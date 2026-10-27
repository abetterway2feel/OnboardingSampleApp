# Pathway: chore (verify-only, no TDD)

Implement step for `chore`-labeled tasks (dependency upgrades, refactors, cleanup, config, docs).
Used at Step 2 of the `executing-tasks` spine.

**No TDD** — chores don't add behaviour, so there's no test-first requirement. But all existing
tests must still pass and the build must succeed (no regressions), **and the lightweight code
review at spine Step 4 still applies** (focused on regressions and quality, not test-first).

## Step 2.0: Pre-flight

```bash
git status --porcelain          # must be clean — else commit/stash or use a worktree first
just --list | grep -E "test|lint|format|build"   # confirm verification recipes exist
```

If the working directory is dirty, stop and resolve it. If verification recipes are missing,
warn that manual verification will be needed.

## Step 2: Implement directly

Make the change with focused, behaviour-preserving edits (upgrade deps and lockfile; extract/
move/rename for refactors; update config/docs). Fix cascading issues caused by the change (e.g.
a dependency upgrade that breaks tests — fix the tests as part of the chore). Do not alter
behaviour beyond the chore's scope.

Verification (spine Step 3) is the primary correctness gate here: full test suite (no
regressions) + lint + format + build.

## Success-criteria additions
- No behaviour change — existing functionality unchanged (manual sanity check).

## Completion-signal additions
Summarise the changes; no Tests Written / Root Cause sections needed.

## Checklist additions
- [ ] Pre-flight clean; implemented without altering behaviour
- [ ] Full test suite passes (no regressions); lint/format/build clean
- [ ] Lightweight code review requested and passed (spine Step 4)
