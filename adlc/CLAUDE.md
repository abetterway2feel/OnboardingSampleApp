# ADLC Plugin - AI Development Guide

**Version:** 1.3.0
**Last Updated:** 2026-06-04

## Purpose

This document captures the core principles, architecture decisions, and working practices for the ADLC (Agentic Development Lifecycle) plugin. It guides both human developers and AI agents working in this codebase.

## Core Philosophy

> **The workflow pipeline, command-by-command narrative, and conventions are documented once, canonically, in [`skills/using-adlc/SKILL.md`](skills/using-adlc/SKILL.md). The visual workflow map (mermaid diagrams of the lifecycle, team/sequential strategies, and branch strategies) lives in [`EXECUTION_WORKFLOW.md`](EXECUTION_WORKFLOW.md). This document does not restate them — it captures the architecture, design decisions, and working practices for developing the plugin itself.**

The design rests on a few load-bearing principles (the *why* and detail behind each lives in **Key Design Decisions** below):

- **Repository foundation first** — run `/foundations:setup` (from the [Foundations plugin](../foundations/README.md)) before any work; it establishes CLAUDE.md, justfiles, pre-commit hooks, and PM integration.
- **Spec-driven** — Specification (WHAT) precedes Technical Plan (HOW) precedes implementation. Every technical decision traces back to a requirement.
- **Test-driven** — Iron Law: no production code without a failing test first (RED → GREEN → REFACTOR). Tests and implementation are never split across tasks.
- **Independent review before execution** — `/adlc:plan` and `/adlc:breakdown` each end by dispatching a fresh-context subagent that audits what was just produced against the artifact upstream of it; a human takes the gate decision. A session never reviews its own work.
- **`just` abstraction** — workflows invoke `just test` / `lint` / `format` / `build`, keeping ADLC stack-agnostic; the repo defines what each recipe does.
- **3-tier execution with vertical slicing** — see the architecture section below.
- **Code review at every level** — per-task (Tier 3), phase PR (Tier 2), feature PR (Tier 1).
- **PM system is the source of truth** — specs, plans, and status live in tickets, never separate files.

## Architecture Principles

### Commands Orchestrate, Skills Guide

**Commands** (`/refine`, `/plan`, `/breakdown`, `/execute`, `/pr`, `/address-feedback`):

- Entry points for workflows
- Orchestrate multiple skills
- Handle user interaction
- Should be < 250 lines (orchestration only)

**Skills** (in `skills/` directory):

