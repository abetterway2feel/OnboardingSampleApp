---
name: updating-pm-status
description: Update PM system (Linear/JIRA) with task status changes and lifecycle comments
when_to_use: when task status changes during execution (start, PR created, CI status, merged)
version: 1.0.0
---

# Updating PM Status

## Overview

Keep PM system (Linear/JIRA) synchronized with task lifecycle events, providing real-time visibility into execution progress.

**Core principle:** PM system is source of truth for task status.

**Called by:** execution-orchestration and executing-tasks skills.

## Status Mapping

| Event | Linear Status | JIRA Status | Comment |
|-------|---------------|-------------|---------|
| Task dispatched | In Progress | In Progress | Task started |
| PR created | In Review | In Review | PR link |
| CI running | In Review | In Review | CI started |
| CI passed | In Review | In Review | CI passed |
| CI failed | Blocked | Blocked | CI failure details |
| Review requested | In Review | In Review | Review requested |
| Changes requested | In Progress | In Progress | Review feedback |
| Review approved | In Review | In Review | Review approved |
| PR merged | Done | Done | Completion summary |

## Event Handlers

### Task Started

```python
def on_task_started(task_id: str, context: dict):
    """Called when task execution begins."""

    # Update status
    # Linear:
    mcp__linear-server__update_issue(
        id=task_id,
        state='In Progress'
    )

    # Add comment
    mcp__linear-server__create_comment(
        issueId=task_id,
        body=f"""🚀 **Task Started**

**Executor:** {context.get('executor_id', 'local')}
**Branch:** `{context.get('task_branch', 'unknown')}`
**Worktree:** `{context.get('worktree_path', 'unknown')}`

Started at: {datetime.utcnow().isoformat()}
"""
    )
```

### PR Created

```python
def on_pr_created(task_id: str, pr_number: int, pr_url: str, context: dict):
    """Called when task PR is created."""

    # Update status to In Review
    # Linear:
    mcp__linear-server__update_issue(
        id=task_id,
        state='In Review'
    )

    # Add comment with PR link
    mcp__linear-server__create_comment(
        issueId=task_id,
        body=f"""📝 **Pull Request Created**

**PR:** [#{pr_number}]({pr_url})
**Branch:** `{context.get('task_branch')}` → `{context.get('feature_branch')}`

Awaiting CI checks and review.
"""
    )
```

### CI Status Update

```python
def on_ci_status_change(task_id: str, pr_number: int, status: str, details: dict):
    """Called when CI status changes."""

    if status == 'failed':
        # Update status to Blocked
        mcp__linear-server__update_issue(
            id=task_id,
            state='Blocked'
        )

        # Add failure comment
        mcp__linear-server__create_comment(
            issueId=task_id,
            body=f"""❌ **CI Checks Failed**

**PR:** #{pr_number}
**Failed Checks:**
{format_failed_checks(details.get('failed_checks', []))}

Manual intervention may be required.
"""
        )

    elif status == 'passed':
        # Add success comment (status stays In Review)
        mcp__linear-server__create_comment(
            issueId=task_id,
            body=f"""✅ **CI Checks Passed**

**PR:** #{pr_number}
All {details.get('check_count', 'N')} checks passed.
"""
        )
```

### Review Status Update

```python
def on_review_status_change(task_id: str, pr_number: int, status: str, reviewer: str):
    """Called when review status changes."""

    if status == 'changes_requested':
        # Update status to In Progress (needs work)
        mcp__linear-server__update_issue(
            id=task_id,
            state='In Progress'
        )

        mcp__linear-server__create_comment(
            issueId=task_id,
            body=f"""🔄 **Changes Requested**

**PR:** #{pr_number}
**Reviewer:** @{reviewer}

Address review feedback before proceeding.
"""
        )

    elif status == 'approved':
        mcp__linear-server__create_comment(
            issueId=task_id,
            body=f"""✅ **Review Approved**

**PR:** #{pr_number}
**Reviewer:** @{reviewer}

Ready to merge.
"""
        )
```

### PR Merged

```python
def on_pr_merged(task_id: str, pr_number: int, merge_sha: str, context: dict):
    """Called when PR is merged."""

    # Update status to Done
    # Linear:
    mcp__linear-server__update_issue(
        id=task_id,
        state='Done'
    )

    # Add completion comment
    mcp__linear-server__create_comment(
        issueId=task_id,
        body=f"""✅ **Task Complete**

**PR:** #{pr_number} (merged)
**Commit:** `{merge_sha[:8]}`
**Strategy:** {context.get('merge_strategy', 'squash')}

**Summary:**
{context.get('summary', 'Implementation complete.')}

**Files Changed:** {context.get('files_changed', 'N/A')}
**Tests:** {context.get('test_summary', 'N/A')}

🤖 Completed by ADLC orchestrator
"""
    )
```

## Utility Functions

### Format Failed Checks

```python
def format_failed_checks(checks: list) -> str:
    """Format failed CI checks for comment."""
    if not checks:
        return "- No details available"

    lines = []
    for check in checks:
        lines.append(f"- **{check['name']}**: {check.get('conclusion', 'failed')}")
        if check.get('details_url'):
            lines.append(f"  [View details]({check['details_url']})")
    return '\n'.join(lines)
```

### Retry on API Failure

```python
def update_with_retry(update_fn, max_retries=3, delay=2):
    """Retry PM API calls on failure."""
    for attempt in range(max_retries):
        try:
            return update_fn()
        except Exception as e:
            if attempt < max_retries - 1:
                print(f"PM API call failed (attempt {attempt + 1}): {e}")
                time.sleep(delay * (attempt + 1))
            else:
                print(f"PM API call failed after {max_retries} attempts: {e}")
                raise
```

## Integration Points

**Update status at these points in execution:**

1. **Step 3.1** (Task Branch Setup): Call `on_task_started`
2. **Step 3.2** (PR Created): Call `on_pr_created`
3. **Step 3.3** (PR Monitoring): Call `on_ci_status_change`, `on_review_status_change`
4. **Step 3.4** (PR Merged): Call `on_pr_merged`

**Example integration in execution:**

```python
# After creating task branch
Skill('adlc:updating-pm-status').on_task_started(task_id, {
    'executor_id': executor_state.id,
    'task_branch': task_branch,
    'worktree_path': task_worktree_path
})

# After creating PR
Skill('adlc:updating-pm-status').on_pr_created(task_id, pr_number, pr_url, {
    'task_branch': task_branch,
    'feature_branch': feature_branch
})

# After merge
Skill('adlc:updating-pm-status').on_pr_merged(task_id, pr_number, merge_sha, {
    'merge_strategy': config.merge.strategy,
    'summary': task_completion_summary,
    'files_changed': len(changed_files),
    'test_summary': test_results
})
```

## Configuration

```yaml
pm_status:
  # Enable/disable status updates
  enabled: true

  # Update frequency throttling (seconds)
  min_update_interval: 5

  # Retry configuration
  retry:
    max_attempts: 3
    initial_delay: 2
    backoff_multiplier: 2

  # Comment verbosity
  comments:
    on_start: true
    on_pr_created: true
    on_ci_status: true  # Only on failure by default
    on_review: true
    on_merge: true
```

## Remember

- PM system is source of truth for team visibility
- Update status immediately on state changes
- Always include PR links in comments
- Log CI failures with actionable details
- Retry on API failures (network issues common)
- Keep comments concise but informative
