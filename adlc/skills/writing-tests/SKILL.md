---
name: writing-tests
description: Comprehensive guide for writing effective tests at the right levels with clear structure, behavior focus, and appropriate coverage - use when writing or changing tests to ensure quality and maintainability
when_to_use: when writing new tests, refactoring test suites, or reviewing test quality
version: 2.0.0
---

# Writing Effective Tests

**Core principle:** Tests are documentation that executes. Write tests that tell a story, verify behavior, and provide fast feedback.

## Philosophy

> "Tests should tell you what broke without reading the implementation." - Kent Beck

Good tests:

- Document expected behavior through clear names
- Verify "what" the code does, not "how" it does it
- Run independently and in any order
- Provide fast feedback
- Focus on one behavior at a time

## Quick Start: The Essentials

### 1. Structure Every Test with AAA

**Arrange-Act-Assert** makes tests scannable and predictable:

```python
def test_user_creation_generates_unique_id():
    # Arrange - Set up your data
    user_data = {"email": "alice@example.com", "name": "Alice"}

    # Act - Perform the action
    user = create_user(user_data)

    # Assert - Verify the outcome
    assert user.id is not None
    assert isinstance(user.id, str)
```

### 2. Name Tests Like Stories

Complete the sentence: "It should..."

```python
# ✅ Good - tells what broke
def test_user_login_with_invalid_password_raises_auth_error():

# ❌ Bad - doesn't explain behavior
def test_login():
```

**Rule:** If the name doesn't tell you what broke when it fails, rename it.

### 3. Test at the Right Level

**Avoid testing the same flow at all levels!** Each level tests different aspects:

| Level | What to Test | Speed | Example |
|-------|-------------|-------|---------|
| **Unit** | Pure logic, no dependencies | < 10ms | Email validation, calculations |
| **Integration** | Service interactions | 10-100ms | Service + database, component + state |
| **E2E** | Critical user flows | seconds | Complete checkout, registration → login |

**Example - User Registration (No Duplication):**

- **Unit:** Test email validation logic, password hashing logic
- **Integration:** Test UserService creates user in database
- **E2E:** Test complete registration → login flow from UI

### 4. Test Behavior, Not Implementation

Focus on **what** happens, not **how** it happens:

```python
# ✅ Good - tests behavior
def test_order_marked_as_paid_after_successful_payment():
    order = create_unpaid_order()
    process_payment(order, payment)
    assert order.status == OrderStatus.PAID  # What happened

# ❌ Bad - tests implementation
def test_process_payment_calls_gateway():
    mock_gateway = Mock()
    process_payment(order, mock_gateway)
    mock_gateway.charge.assert_called_once()  # How it happened
```

**Rule:** If test breaks when you refactor without changing behavior, it's testing implementation.

### 5. Keep Tests Independent

Each test runs successfully alone and in any order:

```python
# ✅ Good - self-contained
def test_find_user_by_email(self, service):
    service.create({"email": "bob@example.com", "name": "Bob"})  # Own setup
    user = service.find_by_email("bob@example.com")
    assert user.name == "Bob"

# ❌ Bad - depends on other test
def test_2_find_user(self):
    user = service.find_by_email(self.user.email)  # Needs test_1!
```

## Test Level Strategy

**Critical:** Don't duplicate the same test across levels. Test different aspects at each level.

### Unit Tests - Pure Logic

**What:** Validation, calculations, transformations, business rules
**Why:** Fast feedback (< 10ms), no setup needed
**Mock:** Usually nothing - pure logic has no dependencies

```python
def test_calculate_shipping_cost_premium_user_gets_discount():
    # Pure calculation - no database, no API
    user = User(is_premium=True)
    cost = calculate_shipping_cost(order_total=50, user=user)
    assert cost == 5.00  # 50% discount
```

### Integration Tests - Component Interactions

**What:** Service + repository, API + database, component + state
**Why:** Verify components work together correctly
**Mock:** Only external boundaries (APIs, email services)

