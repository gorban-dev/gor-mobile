#!/usr/bin/env bash
# gor-mobile llm — local-first LLM dispatcher for code generation / review / vision.
#
# Output contract: one JSON object to stdout.
#   { status: OK|BLOCKED|FALLBACK|ERROR, model: <id>|null, content: <string>,
#     tokens: {input, output}, elapsed_ms, reason?: <string> }
# Exit code:
#   0 on OK
#   2 on BLOCKED   (callers should fallback to Opus)
#   3 on ERROR     (runtime failure, also fallback)

# shellcheck source=../constants.sh
source "$GOR_MOBILE_ROOT/lib/constants.sh"
# shellcheck source=../helpers/detect-deps.sh
source "$GOR_MOBILE_ROOT/lib/helpers/detect-deps.sh"
# shellcheck source=../helpers/lm-studio.sh
source "$GOR_MOBILE_ROOT/lib/helpers/lm-studio.sh"

# ──── Routing config ──────────────────────────────────────────────────────

# role → target (local|cloud) @ model
# The model column is the DEFAULT — actual model is resolved via _resolve_model()
# which reads config.json → .models.<role> first, then falls back to this default.
_routing_table_balanced() {
    cat <<EOF
impl:local:$MODEL_DEFAULT_IMPL
tdd-red:local:$MODEL_DEFAULT_IMPL
routine-debug:local:$MODEL_DEFAULT_IMPL
review:local:$MODEL_DEFAULT_REVIEW
review-deep:local:$MODEL_DEFAULT_DEEP
vision:local:$MODEL_DEFAULT_DEEP
analyze:local:$MODEL_DEFAULT_REVIEW
brainstorm:cloud:-
plan:cloud:-
verify:cloud:-
finishing:cloud:-
EOF
}

_routing_table_aggressive_local() {
    _routing_table_balanced | sed 's/cloud:-/local:'"$MODEL_DEFAULT_DEEP"'/'
}

_routing_table_cloud_only() {
    _routing_table_balanced | awk -F: '{print $1":cloud:-"}'
}

# Resolve effective model for a role:
#   1) user override from config.json → .models[<role>]
#   2) fallback to the default supplied by the caller (from routing table)
_resolve_model() {
    local role="$1" default="$2"
    if [[ -f "$GOR_MOBILE_CONFIG" ]]; then
        local override
        override=$(jq -r --arg r "$role" '.models[$r] // empty' "$GOR_MOBILE_CONFIG" 2>/dev/null || true)
        if [[ -n "$override" ]]; then
            echo "$override"
            return
        fi
    fi
    echo "$default"
}

_current_preset() {
    if [[ -f "$GOR_MOBILE_CONFIG" ]]; then
        jq -r '.preset // "balanced"' "$GOR_MOBILE_CONFIG" 2>/dev/null || echo "balanced"
    else
        echo "balanced"
    fi
}

_resolve_routing() {
    local role="$1" preset="$2"
    local table
    case "$preset" in
        aggressive-local) table="$(_routing_table_aggressive_local)" ;;
        cloud-only)       table="$(_routing_table_cloud_only)" ;;
        *)                table="$(_routing_table_balanced)" ;;
    esac
    local line; line="$(echo "$table" | awk -F: -v r="$role" '$1==r{print; exit}')"
    if [[ -z "$line" ]]; then
        echo ":::"
        return
    fi
    echo "$line"
}

# ──── Response emitters ───────────────────────────────────────────────────

_emit() {
    local status="$1" model="$2" content="$3" in_tok="$4" out_tok="$5" elapsed_ms="$6" reason="${7:-}"
    jq -n \
        --arg s "$status" \
        --arg m "$model" \
        --arg c "$content" \
        --argjson i "${in_tok:-0}" \
        --argjson o "${out_tok:-0}" \
        --argjson e "${elapsed_ms:-0}" \
        --arg r "$reason" \
        '{
            status: $s,
            model: (if $m == "" then null else $m end),
            content: $c,
            tokens: {input: $i, output: $o},
            elapsed_ms: $e
        } + (if $r == "" then {} else {reason: $r} end)'
}

# Visible proof-of-delegation: one line to stderr + an append-only JSON audit log.
# The stderr line surfaces in Claude Code transcripts so the user can see the
# local LLM was really invoked (role + model + tokens + elapsed).
_LLM_AUDIT_LOG="${GOR_MOBILE_CONFIG_DIR:-$HOME/.config/gor-mobile}/llm-audit.log"

