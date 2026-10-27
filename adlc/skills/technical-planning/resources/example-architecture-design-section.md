# Architecture Design Examples

This document provides examples of how to document architecture and component design during technical planning.

## Component Documentation Structure

```markdown
**Components:**
1. **[ComponentName]** (new/modified)
   - Responsibilities: [What it does]
   - Dependencies: [What it needs]
   - Location: [File path]
   - Pattern: Follows [existing pattern reference]
```

## example-1-authentication-service

```markdown
Architecture Overview:

**Components:**

1. **UserAuthService** (new)
   - Responsibilities: Authenticate credentials, issue tokens, validate tokens, revoke sessions
   - Dependencies: UserRepository, TokenService, PasswordHasher, SessionRepository
   - Location: src/services/user-auth-service.ts
   - Pattern: Follows service pattern (see src/services/data-service.ts)

2. **AuthController** (new)
   - Responsibilities: Handle auth endpoints, request validation, response formatting
   - Dependencies: UserAuthService
   - Location: src/controllers/auth-controller.ts
   - Pattern: Follows controller pattern (see src/controllers/user-controller.ts)

3. **AuthMiddleware** (extend existing)
   - Responsibilities: Validate JWT tokens on protected routes
   - Dependencies: TokenService
   - Location: src/middleware/auth-middleware.ts (extend existing)
   - Pattern: Add JWT validation to existing session validation

**Data Flow:**
1. User submits credentials → AuthController
2. Controller validates input → UserAuthService
3. Service verifies credentials → UserRepository
4. Service generates token → TokenService
5. Service creates session → SessionRepository
6. Controller returns token + user data

**Integration Points:**
- Existing middleware: src/middleware/auth-middleware.ts (extend for token validation)
- Existing error handling: src/middleware/error-handler.ts (use for auth errors)
- Existing validation: src/middleware/validator.ts (use for request validation)
```

## example-2-payment-processing-system

```markdown
Architecture Overview:

**Components:**

1. **PaymentService** (new)
   - Responsibilities: Process payments, handle refunds, manage payment methods
   - Dependencies: PaymentRepository, PaymentGateway (Stripe), NotificationService
   - Location: src/services/payment-service.ts
   - Pattern: Follows service pattern with transaction management

2. **PaymentController** (new)
   - Responsibilities: Payment endpoints, webhook handling
   - Dependencies: PaymentService
   - Location: src/controllers/payment-controller.ts
   - Pattern: Standard controller + webhook endpoint

3. **PaymentGateway** (new)
   - Responsibilities: Abstract Stripe API, handle retries, format errors
   - Dependencies: Stripe SDK
   - Location: src/lib/payment-gateway.ts
   - Pattern: Adapter pattern for external service

**Data Flow:**
1. User initiates payment → PaymentController
2. Controller validates amount/method → PaymentService
3. Service creates payment intent → PaymentGateway
4. Gateway calls Stripe API → External
5. Service saves transaction → PaymentRepository
6. Webhook confirms → PaymentController → PaymentService updates status

**Integration Points:**
- Order system: src/services/order-service.ts (trigger payments from orders)
- Notification: src/services/notification-service.ts (send payment receipts)
- Webhooks: src/routes/webhooks.ts (add Stripe webhook endpoint)
```

## example-3-realtime-chat-feature

```markdown
Architecture Overview:

**Components:**

1. **ChatService** (new)
   - Responsibilities: Send/receive messages, manage rooms, handle presence
   - Dependencies: ChatRepository, WebSocketManager
   - Location: src/services/chat-service.ts
   - Pattern: Service with pub/sub for real-time events

2. **WebSocketManager** (new)
   - Responsibilities: Manage WebSocket connections, broadcast messages, handle reconnects
   - Dependencies: Socket.io
   - Location: src/lib/websocket-manager.ts
   - Pattern: Singleton connection manager

3. **ChatController** (new)
   - Responsibilities: REST endpoints for chat history, room management
   - Dependencies: ChatService
   - Location: src/controllers/chat-controller.ts
   - Pattern: Standard REST controller (history is REST, real-time is WebSocket)

**Data Flow:**
Real-time messaging:
1. Client sends message → WebSocket → WebSocketManager
2. Manager validates auth → ChatService
3. Service saves message → ChatRepository
4. Service broadcasts → WebSocketManager → All room clients

History retrieval:
1. Client requests history → ChatController (REST)
2. Controller → ChatService → ChatRepository
3. Returns paginated messages

**Integration Points:**
- Auth: src/middleware/auth-middleware.ts (WebSocket auth handshake)
- User presence: src/services/user-service.ts (online/offline status)
- Notifications: src/services/notification-service.ts (push when user offline)
```

## Data Flow Visualization Tips

**Simple flow (linear):**

```
A → B → C → D
```

**Conditional flow:**

```
A → B
B → C (if success)
B → D (if failure)
```

**Parallel flow:**

```
A → B
A → C (parallel)
B + C → D (wait for both)
```

## Integration Points Checklist

When documenting integration, consider:

- [ ] Existing middleware (auth, validation, error handling)
- [ ] Existing services (what can be reused?)
- [ ] Database (migrations, new tables vs extending existing)
- [ ] External APIs (third-party integrations)
- [ ] Background jobs (queue system, cron tasks)
- [ ] Caching layer (what needs caching?)
- [ ] Notification system (emails, push, webhooks)
