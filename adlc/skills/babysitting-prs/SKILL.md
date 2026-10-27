---
name: babysitting-prs
description: Drive an open PR to done in the background - poll CI and review threads on a self-paced loop, fix red checks, critically evaluate each review comment and auto-incorporate only the safe ones (escalating ambiguous/architectural feedback), and stop to notify when the PR is green, approved, and all threads resolved. Invoked automatically after a PR is raised (creating-pull-requests / execution), or directly when asked to monitor a PR until it is mergeable.
---

# Babysitting PRs

**A PR you raise is yours to drive to done — opening it is the start, not the finish.**
"Done" means: every CI check is green **and** every review thread is resolved — **human and bot
(e.g. CodeRabbit) alike** — **and** the PR is approved. No feedback is ignored: every comment is
considered, addressed, and its thread marked resolved before the PR is merged. This skill runs
that drive-to-done loop in the background.

**When this runs:** automatically as the final stage of the `execute → verify → raise PR`
sequence — `creating-pull-requests` (and the execution feature-PR step) hand off here once a
non-draft PR is opened. It can also be invoked directly to monitor an existing PR that stalled.

**Core principle:** Critically evaluate feedback, fix what's safe, never ignore a red check,
and never claim a state you haven't just observed.

## Spawning this skill: the canonical brief

**Do not run this loop in the session that raised the PR.** Spawn a fresh subagent that loads
this skill. Babysitting from the calling session drags that session's whole prefix through every
poll, and a PR takes many polls.

**This block is the single source of the spawn brief.** `creating-pull-requests` (Step 9),
`execution-orchestration` (Step 6) and `commands/pr.md` all point here — do not inline your own
variant at a call site, or the copies drift.

```
Agent(subagent_type="general-purpose", model="sonnet", run_in_background=true,
      prompt="Invoke Skill(adlc:babysitting-prs), then drive PR #{n} in {repo} to done.
              Branch: {branch}. Worktree: {path}.
              Context budget: ~60k tokens. Stop after ~60 cycles, or sooner on any stop
              condition in the skill. Attempt cap 3 per check.
              Do not spawn subagents. Edit only on the PR branch. Never auto-merge.
              Reach MCP tools (Linear/JIRA) through ToolSearch only if an escalation needs a
              sub-issue. Report in the skill's report format and nothing else.")
```

Then report that the PR is *open and being driven to done*, and end your turn — do not wait on it.

**Hard limits versus soft ones.** `model` and `run_in_background` are set at spawn and hold. The
cycle limit, the tool limits and the context budget are **soft** — instructions in the brief that
you are responsible for honouring:

| Constraint | How it holds |
|---|---|
| `model="sonnet"`, background | Hard — set by the caller at spawn |
| ~60 cycles, then stop | Soft — the stop conditions below are the real guard |
| No spawning, edits confined to the PR branch | Soft — restated in the brief every time |
| Context budget | Soft — stated in the brief, held by the stop conditions |

So **the autonomy envelope below is the whole guardrail.** Read it as binding, not advisory.

Two rules bind the caller as much as the spawned agent:

- **Don't wrap this in `/loop`, `ScheduleWakeup`, or `CronCreate`.** All three re-enqueue a
  prompt into an existing session, so each wake past the cache TTL rewrites the whole prefix.
- **Wait with the `Monitor` tool, not with turns.** Its poll loop runs in a shell, outside any
  model context, so waiting costs nothing.

Loading this skill on demand (rather than preloading it into an agent definition) keeps roughly
5–6k tokens of skill text out of the spawn's fixed prefix, at the cost of one `Skill` call.

The rest of this file is the procedure.

**This skill is GitHub-specific.** Every command below is `gh`, and each script confirms the
repository before doing anything, exiting `4` if `gh` is missing or the repo is not a GitHub one.
Porting to another PR host is a `tailor` job, not a runtime branch — see the `vcs-host` seam in
[`configuration-points.md`](../../configuration-points.md).

**Announce at start:** "I'm using the babysitting-prs skill to drive PR #{n} to done."

## Autonomy Envelope (do not exceed without asking)

- **Auto-incorporate only low-risk accepted feedback** — typos, lint/format, clear bugs,
  small explicitly-requested changes. Implement → push → reply → resolve the thread.
- **Escalate, do not auto-implement:** ambiguous, architectural, scope-changing, or
  disagreed-with feedback. Reply asking for clarification or with technical reasoning, leave
  the thread open, and surface it to the human.
- **Never auto-merge.** When the PR is mergeable, stop and notify "ready to merge".
- **Never force-push** over commits you didn't make. If a rebase is required, stop and notify.

## The Loop

Run one cycle per event, then arm the next wait (see "Pacing"). Each cycle:

### Step 1: Poll state, then work where the PR lives

