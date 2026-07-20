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

# --- ast-index freshness ------------------------------------------------------
# A stale index answers confidently and wrongly: a changed file yields a false
# negative, a deleted one yields a phantom with a signature and a line number.
idx_repo="$(mktemp -d)"
mkdir -p "$idx_repo/.claude/rules" "$idx_repo/.claude/skills/gor-mobile-using-superpowers"
printf '{"platform":"android"}\n' > "$idx_repo/.gor-mobile.json"
: > "$idx_repo/.claude/rules/ast-index.md"
printf 'stub skill\n' > "$idx_repo/.claude/skills/gor-mobile-using-superpowers/SKILL.md"

STUB_BIN="$(mktemp -d)"
cat > "$STUB_BIN/ast-index" <<'STUB'
#!/bin/sh
echo "Checking for changes..."
echo "Found 42 new/changed files, 12 deleted files"
echo "Updated: 54 files (42 changed, 12 deleted)"
STUB
chmod +x "$STUB_BIN/ast-index"

out="$(printf '{"cwd":"%s","source":"startup"}' "$idx_repo" \
    | PATH="$STUB_BIN:$PATH" bash "$HOOK" 2>/dev/null)"
if printf '%s' "$out" | grep -q '42'; then
    ok "stale index reports counts into context"
else
    bad "stale index did not report counts"
fi

cat > "$STUB_BIN/ast-index" <<'STUB'
#!/bin/sh
echo "Checking for changes..."
echo "Found 0 new/changed files, 0 deleted files"
echo "Index is up to date."
STUB
chmod +x "$STUB_BIN/ast-index"

out="$(printf '{"cwd":"%s","source":"startup"}' "$idx_repo" \
    | PATH="$STUB_BIN:$PATH" bash "$HOOK" 2>/dev/null)"
# Match the note's own tag, not the bare word: the always-injected workflow
# pointers already reference the [[gor-mobile-ast-index]] skill by name.
if printf '%s' "$out" | grep -q '<gor-mobile-ast-index>'; then
    bad "fresh index must stay silent"
else
    ok "fresh index stays silent"
fi

# A repo without the ast-index marker must not invoke the CLI at all.
noidx="$(mktemp -d)"
mkdir -p "$noidx/.claude/skills/gor-mobile-using-superpowers"
printf '{"platform":"android"}\n' > "$noidx/.gor-mobile.json"
printf 'stub skill\n' > "$noidx/.claude/skills/gor-mobile-using-superpowers/SKILL.md"
cat > "$STUB_BIN/ast-index" <<'STUB'
#!/bin/sh
echo "Found 9 new/changed files, 9 deleted files"
STUB
chmod +x "$STUB_BIN/ast-index"
out="$(printf '{"cwd":"%s","source":"startup"}' "$noidx" \
    | PATH="$STUB_BIN:$PATH" bash "$HOOK" 2>/dev/null)"
if printf '%s' "$out" | grep -q '9 new/changed'; then
    bad "unindexed repo must not run ast-index"
else
    ok "unindexed repo does not run ast-index"
fi

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
