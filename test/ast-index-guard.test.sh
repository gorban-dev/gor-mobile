#!/usr/bin/env bash
# Test harness for templates/ast-index-guard-hook.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GUARD="$REPO_ROOT/templates/ast-index-guard-hook.sh"

if ! command -v jq >/dev/null 2>&1; then
    printf 'SKIP ast-index-guard suite: jq is not installed — the guard hook itself\n'
    printf 'fails open without jq, so deny behavior cannot be asserted here.\n'
    exit 0
fi

pass=0; fail=0
ok()  { printf '  ok   %s\n' "$1"; pass=$((pass+1)); }
bad() { printf '  FAIL %s\n' "$1"; fail=$((fail+1)); }

# run_guard <json> — feeds stdin JSON, returns the hook's exit code
run_guard() { printf '%s' "$1" | bash "$GUARD" >/dev/null 2>&1; }

# assert_guard <expected-exit> <description> <json>
assert_guard() {
    local expected="$1" desc="$2" json="$3"
    run_guard "$json"
    local code=$?
    if [[ "$code" == "$expected" ]]; then ok "$desc"; else bad "$desc (got $code, want $expected)"; fi
}

# --- fixture repos ------------------------------------------------------------
# indexed: looks like a project root (.git) with the ast-index marker
indexed="$(mktemp -d)"
mkdir -p "$indexed/.git" "$indexed/.claude/rules"
: > "$indexed/.claude/rules/ast-index.md"
# plain: project root without the marker
plain="$(mktemp -d)"
mkdir -p "$plain/.git"
# nested dir under the indexed root; .claude-only root (no .git)
mkdir -p "$indexed/app/src"
claudeonly="$(mktemp -d)"
mkdir -p "$claudeonly/.claude/rules"
: > "$claudeonly/.claude/rules/ast-index.md"
# Deny behavior requires the ast-index binary (the hook fails open without
# it) — stub one so the suite is self-contained.
STUB_BIN="$(mktemp -d)"
printf '#!/bin/sh\nexit 0\n' > "$STUB_BIN/ast-index"
chmod +x "$STUB_BIN/ast-index"
export PATH="$STUB_BIN:$PATH"

grep_json() { # <cwd> <pattern> [extra tool_input pairs as raw json, e.g. ',"glob":"res/**"']
    printf '{"tool_name":"Grep","cwd":"%s","tool_input":{"pattern":"%s"%s}}' "$1" "$2" "${3:-}"
}
bash_json() { # <cwd> <command>
    printf '{"tool_name":"Bash","cwd":"%s","tool_input":{"command":"%s"}}' "$1" "$2"
}

# --- deny cases ----------------------------------------------------------------
assert_guard 2 "Grep bare identifier in indexed repo → deny" \
    "$(grep_json "$indexed" "getFormatValue")"
assert_guard 2 "Bash rg bare identifier in indexed repo → deny" \
    "$(bash_json "$indexed" "rg getFormatValue app/src")"
assert_guard 2 "Bash grep -rn identifier → deny" \
    "$(bash_json "$indexed" "grep -rn toPriceFormat .")"
assert_guard 2 "Grep identifier with kt glob → deny" \
    "$(grep_json "$indexed" "getPriceDoubleFormat" ',"glob":"**/*.kt"')"
assert_guard 2 "Bash rg with -t value flag → deny (value not mistaken for pattern)" \
    "$(bash_json "$indexed" "rg -t kotlin getFormatValue")"
assert_guard 2 "leading grep piped to head → deny" \
    "$(bash_json "$indexed" "rg getFormatValue app/src | head")"
assert_guard 2 "leading grep piped to wc → deny" \
    "$(bash_json "$indexed" "grep -rn toPriceFormat . | wc -l")"
assert_guard 2 "attached -ePATTERN → deny" \
    "$(bash_json "$indexed" "grep -rn -egetFormatValue app/src")"
assert_guard 2 "attached --regexp=PATTERN → deny" \
    "$(bash_json "$indexed" "rg --regexp=getFormatValue app/src")"
assert_guard 2 "nested cwd under indexed root → deny" \
    "$(grep_json "$indexed/app/src" "getFormatValue")"
assert_guard 2 ".claude-only root boundary → deny" \
    "$(grep_json "$claudeonly" "getFormatValue")"
assert_guard 2 "apostrophe inside dquoted arg + pipe still denies" \
    "$(bash_json "$indexed" "grep -c getFormatValue \\\"o'brien/app.kt\\\" | wc -l")"
# jq-built fixture: command must reach the hook as  grep -rn getFormatValue "a\"b.kt" | head
assert_guard 2 "escaped quote inside dquoted arg + pipe still denies" \
    "$(jq -cn --arg cwd "$indexed" --arg cmd 'grep -rn getFormatValue "a\"b.kt" | head' \
        '{tool_name:"Bash",cwd:$cwd,tool_input:{command:$cmd}}')"
assert_guard 2 "escaped quote + post-pipe noncode word still denies" \
    "$(jq -cn --arg cwd "$indexed" --arg cmd 'grep getFormatValue "a\"b.kt" | grep res/x' \
        '{tool_name:"Bash",cwd:$cwd,tool_input:{command:$cmd}}')"
assert_guard 2 "piped counting grep (leading structural query) → deny" \
    "$(bash_json "$indexed" "grep -c getFormatValue app.kt | wc -l")"

# --- allow cases ---------------------------------------------------------------
assert_guard 0 "no ast-index marker → allow" \
    "$(grep_json "$plain" "getFormatValue")"
assert_guard 0 "regex-meta pattern (resource literal) → allow" \
    "$(grep_json "$indexed" "R\\\\.string\\\\.price_with_rouble")"
assert_guard 0 "glob restricted to res/ → allow" \
    "$(grep_json "$indexed" "price_with_rouble" ',"glob":"res/**/*.xml"')"
