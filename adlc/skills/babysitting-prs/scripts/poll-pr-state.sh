#!/usr/bin/env bash
# One poll of everything a babysitting cycle needs to decide: PR state, CI, review threads.
# Prints a compact KEY=value block so a cycle costs a few hundred tokens instead of several
# thousand of raw JSON.
#
# This is the SNAPSHOT half of the pair: one call, one answer, then it exits — call it at the top
# of a cycle. `watch-pr-comments.sh` is the WAIT half, armed under Monitor to wake you when a
# reviewer speaks. Only this one tells you what is still unresolved.
#
# Every field fails CLOSED. A request that fails, returns nothing, or returns fewer threads
# than it claims to have yields UNKNOWN, never a zero — because "0 unresolved threads" and
# "0 failing checks" are the two strongest possible false green signals. Specifically:
#
#   - `jq` on empty input exits 0 and prints nothing, so a guard that pipes a failed request
#     into `jq` and compares counts compares "" against "" and stays silent. Every count here
#     is proven with `jq -e` on a payload that parsed as the expected shape first.
#   - `printf '%s'`, never `echo "$json"`: echo interprets backslash escapes, so an escaped
#     \n inside a comment body becomes a real newline and jq then rejects the JSON.
#   - GraphQL reviewThreads cursor pagination under-reports (observed: 10 of 11 threads with
#     first:2 and hasNextPage=false). One first:100 page, reconciled against totalCount.
#
# Exit codes:
#   0  every field observed
#   2  at least one field is UNKNOWN — you learned less than you asked for, do not conclude
#   4  `gh` unavailable, or not a GitHub repository
#   64 usage error

set -uo pipefail

usage() {
    cat <<'USAGE'
Usage: poll-pr-state.sh <pr-number> [options]

  --repo OWNER/NAME   Repository (default: gh's current repo)
  --threads           Also print one THREAD line per unresolved thread
  --body-chars N      Characters of thread body per THREAD line (default 200)
  -h, --help          This help

Output is KEY=value lines: BRANCH, STATE, DRAFT, MERGEABLE, MERGE_STATE, DECISION,
CI, CI_FAILING, THREADS_STATE, THREADS_TOTAL, THREADS_UNRESOLVED.
CI is one of green | failing | pending | none | UNKNOWN.
THREADS_STATE is KNOWN | UNKNOWN; counts are only meaningful when it is KNOWN.
USAGE
}

PR=""
REPO=""
WANT_THREADS=false
BODY_CHARS=200

while [ $# -gt 0 ]; do
    case "$1" in
        --repo)       REPO="${2:-}"; shift 2 ;;
        --threads)    WANT_THREADS=true; shift ;;
        --body-chars) BODY_CHARS="${2:-}"; shift 2 ;;
        -h|--help)    usage; exit 0 ;;
        -*)           echo "unknown option: $1" >&2; usage >&2; exit 64 ;;
        *)            if [ -z "$PR" ]; then PR="$1"; shift; else
                          echo "unexpected argument: $1" >&2; exit 64
                      fi ;;
    esac
done

[ -n "$PR" ] || { echo "a PR number is required" >&2; usage >&2; exit 64; }
case "$BODY_CHARS" in ''|*[!0-9]*) echo "--body-chars must be a number" >&2; exit 64 ;; esac

command -v gh >/dev/null 2>&1 || {
    echo "ERROR gh is not installed" >&2
    exit 4
}

# Resolve the repository once, and use it as the GitHub precondition: `gh repo view` goes
# through gh's own config, so a GitHub Enterprise host passes and a non-GitHub remote does not.
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

unknown=0

# --- PR envelope -------------------------------------------------------------------------
BRANCH=UNKNOWN; STATE=UNKNOWN; DRAFT=UNKNOWN
MERGEABLE=UNKNOWN; MERGE_STATE=UNKNOWN; DECISION=UNKNOWN

# `gh pr view` has no reviewThreads field — asking for it fails the whole command.
pr_json=$(gh pr view "$PR" --repo "$OWNER/$NAME" \
              --json headRefName,state,isDraft,mergeable,mergeStateStatus,reviewDecision 2>/dev/null)
if printf '%s' "$pr_json" | jq -e 'type == "object" and has("state")' >/dev/null 2>&1; then
    BRANCH=$(printf '%s' "$pr_json" | jq -r '.headRefName')
    STATE=$(printf '%s' "$pr_json" | jq -r '.state')
    DRAFT=$(printf '%s' "$pr_json" | jq -r '.isDraft')
    MERGEABLE=$(printf '%s' "$pr_json" | jq -r '.mergeable')
    MERGE_STATE=$(printf '%s' "$pr_json" | jq -r '.mergeStateStatus')
    # An empty reviewDecision is a real answer: no review is required on this repo.
    DECISION=$(printf '%s' "$pr_json" | jq -r 'if .reviewDecision == "" then "NONE_REQUIRED" else .reviewDecision end')
else
    echo "WARN gh pr view failed; PR envelope is UNKNOWN" >&2
    unknown=1
fi

