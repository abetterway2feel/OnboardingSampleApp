#!/usr/bin/env bash
# Tests for reply-to-thread.sh. `gh` is stubbed on PATH; the stub records its arguments and
# applies the real `--jq` program to the fixture, so the response is read the same way it is
# in production.
#
# The assertions that matter are the negative ones: resolving must not happen unless asked,
# and must not happen at all when the reply failed.
#
# Run: bash plugins/adlc/skills/babysitting-prs/tests/test_reply_to_thread.sh

set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$HERE/../scripts/reply-to-thread.sh"
PASS=0
FAIL=0
LAST_OUT=""
LAST_ARGS=""

make_stub() {
    local dir="$1" reply="$2" resolve="$3"
    mkdir -p "$dir/bin"
    printf '%s' "$reply"   >"$dir/reply"
    printf '%s' "$resolve" >"$dir/resolve"
    : >"$dir/args"
    cat >"$dir/bin/gh" <<'STUB'
#!/usr/bin/env bash
d="$(dirname "$(dirname "$0")")"
printf '%s\n' "$@" >>"$d/args"

expr=""
for i in $(seq 1 $#); do
    if [ "${!i}" = "--jq" ]; then
        j=$((i + 1)); expr="${!j}"
    fi
done

respond() {
    local fixture="$1" payload
    payload=$(cat "$d/$fixture")
    [ "$payload" = "FAIL" ] && exit 1
    if [ -n "$expr" ]; then
        printf '%s' "$payload" | jq -r "$expr"
    else
        printf '%s' "$payload"
    fi
    exit 0
}

case "$*" in
    *addPullRequestReviewThreadReply*) respond reply ;;
    *resolveReviewThread*)             respond resolve ;;
esac
exit 1
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

# run <name> <expected-exit> <reply-fixture> <resolve-fixture> [args...]
run() {
    local name="$1" want="$2" reply="$3" resolve="$4"; shift 4
    local dir out got
    dir="$(mktemp -d)"
    make_stub "$dir" "$reply" "$resolve"
    out=$(PATH="$dir/bin:$PATH" bash "$SCRIPT" "$@" 2>&1)
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

expect_arg() {
    local name="$1" needle="$2"
    if printf '%s' "$LAST_ARGS" | grep -q -F -- "$needle"; then
        PASS=$((PASS + 1)); printf '  ok   %-52s sent %s\n' "$name" "\"$needle\""
    else
        FAIL=$((FAIL + 1)); printf '  FAIL %-52s never sent %s\n' "$name" "\"$needle\""
        printf '%s\n' "$LAST_ARGS" | sed 's/^/         | /'
    fi
}

refute_arg() {
    local name="$1" needle="$2"
    if printf '%s' "$LAST_ARGS" | grep -q -F -- "$needle"; then
        FAIL=$((FAIL + 1)); printf '  FAIL %-52s must not send %s\n' "$name" "\"$needle\""
        printf '%s\n' "$LAST_ARGS" | sed 's/^/         | /'
    else
        PASS=$((PASS + 1)); printf '  ok   %-52s never sends %s\n' "$name" "\"$needle\""
    fi
}

REPLY_OK='{"data":{"addPullRequestReviewThreadReply":{"comment":{"id":"IC_1"}}}}'
RESOLVED='{"data":{"resolveReviewThread":{"thread":{"isResolved":true}}}}'
NOT_RESOLVED='{"data":{"resolveReviewThread":{"thread":{"isResolved":false}}}}'
TID=PRRT_kwDOexample

echo "reply-to-thread.sh"

# --- resolving is opt-in ------------------------------------------------------
# The autonomy envelope allows resolving only once the change is pushed, so the default must
# leave the thread open — that is also the escalation path, which needs no flag at all.
run "reply alone leaves the thread open"   0 "$REPLY_OK" "$RESOLVED" "$TID" --body "thanks"
expect_output "  confirms the reply"         "REPLIED $TID"
refute_output "  does not claim resolution"  "RESOLVED $TID"
refute_arg    "  never calls the mutation"   "resolveReviewThread"

run "--resolve resolves"                   0 "$REPLY_OK" "$RESOLVED" "$TID" --body "fixed" --resolve
expect_output "  confirms the reply"         "REPLIED"
expect_output "  confirms resolution"        "RESOLVED $TID"
expect_arg    "  calls the mutation"         "resolveReviewThread"

# --- a resolve that did not take is not a success -----------------------------
# Read from the response, not from gh's exit status, and keep it distinct from a failed reply
# so the caller does not repost the comment.
run "isResolved:false is not resolved"     3 "$REPLY_OK" "$NOT_RESOLVED" "$TID" --body "x" --resolve
expect_output "  says the thread is open"    "not resolved"
expect_output "  but confirms the reply"     "REPLIED"
run "a failed resolve call exits 3"        3 "$REPLY_OK" "FAIL" "$TID" --body "x" --resolve
expect_output "  warns against reposting"    "do not repost"

# --- a failed reply must not resolve anything --------------------------------
run "failed reply exits 2"                 2 "FAIL" "$RESOLVED" "$TID" --body "x" --resolve
expect_output "  says nothing was posted"    "nothing was posted"
refute_output "  claims no reply"            "REPLIED"
refute_arg    "  and never resolves"         "resolveReviewThread"

# --- the body survives verbatim ----------------------------------------------
# Markdown replies carry backticks, quotes and newlines; -f passes them as a literal string.
BODY_FILE="$(mktemp)"
printf 'Confirmed and fixed in `8c564d2`.\n\n```\nSETTLED PASSING\n```\n' >"$BODY_FILE"
run "--body-file preserves markdown"       0 "$REPLY_OK" "$RESOLVED" "$TID" --body-file "$BODY_FILE"
expect_arg "  sends the backticks"           'Confirmed and fixed in `8c564d2`.'
expect_arg "  sends the fenced block"        'SETTLED PASSING'
rm -f "$BODY_FILE"

# --- interface ---------------------------------------------------------------
run "missing body is a usage error"        64 "$REPLY_OK" "$RESOLVED" "$TID"
expect_output "  says what is required"      "a reply body is required"
run "missing thread id is a usage error"   64 "$REPLY_OK" "$RESOLVED" --body "x"
expect_output "  says what is required"      "a thread id is required"
run "both body forms is a usage error"     64 "$REPLY_OK" "$RESOLVED" "$TID" --body "x" --body-file /dev/null
run "a missing body file is rejected"      64 "$REPLY_OK" "$RESOLVED" "$TID" --body-file /nonexistent/file
run "unknown option is a usage error"      64 "$REPLY_OK" "$RESOLVED" "$TID" --nope

dir="$(mktemp -d)"; mkdir -p "$dir/bin"
LAST_OUT=$(PATH="$dir/bin" "$BASH" "$SCRIPT" "$TID" --body x 2>&1); got=$?
report "missing gh exits 4" 4 "$got"
expect_output "  says gh is not installed"   "gh is not installed"
rm -rf "$dir"

echo
if [ "$FAIL" -eq 0 ]; then
    echo "all $PASS assertions passed"
    exit 0
fi
echo "$FAIL failed, $PASS passed"
exit 1
