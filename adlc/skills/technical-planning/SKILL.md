---
name: technical-planning
description: Create comprehensive technical implementation plans from refined specifications, translating WHAT to build into HOW to build it, with architecture, technology choices, and implementation guidance
when_to_use: when partner provides issue ID that has been refined (has Specification section) and needs technical planning before breakdown
version: 2.0.0
---

# Technical Planning

## Overview

Transform refined specifications (WHAT to build) into comprehensive technical implementation plans (HOW to build it), covering architecture, technology choices, data models, API contracts, testing strategy, and implementation phases.

**Core principle:** Translate user requirements into technical decisions with clear rationale, reference existing patterns, and create a roadmap for implementation.

**Announce at start:** "I'm using the technical-planning skill to create a comprehensive technical implementation plan."

**Critical distinctions:**

- **Input**: Specification (WHAT) - user needs, behaviors, success criteria
- **Output**: Technical Plan (HOW) - architecture, tech stack, patterns, phases

## Quick Reference

| Phase | Key Activities | Tool Usage | Output |
|-------|---------------|------------|--------|
| **1. Load Specification** | Retrieve refined issue | Linear/JIRA MCP tools | Specification loaded |
| **2. Analyze Codebase** | Find patterns, similar code | Grep, Read | Existing patterns identified |
| **3. Research Options** | Investigate technologies | Web search, documentation | Technology options evaluated |
| **4. Design Architecture** | High-level component design | — | Architecture documented |
| **5. Define Contracts** | Data models, APIs | — | Contracts specified |
| **6. Plan Testing** | Strategy per test level | — | Testing approach defined |
| **7. Implementation Approach** | Describe high-level approach and key dependencies | — | Approach documented |
| **8. Document Patterns** | Reference existing code | — | Pattern references |
| **9. Write to Issue** | Append Technical Plan | Linear/JIRA MCP update | Issue ready for breakdown |
| **10. Review Signal Loss** | Confirm plan covers the spec | — | No requirement dropped WHAT→HOW |

## The Process

Copy this checklist to track progress:

```
Technical Planning Progress:
- [ ] Phase 1: Load Specification (requirements retrieved from PM system)
- [ ] Phase 2: Analyze Codebase (existing patterns identified)
- [ ] Phase 3: Research Options (technology choices evaluated)
- [ ] Phase 4: Design Architecture (high-level design created)
- [ ] Phase 5: Define Contracts (data models and APIs specified)
- [ ] Phase 6: Plan Testing (strategy per level defined)
- [ ] Phase 7: Implementation Approach (high-level approach described)
- [ ] Phase 8: Document Patterns (references to existing code)
- [ ] Phase 9: Write to Issue (technical plan written to PM system)
- [ ] Phase 10: Review for Signal Loss (plan demonstrably covers the spec)
```

### Phase 1: Load Specification

**Verify issue has Specification section:**

```bash
# Linear:
issue = mcp__linear-server__get_issue(id=issue_id)
# OR JIRA:
issue = mcp__jira__get_issue(issue_key=issue_id)

if "## Specification" not in issue.description:
    ERROR: Issue missing Specification section
    SUGGEST: Run `/adlc:refine <issue-id>` first
    STOP
```

**Extract key elements:**

- User stories (who needs what)
- Expected behaviors (given/when/then)
- Success criteria (testable outcomes)
- Data requirements (what data, what relationships)
- Edge cases and error conditions

**Present loaded spec:**

```
Loaded issue TEAM-123: "User authentication system"

Specification Summary:
- 4 user stories identified
- 8 expected behaviors defined
- 5 success criteria
- 2 primary data entities (User, Session)
- 6 edge cases documented

I'm using the technical-planning skill to create the implementation plan.
```

### Phase 2: Analyze Codebase

**Search for existing patterns:**

```bash
# Find similar services/controllers
Grep: pattern="class.*Service"
Grep: pattern="class.*Controller"

# Find domain-specific patterns (auth example)
Grep: pattern="auth|authentication|login"

# Find data model patterns
Grep: pattern="class.*Model|interface.*Entity"

# Find API endpoint patterns
Grep: pattern="@Get|@Post|app.get|app.post|router"

# Find testing patterns
Grep: pattern="describe|test|it\(|def test_"
```

**Document findings:**

```markdown
Codebase Analysis:
- Service pattern: src/services/*-service.ts
- Controller pattern: src/controllers/*-controller.ts
- Data models: src/models/*.ts
- Test structure: tests/**/*.test.ts
- Error handling: src/types/result.ts
```

**Identify constraints:** Framework, database, auth approach, API style, testing tools from package.json and imports.

### Phase 3: Research Options & Confirm Decisions

