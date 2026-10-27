---
description: Break down refined and planned issues into implementation sub-issues with dependencies in Linear/JIRA
---

# Breakdown - Implementation Task Creation Command

Transform refined specification and technical plan into executable sub-issues with dependencies.

## Usage

```bash
/breakdown <issue-id>       # Break down issue into sub-issues
```

## Overview

This command uses the `breakdown-planning` skill to:

1. Load issue and verify Specification + Technical Plan exist
2. Break Technical Plan phases into independent, implementable tasks
3. Each task is a complete feature/behavior (TDD: tests + implementation together)
4. Create sub-issues in Linear/JIRA with full context
5. Map dependencies between tasks
6. Review the breakdown from a **fresh context** (dispatched subagent), then present the human gate before execution

## Requirements

**The parent issue MUST have:**

- "Specification" section (from `/adlc:refine` - defines WHAT)
- "Technical Plan" section (from `/adlc:plan` - defines HOW)

**If missing:** Suggests running `/adlc:refine` and/or `/adlc:plan` first.

## Core Concept

**Vertical phases, horizontal tasks:**

- **Phases** are vertical slices — each delivers independently demoable end-to-end functionality (DB + API + UI as needed)
- **Tasks** within each phase are horizontal layer-specific units — one TDD cycle per task (e.g., "add migration", "implement endpoint", "create form component")
- Each phase becomes one sub-issue under the parent feature. Tasks are checklist items within the phase sub-issue — never separate tickets.

## How It Works

### Step 1: Verify Prerequisites

```bash
# Load issue
if mcp__linear-server available:
  issue = mcp__linear-server__get_issue(id)
elif jira available:
  issue = jira_get_issue(id)
else:
  ERROR: No PM system configured

# Verify sections
if "## Specification" not in issue.description:
    ERROR: Run `/adlc:refine <issue-id>` first
    STOP
if "## Technical Plan" not in issue.description:
    ERROR: Run `/adlc:plan <issue-id>` first
    STOP
```

### Step 2: Run Breakdown-Planning Skill

```bash
Skill(adlc:breakdown-planning)
```

The skill handles:

- **Assessing whether a breakdown is warranted at all** — if the issue is already a single thin vertical slice, it proposes skipping breakdown and executing directly; if borderline, it clarifies with the user
- Slicing into vertical phases (each phase = one demoable end-to-end behavior)
- Breaking each phase into horizontal tasks by layer (DB, API, service, UI)
- Each feature/bug task includes full TDD workflow (tests + implementation); chore phases use a verification checklist instead
- Creating phase sub-issues with Specification context + Technical Plan guidance
- Defining acceptance criteria and acceptance tests per phase (feature/bug phases include an end-to-end / acceptance test per slice)
- Mapping dependencies between phases
- Self-checking coverage for signal loss — confirming the phases together deliver the entire Technical Plan and Specification before hand-off

### Step 3: Independent Divergence Review (Fresh Context)

`/adlc:execute` runs autonomously against whatever the tickets say: a requirement lost,
invented, or quietly narrowed during breakdown becomes code before anyone reads it. The
self-check in Step 2 cannot catch that — a decomposition cannot audit itself. Dispatch a
subagent:

```python
Agent(
    subagent_type="general-purpose",
    prompt=f"Review the breakdown of {issue_id} against its Specification and Technical Plan. "
           f"Follow Skill(adlc:reviewing-divergence) in mode `breakdown`. Read the parent and "
           f"all sub-issues from the PM system yourself; post the divergence report to the "
           f"parent and return it."
)
```

**Pass the issue ID and mode only — never a summary of the tickets.** The summary is where the
divergence hides.

The subagent posts a severity-ranked report to the parent and returns PASS / PASS WITH DECISIONS /
RETURN TO BREAKDOWN. Skipped for a single-slice issue that skipped breakdown; when this session
did **not** author the breakdown, run the skill inline instead.

### Step 4: Present the Gate

