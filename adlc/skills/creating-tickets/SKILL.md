---
name: creating-tickets
description: Standardized process for creating PM tickets with proper classification (feature/chore/bug) and required metadata
when_to_use: when creating sub-tickets during breakdown planning, or creating any ticket that will be executed through ADLC workflows
version: 1.0.0
---

# Creating Tickets

Standardized process for creating project management tickets with proper classification and metadata.

**Core principle:** Every ticket must be classified as feature, chore, or bug. This classification determines which execution workflow is used.

## Ticket Type Classification

**CRITICAL: All tickets MUST have exactly ONE of these labels:**

### Feature

**Definition:** Any desired behavior change that adds or modifies functionality

**Examples:**

- New API endpoint
- New UI component
- Enhanced validation logic
- Modified business rule
- New integration

**Label:** `feature` or `Feature`

**Execution workflow:** Uses `executing-tasks` skill, feature pathway (TDD required)

### Chore

**Definition:** Maintenance work that doesn't change user-facing behavior

**Examples:**

- Documentation updates
- Scaffolding and project setup
- Refactoring (no behavior change)
- Test coverage improvements
- Dependency upgrades
- Code cleanup and organization
- Configuration changes

**Label:** `chore` or `Chore`

**Execution workflow:** Uses `executing-tasks` skill, chore pathway (no TDD requirement, but full test suite must pass and changes get a lightweight code review)

### Bug

**Definition:** Existing behavior is not working as expected or specified

**Examples:**

- Function returns wrong value
- Error handling missing
- Race condition causing failures
- Performance regression
- Incorrect validation logic

**Label:** `bug` or `Bug`

**Execution workflow:** Uses `executing-tasks` skill, bug pathway (TDD required: reproduce with test first)

## Classification Decision Tree

```
Is this changing user-facing or system behavior?
├─ YES → Is it fixing broken behavior?
│         ├─ YES → BUG
│         └─ NO  → FEATURE
└─ NO  → CHORE
```

**Examples:**

- "Add login endpoint" → FEATURE (new behavior)
- "Fix login endpoint returning 500" → BUG (broken behavior)
- "Refactor login logic to service layer" → CHORE (no behavior change)
- "Document login endpoint" → CHORE (no behavior change)
- "Add tests for login endpoint" → CHORE (improving coverage, no behavior change)

## Required Fields

**All tickets must include:**

1. **Title** - Clear, concise description
2. **Description** - Detailed context (see templates below)
3. **Team** - Team ID or name
4. **Label** - Exactly ONE of: feature, chore, bug
5. **Parent** - Parent ticket ID (for sub-tickets)
6. **State** - Usually "Todo" for new sub-tickets

**Optional but recommended:**

- **Priority** - Only set if explicitly specified
- **Estimate** - Complexity points (if team uses)
- **Assignee** - Usually left unassigned for sub-tickets

## Ticket Description Templates

### Feature Ticket Template

```markdown
## Objective
Implement [Component/Feature] with full TDD workflow (tests first, then implementation).

## Specification Context (WHAT we're building)
From parent ticket Specification section:
- User story: [relevant user story from spec]
- Expected behavior: [relevant behavior from spec]
- Success criteria: [relevant criteria from spec]

## Technical Plan Guidance (HOW to build it)
From parent ticket Technical Plan section:
- Component: [Component name and location]
- Responsibilities: [What this component does]
- Dependencies: [What it depends on]
- Pattern: [Reference to existing code to follow]
- Error handling: [How errors should be handled]

## TDD Implementation Checklist
Follow test-driven-development skill (adlc:test-driven-development):

**RED Phase:**
- [ ] Write test for [behavior 1] - verify it fails
- [ ] Write test for [behavior 2] - verify it fails
- [ ] Write test for [edge case] - verify it fails

**GREEN Phase:**
- [ ] Implement minimal code to pass tests
- [ ] All tests passing

**REFACTOR Phase:**
- [ ] Check for code smells
- [ ] Refactor while keeping tests green
- [ ] Final verification: all tests still passing

## Acceptance Criteria
- [ ] All tests written and passing
- [ ] Follows pattern from [reference file]
- [ ] Error handling implemented per Technical Plan
- [ ] Code reviewed and approved
- [ ] Committed with clear message

## Files to Touch
- Create/Modify: [file paths]
- Reference: [similar code to follow]
```

### Chore Ticket Template