**For each technical decision, research options:**

**Technology Choices to consider:**

- Authentication: JWT vs Sessions vs OAuth
- Data storage: SQL vs NoSQL considerations
- Caching: Redis vs in-memory vs none
- API design: REST vs GraphQL

**For each option, document:**

- Pros and cons
- Fit with existing codebase
- Performance implications
- Security considerations
- Team familiarity

**Context-Aware Decision Making:**

**ONLY ask for user confirmation when:**

1. **New technology not in codebase** (e.g., adding Redis when not currently used)
2. **Multiple valid architectural approaches** (e.g., sync vs async processing)
3. **Significant trade-offs** (e.g., performance vs complexity)
4. **Cross-cutting concerns** (e.g., caching strategy, security model changes)

**DO NOT ask when:**

1. **Codebase already uses the technology** (e.g., Postgres already in use → use Postgres)
2. **Existing patterns dictate approach** (e.g., REST endpoints already present → continue with REST)
3. **Single obvious choice** (e.g., bcrypt for password hashing)
4. **Standard practice** (e.g., JWT for stateless auth when API already uses tokens)

**Use AskUserQuestion for genuine decisions**, then **document every decision with rationale**
(whether user-confirmed or codebase-dictated). For `AskUserQuestion` templates and the
decision-documentation format, see [resources/decision-question-examples.md](resources/decision-question-examples.md).

**Pattern for interactivity:**

1. Analyze codebase in Phase 2
2. Identify genuine decision points (new tech, architectural choices, trade-offs)
3. Research options for genuine decisions
4. Use AskUserQuestion for decisions with multiple valid approaches
5. Document all decisions with rationale

**For detailed examples of technology decisions, see:** resources/example-technology-choices.md

### Phase 4: Design Architecture

**Document high-level component design:**

```markdown
Architecture Overview:

**Components:**
1. **[ComponentName]** (new/modified)
   - Responsibilities: [What it does]
   - Dependencies: [What it needs]
   - Location: [File path]
   - Pattern: Follows [existing pattern reference]

**Data Flow:**
[Step-by-step flow through components]

**Integration Points:**
[How it connects to existing middleware, error handling, validation]
```

**Confirm architecture approach if significant design decision:**

**ONLY ask when:**

- Multiple valid architectural patterns (e.g., microservices vs monolith expansion)
- Significant component structure changes (e.g., new service layer)
- Integration approach with trade-offs (e.g., event-driven vs synchronous)

For an `AskUserQuestion` template, see [resources/decision-question-examples.md](resources/decision-question-examples.md).

**For detailed architecture examples, see:** resources/example-architecture-design-section.md

### Phase 5: Define Contracts

**Define data models and API contracts:**

```markdown
**Data Models:**
**[EntityName]** (new/extend existing)
- [field]: [type] ([existing/NEW])
- Validation: [rules]

**API Contracts:**
**[METHOD] /api/[endpoint]**
- Request: { fields }
- Response (200): { fields }
- Errors: [status codes and descriptions]
```

For detailed examples, see **resources/example-contracts-section.md**

### Phase 6: Plan Testing

**Define testing strategy:**

```markdown
Testing Strategy:

**Unit Tests** - Service/utility functions in isolation, mock dependencies
**Integration Tests** - API endpoints with real database
**E2E / Acceptance Tests** - one per vertical slice, driving it across all its layers (UI → API →
DB, or the public interface for non-UI work) to prove it end-to-end. Full-stack E2E where a
harness exists; an integration test spanning the slice is the floor. This is what makes each
`/breakdown` phase demonstrably vertical — scale the level to the stack, but don't drop it.

**All implementation follows TDD:** RED → GREEN → REFACTOR
```

**Confirm testing approach if significant decision:**

**ONLY ask when:**

- Multiple testing strategies with trade-offs (e.g., end-to-end vs integration focus)
- Performance testing requirements unclear (e.g., load testing needed?)
- Test infrastructure changes (e.g., introducing contract testing, visual regression)

For an `AskUserQuestion` template, see [resources/decision-question-examples.md](resources/decision-question-examples.md).

For test levels, structure, and what NOT to test at each level, see `Skill(adlc:writing-tests)`.

**Testing approach should follow project's CLAUDE.md guidelines.** Otherwise use test pyramid (many unit, some integration, few e2e).

### Phase 7: Implementation Approach

**Describe the high-level implementation approach — NOT a detailed breakdown.**

The Technical Plan should outline the general approach, key components, and critical dependencies. The detailed breakdown into vertical phases and horizontal tasks is done later by `/breakdown`.

