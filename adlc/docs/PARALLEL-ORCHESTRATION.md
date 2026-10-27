# Parallel Orchestration System

> This page covers the **conductor / multi-feature** specifics: board-level orchestration, execution strategy, state files, and the sleep/wake cycle. For the single-feature execution flow, tiers, and branch strategies, see the visual map in [`../EXECUTION_WORKFLOW.md`](../EXECUTION_WORKFLOW.md) and the [`execution-orchestration` skill](../skills/execution-orchestration/SKILL.md). For workflow orientation, see [`../skills/using-adlc/SKILL.md`](../skills/using-adlc/SKILL.md). Conductor setup lives in the [Conductor plugin README](../../conductor/README.md).

## Overview

The ADLC parallel orchestration system enables autonomous execution of multiple features and tasks with sophisticated state management, progress tracking, and human-in-the-loop integration.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CONDUCTOR                                    │
│  Board-level orchestrator managing multiple features                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │  Executor 1 │  │  Executor 2 │  │  Executor 3 │                 │
│  │  AIFE-100   │  │  AIFE-101   │  │  AIFE-102   │                 │
│  │  [Running]  │  │  [Sleeping] │  │  [Running]  │                 │
│  └─────────────┘  └─────────────┘  └─────────────┘                 │
└─────────────────────────────────────────────────────────────────────┘
         │                  │                  │
         ▼                  ▼                  ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Worktree 1 │    │  Worktree 2 │    │  Worktree 3 │
│  ~/wt/repo/ │    │  ~/wt/repo/ │    │  ~/wt/repo/ │
│  feature-a  │    │  feature-b  │    │  feature-c  │
└─────────────┘    └─────────────┘    └─────────────┘
```

## Execution Strategy

Within a phase, tasks run under one **strategy** — set with `--strategy` or `execution.strategy` in
config. This is the single execution axis; there is no separate `execution.mode`.

### Sequential

Tier 2 dispatches tasks one at a time to Tier 3 in an isolated worktree.

```bash
/adlc:execute PARENT-123 --strategy sequential
```

**Characteristics:**
- One task at a time; full context preservation; simplest debugging
- Best for small or tightly-coupled phases, headless runs, or when Agent Teams aren't available

### Team (default)

Tier 1 spawns Sonnet teammates (Agent Teams) that claim tasks from a shared list and run Tier 3 in
parallel on a shared phase branch.

```bash
/adlc:execute PARENT-123 --strategy team
```

**Characteristics:**
- Parallel task execution within a phase; dependency-aware claiming; shared phase branch with pull-rebase
- Requires `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`; falls back to sequential when teams aren't
  available, the phase is single-task, or running headless

> **Remote / multi-feature orchestration** — executors on remote VMs, board-level scheduling, and
> sleep/wake for PR reviews — is handled by the separate **Conductor plugin**
> ([`../../conductor/README.md`](../../conductor/README.md)), not by an ADLC execution mode.

## State Management

### Executor State

Each executor maintains state at `.claude/executor-state/{executor-id}.json`:

```json
{
  "executorId": "exec-abc123",
  "parentId": "AIFE-100",
  "status": "running",
  "currentTask": "AIFE-101",
  "completedTasks": ["AIFE-100"],
  "totalTasks": 5,
  "worktreePath": "~/worktrees/repo/feature-branch",
  "startedAt": "2026-01-16T10:00:00Z"
}
```

### Conductor State

The Conductor tracks all executors at `.claude/.adlc_conductor/state.local.yml`:

```yaml
status: running
lastPoll: "2026-03-01T14:30:00Z"
lastMergedPRCheck: "2026-03-01T14:30:00Z"
activeExecutors:
  - issueId: "AIFE-100"
    type: bug
    paneId: "1:0"
    worktreePath: ~/worktrees/project/AIFE-100-fix-login
    branch: "AIFE-100-fix-login"
    startedAt: "2026-03-01T14:25:00Z"
    needsRebase: false
completedToday:
  bugs: 3
  chores: 1
  features: 1
```

## Completion Protocol

Executors signal task completion with the structured `<completion>` format (e.g. `<completion>TASK:AIFE-101:COMPLETE</completion>`), validated by the SubagentStop hook before an executor can exit. The full signal format across tiers (TASK / PHASE / FEATURE / STANDALONE, with status values and structured body) is documented once in [`../CLAUDE.md`](../CLAUDE.md#completion-protocol).

## Progress Tracking

Progress is tracked across multiple channels:

| Channel | What's Tracked |
|---------|---------------|
| Executor State | Current task, completed count |
| PM System | Issue status updates |
| GitHub PR | PR state, CI status |
| Completion Signals | Explicit task outcomes |

## Sleep/Wake Cycle

For remote executors (Conductor plugin), executors can sleep while waiting for external events:

```
Executor creates PR
       │
       ▼
Sleep (waiting for review)
       │
       ▼
Wake trigger detected:
  - PR approved
  - CI passed
  - Review requested changes
       │
       ▼
Executor wakes and continues
```

Wake triggers are detected via GitHub Actions workflow polling.

## Conductor Commands

The Conductor is a **separate plugin** — see the [Conductor plugin README](../../conductor/README.md).
It is driven by the `conductor` CLI (there is no `/adlc:conduct` command):

```bash
# Start conductor (creates tmux layout, launches Claude via /conductor:start)
conductor start

# Show conductor status
conductor status

# Fetch board state (used internally by Claude)
conductor fetch

# Stop conductor gracefully
conductor stop
```

## Cleanup

After execution completes:

```bash
# Interactive cleanup of merged worktrees
/adlc:clean-worktrees

# Show what would be cleaned
/adlc:clean-worktrees --dry-run

# Clean all merged branches
/adlc:clean-worktrees --all

# Force cleanup (even unmerged)
/adlc:clean-worktrees --force
```

## Troubleshooting

### Executor Stuck

1. Check executor state: `cat .claude/executor-state/*.json | jq`
2. Check for completion signal in conversation
3. Verify worktree exists: `git worktree list`

### Missing Completion Signal

The SubagentStop hook will block exit if no completion signal found. Check:
1. Task actually completed (tests pass, PR created)
2. Explicit `<completion>` tag in output
3. Hook configuration in `hooks/hooks.json`

### Stale Artifacts

Run stale detection:
```bash
# Conductor status includes stale report (Conductor plugin — see ../../conductor/README.md)
conductor status
```

Stale criteria:
- Branches: No commits > 7 days, no open PR
- Worktrees: No commits > 7 days, branch merged
- Executors: Sleeping > 48 hours

### State Corruption

Archive and reset:
1. Archive current state: `cp -r .claude/executor-state .claude/archive/`
2. Remove corrupt state: `rm .claude/executor-state/*.json`
3. Restart execution: `/adlc:execute PARENT-123`

## Best Practices

1. **Start Small**: Use the sequential strategy until comfortable with the system
2. **Monitor Progress**: Watch the PM board and PR checks during team execution (`conductor status` for multi-feature runs)
3. **Clean Up**: Run cleanup after each feature completion
4. **Review Lessons**: Check CLAUDE-lessons.md for extracted learnings
5. **Archive History**: Keep archives for debugging and auditing