One script, one poll, every state a cycle needs — PR envelope, CI, thread counts, and the open
threads themselves. `SCRIPTS` below is
`"${CLAUDE_PLUGIN_ROOT}/skills/babysitting-prs/scripts"`:

```bash
"$SCRIPTS/poll-pr-state.sh" 116 --threads
```

```
PR=116                      STATE=OPEN            CI=green
REPO=owner/name             DRAFT=false           CI_FAILING=
BRANCH=feat/x               MERGEABLE=MERGEABLE   THREADS_STATE=KNOWN
DECISION=NONE_REQUIRED      MERGE_STATE=CLEAN     THREADS_TOTAL=23
                                                  THREADS_UNRESOLVED=1
THREAD PRRT_kwDOexample plugins/adlc/CLAUDE.md alice: first 200 characters of the comment
```

(one `KEY=value` per line in reality; grouped here only to fit the page.)

Exit `0` every field observed, `2` at least one field is UNKNOWN, `4` `gh` is missing or this is
not a GitHub repository. `--repo OWNER/NAME` if you are not inside the repo.

**On the first cycle, switch to the PR's branch before doing any work** — `BRANCH` is in the
output, and the worktree for it lives under `~/worktrees/` (see `addressing-pr-feedback` Step 1).

**Exit 2 means you learned less than you asked for. Every UNKNOWN blocks, and none of them is a
zero.** `THREADS_UNRESOLVED=0` and `CI=green` are the two strongest possible false "ready to
merge" signals, so the script will not print either unless it proved it:

- **Threads reconcile or they are UNKNOWN.** The returned node count must equal `totalCount`.
  GraphQL cursor pagination under-reports — traversing 11 threads with `first:2` reported
  `hasNextPage=false` after 10 — so it takes one `first:100` page and checks the total.
- **A count is only believed after the payload parsed.** `jq` on empty input exits 0 and prints
  nothing, so a bare comparison after a failed request compares `""` against `""` and stays
  silent. Every count is proven with `jq -e` on the expected shape first.
- **CI is classified by bucket, never by raw state.** `--json bucket` normalises every state into
  `pass`/`fail`/`pending`/`skipping`/`cancel` *and* normalises both rollup entry types:
  `statusCheckRollup` mixes `CheckRun` (`.status`/`.conclusion`) with `StatusContext` (`.state`),
  and a bot review such as CodeRabbit arrives as the latter. A filter written for `CheckRun`
  alone reports "all green" while a whole class of check still pends — that is how
  `mergeStateStatus: UNSTABLE` sneaks past.

Then classify:

- **CI:** `failing` → Step 2 (a `cancel` is not a pass: re-run only if genuinely transient).
  `pending` → nothing to do this cycle. `green` → done. `none` → no checks exist, which is not
  the same as passing; say so rather than treating it as green.
- **Threads:** `KNOWN` → work the `THREAD` lines plus any new comments since last cycle.
  `UNKNOWN` → you know nothing about threads this cycle. Note it in the ledger and re-poll.
- **Decision:** `APPROVED` / `CHANGES_REQUESTED` / `REVIEW_REQUIRED`, or `NONE_REQUIRED` when the
  repo requires no review — which is a real answer, distinct from `UNKNOWN`.
- **State:** `MERGED`/`CLOSED` → exit the loop. `DRAFT=true` → notify and exit (nothing to drive).

### Step 2: Drive CI to green

```bash
"$SCRIPTS/pr-failed-logs.sh" 116 --lines 40        # tail of each failing check's log
```

Raw CI logs are the fastest way to blow the context budget, so this bounds the output per check
and names any check that has no log to fetch rather than skipping it silently. Narrow with
`--check <name>` and raise `--lines` only when 40 was genuinely not enough.

- Diagnose, fix in the worktree, commit, push, re-poll.
- Re-run a check **only** if it is genuinely flaky (transient infra/network), via
  `gh run rerun --failed <run-id>` — never to paper over a real failure.
- Cap fix attempts per check (default 3). On exhaustion → escalate (Step 5).
- Extract the failing assertion and its file, then discard the log text.

### Step 3: Critically evaluate each new review comment

**REQUIRED SUB-SKILL:** Use `adlc:receiving-code-review` for every thread — verify against the
codebase, no performative agreement, push back when wrong. Then route by the decision matrix:

| Verdict | Risk | Action |
|---------|------|--------|
| Correct & in scope | **Low** (typo, lint, clear bug, small requested change) | Implement, push, reply with what changed, **resolve thread** |
| Correct & in scope | **High** (architectural, multi-file, behavior/scope change) | **Escalate** — do not auto-implement; reply noting it's queued for the human; optionally open a PM sub-issue via `adlc:addressing-pr-feedback` |
| Ambiguous / unclear | any | **Escalate** — reply asking a specific clarifying question; leave open |
| Incorrect for this codebase | any | Reply with technical reasoning (`receiving-code-review`), leave open, surface disagreement to the human |
| Question (not a change) | — | Answer if you can verify it; otherwise escalate. Never fabricate |

