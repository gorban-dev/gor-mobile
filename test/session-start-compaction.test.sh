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

# --- ast-index malformed-count parsing -----------------------------------------
# A misbehaving indexer must not crash the arithmetic or leak raw bash errors
# to stderr; the count line must be read as the first match only, in base 10.
err_file="$(mktemp)"

cat > "$STUB_BIN/ast-index" <<'STUB'
#!/bin/sh
echo "Found 008 new/changed files, 003 deleted files"
STUB
chmod +x "$STUB_BIN/ast-index"
out="$(printf '{"cwd":"%s","source":"startup"}' "$idx_repo" \
    | PATH="$STUB_BIN:$PATH" bash "$HOOK" 2>"$err_file")"
if printf '%s' "$out" | jq -e . >/dev/null 2>&1; then
    ok "leading-zero counts: still valid JSON"
else
    bad "leading-zero counts: invalid JSON"
fi
if printf '%s' "$out" | grep -q '<gor-mobile-ast-index>'; then
    ok "leading-zero counts: note present (008/003 read as base 10, not octal)"
else
    bad "leading-zero counts: note missing"
fi
if [[ -s "$err_file" ]]; then
    bad "leading-zero counts: stderr should be empty, got: $(cat "$err_file")"
else
    ok "leading-zero counts: no stderr noise"
fi

cat > "$STUB_BIN/ast-index" <<'STUB'
#!/bin/sh
echo "Found 5 new/changed files, 1 deleted files"
echo "Found 5 new/changed files, 1 deleted files"
echo "Found 5 new/changed files, 1 deleted files"
STUB
chmod +x "$STUB_BIN/ast-index"
: > "$err_file"
out="$(printf '{"cwd":"%s","source":"startup"}' "$idx_repo" \
    | PATH="$STUB_BIN:$PATH" bash "$HOOK" 2>"$err_file")"
if printf '%s' "$out" | jq -e . >/dev/null 2>&1; then
    ok "repeated match lines: still valid JSON"
else
    bad "repeated match lines: invalid JSON"
fi
if printf '%s' "$out" | grep -q '<gor-mobile-ast-index>'; then
    ok "repeated match lines: note present (first match used)"
else
    bad "repeated match lines: note missing"
fi
if [[ -s "$err_file" ]]; then
    bad "repeated match lines: stderr should be empty, got: $(cat "$err_file")"
else
    ok "repeated match lines: no stderr noise"
fi
rm -f "$err_file"

# --- ast-index watchdog: a hanging indexer must not hang the hook -------------
# GORM_AST_INDEX_WATCHDOG_SECS overrides the hook's 10s default so this case
# stays fast in CI; the hook's real-world default is unaffected.
cat > "$STUB_BIN/ast-index" <<'STUB'
#!/bin/sh
sleep 300
STUB
chmod +x "$STUB_BIN/ast-index"
start_ts=$(date +%s)
out="$(printf '{"cwd":"%s","source":"startup"}' "$idx_repo" \
    | PATH="$STUB_BIN:$PATH" GORM_AST_INDEX_WATCHDOG_SECS=1 bash "$HOOK" 2>/dev/null)"
elapsed=$(( $(date +%s) - start_ts ))
if [[ "$elapsed" -le 5 ]]; then
    ok "hanging indexer: hook returns bounded (${elapsed}s)"
else
    bad "hanging indexer: hook took ${elapsed}s, watchdog did not bound it"
fi
if printf '%s' "$out" | jq -e . >/dev/null 2>&1; then
    ok "hanging indexer: still valid JSON"
else
    bad "hanging indexer: invalid JSON"
fi
if printf '%s' "$out" | grep -q '<gor-mobile-ast-index>'; then
    bad "hanging indexer: note should be absent"
else
    ok "hanging indexer: note absent"
fi

# --- ast-index watchdog: grandchildren must not survive as orphans ------------
# A file-scanning indexer plausibly forks worker processes; killing only the
# direct child would leave those running after the hook returns. Uses a
# per-run sleep duration as a poor-man's unique marker for pgrep.
orphan_secs=$((300 + ($$ % 90)))
pkill -9 -f "sleep $orphan_secs" >/dev/null 2>&1 || true
cat > "$STUB_BIN/ast-index" <<STUB
#!/bin/sh
sleep $orphan_secs &
wait
STUB
chmod +x "$STUB_BIN/ast-index"
printf '{"cwd":"%s","source":"startup"}' "$idx_repo" \
    | PATH="$STUB_BIN:$PATH" GORM_AST_INDEX_WATCHDOG_SECS=1 bash "$HOOK" >/dev/null 2>&1
sleep 1
if pgrep -f "sleep $orphan_secs" >/dev/null 2>&1; then
    bad "hanging indexer: grandchild orphan survives (sleep $orphan_secs)"
    pkill -9 -f "sleep $orphan_secs" >/dev/null 2>&1 || true
else
    ok "hanging indexer: no orphan grandchild survives"
fi

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
