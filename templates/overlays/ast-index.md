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
