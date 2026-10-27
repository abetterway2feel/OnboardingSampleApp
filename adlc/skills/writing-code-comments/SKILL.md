---
name: writing-code-comments
description: Write effective code comments that explain "why" and "how", not "what" - follow best practices for meaningful documentation without stating the obvious
when_to_use: when writing code comments, reviewing comment quality, or establishing commenting standards
version: 2.0.0
---

# Code Commenting Best Practices

**Core principle:** Comment the "why" and sometimes "how", never the "what". Good naming shows what the code does; comments explain reasoning and non-obvious decisions.

## Philosophy

- **DO**: Explain business logic, design decisions, non-obvious reasoning
- **DON'T**: Describe what the code mechanically does (the code itself shows this)

**Example:**

```python
# BAD: Increment counter by 1
counter += 1

# GOOD: Track retry attempts to prevent infinite loops
counter += 1
```

## When to Write Comments

### Always Comment These

1. **Complex algorithms** - Mathematical formulas, performance characteristics, references
2. **Non-obvious business rules** - Domain-specific logic, regulatory requirements
3. **Workarounds** - Temporary fixes, technical debt, version-specific issues
4. **Security considerations** - Authentication, authorization, data sensitivity
5. **Performance optimizations** - Trade-offs, benchmarks, scaling considerations
6. **Public APIs** - Parameters, return values, exceptions, examples (use language conventions: docstrings, JSDoc)

### Avoid Comments For

- Self-explanatory variable names and simple operations
- Standard language patterns and idioms
- Getter/setter methods without special behavior
- Obvious error handling

## Comment Patterns

### Function/Method Documentation

Use language-appropriate conventions:

**Python (docstrings):**

```python
def calculate_discount(base_price: float, customer_tier: str) -> float:
    """
    Calculate final discount based on customer loyalty.

    Args:
        base_price: Original price before any discounts
        customer_tier: Customer loyalty level ('bronze', 'silver', 'gold')

    Returns:
        Final discount percentage as decimal (0.15 for 15% off)

    Raises:
        ValueError: If customer_tier is invalid

    Note:
        Discounts are multiplicative, not additive.
    """
```

**TypeScript (JSDoc):**

```typescript
/**
 * Calculate final discount based on customer loyalty
 * @param basePrice - Original price before discounts
 * @param customerTier - Customer loyalty level
 * @returns Discount percentage as decimal
 * @throws {ValueError} If customer tier is invalid
 */
function calculateDiscount(basePrice: number, customerTier: string): number {
```

### Inline Comments

```python
# Use inline comments sparingly - explain why, not what
result = complex_calculation()  # Cache for 5 minutes to reduce API calls

# For complex algorithms, explain the approach
# This implements the Knuth-Morris-Pratt algorithm for pattern matching.
# Time complexity: O(n + m) where n is text length, m is pattern length.
def kmp_search(text, pattern):
```

### TODO/FIXME/WARNING

```python
# TODO(2025-02-01): Migrate to new authentication system
# FIXME: Handle edge case when user has multiple active sessions
# WARNING: This method modifies the input array in place
# HACK: Temporary workaround for upstream bug #12345
# NOTE: Performance degrades with >10000 items; consider pagination
```

### Configuration and Magic Numbers

```python
# Maximum retry attempts before marking transaction as failed
# Based on payment gateway SLA of 99.9% availability
MAX_RETRIES = 3

# Timeout in seconds for external API calls
# Set below the 30s gateway timeout to allow for retries
API_TIMEOUT = 25
```

## What NOT to Comment

**Bad examples - these add no value:**

```python
# Set x to 5
x = 5

# Loop through users
for user in users:

# Check if user exists
if user:

# Return the result
return result

# Call the API
response = api.call()
```

**Better - let code speak:**

```python
x = 5  # No comment needed - obvious
for user in users:  # No comment needed - clear loop
if user:  # No comment needed - standard check
return result  # No comment needed
response = api.call()  # No comment needed
```

## Comment Quality Checklist

### Good Comments

- ✅ Explain intent and context
- ✅ Are concise but complete
- ✅ Use proper grammar and spelling
- ✅ Stay synchronized with code changes
- ✅ Add value beyond the code itself
- ✅ Reference external resources when relevant

### Poor Comments

- ❌ State the obvious
- ❌ Contradict the code
- ❌ Are outdated or misleading
- ❌ Use unclear abbreviations
- ❌ Are overly verbose
- ❌ Contain commented-out code without explanation

## Red Flags

Watch out for:

- Comments that apologize for code quality ("this is ugly but...")
- Excessive TODO comments without dates or owners
- Comments that disable linting without explanation
- Contradictions between comments and code
- Comments explaining what good naming would show

## Remember

**Good code is self-documenting. Comments explain what code cannot.**

Focus on:

- Why this approach was chosen
- Non-obvious implications
- Business rules and domain logic
- Performance or security trade-offs
- References to external specifications

Avoid:

- Describing what the code does mechanically
- Redundant information visible in the code
- Generic advice ("always validate inputs")

**When in doubt:** If removing the comment wouldn't make the code harder to understand, remove it. Better naming is better than comments.
