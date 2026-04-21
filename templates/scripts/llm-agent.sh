#!/bin/bash
# Run a local LLM agent with file access tools
# The LLM autonomously reads files and directories — Claude only receives the final answer
# Usage: llm-agent.sh "<task description>" [working_dir]
# Returns: agent's final answer to stdout
#
# Environment:
#   LLM_URL            - API base URL (default: http://127.0.0.1:1234)
#   LLM_MODEL          - model identifier (default: google/gemma-4-26b-a4b)
#   LLM_CONTEXT_LENGTH - context window size (default: 65536)

source "$(dirname "$0")/llm-config.sh"

TASK="$1"
WORKDIR="${2:-$(pwd)}"

# Check server
if ! curl -s --max-time 2 "$LLM_URL" > /dev/null 2>&1; then
  echo "LLM_UNAVAILABLE"
  exit 0
fi

# Empty task = availability check only
if [ -z "$TASK" ]; then
  echo "LLM_AVAILABLE"
  exit 0
fi

# Auto-load model with correct context length
llm_ensure_loaded

python3 - "$LLM_URL" "$LLM_MODEL" "$TASK" "$WORKDIR" <<'PYEOF'
import sys, json, urllib.request, os, subprocess

url = sys.argv[1]
model = sys.argv[2]
task = sys.argv[3]
workdir = sys.argv[4]

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Read the contents of a file. Use this to examine source code, configs, or any text file.",
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
            "description": "List files and directories at a path. Returns names with / suffix for directories.",
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
            "name": "git_log",
            "description": "Show git commit history. Use to understand recent changes, find when a file was modified, or trace who changed what.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "File or directory to show history for (optional, empty for all)"},
                    "count": {"type": "integer", "description": "Number of commits to show (default: 10)"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "git_diff",
            "description": "Show changes in the working directory or between commits. Use to review what was modified.",
            "parameters": {
                "type": "object",
                "properties": {
                    "ref": {"type": "string", "description": "Git ref to diff against (e.g. 'HEAD~3', 'main', a commit hash). Default: staged + unstaged changes."}
                }
            }
        }
    }
]

def execute_tool(name, args):
    try:
        if name == "read_file":
            filepath = os.path.join(workdir, args["path"])
            if not os.path.isfile(filepath):
                return f"Error: File not found: {args['path']}"
            with open(filepath) as f:
                content = f.read()
            # Limit file size to prevent context overflow
            max_size = 8000 if total_tool_content > 10000 else 15000
            if len(content) > max_size:
                content = content[:max_size] + f"\n... (truncated at {max_size} chars, {len(content)} total)"
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

        elif name == "git_log":
            cmd = ["git", "-C", workdir, "log", "--oneline",
                   f"-{args.get('count', 10)}"]
            path = args.get("path", "")
            if path:
                cmd += ["--", path]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
            return result.stdout or "No git history found"

        elif name == "git_diff":
            ref = args.get("ref", "")
            # Return stat summary only — agent should use read_file for specific files
            cmd = ["git", "-C", workdir, "diff", "--stat"]
            if ref:
                cmd.append(ref)
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
            output = result.stdout
            if not output:
                return "No changes found"
            return f"{output}\nTo see the actual changes, use read_file on the files listed above."

    except Exception as e:
        return f"Error: {e}"

# Split stable instructions from variable task for better prefix-cache hit rate.
# System message is fully static → cached across sessions.
# User message keeps workdir (semi-static per project) before task (fully variable).
messages = [
    {"role": "system", "content": "/no_think\nYou have tools to read files, search code, and check git history. Use them to investigate, then give a concise final answer. Be efficient — don't read files you don't need."},
    {"role": "user", "content": f"Working directory: {workdir}\n\nTask: {task}"}
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
    # Thinking is off (/no_think) for multi-turn agent to prevent context overflow
    # Lower temperature when context grows large for more focused responses
    use_think = total_tool_content < LONG_CTX_THRESHOLD

    data = json.dumps({
        "model": model,
        "max_tokens": int(os.environ.get("LLM_MAX_TOKENS_AGENT", "4096")),
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
        print(f"LLM_ERROR: {e}", file=sys.stderr)
        sys.exit(1)

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

    # Check if model wants to call tools
    tool_calls = msg.get("tool_calls", [])
    if not tool_calls:
        metrics["exit_reason"] = "final_answer"
        _emit_metrics()
        # No tool calls — this is the final answer
        content = msg.get("content", "")
        reasoning = msg.get("reasoning_content", "")
        if content.strip():
            print(content)
        elif reasoning.strip():
            # Thinking overflow — extract useful content from reasoning
            print(reasoning)
        else:
            print("LLM_ERROR: empty response")
        break

    # Execute tool calls and add results
    for tc in tool_calls:
        fn_name = tc["function"]["name"]
        fn_args = json.loads(tc["function"]["args"] if "args" in tc["function"] else tc["function"].get("arguments", "{}"))
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
    print("LLM_ERROR: max iterations reached", file=sys.stderr)
    sys.exit(1)
PYEOF
