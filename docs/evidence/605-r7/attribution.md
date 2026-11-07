# R7 exact clean-base attribution

Coordinates: base/head `4f7df01bcf087075c114901a96a7a54573110f61`, Node v26.7.0, cwd `/private/tmp/h605-r2`. Stash `8ff463c7aae2bd2e23f49a09969e3bb1a1d13657`; clean before/after ten exact cases. Each was run once. All 23 pre-stash file hashes restored exactly after stash pop.

Owner R7 permits these clean-base failures to be pre-existing exclusions only. No environment/dependency/credential change or assertion repair was made. Original unfiltered R6 suite remains rc1 (626 tests /614 pass /10 fail /2 skipped).

| ID | R6 coordinate | Exact base rc | Classification | Concrete diagnosis / limitation |
|---|---|---:|---|---|
| F01 | `packages/agent-router/test/broker-rpc.test.js:322` | 1 | pre-existing | broker read-back returns STILL_UNKNOWN / read-back transport failed; old test expects response was lost. |
| F02 | `packages/agent-router/test/broker-rpc.test.js:334` | 1 | pre-existing | broker read-back returns STILL_UNKNOWN / read-back response unusable; old test expects outcome is unknown. |
| F03 | `packages/agent-router/test/luna-credential-chain.test.js:157` | 1 | pre-existing | gates(t) calls cliBin() and throws because default /private/github/deepseek-harness/apps/cli/lib/bin.js is absent; credential initialization is not reached. |
| F04 | `packages/agent-router/test/luna-credential-chain.test.js:169` | 1 | pre-existing | Same CLI gate fails before the missing-credential behavioral test is reached. |
| F05 | `packages/agent-router/test/luna-credential-chain.test.js:186` | 1 | pre-existing | Same CLI gate fails before the unsafe-credential behavioral test is reached. |
| F06 | `packages/agent-router/test/process-lifecycle/feishu-reply-delivery-result.test.js:1` | 1 | pre-existing | Whole file fails at module load: @larksuite/channel is absent. Its behavioral tests remain unexecuted. |
| F07 | `packages/agent-router/test/process-lifecycle/message-origin.test.js:175` | 1 | pre-existing | Fixture expects gatewayCalls[0] for a settled exact source; unchanged relay rejects authoritative_reference_unavailable before gateway, so ctx is undefined. |
| F08 | `packages/agent-router/test/route-chain/native-goal-composed.test.js:14` | 1 | pre-existing | NGC_HARNESS_ROOT / paired native build prerequisite is absent; conformance assertion rejects. |
| F09 | `packages/agent-router/test/route-chain/native-goal-composed.test.js:74` | 1 | pre-existing | Exact real-child timeout case fails initialize with AGENT_PROCESS_EXITED, code1/signal null. Underlying child cause remains UNKNOWN (no captured stderr). |
| F10 | `packages/agent-router/test/route-chain/native-goal-composed.test.js:74` | 1 | pre-existing | Exact real-child cancel case fails initialize with AGENT_PROCESS_EXITED, code1/signal null. Underlying child cause remains UNKNOWN (no captured stderr). |

## Full original comparison per case

R6 original source log: `../605-r6/full-router.log`, SHA256 `ac1b00609c56c1df3f611e07a75d7e5a6e694445ee2b34c6875c589a0dc5abdd`. Per-case complete clean-base stdout/stderr and command/time/hash are retained alongside this file and in baseline.json.

### F01 — seam: a gateway THROW resolves as mutation_outcome_unknown with zero automatic retry (true transport loss semantics kept)

