#!/usr/bin/env bash
# Tests for watch-pr-comments.sh. `gh` is stubbed on PATH; the stub records every argument it
# was given and applies the real `--jq` program to the fixture, so the jq expression in the
# script is exercised rather than bypassed.
#
# The recorded arguments are what make the watermark rule testable: after a failed poll the
# next request must still carry the ORIGINAL `since=`, because advancing it would leave the
# window that failed permanently unread.
#
# Run: bash plugins/adlc/skills/babysitting-prs/tests/test_watch_pr_comments.sh

set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$HERE/../scripts/watch-pr-comments.sh"
SINCE="2020-01-01T00:00:00Z"
PASS=0
FAIL=0
LAST_OUT=""
LAST_ARGS=""

# Fixtures are '---'-separated blocks, one consumed per call to that endpoint (the last block
# repeats). A block of FAIL makes that call fail.
make_stub() {
    local dir="$1" repo="$2" pulls="$3" issues="$4"
    mkdir -p "$dir/bin"
    printf '%s' "$repo"   >"$dir/repo"
    printf '%s' "$pulls"  >"$dir/pulls"
    printf '%s' "$issues" >"$dir/issues"
    : >"$dir/calls"
    : >"$dir/args"
    cat >"$dir/bin/gh" <<'STUB'
#!/usr/bin/env bash
d="$(dirname "$(dirname "$0")")"
printf '%s\n' "$@" >>"$d/args"

if [ "${1:-} ${2:-}" = "repo view" ]; then
    [ "$(cat "$d/repo")" = "FAIL" ] && exit 1
    cat "$d/repo"
    exit 0
fi

[ "${1:-}" = "api" ] || exit 1
shift
url=""; expr=""
while [ $# -gt 0 ]; do
    case "$1" in
        --paginate) shift ;;
        --jq)       expr="${2:-}"; shift 2 ;;
        *)          url="$1"; shift ;;
    esac
