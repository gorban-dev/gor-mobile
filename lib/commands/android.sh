#!/usr/bin/env bash
# gor-mobile android — wrapper around Google's `android` CLI with gradle fallback.

# shellcheck source=../constants.sh
source "$GOR_MOBILE_ROOT/lib/constants.sh"
# shellcheck source=../helpers/detect-deps.sh
source "$GOR_MOBILE_ROOT/lib/helpers/detect-deps.sh"

cmd_android() {
    if dep_android_cli_path >/dev/null 2>&1; then
        exec "$(dep_android_cli_path)" "$@"
    fi
    # Gradle fallback for common verbs in a gradle-wrapper project.
    case "${1:-}" in
        build|assemble|assembleDebug|assembleRelease)
            if [[ -x ./gradlew ]]; then
                log_info "Falling back to ./gradlew $1"
                exec ./gradlew "$1"
            fi
            ;;
        "")
            log_err "Usage: gor-mobile android <subcommand> [args...]"
            exit 1
            ;;
    esac
    log_err "Android CLI not installed and no gradle fallback available."
    log_info "Install Google Android CLI from: https://developer.android.com/tools/agents"
    exit 1
}
