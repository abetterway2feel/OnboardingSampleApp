# Refactoring Reference

Refactoring changes code structure without changing behavior; tests prove behavior is unchanged.

**Golden Rule:** Refactor only when all tests are green. If tests fail during refactoring, revert
immediately and try a smaller step.

## Code Smell Checklist

Run through this during the REFACTOR phase. Each smell maps to a pattern.

**Duplication**
- Duplicated code → Extract Method / Extract Class / Pull Up Method
- Magic numbers → Replace with Named Constant
- Duplicated conditionals → Replace Conditional with Polymorphism / Extract Method

**Size**
- Long method (>20 lines) → Extract Method, Replace Temp with Query
- Large class (>300 lines or >10 methods) → Extract Class
- Long parameter list (>3 params) → Introduce Parameter Object

**Responsibility**
- Feature envy (method uses another class more than its own) → Move Method
- Divergent change (class changes for multiple reasons) → Extract Class
- Shotgun surgery (one change touches many classes) → Move Method / Inline Class

**Data**
- Data clumps (same group of fields recurring) → Introduce Parameter Object / Extract Class
- Primitive obsession → Replace Data Value with Object
- Temporary field → Extract Class

**Clarity**
- Comments explaining *what* → Extract Method / Rename
- Unclear names → Rename (IDE-assisted)
- Dead code → delete immediately

**Conditionals**
- Complex/nested conditional (>2 levels) → Decompose Conditional / Polymorphism
- Pervasive null checks → Introduce Null Object / Optional
- Type code driving behavior → Replace Type Code with Polymorphism

## Representative Patterns

These show the mechanics; the same approach applies to the other patterns above.

### Extract Method

Long method or duplicated fragment → group into a named method.

```typescript
// Before
function printOwing(invoice: Invoice) {
  printBanner();
  console.log(`Name: ${invoice.customer}`);
  console.log(`Amount: ${invoice.getOutstanding()}`);
}

// After
function printOwing(invoice: Invoice) {
  printBanner();
  printDetails(invoice);
}
function printDetails(invoice: Invoice) {
  console.log(`Name: ${invoice.customer}`);
  console.log(`Amount: ${invoice.getOutstanding()}`);
}
```

Steps: create method with descriptive name → copy code → turn locals into parameters → replace
original with the call → run tests.

### Replace Magic Number with Named Constant

```typescript
// Before
return mass * 9.81 * height;

// After
const GRAVITATIONAL_CONSTANT = 9.81; // m/s²
return mass * GRAVITATIONAL_CONSTANT * height;
```

### Decompose Conditional

Hard-to-read condition → extract into a named predicate.

```typescript
// Before
if (date.before(SUMMER_START) || date.after(SUMMER_END)) { ... }

// After
function isWinter(date: Date): boolean {
  return date.before(SUMMER_START) || date.after(SUMMER_END);
}
if (isWinter(date)) { ... }
```

### Replace Conditional with Polymorphism

Type-switch driving behavior → one subclass per branch, each implementing the method.

```typescript
// Before
function getSpeed(bird: Bird): number {
  switch (bird.type) {
    case 'European': return getBaseSpeed();
    case 'African':  return getBaseSpeed() - getLoadFactor() * bird.numberOfCoconuts;
    case 'Norwegian': return bird.isNailed ? 0 : getBaseSpeed();
  }
}

// After: abstract Bird with getSpeed(); European/African/Norwegian each override it.
```

Steps: create a subclass per branch → move branch logic into its `getSpeed()` → replace the
conditional with a polymorphic call → run tests after each subclass.

### Introduce Parameter Object

```typescript
// Before
function amountInvoiced(startDate: Date, endDate: Date, customerId: string): number {}

// After
interface DateRange { start: Date; end: Date; }
function amountInvoiced(range: DateRange, customerId: string): number {}
```

## Refactoring Safety

**Before:** all tests green, clean working directory, behavior covered by tests, recent work
committed (so you can revert).

**During:** one small refactoring at a time → run full suite after each → commit each success →
add no new functionality. If tests fail, revert immediately and take a smaller step.

**After:** all tests still green, code clearer, behavior identical, committed with a clear
description.

### Emergency Protocol (tests fail mid-refactor)

1. **STOP** — don't fix forward
2. **REVERT** (`git reset --hard` or undo)
3. **THINK** — was the step too big?
4. **SMALLER STEP** — break it down
5. **TRY AGAIN** — one tiny change at a time

**Never:** change test expectations to make them pass, continue while red, add functionality
while refactoring, or skip the test run "because it's obvious."

## IDE-Assisted Refactorings (Prefer These)

Modern IDEs automate the safest refactorings — always prefer them over manual edits:

- **Rename** symbol (updates all references)
- **Extract Method/Function**
- **Move** method/class to another file (handles imports)
- **Inline** variable/method
- **Change Signature** (add/remove/reorder parameters)

For refactorings the IDE can't do (Extract Class, Replace Conditional with Polymorphism), follow
the manual process: one tiny structural change → run tests → commit if green, revert if red →
repeat.

## Am I Refactoring Correctly?

- [ ] Started with all tests green
- [ ] Only structural changes (no new features)
- [ ] Ran tests after each small change
- [ ] All tests still green
- [ ] Committed each successful refactoring
- [ ] Reverted immediately when tests failed

Can't check every box? You're not refactoring correctly.