- Reusable workflow units
- Contain **succinct, focused** process guidance
- Can be invoked by multiple commands
- Single responsibility
- **Target: <500 lines** (longer than this means too much explanation)
- **Focus on WHAT to do**, not WHY (LLMs don't need convincing)
- Avoid redundant examples (LLM already knows language syntax)

**Agents** (in `agents/` directory):

- Specialized subagent definitions
- Invoked via Agent() tool
- Get fresh context, execute independently
- Report back when complete
- **Default to Sonnet** for delegated execution; the `code-reviewer` quality gate runs on Opus. Defaults live in each agent's `model:` frontmatter and are overridable per invocation (`--model`), per repo (`execution.model_routing` in `adlc.local.md`), or in the frontmatter. See [skills/execution-orchestration/references/model-routing.md](skills/execution-orchestration/references/model-routing.md).
- **Long-running work is spawned, not run in the calling session.** State the budget, a cycle limit and the hard "never" rules in the brief; the stop conditions are the guard. These are soft limits — a turn cap is only hard when it comes from a subagent definition.
- **One spawn brief, defined once.** The canonical brief for driving a PR to done lives in `skills/babysitting-prs/SKILL.md` under *Spawning this skill*; `commands/pr.md`, `creating-pull-requests` Step 9 and `execution-orchestration` Step 6 all point at it. Don't inline a variant at a call site — copies of a brief drift, and the brief is the only guardrail once the agent is running.
- **PR commands live in scripts, not in prose.** All five are in `skills/babysitting-prs/scripts/` (check watch, state poll, comment watch, failing logs, thread reply). Every script fails **closed**: a failed or under-reported poll yields `UNKNOWN`, never a zero, because "0 unresolved threads" and "0 failing checks" are the strongest possible false green signals. These are GitHub-specific by design — porting to another PR host is the `vcs-host` seam in `configuration-points.md`, not a runtime branch.

### 3-Tier Execution Architecture

**Feature → Phase → Task hierarchy:**

```python
# Tier 1: Feature Orchestration
for phase in ready_phases:
    phase_branch = f"{feature_branch}/phase-{phase.number}-{phase.slug}"
    strategy = resolve_strategy(flags, config, phase)

    if strategy == 'team':
        # Team strategy: Tier 1 coordinates directly via Agent Teams
        # Spawn Sonnet teammates → teammates claim tasks → Tier 3 skills
        for task in parsed_tasks:
            TaskCreate(subject=task.title, description=tier3_context)
        spawn_teammates(model="sonnet", count=min(len(tasks), max_teammates))
        # Teammates invoke Tier 3 skills directly in parallel
    else:
        # Sequential strategy: dispatch to Tier 2 subagent
        Agent(subagent_type="execution-orchestration", prompt=phase_context)

    # Squash-merge phase PR after completion

# Tier 2: Phase Execution (sequential strategy only)
for task in parsed_tasks:
    # Dispatch to Tier 3 by label
    Agent(subagent_type=route_by_label(phase_label), prompt=task_context)
    # One commit per task on phase branch

# Tier 3: Task Execution (used by both strategies)
# Single TDD cycle: RED → GREEN → REFACTOR
# Inner loop: test + lint + typecheck
# Code review, commit, report completion
```

**Why:** Clear tiers, per-task commits, phase PRs, feature PR. Resumable at any level. Team strategy adds parallelism without bypassing Tier 3 quality gates.

### Label-Based Routing

**Every phase sub-issue has exactly ONE label that determines Tier 3 routing:**

- `feature` → `executing-tasks` skill, feature pathway (full TDD workflow)
- `chore` → `executing-tasks` skill, chore pathway (verification-focused + lightweight review)
- `bug` → `executing-tasks` skill, bug pathway (reproduction + TDD fix)

**Routing happens in `execution-orchestration` at phase level** (Step 5d) — Tier 2 in sequential strategy, folded into the Tier 1 lead in team strategy — dispatching each task to the appropriate Tier 3 skill based on the phase's label.

**Why:** Clear routing, consistent execution, proper workflow for each task type.

## Working Practices

### 1. Plans Live in PM System

**Never create separate plan files.**

- Specification: In parent issue description under `## Specification`
- Technical Plan: In parent issue description under `## Technical Plan`
- Task context: In sub-issue descriptions with TDD checklists

**Why:** Single source of truth, team visibility, no file synchronization issues.

### 2. Worktree Standard Location

**Always use:** `~/worktrees/<repo-name>/<branch-name>/`

- Outside repository (no .gitignore needed)
- Parallel-execution safe
- Easy cleanup: `rm -rf ~/worktrees` when done
- Consistent across all workflows

### 3. Completed Tasks Respected

**execution-orchestration skill respects already-completed sub-issues:**

```python
completed = [t for t in sub_issues if t.state in ['Done', 'Completed']]
remaining = [t for t in sub_issues if t.state not in ['Done', 'Completed']]
```

**Enables:**

- Resuming interrupted executions
- Mixing manual fixes with automated execution
- Addressing feedback (some original, some new sub-issues)

### 4. Error Resilience

**Retry → Skip → Continue:**

```
Task fails → Retry (up to 3x)
Still failing → Skip with warning
Independent tasks → Continue execution
```

**Why:** One failing task shouldn't block all independent work.

### 5. Comprehensive PR Descriptions

**Auto-generated PRs include:**

- Executive summary with Mermaid diagrams
- Architectural changes diagram
- Sequence diagram for workflows
- Test coverage summary
- Links to implemented issues

**Why:** Context for reviewers, documentation for posterity.

### 6. Feedback Categorization

**All PR feedback categorized by severity:**

- 🔴 **Critical:** Security, data loss, broken functionality
- 🟡 **Important:** Architecture, patterns, maintainability
- 🟢 **Minor:** Style, naming, documentation

**Auto-implementation priorities Critical → Important → Minor**

## Code Quality Standards

### Security

- No hardcoded secrets
- Input validation everywhere
- Proper authn/authz flows
- OWASP Top 10 awareness

### Maintainability

- Single Responsibility Principle
- Functions < 50 lines
- Clear naming (no abbreviations)
- Comments explain WHY, not WHAT

### Testing

- Test behavior, not implementation
- AAA pattern (Arrange, Act, Assert)
- Deterministic tests only
- No test-only methods in production code

### Architecture

- SOLID principles
- No circular dependencies
- Dependency direction: UI → Service → Data
- Appropriate abstraction (not over/under-engineered)

## File Organization

Rather than duplicate a hand-maintained directory tree here (it drifts out of date fast),
see the authoritative sources:

- **`commands/`** — Slash commands (entry points); one file per `/adlc:<name>` command.
- **`skills/`** — Reusable workflow units, one directory per skill. See
  [`docs/SKILLS-README.md`](docs/SKILLS-README.md) for the complete, authoritative skills catalog.
- **`agents/`** — Subagent definitions, one file per agent.
- **`docs/`** — Reference documentation. **`hooks/`** — session/guard hook scripts (wired in `hooks/hooks.json`).
- Top-level guides: **`README.md`** (user-facing), **`EXECUTION_WORKFLOW.md`** (visual workflow map),
  **`QUICK-START.md`** (getting started), **`CLAUDE.md`** (this file — AI/dev guide).

## Common Patterns

For runnable command walkthroughs — repository init, command chaining, resuming an interrupted run, addressing feedback, and team vs. sequential execution — see [`QUICK-START.md`](QUICK-START.md) and the orientation in [`skills/using-adlc/SKILL.md`](skills/using-adlc/SKILL.md). The visual sequence/branch diagrams are in [`EXECUTION_WORKFLOW.md`](EXECUTION_WORKFLOW.md).

## Anti-Patterns to Avoid

### ❌ Splitting Tests and Implementation

**Bad:**

```
- TEAM-46: Write tests for user authentication
- TEAM-47: Implement user authentication
```

**Good:**

```
- TEAM-46: User authentication (TDD)
  - [ ] RED: Write failing tests
  - [ ] GREEN: Minimal implementation
  - [ ] REFACTOR: Clean up
```

### ❌ Horizontal Slicing (Phases by Layer)

**Bad:**

```
- TEAM-50: Phase 1 - Data models (User, Session, Token)
- TEAM-51: Phase 2 - Services (AuthService, SessionService)
- TEAM-52: Phase 3 - API endpoints (/login, /register, /logout)
- TEAM-53: Phase 4 - UI (LoginForm, RegisterForm)
```

Nothing is demoable until Phase 4. Phases are sliced by layer, not by user-facing behavior.

**Good:**

```
- TEAM-50: Phase 1 - Register a user (migration + model + POST /register + form)
- TEAM-51: Phase 2 - Log in (session model + POST /login + form + JWT)
- TEAM-52: Phase 3 - View profile (GET /me + profile page)
- TEAM-53: Phase 4 - Log out (DELETE /session + button)
```

Each phase is a vertical slice — independently demoable e2e functionality. Tasks *within* each phase are horizontal (one per layer).

### ❌ Creating Separate Plan Files

**Bad:**

```
# Creating plan.md or IMPLEMENTATION.md
```

**Good:**

```
# Write plan in Linear issue description under ## Technical Plan
```

### ❌ Implementing Before Testing

**Bad:**

```python
# Write implementation first, then tests
def authenticate_user(credentials):
    # ... implementation ...
```

**Good:**

```python
# Write test first
def test_authenticate_user_with_valid_credentials():
    result = authenticate_user(valid_creds)
    assert result.success
    assert result.user_id is not None

# THEN implement (test should fail first)
def authenticate_user(credentials):
    # ... minimal implementation to pass test ...
```

### ❌ Manual Context Switching

**Bad:**

```bash
cd main-workspace
git checkout feature-branch
# ... work ...
git checkout main
# ... more work ...
```

**Good:**

```bash
# Use worktrees for isolation
# execution-orchestration skill creates worktree automatically
/execute TEAM-123
```

### ❌ Skipping Code Review

**Bad:**

```bash
# Push directly without review
git push origin feature-branch
```

**Good:**

```bash
# Code review is automatic
/execute TEAM-123
# → Per-task review after each task
# → Final branch review before PR creation
```

## Key Design Decisions

### Why Succinct Skills (200-400 Lines)?

**Problem with verbose skills:**

- Initial logging skill draft was 900+ lines
- Included language examples LLM already knows (Python, JS, Java, Go)
- Explanations of "why" that don't help LLM execute
- Redundant anti-pattern examples

**Benefits of succinct skills:**

- LLM focuses on actionable instructions, not theory
- Faster processing, less token usage
- Clear decision trees and checklists
- One focused example, not five language variations

**Rule of thumb:** If skill >400 lines, ask "Does LLM need this, or am I explaining why?"

### Why Divergence Review Inside `/plan` and `/breakdown` Rather Than a Stage of Its Own?

The session that produced an artifact shares every assumption it made, so it cannot see what it
smoothed over — self-review re-derives the same conclusions. Hence review runs from a **fresh
context**: both commands finish by dispatching a `general-purpose` subagent with
`Skill(adlc:reviewing-divergence)`, passing the issue ID and the mode only. The subagent reads
the PM artifacts itself rather than trusting a summary — the summary is exactly where divergence
hides — and reports findings only: it never edits tickets and never takes the gate decision.

It is a step, not a stage, because the fix always belongs to the command that produced the
artifact; a separate `/adlc:review` command adds a stage a user can forget to run and a
round-trip back to the authoring command anyway. Inlining it also gets the plan reviewed, where
signal loss is cheapest to fix — a lost requirement caught at plan time costs a paragraph;
caught after execution it costs finished phases.

### Why Specification Before Technical Plan?

**Rationale:** User requirements should drive technical decisions, not the reverse.

**Example:**

- Specification: "Users must be able to reset password via email within 15 minutes"
- Technical Plan: "Use Redis for token storage (15min TTL), SendGrid for email delivery"

If we started with Technical Plan, we might choose Redis without understanding the 15-minute requirement.

### Why No File-Based Plans?

**Problems with files:**

- Synchronization with PM system required
- No single source of truth
- Team members don't see updates
- File locations unclear

**Benefits of PM system:**

- Real-time updates
- Team visibility
- Historical context
- Searchable
- Linked to commits/PRs

### Why Agent Teams as Default Strategy?

**Previous approach:** Sequential-only execution via Tier 2 subagents.

**Why Agent Teams (team strategy) as default:**

- Parallel task execution within phases significantly reduces wall-clock time
- Tier 3 skill enforcement preserved — teammates invoke the same TDD/review skills
- Pattern broadcasting enables teammates to share discoveries in real-time
- Shared phase branch with pull-rebase keeps git workflow simple
- Automatic fallback to sequential when teams aren't available or practical

**When sequential is still used:**

- Single-task phases (no benefit from parallelism)
- Agent Teams not enabled (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` not set)
- Headless or conductor mode (no interactive team coordination)
- Explicit `--strategy sequential` flag

**Trade-off:** Team mode uses more resources (multiple Sonnet sessions) and has potential for merge conflicts on the shared branch. Well-structured vertical slices minimize conflicts since tasks touch different files.

### Why Default Delegated Work to Sonnet?

**Approach:** Mechanical execution runs on Sonnet by default; the code-review gate runs on Opus.

**Why:**

- Opus costs roughly **5x Sonnet per token**, so model choice is the largest lever on delegated spend — more than any context optimisation
- Most delegated tasks are well-specified execution against a plan (TDD cycle, scoped edits), where Sonnet performs well
- Review is where the strongest model pays off (subtle bugs, security, architecture) and is low-volume, high-value — so the `code-reviewer` stays on Opus
- The interactive session model is unaffected — this only sets the model for subagents ADLC spawns

**Overridable** per invocation (`--model`), per repo (`execution.model_routing` in `adlc.local.md`), or permanently in agent frontmatter. Escalate to Opus for ambiguous specs, architectural refactors, subtle security/concurrency logic, complex debugging, or risky infrastructure. See [skills/execution-orchestration/references/model-routing.md](skills/execution-orchestration/references/model-routing.md).

### Why ~/worktrees/ Standard Location?

**Alternatives considered:**

1. `.worktrees/` in repo (original implementation)
2. `/tmp/worktrees/`
3. User-specified location

**Why ~/worktrees/:**

- Persistent across sessions (unlike /tmp)
- Outside repo (no .gitignore concerns)
- Isolation for clean workspace
- Easy cleanup
- Consistent across projects

### Why Label-Based Routing?

**Alternative considered:** Manual workflow selection

**Why labels:**

- Automatic routing (no user decision)
- Consistent execution (right workflow for task type)
- PM system enforces single label
- Clear semantics (feature vs chore vs bug)

**Example:** Feature requires full TDD. Chore requires verification only. Routing ensures correct workflow.

### Why Just Command Abstraction?

**Alternative considered:** Direct tool invocation (npm test, pytest, cargo test, etc.)

**Why just:**

- Stack-agnostic workflows
- Repository defines implementation
- Consistent interface
- Easy to change underlying tools
- Composable recipes

**Example:** `just test` might run unit + integration + e2e tests. Implementation details hidden from workflow.

## Integration Points

### Linear/JIRA MCP Servers

**Required for ADLC workflows:**

One of Linear or JIRA MCP server is **required** for most ADLC workflows to function:

- `/refine` - Create/update issues with Specification
- `/plan` - Add Technical Plan to issues
- `/breakdown` - Create sub-issues with dependencies
- `/execute` - Read sub-issues, update status
- `/address-feedback` - Create feedback sub-issues

**Exception:** `/foundations:setup` does not require Linear/JIRA - it works standalone with any repository

**MCP Tools Used:**

- `get_issue` - Fetch issue details
- `list_issues` - Fetch sub-issues (filter by parentId)
- `create_issue` - Create new issues
- `update_issue` - Update descriptions, status
- `create_dependency` - Link blocking relationships

**Note:** Users must install MCP servers separately. ADLC does not include them.

### Git Worktrees

**Required for:**

- `/execute` - Parallel execution isolation
- `/address-feedback` - Automatic worktree detection and switching

**Commands Used:**

- `git worktree add ~/worktrees/<repo>/<branch> -b <branch>`
- `git worktree list` - Enumerate existing worktrees
- `git worktree remove` - Cleanup after merge

### Just Task Runner

**Optional but recommended:**

- Provides consistent interface for test/lint/format/build
- Repository defines implementation
- ADLC invokes via `just <recipe>`

**Fallback:** If no justfile, ADLC uses stack-specific commands directly.

## Influences and References

**Review these periodically to stay aligned with industry best practices:**

### spec-kit (GitHub)

<https://github.com/github/spec-kit>

**Key ideas:**

- Specifications are living documents
- Separate WHAT from HOW
- Specs evolve with codebase
- Keep specs close to code

**How ADLC applies this:**

- Specifications in Linear (living, searchable)
- Clear Specification vs Technical Plan separation
- Specs updated during refinement
- Plans reference codebase files

### superpowers (obra)

<https://github.com/obra/superpowers>

**Key ideas:**

- AI agents as development workflow accelerators
- Skills-based architecture for reusability
- Human-in-the-loop for decisions
- Progressive automation

**How ADLC applies this:**

- Skill-based architecture (skills/ directory)
- Commands orchestrate skills
- User confirmation at key decision points
- Automatic execution with manual override

## Execution Architecture

### Execution Modes

ADLC detects the issue type and routes to the correct tier:

| Issue Type | Detection | Routed To |
|------------|-----------|-----------|
| **Feature** (parent) | Has sub-issues | Tier 1: execution-orchestration |
| **Phase** (sub-issue) | Has parent issue | Tier 2: execution-orchestration |
| **Standalone** | No parent, no children | Tier 3: executing-tasks (feature/bug/chore pathway) |

### PR Strategy

| Strategy | Flag | Behavior |
|----------|------|----------|
| **Feature branch** | `--pr-strategy feature` | Phase PRs merge to feature branch (squash) |
| **Stacked** | (default) | Phase PRs stack on previous phase branch |

### Conductor

Board-level orchestration of multiple features lives in the **separate Conductor plugin**, not
in ADLC — there is no `/adlc:conduct` command. The Conductor monitors the board, manages parallel
workers, and dispatches to executors. See [`../conductor/README.md`](../conductor/README.md). It is
driven by the `conductor` CLI:

```bash
conductor start     # Create tmux layout and launch Claude (runs /conductor:start)
conductor status    # Show status
conductor fetch     # Fetch board state (used internally by Claude)
conductor stop      # Stop conductor
```

### Completion Protocol

Completion signals flow upward through the tiers. All signals use the structured `<completion>` format:

```
Tier 3 (Task):       <completion>TASK:{phase_id}:{task_index}:COMPLETE\n{structured body}</completion>
Tier 2 (Phase):      <completion>PHASE:{phase_id}:COMPLETE\n{structured body}</completion>
Tier 1 (Feature):    <completion>FEATURE:{parent_id}:COMPLETE\n{structured body}</completion>
Tier 1 (Standalone): <completion>STANDALONE:{issue_id}:COMPLETE\n{structured body}</completion>
```

Status values: `COMPLETE`, `BLOCKED`, `FAILED`

Each signal includes a structured body with Summary, Verification, and Files Changed sections.

### State Files

| File | Location | Purpose |
|------|----------|---------|
| Executor State | `.claude/executor-state/*.json` | Per-executor progress |
| Conductor State | `.claude/.adlc_conductor/state.local.yml` | Board-level state |

### Cleanup

```bash
/adlc:clean-worktrees              # Interactive cleanup
/adlc:clean-worktrees --dry-run    # Preview cleanup
/adlc:clean-worktrees --all        # Clean all merged
```

See `docs/PARALLEL-ORCHESTRATION.md` for complete documentation.

## Version History

| Version | Date       | Changes                                      |
|---------|------------|----------------------------------------------|
| 1.4.0   | 2026-08-13 | PR babysitting moved out of the calling session into a fresh subagent spawned on a canonical brief in the `babysitting-prs` skill; every PR command moved into a fail-closed script |
| 1.3.0   | 2026-06-04 | Optional estimated Claude spend in PR bodies (opt-in `pr.include_spend`); branch-scoped, deduped, with feature-PR phase rollup |
| 1.2.0   | 2026-06-03 | Model routing — delegated execution defaults to Sonnet, code-review gate on Opus; overridable |
| 1.1.5   | 2026-03-04 | Fix hooks (SubagentStop/TeammateIdle/TaskCompleted), replace local plugin-dev with official |
| 1.1.0   | 2026-01-16 | Add parallel orchestration system            |
| 1.0.0   | 2025-11-02 | Initial CLAUDE.md for ADLC plugin            |

## Next Steps for Contributors

### If You're an AI Agent

1. **Check for CLAUDE.md** - If none exists or it's outdated, suggest `/foundations:setup`
2. **Read this file completely** before making changes
3. **Follow the principles** - they're battle-tested
4. **Use verification tools** - Run `just lint`, `just test` to self-verify
5. **Preserve architecture** - don't introduce circular dependencies
6. **Write tests first** - TDD is non-negotiable
7. **Update this file** if you discover new patterns or anti-patterns

### If You're a Human Developer

1. **Start with `/foundations:setup`** - Establish repository foundation first
2. **Understand the philosophy** before diving into code
3. **Try the workflows** - run `/refine`, `/breakdown`, `/execute` on test issues
4. **Review CLAUDE.md** - Generated documentation shows repository structure
5. **Read the influences** - spec-kit and superpowers provide context
6. **Question decisions** - if something seems wrong, it might be (or this doc needs updating)
7. **Contribute patterns** - capture new workflows in this document

## Questions and Discussions

**When working on ADLC:**

- "Does this follow spec-driven development?" (WHAT before HOW)
- "Is this testable via TDD?" (Test first)
- "Could this work with other stacks?" (Just abstraction)
- "Does this respect task dependencies?" (Sequential execution order)
- "Is context in the PM system?" (No separate files)

**If the answer is "no" to any question, reconsider the approach.**

---

**Remember:** This plugin exists to make development faster and more reliable through systematic workflows. Every design decision traces back to that goal.