done
case "$url" in
    *pulls/*)  fixture=pulls ;;
    *issues/*) fixture=issues ;;
    *)         exit 1 ;;
esac
n=$(( $(grep -c "^$fixture$" "$d/calls") + 1 ))
echo "$fixture" >>"$d/calls"
block=$(awk -v want="$n" '
  BEGIN { blk = 1 }
  /^---$/ { blk++; next }
  { buf[blk] = buf[blk] $0 "\n" }
  END { if (want > blk) want = blk; printf "%s", buf[want] }
' "$d/$fixture")
[ "$(printf '%s' "$block" | tr -d '[:space:]')" = "FAIL" ] && exit 1
printf '%s' "$block" | jq -r "$expr"
STUB
    chmod +x "$dir/bin/gh"
}

report() {
    local name="$1" want="$2" got="$3"
    if [ "$got" = "$want" ]; then
        PASS=$((PASS + 1)); printf '  ok   %-52s exit %s\n' "$name" "$got"
    else
        FAIL=$((FAIL + 1))
        printf '  FAIL %-52s exit %s (wanted %s)\n' "$name" "$got" "$want"
        printf '%s\n' "$LAST_OUT" | sed 's/^/         | /'
    fi
}

# run <name> <expected-exit> <repo> <pulls> <issues> [extra args...]
run() {
    local name="$1" want="$2" repo="$3" pulls="$4" issues="$5"; shift 5
    local dir out got
    dir="$(mktemp -d)"
    make_stub "$dir" "$repo" "$pulls" "$issues"
    out=$(PATH="$dir/bin:$PATH" bash "$SCRIPT" 42 --interval 0 --since "$SINCE" "$@" 2>&1)
    got=$?
    LAST_OUT="$out"
    LAST_ARGS="$(cat "$dir/args")"
    report "$name" "$want" "$got"
    rm -rf "$dir"
}

expect_output() {
    local name="$1" needle="$2"
    if printf '%s' "$LAST_OUT" | grep -q -- "$needle"; then
        PASS=$((PASS + 1)); printf '  ok   %-52s says %s\n' "$name" "\"$needle\""
    else
        FAIL=$((FAIL + 1)); printf '  FAIL %-52s missing %s\n' "$name" "\"$needle\""
        printf '%s\n' "$LAST_OUT" | sed 's/^/         | /'
    fi
}

refute_output() {
    local name="$1" needle="$2"
    if printf '%s' "$LAST_OUT" | grep -q -- "$needle"; then
        FAIL=$((FAIL + 1)); printf '  FAIL %-52s must not say %s\n' "$name" "\"$needle\""
        printf '%s\n' "$LAST_OUT" | sed 's/^/         | /'
    else
        PASS=$((PASS + 1)); printf '  ok   %-52s never says %s\n' "$name" "\"$needle\""
    fi
}

expect_out_count() {
    local name="$1" needle="$2" want="$3" got
    got=$(printf '%s\n' "$LAST_OUT" | grep -c -- "$needle")
    if [ "$got" -eq "$want" ]; then
        PASS=$((PASS + 1)); printf '  ok   %-52s %s x%s\n' "$name" "\"$needle\"" "$got"
    else
        FAIL=$((FAIL + 1)); printf '  FAIL %-52s %s x%s (wanted x%s)\n' "$name" "\"$needle\"" "$got" "$want"
        printf '%s\n' "$LAST_OUT" | sed 's/^/         | /'
    fi
}

expect_arg() {
    local name="$1" needle="$2"
    if printf '%s' "$LAST_ARGS" | grep -q -F -- "$needle"; then
        PASS=$((PASS + 1)); printf '  ok   %-52s requested %s\n' "$name" "\"$needle\""
    else
        FAIL=$((FAIL + 1)); printf '  FAIL %-52s never requested %s\n' "$name" "\"$needle\""
        printf '%s\n' "$LAST_ARGS" | sed 's/^/         | /'
    fi
}

expect_arg_count() {
    local name="$1" needle="$2" want="$3" got
    got=$(printf '%s\n' "$LAST_ARGS" | grep -c -F -- "$needle")
    if [ "$got" -eq "$want" ]; then
        PASS=$((PASS + 1)); printf '  ok   %-52s %s x%s\n' "$name" "\"$needle\"" "$got"
    else
        FAIL=$((FAIL + 1)); printf '  FAIL %-52s %s x%s (wanted x%s)\n' "$name" "\"$needle\"" "$got" "$want"
        printf '%s\n' "$LAST_ARGS" | sed 's/^/         | /'
    fi
}

REPO='{"owner":{"login":"owner"},"name":"repo"}'
# A body with a newline and repeated spaces: one comment must produce exactly one line.
REVIEW='[{"id":11,"user":{"login":"alice"},"path":"a.py","body":"first\nline    two"}]'
REVIEW2='[{"id":12,"user":{"login":"bot"},"path":"b.py","body":"from a bot"}]'
ISSUE='[{"id":21,"user":{"login":"carol"},"body":"top level"}]'
NONE='[]'

echo "watch-pr-comments.sh"

# --- both endpoints, one line per comment -------------------------------------
run "polls review and top-level comments"  0 "$REPO" "$REVIEW" "$ISSUE" --once
expect_output "  reports the review comment" "COMMENT alice a.py: first line two"
expect_output "  reports the top-level one"  "COMMENT carol -: top level"
expect_arg    "  asks the review endpoint"   "pulls/42/comments"
expect_arg    "  asks the issues endpoint"   "issues/42/comments"

# --- pagination: the default page size of 30 silently drops a busy round ------
expect_arg "  paginates"                     "--paginate"
expect_arg "  asks for 100 per page"         "per_page=100"

# --- dedupe: `since` is inclusive, so the boundary comment comes back ---------
run "a comment is announced once"          0 "$REPO" "$REVIEW" "$NONE" --max-polls 2
expect_out_count "  not once per poll"       "COMMENT alice" 1

# --- the watermark rule -------------------------------------------------------
# Poll 1 fails for the review endpoint and succeeds for issues. Poll 2 must therefore re-ask
# the review endpoint from the ORIGINAL since, while issues has moved on.
run "failed poll keeps its window"         0 "$REPO" "FAIL"$'\n---\n'"$REVIEW" "$ISSUE" --max-polls 2
expect_output    "  announces the failure"   "WARN review-comment poll failed"
expect_output    "  names the unread window" "the window from $SINCE is still unread"
expect_arg_count "  re-asks the same window" "pulls/42/comments?per_page=100&since=$SINCE" 2
expect_arg_count "  advances on success"     "issues/42/comments?per_page=100&since=$SINCE" 1
expect_output    "  and delivers it later"   "COMMENT alice"

run "persistent failure exits 2"           2 "$REPO" "FAIL" "FAIL" --max-polls 9 --max-retries 2
expect_output "  says it gave up"            "ERROR comment polling failed"

# Ending ON a failed poll must not exit 0. --once and the final --max-polls iteration would
# otherwise report "no new comments" when the truth is "a window went unread" — and a caller
# using --once inside a cycle reads that exit code as a clean, empty result.
run "--once on a failed poll exits 2"      2 "$REPO" "FAIL" "$ISSUE" --once
expect_output "  names the unread window"    "ERROR ended on a failed poll"
run "last --max-polls failure exits 2"     2 "$REPO" "$REVIEW"$'\n---\n'"FAIL" "$ISSUE" --max-polls 2
expect_output "  names the unread window"    "ERROR ended on a failed poll"
# A failure mid-run is different: the next poll re-reads the same window, so it is not fatal.
run "failure mid-run still exits 0"        0 "$REPO" "FAIL"$'\n---\n'"$REVIEW" "$ISSUE" --max-polls 2
refute_output "  no terminal error"          "ERROR"

# --- filtering ----------------------------------------------------------------
run "--exclude-author drops that login"    0 "$REPO" "$REVIEW2" "$ISSUE" --once --exclude-author bot
refute_output "  bot is skipped"             "COMMENT bot"
expect_output "  others still reported"      "COMMENT carol"

run "quiet poll says nothing"              0 "$REPO" "$NONE" "$NONE" --once
refute_output "  silence means nothing new"  "COMMENT"
refute_output "  and no warning either"      "WARN"

# --- preconditions ------------------------------------------------------------
run "non-GitHub repo exits 4"              4 "FAIL" "$REVIEW" "$ISSUE" --once
expect_output "  says why"                   "not a reachable GitHub repository"
run "unknown option is a usage error"      64 "$REPO" "$REVIEW" "$ISSUE" --nope

# A `gh` that is absent must be reported as such, not retried as an API failure. PATH is emptied
# for this one, so the interpreter is named absolutely — `bash` itself would not be found either.
dir="$(mktemp -d)"; mkdir -p "$dir/bin"
LAST_OUT=$(PATH="$dir/bin" "$BASH" "$SCRIPT" 42 --once 2>&1); got=$?
report "missing gh exits 4" 4 "$got"
expect_output "  says gh is not installed"   "gh is not installed"
rm -rf "$dir"

LAST_OUT=$(bash "$SCRIPT" --once 2>&1); got=$?
report "missing PR number is a usage error" 64 "$got"
expect_output "  says what is required"      "a PR number is required"

echo
if [ "$FAIL" -eq 0 ]; then
    echo "all $PASS assertions passed"
    exit 0
fi
echo "$FAIL failed, $PASS passed"
exit 1
