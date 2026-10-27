---
name: execution-orchestration
description: Unified execution-orchestration skill for features, phases, and standalone tasks. Orchestrates worktree creation, team/sequential task execution, code review gates, phase PRs (stacked default), and PM status updates.
version: 1.0.0
---

# Execution Orchestration

## Overview

Execute a parent feature issue by orchestrating its phase sub-issues. Each phase creates a worktree, executes tasks (team or sequential), passes a code review gate, and produces a phase PR. Stacked PRs are the default.

**Entry point:** `/adlc:execute ISSUE-ID` → `commands/execute.md` detects issue type → invokes this skill for features and phases.

**Tiers:** this one skill operates at **Tier 1** (invoked on a feature — orchestrates its phases) and **Tier 2** (invoked on a phase — executes that phase's tasks), and dispatches **Tier 3** (`executing-tasks`) per task. Which role it plays is decided at Step 0 by the issue type. In team strategy (default) Tier 2 folds into the Tier 1 lead; in sequential strategy Tier 1 dispatches a fresh instance of this skill per phase as Tier 2.

**Core flow:** Load issue → Resume check → Validate → Resolve dependencies → Create feature worktree → Phase loop (worktree → tasks → review → PR → merge → cleanup) → Feature PR → Complete.

## Architecture

```
Parent Issue (PARENT-100)
  │
  ▼ This skill
  ├── Phase 1 (PARENT-101) ──▶ Worktree → Tasks → Review → Phase PR
  │   ├── Task 1 ──▶ Tier 3 skill (TDD)
  │   ├── Task 2 ──▶ Tier 3 skill (TDD)
  │   └── Task 3 ──▶ Tier 3 skill (TDD)
  ├── Phase 2 (PARENT-102) ──▶ Worktree → Tasks → Review → Phase PR
  │   └── ...
  └── Feature PR → main
```

**Strategies:**

| Strategy | How | When |
|----------|-----|------|
| **Team** (default) | Spawn Sonnet task agents + code reviewer via Agent Teams | Multi-task phases, Agent Teams enabled |
| **Sequential** (fallback) | Single subagent executes tasks serially, then code reviewer | No Agent Teams, single-task, headless/conductor, explicit flag |

---

## Verification Gate — Verify Subagent Work Before Trusting It

Subagents self-report completion. A `<completion>...:COMPLETE` signal, or "all tests passing" in
a task summary, is a prompt to verify — not evidence. Before you act on a subagent result,
aggregate it into a completion claim, or merge a phase, confirm the work yourself. The
orchestrator's own claims (phase/feature signals, PM comments) must reflect commands *you* ran on
the integrated branch, not the subagents' reports summed together.

- **Before trusting a subagent result:** read the VCS diff on the phase branch and confirm the
  changes it claims are present.
- **Before a phase completion claim or merge:** run the checks fresh on the *integrated* phase
  branch (`just test`, `just lint`, `just build`). Tasks passing in isolation don't prove the
  merged branch passes — rebases and overlapping edits interact. This is the integrated
  verification gate at Step 5d.
- **Acceptance-criteria coverage is the phase's gate.** Acceptance tests verify the vertical slice
  as a whole, so the slice is only proven when every phase acceptance criterion is covered by a
  passing acceptance test on the integrated branch. A single task can't close this — tasks own
  unit tests; the phase owns acceptance coverage. Verify it at Step 5d.

**What each claim requires:**

| Claim | Requires | Not sufficient |
|-------|----------|----------------|
| Subagent task done | VCS diff shows the claimed changes | `COMPLETE` signal, task summary |
| Phase tests pass | `just test` on the integrated phase branch: 0 failures | Sum of per-task reports |
| Acceptance criteria met | A passing acceptance test per criterion on the integrated branch | Reviewer opinion, per-task unit tests |
| Phase complete | Integrated checks + acceptance coverage pass + code review gate passed | All tasks reported `COMPLETE` |
| Feature complete | Every phase verified and merged | Phase signals aggregated |

**Watch for:** treating incidental `COMPLETE` text as done instead of matching the structured
`<completion>...:COMPLETE` signal; writing "all passing" into a PM comment or completion signal
from subagent summaries; merging a phase before running the integrated checks yourself.

## Step 0: Entry & Detection

```python
issue = mcp__linear-server__get_issue(id=issue_id)
sub_issues = mcp__linear-server__list_issues(parentId=issue.id)

if len(sub_issues) > 0:
    # Feature — orchestrate phases (this skill's main flow)
    proceed_to_step_1()
elif issue.parent:
    # Phase — execute tasks within this single phase
    proceed_to_step_5_single_phase(issue)
else:
    # Standalone — commands/execute.md routes to Tier 3 directly
    ERROR("Standalone issues route to Tier 3 via execute command")
```

## Step 1: Resume Check (PM as Source of Truth)

Every invocation assumes it might be resuming. PM is the only source of truth — no local state files.

**Gather state:** Query PM sub-issues (partition into done/in-review/in-progress/pending), check `git gtr list` for existing worktrees, check `gh pr list` for open PRs on the feature branch.

**Resume decision table:**

| PM Status | Action |
|-----------|--------|
| Done | **Skip** — phase already complete |
| In Review + PR merged | **Sync PM** → Done, skip |
| In Review + PR open (changes requested) | Treat as in-progress, address feedback |
| In Review + no PR found | Reset to pending, re-execute |
| In Progress + worktree exists | **Dispatch Explore agent** to assess progress (commits, uncommitted changes, test status, task completion). Resume from next incomplete task or start fresh based on report. |
| In Progress + branch exists, no worktree | Recreate worktree (`git fetch origin {branch} && git gtr new {branch}`), then assess as above |
| In Progress + no branch | Stale status — reset to pending |
| Pending | Start fresh (cleanup orphan worktree/branch if present) |

**Feature branch recovery:** If the feature worktree already exists, `cd` into it. If only the branch exists, recreate the worktree with `git fetch origin {branch} && git gtr new {branch}`.

**Key principle:** Never fail because of leftover state. Detect it, assess progress, recover, continue.

## Step 2: Validate Prerequisites

```python
# Parent checks
if "## Specification" not in parent.description:
    ERROR("Missing ## Specification — run /adlc:refine first")
if "## Technical Plan" not in parent.description:
    ERROR("Missing ## Technical Plan — run /adlc:plan first")

# Phase checks
for phase in [p for p in sub_issues if p.state not in ("Done", "Completed")]:
    phase_detail = mcp__linear-server__get_issue(id=phase.id)

    # Must have label
    if not any(l.name in ("feature", "bug", "chore") for l in phase_detail.labels):
        ERROR(f"Phase {phase.identifier} has no feature/bug/chore label")

    # Must have key sections
    for section in ("## Scope", "## Tasks", "## Acceptance Criteria"):
        if section not in phase_detail.description:
            ERROR(f"Phase {phase.identifier} missing {section}")

    # Parseable tasks check
    if "### Task" not in phase_detail.description and "- [ ]" not in phase_detail.description:
        WARNING(f"Phase {phase.identifier} has no parseable tasks — whole-phase fallback will be used")
```

## Step 3: Resolve Dependencies

Build execution graph from PM blocking relations. See [references/dependency-analysis.md](references/dependency-analysis.md).

```python
graph = analyze_dependencies(sub_issues)
cycles = detect_cycles(graph)
if cycles:
    ERROR(f"Circular dependencies: {cycles}")

waves = calculate_waves(graph)
# waves[0] = phases with no blockers (execute first)
# waves[1] = phases whose blockers are all in wave 0
# etc.
```

## Step 4: Create Feature Branch Worktree

```bash
# Create feature worktree from main (gtr handles ~/worktrees/<repo>/ location)
git gtr new feature/{id}-{slug}
cd ~/worktrees/<repo>/feature-{id}-{slug}/

# gtr automatically:
# - Creates branch from main
# - Copies .env files
# - Runs just install (if justfile exists)
```

**PM update:** Set parent issue → In Progress.

## Step 5: Phase Loop

For each ready phase (respecting dependency waves):

### 5a. Create Phase Worktree

```bash
# Branch from feature branch (--from-current uses current branch as base)
git gtr new {phase-branch} --from-current
cd ~/worktrees/<repo>/{phase-branch}/

# gtr handles .env copying and just install
```

### 5b. PM Update

```python
mcp__linear-server__save_issue(id=phase.id, state="In Progress")
```

### 5c. Resolve Strategy

```python
def resolve_strategy(flags, config, phase):
    # Explicit flag takes priority
    if flags.get("strategy"):
        return flags["strategy"]

    # Config setting
    if config.get("execution.strategy"):
        return config["execution.strategy"]

    # Default: team
    strategy = "team"

    # Auto-fallback to sequential
    if strategy == "team":
        if not env_var_set("CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS"):
            return "sequential"
        if is_headless_or_conductor():
            return "sequential"
        tasks = parse_tasks(phase.description)
        if len(tasks) <= 1:
            return "sequential"

    return strategy
```

### 5d. Execute Tasks

**Parse tasks** from phase description. See [references/task-parsing.md](references/task-parsing.md).

**Route by phase label:**

| Phase Label | Tier 3 Skill | Pathway | Workflow |
|-------------|-------------|---------|----------|
| `feature` | `executing-tasks` | feature | Full TDD |
| `bug` | `executing-tasks` | bug | Reproduce + TDD fix |
| `chore` | `executing-tasks` | chore | Verification-focused (+ lightweight review) |

#### Team Strategy

See [references/team-deployment.md](references/team-deployment.md) for full prompt templates.

```python
tasks = parse_tasks(phase.description)

# Write a brief file per task (full context incl. the spec/plan slice the lead fetches from
# PM) and put only a short pointer in the task description. Keeps prompts small; the task agent
# reads the brief locally and needs no MCP access. See references/task-brief.md.
briefs_dir = f"{phase_worktree}/.claude/executor-state/briefs"
for task in tasks:
    brief_path = write_task_brief(
        f"{briefs_dir}/{phase_id}-task-{task['index']}.md", task, phase, parent, patterns
    )
    TaskCreate(
        subject=f"Task {task['index']}: {task['title']}",
        description=task_pointer(task, phase_id, phase_label, brief_path),
        activeForm=f"Executing {task['title']}"
    )

# Set up dependencies from parallelisation notes
dependencies = parse_parallelisation_notes(phase.description)
for task_id, blocked_by in dependencies.items():
    TaskUpdate(taskId=task_id, addBlockedBy=blocked_by)

# Spawn task agents — honour --model / execution.model_routing, default Sonnet
resolved_model = resolve_model(phase_label, flags, config) or "sonnet"
max_teammates = min(len(tasks), 4)
for i in range(max_teammates):
    spawn_teammate(model=resolved_model, prompt=TASK_AGENT_PROMPT)

# Monitor completion, handle failures
# See references/failure-handling.md for retry protocol
```

#### Sequential Strategy

```python
accumulated_patterns = codebase_patterns
briefs_dir = f"{phase_worktree}/.claude/executor-state/briefs"

for task in task_order:
    # Write the brief locally (full context incl. spec/plan slice); pass only a pointer.
    brief_path = write_task_brief(
        f"{briefs_dir}/{phase_id}-task-{task['index']}.md", task, phase, parent, accumulated_patterns
    )
    result = Agent(
        subagent_type=route_by_label(phase_label),
        model=resolve_model(phase_label, flags, config),  # None => agent's frontmatter default (sonnet for execution roles)
        prompt=task_pointer(task, phase_id, phase_label, brief_path)
    )

    if parse_completion(result).status == "COMPLETE":   # match the <completion>TASK:...:COMPLETE envelope, not incidental text
        new_patterns = extract_patterns(result)
        accumulated_patterns.extend(new_patterns)
    else:
        # Retry up to 3 times, then fail phase
        # See references/failure-handling.md
```

#### Model Routing

Delegated execution defaults to **Sonnet**; the code-review gate runs on **Opus**. Both
strategies resolve the model via `resolve_model(phase_label, flags, config)` (team dispatch
falls back to `"sonnet"` on `None`; sequential passes `None` through to each agent's frontmatter
default). Override per invocation (`--model`), per repo (`execution.model_routing`), or in agent
frontmatter; escalate to Opus for ambiguous specs, architectural refactors, or subtle
security/concurrency logic. See [references/model-routing.md](references/model-routing.md).

#### Integrated Verification (gate before review)

Once every task reports `COMPLETE`, don't proceed on the reports alone — apply the **Verification
Gate** (above):

- Read `git diff {base_branch}...{phase_branch}` and confirm each task's claimed changes are present.
- Run the checks on the integrated branch — `just test`, `just lint`, `just build`. All must pass
  here, not just in each task's isolated run.
- Confirm every phase **acceptance criterion is covered by a passing acceptance test** (the phase's
  e2e/slice tests) on the integrated branch. Tasks own unit tests; acceptance coverage is proven
  here, where the whole slice exists. A criterion with no acceptance test is a gap — add one (or
  dispatch a task) before the review gate.

If the integrated branch fails or a criterion is uncovered, treat it as a task-integration
failure: fix it or dispatch a fix (retry protocol in
[references/failure-handling.md](references/failure-handling.md)) before the review gate. The
"all passing" you report later must come from this run.

### 5e. Code Review Gate

After all tasks complete and the integrated verification gate passes, dispatch code reviewer to validate the phase. Provide the reviewer with a summary of completed tasks (from their `<completion>TASK:` signals), corroborated by the diff you just read. The reviewer runs on Opus (its frontmatter default).

```python
Agent(
    subagent_type="adlc:code-reviewer",
    prompt=f"""Review all changes on phase branch vs base.

    PHASE: {phase.identifier} — {phase.title}
    DIFF: git diff {base_branch}...{phase_branch}
    ACCEPTANCE CRITERIA: {phase.acceptance_criteria}
    SPECIFICATION: {spec_excerpt}
    TECHNICAL PLAN: {plan_excerpt}

    TASK SUMMARIES:
    {aggregated_task_summaries}

    CHECK:
    - TDD compliance (tests before impl, tests fail first, coverage)
    - Acceptance criteria met
    - Code quality (SOLID, no circular deps, proper naming)
    - Security (no hardcoded secrets, input validation)

    Produce severity-tagged report: critical / major / minor.
    Fix critical and major issues directly. Report minor as comments.
    """
)
```

**Re-verify after review fixes.** The reviewer commits critical/major fixes directly, which
invalidates the Step 5d run. Before creating the phase PR or merging, apply the **Verification
Gate** once more on the now-updated branch: re-read the diff and re-run `just test`, `just lint`,
`just build`. The "all passing" you report at 5i must come from *this* post-review run, not the
pre-review one.

### 5f. Create Phase PR

Determine base branch based on PR strategy. See [references/pr-strategies.md](references/pr-strategies.md).

```python
# Stacked (default): chain PRs
if pr_strategy == "stacked":
    base = previous_phase_branch or feature_branch
else:  # feature branch strategy
    base = feature_branch

# Push and create PR
git push -u origin {phase_branch}
pr = gh pr create --base {base} --head {phase_branch} \
    --title "[{phase.identifier}] {phase.title}" \
    --body "Phase PR body with changes, tests, patterns"
```

**Estimated spend (if `pr.include_spend: true`):** scope this phase's worktree with a strict
`--cwd-prefix` and append the block to the phase PR body, using the usage plugin's
`analyze_usage.py` (single source of pricing; skip if not installed). See
[creating-pull-requests/resources/spend-estimate.md](../creating-pull-requests/resources/spend-estimate.md)
for the exact command.

### 5g. PM Update

```python
mcp__linear-server__save_issue(id=phase.id, state="In Review")
mcp__linear-server__create_comment(
    issueId=phase.id, body=f"Phase PR created: {pr.url}"
)
```

### 5h. Squash-Merge Phase PR

```bash
gh pr merge {pr_number} --squash --delete-branch
```

### 5i. PM Update & Structured Phase Completion

The **Tests** and **Verification** lines below must report the integrated run from Step 5d, not
the sum of per-task reports.

```python
mcp__linear-server__save_issue(id=phase.id, state="Done")
mcp__linear-server__create_comment(
    issueId=parent.id,
    body=f"""## Phase Complete: {phase.identifier}
**Implemented:** {summary}
**Phase PR:** #{pr_number} (squash-merged)
**Tests:** {test_count} written, all passing
**Verification:** just test + lint + build clean (integrated run, Step 5d)
**Acceptance:** {covered}/{total} criteria covered by passing acceptance tests
**Patterns:** {new_patterns}
**Files Changed:** {file_list}"""
)
```

### 5j. Cleanup Phase Worktree

```bash
git gtr rm {phase-branch} --delete-branch
```

### 5k. Accumulate Patterns

Pass discovered patterns to next phase for consistency.

## Step 6: Feature PR

```bash
# From feature worktree
gh pr create --base main --head {feature_branch} \
    --title "[{parent.identifier}] {parent.title}" \
    --body "Feature PR with summary of all phases"
```

**Estimated spend rollup (if `pr.include_spend: true`):** use a `--cwd-stem` so the gtr
dash-boundary sweeps every phase worktree (`feature-X`, `feature-X-phase-1`, …) in one pass —
this matches the `cwd` strings in the transcripts even after phase worktrees were deleted at 5j;
`message.id` dedup keeps the union exact. See
[creating-pull-requests/resources/spend-estimate.md](../creating-pull-requests/resources/spend-estimate.md)
for the exact command. Append to the feature PR body when non-empty.

**PM update:** Set parent → In Review, comment PR link.

**Drive to done:** Spawn a fresh subagent on the feature PR using the canonical brief in
[`adlc:babysitting-prs`](../babysitting-prs/SKILL.md#spawning-this-skill-the-canonical-brief) —
drive CI to green, critically evaluate and (safely) incorporate review feedback, and notify when
it's ready to merge. It runs in its own fresh context; do not wait on it. The completion signal
below reports the PR as *opened and being driven to done*, not merged (this skill never
auto-merges).

## Step 7: Feature Completion Signal

Emit a structured `<completion>FEATURE:` signal that the conductor can parse. Its **Verification**
section rests on each phase's integrated verification (Step 5d) and review gate — not on subagent
reports aggregated across phases.

```xml
<completion>FEATURE:{parent.identifier}:COMPLETE

## Ticket
{parent.identifier}: {parent.title}

## Summary
{aggregated_summary_of_all_phases}

## Phases Completed
1. {phase_1.identifier}: {phase_1.title} — {task_count} tasks, PR #{pr_1} merged
2. {phase_2.identifier}: {phase_2.title} — {task_count} tasks, PR #{pr_2} merged

## Verification
- {total_tests} tests written, all passing
- just test + lint + build clean on each phase's integrated branch (Step 5d)
- Every phase's acceptance criteria covered by passing acceptance tests
- Code review passed on all phase PRs

## Feature PR
{feature_pr_url}

## Follow-up Tickets
- {follow_up_1} (created during execution)
</completion>
```

If blocked:

```xml
<completion>FEATURE:{parent.identifier}:BLOCKED
{reason}
</completion>
```

---

## Worktree Management

All worktree operations use `git gtr` (from worktrees plugin). See the worktrees plugin for setup.

| Operation | Command |
|-----------|---------|
| Create feature worktree (from main) | `git gtr new feature/{id}-{slug}` |
| Create phase worktree (from feature branch) | `git gtr new {phase-branch} --from-current` |
| List worktrees | `git gtr list` |
| Remove after merge | `git gtr rm {branch} --delete-branch` |
| Batch cleanup merged | `git gtr clean --merged` |

**Directory convention:** `~/worktrees/<repo-name>/<branch-slug>/`

## Branch Naming

| Branch | Pattern | Example |
|--------|---------|---------|
| Feature | `feature/{parent-id}-{slug}` | `feature/PARENT-100-user-auth` |
| Phase | `feature/{parent-id}-{slug}/phase-{n}-{slug}` | `feature/PARENT-100-user-auth/phase-1-register` |

Tasks commit directly to the phase branch (no per-task branches).

**Completion signals** at every tier use the `<completion>TIER:{id}:STATUS\n{body}</completion>`
format (Step 7 shows the feature-level signal). Status values: `COMPLETE`, `BLOCKED`, `FAILED`;
each body carries Summary, Verification, and Files Changed sections.

**PR strategies** — stacked (default, phase PRs chain) vs feature branch (all phase PRs → feature
branch). See [references/pr-strategies.md](references/pr-strategies.md).

---

## Additional Resources

- [references/task-parsing.md](references/task-parsing.md) — Task extraction from phase descriptions
- [references/dependency-analysis.md](references/dependency-analysis.md) — Graph building, cycle detection, wave computation
- [references/pr-strategies.md](references/pr-strategies.md) — Stacked vs feature branch PR strategies
- [references/team-deployment.md](references/team-deployment.md) — Task agent + code reviewer prompt templates
- [references/task-brief.md](references/task-brief.md) — File-based per-task context handoff (small prompts, no subagent MCP dependency)
- [references/failure-handling.md](references/failure-handling.md) — Retry → skip → continue protocol

## Related Skills

**Dispatches to (Tier 3):**
- **executing-tasks** — Single Tier 3 skill with three pathways selected by phase label: feature pathway (TDD) for `feature`, bug pathway (systematic debugging + TDD) for `bug`, chore pathway (verification-focused + lightweight review) for `chore`

**Uses:**
- **creating-pull-requests** — PR creation patterns
- **updating-pm-status** — PM lifecycle updates

## Related Plugins

- **conductor** — Board-level orchestration (multiple features, worktrees)
- **worktrees** — `git gtr` worktree management

## Remember

- **PM is source of truth** — no local state files; query PM to resume, sync at every transition
- **Verify subagent work** — a `COMPLETE` signal is a prompt to check, not evidence; read the diff and re-run the integrated checks before claiming a phase or feature done
- **Acceptance tests are the phase's gate** — the slice is proven only when every acceptance criterion has a passing acceptance test on the integrated branch; unit tests are the task's job
- **Team default, sequential fallback** — auto-detect on env, task count, mode
- **gtr for worktrees** — never raw `git worktree`
- **Code review gate per phase**, **one commit per task** (Tier 3 handles commits)
- **Vertical slices** — each phase delivers demoable end-to-end functionality; accumulate patterns forward
- **Structured completion signals** for conductor detection
