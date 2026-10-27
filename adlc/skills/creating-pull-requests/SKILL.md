---
name: creating-pull-requests
description: Create pull requests with human-readable descriptions, diagrams, and visual documentation - automatically detects PR templates and generates comprehensive PR content
---

# Creating Pull Requests

## Overview

Creates pull requests with clear, human-readable descriptions that communicate what was implemented. Uses diagrams and visuals to explain complex changes.

**Core principle:** Clear communication + visual aids = easy code review.

**Announce at start:** "I'm using the creating-pull-requests skill to create a pull request."

## Process

### Step 1: Gather Context

**Check current branch and commits:**

```bash
# Get current branch
CURRENT_BRANCH=$(git branch --show-current)

# Get default branch (main/master)
DEFAULT_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@')

# Get commits on this branch not in default
git log $DEFAULT_BRANCH..HEAD --oneline
```

**Get diff statistics:**

```bash
# Overall statistics
git diff $DEFAULT_BRANCH...HEAD --stat

# Files changed
git diff $DEFAULT_BRANCH...HEAD --name-status
```

**Load PM system context (REQUIRED):**

```bash
# Extract issue IDs from branch name or commits
# Format: feature/TEAM-123-description or commits with [TEAM-123]
issue_id=$(git log --format=%s | grep -oE '[A-Z]+-[0-9]+' | head -1)

if [[ -z "$issue_id" ]]; then
    # Check branch name
    issue_id=$(git branch --show-current | grep -oE '[A-Z]+-[0-9]+')
fi

if [[ -z "$issue_id" ]]; then
    WARNING: "No parent issue found in commits or branch name"
    SUGGEST: "Include issue reference in commit messages"
    # Continue without PM context
else
    # Fetch parent issue
    parent = get_issue(issue_id)

    echo "✓ Found parent issue: $issue_id - ${parent.title}"

    # This parent issue will be used for feedback tracking
    PARENT_ISSUE_ID = issue_id
fi
```

**CRITICAL: Ensure parent issue is in PR description:**

The PR description MUST include a clear reference to the parent issue:

```markdown
## Related Issues

Implements {PARENT_ISSUE_ID}
Closes {PARENT_ISSUE_ID}

<!-- The parent issue ID is critical for /adlc:address-feedback -->
<!-- Feedback will be added as sub-issues to this parent -->
```

### Step 2: Check for PR Template

**Search for PR template in standard locations:**

```bash
# Check .github directory
if [ -f .github/pull_request_template.md ]; then
    TEMPLATE=".github/pull_request_template.md"
elif [ -f .github/PULL_REQUEST_TEMPLATE.md ]; then
    TEMPLATE=".github/PULL_REQUEST_TEMPLATE.md"
elif [ -f .github/PULL_REQUEST_TEMPLATE/pull_request_template.md ]; then
    TEMPLATE=".github/PULL_REQUEST_TEMPLATE/pull_request_template.md"
# Check docs directory
elif [ -f docs/pull_request_template.md ]; then
    TEMPLATE="docs/pull_request_template.md"
# Check root
elif [ -f pull_request_template.md ]; then
    TEMPLATE="pull_request_template.md"
else
    TEMPLATE="default"  # Use built-in template
fi
```

**For detailed template handling examples, see [resources/template-examples.md](resources/template-examples.md)**

### Step 3: Analyze Changes

**Categorize changes by type:**

```python
changes = {
    'features': [],      # New functionality
    'fixes': [],         # Bug fixes
    'refactors': [],     # Code improvements
    'tests': [],         # Test additions/changes
    'docs': [],          # Documentation changes
    'chores': []         # Build, config, dependencies
}

# Analyze commit messages and diffs
for commit in commits:
    category = categorize_commit(commit)
    changes[category].append(commit)

# Analyze file changes
for file in changed_files:
    if is_test_file(file):
        changes['tests'].append(file)
    elif is_doc_file(file):
        changes['docs'].append(file)
    # ... etc
```

**Identify key changes:**

- New files created
- Major refactorings
- API changes
- Database migrations
- Configuration changes
- Breaking changes