R6 original failing-test entry:
```text
test at packages/agent-router/test/broker-rpc.test.js:322:1
✖ seam: a gateway THROW resolves as mutation_outcome_unknown with zero automatic retry (true transport loss semantics kept) (0.491083ms)
  AssertionError [ERR_ASSERTION]: The input did not match the regular expression /response was lost/. Input:

  'scheduler mutation outcome STILL_UNKNOWN after canonical read-back: {"state":"STILL_UNKNOWN","operation":"create","reason":"read-back transport failed"}'

      at TestContext.<anonymous> (file:///private/tmp/h605-r2/packages/agent-router/test/broker-rpc.test.js:330:10)
      at async Test.run (node:internal/test_runner/test:1404:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:969:7) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: 'scheduler mutation outcome STILL_UNKNOWN after canonical read-back: {"state":"STILL_UNKNOWN","operation":"create","reason":"read-back transport failed"}',
    expected: /response was lost/,
    operator: 'match',
    diff: 'simple'
  }
```

Clean-base complete stdout/stderr:
```text
✖ seam: a gateway THROW resolves as mutation_outcome_unknown with zero automatic retry (true transport loss semantics kept) (0.919625ms)
ℹ tests 1
ℹ suites 0
ℹ pass 0
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 59.9585

✖ failing tests:

test at packages/agent-router/test/broker-rpc.test.js:322:1
✖ seam: a gateway THROW resolves as mutation_outcome_unknown with zero automatic retry (true transport loss semantics kept) (0.919625ms)
  AssertionError [ERR_ASSERTION]: The input did not match the regular expression /response was lost/. Input:

  'scheduler mutation outcome STILL_UNKNOWN after canonical read-back: {"state":"STILL_UNKNOWN","operation":"create","reason":"read-back transport failed"}'

      at TestContext.<anonymous> (file:///private/tmp/h605-r2/packages/agent-router/test/broker-rpc.test.js:330:10)
      at async Test.run (node:internal/test_runner/test:1404:7)
      at async startSubtestAfterBootstrap (node:internal/test_runner/harness:387:3) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: 'scheduler mutation outcome STILL_UNKNOWN after canonical read-back: {"state":"STILL_UNKNOWN","operation":"create","reason":"read-back transport failed"}',
    expected: /response was lost/,
    operator: 'match',
    diff: 'simple'
  }
```

### F02 — seam: a structured gateway failure passes through declared codes verbatim at the correct depth

R6 original failing-test entry:
```text
test at packages/agent-router/test/broker-rpc.test.js:334:1
✖ seam: a structured gateway failure passes through declared codes verbatim at the correct depth (0.155875ms)
  AssertionError [ERR_ASSERTION]: The input did not match the regular expression /outcome is unknown/. Input:

  'scheduler mutation outcome STILL_UNKNOWN after canonical read-back: {"state":"STILL_UNKNOWN","operation":"create","reason":"read-back response unusable"}'

      at TestContext.<anonymous> (file:///private/tmp/h605-r2/packages/agent-router/test/broker-rpc.test.js:340:10)
      at async Test.run (node:internal/test_runner/test:1404:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:969:7) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: 'scheduler mutation outcome STILL_UNKNOWN after canonical read-back: {"state":"STILL_UNKNOWN","operation":"create","reason":"read-back response unusable"}',
    expected: /outcome is unknown/,
    operator: 'match',
    diff: 'simple'
  }
```

Clean-base complete stdout/stderr:
```text
✖ seam: a structured gateway failure passes through declared codes verbatim at the correct depth (0.88725ms)
ℹ tests 1
ℹ suites 0
ℹ pass 0
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 47.20975

✖ failing tests:

test at packages/agent-router/test/broker-rpc.test.js:334:1
✖ seam: a structured gateway failure passes through declared codes verbatim at the correct depth (0.88725ms)
  AssertionError [ERR_ASSERTION]: The input did not match the regular expression /outcome is unknown/. Input:

  'scheduler mutation outcome STILL_UNKNOWN after canonical read-back: {"state":"STILL_UNKNOWN","operation":"create","reason":"read-back response unusable"}'

      at TestContext.<anonymous> (file:///private/tmp/h605-r2/packages/agent-router/test/broker-rpc.test.js:340:10)
      at async Test.run (node:internal/test_runner/test:1404:7)
      at async startSubtestAfterBootstrap (node:internal/test_runner/harness:387:3) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: 'scheduler mutation outcome STILL_UNKNOWN after canonical read-back: {"state":"STILL_UNKNOWN","operation":"create","reason":"read-back response unusable"}',
    expected: /outcome is unknown/,
    operator: 'match',
    diff: 'simple'
  }
```

