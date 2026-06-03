#!/usr/bin/env bash
# Test harness for templates/detect-mobile-context.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DET="$REPO_ROOT/templates/detect-mobile-context.sh"

pass=0; fail=0
ok()  { printf '  ok   %s\n' "$1"; pass=$((pass+1)); }
bad() { printf '  FAIL %s\n' "$1"; fail=$((fail+1)); }

# assert_exit <expected-code> <description> <command...>
assert_exit() {
    local expected="$1"; shift
    local desc="$1"; shift
    "$@" >/dev/null 2>&1
    local code=$?
    if [[ "$code" == "$expected" ]]; then ok "$desc"; else bad "$desc (got $code, want $expected)"; fi
}

empty="$(mktemp -d)"
assert_exit 1 "empty dir is non-mobile" bash "$DET" "$empty" "s-empty"

android="$(mktemp -d)"; : > "$android/gradlew"
assert_exit 0 "gradlew dir is mobile" bash "$DET" "$android" "s-android"

ios="$(mktemp -d)"; : > "$ios/Podfile"
assert_exit 0 "Podfile dir is mobile" bash "$DET" "$ios" "s-ios"

marked="$(mktemp -d)"; : > "$marked/.gor-mobile.json"
assert_exit 0 "marker dir is mobile" bash "$DET" "$marked" "s-marker"

kw="$(mktemp -d)"
assert_exit 0 "explicit keyword is mobile" env GORM_PROMPT="please use gor-mobile" bash "$DET" "$kw" "s-kw"

forced="$(mktemp -d)"
assert_exit 0 "GORM_FORCE_MOBILE forces mobile" env GORM_FORCE_MOBILE=1 bash "$DET" "$forced" "s-force"

stick="$(mktemp -d)"; sess="s-sticky-$$"
GORM_PROMPT="create an android app" bash "$DET" "$stick" "$sess" >/dev/null 2>&1
assert_exit 0 "sticky flag keeps session active" bash "$DET" "$stick" "$sess"

rm -f "${TMPDIR:-/tmp}"/gor-mobile-active-s-* 2>/dev/null || true

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[[ "$fail" == 0 ]]
