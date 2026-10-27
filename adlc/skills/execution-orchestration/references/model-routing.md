# Model Routing

Delegated work runs on the cheapest model that does the job well, escalating to a stronger
model only where reasoning or blast-radius justifies it. Opus costs roughly **5x Sonnet per
token**, so routing mechanical execution to Sonnet is the single biggest lever on delegated
spend — far more than context hygiene. This does **not** change the interactive session model;
it only sets the model for subagents ADLC spawns.

## Policy (default tier per role)

| Agent / work | Default model | Why |
|---|---|---|
| `backend-engineer` | **sonnet** | Executes well-specified tasks against a plan via TDD |
| `frontend-engineer` | **sonnet** | UI work against a spec |
| `qa-engineer` | **sonnet** | Writing/extending tests from acceptance criteria |
| `documentation-specialist` | **sonnet** | Mechanical writing |
| `platform-engineer` | **sonnet** | Routine IaC/CI; escalate to opus for complex or high-risk infra |
| `code-reviewer` | **opus** | Quality gate — catching subtle bugs/security needs the strongest reasoning; low volume, high value |
| Team task agents (`spawn_teammate`) | **sonnet** | Already the default in the team strategy |

The default lives in each agent's `model:` frontmatter (`plugins/adlc/agents/*.md`). Sequential
dispatch routes by label to these agents and inherits their model; the team strategy passes
`model="sonnet"` explicitly. Both paths therefore default mechanical execution to Sonnet.

## resolve_model() — the override path

When the orchestrator dispatches a task it may set an explicit `model=`, resolved in priority
order (mirrors `resolve_strategy`):

```python
def resolve_model(label, flags, config):
    # 1. Explicit per-invocation flag wins
    if flags.get("model"):
        return flags["model"]              # e.g. /adlc:execute ISSUE --model opus
    # 2. Repo config (adlc.local.md): execution.model_routing maps label -> model
    routing = config.get("execution.model_routing")  # e.g. {"chore": "sonnet", "bug": "opus"}
    if routing and label in routing:
        return routing[label]
    # 3. Fall back to the agent's frontmatter default (sonnet for execution roles)
    return None  # None => use the subagent's own `model:` default
```

## Three ways to override the default

1. **Per invocation** — `/adlc:execute ISSUE-ID --model opus` (or pass `model=` when dispatching a
   Task). Highest priority; affects one run.
2. **Per repository** — set `execution.model_routing` in `adlc.local.md`, e.g.
   `execution.model_routing: { chore: sonnet, feature: sonnet, bug: opus }`. Applies to the repo.
3. **Permanently per role** — edit the `model:` field in `plugins/adlc/agents/<agent>.md`.

## Interactive nudges (advisory)

The above governs *delegated* subagent work. For *interactive* sessions, the model can't be
switched automatically, so the routine ADLC commands surface a one-line advisory tip keyed to
the task type (continue without blocking):

- `/adlc:quick` and `/adlc:chore` → suggest `/model sonnet` (routine work, ~1/5 the cost).
- `/adlc:label` → suggest Sonnet for `chore`, Opus for `feature`/`bug`.

These only recommend; the user decides. They fire at points where the task type is already
known, so there's no per-prompt noise.

## Guidance: when to escalate to Opus

Escalate when the task involves genuine reasoning or high blast-radius, not just mechanical
edits: ambiguous/under-specified requirements, multi-file architectural refactors, subtle
concurrency or security logic, complex debugging, or risky infrastructure changes. Keep
straightforward, well-specified tasks (most chores and scoped feature/bug tasks) on Sonnet.
