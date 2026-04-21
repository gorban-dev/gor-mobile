#!/bin/bash
# Run a local LLM implementation agent with file read/write tools
# Extends llm-agent.sh with write_file, pre-loaded context, and STATUS parsing
# Usage: llm-implement.sh <task-file> <working-dir> <allowed-files> [ref-file1] [ref-file2] ...
# Returns: JSON status to stdout (matching codex-status-schema.json)
#
# Arguments:
#   task-file     - Path to a text file containing the task description
#   working-dir   - Project root directory
#   allowed-files - Comma-separated list of file paths write_file may create/modify
#   ref-file*     - Reference files to pre-load into system prompt context
#
# Environment:
#   LLM_URL            - API base URL (default from llm-config.sh)
#   LLM_MODEL          - model identifier (default from llm-config.sh)
#   LLM_CONTEXT_LENGTH - context window size (default from llm-config.sh)

source "$(dirname "$0")/llm-config.sh"

TASK_FILE="$1"
WORKDIR="$2"
ALLOWED_FILES="$3"
shift 3
REF_FILES=("$@")

if [ -z "$TASK_FILE" ] || [ -z "$WORKDIR" ] || [ -z "$ALLOWED_FILES" ]; then
  echo '{"status":"BLOCKED","severity":"major","summary":"Missing required arguments","files_changed":[],"exports_added":[],"dependencies_added":[],"concerns":"Usage: llm-implement.sh <task-file> <working-dir> <allowed-files> [ref-files...]","notes":"","deviations":"","routing_hint":""}'
  exit 0
fi

if [ ! -f "$TASK_FILE" ]; then
  echo '{"status":"BLOCKED","severity":"major","summary":"Task file not found","files_changed":[],"exports_added":[],"dependencies_added":[],"concerns":"Task file not found: '"$TASK_FILE"'","notes":"","deviations":"","routing_hint":""}'
  exit 0
fi

# File-size precheck: large files exceed Gemma's reliable in-place editing range.
# Empirically a single ~500 LOC file or combined ref+allowed >2500 LOC pushes timeouts.
# This is ADVISORY (routing_hint) not blocking — the orchestrator decides whether to escalate.
ROUTING_HINT=""
PRECHECK_REASONS=""
MAX_SINGLE_LOC=0
COMBINED_LOC=0
IFS=',' read -ra _ALLOWED_PATHS <<< "$ALLOWED_FILES"
for _f in "${_ALLOWED_PATHS[@]}"; do
  _full="$WORKDIR/$_f"
  if [ -f "$_full" ]; then
    _loc=$(wc -l < "$_full" | tr -d ' ')
    COMBINED_LOC=$((COMBINED_LOC + _loc))
    if [ "$_loc" -gt "$MAX_SINGLE_LOC" ]; then
      MAX_SINGLE_LOC="$_loc"
    fi
  fi
done
for _ref in "${REF_FILES[@]}"; do
  if [ -f "$_ref" ]; then
    _loc=$(wc -l < "$_ref" | tr -d ' ')
    COMBINED_LOC=$((COMBINED_LOC + _loc))
  fi
done
if [ "$MAX_SINGLE_LOC" -gt 480 ]; then
  ROUTING_HINT="consider-sonnet"
  PRECHECK_REASONS="single allowed file is $MAX_SINGLE_LOC LOC (>480 LOC threshold for reliable Gemma in-place editing)"
fi
if [ "$COMBINED_LOC" -gt 2500 ]; then
  ROUTING_HINT="consider-sonnet"
  if [ -n "$PRECHECK_REASONS" ]; then
    PRECHECK_REASONS="$PRECHECK_REASONS; combined ref+allowed is $COMBINED_LOC LOC (>2500 LOC threshold)"
  else
    PRECHECK_REASONS="combined ref+allowed is $COMBINED_LOC LOC (>2500 LOC threshold)"
  fi
fi
export ROUTING_HINT PRECHECK_REASONS

# Check server
if ! curl -s --max-time 2 "$LLM_URL" > /dev/null 2>&1; then
  # Use Python to safely emit JSON (avoids shell-escaping pitfalls when ROUTING_HINT/PRECHECK_REASONS contain special chars)
  python3 -c "