**Consider every reviewer's feedback — human and bot (e.g. CodeRabbit) alike.** Bot comments are
not optional: run each through the same `receiving-code-review` evaluation (verify, don't blindly
accept), then route it through the matrix above. Every thread must be **addressed and resolved**
before merge — either by implementing the fix (resolve with what changed) or, if the comment is
wrong/out-of-scope/ambiguous, by replying with reasoning or a clarifying question (escalate, leave
open for the human). What you must not do is leave a bot thread silently unaddressed.

For accepted low-risk items, prefer one fix commit covering all of them per cycle (not one commit
per comment). After pushing, reply on each thread — the ids come from the `THREAD` lines in
Step 1:

```bash
"$SCRIPTS/reply-to-thread.sh" PRRT_kwDOexample --body-file reply.md --resolve
```

**Resolving is opt-in, and that is the guardrail, not a convenience.** Without `--resolve` the
thread gets the reply and stays open, which is exactly the escalation path. Pass `--resolve` only
once the corresponding change is pushed. Use `--body-file` for anything with markdown in it, and
read the exit code: `2` the reply failed and nothing was posted (safe to retry), `3` the reply
posted but the thread is still open (resolve it alone — do **not** repost).

### Step 4: Verification gate

**Evidence before claims, always.** Before declaring any cycle clean, re-poll (Step 1) fresh after
pushing — do not assume your push turned checks green or that a thread is resolved. Never report
green/resolved without a fresh observation you made *this cycle*: read the actual check output and
thread state, don't extrapolate from the fact that you pushed.

### Step 5: Decide — continue, exit, or escalate

- **Mergeable** (`CI=green` AND `THREADS_STATE=KNOWN` with **all threads resolved — human and bot**
  AND `DECISION=APPROVED`, or `NONE_REQUIRED` with no changes requested) →
  **stop the loop and notify**:
  > ✅ PR #{n} is ready to merge — all checks green, approved, {k} threads resolved (incl. bot review). Merge when ready (`gh pr merge {n} --squash`).
