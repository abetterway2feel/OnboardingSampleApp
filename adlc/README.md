# ADLC - Agentic Development Lifecycle

**Version:** 1.0.0
**Plugin Type:** Claude Code Plugin for Development Workflow Automation

The ADLC (Agentic Development Lifecycle) plugin takes work from a rough idea to a merged PR through a consistent, spec-driven, test-driven pipeline, deeply integrated with Linear and JIRA.

```
/refine → /plan → /breakdown → /execute → /pr → /address-feedback
```

## Where to start

- **New to ADLC? Read the workflow orientation first:** [`skills/using-adlc/SKILL.md`](skills/using-adlc/SKILL.md) — the canonical single source for the pipeline, when to use each command, conventions, and how execution works. (It's also injected at session start.)
- **Want the visual map?** [`EXECUTION_WORKFLOW.md`](EXECUTION_WORKFLOW.md) — mermaid diagrams of the lifecycle, team/sequential strategies, and branch strategies.
- **Want a concrete end-to-end walkthrough?** [`QUICK-START.md`](QUICK-START.md) — install + a realistic example run.
- **Working *on* the plugin?** [`CLAUDE.md`](CLAUDE.md) — architecture, design decisions, and contributor guidance.
- **Skill catalog:** [`docs/SKILLS-README.md`](docs/SKILLS-README.md). **Parallel/conductor specifics:** [`docs/PARALLEL-ORCHESTRATION.md`](docs/PARALLEL-ORCHESTRATION.md). **Config & hooks:** [`docs/CONFIGURATION.md`](docs/CONFIGURATION.md), [`docs/HOOKS.md`](docs/HOOKS.md).

## Commands at a glance

For the full narrative — what each command does, when to use it, and how they chain — see [`skills/using-adlc/SKILL.md`](skills/using-adlc/SKILL.md).

| Command | Purpose |
|---------|---------|
| `/adlc:refine <id \| description>` | Turn a rough idea into a Specification (WHAT to build), in the PM ticket. |
| `/adlc:plan <id>` | Turn the Specification into a Technical Plan (HOW to build). |
| `/adlc:breakdown <id>` | Split into phase sub-issues (vertical slices), each labelled `feature` / `bug` / `chore`. |
| `/adlc:execute <id>` | 3-tier execution: TDD, code review, phase PRs. Primary entry point. |
| `/adlc:pr` | Open the feature PR (then driven to done automatically by `babysitting-prs`). |
| `/adlc:quick <description>` | Small, well-defined tasks with minimal overhead. |
| `/adlc:chore <id \| description>` | Maintenance (no TDD, but full verification + lightweight review). |
| `/adlc:bug-fix <id \| description>` | Systematic debugging + TDD. |
| `/adlc:address-feedback <pr>` | Process PR review comments into sub-issues and implement them. |
| `/adlc:clean-worktrees` | Clean up merged worktrees and branches. |

Each command can run standalone or chain to the next.

> **After a PR is raised, the flow drives it to done automatically.** Once `/execute` (or
> `/adlc:pr`) opens a non-draft PR, a fresh background subagent takes over, following the
> `babysitting-prs` skill: it drives CI to green, critically evaluates each review
> comment and auto-incorporates **only** the low-risk accepted ones (escalating
> ambiguous/architectural feedback), and notifies you when the PR is green, approved, and all
> threads resolved. It **never auto-merges** — the merge is always your call.
>
> It runs in its own fresh context and waits with the `Monitor` tool rather than burning turns,
> which keeps babysitting off the calling session's context.

## Installation

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

See [`QUICK-START.md`](QUICK-START.md) for the full prerequisites checklist (Just, ripgrep, fd, GitHub CLI, uv, pre-commit) and a complete idea-to-PR walkthrough.

### First time in a repo

Run `/foundations:setup` (from the [Foundations plugin](../foundations/README.md)) to establish the repository foundation: a generated CLAUDE.md, a justfile with verification recipes, pre-commit hooks, and PM integration. ADLC builds on top of this foundation.

## Integration Requirements

### Required MCP Integration

**IMPORTANT:** The ADLC plugin does NOT install MCP servers. You must install and configure them separately in your Claude Code settings.

**Linear:**

Linear provides an official, centrally-hosted MCP server. Install via Claude Code CLI:

```bash
# Add Linear MCP server
claude mcp add --transport sse linear-server https://mcp.linear.app/sse

# Authenticate when prompted
# Use the /mcp command to complete authentication
```

- Tools needed: `mcp__linear-server__*`
- Verify: Run `/foundations:setup` to check if MCP server is available

**OR**

**JIRA:**

- **User must install:** JIRA MCP server (check MCP marketplace)
- Tools needed: JIRA MCP tools
- Configuration: Add JIRA credentials to Claude Code MCP settings
- Verify: Run `/foundations:setup` to check if MCP server is available

**Installation Steps:**

1. Install the Linear or JIRA MCP server per their documentation
2. Add configuration to Claude Code settings (`~/.claude/settings.json`)
3. Restart Claude Code
4. Verify with `/foundations:setup` or test MCP tools availability

### Optional But Recommended

**Justfile:** Create a `justfile` in the repository root with `test`, `lint`, `format` (and ideally `install`, `build`) recipes. ADLC prefers `just` so workflows stay stack-agnostic; without it, ADLC falls back to stack-specific commands.

**Git Worktrees:** ADLC creates isolated worktrees automatically during `/execute` (handled by the [`execution-orchestration` skill](skills/execution-orchestration/SKILL.md)); no manual setup needed.

## Configuration

### Project Management Configuration

Add a `## Project Management` section to your CLAUDE.md (created automatically by `/foundations:setup`):

```markdown
## Project Management

**Tool:** Linear
**Team:** CORE
**Project:** core-platform
**Epic:** Onboarding Improvements (CORE-100)
```

This tells ADLC which Linear team/project to create issues in. The same section is auto-discovered by the [Conductor plugin](../conductor/README.md) as a zero-config fallback.

**How PM config flows across plugins:**

| Plugin | Role |
|--------|------|
| **Foundations** | `/foundations:setup` writes `## Project Management` to CLAUDE.md |
| **ADLC** | Reads it to route issues to the correct Linear team (via MCP) |
| **Conductor** | Auto-discovers it; also supports explicit `~/.adlc-conductor/config.yml` and `.claude/conductor.local.md` |

**Authentication:** ADLC uses the Linear MCP server (OAuth via `claude mcp add`). Conductor uses `LINEAR_API_KEY` env var for its Python-based board polling.

For the full set of configuration options (including hooks and per-repo overrides in `.claude/adlc.local.md`), see [`docs/CONFIGURATION.md`](docs/CONFIGURATION.md) and [`docs/HOOKS.md`](docs/HOOKS.md).

### Estimated Claude Spend in PRs

Opt in to have every ADLC-raised PR carry a list-price estimate of the Claude Code tokens that
produced it — a quick signal for "what did this change cost" right next to the diff.

Enable it in `.claude/adlc.local.md`:

```yaml
pr:
  include_spend: true            # default: false
  spend_basis: excl_cache_reads  # or incl_cache_reads for the list-price upper bound
```

The PR body then gets a collapsible block:

```markdown
<details><summary>💸 Estimated Claude spend · ~$42 (list price)</summary>

318 turns · 2 session(s) · delegated $38 / interactive $4
Opus $31 · Sonnet $11
input $3 · output $12 · cache-write $27 · cache-read $9 (excluded)
scope: this branch · since 2026-06-02

_List-price estimate · deduped by message.id · cache-reads excluded unless billed._
</details>
```

The estimate is produced by the [usage plugin](../usage/README.md)'s analyser (the single source
of pricing). If the usage plugin isn't installed, the section is simply omitted. Cost is
branch-scoped and deduped by `message.id`, so each PR reflects its own work and the feature PR
rolls up its phases without double-counting.

