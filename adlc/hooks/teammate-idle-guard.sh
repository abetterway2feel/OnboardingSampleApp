#!/usr/bin/env bash
# teammate-idle-guard.sh - TeammateIdle hook for Agent Teams
#
# Fires when a teammate is about to go idle.
# Exit 0 = allow idle, Exit 2 = block idle (stderr fed back as feedback).
#
# TeammateIdle does NOT support matchers or JSON decision control.

set -euo pipefail

# Consume stdin (required by hook protocol)
cat > /dev/null

# Allow the teammate to go idle — the lead and task list handle coordination.
# To enforce quality gates, add checks here and exit 2 with stderr feedback.

exit 0
