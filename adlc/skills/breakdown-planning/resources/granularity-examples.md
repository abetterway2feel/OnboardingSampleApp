# Vertical Slicing Examples

## Core Principle

Every phase is a vertical slice that delivers independently demoable functionality. Phases touch all necessary layers (DB, service, API, UI) for one piece of end-to-end behavior **and are proven by an end-to-end / acceptance test**.

**The question each phase must answer:** "What can the user DO after this phase is complete?"

**Every phase ends with an end-to-end test task** (shown as the final task below) that drives the whole slice. Per-layer unit tests prove each piece; the E2E test proves the slice. The `E2E acceptance` line under each phase is the behavior that test must demonstrate.

## Example 1: CRUD API (Blog Posts)

### Context

```yaml
Feature: Blog Post Management
Layers: Database, API, Frontend
Risk level: Low
```

### Breakdown (5 phases)

```
Phase 1: Create a blog post
  Tasks:
  - Add posts table migration (DB)
    Unit tests: migration applies, rolls back, columns correct
  - Implement Post model with validations (Service)
    Unit tests: test_create_post_valid, test_title_required, test_body_required
  - Implement POST /api/posts endpoint (API)
    Unit tests: test_create_post_201, test_create_missing_title_422, test_create_empty_body_422
  - Create PostForm component (UI)
    Unit tests: test_renders_fields, test_validates_required, test_submits_data
  - Wire form submission to API (Integration)
    Unit tests: test_submit_calls_api, test_shows_success, test_shows_error
  - Add end-to-end test for the slice (E2E)
    E2E tests: create_post_happy_path (fill form -> submit -> post in DB -> appears in list),
               create_post_validation (submit empty -> inline errors, nothing persisted)
  Demoable: User can create a blog post via the form
  E2E acceptance: POST valid data -> 201; form submit -> post appears in DB; validation errors shown

Phase 2: List blog posts
  Tasks:
  - Implement GET /api/posts with pagination (API)
    Unit tests: test_list_returns_posts, test_pagination_limit_offset, test_empty_list_200
  - Create PostList component with loading states (UI)
    Unit tests: test_renders_posts, test_loading_state, test_empty_state
  - Add empty state and pagination controls (UI)
    Unit tests: test_next_page_button, test_disabled_on_last_page
  - Add end-to-end test for the slice (E2E)
    E2E tests: list_shows_posts (seed posts -> load list -> all visible),
               list_pagination (seed >1 page -> next/prev navigates correctly)
  Demoable: User sees paginated list of all posts
  E2E acceptance: GET /api/posts -> paginated results; list page shows posts with pagination

Phase 3: View blog post detail
  Tasks:
  - Implement GET /api/posts/:id endpoint (API)
    Unit tests: test_get_post_200, test_get_nonexistent_404
  - Create PostDetail page with markdown rendering (UI)
    Unit tests: test_renders_title_body, test_renders_markdown
  - Add navigation from list to detail (UI)
    Unit tests: test_click_post_navigates
  - Add end-to-end test for the slice (E2E)
    E2E tests: view_post_detail (list -> click post -> detail page with full content),
               view_missing_post (navigate to unknown id -> 404 handled gracefully)
  Demoable: User clicks a post and sees its full content
  E2E acceptance: Click post in list -> detail page with full content rendered

Phase 4: Edit a blog post
  Tasks:
  - Implement PUT /api/posts/:id endpoint (API)
    Unit tests: test_update_post_200, test_update_nonexistent_404, test_update_invalid_422
  - Add edit mode to PostForm (reuse create form) (UI)
    Unit tests: test_prefills_existing_data, test_submits_update
  - Add edit button to PostDetail page (UI)
    Unit tests: test_edit_button_visible, test_edit_navigates_to_form
  - Add end-to-end test for the slice (E2E)
    E2E tests: edit_post_happy_path (detail -> edit -> change -> submit -> updated content shown + persisted)
  Demoable: User can edit an existing post
  E2E acceptance: Edit button -> form prefilled -> submit -> updated post displayed

Phase 5: Delete a blog post
  Tasks:
  - Implement DELETE /api/posts/:id endpoint (API)
    Unit tests: test_delete_post_204, test_delete_nonexistent_404
  - Add delete button with confirmation dialog (UI)
    Unit tests: test_delete_button_visible, test_confirmation_dialog, test_cancel_aborts
  - Handle post-delete redirect to list (UI)
    Unit tests: test_redirects_after_delete
  - Add end-to-end test for the slice (E2E)
    E2E tests: delete_post_happy_path (detail -> delete -> confirm -> gone from DB + list),
               delete_cancel (delete -> cancel -> post still present)
  Demoable: User can delete a post with confirmation
  E2E acceptance: Delete button -> confirmation -> post removed -> redirected to list
```

