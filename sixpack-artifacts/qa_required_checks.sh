#!/bin/bash
set -u
echo '== end-to-end verification through the public user boundary =='
PATH=/tmp/node-v25.6.1-darwin-arm64/bin:/usr/bin:/bin node --test packages/agent-router/test/feishu-regression.test.js 2>&1 | tail -20
echo '== final CRAP/DRY checks on the terminal candidate =='
git diff --stat $(git rev-parse HEAD) -- packages/ 2>/dev/null; echo 'product-code diff above must be empty except test file'
echo '== handoff and manifest consistency =='
ls -la sixpack-artifacts/
