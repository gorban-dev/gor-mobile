#!/usr/bin/env bash
# Test harness for templates/session-start-hook.sh checkpoint re-hydration.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOOK="$REPO_ROOT/templates/session-start-hook.sh"

if ! command -v jq >/dev/null 2>&1; then
    printf 'SKIP session-start-compaction: jq not installed (hook needs jq to emit JSON)\n'
    exit 0
fi

pass=0; fail=0
ok()  { printf '  ok   %s\n' "$1"; pass=$((pass+1)); }
bad() { printf '  FAIL %s\n' "$1"; fail=$((fail+1)); }

# Fixture repo: marker + skills dir with the superpowers skill + a checkpoint.
repo="$(mktemp -d)"
printf '{"platform":"android"}\n' > "$repo/.gor-mobile.json"
mkdir -p "$repo/.claude/skills/gor-mobile-using-superpowers"
printf 'name: gor-mobile-using-superpowers\n' \
    > "$repo/.claude/skills/gor-mobile-using-superpowers/SKILL.md"
mkdir -p "$repo/.gor-mobile/state"
printf '# progress\nNext action: Task 2\n' \
    > "$repo/.gor-mobile/state/2026-07-14-feature.progress.md"

# ctx <source> — run the hook with given source, print additionalContext
ctx() {
    printf '{"cwd":"%s","source":"%s"}' "$repo" "$1" \
        | bash "$HOOK" 2>/dev/null \
        | jq -r '.hookSpecificOutput.additionalContext // empty'
}

out_compact="$(ctx compact)"
case "$out_compact" in
    *"<gor-mobile-resume>"*) ok "compact: resume block injected" ;;
    *) bad "compact: resume block missing" ;;
esac
case "$out_compact" in
    *"2026-07-14-feature.progress.md"*) ok "compact: checkpoint path present" ;;
    *) bad "compact: checkpoint path missing" ;;
esac
case "$out_compact" in
    *"You are resuming a gor-mobile session"*) ok "compact: strong rehydration phrasing" ;;
    *) bad "compact: strong phrasing missing" ;;
esac

out_startup="$(ctx startup)"
case "$out_startup" in
    *"2026-07-14-feature.progress.md"*) ok "startup: checkpoint path surfaced (soft)" ;;
    *) bad "startup: checkpoint path missing" ;;
esac
case "$out_startup" in
    *"You are resuming a gor-mobile session"*) bad "startup: should NOT use strong compaction phrasing" ;;
    *) ok "startup: soft phrasing only" ;;
esac

# No checkpoint → no resume block at all.
rm -f "$repo/.gor-mobile/state/"*.progress.md
out_none="$(ctx compact)"
case "$out_none" in
    *"<gor-mobile-resume>"*) bad "no-checkpoint: resume block should be absent" ;;
    *) ok "no-checkpoint: no resume block" ;;
esac

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
