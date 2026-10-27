---
name: breakdown-planning
description: Create implementation sub-issues from Specification and Technical Plan using vertical slicing, where each phase delivers independently demoable end-to-end functionality
when_to_use: when Specification and Technical Plan are complete and you need to break down work into executable sub-issues
version: 4.0.0
---

# Breakdown Planning

## Overview

Break down Specification + Technical Plan into executable sub-issues using **vertical slicing**. Each phase delivers independently demoable functionality touching all necessary layers and is **proven end-to-end**. Tasks within a phase are atomic todos that together complete the phase.

**Core principle:** Every phase is a vertical slice - it touches DB, API, and UI (as needed) for ONE piece of functionality, and ships with an end-to-end test that proves it. Never slice horizontally by layer.

**Don't force a breakdown.** If the issue is already a single thin vertical slice, propose skipping the breakdown and executing it directly; if it's questionable, clarify with the user before slicing. See Phase 2.

**Critical — vertical means verified end-to-end:** A slice is not vertical just because it touches every layer. It must be *provable* end-to-end. Every feature/bug phase includes an **end-to-end / acceptance test** that drives the whole slice (e.g. UI form → API → DB and back, or the public interface for non-UI work), on top of the per-layer unit tests. Scale the test to the stack — full-stack E2E where a harness exists, an integration test spanning the slice as the floor — but don't drop it. If you cannot write *any* test that demonstrates the slice working, it is not a vertical slice — restructure it. (Chore phases — infra, refactors — are exempt; they use a verification checklist instead.)

**Critical:** NEVER create separate "write tests" and "implement" tasks. Each task includes BOTH.

**Announce at start:** "I'm using the breakdown-planning skill to create the implementation breakdown."

## Terminology

| Term | Slice Direction | Definition | Example |
|------|----------------|-----------|---------|
| **Phase** | **Vertical** (e2e thin slice) | A subticket under the parent feature. Delivers independently demoable end-to-end functionality touching all necessary layers. Has its own acceptance criteria and acceptance tests. | "Phase 1: Register a user (DB + API + UI)" |
| **Task** | **Horizontal** (layer-specific) | A todo item within a phase subticket. One TDD cycle targeting a specific layer or concern. | "Add users table migration (DB)", "Implement POST /api/users endpoint (API)" |

**Key distinctions:**
- Phases are subtickets in the PM system. Tasks are checklist items within a phase's description — **never separate tickets**.
- Phases slice **vertically** across layers to deliver demoable behavior. Tasks slice **horizontally** within a phase, each targeting one layer (DB, service, API, UI).

## Quick Reference

| Phase | Key Activities | Tool Usage | Output |
|-------|---------------|------------|--------|
| **1. Load Context** | Retrieve Specification + Technical Plan | Linear/JIRA MCP | Full context loaded |
| **2. Extract Phases** | Identify vertical slices from Technical Plan | — | Vertical slice phases defined |
| **3. Create Tasks** | Define atomic todos within each phase | TodoWrite | Tasks with TDD checklists |
| **4. Create Sub-Issues** | Write phase subtickets to PM system | Linear/JIRA MCP | Sub-issues with full context |
| **5. Map Dependencies** | Link blocking relationships between phases | Linear/JIRA MCP | Dependency graph complete |
| **5.5 Verify Quality** | Re-read sub-issues and validate sections | Linear/JIRA MCP | All sub-issues validated |
| **5.6 Coverage Review** | Confirm phases together cover Plan + Spec | Linear/JIRA MCP | No signal loss from plan/spec |

## The Process

Copy this checklist to track progress:

```
Breakdown Progress:
- [ ] Phase 1: Load Context (Specification + Technical Plan retrieved)
- [ ] Phase 2: Extract Phases (breakdown warranted? then vertical slices identified)
- [ ] Phase 3: Create Tasks (atomic todos defined per phase)
- [ ] Phase 4: Create Sub-Issues (phase subtickets created with full context)
- [ ] Phase 5: Map Dependencies (blocking relationships documented)
- [ ] Phase 5.5: Verify Sub-Issue Quality (each sub-issue validated)
- [ ] Phase 5.6: Review for Signal Loss (phases together cover the Plan + Spec)
```

### Phase 1: Load Context

**Retrieve parent issue:**