### Step 4: Generate PR Description

**Use custom template if found, otherwise use default structure with these key sections:**

- **Summary** - 1-2 paragraph overview (what and why)
- **What Changed** - Features, fixes, technical changes
- **Visual Overview** - Diagrams (see Step 5)
- **Implementation Details** - Key files, dependencies, breaking changes
- **Testing** - Coverage, strategy, manual checklist
- **Related Issues** - Link with "Closes", "Fixes", "Implements"
- **Claude Code attribution** - Footer

**For complete default template structure, see [resources/default-template.md](resources/default-template.md)**
**For example PRs, see [resources/pr-examples.md](resources/pr-examples.md)**

### Step 5: Generate Diagrams

**When to include diagrams:**

- **Architecture changes** - Show new components and relationships
- **Complex workflows** - Illustrate multi-step processes
- **Data model changes** - Show schema relationships
- **State machines** - Depict state transitions
- **Integration points** - Show how systems connect

**For complete diagram examples and guidance, see [resources/diagram-guide.md](resources/diagram-guide.md)**

**Quick diagram decision matrix:**

| Situation | Diagram Type |
|-----------|--------------|
| New services or modules | Architecture (graph) |
| API workflows | Sequence |
| Data model changes | Class/ERD |
| Status workflows | State |
| Decision logic | Flowchart |

### Step 6: Add Context from PM System

If issue information available:

```markdown
## Context from {PM-SYSTEM}

**Issue:** {TEAM-123}: {Issue Title}
**Issue URL:** {linear_url}

### User Story
{User story from specification}

### Success Criteria
{Success criteria from specification}

### Technical Approach
{High-level approach from technical plan}
```

### Step 6.5: Estimate Claude Spend (optional)