import json, os
print(json.dumps({
  'status': 'BLOCKED', 'severity': 'major',
  'summary': 'LLM unavailable',
  'files_changed': [], 'exports_added': [], 'dependencies_added': [],
  'concerns': 'LM Studio not running on $LLM_URL',
  'notes': '', 'deviations': '',
  'routing_hint': os.environ.get('ROUTING_HINT', ''),
  'routing_hint_reasons': os.environ.get('PRECHECK_REASONS', '')
}))"
  exit 0
fi

# Auto-load model
llm_ensure_loaded

# Write ref file paths to a temp file for Python to read
REF_LIST_FILE=$(mktemp)
for ref in "${REF_FILES[@]}"; do
  echo "$ref" >> "$REF_LIST_FILE"
done

python3 - "$LLM_URL" "$LLM_MODEL" "$WORKDIR" "$ALLOWED_FILES" "$TASK_FILE" "$REF_LIST_FILE" <<'PYEOF'
import sys, json, urllib.request, os, subprocess, re

url = sys.argv[1]
model = sys.argv[2]
workdir = sys.argv[3]
allowed_files = set(sys.argv[4].split(","))
task_file = sys.argv[5]
ref_list_file = sys.argv[6]

# Read task description
with open(task_file) as f:
    TASK_CONTENT = f.read()

# Read shared state (if exists)
shared_state_path = os.path.join(workdir, ".shared-state.md")
SHARED_STATE = ""
if os.path.isfile(shared_state_path):
    with open(shared_state_path) as f:
        SHARED_STATE = f.read()[:4000]

# Read reference files (max 20K chars total)
REF_CONTENT = ""
ref_total = 0
ref_max = 20000
ref_per_file = 8000
with open(ref_list_file) as f:
    ref_paths = [line.strip() for line in f if line.strip()]
for ref_path in ref_paths:
    if os.path.isfile(ref_path):
        with open(ref_path) as f:
            content = f.read()[:ref_per_file]
        if ref_total + len(content) > ref_max:
            break
        REF_CONTENT += f"\n--- REFERENCE: {os.path.basename(ref_path)} ---\n{content}\n--- END REFERENCE ---\n"
        ref_total += len(content)
os.unlink(ref_list_file)

