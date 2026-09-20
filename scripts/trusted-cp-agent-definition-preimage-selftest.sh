#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
output="$(bash "$SCRIPT_DIR/trusted-cp-deploy-install.sh" --selftest-agent-definition-preimage 2>&1)" || {
  printf '%s\n' "$output" >&2
  exit 1
}
printf '%s\n' "$output"
grep -qx 'SELFTEST_AGENT_DEFINITION_PREIMAGE=PASS' <<<"$output"