**Dependencies:**
- Phase 1: None
- Phase 2: Blocked by Phase 1 (needs Post model)
- Phase 3: Blocked by Phase 2 (needs list to navigate from)
- Phase 4: Blocked by Phase 3 (needs detail page for edit button)
- Phase 5: Blocked by Phase 3 (needs detail page for delete button)
- Phases 4-5: Can run in parallel (both depend on Phase 3, touch different files)

## Example 2: Authentication System

### Context

```yaml
Feature: User Authentication System
Layers: Database, Cache, Email, API, Frontend
Risk level: High (security-critical)
```

### Breakdown (5 phases)

```
Phase 1: Register a user
  Tasks:
  - Add users table migration with email/password_hash (DB)
  - Implement User model with email validation (Service)
  - Implement PasswordHasher utility (Service)
  - Implement POST /api/auth/register endpoint (API)
  - Create RegisterForm with client-side validation (UI)
  - Wire form to API with success/error handling (Integration)
  Demoable: User can create an account with email/password

Phase 2: Log in and receive session
  Tasks:
  - Add sessions table migration (DB)
  - Implement TokenService for JWT generation/validation (Service)
  - Implement POST /api/auth/login endpoint (API)
  - Implement auth middleware for protected routes (API)
  - Create LoginForm component (UI)
  - Add auth state management (store token, redirect) (UI)
  Demoable: User can log in and access protected pages

Phase 3: View and edit profile
  Tasks:
  - Implement GET /api/auth/me endpoint (API)
  - Implement PUT /api/auth/me endpoint (API)
  - Create ProfilePage with user details (UI)
  - Add edit form for profile fields (UI)
  Demoable: Logged-in user can view and update their profile

Phase 4: Log out and session management
  Tasks:
  - Implement DELETE /api/auth/session endpoint (API)
  - Implement session expiry logic (Service)
  - Add logout button to navigation (UI)
  - Clear auth state on logout (UI)
  Demoable: User can log out, expired sessions are rejected

Phase 5: Password reset via email
  Tasks:
  - Add password_reset_tokens table migration (DB)
  - Implement email sending service (Service)
  - Implement POST /api/auth/forgot-password endpoint (API)
  - Implement POST /api/auth/reset-password endpoint (API)
  - Create ForgotPasswordForm and ResetPasswordForm (UI)
  - Add rate limiting to reset endpoints (API)
  Demoable: User can reset password via email link
```

**Dependencies:**
- Phase 1: None
- Phase 2: Blocked by Phase 1 (needs User model + PasswordHasher)
- Phase 3: Blocked by Phase 2 (needs auth middleware)
- Phase 4: Blocked by Phase 2 (needs session/token infrastructure)
- Phase 5: Blocked by Phase 1 (needs User model + email)
- Phases 3-4: Can run in parallel
- Phase 5: Can run in parallel with Phases 3-4

## Example 3: Payment Integration (Stripe)

### Context

```yaml
Feature: Stripe Payment Integration
Layers: Database, Stripe API, Backend API, Frontend
Risk level: Critical (financial transactions)
Compliance: PCI DSS
```

### Breakdown (5 phases)

```
Phase 1: Create a payment (one-time charge)
  Tasks:
  - Add payments table migration (DB)
  - Implement Payment model (Service)
  - Implement StripeService wrapper for payment intents (Service)
  - Implement POST /api/payments/create-intent endpoint (API)
  - Create PaymentForm with Stripe Elements (UI)
  - Wire form to create-intent API and handle Stripe confirmation (Integration)
  Demoable: User can make a one-time payment with credit card

Phase 2: Payment confirmation and receipt
  Tasks:
  - Implement Stripe webhook handler for payment_intent.succeeded (API)
  - Update payment status on webhook receipt (Service)
  - Implement GET /api/payments/:id endpoint (API)
  - Create PaymentConfirmation page (UI)
  - Add email receipt on successful payment (Service)
  Demoable: User sees confirmation page, receives email receipt

Phase 3: View payment history
  Tasks:
  - Implement GET /api/payments with filters (API)
  - Create PaymentHistory page with date filtering (UI)
  - Add payment status badges and formatting (UI)
  Demoable: User can view their payment history with filters

Phase 4: Process refunds
  Tasks:
  - Implement StripeService.refund() method (Service)
  - Implement POST /api/payments/:id/refund endpoint (API)
  - Handle refund webhooks (charge.refunded) (API)
  - Add refund button to payment detail (admin) (UI)
  - Show refund status in payment history (UI)
  Demoable: Admin can refund a payment, user sees refund status

Phase 5: Handle disputes
  Tasks:
  - Implement dispute webhook handler (charge.dispute.created) (API)
  - Add dispute status tracking to Payment model (Service)
  - Create dispute evidence submission endpoint (API)
  - Add dispute alerts in admin dashboard (UI)
  Demoable: System handles disputes, admin can submit evidence
```

