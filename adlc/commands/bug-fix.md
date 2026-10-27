---
description: Fix bugs systematically using TDD, root cause analysis, and automatic testing
---

# Bug-Fix Command

Standalone entry point for fixing a bug. Thin orchestrator — the workflow lives in
`Skill(adlc:executing-tasks)` (bug pathway).

## Usage

```bash
/adlc:bug-fix <issue-id>      # Fix an existing Linear/JIRA bug
/adlc:bug-fix "<description>"  # Create a bug issue, then fix it
```

## Process

1. **Load or create the bug issue.**
   - Existing: fetch via the PM MCP (`linear-server`/`jira`) and surface title + expected vs actual.
   - From a description: extract what's broken / expected / actual (ask for team + priority if needed) and create the issue via `Skill(adlc:creating-tickets)` with the `bug` label.
2. **Track progress** with TodoWrite (investigate → reproduce → fix → verify → commit).
3. **Fix it** → `Skill(adlc:executing-tasks)` (bug pathway). The skill owns the workflow: root-cause investigation (`systematic-debugging`), reproduce with a failing test (TDD RED), minimal fix (GREEN), per-task review, verification gate, commit with root-cause docs, and PM status update.
4. **Summarise** (issue, root cause, fix, tests, commit) and **offer `/adlc:pr`** to open the PR (which drives it to done via `babysitting-prs`).

## Requirements

- PM MCP (`linear-server` or `jira`); test framework; justfile recommended.

## Error handling

| Error | Response |
|-------|----------|
| No PM MCP | Need Linear/JIRA MCP — or run `/adlc:bug-fix "<description>"` to create the issue inline. |
| Issue not found | Verify the ID/access, or create a new one from a description. |
| Cannot reproduce / architectural flaw | The executing-tasks skill reports it (env/steps, or use `/adlc:refine` + `/adlc:breakdown`). |

## Related

- `Skill(adlc:executing-tasks)` (bug pathway) — the workflow · `systematic-debugging` · `test-driven-development`
- `/adlc:pr` — open the PR · `/adlc:execute <bug-id>` — equivalent standalone route