### F03 — E: valid canonical credential — child initializes on the openai-codex route

R6 original failing-test entry:
```text
test at packages/agent-router/test/luna-credential-chain.test.js:157:1
✖ E: valid canonical credential — child initializes on the openai-codex route (1.7235ms)
  Error: dsh CLI not found at /private/github/deepseek-harness/apps/cli/lib/bin.js; set DSH_HARNESS_ROOT to the deepseek-harness checkout
      at cliBin (file:///private/tmp/h605-r2/packages/agent-provisioning/src/index.js:76:11)
      at gates (file:///private/tmp/h605-r2/packages/agent-router/test/luna-credential-chain.test.js:42:46)
      at TestContext.<anonymous> (file:///private/tmp/h605-r2/packages/agent-router/test/luna-credential-chain.test.js:158:8)
      at Test.runInAsyncScope (node:async_hooks:226:14)
      at Test.run (node:internal/test_runner/test:1397:25)
      at Test.start (node:internal/test_runner/test:1257:17)
      at startSubtestAfterBootstrap (node:internal/test_runner/harness:387:17)
```

Clean-base complete stdout/stderr:
```text
✖ E: valid canonical credential — child initializes on the openai-codex route (0.464875ms)
ℹ tests 1
ℹ suites 0
ℹ pass 0
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 44.479791

✖ failing tests:

test at packages/agent-router/test/luna-credential-chain.test.js:157:1
✖ E: valid canonical credential — child initializes on the openai-codex route (0.464875ms)
  Error: dsh CLI not found at /private/github/deepseek-harness/apps/cli/lib/bin.js; set DSH_HARNESS_ROOT to the deepseek-harness checkout
      at cliBin (file:///private/tmp/h605-r2/packages/agent-provisioning/src/index.js:76:11)
      at gates (file:///private/tmp/h605-r2/packages/agent-router/test/luna-credential-chain.test.js:42:46)
      at TestContext.<anonymous> (file:///private/tmp/h605-r2/packages/agent-router/test/luna-credential-chain.test.js:158:8)
      at Test.runInAsyncScope (node:async_hooks:226:14)
      at Test.run (node:internal/test_runner/test:1397:25)
      at Test.start (node:internal/test_runner/test:1257:17)
      at startSubtestAfterBootstrap (node:internal/test_runner/harness:387:17)
```

### F04 — F: missing credential fails loud on the real chain — never a silent fallback

R6 original failing-test entry:
```text
test at packages/agent-router/test/luna-credential-chain.test.js:169:1
✖ F: missing credential fails loud on the real chain — never a silent fallback (0.098834ms)
  Error: dsh CLI not found at /private/github/deepseek-harness/apps/cli/lib/bin.js; set DSH_HARNESS_ROOT to the deepseek-harness checkout
      at cliBin (file:///private/tmp/h605-r2/packages/agent-provisioning/src/index.js:76:11)
      at gates (file:///private/tmp/h605-r2/packages/agent-router/test/luna-credential-chain.test.js:42:46)
      at TestContext.<anonymous> (file:///private/tmp/h605-r2/packages/agent-router/test/luna-credential-chain.test.js:170:8)
      at Test.runInAsyncScope (node:async_hooks:226:14)
      at Test.run (node:internal/test_runner/test:1397:25)
      at Test.processPendingSubtests (node:internal/test_runner/test:969:18)
      at Test.postRun (node:internal/test_runner/test:1537:19)
      at Test.run (node:internal/test_runner/test:1462:12)
      at async startSubtestAfterBootstrap (node:internal/test_runner/harness:387:3)
```

