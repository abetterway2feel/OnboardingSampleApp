# CLAUDE.md

Internal tool that helps the Customer Success team clear the customer onboarding queue. See [README.md](README.md) for the scenario and setup.

## Issues and tickets

We track work as **GitHub issues on this repo** (`abetterway2feel/OnboardingSampleApp`), not Linear or Jira. A bare number like "ticket 3" or "#3" means GitHub issue 3.

- Read and update issues with `gh` (`gh issue view 3`, `gh issue list`, `gh issue edit`, `gh issue comment`).
- Write refined specifications back into the issue body or a comment on the issue.
- The `refined` label marks an issue whose specification is ready for planning.
- Reference the issue in commits and PRs (`Closes #N`).

## Commands

Prefer `just` recipes (run `just` to list them):

- `just setup` installs dependencies and the Playwright browser
- `just start` runs the app (server on :3001, client on :5173)
- `just test-unit` runs unit tests, `just test-e2e` runs Playwright, `just test` runs both

## Layout

- `server/` backend (port 3001)
- `client/` frontend (Vite, port 5173)
- `tests/e2e/` Playwright tests
- `sample-data/` sample customer data
