# Testing Anti-Patterns

One recognizable bad shape → the fix → a one-line **Gate** to catch it before you write it.
Core principles: [SKILL.md](SKILL.md). Fuller examples: [examples.md](examples.md).

## 1. Testing mock behavior

Asserting a mock exists verifies the mock, not your code — it tells you nothing about real behaviour.

```typescript
// ❌ expect(screen.getByTestId('sidebar-mock')).toBeInTheDocument()
// ✅ render the real component; assert behaviour: getByRole('navigation')
```

**Gate:** Asserting on a mock element? Test real behaviour, or unmock it.

## 2. Test-only methods in production

A method only tests call (e.g. `Session.destroy()`) pollutes the production class, is dangerous if called for real, and confuses object with entity lifecycle.

**Fix:** Put test cleanup in test utilities (`cleanup_session(session)`), not on the production class.

**Gate:** Method only used by tests? Move it to test utilities. Class doesn't own the resource's lifecycle? Wrong class.

## 3. Mocking without understanding

Mocking a method that has a side effect the test depends on (e.g. writing config) makes the test pass or fail for the wrong reason.

```typescript
// ❌ vi.mock('ToolCatalog', ...)  // also kills the config write the test relies on
// ✅ vi.mock('MCPServerManager')  // mock only the slow server startup
```

**Gate:** Before mocking, know the real method's side effects and whether the test depends on them. Unsure? Run with the real implementation first, then mock minimally at the lowest level.

## 4. Incomplete mocks

A partial mock (only the fields you think you need) fails silently when downstream code reads an omitted field (`response.metadata.requestId`).

**Fix:** Mirror the real response schema completely — every field the system might consume.

**Gate:** Creating a mock response? Include all documented fields; if you don't understand the whole structure, don't fake it.

## 5. Testing implementation details

Asserting on a private method (`service._validate_email.assert_called_once()`) couples the test to internals and breaks on refactors that don't change behaviour.

```python
# ✅ assert public behaviour instead
with pytest.raises(ValidationError, match="Invalid email"):
    service.create({"email": "not-an-email"})
```

**Gate:** If the test breaks when you refactor without changing behaviour, it's testing implementation — rewrite it against public behaviour.

## 6. Over-mocking

```python
# ❌ setup dwarfs the code under test
@patch('UserService') @patch('EmailService') @patch('Database') @patch('Cache') @patch('Logger')
def test_registration(...):  # 20 lines of mock wiring
```

Mock setup larger than the logic means you're testing wiring, not interactions — and it's brittle.

**Fix:** Integration test with real components; mock only true external boundaries (payment API, email). Use in-memory DB/cache.

**Gate:** More than 2–3 mocks, or mock setup > test logic? Rewrite as an integration test.

## 7. Coupled tests

```python
# ❌ shared state, order-dependent
def test_1_create(self): self.user = service.create(...)
def test_2_update(self): service.update(self.user.id, ...)  # needs test_1
```

Order-dependent tests can't run in isolation or parallel, and one failure cascades.

**Fix:** Each test creates its own fresh data (fixtures / per-test setup).

**Gate:** Using `self.*`/class state another test relies on? Tests are coupled — make each self-contained.

## 8. Testing multiple behaviors

One `test_user_crud_operations()` doing create+read+update+delete hides which behaviour broke, and stops at the first failed assertion.

**Fix:** One behaviour per test (`test_create_generates_id`, `test_update_changes_name`, …).

**Gate:** More than one *unrelated* behaviour under test? Split. (Multiple assertions on the *same* behaviour are fine.)

## 9. Slow unit tests

A "unit" test that hits the database (~100ms) isn't a unit test — slow feedback means tests run less often.

**Fix:** Test pure logic directly (`validate_email("bad")` → raises), no DB/network.

**Gate:** Unit test > ~50ms? Extract the logic, mock the network, or reclassify it as integration. Target < 10ms.

## 10. Test duplication across levels

The same registration flow asserted at unit, integration, and e2e is triple maintenance with no added value.

**Fix — test a different aspect at each level:**
- **Unit:** logic correctness (email validation, password hashing)
- **Integration:** component interactions (service persists to DB)
- **E2E:** the user journey (register → logout → login)

**Gate:** Behaviour already covered at another level? Only add a test if it verifies a *different* aspect.

## 11. Testing the framework

```python
# ❌ db_session.add(User(...)); assert db_session.query(User).count() == 1  # only the ORM/fixture
# ❌ expect(container.firstChild).toBeInTheDocument()  # tests React renders
```

The framework is already tested by its maintainers — this is false coverage. (Asserting a record *your code* persisted — e.g. querying the DB after calling the registration endpoint — is a valid integration/acceptance assertion; it verifies an application outcome, not the framework.)

**Fix:** Test *your* logic through the framework (duplicate-email rejection, button loading state).

**Gate:** Does the test only prove a fixture/ORM/framework or stdlib function works, with no application code exercised? Delete it.

## 12. Trivial / no-op assertions

```python
# ❌ assert True          # placeholder that can never fail
# ❌ assert user          # bare truthiness — passes for almost any object
```

A test that can't fail can't catch a regression, yet it counts as coverage.

```python
# ✅ assert the observable outcome
assert order.status == OrderStatus.PAID
assert user.id is not None and user.email == "alice@example.com"
```

**Gate:** Could this assertion fail if the code were wrong? If it's `assert True`, a bare truthiness check, or a compare against an unrelated literal — it verifies nothing. Bind every test to an observable result (return value, state change, or raised error).

---

**See [SKILL.md](SKILL.md) for core principles and [examples.md](examples.md) for comprehensive code examples.**
