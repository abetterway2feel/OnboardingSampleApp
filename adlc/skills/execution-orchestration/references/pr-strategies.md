# PR Strategies Reference

Two strategies for phase PR base branches.

## Strategy: `stacked` (Default)

Each phase PR targets the previous phase branch. Creates a chain of incremental PRs.

```
main
 └── feature/PARENT-100-auth  (feature branch)
      └── phase-1-register  → PR into feature branch
           └── phase-2-login  → PR into phase-1 branch
                └── phase-3-profile  → PR into phase-2 branch
```

| Phase Branch | PR Base |
|-------------|---------|
| phase-1 | `feature/PARENT-100-auth` |
| phase-2 | `phase-1` |
| phase-3 | `phase-2` |

**Characteristics:**
- Each PR shows only the incremental diff from the previous phase
- Smaller, easier-to-review PRs
- Must be merged in order
- Better for tightly coupled phases

## Strategy: `feature`

Each phase PR targets the feature branch directly. Flat structure.

```
main
 └── feature/PARENT-100-auth  (feature branch)
      ├── phase-1-register  → PR into feature branch
      ├── phase-2-login     → PR into feature branch
      └── phase-3-profile   → PR into feature branch
```

**Characteristics:**
- All PRs target the same base branch
- Each PR shows full diff of that phase
- PRs can be merged in any order
- Best for phases with minimal interdependency

## Implementation

```python
def get_pr_base_branch(pr_strategy, feature_branch, previous_phase_branch):
    if pr_strategy == "stacked":
        return previous_phase_branch or feature_branch
    else:
        return feature_branch
```

## Choosing a Strategy

| Factor | `stacked` (default) | `feature` |
|--------|---------------------|-----------|
| PR size | Incremental diff | Full phase diff |
| Merge order | Must be sequential | Any order |
| Review complexity | Smaller diffs | Larger diffs |
| Conflict risk | Lower | Higher (parallel merges) |
| Best for | Sequential phases | Independent phases |
