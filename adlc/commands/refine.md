---
description: Refine feature ideas into specifications focusing on WHAT to build not HOW
---

# Refine - Issue Refinement Command

Transform rough ideas into validated specifications (WHAT to build), ready for technical planning.

## Usage

```bash
/refine <issue-id>          # Refine existing Linear/JIRA issue
/refine <free text>         # Create new issue and refine it
```

## Overview

This command uses the `refining-issues` skill to:

1. Load or create issue in Linear/JIRA
2. Ask questions about user needs (WHAT, not HOW)
3. Explore expected behaviors and edge cases
4. Present specification for validation
5. Write specification to issue
6. Offer to chain to `/plan`

**Focus:** Requirements, behaviors, success criteria (NOT technology or architecture)

## How It Works

### Step 1: Load or Create Issue

**Existing issue:**

```bash
issue = mcp__linear-server__get_issue(id)
```

**New issue from text:**

```bash
# Determine team (from CLAUDE.md or ask user)
# Create issue with description
issue = mcp__linear-server__create_issue(title, description, team)
```

### Step 2: Run Refining-Issues Skill

```bash
Skill(adlc:refining-issues)
```

The skill handles:

- Understanding user needs
- Exploring behaviors and edge cases
- Presenting specification
- Writing to issue with "Specification" section

### Step 3: Offer Next Step

```markdown
✓ Specification written to issue <ISSUE-ID>

Ready to create technical plan? Run `/adlc:plan <ISSUE-ID>`
```

**If user agrees, chain to `/adlc:plan`**

## Error Handling

### No PM System

```markdown
ERROR: No project management system configured

Install Linear or JIRA MCP server:
- Linear: https://github.com/modelcontextprotocol/servers/tree/main/src/linear
- Configure API key in Claude Code settings
- Restart Claude Code
```

### Issue Not Found

```markdown
ERROR: Issue <ISSUE-ID> not found

Check issue ID format:
- Linear: TEAM-123
- JIRA: PROJECT-456

Or create new: `/refine "your feature description"`
```

## Integration

**Requires:**

- Linear/JIRA MCP configured
- `refining-issues` skill

**Chains to:**

- `/adlc:plan` (optional)

## Remember

- Use `refining-issues` skill for all refinement work
- Focus on WHAT not HOW
- Specification drives tests later
- Chain to `/adlc:plan` (not `/adlc:breakdown`)
- All in PM system (no separate files)
