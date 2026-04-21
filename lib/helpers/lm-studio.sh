#!/usr/bin/env bash
# LM Studio interaction: server health, model loading, REST chat completions.
# Ported pattern from /tmp/android-llm-bench/run-bench.sh.

# shellcheck source=../constants.sh
source "$GOR_MOBILE_ROOT/lib/constants.sh"
# shellcheck source=detect-deps.sh
source "$GOR_MOBILE_ROOT/lib/helpers/detect-deps.sh"

_lms() {
    local bin; bin="$(dep_lms_path 2>/dev/null || true)"
    [[ -n "$bin" ]] || { log_err "lms CLI not found — install LM Studio"; return 1; }
    "$bin" "$@"
}

lm_server_up() {
    curl -sS --max-time 2 "$LLM_URL/v1/models" >/dev/null 2>&1
}

lm_server_start() {
    if lm_server_up; then
        return 0
    fi
    log_info "Starting LM Studio server..."
    _lms server start >/dev/null 2>&1 || { log_err "lms server start failed"; return 1; }
    local tries=0
    until lm_server_up; do
        tries=$((tries + 1))
        if (( tries > 15 )); then
            log_err "LM Studio server failed to come up in 15s"
            return 1
        fi
        sleep 1
    done
}

lm_loaded_identifier() {
    _lms ps --json 2>/dev/null | jq -r '.[0].identifier // .[0].modelKey // empty'
}

# List modelKey values of installed LLMs (excluding embedding models).
lm_list_installed_llms() {
    _lms ls --json 2>/dev/null | jq -r '.[] | select(.type=="llm") | .modelKey' 2>/dev/null || true
}

lm_ensure_model_loaded() {
    local model_id="$1" ctx="${2:-$LLM_CONTEXT_LENGTH}"
    local current; current="$(lm_loaded_identifier 2>/dev/null || true)"
    if [[ "$current" == "$model_id" ]]; then
        return 0
    fi
    log_info "Loading $model_id (ctx=$ctx)..."
    _lms unload --all >/dev/null 2>&1 || true
    _lms load "$model_id" -c "$ctx" --yes >/dev/null 2>&1 || {
        log_err "Failed to load $model_id"
        return 1
    }
}

# Send a chat completion. Prints raw response JSON to stdout.
# Usage: lm_chat <model-id> <prompt-file> [max-tokens] [temperature]
lm_chat() {
    local model="$1" prompt_file="$2"
    local max_tokens="${3:-$LLM_MAX_TOKENS}"
    local temperature="${4:-$LLM_TEMPERATURE}"
    local prompt; prompt="$(cat "$prompt_file")"

    local body; body="$(jq -n \
        --arg model "$model" \
        --arg content "$prompt" \
        --argjson temp "$temperature" \
        --argjson max "$max_tokens" \
        '{
            model: $model,
            temperature: $temp,
            max_tokens: $max,
            stream: false,
            messages: [{ role: "user", content: $content }]
        }')"

    curl -sS --max-time 600 \
        -X POST "$LLM_URL/v1/chat/completions" \
        -H "Content-Type: application/json" \
        -d "$body"
}
