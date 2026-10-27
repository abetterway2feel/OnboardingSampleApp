---
name: using-adlc
description: Orientation for the ADLC (Agentic Development Lifecycle) plugin - the command pipeline, when to use each command, and how execution works. This is the canonical workflow orientation; the SessionStart hook injects it, and it can be invoked directly. Use at the start of work in an ADLC repo, or when unsure which ADLC command fits.
---

# Using ADLC

ADLC takes work from idea to a merged PR through a consistent, spec-driven pipeline. Prefer it
over ad-hoc changes for anything non-trivial.

## The pipeline

For features and code changes:

`/adlc:refine` → `/adlc:plan` → `/adlc:breakdown` → `/adlc:execute` → `/adlc:pr`

- **`/adlc:refine`** — turn a rough idea into a Specification (WHAT to build), in the PM ticket.
- **`/adlc:plan`** — turn the Specification into a Technical Plan (HOW to build), then have a fresh-context subagent audit it against the Specification for signal loss.
- **`/adlc:breakdown`** — split into phase sub-issues = vertical slices, each labelled `feature` / `bug` / `chore`, then have a fresh-context subagent audit the breakdown against Spec + Plan.
- **`/adlc:execute`** — 3-tier execution (see below): TDD, code review, phase PRs.
- **`/adlc:pr`** — open the feature PR. Once open, the PR is **driven to done automatically** (CI green + all human review threads resolved + approved) by the `babysitting-prs` skill; it never auto-merges — the final merge is yours.

`/adlc:plan` and `/adlc:breakdown` each end with an independent divergence review
(`reviewing-divergence`, run in a fresh context) and present its recommendation as a gate —
**you** decide whether to proceed.

Each command can run standalone or chain to the next.

## Other commands

- **`/adlc:quick`** — small, well-defined tasks with minimal overhead.
- **`/adlc:chore`** — maintenance (no TDD, but still lint/test/build + a lightweight review).
- **`/adlc:bug-fix`** — systematic debugging + TDD.
- **`/adlc:address-feedback`** — process PR review comments into sub-issues and implement them.

## How execution works

- **3 tiers:** Tier 1 orchestrates phases (feature/phase branches, stacked phase PRs); Tier 2 iterates tasks within a phase; Tier 3 runs one task via the unified **`executing-tasks`** skill, which picks a pathway by label — feature = TDD, bug = investigate + TDD, chore = verify-only.
- **Team strategy is the default:** Tier 1 spawns Sonnet teammates (Agent Teams) that claim tasks from a shared list and run Tier 3 in parallel on a shared phase branch. Falls back to **sequential** when teams aren't available, the phase is single-task, or running headless.
- **Quality gates everywhere:** per-task TDD + code review, a verification gate (fresh proof before claiming done, baked into `executing-tasks`; `execution-orchestration` verifies subagent work — diff + integrated re-run — before phase/feature claims), and a phase-level review before each PR.

## Conventions

- **Always prefer `just` commands** — `just test`, `just lint`, `just format`, `just build`. Run `just --list` to discover recipes. ADLC stays stack-agnostic; the repo defines what each recipe does.
- **The PM system (Linear/JIRA) is the source of truth** — specs, plans, and status live in tickets, not separate files.
- **First time in a repo?** Run `/foundations:setup` to establish CLAUDE.md, a justfile, pre-commit hooks, and PM integration.
