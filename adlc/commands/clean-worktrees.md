---
description: Clean up git worktrees related to merged branches with user confirmation
---

# Clean Worktrees - Git Worktree Cleanup Command

Remove git worktrees that are associated with merged branches to keep workspace clean and free up disk space.

## Usage

```bash
/adlc:clean-worktrees           # Clean up merged worktrees in current repo
```

## Overview

This command uses the `cleanup-commands` skill to identify and remove worktrees for branches that have been merged into the main branch.

**Process:**

1. List all existing git worktrees
2. Identify which branches have been merged
3. Check for uncommitted changes in each worktree
4. Present summary to user with safety warnings
5. Get user confirmation before removal
6. Remove selected worktrees safely
7. Optionally cleanup merged local branches

## Requirements

**Git repository with:**

- Worktrees (created via `git worktree add`)
- Main/master/develop branch as merge target

**Safe to run:**

- After merging feature branches
- During regular workspace cleanup
- Anytime worktrees accumulate

## Safety Features

**Protected worktrees (never removed):**

- Current worktree (where you are now)
- Main worktree (original checkout)
- Worktrees on unmerged branches

**Safety checks:**

- Verify branch merge status
- Detect uncommitted changes
- Warn about data loss
- Require user confirmation

**User control:**

- Choose which worktrees to remove
- Decide on dirty worktrees separately
- Option to keep branches while removing worktrees
- Can cancel at any time

## Command Execution

When you invoke this command, Claude will:

1. **Announce skill usage:**
   "I'm using the cleanup-commands skill to clean up merged worktrees."

2. **Execute the skill workflow:**
   - List all worktrees via `git worktree list --porcelain`
   - Check merge status via `git branch --merged <main-branch>`
   - Analyze uncommitted changes via `git status --porcelain`
   - Categorize worktrees: clean merged, dirty merged, unmerged

3. **Present summary:**

   ```
   ## Merged Worktrees (Safe to Remove)
   1. ~/worktrees/my-repo/feature-auth
      Branch: feature/auth
      Status: Merged into main
      Clean: Yes

   ## Merged Worktrees with Uncommitted Changes (⚠️)
   2. ~/worktrees/my-repo/feature-dashboard
      Branch: feature/dashboard
      Status: Merged into main
      Clean: No - 3 files modified
      Warning: Removing will delete uncommitted changes

   ## Unmerged Worktrees (Keep)
   3. ~/worktrees/my-repo/feature-new-feature
      Branch: feature/new-feature
      Status: Not merged
   ```

4. **Get confirmation:**

   ```
   Found 2 worktrees that can be removed (1 clean, 1 with uncommitted changes)

   Options:
   1. Remove 1 clean worktree (safe)
   2. Remove all 2 worktrees (⚠️ will lose uncommitted changes)
   3. Select specific worktrees to remove
   4. Cancel - keep all worktrees

   Your choice:
   ```

5. **Remove worktrees:**

   ```bash
   git worktree remove "$WORKTREE_PATH"
   # Or with force for uncommitted changes:
   git worktree remove --force "$WORKTREE_PATH"
   git worktree prune
   ```

6. **Optional branch cleanup:**

   ```
   Worktrees removed. Also delete merged local branches?

   Branches:
   - feature/auth (merged)

   Delete branches? (yes/no)
   ```

7. **Report results:**

   ```
   ✓ Removed ~/worktrees/my-repo/feature-auth
   ✓ Deleted branch feature/auth

   Cleanup complete! Freed 450MB.
   ```

## Examples

### Example: Standard Cleanup

```bash
/adlc:clean-worktrees
```

**Output:**

```
Found 5 worktrees: 2 merged (clean), 1 merged (dirty), 2 unmerged

Options:
1. Remove 2 clean worktrees
2. Remove all 3 (⚠️ data loss)
3. Select specific
4. Cancel

> 1

✓ Removed ~/worktrees/my-repo/feature-auth
✓ Removed ~/worktrees/my-repo/fix-bug-123
✓ Deleted branches: feature/auth, fix/bug-123

Cleanup complete! Freed 450MB.
```

**No merged worktrees:**

```
Found 3 worktrees: all unmerged (active development)
No cleanup needed.
```

**Selective cleanup:**

```
> 3 (select specific)
Select: 1,2,4
✓ Removed 3 worktrees. Branches kept.
```

## Integration

**Uses:**

- `cleanup-commands` skill for cleanup logic

**Pairs with:**

- `execution-orchestration` skill - Creates worktrees
- `/adlc:execute` - Uses worktrees during implementation

## Best Practices

1. **Run regularly** - After merging PRs or completing features
2. **Review carefully** - Always check the summary before confirming
3. **Backup important work** - Commit or stash changes in dirty worktrees before removal
4. **Keep active work** - Only remove worktrees for merged branches
5. **Cleanup branches** - Delete merged local branches to keep branch list clean
