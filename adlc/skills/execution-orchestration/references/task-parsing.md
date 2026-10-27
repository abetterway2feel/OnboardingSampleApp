# Task Parsing Reference

Parsing contract between breakdown-planning output and execution-orchestration skill input.

## Parsing Hierarchy

Three formats, tried in order. First match wins.

### 1. Primary: `### Task N:` Headers

Output format from `breakdown-planning` skill. Each task is a markdown heading with structured body.

**Expected format:**

```markdown
### Task 1: Add users table migration
- **Layers:** DB
- **Files:** `db/migrations/XXXX_create_users.py`
- **Unit tests:**
  - Migration applies successfully (table created with correct columns)
  - Migration rolls back cleanly (table dropped)
- **Reference:** `db/migrations/0001_create_sessions.py`

### Task 2: Implement User model
- **Layers:** Service
- **Files:** `models/user.py`, `tests/models/test_user.py`
- **Unit tests:**
  - `test_create_user_with_valid_attrs` - creates user, returns model instance
  - `test_password_is_hashed` - password_hash != plaintext password
  - `test_email_uniqueness` - duplicate email raises IntegrityError
- **Reference:** `models/session.py`
```

**Extraction:**

```python
def extract_task_headers(description: str) -> list[dict]:
    sections = split_on_pattern(description, r"### Task (\d+):\s*(.+)")
    tasks = []
    for match in sections:
        task = {
            "index": int(match.group(1)),
            "title": match.group(2).strip(),
            "body": match.section_body,
            "layers": extract_bold_field(body, "Layers"),
            "files": extract_bold_field(body, "Files"),
            "tests": extract_bold_field(body, "Unit tests"),
            "reference": extract_bold_field(body, "Reference"),
        }
        tasks.append(task)
    return tasks
```

### 2. Fallback: `- [ ]` Checklist Items

```markdown
## Tasks
- [ ] Add users table migration - `db/migrations/`
- [ ] Implement User model - `models/user.py`
- [ ] Implement POST /api/users - `routes/users.py`
```

### 3. Final Fallback: Entire Phase as Single Task

If no structured tasks found, treat entire phase description as one task.

## Field Extraction

```python
def extract_bold_field(body: str, field_name: str) -> str | list:
    """Extract value after **Field:** in markdown body."""
    pattern = rf"\*\*{field_name}:\*\*\s*(.+?)(?=\n\*\*|\n###|\Z)"
    match = search(pattern, body, DOTALL)
    if not match:
        return "" if field_name in ("Reference",) else []
    value = match.group(1).strip()
    if "\n  -" in value or "\n-" in value:
        return [line.strip("- ").strip() for line in value.split("\n") if line.strip().startswith("-")]
    if "," in value:
        return [item.strip().strip("`") for item in value.split(",")]
    return value
```

## Validation

```python
for task in tasks:
    assert task["index"] > 0, "Task index must be positive"
    assert task["title"], "Task must have a title"
    assert task["body"], "Task must have a body"
```
