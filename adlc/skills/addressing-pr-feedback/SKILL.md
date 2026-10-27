---
name: addressing-pr-feedback
description: Process PR review comments, create sub-issues - prepares feedback for execution without implementing fixes
---

# Addressing PR Feedback

## Overview

Processes GitHub PR review feedback by categorizing comments and creating trackable sub-issues. Returns parent issue ID for execution.

**Core principle:** Categorize feedback → Create sub-issues → Return for execution.

**Announce at start:** "I'm using the addressing-pr-feedback skill to process PR review feedback."

## The Process

### Step 1: Verify Branch

**Get PR branch name and check out if needed:**

```bash
pr_branch=$(gh pr view $PR_NUMBER --json headRefName --jq '.headRefName')
current_branch=$(git branch --show-current)

if [[ "$current_branch" != "$pr_branch" ]]; then
    git checkout "$pr_branch"
    echo "✓ Switched to branch: $pr_branch"
fi
```

### Step 2: Fetch PR Review Comments

**Get all comments from GitHub:**

```bash
# Review comments (inline code comments)
review_comments=$(gh api repos/{owner}/{repo}/pulls/{pr}/comments)

# General PR comments
pr_comments=$(gh api repos/{owner}/{repo}/issues/{pr}/comments)

# Review summaries
reviews=$(gh pr view {pr} --json reviews)
```

### Step 3: Categorize Feedback

**Analyze and categorize:**

```python
categories = {
    'critical': [],    # Security, bugs, breaking changes
    'important': [],   # Architecture, design issues
    'minor': [],       # Style, naming, docs
    'questions': [],   # Need answers
    'suggestions': []  # Optional improvements
}
```

**Present:**

```markdown
Found 10 review comments:

Critical (2):
- SQL injection vulnerability
- Race condition in auth

Important (3):
- Missing error handling
- Architecture refactoring needed
- N+1 query issue

Minor (5):
- Style inconsistencies
... (abbreviated)
```

### Step 4: Answer Questions

For each question, investigate and draft response, then ask user for approval to post.

### Step 5: Find Existing Parent Issue

**CRITICAL: Extract parent issue from PR (added by /adlc:pr):**

```bash
# Get PR body to find parent issue reference
# The creating-pull-requests skill MUST add this reference
pr_body=$(gh pr view $PR_NUMBER --json body --jq '.body')

# Search for issue references (TEAM-123, Closes TEAM-123, etc.)
parent_issue_id=$(echo "$pr_body" | grep -oE '(Closes|Implements|Fixes) [A-Z]+-[0-9]+' | grep -oE '[A-Z]+-[0-9]+' | head -1)

# Fallback: check commits
if [[ -z "$parent_issue_id" ]]; then
    commits=$(gh pr view $PR_NUMBER --json commits --jq '.commits[].messageHeadline')
    parent_issue_id=$(echo "$commits" | grep -oE '[A-Z]+-[0-9]+' | head -1)
fi

if [[ -z "$parent_issue_id" ]]; then
    ERROR: "Cannot find parent issue reference in PR"
    SUGGEST: "PR should reference the original issue"
    SUGGEST: "This is added automatically by /adlc:pr"
    STOP
fi
```

**Verify parent issue exists:**

```bash
parent = get_issue(parent_issue_id)

if not parent:
    ERROR: "Parent issue $parent_issue_id not found in PM system"
    STOP

echo "✓ Found parent issue: $parent_issue_id - ${parent.title}"
```

### Step 6: Create Additional Sub-Issues

**REQUIRED SUB-SKILL:** Use `adlc:creating-tickets` for the classification (each sub-issue still
needs exactly ONE `feature`/`chore`/`bug` label so execution routes correctly) and create-issue
mechanics. This step adds only the PR-feedback-specific metadata on top: parent link, severity
priority, and the `pr-feedback` + category labels.

**Add new sub-issues to existing parent:**

```python
for item in critical + important + minor:
    sub_issue = create_issue({
        'title': f"[PR Feedback] {category}: {description}",
        'description': format_description(item),  # use the creating-tickets template
        'parent': parent_issue_id,  # Add to EXISTING parent
        'priority': map_severity(item.category),
        'labels': classify(item) + ['pr-feedback', item.category]  # feature/chore/bug + PR metadata
    })
```

**Update parent issue with feedback summary:**

```python
# Append feedback section to parent description
feedback_section = f"""

---

## PR Feedback ({timestamp})

Processed {count} review comments from PR #{pr}

**Critical:** {critical_count}
**Important:** {important_count}
**Minor:** {minor_count}

New sub-issues created:
{list_sub_issue_ids}
"""

update_issue({
    'id': parent_issue_id,
    'description': parent.description + feedback_section
})
```

### Step 7: Return to Command

Return parent issue ID for execution:

```markdown
PARENT_ISSUE_ID: {parent_id}  # Existing parent, not new
SUB_ISSUES_ADDED: {count}
WORKTREE_PATH: {path}
READY: true
```

## Remember

- This skill is PREPARATION only
- Does NOT implement fixes (that's `/adlc:execute`)
- Switches to correct worktree
- Creates sub-issues in PM system
- Returns parent ID for command to execute
