#!/bin/bash
# Analyze multiple files together using local LLM via LM Studio (with thinking/reasoning)
# Auto-loads the model if not already loaded
# Usage: llm-analyze.sh <task> <file1> <file2> ... [--model MODEL]
# Returns: analysis text to stdout
#
# Environment:
#   LLM_URL            - API base URL (default: http://127.0.0.1:1234)
#   LLM_MODEL          - model identifier (default: google/gemma-4-26b-a4b)
#   LLM_CONTEXT_LENGTH - context window size (default: 65536)

source "$(dirname "$0")/llm-config.sh"

# Parse arguments
TASK="$1"
shift

if [ -z "$TASK" ]; then
  echo "Usage: llm-analyze.sh <task> <file1> <file2> ... [--model MODEL]" >&2
  exit 1
fi

FILES=()
while [ $# -gt 0 ]; do
  if [ "$1" = "--model" ]; then
    LLM_MODEL="$2"
    shift 2
  else
    FILES+=("$1")
    shift
  fi
done

if [ ${#FILES[@]} -eq 0 ]; then
  echo "No files provided" >&2
  exit 1
fi

# Check server
if ! curl -s --max-time 2 "$LLM_URL" > /dev/null 2>&1; then
  echo "LLM_UNAVAILABLE"
  exit 0
fi

# Auto-load model with correct context length
llm_ensure_loaded

# Build file content for python
FILE_ARGS=""
for FILE in "${FILES[@]}"; do
  FILE_ARGS+="$FILE "
done

python3 - "$LLM_URL" "$LLM_MODEL" "$TASK" $FILE_ARGS <<'PYEOF'
import sys, json, urllib.request, os

url = sys.argv[1]
model = sys.argv[2]
task = sys.argv[3]
files = sys.argv[4:]

prompt = f"/think\nTask: {task}\nReport ONLY confirmed issues. Be concise.\n\nFiles to analyze:\n"
for filepath in files:
    filename = os.path.basename(filepath)
    if os.path.isfile(filepath):
        content = open(filepath).read()
        prompt += f"\n--- {filename} ---\n{content}\n"
    else:
        prompt += f"\n--- {filename} (NOT FOUND) ---\n"

try:
    data = json.dumps({
        "model": model,
        "max_tokens": int(os.environ.get("LLM_MAX_TOKENS_ANALYZE", "16384")),
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
        reasoning = msg.get("reasoning_content", "")
        if reasoning:
            print("LLM_THINKING_OVERFLOW: model used all tokens on reasoning, reduce number of files or simplify task")
        else:
            print("LLM_ERROR: empty response")
except Exception as e:
    print(f"LLM_ERROR: {e}", file=sys.stderr)
    sys.exit(1)
PYEOF
