#!/usr/bin/env bash
# stop-guard.sh - Guard script for Stop/SubagentStop hooks
#
# Reads hook input JSON from stdin, checks stop_hook_active to prevent
# infinite loops, and outputs a block decision with the provided reason.
#
# Usage: stop-guard.sh "reason text for Claude"

set -euo pipefail

REASON="${1:?Usage: stop-guard.sh \"reason text\"}"

# Read hook input from stdin
INPUT=$(cat)

# Check stop_hook_active to prevent infinite loops
STOP_HOOK_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false')

if [ "$STOP_HOOK_ACTIVE" = "true" ]; then
  # Already in a stop hook cycle — allow stopping to prevent infinite loop
  exit 0
fi

# Block stopping and provide reason to Claude
jq -n --arg reason "$REASON" '{"decision": "block", "reason": $reason}'