- **Escalation needed** (ambiguous/architectural feedback, disagreement, attempt cap hit,
  merge conflict / rebase required, CI failing on code you don't own) → **stop and notify**
  with a concise summary of exactly what needs a human decision.
- **Otherwise** (work pushed, checks re-running, waiting on reviewers) → **arm the next wait**
  and end the turn.

## Pacing: wait in a shell, not in turns

Waiting is the expensive part of babysitting, and it is expensive only if you wait *in
turns*. Arm one `Monitor` whose command exits when something you would act on happens, and
spend nothing until it does:

**Use the bundled scripts — do not hand-roll either loop.** Both distinguish *no signal* from *bad
signal* from *good signal*, which is the whole difficulty and the thing a hand-written loop keeps
getting wrong.

`Monitor` starts a **new shell**. It inherits Claude Code's environment — so
`${CLAUDE_PLUGIN_ROOT}` resolves — but *not* variables you set in an earlier `Bash` call, so
`"$PR"` arrives empty and the script exits 64. Write the actual numbers and names in:

```bash
Monitor(command: '"${CLAUDE_PLUGIN_ROOT}/skills/babysitting-prs/scripts/watch-pr-checks.sh" \
                    116 --repo HgDataTeam/hg-claude-code-plugin --require "CodeQL,build"',
        description: "PR #116 checks")
```

Exit `0` all passing, `1` settled with a `fail`/`cancel`, `2` a persistent `gh` error or an
expected check that never reported (or vanished and never returned), `3` timed out still pending,
`4` `gh` is missing or this is not a GitHub repository. `WARN` and `WAITING` lines are progress,
not verdicts — only the exit code is terminal.

**Four ways a watch lies, each indistinguishable from "still running."** The script's header
comment documents them in full; each one has broken a hand-written loop, which is why the script
exists:

1. **Matching the happy path.** `gh pr checks --json bucket` returns `pass`/`fail`/`pending`/
   `skipping`/`cancel` and a PR shows several at once, so matching `pass` exactly hangs on a
   healthy `pass,skipping`. Decide by what is still *pending*, and never let `cancel` pass.
2. **Reading one entry type.** `statusCheckRollup` mixes `CheckRun` (`.status`/`.conclusion`) with
   `StatusContext` (`.state`) — bot reviews are the latter — so a filter for one type reports "all
   green" while a class of check still pends. `--json bucket` normalises both.
3. **Absence read as success.** A check not yet created, or re-queued by your own push, is
   *missing*, so "nothing is pending" is true and wrong. Settling needs an identical snapshot
   across polls, the expected checks named, **and** every check an earlier poll returned still
   present — three identical *partial* snapshots are perfectly stable.
4. **An error read as an empty result.** `gh pr checks` exits `8` pending and `1` failing, and a
   bad PR or credentials problem also exits non-zero; `|| echo '[]'` collapses all of it into "no
   checks" and waits forever in silence. The subtle form: **`jq` on empty input exits 0 and prints
   nothing**, so a guard that pipes a failed request into `jq` compares nothing against nothing.

New comments are a second `Monitor`, not a complication of the checks loop:

```bash
Monitor(command: '"${CLAUDE_PLUGIN_ROOT}/skills/babysitting-prs/scripts/watch-pr-comments.sh" \
                    116 --exclude-author my-login',
        description: "PR #116 comments")
```

It emits `COMMENT <author> <path>: <body>` and polls **both** endpoints, because reviewers use
both: `pulls/N/comments` for diff-line comments and `issues/N/comments` for top-level ones. Two
things in it are load-bearing:

- **The `since` watermark advances only after a poll that succeeded**, and the timestamp is taken
  *before* the request. Advancing it unconditionally discards the whole window a failed poll
  covered — those comments appear in no later `since=` range, so they are never seen again. A
  failed poll prints `WARN` and names the window it could not read.
- **`--paginate` with `per_page=100`.** The default page size is 30; a busy review round silently
  drops everything past the thirtieth comment.

`--exclude-author` with your own login stops your replies from waking you. Poll remote APIs no
faster than every 30–60s (the default is 60), and use `persistent: true` for a watch that must
outlive the default timeout.

**Do not pace with `ScheduleWakeup` or `CronCreate`.** Both re-enqueue a prompt into an
existing session rather than starting fresh, so every wake past the cache TTL rewrites the
full prefix — the most expensive turn shape there is.

Keep a short running ledger (cycle count, last action, attempt counters) so the loop stays
coherent across events and respects the per-check attempt cap. Append one line per cycle —
never re-narrate previous cycles, and discard CI log text once you've extracted the failing
assertion from it.

## Guardrails

- Consider all feedback — human and bot; every thread is addressed and resolved before merge (fix-and-resolve, or reasoned reply/escalate), never silently left open.
- Attempt cap per check and per comment (default 3) → escalate, don't thrash.
- Never auto-merge; never force-push over others; stop on merge conflict / required rebase.
- Never mark a thread resolved without having pushed the corresponding change (or posted a
  reasoned reply the human can act on). `reply-to-thread.sh` only resolves when told to.
- **A failed poll is not a clean result.** Unknown ≠ zero, for threads, checks and comments
  alike. Every script here fails *closed*: no observation means keep waiting, never "ready".
- **Use the bundled scripts rather than re-deriving their commands.** Each hand-written
  equivalent has to relearn the same four traps.
- **Run in a fresh subagent, wait in a shell, keep the context small.** One fix commit per
  cycle; `gh --json <fields> --jq` over bare `gh`; `Grep` before `Read`; logs discarded once
  diagnosed. Stop and report rather than growing past your stated context budget.

## Stop conditions

Stop and report the moment any of these is true — do not keep cycling:

1. **Mergeable** — CI green (`watch-pr-checks.sh` exited `0`, or a fresh Step 1 poll observed
   `CI=green`), every thread resolved (human and bot), approved where approval is required.
2. **Escalation needed** — ambiguous or architectural feedback, a disagreement, the per-check
   attempt cap (3) hit, a merge conflict or required rebase, or CI failing on code you don't own.
3. **PR merged or closed** by someone else.
4. **Budget or cycle limit reached** — at your stated context budget, write your ledger and
   state into a short summary turn, then `/compact` so the summary survives and the log excerpts
   do not. At roughly 1.5× it, or past ~60 cycles, you have drifted from this brief: stop, report
   where the PR stands, and say the remaining work needs a fresh run.

## Report format

Under 200 words. This is a return value, not a chat message.

```
PR: #<n> — <title>
OUTCOME: ready-to-merge | escalation-needed | merged | closed | budget-exhausted
CI: <observed state, from this cycle>
THREADS: <resolved>/<total> resolved; <k> open and why — `unknown` when a poll could not read them
CYCLES: <n>   COMMITS PUSHED: <n>
NEEDS A HUMAN: <the specific decision, or "nothing">
```

Report only what you observed this run. Never report green or resolved because you pushed
something that should have made it so — re-poll and read the actual state first. If either thread
field is `unknown`, `OUTCOME` must not be `ready-to-merge`.

## Reuses

- `adlc:receiving-code-review` — the critical-evaluation gate (accept / push back / escalate).
- `adlc:addressing-pr-feedback` — worktree switch, comment fetch, PM sub-issue creation for escalated items.
