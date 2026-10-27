# PR Feedback Categorization Guide

Reference for categorizing GitHub PR review comments by severity.

## Severity Categories

### Critical

**Definition:** Blocks PR merge, security issues, bugs, breaking changes

**Examples:**

- SQL injection vulnerability
- Race condition causing data loss
- Breaking API change without migration
- Memory leak
- Authentication bypass

**Treatment:**

- MUST be addressed before merge
- Always create separate task
- Highest Linear priority
- No grouping with other items

### Important

**Definition:** Architectural concerns, design issues, significant maintainability problems

**Examples:**

- Missing service layer pattern
- Poor error handling strategy
- N+1 query performance issue
- Tight coupling between modules
- Missing critical test coverage

**Treatment:**

- Should be addressed before merge
- Always create separate task
- High Linear priority
- May have dependencies on other Important items

### Minor

**Definition:** Style, naming, refactoring, documentation, small improvements

**Examples:**

- Inconsistent naming conventions
- Magic numbers not extracted to constants
- Missing JSDoc comments
- Code duplication (non-critical)
- Import organization

**Treatment:**

- Can be addressed after merge (but shouldn't be ignored)
- May be grouped if related
- Medium/Low Linear priority
- Can be batched together

### Questions

**Definition:** Reviewer asking for clarification or context

**Examples:**

- "Why not use existing service?"
- "Is this compatible with mobile client?"
- "What happens if this value is null?"

**Treatment:**

- Investigate codebase for context
- Answer on GitHub (don't create task)
- May reveal actual issues (then create task)

### Suggestions

**Definition:** Optional improvements, alternative approaches

**Examples:**

- "Consider using Zod for validation"
- "Could use lodash for this"
- "Nice to have: add retry logic"

**Treatment:**

- Ask user if should be implemented
- Only create task if user approves
- Low priority if created

### Praise

**Definition:** Positive feedback, acknowledgments

**Examples:**

- "Nice refactoring!"
- "Good test coverage"
- "Clean implementation"

**Treatment:**

- Acknowledge but don't create tasks
- Include in summary for morale

## Categorization Algorithm

```python
def categorize_feedback(comment):
    text = comment.body.lower()

    # Critical indicators
    if any(keyword in text for keyword in [
        'security', 'vulnerability', 'injection', 'bug',
        'broken', 'crash', 'leak', 'race condition',
        'must fix', 'blocking', 'breaks'
    ]):
        return 'critical'

    # Important indicators
    if any(keyword in text for keyword in [
        'architecture', 'design', 'refactor',
        'should', 'missing', 'n+1', 'performance',
        'error handling', 'coupling', 'tight'
    ]):
        return 'important'

    # Question indicators
    if any(keyword in text for keyword in [
        'why', 'what if', 'how does', 'clarify', '?'
    ]):
        return 'question'

    # Suggestion indicators
    if any(keyword in text for keyword in [
        'consider', 'could', 'might', 'nice to have',
        'alternatively', 'suggestion'
    ]):
        return 'suggestion'

    # Praise indicators
    if any(keyword in text for keyword in [
        'nice', 'good', 'great', 'clean', 'well done',
        'like this', 'looks good'
    ]):
        return 'praise'

    # Default to minor
    return 'minor'
```

## Context Analysis

Consider:

- **File location** - Changes in security/auth modules more critical
- **Reviewer expertise** - Security team's feedback on security code
- **Existing issues** - If comment references existing bug
- **Test coverage** - Feedback on untested code more important

## Priority Mapping

```python
def map_severity_to_priority(severity):
    return {
        'critical': 1,    # Urgent
        'important': 2,   # High
        'minor': 3        # Medium
    }[severity]
```

## Dependency Rules

1. **Critical before everything** - Critical issues must be fixed first
2. **Architecture before implementation** - Design changes before code
3. **Tests before code** - If test task exists, code depends on it
4. **Grouped minors last** - Wait for architecture to stabilize

## Grouping Minor Items

Group if:

- Same file affected
- Same category (style, docs, testing)
- Same component
- Related concerns

Example grouped title:

```
[PR Feedback] Style: Code quality improvements for UserService
```
