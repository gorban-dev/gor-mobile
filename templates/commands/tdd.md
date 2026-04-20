---
description: Test-Driven Development — RED → GREEN → REFACTOR for any behavior change
---

Task from user: **$ARGUMENTS**

## Android adaptation (gor-mobile overlay)

This is the superpowers `test-driven-development` skill, adapted for Android/gor-mobile. The skill text below is verbatim; the overlay only adds:

- **Local-LLM delegation for the RED and GREEN phases**: when the test or the minimal implementation is Kotlin code you're about to write, generate it via:

  ```sh
  gor-mobile llm tdd-red --input <prompt-file>   # for the failing test
  gor-mobile llm impl    --input <prompt-file>   # for the minimal implementation
  ```

  On `status == OK` → use `.content`. On `BLOCKED`/`ERROR` → fall back to Opus.

- **Rules to pass into every delegation prompt**: `$HOME/.gor-mobile/rules/rules/core.md`, `$HOME/.gor-mobile/rules/rules/testing.md`, and, if applicable, 1-2 example tests from `$HOME/.gor-mobile/rules/examples/<layer>/`.

- **Test commands**: replace `npm test` / `pytest` in the examples below with:

  ```sh
  ./gradlew :<module>:test --tests "*<Name>Test*"
  ```

  For UI/integration tests, use the corresponding `connectedAndroidTest` task or the Compose test runner the project already has wired up.

- **Scope**: TDD is MANDATORY for UseCase and Mapper business logic (pure Kotlin). For ViewModel state machines it is strongly recommended. Pure Compose UI does not have a forced RED phase.

- **No auto-commit**: the verbatim text below mentions "commit after REFACTOR". In gor-mobile we leave all commits to the user — do NOT `git add` / `git commit`.

Everything else — the Iron Law, Red-Green-Refactor flow, "verify RED" / "verify GREEN" gates, rationalizations table, red flags — is **unchanged** from superpowers.

---

# Test-Driven Development (TDD)

## Overview

Write the test first. Watch it fail. Write minimal code to pass.

**Core principle:** If you didn't watch the test fail, you don't know if it tests the right thing.

**Violating the letter of the rules is violating the spirit of the rules.**

## When to Use

**Always:**
- New features
- Bug fixes
- Refactoring
- Behavior changes

**Exceptions (ask your human partner):**
- Throwaway prototypes
- Generated code
- Configuration files

Thinking "skip TDD just this once"? Stop. That's rationalization.

## The Iron Law

```
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST
```

Write code before the test? Delete it. Start over.

**No exceptions:**
- Don't keep it as "reference"
- Don't "adapt" it while writing tests
- Don't look at it
- Delete means delete

Implement fresh from tests. Period.

## Red-Green-Refactor

### RED - Write Failing Test

Write one minimal test showing what should happen.

**Kotlin example (Android adaptation):**

```kotlin
class RetryOperationTest {
    @Test
    fun `retries failed operations 3 times`() = runTest {
        var attempts = 0
        val operation: suspend () -> String = {
            attempts++
            if (attempts < 3) error("fail") else "success"
        }

        val result = retryOperation(operation)

        assertEquals("success", result)
        assertEquals(3, attempts)
    }
}
```

Clear name, tests real behavior, one thing.

**Anti-example:**

```kotlin
@Test
fun `retry works`() = runTest {
    val mock = mockk<suspend () -> String>()
    coEvery { mock() } throwsMany listOf(Exception(), Exception()) andThen "success"
    retryOperation(mock)
    coVerify(exactly = 3) { mock() }
}
```

Vague name, tests mock not code.

**Requirements:**
- One behavior
- Clear name
- Real code (no mocks unless unavoidable)

### Verify RED - Watch It Fail

**MANDATORY. Never skip.**

```bash
./gradlew :<module>:test --tests "*RetryOperationTest*"
```

Confirm:
- Test fails (not errors)
- Failure message is expected
- Fails because feature missing (not typos)

**Test passes?** You're testing existing behavior. Fix test.

**Test errors?** Fix error, re-run until it fails correctly.

### GREEN - Minimal Code

Write simplest code to pass the test.

**Kotlin example:**

```kotlin
suspend fun <T> retryOperation(fn: suspend () -> T): T {
    var last: Throwable? = null
    repeat(3) {
        try {
            return fn()
        } catch (t: Throwable) {
            last = t
        }
    }
    throw last ?: IllegalStateException("unreachable")
}
```

Just enough to pass.

**Anti-example (over-engineered):**

