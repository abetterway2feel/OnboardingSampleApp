# ADLC Hook System

The ADLC plugin uses lightweight hooks focused on workflow guidance and completeness checks. Enforcement (lint, format, tests, build) is handled by pre-commit hooks and `just` commands.

## Hooks

### SessionStart

| | |
|---|---|
| **Type** | `command` (`session-init.sh`) |
| **Matcher** | `*` |
| **Timeout** | 30s |

Displays a concise workflow reminder on session start:

- ADLC workflow: `refine → plan → breakdown → execute → pr`
- Other commands (`/adlc:quick`, `/adlc:address-feedback`)
- `just` command emphasis
- Repository initialisation status

### SubagentStop

Two matchers for specific ADLC agents only (no catch-all):

| Matcher | Focus |
|---|---|
| `backend-engineer\|frontend-engineer\|qa-engineer\|platform-engineer\|documentation-specialist` | **Enforcement** (`verify-guard.sh`) + reminder (`stop-guard.sh`): acceptance criteria, docs, code review |
| `code-reviewer` | Critical/major issues found and addressed or flagged |

The reminder path uses `stop-guard.sh` (command type) which checks `stop_hook_active` to prevent infinite loops and returns `{"decision": "block", "reason": "..."}` JSON.

**Enforcement (`verify-guard.sh`):** the engineer matcher also runs `verify-guard.sh subagentstop`, which actually runs `just lint` + `just typecheck` and **blocks completion on failure** (feeding the failing output back) — turning "verify before done" into enforcement, not just a prompt. It is **fail-open**: with no `justfile`/`just`/recipe, or anything ambiguous, it allows completion. Configure via `ADLC_STOP_VERIFY` (default `lint,typecheck`; `off` to disable; add `test` to include the full suite). Caveat: it runs in the session's `CLAUDE_PROJECT_DIR`, not a subagent's worktree, so for worktree-isolated execution the Tier 3 inner loop remains the primary gate and this hook is a backstop (most valuable for standalone flows).

**Note:** The `*` catch-all was removed — it blocked built-in agents (Explore, Plan, etc.) from finishing, causing errors.

### TeammateIdle

| | |
|---|---|
| **Type** | `command` (`teammate-idle-guard.sh`) |
| **Matcher** | Not supported (fires on every occurrence) |

For Agent Teams: fires when a teammate is about to go idle. Uses **exit code 2** to block (stderr fed back as feedback). Does NOT support JSON decision control.

Currently allows idle by default (exit 0). Quality gates can be added by uncommenting the test check in the script.

### TaskCompleted

| | |
|---|---|
| **Type** | `command` (`verify-guard.sh taskcompleted`) |
| **Matcher** | Not supported (fires on every occurrence) |

Fires when a task is being marked as completed. Uses **exit code 2** to block (stderr fed back as feedback). Does NOT support JSON decision control.

Runs the same `verify-guard.sh` enforcement (`just lint`/`typecheck`) in `taskcompleted` mode — blocking completion on a real failure, fail-open otherwise. Configure/disable with `ADLC_STOP_VERIFY` (see SubagentStop above).

## Design Principles

- **Enforce the cheap/deterministic gates, remind for the rest** — `verify-guard.sh` hard-blocks on `lint`/`typecheck` failures (fail-open when not applicable); the prose reminders cover judgement calls (acceptance criteria, docs). Pre-commit hooks remain the enforcement layer for commits.
- **Specific matchers only** — only ADLC implementation and review agents get stop guards; no catch-all that blocks built-in agents
- **Correct hook API per event** — SubagentStop uses JSON decision control; TeammateIdle/TaskCompleted use exit code 2 only
- **Minimal overhead** — no blocking validation steps that duplicate pre-commit or `just` commands
