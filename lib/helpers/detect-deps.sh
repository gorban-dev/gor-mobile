#!/usr/bin/env bash
# Dependency detection. Sourced by init/doctor.

# shellcheck source=../constants.sh
source "$GOR_MOBILE_ROOT/lib/constants.sh"

dep_has() {
    command -v "$1" >/dev/null 2>&1
}

dep_version() {
    local bin="$1"
    if dep_has "$bin"; then
        "$bin" --version 2>/dev/null | head -1 || printf "unknown\n"
    else
        printf "missing\n"
    fi
}

dep_android_cli_path() {
    # Google's `android` CLI (from the android-tools formula), not the legacy SDK tool.
    if dep_has android; then
        command -v android
        return 0
    fi
    return 1
}

dep_report() {
    local name="$1" found_path="$2" required="$3"
    if [[ -n "$found_path" ]]; then
        log_ok "$name → $found_path"
    else
        if [[ "$required" == "required" ]]; then
            log_err "$name not found (required)"
        else
            log_warn "$name not found (optional)"
        fi
    fi
}

# Collect a quick environment summary as JSON for doctor / repair.
deps_summary_json() {
    local android_path
    android_path="$(dep_android_cli_path 2>/dev/null || true)"
    jq -n \
        --arg brew "$(command -v brew || true)" \
        --arg git "$(command -v git || true)" \
        --arg curl "$(command -v curl || true)" \
        --arg jq_bin "$(command -v jq || true)" \
        --arg android "$android_path" \
        '{
            brew: $brew, git: $git, curl: $curl, jq: $jq_bin,
            android: $android
        }'
}
