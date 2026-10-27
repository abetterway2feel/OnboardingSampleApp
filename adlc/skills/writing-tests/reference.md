# Testing Reference

Detailed patterns, templates, and organization strategies for test suites.

## Test Organization

### Directory Structure

**Mirror production structure** with clear level separation:

```
src/
├── services/
│   ├── user_service.py
│   └── order_service.py
├── repositories/
│   ├── user_repository.py
│   └── order_repository.py
└── utils/
    └── validators.py

tests/
├── unit/                           # Fast, isolated tests
│   ├── services/
│   │   ├── test_user_service.py
│   │   └── test_order_service.py
│   ├── repositories/
│   │   ├── test_user_repository.py
│   │   └── test_order_repository.py
│   └── utils/
│       └── test_validators.py
├── integration/                    # Component interaction tests
│   ├── test_user_api.py
│   ├── test_order_flow.py
│   └── test_payment_processing.py
├── e2e/                           # Full system tests
│   ├── test_checkout_flow.py
│   ├── test_user_journey.py
│   └── test_admin_workflow.py
└── conftest.py                    # Shared fixtures
```

**Benefits:**

- Easy to find tests for any production file
- Clear separation by test level
- Scalable as codebase grows
- Parallel test execution per directory

### Test Class Organization

Group related tests in classes for better organization:

```python
class TestUserAuthentication:
    """All authentication-related tests"""

    def test_login_with_valid_credentials_returns_token(self):
        ...

    def test_login_with_invalid_password_raises_auth_error(self):
        ...

    def test_login_with_nonexistent_user_raises_not_found(self):
        ...

    def test_login_with_expired_credentials_forces_password_reset(self):
        ...

class TestUserAuthorization:
    """All authorization-related tests"""

    def test_admin_can_delete_users(self):
        ...

    def test_standard_user_cannot_delete_users(self):
        ...

    def test_user_can_only_view_own_data(self):
        ...
```

```typescript
describe('User Authentication', () => {
  describe('login', () => {
    test('returns token when credentials are valid', () => { ... });
    test('raises auth error when password is invalid', () => { ... });
    test('raises not found when user does not exist', () => { ... });
  });

  describe('logout', () => {
    test('invalidates token when user logs out', () => { ... });
    test('clears session data when user logs out', () => { ... });
  });
});
```

## Fast Test Strategies

### In-Memory Databases

```python
# pytest fixture for fast database tests
@pytest.fixture
def db_session():
    """SQLite in-memory database"""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    yield session

    session.close()
```

```typescript
// In-memory database for Node.js tests
import { DataSource } from 'typeorm';

export async function setupTestDB() {
  const dataSource = new DataSource({
    type: 'sqlite',
    database: ':memory:',
    entities: [User, Order, Product],
    synchronize: true
  });

  await dataSource.initialize();
  return dataSource;
}
```

### Parallel Test Execution

```bash
# pytest - use all cores
pytest -n auto

# pytest - specific number of workers
pytest -n 4

# vitest - parallel by default
vitest --threads

# go test - parallel by default
go test -v ./...

# go test - control parallelism
go test -v -parallel 4 ./...
```

### Speed Optimization Patterns

```python
# Use setUpClass for expensive one-time setup (use sparingly)
class TestUserAPI:
    @classmethod
    def setUpClass(cls):
        """Run once for all tests in class"""
        cls.app = create_test_app()

    def setUp(self):
        """Run before each test"""
        self.client = self.app.test_client()

# But prefer independent tests with fixtures
@pytest.fixture(scope="session")
def app():
    """Create app once per test session"""
    return create_test_app()

@pytest.fixture
def client(app):
    """Fresh client for each test"""
    return app.test_client()
```

## Assertion Patterns

### Descriptive Failure Messages

```python
# Python
assert user.email == "alice@example.com", \
    f"Expected email 'alice@example.com', got '{user.email}'"

assert order.status == OrderStatus.PAID, \
    f"Order should be PAID after payment, got {order.status}"

assert len(results) > 0, \
    f"Search for '{query}' should return results, got {len(results)}"
```