```kotlin
suspend fun <T> retryOperation(
    fn: suspend () -> T,
    maxRetries: Int = 3,
    backoff: Backoff = Backoff.Exponential,
    onRetry: (Int) -> Unit = {},
): T = TODO("YAGNI")
```

Don't add features, refactor other code, or "improve" beyond the test.

### Verify GREEN - Watch It Pass

**MANDATORY.**

```bash
./gradlew :<module>:test --tests "*RetryOperationTest*"
```

Confirm:
- Test passes
- Other tests still pass
- Output pristine (no errors, warnings)

**Test fails?** Fix code, not test.

**Other tests fail?** Fix now.

### REFACTOR - Clean Up

After green only:
- Remove duplication
- Improve names
- Extract helpers

Keep tests green. Don't add behavior.

### Repeat

Next failing test for next feature.

## Good Tests

| Quality | Good | Bad |
|---------|------|-----|
| **Minimal** | One thing. "and" in name? Split it. | `test('validates email and domain and whitespace')` |
| **Clear** | Name describes behavior | `test('test1')` |
| **Shows intent** | Demonstrates desired API | Obscures what code should do |

## Why Order Matters

**"I'll write tests after to verify it works"** — tests written after code pass immediately. Passing immediately proves nothing: might test wrong thing, implementation instead of behavior, or miss edge cases. Test-first forces you to see the test fail, proving it actually tests something.

**"I already manually tested all the edge cases"** — manual testing is ad-hoc. No record, can't re-run, easy to forget cases under pressure. Automated tests are systematic; they run the same way every time.

**"Deleting X hours of work is wasteful"** — sunk cost fallacy. Keeping code you can't trust IS waste.

**"TDD is dogmatic, being pragmatic means adapting"** — TDD IS pragmatic. Finds bugs before commit, prevents regressions, documents behavior, enables refactoring.

**"Tests after achieve the same goals - it's spirit not ritual"** — no. Tests-after answer "What does this do?" Tests-first answer "What should this do?" Tests-after are biased by implementation.

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Too simple to test" | Simple code breaks. Test takes 30 seconds. |
| "I'll test after" | Tests passing immediately prove nothing. |
| "Tests after achieve same goals" | Tests-after = "what does this do?" Tests-first = "what should this do?" |
| "Already manually tested" | Ad-hoc ≠ systematic. No record, can't re-run. |
| "Deleting X hours is wasteful" | Sunk cost fallacy. Keeping unverified code is technical debt. |
| "Keep as reference, write tests first" | You'll adapt it. That's testing after. Delete means delete. |
| "Need to explore first" | Fine. Throw away exploration, start with TDD. |
| "Test hard = design unclear" | Listen to test. Hard to test = hard to use. |
| "TDD will slow me down" | TDD faster than debugging. Pragmatic = test-first. |
| "Manual test faster" | Manual doesn't prove edge cases. You'll re-test every change. |
| "Existing code has no tests" | You're improving it. Add tests for existing code. |

## Red Flags - STOP and Start Over

- Code before test
- Test after implementation
- Test passes immediately
- Can't explain why test failed
- Tests added "later"
- Rationalizing "just this once"
- "I already manually tested it"
- "Tests after achieve the same purpose"
- "It's about spirit not ritual"
- "Keep as reference" or "adapt existing code"
- "Already spent X hours, deleting is wasteful"
- "TDD is dogmatic, I'm being pragmatic"
- "This is different because..."

**All of these mean: Delete code. Start over with TDD.**

## Verification Checklist

Before marking work complete:

- [ ] Every new function/method has a test
- [ ] Watched each test fail before implementing
- [ ] Each test failed for expected reason (feature missing, not typo)
- [ ] Wrote minimal code to pass each test
- [ ] All tests pass
- [ ] Output pristine (no errors, warnings)
- [ ] Tests use real code (mocks only if unavoidable)
- [ ] Edge cases and errors covered

Can't check all boxes? You skipped TDD. Start over.

## When Stuck

| Problem | Solution |
|---------|----------|
| Don't know how to test | Write wished-for API. Write assertion first. Ask your human partner. |
| Test too complicated | Design too complicated. Simplify interface. |
| Must mock everything | Code too coupled. Use dependency injection. |
| Test setup huge | Extract helpers. Still complex? Simplify design. |

## Debugging Integration

Bug found? Write failing test reproducing it. Follow TDD cycle. Test proves fix and prevents regression.

Never fix bugs without a test.

## Final Rule

```
Production code → test exists and failed first
Otherwise → not TDD
```

No exceptions without your human partner's permission.
