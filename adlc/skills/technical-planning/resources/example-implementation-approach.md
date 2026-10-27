# Implementation Approach Examples

This document provides examples of how to describe the implementation approach in a Technical Plan. The goal is to identify key components, critical dependencies, and the general order of work — **without** doing a detailed phase/task breakdown (that's `/breakdown`'s job).

## What the Implementation Approach Should Contain

1. **Key components** — what needs to be built or modified
2. **Critical dependencies** — what must exist before other work can proceed
3. **General approach** — the natural starting point and rationale
4. **What NOT to include** — detailed phases, numbered tasks, specific file lists (that's `/breakdown`)

## Example 1: Authentication System

```markdown
### Implementation Approach

Core components are UserAuthService (credential validation, token issuance), Session model
(persistent sessions with expiry), and AuthMiddleware (JWT validation on protected routes).
The PasswordHasher utility is also needed for secure credential storage.

The User model and password hashing are foundational — all other auth functionality depends on
them. Registration is the natural starting point as the thinnest end-to-end slice (create
account, store credentials, confirm success). Login, profile management, and password reset
each build on registration but are largely independent of each other.

Key risk: Session management strategy (Redis vs database-backed) affects performance at scale.
Redis token blacklist chosen for fast lookups (see Key Technology Choices above).
```

**Note:** This describes WHAT components exist and HOW they relate — it does NOT prescribe
"Phase 1: Foundation, Phase 2: Services, Phase 3: API". The breakdown skill will slice this
into vertical phases like "Register a user", "Log in", "Reset password", each touching all
necessary layers.

## Example 2: Payment Processing

```markdown
### Implementation Approach

Core components are PaymentService (orchestrates payment flow), StripeGateway adapter (wraps
Stripe SDK), and Payment/PaymentMethod models (persist transaction state). Webhook handling
is critical for async payment confirmation.

The Payment model and Stripe adapter are foundational — all payment flows depend on them.
One-time payment is the simplest end-to-end flow and the natural starting point. Payment
confirmation via webhooks is the next essential piece (without it, payment status is
unreliable). Refunds and dispute handling extend from completed payments but are independent
of each other.

Key risk: Webhook reliability requires idempotency keys and retry handling. PCI DSS compliance
means card details never touch our servers — Stripe Elements handles all sensitive data
client-side.
```

## Example 3: Real-time Chat

```markdown
### Implementation Approach

Core components are WebSocketManager (connection lifecycle), ChatService (message persistence
and retrieval), and Message/ChatRoom models. Redis is used for user presence tracking.

WebSocket infrastructure and the Message model are foundational. Sending and receiving
messages in real-time is the thinnest end-to-end slice — a single channel with basic
send/receive covers the core value. Message history, user presence, channel management, and
push notifications each extend the core independently.

Key risk: WebSocket auth handshake must validate JWT tokens before allowing connection.
Message ordering under high concurrency needs server-assigned timestamps, not client
timestamps.
```

## Anti-Pattern: Doing the Breakdown in the Plan

**Bad — this is `/breakdown`'s job:**

```markdown
### Implementation Approach

Phase 1: Foundation (data models)
  1.1. User model
  1.2. Session model
  1.3. Migrations

Phase 2: Core Services
  2.1. PasswordHasher
  2.2. TokenService
  2.3. UserAuthService

Phase 3: API Layer
  3.1. POST /login
  3.2. POST /logout
  3.3. POST /refresh
```

This is a horizontal layer-by-layer breakdown disguised as a plan. It prescribes implementation
order by layer rather than describing the technical approach. Worse, it pre-empts `/breakdown`
which would slice this vertically (register, login, logout — each touching all layers).

**Good — describe approach and let `/breakdown` handle phasing:**

```markdown
### Implementation Approach

Core components are UserAuthService, TokenService, and Session model. User model and password
hashing are foundational. Registration is the thinnest e2e slice. Login, logout, and session
refresh build on it independently. Detailed vertical phase breakdown will be created during
`/breakdown`.
```

## Summary

The Implementation Approach section should:
- Identify the key components and their responsibilities
- Call out critical dependencies and foundational pieces
- Suggest the natural starting point (thinnest e2e slice)
- Note key risks or architectural concerns
- Be 1-2 paragraphs, not a numbered task list
- Leave detailed phasing to `/breakdown`
