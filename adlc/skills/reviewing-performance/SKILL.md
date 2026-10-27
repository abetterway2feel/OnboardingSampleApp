---
name: reviewing-performance
description: Measurement-first performance review playbook - layer analysis (frontend/backend/database), optional profiling, severity-tagged findings with evidence against reference budgets, and concrete optimisations. Loaded by code-reviewer when a change touches hot paths, bulk operations, or database access; also invocable standalone for a focused performance pass.
---

# Reviewing for Performance

Deep performance lens for a change or codebase. The `code-reviewer` agent does a baseline
performance check on every review (algorithmic complexity, obvious N+1, scaling); load this
skill when the diff warrants more — hot paths, bulk operations, database access, or reported
latency/memory concerns. It is also invocable on its own for a standalone performance pass.

**Core principle:** Measure first, optimise second. Never propose an optimisation without
evidence of a real bottleneck. Optimise common paths, not rare edge cases. Prefer clear code;
optimise only where measurement justifies it.

## Workflow

1. **Scope & baseline**
   - Identify the target (diff, branch, or hot path) and use it directly as the source of truth.
   - Establish baseline metrics where measurable: load time, latency, memory, CPU, query time.
   - Identify critical user paths and performance-sensitive operations in scope.

2. **Layer analysis** — inspect each relevant layer:
   - **Frontend** — bundle size and code splitting, render/DOM thrashing, unmemoised re-renders, asset optimisation (compression, modern formats, lazy loading), main-thread blocking, leaked listeners/intervals.
   - **Backend** — algorithmic complexity (flag O(n²)+ on hot paths), blocking I/O that should be async, batching opportunities, caching gaps, payload sizes, connection pooling.
   - **Database** — N+1 queries, `SELECT *`, missing indexes on filtered/joined columns, unbounded result sets without pagination, long-running transactions and lock contention. Use `EXPLAIN` where available.

3. **Profiling (where feasible)**
   - Use language-appropriate profilers (Chrome DevTools/Lighthouse, Py-Spy, VisualVM, dotTrace).
   - Capture flame graphs or query plans as evidence for findings.
   - If profiling is not feasible in this environment, mark findings as **analytical** (evidence from code, not measurement) and say so.

4. **Compose report** (format below) — every finding cites evidence and proposes a concrete fix.

## Severity Calibration

| Severity | Criteria |
|----------|----------|
| 🔴 **Critical** | Measured regression or bottleneck breaching a budget on a hot path (e.g. N+1 on a core endpoint, unbounded query) |
| 🟡 **Major** | Inefficiency with real user impact under load (missing index, blocking I/O, large uncached payload) |
| 🟢 **Minor** | Best-practice deviation with marginal impact, or improvement on a cold path |

## Reference Budgets

Use as defaults when the repo defines none; defer to repo-specific budgets when present.
- **Frontend:** LCP < 2.5s, FID < 100ms, CLS < 0.1, TTI < 3s
- **Backend:** API p95 < 200ms
- **Database:** simple query < 100ms, complex query < 1s
- **Resources:** memory < 80% capacity, CPU < 70% average

## Required Output Format

```markdown
# Performance Review – <branch/PR/commit id>  (<date>)

## Executive Summary
| Metric | Result |
|--------|--------|
| Overall Assessment | Fast / Acceptable / Needs Work / Critical |
| Findings | <n> (Critical: x, Major: y, Minor: z) |
| Evidence Basis | Profiled / Analytical (no runtime profiling available) |
| Layers Reviewed | Frontend / Backend / Database |

## 🔴 Critical Findings
| File:Line | Issue | Evidence | Impact | Suggested Fix |
|-----------|-------|----------|--------|---------------|
| repo/users.py:88 | N+1 query in list endpoint | EXPLAIN: 1+N round trips | p95 grows with row count | Eager-load with join / batch |

## 🟡 Major Findings
… (same table)

## 🟢 Minor Suggestions
- <file:line> — <improvement>

## Measurements
- Baseline vs. observed metrics, profiler output, or query plans (where captured)

## Action Checklist
- [ ] <concrete optimisation with file reference>
```

## Heuristics

- Pair every finding with evidence — a measurement, a query plan, or an explicit "analytical only" note. No unsupported claims.
- Never compromise security or correctness for performance. Do not skip input validation or weaken crypto for speed.
- Eliminate N+1 queries, unbounded result sets, and `SELECT *` on hot paths first — these scale with data.
- When loaded by `code-reviewer` for a specific escalated finding, return a focused analysis of that finding rather than re-reviewing the whole change.
- Flag premature optimisation as a finding too: complexity added without measured benefit is a cost.

Deliver every review in the specified format, with explicit file:line references, evidence for each finding, and concrete optimisations.
