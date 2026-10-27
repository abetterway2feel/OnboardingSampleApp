# Team Deployment Reference

Task agent and code reviewer prompt templates for team execution strategy.

## Task Agent Prompt Template

Each task agent (teammate) receives this prompt when spawned:

```
You are a task agent executing tasks for phase {phase_id}.

PROTOCOL:
1. Check TaskList for available tasks
2. Claim a pending, unblocked task (TaskUpdate status=in_progress)
3. Read the brief file referenced in the task description — it holds the full task context
   (task body, files, pathway-specific fields, the relevant Specification + Technical Plan
   slice, and acceptance criteria). You do NOT need PM/MCP access; everything is in the file.
4. Execute using the Tier 3 skill Skill('adlc:executing-tasks') — it selects a pathway from the phase label:
   - feature → feature pathway (TDD)
   - bug → bug pathway (systematic debugging + TDD fix)
   - chore → chore pathway (verification-focused + lightweight review)
5. Git pull --rebase before committing, push after
6. Mark task complete (TaskUpdate status=completed)
7. Claim next available task or go idle

PHASE CONTEXT:
- Phase ticket ID: {phase_id}
- Phase branch: {phase_branch}
- Feature branch: {feature_branch}
- Phase label: {phase_label}

(Per-task context — including the Specification/Technical Plan slice and codebase patterns —
lives in each task's brief file, not in this prompt. Read the brief at step 3.)

GIT WORKFLOW:
- Before starting each task: git pull --rebase origin {phase_branch}
- Tier 3 skill handles the commit (one commit per task)
- After task commit: git push origin {phase_branch}
- If push fails (conflict): git pull --rebase origin {phase_branch} && git push
```

## Code Reviewer Prompt Template

Dispatched after all tasks in a phase complete:

```
Review all changes on the phase branch.

PHASE: {phase_id} — {phase_title}
DIFF: git diff {base_branch}...{phase_branch}
ACCEPTANCE CRITERIA:
{acceptance_criteria}

SPECIFICATION EXCERPT:
{spec}

TECHNICAL PLAN EXCERPT:
{plan}

CHECKLIST:
- [ ] TDD compliance: tests written before implementation, tests fail first
- [ ] Test coverage: all acceptance criteria have corresponding tests
- [ ] Code quality: SOLID principles, no circular dependencies
- [ ] Security: no hardcoded secrets, input validation at boundaries
- [ ] Naming: clear, consistent with codebase conventions
- [ ] No over-engineering: minimal code for requirements

REPORT FORMAT:
Produce a severity-tagged report:
- 🔴 Critical: Security, data loss, broken functionality → FIX DIRECTLY
- 🟡 Major: Architecture, patterns, maintainability → FIX DIRECTLY
- 🟢 Minor: Style, naming, documentation → COMMENT ONLY

Fix critical and major issues with commits on the phase branch.
Report minor issues as comments in the PR.
```

## Task List Setup

The lead writes a **brief file** per task (full context, incl. spec/plan slice it fetches from
PM) and puts only a short **pointer** in the task description — see
[task-brief.md](task-brief.md). This keeps dispatch prompts small and means the task agent never
needs MCP to get its context.

```python
tasks = parse_tasks(phase.description)
briefs_dir = f"{phase_worktree}/.claude/executor-state/briefs"

for task in tasks:
    # Lead has PM access: bake the relevant spec/plan slice into the brief file.
    brief_path = write_task_brief(
        f"{briefs_dir}/{phase_id}-task-{task['index']}.md",
        task, phase, parent, accumulated_patterns,   # spec/plan fetched from `parent`
    )
    TaskCreate(
        subject=f"Task {task['index']}: {task['title']}",
        description=f"""
Phase: {phase_id} ({phase_label})  ·  Task {task['index']}: {task['title']}
Pathway: {phase_label}
Full brief (read this first): {brief_path}
""",
        activeForm=f"Executing {task['title']}"
    )

# Set up dependencies
dependencies = parse_parallelisation_notes(phase.description)
for task_id, blocked_by in dependencies.items():
    TaskUpdate(taskId=task_id, addBlockedBy=blocked_by)
```

## Teammate Spawn

```python
max_teammates = min(len(tasks), 4)
for i in range(max_teammates):
    spawn_teammate(model="sonnet", prompt=TASK_AGENT_PROMPT)
```

## Git Coordination

All teammates work on the same phase branch:

```bash
# Before each task
git pull --rebase origin {phase_branch}

# After commit
git push origin {phase_branch}

# If push fails
git pull --rebase origin {phase_branch}
git push origin {phase_branch}

# If rebase conflicts are unresolvable
# Report failure, lead spawns replacement
```

**Key:** No per-teammate branches. Well-structured vertical slices minimize conflicts.

## Strategy Resolution

```python
def resolve_strategy(flags, config, phase):
    if flags.get("strategy"):
        return flags["strategy"]
    if config.get("execution.strategy"):
        return config["execution.strategy"]

    strategy = "team"

    if not env_var_set("CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS"):
        return "sequential"
    if is_headless_or_conductor():
        return "sequential"
    if len(parse_tasks(phase.description)) <= 1:
        return "sequential"

    return strategy
```