```markdown
Implementation Approach:

**Key components to build:**
- [Component 1]: [What it does, key responsibilities]
- [Component 2]: [What it does, key responsibilities]

**Critical dependencies:**
- [Component X] must exist before [Component Y] (needs schema/interface/model)
- [Component Z] can be developed independently

**Suggested approach:**
[1-2 paragraphs describing the general order and rationale — e.g., "Start with the thinnest
end-to-end slice (the walking skeleton), adding only the minimum data model it needs, then
extend with further slices." Don't prescribe detailed phases — `/breakdown` will slice this
into vertical phases with horizontal tasks.]
```

**IMPORTANT:** Do NOT create a detailed phase-by-phase breakdown here. That is the responsibility of `/breakdown`, which will:
- Slice the work into **vertical phases** (each delivering demoable e2e functionality)
- Break each phase into **horizontal tasks** by layer (DB, service, API, UI)
- Define acceptance criteria and acceptance tests per phase, including an **end-to-end / acceptance test per slice**

The plan's job is to describe the technical approach, components, and dependencies so that `/breakdown` can make informed slicing decisions.

**If you sketch any suggested ordering, it MUST be by vertical slice (demoable behavior), never by layer.** A layer-ordered sketch here is the single most common way plans go wrong — it biases `/breakdown` into a horizontal breakdown.

```
BAD (by layer):     all models → all services → all endpoints → all UI
                    → nothing demoable until the last step. Not vertical.
GOOD (by behavior): register a user → log in → view profile
                    → each step demoable and verified end-to-end.
```

Describe the *starting slice* and the *order slices build on each other* — not a list of layers to construct.

**For examples of implementation approach descriptions, see:** [resources/example-implementation-approach.md](resources/example-implementation-approach.md)

### Phase 8: Document Patterns

**First, check project documentation:**

1. Read `CLAUDE.md` in project root (architecture patterns, conventions)
2. Read `CLAUDE-patterns/` or `docs/architecture.md` if present
3. Search existing codebase for similar implementations

**Reference existing code patterns:**

```markdown
Patterns to Follow:

**From project CLAUDE.md/CLAUDE-*.md:**
- [List key architectural principles from project docs]
- [Reference specific patterns documented there]

**From existing codebase:**
- Service layer: src/services/[similar-service].ts (follow this structure)
- Controller pattern: src/controllers/[similar-controller].ts (follow this pattern)
- Error handling: src/middleware/error-handler.ts (use existing approach)
- Validation: src/middleware/validator.ts (follow validation pattern)

**Key best practices (if not documented in project):**
- Dependency injection for testability
- Explicit error handling (no silent failures)
- Input validation at boundaries
- Single responsibility per function/class
```

**Always prefer project's documented patterns over generic best practices.**

### Phase 9: Write to Issue

**Format Technical Plan (concise parent-level overview):**

```markdown
## Technical Plan

### Architecture Overview
[1-2 paragraphs: High-level component structure and data flow]
Example: "This feature consists of 3 main components: UserAuthService for business logic,
AuthController for API endpoints, and Session model for data persistence. User credentials
flow through validation → service authentication → token generation → session creation."

### Key Technology Choices
[1 paragraph per major decision with brief rationale]
Example: "JWT tokens for authentication (stateless, scalable). Bcrypt for password hashing
(industry standard). Redis for token blacklist (fast lookups). Following existing patterns
in src/services/ and src/controllers/."

### Implementation Approach
[1-2 paragraphs: Key components, critical dependencies, general approach]
Example: "Core components are UserAuthService (business logic), AuthController (API endpoints),
and Session model (data persistence). The User model and password hashing are foundational —
everything else depends on them. Registration is the natural starting point as the thinnest
end-to-end slice; login, profile, and password reset extend from there — each a demoable slice
verified end-to-end, not a layer. Detailed vertical phase breakdown and task definitions will
be created during `/breakdown`."

### Testing Strategy
[1 paragraph: Overview of test levels]
Example: "Unit tests for service logic and utilities (mocked dependencies). Integration
tests for API endpoints (with test database). Each vertical slice is verified end-to-end by
an acceptance test (full-stack E2E for key flows like login/logout; integration spanning
API + DB as the minimum bar). TDD approach enforced via sub-issue checklists."

### Key Patterns
[Bullet list of reference files]
Example:
- Service structure: src/services/data-service.ts
- Controller structure: src/controllers/user-controller.ts
- Error handling: src/types/result.ts
- Testing: tests/services/data-service.test.ts
```

**IMPORTANT: Keep parent plan concise**

- **1-2 paragraphs** per section maximum
- **High-level overview** only - no detailed schemas, API contracts, or full component specs
- **Detailed technical context** will be written to sub-issues during breakdown
- **Focus on architecture and approach**, not implementation details

