# #953 round 2 — validation evidence (2026-10-31 Asia/Shanghai)

All validation ran in the isolated clone at `f5a530ef7f0baf9f6ca86e3a9e59fd660ba59437`.
No product or existing test files were changed. `git diff --exit-code f5a530ef -- packages scripts profile-production bundle-broker package.json package-lock.json` returned 0.

## Result

| Check | Actual result | Limit |
|---|---|---|
| Existing full test target, serial | exit 1; 463 tests, 460 pass, 1 fail, 2 skipped | **Not all green**; the one failure is the pre-existing pinned Harness identity assertion described below |
| Initial `npm test` | exit 1; 441 tests, 435 pass, 4 fail, 2 skipped | Missing local bridge at import time (2 files), shared `/tmp/home/agt_a` symlink race (1), Harness identity (1); retained as attempt 1 |
| `node --check` | exit 0; all 134 `.js`/`.mjs`/`.cjs` files under `packages/` and `scripts/` | Parsing only; scripts were not executed |
| Build command | `package.json` has no `build` script | No claim that a nonexistent build ran; syntax check is not a build |
| Live/production acceptance | NOT RUN | No production install/deploy/recruitment/auth mutation/canary |

The corrected setup used the exact `npm test` file glob with serial scheduling:

```text
node --test --test-concurrency=1 packages/*/test/*.test.js
```

The sole remaining failure is `packages/agent-provisioning/test/provisioning.test.js:90-96`,
which requires Harness `{version:0.1.0-rc.5, commit:a12bb03c6861969985f066bfbf0cb7e5dd5ac567}`.
The available source Harness is `{version:0.1.0-rc.8, commit:514ab7b0029141b88c807704764d0d3e1eea1da4}`.
The full target ran unchanged baseline product/test bytes, so this is a demonstrated dependency/environment mismatch, not a #953 fix or a claim of passing baseline.
The exact pinned Git object exists but has no tracked `apps/cli/lib/bin.js`; no synthetic version, patched assertion, mixed old-source/new-build checkout, or production downgrade was used to hide the failure.

All five tests in `packages/broker/test/onboarding-entry.test.js` and all twelve tests in
`packages/production-runtime/test/v2-ingress-gate.test.js` passed within that full run.
These are fake/tmp SOURCE tests, not evidence that a real employee was recruited or that a production group accepted/delivered an event.
Two explicit existing gates stayed skipped: the notification-ingress integration seam and the exact ChatGPT package artifact acceptance. No integration-enable/artifact environment variables were set.

## Safety setup and instrumentation

- Created a **real local** gitignored `node_modules/` directory. Linked only third-party entries from the ordinary readable installed app dependency tree; `@agent-core` remains local. No npm install or dependency target mutation ran.
- Prebuilt the local `@agent-core` bridge by importing and invoking only `ensureRepoCoreBridge()` from `packages/agent-provisioning/src/index.js`. This function writes local symlinks only; `provisionAgentHome()` was not invoked by that setup command.
- This distinction matters: existing tests call `provisionAgentHome()`, whose default behavior copies `os.homedir()/.dsh/.credentials.yaml` and writes the repo bridge. A symlink of the entire node_modules directory, or an ordinary user-home test run, would violate this diagnostic boundary.
- Every test process ran with a minimal environment containing only `PATH`, `DSH_HARNESS_ROOT`, `NODE_OPTIONS`, and the task-specific `HR953_ISOLATED_OS_HOME`.
- The retained `validation-home-preload.mjs` replaces `os.homedir()` with a new empty `/private/tmp/hr953-validation-*/os-home`, then calls `syncBuiltinESMExports()`. `HOME` and `CODEX_HOME` were not assigned or repurposed. No real private credential/settings content was read or copied.
- The preload changes home-directory semantics for this validation. Results are therefore **instrumented isolated test results**. They do not establish uninstrumented production behavior.
- No model turns or real employee operations ran. The real-boot smoke test only performed a local child initialize/shutdown handshake using a scratch home. HTTP tests use fake loopback servers; production acceptance scripts were not executed.
- Serial scheduling is required here because existing tests share literal fake paths such as `/tmp/home/agt_a`; no production state path was used. Attempts are both retained rather than replacing failed evidence.

## Evidence files

- `validation-test-metadata.json` — final exact command, start/end, environment keys and counts.
- `validation-npm-test.log.gz` — final full output and the exact failure.
- `validation-test-attempt1-metadata.json`, `validation-npm-test-attempt1.log.gz` — initial attempt.
- `validation-dependencies.json` — local dependency-link realpaths and strategy.
- `validation-home-preload.mjs` — complete home-isolation instrumentation.
- `validation-syntax-metadata.json`, `validation-syntax.log.gz` — source parse scope, per-file rc and count.

Raw command outputs are delivered as lossless `.log.gz` archives (to preserve whitespace byte-for-byte). Read with `gzip -cd <archive>`. `validation-log-archives.json` records raw and archive SHA-256 and verified lossless roundtrips. The redaction audit scanned the uncompressed bytes before archiving.