SYSTEM_PROMPT = """You are a senior developer implementing code for a project.

## Rules
- Follow existing patterns exactly as shown in the reference files
- Use named exports only (no default exports)
- Follow TypeScript best practices with proper typing
- Respect architecture module boundaries
- **Tool choice:** use `edit_file` for modifying existing files (exact substring replacement — no regeneration, no length limit). Use `write_file` ONLY to create brand-new files that do not yet exist. Never use `write_file` to rewrite an existing file — it forces full-content regeneration and causes truncation / stochastic substitutions on files larger than ~150 LOC.
- Use `read_file`, `list_dir`, `search_code` to explore the codebase when needed

## Signature Verification (REQUIRED before write_file or edit_file)
Before calling write_file or edit_file on a file that imports custom components/enums/utils from the codebase: if the task description doesn't show you the exact prop interface, default-vs-named export, or enum members — read_file the source ONCE to confirm. Cap reads at 1-2 per file you're about to write.

Common pitfalls to verify:
- Component prop names (e.g. `fulfillmentStatus` not `status`, `orderSource` not `source`)
- Default vs named exports (e.g. `import OrdersPageSkeleton from './X'` not `import { OrdersPageSkeleton }`)
- Enum members (e.g. DateFormats has SHORT/LONG/SYSTEM/DETAILED — NOT DISPLAY)
- Whether a component is re-exported from a barrel `@/domain/X/ui/index.ts`

## Output Format
After completing your work, you MUST end with a STATUS block in this exact format:

--- STATUS ---
status: DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED
severity: none | minor | major
files_changed: ["path/to/file1.ts", "path/to/file2.ts"]
exports_added: ["ExportName1", "ExportName2"]
concerns: none | description of concerns
notes: optional notes for orchestrator
deviations: none | EXPLICIT description of any place you intentionally diverged from the task instructions (e.g. "kept local isValidImageUrl in GenericRssParser because extractImageFromHtml needs a positive-match validator with different semantics than the shared one")
--- END STATUS ---

**`deviations` is MANDATORY.** If you followed the task verbatim with no judgment calls, write `deviations: none`. If you skipped, renamed, or kept something the task told you to remove/change because doing so verbatim would have broken the build or produced wrong semantics, you MUST describe what you did and WHY. The orchestrator uses this field to spot-check your judgment without re-reading every file.

## Reference Files (study these patterns)
""" + REF_CONTENT + """

## Current Shared State
""" + (SHARED_STATE or "(empty)") + """

## Task
""" + TASK_CONTENT

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Read the contents of a file.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Relative path from project root"}
                },
                "required": ["path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_dir",
            "description": "List files and directories at a path.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Relative path from project root (use '.' for root)"}
                },
                "required": ["path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_code",
            "description": "Search for a pattern in files. Returns matching lines with file paths.",
            "parameters": {
                "type": "object",
                "properties": {
                    "pattern": {"type": "string", "description": "Search pattern (regex supported)"},
                    "path": {"type": "string", "description": "Directory to search in (default: '.')"}
                },
                "required": ["pattern"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "write_file",
            "description": "Create a NEW file. Do NOT use for modifying existing files — use edit_file instead. write_file sends the full content and regenerating a large existing file causes truncation and stochastic substitutions.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Relative path from project root"},
                    "content": {"type": "string", "description": "Full file content to write"}
                },
                "required": ["path", "content"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "edit_file",
            "description": "Replace an exact substring in an existing file. PREFERRED for any modification of existing files: sends only the change, no whole-file regeneration, no length limits. old_string must match exactly once (whitespace, case, newlines included). On no-match or multi-match the call returns an error — widen or narrow the context and retry. Call multiple times for multiple edits in the same file.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Relative path from project root"},
                    "old_string": {"type": "string", "description": "Exact substring currently in the file (must appear exactly once)"},
                    "new_string": {"type": "string", "description": "Replacement substring (may be empty to delete)"}
                },
                "required": ["path", "old_string", "new_string"]
            }
        }
    }
]

files_written = []

