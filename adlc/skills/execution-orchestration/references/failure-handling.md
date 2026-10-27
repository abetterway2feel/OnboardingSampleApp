# Failure Handling Reference

Retry → skip → continue protocol for task and phase failures.

## Task-Level Retries

Within a phase (both team and sequential strategies):

A `COMPLETE` signal ends the retry loop but is not proof the work is done — match the structured
`<completion>TASK:...:COMPLETE` envelope (not incidental text), and the integrated verification
gate (SKILL Step 5d) still runs on the phase branch before the review gate and any completion
claim.

```python
max_attempts = 3

for attempt in range(1, max_attempts + 1):
    result = dispatch_to_tier3(task, context)

    if parse_completion(result).status == "COMPLETE":  # the envelope, not any "COMPLETE" substring
        break  # necessary, not sufficient — verified at the Step 5d integrated gate
    elif attempt < max_attempts:
        # Retry with error context from previous attempt
        context += f"\nPREVIOUS FAILURE (attempt {attempt}):\n{result}"
    else:
        # All attempts exhausted — fail task
        report_task_failure(task, result)
```

## Team Strategy: Replacement Teammates

When a task agent fails in team mode:

| Stage | Action |
|-------|--------|
| Tier 3 retries (within agent) | Agent retries up to 3 times per skill protocol |
| Agent reports failure | Task remains in task list with error context |
| Lead resets task | Lead resets task to pending, appends error to description |
| Replacement agent | Lead spawns replacement with error context |
| Max 2 replacements | After 2 replacements per task, mark phase FAILED |

```python
def handle_task_failure(task, error_context):
    replacements = task.metadata.get("replacements", 0)
    if replacements >= 2:
        emit(f"<completion>PHASE:{phase_id}:FAILED:Task {task.index} failed after replacements</completion>")
        return

    TaskUpdate(
        taskId=task.id,
        status="pending",
        description=task.description + f"\n\nPREVIOUS FAILURE:\n{error_context}",
        metadata={"replacements": replacements + 1}
    )
    spawn_teammate(model="sonnet", prompt=TASK_AGENT_PROMPT + f"\n\nKNOWN ISSUE:\n{error_context}")
```

## Phase-Level Retries

When an entire phase fails (all task retries exhausted):

```python
def handle_phase_failure(phase_id, parent_id, error):
    retries = phase_retries.get(phase_id, 0)
    max_retries = 1

    if retries < max_retries:
        phase_retries[phase_id] = retries + 1
        # Re-execute the entire phase
        execute_phase(phase_id)
    else:
        # Notify on parent ticket
        mcp__linear-server__create_comment(
            issueId=parent_id,
            body=f"""## Execution Blocked

**Phase:** {phase_id}
**Reason:** {error}

**Action needed:** Investigate and run `/adlc:execute {parent_id}` to retry.

---
*ADLC Executor*"""
        )
```

## Failure Modes

| Failure | Level | Action | Continue? |
|---------|-------|--------|-----------|
| Test failure | Task | Retry (3x) | No |
| Lint failure | Task | Retry (3x) | No |
| Build failure | Task | Retry (3x) | No |
| All task retries exhausted | Phase | Retry phase (1x) | No |
| Phase retry exhausted | Feature | Notify, skip | Yes (independent phases) |
| Merge conflict | Phase | Notify, wait | No |
| CI failure on phase PR | Phase | Fix or notify | Depends |

## Independent Phase Continuation

When a phase fails and has no dependents waiting, continue with other independent phases:

```python
for phase in ready_phases:
    try:
        execute_phase(phase)
    except PhaseFailure as e:
        failed_phases.append(phase)
        # Continue with phases not blocked by this one
        continue
```
