#!/usr/bin/env bash
# Watch a PR's checks from a shell, outside any model context, and exit once they settle.
#
# The whole difficulty is distinguishing *no signal* from *bad signal* from *good signal*, which
# a hand-written poll loop keeps getting wrong. Four rules, implemented once here:
#
#   1. Decide by what is still PENDING, never by matching the happy path. `gh pr checks
#      --json bucket` returns pass/fail/pending/skipping/cancel and a PR usually shows
#      several at once, so matching `pass` exactly hangs on a healthy `pass,skipping`.
#   2. `fail` and `cancel` are failures, and must not leave through the success path.
#   3. Absence is not success. A check not yet created — or re-queued by your own push —
#      is simply missing, so "nothing is pending" is true and wrong. Settlement therefore
#      requires an IDENTICAL snapshot across consecutive polls, that every --require'd check
#      is present, AND that every check any earlier poll returned is still present. Stability
#      alone is not enough: three identical *partial* snapshots are perfectly stable, and
#      reading them as success is this same bug wearing a disguise.
#   4. An error is not an empty result. `gh pr checks` exits 8 for pending and 1 for
#      failing, and a bad PR number or a credentials problem also exits non-zero. Collapsing
#      those to `[]` waits forever in silence. Errors are retried, announced, then fatal.
#
# The repository is confirmed to be a reachable GitHub one before any polling starts, and the
# run aborts loudly (exit 4) if it is not: without that gate a bad remote or a missing `gh`
# produces a stream of errors that read exactly like a credentials problem.
#
# Every stdout line is an event when run under the Monitor tool. `WARN` and `WAITING` lines
# are progress, not verdicts — only the exit code is terminal. Silence means "still pending"
# and nothing else.
#
# Exit codes:
#   0  settled; all checks passing (pass/skipping)
#   1  settled; at least one fail or cancel
#   2  `gh` kept failing, or an expected check never reported / vanished and never returned
#   3  timed out with checks still pending
#   4  `gh` unavailable, or not a reachable GitHub repository
#   64 usage error

set -uo pipefail

usage() {
    cat <<'USAGE'
Usage: watch-pr-checks.sh <pr-number> [options]

  --repo OWNER/NAME   Repository (default: gh's current repo)
  --require "A,B"     Comma-separated checks that MUST be present before settling
  --interval SECONDS  Poll interval (default 60; use 0 in tests)
  --stable N          Identical consecutive snapshots required (default 2)
  --max-retries N     Consecutive gh failures tolerated (default 5)
  --max-polls N       Give up after N polls (default 120)
  -h, --help          This help
USAGE
}

PR=""
REPO=""
REQUIRE=""
INTERVAL=60
STABLE_NEEDED=2
MAX_RETRIES=5
MAX_POLLS=120

while [ $# -gt 0 ]; do
    case "$1" in
        --repo)        REPO="${2:-}"; shift 2 ;;
        --require)     REQUIRE="${2:-}"; shift 2 ;;
        --interval)    INTERVAL="${2:-}"; shift 2 ;;
        --stable)      STABLE_NEEDED="${2:-}"; shift 2 ;;
        --max-retries) MAX_RETRIES="${2:-}"; shift 2 ;;
        --max-polls)   MAX_POLLS="${2:-}"; shift 2 ;;
        -h|--help)     usage; exit 0 ;;
        -*)            echo "unknown option: $1" >&2; usage >&2; exit 64 ;;
        *)             if [ -z "$PR" ]; then PR="$1"; shift; else
                           echo "unexpected argument: $1" >&2; exit 64
                       fi ;;
    esac
done

[ -n "$PR" ] || { echo "a PR number is required" >&2; usage >&2; exit 64; }

# Checks that must be present before we believe a settled snapshot. Kept as a
# newline-delimited string rather than an array: expanding an empty array under `set -u`
# is an error on bash 3.2, which is what macOS ships.
required=""
if [ -n "$REQUIRE" ]; then
    required=$(printf '%s' "$REQUIRE" | tr ',' '\n' | sed 's/^ *//; s/ *$//' | grep -v '^$')
fi

# One wrapper so the --repo branch exists in exactly one place.
fetch_checks() {
    if [ -n "$REPO" ]; then
        gh pr checks "$PR" --repo "$REPO" --json name,bucket 2>/dev/null
    else
        gh pr checks "$PR" --json name,bucket 2>/dev/null
    fi
}

# Confirm this is a GitHub repository before polling. `gh repo view` is the authoritative test —
# it resolves the repo through gh's own config, so GitHub Enterprise hosts pass while a
# non-GitHub remote does not.
if ! command -v gh >/dev/null 2>&1; then
    echo "ERROR gh is not installed" >&2
    exit 4
fi
if [ -n "$REPO" ]; then
    gh repo view "$REPO" --json nameWithOwner >/dev/null 2>&1 || {
        echo "ERROR '$REPO' is not a reachable GitHub repository" >&2
        exit 4
    }
else
    gh repo view --json nameWithOwner >/dev/null 2>&1 || {
        echo "ERROR not a reachable GitHub repository (gh cannot resolve it)" >&2
        exit 4
    }
fi

prev_snapshot=""
prev_settled=""
prev_missing=""
# Every check name any successful poll has returned. A name that drops out of a later snapshot
# is treated as missing rather than as gone, because the usual cause is your own push
# re-queueing it — and a re-queued check is about to run, not finished.
seen=""
stable=0
retries=0
polls=0

