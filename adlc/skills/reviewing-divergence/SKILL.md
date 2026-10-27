---
name: reviewing-divergence
description: Independently audit a Technical Plan against its Specification, or a breakdown against both, in a fresh context - producing a severity-ranked divergence report and a gate recommendation
when_to_use: as the final step of /adlc:plan and /adlc:breakdown, dispatched to a fresh subagent; also when inheriting someone else's plan or breakdown
version: 1.0.0
---

# Reviewing Divergence

## Overview

Audit one artifact against the one upstream of it and report what diverges:

| Mode | Reviews | Against | Dispatched by |
|------|---------|---------|---------------|
| `plan` | `## Technical Plan` | `## Specification` | `/adlc:plan` |
| `breakdown` | the phase sub-issues | `## Specification` + `## Technical Plan` | `/adlc:breakdown` |

Divergence is signal loss between stages: a requirement dropped, narrowed, or replaced by
something nobody asked for. `/adlc:execute` runs autonomously against whatever the tickets say,
so anything lost here becomes code before a person reads it.

**An artifact cannot audit itself.** The context that produced it shares its blind spots and
re-derives the same conclusions, which is why this runs in a fresh context.

**You do not fix findings.** You report them; fixing belongs to the authoring command.

**Announce at start:** "I'm using the reviewing-divergence skill to audit this
[plan | breakdown] against its [Specification | Specification and Technical Plan]."

## Context Requirement — read this first

- `/adlc:plan` and `/adlc:breakdown` dispatch this skill via
  `Agent(subagent_type="general-purpose")`, passing the issue ID and the mode — nothing else.
- If you authored the artifact, **stop** and report: *"Divergence review must run in a fresh
  context — dispatch a general-purpose subagent with Skill(adlc:reviewing-divergence)."*
- Read the artifacts from the PM system yourself. Never accept a summary of them — the summary
  is exactly where the divergence hides.

## The Process

```
Divergence Review Progress:
- [ ] Step 1: Load the artifacts cold from the PM system
- [ ] Step 2: Build the coverage table (each success criterion → what delivers it)
- [ ] Step 3: Run the checks for this mode
- [ ] Step 4: Post the severity-ranked report to the parent issue
- [ ] Step 5: Recommend PASS / PASS WITH DECISIONS / RETURN
```

### Step 1: Load Artifacts

- Parent issue: `mcp__linear-server__get_issue(id)` (or the JIRA equivalent) — extract
  `## Specification` and, in `breakdown` mode, `## Technical Plan`.
- `breakdown` mode: fetch **every** sub-issue in full. A breakdown you have only partly read
  cannot be audited — titles hide nothing, bodies do.

Stop conditions:

- No `## Specification` → *"Run `/adlc:refine` first. There is nothing to review against."*
- Mode `plan` and no `## Technical Plan` → *"Nothing to review."*
- Mode `breakdown` and no sub-issues → *"Run `/adlc:breakdown` first, or this issue is a single
  slice executing standalone."*

### Step 2: Build the Coverage Table

Number the parent's success criteria `AC-1`, `AC-2`, … if they are not already, then record what
claims each one downstream. Rows with `—` are the review's primary output:

```markdown
| ID | Criterion (short) | Delivered by | Tested by |
|----|-------------------|--------------|-----------|
| AC-1 | Export completes and the file downloads | Phase 2 | e2e/export.spec.ts |
| AC-4 | Export of >100k rows is rejected with a clear message | — | — |
```

Do this before forming any opinion: coverage is arithmetic, the rest is judgement.

### Step 3: Run the Checks

**Both modes:**

1. **Requirement survival** — every `AC-n` and stated constraint is delivered by something named.
   Silent narrowing counts ("all formats" → CSV only).
2. **Invention** — everything proposed traces back to a criterion. Work no criterion asks for is
   a decision a human has not taken.
3. **Testability** — each `AC-n` has a named way to verify it. "Comprehensive tests" is not one.
4. **Decision honesty** — open questions and assumptions from the Specification are still open,
   not quietly resolved in the reviewed artifact's favour.

**Mode `plan` adds:**

5. **Measurability** — criteria that state a threshold (latency, volume, error rate) have a
   mechanism in the design that can hold and be observed.
6. **Shared seams named** — data models, interfaces, event payloads and config schemas that more
   than one slice touches are specified, so decomposition can order them first.

**Mode `breakdown` adds** — the recurring failures worth checking by name:

7. **Horizontal slicing** — phases split by layer (models → services → API → UI) instead of by
   user-visible behaviour. Nothing is demoable until the last phase.
8. **Split tests and implementation** — a phase or task that writes tests for work another one
   implements. One task = one TDD cycle.
9. **Dependency sanity** — no cycles; dependencies are real (shared code or data), not
   speculative ordering; work marked parallel does not edit the same files.
10. **First slice is not a walking skeleton** — Phase 1 should prove the thinnest end-to-end
    path, not build foundations that demo nothing.
11. **Context adequacy** — each sub-issue is executable by an agent that reads only that ticket:
    the `AC-n` it delivers, the relevant plan extract, and its acceptance test.
12. **Orphan work** — a phase or task that maps to no `AC-n` and to no part of the plan.

Tag every finding:

| Severity | Meaning | Gate effect |
|----------|---------|-------------|
| 🔴 `BLOCKER` | Proceeding as-is builds the wrong thing, or builds it unverifiably | Resolve before the next stage |
| 🟡 `QUESTION` | A decision the upstream artifact does not support; a human must confirm it | Needs an explicit decision |
| 🟢 `NOTE` | Worth knowing; does not change what gets built | Informational |

Cite the ticket ID and the quoted line for every finding, or the `AC-n` with nothing covering
it. A finding that cannot be verified in 30 seconds gets ignored.

Say so when there is nothing to say. A review that manufactures findings to look thorough trains
people to skip the gate.

### Step 4: Post the Report

Comment it on the parent issue — never write it to a file in the repo — and return it to the
dispatching command. Blockers first; a reader with 20 minutes must reach the important part.

```markdown
# Divergence Report — [PARENT-ID] [Title]

**Mode:** plan | breakdown
**Reviewer context:** fresh (general-purpose subagent)
**Recommendation:** ✅ PASS | 🟡 PASS WITH DECISIONS ([n]) | 🔴 RETURN TO [PLAN | BREAKDOWN]

## Blockers
🔴 **B1 — [one line]**
[What diverges, quoting the artifact. Which `AC-n` or plan element it breaks. What must change.]

## Decisions needed
🟡 **D1 — [one line]** · Recommended: [option] because [reason]

## Coverage
[the table from Step 2]

## Notes
🟢 [one line each]

## Metrics
| Criteria covered | [n] / [n] |
| Checks with no findings | [n] / [4 shared + 2 plan | 4 shared + 6 breakdown] |
| Findings | [n] blockers · [n] decisions · [n] notes |
```

### Step 5: Recommend

- **PASS** — no blockers, no unsupported decisions.
- **PASS WITH DECISIONS** — no blockers, but *n* questions need a human answer first. Give the
  option you would choose and why.
- **RETURN** — blockers present. Name what must fix them: `/adlc:plan` or `/adlc:breakdown` for
  the artifact, `/adlc:refine` when the gap is in the Specification.

**The human takes the gate decision.** The recommendation is input to it — the reviewer never
approves its own way into execution.

## Key Principles

| Principle | Application |
|-----------|-------------|
| **Fresh context** | Never audit an artifact you authored; refuse and ask to be re-dispatched |
| **Report, don't fix** | Findings go back to the authoring command; never edit the tickets |
| **Arithmetic before judgement** | Build the coverage table before forming opinions |
| **Evidence per finding** | Ticket ID + quoted line, or the uncovered `AC-n` |
| **Severity discipline** | `BLOCKER` means "the wrong thing gets built", not "I would have worded it differently" |
| **Silence is a valid result** | A clean artifact gets a clean report |
| **Human decides** | The reviewer recommends; a person passes the gate |

## Red Flags — STOP

- You produced this artifact → wrong context; refuse and ask for a fresh dispatch.
- You are editing the plan or a sub-issue → you have become the author; report instead.
- You only read the sub-issue titles → the divergence is in the bodies.
- A dozen findings and all of them `NOTE` → you are padding; re-read for coverage gaps.
- The Specification has no testable success criteria → the artifact under review is not the
  problem. Return to `/adlc:refine`.

## Integration with Other Skills

**Reviews:** `technical-planning` (mode `plan`), `breakdown-planning` (mode `breakdown`).
**Dispatched by:** `/adlc:plan` and `/adlc:breakdown` as their final step, via
`Agent(subagent_type="general-purpose")`.
**Precedes:** `/adlc:breakdown` (after a plan review) and `/adlc:execute` (after a breakdown
review), in both cases only once a human has passed the gate.