```markdown
## Objective
[Description of maintenance task]

## Context
[Why this chore is needed]

## Approach
[How to accomplish this]

## Verification Checklist
- [ ] Changes implemented
- [ ] All existing tests still pass
- [ ] Lint/format checks pass
- [ ] Build succeeds
- [ ] No regressions introduced

## Acceptance Criteria
- [ ] Task completed as specified
- [ ] No behavioral changes
- [ ] All quality checks passing
- [ ] Committed with clear message

## Files to Touch
- Modify: [file paths]
```

### Bug Ticket Template

```markdown
## Bug Description
[What is broken and how it manifests]

## Expected Behavior
[What should happen]

## Actual Behavior
[What currently happens]

## Root Cause Investigation
[To be filled during execution - see systematic-debugging skill]

## Fix Checklist
Follow systematic-debugging and test-driven-development skills:

**Phase 1: Root Cause Investigation**
- [ ] Reproduce bug consistently
- [ ] Identify root cause
- [ ] Document findings

**Phase 2: Reproduce with Test**
- [ ] Write failing test that reproduces bug
- [ ] Verify test fails for correct reason

**Phase 3: Fix**
- [ ] Implement minimal fix
- [ ] Verify reproducing test now passes
- [ ] Run full test suite (no regressions)

**Phase 4: Review**
- [ ] Code review confirms fix
- [ ] Root cause documented

## Acceptance Criteria
- [ ] Root cause identified and documented
- [ ] Bug reproduced with failing test
- [ ] Fix implemented (minimal change)
- [ ] All tests passing
- [ ] No regressions introduced
- [ ] Code reviewed and approved
```

## Creating Tickets in PM System

**Use PM MCP tools (Linear, JIRA, or other):**

```python
# Example with Linear
ticket = mcp__linear-server__create_issue({
    'title': '[Clear, concise title]',
    'description': '[Use appropriate template above]',
    'team': '[Team name or ID]',
    'parentId': '[Parent ticket ID for sub-tickets]',
    'labels': ['feature' or 'chore' or 'bug'],  # REQUIRED
    'state': 'Todo',
    'priority': '[Only if explicitly specified]'
})

# Example with JIRA
ticket = mcp__jira__create_issue({
    'summary': '[Clear, concise title]',
    'description': '[Use appropriate template above]',
    'project': '[Project key]',
    'parent': '[Parent ticket key for sub-tasks]',
    'issuetype': '[Task/Story/Bug]',
    'labels': ['feature' or 'chore' or 'bug'],  # REQUIRED
})

# Adapt to your PM system's MCP tools
```

## Validation Rules

**Before creating any ticket:**

1. **Classification check:**

   ```python
   if not any(label in ['feature', 'chore', 'bug'] for label in labels):
       ERROR: "Ticket must have feature, chore, or bug label"
       STOP
   ```

2. **Single classification:**

   ```python
   type_labels = [l for l in labels if l in ['feature', 'chore', 'bug']]
   if len(type_labels) > 1:
       ERROR: "Ticket can only have ONE type label"
       STOP
   ```

3. **Template usage:**

   ```python
   if label == 'feature' and 'TDD Implementation Checklist' not in description:
       WARNING: "Feature ticket should include TDD checklist"

   if label == 'bug' and 'Root Cause Investigation' not in description:
       WARNING: "Bug ticket should include investigation checklist"
   ```

## Quick Reference

| Type | Label | TDD Required | Workflow Skill (pathway) | Example |
|------|-------|--------------|----------------|---------|
| **Feature** | `feature` | ✅ Yes | `executing-tasks` (feature pathway) | Add login endpoint |
| **Chore** | `chore` | ❌ No | `executing-tasks` (chore pathway) | Update docs, refactor |
| **Bug** | `bug` | ✅ Yes | `executing-tasks` (bug pathway) | Fix login 500 error |

## Integration with Other Skills

**Used by:**

- `breakdown-planning` - REQUIRED: Creates all sub-tickets using this skill
- `addressing-pr-feedback` - Creates tasks from PR feedback
- Any skill that creates tickets

**Ensures:**

- Consistent ticket structure across all workflows
- Proper classification for routing to the correct executing-tasks pathway
- Required metadata for parallel execution orchestration

## Remember

- **Every ticket needs exactly ONE type label** (feature/chore/bug)
- **Classification determines execution workflow** (tasks/chores/bug-fixes)
- **Use appropriate template** for the ticket type
- **Validate before creating** (labels, parent, team)
- **For sub-tickets:** Always include parent ticket ID
- **For features/bugs:** Always include TDD/investigation checklists
