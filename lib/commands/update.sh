#!/usr/bin/env bash
# gor-mobile update — pull latest rules + repair managed files.

# shellcheck source=../constants.sh
source "$GOR_MOBILE_ROOT/lib/constants.sh"

cmd_update() {
    log_step "Updating rules pack"
    if [[ -d "$GOR_MOBILE_RULES_DIR/.git" ]]; then
        git -C "$GOR_MOBILE_RULES_DIR" pull --ff-only || log_warn "git pull failed"
        log_ok "Rules pack updated"
    else
        log_warn "Rules pack is not a git repo — skipping pull"
    fi

    if command -v brew >/dev/null 2>&1 && brew list gor-mobile >/dev/null 2>&1; then
        log_step "Checking for brew update"
        brew update >/dev/null 2>&1 || true
        local latest current
        latest="$(brew info --json=v2 gor-mobile 2>/dev/null | jq -r '.formulae[0].versions.stable // empty')"
        current="$(brew list --versions gor-mobile 2>/dev/null | awk '{print $2}')"
        if [[ -n "$latest" && "$latest" != "$current" ]]; then
            log_info "New CLI version available ($current → $latest) — run: brew upgrade gor-mobile"
        else
            log_ok "CLI up-to-date ($current)"
        fi
    fi

    log_step "Repairing managed files"
    source "$GOR_MOBILE_ROOT/lib/commands/repair.sh"
    cmd_repair
}
