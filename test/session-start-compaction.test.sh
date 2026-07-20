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
# Real ast-index stream split (v3.38.0, measured by capturing stdout/stderr
# separately): "Checking for changes..." and the "Updated: ..." /
# "Index is up to date." summary go to stdout; "Loaded ...", "Found ..." and
# "Time: ..." go to stderr. The hook must parse stdout's own vocabulary.
cat > "$STUB_BIN/ast-index" <<'STUB'
#!/bin/sh
echo "Checking for changes..."
echo "Updated: 54 files (42 changed, 12 deleted)"
echo "Loaded 2 files from index" >&2
echo "Found 42 new/changed files, 12 deleted files" >&2
echo "Time: 9.856917ms" >&2
STUB
chmod +x "$STUB_BIN/ast-index"

out="$(printf '{"cwd":"%s","source":"startup"}' "$idx_repo" \
    | PATH="$STUB_BIN:$PATH" bash "$HOOK" 2>/dev/null)"
if printf '%s' "$out" | grep -q '<gor-mobile-ast-index>'; then
    ok "stale index (real stream split): note fires"
else
    bad "stale index (real stream split): note missing"
fi
if printf '%s' "$out" | grep -q '42 changed'; then
    ok "stale index (real stream split): changed count correct (42)"
else
    bad "stale index (real stream split): changed count wrong or missing"
fi
if printf '%s' "$out" | grep -q '12 deleted'; then
    ok "stale index (real stream split): deleted count correct (12)"
else
    bad "stale index (real stream split): deleted count wrong or missing"
fi

cat > "$STUB_BIN/ast-index" <<'STUB'
#!/bin/sh
echo "Checking for changes..."
echo "Index is up to date."
echo "Loaded 2 files from index" >&2
echo "Found 0 new/changed files, 0 deleted files" >&2
echo "Time: 1.234ms" >&2
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

# Regression guard for the bug this suite used to certify: a stub that
# prints the real "Found ..." summary ONLY to stderr, with no "Updated:"
# line on stdout at all. Before the fix, the hook parsed this exact line —
# but the real CLI only ever prints it to stderr, which the hook discards by
# design, so the note could never fire against the real binary. The hook
# must stay silent here, not invent counts from a line it never reads.
cat > "$STUB_BIN/ast-index" <<'STUB'
#!/bin/sh
echo "Found 7 new/changed files, 3 deleted files" >&2
STUB
chmod +x "$STUB_BIN/ast-index"
out="$(printf '{"cwd":"%s","source":"startup"}' "$idx_repo" \
    | PATH="$STUB_BIN:$PATH" bash "$HOOK" 2>/dev/null)"
if printf '%s' "$out" | grep -q '<gor-mobile-ast-index>'; then
    bad "Found-only-on-stderr, no Updated: line: must not invent counts"
else
    ok "Found-only-on-stderr, no Updated: line: hook stays silent"
fi
if printf '%s' "$out" | jq -e . >/dev/null 2>&1; then
    ok "Found-only-on-stderr, no Updated: line: still valid JSON"
else
    bad "Found-only-on-stderr, no Updated: line: invalid JSON"
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
echo "Updated: 011 files (008 changed, 003 deleted)"
echo "Found 008 new/changed files, 003 deleted files" >&2
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
echo "Updated: 6 files (5 changed, 1 deleted)"
echo "Updated: 6 files (5 changed, 1 deleted)"
echo "Updated: 6 files (5 changed, 1 deleted)"
echo "Found 5 new/changed files, 1 deleted files" >&2
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
start_fine="$(date +%s.%N)"
out="$(printf '{"cwd":"%s","source":"startup"}' "$idx_repo" \
    | PATH="$STUB_BIN:$PATH" GORM_AST_INDEX_WATCHDOG_SECS=1 bash "$HOOK" 2>/dev/null)"
end_fine="$(date +%s.%N)"
elapsed=$(( $(date +%s) - start_ts ))
if [[ "$elapsed" -le 5 ]]; then
    ok "hanging indexer: hook returns bounded (${elapsed}s)"
else
    bad "hanging indexer: hook took ${elapsed}s, watchdog did not bound it"
fi
# Fine-grained companion to the assertion above: the watchdog must fire at
# approximately watchdog_secs (1s here), not noticeably sooner (which would
# mean the poll granularity is too coarse in the other direction, tripping
# early) and not much later (the bound above already catches "way later").
fine_elapsed="$(awk -v s="$start_fine" -v e="$end_fine" 'BEGIN{printf "%.3f", e-s}')"
if awk -v e="$fine_elapsed" 'BEGIN{exit !(e >= 0.8 && e <= 4.0)}'; then
    ok "hanging indexer: watchdog fires at ~1s, not sooner (${fine_elapsed}s)"
else
    bad "hanging indexer: watchdog fired at ${fine_elapsed}s, expected ~0.8-4.0s"
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

