---
description: Handle maintenance tasks and chores with best practice verification (tests, build, lint) without requiring TDD
---

# Chore - Maintenance Task Execution Command

Execute maintenance tasks like dependency upgrades, refactoring, and other chores that don't require test-first development but still ensure quality through comprehensive verification.

## Usage

```bash
/chore <description>              # Execute chore from description
/chore <issue-id>                 # Execute chore from Linear issue
```

## Overview

This command is designed for maintenance tasks that:

- Don't benefit from test-driven development (e.g., dependency upgrades)
- Still require quality verification (all tests pass, build succeeds)
- Need best practice enforcement (lint, format)

**Key differences from `/execute`:**

- No TDD requirement
- No sub-issues (single chore task)
- Simpler workflow focused on verification
- Still ensures all tests pass and build succeeds

## Model Recommendation (cost)

Chores are mechanical maintenance work, so **at the start of execution, surface a one-line model tip** (then continue without waiting for a reply):

> 💡 **Model tip:** chore/maintenance work — Sonnet handles this well at ~1/5 the Opus cost. If you're on Opus, consider `/model sonnet` for this task; escalate back to Opus only if it turns out to need deep reasoning.

See `skills/execution-orchestration/references/model-routing.md`.

## Prerequisites

**Repository MUST have:**

- Clean working directory OR git worktree
- Justfile with test/lint/format/build commands (recommended)

**Optional:**

- Linear issue with chore details
- Linear MCP server for issue integration

## Workflow

### 1. Load Chore Context

**Parse input to determine source:**

- If matches `[A-Z]+-\d+` pattern: fetch from Linear via `mcp__linear-server__get_issue`
- Otherwise: treat as chore description

**Extract chore details:**

- Title and description
- Issue ID (if from Linear)

**Present context and confirm:**

- Display chore details
- Explain the executing-tasks skill (chore pathway) workflow
- Get user confirmation

### 2. Execute via Skill

**Announce and invoke:**

```
I'm using the executing-tasks skill (chore pathway) to handle this maintenance task.
```

**Pass to skill:**

- Chore title and description
- Linear issue ID (if applicable)

**Skill handles:** Pre-flight checks, implementation, verification, fixes, lightweight code review, commit, Linear updates

### 3. Report Results

**Summarize completion:**

- Changes made
- Verification results
- Commit details
- Next actions (create PR via `/pr`)

## Error Handling

**Common errors and resolutions:**

- **Dirty working directory:** Commit/stash changes or use git worktree
- **Missing justfile:** Create justfile or continue with manual verification
- **Linear issue not found:** Check issue ID, access, and MCP configuration
- **Test/build failures:** Review skill output and fix issues iteratively

## Examples

**From description:**

```bash
/chore "Upgrade React from v17 to v18"
```

**From Linear issue:**

```bash
/chore MAINT-42
```

Both invoke the executing-tasks skill (chore pathway) which handles implementation, verification, fixes, lightweight code review, and commit.

## Integration

**Command orchestrates:** Context loading → Skill invocation → Result reporting

**Skill provides:** Pre-flight checks, implementation, verification, fixes, lightweight code review, commits, Linear updates

**Follow-up:** Use `/pr` to create pull request

## When to Use

**Use /chore for:** Dependency upgrades, refactoring, cleanup, config changes, docs, removing deprecated code

**Use /execute for:** New features, bug fixes, functionality requiring TDD or sub-issues
