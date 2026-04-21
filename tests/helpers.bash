#!/usr/bin/env bash
# Shared bats helpers: isolate filesystem state into a scratch $HOME.

setup_isolated_home() {
    BATS_TMPDIR_PROJECT="${BATS_TEST_TMPDIR:-/tmp}/gor-mobile-$$-$RANDOM"
    mkdir -p "$BATS_TMPDIR_PROJECT"
    export HOME="$BATS_TMPDIR_PROJECT/home"
    export GOR_MOBILE_HOME="$HOME/.gor-mobile"
    export XDG_CONFIG_HOME="$HOME/.config"
    mkdir -p "$HOME/.claude"

    export GOR_MOBILE_ROOT
    GOR_MOBILE_ROOT="$(cd "${BATS_TEST_DIRNAME}/.." && pwd)"
    export PATH="$GOR_MOBILE_ROOT/bin:$PATH"
}

teardown_isolated_home() {
    if [[ -n "${BATS_TMPDIR_PROJECT:-}" && -d "$BATS_TMPDIR_PROJECT" ]]; then
        rm -rf "$BATS_TMPDIR_PROJECT"
    fi
}

# Create a fake Android project in a temp cwd and cd into it.
fake_android_project() {
    local dir; dir="$(mktemp -d)"
    printf "android {\n}\n" > "$dir/build.gradle.kts"
    cd "$dir"
}