# --- ast-index watchdog: malformed GORM_AST_INDEX_WATCHDOG_SECS ---------------
# Identifier-shaped values are the dangerous case: under `set -u`, bash
# arithmetic treats a bare identifier as a variable reference and aborts —
# fatal even inside a `while` condition — taking the whole hook down with
# it, not just this block. Every value here must fall back to the 10s
# default and still emit exactly one valid JSON object on stdout, rc 0.
cat > "$STUB_BIN/ast-index" <<'STUB'
#!/bin/sh
echo "Index is up to date."
echo "Found 0 new/changed files, 0 deleted files" >&2
STUB
chmod +x "$STUB_BIN/ast-index"

for bad_val in true false disabled off none abc; do
    out="$(printf '{"cwd":"%s","source":"startup"}' "$idx_repo" \
        | PATH="$STUB_BIN:$PATH" GORM_AST_INDEX_WATCHDOG_SECS="$bad_val" bash "$HOOK" 2>/dev/null)"
    rc=$?
    if [[ "$rc" -eq 0 ]] && printf '%s' "$out" | jq -e . >/dev/null 2>&1; then
        ok "watchdog secs '$bad_val' (identifier-shaped): rc 0, valid JSON"
    else
        bad "watchdog secs '$bad_val' (identifier-shaped): rc=$rc out='$out'"
    fi
done

for bad_val in '10s' '-5' ''; do
    out="$(printf '{"cwd":"%s","source":"startup"}' "$idx_repo" \
        | PATH="$STUB_BIN:$PATH" GORM_AST_INDEX_WATCHDOG_SECS="$bad_val" bash "$HOOK" 2>/dev/null)"
    rc=$?
    if [[ "$rc" -eq 0 ]] && printf '%s' "$out" | jq -e . >/dev/null 2>&1; then
        ok "watchdog secs '$bad_val' (non-numeric garbage): rc 0, valid JSON"
    else
        bad "watchdog secs '$bad_val' (non-numeric garbage): rc=$rc out='$out'"
    fi
done

# --- ast-index watchdog: an up-to-date index must not cost a full second ------
# The design intent is that an up-to-date index is the silent, cheap, normal
# case. Polling liveness at 1s granularity taxed every session start ~1.05s
# even when the indexer had already exited by the time the watchdog looked.
cat > "$STUB_BIN/ast-index" <<'STUB'
#!/bin/sh
echo "Index is up to date."
echo "Found 0 new/changed files, 0 deleted files" >&2
STUB
chmod +x "$STUB_BIN/ast-index"
start_fine="$(date +%s.%N)"
out="$(printf '{"cwd":"%s","source":"startup"}' "$idx_repo" \
    | PATH="$STUB_BIN:$PATH" bash "$HOOK" 2>/dev/null)"
end_fine="$(date +%s.%N)"
fine_elapsed="$(awk -v s="$start_fine" -v e="$end_fine" 'BEGIN{printf "%.3f", e-s}')"
if awk -v e="$fine_elapsed" 'BEGIN{exit !(e < 0.7)}'; then
    ok "instant indexer: hook returns well under 1s (${fine_elapsed}s)"
else
    bad "instant indexer: hook took ${fine_elapsed}s, expected comfortably under 1s"
fi
if printf '%s' "$out" | jq -e . >/dev/null 2>&1; then
    ok "instant indexer: still valid JSON"
else
    bad "instant indexer: invalid JSON"
fi

# --- ast-index watchdog: fraction-rejecting `sleep` (BusyBox/minimal coreutils) --
# `sleep 0.1` is not POSIX. On a system whose `sleep` rejects a fractional
# argument, the old poll loop's `sleep 0.1` failed under the `set -euo
# pipefail` inherited into the watchdog subshell, aborting the subshell
# before its kill/wait cleanup ran — and the subshell's nonzero exit then
# aborted the whole hook. Shimmed here as a `sleep` placed ahead of the real
# one on PATH for the hook's own invocation only (never exported to the rest
# of this script, so the harness's own timing calls below are unaffected).
FRAC_STUB_BIN="$(mktemp -d)"
cat > "$FRAC_STUB_BIN/sleep" <<'STUB'
#!/bin/sh
for arg in "$@"; do
    case "$arg" in
        *.*) echo "sleep: invalid time interval '$arg'" >&2; exit 1 ;;
    esac
done
if [ -x /bin/sleep ]; then
    exec /bin/sleep "$@"
elif [ -x /usr/bin/sleep ]; then
    exec /usr/bin/sleep "$@"
fi
exit 1
STUB
chmod +x "$FRAC_STUB_BIN/sleep"

# Instant-indexer path: the watchdog's probe sleep runs unconditionally
# before the poll loop even starts, so this alone exercises the shim.
cat > "$STUB_BIN/ast-index" <<'STUB'
#!/bin/sh
echo "Index is up to date."
echo "Found 0 new/changed files, 0 deleted files" >&2
STUB
chmod +x "$STUB_BIN/ast-index"
out="$(printf '{"cwd":"%s","source":"startup"}' "$idx_repo" \
    | PATH="$FRAC_STUB_BIN:$STUB_BIN:$PATH" bash "$HOOK" 2>/dev/null)"