- Linear: `mcp__linear-server__get_issue` with issue ID
- JIRA: (equivalent JIRA tool) with issue ID
- Extract: Title, Specification section, Technical Plan section

**Verify required sections:**

```python
if "## Specification" not in issue.description:
    ERROR: Missing Specification - run `/adlc:refine` first
    STOP

if "## Technical Plan" not in issue.description:
    ERROR: Missing Technical Plan - run `/adlc:plan` first
    STOP
```

**Extract context:**

- From Specification: User stories, expected behaviors, success criteria
- From Technical Plan: Components, phases, dependencies, patterns

### Phase 2: Extract Phases (Vertical Slices)

**First, decide whether a breakdown is warranted at all.** Not every issue needs splitting — do not manufacture phases to hit a quota.

```python
slices = count_independently_demoable_slices(spec, technical_plan)

if slices == 1 and fits_one_phase(issue):   # one demoable behavior, ~5 tasks, ~1 day of work
    # Already a single thin vertical slice — a breakdown would add ceremony, not value.
    PROPOSE: "This issue is already a single thin vertical slice (~N tasks). I recommend
              skipping breakdown and executing it directly as a standalone via `/adlc:execute`.
              Break it down anyway, or skip?"
    Skip unless the user asks to proceed  # execute the parent directly, no sub-issues
elif borderline:   # could be one wide slice or two thin ones — genuinely unclear
    ASK the user (AskUserQuestion): break into N phases, or execute as a single slice?
else:
    proceed with the breakdown below   # clearly multiple slices
```

- **Single thin slice** (clearly one demoable behavior): propose skipping — the parent runs directly via `/adlc:execute` as a standalone.
- **Questionable** (borderline size, unclear seams): clarify with the user before slicing.
- **Clearly multiple slices**: proceed.

**Reinterpret Technical Plan phases as vertical slices.**

The Technical Plan may describe components by layer. Your job is to reorganize them into vertical slices where each phase delivers one independently demoable piece of functionality.

**Vertical slicing rules:**

1. Each phase MUST touch all layers needed for its functionality (DB, service, API, UI)
2. Each phase MUST be independently demoable - you can show it working end-to-end
3. Phase 1 should be the thinnest possible end-to-end slice (the "walking skeleton")
4. Subsequent phases add functionality, not layers
5. Each phase MUST include an end-to-end / acceptance test that exercises the full slice — this is what proves it is vertical, not merely multi-layered

**Vertical vs Horizontal Slicing:**

```
BAD (horizontal - layers as phases):
  Phase 1: Data models (User, Session, Token)
  Phase 2: Services (AuthService, SessionService)
  Phase 3: API endpoints (/login, /register, /logout)
  Phase 4: UI (LoginForm, RegisterForm)

  Problem: Nothing is demoable until Phase 4 is complete.

GOOD (vertical - features as phases):
  Phase 1: Register a user (migration + model + POST /register + form)
  Phase 2: Log in (session model + POST /login + form + JWT)
  Phase 3: View profile (GET /me + profile page)
  Phase 4: Log out (DELETE /session + button)
  Phase 5: Reset password (token model + email + endpoints + form)

  Each phase is independently demoable from day one and verified by its own end-to-end test.
```

**Identify phases from Technical Plan:**

```python
# Parse Technical Plan components
components = parse_technical_plan(issue.description)

# Reorganize into vertical slices
phases = group_into_vertical_slices(components)

# Each phase should answer: "What can the user DO after this phase?"
for phase in phases:
    assert phase.has_demoable_behavior()
    assert phase.touches_all_needed_layers()
```

### Phase 3: Create Tasks (Horizontal Layer-Specific Units Within Phases)

**Tasks are horizontal, layer-specific todos within a vertical phase — NOT standalone subtickets.**

Each vertical phase contains multiple horizontal tasks that together deliver the end-to-end slice. Tasks target specific layers (DB migration, service logic, API endpoint, UI component) and are checklist items in the phase subticket description.

**CRITICAL RULE: One task = one TDD cycle (RED-GREEN-REFACTOR) targeting one layer**

**Every feature/bug phase ends with an end-to-end / acceptance-test task** that drives the whole slice across its layers (e.g. UI form → API → DB and back, or the public interface for non-UI work). The per-layer unit tests prove each piece; this final test proves the slice works as one demoable behavior. Make it a real task with its own file(s) — do not rely on the acceptance-criteria checklist alone.

