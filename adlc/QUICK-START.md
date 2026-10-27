# ADLC Quick Start Guide

Get from install to your first idea-to-PR run. For the workflow narrative (what each command does, when to use it, how execution works), read the canonical orientation in [`skills/using-adlc/SKILL.md`](skills/using-adlc/SKILL.md); for the visual map, see [`EXECUTION_WORKFLOW.md`](EXECUTION_WORKFLOW.md).

## Prerequisites

### 1. Install ADLC Plugin

Follow the installation instructions in the [ADLC README](README.md#installation) or the [main repo README](../../README.md#installing-adlc-plugin).

**Quick install via Claude Code Plugin System (Recommended):**

```bash
# In Claude Code, add the marketplace
/plugin marketplace add HgDataTeam/hg-claude-code-plugin

# Install ADLC plugin
/plugin install adlc@hg-claude-code-plugin

# Verify installation
/help
# Should show /adlc:* commands
```

**Alternative: Manual installation for development:**

```bash
# Clone repository
git clone https://github.com/HgDataTeam/hg-claude-code-plugin.git
cd hg-claude-code-plugin

# Option A: Add as local marketplace
/plugin marketplace add ./hg-claude-code-plugin
/plugin install adlc@hg-claude-code-plugin

# Option B: Symlink for live development
mkdir -p ~/.claude/plugins
ln -s "$(pwd)/plugins/adlc" ~/.claude/plugins/adlc
```

### 2. Configure Linear or JIRA MCP Server

**IMPORTANT:** ADLC requires a project management MCP server. Choose one:

#### Linear Setup (Official MCP Server)

Linear provides an official, centrally-hosted MCP server:

```bash
# Add Linear MCP server via CLI
claude mcp add --transport sse linear-server https://mcp.linear.app/sse

# Authenticate in Claude Code
# Use the /mcp command to complete authentication
```

#### JIRA Setup

Check your organization's internal documentation for JIRA MCP server setup.

### 3. Set Up Recommended Tools

ADLC works best with these additional tools for optimal performance:

#### Just Task Runner (Highly Recommended)

```bash
# Linux (Ubuntu/Debian)
sudo apt install just

# Linux (other distros)
curl --proto '=https' --tlsv1.2 -sSf https://just.systems/install.sh | bash -s -- --to /usr/local/bin

# macOS
brew install just

# Windows
scoop install just
```

Create a `justfile` in your repository root:

```justfile
# Install dependencies
install:
    npm install  # or pip install, cargo build, etc.

# Run tests
test:
    npm test

# Run linters
lint:
    npm run lint

# Format code
format:
    npm run format

# Build artifacts
build:
    npm run build
```

**Note:** Without Just, ADLC falls back to stack-specific commands (npm test, pytest, etc.)

#### Additional Recommended Tools

**ripgrep** - Fast code search (improves codebase analysis):

```bash
# Linux
sudo apt install ripgrep

# macOS
brew install ripgrep
```

**fd** - Fast file finder (improves file discovery):

```bash
# Linux (Ubuntu/Debian)
sudo apt install fd-find
echo "alias fd='fdfind'" >> ~/.bashrc  # Create alias

# macOS
brew install fd
```

**GitHub CLI** - Required for PR operations:

```bash
# Linux (Ubuntu/Debian)
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
sudo chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update
sudo apt install gh

# macOS
brew install gh

# Authenticate
gh auth login
```

**uv** - Fast Python package manager (for Python projects):

```bash
# All platforms
curl -LsSf https://astral.sh/uv/install.sh | sh
```

**pre-commit** - Git hooks for quality checks:

```bash
# Via uv (recommended)
uv tool install pre-commit

# Via apt (Linux)
sudo apt install pre-commit

# Via brew (macOS)
brew install pre-commit
```

**Quick install all (Linux/Ubuntu):**

```bash
sudo apt update
sudo apt install -y just ripgrep fd-find gh pre-commit
curl -LsSf https://astral.sh/uv/install.sh | sh
gh auth login
echo "alias fd='fdfind'" >> ~/.bashrc && source ~/.bashrc
```

### 4. Initialise the Repository

First time in a repo, run `/foundations:setup` (from the [Foundations plugin](../foundations/README.md)) to generate a CLAUDE.md, a justfile, pre-commit hooks, and PM integration. ADLC builds on this foundation.

### 5. Verify Installation

```bash
# In Claude Code
/adlc:refine --help

# Should show command documentation
# If not found, restart Claude Code
```

## The Core Workflow

```
/refine → /plan → /breakdown → /execute → /pr → /address-feedback
```

Each command can run standalone or chain to the next; you can decline a chain prompt and run the next step manually later. For the full description of each command and how execution works, see [`skills/using-adlc/SKILL.md`](skills/using-adlc/SKILL.md).

## End-to-End Walkthrough: Idea to Merged PR

Here is one complete run, from a rough idea to a reviewed and merged PR.

```bash
# Step 1: Create Specification (WHAT to build)
/adlc:refine "Add real-time notifications"

# ... Interactive Socratic dialogue ...
# Questions like:
# - "Which notification types should we support?" (email, push, in-app)
# - "What triggers notifications?" (user actions, system events)
# - "Where should notifications be stored?" (database, cache)

✓ Created issue NOTIF-45 with Specification
Ready to create technical plan? > yes

# Step 2: Create Technical Plan (HOW to build)
# (Automatically chains to /adlc:plan NOTIF-45)

Analyzing codebase...
Found: WebSocket service, React components, PostgreSQL models

Recommending approach:
- Use existing WebSocket infrastructure
- Add notifications table with Prisma
- Create React hook for real-time updates

✓ Technical Plan added to NOTIF-45
Ready to break this down? > yes

# Step 3: Break into phase sub-issues (vertical slices)
# (Automatically chains to /adlc:breakdown NOTIF-45)

Breaking down Technical Plan into vertical slices...

✓ Created phase sub-issues with dependencies:
  - NOTIF-46 (feature): Basic notification model (DB + API) - ready
  - NOTIF-47 (feature): WebSocket delivery - blocked by NOTIF-46
  - NOTIF-48 (feature): React notification UI - blocked by NOTIF-47

Each phase contains ~5 tasks (atomic TDD cycles) as checklist items.
Ready to execute? > yes

# Step 4: 3-Tier Execution
# (Automatically chains to /adlc:execute NOTIF-45)

✓ Created feature branch: feature/NOTIF-45-notifications

Phase 1: Basic notification model (NOTIF-46)
  ✓ Task 1: Add notifications migration - committed
  ✓ Task 2: Implement Notification model - committed
  ✓ Task 3: POST /api/notifications - committed
  ✓ Phase PR #12 squash-merged

Phase 2: WebSocket delivery (NOTIF-47)
  ✓ Task 1: WebSocket integration - committed
  ✓ Task 2: Real-time push handler - committed
  ✓ Phase PR #13 squash-merged

Phase 3: React notification UI (NOTIF-48)
  ✓ Task 1: NotificationBell component - committed
  ✓ Task 2: NotificationList component - committed
  ✓ Task 3: useNotifications hook - committed
  ✓ Phase PR #14 squash-merged

✓ All 3 phases complete
✓ Linear issues updated to "Done"

Feature PR? > yes

# Step 5: Create the feature PR
# (Automatically chains to /adlc:pr)

✓ PR created: https://github.com/org/repo/pull/89
  - Title: "Add real-time notifications (NOTIF-45)"
  - Mermaid architecture + sequence diagrams
  - Test coverage: 94%
  - Links to all implemented sub-issues

# After the PR opens, the babysitting-prs skill drives it to done in the
# background: CI to green, low-risk review comments auto-incorporated,
# threads resolved. It never auto-merges — the final merge is yours.

# Step 6: Address review feedback (if a reviewer leaves comments)

/adlc:address-feedback 89

Fetching PR comments...
Found 8 review comments:
  🔴 1 Critical (security: validate notification permissions)
  🟡 4 Important (architecture improvements)
  🟢 3 Minor (naming, documentation)

Creating sub-issues for tracking...
✓ Created NOTIF-58, NOTIF-59, NOTIF-60 (feedback items)

Implementing feedback using TDD...
  ✓ NOTIF-58: Add permission validation (tests + impl)
  ✓ NOTIF-59: Extract notification formatter (refactor)
  ... (continues)

✓ All feedback addressed
✓ PR updated with new commits
Ready for re-review!

# Step 7: After the PR merges, clean up

/adlc:clean-worktrees

Found 1 worktree with merged branch:
  ~/worktrees/myapp/notif-45/ (branch: notif-45, merged: ✓)

Remove this worktree? > yes

✓ Worktree removed
✓ Workspace clean

🎉 Done! Feature shipped from idea to production.
```

### What just happened

- **Worktrees are automatic** — `/execute` created `~/worktrees/myapp/notif-45/`; your main workspace was never touched.
- **TDD ran on every task** — RED → GREEN → REFACTOR, with a per-task code review gate.
- **Execution is resumable** — if a run is interrupted, re-running `/adlc:execute NOTIF-45` picks up where it left off and respects already-completed sub-issues.
- For tier/strategy detail (team vs. sequential), branch strategies, and the completion protocol, see [`EXECUTION_WORKFLOW.md`](EXECUTION_WORKFLOW.md) and [`CLAUDE.md`](CLAUDE.md).

## Troubleshooting

### Installation Issues

**"Commands not found" — `/adlc:refine` not available**

```bash
# Verify plugin is installed
ls ~/.claude/plugins/adlc
# If not present, reinstall following the Prerequisites section, then restart Claude Code
```

**"No project management MCP configured"**

- MCP servers must be configured separately (see Prerequisites)
- Run `claude mcp add --transport sse linear-server https://mcp.linear.app/sse`, then restart Claude Code
- If authentication fails, use the `/mcp` command to re-authenticate

### Workflow Issues

| Message | Fix |
|---------|-----|
| "Issue missing Specification section" | Run `/adlc:refine <issue-id>` first |
| "Issue missing Technical Plan section" | Run `/adlc:plan <issue-id>` after refine |
| "No sub-issues found" | Run `/adlc:breakdown <issue-id>` after plan |
| "Working directory has uncommitted changes" | ADLC isolates work in a worktree; if you still see this, commit/stash in your main workspace |

### Execution Issues

- **Tests failing during `/adlc:execute`** — the executor retries (up to 3x), then continues with independent tasks. Fix manually and re-run; completed tasks are respected.
- **Execution interrupted mid-way** — just re-run `/adlc:execute <issue-id>`; it resumes without duplicate effort.
- **Can't find a PR's worktree** — `address-feedback` locates it automatically; otherwise `git worktree list` (worktrees live at `~/worktrees/<repo>/<branch>/`).

## Next Steps

- **Read the orientation:** [`skills/using-adlc/SKILL.md`](skills/using-adlc/SKILL.md) — the canonical workflow reference.
- **See the visual map:** [`EXECUTION_WORKFLOW.md`](EXECUTION_WORKFLOW.md).
- **Working on the plugin / want the philosophy and design decisions:** [`CLAUDE.md`](CLAUDE.md).
- **Scale to multiple features in parallel:** the [Conductor plugin](../conductor/README.md) (`conductor start`) reuses the same ADLC commands. See [`docs/PARALLEL-ORCHESTRATION.md`](docs/PARALLEL-ORCHESTRATION.md).
- **Customise for your stack:** tailor your `justfile` recipes and pre-commit hooks; see [`docs/CONFIGURATION.md`](docs/CONFIGURATION.md).

---

**Ready to accelerate your workflow? Start with `/adlc:refine` and let ADLC guide you from idea to production.**
</content>