```typescript
// TypeScript - use custom messages when helpful
expect(user.email).toBe('alice@example.com');  // Built-in message usually OK

// Custom message for complex assertions
expect(order.status).toBe(OrderStatus.PAID,
  `Order should be PAID after successful payment, got ${order.status}`);
```

### Multiple Assertions for Same Behavior

```python
def test_user_creation_populates_all_required_fields():
    """Single behavior: user creation sets fields correctly"""
    user = create_user({"email": "alice@example.com", "name": "Alice"})

    # All assertions verify the same behavior (field population)
    assert user.id is not None, "User ID should be generated"
    assert user.email == "alice@example.com", "Email should match input"
    assert user.name == "Alice", "Name should match input"
    assert user.created_at is not None, "Timestamp should be set"
    assert user.role == UserRole.STANDARD, "Default role should be STANDARD"
```

## Mocking Patterns

### When to Mock (Decision Tree)

```
Is it an external API or service?
├─ YES → Mock it (network calls are slow/unreliable)
└─ NO → Is it a slow operation (>10ms)?
    ├─ YES → Consider mocking (file I/O, complex computation)
    └─ NO → Is it non-deterministic (random, time)?
        ├─ YES → Mock it (tests must be reproducible)
        └─ NO → Is it a side effect you don't want?
            ├─ YES → Mock it (sending emails, charging cards)
            └─ NO → DON'T MOCK - use real implementation
```

### Mock Complete Structures

```python
# Complete API response mock
mock_api_response = {
    "status": "success",
    "data": {
        "user_id": "123",
        "name": "Alice",
        "email": "alice@example.com",
        "role": "standard"
    },
    "metadata": {
        "request_id": "req-789",
        "timestamp": "2024-01-01T00:00:00Z",
        "version": "v1"
    },
    "links": {
        "self": "/api/users/123",
        "profile": "/api/users/123/profile"
    }
}
# Include ALL fields real API returns
```

### Test Doubles Spectrum

**Dummy:** Passed but never used

```python
def test_log_error_with_context():
    dummy_request = None  # Passed but not used in this test path
    log_error("Error message", request=dummy_request)
```

**Stub:** Returns canned responses

```python
class StubUserRepository:
    def get_by_id(self, user_id):
        return User(id=user_id, name="Alice")  # Always returns same user
```

**Spy:** Records interactions

```python
class SpyEmailService:
    def __init__(self):
        self.sent_emails = []

    def send(self, to, subject, body):
        self.sent_emails.append({"to": to, "subject": subject, "body": body})
```

**Mock:** Expectations and verifications

```python
mock_payment_gateway = Mock()
mock_payment_gateway.charge.return_value = {"status": "success", "transaction_id": "txn-123"}

process_payment(order, mock_payment_gateway)

mock_payment_gateway.charge.assert_called_once_with(
    amount=order.total,
    currency="USD"
)
```

**Fake:** Simplified working implementation

```python
class FakeDatabase:
    """In-memory database for testing"""
    def __init__(self):
        self.users = {}

    def create(self, user):
        self.users[user.id] = user
        return user

    def get_by_id(self, user_id):
        return self.users.get(user_id)
```

Use the simplest that works: Fake > Stub > Mock

## Test Data Builders

For complex test data, use builders:

```python
# test_builders.py
class UserBuilder:
    def __init__(self):
        self.user = {
            "email": "default@example.com",
            "name": "Default User",
            "role": UserRole.STANDARD,
            "is_premium": False
        }

    def with_email(self, email):
        self.user["email"] = email
        return self

    def with_name(self, name):
        self.user["name"] = name
        return self

    def as_premium(self):
        self.user["is_premium"] = True
        return self

    def as_admin(self):
        self.user["role"] = UserRole.ADMIN
        return self

    def build(self):
        return User(**self.user)

# Usage in tests
def test_premium_user_gets_free_shipping():
    user = UserBuilder().as_premium().build()
    cost = calculate_shipping_cost(order, user, method)
    assert cost == 0

def test_admin_can_view_all_users():
    admin = UserBuilder().as_admin().with_email("admin@example.com").build()
    users = get_all_users(actor=admin)
    assert len(users) > 0
```

