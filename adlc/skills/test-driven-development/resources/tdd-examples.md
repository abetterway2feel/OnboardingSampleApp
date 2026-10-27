# TDD Examples

Two representative walk-throughs of the RED → GREEN → REFACTOR cycle: a bug fix and a new
feature. The same discipline applies to every scenario (refactoring legacy code, features with
external dependencies, etc.). For test *quality* (naming, AAA, mocking, behavior-vs-implementation),
see `Skill(adlc:writing-tests)`.

## Example 1: Bug Fix

**Bug:** Empty email is accepted when it shouldn't be.

### RED — write a failing test for the specific bug

```typescript
test('rejects empty email', async () => {
  const result = await submitForm({ email: '' });
  expect(result.error).toBe('Email required');
});
```

### Verify RED — watch it fail for the right reason

```bash
$ just test
FAIL: expected 'Email required', got undefined
```

Fails because validation is missing (not a typo) — good.

### GREEN — minimal code to pass

```typescript
function submitForm(data: FormData) {
  if (!data.email?.trim()) {
    return { error: 'Email required' };
  }
  // ... rest of existing code
}
```

Only the missing check — no email-format validation, no other rules (YAGNI).

### Verify GREEN

```bash
$ just test
PASS
```

New test passes, existing tests still pass.

### REFACTOR — clean up only if there's a smell

If the error string or validation is duplicated, extract it; otherwise you're done.

```typescript
const ERROR_MESSAGES = { EMAIL_REQUIRED: 'Email required' };

function validateEmail(email: string | undefined): string | null {
  if (!email?.trim()) return ERROR_MESSAGES.EMAIL_REQUIRED;
  return null;
}

function submitForm(data: FormData) {
  const emailError = validateEmail(data.email);
  if (emailError) return { error: emailError };
  // ... rest of code
}
```

Run tests again (PASS), then commit.

**Lesson:** A bug fix always starts with a failing test that reproduces the bug — never fix
first then add a test.

## Example 2: New Feature (Retry Logic)

**Feature:** Retry failed network operations up to 3 times.

### RED — start with the simplest case

```typescript
test('retries failed operations up to 3 times', async () => {
  let attempts = 0;
  const operation = () => {
    attempts++;
    if (attempts < 3) throw new Error('fail');
    return 'success';
  };
  const result = await retryOperation(operation);
  expect(result).toBe('success');
  expect(attempts).toBe(3);
});
```

### Verify RED

```bash
$ just test
ERROR: retryOperation is not defined
```

Add an empty function so the test *fails* rather than *errors*:

```typescript
async function retryOperation<T>(fn: () => Promise<T>): Promise<T> {
  throw new Error('not implemented');
}
```

```bash
$ just test
FAIL: expected 'success', got Error: not implemented
```

Now we have a proper failure.

### GREEN — minimal implementation

```typescript
async function retryOperation<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; i < 3; i++) {
    try { return await fn(); }
    catch (e) { if (i === 2) throw e; }
  }
  throw new Error('unreachable');
}
```

### Subsequent RED tests

Add tests for "throws after 3 failures" and "returns immediately on success." Some may pass
immediately — that's fine; you still wrote them to *verify* the behavior exists.

### REFACTOR

Extract the magic number; don't add configurability that wasn't requested (YAGNI).

```typescript
const DEFAULT_MAX_RETRIES = 3;
async function retryOperation<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; i < DEFAULT_MAX_RETRIES; i++) {
    try { return await fn(); }
    catch (e) { if (i === DEFAULT_MAX_RETRIES - 1) throw e; }
  }
  throw new Error('unreachable');
}
```

Run tests (PASS), commit.

## Key Patterns

1. **Bug fix always starts with a failing test** — show the bug, then fix it.
2. **Verify the test fails for the right reason** before writing implementation.
3. **Write minimal code** to pass — no speculative features (YAGNI).
4. **Refactor only structure**, never add behavior during REFACTOR — if you find yourself adding
   a new rule (e.g. a length check), that's a new RED-GREEN-REFACTOR cycle.
5. **Tests stay green during refactoring** — if one goes red, revert immediately.
6. **One cycle ≈ one commit.**
