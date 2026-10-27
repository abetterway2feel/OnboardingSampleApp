#!/usr/bin/env bash
# Tests for poll-pr-state.sh. No network, no tokens: `gh` is stubbed on PATH with one fixture
# per subcommand. A fixture whose content is the word FAIL makes that call fail, which is how
# each field's fail-closed behaviour is exercised independently of the others.
#
# Run: bash plugins/adlc/skills/babysitting-prs/tests/test_poll_pr_state.sh

set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$HERE/../scripts/poll-pr-state.sh"
PASS=0
FAIL=0
LAST_OUT=""

make_stub() {
    local dir="$1" repo="$2" pr="$3" checks="$4" threads="$5"
    mkdir -p "$dir/bin"
    printf '%s' "$repo"    >"$dir/repo"
    printf '%s' "$pr"      >"$dir/pr"
    printf '%s' "$checks"  >"$dir/checks"
    printf '%s' "$threads" >"$dir/threads"
    cat >"$dir/bin/gh" <<'STUB'
#!/usr/bin/env bash
d="$(dirname "$(dirname "$0")")"
emit() {
    f="$d/$1"
    [ -f "$f" ] || exit 1
    [ "$(cat "$f")" = "FAIL" ] && exit 1
    cat "$f"
    exit 0
}
case "${1:-} ${2:-}" in
    "repo view")   emit repo ;;
    "pr view")     emit pr ;;
    "pr checks")   emit checks ;;
    "api graphql") emit threads ;;
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

# run <name> <expected-exit> <repo> <pr> <checks> <threads> [extra args...]
run() {
    local name="$1" want="$2" repo="$3" pr="$4" checks="$5" threads="$6"; shift 6
    local dir out got
    dir="$(mktemp -d)"
    make_stub "$dir" "$repo" "$pr" "$checks" "$threads"
    out=$(PATH="$dir/bin:$PATH" bash "$SCRIPT" 42 "$@" 2>&1)
    got=$?
    LAST_OUT="$out"
    report "$name" "$want" "$got"
    rm -rf "$dir"
}