```python
def test_user_service_prevents_duplicate_email(db_session):
    # Real service + real database
    service = UserService(db_session)
    service.create({"email": "alice@example.com", "name": "Alice"})

    with pytest.raises(ValidationError, match="Email already exists"):
        service.create({"email": "alice@example.com", "name": "Bob"})
```

### E2E Tests - Critical Flows Only

**What:** Complete user journeys, business-critical paths
**Why:** Ensure system works end-to-end from user perspective
**How Many:** Few tests - only critical flows

```typescript
test('user can complete purchase', async ({ page }) => {
  await page.goto('/products');
  await page.click('text=Add to Cart');
  await page.click('text=Checkout');
  await page.fill('[name=cardNumber]', '4242424242424242');
  await page.click('text=Complete Purchase');
  await expect(page.locator('text=Order confirmed')).toBeVisible();
});
```

## Coverage and Complexity

### Coverage by Priority

- **Critical paths** (auth, payments, data integrity): 100%
- **Business logic**: 90%+
- **Utilities**: 80%+
- **UI components**: 70%+ (behavior, not every render path)

**Don't chase 100% everywhere** - focus on complex, critical code.

### Complexity-Driven Testing

**Simple function (1-2 paths):** One test covers both
**Complex function (many paths):** Multiple tests for different scenarios

More complexity = more tests.

## Best Practices Checklist

Before submitting tests:

- [ ] Test names clearly describe behavior being verified
- [ ] Tests follow AAA structure (Arrange-Act-Assert)
- [ ] Tests verify behavior, not implementation
- [ ] Each test runs independently
- [ ] One logical assertion per test
- [ ] Unit tests are fast (< 10ms)
- [ ] Mocks used only at external boundaries
- [ ] No test-only methods in production code
- [ ] Tests at appropriate levels (unit/integration/e2e)
- [ ] **No duplicate coverage across test levels**

## When to Use This Skill

**Use this skill when:**

- Writing new tests for any feature
- Refactoring existing test suites
- Reviewing test quality
- Planning testing strategy for a feature
- Debugging why tests are slow or brittle

**The skill will guide you on:**

- Choosing the right test level
- Writing clear, maintainable tests
- Avoiding common pitfalls
- Structuring test suites effectively

## Supporting Documentation

This skill includes detailed supporting documentation:

- **[examples.md](examples.md)** - Comprehensive code examples across languages and test levels
- **[reference.md](reference.md)** - Detailed patterns, templates, and organization strategies
- **[anti-patterns.md](anti-patterns.md)** - Common mistakes and how to avoid them

Claude will read these files when needed based on your questions and context.

## Quick Reference

| Principle | Do | Don't |
|-----------|-----|-------|
| **Naming** | `test_user_login_with_invalid_password_raises_error` | `test_login` |
| **Structure** | Arrange-Act-Assert | Mixed setup and assertions |
| **Focus** | Test behavior (what) | Test implementation (how) |
| **Independence** | Each test self-contained | Tests depend on each other |
| **Speed** | Unit < 10ms | All tests slow |
| **Mocking** | Mock external boundaries | Mock your own services |
| **Coverage** | Focus on complex/critical | Chase 100% everywhere |
| **Levels** | Different aspects per level | Same test at all levels |

## Red Flags

Watch out for these warning signs:

- ❌ Test names don't explain what's being tested
- ❌ Tests depend on execution order
- ❌ Mocking your own service layer
- ❌ Test breaks on refactor without behavior change
- ❌ Mock setup is 50%+ of the test
- ❌ Tests take seconds (should be milliseconds for unit tests)
- ❌ One test failure causes cascade of failures
- ❌ Testing framework features instead of your code

## Remember

**Tests are documentation that executes.**

Good tests:

- Tell you what broke when they fail
- Document expected behavior
- Provide confidence to refactor
- Run fast enough to use constantly
- Focus on behavior, not implementation
- Test at the right level

**When in doubt:** Write the test you'd want to read when debugging at 3am.

---

**For comprehensive examples and detailed patterns, see the supporting files in this skill directory.**
