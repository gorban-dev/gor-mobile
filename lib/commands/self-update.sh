#!/usr/bin/env bash
# gor-mobile self-update — update the CLI itself. Only applicable to curl-installer
# installs (brew installs should use 'brew upgrade gor-mobile').

# shellcheck source=../constants.sh
source "$GOR_MOBILE_ROOT/lib/constants.sh"

cmd_self_update() {
    if [[ -d "$GOR_MOBILE_ROOT/.git" ]]; then
        log_step "git pull in $GOR_MOBILE_ROOT"
        git -C "$GOR_MOBILE_ROOT" pull --ff-only
        log_ok "CLI updated"
        return
    fi
    if command -v brew >/dev/null 2>&1 && brew list gor-mobile >/dev/null 2>&1; then
        log_info "Brew-managed install — use: brew upgrade gor-mobile"
        return
    fi
    log_warn "Unable to self-update: not a git repo and not a brew install."
    log_info "Reinstall via: curl -fsSL https://raw.githubusercontent.com/gorban/gor-mobile/main/install.sh | bash"
}