_log_invocation() {
    local role="$1" target="$2" model="$3" status="$4" in_tok="$5" out_tok="$6" elapsed_ms="$7" reason="${8:-}"
    printf >&2 "[gor-mobile llm] role=%s target=%s model=%s status=%s tokens=%s/%s elapsed=%sms%s\n" \
        "$role" "$target" "${model:-none}" "$status" \
        "${in_tok:-0}" "${out_tok:-0}" "${elapsed_ms:-0}" \
        "${reason:+ reason=\"$reason\"}"
    mkdir -p "$(dirname "$_LLM_AUDIT_LOG")" 2>/dev/null || true
    jq -cn \
        --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        --arg role "$role" --arg target "$target" \
        --arg model "$model" --arg status "$status" \
        --argjson i "${in_tok:-0}" --argjson o "${out_tok:-0}" \
        --argjson e "${elapsed_ms:-0}" --arg r "$reason" \
        '{ts:$ts, role:$role, target:$target, model:$model, status:$status,
          tokens:{input:$i, output:$o}, elapsed_ms:$e}
         + (if $r == "" then {} else {reason:$r} end)' \
        >> "$_LLM_AUDIT_LOG" 2>/dev/null || true
}

_exit_for_status() {
    case "$1" in
        OK) return 0 ;;
        BLOCKED|FALLBACK) return 2 ;;
        ERROR) return 3 ;;
    esac
    return 1
}

# ──── Subcommands ─────────────────────────────────────────────────────────

_llm_status() {
    local lms_up="false"
    local loaded=""
    if dep_lms_path >/dev/null 2>&1 && lm_server_up; then
        lms_up="true"
        loaded="$(lm_loaded_identifier 2>/dev/null || true)"
    fi
    jq -n \
        --arg url "$LLM_URL" \
        --arg up "$lms_up" \
        --arg loaded "$loaded" \
        --arg preset "$(_current_preset)" \
        '{
            lm_studio: { url: $url, reachable: ($up == "true"), loaded: (if $loaded == "" then null else $loaded end) },
            preset: $preset
        }'
}

_llm_routing() {
    local preset; preset="$(_current_preset)"
    printf "preset: %s\n\n" "$preset"
    printf "%-18s  %-7s  %s\n" "role" "target" "model"
    printf "%-18s  %-7s  %s\n" "----" "------" "-----"
    local roles=(impl tdd-red routine-debug review review-deep vision analyze brainstorm plan verify finishing)
    for role in "${roles[@]}"; do
        local line; line="$(_resolve_routing "$role" "$preset")"
        local target default_model model
        target="$(echo "$line" | awk -F: '{print $2}')"
        default_model="$(echo "$line" | awk -F: '{print $3}')"
        if [[ "$default_model" == "-" || -z "$default_model" ]]; then
            model="—"
        else
            model="$(_resolve_model "$role" "$default_model")"
        fi
        printf "%-18s  %-7s  %s\n" "$role" "$target" "$model"
    done
}

_llm_preset() {
    local name="${1:-}"
    case "$name" in
        aggressive-local|balanced|cloud-only) ;;
        *)
            log_err "Invalid preset. Choose: aggressive-local | balanced | cloud-only"
            return 1
            ;;
    esac
    mkdir -p "$GOR_MOBILE_CONFIG_DIR"
    local tmp; tmp="$(mktemp)"
    if [[ -f "$GOR_MOBILE_CONFIG" ]]; then
        jq --arg p "$name" '.preset = $p' "$GOR_MOBILE_CONFIG" > "$tmp"
    else
        jq -n --arg p "$name" '{preset: $p}' > "$tmp"
    fi
    mv "$tmp" "$GOR_MOBILE_CONFIG"
    log_ok "Preset set to: $name"
}

