---
description: Create a pull request with comprehensive description, diagrams, and visual documentation
---

# PR - Pull Request Creation Command

Create a pull request with a clear, human-readable description (diagrams + visual aids), then
drive it to done. Thin entry point — all the logic lives in the `creating-pull-requests` skill.

## Usage

```bash
/adlc:pr                          # Create PR for the current branch
/adlc:pr --draft                  # Draft PR (skips the drive-to-done handoff)
/adlc:pr --title "Custom title"   # Override the generated title
/adlc:pr --base develop           # Non-default base branch
```

## Requirements

- **`gh`** installed + authenticated, with repo access.
- Commits on the current branch not in the base; remote configured.
- Optional: PM system (Linear/JIRA) MCP for issue context; a PR template in `.github/`.

## What it does

Invokes **`Skill(adlc:creating-pull-requests)`**, which gathers context (branch/commits/diff/PM
issue), detects the PR template, categorizes changes, generates the description + diagrams,
creates the PR via `gh`, and applies labels. **See `skills/creating-pull-requests/SKILL.md` for
the full workflow and `resources/error-scenarios.md` for error handling** (no commits, PR already
exists, not authenticated, dirty tree, unpushed branch).

Then it **spawns a fresh subagent on the `adlc:babysitting-prs` brief** (creating-pull-requests
Step 9): drive CI to green, critically evaluate review feedback (auto-incorporate only safe items,
escalate the rest), and notify when ready to merge. It runs in its own fresh context and waits with
the `Monitor` tool rather than burning turns, which keeps babysitting off the calling session's
context. **Never auto-merges.** Skipped for `--draft`.

## After creation

```bash
gh pr edit <number> --add-reviewer @alice,@bob   # request reviewers
gh pr edit <number> --add-project "Sprint 23"     # add to a board
gh pr ready <number>                              # mark a draft ready
```

## Integration

- **Uses:** `creating-pull-requests` skill, `gh`, `git`, PM MCP (optional).
- **Called by:** the user directly, or `/adlc:execute` at the end of execution.
- **Pairs with:** `/adlc:address-feedback` (process review comments manually).

## Remember

- PR creation is **not** the last step — once opened, `babysitting-prs` drives it to done (CI green + threads resolved); the merge stays your call.
- Comprehensive descriptions + diagrams make review easier; link the PM issue; flag breaking changes and include screenshots for UI work.
