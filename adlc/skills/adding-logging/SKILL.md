---
name: adding-logging
description: Use when implementing or improving application logging - focused guide emphasizing minimal logging at interfaces, DEBUG level default, and strict PII protection
when_to_use: when adding logging to a new feature, improving existing logs, or establishing logging standards
version: 1.0.0
---

# Adding Effective Application Logging

**Core principle:** Log less, log smarter. Focus on boundaries and interfaces, not implementation details.

## Philosophy

> "Log less, log smarter. Most codebases have TOO MUCH logging at TOO HIGH levels."

**The three iron rules:**

1. **Review existing patterns first** - Consistency > perfection
2. **Default to DEBUG** - 90% of logs should be DEBUG, not INFO
3. **Never log PII or credentials** - When in doubt, DON'T LOG IT

## The Essential Process

### Step 1: Review Existing Logging Patterns

**BEFORE adding any logs, examine the codebase:**

```bash
# Find existing patterns
rg "log\.(info|debug|error|warning)" --type py -A 2 | head -50
# or
grep -r "logger\." src/ | head -30
```

**Identify:**

- What logger library? (structlog, winston, logback, zap, etc.)
- What log levels are common? (Should mostly be DEBUG)
- What context fields? (request_id, correlation_id patterns)
- Any sanitization utilities? (mask_email, redact_pii functions)

**Then match those patterns.** Don't introduce a new logging style.

### Step 2: Choose the Right Log Level (Default: DEBUG)

**Decision tree:**

```
Is it a system lifecycle event (startup/shutdown)?
  → INFO

Is it system degradation requiring attention?
  → WARNING

Did an operation fail requiring investigation?
  → ERROR

Is the system in danger of complete failure?
  → CRITICAL

Everything else (interface calls, boundaries, diagnostics)?
  → DEBUG
```

**Expected distribution:**

- DEBUG: ~90% of your logs
- INFO: ~5% (startup, shutdown, major business milestones)
- WARNING: ~3% (degraded but functional)
- ERROR: ~2% (failures needing investigation)
- CRITICAL: <1% (system-level failures)

**Common mistake:** Logging at INFO what should be DEBUG. This creates production noise.

### Step 3: Protect PII and Sensitive Data

**Safe to log:**

- ✅ Technical IDs (request_id, transaction_id, correlation_id)
- ✅ Timings (duration_ms, timestamp)
- ✅ Generic types (payment_method="card", not card details)
- ✅ Counts (item_count, retry_count)
- ✅ Status codes (http_status, error_code)

**NEVER log:**

- 🔴 Names, emails, phone numbers, addresses
- 🔴 IP addresses (unless hashed)
- 🔴 Passwords, tokens, API keys, session IDs
- 🔴 Credit card numbers, bank accounts, financial amounts
- 🔴 User-generated content (may contain secrets/PII)

**When in doubt: DON'T LOG IT.**

### Step 4: Log at Interfaces Only

**Log these boundaries (DEBUG level):**

- Service method entry/exit (public API)
- HTTP request received/response sent
- External API call start/result
- Database query start/result
- Message queue publish/consume
- Cache hit/miss

**Don't log these implementation details:**

- Variable assignments
- Loop iterations
- Private method calls
- Intermediate calculations
- Validation logic steps

## Code Pattern

```python
class OrderService:
    def process_order(self, order_id: str) -> Order:
        # ✅ Interface entry
        logger.debug("process_order_started",
            order_id=order_id,
            request_id=get_request_id()
        )

        try:
            # ✅ External call boundary
            logger.debug("calling_payment_service")
            payment = payment_service.charge(order)

            # ✅ External call result
            logger.debug("payment_completed",
                payment_id=payment.id,
                duration_ms=elapsed
            )

            # ❌ DON'T: Internal implementation
            # logger.debug("validating_order_items")  # Too detailed!
            # logger.debug("calculating_tax")  # Implementation detail!

            # ✅ Database boundary
            logger.debug("updating_order_status")
            order.mark_paid()
            self.repository.save(order)

            # ✅ Interface exit
            logger.debug("process_order_completed",
                order_id=order_id,
                total_duration_ms=total_elapsed
            )
            return order

        except PaymentError as e:
            # ✅ Error with context (ERROR level appropriate)
            logger.error("payment_failed",
                error_code=e.code,
                order_id=order_id,
                retry_count=e.retry_count,
                exc_info=True  # Stack trace
            )
            raise
```

## Structured Logging (If Codebase Uses It)

**Match the codebase format:**

```python
# Key-value structured (Python structlog, Go zap)
logger.debug("event_name", key1=value1, key2=value2)

# JSON structured (Node winston)
logger.debug("event_name", { key1: value1, key2: value2 })

# MDC/Context (Java logback)
MDC.put("request_id", requestId)
logger.debug("event_name")
```

**Don't use structured logging if the codebase doesn't.** Consistency matters more.

## Performance Considerations

**Avoid logging in hot paths:**

```python
# ❌ BAD - Logs millions of times
for item in millions_of_items:
    logger.debug("processing_item", item_id=item.id)

# ✅ GOOD - Log summary
logger.debug("processing_items", item_count=len(millions_of_items))
# ... process ...
logger.debug("items_processed",
    item_count=len(millions_of_items),
    duration_ms=elapsed
)
```

**Use lazy evaluation for expensive operations:**

```python
# Only evaluates if DEBUG enabled
logger.debug("data_summary",
    summary=lambda: expensive_summary(data)
)
```

## Implementation Checklist

**Before committing code with logging:**

### Critical (Must Have)

- [ ] Reviewed existing logging patterns and matched them
- [ ] No PII: names, emails, phones, addresses, IPs
- [ ] No credentials: passwords, tokens, keys, session IDs
- [ ] Most logs at DEBUG level (not INFO/WARNING)
- [ ] Logged at interfaces only (not implementation details)

### Important (Should Have)

- [ ] Includes correlation IDs (request_id if codebase has this)
- [ ] ERROR logs include error_code and exc_info=True
- [ ] No logging in tight loops or hot paths
- [ ] Follows codebase structured logging format (if any)

## Quick Reference

| Situation | Do | Don't |
|-----------|-----|-------|
| **New feature** | Review existing patterns first | Add new logging style |
| **Log level** | Default to DEBUG | Default to INFO |
| **User data** | Never log it | Log "just in case" |
| **Boundaries** | Log service entry/exit, external calls | Log every line |
| **Context** | request_id, order_id, duration_ms | user_email, user_name |
| **Errors** | error_code, exc_info=True | Vague "failed" message |
| **Hot paths** | Aggregate/sample | Log every iteration |

## Red Flags - Review Your Code

**STOP and fix if you see:**

🔴 **Critical issues:**

- PII in logs (names, emails, addresses, phones, IPs)
- Credentials in logs (passwords, tokens, keys)
- Most logs at INFO/WARNING instead of DEBUG

⚠️ **Common problems:**

- Different logging style than rest of codebase
- Logging implementation details instead of interfaces
- Logging in tight loops
- Error logs without error_code or stack trace

## When in Doubt

- **About log level?** Use DEBUG.
- **About logging user data?** DON'T.
- **About format?** Match the codebase.
- **About whether to log?** Log less, not more.

---

**Version:** 1.0.0
**Last Updated:** 2025-11-03
