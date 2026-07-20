#!/usr/bin/env bash
# init must refuse directories that are clearly not mobile projects, prompt on
# empty ones (greenfield is supported), and stay silent on real projects.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLI="$REPO_ROOT/bin/gor-mobile"

pass=0; fail=0
ok()  { printf '  ok   %s\n' "$1"; pass=$((pass+1)); }
bad() { printf '  FAIL %s\n' "$1"; fail=$((fail+1)); }

# machineReady() needs only these two paths — fake them instead of a full setup.
FAKE_HOME="$(mktemp -d)"
mkdir -p "$FAKE_HOME/.gor-mobile/templates" "$FAKE_HOME/.gor-mobile/rules"
: > "$FAKE_HOME/.gor-mobile/templates/session-start-hook.sh"
printf '{}\n' > "$FAKE_HOME/.gor-mobile/rules/manifest.json"

run_init() { # <dir> <extra args...> — echoes combined output, sets RC
    local dir="$1"; shift
    ( cd "$dir" && HOME="$FAKE_HOME" GOR_MOBILE_HOME="$FAKE_HOME/.gor-mobile" \
        "$CLI" init --no-tui "$@" 2>&1 )
}

assert_contains() { # <haystack> <needle> <desc>
    if printf '%s' "$1" | grep -qF "$2"; then ok "$3"; else bad "$3 (missing: $2)"; fi
}

# --- dry-run verdicts ---------------------------------------------------------
foreign="$(mktemp -d)"; printf '{}\n' > "$foreign/package.json"
out="$(run_init "$foreign" --dry-run --yes)"
rc=$?
assert_contains "$out" "would refuse: foreign directory" "dry-run foreign prints verdict"
[[ "$rc" == 0 ]] && ok "dry-run foreign still exits 0" || bad "dry-run foreign exits $rc, want 0"

empty="$(mktemp -d)"
out="$(run_init "$empty" --dry-run --yes)"
assert_contains "$out" "would prompt: empty directory" "dry-run empty prints verdict"

readmeonly="$(mktemp -d)"; : > "$readmeonly/README.md"; : > "$readmeonly/LICENSE"
out="$(run_init "$readmeonly" --dry-run --yes)"
assert_contains "$out" "would prompt: empty directory" "README+LICENSE still counts as empty"

android="$(mktemp -d)"; : > "$android/settings.gradle.kts"
out="$(run_init "$android" --dry-run --yes)"
if printf '%s' "$out" | grep -qF "would refuse"; then
    bad "real android project must not be gated"
else
    ok "real android project passes untouched"
fi

# --- non-dry-run enforcement --------------------------------------------------
foreign2="$(mktemp -d)"; printf '{}\n' > "$foreign2/package.json"
run_init "$foreign2" --yes >/dev/null 2>&1
rc=$?
[[ "$rc" != 0 ]] && ok "foreign + --yes exits non-zero" || bad "foreign + --yes exited 0"

foreign3="$(mktemp -d)"; printf '{}\n' > "$foreign3/Cargo.toml"
out="$(run_init "$foreign3" --yes --platform android 2>&1)"
rc=$?
[[ "$rc" == 0 ]] && ok "explicit --platform overrides the gate" || bad "explicit --platform still exited $rc"

printf '\n  %d passed, %d failed\n' "$pass" "$fail"
[[ "$fail" == 0 ]]