```typescript
// UserBuilder.ts
export class UserBuilder {
  private user = {
    id: 'user-123',
    email: 'default@example.com',
    name: 'Default User',
    role: UserRole.STANDARD,
    isPremium: false
  };

  withEmail(email: string) {
    this.user.email = email;
    return this;
  }

  withName(name: string) {
    this.user.name = name;
    return this;
  }

  asPremium() {
    this.user.isPremium = true;
    return this;
  }

  asAdmin() {
    this.user.role = UserRole.ADMIN;
    return this;
  }

  build(): User {
    return { ...this.user };
  }
}

// Usage
const user = new UserBuilder().asPremium().build();
const admin = new UserBuilder().asAdmin().withEmail('admin@example.com').build();
```

## Test Configuration

### pytest Configuration

```ini
# pytest.ini
[pytest]
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*

# Warnings
filterwarnings =
    error
    ignore::DeprecationWarning

# Coverage
addopts =
    --strict-markers
    --tb=short
    --cov=src
    --cov-report=term-missing
    --cov-report=html
    --cov-fail-under=80

markers =
    unit: Unit tests (fast, no external dependencies)
    integration: Integration tests (database, services)
    e2e: End-to-end tests (full system)
    slow: Tests that take > 1 second
```

### Vitest Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.test.ts',
        '**/*.spec.ts'
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80
      }
    },
    include: ['src/**/*.test.ts'],
    exclude: ['tests/e2e/**']
  }
});
```

## Continuous Integration

### Run Tests in Layers

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run unit tests
        run: just test
        timeout-minutes: 2  # Should be fast!

  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests  # Only run if unit tests pass
    steps:
      - uses: actions/checkout@v3
      - name: Run integration tests
        run: just test-integration
        timeout-minutes: 5

  e2e-tests:
    runs-on: ubuntu-latest
    needs: integration-tests  # Only run if integration tests pass
    steps:
      - uses: actions/checkout@v3
      - name: Run E2E tests
        run: just test-e2e
        timeout-minutes: 10
```

**Benefits:**

