---
name: executing-tasks
description: Unified Tier 3 task execution for feature/bug/chore phases. A shared spine - accept context, implement via the pathway for this task's label, verify, code review, commit, report completion - that loads the matching pathway (feature = TDD, bug = investigate + TDD, chore = verify-only). Dispatched by execution-orchestration for each task within a phase.
version: 1.0.0
---

# Executing Tasks (Tier 3 Task Execution)

Execute a single task within a phase. The phase's **label selects the pathway**; everything
around the implement step is shared across all task types.

**Core principle:** Right pathway for the task type, same quality gates for all.

**Context:** Dispatched by `execution-orchestration` (Tier 2/team) for each task within a phase. The phase
label (`feature` / `bug` / `chore`) determines which pathway you follow at Step 2.

## Pathways

| Phase label | Pathway | Implement step (Step 2) |
|-------------|---------|--------------------------|
| `feature` | [pathways/feature.md](pathways/feature.md) | TDD: RED → GREEN → REFACTOR |
| `bug` | [pathways/bug.md](pathways/bug.md) | systematic-debugging → reproduce with test → minimal fix |
| `chore` | [pathways/chore.md](pathways/chore.md) | pre-flight → direct implement (no TDD) |

**Read the pathway file for this task's label now** and follow it where Step 2 says so. The
pathway also lists any extra success-criteria rows, completion-signal fields, and checklist
items specific to that task type.

When invoked directly by a command rather than via a phase (`/adlc:bug-fix` → `bug`,
`/adlc:chore` → `chore`, `/adlc:quick`/feature work → `feature`), use the pathway the command
specifies instead of a phase label.

## Success Criteria (all task types)

**Before reporting a task complete, ALL of the following must be true:**

| Check | Command | Expected Output |
|-------|---------|-----------------|
| Tests pass | `just test` | 0 failures, 0 regressions |
| Lint clean | `just lint` | No warnings or errors |
| Format clean | `just format --check` | No formatting issues |
| Types check | `just typecheck` (if available) | No type errors |
| Build succeeds | `just build` (if available) | Exit code 0 |
| Acceptance criteria | Author/extend the phase's acceptance tests for the behaviour you land; **standalone/single-task work → a passing acceptance test per criterion** | Full-phase coverage from one task (gated at orchestration, not here) |

The pathway adds type-specific rows (e.g. `bug` requires the reproducing test to pass;
`feature` requires every specified behaviour to have a unit test).

**Acceptance tests verify the slice as a whole (= the phase).** A task owns its **unit tests** and
authors/extends acceptance tests for the behaviour it lands; coverage of *all* the phase's
acceptance criteria is gated at **orchestration (Tier 2)** on the integrated branch. Exception:
standalone / single-task work is the whole slice, so this task owns full acceptance coverage.

**When to escalate vs retry:**
- Failure in YOUR code → fix and retry (up to 3 attempts)
- Failure in UNRELATED/pre-existing code → report as blocker, continue other work
- Lint/format issues → auto-fix and retry
- Build failure from your changes → fix and retry; from external cause → report as blocker
- Acceptance criteria unclear → report as blocker (do not guess)

## Autonomous Agent Behavior

**Operate autonomously. Only stop when truly blocked.**

1. **Proceed without confirmation** — implement, verify, fix, commit without pausing
2. **Do not ask "Ready to proceed?"** — just proceed through each step
3. **Flag blockers and continue** — if one aspect is blocked, work on other aspects
4. **Incorporate CI feedback** — if CI fails after commit, fix and re-commit without waiting
5. **Make decisions** — choose the simplest correct approach; don't present options unless genuinely ambiguous
6. **Time-box investigation** — if stuck for more than 3 attempts on a single issue, report it and move on

**Blockers (STOP and report):** missing dependency that can't be mocked; ambiguous acceptance
criteria with no reasonable default; external service unavailable with no stub; change requires
an architectural decision, a breaking API/contract change, or access you don't have.

**Not blockers (handle yourself):** test/lint failures, missing imports, unclear names, multiple
plausible approaches — fix or decide and proceed.

## Verification Gate — Evidence Before Claims

Run the proving command before claiming the work is done. This gate governs Step 3 (Verification)
and Step 7 (Report Completion) below — apply it before every completion claim.

**Rule:** no completion claim without fresh verification output. If you haven't run the proving
command *in this step*, don't claim it passes.

**Before making a claim:**
1. Identify the command that proves it.
2. Run it fresh and in full.
3. Read the output — exit code, failure count.
4. If the output doesn't confirm the claim, report the actual status with that evidence instead.

**What each claim requires:**

| Claim | Requires | Not sufficient |
|-------|----------|----------------|
| Tests pass | Test command output: 0 failures | A previous run, "should pass" |
| Linter clean | Linter output: 0 errors | Partial check, extrapolation |
| Build succeeds | Build command: exit 0 | Linter passing, logs "look good" |
| Bug fixed | Test of the original symptom passes | Code changed, assumed fixed |
| Regression test works | Red-green cycle verified | Test passes once |
| Requirements met | Line-by-line checklist vs the ticket | Tests passing |

**Watch for:** "should" / "probably" / "seems to"; reporting done before running the command;
committing, opening a PR, or emitting a completion signal without fresh output. Wording that
implies success without having run the check is a claim without evidence — reword it or run the
check.

## The Process

**Fresh context per task:** each task runs with clean context. If the orchestrator provided a
"Codebase Patterns" section, review it first.

### Step 1: Accept Task Context

The dispatch carries a short pointer: `phase_id`, `task_index`, `pathway`, and a **`brief_path`**.
**Read the brief file at `brief_path` first** — it holds the full task context (task body, files,
reference patterns, the relevant Specification + Technical Plan slice, acceptance criteria, and
any pathway-specific fields). You do **not** need PM/MCP access; everything is in the file.
See [../execution-orchestration/references/task-brief.md](../execution-orchestration/references/task-brief.md).

