# Task Structure Guide

## Terminology

| Term | Slice Direction | Definition |
|------|----------------|-----------|
| **Phase** | **Vertical** (e2e thin slice) | A subticket under the parent feature. Delivers independently demoable end-to-end functionality touching all necessary layers. |
| **Task** | **Horizontal** (layer-specific) | A todo item within a phase subticket. One TDD cycle (RED-GREEN-REFACTOR) targeting a specific layer, touching 1-3 files. |

## Core Rules

### The Iron Law: One Task = One Complete Behavior with TDD

Every task must include BOTH tests AND implementation. Never split them.

**NEVER do this (BAD):**

```
Task 1: Write tests for UserAuthService
Task 2: Implement UserAuthService
```

**ALWAYS do this (GOOD):**

```
Task 1: Implement UserAuthService (includes writing tests first via TDD)
```

### Tasks Are Horizontal Layer-Specific Todos Within a Vertical Phase

Tasks are NOT standalone subtickets. They are checklist items within a phase's subticket description. A vertical phase subticket contains multiple horizontal tasks — each targeting a specific layer — that together deliver one end-to-end slice of functionality.

```
Phase subticket (vertical slice): "Register a user"
  ├── Task: Add users table migration              (DB layer)
  ├── Task: Implement User model with validations   (Service layer)
  ├── Task: Implement POST /api/users endpoint      (API layer)
  ├── Task: Create RegisterForm component           (UI layer)
  └── Task: Wire form to API with success/error     (Integration)
```

### Task Completeness

**Definition of done for a task:**

- Feature code is implemented
- All tests are written and passing
- Edge cases are covered
- Code is refactored and clean

**A task cannot be marked complete without its tests.**

### Exceptions to TDD Task Structure

```yaml
rule: "Never create tasks titled 'Write tests for X' or 'Add test coverage'"
exceptions:
  - "Client explicitly requests separate test tasks"
  - "Retrofitting tests to legacy code without changes"
  - "Test infrastructure or framework setup"
```

## Sizing Heuristics

### Three Levels

| Level | Right-sized | Warning | Action | Human reference |
|-------|------------|---------|--------|-----------------|
| **Feature** | 3-6 phases | >8 phases | Split into multiple features | ~1-1.5 weeks |
| **Phase** | ~5 tasks | >8 tasks | Split into multiple phases | ~1 day |
| **Task** | 1 TDD cycle, 1-3 files | >5 files | Split into multiple tasks | ~1-2 hours |

### Task Sizing: One TDD Cycle = One Task

> **A task is exactly one RED-GREEN-REFACTOR cycle.** Write a test (or small group of related tests), make it pass, refactor. This naturally constrains scope to 1-3 files.

**Right-sized tasks (1 TDD cycle each):**
- Add a database migration (1 test file + 1 migration file)
- Implement a single API endpoint (1 test file + 1 route file)
- Create a UI component with props (1 test file + 1 component file)
- Add validation logic with edge cases (1 test file + 1 module file)

**Too large (multiple TDD cycles - split further):**
- "Build user authentication system" - this is a phase, not a task
- "Create dashboard" - this is a phase with multiple tasks
- "Implement user CRUD" - this is 4-5 separate TDD cycles

**Too small (combine with related tasks):**
- "Add one field to model" (unless it requires migration + API + UI changes)
- "Fix a typo" (handle as quick fix, not a tracked task)

### Signs a Task is Too Large

- Touches more than 5 files
- Requires multiple distinct test groups (separate behaviors)
- Has more than 3 dependencies on other tasks
- Cannot be described in 2-3 sentences

**Solution:** Break into smaller tasks within the phase. Each task = one TDD cycle.

### Phase Sizing: ~5 Tasks, Warn at >8

A phase delivers one independently demoable vertical slice. Most phases land around 5 tasks given single-TDD-cycle granularity. If a phase exceeds 8 tasks, the slice is probably too wide - split it into two independently demoable behaviors.

### Feature Sizing: 3-6 Phases, Split at >8

If a feature requires >8 phases, it's really two features. Split at a natural boundary where the first set of phases delivers standalone value.

## Task Description Template

Every task within a phase should include explicit unit test definitions so the implementing agent can follow TDD without ambiguity:

```markdown
### Task: [Action verb] [specific thing]
- **Description**: What to do in 1-2 sentences
- **Layers touched**: DB / Service / API / UI
- **Files likely modified**: `path/to/file.py`, `path/to/test.py`
- **Unit tests** (write these FIRST in RED phase):
  - `test_name_1` - what it verifies, expected input -> expected output
  - `test_name_2` - what it verifies, expected input -> expected output
  - `test_edge_case` - edge case description
- **Reference examples**: `path/to/similar/code.py` (pattern to follow)
```

**The unit tests section is critical.** It defines the RED phase for TDD. The implementing agent writes these tests first, watches them fail, then implements.

### Example Complete Task

