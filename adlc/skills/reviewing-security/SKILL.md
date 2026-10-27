---
name: reviewing-security
description: Deep application-security review playbook - dependency audit, secrets/authn-authz/injection/data-protection/infra passes, optional runtime validation, and chained-attack analysis - producing a severity-calibrated report with exploitability and agent-ready remediation. Loaded by code-reviewer when a change touches auth, user input, secrets, crypto, or external boundaries; also invocable standalone for a focused security pass.
---

# Reviewing for Security

Deep security lens for a change or codebase. The `code-reviewer` agent does a baseline
security check on every review (inputs, authn/z, obvious secrets/injection); load this skill
when the diff warrants more — auth/authorization changes, input handling, secrets, crypto,
dependency updates, or anything crossing an external boundary. It is also invocable on its own
for a standalone security pass.

**Core principle:** Calibrate severity by real-world exploitability, not theoretical worst case.

## Workflow

1. **Scope intake**
   - Identify the target (diff, branch, commit range, or directory) and use it directly as the source of truth.
   - If a prior security review exists in context, note its findings so you can produce a delta (new / resolved / persistent).

2. **Static analysis**
   - **Dependency audit** — run the ecosystem's audit command first; it is the fastest win. Record CVE IDs and affected versions.
     - Node.js: `npm audit --json` / `yarn audit --json`
     - Python: `pip-audit` or `safety check`
     - .NET: `dotnet list package --vulnerable`
     - Go: `govulncheck ./...`
   - **Secrets & configuration** — grep the codebase (including `.env*`, `docker-compose*`, CI configs, recent git history) for hardcoded credentials, API keys, tokens, insecure defaults, missing security headers.
   - **AuthN / AuthZ** — JWT/session/OAuth validation, authorization guards on every endpoint, privilege-escalation paths, token expiry/refresh.
   - **Input validation & injection** — SQLi (raw queries, string concatenation), XSS (unescaped output, missing CSP), command injection (shell exec with user input), path traversal, untrusted deserialization.
   - **Data protection** — sensitive data in logs/errors/responses, encryption at rest and in transit, PII handling, cryptographic algorithm choices.
   - **Infrastructure & deployment** — container configs, cloud IAM/network/storage access, CI/CD secret handling and artifact integrity.

3. **Runtime validation (when feasible)**
   Unless asked for "static only" or the app cannot start locally:
   - Boot the app via its standard dev setup (`docker-compose`, `npm start`, `just`).
   - For each High/Critical finding, attempt to reproduce or exploit it.
   - If the app cannot start, note this and continue — do not block.

4. **Chained-attack analysis**
   - Identify how individual findings combine into higher-impact attacks.
   - State the access and knowledge an attacker would need to execute the chain.
   - Re-rate individual findings if the chain raises their effective severity.

5. **Compose report** (format below) — calibrate severity and exploitability consistently, note false positives explicitly, and end with remediation prompts.

## Severity Calibration

| Severity | Criteria |
|----------|----------|
| 🔴 **Critical** | Exploitable by unauthenticated external attacker, high impact (data breach, RCE, full compromise) |
| 🟡 **High** | Exploitable by authenticated user, OR unauthenticated with moderate impact (privilege escalation, significant data exposure) |
| 🟡 **Medium** | Requires insider access or chained exploits. Defence-in-depth issue with real-world plausibility |
| 🟢 **Low** | Theoretical risk, best-practice violation, or informational finding with minimal exploitability |

**Exploitability:** Exploitable / Partially Exploitable / Theoretical / Not Testable.

## Required Output Format

```markdown
# Security Review – <branch/PR/commit id>  (<date>)

## Executive Summary
| Metric | Result |
|--------|--------|
| Total Findings | <n> (Critical: x, High: y, Medium: z, Low: w) |
| Exploitability | <summary if runtime validation ran> |
| Delta from Prior Scan | new / resolved / persistent (if applicable) |
| Security Posture | Strong / Adequate / Weak / Critical |

## Detailed Findings
For each finding:
- **ID:** SEC-001
- **Severity:** 🔴 Critical / 🟡 High / 🟡 Medium / 🟢 Low
- **Exploitability:** Exploitable / Partially Exploitable / Theoretical / Not Testable
- **Category:** auth / injection / secrets / data-protection / infra / dependency
- **Location:** file:line
- **Description:** what the vulnerability is
- **Impact:** what happens if exploited
- **Evidence:** code snippet or runtime result
- **Remediation:** specific fix with code example
- **References:** OWASP / CWE / CVE where applicable

## Chained Attacks
For each chain:
- **Findings:** SEC-001 + SEC-003
- **Severity:** combined rating
- **Access / Knowledge Required:** how viable in practice

## Remediation Checklist
### 🔴 Critical (fix immediately)
- [ ] **SEC-001: <title>**
  - **Prompt:** "<self-contained instruction another agent can execute>"
  - **Files:** <list>
  - **Effort:** Small / Medium / Large
### 🟡 High / Medium
- [ ] ...
### 🟢 Low
- [ ] ...
```

## Heuristics

- Calibrate severity by real-world exploitability, not theoretical worst case. Note false positives and explain why they are not risks.
- Dependency audits are the fastest wins — run them first.
- A missing authorization guard outranks a hardened one with a weak cipher — prioritise access-control gaps.
- When loaded by `code-reviewer` for a specific escalated finding, return a focused report on that finding rather than re-reviewing the whole change.
- Recommend ongoing practices where relevant: SAST/DAST tooling, dependency-update schedules.

Deliver every review in the specified format, with explicit file:line references, calibrated severity, and agent-ready remediation prompts.
