# Diagram Guide for Pull Requests

## When to Use Each Diagram Type

### Architecture Diagram (graph TB/LR)

Use for:

- New services or modules
- Component relationships
- System integration
- Dependency changes

Example:

```mermaid
graph TB
    subgraph "New Components"
        A[Component A]
        B[Component B]
    end
    subgraph "Existing System"
        C[Component C]
        D[Component D]
    end
    A --> C
    B --> D
    A -.->|new dependency| B
```

### Sequence Diagram

Use for:

- API workflows
- User interactions
- Multi-step processes
- Event flows

Example:

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant API
    participant Database

    User->>Frontend: Click action
    Frontend->>API: POST /api/endpoint
    API->>Database: Query data
    Database-->>API: Return results
    API-->>Frontend: JSON response
    Frontend-->>User: Update UI
```

### Class Diagram

Use for:

- Data model changes
- New classes/interfaces
- Inheritance hierarchies
- Relationships

Example:

```mermaid
classDiagram
    class User {
        +String id
        +String email
        +authenticate()
    }
    class Session {
        +String token
        +Date expires
        +validate()
    }
    User "1" --> "*" Session
```

### State Diagram

Use for:

- Status workflows
- FSM implementations
- Lifecycle changes

Example:

```mermaid
stateDiagram-v2
    [*] --> Draft
    Draft --> Review: Submit
    Review --> Approved: Approve
    Review --> Rejected: Reject
    Rejected --> Draft: Revise
    Approved --> [*]
```

### Flowchart

Use for:

- Decision logic
- Algorithm changes
- Process flows

Example:

```mermaid
flowchart TD
    A[Start] --> B{Valid Input?}
    B -->|Yes| C[Process Data]
    B -->|No| D[Return Error]
    C --> E[Save Result]
    E --> F[End]
    D --> F
```

## Diagram Best Practices

1. **Keep it simple** - Show only what changed or is relevant
2. **Use clear labels** - Descriptive names for nodes and edges
3. **Highlight changes** - Use styling to show what's new
4. **Add context** - Include existing components for reference
5. **Multiple diagrams** - Break complex systems into multiple focused diagrams

## Advanced Styling

### Highlighting New Components

```mermaid
graph LR
    A[Existing]
    B[New Component]:::new
    C[Existing]

    A --> B
    B --> C

    classDef new fill:#90EE90,stroke:#006400,stroke-width:3px
```

### Showing Optional Flows

```mermaid
sequenceDiagram
    User->>API: Request
    API->>Cache: Check cache
    alt Cache Hit
        Cache-->>API: Return cached
    else Cache Miss
        API->>Database: Query
        Database-->>API: Return data
        API->>Cache: Update cache
    end
    API-->>User: Response
```

## When to Include Diagrams

**Always include diagrams for:**

- Architecture changes - Show new components and relationships
- Complex workflows - Illustrate multi-step processes
- Data model changes - Show schema relationships
- State machines - Depict state transitions
- Integration points - Show how systems connect

**Skip diagrams for:**

- Simple bug fixes (unless workflow changed)
- Documentation-only changes
- Dependency version bumps
- Minor refactoring without structural changes
