#!/bin/bash
# ROOT-SIDE step of AGENT_MEMORY_SIGTRAP_FIX_V1 — invoked via
# osascript "do shell script ... with administrator privileges" (the Owner
# approves the macOS dialog; no password is ever read by this session).
# Exactly four mutations, each verified, aborting on the first failure:
#   1. verify the live memory.js preimage hash (refuses ANY unexpected file)
#   2. install the audited artifact (root:wheel 0644)
#   3. verify the installed bytes
#   4. kickstart system/ai.agent-core.runtime
set -euo pipefail
LIVE=/usr/local/libexec/agent-core/app/packages/agent-memory/src/memory.js
STAGED=__STAGED__
EXPECT_PREIMAGE=239cd5ed488886ee9c66900112e7203ce7b6a9432efa1365d550787a2bfeabcc
EXPECT_INSTALLED=99d59bdeb055e18d7827d5529f2505783252e6b75124f8fb45c91d5a96bf2b7d

echo "ROOT_STEP_1_PREIMAGE_BEGIN"
actual_preimage=$(/usr/bin/shasum -a 256 "$LIVE" | awk '{print $1}')
if [ "$actual_preimage" != "$EXPECT_PREIMAGE" ]; then
  echo "ROOT_STEP_ABORT: preimage mismatch actual=$actual_preimage expect=$EXPECT_PREIMAGE"
  exit 3
fi
echo "ROOT_STEP_1_PREIMAGE_OK $actual_preimage"

echo "ROOT_STEP_2_INSTALL_BEGIN"
/usr/bin/install -m 0644 -o root -g wheel "$STAGED" "$LIVE"
echo "ROOT_STEP_2_INSTALL_OK"

echo "ROOT_STEP_3_VERIFY_BEGIN"
installed=$(/usr/bin/shasum -a 256 "$LIVE" | awk '{print $1}')
if [ "$installed" != "$EXPECT_INSTALLED" ]; then
  echo "ROOT_STEP_ABORT: installed mismatch actual=$installed expect=$EXPECT_INSTALLED"
  exit 4
fi
ls -la "$LIVE"
echo "ROOT_STEP_3_VERIFY_OK $installed"

echo "ROOT_STEP_4_KICKSTART_BEGIN"
OLD_PID=$(/bin/launchctl print system/ai.agent-core.runtime 2>/dev/null | /usr/bin/awk '/^\tpid =/{print $3}')
/bin/launchctl kickstart -k system/ai.agent-core.runtime
echo "ROOT_STEP_4_KICKSTART_OK old_pid=${OLD_PID:-unknown}"
echo "ROOT_STEP_ALL_DONE"