**Dependencies:**
- Phase 1: None
- Phase 2: Blocked by Phase 1 (needs payment intent flow)
- Phase 3: Blocked by Phase 2 (needs completed payments to display)
- Phase 4: Blocked by Phase 2 (needs completed payments to refund)
- Phase 5: Blocked by Phase 2 (needs payment records for disputes)
- Phases 3-5: Can run in parallel

## Example 4: Real-time Chat

### Context

```yaml
Feature: Real-time Chat System
Layers: Database, WebSocket, Redis, API, Frontend
Risk level: Medium
```

### Breakdown (5 phases)

```
Phase 1: Send and receive messages in a channel
  Tasks:
  - Add messages table migration (DB)
  - Implement Message model (Service)
  - Set up WebSocket server infrastructure (Service)
  - Implement WebSocket message handler (send/receive) (API)
  - Create ChatWindow component with message list (UI)
  - Create MessageInput component (UI)
  - Wire WebSocket connection for real-time updates (Integration)
  Demoable: Two users can send/receive messages in real-time

Phase 2: Message history and persistence
  Tasks:
  - Implement GET /api/channels/:id/messages with pagination (API)
  - Load historical messages on channel join (UI)
  - Add infinite scroll for older messages (UI)
  - Add message timestamps and grouping (UI)
  Demoable: User joins channel and sees message history with scroll

Phase 3: User presence (online/offline)
  Tasks:
  - Set up Redis for presence tracking (Service)
  - Implement PresenceTracker with heartbeat (Service)
  - Broadcast presence changes via WebSocket (API)
  - Show online/offline indicators in UI (UI)
  - Add "X users online" counter (UI)
  Demoable: Users see who is online in real-time

Phase 4: Channel management
  Tasks:
  - Add channels table migration (DB)
  - Implement Channel model with members (Service)
  - Implement CRUD endpoints for channels (API)
  - Create ChannelList sidebar component (UI)
  - Add create/join/leave channel UI (UI)
  Demoable: Users can create channels and switch between them

Phase 5: Push notifications for offline users
  Tasks:
  - Implement push notification service (Service)
  - Add notification preferences to User model (DB)
  - Implement notification triggers on new message (Service)
  - Add notification permission prompt (UI)
  - Create notification settings page (UI)
  Demoable: Offline users receive push notifications for new messages
```

**Dependencies:**
- Phase 1: None
- Phase 2: Blocked by Phase 1 (needs Message model + WebSocket)
- Phase 3: Blocked by Phase 1 (needs WebSocket infrastructure)
- Phase 4: Blocked by Phase 1 (needs messaging to work within channels)
- Phase 5: Blocked by Phase 1 (needs message events to trigger notifications)
- Phases 2-5: Can largely run in parallel after Phase 1

## Example 5: Data Migration (Special Case)

### Context

```yaml
Feature: Database Migration Script
Layers: Database only
Risk level: High (data integrity)
One-time use: Yes
```

### Breakdown (3 phases)

Even single-layer work benefits from vertical slicing by delivering progressively:

```
Phase 1: Migrate core records with validation
  Tasks:
  - Implement migration script for core table (DB)
  - Implement data validation checks (Service)
  - Implement rollback capability (DB)
  - Write integration tests with test database (Test)
  Demoable: Core records migrated, validated, rollback works

Phase 2: Migrate dependent records and verify integrity
  Tasks:
  - Implement migration for dependent tables (DB)
  - Add foreign key integrity checks (Service)
  - Add progress reporting (Service)
  Demoable: All records migrated with integrity verified

Phase 3: Create runbook and staging validation
  Tasks:
  - Run migration on staging environment (Ops)
  - Verify data integrity on staging (Ops)
  - Document migration runbook with rollback steps (Docs)
  Demoable: Staging validated, runbook ready for production
```

## Summary

**Every phase answers:** "What can the user DO after this?"

**Vertical slicing principles:**
- Phase 1 is always the thinnest end-to-end slice (walking skeleton)
- Subsequent phases add functionality, not layers
- Each phase is independently demoable
- **Each phase ends with an end-to-end / acceptance test that exercises the full slice** — this is what proves it is vertical, not just multi-layered
- Tasks within a phase are atomic todos (hours, not days)
- Dependencies between phases are explicit
- Tasks within a phase can note parallelisation opportunities

> Examples 2-5 above omit the explicit E2E task line for brevity, but every phase in them
> ends with one too — the `Demoable:` line states exactly what that test must demonstrate.
