#!/usr/bin/env bash
# Regression for the managed statusLine: repair re-points a managed entry to the
# current GOR_MOBILE_HOME, never touches a foreign statusLine, and uninstall
# removes only the managed one. Drives the real shipped binary.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Hermetic PATH: drop any dir carrying `android` so repair/uninstall stay local.
SAFE_PATH=""
IFS=':' read -ra _dirs <<< "$PATH"
for d in "${_dirs[@]}"; do
  [ -z "$d" ] && continue
  [ -x "$d/android" ] && continue
  SAFE_PATH="${SAFE_PATH:+$SAFE_PATH:}$d"
done

run_repair() { node "$ROOT/bin/gor-mobile.mjs" repair >/dev/null 2>&1; }
run_uninstall() { node "$ROOT/bin/gor-mobile.mjs" uninstall --yes >/dev/null 2>&1; }

# --- Case 1: managed (stale path) -> repair re-points to current home ---
TMP1="$(mktemp -d)"; trap 'rm -rf "$TMP1"' EXIT
export HOME="$TMP1" GOR_MOBILE_HOME="$TMP1/.gor-mobile" XDG_CONFIG_HOME="$TMP1/.config" PATH="$SAFE_PATH"
mkdir -p "$HOME/.claude"
cat > "$HOME/.claude/settings.json" <<'JSON'
{ "statusLine": { "type": "command", "command": "bash /old/.gor-mobile/templates/statusline-command.sh", "_managed_by": "gor-mobile" } }
JSON
echo "→ case 1: repair re-points a managed statusLine"
run_repair
GM_HOME="$GOR_MOBILE_HOME" node "$ROOT/test/assert-statusline.mjs" "$HOME/.claude/settings.json" managed command

# --- Case 2: foreign survives repair AND uninstall ---
TMP2="$(mktemp -d)"; trap 'rm -rf "$TMP1" "$TMP2"' EXIT
export HOME="$TMP2" GOR_MOBILE_HOME="$TMP2/.gor-mobile" XDG_CONFIG_HOME="$TMP2/.config"
mkdir -p "$HOME/.claude"
cat > "$HOME/.claude/settings.json" <<'JSON'
{ "statusLine": { "type": "command", "command": "bash /home/me/.config/my-statusline.sh" } }
JSON
echo "→ case 2: repair leaves a foreign statusLine untouched"
run_repair
node "$ROOT/test/assert-statusline.mjs" "$HOME/.claude/settings.json" foreign
echo "→ case 2: uninstall leaves a foreign statusLine untouched"
run_uninstall
node "$ROOT/test/assert-statusline.mjs" "$HOME/.claude/settings.json" foreign

# --- Case 3: managed removed by uninstall ---
TMP3="$(mktemp -d)"; trap 'rm -rf "$TMP1" "$TMP2" "$TMP3"' EXIT
export HOME="$TMP3" GOR_MOBILE_HOME="$TMP3/.gor-mobile" XDG_CONFIG_HOME="$TMP3/.config"
mkdir -p "$HOME/.claude"
cat > "$HOME/.claude/settings.json" <<'JSON'
{ "statusLine": { "type": "command", "command": "bash /x/.gor-mobile/templates/statusline-cat.sh", "_managed_by": "gor-mobile" } }
JSON
echo "→ case 3: uninstall removes a managed statusLine"
run_uninstall
node "$ROOT/test/assert-statusline.mjs" "$HOME/.claude/settings.json" absent

echo "PASS: statusLine repair/uninstall invariants"
