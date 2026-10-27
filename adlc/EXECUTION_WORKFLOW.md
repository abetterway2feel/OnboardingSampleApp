# ADLC Execution Workflow

## Lifecycle (high level)

```mermaid
flowchart TD
    idea([Idea or ticket]) --> refine["/adlc:refine<br/>Specification — WHAT"]
    refine --> plan["/adlc:plan<br/>Technical Plan — HOW"]
    plan --> planreview["divergence review<br/>fresh-context subagent<br/>Plan vs Specification"]
    planreview -.->|blockers| plan
    planreview -->|human passes gate| breakdown["/adlc:breakdown<br/>Phase sub-issues = vertical slices<br/>each labelled feature / bug / chore"]
    breakdown --> bdreview["divergence review<br/>fresh-context subagent<br/>Breakdown vs Spec + Plan"]
    bdreview -.->|blockers| breakdown
    bdreview -->|human passes gate| execute["/adlc:execute<br/>3-tier execution — see Team Strategy below"]
    execute --> pr["/adlc:pr<br/>Feature PR"]
    pr --> babysit["babysitting-prs<br/>drive PR to done in background"]
    babysit --> done([CI green + approved + threads resolved])
    babysit -.->|new review feedback| af["/adlc:address-feedback"]
    af -.-> execute
```

## Team Strategy (Default)

```mermaid
sequenceDiagram
    participant User
    participant Cmd as /execute command
    participant Lead as Lead (execution-orchestration skill)
    participant GTR as git gtr
    participant TA as Task Agents (Sonnet)
    participant T3 as Tier 3 Skills
    participant Rev as Code Reviewer

    User->>Cmd: /execute PARENT-ID
    Cmd->>Cmd: Detect issue type<br/>(feature / phase / standalone)

    alt Feature (has sub-issues)
        Cmd->>Lead: Skill(adlc:execution-orchestration)
        Lead->>Lead: Resume check (PM status + worktrees + PRs)
        Lead->>Lead: Validate prerequisites, resolve dependencies

        Lead->>GTR: git gtr new feature/{id}-{slug}
        GTR-->>Lead: ~/worktrees/repo/feature-{id}-{slug}/

        loop For each phase (respecting dependency waves)
            Lead->>GTR: git gtr new {phase-branch} --from-current
            GTR-->>Lead: ~/worktrees/repo/{phase-branch}/
            Lead->>Lead: PM update: phase → In Progress

            Lead->>Lead: Parse tasks and write per-task brief files<br/>(full task context in .claude/executor-state/briefs, no MCP needed)
            Lead->>Lead: TaskCreate one entry per task (pointer to brief and blockers)
            Lead->>TA: Spawn Sonnet teammates via Agent Teams (max 4)

            par Each teammate, in parallel
                TA->>TA: Claim next unblocked task → read brief
                TA->>T3: Skill(adlc:executing-tasks) feature/bug/chore pathway by label
                T3->>T3: TDD / investigate / verify, inner loop, per-task review
                T3->>T3: verification gate (fresh proof)
                T3->>T3: git pull --rebase, commit, push to shared phase branch
                TA->>TA: Mark task complete → claim next
            end

            Lead->>Lead: Integrated verification gate<br/>(read diff, re-run just test/lint on phase branch)
            Lead->>Rev: Review all changes on phase branch (Opus)
            Rev->>Rev: TDD compliance, acceptance criteria, code quality
            Rev-->>Lead: Severity report (fix critical/major, comment minor)

            Lead->>Lead: Create phase PR (stacked: phase-2 → phase-1)
            Lead->>Lead: PM update: phase → In Review
            Lead->>Lead: Squash-merge phase PR
            Lead->>Lead: PM update: phase → Done
            Lead->>GTR: git gtr rm {phase-branch} --delete-branch
            Lead->>Lead: Accumulate patterns for next phase
        end

        Lead->>Lead: Create feature PR (feature → main)
        Lead->>Lead: PM update: parent → In Review
        Lead->>Lead: Hand off to babysitting-prs (drive PR to done)
        Lead-->>User: <completion>FEATURE:{id}:COMPLETE</completion>

    else Phase (has parent)
        Cmd->>Lead: Skill(adlc:execution-orchestration) for phase mode
        Note over Lead,Rev: Same task/review/PR loop as above

    else Standalone (no parent, no children)
        Cmd->>T3: Direct Tier 3 by label
        Note over T3,Rev: Single TDD cycle + review
    end
```

## Sequential Strategy (Fallback)

```mermaid
sequenceDiagram
    participant Lead as Lead (execution-orchestration skill)
    participant Sub as Subagent
    participant T3 as Tier 3 Skills
    participant Rev as Code Reviewer

    Lead->>Lead: Parse tasks from phase description

    loop For each task (serial)
        Lead->>Sub: Agent(subagent) with task context
        Sub->>T3: Skill(adlc:executing-tasks) feature/bug/chore pathway by label
        T3->>T3: TDD cycle, commit, push
        T3-->>Sub: Task complete + patterns
        Sub-->>Lead: Result + patterns
        Lead->>Lead: Accumulate patterns
    end

    Lead->>Rev: Review all phase changes
    Rev-->>Lead: Severity report
    Lead->>Lead: Create phase PR
```

## Architecture Summary

```
execution-orchestration skill (unified)
├── Feature mode: orchestrate phases across worktrees
│   ├── Resume check (PM status, worktrees, PRs)
│   ├── Dependency resolution (topological sort into waves)
│   ├── Feature worktree via gtr
│   └── Phase loop:
│       ├── Phase worktree via gtr
│       ├── Team (default): spawn task agents → Tier 3 in parallel
│       ├── Sequential (fallback): subagent → Tier 3 in series
│       ├── Code reviewer validates phase
│       ├── Phase PR (stacked default)
│       ├── Squash-merge, cleanup worktree
│       └── PM updates at every transition
├── Phase mode: execute tasks within a single phase (same loop)
└── Completion: feature PR → main, <completion>FEATURE:{id}:COMPLETE</completion>

Tier 3: Task Execution (executing-tasks skill — feature / bug / chore pathway by label)
├── Single TDD cycle (RED → GREEN → REFACTOR)
├── Inner loop verification (test + lint + typecheck)
├── One commit per task
└── Emits: <completion>TASK:{phase}:{index}:STATUS</completion>
```

## Branch Strategy — Stacked PRs (Default)

```
main
└── feature/PARENT-100-auth                              # Feature worktree
    └── feature/PARENT-100-auth/phase-1-register         # Phase 1 worktree
        ├── commit: Task 1 - Add users migration
        ├── commit: Task 2 - Implement User model
        └── commit: Task 3 - POST /api/users endpoint
        └── Phase PR → feature branch (squash merge)
             └── feature/PARENT-100-auth/phase-2-login   # Phase 2 worktree
                 ├── commit: Task 1 - Session model
                 └── commit: Task 2 - POST /api/login
                 └── Phase PR → phase-1 branch (squash merge)
    └── Feature PR → main
```

## Branch Strategy — Feature Branch PRs (`--pr-strategy feature`)

```
main
└── feature/PARENT-100-auth                          # Feature worktree
    ├── feature/PARENT-100-auth/phase-1-register     # Phase PR → feature branch
    ├── feature/PARENT-100-auth/phase-2-login        # Phase PR → feature branch
    └── feature/PARENT-100-auth/phase-3-profile      # Phase PR → feature branch
    └── Feature PR → main
```