# Main dispatch.
_llm_run() {
    local role="" input_file="" force_cloud=0
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --input)        input_file="${2:-}"; shift ;;
            --force-cloud)  force_cloud=1 ;;
            --*)            log_err "Unknown flag: $1"; return 3 ;;
            *)              [[ -z "$role" ]] && role="$1" ;;
        esac
        shift
    done

    if [[ -z "$role" ]]; then
        log_err "Usage: gor-mobile llm <role> [--input <file>] [--force-cloud]"
        return 3
    fi
    if [[ -z "$input_file" ]]; then
        log_err "Missing --input <file>"
        return 3
    fi
    if [[ ! -f "$input_file" ]]; then
        log_err "Input file not found: $input_file"
        return 3
    fi

    local preset; preset="$(_current_preset)"
    local line; line="$(_resolve_routing "$role" "$preset")"
    local target default_model model
    target="$(echo "$line" | awk -F: '{print $2}')"
    default_model="$(echo "$line" | awk -F: '{print $3}')"

    if [[ -z "$target" ]]; then
        _log_invocation "$role" "-" "" "BLOCKED" 0 0 0 "unknown role: $role"
        _emit BLOCKED "" "" 0 0 0 "unknown role: $role"
        return 2
    fi

    if [[ $force_cloud -eq 1 ]]; then
        target="cloud"
    fi

    if [[ "$target" == "cloud" ]]; then
        _log_invocation "$role" "cloud" "" "BLOCKED" 0 0 0 "routed to cloud under preset=$preset"
        _emit BLOCKED "" "" 0 0 0 "role=$role routes to cloud under preset=$preset — caller should use Opus"
        return 2
    fi

    model="$(_resolve_model "$role" "$default_model")"

    if ! dep_lms_path >/dev/null 2>&1; then
        _log_invocation "$role" "local" "$model" "ERROR" 0 0 0 "lms CLI not installed"
        _emit ERROR "" "" 0 0 0 "lms CLI not installed"
        return 3
    fi
    if ! lm_server_up; then
        if ! lm_server_start 2>/dev/null; then
            _log_invocation "$role" "local" "$model" "ERROR" 0 0 0 "LM Studio unreachable"
            _emit ERROR "" "" 0 0 0 "LM Studio server unreachable at $LLM_URL"
            return 3
        fi
    fi
    if ! lm_ensure_model_loaded "$model" "$LLM_CONTEXT_LENGTH"; then
        _log_invocation "$role" "local" "$model" "BLOCKED" 0 0 0 "failed to load model"
        _emit BLOCKED "" "" 0 0 0 "failed to load model $model"
        return 2
    fi

    local start_ms end_ms elapsed_ms
    start_ms="$(python3 -c 'import time; print(int(time.time()*1000))')"
    local raw_response; raw_response="$(lm_chat "$model" "$input_file")"
    end_ms="$(python3 -c 'import time; print(int(time.time()*1000))')"
    elapsed_ms=$(( end_ms - start_ms ))

    if echo "$raw_response" | jq -e '.error' >/dev/null 2>&1; then
        local err; err="$(echo "$raw_response" | jq -r '.error.message // .error | tostring')"
        _log_invocation "$role" "local" "$model" "ERROR" 0 0 "$elapsed_ms" "LM Studio: $err"
        _emit ERROR "$model" "" 0 0 "$elapsed_ms" "LM Studio: $err"
        return 3
    fi

    local content in_tok out_tok
    content="$(echo "$raw_response" | jq -r '.choices[0].message.content // ""')"
    in_tok="$(echo "$raw_response" | jq -r '.usage.prompt_tokens // 0')"
    out_tok="$(echo "$raw_response" | jq -r '.usage.completion_tokens // 0')"

    # Context-overflow heuristic: response truncated with near-zero content.
    if [[ -z "$content" && "$in_tok" -gt 0 ]]; then
        _log_invocation "$role" "local" "$model" "BLOCKED" "$in_tok" "$out_tok" "$elapsed_ms" "empty completion — possible context overflow"
        _emit BLOCKED "$model" "" "$in_tok" "$out_tok" "$elapsed_ms" "empty completion — possible context overflow"
        return 2
    fi

    _log_invocation "$role" "local" "$model" "OK" "$in_tok" "$out_tok" "$elapsed_ms"
    _emit OK "$model" "$content" "$in_tok" "$out_tok" "$elapsed_ms"
}

cmd_llm() {
    local sub="${1:-}"
    shift || true
    case "$sub" in
        status)   _llm_status ;;
        routing)  _llm_routing ;;
        preset)   _llm_preset "$@" ;;
        "")
            log_err "Usage: gor-mobile llm <role|status|routing|preset> [...]"
            exit 3
            ;;
        *)
            _llm_run "$sub" "$@"
            _exit_for_status "$(echo "$?" )" || true
            ;;
    esac
}
