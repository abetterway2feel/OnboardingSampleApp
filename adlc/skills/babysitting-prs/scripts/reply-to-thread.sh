#!/usr/bin/env bash
# Reply to one review thread, and resolve it only if asked.
#
# Resolving is opt-in because the autonomy envelope says a thread may be resolved only once the
# corresponding change is pushed. Leaving it open is therefore the default, and the escalation
# path (reply with reasoning or a question, leave open for the human) needs no flag at all.
#
# Exit codes:
#   0  replied (and resolved, if --resolve)
#   2  the reply failed — nothing was posted, retry is safe
#   3  the reply posted but resolving failed — do NOT retry the reply, resolve alone
#   4  `gh` unavailable
#   64 usage error

set -uo pipefail

usage() {
    cat <<'USAGE'
Usage: reply-to-thread.sh <thread-id> (--body TEXT | --body-file FILE) [--resolve]

  <thread-id>       GraphQL thread id, e.g. PRRT_kwDO... (from poll-pr-state.sh --threads)
  --body TEXT       Reply body
  --body-file FILE  Reply body read from a file ("-" for stdin); preferred for markdown
  --resolve         Resolve the thread after replying. Only when the change is pushed.
  -h, --help        This help
USAGE
}

THREAD=""
BODY=""
BODY_FILE=""
RESOLVE=false

while [ $# -gt 0 ]; do
    case "$1" in
        --body)      BODY="${2:-}"; shift 2 ;;
        --body-file) BODY_FILE="${2:-}"; shift 2 ;;
        --resolve)   RESOLVE=true; shift ;;
        -h|--help)   usage; exit 0 ;;
        -*)          echo "unknown option: $1" >&2; usage >&2; exit 64 ;;
        *)           if [ -z "$THREAD" ]; then THREAD="$1"; shift; else
                         echo "unexpected argument: $1" >&2; exit 64
                     fi ;;
    esac
done

[ -n "$THREAD" ] || { echo "a thread id is required" >&2; usage >&2; exit 64; }

if [ -n "$BODY_FILE" ]; then
    [ -z "$BODY" ] || { echo "use --body or --body-file, not both" >&2; exit 64; }
    if [ "$BODY_FILE" = "-" ]; then
        BODY=$(cat)
    else
        [ -f "$BODY_FILE" ] || { echo "no such file: $BODY_FILE" >&2; exit 64; }
        BODY=$(cat "$BODY_FILE")
    fi
fi
[ -n "$BODY" ] || { echo "a reply body is required (--body or --body-file)" >&2; usage >&2; exit 64; }

command -v gh >/dev/null 2>&1 || { echo "ERROR gh is not installed" >&2; exit 4; }

# -f passes the body as a literal string, so backticks, quotes and newlines in markdown survive.
if ! gh api graphql -f tid="$THREAD" -f body="$BODY" -f query='
      mutation($tid:ID!,$body:String!){
        addPullRequestReviewThreadReply(input:{pullRequestReviewThreadId:$tid, body:$body}){
          comment{id}}}' >/dev/null 2>&1; then
    echo "ERROR reply to $THREAD failed; nothing was posted" >&2
    exit 2
fi
echo "REPLIED $THREAD"

[ "$RESOLVE" = true ] || exit 0

resolved=$(gh api graphql -f tid="$THREAD" -f query='
      mutation($tid:ID!){resolveReviewThread(input:{threadId:$tid}){thread{isResolved}}}' \
      --jq '.data.resolveReviewThread.thread.isResolved' 2>/dev/null)

# Confirm from the response rather than from the exit status: only `true` means resolved.
if [ "$resolved" = "true" ]; then
    echo "RESOLVED $THREAD"
    exit 0
fi

echo "ERROR reply posted but $THREAD is not resolved; resolve it alone, do not repost" >&2
exit 3
