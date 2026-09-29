#!/usr/bin/env bash
# Proves that a variant install under a throwaway GOR_MOBILE_HOME / CODEX_HOME
# leaves the real user configs byte-identical. Run before trusting evals/run.mjs.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$(cd "$(mktemp -d)" && pwd -P)"
trap 'rm -rf "$TMP"' EXIT

watched=(
    "$HOME/.claude/settings.json"
    "$HOME/.codex/config.toml"
    "$HOME/.codex/hooks.json"
    "$HOME/.codex/AGENTS.md"
    "$HOME/.gor-mobile/config.json"
)

snap() {
    for f in "${watched[@]}"; do
        if [[ -f "$f" ]]; then shasum "$f"; else echo "absent $f"; fi
    done
    # ~/.claude.json: every key except projects["$TMP/..."] entries
    node -e '
        const fs = require("fs");
        const p = process.env.HOME + "/.claude.json";
        if (!fs.existsSync(p)) { console.log("absent claude.json"); process.exit(0); }
        const j = JSON.parse(fs.readFileSync(p, "utf8"));
        for (const k of Object.keys(j.projects ?? {})) if (k.startsWith(process.argv[1])) delete j.projects[k];
        delete j.numStartups; delete j.lastReleaseNotesSeen; delete j.cachedChangelog;
        console.log(require("crypto").createHash("sha1").update(JSON.stringify(j)).digest("hex"), "claude.json");
    ' "$TMP"
}

before="$(snap)"

export GOR_MOBILE_HOME="$TMP/gm" CODEX_HOME="$TMP/cx"
mkdir -p "$CODEX_HOME"
cp "$HOME/.codex/auth.json" "$CODEX_HOME/"
node "$REPO/bin/gor-mobile.mjs" setup --yes --no-tui --skip-android-update --target codex >"$TMP/setup.log" 2>&1

mkdir -p "$TMP/app" && cd "$TMP/app" && git init -q
node "$REPO/bin/gor-mobile.mjs" init --yes --no-tui --platform android >"$TMP/init.log" 2>&1
node "$REPO/bin/gor-mobile.mjs" uninstall --project --yes >"$TMP/uninstall.log" 2>&1
cd "$REPO"

after="$(snap)"
if [[ "$before" == "$after" ]]; then
    echo "isolation OK"
else
    echo "isolation BROKEN:"
    diff <(echo "$before") <(echo "$after") || true
    exit 1
fi
