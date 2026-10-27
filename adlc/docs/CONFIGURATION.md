# ADLC Configuration Reference

## Overview

ADLC configuration is stored in `.claude/adlc.local.md` using YAML frontmatter.

## Configuration File

```yaml
---
# .claude/adlc.local.md

# Project Management Integration
pm_system: linear  # linear, jira, github
team: "AI-First Engineering"
project: null  # Optional project filter

# Execution Settings
execution:
  strategy: team    # team | sequential (default: team)
  max_concurrent_executors: 3
  retry_attempts: 3
  retry_delay_seconds: 30

# Pull Request Settings
pr:
  include_spend: false           # append an estimated Claude spend block to PR bodies
  spend_basis: excl_cache_reads  # excl_cache_reads (default) | incl_cache_reads (upper bound)

# Agent Teams Settings
agent_teams:
  teammate_model: sonnet    # Model for teammates
  max_teammates: 4          # Max parallel teammates per phase
  pattern_broadcast: true   # Teammates share discoveries via messaging

# Worktree Settings
worktrees:
  base_path: ~/worktrees
  cleanup_after_merge: true
  max_age_days: 7

# Conductor Settings
conductor:
  poll_interval_seconds: 60
  max_queue_size: 50
  priority_boost_after_hours: 24

# Notifications
notifications:
  enabled: true
  channels:
    linear: true
    slack: false
    github: true

# Lesson Extraction
lessons:
  enabled: true
  file: CLAUDE-lessons.md
  min_confidence: medium
  categories:
    - error_patterns
    - code_review
    - architecture
    - performance
    - testing

# Cleanup
cleanup:
  auto_cleanup: true
  archive_before_delete: true
  max_age:
    worktrees: 7
    state_files: 30
    archives: 90

# Stale Detection
stale_detection:
  enabled: true
  stale_days:
    branches: 7
    worktrees: 7
  stale_hours:
    executors: 48
    queue: 24
---

# ADLC Local Configuration

Additional notes and context for this repository.
```

## Configuration Sections

### PM System Integration

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `pm_system` | string | `linear` | Project management system (linear, jira, github) |
| `team` | string | required | Team name or ID |
| `project` | string | null | Optional project filter |

### Execution Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `execution.strategy` | string | `team` | Phase execution strategy (team, sequential); falls back to sequential when Agent Teams aren't available |
| `execution.max_concurrent_executors` | int | 3 | Max parallel executors |
| `execution.retry_attempts` | int | 3 | Retry attempts per task |
| `execution.retry_delay_seconds` | int | 30 | Delay between retries |

### Pull Request Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `pr.include_spend` | bool | false | Append an estimated Claude token-spend block to PR bodies (list price, deduped by `message.id`) |
| `pr.spend_basis` | string | `excl_cache_reads` | Cost basis for the estimate: `excl_cache_reads` (panel-realistic) or `incl_cache_reads` (list-price upper bound) |

### Worktree Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `worktrees.base_path` | string | `~/worktrees` | Base path for worktrees |
| `worktrees.cleanup_after_merge` | bool | true | Auto-cleanup merged worktrees |
| `worktrees.max_age_days` | int | 7 | Max worktree age before stale |

### Agent Teams Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `agent_teams.teammate_model` | string | `sonnet` | Model for team teammates |
| `agent_teams.max_teammates` | int | 4 | Max teammates per phase |
| `agent_teams.pattern_broadcast` | bool | true | Enable pattern sharing between teammates |

**Prerequisites:** `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` environment variable must be set for team strategy. Without it, execution falls back to sequential.

### Conductor Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `conductor.poll_interval_seconds` | int | 60 | Board polling interval |
| `conductor.max_queue_size` | int | 50 | Maximum queue size |
| `conductor.priority_boost_after_hours` | int | 24 | Hours before priority boost |

### Notification Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `notifications.enabled` | bool | true | Enable notifications |
| `notifications.channels.linear` | bool | true | Post to Linear comments |
| `notifications.channels.slack` | bool | false | Post to Slack |
| `notifications.channels.github` | bool | true | Post to GitHub PRs |

### Lesson Extraction Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `lessons.enabled` | bool | true | Enable lesson extraction |
| `lessons.file` | string | `CLAUDE-lessons.md` | Output file |
| `lessons.min_confidence` | string | `medium` | Minimum confidence (low, medium, high) |
| `lessons.categories` | list | all | Categories to extract |

### Cleanup Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `cleanup.auto_cleanup` | bool | true | Auto-cleanup after merge |
| `cleanup.archive_before_delete` | bool | true | Archive before deleting |
| `cleanup.max_age.worktrees` | int | 7 | Max worktree age (days) |
| `cleanup.max_age.state_files` | int | 30 | Max state file age (days) |
| `cleanup.max_age.archives` | int | 90 | Max archive age (days) |

### Stale Detection Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `stale_detection.enabled` | bool | true | Enable stale detection |
| `stale_detection.stale_days.branches` | int | 7 | Branch stale threshold |
| `stale_detection.stale_days.worktrees` | int | 7 | Worktree stale threshold |
| `stale_detection.stale_hours.executors` | int | 48 | Executor sleep threshold |
| `stale_detection.stale_hours.queue` | int | 24 | Queue item threshold |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `CLAUDE_PLUGIN_ROOT` | Plugin installation directory |
| `ADLC_PM_SYSTEM` | Override PM system |
| `ADLC_TEAM` | Override team |
| `ADLC_DEBUG` | Enable debug logging |

## Hooks Configuration

Hooks are configured in `hooks/hooks.json`. See `docs/HOOKS.md` for full documentation.

The plugin uses four hooks: `SessionStart` (command), `SubagentStop` (command via stop-guard.sh), `TeammateIdle` (command via teammate-idle-guard.sh), and `TaskCompleted` (command via verify-guard.sh in taskcompleted mode).

## State File Locations

| File | Location | Purpose |
|------|----------|---------|
| Executor State | `.claude/executor-state/*.json` | Individual executor state |
| Conductor State | `.claude/.adlc_conductor/state.local.yml` | Conductor state |
| Lessons | `CLAUDE-lessons.md` | Extracted lessons |
| Config | `.claude/adlc.local.md` | Local configuration |

## Validation

Configuration is validated on load. Invalid settings trigger warnings:

```
[WARN] Invalid execution.strategy: 'invalid'. Using default: 'team'
[WARN] conductor.poll_interval_seconds must be >= 10. Using: 10
```

## Defaults

If no configuration file exists, ADLC uses sensible defaults:
- Team execution strategy (falls back to sequential without Agent Teams)
- 3 max concurrent executors
- Auto-cleanup enabled
- All notifications enabled
- 7-day stale thresholds
