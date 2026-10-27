# API Contract and Data Model Examples

Representative templates for defining API contracts and data models during technical planning.
The patterns repeat across HTTP verbs — adapt the examples below to your domain and verbs.

## Data Model Templates

### New Entity

```markdown
**Session** (new model - create src/models/session.ts)
- id: UUID (primary key)
- userId: UUID (foreign key to User, not null, indexed)
- token: string (SHA256 of JWT, 64 chars, unique, indexed)
- ipAddress: string, max 45 chars (IPv6), nullable
- expiresAt: DateTime (not null)
- revokedAt: DateTime, nullable
- createdAt: DateTime

**Validation:**
- userId: must reference existing user
- token: exactly 64 chars
- expiresAt: must be in future at creation
- ipAddress: valid IPv4/IPv6 if provided

**Indexes:** Primary id; unique token (auth lookup); (userId, expiresAt); expiresAt (cleanup job)

**Relationships:** belongsTo(User) via userId

**Cascade Rules:** on user delete → CASCADE (delete sessions)
```

### Extending an Existing Model

```markdown
**User** (extend existing src/models/user.ts)
- email: string, unique, indexed (existing)
- passwordHash: string (NEW - bcrypt, 60 chars)
- loginAttempts: integer, default 0 (NEW - rate limiting)
- lockedUntil: DateTime, nullable (NEW - account lock expiry)
- sessions: Session[] (NEW relationship)

**Migration Required:**
- Add column passwordHash (string 60, not null)
- Add column loginAttempts (integer, default 0, not null)
- Add column lockedUntil (timestamp, nullable) + index for cleanup

**Validation:**
- Password (input only): min 8 chars, requires upper/lower/number/special
- loginAttempts: 0-10 (lock account after 10 failed attempts)
- lockedUntil: must be in future if set
```

## API Contract Templates

Each endpoint specifies: purpose, headers, request body + validation, success response, error
responses, behavior, and security considerations. Two representative examples follow; apply the
same shape to PATCH/DELETE/action endpoints (with 403/404/409 error bodies as appropriate).

### POST (Create Resource)

```markdown
**POST /api/auth/login** — Authenticate credentials and issue a session token

**Request Headers:** Content-Type: application/json
**Request Body:** { "email": "user@example.com", "password": "..." }
**Validation:** email required/valid/max 255; password required/min 8/max 72 (bcrypt limit)

**Response (200 OK):**
{ "token": "eyJ...", "user": { "id": "<uuid>", "email": "..." }, "expiresAt": "<iso8601>" }

**Error Responses (shared error shape):**
{ "error": { "code": "...", "message": "...", "details": null } }
- 401 INVALID_CREDENTIALS — "Email or password is incorrect"
- 401 ACCOUNT_LOCKED — details: { lockedUntil, remainingMinutes }
- 400 VALIDATION_ERROR — details: per-field messages
- 429 RATE_LIMIT_EXCEEDED — details: { retryAfter }

**Behavior:** success creates session; failure increments loginAttempts; lock after 10 failures
for 15 min; rate limit 5/min/IP; P95 < 200ms.

**Security:** generic error (don't reveal if email exists); constant-time bcrypt compare; log
failed attempts; HTTPS required.
```

### GET (Read Resource)

```markdown
**GET /api/auth/session** — Validate current session and return metadata

**Request Headers:** Authorization: Bearer <token> (required)

**Response (200 OK):**
{ "valid": true, "session": { "id", "userId", "expiresAt", "createdAt" }, "user": { "id", "email" } }

**Error Responses (shared error shape):**
- 401 INVALID_TOKEN — "token invalid or malformed"
- 401 SESSION_EXPIRED — details: { expiredAt }
- 401 SESSION_REVOKED — details: { revokedAt }

**Behavior:** validate JWT signature; check session not expired/revoked; P95 < 100ms.
**Security:** cryptographic token validation; check both token and session expiry; no sensitive
data in response.
```

## REST API Design Patterns

**Pagination:** query params `page` (min 1, default 1), `limit` (min 1, max 100, default 20),
`sort` ("field:direction"). Response includes a `pagination` block:
`{ page, limit, total, totalPages, hasNext, hasPrev }`.

**Filtering:** exact-match (`status`), partial-match (`email`), and range filters
(`createdAfter`/`createdBefore` as ISO 8601). Echo applied filters in the response.

**Bulk operations:** accept `{ ids: [...], updates: {...} }`; return `{ updated, failed, results: [{ id, success, error? }] }`.
Use **207 Multi-Status** for partial failures.

## GraphQL Contract Example

```graphql
type User {
  id: ID!
  email: String!
  displayName: String
  sessions(limit: Int = 10): [Session!]!
  createdAt: DateTime!
}

type Query {
  currentUser: User
  users(page: Int = 1, limit: Int = 20, status: UserStatus): UserConnection!
}

type Mutation {
  login(input: LoginInput!): LoginPayload!
  updateUser(id: ID!, input: UpdateUserInput!): UpdateUserPayload!
}

input LoginInput { email: String!  password: String! }
type LoginPayload { token: String!  user: User!  expiresAt: DateTime! }

type UpdateUserPayload { user: User!  errors: [UserError!] }
type UserError { field: String!  message: String!  code: String! }
```

Use a `*Connection` type (`edges`, `pageInfo`, `totalCount`) for paginated lists, and return a
`errors: [UserError!]` field on mutation payloads for field-level validation errors.

## Validation Rules Reference

- **String:** min/max length, `pattern` (regex), `enum`, `format` (email/url/uuid/date)
- **Numeric:** min/max, positive, integer, precision
- **Date/Time:** before/after/future/past; ISO 8601 recommended
- **Relationship:** required (FK exists), cascade behavior, nullable, unique (or unique combination)
- **Array:** minItems/maxItems, uniqueItems, itemSchema

## Using These Templates

1. Choose the template for your endpoint type and adapt the shared error shape.
2. Replace the auth examples with your domain entities.
3. Include all error cases from the specification's edge cases.
4. Define validation that matches specification requirements.
5. Specify performance targets and security considerations for sensitive operations.
