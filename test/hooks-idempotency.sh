#!/usr/bin/env bash
# Regression test for the hook dedup bug: upsertHook must be idempotent and must
# collapse legacy, *untagged* managed entries (left by an earlier install, manual
# edits, format migrations, or a broken merge) instead of stacking duplicates.
# Since v0.3.0 the Claude workflow is per-project, so this drives the real
# shipped binary (`gor-mobile repair` from inside a repo) against a pre-seeded
# <repo>/.claude/settings.local.json — the whole code path, not a reimplementation.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

export HOME="$TMP"
export GOR_MOBILE_HOME="$TMP/.gor-mobile"
export XDG_CONFIG_HOME="$TMP/.config"

# Hermetic: drop any PATH dir carrying an `android` binary so `repair` skips
# `android init` and stays fully local (no network, no real toolchain).
SAFE_PATH=""
IFS=':' read -ra _dirs <<< "$PATH"
for d in "${_dirs[@]}"; do
  [ -z "$d" ] && continue
  [ -x "$d/android" ] && continue
  SAFE_PATH="${SAFE_PATH:+$SAFE_PATH:}$d"
done
export PATH="$SAFE_PATH"

REPO="$TMP/app"
mkdir -p "$REPO/.claude"
# A per-project marker so `repair` finds this repo (walks up from cwd).
printf '{ "platform": "android", "version": "0.0.0" }\n' > "$REPO/.gor-mobile.json"

# Three untagged legacy entries per event (varied absolute paths, as real
# machines accumulate over reinstalls) plus one unrelated third-party hook that
# MUST survive untouched.
cat > "$REPO/.claude/settings.local.json" <<'JSON'
{
  "hooks": {
    "SessionStart": [
      { "matcher": "startup|clear|compact|resume", "hooks": [{ "type": "command", "command": "bash /old/install/.gor-mobile/templates/session-start-hook.sh" }] },
      { "matcher": "startup", "hooks": [{ "type": "command", "command": "bash /Users/someone/.gor-mobile/templates/session-start-hook.sh" }] },
      { "matcher": "startup", "hooks": [{ "type": "command", "command": "bash ~/.gor-mobile/templates/session-start-hook.sh" }] },
      { "matcher": "startup", "hooks": [{ "type": "command", "command": "echo unrelated-sessionstart-hook" }] }
    ],
    "UserPromptSubmit": [
      { "matcher": "", "hooks": [{ "type": "command", "command": "bash /old/install/.gor-mobile/templates/user-prompt-submit-hook.sh" }] },
      { "matcher": "", "hooks": [{ "type": "command", "command": "bash ~/.gor-mobile/templates/user-prompt-submit-hook.sh" }] },
      { "matcher": "", "hooks": [{ "type": "command", "command": "echo unrelated-userpromptsubmit-hook" }] }
    ],
    "PreToolUse": [
      { "matcher": "Grep|Bash", "hooks": [{ "type": "command", "command": "bash /old/install/.gor-mobile/templates/ast-index-guard-hook.sh" }] },
      { "matcher": "Grep|Bash", "hooks": [{ "type": "command", "command": "bash ~/.gor-mobile/templates/ast-index-guard-hook.sh" }] },
      { "matcher": "Bash", "hooks": [{ "type": "command", "command": "echo unrelated-pretooluse-hook" }] }
    ]
  }
}
JSON

cd "$REPO"
echo "→ repair #1"
node "$ROOT/bin/gor-mobile.mjs" repair >/dev/null 2>&1 || { echo "repair #1 exited non-zero"; exit 1; }
echo "→ repair #2 (idempotency)"
node "$ROOT/bin/gor-mobile.mjs" repair >/dev/null 2>&1 || { echo "repair #2 exited non-zero"; exit 1; }

echo "→ asserting final settings.local.json"
node "$ROOT/test/assert-hooks.mjs" "$REPO/.claude/settings.local.json"
echo "PASS: hook upsert is idempotent and collapses legacy entries"
