# Task Brief Files (file-based context handoff)

Per-task context is handed to Tier 3 agents via a **local brief file**, not by pasting the
full Specification + Technical Plan into every dispatch prompt.

**Why:**
- **Smaller prompts** — everything pasted into a dispatch prompt stays resident in that agent's
  context for its whole run. A pointer + a file read is far cheaper than re-pasting the spec and
  plan for every task.
- **No MCP dependency in the subagent** — the orchestrator (Tier 1/2 lead) has PM (Linear/JIRA)
  access and fetches the spec/plan once; the task agent only needs to read a local file.
  Subagents can lose MCP access, so they must not need it to get their context.

## Who writes it

The **orchestrator** (Tier 1/2, or the team lead) writes one brief per task *before* dispatch,
while it still has PM access. It fetches the Specification slice and Technical Plan guidance from
the parent issue and bakes them into the file.

## Location

```
{phase_worktree}/.claude/executor-state/briefs/{phase_id}-task-{index}.md
```

Local to the machine and inside the worktree the task agent runs in, so it's always readable
regardless of MCP state. Temporary — add `.claude/executor-state/` to the repo's gitignore (the
plugin already stores executor/conductor state there). Briefs may be cleaned up after the phase
completes.

## Contents

```markdown
# Task {index}: {title}   ({phase_id}, pathway: {feature|bug|chore})

## Task
{task_body}

## Files
{files}            # files to create/modify
## Reference patterns
{reference_patterns}

## Pathway-specific
{unit_tests}                                   # feature
{bug_description / expected / actual}          # bug

## Specification (relevant slice)
{spec_excerpt}

## Technical Plan (relevant guidance)
{plan_excerpt}

## Acceptance criteria
{acceptance_criteria}
```

## How it's passed and read

- **Dispatch** carries a short pointer, not the body: `phase_id`, `task_index`, `pathway`, and
  `brief_path` (plus the phase branch / git workflow). See `team-deployment.md`.
- **Step 1 of the `executing-tasks` skill** reads `brief_path` to get full task context. If no
  `brief_path` is provided (e.g. a direct standalone invocation), it falls back to an inline
  TASK CONTEXT block.
