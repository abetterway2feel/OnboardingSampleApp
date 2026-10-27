# The RED Review Gate

Review the committed failing tests against the acceptance criteria **before** any production code
exists, then treat those test files as frozen. Mandatory for every task that writes production code.

An agent that can see the implementation writes tests shaped by it — the code is the most available
description of the behaviour — so the suite ends up asserting what the code does rather than what
the spec requires. Reviewing the tests while no implementation exists removes that contamination;
the commit is the evidence they predate the code. This replaces splitting tests and implementation
into separate tasks, keeping one task = one TDD cycle.

`AC-n` = one criterion from the ticket's Success Criteria. Number them if the ticket hasn't.

## Step 1 — watch it fail, then commit RED

```bash
just test tests/exports/export.test.ts   # unmarked: confirm each fails, and why
# skip-mark each test, naming its criterion: @pytest.mark.skip(reason="red-test-AC-1"),
# test.skip('... (red-test-AC-1)'), @Disabled("red-test-AC-1"), t.Skip, #[ignore = "..."]
just test                                # suite green again, so pre-commit passes
git add tests/exports/export.test.ts tests/e2e/export.spec.ts   # exact paths only
git commit -m "test(export): failing tests for AC-1..AC-4 (RED, skipped)"
```

Two rules make this reviewable: **test files only** (production code in the RED commit destroys
the ordering evidence), and **the failure output goes in the commit message** — that is what the
review reads. Never reach for `--no-verify`; the markers are what keep the hooks green.

GREEN removes the markers in the implementation commit, so `red-test-AC-n` never survives a
completed task.

## Step 2 — review the RED commit against the acceptance criteria

Dispatch the `code-reviewer` agent on the RED commit (`git show`), or have a human review it.

- [ ] **Traceable** — every test names the `AC-n` it verifies and carries its `red-test-AC-n`
      marker; every in-scope `AC-n` has a test; no test maps to no criterion
- [ ] **Behavioural** — assertions are on observable outcomes (return values, persisted state,
      emitted events, what the user sees), not call counts, private methods, or internal structure;
      error paths assert the observable consequence, not merely that something threw
- [ ] **Genuinely failing** — the recorded output shows each test failing on an assertion or a
      missing symbol, not an import/syntax/fixture error (a collection error is the signature of a
      test that never ran) and not passing already. Unconvincing output → strip the markers and
      re-run rather than take it on trust
- [ ] **Strong** — no vacuous assertions (`expect(true)`, `toBeDefined`, assertion-free tests);
      boundaries tested at the boundary (100000 and 100001, not "a big number")

**Reject and rewrite** on any failure. Rejection costs one commit; the same defect found after
GREEN means the implementation was built against the wrong contract.

## Step 3 — freeze the test files

Removing the `red-test-AC-n` markers is the **only** edit GREEN may make to an approved test file.
Failing test → fix the code. A test that is genuinely wrong is a **spec amendment**: stop, say
which `AC-n` is wrong, get it corrected in the ticket, re-run the RED review. A legitimate path —
just not a silent one.

This is the loophole that matters: without the freeze, a stuck agent relaxes an assertion,
everything goes green, and the diff looks like progress.

Optional mechanical enforcement, wired into the task's verification step or CI on phase PRs
(adapt the globs; `writing-justfiles` in Foundations owns justfile conventions):

```just
verify-red-frozen red_ref:
    #!/usr/bin/env bash
    set -uo pipefail
    if git diff -U0 {{red_ref}}..HEAD -- '**/*test*' '**/*spec*' |
       grep -E '^[-+][^-+]' | grep -v 'red-test-AC-'; then
        echo "Approved tests changed beyond marker removal — spec amendment required."; exit 1
    fi
    if grep -rn 'red-test-AC-' --include='*test*' --include='*spec*' .; then
        echo "RED markers still present — GREEN must remove them."; exit 1
    fi
```

## The residual gap: existing code

For refactors, bug fixes and behaviour changes the current behaviour is already visible, so commit
ordering proves less. Mitigations, strongest first:

1. **Derive the test cases from the `AC-n` up front** — supplied in the ticket before the
   implementing agent reads the code. The only measure that actually removes the contamination.
2. **Bug fixes: write the reproduction test from the bug report**, not the code path you found.
3. **Refactors: the existing tests are the contract** — change production code only. A refactor
   that needs test changes is a behaviour change; treat it as one.

Say so explicitly when this gap applies rather than implying the gate covers it.
