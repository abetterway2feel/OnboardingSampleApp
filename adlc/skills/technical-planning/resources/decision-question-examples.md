# AskUserQuestion Examples for Technical Decisions

Use `AskUserQuestion` only for genuine decisions (new tech, multiple valid architectures,
significant trade-offs, cross-cutting concerns). Skip it when the codebase already dictates the
choice or there is a single obvious option.

## Technology Choice (new infrastructure)

```typescript
AskUserQuestion({
  questions: [{
    question: "For session management, should we introduce Redis caching?",
    header: "Caching",
    multiSelect: false,
    options: [
      { label: "Redis cache", description: "Fast lookups, requires new infrastructure, better scalability" },
      { label: "Database only", description: "Uses existing Postgres, simpler setup, higher database load" },
      { label: "In-memory cache", description: "No new infrastructure, loses cache on restart, single-server only" }
    ]
  }]
})
```

## Architecture Approach

```typescript
AskUserQuestion({
  questions: [{
    question: "For the authentication service, should we use synchronous or event-driven architecture?",
    header: "Architecture",
    multiSelect: false,
    options: [
      { label: "Synchronous", description: "Direct service calls, simpler, consistent with existing services" },
      { label: "Event-driven", description: "Pub/sub pattern, better scalability, requires event infrastructure" }
    ]
  }]
})
```

## Testing Strategy

```typescript
AskUserQuestion({
  questions: [{
    question: "Should we include performance/load testing for this authentication system?",
    header: "Testing",
    multiSelect: false,
    options: [
      { label: "Yes, add load tests", description: "Verify performance under concurrent load, catch bottlenecks early" },
      { label: "No, defer to later", description: "Focus on functional correctness first, add performance tests later" }
    ]
  }]
})
```

## Documenting Decisions

Record every decision with rationale, whether user-confirmed or codebase-dictated:

```markdown
**Authentication Method:** JWT tokens
- Rationale: Stateless, scalable, consistent with existing API patterns
- No alternatives considered: codebase already uses JWT (src/services/token-service.ts)

**Session Management:** Redis for token blacklist [USER CONFIRMED]
- Rationale: Fast lookups, handles distributed system, existing Redis infrastructure
- Alternative considered: Database (rejected: slower, unnecessary load)
- References: src/services/cache-service.ts (existing Redis client)
```
