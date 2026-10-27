# Common Dependency Patterns

## Understanding Dependencies

Dependencies determine execution order and parallelisation opportunities. With vertical slicing, inter-phase dependencies are naturally reduced because each phase is self-contained.

**Key insight:** Vertical slices reduce dependencies between phases. Most dependencies come from shared data models or infrastructure established in Phase 1.

## Dependency Types

### 1. Hard Dependency (Blocking)

**Definition:** Phase B cannot start until Phase A completes.

**When it occurs:**
- Phase B needs a model/schema created in Phase A
- Phase B needs infrastructure set up in Phase A
- Phase B extends functionality built in Phase A

**Example:**

```
Phase A: Register a user (creates User model + auth endpoint)
Phase B: Log in (needs User model and password hashing from Phase A)
Dependency: B blocked by A
```

### 2. Soft Dependency (Non-blocking)

**Definition:** Phase B can start, but cannot complete until Phase A finishes.

**When it occurs:**
- Phase B can write tests/interfaces without Phase A
- Phase B needs Phase A only for integration
- Phase B can use mocks until Phase A is ready

**Example:**

```
Phase A: Payment processing (creates Payment model + Stripe integration)
Phase B: Payment history UI (can build UI with mock data, needs API for integration)
Dependency: B can start (use mocks), needs A for integration
```

### 3. Data Dependency

**Definition:** Phase B needs specific data structures from Phase A.

**When it occurs:**
- Database schemas shared between phases
- API contracts needed by consumers
- Type definitions used across phases

**Example:**

```
Phase A: Create resource (defines Resource schema + model)
Phase B: List resources (needs Resource schema for query and display)
Dependency: B needs schema from A
```

### 4. Interface Dependency

**Definition:** Phase B needs an interface contract from Phase A, but not the implementation.

**When it occurs:**
- Phase B implements a consumer of Phase A's API
- Clear contract between phases allows parallel work

**Example:**

```
Phase A: Implement backend API for search
Phase B: Implement search UI
Dependency: B needs API contract (can mock), not implementation
```

## Common Dependency Patterns

### Pattern 1: Walking Skeleton + Extensions

**Structure:**

```
Phase 1 (walking skeleton)
   /    |    \
Phase 2  Phase 3  Phase 4
```

**Characteristics:**
- Phase 1 establishes the foundation (thinnest end-to-end slice)
- Subsequent phases extend functionality independently
- High parallelisation after Phase 1
- Most common pattern with vertical slicing

**Example:**

```
Phase 1: Create a resource (DB + API + UI)
  ├─> Phase 2: List resources (parallel)
  ├─> Phase 3: View resource detail (parallel)
  └─> Phase 4: Delete resource (parallel)
```

**This is the ideal pattern.** Phase 1 is the critical path; everything else fans out.

### Pattern 2: Sequential Feature Chain

**Structure:**

```
Phase 1 → Phase 2 → Phase 3
```

**Characteristics:**
- Each phase builds on the previous
- No parallelisation
- Appropriate when features are naturally sequential

**When appropriate:**
- Login requires registration
- Editing requires viewing
- Payment confirmation requires payment creation

**Example:**

```
Phase 1: Register a user →
Phase 2: Log in (needs User model) →
Phase 3: View profile (needs auth)
```

**Optimisation:** Review if later phases can start with mocks to increase parallelism.

### Pattern 3: Fan-out (Parallel Extensions)

**Structure:**

```
    A
   /|\
  B C D
```

**Characteristics:**
- Foundation phase enables multiple parallel phases
- High parallelisation
- Short critical path

**When appropriate:**
- Foundation provides common dependencies (schema, types, infrastructure)
- Multiple independent features built on the same foundation

**Example:**

```
Phase 1: Send and receive messages (WebSocket + DB + UI)
   ├─> Phase 2: Message history (parallel)
   ├─> Phase 3: User presence (parallel)
   ├─> Phase 4: Channel management (parallel)
   └─> Phase 5: Push notifications (parallel)
```

### Pattern 4: Diamond Dependency

**Structure:**

```
   A
  / \
 B   C
  \ /
   D
```

**Characteristics:**
- Two parallel paths converge on an integration phase
- Medium parallelisation
- Risk of integration conflicts at convergence

**When appropriate:**
- Frontend and backend developed in parallel
- Two independent features share an integration point

