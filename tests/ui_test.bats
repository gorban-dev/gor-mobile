#!/usr/bin/env bats
# Tests for lib/helpers/ui.sh — fallback mode (no gum).
# We force NO_TUI=1 so ensure_gum returns 1 and all ui_* primitives use
# the plain-bash read/printf fallback path. 2>/dev/null strips the
# visual-only noise (prompts, menus) so $output holds just the returned
# value — which is what callers actually consume.

load helpers.bash

setup() {
    setup_isolated_home
    export NO_TUI=1
    # shellcheck disable=SC1091
    source "$GOR_MOBILE_ROOT/lib/helpers/ui.sh"
}

teardown() {
    teardown_isolated_home
}

@test "ensure_gum returns 1 under NO_TUI=1" {
    run ensure_gum
    [ "$status" -eq 1 ]
    [ -z "$GUM" ]
}

@test "ensure_gum returns 1 under ASSUME_YES=1" {
    unset NO_TUI
    export ASSUME_YES=1
    run ensure_gum
    [ "$status" -eq 1 ]
}

@test "ui_confirm returns 0 on 'y' reply (default N)" {
    run bash -c 'export NO_TUI=1; source "'"$GOR_MOBILE_ROOT"'/lib/helpers/ui.sh"; echo y | ui_confirm "Proceed?" N 2>/dev/null'
    [ "$status" -eq 0 ]
}

@test "ui_confirm returns 1 on 'n' reply (default Y)" {
    run bash -c 'export NO_TUI=1; source "'"$GOR_MOBILE_ROOT"'/lib/helpers/ui.sh"; echo n | ui_confirm "Proceed?" Y 2>/dev/null'
    [ "$status" -eq 1 ]
}

@test "ui_confirm honors Y default on empty reply" {
    run bash -c 'export NO_TUI=1; source "'"$GOR_MOBILE_ROOT"'/lib/helpers/ui.sh"; printf "\n" | ui_confirm "Proceed?" Y 2>/dev/null'
    [ "$status" -eq 0 ]
}

@test "ui_confirm honors N default on empty reply" {
    run bash -c 'export NO_TUI=1; source "'"$GOR_MOBILE_ROOT"'/lib/helpers/ui.sh"; printf "\n" | ui_confirm "Proceed?" N 2>/dev/null'
    [ "$status" -eq 1 ]
}

@test "ui_confirm returns 0 under ASSUME_YES=1 regardless of input" {
    run bash -c 'export NO_TUI=1 ASSUME_YES=1; source "'"$GOR_MOBILE_ROOT"'/lib/helpers/ui.sh"; printf "n\n" | ui_confirm "Proceed?" N 2>/dev/null'
    [ "$status" -eq 0 ]
}

@test "ui_choose returns the numerically selected item" {
    run bash -c 'export NO_TUI=1; source "'"$GOR_MOBILE_ROOT"'/lib/helpers/ui.sh"; echo 2 | ui_choose "Pick one" "alpha" alpha beta gamma 2>/dev/null'
    [ "$status" -eq 0 ]
    [ "$output" = "beta" ]
}

@test "ui_choose falls back to default on empty reply" {
    run bash -c 'export NO_TUI=1; source "'"$GOR_MOBILE_ROOT"'/lib/helpers/ui.sh"; printf "\n" | ui_choose "Pick one" "beta" alpha beta gamma 2>/dev/null'
    [ "$status" -eq 0 ]
    [ "$output" = "beta" ]
}

@test "ui_choose falls back to default on out-of-range reply" {
    run bash -c 'export NO_TUI=1; source "'"$GOR_MOBILE_ROOT"'/lib/helpers/ui.sh"; echo 99 | ui_choose "Pick one" "alpha" alpha beta gamma 2>/dev/null'
    [ "$status" -eq 0 ]
    [ "$output" = "alpha" ]
}

@test "ui_input returns the entered text" {
    run bash -c 'export NO_TUI=1; source "'"$GOR_MOBILE_ROOT"'/lib/helpers/ui.sh"; echo hello | ui_input "Name" 2>/dev/null'
    [ "$status" -eq 0 ]
    [ "$output" = "hello" ]
}

@test "ui_spin runs the command and returns its exit code" {
    run bash -c 'export NO_TUI=1; source "'"$GOR_MOBILE_ROOT"'/lib/helpers/ui.sh"; ui_spin "working…" true 2>/dev/null'
    [ "$status" -eq 0 ]
    run bash -c 'export NO_TUI=1; source "'"$GOR_MOBILE_ROOT"'/lib/helpers/ui.sh"; ui_spin "working…" false 2>/dev/null'
    [ "$status" -eq 1 ]
}