**Sizing heuristics:**

| Level | Right-sized | Warning sign | Action | Human reference |
|-------|------------|--------------|--------|-----------------|
| **Feature** | 3-6 phases | >8 phases | Split into multiple features | ~1-1.5 weeks |
| **Phase** | ~5 tasks | >8 tasks | Split into multiple phases | ~1 day |
| **Task** | 1 TDD cycle, 1-3 files | >5 files | Split into multiple tasks | ~1-2 hours |

**Task description template:**

Each task within a phase should specify:
- **Description**: What to do in 1-2 sentences
- **Layers touched**: DB / Service / API / UI
- **Files likely modified**: Specific file paths
- **Unit tests** (explicit test names and expectations - these define the RED phase):
  - `test_name` - input -> expected output/behavior
- **Reference examples**: Similar code in the codebase to follow

**Example phase with tasks:**

```markdown
## Phase 1: Register a user

### Tasks
- [ ] Add users table migration (DB) - `db/migrations/`
      Tests: migration applies (table exists), rolls back (table gone)
- [ ] Implement User model (Service) - `models/user.py`
      Tests: test_create_valid, test_email_required, test_password_hashed, test_email_unique
- [ ] Implement POST /api/users (API) - `routes/users.py`
      Tests: test_register_201, test_missing_fields_422, test_duplicate_409, test_invalid_email_422
- [ ] Create RegisterForm (UI) - `components/RegisterForm.tsx`
      Tests: test_renders_fields, test_validates_required, test_shows_errors
- [ ] Wire form to API (Integration)
      Tests: test_submit_creates_user, test_error_displayed, test_success_confirmation
- [ ] Add end-to-end test for the slice (E2E) - `e2e/register.spec.ts`
      Tests: register_happy_path (fill form -> submit -> user in DB -> confirmation shown),
             register_duplicate_email (submit existing email -> error surfaced to user)

### E2E Acceptance
- POST /api/users with valid data -> 201, user in DB
- Submit form with invalid data -> validation errors shown
- Submit form with valid data -> confirmation page
```

## Collision Prevention

When multiple tasks within a phase touch the same files or modules, sequence them to prevent merge conflicts:

**Rules:**

1. **Distinct code areas**: Tasks that touch completely different files can be parallelised
2. **Shared file ownership**: If two tasks modify the same file, they MUST be sequenced (mark one as blocked by the other)
3. **Migration ordering**: Database migrations must be strictly ordered
4. **Import chain**: If task B imports from a file task A creates, B is blocked by A

**In phase subticket, note parallelisation:**

```markdown
### Parallelisation Notes
- Tasks 1-2 can run in parallel (different files)
- Task 3 depends on Task 1 (imports User model)
- Tasks 4-5 must be sequential (both modify routes/index.py)
```

**For detailed rules, examples, and anti-patterns, see:** [resources/task-structure-guide.md](resources/task-structure-guide.md)

**Task description includes:**

- Specification context (WHAT): User stories and behaviors this enables
- Technical Plan guidance (HOW): Architecture, patterns, dependencies
- TDD Implementation Checklist: Write tests -> implement -> refactor (use base checklist format below)
- Acceptance criteria: Tests pass, follows patterns, code reviewed
- Justfile commands: Use `just test`, `just lint`, `just format`, `just build` (stack-agnostic)

**Base TDD Checklist Format (include in every feature/bug phase):**

```markdown
## TDD Implementation Checklist

**RED Phase:**
- [ ] Write test for [behavior 1] - verify it fails
- [ ] Write test for [behavior 2] - verify it fails
- [ ] Write test for [edge case] - verify it fails

**GREEN Phase:**
- [ ] Implement minimal code to pass [behavior 1] test
- [ ] Implement minimal code to pass [behavior 2] test
- [ ] Implement minimal code to pass [edge case] test
- [ ] All tests passing

**REFACTOR Phase:**
- [ ] Check for code smells (see adlc:test-driven-development resources/refactoring.md)
- [ ] Refactor while keeping tests green
- [ ] Final verification: all tests still passing
```

**Identify dependencies between phases:**

- **Blocks:** Other phases that depend on this one
- **Blocked by:** Phases this one depends on
- **Parallel:** Phases with no interdependencies

