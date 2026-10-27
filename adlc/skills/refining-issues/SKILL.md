---
name: refining-issues
description: Refine rough issue descriptions into fully-formed specifications through Socratic questioning, focusing on WHAT to build not HOW, writing results directly to Linear/JIRA issues
when_to_use: when partner provides issue ID or feature description that needs requirements refinement before technical planning
version: 2.0.0
---

# Refining Issues Into Specifications

## Overview

Transform rough issue descriptions into fully-formed specifications through structured questioning, focusing exclusively on WHAT to build (requirements, behaviors) not HOW to build it (implementation), writing results directly to project management system.

**Core principle:** Ask questions to understand user needs, expected behaviors, and success criteria. Avoid technical implementation details.

**Announce at start:** "I'm using the refining-issues skill to refine this into a complete specification."

**Critical distinctions:**

- ✅ **WHAT**: User needs, behaviors, outcomes, data requirements, success criteria
- ❌ **HOW**: Technology choices, architecture, APIs, database design, file structures

## Quick Reference

| Phase | Key Activities | Tool Usage | Output |
|-------|---------------|------------|--------|
| **1. Load Issue** | Retrieve issue details | Linear/JIRA MCP tools | Issue context loaded |
| **2. Understanding** | Ask questions about needs (one at a time) | AskUserQuestion for choices | Purpose, constraints, success criteria |
| **3. Behavior Exploration** | Clarify expected behaviors and edge cases | AskUserQuestion for scenarios | Clear behavioral requirements |
| **4. Specification Presentation** | Present requirements in sections | Open-ended questions | Complete specification validated |
| **5. Update Issue** | Write specification to issue | Linear/JIRA MCP update | Issue ready for technical planning |

## The Process

Copy this checklist to track progress:

```
Issue Refinement Progress:
- [ ] Phase 1: Load Issue (context retrieved from PM system)
- [ ] Phase 2: Understanding (user needs, constraints, success criteria gathered)
- [ ] Phase 3: Behavior Exploration (expected behaviors, edge cases clarified)
- [ ] Phase 4: Specification Presentation (requirements validated in sections)
- [ ] Phase 5: Update Issue (specification written to PM system)
```

**Throughout all phases - AVOID:**

- ❌ Suggesting technology choices (databases, frameworks, libraries)
- ❌ Discussing architecture patterns (MVC, microservices, event-driven)
- ❌ Proposing API designs (endpoints, request/response formats)
- ❌ Describing data structures (tables, schemas, indexes)
- ❌ Implementation details (classes, functions, algorithms)

**Instead - FOCUS ON:**

- ✅ What users need to accomplish
- ✅ Observable behaviors and outcomes
- ✅ Testable success criteria
- ✅ Data requirements (what data exists, what relationships)
- ✅ Edge cases and error scenarios
- ✅ Constraints and business rules

### Phase 1: Load Issue

**If issue ID provided:**

- Linear: `mcp__linear-server__get_issue(id=issue_id)`
- OR JIRA: `mcp__jira__get_issue(issue_key=issue_id)`
- Extract: Title, description, labels, project/team context
- Present to user: "I've loaded issue [ID]: [Title]. Current description: [summary]"

**If free text provided:**

- Clarify which project/team this belongs to
- Create the parent issue (Linear: `create_issue(title=, team=, description=)`; JIRA equivalent).
  For label classification and required metadata, defer to `adlc:creating-tickets` — at refine
  time a bare placeholder is fine; the label and full ticket structure are set during
  `/breakdown` via `adlc:creating-tickets`.
- Capture the created issue ID for later updates
- Present to user: "I've created issue [ID]: [Title] in [Team/Project]"

### Phase 2: Understanding

- Check current project state in working directory
- Ask one question at a time about user needs and requirements
- **Use AskUserQuestion tool** for multiple choice options
- Gather: Purpose, user needs, constraints, success criteria
- Build on existing issue description
- **AVOID technical implementation questions**

**Example using AskUserQuestion (GOOD - focuses on WHAT):**

```
Question: "How long should user sessions remain active?"
Options:
  - "Until browser closes" (more secure, user re-authenticates each session)
  - "For 24 hours" (balanced convenience and security)
  - "Until explicitly logged out" (maximum convenience)
```

