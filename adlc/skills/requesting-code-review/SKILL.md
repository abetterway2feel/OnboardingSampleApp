---
name: requesting-code-review
description: Use when completing tasks, implementing major features, or before merging to verify work meets requirements - dispatches code-reviewer subagent to review implementation against plan or requirements before proceeding
---

# Requesting Code Review

Dispatch code-reviewer subagent to catch issues before they cascade.

**Core principle:** Review early, review often.

## When to Request Review

**Mandatory:**

- After each task in subagent-driven development
- After completing major feature
- Before merge to main

**Optional but valuable:**

- When stuck (fresh perspective)
- Before refactoring (baseline check)
- After fixing complex bug

## How to Request

**1. Get git SHAs:**

```bash
BASE_SHA=$(git rev-parse HEAD~1)  # or origin/main
HEAD_SHA=$(git rev-parse HEAD)
```

**2. Dispatch code-reviewer subagent:**

Use the Agent tool with code-reviewer type, fill template at `code-reviewer.md`

**Placeholders:**

- `{WHAT_WAS_IMPLEMENTED}` - What you just built
- `{PLAN_OR_REQUIREMENTS}` - What it should do
- `{BASE_SHA}` - Starting commit
- `{HEAD_SHA}` - Ending commit
- `{DESCRIPTION}` - Brief summary

**3. Act on feedback:**

- Fix Critical issues immediately
- Fix Important issues before proceeding
- Note Minor issues for later
- Push back if reviewer is wrong (with reasoning)

## Specialist Review Depth

The single `code-reviewer` dispatch above already covers specialist depth — you do not dispatch
anything extra. It always does a baseline security and performance pass, and deepens that lens
itself by reading and applying a specialist skill in its own context when the change warrants it:

- **Security-sensitive change** (auth, authorization, input handling, secrets, crypto, external boundary) → `adlc:reviewing-security`
- **Performance-sensitive change** (hot paths, bulk operations, database access, reported latency/memory) → `adlc:reviewing-performance`
- **Otherwise** → baseline pass only; no escalation.

The reviewer folds these findings into one coherent report (no extra Opus dispatch — `code-reviewer`
has no Agent tool). Either skill can also be invoked standalone when you want a focused security or
performance pass on a change.

## Example

```
[Just completed Task 2: Add verification function]

You: Let me request code review before proceeding.

BASE_SHA=$(git log --oneline | grep "Task 1" | head -1 | awk '{print $1}')
HEAD_SHA=$(git rev-parse HEAD)

[Dispatch code-reviewer subagent]
  WHAT_WAS_IMPLEMENTED: Verification and repair functions for conversation index
  PLAN_OR_REQUIREMENTS: Task 2 from docs/plans/deployment-plan.md
  BASE_SHA: a7981ec
  HEAD_SHA: 3df7661
  DESCRIPTION: Added verifyIndex() and repairIndex() with 4 issue types

[Subagent returns]:
  Strengths: Clean architecture, real tests
  Issues:
    Important: Missing progress indicators
    Minor: Magic number (100) for reporting interval
  Assessment: Ready to proceed

You: [Fix progress indicators]
[Continue to Task 3]
```

## Integration with Workflows

**Subagent-Driven Development:**

- Review after EACH task
- Catch issues before they compound
- Fix before moving to next task

**Executing Plans:**

- Review after each batch (3 tasks)
- Get feedback, apply, continue

**Ad-Hoc Development:**

- Review before merge
- Review when stuck

## Red Flags

**Do nothing wrong:**

- Skip no review because "it's simple"
- Ignore no Critical issues
- Proceed with no unfixed Important issues
- Argue with no valid technical feedback

**If reviewer wrong:**

- Push back with technical reasoning
- Show code/tests that prove it works
- Request clarification

See template at: requesting-code-review/code-reviewer.md