Clean-base complete stdout/stderr:
```text
✖ F: missing credential fails loud on the real chain — never a silent fallback (0.460792ms)
ℹ tests 1
ℹ suites 0
ℹ pass 0
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 44.165125

✖ failing tests:

test at packages/agent-router/test/luna-credential-chain.test.js:169:1
✖ F: missing credential fails loud on the real chain — never a silent fallback (0.460792ms)
  Error: dsh CLI not found at /private/github/deepseek-harness/apps/cli/lib/bin.js; set DSH_HARNESS_ROOT to the deepseek-harness checkout
      at cliBin (file:///private/tmp/h605-r2/packages/agent-provisioning/src/index.js:76:11)
      at gates (file:///private/tmp/h605-r2/packages/agent-router/test/luna-credential-chain.test.js:42:46)
      at TestContext.<anonymous> (file:///private/tmp/h605-r2/packages/agent-router/test/luna-credential-chain.test.js:170:8)
      at Test.runInAsyncScope (node:async_hooks:226:14)
      at Test.run (node:internal/test_runner/test:1397:25)
      at Test.start (node:internal/test_runner/test:1257:17)
      at startSubtestAfterBootstrap (node:internal/test_runner/harness:387:17)
```

### F05 — G: unsafe credential (group/world readable) fails loud on the real chain

R6 original failing-test entry:
```text
test at packages/agent-router/test/luna-credential-chain.test.js:186:1
✖ G: unsafe credential (group/world readable) fails loud on the real chain (0.09325ms)
  Error: dsh CLI not found at /private/github/deepseek-harness/apps/cli/lib/bin.js; set DSH_HARNESS_ROOT to the deepseek-harness checkout
      at cliBin (file:///private/tmp/h605-r2/packages/agent-provisioning/src/index.js:76:11)
      at gates (file:///private/tmp/h605-r2/packages/agent-router/test/luna-credential-chain.test.js:42:46)
      at TestContext.<anonymous> (file:///private/tmp/h605-r2/packages/agent-router/test/luna-credential-chain.test.js:187:8)
      at Test.runInAsyncScope (node:async_hooks:226:14)
      at Test.run (node:internal/test_runner/test:1397:25)
      at Test.processPendingSubtests (node:internal/test_runner/test:969:18)
      at Test.postRun (node:internal/test_runner/test:1537:19)
      at Test.run (node:internal/test_runner/test:1462:12)
      at async Test.processPendingSubtests (node:internal/test_runner/test:969:7)
```

Clean-base complete stdout/stderr:
```text
✖ G: unsafe credential (group/world readable) fails loud on the real chain (0.467792ms)
ℹ tests 1
ℹ suites 0
ℹ pass 0
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 42.405

✖ failing tests:

test at packages/agent-router/test/luna-credential-chain.test.js:186:1
✖ G: unsafe credential (group/world readable) fails loud on the real chain (0.467792ms)
  Error: dsh CLI not found at /private/github/deepseek-harness/apps/cli/lib/bin.js; set DSH_HARNESS_ROOT to the deepseek-harness checkout
      at cliBin (file:///private/tmp/h605-r2/packages/agent-provisioning/src/index.js:76:11)
      at gates (file:///private/tmp/h605-r2/packages/agent-router/test/luna-credential-chain.test.js:42:46)
      at TestContext.<anonymous> (file:///private/tmp/h605-r2/packages/agent-router/test/luna-credential-chain.test.js:187:8)
      at Test.runInAsyncScope (node:async_hooks:226:14)
      at Test.run (node:internal/test_runner/test:1397:25)
      at Test.start (node:internal/test_runner/test:1257:17)
      at startSubtestAfterBootstrap (node:internal/test_runner/harness:387:17)
```

### F06 — packages/agent-router/test/process-lifecycle/feishu-reply-delivery-result.test.js

