# ADLC Configuration Points

The **tailoring contract** for this plugin: the specific elements that change when porting ADLC
to a different **company environment** (PM system, VCS host, task runner, conventions) or a
different **agent platform** (Cursor, Codex).

This file is **shipped with the plugin** and is what the `tailor` meta-plugin looks for **first**
(`/tailor:port`). If a plugin doesn't ship one, tailor derives it with the
`identifying-configuration-points` skill. Keeping it in-repo means the plugin author — who knows the
seams best — declares them, rather than a generic analysis guessing.

**How tailor uses this:** it doesn't run a fixed generator. It **researches the current target
APIs** (real MCP tool prefixes for the source and target PM systems, the real VCS CLI / task-runner
syntax — don't assume a `gh`-shaped Bitbucket CLI or an `mcp__jira_server__` prefix exists), then
**authors a port-specific transform script** to apply the swaps and structural changes. So the
`detect` patterns below locate each seam; the *values* to swap to are verified at port time, not
taken from this file. See `plugins/tailor/skills/porting-plugins/`.

Two axes: **Company** (your org's tools and rules) and **Platform** (the agent harness).

## Seams (machine-readable index)

`tailor` reads this index to know what to look for; the prose below explains each. `kind`:
`substitution` (text/term swap) · `structural` (layout/format change) · `injection` (content
added) · `policy` (rules to enforce).

```yaml
seams:
  # --- Company axis ---
  - id: pm-system
    axis: company
    kind: substitution
    locations: ["skills/**", "commands/**"]
    detect: ["mcp__linear-server__", "\\bLinear\\b", "\\bJIRA\\b"]
    note: PM system MCP tool prefix + terminology + issue-key format (verify the target MCP's real prefix at port time)
  - id: vcs-host
    axis: company
    kind: substitution
    locations: ["commands/pr.md", "skills/creating-pull-requests/**", "skills/babysitting-prs/**", "skills/addressing-pr-feedback/**"]
    detect: ["gh pr ", "gh api ", "gh repo view", "gh run view"]
    note: >-
      VCS host CLI for PRs / checks / review / merge. ADLC is deliberately GitHub-only at runtime:
      the PR scripts under skills/babysitting-prs/scripts/ confirm the repo with `gh repo view` and
      exit 4 rather than branching per host, so a port replaces them wholesale (each has a stub-CLI
      test suite in the sibling tests/ directory that must be ported with it).
  - id: task-runner
    axis: company
    kind: substitution
    locations: ["skills/**", "hooks/verify-guard.sh"]
    detect: ["\\bjust (test|lint|format|build|typecheck)\\b", "just --list", "just \"\\$recipe\""]
    note: stack-agnostic verification verb (just / make / npm)
  - id: ways-of-working
    axis: company
    kind: policy
    locations: ["CLAUDE.md", "skills/babysitting-prs/**", "skills/requesting-code-review/**", "hooks/verify-guard.sh"]
    note: PR/review/merge/commit/CI non-negotiables — inject into memory + PR/review skills
  - id: language-references
    axis: company
    kind: injection
    locations: ["agents/backend-engineer.md", "agents/frontend-engineer.md", "agents/qa-engineer.md", "agents/platform-engineer.md", "agents/code-reviewer.md"]
    note: per-role stack/framework/style references appended to engineer + reviewer agents
  - id: model-routing
    axis: company
    kind: substitution
    locations: ["skills/execution-orchestration/references/model-routing.md", "agents/*.md"]
    note: which model each delegated role uses (execution=Sonnet, review=Opus)
  - id: worktree-paths
    axis: company
    kind: substitution
    locations: ["skills/execution-orchestration/**", "CLAUDE.md"]
    detect: ["~/worktrees/", ".claude/executor-state"]
    note: worktree + executor/conductor state locations (gitignored)

  # --- Platform axis ---
  - id: skill-invocation
    axis: platform
    kind: substitution
    locations: ["skills/**", "commands/**"]
    detect: ["Skill\\(adlc:", "`adlc:"]
    note: how skills are invoked (Claude Skill(adlc:X) / Cursor /X / Codex $X)
  - id: subagent-dispatch
    axis: platform
    kind: structural
    locations: ["skills/execution-orchestration/**"]
    detect: ["subagent_type=", "TaskCreate", "spawn_teammate", "Agent Teams"]
    note: dispatch + parallelism — Claude Agent Teams / Cursor background subagents / Codex sequential
  - id: hooks
    axis: platform
    kind: structural
    locations: ["hooks/hooks.json", "hooks/*.sh"]
    detect: ["SubagentStop", "SessionStart", "TeammateIdle", "TaskCompleted", "CLAUDE_PLUGIN_ROOT"]
    note: hook event-name casing + plugin-root env var
  - id: agent-skill-format-layout
    axis: platform
    kind: structural
    locations: ["agents/*.md", "skills/*/SKILL.md"]
    note: Cursor keeps MD; Codex uses TOML subagents + .agents/skills layout
  - id: manifest-memory
    axis: platform
    kind: structural
    locations: [".claude_plugin/plugin.json", "CLAUDE.md"]
    note: bundle manifest + memory file (.cursor-plugin + CLAUDE.md/rules / config.toml + AGENTS.md)
  - id: mcp-config
    axis: platform
    kind: structural
    locations: [".mcp.json"]
    note: external — Cursor .cursor/mcp.json / Codex [mcp_servers] in config.toml
  - id: session-start
    axis: platform
    kind: structural
    locations: ["hooks/session-init.sh", "skills/using-adlc/SKILL.md"]
    note: orientation injection — Claude SessionStart hook / Cursor alwaysApply rule / Codex AGENTS.md (single-source from using-adlc)
```

---

## Company axis — details

- **pm-system** — ADLC reads/writes specs, plans, sub-issues, and status via a PM MCP server. Swap the MCP tool prefix (`mcp__linear-server__*`), terminology ("issue"/"ticket"), and issue-key pattern. **Research the target MCP's real prefix and tool names first** (the Atlassian/JIRA MCP is not `mcp__jira_server__`) — don't guess. ADLC documents both Linear and JIRA — prune to the one you use.
- **vcs-host** — `gh pr …` / `gh api …` → your host's CLI. **Verify the target actually has an equivalent**: GitLab `glab` differs in subcommands; Bitbucket has no first-class `gh` equivalent (REST/`curl` or `acli`). Adjust PR-template detection. The PR loops are **scripts**, not prose, and they are GitHub-only on purpose (each exits `4` on a non-GitHub repo rather than guessing), so port the script plus its test suite together: `poll-pr-state.sh`, `watch-pr-comments.sh`, `pr-failed-logs.sh`, `reply-to-thread.sh`, `watch-pr-checks.sh`. The four rules each one implements — decide by what is still pending, `fail`/`cancel` are failures, absence is not success, an error is not an empty result — are host-independent and must survive the port.
- **task-runner** — `just test|lint|format|build` → your runner; ADLC is abstracted here, so it's mostly a term swap. Anchor the swap to recipe verbs (not the bare word "just") and confirm flags exist (`just --list` has no `make` equivalent).
- **ways-of-working** — your PR doctrine (what "done" means, approvals, merge method, commit convention, CI/security gates). Capture from the target repo's `.github` (branch protection, required checks), `CONTRIBUTING.md`, and a team interview; inject into `CLAUDE.md` and the PR/review skills so they fire in the loop.
- **language-references** — the stack the engineer + reviewer agents should assume; append concrete, repo-true references.
- **model-routing** — execution → Sonnet, review → Opus; adjust per provider/cost.
- **worktree-paths** — `~/worktrees/<repo>/…` and `.claude/executor-state/…`; repoint if needed; keep state gitignored.

## Platform axis — details

- **skill-invocation** — `Skill(adlc:X)` / `` `adlc:X` `` → Cursor `/X` → Codex `$X`.
- **subagent-dispatch** — Claude Agent Teams (`TaskCreate`/`spawn_teammate`) → Cursor background subagents (`is_background`) → Codex **sequential** (explicit-spawn only). Biggest semantic difference.
- **hooks** — event casing (Claude/Codex PascalCase ↔ Cursor camelCase); plugin-root env var.
- **agent-skill-format-layout** — Cursor MD; Codex TOML subagents + `.agents/skills/`.
- **manifest-memory** — `.claude_plugin/plugin.json` + `CLAUDE.md` → `.cursor-plugin` + rules / `config.toml` + `AGENTS.md`.
- **mcp-config** — `.cursor/mcp.json` / `[mcp_servers.*]` in `config.toml`.
- **session-start** — orientation injection; translate the mechanism, don't copy the hook (Claude SessionStart → Cursor `alwaysApply` rule → Codex `AGENTS.md`). Single-source from the `using-adlc` skill.

## See also
- `plugins/tailor/` — the generic engine that consumes this contract + platform/company profiles (`/tailor:port`).
- `plugins/tailor/skills/identifying-configuration-points/` — derives this contract for plugins that don't ship one.
- `plugins/tailor/skills/porting-plugins/references/construct-mapping.md` — the full Claude → Cursor → Codex mapping.