def execute_tool(name, args):
    global files_written
    try:
        if name == "read_file":
            filepath = os.path.join(workdir, args["path"])
            if not os.path.isfile(filepath):
                return f"Error: File not found: {args['path']}"
            with open(filepath) as f:
                content = f.read()
            max_size = 8000 if total_tool_content > 10000 else 15000
            if len(content) > max_size:
                content = content[:max_size] + f"\n... (truncated at {max_size} chars)"
            return content

        elif name == "list_dir":
            dirpath = os.path.join(workdir, args["path"])
            if not os.path.isdir(dirpath):
                return f"Error: Directory not found: {args['path']}"
            entries = []
            for entry in sorted(os.listdir(dirpath)):
                full = os.path.join(dirpath, entry)
                if entry.startswith('.'):
                    continue
                entries.append(f"{entry}/" if os.path.isdir(full) else entry)
            return "\n".join(entries[:100])

        elif name == "search_code":
            search_path = os.path.join(workdir, args.get("path", "."))
            result = subprocess.run(
                ["grep", "-rn", "--include=*.ts", "--include=*.tsx", "--include=*.md",
                 args["pattern"], search_path],
                capture_output=True, text=True, timeout=10
            )
            output = result.stdout
            if len(output) > 10000:
                output = output[:10000] + "\n... (truncated)"
            return output or "No matches found"

        elif name == "write_file":
            rel_path = args["path"]
            # Path restriction: no absolute paths, no traversal
            if rel_path.startswith("/") or ".." in rel_path:
                return f"ERROR: path must be relative and cannot contain '..'. Got: {rel_path}"
            # Scope restriction: check allowed list
            if rel_path not in allowed_files:
                return f"ERROR: path not in task scope. Allowed: {', '.join(allowed_files)}. If this file is necessary, report NEEDS_CONTEXT with the path in your concerns."
            filepath = os.path.join(workdir, rel_path)
            # Guard: write_file is for CREATE only. Redirect to edit_file on existing files.
            if os.path.isfile(filepath):
                return f"ERROR: {rel_path} already exists. Use edit_file for modifications — write_file is for new files only. Regenerating an existing file risks truncation and stochastic substitutions."
            # Create parent directories
            os.makedirs(os.path.dirname(filepath), exist_ok=True)
            # Atomic write: temp file + rename
            tmp_path = filepath + ".tmp"
            with open(tmp_path, "w") as f:
                f.write(args["content"])
            os.rename(tmp_path, filepath)
            files_written.append(rel_path)
            return f"OK: wrote {len(args['content'])} chars to {rel_path}"

        elif name == "edit_file":
            rel_path = args["path"]
            old = args["old_string"]
            new = args["new_string"]
            if rel_path.startswith("/") or ".." in rel_path:
                return f"ERROR: path must be relative and cannot contain '..'. Got: {rel_path}"
            if rel_path not in allowed_files:
                return f"ERROR: path not in task scope. Allowed: {', '.join(allowed_files)}. If this file is necessary, report NEEDS_CONTEXT with the path in your concerns."
            filepath = os.path.join(workdir, rel_path)
            if not os.path.isfile(filepath):
                return f"ERROR: file does not exist: {rel_path}. Use write_file to create new files."
            if old == new:
                return f"ERROR: old_string and new_string are identical — nothing to do."
            with open(filepath) as f:
                original = f.read()
            count = original.count(old)
            if count == 0:
                return f"ERROR: old_string not found in {rel_path}. Must match exactly (whitespace, case, newlines). read_file to confirm current content."
            if count > 1:
                return f"ERROR: old_string matches {count} times in {rel_path}. Add surrounding context to make the match unique."
            updated = original.replace(old, new, 1)
            tmp_path = filepath + ".tmp"
            with open(tmp_path, "w") as f:
                f.write(updated)
            os.rename(tmp_path, filepath)
            if rel_path not in files_written:
                files_written.append(rel_path)
            return f"OK: replaced {len(old)} chars with {len(new)} chars in {rel_path}"

    except Exception as e:
        return f"Error: {e}"

messages = [
    {"role": "system", "content": SYSTEM_PROMPT},
    {"role": "user", "content": "/no_think\nImplement the task described above. Use the reference files as patterns. Use edit_file to modify existing files and write_file to create new ones (never use write_file on a file that already exists). End with the STATUS block."}
]

MAX_ITERATIONS = 25
total_tool_content = 0

import time
metrics = {
    "iterations": 0,
    "tool_calls": {},
    "iteration_timings_s": [],
    "iteration_prompt_tokens": [],
    "iteration_completion_tokens": [],
    "total_prompt_tokens": 0,
    "total_completion_tokens": 0,
    "exit_reason": None,
    "wall_clock_total_s": None,
}
_metrics_start = time.time()

def _emit_metrics():
    metrics["wall_clock_total_s"] = round(time.time() - _metrics_start, 2)
    metrics_path = os.environ.get("LLM_METRICS_FILE")
    if metrics_path:
        try:
            with open(metrics_path, "w") as f:
                json.dump(metrics, f, indent=2)
        except Exception:
            pass
    print(f"METRICS: {json.dumps(metrics)}", file=sys.stderr)

LONG_CTX_THRESHOLD = int(os.environ.get("LLM_LONG_CTX_THRESHOLD", "20000"))
TEMP_DEFAULT = float(os.environ.get("LLM_TEMPERATURE", "0.7"))
TEMP_LONG_CTX = float(os.environ.get("LLM_TEMPERATURE_LONG_CTX", "0.3"))

