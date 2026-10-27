# Estimated Claude Spend in PR Bodies

Append an estimate of the Claude Code token spend that produced a PR. Opt-in, list-price,
deduped — a relative signal for "what did this change cost", not a billing figure.

The estimate is produced by the **usage plugin's** `analyze_usage.py` in `--format md` mode —
the single source of truth for pricing and the transcript walk. ADLC has no vendored copy; if
the usage plugin isn't installed, the section is skipped.

```bash
# Locate the canonical analyser; skip the whole step if the usage plugin is absent
USAGE_SCRIPT=$(find ~/.claude/plugins -path '*/usage/skills/usage-analysis/scripts/analyze_usage.py' 2>/dev/null | head -1)
[ -n "$USAGE_SCRIPT" ] || { echo "usage plugin not installed — skipping spend estimate"; }
```

## Opt-in gate

Only run this if `pr.include_spend` is `true` in `.claude/adlc.local.md`:

```yaml
pr:
  include_spend: true          # default: false (section omitted)
  spend_basis: excl_cache_reads  # or incl_cache_reads for the list-price upper bound
```

```bash
# Skip the whole step unless explicitly enabled
INCLUDE_SPEND=$(grep -A3 '^pr:' .claude/adlc.local.md 2>/dev/null | grep -m1 'include_spend:' | grep -c 'true')
[ "$INCLUDE_SPEND" = "1" ] || { echo "spend estimate disabled"; }   # -> skip if not 1
BASIS=$(grep -A3 '^pr:' .claude/adlc.local.md 2>/dev/null | grep -m1 'spend_basis:' | grep -o 'incl_cache_reads')
BILL_FLAG=$([ "$BASIS" = "incl_cache_reads" ] && echo "--bill-cache-reads" || echo "")
```

## Why this is reliable (and how double-counting is avoided)

- **Dedup by `message.id`** — the same assistant message is copied across resumed/forked
  transcripts; the script counts each id once, so overlapping scopes never double-count.
- **`cwd` ≈ branch** — each branch runs in its own worktree, so the worktree path scopes
  a transcript to one branch's work (including subagent/teammate turns, which share the cwd).
- **gtr flattens slashes to dashes** — `feature/X` → `~/worktrees/<repo>/feature-X`,
  `feature/X/phase-1` → `feature-X-phase-1`. So the feature worktree path is a *dash-boundary
  prefix* of every phase worktree path. A single `--cwd-stem <feature-worktree>` sweeps the
  whole phase family in one shot — and it matches the `cwd` strings recorded in the
  transcripts, so it still works after phase worktrees are deleted on merge.

## Choosing the scope

| Raising… | Flag | Window |
|----------|------|--------|
| a single branch (standalone / phase / manual `/adlc:pr`) | `--cwd-prefix "$(git rev-parse --show-toplevel)"` (strict) | `--since` = branch's first commit |
| the **feature PR** (rolls up all phases) | `--cwd-stem "$(git rev-parse --show-toplevel)"` (dash-boundary sweep) | `--since` = feature branch's first commit |

```bash
SINCE=$(git log --reverse --format=%cI "$BASE_BRANCH..HEAD" | head -1)
TOPLEVEL=$(git rev-parse --show-toplevel)

# Single branch:
SPEND=$(uv run --script "$USAGE_SCRIPT" --format md --cwd-prefix "$TOPLEVEL" --since "$SINCE" \
        --scope-label "this branch" $BILL_FLAG)

# Feature PR rollup (sweeps phase worktrees via the gtr dash-stem):
SPEND=$(uv run --script "$USAGE_SCRIPT" --format md --cwd-stem "$TOPLEVEL" --since "$SINCE" \
        --scope-label "feature + all phases" $BILL_FLAG)
```

## Embedding

`--format md` prints a ready-to-embed collapsible markdown block, or **empty output** when no
spend is attributable. Append it to the PR body only when non-empty:

```bash
if [ -n "$SPEND" ]; then
    PR_DESCRIPTION="${PR_DESCRIPTION}

${SPEND}"
fi
```

The block renders as:

```
<details><summary>💸 Estimated Claude spend · ~$42 (list price)</summary>

318 turns · 2 session(s) · delegated $38 / interactive $4
Opus $31 · Sonnet $11
input $3 · output $12 · cache-write $27 · cache-read $9 (excluded)
scope: this branch · since 2026-06-02T09:14:00Z

_List-price estimate · deduped by message.id · cache-reads excluded unless billed. Anchor absolute $ to your billing panel._
</details>
```

## Notes & limits

- **List price only.** Relative breakdown is exact; anchor absolute dollars to the billing panel.
- **Non-worktree work** (editing directly in the main checkout) is scoped by the repo toplevel;
  two branches worked in the same directory can't be separated by path alone. Acceptable — the
  estimate is a signal, not an invoice.
- **Single source of truth.** Pricing, the transcript walk, and `message.id` dedup all live in
  the usage plugin's `analyze_usage.py`. ADLC only invokes it — there is no duplicated price
  table to drift. The cost is a runtime dependency on the usage plugin (skipped if absent).