R6 original failing-test entry:
```text
test at packages/agent-router/test/process-lifecycle/feishu-reply-delivery-result.test.js:1:1
✖ packages/agent-router/test/process-lifecycle/feishu-reply-delivery-result.test.js (37.034625ms)
  'test failed'
```

R6 module-load context:
```text
n is rejected pre-queue; oversized prompts never cached (3.411041ms)
node:internal/modules/package_json_reader:301
  throw new ERR_MODULE_NOT_FOUND(packageName, fileURLToPath(base), null);
        ^

Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@larksuite/channel' imported from /private/tmp/h605-r2/packages/feishu-connector/src/index.js
    at Object.getPackageJSONURL (node:internal/modules/package_json_reader:301:9)
    at packageResolve (node:internal/modules/esm/resolve:784:25)
    at moduleResolve (node:internal/modules/esm/resolve:873:18)
    at defaultResolve (node:internal/modules/esm/resolve:1006:11)
    at #cachedDefaultResolve (node:internal/modules/esm/loader:708:20)
    at #resolveAndMaybeBlockOnLoaderThread (node:internal/modules/esm/loader:728:38)
    at ModuleLoader.resolveSync (node:internal/modules/esm/loader:766:56)
    at #resolve (node:internal/modules/esm/loader:690:17)
    at ModuleLoader.getOrCreateModuleJob (node:internal/modules/esm/loader:610:35)
    at ModuleJob.syncLink (node:internal/modules/esm/module_job:277:33) {
  code: 'ERR_MODULE_NOT_FOUND'
}

Node.js v26.7.0
✖ packages/agent-router/test/process-lifecycle/feishu-reply-delivery-result.test.js
```

Clean-base complete stdout/stderr:
```text
node:internal/modules/package_json_reader:301
  throw new ERR_MODULE_NOT_FOUND(packageName, fileURLToPath(base), null);
        ^

Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@larksuite/channel' imported from /private/tmp/h605-r2/packages/feishu-connector/src/index.js
    at Object.getPackageJSONURL (node:internal/modules/package_json_reader:301:9)
    at packageResolve (node:internal/modules/esm/resolve:784:25)
    at moduleResolve (node:internal/modules/esm/resolve:873:18)
    at defaultResolve (node:internal/modules/esm/resolve:1006:11)
    at #cachedDefaultResolve (node:internal/modules/esm/loader:708:20)
    at #resolveAndMaybeBlockOnLoaderThread (node:internal/modules/esm/loader:728:38)
    at ModuleLoader.resolveSync (node:internal/modules/esm/loader:766:56)
    at #resolve (node:internal/modules/esm/loader:690:17)
    at ModuleLoader.getOrCreateModuleJob (node:internal/modules/esm/loader:610:35)
    at ModuleJob.syncLink (node:internal/modules/esm/module_job:277:33) {
  code: 'ERR_MODULE_NOT_FOUND'
}

Node.js v26.7.0
✖ packages/agent-router/test/process-lifecycle/feishu-reply-delivery-result.test.js (33.653666ms)
ℹ tests 1
ℹ suites 0
ℹ pass 0
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 36.825959

✖ failing tests:

test at packages/agent-router/test/process-lifecycle/feishu-reply-delivery-result.test.js:1:1
✖ packages/agent-router/test/process-lifecycle/feishu-reply-delivery-result.test.js (33.653666ms)
  'test failed'
```

### F07 — R3: a settled or unknown turnExecutionId proves nothing (absent leaf)

R6 original failing-test entry:
```text
test at packages/agent-router/test/process-lifecycle/message-origin.test.js:175:1
✖ R3: a settled or unknown turnExecutionId proves nothing (absent leaf) (0.126125ms)
  TypeError: Cannot read properties of undefined (reading 'ctx')
      at TestContext.<anonymous> (file:///private/tmp/h605-r2/packages/agent-router/test/process-lifecycle/message-origin.test.js:180:32)
      at async Test.run (node:internal/test_runner/test:1404:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:969:7)
```

