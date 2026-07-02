#!/usr/bin/env bash
# Shared mobile-context detector for gor-mobile hooks.
# Decides whether the current session/turn is a mobile (Android/iOS) context,
# i.e. whether the gor-mobile hooks should inject.
#
# Usage:  detect-mobile-context.sh <cwd> <session_id>
#   Optional env GORM_PROMPT   — user prompt text (UserPromptSubmit only).
#   Optional env GORM_FORCE_MOBILE=1 — force a positive result (tests/doctor).
# Exit 0 = mobile context (inject). Exit 1 = not (stay silent).
# Side effect: on first positive result for a session, writes a sticky flag so
# later turns short-circuit to "active".

set -uo pipefail

cwd="${1:-$PWD}"
session_id="${2:-}"
# session_id is interpolated into the sticky-flag path — strip anything that is
# not a safe path component so it can never traverse directories.
session_id="${session_id//[^a-zA-Z0-9_-]/}"
prompt="${GORM_PROMPT:-}"

flag_file=""
if [[ -n "$session_id" ]]; then
    flag_file="${TMPDIR:-/tmp}/gor-mobile-active-${session_id}"
fi

activate() {
    shopt -u nocasematch 2>/dev/null || true
    [[ -n "$flag_file" ]] && : > "$flag_file" 2>/dev/null
    exit 0
}

# Greenfield = a brand-new project dir: no recognized build/manifest file at cwd
# and no enclosing git repo. Used to scope the "ambiguous new project" verdict so
# we never nag inside an established (non-mobile) project.
is_greenfield() {
    local d="$1" m nd dir
    compgen -G "$d/*.xcodeproj" >/dev/null 2>&1 && return 1
    compgen -G "$d/*.xcworkspace" >/dev/null 2>&1 && return 1
    for m in package.json Cargo.toml go.mod pom.xml pyproject.toml \
             build.gradle build.gradle.kts settings.gradle settings.gradle.kts \
             Podfile Package.swift; do
        [[ -f "$d/$m" ]] && return 1
    done
    dir="$d"
    while [[ -n "$dir" && "$dir" != "/" ]]; do
        [[ -d "$dir/.git" ]] && return 1
        [[ "$dir" == "$HOME" ]] && break
        nd="$(dirname "$dir")"
        [[ "$nd" == "$dir" ]] && break
        dir="$nd"
    done
    return 0
}

# 0. Hard override (tests / doctor emulation).
[[ "${GORM_FORCE_MOBILE:-}" == "1" ]] && activate

# 1. Sticky flag — fast path for the rest of the session.
[[ -n "$flag_file" && -f "$flag_file" ]] && exit 0

# 2 + 3a/3b. Walk from cwd up to git root or $HOME, checking markers per level.
dir="$cwd"
while [[ -n "$dir" && "$dir" != "/" ]]; do
    # 2. Opt-in marker (committed, repo-root).
    [[ -f "$dir/.gor-mobile.json" ]] && activate
    # 3a. Android markers.
    if [[ -f "$dir/build.gradle" || -f "$dir/build.gradle.kts" \
        || -f "$dir/settings.gradle" || -f "$dir/settings.gradle.kts" \
        || -f "$dir/gradlew" ]]; then
        activate
    fi
    # 3b. iOS markers (Package.swift is a weak signal — may be server Swift).
    if compgen -G "$dir/*.xcodeproj" >/dev/null 2>&1 \
        || compgen -G "$dir/*.xcworkspace" >/dev/null 2>&1 \
        || [[ -f "$dir/Podfile" || -f "$dir/Package.swift" ]]; then
        activate
    fi
    [[ -d "$dir/.git" ]] && break
    [[ "$dir" == "$HOME" ]] && break
    new_dir="$(dirname "$dir")"
    [[ "$new_dir" == "$dir" ]] && break
    dir="$new_dir"
done

# 3c. AndroidManifest.xml in an app module under cwd (bounded depth — runs each
#     non-mobile turn, so keep maxdepth small).
if [[ -d "$cwd" && -n "$(find "$cwd" -maxdepth 3 -name AndroidManifest.xml -print -quit 2>/dev/null)" ]]; then
    activate
fi

# 4. Prompt-based signals (UserPromptSubmit passes GORM_PROMPT).
if [[ -n "$prompt" ]]; then
    shopt -s nocasematch
    explicit_re='gor[ -]?mobile'
    platform_re='(android|андроид|ios|kotlin|котлин|swift|свифт|jetpack|compose|apk|flutter|xcode|мобильн|play ?(market|store)|app ?store)'
    nonmobile_re='(web|веб|website|сайт|landing|лендинг|frontend|фронтенд|backend|бэкенд|бекенд|browser|браузер|desktop|десктоп)'
    verb_re='(creat|build|scaffold|generat|implement|develop|init|new app|нов|созда|сдела|дела|постро|сгенер|напиш|разраб|реализ|начина|запил)'

    # 4a. Explicit gor-mobile mention, or a named mobile platform + build intent → mobile.
    if [[ "$prompt" =~ $explicit_re ]]; then activate; fi
    if [[ "$prompt" =~ $platform_re ]] && [[ "$prompt" =~ $verb_re ]]; then
        activate
    fi

    # 4b. Ambiguous NEW project: build intent in a greenfield dir with NO platform
    #     word of any kind (neither mobile nor clearly-non-mobile). We cannot know the
    #     target → emit "ambiguous" (exit 2) so the UserPromptSubmit hook asks the
    #     user which platform, instead of staying silent (silence lets a co-installed
    #     generic plugin, e.g. upstream superpowers, hijack the workflow choice).
    if [[ "$prompt" =~ $verb_re ]] \
        && [[ ! "$prompt" =~ $platform_re ]] \
        && [[ ! "$prompt" =~ $nonmobile_re ]] \
        && is_greenfield "$cwd"; then
        shopt -u nocasematch
        exit 2
    fi
    shopt -u nocasematch
fi

exit 1
