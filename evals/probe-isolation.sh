#!/usr/bin/env bash
# Proves that a variant install under a throwaway GOR_MOBILE_HOME / CODEX_HOME
# leaves the real user configs byte-identical. Run before trusting evals/run.mjs.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$(cd "$(mktemp -d)" && pwd -P)"
cleanup() {
    node -e '
        const fs = require("fs");
        const p = process.env.HOME + "/.claude.json";
        if (!fs.existsSync(p)) process.exit(0);
        const j = JSON.parse(fs.readFileSync(p, "utf8"));
        let n = 0;
        for (const k of Object.keys(j.projects ?? {})) if (k.startsWith(process.argv[1] + "/")) { delete j.projects[k]; n++; }
        if (n) fs.writeFileSync(p, JSON.stringify(j, null, 2));
    ' "$TMP" || true
    rm -rf "$TMP"
}
trap cleanup EXIT

watched=(
    "$HOME/.claude/settings.json"
    "$HOME/.codex/config.toml"
    "$HOME/.codex/hooks.json"
    "$HOME/.codex/AGENTS.md"
    "$HOME/.gor-mobile/config.json"
)

watched_dirs=(
    "$HOME/.claude/skills"
    "$HOME/.claude/agents"
    "$HOME/.codex/skills"
    "$HOME/.codex/agents"
    "$HOME/.hermes/skills"
    "$HOME/.gor-mobile/templates"
    "$HOME/.gor-mobile/rules"
)

snap() {
    for f in "${watched[@]}"; do
        if [[ -f "$f" ]]; then shasum "$f"; else echo "absent $f"; fi
    done
    for d in "${watched_dirs[@]}"; do
        if [[ -d "$d" ]]; then
            echo "$(find "$d" -type f -not -name .DS_Store | sort | xargs shasum 2>/dev/null | shasum | cut -d' ' -f1) $d"
        else
            echo "absent $d"
        fi
    done
    # ~/.claude.json: gor-mobile only writes projects[<path>].mcpServers; live sessions rewrite the rest
    node -e '
        const fs = require("fs");
        const p = process.env.HOME + "/.claude.json";
        if (!fs.existsSync(p)) { console.log("absent claude.json"); process.exit(0); }
        const j = JSON.parse(fs.readFileSync(p, "utf8"));
        const keys = Object.keys(j.projects ?? {}).filter((k) => !k.startsWith(process.argv[1])).sort();
        const fp = keys.map((k) => {
            const m = j.projects[k].mcpServers ?? {};
            return [k, JSON.stringify(Object.keys(m).sort().map((n) => [n, m[n]]))];
        });
        console.log(require("crypto").createHash("sha1").update(JSON.stringify(fp)).digest("hex"), "claude.json");
    ' "$TMP"
}

before="$(snap)"

mkdir -p "$TMP/home"
export GOR_MOBILE_HOME="$TMP/gm" CODEX_HOME="$TMP/cx"
if [[ ! -f "$HOME/.codex/auth.json" ]]; then
    echo "missing $HOME/.codex/auth.json: needed to seed the throwaway CODEX_HOME" >&2
    exit 1
fi
mkdir -p "$CODEX_HOME"
cp "$HOME/.codex/auth.json" "$CODEX_HOME/"

step() {
    local name="$1"; shift
    if ! HOME="$TMP/home" JAVA_TOOL_OPTIONS="-Duser.home=$TMP/home" node "$REPO/bin/gor-mobile.mjs" "$@" >"$TMP/$name.log" 2>&1; then
        echo "$name failed; last 30 lines of its log:" >&2
        tail -n 30 "$TMP/$name.log" >&2
        exit 1
    fi
}

step setup setup --yes --no-tui --skip-android-update --target codex

mkdir -p "$TMP/app" && cd "$TMP/app" && git init -q
step init init --yes --no-tui --platform android
step uninstall uninstall --project --yes
cd "$REPO"

after="$(snap)"
if [[ "$before" == "$after" ]]; then
    echo "isolation OK"
else
    echo "isolation BROKEN:"
    diff <(echo "$before") <(echo "$after") || true
    exit 1
fi