Clean-base complete stdout/stderr:
```text
✖ R3: a settled or unknown turnExecutionId proves nothing (absent leaf) (0.505167ms)
ℹ tests 1
ℹ suites 0
ℹ pass 0
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 39.618125

✖ failing tests:

test at packages/agent-router/test/process-lifecycle/message-origin.test.js:175:1
✖ R3: a settled or unknown turnExecutionId proves nothing (absent leaf) (0.505167ms)
  TypeError: Cannot read properties of undefined (reading 'ctx')
      at TestContext.<anonymous> (file:///private/tmp/h605-r2/packages/agent-router/test/process-lifecycle/message-origin.test.js:180:32)
      at async Test.run (node:internal/test_runner/test:1404:7)
      at async startSubtestAfterBootstrap (node:internal/test_runner/harness:387:3)
```

### F08 — scripted native rounds obtain fresh parent proof after prior settlement through real child transport

R6 original failing-test entry:
```text
test at packages/agent-router/test/route-chain/native-goal-composed.test.js:14:1
✖ scripted native rounds obtain fresh parent proof after prior settlement through real child transport (0.6665ms)
  AssertionError [ERR_ASSERTION]: paired native build is required; this conformance test must not silently skip
      at TestContext.<anonymous> (file:///private/tmp/h605-r2/packages/agent-router/test/route-chain/native-goal-composed.test.js:15:10)
      at Test.runInAsyncScope (node:async_hooks:226:14)
      at Test.run (node:internal/test_runner/test:1397:25)
      at Test.start (node:internal/test_runner/test:1257:17)
      at startSubtestAfterBootstrap (node:internal/test_runner/harness:387:17) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: undefined,
    expected: true,
    operator: '==',
    diff: 'simple'
  }
```

Clean-base complete stdout/stderr:
```text
✖ scripted native rounds obtain fresh parent proof after prior settlement through real child transport (0.653333ms)
ℹ tests 1
ℹ suites 0
ℹ pass 0
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 45.908333

✖ failing tests:

test at packages/agent-router/test/route-chain/native-goal-composed.test.js:14:1
✖ scripted native rounds obtain fresh parent proof after prior settlement through real child transport (0.653333ms)
  AssertionError [ERR_ASSERTION]: paired native build is required; this conformance test must not silently skip
      at TestContext.<anonymous> (file:///private/tmp/h605-r2/packages/agent-router/test/route-chain/native-goal-composed.test.js:15:10)
      at Test.runInAsyncScope (node:async_hooks:226:14)
      at Test.run (node:internal/test_runner/test:1397:25)
      at Test.start (node:internal/test_runner/test:1257:17)
      at startSubtestAfterBootstrap (node:internal/test_runner/harness:387:17) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: undefined,
    expected: true,
    operator: '==',
    diff: 'simple'
  }
```

### F09 — real child timeout removes native queued admission before old owner release

R6 original failing-test entry:
```text
test at packages/agent-router/test/route-chain/native-goal-composed.test.js:74:43
✖ real child timeout removes native queued admission before old owner release (37.646541ms)
  Error: agent agt_cancel-source (generation 1) RPC initialize rejected: AGENT_PROCESS_EXITED
      at AgentProcess.rejectAllPending (file:///private/tmp/h605-r2/packages/agent-router/src/process/rpc-channel.js:358:35)
      at AgentProcess.onChildExit (file:///private/tmp/h605-r2/packages/agent-router/src/process/spawn.js:143:10)
      at ChildProcess.<anonymous> (file:///private/tmp/h605-r2/packages/agent-router/src/process/spawn.js:77:47)
      at ChildProcess.wrapper (node:events:639:12)
      at ChildProcess.emit (node:events:514:20)
      at ChildProcess._handle.onexit (node:internal/child_process:294:12) {
    code: 'AGENT_PROCESS_EXITED',
    agentId: 'agt_cancel-source',
    processGeneration: 1,
    method: 'initialize',
    evidence: { code: 1, signal: null }
  }
```