assert_guard 0 "type=md → allow" \
    "$(grep_json "$indexed" "getFormatValue" ',"type":"md"')"
assert_guard 0 "Bash rg -t md restricts to markdown → allow" \
    "$(bash_json "$indexed" "rg -t md getFormatValue")"
assert_guard 0 "compound bash command → allow" \
    "$(bash_json "$indexed" "cd app \&\& grep foo bar.kt")"
assert_guard 0 "bash quoted multi-word pattern → allow" \
    "$(bash_json "$indexed" "rg \\\"price format\\\" app/")"
assert_guard 0 "bash grep into res/ path → allow" \
    "$(bash_json "$indexed" "grep -rn price_with_rouble res/")"
assert_guard 0 "bash grep -A value flag + xml target → allow" \
    "$(bash_json "$indexed" "grep -A 3 price_with_rouble res/values/strings.xml")"
assert_guard 0 "quoted regex alternation → allow" \
    "$(bash_json "$indexed" "rg 'foo|bar' app/")"
assert_guard 0 "comment tag TODO → allow" \
    "$(bash_json "$indexed" "rg TODO")"
assert_guard 0 "docs/ path → allow" \
    "$(bash_json "$indexed" "grep -rn MainActivity docs/")"
assert_guard 0 "attached --type=md → allow" \
    "$(bash_json "$indexed" "rg --type=md getFormatValue")"
assert_guard 0 "rg --files listing → allow" \
    "$(bash_json "$indexed" "rg --files app")"
assert_guard 0 "rg --version → allow" \
    "$(bash_json "$indexed" "rg --version")"
assert_guard 0 "short pattern (<3) → allow" \
    "$(grep_json "$indexed" "ab")"
assert_guard 0 "non-grep bash command → allow" \
    "$(bash_json "$indexed" "ls -la")"
assert_guard 0 "other tool name → allow" \
    '{"tool_name":"Read","cwd":"'"$indexed"'","tool_input":{"file_path":"/x"}}'
assert_guard 0 "malformed stdin → fail-open allow" 'not json at all'
assert_guard 0 "empty stdin → fail-open allow" ''

# non-absolute cwd must fail open FAST (regression: dirname "." hang)
( printf '{"tool_name":"Grep","cwd":".","tool_input":{"pattern":"getFormatValue"}}' \
    | bash "$GUARD" >/dev/null 2>&1 ) &
hpid=$!
hung=1
for _ in 1 2 3 4 5 6 7 8 9 10; do
    if ! kill -0 "$hpid" 2>/dev/null; then hung=0; break; fi
    sleep 0.2
done
if [[ "$hung" == 0 ]]; then
    wait "$hpid"; hcode=$?
    if [[ "$hcode" == 0 ]]; then ok "non-absolute cwd fails open fast"; else bad "non-absolute cwd fails open fast (exit $hcode)"; fi
else
    kill "$hpid" 2>/dev/null
    bad "non-absolute cwd fails open fast (hung)"
fi

# marker present but ast-index binary missing → fail open (restricted PATH
# drops the stub while keeping jq via /usr/bin)
printf '%s' "$(grep_json "$indexed" "getFormatValue")" \
    | PATH="/usr/bin:/bin" bash "$GUARD" >/dev/null 2>&1
mb=$?
if [[ "$mb" == 0 ]]; then ok "missing ast-index binary → fail open"; else bad "missing ast-index binary → fail open (got $mb)"; fi

# deny message quality: must name ast-index usages and the pattern
msg="$(printf '%s' "$(grep_json "$indexed" "getFormatValue")" | bash "$GUARD" 2>&1 >/dev/null)"
if printf '%s' "$msg" | grep -q 'ast-index usages "getFormatValue"'; then
    ok "deny message carries substitute command"
else
    bad "deny message carries substitute command"
fi

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[[ "$fail" == 0 ]]
