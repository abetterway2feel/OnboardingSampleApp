# ADLC Skills Catalog

A thin index of the skills shipped with the ADLC plugin. Each skill's `SKILL.md` is the authoritative source for its process; this page is just a map.

Invoke a skill with `Skill(adlc:<skill-name>)` (or `Skill(foundations:<skill-name>)` for setup skills, which now live in the [Foundations plugin](../../foundations/README.md)).

For *how the skills fit together* in the pipeline — and how routing and execution work — see the canonical orientation in [`../skills/using-adlc/SKILL.md`](../skills/using-adlc/SKILL.md) and the visual map in [`../EXECUTION_WORKFLOW.md`](../EXECUTION_WORKFLOW.md). For the architecture and design rationale, see [`../CLAUDE.md`](../CLAUDE.md).

## Orientation

| Skill | Purpose | When used |
|-------|---------|-----------|
| [`using-adlc`](../skills/using-adlc/SKILL.md) | Canonical workflow orientation — the pipeline, when to use each command, conventions, how execution works | At the start of work in an ADLC repo, or when unsure which command fits (injected at session start) |

## Planning & Specification

| Skill | Purpose | When used |
|-------|---------|-----------|
| [`refining-issues`](../skills/refining-issues/SKILL.md) | Refine rough ideas into specifications via Socratic questioning (WHAT, not HOW), written to the ticket | A vague issue/idea needs requirements before planning (`/refine`) |
| [`technical-planning`](../skills/technical-planning/SKILL.md) | Turn a Specification into a Technical Plan: architecture, technology choices, implementation guidance | Issue has a Specification and needs a HOW (`/plan`) |
| [`breakdown-planning`](../skills/breakdown-planning/SKILL.md) | Split Spec + Plan into phase sub-issues using vertical slicing (each phase independently demoable) | Spec + Plan complete, ready to create sub-issues (`/breakdown`) |
| [`reviewing-divergence`](../skills/reviewing-divergence/SKILL.md) | Independently audit a Technical Plan against its Specification (mode `plan`), or a breakdown against both (mode `breakdown`), in a fresh context — severity-ranked report + gate recommendation | Final step of `/plan` and `/breakdown`, dispatched to a general-purpose subagent; also when inheriting someone else's plan or breakdown |
| [`creating-tickets`](../skills/creating-tickets/SKILL.md) | Standardised PM ticket creation with classification (feature/chore/bug) and required metadata | Creating sub-issues during breakdown or feedback |

## Execution

| Skill | Purpose | When used |
|-------|---------|-----------|
| [`execution-orchestration`](../skills/execution-orchestration/SKILL.md) | Orchestrate features/phases/standalone: worktrees, team/sequential task execution, review gates, phase PRs (stacked default), PM updates; **verifies subagent work** (reads the diff + re-runs integrated checks) before any completion claim | `/execute` on a feature, phase, or standalone issue |
| [`executing-tasks`](../skills/executing-tasks/SKILL.md) | Unified Tier 3 task execution — one spine, three pathways by label (feature = TDD, bug = investigate + TDD, chore = verify-only); includes the built-in **Verification Gate** (fresh command output before any completion claim) | Dispatched by `execution-orchestration` per task; or directly for standalone tickets |
| [`updating-pm-status`](../skills/updating-pm-status/SKILL.md) | Update Linear/JIRA with task status changes and lifecycle comments | On status transitions during execution (start, PR, CI, merged) |

## Quality & Code Review

| Skill | Purpose | When used |
|-------|---------|-----------|
| [`test-driven-development`](../skills/test-driven-development/SKILL.md) | Enforce RED → GREEN → REFACTOR; tests must fail first | Implementing any feature or bugfix, before writing implementation code |
| [`writing-tests`](../skills/writing-tests/SKILL.md) | Write effective tests at the right levels, behaviour-focused, with meaningful coverage | Writing or refactoring tests |
| [`requesting-code-review`](../skills/requesting-code-review/SKILL.md) | Dispatch the code-reviewer subagent against plan/requirements | After tasks, major features, or before merge |
| [`receiving-code-review`](../skills/receiving-code-review/SKILL.md) | Evaluate review feedback with technical rigor; verify before implementing, push back when wrong | When receiving review feedback, before acting on it |
| [`reviewing-security`](../skills/reviewing-security/SKILL.md) | Deep security review playbook (dependencies, secrets, authn/authz, injection, data protection) | Loaded by code-reviewer for auth/input/secrets/crypto/boundary changes; also standalone |
| [`reviewing-performance`](../skills/reviewing-performance/SKILL.md) | Measurement-first performance review (layer analysis, profiling, findings vs. budgets) | Loaded by code-reviewer for hot-path/bulk/DB changes; also standalone |

## Debugging

| Skill | Purpose | When used |
|-------|---------|-----------|
| [`systematic-debugging`](../skills/systematic-debugging/SKILL.md) | Four-phase framework (investigate → patterns → hypothesis → implement) ensuring understanding before fixes | Any bug, test failure, or unexpected behaviour, before proposing a fix |
| [`root-cause-tracing`](../skills/root-cause-tracing/SKILL.md) | Trace bugs backward through the call stack to the original trigger; fix at source | Error manifests deep in execution and the origin is unclear |

## Code Quality

| Skill | Purpose | When used |
|-------|---------|-----------|
| [`adding-logging`](../skills/adding-logging/SKILL.md) | Minimal logging at interfaces, DEBUG default, strict PII protection | Adding or improving application logging |
| [`writing-code-comments`](../skills/writing-code-comments/SKILL.md) | Comment the "why" and "how", not the "what" | Writing or reviewing comments |

## Git & PR Workflow

| Skill | Purpose | When used |
|-------|---------|-----------|
| [`creating-pull-requests`](../skills/creating-pull-requests/SKILL.md) | Create PRs with human-readable descriptions, diagrams, and template detection | End of an execution workflow (`/pr`) |
| [`babysitting-prs`](../skills/babysitting-prs/SKILL.md) | Drive an open PR to done in the background: CI green, safe review comments auto-incorporated, threads resolved (never auto-merges). Carries the canonical brief for spawning it in a fresh subagent, plus the `gh` watch/poll scripts | Automatically after a PR is raised; or directly to monitor a PR until mergeable |
| [`addressing-pr-feedback`](../skills/addressing-pr-feedback/SKILL.md) | Process PR review comments into trackable sub-issues, ready for execution | `/address-feedback` on a reviewed PR |

> **Setup skills moved to Foundations:** `generating-agent-documentation`, `configuring-project-management`, `setting-up-pre-commit`, `writing-justfiles`, and `qa-review` now live in the [Foundations plugin](../../foundations/README.md). Use `/foundations:setup` for repository setup and `/foundations:qa-review` for QA readiness assessment.
</content>
