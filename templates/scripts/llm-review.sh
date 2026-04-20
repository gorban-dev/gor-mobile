#!/bin/bash
# Review a file using local LLM via LM Studio (with thinking/reasoning)
# Auto-loads the model if not already loaded
# Usage: llm-review.sh <file_path> [focus] [model]
# Returns: review text to stdout (reasoning is used internally, not printed)
#
# Environment:
#   LLM_URL            - API base URL (default: http://127.0.0.1:1234)
#   LLM_MODEL          - model identifier (default: google/gemma-4-26b-a4b)
#   LLM_CONTEXT_LENGTH - context window size (default: 65536)

source "$(dirname "$0")/llm-config.sh"

FILE="$1"
FOCUS="${2:-general code quality}"
# Allow per-call model override via 3rd arg
if [ -n "$3" ]; then
  LLM_MODEL="$3"
fi

# Health check mode
if [ -z "$FILE" ] || [ "$FILE" = "/dev/null" ]; then
  bash "$(dirname "$0")/llm-check.sh"
  exit 0
fi

if [ ! -f "$FILE" ]; then
  echo "File not found: $FILE" >&2
  exit 1
fi

# Check server
if ! curl -s --max-time 2 "$LLM_URL" > /dev/null 2>&1; then
  echo "LLM_UNAVAILABLE"
  exit 0
fi

# Auto-load model with correct context length
llm_ensure_loaded

FILENAME=$(basename "$FILE")

python3 - "$LLM_URL" "$LLM_MODEL" "$FILE" "$FILENAME" "$FOCUS" <<'PYEOF'
import sys, json, urllib.request, os

url, model, filepath, filename, focus = sys.argv[1:6]
content = open(filepath).read()

prompt = f"""/think
Review the file '{filename}'. Focus on: {focus}.
Report ONLY confirmed issues. Be concise — no filler, no praise, just findings.

File content:
{content}"""

try:
    data = json.dumps({
        "model": model,
        "max_tokens": int(os.environ.get("LLM_MAX_TOKENS_REVIEW", "16384")),
        "messages": [{"role": "user", "content": prompt}],
        "temperature": float(os.environ.get("LLM_TEMPERATURE", "0.7")),
        "top_p": float(os.environ.get("LLM_TOP_P", "0.95")),
        "top_k": int(os.environ.get("LLM_TOP_K", "60")),
        "min_p": float(os.environ.get("LLM_MIN_P", "0.0"))
    }).encode()
    req = urllib.request.Request(
        f"{url}/v1/chat/completions", data=data,
        headers={"Content-Type": "application/json"}
    )
    resp = json.loads(urllib.request.urlopen(req, timeout=300).read())
    msg = resp["choices"][0]["message"]
    answer = msg.get("content", "")
    if answer.strip():
        print(answer)
    else:
        # Fallback: if answer empty, model used all tokens on thinking
        reasoning = msg.get("reasoning_content", "")
        if reasoning:
            print("LLM_THINKING_OVERFLOW: model used all tokens on reasoning, increase max_tokens or simplify prompt")
        else:
            print("LLM_ERROR: empty response")
except Exception as e:
    print(f"LLM_ERROR: {e}", file=sys.stderr)
    sys.exit(1)
PYEOF