```markdown
### Task: Implement POST /api/users endpoint
- **Description**: Create registration endpoint that accepts email/password, validates input, creates user record, and returns 201 with user object (excluding password).
- **Layers touched**: API, Service
- **Files likely modified**: `routes/users.py`, `tests/routes/test_users.py`
- **Unit tests:**
  - `test_register_success` - POST `{email, password}` -> 201, body has `{id, email}`, no password field
  - `test_register_missing_email` - POST `{password}` -> 422, body has `{errors: {email: "required"}}`
  - `test_register_duplicate_email` - POST existing email -> 409, body has `{error: "email already registered"}`
  - `test_register_invalid_email` - POST `{email: "notanemail"}` -> 422, body has email format error
  - `test_register_short_password` - POST `{password: "ab"}` -> 422, body has password length error
- **Reference examples**: `routes/sessions.py` (similar POST endpoint pattern)
```

## Collision Prevention

When tasks within a phase touch overlapping code areas, collisions can occur. Prevent them:

### Rules

1. **Distinct code areas**: Tasks that touch completely different files can be parallelised safely
2. **Shared file ownership**: If two tasks modify the same file, they MUST be sequenced
3. **Migration ordering**: Database migrations must be strictly ordered - never parallel
4. **Import chain**: If task B imports something task A creates, B is blocked by A
5. **Configuration files**: Tasks modifying shared config (routes, DI container) should be sequenced

### Documenting Collision Risk

In the phase subticket, include a parallelisation section:

```markdown
## Parallelisation Notes
- Tasks 1-2: PARALLEL (different files: migrations/ vs components/)
- Task 3: AFTER Task 1 (imports User model from Task 1)
- Tasks 4-5: SEQUENTIAL (both modify routes/__init__.py)
```

### Common Collision Patterns

| Pattern | Risk | Mitigation |
|---------|------|------------|
| Two tasks adding routes | High | Sequence them |
| Migration + model in same task | None | Already atomic |
| Frontend + backend tasks | Low | Usually different files |
| Two tasks importing same new module | Medium | Create module in earlier task |

## Task Anti-Patterns

### 1. The Test Splitter

**Anti-pattern:**

```
Task 1: Write tests for feature X
Task 2: Implement feature X
```

**Why it's bad:** Violates TDD principle, creates false dependency, doubles tasks unnecessarily.

**Solution:**

```
Task 1: Implement feature X (TDD)
  - [ ] RED: Write failing tests
  - [ ] GREEN: Minimal implementation
  - [ ] REFACTOR: Clean up
```

### 2. The Horizontal Slice

**Anti-pattern:**

```
Phase 1: Create all database models
Phase 2: Create all services
Phase 3: Create all endpoints
```

**Why it's bad:** Nothing is demoable until Phase 3 completes. Delays feedback.

**Solution:**

```
Phase 1: Register user (model + service + endpoint + form)
Phase 2: Login (session + auth + endpoint + form)
Phase 3: Profile (endpoint + page)
```

### 3. The Mega Task

**Anti-pattern:**

```
Task: Implement entire user management system
```

**Why it's bad:** Too broad, cannot be completed in hours, hard to test comprehensively.

**Solution:** Break into tasks within a phase:

```
Phase: User registration
  - Task: Add users migration
  - Task: Implement User model
  - Task: Implement POST /users endpoint
  - Task: Create registration form
```

### 4. The Vague Task

**Anti-pattern:**

```
Task: Fix authentication issues
Task: Update user endpoints
```

**Why it's bad:** Unclear scope, cannot write clear acceptance criteria.

**Solution:**

```
Task: Fix JWT token expiration not being validated
Task: Add pagination to GET /users endpoint
```

### 5. The Kitchen Sink

**Anti-pattern:**

```
Task: Implement authentication, authorization, rate limiting, logging, and monitoring
```

**Why it's bad:** Multiple responsibilities, hard to test, cannot be parallelised.

**Solution:** Split into separate tasks within the phase, each with single responsibility.

## Special Cases

### Infrastructure Tasks (Chores)

```
Task: Set up test infrastructure for E2E tests
  - [ ] Install Playwright
  - [ ] Configure test environment
  - [ ] Create example test
  - [ ] Document usage
```

**Note:** Infrastructure tasks may not follow strict TDD but should still be atomic and focused.

### Bug Fix Tasks

```
Task: Fix JWT token not expiring after 24h (TDD)
  - [ ] RED: Write test reproducing bug
  - [ ] GREEN: Fix implementation
  - [ ] REFACTOR: Clean up
```

**Note:** Bug fixes MUST start with reproduction test.

### Refactoring Tasks (Chores)

```
Task: Refactor UserService to use dependency injection
  - [ ] Ensure all existing tests pass (baseline)
  - [ ] Refactor service structure
  - [ ] Verify all tests still pass
```

**Note:** Refactoring starts GREEN, stays GREEN.

## Checklist: Task Quality Review

Before creating a task, verify:

- [ ] Task has single, clear responsibility
- [ ] Task includes BOTH tests and implementation (for features/bugs)
- [ ] Task can be completed in hours to a day
- [ ] Task specifies layers touched and files to modify
- [ ] **Unit tests are explicitly defined** with test names, inputs, and expected outputs
- [ ] Reference examples point to similar code in the codebase
- [ ] Dependencies on other tasks within the phase are documented
- [ ] Collision risks with other tasks are identified
- [ ] TDD checklist included (RED-GREEN-REFACTOR)
- [ ] Appropriate label assigned to parent phase (feature/chore/bug)
