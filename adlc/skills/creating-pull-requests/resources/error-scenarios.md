# Error Handling and Edge Cases

## Common Error Scenarios

### No Commits to PR

**Situation:** Current branch has no commits different from base branch.

**Detection:**

```bash
DEFAULT_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@')
COMMITS=$(git log $DEFAULT_BRANCH..HEAD --oneline | wc -l)

if [[ $COMMITS -eq 0 ]]; then
    # No commits to PR
fi
```

**Response:**

```markdown
ERROR: No commits on current branch different from {default_branch}

Current branch appears to be up to date with {default_branch}.

Options:
1. Make changes and commit first
2. Check if you're on the correct branch: `git branch`
3. Check if changes were already merged: `git log`

Current branch: {branch_name}
Base branch: {default_branch}
```

### Branch Already Has PR

**Situation:** PR already exists for current branch.

**Detection:**

```bash
CURRENT_BRANCH=$(git branch --show-current)
EXISTING_PR=$(gh pr list --head $CURRENT_BRANCH --json number --jq '.[0].number')

if [[ -n "$EXISTING_PR" ]]; then
    # PR exists
fi
```

**Response:**

```markdown
PR already exists for this branch: #{pr_number}

URL: {pr_url}
Status: {pr_status}
Title: {pr_title}

Options:
1. View existing PR: `gh pr view {pr_number}`
2. Update PR description: `gh pr edit {pr_number} --body "new description"`
3. Add new commits (will automatically update PR)
4. Close existing PR: `gh pr close {pr_number}`

Would you like to update the existing PR or create a new one?
```

### GitHub CLI Not Authenticated

**Situation:** `gh` CLI not authenticated or token expired.

**Detection:**

```bash
if ! gh auth status &>/dev/null; then
    # Not authenticated
fi
```

**Response:**

```markdown
ERROR: GitHub CLI not authenticated

Please authenticate:

gh auth login

Then retry: /adlc:pr

For more info: https://cli.github.com/manual/gh_auth_login
```

### Push Failed - No Upstream

**Situation:** Branch exists locally but not on remote.

**Detection:**

```bash
if ! git ls-remote --exit-code --heads origin $CURRENT_BRANCH; then
    # Branch not on remote
fi
```

**Fix:**

```bash
# Push with upstream tracking
git push -u origin $CURRENT_BRANCH
```

**Response:**

```markdown
Branch not found on remote - pushing now...

git push -u origin {branch_name}

✓ Branch pushed successfully
Continuing with PR creation...
```

### No Parent Issue Found

**Situation:** No issue reference in branch name or commits.

**Detection:**

```bash
# Check commits
ISSUE_ID=$(git log --format=%s | grep -oE '[A-Z]+-[0-9]+' | head -1)

if [[ -z "$ISSUE_ID" ]]; then
    # Check branch name
    ISSUE_ID=$(git branch --show-current | grep -oE '[A-Z]+-[0-9]+')
fi

if [[ -z "$ISSUE_ID" ]]; then
    # No parent issue found
fi
```

**Response:**

```markdown
WARNING: No parent issue found in commits or branch name

This means PR feedback cannot be automatically tracked via /adlc:address-feedback

Recommendation:
1. Include issue reference in commit messages: [TEAM-123]
2. Use branch naming convention: feature/TEAM-123-description

Continue with PR creation? (y/n)
```

### Template Parse Error

**Situation:** PR template exists but has invalid format.

**Detection:**

```bash
if [ -f .github/pull_request_template.md ]; then
    # Template exists - try to parse
    if ! validate_template .github/pull_request_template.md; then
        # Parse error
    fi
fi
```

**Response:**

```markdown
WARNING: PR template found but could not parse structure

Template: {template_path}

Using default template instead. You may need to manually adjust PR description to match project requirements.

Continue with default template? (y/n)
```

### Base Branch Not Found

**Situation:** Cannot determine default branch (no origin/HEAD).

**Detection:**

```bash
DEFAULT_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@')

if [[ -z "$DEFAULT_BRANCH" ]]; then
    # Could not determine default branch
fi
```

**Fix Attempt:**

```bash
# Try to set origin/HEAD
git remote set-head origin --auto

# Retry detection
DEFAULT_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@')
```

**Response if still fails:**

