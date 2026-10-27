# Pathway: feature (TDD)

Implement step for `feature`-labeled tasks. Used at Step 2 of the `executing-tasks` spine.

**REQUIRED SUB-SKILL:** Use `adlc:test-driven-development` (and `adlc:writing-tests` for test quality).

**Iron law:** no production code without a failing test first.

## Step 2: TDD Implementation

**RED — write failing tests:**
1. Review the Specification (expected behaviours), the Technical Plan (patterns to follow), and the acceptance criteria.
2. Write a **unit test** for each specified behaviour — task-level TDD is unit-first, and these drive the RED-GREEN-REFACTOR cycle.
3. Author or extend the phase's **acceptance tests** (the e2e/slice tests) for the criteria your layer enables. Full-phase acceptance coverage is gated at orchestration (Tier 2); a standalone/single-task feature is the whole slice, so it owns all of it here. Browser/manual checks supplement these only where a criterion genuinely can't be automated.
4. Name the `AC-n` each test verifies (test name, describe block, or comment) — the review below checks this mapping.
5. Run tests; confirm each fails because the feature is missing (not because of typos/errors).
6. Skip-mark each test with the criterion it verifies (`@pytest.mark.skip(reason="red-test-AC-1")`, `test.skip('... (red-test-AC-1)')`, `@Disabled("red-test-AC-1")`) so the suite stays green for pre-commit; GREEN removes them.
7. **Commit RED — test files only**, with the step 5 failure output in the commit message. `git commit -m "test(<scope>): failing tests for AC-n.. (RED, skipped)"`. Production code in the RED commit destroys the ordering evidence.

**RED REVIEW GATE — before any production code:**

Mandatory for every task. `AC-n` = one criterion from the ticket's success criteria.

1. Review the RED commit (`git show`) against the acceptance criteria: every test traces to an `AC-n` and carries its marker, every in-scope `AC-n` has a test, assertions are on observable behaviour (not call counts or private methods), the recorded output shows assertion failures rather than import/collection errors (re-run with the markers stripped if it doesn't), and no assertion is vacuous.
2. Dispatch `Agent(subagent_type="code-reviewer")` on the RED commit, or get human approval. Rejected? Rewrite the tests and re-review.
3. **Freeze the test files** for GREEN. See `test-driven-development` → `resources/red-review-gate.md`.

For changes to *existing* behaviour, commit ordering proves little — the current behaviour is already visible. Use the AC-derived test cases supplied in the ticket; if none were supplied, ask for them before writing tests.

**GREEN — minimal implementation:**
1. Write the simplest code to pass the first test.
2. Run tests; verify it passes. Repeat per test until all pass.
3. No premature optimization or extra features.
4. **Remove the markers in this commit — the only edit permitted to an approved test file.** A test that is genuinely wrong is a spec amendment: correct the `AC-n` in the ticket and re-run the RED review — never relax an assertion to reach green.

**REFACTOR — clean up:**
1. Remove duplication, improve naming, simplify conditionals (see `test-driven-development` refactoring guide).
2. Run tests after each change; keep them green.

**Inner loop after each RED-GREEN-REFACTOR cycle:** `just test` · `just lint` · `just typecheck`.
Fix failures before the next cycle.

## Success-criteria additions
- Every behaviour in the Specification has a passing unit test.
- Acceptance tests authored/extended for the criteria your layer enables; full-phase coverage is gated at orchestration (Tier 2). Standalone/single-task: every acceptance criterion has a passing acceptance test here.
- Required context check: if no `unit_tests` and no test references in `task_description`, STOP — cannot follow TDD without test specs.
- RED committed (tests only, skip-marked) and reviewed against its `AC-n` before GREEN; markers removed in the GREEN commit, tests otherwise unchanged.

## Completion-signal additions
Include a **## Tests Written** section listing each test (unit and acceptance) by file/name and PASSED status.

## Checklist additions
- [ ] Followed TDD (tests first, watched fail, implemented, refactored)
- [ ] RED committed (test files only, skip-marked) and reviewed against its `AC-n` before GREEN
- [ ] Markers removed in the GREEN commit; no `red-test-AC-` remains and those tests now pass
- [ ] Approved tests otherwise unchanged during GREEN (or amended via the ticket, with re-review)
- [ ] Every specified behaviour has a passing unit test
- [ ] Acceptance tests authored/extended for your layer (standalone/whole-slice: every criterion covered)