for i in range(MAX_ITERATIONS):
    use_think = total_tool_content < LONG_CTX_THRESHOLD

    data = json.dumps({
        "model": model,
        "max_tokens": int(os.environ.get("LLM_MAX_TOKENS_IMPLEMENT", "8192")),
        "messages": messages,
        "tools": TOOLS,
        "temperature": TEMP_DEFAULT if use_think else TEMP_LONG_CTX,
        "top_p": float(os.environ.get("LLM_TOP_P", "0.95")),
        "top_k": int(os.environ.get("LLM_TOP_K", "60")),
        "min_p": float(os.environ.get("LLM_MIN_P", "0.0"))
    }).encode()

    req = urllib.request.Request(
        f"{url}/v1/chat/completions", data=data,
        headers={"Content-Type": "application/json"}
    )

    _iter_start = time.time()
    try:
        resp = json.loads(urllib.request.urlopen(req, timeout=600).read())
    except Exception as e:
        metrics["exit_reason"] = f"api_error: {e}"
        _emit_metrics()
        print(json.dumps({
            "status": "BLOCKED", "severity": "major",
            "summary": f"LLM API error: {e}",
            "files_changed": files_written, "exports_added": [],
            "dependencies_added": [], "concerns": str(e), "notes": "",
            "deviations": "",
            "routing_hint": os.environ.get("ROUTING_HINT", ""),
            "routing_hint_reasons": os.environ.get("PRECHECK_REASONS", "")
        }))
        sys.exit(0)

    metrics["iterations"] += 1
    metrics["iteration_timings_s"].append(round(time.time() - _iter_start, 2))
    _usage = resp.get("usage", {})
    metrics["iteration_prompt_tokens"].append(_usage.get("prompt_tokens", 0))
    metrics["iteration_completion_tokens"].append(_usage.get("completion_tokens", 0))
    metrics["total_prompt_tokens"] += _usage.get("prompt_tokens", 0)
    metrics["total_completion_tokens"] += _usage.get("completion_tokens", 0)

    choice = resp["choices"][0]
    msg = choice["message"]
    messages.append(msg)

    tool_calls = msg.get("tool_calls", [])
    if not tool_calls:
        metrics["exit_reason"] = "final_answer"
        _emit_metrics()
        # Final answer — parse STATUS block
        content = msg.get("content", "") or msg.get("reasoning_content", "")
        status_match = re.search(r'--- STATUS ---\s*\n(.*?)\n--- END STATUS ---', content, re.DOTALL)
        if status_match:
            status_text = status_match.group(1)
            # Parse key-value pairs
            def extract(key, default=""):
                m = re.search(rf'^{key}:\s*(.+)$', status_text, re.MULTILINE)
                return m.group(1).strip() if m else default

            status_val = extract("status", "DONE_WITH_CONCERNS")
            severity_val = extract("severity", "minor")
            concerns_val = extract("concerns", "none")
            notes_val = extract("notes", "")
            deviations_val = extract("deviations", "none")

            # Parse array fields
            fc_match = re.search(r'files_changed:\s*\[([^\]]*)\]', status_text)
            fc = [f.strip().strip('"').strip("'") for f in fc_match.group(1).split(",") if f.strip()] if fc_match else files_written

            ea_match = re.search(r'exports_added:\s*\[([^\]]*)\]', status_text)
            ea = [e.strip().strip('"').strip("'") for e in ea_match.group(1).split(",") if e.strip()] if ea_match else []

            routing_hint = os.environ.get("ROUTING_HINT", "")
            precheck_reasons = os.environ.get("PRECHECK_REASONS", "")

            print(json.dumps({
                "status": status_val,
                "severity": severity_val,
                "summary": f"Implemented task with {len(files_written)} file(s) written",
                "files_changed": fc if fc else files_written,
                "exports_added": ea,
                "dependencies_added": [],
                "concerns": concerns_val if concerns_val != "none" else "",
                "notes": notes_val,
                "deviations": deviations_val if deviations_val != "none" else "",
                "routing_hint": routing_hint,
                "routing_hint_reasons": precheck_reasons
            }))
        else:
            # No STATUS block via regex — fall back to JSON Schema mode
            # This handles cases where Gemma's STATUS block was malformed or truncated.
            schema_messages = list(messages) + [{
                "role": "user",
                "content": "Output the implementation status as JSON conforming to the schema. Be honest about status (DONE if everything compiled, DONE_WITH_CONCERNS if minor issues remain, BLOCKED if you couldn't complete)."
            }]
            schema_payload = json.dumps({
                "model": model,
                "max_tokens": 1024,
                "messages": schema_messages,
                "temperature": 0.1,
                "top_p": 0.95,
                "top_k": 64,
                "min_p": 0.0,
                "response_format": {
                    "type": "json_schema",
                    "json_schema": {
                        "name": "implement_status",
                        "strict": True,
                        "schema": {
                            "type": "object",
                            "properties": {
                                "status": {"type": "string", "enum": ["DONE", "DONE_WITH_CONCERNS", "NEEDS_CONTEXT", "BLOCKED"]},
                                "severity": {"type": "string", "enum": ["none", "minor", "major"]},
                                "files_changed": {"type": "array", "items": {"type": "string"}},
                                "exports_added": {"type": "array", "items": {"type": "string"}},
                                "concerns": {"type": "string"},
                                "notes": {"type": "string"},
                                "deviations": {"type": "string"}
                            },
                            "required": ["status", "severity", "files_changed", "exports_added", "concerns", "notes", "deviations"]
                        }
                    }
                }
            }).encode()
            schema_req = urllib.request.Request(f"{url}/v1/chat/completions", data=schema_payload, headers={"Content-Type": "application/json"})
            try:
                schema_resp = json.loads(urllib.request.urlopen(schema_req, timeout=180).read())
                schema_content = schema_resp["choices"][0]["message"].get("content", "{}")
                parsed = json.loads(schema_content)
                metrics["json_schema_fallback"] = True
                print(json.dumps({
                    "status": parsed.get("status", "DONE_WITH_CONCERNS"),
                    "severity": parsed.get("severity", "minor"),
                    "summary": f"Implemented task with {len(files_written)} file(s) written (status via JSON schema fallback)",
                    "files_changed": parsed.get("files_changed") or files_written,
                    "exports_added": parsed.get("exports_added", []),
                    "dependencies_added": [],
                    "concerns": parsed.get("concerns", ""),
                    "notes": parsed.get("notes", ""),
                    "deviations": parsed.get("deviations", ""),
                    "routing_hint": os.environ.get("ROUTING_HINT", ""),
                    "routing_hint_reasons": os.environ.get("PRECHECK_REASONS", "")
                }))
            except Exception as schema_err:
                # Even JSON schema failed — last-resort default
                metrics["json_schema_fallback"] = f"failed: {schema_err}"
                print(json.dumps({
                    "status": "DONE_WITH_CONCERNS",
                    "severity": "minor",
                    "summary": f"Completed but STATUS block + JSON fallback both failed. {len(files_written)} file(s) written.",
                    "files_changed": files_written,
                    "exports_added": [],
                    "dependencies_added": [],
                    "concerns": f"LLM did not produce STATUS block, JSON fallback also failed: {schema_err}",
                    "notes": content[:500] if content else "",
                    "deviations": "",
                    "routing_hint": os.environ.get("ROUTING_HINT", ""),
                    "routing_hint_reasons": os.environ.get("PRECHECK_REASONS", "")
                }))
        break

    # Execute tool calls
    for tc in tool_calls:
        fn_name = tc["function"]["name"]
        fn_args = json.loads(tc["function"].get("args") or tc["function"].get("arguments", "{}"))
        result = execute_tool(fn_name, fn_args)
        total_tool_content += len(result)
        metrics["tool_calls"][fn_name] = metrics["tool_calls"].get(fn_name, 0) + 1
        messages.append({
            "role": "tool",
            "tool_call_id": tc["id"],
            "content": result
        })
else:
    metrics["exit_reason"] = "max_iterations"
    _emit_metrics()
    print(json.dumps({
        "status": "DONE_WITH_CONCERNS", "severity": "minor",
        "summary": f"Max iterations reached. {len(files_written)} file(s) written.",
        "files_changed": files_written, "exports_added": [],
        "dependencies_added": [],
        "concerns": "Max iterations (25) reached before LLM produced final answer",
        "notes": "",
        "deviations": "",
        "routing_hint": os.environ.get("ROUTING_HINT", ""),
        "routing_hint_reasons": os.environ.get("PRECHECK_REASONS", "")
    }))
PYEOF
