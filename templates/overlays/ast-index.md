<!-- BEGIN gor-mobile overlay -->

## gor-mobile overlay (Android/Kotlin)

The skill body above runs verbatim. The following overrides apply when
loaded via gor-mobile.

### Scope: Android only

gor-mobile only supports Android/Kotlin/Java projects. Ignore any
mentions of iOS/Swift, Web/TypeScript, Ruby, Rust, C#, Dart, PHP, Perl,
Python-only, Go, Scala, C/C++, Proto, or WSDL in the upstream body
above. The only relevant `references/` files in this skill are
`android-commands.md` and `module-commands.md`.

### Structural queries are MANDATORY ast-index territory

Symbols, usages, callers, implementations, class hierarchies — these are
answered by `ast-index`, never by `grep`. This is not a preference: grep
undercounts symbol references (field case: 14 vs 24 usages of an extension
function, plus a sibling extension missed entirely), and an undercount is
invisible — the wrong number looks as plausible as the right one. A
PreToolUse guard hook denies bare-identifier greps in initialized repos and
prints the substitute command; do not phrase around the guard — rephrase
the question to ast-index. grep remains correct for literals: string
resources (`R.string.foo`), log messages, XML/manifest content, comments.

> **Red Flag — STOP.** Typing `grep <BareIdentifier>` (or the Grep tool
> with an identifier pattern) in an ast-index repo. That is a structural
> query wearing a text-search costume — run `ast-index usages/symbol`
> instead.

### Counting: the default limit truncates the answer

`ast-index usages` and `ast-index callers` both default to `--limit 50`, and
the limit clips the **headline number**, not just the listing: 70 real usages
print as `Usages of 'X' (50)`, and 70 real callers print as `Callers of 'X'
(49)` — the callers headline caps one below the stated default, so "count
equals the limit" is not a safe truncation check for it. There is no
ellipsis and no "showing 50 of 70" for either command. Always pass `--limit
1000` up front on both, rather than waiting for a suspicious-looking count.

Never attribute a number obtained from a combined pattern to a single name. One
symbol, one query, one number.

### Where the tool stops being authoritative

Subcommands split in two, and only the first half can go stale:

- **Index-backed:** `symbol`, `class`, `hierarchy`, `implementations`,
  `outline`, `refs`, `module` / `deps` / `api`.
- **grep-backed:** `usages`, `callers`, `extensions`, `suspend`, `flows`,
  `composables`, `annotations`, `todo`.

There is no way to recognise which bucket a subcommand falls into from
`ast-index --help` or from its own output — don't infer it, rely on the list
above. `--help` files `usages` under "Search & Navigation" next to
`symbol`/`class`/`refs`, not under the "Code Patterns (grep-based)" heading
it actually shares with the other seven. At runtime, only `usages` ever
appends an `(indexed)`/`(grep)` suffix to its `Time: …` line, and that
reflects whether that one query resolved from the index or fell back to
grep, not a fixed per-command label; the other seven grep-backed commands
always print a bare `Time: …ms` with no suffix at all.

Two consequences worth stating outright:

- An empty `symbol X` means "X is not a project symbol" — stdlib and library
  symbols (`onSuccess` / `onFailure` on `kotlin.Result`) are simply not indexed.
  It does not mean X does not exist.
- `usages X` does not list occurrences inside the file where X is defined. For
  "can this be made `internal` / deleted?" that is exactly right. For "how many
  call sites are there?" it undercounts by every in-file call.

### Before searching: ensure the project is initialized

If the current working directory looks like an Android repo
(`build.gradle.kts`, `settings.gradle.kts`, or `build.gradle` is
present) and `.claude/rules/ast-index.md` does NOT exist in that repo,
invoke the upstream slash command `/ast-index:initialize-android`
BEFORE running any `ast-index` queries. That command writes the
project-local `.claude/` files and runs the initial `ast-index rebuild`.

gor-mobile itself never writes to a project's `.claude/` — this is the
upstream plugin's responsibility.

### If the `ast-index` CLI is missing

If `ast-index` is not in `PATH`:

1. Tell the user to install it:
   `brew tap defendend/ast-index && brew install ast-index`
   (or see https://github.com/defendend/Claude-ast-index-search for
   non-brew install options).
2. Fall back to `Grep` / `Read` for this session; do not block on the
   install.

<!-- END gor-mobile overlay -->