- Fast feedback (unit tests run first)
- Save CI time (don't run slow tests if fast tests fail)
- Clear failure attribution

## Testing Checklist by Feature Type

### New Feature Checklist

- [ ] Unit tests for business logic
- [ ] Unit tests for validation rules
- [ ] Unit tests for calculations/transformations
- [ ] Integration tests for service interactions
- [ ] Integration tests for database operations
- [ ] E2E test for critical user flow (if user-facing)
- [ ] Tests for error cases
- [ ] Tests for edge cases

### Bug Fix Checklist

- [ ] Write failing test reproducing the bug
- [ ] Verify test fails with current code
- [ ] Fix the bug
- [ ] Verify test passes
- [ ] Add tests for related edge cases
- [ ] Run full test suite to check for regressions

### Refactoring Checklist

- [ ] All existing tests still pass
- [ ] No new tests needed (behavior unchanged)
- [ ] Tests run at same speed or faster
- [ ] Coverage maintained or improved

## Performance Benchmarks

### Target Test Speeds

```
Unit Tests:
  ✓ < 5ms: Excellent
  ✓ 5-10ms: Good
  ⚠ 10-50ms: Acceptable (but investigate)
  ✗ > 50ms: Too slow (not a unit test)

Integration Tests:
  ✓ < 50ms: Excellent
  ✓ 50-100ms: Good
  ⚠ 100-500ms: Acceptable
  ✗ > 500ms: Too slow (consider optimization)

E2E Tests:
  ✓ < 2s: Excellent
  ✓ 2-5s: Good
  ⚠ 5-10s: Acceptable
  ✗ > 10s: Too slow (optimize or split)
```

### Speed Optimization Techniques

1. **Use fixtures with appropriate scope**

   ```python
   @pytest.fixture(scope="session")  # Once per test session
   def app():
       return create_app()

   @pytest.fixture(scope="module")  # Once per test module
   def db_engine():
       return create_engine("sqlite:///:memory:")

   @pytest.fixture(scope="function")  # Once per test (default)
   def db_session(db_engine):
       return create_session(db_engine)
   ```

2. **Lazy loading in fixtures**

   ```python
   @pytest.fixture
   def user(db_session):
       """Create user only if test uses it"""
       def _create_user(**kwargs):
           return UserFactory.create(**kwargs)
       return _create_user
   ```

3. **Transaction rollback for database tests**

   ```python
   @pytest.fixture
   def db_session():
       session = Session()
       session.begin_nested()
       yield session
       session.rollback()  # Rollback after test (faster than delete)
   ```

## Don't Test the Framework

**Trust your framework works correctly.**

```python
# ❌ Don't test pytest fixtures work
def test_db_session_fixture(db_session):
    assert db_session is not None  # Useless

# ❌ Don't test SQLAlchemy saves data
def test_database_saves_user(db_session):
    user = User(email="alice@example.com")
    db_session.add(user)
    db_session.commit()
    assert db_session.query(User).count() == 1  # Testing ORM!

# ✅ Test YOUR logic
def test_user_service_validates_duplicate_email(db_session):
    service = UserService(db_session)
    service.create({"email": "alice@example.com", "name": "Alice"})

    with pytest.raises(ValidationError, match="Email already exists"):
        service.create({"email": "alice@example.com", "name": "Bob"})
```

**What not to test:**

- Framework features (routing, ORM, validation libraries)
- Standard library functions
- Third-party library behavior
- Language features

**What to test:**

- Your business logic
- How you USE the framework
- Your validation rules
- Your data transformations

## Test Naming Conventions

### File Naming

```
Python:
  test_*.py or *_test.py
  Example: test_user_service.py, user_service_test.py

TypeScript/JavaScript:
  *.test.ts, *.spec.ts, *.test.tsx
  Example: UserService.test.ts, Button.spec.tsx

Go:
  *_test.go
  Example: user_service_test.go

Rust:
  Tests in same file or tests/ directory
  #[cfg(test)] module
```

### Test Function Naming

```python
# Pytest style - descriptive snake_case
def test_user_login_with_valid_credentials_returns_token():
def test_order_total_calculation_includes_tax_and_shipping():
def test_empty_cart_checkout_raises_empty_cart_error():

# Unittest style - similar but in class
class TestOrderProcessing(unittest.TestCase):
    def test_order_total_calculation_includes_tax(self):
    def test_order_cannot_be_placed_with_empty_cart(self):
```

```typescript
// Jest/Vitest - descriptive camelCase or sentence
test('user login with valid credentials returns token', () => { ... });
test('order total calculation includes tax and shipping', () => { ... });

// BDD style
it('should return token when credentials are valid', () => { ... });
it('should include tax in total calculation', () => { ... });
```

```go
// Go - TestFunctionName_Scenario
func TestUserLogin_ValidCredentials_ReturnsToken(t *testing.T) { ... }
func TestOrderTotal_IncludesTaxAndShipping(t *testing.T) { ... }
```

## Coverage Tools

### Generate Coverage Reports

```bash
# Python
pytest --cov=src --cov-report=html
open htmlcov/index.html

# TypeScript/JavaScript
vitest --coverage
open coverage/index.html

# Go
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out

# Rust
cargo tarpaulin --out Html
```

### Interpreting Coverage

**Green (covered):** Code executed by tests
**Red (not covered):** Code never executed
**Yellow (partially covered):** Branch/condition not fully tested

**Focus on:**

- Red in critical paths → write tests
- Red in complex functions → write tests
- Red in trivial code → probably OK to skip
- Yellow → add tests for uncovered branches

**Don't:**

- Chase 100% just to hit a number
- Test trivial getters/setters for coverage
- Test generated or framework code

---

**See [examples.md](examples.md) for comprehensive code examples and [anti-patterns.md](anti-patterns.md) for common mistakes.**
