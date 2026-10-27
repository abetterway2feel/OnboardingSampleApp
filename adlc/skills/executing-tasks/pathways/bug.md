# Pathway: bug (investigate → reproduce → fix)

Implement step for `bug`-labeled tasks. Used at Step 2 of the `executing-tasks` spine.

**REQUIRED SUB-SKILLS:** `adlc:systematic-debugging` (investigation), `adlc:test-driven-development`
(reproduce + fix), `adlc:root-cause-tracing` (when the error is deep in the call stack).

**Principle:** investigation first — never guess at fixes. Minimal change at the root cause.

## Step 2a: Root-cause investigation

Use `adlc:systematic-debugging` (Phase 1). Read error messages carefully, reproduce
consistently, check recent changes, gather evidence (add instrumentation if multi-component),
trace the data flow to where the bad value originates (use `root-cause-tracing` if deep).
Document: **Root Cause**, **Evidence**, **Location (file:line)**.

## Step 2b: Reproduce with a failing test

Use `adlc:test-driven-development` (RED). Write a test that triggers the bug and **fails with the
same error as the report** — this confirms the test actually reproduces it.

**Write it from the bug report, not from the code path you just read.** The report describes the
required behaviour; the code describes the current (wrong) behaviour. This is the one place a
reproduction test commonly ends up asserting the defect.

Then skip-mark it `red-test-AC-n` (so the suite stays green for pre-commit), **commit RED — test
files only** with the failure output in the commit message, and review it against the `AC-n` /
expected behaviour before fixing anything. The fix then changes production code and removes the
marker, nothing else.
See `test-driven-development` → [../../test-driven-development/resources/red-review-gate.md](../../test-driven-development/resources/red-review-gate.md).

## Step 2c: Minimal fix

Use `adlc:test-driven-development` (GREEN + REFACTOR). Fix only the identified root cause — don't
refactor unrelated code or fix other bugs. Remove the `red-test-AC-n` marker in the fix commit and
verify the reproducing test now runs and passes.

**Inner loop:** `just test` · `just lint` · `just typecheck` — full suite, no regressions.

## Success-criteria additions
- Reproducing test passes (`just test <test-file>`) and the original behaviour no longer occurs.
- Required context check: if no structured bug fields (`bug_description` / `expected_behavior` /
  `actual_behavior`), warn — investigation may be slower — but proceed.

## Completion-signal additions
Include a **## Root Cause** section and note the reproducing test under Tests/Verification.
Document the root cause in the commit message and in a code comment at the fix site.

## Error handling additions
- Cannot identify root cause → use `root-cause-tracing`, add logging; report blocked if still stuck after thorough investigation.
- Fix fails after 3 attempts → may be architectural (see `systematic-debugging` Phase 4.5); report to the orchestrator.

## Checklist additions
- [ ] Root cause identified (systematic investigation), documented in code + commit
- [ ] Failing test reproduces the bug; verified it fails for the right reason
- [ ] Reproduction test derived from the report, committed as RED (tests only, marked `red-test-AC-n`), reviewed before the fix
- [ ] Marker removed in the fix commit; no `red-test-AC-` remains
- [ ] Reproducing test now passes; bug no longer occurs (frontend: verified in browser)