# --- CI ---------------------------------------------------------------------------------
# Classify by bucket, never by raw state. `gh pr checks --json bucket` normalises every state
# into pass/fail/pending/skipping/cancel AND normalises both rollup entry types: statusCheckRollup
# mixes CheckRun (.status/.conclusion) with StatusContext (.state), and bot reviews such as
# CodeRabbit arrive as the latter. A filter written for CheckRun alone reports "all green" while
# a whole class of check still pends — that is how mergeStateStatus: UNSTABLE sneaks past.
#
# Exit status is not an error signal here: 0 pass, 1 failing, 8 pending are all normal answers,
# so the payload decides, not the status.
CI=UNKNOWN
CI_FAILING=""
checks_json=$(gh pr checks "$PR" --repo "$OWNER/$NAME" --json name,bucket 2>/dev/null)
if printf '%s' "$checks_json" | jq -e 'type == "array"' >/dev/null 2>&1; then
    if [ "$(printf '%s' "$checks_json" | jq 'length')" -eq 0 ]; then
        CI=none
    elif printf '%s' "$checks_json" | jq -e 'any(.[]; .bucket == "fail" or .bucket == "cancel")' >/dev/null; then
        CI=failing
        CI_FAILING=$(printf '%s' "$checks_json" \
            | jq -r '[.[] | select(.bucket == "fail" or .bucket == "cancel") | "\(.name) (\(.bucket))"] | join(", ")')
    elif printf '%s' "$checks_json" | jq -e 'any(.[]; .bucket == "pending")' >/dev/null; then
        CI=pending
    else
        CI=green
    fi
else
    echo "WARN gh pr checks failed; CI is UNKNOWN" >&2
    unknown=1
fi

# --- Review threads ---------------------------------------------------------------------
THREADS_STATE=UNKNOWN
THREADS_TOTAL=UNKNOWN
THREADS_UNRESOLVED=UNKNOWN
threads_open=""

threads_json=$(gh api graphql -f owner="$OWNER" -f repo="$NAME" -F pr="$PR" -f query='
  query($owner:String!,$repo:String!,$pr:Int!){repository(owner:$owner,name:$repo){pullRequest(number:$pr){
    reviewThreads(first:100){totalCount nodes{id isResolved isOutdated path
      comments(first:1){nodes{author{login} body}}}}}}}' 2>/dev/null)

got=$(printf '%s' "$threads_json" | jq -e '.data.repository.pullRequest.reviewThreads.nodes | length' 2>/dev/null) || got=""
want=$(printf '%s' "$threads_json" | jq -e '.data.repository.pullRequest.reviewThreads.totalCount' 2>/dev/null) || want=""

if [ -n "$got" ] && [ -n "$want" ] && [ "$got" -eq "$want" ] 2>/dev/null; then
    # Reconciling the count proves how many threads came back, not that each one is readable.
    # A node whose `comments` is not indexable makes this jq fail, and a failed jq prints
    # nothing — so without checking its status, an unresolved thread renders as zero
    # unresolved threads. Same bug as an under-reported page, one step further in.
    if threads_open=$(printf '%s' "$threads_json" \
        | jq -r --argjson n "$BODY_CHARS" '
            .data.repository.pullRequest.reviewThreads.nodes[]
            | select(.isResolved == false)
            | "THREAD \(.id) \(.path // "-") \(.comments.nodes[0].author.login // "?"): " +
              ((.comments.nodes[0].body // "") | gsub("[[:space:]]+"; " ") | .[0:$n])' 2>/dev/null)
    then
        THREADS_STATE=KNOWN
        THREADS_TOTAL="$want"
        if [ -z "$threads_open" ]; then
            THREADS_UNRESOLVED=0
        else
            THREADS_UNRESOLVED=$(printf '%s\n' "$threads_open" | grep -c '^THREAD ')
        fi
    else
        # Every field goes UNKNOWN together, including the total that did reconcile: a number
        # printed next to UNKNOWN is exactly the misreading this script exists to prevent.
        echo "WARN thread payload reconciled ($got of $want) but could not be read; threads are UNKNOWN" >&2
        threads_open=""
        unknown=1
    fi
else
    echo "WARN thread poll failed or under-reported (${got:-?} of ${want:-?}); threads are UNKNOWN" >&2
    unknown=1
fi

# --- Report -----------------------------------------------------------------------------
printf 'PR=%s\n'                 "$PR"
printf 'REPO=%s\n'               "$OWNER/$NAME"
printf 'BRANCH=%s\n'             "$BRANCH"
printf 'STATE=%s\n'              "$STATE"
printf 'DRAFT=%s\n'              "$DRAFT"
printf 'MERGEABLE=%s\n'          "$MERGEABLE"
printf 'MERGE_STATE=%s\n'        "$MERGE_STATE"
printf 'DECISION=%s\n'           "$DECISION"
printf 'CI=%s\n'                 "$CI"
printf 'CI_FAILING=%s\n'         "$CI_FAILING"
printf 'THREADS_STATE=%s\n'      "$THREADS_STATE"
printf 'THREADS_TOTAL=%s\n'      "$THREADS_TOTAL"
printf 'THREADS_UNRESOLVED=%s\n' "$THREADS_UNRESOLVED"

if [ "$WANT_THREADS" = true ] && [ -n "$threads_open" ]; then
    printf '%s\n' "$threads_open"
fi

[ "$unknown" -eq 0 ] || exit 2
