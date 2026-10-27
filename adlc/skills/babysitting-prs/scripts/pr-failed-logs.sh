#!/usr/bin/env bash
# Print the tail of the failing log for each failing check on a PR, and nothing else.
#
# Raw CI logs are the fastest way to blow an agent's context budget: a full `gh run view --log`
# runs to tens of thousands of tokens, and the useful part is the last few dozen lines. This
# bounds the output per check so diagnosis costs a known amount.
#
# Checks with no log to fetch (StatusContext entries such as a bot review) are named rather than
# skipped silently, so an absent log is never mistaken for an absent failure.
#
# Exit codes:
#   0  the check list was read (whether or not anything is failing)
#   2  the check list could not be read — you do not know what is failing
#   4  `gh` unavailable, or not a GitHub repository
#   64 usage error

set -uo pipefail

usage() {
    cat <<'USAGE'
Usage: pr-failed-logs.sh <pr-number> [options]

  --repo OWNER/NAME   Repository (default: gh's current repo)
  --lines N           Log lines per failing check (default 40)
  --check NAME        Only this check (substring match)
  -h, --help          This help
USAGE
}

PR=""
REPO=""
LINES=40
ONLY=""

while [ $# -gt 0 ]; do
    case "$1" in
        --repo)    REPO="${2:-}"; shift 2 ;;
        --lines)   LINES="${2:-}"; shift 2 ;;
        --check)   ONLY="${2:-}"; shift 2 ;;
        -h|--help) usage; exit 0 ;;
        -*)        echo "unknown option: $1" >&2; usage >&2; exit 64 ;;
        *)         if [ -z "$PR" ]; then PR="$1"; shift; else
                       echo "unexpected argument: $1" >&2; exit 64
                   fi ;;
    esac
done

[ -n "$PR" ] || { echo "a PR number is required" >&2; usage >&2; exit 64; }
case "$LINES" in ''|*[!0-9]*) echo "--lines must be a number" >&2; exit 64 ;; esac

command -v gh >/dev/null 2>&1 || { echo "ERROR gh is not installed" >&2; exit 4; }

if [ -n "$REPO" ]; then
    repo_json=$(gh repo view "$REPO" --json owner,name 2>/dev/null)
else
    repo_json=$(gh repo view --json owner,name 2>/dev/null)
fi
OWNER=$(printf '%s' "$repo_json" | jq -re '.owner.login' 2>/dev/null) || OWNER=""
NAME=$(printf '%s' "$repo_json" | jq -re '.name' 2>/dev/null) || NAME=""
if [ -z "$OWNER" ] || [ -z "$NAME" ]; then
    echo "ERROR ${REPO:-this directory} is not a reachable GitHub repository" >&2
    exit 4
fi

checks_json=$(gh pr checks "$PR" --repo "$OWNER/$NAME" --json name,bucket,link 2>/dev/null)
if ! printf '%s' "$checks_json" | jq -e 'type == "array"' >/dev/null 2>&1; then
    echo "ERROR could not read checks for #$PR; you do not know what is failing" >&2
    exit 2
fi

failing=$(printf '%s' "$checks_json" \
    | jq -r '.[] | select(.bucket == "fail" or .bucket == "cancel") | "\(.name)\t\(.bucket)\t\(.link // "")"')

if [ -z "$failing" ]; then
    echo "NO FAILING CHECKS on #$PR"
    exit 0
fi

while IFS=$'\t' read -r name bucket link; do
    [ -n "$name" ] || continue
    if [ -n "$ONLY" ] && ! printf '%s' "$name" | grep -Fq -- "$ONLY"; then
        continue
    fi

    echo "=== $name ($bucket) ==="

    # A check's link is either .../actions/runs/<run>/job/<job> or an arbitrary URL for a
    # StatusContext, which has no log at all.
    job_id=$(printf '%s' "$link" | sed -n 's#.*/job/\([0-9][0-9]*\).*#\1#p')
    run_id=$(printf '%s' "$link" | sed -n 's#.*/runs/\([0-9][0-9]*\).*#\1#p')

    log=""
    if [ -n "$job_id" ]; then
        log=$(gh run view --repo "$OWNER/$NAME" --job "$job_id" --log-failed 2>/dev/null)
        [ -n "$log" ] || log=$(gh run view --repo "$OWNER/$NAME" --job "$job_id" --log 2>/dev/null)
    elif [ -n "$run_id" ]; then
        log=$(gh run view "$run_id" --repo "$OWNER/$NAME" --log-failed 2>/dev/null)
    fi

    if [ -n "$log" ]; then
        printf '%s\n' "$log" | tail -n "$LINES"
    else
        echo "NO LOG available — inspect it directly: ${link:-no link reported}"
    fi
done <<<"$failing"