The human takes the decision — never chain into `/adlc:execute` on your own PASS:

```markdown
✓ Breakdown complete: 5 phase sub-issues created
✓ Divergence review (fresh context): ✅ PASS — 0 blockers · criteria 8/8

Ready to execute? Run `/adlc:execute <issue-id>`
```

On findings, fix them here (or in `/adlc:refine` when the gap is in the Specification) and
re-run the review — the reviewer reports, `/adlc:breakdown` fixes:

```markdown
🔴 RETURN TO BREAKDOWN — 2 blockers, 1 decision (report on <issue-id>)

B1  AC-4 (>100k rows rejected) is delivered by no phase
B2  Phase 2 writes the tests that Phase 3 implements — split TDD cycle
D1  Phase 3 adds a bulk-export queue that no acceptance criterion asks for
```

## Error Handling

### No PM System

```markdown
ERROR: No project management system configured
Set up Linear or JIRA MCP server first.
```

### Missing Sections

```markdown
ERROR: Issue missing required sections

Run in order:
1. `/adlc:refine <issue-id>` - Create Specification (WHAT)
2. `/adlc:plan <issue-id>` - Create Technical Plan (HOW), reviewed from a fresh context
3. `/adlc:breakdown <issue-id>` - Create tasks, reviewed from a fresh context

Missing: [Specification | Technical Plan | Both]
```

### Already Has Sub-Issues

```markdown
WARNING: Issue already has sub-issues

Options:
1. Skip (use existing)
2. Add more (append)
3. Replace (delete and recreate)
```

## Examples

### Example: Successful Breakdown

```bash
/breakdown AUTH-123
```

Output:

```
Loaded AUTH-123: "User authentication"
✓ Specification found
✓ Technical Plan found

Using breakdown-planning skill...

Created 5 phase sub-issues (vertical slices):
- Phase 1: Register a user (5 tasks) - no dependencies
- Phase 2: Log in and receive session (6 tasks) - blocked by Phase 1
- Phase 3: View and edit profile (4 tasks) - blocked by Phase 2
- Phase 4: Log out and session management (4 tasks) - blocked by Phase 2
- Phase 5: Reset password via email (6 tasks) - blocked by Phase 1

Each phase is independently demoable end-to-end.
Phases 3-5 can run in parallel after their dependencies complete.

Ready to execute? Run `/adlc:execute AUTH-123`
```

### Example: Single Slice (Propose Skipping)

```bash
/breakdown FEAT-88
```

Output:

```
Loaded FEAT-88: "Add CSV export button to reports page"
✓ Specification found
✓ Technical Plan found

Using breakdown-planning skill...

This issue is already a single thin vertical slice (~4 tasks: endpoint + button +
wiring + E2E test). Breaking it into phases would add ceremony without value.

Recommendation: skip breakdown and execute it directly as a standalone.

Run `/adlc:execute FEAT-88`, or reply "break down anyway" to force a breakdown.
```

### Example: Missing Plan

```bash
/breakdown FEAT-45
```

Output:

```
Loaded FEAT-45: "Notifications"
✓ Specification found
✗ Technical Plan missing

ERROR: Run `/adlc:plan FEAT-45` first to create technical plan
```

## Integration

**Requires:**

- Linear/JIRA MCP configured
- Issue with Specification + Technical Plan
- `breakdown-planning` and `reviewing-divergence` skills

**Chains to:**

- `/adlc:execute` (after a human passes the divergence gate)

## Remember

- Use `breakdown-planning` skill for all breakdown work
- Each phase sub-issue = one vertical slice delivering demoable e2e functionality
- Tasks within a phase = horizontal layer-specific units (DB, service, API, UI)
- Tasks are checklist items in the phase sub-issue, never separate tickets
- Each task includes BOTH tests and implementation (TDD, not split)
- Sub-issues include both WHAT (spec) and HOW (technical plan) context
- Each phase has clear acceptance criteria and acceptance tests
- Offer `/adlc:execute` but don't force