**Example to AVOID (BAD - focuses on HOW):**

```
Question: "Where should the authentication data be stored?"
Options:
  - "Session storage" (clears on tab close, more secure)
  - "Local storage" (persists across sessions, more convenient)
  - "Cookies" (works with SSR, compatible with older approach)
```

This is implementation detail - save for /plan command!

### Phase 3: Behavior Exploration

- Clarify expected behaviors in different scenarios
- Explore edge cases and error conditions
- Understand data requirements and relationships
- Define constraints and business rules
- **Use AskUserQuestion tool** for scenario-based questions
- **AVOID architectural or technical approaches**

**Example using AskUserQuestion (GOOD - explores behaviors):**

```
Question: "What should happen when a user tries to log in with an incorrect password?"
Options:
  - "Show generic error immediately" (more secure, prevents user enumeration)
  - "Show specific error after 3 attempts" (helps legitimate users, may aid attackers)
  - "Lock account after 5 attempts" (prevents brute force, may frustrate users)
```

**Example using AskUserQuestion (GOOD - explores data needs):**

```
Question: "What user information needs to be accessible after login?"
Options:
  - "Basic profile only (name, email)" (minimal data, faster)
  - "Profile plus preferences" (personalized experience)
  - "Full user history and activity" (comprehensive but may be slow)
```

**Example to AVOID (BAD - architectural decision):**

```
Question: "Which architectural approach should we use?"
Options:
  - "Event-driven with message queue" (scalable, complex setup)
  - "Direct API calls with retry logic" (simple, synchronous)
```

This belongs in /plan, not /refine!

### Phase 4: Specification Presentation

- Present requirements in 200-300 word sections
- Cover: User stories, expected behaviors, success criteria, data requirements, edge cases
- Ask after each section: "Does this capture the requirements correctly?" (open-ended)
- Use open-ended questions here to allow freeform feedback
- **Continue avoiding technical implementation details**

**Structure to present:**

1. User Stories (who needs what and why)
2. Expected Behaviors (given/when/then scenarios)
3. Success Criteria (testable outcomes)
4. Data Requirements (what data, what relationships)
5. Edge Cases and Error Conditions
6. Out of Scope (explicitly excluded features)

### Phase 5: Update Issue

After specification is validated, write it to the issue:

**Structure the update as:**

```markdown
## Specification

### Overview
[2-3 sentence summary of what we're building and why]

### User Stories
- As a [user type], I want [capability] so that [benefit]
- As a [user type], I want [capability] so that [benefit]

### Expected Behaviors
- When [condition], then [expected outcome]
- Given [context], the system should [behavior]
- If [scenario], the user sees [result]

### Success Criteria
- [ ] Testable criterion 1 (specific, measurable)
- [ ] Testable criterion 2 (specific, measurable)
- [ ] Testable criterion 3 (specific, measurable)

### Data Requirements
**What data:**
- User: name, email, authentication status
- Session: creation time, expiry, user reference

**What relationships:**
- Each user can have multiple active sessions
- Sessions belong to exactly one user

**What constraints:**
- Email must be unique across all users
- Session cannot exceed 24 hours

### Edge Cases
- User attempts login with incorrect credentials
- User tries to access expired session
- Concurrent login attempts from different devices
- Empty or malformed input handling

### Error Conditions
- Invalid credentials → User should see clear error message
- Expired session → User should be redirected to login
- Network failure → User should see retry option

### Out of Scope
- Features explicitly NOT included in this implementation
- Password reset functionality (separate feature)
- Multi-factor authentication (future enhancement)
```

**Update the issue:**

