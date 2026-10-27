---
description: Create technical implementation plan from refined specification - translates WHAT to HOW
---

# Plan - Technical Implementation Planning Command

Create technical plan from specification, defining HOW to build what's been specified.

## Usage

```bash
/plan <issue-id>          # Create technical plan for refined issue
```

## Overview

This command uses the `technical-planning` skill to:

1. Load issue and verify Specification exists
2. Create Technical Plan (architecture, patterns, phases)
3. Append Technical Plan to issue
4. Review the plan against the Specification from a **fresh context** (dispatched subagent)
5. Offer to chain to `/breakdown` once a human takes the gate decision

## How It Works

### Step 1: Verify Prerequisites

```bash
# Load issue
issue = mcp__linear-server__get_issue(id)

# Verify Specification exists
if "## Specification" not in issue.description:
    ERROR: Run `/adlc:refine <issue-id>` first
    STOP

# Check if plan already exists
if "## Technical Plan" in issue.description:
    WARNING: Technical Plan already exists
    ASK: Replace or cancel?
```

### Step 2: Run Technical-Planning Skill

```bash
Skill(adlc:technical-planning)
```

The skill handles:

- Analyzing codebase for patterns
- Researching technology options
- Designing architecture
- Defining data models and APIs
- Planning testing strategy (each vertical slice verified end-to-end)
- Describing the implementation approach (vertical, e2e-verified slices — NOT a detailed breakdown; that is `/breakdown`'s job)
- Documenting patterns
- Writing Technical Plan to issue
- Self-checking the plan against the spec for signal loss (every requirement survives WHAT→HOW)

### Step 3: Independent Divergence Review (Fresh Context)

This session wrote the plan, so it cannot audit it — the authoring context shares the blind
spots that produced the gaps and will rationalise them. Dispatch a subagent:

```python
Agent(
    subagent_type="general-purpose",
    prompt=f"Review the Technical Plan of {issue_id} against its Specification. "
           f"Follow Skill(adlc:reviewing-divergence) in mode `plan`. Read the issue from "
           f"the PM system yourself; post the divergence report to the issue and return it."
)
```

**Pass the issue ID and mode only — never a summary of the plan.** The summary is where the
divergence hides; the reviewer must read the artifact cold.

The subagent posts a severity-ranked report to the issue and returns PASS / PASS WITH DECISIONS /
RETURN TO PLAN. Skip the dispatch only when this session did **not** author the plan (an
inherited one) — then run the skill inline.

### Step 4: Present the Gate

Surface the recommendation and let the **human** decide — do not chain on your own PASS:

```markdown
✓ Technical Plan written to issue <ISSUE-ID>
✓ Divergence review (fresh context): ✅ PASS — 0 blockers, 0 decisions · criteria 8/8

Ready to break this down into implementation tasks? Run `/adlc:breakdown <ISSUE-ID>`
```

On blockers, fix the plan here and re-run the review — or return to `/adlc:refine` when the gap
is in the Specification rather than the design:

```markdown
🔴 RETURN TO PLAN — 2 blockers, 1 decision (report on <ISSUE-ID>)

B1  AC-4 (>100k rows rejected) has no mechanism in the plan
B2  AC-6 (audit trail) is narrowed to logging, which is not queryable
D1  A caching layer no acceptance criterion asks for
```

**If the human passes the gate, chain to `/adlc:breakdown`**

## Error Handling

### No PM System

```markdown
ERROR: No project management system configured
Set up Linear or JIRA MCP server first.
```

### Missing Specification

```markdown
ERROR: Issue missing Specification section

Run `/adlc:refine <issue-id>` first to create specification (WHAT to build).
Then run `/adlc:plan <issue-id>` to create technical plan (HOW to build it).
```

### Plan Already Exists

```markdown
WARNING: Issue already has Technical Plan

Options:
1. Replace (destructive)
2. Update/extend (preserves content)
3. Cancel (keep existing)
```

## Examples

### Example: Create Plan

```bash
/plan AUTH-123
```

Output:

```
Loaded AUTH-123: "User authentication"
✓ Specification found

Using technical-planning skill...

✓ Technical Plan written
  - 4 components defined
  - 3 API endpoints specified
  - Implementation approach: vertical slices (register → login → profile → …), each verified end-to-end
    (detailed phase breakdown happens in /breakdown)

Ready to break down into tasks?
```

### Example: Missing Spec

```bash
/plan FEAT-45
```

Output:

```
Loaded FEAT-45: "Notifications"
✗ Specification missing

ERROR: Run `/adlc:refine FEAT-45` first
```

## Integration

**Requires:**

- Linear/JIRA MCP configured
- Issue with Specification section
- `technical-planning` and `reviewing-divergence` skills

**Chains to:**

- `/adlc:breakdown` (optional)

## Remember

- Use `technical-planning` skill for all planning work
- Requires Specification (from `/adlc:refine`)
- Creates Technical Plan (HOW)
- All in PM system (no separate files)
- Never review your own plan — dispatch the fresh-context subagent; the human takes the gate
- Offer `/adlc:breakdown` but don't force