Clean-base complete stdout/stderr:
```text
✖ real child timeout removes native queued admission before old owner release (35.586ms)
ℹ tests 1
ℹ suites 0
ℹ pass 0
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 79.272583

✖ failing tests:

test at packages/agent-router/test/route-chain/native-goal-composed.test.js:74:43
✖ real child timeout removes native queued admission before old owner release (35.586ms)
  Error: agent agt_cancel-source (generation 1) RPC initialize rejected: AGENT_PROCESS_EXITED
      at AgentProcess.rejectAllPending (file:///private/tmp/h605-r2/packages/agent-router/src/process/rpc-channel.js:358:35)
      at AgentProcess.onChildExit (file:///private/tmp/h605-r2/packages/agent-router/src/process/spawn.js:143:10)
      at ChildProcess.<anonymous> (file:///private/tmp/h605-r2/packages/agent-router/src/process/spawn.js:77:47)
      at ChildProcess.wrapper (node:events:639:12)
      at ChildProcess.emit (node:events:514:20)
      at ChildProcess._handle.onexit (node:internal/child_process:294:12) {
    code: 'AGENT_PROCESS_EXITED',
    agentId: 'agt_cancel-source',
    processGeneration: 1,
    method: 'initialize',
    evidence: { code: 1, signal: null }
  }
```

### F10 — real child cancel removes native queued admission before old owner release

R6 original failing-test entry:
```text
test at packages/agent-router/test/route-chain/native-goal-composed.test.js:74:43
✖ real child cancel removes native queued admission before old owner release (34.797875ms)
  Error: agent agt_cancel-source (generation 1) RPC initialize rejected: AGENT_PROCESS_EXITED
      at AgentProcess.rejectAllPending (file:///private/tmp/h605-r2/packages/agent-router/src/process/rpc-channel.js:358:35)
      at AgentProcess.onChildExit (file:///private/tmp/h605-r2/packages/agent-router/src/process/spawn.js:143:10)
      at ChildProcess.<anonymous> (file:///private/tmp/h605-r2/packages/agent-router/src/process/spawn.js:77:47)
      at ChildProcess.wrapper (node:events:639:12)
      at ChildProcess.emit (node:events:514:20)
      at ChildProcess._handle.onexit (node:internal/child_process:294:12) {
    code: 'AGENT_PROCESS_EXITED',
    agentId: 'agt_cancel-source',
    processGeneration: 1,
    method: 'initialize',
    evidence: { code: 1, signal: null }
  }
```

Clean-base complete stdout/stderr:
```text
✖ real child cancel removes native queued admission before old owner release (32.415292ms)
ℹ tests 1
ℹ suites 0
ℹ pass 0
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 74.371958

✖ failing tests:

test at packages/agent-router/test/route-chain/native-goal-composed.test.js:74:43
✖ real child cancel removes native queued admission before old owner release (32.415292ms)
  Error: agent agt_cancel-source (generation 1) RPC initialize rejected: AGENT_PROCESS_EXITED
      at AgentProcess.rejectAllPending (file:///private/tmp/h605-r2/packages/agent-router/src/process/rpc-channel.js:358:35)
      at AgentProcess.onChildExit (file:///private/tmp/h605-r2/packages/agent-router/src/process/spawn.js:143:10)
      at ChildProcess.<anonymous> (file:///private/tmp/h605-r2/packages/agent-router/src/process/spawn.js:77:47)
      at ChildProcess.wrapper (node:events:639:12)
      at ChildProcess.emit (node:events:514:20)
      at ChildProcess._handle.onexit (node:internal/child_process:294:12) {
    code: 'AGENT_PROCESS_EXITED',
    agentId: 'agt_cancel-source',
    processGeneration: 1,
    method: 'initialize',
    evidence: { code: 1, signal: null }
  }
```
