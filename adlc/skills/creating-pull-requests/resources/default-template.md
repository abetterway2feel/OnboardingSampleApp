# Default PR Template

Use this template when no custom PR template is found in the repository.

```markdown
# [Feature/Fix/Chore]: {Concise Title}

## Summary

{1-2 paragraph overview of what was implemented and why}

## What Changed

### Features
- {feature 1}: {brief description}
- {feature 2}: {brief description}

### Bug Fixes
- {fix 1}: {what was broken and how it's fixed}

### Technical Changes
- {refactor/improvement}: {what and why}

## Visual Overview

{Include diagrams for complex changes}

### Architecture
```mermaid
{architecture diagram showing new components or changes}
```

## User Flow (if applicable)

```mermaid
{sequence or flow diagram showing user interaction}
```

## Data Model (if applicable)

```mermaid
{ERD or class diagram showing data structure changes}
```

## Implementation Details

### Key Files Changed

- `path/to/file1.ts` - {what changed and why}
- `path/to/file2.ts` - {what changed and why}

### New Dependencies

- {package-name}: {why added and what it does}

### Breaking Changes

{List any breaking changes with migration instructions}

### Database Migrations

{If applicable, describe schema changes}

## Testing

### Test Coverage

- {N} new tests added
- {N} existing tests updated
- All tests passing: ✅

### Test Strategy

- Unit tests for {components}
- Integration tests for {workflows}
- {Type} tests for {feature}

### Manual Testing

- [ ] Tested on development environment
- [ ] Tested edge cases
- [ ] Tested error handling
- [ ] Verified no regressions

## Screenshots/Demos

{If UI changes, include before/after screenshots}
{If API changes, include example requests/responses}
{If CLI changes, include example commands}

## Related Issues

Closes #{issue-number}
Related to #{issue-number}

## Checklist

- [x] Code follows project style guidelines
- [x] Tests added/updated and passing
- [x] Documentation updated
- [x] No breaking changes (or migration guide provided)
- [x] Reviewed own code
- [x] Ready for review

## Reviewer Notes

{Specific areas to focus review on}
{Known limitations or trade-offs}
{Future work planned}

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)

```

## Template Sections Explained

### Summary
Concise overview of the PR. Answers "what was done" and "why was it done". Should be scannable in 30 seconds.

### What Changed
Categorized list of changes by type (features, fixes, technical). Helps reviewers understand scope.

### Visual Overview
Mermaid diagrams for complex changes. See [diagram-guide.md](diagram-guide.md) for when to use each type.

### Implementation Details
Technical specifics: files changed, new dependencies, breaking changes, migrations. Helps reviewers focus on key areas.

### Testing
Test coverage, strategy, and manual testing checklist. Demonstrates quality and completeness.

### Screenshots/Demos
Visual evidence for UI/UX changes. Example requests for API changes. Example commands for CLI changes.

### Related Issues
Links to PM system issues. Use proper keywords:
- "Closes" or "Fixes" - Automatically closes issue when PR merges
- "Implements" or "Resolves" - Links issue without auto-closing
- "Related to" - Associated but not completing

### Checklist
Self-review items. Shows due diligence and readiness for review.

### Reviewer Notes
Guidance for reviewers: focus areas, known limitations, future work. Streamlines review process.

### Attribution
Claude Code footer acknowledging AI-assisted PR creation.