**Use TodoWrite to track sub-issue creation:**

```
Sub-Issue Creation Progress:
- [ ] Phase 1: Register a user (no dependencies)
- [ ] Phase 2: Log in (blocked by Phase 1 - needs User model)
- [ ] Phase 3: View profile (blocked by Phase 2 - needs auth)
...
```

### Phase 4: Create Sub-Issues

**REQUIRED SUB-SKILL:** Use `adlc:creating-tickets` for all ticket creation — it owns
classification (every sub-issue MUST have exactly ONE label: `feature`, `chore`, or `bug`),
required metadata, and the create-issue mechanics. Do not restate that logic here.

**For each phase, create one self-contained sub-issue** containing the breakdown-specific
sections (Scope, Relevant Context, What's Demoable, Tasks, Implementation Guide,
Parallelisation Notes, Dependencies, TDD Implementation Checklist, Acceptance Criteria, Relevant Patterns).

**See [resources/phase-subticket-template.md](resources/phase-subticket-template.md) for the
full section-by-section template.**

Tasks reuse the `### Task N:` format from the Phase 3 example (Layers, Files, Unit tests,
Reference). Each sub-issue must be self-contained — the implementing agent should never need
to read the parent issue.

**After each sub-issue created:** record the issue ID and map dependencies via the PM
relationship system (update the blocking issue with a link to the blocked issue, and vice
versa).

### Phase 5: Document Patterns

For each sub-issue, append task-type pattern references (backend/frontend/integration — see the
"Relevant Patterns" section of [resources/phase-subticket-template.md](resources/phase-subticket-template.md))
to the description.

### Phase 5.5: Verify Sub-Issue Quality

Re-read each created sub-issue from the PM system and confirm it holds up. This is the cheapest place to fix problems — you just wrote them. If any check fails, fix the sub-issue now before continuing.

**For every sub-issue:**

- **Required sections present and substantive** — Scope, Relevant Context, What's Demoable, Tasks, Implementation Guide, Parallelisation Notes, Dependencies, Acceptance Criteria. A heading with nothing real under it does not count (presence ≠ substance).
- **Tasks are parseable** — the Tasks section contains `### Task` entries, not loose prose.

**For every feature/bug sub-issue, additionally:**

- **TDD Implementation Checklist present.**
- **Every task defines its tests** — the unit tests are the RED phase; a task with no test spec has no test-first contract.
- **The slice is proven end-to-end** — there is an E2E / acceptance / integration test exercising the whole slice, not just per-layer unit tests. If it is only ever tested layer-by-layer, "vertical" was claimed but never demonstrated.

Chore sub-issues are exempt from the TDD/E2E checks — they carry a verification checklist (build, lint, test) instead.

### Phase 5.6: Review for Signal Loss (Coverage vs Plan and Spec)

Phase 5.5 checks each sub-issue in isolation. This step checks them **together** — that the set of phases fully delivers the Technical Plan, and through it the Specification. The risk at this hand-off is silent signal loss: work that was in the plan or spec but fell through the slicing.

Re-read the parent's Technical Plan and Specification, then confirm:

- **Every component, contract, and behavior in the Technical Plan** is delivered by at least one phase. List any plan item with no covering phase — those are gaps.
- **The phases together satisfy the Specification** — every user story and success criterion is reachable once all phases are done, not merely plausible one-by-one.
- **No scope was dropped or silently shrunk** — the union of the phases is the whole feature, not a convenient subset of it.
- **No double-counting** — two phases both claiming the same behavior signals a slicing problem, not coverage.

If a plan component or spec requirement has no home, add or adjust a phase before finishing. If coverage is genuinely ambiguous (e.g. the spec is unclear), raise it with the user rather than guessing.

### Phase 6: Summary Report

**Present breakdown summary:**

```markdown
# Breakdown Complete

## Summary
- Created [N] phase sub-issues in [Team]
- Each phase is a vertical slice delivering demoable functionality
- Parallel tracks: [N] (phases with no dependencies)
- Critical path: [N] phases

## Phases Created
1. [ISSUE-ID] [Title] - [What's demoable] - Deps: [None/IDs]
2. [ISSUE-ID] [Title] - [What's demoable] - Deps: [IDs]
...

## Dependency Graph
```

