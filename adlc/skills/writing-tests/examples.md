# Testing Examples

Comprehensive code examples demonstrating effective test writing across languages and test levels.

## Table of Contents

- [Unit Test Examples](#unit-test-examples)
- [Integration Test Examples](#integration-test-examples)
- [E2E Test Examples](#e2e-test-examples)
- [Avoiding Test Duplication](#avoiding-test-duplication)
- [Common Patterns](#common-patterns)

## Unit Test Examples

### Python - Pure Logic

```python
def test_calculate_order_total_with_tax():
    # Arrange
    items = [
        Item(price=10.00, quantity=2),
        Item(price=5.00, quantity=1)
    ]
    tax_rate = 0.08

    # Act
    total = calculate_total(items, tax_rate)

    # Assert
    assert total == Decimal('27.00')  # (10*2 + 5) * 1.08

def test_calculate_shipping_cost_premium_user_gets_discount():
    # Arrange
    user = User(is_premium=True)
    order = Order(total=50.00)
    shipping_method = ShippingMethod(base_cost=10.00)

    # Act
    cost = calculate_shipping_cost(order, user, shipping_method)

    # Assert
    assert cost == 5.00  # 50% discount for premium users
```

### TypeScript/JavaScript - Pure Logic

```typescript
test('calculate order total with tax', () => {
  // Arrange
  const items = [
    { price: 10.00, quantity: 2 },
    { price: 5.00, quantity: 1 }
  ];
  const taxRate = 0.08;

  // Act
  const total = calculateTotal(items, taxRate);

  // Assert
  expect(total).toBe(27.00); // (10*2 + 5) * 1.08
});

test('validate email format rejects invalid emails', () => {
  // Arrange
  const invalidEmails = ['notanemail', 'missing@domain', '@example.com'];

  // Act & Assert
  invalidEmails.forEach(email => {
    expect(() => validateEmail(email)).toThrow(ValidationError);
  });
});
```

### Go - Pure Logic

```go
func TestCalculateOrderTotal(t *testing.T) {
    // Arrange
    items := []Item{
        {Price: 10.00, Quantity: 2},
        {Price: 5.00, Quantity: 1},
    }
    taxRate := 0.08

    // Act
    total := CalculateTotal(items, taxRate)

    // Assert
    expected := 27.00
    if total != expected {
        t.Errorf("Expected total %v, got %v", expected, total)
    }
}
```

## Integration Test Examples

### Python - Database Operations

```python
def test_user_repository_creates_and_retrieves_user(db_session):
    # Arrange
    repo = UserRepository(db_session)
    user_data = UserCreate(email="alice@example.com", name="Alice")

    # Act
    created_user = repo.create(user_data)
    retrieved_user = repo.get_by_id(created_user.id)

    # Assert
    assert retrieved_user.id == created_user.id
    assert retrieved_user.email == "alice@example.com"
    assert retrieved_user.name == "Alice"

def test_user_service_prevents_duplicate_email(db_session):
    # Arrange
    service = UserService(db_session)
    service.create({"email": "alice@example.com", "name": "Alice"})

    # Act & Assert
    with pytest.raises(ValidationError, match="Email already exists"):
        service.create({"email": "alice@example.com", "name": "Bob"})
```

### TypeScript - React Component with State

```typescript
test('shopping cart updates total when items added', () => {
  // Arrange
  render(<ShoppingCart />);

  // Act
  fireEvent.click(screen.getByText('Add Item 1 ($10)'));
  fireEvent.click(screen.getByText('Add Item 2 ($15)'));

  // Assert
  expect(screen.getByText('Total: $25.00')).toBeInTheDocument();
});

test('shopping cart shows empty state when no items', () => {
  // Arrange & Act
  render(<ShoppingCart />);

  // Assert
  expect(screen.getByText('Your cart is empty')).toBeInTheDocument();
  expect(screen.queryByText('Checkout')).not.toBeInTheDocument();
});
```

### Go - Service with Database

```go
func TestUserService_CreateUser(t *testing.T) {
    // Arrange
    db := setupTestDB(t)
    defer db.Close()
    service := NewUserService(db)

    userData := UserCreate{
        Email: "alice@example.com",
        Name:  "Alice",
    }

    // Act
    user, err := service.Create(userData)

    // Assert
    if err != nil {
        t.Fatalf("Expected no error, got %v", err)
    }
    if user.ID == "" {
        t.Error("Expected user ID to be set")
    }
    if user.Email != userData.Email {
        t.Errorf("Expected email %v, got %v", userData.Email, user.Email)
    }
}
```

## E2E Test Examples

### Playwright - Complete User Flow

```typescript
test('user can complete checkout flow', async ({ page }) => {
  // Arrange
  await page.goto('/products');

  // Act
  await page.click('text=Add to Cart');
  await page.click('text=Checkout');
  await page.fill('[name=email]', 'customer@example.com');
  await page.fill('[name=cardNumber]', '4242424242424242');
  await page.fill('[name=expiry]', '12/25');
  await page.fill('[name=cvc]', '123');
  await page.click('text=Complete Purchase');

  // Assert
  await expect(page.locator('text=Order confirmed')).toBeVisible();
  await expect(page.locator('text=Order #')).toBeVisible();
  await expect(page.locator('text=customer@example.com')).toBeVisible();
});

test('user registration and login flow works', async ({ page }) => {
  // Arrange
  const email = `test-${Date.now()}@example.com`;

  // Act - Register
  await page.goto('/register');
  await page.fill('[name=email]', email);
  await page.fill('[name=password]', 'secret123');
  await page.fill('[name=name]', 'Test User');
  await page.click('text=Register');

  // Assert registration worked
  await expect(page.locator('text=Welcome')).toBeVisible();

  // Act - Logout and login
  await page.click('text=Logout');
  await page.fill('[name=email]', email);
  await page.fill('[name=password]', 'secret123');
  await page.click('text=Login');

  // Assert login worked
  await expect(page.locator('text=Welcome back')).toBeVisible();
});
```

## Avoiding Test Duplication

### Example: User Registration Across Levels

**Don't test the same flow at all levels!** Each level tests different aspects.

```python
# ═══════════════════════════════════════════════════════════════
# UNIT TESTS - Business logic only
# ═══════════════════════════════════════════════════════════════

def test_registration_validates_email_format():
    """Test email validation logic in isolation"""
    with pytest.raises(ValidationError):
        validate_user_data({"email": "invalid-email", "name": "Alice"})

def test_registration_validates_password_strength():
    """Test password validation logic"""
    with pytest.raises(ValidationError, match="Password too weak"):
        validate_password("123")  # Too short

def test_registration_hashes_password():
    """Test password hashing logic"""
    password = "secret123"
    hashed = hash_password(password)
    assert hashed != password
    assert verify_password(password, hashed)

# ═══════════════════════════════════════════════════════════════
# INTEGRATION TESTS - Service + Database
# ═══════════════════════════════════════════════════════════════

def test_user_service_creates_user_in_database(db_session):
    """Test UserService correctly uses UserRepository and persists"""
    service = UserService(db_session)
    user = service.register({
        "email": "alice@example.com",
        "password": "secret123",
        "name": "Alice"
    })

    # Verify user persisted with hashed password
    db_user = db_session.query(User).filter_by(id=user.id).first()
    assert db_user is not None
    assert db_user.password != "secret123"  # Password was hashed
    assert verify_password("secret123", db_user.password)  # But verifies correctly

def test_user_service_prevents_duplicate_email(db_session):
    """Test duplicate detection works via database constraint"""
    service = UserService(db_session)
    service.register({"email": "alice@example.com", "password": "secret123", "name": "Alice"})

    with pytest.raises(ValidationError, match="Email already exists"):
        service.register({"email": "alice@example.com", "password": "other", "name": "Bob"})

# ═══════════════════════════════════════════════════════════════
# E2E TESTS - Complete user journey from UI
# ═══════════════════════════════════════════════════════════════

def test_user_can_register_and_login(browser):
    """Test complete registration → login flow from UI perspective"""
    # Act - Register
    browser.goto('/register')
    browser.fill('[name=email]', 'alice@example.com')
    browser.fill('[name=password]', 'secret123')
    browser.fill('[name=name]', 'Alice')
    browser.click('text=Register')

    # Assert registration success
    assert browser.is_visible('text=Welcome, Alice')

    # Act - Logout
    browser.click('text=Logout')

    # Act - Login with new account
    browser.fill('[name=email]', 'alice@example.com')
    browser.fill('[name=password]', 'secret123')
    browser.click('text=Login')

    # Assert login success
    assert browser.is_visible('text=Welcome back, Alice')
```

**Key Differences:**

- **Unit:** Validation logic, hashing logic (pure functions)
- **Integration:** Service + database interaction, duplicate detection
- **E2E:** User experience through UI (registration → logout → login)

**No duplication:** Each level validates different concerns.

## Common Patterns

### Testing Exceptions

```python
# Python
def test_create_user_with_duplicate_email_raises_validation_error():
    service.create({"email": "alice@example.com", "name": "Alice"})

    with pytest.raises(ValidationError, match="Email already exists"):
        service.create({"email": "alice@example.com", "name": "Bob"})
```

```typescript
// TypeScript
test('create user with duplicate email throws validation error', () => {
  service.create({ email: 'alice@example.com', name: 'Alice' });

  expect(() => {
    service.create({ email: 'alice@example.com', name: 'Bob' });
  }).toThrow('Email already exists');
});
```

```go
// Go
func TestCreateUser_DuplicateEmail(t *testing.T) {
    service.Create(UserCreate{Email: "alice@example.com", Name: "Alice"})

    _, err := service.Create(UserCreate{Email: "alice@example.com", Name: "Bob"})
    if err == nil {
        t.Fatal("Expected validation error for duplicate email")
    }
    if !errors.Is(err, ErrDuplicateEmail) {
        t.Errorf("Expected ErrDuplicateEmail, got %v", err)
    }
}
```

### Testing Async Operations

```python
# Python
@pytest.mark.asyncio
async def test_fetch_user_data_from_api():
    # Arrange
    user_id = "123"

    # Act
    user = await fetch_user_data(user_id)

    # Assert
    assert user.id == user_id
    assert user.name is not None
```

```typescript
// TypeScript
test('fetch user data from API', async () => {
  // Arrange
  const userId = '123';

  // Act
  const user = await fetchUserData(userId);

  // Assert
  expect(user.id).toBe(userId);
  expect(user.name).toBeDefined();
});
```

### Testing Side Effects

```python
def test_user_creation_sends_welcome_email(mock_email_service):
    # Arrange
    user_data = {"email": "alice@example.com", "name": "Alice"}

    # Act
    user = create_user(user_data)

    # Assert - verify side effect occurred
    mock_email_service.send.assert_called_once_with(
        to="alice@example.com",
        subject="Welcome!",
        template="welcome"
    )
```

```typescript
test('user creation sends welcome email', () => {
  // Arrange
  const emailService = jest.fn();
  const userData = { email: 'alice@example.com', name: 'Alice' };

  // Act
  createUser(userData, emailService);

  // Assert
  expect(emailService).toHaveBeenCalledWith({
    to: 'alice@example.com',
    subject: 'Welcome!',
    template: 'welcome'
  });
});
```

### Using Fixtures

```python
# conftest.py - Shared fixtures
@pytest.fixture
def sample_user():
    """Standard user for testing"""
    return User(
        id="user-123",
        email="alice@example.com",
        name="Alice",
        role=UserRole.STANDARD
    )

@pytest.fixture
def admin_user():
    """Admin user for permission testing"""
    return User(
        id="admin-456",
        email="admin@example.com",
        name="Admin",
        role=UserRole.ADMIN
    )

@pytest.fixture
def db_session():
    """In-memory database for fast tests"""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()

# In tests
def test_standard_user_cannot_delete_others(sample_user):
    with pytest.raises(PermissionError):
        delete_user(user_id="other-789", actor=sample_user)

def test_admin_can_delete_any_user(admin_user):
    result = delete_user(user_id="other-789", actor=admin_user)
    assert result.success is True
```

```typescript
// test-utils.ts - Shared utilities
export function createMockUser(overrides = {}) {
  return {
    id: 'user-123',
    email: 'alice@example.com',
    name: 'Alice',
    role: UserRole.STANDARD,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides
  };
}

export function setupTestDB() {
  return new InMemoryDatabase();
}

// In tests
test('standard user cannot delete others', () => {
  const user = createMockUser();
  expect(() => deleteUser('other-789', user)).toThrow(PermissionError);
});

test('admin can delete any user', () => {
  const admin = createMockUser({ role: UserRole.ADMIN });
  const result = deleteUser('other-789', admin);
  expect(result.success).toBe(true);
});
```

### Complexity-Driven Testing Example

```python
# Simple function - one test sufficient
def get_user_display_name(user):
    """Simple logic - one test covers both paths"""
    return user.name or user.email.split('@')[0]

def test_get_user_display_name():
    # Test with name
    user1 = User(name="Alice", email="alice@example.com")
    assert get_user_display_name(user1) == "Alice"

    # Test without name
    user2 = User(name=None, email="bob@example.com")
    assert get_user_display_name(user2) == "bob"

# ═══════════════════════════════════════════════════════════════

# Complex function - multiple tests for different paths
def calculate_shipping_cost(order, user, shipping_method):
    """Complex logic with multiple conditions"""
    base_cost = shipping_method.base_cost

    if user.is_premium:
        base_cost *= 0.5  # 50% discount

    if order.total > 100:
        base_cost = 0  # Free shipping over $100

    if shipping_method.is_express:
        base_cost *= 1.5  # Express surcharge

    return base_cost

def test_shipping_cost_standard_user_under_threshold():
    user = User(is_premium=False)
    order = Order(total=50)
    method = ShippingMethod(base_cost=10.00, is_express=False)
    assert calculate_shipping_cost(order, user, method) == 10.00

def test_shipping_cost_premium_user_gets_discount():
    user = User(is_premium=True)
    order = Order(total=50)
    method = ShippingMethod(base_cost=10.00, is_express=False)
    assert calculate_shipping_cost(order, user, method) == 5.00

def test_shipping_cost_free_over_hundred():
    user = User(is_premium=False)
    order = Order(total=150)
    method = ShippingMethod(base_cost=10.00, is_express=False)
    assert calculate_shipping_cost(order, user, method) == 0

def test_shipping_cost_express_surcharge():
    user = User(is_premium=False)
    order = Order(total=50)
    method = ShippingMethod(base_cost=10.00, is_express=True)
    assert calculate_shipping_cost(order, user, method) == 15.00

def test_shipping_cost_premium_express_over_hundred():
    """Edge case: multiple conditions"""
    user = User(is_premium=True)
    order = Order(total=150)
    method = ShippingMethod(base_cost=10.00, is_express=True)
    # Free shipping (over $100) takes precedence
    assert calculate_shipping_cost(order, user, method) == 0
```

## Mocking Examples

### Mock at External Boundaries

```python
# ✅ Good: Mock external API
@patch('requests.get')
def test_fetch_user_data_from_api(mock_get):
    # Arrange
    mock_get.return_value = Mock(
        json=lambda: {
            "id": "123",
            "name": "Alice",
            "email": "alice@example.com",
            "role": "standard",
            "created_at": "2024-01-01T00:00:00Z"
        },
        status_code=200
    )

    # Act
    user = fetch_user_from_api("123")

    # Assert
    assert user.name == "Alice"
    assert user.email == "alice@example.com"
    mock_get.assert_called_once_with("https://api.example.com/users/123")
```

```typescript
// ✅ Good: Mock external API
test('fetch user data from API', async () => {
  // Arrange
  const mockFetch = jest.fn().mockResolvedValue({
    json: async () => ({
      id: '123',
      name: 'Alice',
      email: 'alice@example.com',
      role: 'standard',
      createdAt: '2024-01-01T00:00:00Z'
    }),
    ok: true
  });
  global.fetch = mockFetch;

  // Act
  const user = await fetchUserData('123');

  // Assert
  expect(user.name).toBe('Alice');
  expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/users/123');
});
```

### Complete Mock Data Structures

```typescript
// ❌ Bad: Incomplete mock
const mockUser = {
  id: '123',
  name: 'Alice'
  // Missing: email, role, timestamps, etc.
};

// ✅ Good: Complete mock matching real structure
const mockUser = {
  id: '123',
  name: 'Alice',
  email: 'alice@example.com',
  role: UserRole.STANDARD,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  lastLoginAt: null,
  emailVerified: true,
  // All fields real User has
};
```

## TDD Workflow Example

```python
# Step 1: Write failing test (RED)
def test_order_total_includes_tax():
    order = Order(items=[Item(price=10.00)])
    total = order.calculate_total(tax_rate=0.08)
    assert total == 10.80

# Run test → FAILS (calculate_total doesn't exist)

# Step 2: Implement to pass (GREEN)
class Order:
    def calculate_total(self, tax_rate):
        subtotal = sum(item.price for item in self.items)
        return subtotal * (1 + tax_rate)

# Run test → PASSES

# Step 3: Refactor (REFACTOR)
class Order:
    def calculate_total(self, tax_rate):
        return self.subtotal * (1 + tax_rate)

    @property
    def subtotal(self):
        return sum(item.price for item in self.items)

# Run test → Still PASSES (behavior unchanged, refactoring safe)
```

## Testing Strategy Template

When implementing a feature, plan tests at each appropriate level:

```markdown
Feature: Order Processing

**Unit Tests (tests/unit/):**
- Calculate order total with tax
- Calculate shipping cost with various conditions
- Validate payment amount matches order total
- Apply discount codes correctly

**Integration Tests (tests/integration/):**
- OrderService creates order in database
- OrderService applies payment and updates status
- Inventory decremented when order placed
- Email sent when order confirmed

**E2E Tests (tests/e2e/):**
- Complete purchase flow (browse → cart → checkout → confirmation)
- Order history displays completed orders

Note: Unit tests cover calculation logic, integration tests cover
service/database interaction, E2E tests cover user experience.
No duplication of the same flow across levels.
```

---

**See [reference.md](reference.md) for detailed patterns and [anti-patterns.md](anti-patterns.md) for common mistakes to avoid.**
