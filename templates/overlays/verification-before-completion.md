<!-- BEGIN gor-mobile overlay -->

## gor-mobile overlay (Android/Kotlin)

The skill body above runs verbatim. The following ADD to it when the target
is an Android/Kotlin codebase.

### Anti-slop checklist

Before claiming a task is "complete" or "fixed", verify it doesn't fall
into any of these failure modes — each of which has historically produced
low-quality changes that the user later had to revert or rewrite:

1. **Third-party dependencies added without justification** — adding a
   library because it's "convenient" or "saves a few lines" is not
   justification. The user owns dependency decisions. If the change
   requires a new Gradle dep, surface it explicitly with the rationale
   and wait for approval before adding.

2. **Speculative fixes** — every change must solve a concrete problem
   the user surfaced. "I noticed this could theoretically race" or
   "the lint flagged this" is not enough. If you cannot point to the
   exact symptom or user request that motivated the change, do not
   bundle it in.

3. **Bundled unrelated refactoring** — if the user asked you to fix bug
   X, do not also rename methods, reformat unrelated files, or
   "improve" tangential code. Each of those is a separate change and
   each deserves its own user-approved cycle. Surface them as
   suggestions, do not just bundle them silently into the diff.

4. **Fabricated problem descriptions** — when filling in tracker tickets,
   PR descriptions, commit messages, or inline comments, describe only
   what you actually verified. Do not invent a user story, do not
   invent a bug report, do not claim "this fixes performance issues on
   Android 14" unless you actually measured it.

5. **"Compliance" rewrites of project conventions** — if the codebase
   does something non-idiomatic, do not rewrite it to match a generic
   best-practice unless the user asked. The team likely knows about
   the deviation and chose it deliberately. Surface the observation
   as a question, not as a fait accompli.

If any of these apply, the work is NOT complete — it has slop attached
to it. Strip the slop, then run verification again.

### Android CLI — phase command mapping

For Android/Kotlin targets, the `android` CLI is the primary tool for
this phase. Invoke `[[gor-mobile-using-android-cli]]` to get the
phase→command map. That bridge skill is authoritative for Android
device ops, replacing direct `adb` / `./gradlew` invocations.

<!-- END gor-mobile overlay -->
