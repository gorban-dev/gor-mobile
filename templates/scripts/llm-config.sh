#!/bin/bash
# Shared LLM configuration — sourced by all llm-*.sh scripts
# Override any variable by setting it in the environment before running a script.
#
# Usage (in other scripts): source "$(dirname "$0")/llm-config.sh"

export LLM_MODEL="${LLM_MODEL:-google/gemma-4-26b-a4b}"
export LLM_URL="${LLM_URL:-http://127.0.0.1:1234}"
export LLM_CONTEXT_LENGTH="${LLM_CONTEXT_LENGTH:-131072}"
export LMS="${LMS:-${HOME}/.lmstudio/bin/lms}"

# Inference settings (optimal for Gemma 4 26B A4B, validated 2026-04-18
# via rubric-scored quality sweep — achieved 20/20 perfect on 3 hard code tests)
export LLM_TEMPERATURE="${LLM_TEMPERATURE:-0.7}"
export LLM_TEMPERATURE_LONG_CTX="${LLM_TEMPERATURE_LONG_CTX:-0.3}"
export LLM_TOP_P="${LLM_TOP_P:-0.95}"
export LLM_TOP_K="${LLM_TOP_K:-60}"
export LLM_MIN_P="${LLM_MIN_P:-0.0}"
export LLM_LONG_CTX_THRESHOLD="${LLM_LONG_CTX_THRESHOLD:-80000}"

# Per-use-case max_tokens (thinking tokens count against this budget)
export LLM_MAX_TOKENS_ANALYZE="${LLM_MAX_TOKENS_ANALYZE:-16384}"
export LLM_MAX_TOKENS_REVIEW="${LLM_MAX_TOKENS_REVIEW:-16384}"
export LLM_MAX_TOKENS_IMPLEMENT="${LLM_MAX_TOKENS_IMPLEMENT:-8192}"
export LLM_MAX_TOKENS_AGENT="${LLM_MAX_TOKENS_AGENT:-4096}"

# Extract short model name for grep matching (e.g., "google/gemma-4-26b-a4b" → "gemma-4-26b-a4b")
export LLM_MODEL_SHORT=$(echo "$LLM_MODEL" | sed 's|.*/||')

# Ensure the configured model is loaded with the correct context length.
# Call this from any script that needs the model ready before making API calls.
llm_ensure_loaded() {
  [ -x "$LMS" ] || return 0
  local loaded
  loaded=$("$LMS" ps 2>/dev/null | grep -c "$LLM_MODEL_SHORT")
  if [ "$loaded" -eq 0 ]; then
    "$LMS" load "$LLM_MODEL" -c "$LLM_CONTEXT_LENGTH" 2>/dev/null
  else
    local ctx
    ctx=$("$LMS" ps 2>/dev/null | grep "$LLM_MODEL_SHORT" | grep -oE '\b[0-9]{4,6}\b' | head -1)
    if [ -n "$ctx" ] && [ "$ctx" -lt "$LLM_CONTEXT_LENGTH" ] 2>/dev/null; then
      "$LMS" unload "$LLM_MODEL" 2>/dev/null
      sleep 2
      "$LMS" load "$LLM_MODEL" -c "$LLM_CONTEXT_LENGTH" 2>/dev/null
    fi
  fi
}
