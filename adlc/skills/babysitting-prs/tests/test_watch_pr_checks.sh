#!/usr/bin/env bash
# Tests for watch-pr-checks.sh. No network, no tokens: `gh` is stubbed on PATH and fed a
# scripted sequence of responses, one per poll.
#
# Run: bash plugins/adlc/skills/babysitting-prs/tests/test_watch_pr_checks.sh

set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$HERE/../scripts/watch-pr-checks.sh"
PASS=0
FAIL=0

# Build a stub `gh` whose Nth `pr checks` invocation prints the Nth response and exits with
# the Nth status. Responses are separated by a line containing only '---'; statuses are a
# comma-separated list. The last entry repeats once the list is exhausted.
#
# `gh repo view` — the GitHub-repo gate — is answered separately and does NOT consume a
# response slot, so the poll sequence in each case stays readable. Set REPO_GATE_STATUS to a
# non-zero value to simulate a non-GitHub repository.
make_stub() {
    local dir="$1" responses="$2" statuses="$3" gate="${4:-0}"
    mkdir -p "$dir/bin"
    printf '%s' "$responses" >"$dir/responses"
    printf '%s' "$statuses"  >"$dir/statuses"
    printf '%s' "$gate"      >"$dir/gate"
    : >"$dir/calls"
    cat >"$dir/bin/gh" <<'STUB'
#!/usr/bin/env bash
d="$(dirname "$(dirname "$0")")"
if [ "${1:-}" = "repo" ]; then
    gate=$(cat "$d/gate")
    [ "$gate" = "0" ] && echo '{"nameWithOwner":"owner/repo"}'
    exit "$gate"
fi
n=$(( $(wc -l <"$d/calls") + 1 ))
echo "call" >>"$d/calls"
# Split responses on '---' and pick the nth block, clamping to the last.
awk -v want="$n" '
  BEGIN { blk = 1 }
  /^---$/ { blk++; next }
  { buf[blk] = buf[blk] $0 "\n" }
  END { if (want > blk) want = blk; printf "%s", buf[want] }
' "$d/responses"
IFS=',' read -r -a st <"$d/statuses"
idx=$(( n - 1 ))
last=$(( ${#st[@]} - 1 ))
[ "$idx" -gt "$last" ] && idx="$last"
exit "${st[$idx]}"
STUB
    chmod +x "$dir/bin/gh"
}

# report <name> <expected-exit> <actual-exit> — shared verdict printer.
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

# run <name> <expected-exit> <responses> <statuses> [extra args...]
run() {
    local name="$1" want="$2" responses="$3" statuses="$4"; shift 4
    local dir out got
    dir="$(mktemp -d)"
    make_stub "$dir" "$responses" "$statuses" "${REPO_GATE_STATUS:-0}"
    out=$(PATH="$dir/bin:$PATH" bash "$SCRIPT" 42 --interval 0 --max-polls 12 "$@" 2>&1)
    got=$?
    LAST_OUT="$out"
    report "$name" "$want" "$got"
    rm -rf "$dir"
}

# `run` always supplies a PR number, so the no-argument path needs a direct invocation.
# A stubbed `gh` that always succeeds would hide an accidental network call, so this stub
# fails everything: argument validation must reject before anything is polled.
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

# A repeated warning is noise: under Monitor every line is a notification.
expect_count() {
    local name="$1" needle="$2" want="$3" got
    got=$(printf '%s' "$LAST_OUT" | grep -c -- "$needle")
    if [ "$got" -eq "$want" ]; then
        PASS=$((PASS + 1)); printf '  ok   %-52s %s x%s\n' "$name" "\"$needle\"" "$got"
    else
        FAIL=$((FAIL + 1)); printf '  FAIL %-52s %s x%s (wanted x%s)\n' "$name" "\"$needle\"" "$got" "$want"
    fi
}

GREEN='[{"name":"CodeQL","bucket":"pass"},{"name":"Analyze","bucket":"pass"}]'
PENDING='[{"name":"CodeQL","bucket":"pass"},{"name":"Analyze","bucket":"pending"}]'
FAILING='[{"name":"CodeQL","bucket":"pass"},{"name":"Analyze","bucket":"fail"}]'
CANCELLED='[{"name":"CodeQL","bucket":"pass"},{"name":"Analyze","bucket":"cancel"}]'
SKIPPED='[{"name":"CodeQL","bucket":"pass"},{"name":"Analyze","bucket":"skipping"}]'
PARTIAL='[{"name":"CodeQL","bucket":"pass"}]'

echo "watch-pr-checks.sh"

# --- rule 1: decide by pending, not by matching the happy path -----------------
run "steady green settles"                 0 "$GREEN"$'\n---\n'"$GREEN"$'\n---\n'"$GREEN" "0"
expect_output "  reports passing"            "SETTLED PASSING"
run "pass+skipping settles (not a hang)"   0 "$SKIPPED"$'\n---\n'"$SKIPPED"$'\n---\n'"$SKIPPED" "0"
run "skipping alone settles"               0 '[{"name":"A","bucket":"skipping"}]'$'\n---\n''[{"name":"A","bucket":"skipping"}]' "0"

# --- rule 2: fail and cancel are failures -------------------------------------
run "fail exits 1"                         1 "$FAILING"$'\n---\n'"$FAILING"$'\n---\n'"$FAILING" "1"
expect_output "  names the failing check"    "SETTLED FAILING"
run "cancel exits 1"                       1 "$CANCELLED"$'\n---\n'"$CANCELLED"$'\n---\n'"$CANCELLED" "1"
run "fail does not leave via success path" 1 "$FAILING"$'\n---\n'"$FAILING" "1"

# --- rule 3: absence is not success ------------------------------------------
# A check appears already-passed on the second poll: the snapshot changed, so the run
# must NOT settle on that poll. This is the bug that shipped in the prose examples.
run "late-appearing check delays settling" 0 \
    "$PARTIAL"$'\n---\n'"$GREEN"$'\n---\n'"$GREEN"$'\n---\n'"$GREEN" "0"
expect_output "  needed an extra poll"       "after 3 polls"
run "required check never appears -> 2"    2 "$PARTIAL" "0" --require "CodeQL,Analyze" --max-retries 3
expect_output "  names the missing check"    "WAITING for check(s) not yet reported: Analyze"
expect_count "  waiting notice is not repeated"  "WAITING" 1

# A check that reported and then dropped out of the list has almost certainly been re-queued
# by our own push. Repeated *partial* snapshots are perfectly stable, so stability alone read
# them as success — absence-as-success reappearing inside the script written to prevent it.
# No --require here: the script must remember what it saw without being told what to expect.
run "vanished check does not settle"       2 "$GREEN"$'\n---\n'"$PARTIAL" "0"
expect_output "  names the vanished check"   "WAITING for check(s) that vanished after reporting: Analyze"
expect_output "  is fatal, not a pass"       "ERROR after 12 polls"
run "vanished check that returns settles"  0 \
    "$GREEN"$'\n---\n'"$PARTIAL"$'\n---\n'"$GREEN"$'\n---\n'"$GREEN" "0"
run "required check arrives late"          0 \
    "$PARTIAL"$'\n---\n'"$GREEN"$'\n---\n'"$GREEN"$'\n---\n'"$GREEN" "0" --require "CodeQL,Analyze"
run "pending then green"                   0 \
    "$PENDING"$'\n---\n'"$PENDING"$'\n---\n'"$GREEN"$'\n---\n'"$GREEN"$'\n---\n'"$GREEN" "8,8,0,0,0"
run "empty check list never settles"       3 '[]' "0"

# --- rule 4: an error is not an empty result ---------------------------------
run "persistent gh error exits 2"          2 "not json at all" "1" --max-retries 3
expect_output "  announces the error"        "ERROR gh pr checks failed"
expect_output "  warns before giving up"     "WARN gh pr checks failed (exit 1)"
run "bad PR number is not silent"          2 "" "1" --max-retries 2
expect_output "  never waits silently"       "WARN"
run "transient error then recovery"        0 \
    "boom"$'\n---\n'"$GREEN"$'\n---\n'"$GREEN"$'\n---\n'"$GREEN" "1,0,0,0" --max-retries 3
run "exit 8 is pending, not an error"      0 \
    "$PENDING"$'\n---\n'"$GREEN"$'\n---\n'"$GREEN"$'\n---\n'"$GREEN" "8,0,0,0"
expect_output "  no error reported"          "SETTLED PASSING"

# --- steady green needs exactly --stable polls -------------------------------
# The count is part of the contract: --stable 2 must mean two polls, not three. An off-by-one
# here is safe but it makes the flag lie, and it costs a whole poll interval per watch.
run "two identical polls satisfy --stable 2" 0 "$GREEN" "0"
expect_output "  settles on the second poll" "after 2 polls"
run "--stable 3 needs three polls"         0 "$GREEN" "0" --stable 3
expect_output "  settles on the third poll"  "after 3 polls"

# --- repository gate ---------------------------------------------------------
# An unresolvable repository must abort with its own code rather than retrying gh errors five
# times and reporting them as a credentials problem.
# Set as a plain variable, not an `X=1 run ...` prefix: bash's scoping for assignments
# prefixed to a *function* call differs between posix and default mode.
REPO_GATE_STATUS=1
run "unresolvable repo exits 4"            4 "$GREEN" "0"
REPO_GATE_STATUS=0
expect_output "  says why"                    "not a reachable GitHub repository"

# --- interface ---------------------------------------------------------------
run     "unknown option is a usage error"  64 "$GREEN" "0" --nonexistent-flag
run_raw "missing PR number is a usage error" 64 --interval 0
expect_output "  says what is required"      "a PR number is required"

echo
if [ "$FAIL" -eq 0 ]; then
    echo "all $PASS assertions passed"
    exit 0
fi
echo "$FAIL failed, $PASS passed"
exit 1