**Example:**

```
Phase 1: Define API contract
   ├─> Phase 2: Implement backend API (parallel)
   └─> Phase 3: Implement frontend client (parallel)
       └─> Phase 4: End-to-end integration tests (depends on both)
```

### Pattern 5: Fan-in (Convergent Integration)

**Structure:**

```
A  B  C
 \ | /
   D
```

**Characteristics:**
- Multiple parallel phases converge on integration
- Maximises early parallelisation
- Integration phase is critical bottleneck

**When appropriate:**
- Independent features need integration testing
- Multiple services combined in higher-level workflow

**Example:**

```
Phase 1: Payment processing (parallel)
Phase 2: Order management (parallel)
Phase 3: Inventory tracking (parallel)
   └─> Phase 4: Checkout flow integration (depends on all three)
```

## Collision Prevention Within Phases

Tasks within a single phase may need sequencing to prevent collisions:

### Task-Level Dependency Patterns

**Sequential tasks (same file):**

```
Phase: Register a user
  Task 1: Add users migration →
  Task 2: Implement User model (needs migration) →
  Task 3: Implement POST /users (needs model)
  Task 4: Create RegisterForm (PARALLEL with Task 3 - different files)
```

**Parallel tasks (different files):**

```
Phase: Register a user
  Task 1: Add migration          } parallel (DB layer)
  Task 2: Create form component  } parallel (UI layer)
  ---
  Task 3: Implement endpoint (after Task 1, imports model)
  Task 4: Wire form to API (after Tasks 2 and 3)
```

### Collision Risk Matrix

| Task A modifies | Task B modifies | Risk | Action |
|-----------------|-----------------|------|--------|
| `migrations/` | `components/` | None | Parallel OK |
| `routes/users.py` | `routes/users.py` | High | Sequence |
| `models/user.py` | `tests/test_user.py` | Low | Parallel OK (different files) |
| `routes/__init__.py` (add route) | `routes/__init__.py` (add route) | High | Sequence |
| New file | New file | None | Parallel OK |

## Anti-Patterns to Avoid

### Anti-pattern 1: Circular Dependencies

```
Phase A depends on Phase B
Phase B depends on Phase A
```

**Solution:** Extract common interface or shared foundation into a new Phase 0.

### Anti-pattern 2: God Phase (Everything Depends on It)

```
Phase A: Set up everything
  ├─ Phase B depends on A
  ├─ Phase C depends on A
  ├─ Phase D depends on A
  └─ Phase E depends on A
```

**Solution:** Make Phase A the thinnest possible walking skeleton. Move non-essential setup into the phases that need it.

### Anti-pattern 3: Unnecessary Dependencies

```
Phase A: Register user
Phase B: Settings page
Dependency: B blocked by A (no real dependency)
```

**Solution:** Remove false dependency. If settings page doesn't need auth, it can run in parallel.

### Anti-pattern 4: Missing Dependencies

```
Phase A: Login page (uses User model)
Phase B: Create User model
No dependency documented
```

**Solution:** Always trace data flow. If Phase A imports from Phase B's output, document the dependency.

## Dependency Documentation Format

### In Phase Sub-Issue Description

```markdown
## Dependencies
- **Blocked by:** TEAM-101 (Register user - needs User model)
- **Blocks:** TEAM-105 (Profile page), TEAM-106 (Settings page)
- **Parent issue:** TEAM-100 (see full Specification + Technical Plan)
- **Phase:** 2 of 5
```

### In Breakdown Summary

```markdown
## Dependency Graph

TEAM-101 (Register: DB+API+UI)
  ├─> TEAM-102 (Login: auth+API+UI)
  │     ├─> TEAM-104 (Profile: API+UI)
  │     └─> TEAM-105 (Logout: API+UI)
  └─> TEAM-103 (Reset password: email+API+UI)

Parallel after TEAM-101: TEAM-103
Parallel after TEAM-102: TEAM-104, TEAM-105
```

## Summary

**Key principles:**

1. Vertical slicing naturally reduces inter-phase dependencies
2. Phase 1 (walking skeleton) is typically the only hard blocker
3. Maximise fan-out after the foundation phase
4. Document both phase-level and task-level dependencies
5. Prevent collisions by sequencing tasks that touch the same files
6. Avoid circular, unnecessary, and missing dependencies
