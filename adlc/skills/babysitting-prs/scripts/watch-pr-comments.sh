#!/usr/bin/env bash
# Stream new PR comments from a shell, outside any model context, for the Monitor tool.
#
# This is the WAIT half of the pair: it runs for as long as the PR needs and emits one line per
# new comment, so an agent spends nothing until a reviewer says something. `poll-pr-state.sh` is
# the SNAPSHOT half — call that once woken, for the authoritative thread list and ids. Neither
# replaces the other: a snapshot cannot wake you, and this cannot tell you what is still open.
#
# Polls both endpoints, because reviewers use both: review comments (pulls/N/comments, the
# ones attached to a diff line) and top-level PR comments (issues/N/comments). Each keeps its
# own `since` watermark.
#
# Two rules make the difference between this and a naive loop:
#
#   1. The watermark advances ONLY after a poll that succeeded, and the timestamp is captured
#      BEFORE the request. Advancing it unconditionally discards the whole window a failed poll
#      covered — those comments appear in no later `since=` range, so they are never seen again.
#   2. --paginate with per_page=100. The default page size is 30, so a busy review round
#      silently drops everything past the thirtieth comment (measured: 54 comments on one PR,
#      30 without these flags).
#
# Silence means "nothing new" and nothing else: a failed poll prints WARN and names the window
# it could not read. `WARN` lines are progress, not verdicts.
#
# Exit codes:
#   0  --once completed, or --max-polls reached, on a poll that succeeded
#   2  the API kept failing, or the run ended on a failed poll (a window went unread)
#   4  `gh` unavailable, or not a GitHub repository
#   64 usage error

set -uo pipefail

usage() {
    cat <<'USAGE'
Usage: watch-pr-comments.sh <pr-number> [options]

  --repo OWNER/NAME       Repository (default: gh's current repo)
  --since TIMESTAMP       Only comments after this ISO-8601 UTC time (default: now)
  --interval SECONDS      Poll interval (default 60; use 0 in tests)
  --max-polls N           Stop after N polls (default 0 = until killed)
  --max-retries N         Consecutive API failures tolerated (default 5)
  --body-chars N          Characters of body per line (default 200)
  --exclude-author "a,b"  Skip these logins (e.g. your own, so replies don't wake you)
  --once                  Poll once and exit
  -h, --help              This help
USAGE
}

PR=""
REPO=""
SINCE=""
INTERVAL=60
MAX_POLLS=0
MAX_RETRIES=5
BODY_CHARS=200
EXCLUDE=""
ONCE=false

while [ $# -gt 0 ]; do
    case "$1" in
        --repo)           REPO="${2:-}"; shift 2 ;;
        --since)          SINCE="${2:-}"; shift 2 ;;
        --interval)       INTERVAL="${2:-}"; shift 2 ;;
        --max-polls)      MAX_POLLS="${2:-}"; shift 2 ;;
        --max-retries)    MAX_RETRIES="${2:-}"; shift 2 ;;
        --body-chars)     BODY_CHARS="${2:-}"; shift 2 ;;
        --exclude-author) EXCLUDE="${2:-}"; shift 2 ;;
        --once)           ONCE=true; shift ;;
        -h|--help)        usage; exit 0 ;;
        -*)               echo "unknown option: $1" >&2; usage >&2; exit 64 ;;
        *)                if [ -z "$PR" ]; then PR="$1"; shift; else
                              echo "unexpected argument: $1" >&2; exit 64
                          fi ;;
    esac
done

[ -n "$PR" ] || { echo "a PR number is required" >&2; usage >&2; exit 64; }

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

[ -n "$SINCE" ] || SINCE=$(date -u +%Y-%m-%dT%H:%M:%SZ)

excluded=""
if [ -n "$EXCLUDE" ]; then
    excluded=$(printf '%s' "$EXCLUDE" | tr ',' '\n' | sed 's/^ *//; s/ *$//' | grep -v '^$')
fi

# `since` is inclusive, so the comment that sits exactly on the watermark comes back next poll.
# Ids already emitted are remembered so a reviewer is announced once, not once per poll.
emitted=""
last_review="$SINCE"
last_issue="$SINCE"
retries=0
polls=0

FETCHED=""

# Sets FETCHED to "<id>\t<login>\t<path>\t<body>" lines. Returns non-zero if the request failed,
# which is deliberately distinct from succeeding with no rows.
fetch() {
    local path="$1" since="$2" out
    out=$(gh api --paginate "repos/$OWNER/$NAME/$path?per_page=100&since=$since" \
            --jq ".[] | \"\(.id)\t\(.user.login)\t\(.path // \"-\")\t\((.body // \"\") | gsub(\"[[:space:]]+\"; \" \") | .[0:$BODY_CHARS])\"" 2>/dev/null) || return 1
    FETCHED="$out"
    return 0
}

emit() {
    local kind="$1" id login path body key
    while IFS=$'\t' read -r id login path body; do
        [ -n "$id" ] || continue
        key="$kind:$id"
        printf '%s\n' "$emitted" | grep -Fxq -- "$key" && continue
        emitted="${emitted}${key}
"
        if [ -n "$excluded" ] && printf '%s\n' "$excluded" | grep -Fxq -- "$login"; then
            continue
        fi
        echo "COMMENT $login $path: $body"
    done <<<"$FETCHED"
}

while :; do
    polls=$((polls + 1))
    now=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    failed=0

    if fetch "pulls/$PR/comments" "$last_review"; then
        emit review
        last_review="$now"        # only on success
    else
        echo "WARN review-comment poll failed; the window from $last_review is still unread"
        failed=1
    fi

    if fetch "issues/$PR/comments" "$last_issue"; then
        emit issue
        last_issue="$now"         # only on success
    else
        echo "WARN top-level-comment poll failed; the window from $last_issue is still unread"
        failed=1
    fi

    if [ "$failed" -eq 1 ]; then
        retries=$((retries + 1))
        if [ "$retries" -ge "$MAX_RETRIES" ]; then
            echo "ERROR comment polling failed $retries times; giving up"
            exit 2
        fi
    else
        retries=0
    fi

    # A run that ENDS on a failed poll must not exit 0: --once and the last --max-polls
    # iteration would otherwise hand the caller "no new comments" when the truth is "a window
    # went unread". Mid-run failures are different — the next poll re-reads the same window.
    if [ "$ONCE" = true ] || { [ "$MAX_POLLS" -gt 0 ] && [ "$polls" -ge "$MAX_POLLS" ]; }; then
        if [ "$failed" -eq 1 ]; then
            echo "ERROR ended on a failed poll; the window from $last_review is unread"
            exit 2
        fi
        exit 0
    fi
    [ "$INTERVAL" -gt 0 ] && sleep "$INTERVAL"
done