If `pr.include_spend: true` in `.claude/adlc.local.md`, append an estimate of the Claude Code
token spend that produced this branch. Skipped silently otherwise (including when the usage
plugin, which owns the analyser, isn't installed).

```bash
# Canonical analyser lives in the usage plugin (single source of pricing); skip if absent
USAGE_SCRIPT=$(find ~/.claude/plugins -path '*/usage/skills/usage-analysis/scripts/analyze_usage.py' 2>/dev/null | head -1)
SINCE=$(git log --reverse --format=%cI "$DEFAULT_BRANCH..HEAD" | head -1)
if [ -n "$USAGE_SCRIPT" ]; then
    SPEND=$(uv run --script "$USAGE_SCRIPT" --format md --cwd-prefix "$(git rev-parse --show-toplevel)" \
            --since "$SINCE" --scope-label "this branch")
    # Append only when non-empty (empty => no attributable spend)
    [ -n "$SPEND" ] && PR_DESCRIPTION="${PR_DESCRIPTION}

${SPEND}"
fi
```

**See [resources/spend-estimate.md](resources/spend-estimate.md)** for the opt-in gate,
`spend_basis` handling, and how the feature-PR rollup sweeps phase worktrees.

### Step 7: Create PR

**Push branch if not already pushed:**

```bash
# Check if branch exists on remote
if ! git ls-remote --exit-code --heads origin $CURRENT_BRANCH; then
    git push -u origin $CURRENT_BRANCH
fi
```

**Create PR using gh CLI:**

```bash
# Create PR with generated description
gh pr create \
    --title "$PR_TITLE" \
    --body "$PR_DESCRIPTION" \
    --base "$DEFAULT_BRANCH" \
    --head "$CURRENT_BRANCH"
```

**Add labels if applicable:**

```bash
# Add labels based on change types
if [[ ${#changes[features]} -gt 0 ]]; then
    gh pr edit --add-label "feature"
fi
if [[ ${#changes[fixes]} -gt 0 ]]; then
    gh pr edit --add-label "bug"
fi
```

### Step 8: Report Success

```markdown
✅ Pull request created!

**PR URL:** {pr_url}
**Title:** {pr_title}
**Base:** {default_branch} ← {current_branch}

**Summary:**
- {N} files changed
- {N} insertions, {N} deletions
- {N} commits included

**Next steps:**
1. Review the PR description and edit if needed
2. Request reviewers: `gh pr edit {pr_number} --add-reviewer @username`
3. Add to project: `gh pr edit {pr_number} --add-project "Project Name"`
```

### Step 9: Drive the PR to Done

Opening the PR is the start, not the finish — hand off to drive it to done.

**REQUIRED:** Spawn a fresh subagent that loads `adlc:babysitting-prs` — do not run the loop in
this session, which would drag its whole prefix through every poll.

**Use the spawn brief in [`adlc:babysitting-prs`](../babysitting-prs/SKILL.md#spawning-this-skill-the-canonical-brief)
verbatim.** It is the single source: `subagent_type="general-purpose"`, `model="sonnet"`,
`run_in_background=true`, and a prompt carrying the PR number, branch, worktree, resolved context
budget, cycle limit and the "no spawning / never auto-merge" limits. Do not write your own variant
here — turn caps and tool limits cannot be passed to `Agent`, so the brief's wording *is* the
guardrail.

Skip the handoff only for a `--draft` PR (nothing to drive yet) or when the caller explicitly
opts out. Report that the PR is *open and being driven to done*, then end your turn — do not
wait on the agent.

## PR Title Format

**Format:** `[Type]: Brief description of change`

**Types:**

- `feat` - New feature
- `fix` - Bug fix
- `refactor` - Code refactoring
- `chore` - Maintenance/tooling
- `docs` - Documentation only
- `test` - Test additions/changes
- `perf` - Performance improvement

**Examples:**

- `feat: Add user authentication system`
- `fix: Resolve race condition in token refresh`
- `refactor: Extract auth logic to service layer`
- `chore: Update dependencies and CI config`

## Error Handling

### Quick Error Reference

| Error | Resolution |
|-------|-----------|
| No commits to PR | Make changes and commit first |
| Branch already has PR | Update existing PR or cancel |
| GitHub CLI not authenticated | Run `gh auth login` |
| Branch not on remote | Push with `-u origin` |
| No parent issue | Include issue ID in commit or branch |

**For detailed error scenarios and recovery strategies, see [resources/error-scenarios.md](resources/error-scenarios.md)**

## Quick Reference

| Situation | Action |
|-----------|--------|
| Has custom template | Parse and fill template (see template examples) |
| No template | Use default comprehensive template |
| Complex changes | Generate architecture diagram |
| Workflow changes | Generate sequence diagram |
| Data model changes | Generate class/ERD diagram |
| UI changes | Request screenshots |
| API changes | Include example requests |

## Common Mistakes to Avoid

**Too brief description**

- **Problem:** Reviewers don't understand context
- **Fix:** Include "what" and "why" with sufficient detail

**No visual aids**

- **Problem:** Complex changes hard to understand
- **Fix:** Always add diagrams for non-trivial changes

**Missing context**

- **Problem:** Changes seem arbitrary
- **Fix:** Link to issues, explain decision rationale

**Not using template**

- **Problem:** Inconsistent PR format
- **Fix:** Always check for and use project template

## Red Flags

**Never:**

- Create PR with empty description
- Skip diagram for complex architectural changes
- Forget to link related issues
- Create PR without pushing branch first
- Ignore project's PR template

**Always:**

- Check for custom PR template first
- Generate diagrams for complex changes
- Include testing information
- Link to PM system issues if available
- Make description human-readable and scannable
- Highlight breaking changes prominently

## Integration

**Called by:**

- `/adlc:pr` command - Direct PR creation
- `/adlc:execute` - At end of execution workflow (with confirmation)

**Pairs with:**

- **execution** - Creates work that needs PR
- **addressing-pr-feedback** - Processes feedback on created PR

## Additional Resources

- **[Diagram Guide](resources/diagram-guide.md)** - Complete Mermaid diagram examples and when to use each type
- **[Template Examples](resources/template-examples.md)** - How to handle custom PR templates with detailed examples
- **[PR Examples](resources/pr-examples.md)** - Complete example PRs for different scenarios
- **[Error Scenarios](resources/error-scenarios.md)** - Detailed error handling and recovery strategies