## Multi-Feature Orchestration with Conductor

For parallel execution of multiple features, use the [Conductor plugin](../conductor/README.md):

```bash
# Start the conductor (monitors Linear, routes issues, manages executors)
conductor start
```

Conductor polls your Linear board, routes bugs/chores/features to executor panes, notifies you when PRs are ready, and rebases in-flight branches. It uses the same ADLC commands (`/adlc:execute`, `/adlc:bug-fix`, `/adlc:chore`) internally. See the [Conductor README](../conductor/README.md) and [`docs/PARALLEL-ORCHESTRATION.md`](docs/PARALLEL-ORCHESTRATION.md).

## Troubleshooting

### "No project management MCP configured"

MCP servers must be installed separately by the user:

1. Install Linear MCP: `claude mcp add --transport sse linear-server https://mcp.linear.app/sse`
2. Add configuration to `~/.claude/settings.json` (see Linear MCP docs)
3. Restart Claude Code
4. Verify tools are available with `/foundations:setup`

The ADLC plugin does NOT install MCP servers automatically.

### "Issue missing Specification section"

The issue needs refinement first: `/adlc:refine <issue-id>`

### "Issue missing Technical Plan section"

Run planning after refine: `/adlc:plan <issue-id>`

### "No sub-issues found"

The issue needs breakdown first: `/adlc:breakdown <issue-id>`

### "Circular dependency detected"

Review sub-issue dependencies in Linear. One task is blocking another that blocks it back. Fix the dependency chain and re-run `/execute`.

### "Working directory has uncommitted changes"

ADLC creates isolated worktrees automatically, so your main workspace isn't affected. If you still hit this, commit or stash changes in your main workspace.

### "ADLC commands not found"

Verify the plugin is installed (`ls ~/.claude/plugins/adlc`) and restart Claude Code. Reinstall via the Installation section if needed.

## Extending ADLC

### Add a new skill

1. Create skill directory: `plugins/adlc/skills/my-skill/`
2. Write `SKILL.md` with frontmatter and content (see [`CLAUDE.md`](CLAUDE.md) for the "commands orchestrate, skills guide" conventions and the <500-line target)
3. Reference from commands: `Skill(adlc:my-skill)`

### Add a new command

1. Create command file: `plugins/adlc/commands/my-command.md`
2. Add frontmatter with description
3. Reference relevant skills (commands orchestrate, < 250 lines)

For architecture, design decisions, anti-patterns, and code-quality standards, see [`CLAUDE.md`](CLAUDE.md).

## Version History

**1.0.0** - Initial release

- `/refine`, `/breakdown`, `/execute` commands
- `refining-issues`, `breakdown-planning` skills
- Linear/JIRA deep integration
- Subagent-driven development pattern
- TDD enforcement
- Automatic code review
</content>