```
phase_id            # Phase identifier for the completion signal
task_index          # Task index within the phase for the completion signal
pathway             # feature | bug | chore (which pathway to follow at Step 2)
brief_path          # Local file with full context — read it
```

**Fallback:** if no `brief_path` is provided (e.g. a direct standalone invocation), read the
inline context the caller passed instead: `task_title`, `task_description`, `files`,
`reference_patterns`, plus pathway-specific fields (`unit_tests` for feature; `bug_description` /
`expected_behavior` / `actual_behavior` for bug).

**Validate:** stop with an error if you have neither a readable `brief_path` nor an inline
`task_description`, or if `phase_id`/`task_index` are missing (cannot emit a completion signal).
Pathways may add their own required-context checks.

### Step 2: Implement — follow the pathway

**Load [pathways/{label}.md](pathways/) for this task's label and follow its implement step.**
This is the only type-specific step. Run the pathway's inner loop (`just test` / `lint` /
`typecheck`) after each cycle; do not accumulate errors.

### Step 3: Verification

```bash
just test          # All tests
just lint          # Code quality
just format        # Formatting
just build         # Build succeeds, if applicable
```

All checks must pass before proceeding — apply the **Verification Gate** (above): read each
command's real output, don't extrapolate. Author or extend the phase's acceptance tests for the
behaviour you landed; if this task is the whole slice (standalone/single-task), confirm every
acceptance criterion has a passing acceptance test — otherwise full-phase coverage is gated at
orchestration (Step 5d). Browser/manual checks supplement acceptance tests where a behaviour is
automatable, not replace them. For frontend work, **also verify in the browser** (renders,
interactions, no console errors). For APIs, verify endpoints return expected responses. Fix and
re-run until all pass.

### Step 4: Request Code Review

**REQUIRED SUB-SKILL:** Use `adlc:requesting-code-review`.

Applies to **every** pathway — including `chore` (a lightweight review focused on regressions
and quality, since chores skip TDD). Prepare a change summary and dispatch the code-reviewer
with `WHAT_WAS_IMPLEMENTED`, `PLAN_OR_REQUIREMENTS` (ticket Specification + Technical Plan),
`CHANGES_SUMMARY`, and `DESCRIPTION`.

### Step 5: Apply Review Feedback

**REQUIRED SUB-SKILL:** Use `adlc:receiving-code-review`.

- **Critical:** fix immediately, re-run tests, request re-review
- **Important:** fix before proceeding, verify with tests
- **Minor:** fix if quick, else note for follow-up

Re-run the inner loop after fixes. If 3+ fix attempts fail, STOP and report to the orchestrator.

### Step 6: Commit Changes

The `feature` and `bug` pathways already committed the failing tests (the RED commit). This step
commits the implementation on top of it — two commits per task, with the test-first ordering
visible in history.

```bash
git add <exact paths changed>          # never `git add .`
git commit -m "<type>(<scope>): <concise description> [<ticket-id>]" \
  -m "Tests: <testing summary>" \
  -m "Closes <ticket-id>"
```

Stage exact paths. Approved test files appear here only for the removal of their `red-test-AC-n`
markers — any other change to them needed a corrected `AC-n` and a re-review first.

Use the conventional `type` for the pathway (`feat` for feature, `fix` for bug, `chore`/`refactor`
for chore). Include what changed, testing summary, and `Closes <ticket-id>`.

### Step 7: Report Completion

**Apply the Verification Gate (above).** Re-run the proving commands fresh and read their output
before reporting — the Verification section must reflect commands you ran *in this step*, not an
earlier run. Bug pathway: this includes seeing the reproducing test pass now.

Emit the structured completion signal:

```xml
<completion>TASK:{phase_id}:{task_index}:COMPLETE

## Summary
- {what was built / fixed / changed}

## Verification
- just test PASSED ({N} tests, 0 failures)
- just lint PASSED
- just build PASSED

## Files Changed
- {file} (new/modified)
</completion>
```

The pathway lists extra body sections to include (e.g. `bug` → Root Cause; `feature` → Tests
Written). For blocked/failed work emit `:BLOCKED` or `:FAILED` with details instead. Then
return a short human-readable summary (implemented, tests, patterns discovered, verification,
commit SHA, files) to the orchestrator.

## Error Handling

- **Checks fail after implementation** → review the pathway's process, fix, re-run; never skip.
- **Code review finds Critical issues** → fix immediately, request re-review; do not mark complete until approved.
- **Cannot complete after 3 attempts** → document the blocker, report to the orchestrator (retry / skip / escalate).

## Checklist (before completion)

- [ ] Accepted task context; validated required fields
- [ ] Followed the pathway for this label (Step 2) with inner loop passing each cycle
- [ ] All tests / lint / format / build passing
- [ ] Acceptance tests authored/extended for the behaviour landed (standalone/whole-slice: every criterion covered; frontend: also verified in browser)
- [ ] Code review requested and passed; feedback applied
- [ ] Committed with a conventional message
- [ ] Verified completion freshly (Verification Gate — fresh command output, this step)
- [ ] Emitted `<completion>TASK:{phase_id}:{task_index}:STATUS</completion>`
- [ ] Pathway-specific checklist items satisfied

## Remember

- **Right pathway, same gates** — only Step 2 differs by task type
- **Code review is mandatory for every pathway** (lightweight for chores)
- **All checks must pass** — tests, lint, format, build
- **Verify before claiming done** — fresh command output, not assumption
- **Work autonomously** — proceed without confirmation; stop only when truly blocked
- **Report back clearly** — the orchestrator needs the summary to track progress