- Linear: `mcp__linear-server__update_issue(id=issue_id, description=formatted_description, labels=['refined'])`
- OR JIRA: `mcp__jira__update_issue(issue_key=issue_id, description=formatted_description, labels=['refined'])`
- Preserve any existing description content (append, don't replace)
- Add label: "refined" or "ready-for-planning"
- Update state to "Todo" if it was "Backlog" or "Triage"

**Confirm with user:**
"Specification written to issue [ID]. This defines WHAT to build. Ready to create the technical plan for HOW to build it? (Run /adlc:plan next)"

## Question Patterns

### When to Use AskUserQuestion Tool

**Use AskUserQuestion for:**

- Phase 2: Clarifying user needs with 2-4 clear options
- Phase 3: Behavior scenarios and data requirement decisions
- Any decision about WHAT the system should do (not HOW)
- When options represent different user needs or business rules

**Example questions (GOOD):**

- "How long should data be retained?"
- "What should users see when X happens?"
- "Which user information is required vs optional?"
- "What defines a valid/invalid input?"

**Example questions to AVOID (BAD):**

- "Which database should we use?"
- "What architecture pattern fits best?"
- "Should this be synchronous or asynchronous?"
- "Where should we deploy this?"

**Benefits:**

- Structured presentation of requirement options
- Clear trade-off visibility (from user perspective)
- Forces explicit choice (prevents vague requirements)
- Keeps focus on WHAT not HOW

### When to Use Open-Ended Questions

**Use open-ended questions for:**

- Phase 4: Specification validation ("Does this capture the requirements correctly?")
- When you need detailed feedback or explanation about user needs
- When partner should describe their own requirements in their words
- When structured options would limit understanding of needs

## When to Revisit Earlier Phases

**You can and should go backward when:**

- Partner reveals new user need during Phase 3 or 4 → Return to Phase 2
- Validation shows fundamental gap in requirements → Return to Phase 2
- Partner questions behaviors during Phase 4 → Return to Phase 3
- Requirements conflict or contradict → Go back and clarify
- Technical details creep in → Refocus on WHAT not HOW

**Force no linear progression** when going backward would give better results.

**If partner asks technical questions:**

- Acknowledge the question
- Explain: "That's an important consideration for the technical plan phase"
- Redirect: "Let's first complete the requirements so we have a solid foundation"
- Note for later: "I'll make sure we address this in /plan"

## Integration with Other Skills

**After completion, hand off to:**

- `technical-planning` skill (via `/plan` command) - Creates technical implementation guide (HOW to build)
- Then `breakdown-planning` skill (via `/breakdown` command) - Creates sub-issues from specification + technical plan

**The workflow:**

1. `/refine` → Specification (WHAT to build) - THIS SKILL
2. `/plan` → Technical Plan (HOW to build) - technical-planning skill
3. `/breakdown` → Sub-issues (tasks to execute) - breakdown-planning skill
4. `/execute` → Implementation (build it) - execution-orchestration skill

## Key Principles

| Principle | Application |
|-----------|-------------|
| **WHAT not HOW** | Focus exclusively on requirements, avoid implementation details |
| **One question per message** | Phase 2-3: Single question per message, use AskUserQuestion for choices |
| **Behavior-focused** | Define expected behaviors and outcomes, not technical solutions |
| **Testable criteria** | Success criteria must be specific and measurable |
| **YAGNI ruthlessly** | Remove unnecessary features and "nice to haves" |
| **User perspective** | Always frame questions from user needs, not developer convenience |
| **Incremental validation** | Present specification in sections, validate each |
| **Flexible progression** | Go backward when needed - flexibility > rigidity |
| **Write to source of truth** | Issue is the living document, not separate files |
| **Defer technical questions** | "That's important for /plan - let's finish requirements first" |

## Remember

- **Focus on WHAT not HOW** - This is critical for spec-driven development
- Load issue context first (don't work blind)
- One question at a time during Understanding
- Explore behaviors and edge cases, NOT architectures or technologies
- Validate incrementally during Specification presentation
- Write structured specification back to issue (not "Design")
- Offer handoff to `/plan` when complete (not `/breakdown`)
- The specification will drive test-first development later
- Keep requirements technology-agnostic
- If you catch yourself discussing implementation, STOP and refocus on requirements

**Common mistakes to avoid:**

- ❌ "Should we use REST or GraphQL?" → Technical decision for /plan
- ❌ "Let's structure this as microservices" → Architecture for /plan
- ❌ "We could cache this in Redis" → Implementation detail for /plan
- ✅ "How long can data be stale before users notice?" → Requirement question
- ✅ "What should happen if this operation fails?" → Behavior question
- ✅ "Which users can perform this action?" → Business rule question