```markdown
ERROR: Cannot determine default branch

Tried:
1. git symbolic-ref refs/remotes/origin/HEAD
2. git remote set-head origin --auto

Please specify base branch:

Example:
/adlc:pr --base main
/adlc:pr --base develop

Common base branches: main, master, develop, staging
```

### Large Diff Warning

**Situation:** PR has extremely large diff (>1000 files or >50k lines).

**Detection:**

```bash
FILES_CHANGED=$(git diff $DEFAULT_BRANCH...HEAD --numstat | wc -l)
LINES_CHANGED=$(git diff $DEFAULT_BRANCH...HEAD --numstat | awk '{sum+=$1+$2} END {print sum}')

if [[ $FILES_CHANGED -gt 1000 ]] || [[ $LINES_CHANGED -gt 50000 ]]; then
    # Very large PR
fi
```

**Response:**

```markdown
WARNING: Very large PR detected

Statistics:
- Files changed: {files_changed}
- Lines changed: {lines_changed}

Recommendation:
Large PRs are difficult to review. Consider breaking into smaller PRs:
1. Infrastructure/setup changes
2. Core functionality
3. Tests and documentation

Continue with large PR? (y/n)
```

### Merge Conflicts with Base

**Situation:** Current branch has conflicts with base branch.

**Detection:**

```bash
git fetch origin $DEFAULT_BRANCH

# Try merge preview
if ! git merge-tree $(git merge-base HEAD origin/$DEFAULT_BRANCH) HEAD origin/$DEFAULT_BRANCH | grep -q "<<<<<<"; then
    # Has conflicts
fi
```

**Response:**

```markdown
WARNING: Merge conflicts detected with {default_branch}

Conflicts in:
{list of conflicting files}

Recommendation:
Resolve conflicts before creating PR:

git fetch origin {default_branch}
git merge origin/{default_branch}
# Resolve conflicts
git commit

Continue anyway? (y/n)
Note: PR will show conflicts and cannot be merged until resolved.
```

## Edge Cases

### Empty Repository

**Situation:** Repository has no commits yet.

**Response:**

```markdown
ERROR: Repository has no commits

Cannot create PR in empty repository. Make initial commit first:

git add .
git commit -m "Initial commit"
git push -u origin {branch_name}
```

### Detached HEAD State

**Situation:** Not on a branch.

**Detection:**

```bash
if [[ $(git symbolic-ref -q HEAD) == "" ]]; then
    # Detached HEAD
fi
```

**Response:**

```markdown
ERROR: Not currently on a branch (detached HEAD state)

Current state: {commit_hash}

Create a branch first:

git checkout -b feature/my-branch
git push -u origin feature/my-branch

Then retry: /adlc:pr
```

### Uncommitted Changes

**Situation:** Working directory has uncommitted changes.

**Detection:**

```bash
if ! git diff-index --quiet HEAD --; then
    # Has uncommitted changes
fi
```

**Response:**

```markdown
WARNING: Uncommitted changes detected

Changes not staged for commit:
{list of modified files}

Options:
1. Commit changes: `git add . && git commit -m "message"`
2. Stash changes: `git stash`
3. Discard changes: `git checkout .`

Continue without uncommitted changes? (y/n)
Note: Only committed changes will be included in PR.
```

## Recovery Strategies

### Retry Logic

For transient failures (network issues, API rate limits):

```bash
retry_count=0
max_retries=3

until gh pr create ... || [ $retry_count -eq $max_retries ]; do
    retry_count=$((retry_count+1))
    echo "Attempt $retry_count failed. Retrying in 5 seconds..."
    sleep 5
done
```

### Graceful Degradation

If optional features fail, continue with core functionality:

```markdown
✓ PR created successfully!
⚠ Could not add labels (rate limit exceeded)
⚠ Could not assign reviewers (insufficient permissions)

PR URL: {pr_url}

You can manually:
- Add labels: `gh pr edit {pr_number} --add-label "feature"`
- Add reviewers: `gh pr edit {pr_number} --add-reviewer @username`
```

### Manual Fallback

If automated PR creation fails completely:

```markdown
ERROR: Could not create PR automatically

Manual PR creation:
1. Push branch: `git push -u origin {branch_name}`
2. Create PR via web: https://github.com/{owner}/{repo}/compare/{base}...{branch}
3. Use this description:

---
{generated_pr_description}
---

Debugging:
- Check auth: `gh auth status`
- Check permissions: `gh repo view`
- Check rate limit: `gh api rate_limit`
```