**Update the issue:**

```bash
# Append concise Technical Plan to existing Specification
current_description = issue.description
technical_plan = format_concise_technical_plan()
new_description = current_description + "\n\n---\n\n" + technical_plan

# Linear:
mcp__linear-server__update_issue(
    id=issue_id,
    description=new_description,
    labels=['planned', 'refined'],
    state='Todo'
)

# OR JIRA:
mcp__jira__update_issue(
    issue_key=issue_id,
    description=new_description,
    labels=['planned', 'refined'],
    status='To Do'
)
```

**Confirm with user:**

```
Technical Plan written to issue TEAM-123 (concise parent-level overview).

This defines HOW to build the features from the specification.
Detailed technical context (data models, API contracts, component specs) will be
provided in sub-issue descriptions during breakdown.

Next steps:
1. Review the technical plan
2. Run `/adlc:breakdown TEAM-123` to create implementation tasks

Ready to break this down into implementation tasks?
```

### Phase 10: Review for Signal Loss (Plan vs Spec)

Before handing off to breakdown, confirm the Technical Plan actually accomplishes what the Specification asks — nothing dropped in the translation from WHAT to HOW. This is the plan's own quality gate, mirroring the coverage review breakdown runs on its sub-issues.

Re-read the Specification alongside the plan you just wrote, and confirm:

- **Every user story and expected behavior** in the spec is served by a component, contract, or approach in the plan.
- **Every success criterion** is achievable and has a testing approach that would verify it.
- **Every data requirement and edge case** is accounted for (schema, validation, error handling).
- **Nothing was silently narrowed** — the plan doesn't quietly solve a smaller problem than the spec describes.

If you find a gap, the plan lost signal — update the plan (and the issue) before proceeding. If the gap is a genuine spec ambiguity, raise it with the user rather than papering over it. Only offer `/adlc:breakdown` once the plan demonstrably covers the spec.

## Integration with Other Skills

**Follows:**

- `refining-issues` skill (via `/refine` command) - Provides Specification (WHAT)

**Precedes:**

- `breakdown-planning` skill (via `/breakdown` command) - Creates sub-issues from Specification + Technical Plan

**May use during planning:**

- Web search for technology research
- Documentation reading for API patterns
- Codebase analysis for existing patterns

**The workflow:**

1. `/refine` → Specification (WHAT to build)
2. `/plan` → Technical Plan (HOW to build) - THIS SKILL
3. `/breakdown` → Sub-issues (tasks to execute)
4. `/execute` → Implementation (build it)

## Key Principles

| Principle | Application |
|-----------|-------------|
| **Specification-driven** | Every technical decision maps back to specification requirements |
| **Rationale required** | Every technology choice must explain "why" |
| **Reference existing** | Always point to similar code in codebase |
| **Test-first planning** | Testing strategy drives implementation phases |
| **Vertical, e2e-verified slices** | Any suggested ordering is by demoable behavior (each provable end-to-end), never by layer |
| **No signal loss** | The plan is reviewed against the spec before hand-off — every requirement survives the WHAT→HOW translation |
| **Approach not breakdown** | Describe implementation approach and key dependencies — leave detailed phasing to `/breakdown` |
| **Dependency-aware** | Clearly document what blocks what |
| **Pattern consistency** | Follow established patterns in codebase |
| **Technology-appropriate** | Choose tech that fits team, scale, and existing stack |
| **High-level focus** | Avoid code-level details, stay architectural |

## Remember

- **Specification provides context** - Every decision traces back to a requirement
- **Testing strategy drives tasks** - TDD approach requires test-first planning; every vertical slice gets an end-to-end / acceptance test
- **Any suggested ordering is vertical** - sketch slices by demoable behavior (each verified end-to-end), never a layer-by-layer sequence — a horizontal sketch here biases `/breakdown` toward a wrong breakdown
- **Review for signal loss** - before offering breakdown, confirm the plan covers every spec requirement (Phase 10); nothing dropped WHAT→HOW
- **Approach not breakdown** - Describe components and dependencies, leave detailed vertical phasing to `/breakdown`
- **All in PM system** - Technical Plan lives in Linear/JIRA issue, not separate files

## Additional Resources

- `resources/decision-question-examples.md` — AskUserQuestion templates + decision-documentation format
- `resources/example-technology-choices.md` — technology decisions with rationale (auth, DB, caching)
- `resources/example-architecture-design-section.md` — component architecture examples
- `resources/example-implementation-approach.md` — high-level approach examples (not detailed breakdowns)
- `resources/example-contracts-section.md` — API contract and data model examples (REST, GraphQL)
- Project `CLAUDE.md` / `docs/` — always check the project's own patterns and conventions first