# No PR number, and a `gh` that fails everything: validation must reject before any call.
run_raw() {
    local name="$1" want="$2"; shift 2
    local dir out got
    dir="$(mktemp -d)"
    mkdir -p "$dir/bin"
    printf '#!/usr/bin/env bash\nexit 1\n' >"$dir/bin/gh"
    chmod +x "$dir/bin/gh"
    out=$(PATH="$dir/bin:$PATH" bash "$SCRIPT" "$@" 2>&1)
    got=$?
    LAST_OUT="$out"
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

expect_line_count() {
    local name="$1" needle="$2" want="$3" got
    got=$(printf '%s\n' "$LAST_OUT" | grep -c -- "$needle")
    if [ "$got" -eq "$want" ]; then
        PASS=$((PASS + 1)); printf '  ok   %-52s %s x%s\n' "$name" "\"$needle\"" "$got"
    else
        FAIL=$((FAIL + 1)); printf '  FAIL %-52s %s x%s (wanted x%s)\n' "$name" "\"$needle\"" "$got" "$want"
        printf '%s\n' "$LAST_OUT" | sed 's/^/         | /'
    fi
}

REPO='{"owner":{"login":"owner"},"name":"repo"}'
PRJSON='{"headRefName":"feat/x","state":"OPEN","isDraft":false,"mergeable":"MERGEABLE","mergeStateStatus":"CLEAN","reviewDecision":"APPROVED"}'
PRNODEC='{"headRefName":"feat/x","state":"OPEN","isDraft":false,"mergeable":"MERGEABLE","mergeStateStatus":"CLEAN","reviewDecision":""}'
GREEN='[{"name":"CodeQL","bucket":"pass"},{"name":"Analyze","bucket":"skipping"}]'
FAILING='[{"name":"CodeQL","bucket":"pass"},{"name":"Analyze","bucket":"fail"}]'
PENDING='[{"name":"CodeQL","bucket":"pending"}]'

# A body with an embedded newline and runs of whitespace: it must arrive as ONE line, because
# the caller counts THREAD lines.
threads_json() {  # threads_json <totalCount> <node-json...>
    local total="$1"; shift
    printf '{"data":{"repository":{"pullRequest":{"reviewThreads":{"totalCount":%s,"nodes":[%s]}}}}}' \
        "$total" "$(printf '%s' "$*")"
}
NODE_OPEN='{"id":"PRRT_a","isResolved":false,"isOutdated":false,"path":"a.py","comments":{"nodes":[{"author":{"login":"alice"},"body":"line one\nline two    with   spaces"}]}}'
NODE_OPEN2='{"id":"PRRT_b","isResolved":false,"isOutdated":false,"path":null,"comments":{"nodes":[{"author":{"login":"bot"},"body":"second"}]}}'
NODE_DONE='{"id":"PRRT_c","isResolved":true,"isOutdated":false,"path":"b.py","comments":{"nodes":[{"author":{"login":"bob"},"body":"done"}]}}'

T_CLEAN=$(threads_json 1 "$NODE_DONE")
T_TWO_OPEN=$(threads_json 3 "$NODE_OPEN,$NODE_OPEN2,$NODE_DONE")
T_TRUNCATED=$(threads_json 18 "$NODE_OPEN")
T_EMPTY=$(threads_json 0 "")

echo "poll-pr-state.sh"

# --- the clean path -----------------------------------------------------------
run "fully observed poll exits 0"          0 "$REPO" "$PRJSON" "$GREEN" "$T_CLEAN"
expect_output "  reports the branch"         "BRANCH=feat/x"
expect_output "  classifies green"           "CI=green"
expect_output "  threads are KNOWN"          "THREADS_STATE=KNOWN"
expect_output "  counts zero unresolved"     "THREADS_UNRESOLVED=0"
expect_output "  reports the decision"       "DECISION=APPROVED"

run "no required review reads as such"     0 "$REPO" "$PRNODEC" "$GREEN" "$T_EMPTY"
expect_output "  distinguishes from UNKNOWN" "DECISION=NONE_REQUIRED"

# --- threads fail closed ------------------------------------------------------
# The whole point: an under-reported or failed thread poll must never present as zero
# unresolved threads, which is the strongest possible false "ready to merge" signal.
run "truncated thread page exits 2"        2 "$REPO" "$PRJSON" "$GREEN" "$T_TRUNCATED"
expect_output "  marks threads UNKNOWN"      "THREADS_STATE=UNKNOWN"
expect_output "  refuses to count"           "THREADS_UNRESOLVED=UNKNOWN"
refute_output "  never claims zero"          "THREADS_UNRESOLVED=0"
expect_output "  names the shortfall"        "(1 of 18)"

run "failed thread poll exits 2"           2 "$REPO" "$PRJSON" "$GREEN" "FAIL"
expect_output "  marks threads UNKNOWN"      "THREADS_STATE=UNKNOWN"
refute_output "  never claims zero"          "THREADS_UNRESOLVED=0"

run "empty response is not zero threads"   2 "$REPO" "$PRJSON" "$GREEN" ""
expect_output "  marks threads UNKNOWN"      "THREADS_STATE=UNKNOWN"

# The count can reconcile on a payload that still cannot be read: a node whose `comments` is
# not indexable makes the rendering jq fail, and a failed jq prints nothing. Without checking
# its status an unresolved thread renders as zero unresolved threads.
T_UNREADABLE=$(threads_json 1 '{"id":"X","isResolved":false,"path":"a.py","comments":"not-an-object"}')
run "reconciled but unreadable exits 2"    2 "$REPO" "$PRJSON" "$GREEN" "$T_UNREADABLE" --threads
expect_output "  marks threads UNKNOWN"      "THREADS_STATE=UNKNOWN"
refute_output "  never claims zero"          "THREADS_UNRESOLVED=0"
expect_output "  says the payload reconciled" "reconciled (1 of 1) but could not be read"
refute_output "  prints no misleading total" "THREADS_TOTAL=1"

# A null `comments` is NOT this case — jq indexes null leniently, so the thread still renders
# and must still be counted. Pinned so the fix above cannot over-reach into a working payload.
T_NULL_COMMENTS=$(threads_json 1 '{"id":"X","isResolved":false,"path":"a.py","comments":null}')
run "null comments still counts"           0 "$REPO" "$PRJSON" "$GREEN" "$T_NULL_COMMENTS" --threads
expect_output "  stays KNOWN"                "THREADS_STATE=KNOWN"
expect_output "  counts the thread"          "THREADS_UNRESOLVED=1"
expect_output "  renders a placeholder"      "THREAD X a.py ?:"

run "unresolved threads are counted"       0 "$REPO" "$PRJSON" "$GREEN" "$T_TWO_OPEN"
expect_output "  counts only the open ones"  "THREADS_UNRESOLVED=2"
run "--threads lists them"                 0 "$REPO" "$PRJSON" "$GREEN" "$T_TWO_OPEN" --threads
expect_line_count "  one line per open thread" "^THREAD " 2
expect_output "  carries the thread id"      "THREAD PRRT_a a.py alice:"
expect_output "  collapses newlines"         "line one line two with spaces"
refute_output "  omits resolved threads"     "PRRT_c"
expect_output "  renders a null path"        "THREAD PRRT_b - bot:"
run "--body-chars truncates"                0 "$REPO" "$PRJSON" "$GREEN" "$T_TWO_OPEN" --threads --body-chars 8
expect_output "  cuts the body"              "alice: line one$"

# --- CI fails closed ----------------------------------------------------------
run "failing CI is named"                  0 "$REPO" "$PRJSON" "$FAILING" "$T_CLEAN"
expect_output "  classifies failing"         "CI=failing"
expect_output "  names the check"            "CI_FAILING=Analyze (fail)"
run "cancelled counts as failing"          0 "$REPO" "$PRJSON" \
    '[{"name":"A","bucket":"cancel"}]' "$T_CLEAN"
expect_output "  cancel is not a pass"       "CI=failing"
run "pending CI is pending"                 0 "$REPO" "$PRJSON" "$PENDING" "$T_CLEAN"
expect_output "  classifies pending"         "CI=pending"
run "no checks at all is not green"        0 "$REPO" "$PRJSON" '[]' "$T_CLEAN"
expect_output "  distinguishes none"         "CI=none"
run "failed checks call exits 2"           2 "$REPO" "$PRJSON" "FAIL" "$T_CLEAN"
expect_output "  marks CI UNKNOWN"           "CI=UNKNOWN"
refute_output "  never claims green"         "CI=green"

# --- PR envelope fails closed -------------------------------------------------
run "failed pr view exits 2"               2 "$REPO" "FAIL" "$GREEN" "$T_CLEAN"
expect_output "  marks state UNKNOWN"        "STATE=UNKNOWN"
expect_output "  still reports what it got"  "CI=green"

# --- preconditions ------------------------------------------------------------
run "non-GitHub repo exits 4"              4 "FAIL" "$PRJSON" "$GREEN" "$T_CLEAN"
expect_output "  says why"                   "not a reachable GitHub repository"
run     "unknown option is a usage error"  64 "$REPO" "$PRJSON" "$GREEN" "$T_CLEAN" --nope
run_raw "missing PR number is a usage error" 64 --threads
expect_output "  says what is required"      "a PR number is required"

# An absent `gh` is its own answer, not an API failure. PATH is emptied for this one, so the
# interpreter is named absolutely — `bash` itself would not be found either.
dir="$(mktemp -d)"; mkdir -p "$dir/bin"
LAST_OUT=$(PATH="$dir/bin" "$BASH" "$SCRIPT" 42 2>&1); got=$?
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