rc=$?
if [[ "$rc" -eq 0 ]]; then
    ok "fraction-rejecting sleep + instant indexer: hook exits 0"
else
    bad "fraction-rejecting sleep + instant indexer: exited $rc"
fi
if printf '%s' "$out" | jq -e . >/dev/null 2>&1; then
    ok "fraction-rejecting sleep + instant indexer: valid JSON"
else
    bad "fraction-rejecting sleep + instant indexer: invalid JSON, got: $out"
fi

# Hanging-indexer path: forces the fallback poll loop itself (not just the
# probe) to run under the shim, bounded by a short watchdog.
frac_orphan_secs=$((300 + (($$ + 1) % 90)))
pkill -9 -f "sleep $frac_orphan_secs" >/dev/null 2>&1 || true
cat > "$STUB_BIN/ast-index" <<STUB
#!/bin/sh
sleep $frac_orphan_secs
STUB
chmod +x "$STUB_BIN/ast-index"
start_ts=$(date +%s)
out="$(printf '{"cwd":"%s","source":"startup"}' "$idx_repo" \
    | PATH="$FRAC_STUB_BIN:$STUB_BIN:$PATH" GORM_AST_INDEX_WATCHDOG_SECS=1 bash "$HOOK" 2>/dev/null)"
rc=$?
elapsed=$(( $(date +%s) - start_ts ))
if [[ "$rc" -eq 0 && "$elapsed" -le 5 ]]; then
    ok "fraction-rejecting sleep + hanging indexer: hook exits 0, bounded (${elapsed}s)"
else
    bad "fraction-rejecting sleep + hanging indexer: rc=$rc elapsed=${elapsed}s"
fi
if printf '%s' "$out" | jq -e . >/dev/null 2>&1; then
    ok "fraction-rejecting sleep + hanging indexer: valid JSON"
else
    bad "fraction-rejecting sleep + hanging indexer: invalid JSON, got: $out"
fi
sleep 1
if pgrep -f "sleep $frac_orphan_secs" >/dev/null 2>&1; then
    bad "fraction-rejecting sleep + hanging indexer: orphan survives (sleep $frac_orphan_secs)"
    pkill -9 -f "sleep $frac_orphan_secs" >/dev/null 2>&1 || true
else
    ok "fraction-rejecting sleep + hanging indexer: no orphan indexer survives"
fi
rm -rf "$FRAC_STUB_BIN"

# --- ast-index watchdog: structural containment (Level 1) ---------------------
# The watchdog subshell must be incapable of aborting the hook no matter what
# fails inside it — not just the fractional-sleep case above. Proven directly:
# take a disposable copy of the hook, inject a guaranteed-failing command
# right after the indexer is backgrounded (so there is a real child to reap),
# and confirm the hook still emits valid JSON and leaves no orphan. The
# injection touches only the copy — the committed hook file is never modified.
FAULT_HOOK="$(mktemp)"
cp "$HOOK" "$FAULT_HOOK"
# Portable in-place edit (works with both BSD and GNU sed): write to a temp
# file and move it back, rather than relying on `sed -i` flag differences.
FAULT_HOOK_TMP="$(mktemp)"
sed 's/^        upd_pid=\$!$/        upd_pid=$!\n        gor_mobile_test_guaranteed_failure_xyz/' \
    "$FAULT_HOOK" > "$FAULT_HOOK_TMP"
mv "$FAULT_HOOK_TMP" "$FAULT_HOOK"
if ! grep -q 'gor_mobile_test_guaranteed_failure_xyz' "$FAULT_HOOK"; then
    bad "structural containment: fault injection anchor not found in hook copy"
else
    fault_secs=$((300 + (($$ + 2) % 90)))
    pkill -9 -f "sleep $fault_secs" >/dev/null 2>&1 || true
    cat > "$STUB_BIN/ast-index" <<STUB
#!/bin/sh
sleep $fault_secs
STUB
    chmod +x "$STUB_BIN/ast-index"
    out="$(printf '{"cwd":"%s","source":"startup"}' "$idx_repo" \
        | PATH="$STUB_BIN:$PATH" GORM_AST_INDEX_WATCHDOG_SECS=1 bash "$FAULT_HOOK" 2>/dev/null)"
    rc=$?
    if [[ "$rc" -eq 0 ]]; then
        ok "structural containment: hook exits 0 despite injected failure"
    else
        bad "structural containment: hook exited $rc"
    fi
    if printf '%s' "$out" | jq -e . >/dev/null 2>&1; then
        ok "structural containment: valid JSON despite injected failure"
    else
        bad "structural containment: invalid JSON, got: $out"
    fi
    sleep 1
    if pgrep -f "sleep $fault_secs" >/dev/null 2>&1; then
        bad "structural containment: orphan survives (sleep $fault_secs)"
        pkill -9 -f "sleep $fault_secs" >/dev/null 2>&1 || true
    else
        ok "structural containment: no orphan indexer survives injected failure"
    fi
fi
rm -f "$FAULT_HOOK"

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