ISSUE-1 (Register user: DB+API+UI)
  └─> ISSUE-2 (Login: session+API+UI)
       └─> ISSUE-3 (Profile: API+UI)

ISSUE-4 (parallel: settings page)

```

## Ready to Execute
[N] phases are ready to start (no dependencies): [ISSUE-IDs]

Ready to begin execution?
```

**Offer handoff to `/adlc:execute`**

## Key Principles

| Principle | Application |
|-----------|-------------|
| **Vertical phases** | Every phase delivers demoable end-to-end functionality across all necessary layers |
| **End-to-end verification** | Every phase includes an E2E/acceptance test exercising the full slice — this is what proves the slice is vertical, not just multi-layered |
| **No signal loss** | The phases together deliver the whole Technical Plan and Specification — verified at hand-off (Phase 5.6), not assumed |
| **Horizontal tasks** | Tasks within a phase target specific layers (DB, service, API, UI) — one TDD cycle each |
| **Phases are subtickets, tasks are checklist items** | Never create separate tickets for individual tasks within a phase |
| **Acceptance criteria per phase** | Every phase has clear, verifiable acceptance criteria with acceptance tests |
| **TDD structure** | Tasks follow test-first pattern (RED-GREEN-REFACTOR) |
| **Clear dependencies** | Every dependency between phases explicitly mapped |
| **Parallel-friendly** | Maximise phases that can start immediately |
| **Collision prevention** | Tasks within a phase sequenced to avoid conflicts |
| **Pattern documentation** | Each phase references relevant patterns |

## Red Flags - STOP and Ask

- Parent issue has no design section -> Run `/adlc:refine` first
- Issue is already a single thin vertical slice -> Propose skipping breakdown, execute directly via `/adlc:execute`
- Borderline whether it's one slice or several -> Clarify with the user before slicing
- Cannot identify vertical slices -> Design too vague, needs rethinking
- A phase doesn't have demoable behavior -> Not a vertical slice, restructure
- A phase has no end-to-end/acceptance test exercising the full slice -> Not proven vertical, add one (or restructure if you can't)
- All phases depend on single blocking phase -> Refactor breakdown
- Sub-issue has no clear acceptance criteria -> Clarify requirements
- Tasks within a phase all touch same files -> Sequence them or restructure

## Integration with Other Skills

**Requires completed:**

- `refining-issues` skill (via `/refine` command) - Must have validated Specification
- `technical-planning` skill (via `/plan` command) - Must have Technical Plan

**Uses during breakdown:**

- `creating-tickets` skill - REQUIRED for all sub-issue creation (ensures proper labeling)

**Hands off to:**

- `execution-orchestration` skill (via `/adlc:execute` command) - Executes the breakdown with task orchestration

**May reference during breakdown:**

- `test-driven-development` - Pattern for implementation tasks
- `systematic-debugging` - Pattern for bug fix tasks
- `execution-orchestration` - Owns worktree creation if parallel development needed

## Remember

- **Don't force a breakdown** — if the issue is already one thin slice, propose skipping it and executing directly; if borderline, ask the user
- **Phases = vertical slices** — each delivers demoable end-to-end functionality with acceptance criteria and acceptance tests
- **Every phase is proven end-to-end** — include an E2E/acceptance test task that drives the full slice, not just per-layer unit tests
- **Check for signal loss before hand-off** — confirm the phases together deliver the entire Plan and Spec (Phase 5.6); nothing dropped in the slicing
- **Tasks = horizontal layer-specific units** — each targets one layer (DB, service, API, UI) within a vertical phase
- **Phases are subtickets, tasks are checklist items** — never create separate tickets for tasks
- Map all dependencies between phases (blocks, blocked-by, related)
- Note parallelisation opportunities and collision risks within phases
- Document relevant patterns in each sub-issue
- Create TodoWrite todos for tracking sub-issue creation
- Verify parent issue has design before starting
- Offer handoff to `/adlc:execute` when complete

## Additional Resources

- [Phase Sub-Issue Template](resources/phase-subticket-template.md) - Full section-by-section sub-issue structure
- [Task Structure Guide](resources/task-structure-guide.md) - Detailed task breakdown rules and anti-patterns
- [Granularity Examples](resources/granularity-examples.md) - Vertical slicing examples for different project types
- [Dependency Patterns](resources/dependency-patterns.md) - Common dependency graph patterns
