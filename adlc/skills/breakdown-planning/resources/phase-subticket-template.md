# Phase Sub-Ticket Template

Full structure for each phase sub-ticket. Ticket classification, labels, and the
create-issue mechanics are owned by `adlc:creating-tickets` — this file covers only the
phase-specific sections a breakdown sub-ticket must contain.

A phase sub-ticket is **self-contained**: the implementing agent should never need to read
the parent issue. Extract all relevant context into the sub-ticket.

## Required Sections

### 1. Scope

One sentence describing the demoable outcome.

```markdown
## Scope
After this phase, users can register an account with email and password and see a success confirmation.
```

### 2. Relevant Context from Parent (WHAT and WHY)

Extract the specific portions of the parent Specification and Technical Plan relevant to this phase:

- **From Specification**: user stories, expected behaviors, success criteria, edge cases
- **From Technical Plan**: architecture decisions, technology choices, patterns, design rationale

### 3. What's Demoable

```markdown
## What's Demoable
- User fills out registration form with email/password
- Form validates input and shows inline errors
- Successful submission creates user record and shows confirmation
- Duplicate email shows appropriate error message
```

### 4. Tasks (Atomic Todos with Unit Test Definitions)

List all tasks as `### Task N:` checklist items with explicit unit test definitions so the
implementing agent can follow TDD. Each task specifies Layers, Files, Unit tests, and Reference
(see the Phase 3 example in SKILL.md).

**The final task of every feature/bug phase is the end-to-end / acceptance test** that drives the
whole slice through all its layers (e.g. UI → API → DB and back). The per-layer tasks prove each
piece; this task proves the slice works as one demoable behavior. Give it its own test file(s),
not just a checklist line under Acceptance Criteria. (Chore phases end with their verification
checklist — build, lint, test — instead.)

### 5. Implementation Guide (HOW — Key Ideas)

- **Module (justfile location)**: which justfile directory for verification
- **Behaviors to implement**: specific, testable behaviors
- **Integration points**: dependencies and consumers
- **Code patterns**: reference similar implementations with file paths

### 6. Parallelisation Notes

```markdown
## Parallelisation Notes
- Tasks 1-2: parallel (different files)
- Task 3: after Task 2 (imports User model)
- Task 4: after Task 3 (needs API endpoint)
```

### 7. Dependencies

```markdown
## Dependencies
- **Blocked by:** None (first phase)
- **Blocks:** Phase 2 (Login), Phase 3 (Profile)
```

### 8. TDD Implementation Checklist

For `feature`/`bug` phases, include the standard TDD checklist (see SKILL.md "Base TDD
Checklist Format"). For `chore` phases, replace it with a verification checklist (build, lint,
test).

### 9. Acceptance Criteria (E2E)

Every phase MUST have verifiable acceptance criteria describing end-to-end behavior — the
acceptance tests that verify the vertical slice as a whole.

```markdown
## Acceptance Criteria (E2E)

**Happy path:**
- [ ] User submits valid registration -> 201, user record created, confirmation shown

**Error cases:**
- [ ] Missing required fields -> 422, inline validation errors shown
- [ ] Duplicate email -> 409, "email already registered" shown
- [ ] Invalid email format -> client-side validation prevents submission

**E2E test plan (required — an end-to-end proof of the slice; scale it to the stack):**
- [ ] Integration test: POST /api/users valid data -> 201 + user object
- [ ] Integration test: POST /api/users duplicate email -> 409
- [ ] **If the project has an E2E framework** (e.g. Playwright/Cypress): full-stack test —
      fill form -> submit -> user in DB -> confirmation shown
- [ ] **If it does not:** an integration test spanning API + DB is the minimum bar —
      never skip end-to-end coverage entirely

**Verification commands:**
- `just test` / `just lint` / `just build`
- [ ] Code review approved
```

Acceptance criteria must be **specific** (not "works correctly" but "returns 201 with user
object"), **verifiable**, **complete** (happy path + errors + edge cases), and **testable**
(each maps to at least one automated test).

**Frontend phases MUST include browser verification:**

```markdown
- [ ] **Verify in browser** — visual check that UI matches design
- [ ] Responsive on mobile/tablet/desktop (if applicable)
- [ ] Accessibility: keyboard navigation, screen reader friendly
```

## Relevant Patterns

After creating each sub-ticket, append pattern references based on task type:

```markdown
## Relevant Patterns

**Backend:** TDD RED-GREEN-REFACTOR, Result-type error handling, input validation at API boundary
**Frontend:** test user interactions, codebase state pattern, WCAG 2.1 AA
**Integration:** contract testing, transaction boundaries, exponential-backoff retry
```
