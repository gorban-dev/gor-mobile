#!/usr/bin/env bash
# PreToolUse guard: a symbol-shaped grep in an ast-index-initialized repo is
# denied with a ready-made ast-index replacement. Field case: grep counted 14
# usages where ast-index finds 24, and missed .toPriceFormat() entirely.
#
# Contract (code.claude.com/docs/en/hooks): stdin JSON carries tool_name,
# tool_input, cwd; exit 0 = allow, exit 2 = deny with stderr fed to the model.
# Everything here is FAIL-OPEN: any parse problem → exit 0.
set -uo pipefail

input="$(cat 2>/dev/null)" || exit 0
[[ -n "$input" ]] || exit 0
command -v jq >/dev/null 2>&1 || exit 0

jqr() { printf '%s' "$input" | jq -r "$1 // empty" 2>/dev/null || true; }

tool="$(jqr '.tool_name')"
cwd="$(jqr '.cwd')"
[[ -n "$tool" && -n "$cwd" ]] || exit 0
[[ "$tool" == "Grep" || "$tool" == "Bash" ]] || exit 0
# A non-absolute cwd would make the dirname walk spin forever (dirname "."
# is "." on both BSD and GNU) — fail open instead.
[[ "$cwd" == /* ]] || exit 0

# Repo gate: walk up from cwd to the first .git / .claude boundary; the repo
# is guarded only when it carries the ast-index init marker.
root=""
dir="$cwd"
while [[ -n "$dir" && "$dir" != "/" ]]; do
    if [[ -e "$dir/.git" || -d "$dir/.claude" ]]; then root="$dir"; break; fi
    prev="$dir"
    dir="$(dirname "$dir")"
    [[ "$dir" == "$prev" ]] && exit 0
done
[[ -n "$root" && -f "$root/.claude/rules/ast-index.md" ]] || exit 0

# The redirect is only honest when the ast-index CLI actually exists —
# marker present but binary gone must fail open, matching the overlay's
# own fallback ("fall back to Grep for this session").
command -v ast-index >/dev/null 2>&1 || exit 0

# Conventional comment tags are bare identifiers but not symbols —
# ast-index cannot answer "find all TODOs", so a redirect would be
# actively wrong.
is_comment_tag() {
    case "$1" in TODO|FIXME|NOTE|HACK|XXX|WIP|TBD|DEBUG|STOPSHIP) return 0 ;; esac
    return 1
}

is_bare_identifier() {
    local p="$1"
    [[ ${#p} -ge 3 ]] || return 1
    [[ "$p" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || return 1
    ! is_comment_tag "$p"
}

# A target string that clearly points away from Kotlin/Java code.
is_noncode_target() {
    case "$1" in
        *res/*|*assets/*|*docs/*|*doc/*|*Documentation/*|*.xml|*.md|*.json|*.txt|*.yml|*.yaml|*.properties) return 0 ;;
        *) return 1 ;;
    esac
}

is_noncode_type() {
    case "$1" in md|markdown|xml|json|yaml|txt|properties|config|css|html) return 0 ;; esac
    return 1
}

pattern=""
dialect=""

if [[ "$tool" == "Grep" ]]; then
    # The Grep tool always runs on ripgrep's engine: bare | is alternation,
    # \| is a literal pipe.
    dialect="ere"
    pattern="$(jqr '.tool_input.pattern')"
    glob="$(jqr '.tool_input.glob')"
    path="$(jqr '.tool_input.path')"
    ftype="$(jqr '.tool_input.type')"
    [[ -n "$glob" ]] && is_noncode_target "$glob" && exit 0
    [[ -n "$path" ]] && is_noncode_target "$path" && exit 0
    [[ -n "$ftype" ]] && is_noncode_type "$ftype" && exit 0
else
    cmd="$(jqr '.tool_input.command')"
    [[ -n "$cmd" ]] || exit 0
    # Analyze the LEADING simple command: `rg Foo | head` is still a
    # structural query. Find the first shell operator OUTSIDE quotes with a
    # left-to-right state scan — parity counting is not enough: a literal
    # apostrophe inside a double-quoted arg ("o'brien/app.kt") must not
    # poison the cut and reopen the pipe bypass.
    lead="$cmd"
    len=${#cmd}
    in_s=0; in_d=0
    for ((ci=0; ci<len; ci++)); do
        ch="${cmd:$ci:1}"
        if [[ "$in_s" == 1 ]]; then
            [[ "$ch" == "'" ]] && in_s=0
            continue
        fi
        if [[ "$in_d" == 1 ]]; then
            if [[ "$ch" == '\' ]]; then ci=$((ci+1)); continue; fi
            [[ "$ch" == '"' ]] && in_d=0
            continue
        fi
        case "$ch" in
            "'") in_s=1 ;;
            '"') in_d=1 ;;
            '\') ci=$((ci+1)) ;;
            '|'|';'|'&') lead="${cmd:0:$ci}"; break ;;
        esac
    done
    case "$lead" in *'$('*|*'`'*) exit 0 ;; esac
    # A quoted multi-word pattern is not a bare symbol — pass.
    if printf '%s' "$lead" | grep -Eq '"[^"]* [^"]*"|'"'"'[^'"'"']* [^'"'"']*'"'"''; then
        exit 0
    fi
    read -r -a words <<< "$lead" || exit 0
    idx=0
    while [[ $idx -lt ${#words[@]} && "${words[$idx]}" == *=* ]]; do idx=$((idx+1)); done
    bin="${words[$idx]:-}"
    case "${bin##*/}" in grep|egrep|fgrep|rg) ;; *) exit 0 ;; esac
    # Regex dialect decides which spelling of alternation is live: BRE
    # (plain grep) treats \| as alternation and a bare | as a literal pipe
    # character; ERE (grep -E/egrep), PCRE (grep -P) and rg's regex engine
    # all invert that — bare | is alternation, \| is literal. Fixed strings
    # (-F/fgrep) has no alternation in either spelling.
    is_ere=0; is_fixed=0
    case "${bin##*/}" in egrep) is_ere=1 ;; fgrep) is_fixed=1 ;; esac
    for ((fpos=idx+1; fpos<${#words[@]}; fpos++)); do
        fw="${words[$fpos]}"
        case "$fw" in
            --extended-regexp) is_ere=1 ;;
            --fixed-strings) is_fixed=1 ;;
            --perl-regexp) is_ere=1 ;;
            --*) : ;;
            -*)
                fchars="${fw#-}"
                for ((fci=0; fci<${#fchars}; fci++)); do
                    fch="${fchars:$fci:1}"
                    case "$fch" in
                        E|P) is_ere=1 ;;
                        F) is_fixed=1 ;;
                    esac
                    # A value-taking short option ends the bundle — anything
                    # after it in this token is an attached value, not flags.
                    case "$fch" in e|t|T|g|f|A|B|C|m|D|d) break ;; esac
                done
                ;;
        esac
    done
    if [[ "$is_fixed" == 1 ]]; then
        dialect="fixed"
    elif [[ "${bin##*/}" == "rg" || "$is_ere" == 1 ]]; then
        dialect="ere"
    else
        dialect="bre"
    fi
    # First non-flag argument is the pattern, honoring -e/--regexp in both
    # separate and attached forms. Flags taking a SEPARATE value must not
    # have that value mistaken for the pattern; type/glob/include values
    # that clearly restrict to non-code are allow signals (symmetric with
    # the Grep tool's type/glob handling). Any later argument that is
    # clearly non-code → allow.
    for ((i=idx+1; i<${#words[@]}; i++)); do
        w="${words[$i]}"
        if [[ -z "$pattern" ]]; then
            case "$w" in
                --files|--type-list|--help|-h|--version|-V) exit 0 ;;
                -e|--regexp) i=$((i+1)); pattern="${words[$i]:-}" ;;
                --regexp=*) pattern="${w#--regexp=}" ;;
                -e?*) pattern="${w#-e}" ;;
                -t|--type) i=$((i+1)); v="${words[$i]:-}"; is_noncode_type "$v" && exit 0 ;;
                --type=*) v="${w#--type=}"; is_noncode_type "$v" && exit 0 ;;
                -g|--glob|--iglob) i=$((i+1)); v="${words[$i]:-}"; v="${v//\"/}"; v="${v//\'/}"; is_noncode_target "$v" && exit 0 ;;
                --glob=*|--iglob=*) v="${w#*=}"; v="${v//\"/}"; v="${v//\'/}"; is_noncode_target "$v" && exit 0 ;;
                --include=*) v="${w#--include=}"; is_noncode_target "$v" && exit 0 ;;
                -f|--file|-T|--type-not|-A|-B|-C|-m|--max-count|--include|--exclude|--exclude-dir) i=$((i+1)) ;;
                -*) continue ;;
                *) pattern="$w" ;;
            esac
            if [[ -n "$pattern" ]]; then
                pattern="${pattern//\"/}"; pattern="${pattern//\'/}"
            fi
        else
            is_noncode_target "$w" && exit 0
        fi
    done
