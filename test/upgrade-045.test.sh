#!/usr/bin/env bash
# 0.4.5 project install → 0.5.0 `repair` and → 0.5.0 `uninstall --project`.
# 0.4.x wrote .claude/workflows/gor-*.js, agents/gor-mobile-runner.md and
# workflowSizeGuideline into every Claude project; 0.5.0 must remove exactly
# what the marker says it owns and leave a user-authored workflow alone.
# Builds the old CLI from the v0.4.5 tag in a throwaway worktree (dist/ is
# committed there, node_modules is symlinked from this checkout).
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
git rev-parse -q --verify v0.4.5 >/dev/null || { echo "skip: tag v0.4.5 not present"; exit 0; }
OLD="$(mktemp -d)/gm-045"
git worktree add -q "$OLD" v0.4.5
ln -s "$ROOT/node_modules" "$OLD/node_modules"
cleanup() { cd "$ROOT"; git worktree remove --force "$OLD" >/dev/null 2>&1; }
trap cleanup EXIT

pass=0; fail=0
ok()   { pass=$((pass+1)); echo "  ok   $1"; }
bad()  { fail=$((fail+1)); echo "  FAIL $1"; }
check() { if eval "$2"; then ok "$1"; else bad "$1"; fi; }

install_045() {
  TMP="$(mktemp -d)"
  export HOME="$TMP" GOR_MOBILE_HOME="$TMP/.gor-mobile" XDG_CONFIG_HOME="$TMP/.config"
  "$OLD/bin/gor-mobile" setup --yes --no-tui >/dev/null 2>&1
  REPO="$TMP/app"; mkdir -p "$REPO"; cd "$REPO"
  "$OLD/bin/gor-mobile" init --yes --no-tui --platform android >/dev/null 2>&1
  echo "user workflow" > .claude/workflows/my-own.js
  check "0.4.5 baseline: workflows + runner + guideline present" \
    '[ -e .claude/workflows/gor-execute.js ] && [ -e .claude/agents/gor-mobile-runner.md ] && [ "$(jq -r .workflowSizeGuideline .claude/settings.local.json)" = large ]'
  "$ROOT/bin/gor-mobile" setup --yes --no-tui >/dev/null 2>&1
}

echo "repair path"
install_045
BEFORE_ALLOW=$(jq '.permissions.allow|length' .claude/settings.local.json)
"$ROOT/bin/gor-mobile" repair >/dev/null 2>&1
check "gor-execute.js removed"            '[ ! -e .claude/workflows/gor-execute.js ]'
check "gor-review.js removed"             '[ ! -e .claude/workflows/gor-review.js ]'
check "user workflow kept"                '[ -e .claude/workflows/my-own.js ]'
check "runner agent removed"              '[ ! -e .claude/agents/gor-mobile-runner.md ]'
check "workflowSizeGuideline removed"     '[ "$(jq "has(\"workflowSizeGuideline\")" .claude/settings.local.json)" = false ]'
check "allowlist did not shrink"          '[ "$(jq ".permissions.allow|length" .claude/settings.local.json)" -ge "$BEFORE_ALLOW" ]'
check "marker: managed_workflows gone"    '[ "$(jq "has(\"managed_workflows\")" .gor-mobile/marker.json)" = false ]'
check "marker: guideline not in managed_settings" '[ "$(jq ".managed_settings | index(\"workflowSizeGuideline\")" .gor-mobile/marker.json)" = null ]'
check "14 gor-mobile-* skills"            '[ "$(ls -d .claude/skills/gor-mobile-* | wc -l | tr -d " ")" = 14 ]'
check "marker version 0.5.0"              '[ "$(jq -r .version .gor-mobile/marker.json)" = 0.5.0 ]'
check "sdd-isolate installed"             '[ -x "$GOR_MOBILE_HOME/scripts/sdd-isolate" ]'
check "doctor: no leftover warning"       '! "$ROOT/bin/gor-mobile" doctor 2>&1 | grep -qi leftover'

echo "uninstall path"
install_045
"$ROOT/bin/gor-mobile" uninstall --project --yes >/dev/null 2>&1
check "gor-*.js removed"                  '[ ! -e .claude/workflows/gor-execute.js ] && [ ! -e .claude/workflows/gor-review.js ]'
check "user workflow kept"                '[ -e .claude/workflows/my-own.js ]'
check "no gor-mobile agents/skills left"  '[ -z "$(ls -d .claude/agents/gor-mobile-* .claude/skills/gor-mobile-* 2>/dev/null)" ]'
check "workflowSizeGuideline removed"     '[ "$(jq "has(\"workflowSizeGuideline\")" .claude/settings.local.json)" = false ]'
check "marker removed"                    '[ ! -e .gor-mobile/marker.json ]'

echo; echo "  $pass passed, $fail failed"
[ "$fail" = 0 ]