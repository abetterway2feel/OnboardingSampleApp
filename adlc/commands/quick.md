---
description: Quick task execution with minimal overhead - creates Linear issue, brief clarification, then immediate execution
---

# Quick - Lightweight Task Execution

Execute small tasks (~30 minutes or less) with minimal overhead: detect type, brief
clarification, create a tracking issue, run one Tier-3 cycle, open a PR.

This is the **fast lane of the structured workflow** — for trivial work that doesn't warrant the
full `refine → plan → breakdown → execute` pipeline. It still tracks the work in the PM system and
goes through a branch + PR, so it stays traceable.

## Usage

```bash
/adlc:quick "Fix the typo in the login button"
/adlc:quick "Update the copyright year in footer"
/adlc:quick "Add loading spinner to submit button"
```

## Model tip (cost)

Before executing, surface a one-line tip (then continue without waiting):

> 💡 **Model tip:** routine task — Sonnet handles these well at ~1/5 the Opus cost. If you're on Opus, consider `/model sonnet`; escalate back only if it needs deep reasoning.

Skip the tip if the task is a clearly complex bug (deep debugging), where Opus is the better default. See `skills/execution-orchestration/references/model-routing.md`.

## Process

The command's own job is **type detection, scope-gating, and brief clarification**; everything
after that delegates to existing skills (so there's no duplicated logic here).

1. **Detect type** from the description — bug signals (`fix`/`bug`/`error`/`broken`/`crash`), chore signals (`update`/`upgrade`/`refactor`/`cleanup`/`deps`/`config`), else feature.
2. **Scope check** — if it smells large (`refactor`/`redesign`/`rewrite`/`migrate`/`auth`/`api`/`database`), warn that it may exceed the fast lane and suggest the full pipeline (`/adlc:refine → /plan → /breakdown → /execute`); ask whether to continue anyway.
3. **Brief clarification** — 1–2 targeted questions only if needed (bug: expected vs actual + affected file; chore: target/version; feature: where it lives). Skip for obvious tasks.
4. **Create the tracking issue** → `Skill(adlc:creating-tickets)` with the detected label.
5. **Execute one task** → `Skill(adlc:executing-tasks)` (pathway = label) on a `quick/<id>-<slug>` branch — the same Tier-3 cycle (TDD/verify + per-task review + verification gate) as any task.
6. **Open the PR** → `Skill(adlc:creating-pull-requests)`, which hands off to `babysitting-prs` to drive it to done.

## Example

```bash
/adlc:quick "Fix login button not responding on mobile"
# Detected: bug · 1 clarification → expected behaviour + component
# Created AIFE-215 → branch quick/AIFE-215-fix-login-button → executing (bug pathway) → checks ✓ → PR
```

For a task that trips the scope check (e.g. "Refactor the authentication system"), `/adlc:quick`
warns and points to the full pipeline before proceeding.

## Configuration

Optional, from `.claude/conductor.local.md` or `~/.adlc-conductor/config.yml`:

```yaml
team: "AI-First Engineering"
quick:
  scope_warning_threshold: 30  # minutes
  skip_clarification_for: ["simple updates", "typo fixes"]
```

## Remember

- ~30 minutes or less; warns and defers to the full pipeline if it's bigger.
- Detects type from the description; tracks the work in the PM system.
- Delegates issue creation, execution, and PR to existing skills — no duplicated logic here.