fi

# Alternation of bare identifiers is N symbol queries in one pattern — the most
# structural shape there is, yet it slips past is_bare_identifier because of the
# metacharacter. Worse, the aggregate count invites attributing it to a single
# branch (field case: a 3-name pattern counted ~30 files, reported as usages of
# one function that had zero external callers). Split it into one query per name.
case "$dialect" in
    bre)
        # \| is alternation; a bare | is a literal pipe character, so it
        # must never split the pattern. $'\x01' is unusable as an IFS
        # separator on macOS's bash 3.2 (it silently fails to split) —
        # \x02 splits correctly there and elsewhere.
        delim=$'\x02'
        alt="${pattern//\\|/$delim}"
        ;;
    ere)
        # Bare | is alternation; protect escaped \| first so it isn't
        # read as a delimiter — it's a literal pipe under this dialect.
        delim='|'
        esc=$'\x03'
        alt="${pattern//\\|/$esc}"
        ;;
    *)
        # Fixed strings (or an unrecognized dialect): no alternation at all.
        delim=""
        alt=""
        ;;
esac
if [[ -n "$delim" && "$alt" == *"$delim"* ]]; then
    IFS="$delim" read -r -a branches <<< "$alt"
    all_bare=1
    [[ ${#branches[@]} -ge 2 ]] || all_bare=0
    for b in "${branches[@]}"; do
        is_bare_identifier "$b" || { all_bare=0; break; }
    done
    if [[ "$all_bare" == 1 ]]; then
        {
            printf 'ast-index guard: "%s" are %d symbol queries in one pattern.\n' \
                "$pattern" "${#branches[@]}"
            printf 'An aggregate count cannot be attributed to a single branch.\n'
            printf 'Ask one at a time:\n'
            for b in "${branches[@]}"; do
                printf '  ast-index usages %s --limit 1000\n' "$b"
            done
            printf 'A result equal to the limit is a lower bound, not a count —\n'
            printf 're-run with a higher --limit.\n'
        } >&2
        exit 2
    fi
fi

is_bare_identifier "$pattern" || exit 0

cat >&2 <<EOF
ast-index guard: "$pattern" looks like a structural symbol query, and this
repo has ast-index initialized. grep undercounts symbols (field case: 14 vs
24 usages, plus a missed extension function). Run instead:
  ast-index usages "$pattern" --limit 1000  # every caller / reference
  ast-index symbol "$pattern"               # definition lookup
  ast-index implementations "<X>"           # interface -> concrete classes
If this is genuinely a literal / resource / log-string search, re-run the
grep restricted to non-code targets (e.g. glob for res/, *.xml, *.md), or
use a pattern with regex metacharacters or dots (e.g. R\\.string\\.foo).
EOF
exit 2