# Emit each check that has newly reached a terminal bucket, so a Monitor run reports
# progress rather than going quiet until the very end.
emit_newly_settled() {
    local settled="$1"
    [ "$settled" = "$prev_settled" ] && return 0
    comm -13 <(printf '%s\n' "$prev_settled") <(printf '%s\n' "$settled") | while IFS= read -r line
    do
        [ -n "$line" ] && echo "$line"
    done
    return 0
}

while :; do
    polls=$((polls + 1))
    if [ "$polls" -gt "$MAX_POLLS" ]; then
        # Distinguish "checks are still running" from "a check we were told to expect
        # never showed up" — the latter is usually a misconfigured --require or a
        # workflow that never triggered, and calls for a different response.
        if [ -n "$prev_missing" ]; then
            echo "ERROR after $MAX_POLLS polls, still waiting $prev_missing"
            exit 2
        fi
        echo "TIMEOUT after $MAX_POLLS polls; checks still pending"
        exit 3
    fi

    # Capture stdout and status separately. `gh pr checks` exits 8 while checks are
    # pending and 1 when some are failing, so a non-zero status is not itself an error.
    out=$(fetch_checks)
    status=$?

    if ! printf '%s' "$out" | jq -e 'type == "array"' >/dev/null 2>&1; then
        # No parseable payload: a real error (bad PR, credentials, network, rate limit).
        retries=$((retries + 1))
        echo "WARN gh pr checks failed (exit $status), attempt $retries/$MAX_RETRIES"
        if [ "$retries" -ge "$MAX_RETRIES" ]; then
            echo "ERROR gh pr checks failed $retries times; giving up"
            exit 2
        fi
        [ "$INTERVAL" -gt 0 ] && sleep "$INTERVAL"
        continue
    fi
    retries=0

    snapshot=$(printf '%s' "$out" | jq -r '.[] | "\(.name): \(.bucket)"' | sort)
    settled=$(printf '%s' "$out" | jq -r '.[] | select(.bucket != "pending") | "\(.name): \(.bucket)"' | sort)
    emit_newly_settled "$settled"
    prev_settled="$settled"

    count=$(printf '%s' "$out" | jq 'length')
    any_pending=$(printf '%s' "$out" | jq -r 'any(.[]; .bucket == "pending")')

    # Completeness, not just stability. Two distinct absences, reported differently because
    # they call for different responses: a --require'd check that has never appeared usually
    # means a workflow did not trigger, while a check that appeared and then vanished means
    # something re-queued it. Both block settlement; neither may be read as "nothing pending".
    names=$(printf '%s' "$out" | jq -r '.[].name' | sort -u)

    never_reported=""
    if [ -n "$required" ]; then
        while IFS= read -r want; do
            [ -n "$want" ] || continue
            printf '%s\n' "$names" | grep -Fxq -- "$want" && continue
            printf '%s\n' "$seen"  | grep -Fxq -- "$want" && continue
            never_reported="${never_reported:+$never_reported, }$want"
        done <<<"$required"
    fi

    vanished=""
    if [ -n "$seen" ]; then
        while IFS= read -r want; do
            [ -n "$want" ] || continue
            printf '%s\n' "$names" | grep -Fxq -- "$want" && continue
            vanished="${vanished:+$vanished, }$want"
        done <<<"$seen"
    fi

    seen=$(printf '%s\n%s\n' "$seen" "$names" | grep -v '^$' | sort -u)

    # Message-ready, so the WAITING line and the timeout line say the same thing.
    missing=""
    [ -n "$never_reported" ] && missing="for check(s) not yet reported: $never_reported"
    if [ -n "$vanished" ]; then
        missing="${missing:+$missing; }for check(s) that vanished after reporting: $vanished"
    fi

    if [ "$count" -gt 0 ] && [ "$any_pending" = "false" ] && [ -z "$missing" ]; then
        # First eligible snapshot counts as one: `stable` is the number of consecutive
        # complete, quiet snapshots seen, so --stable 2 means two polls rather than three.
        if [ "$snapshot" = "$prev_snapshot" ]; then
            stable=$((stable + 1))
        else
            stable=1
        fi
    else
        stable=0
    fi
    prev_snapshot="$snapshot"

    if [ "$stable" -ge "$STABLE_NEEDED" ]; then
        buckets=$(printf '%s' "$out" | jq -r '[.[].bucket] | unique | join(",")')
        if printf '%s' "$out" | jq -e 'any(.[]; .bucket == "fail" or .bucket == "cancel")' >/dev/null; then
            bad=$(printf '%s' "$out" | jq -r '[.[] | select(.bucket == "fail" or .bucket == "cancel") | .name] | join(", ")')
            echo "SETTLED FAILING ($buckets): $bad"
            exit 1
        fi
        echo "SETTLED PASSING ($buckets) after $polls polls"
        exit 0
    fi

    # If we are only waiting on an absent check, say so rather than sitting silent — silence
    # must mean "pending", nothing else. Announce it only when the set changes: one
    # notification per condition, not one per poll.
    if [ "$any_pending" = "false" ] && [ -n "$missing" ] && [ "$missing" != "$prev_missing" ]; then
        echo "WAITING $missing"
    fi
    prev_missing="$missing"

    [ "$INTERVAL" -gt 0 ] && sleep "$INTERVAL"
done
