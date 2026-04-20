#!/bin/bash
# Quick LLM availability check — run once at pipeline start
# Returns one line: LLM_AVAILABLE or LLM_UNAVAILABLE with details
# Claude reads this output and skips all LLM steps if unavailable

source "$(dirname "$0")/llm-config.sh"

# Check 1: lms CLI exists
if [ ! -x "$LMS" ]; then
  echo "LLM_UNAVAILABLE: LM Studio CLI not found"
  exit 0
fi

# Check 2: LM Studio server is running
if ! curl -s --max-time 2 "$LLM_URL" > /dev/null 2>&1; then
  echo "LLM_UNAVAILABLE: LM Studio server not running on $LLM_URL"
  exit 0
fi

# Check 3: model is installed
if ! "$LMS" ls 2>/dev/null | grep -q "$LLM_MODEL_SHORT"; then
  echo "LLM_UNAVAILABLE: model $LLM_MODEL not installed"
  exit 0
fi

# Auto-load model with correct context length
llm_ensure_loaded

echo "LLM_AVAILABLE: $LLM_MODEL on $LLM_URL (loaded and ready)"
