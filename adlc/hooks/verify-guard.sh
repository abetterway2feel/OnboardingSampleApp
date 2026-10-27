#!/usr/bin/env bash
# verify-guard.sh — Enforcement guard for SubagentStop / TaskCompleted hooks.
#
# Runs fast, deterministic verification (lint + typecheck by default) when a
# subagent or task is about to complete, and BLOCKS completion if it fails.
# This turns the "verify before claiming done" discipline into enforcement,
# not just a prose reminder (see the Verification Gate in the executing-tasks skill).
#
# Design: fail-OPEN. It only blocks on an actual verification failure. If there
# is no justfile, no `just`, the recipe doesn't exist, or anything is ambiguous,
# it allows completion — it must never break a workflow it can't reason about.
#
# Usage: verify-guard.sh <mode>
#   subagentstop   -> emit {"decision":"block","reason":...} JSON on failure (exit 0)
#   taskcompleted  -> print reason to stderr and exit 2 on failure (no JSON support)
#
# Config (env):
#   ADLC_STOP_VERIFY  Comma-separated just recipes to run. Default "lint,typecheck".
#                     "off" or empty disables enforcement. Add "test" to include
#                     the full suite (slower; off by default to keep stops fast).
#
# Caveat: the hook runs in the session's project dir (CLAUDE_PROJECT_DIR), not a
# subagent's worktree. In worktree-isolated execution the primary gate is the
# Tier 3 inner loop; this hook is a backstop, most valuable for standalone flows.

set -uo pipefail   # not -e: failures are handled explicitly

MODE="${1:-subagentstop}"
INPUT=$(cat)

# Prevent infinite loops: if we already blocked once this cycle, allow.
STOP_HOOK_ACTIVE=$(printf '%s' "$INPUT" | jq -r '.stop_hook_active // false' 2>/dev/null || echo false)
[ "$STOP_HOOK_ACTIVE" = "true" ] && exit 0

CONFIG="${ADLC_STOP_VERIFY:-lint,typecheck}"
{ [ "$CONFIG" = "off" ] || [ -z "$CONFIG" ]; } && exit 0   # enforcement disabled

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$PWD}"
cd "$PROJECT_DIR" 2>/dev/null || exit 0                    # fail-open

command -v just >/dev/null 2>&1 || exit 0                  # no just -> nothing to enforce
[ -f justfile ] || [ -f Justfile ] || exit 0              # no justfile -> nothing to enforce

AVAILABLE=$(just --list 2>/dev/null || true)

failures=""
IFS=',' read -ra RECIPES <<< "$CONFIG"
for recipe in "${RECIPES[@]}"; do
  recipe=$(printf '%s' "$recipe" | tr -d '[:space:]')
  [ -z "$recipe" ] && continue
  # Only run recipes that actually exist (fail-open on missing recipe).
  # Escape ERE metacharacters so a recipe name is matched literally (a value
  # like "lint|test" must not be treated as an alternation).
  recipe_re=$(printf '%s' "$recipe" | sed 's/[][(){}.^$*+?|\\/]/\\&/g')
  printf '%s\n' "$AVAILABLE" | grep -qE "^[[:space:]]*${recipe_re}([[:space:]]|$)" || continue
  if ! OUT=$(just "$recipe" 2>&1); then
    failures="${failures}"$'\n'"--- just ${recipe} failed ---"$'\n'"$(printf '%s' "$OUT" | tail -25)"
  fi
done

[ -z "$failures" ] && exit 0   # all configured checks passed (or none applicable)

REASON="Verification failed before completion — fix these, then finish:${failures}

Do not claim this work complete until \`just\` verification passes (evidence before claims). Set ADLC_STOP_VERIFY=off to disable this gate."

if [ "$MODE" = "taskcompleted" ]; then
  printf '%s\n' "$REASON" >&2
  exit 2
else
  jq -n --arg reason "$REASON" '{"decision":"block","reason":$reason}'
  exit 0
fi
