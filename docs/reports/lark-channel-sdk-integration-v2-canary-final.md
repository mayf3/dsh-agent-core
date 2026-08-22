# Lark Channel SDK Integration V2 — Phase A Final Canary

## Verdict

**PASS — Phase A merge candidate.**

The final candidate uses one official SDK WebSocket, SDK normalization/dedup/ProcessingLock, and `PREBOUND_ONLY`. No Phase B behavior or Router/AgentProcess/Binding/Workspace/Session/Scheduler/Kernel product feature was added.

- Live-tested candidate: `4ad9a60288e1fd6873f64591eadc14df9f48a9ed`
- Live-tested tree: `543e7625a07a8256fa99774e2dfad3b67a668c2d`
- Connector tree: `c43e2859af3d6afb136cb162ed6fea5ad042d8e3`
- Latest-main rollback base: `342111c485a48c4932b1b6f1cb59ef5307af6279`
- Accepted UX Spec blob: `91513d140bfeb2747326a465bdc01d72c899c864` (byte-identical)

The companion JSON report is the machine-readable authority for exact counters and digests.

## Current-main fast-forward delivery reconciliation

A later delivery-only round fetched `origin/main` and mechanically replayed the exact reviewed PR #40 delta onto current main without changing product semantics:

- Historical reviewed Head: `71b12b65a65fb263fed0bfe196ec2fea3ed72f73` (`REVIEWED_PASS / REFERENCE_ONLY`)
- Current main base: `b312ef88532d2750e6df95a8ef2e4a83284b9562`
- Historical Head/current-main merge-base: `342111c485a48c4932b1b6f1cb59ef5307af6279`
- Replayed Head before this reconciliation-only report update: `96ff5ec39b64d8e64d1df5546309d55f75827459`
- Historical changed paths compared: 37; blob mismatches after replay: 0
- `BASE_MAIN_IS_ANCESTOR_OF_NEW_HEAD = YES`; `behind_by = 0`
- `LIVE_TESTED_CODE_TREE_MATCH = PASS`
- Full live Canary rerun: not required; inherited result remains unchanged PASS

Byte-identical governed implementation coordinates:

- Feishu connector tree: `c43e2859af3d6afb136cb162ed6fea5ad042d8e3`
- Production runtime `compose.js`: `627776f2427c5418f0f9b5d2522d548ce2f10d22`
- Connector package manifest: `199af352ebc80e0de08d7349fc03816a96797168`
- Connector lockfile: `c015e2949719cc8ad2dfb2cbfe41cc52a316e06c`
- SDK runtime revision: `ab028f9dbcc09effbdfa4c9885cdcc1f5ecc623f`
- Canary driver: `6ff8f30730e638379858160996760d3b480834a0`

Current-main drift did not overlap any PR #40 changed file. The current-main Agent Router tree `c1ea28de9720c665020d7a3f73495717f61cc5b3`, AgentProcess blob `ec5e0d092fbc9d1030fa24c295c7e288ee8df1ef`, and model-overrides blob `4c777c7c6a41943add7dc0716e442f8864042adf` remain byte-identical to current main. This preserves the Agent child `TMPDIR` inheritance fix and Luna rc.8 override.

The accepted UX Spec remains `accepted` at blob `91513d140bfeb2747326a465bdc01d72c899c864`; accepted Spec change is `NONE`. The superseding Draft PR persistently binds the final delivery Head after this report commit.

### Delivery minimal recheck

All required checks were rerun on the current-main replay:

- Log-redaction adversarial: 16/16 pass
- Feishu connector full suite: 133/133 pass
- Production runtime full suite: 42 pass, 0 fail, 2 skip (44 total)
- Agent Router full suite, including current-main child `TMPDIR` tests: 107/107 pass
- Real Binding read-only replay: 1/1 pass
- Frozen rc.5 serialized full repository: 620 pass, 0 fail, 3 skip (623 total)
- Governance, authority hashes, accepted UX blob, and `git diff --check`: PASS
- Gitleaks: 0 findings
- Exact local credential literals: 13 candidates scanned, 0 tracked-file matches
- Forbidden-surface diff: `NONE`

`FULL_REPO_FAIL = 0`.

## Frozen Harness

Verification and live execution used only:

- Commit: `a12bb03c6861969985f066bfbf0cb7e5dd5ac567`
- Tree: `1e2b319fd1312d3263c3d9f84231d290e6dddd99`
- Version: `0.1.0-rc.5`

Tracked cleanliness and the rollback dependency namespace link to this exact checkout were fail-closed and rechecked.

## Provider policy

The allowed primary route `zai/glm-5.3` succeeded normally. Therefore fallback invocation was **not permitted** and was not performed. Status: `NOT_PERMITTED_PRIMARY_SUCCEEDED`.

The unused fallback artifact was still frozen for audit:

- `dsh-codex@0.2.3`
- 43 sorted path/type/content entries
- Tree digest: `442d0039ac373b890fa6e0b25d4a50649c2c8157a2f5fcf34a814538de5cd67d`

## Primary canary

Result: **PASS** on `zai/glm-5.3`.

- One resolved Agent turn and reply flow
- One SDK channel service, one SDK connect call, one SDK WebSocket construction
- Zero SDK errors
- Zero secret-disclosure matches
- Evidence SHA-256: `4aaf3ab5f679dce16e701ea6be42d6ae38429e644020bfaae3fc9789a3f04474`

The primary run predates final driver-only hardening but used the same connector tree `c43e2859af3d6afb136cb162ed6fea5ad042d8e3`.

## Full primary-route matrix

Result: **PASS** at the exact live-tested candidate.

Evidence SHA-256: `759b5cf46d91dabe70a835b1cd8cca02e80422190dd3f61930f057cf24572924`.

Passed gates:

- Group bot-only mention
- P2P without mention
- `@all` raw null-vs-zero semantics
- Ordinary no-mention silent drop with six zero deltas and byte/size/mtime-identical Binding state
- Topic and same-topic follow-up
- Server-side same-chat, same-root, same-thread, and reply-parent equality
- Exact raw duplicate replay during an immutable 20-second hold
- Processing lease held, unseen before settle, zero replay Router/turn deltas, one active turn
- Seen-cache mark and lease release after settle
- Zero SDK errors and zero secret-disclosure matches

Successful stop Binding SHA-256: `f77f8a049ce74d80c724b461bc48114c2a22f2389ea2b52b6d786344bd127ae6`.

## Rollback

Result: **PASS** on the exact detached latest-main base.

A separately frozen handoff was generated by the same exact candidate and deliberately stopped immediately after successful readiness and three-scope Agent/main prebinding. This kept the full matrix proof and the rollback byte-handoff proof independently auditable:

- Full successful matrix evidence: `759b5cf46d91dabe70a835b1cd8cca02e80422190dd3f61930f057cf24572924`
- Handoff evidence: `e5106e77a8b29ed412b5fe80dbc208e8b0609c93f57d14a570c166dc9c8c44cd`
- Copied handoff Binding bytes: `b62d5a89185ff75337be0a750ee2779c051778ef3f1174c28e5cfe3f8c0de25b`
- Independently reviewed rollback driver: `2ccb9a863f8d703c04b522b0047a942da8f0024aa29ba17c1d3b947dde42adf5`
- Final rollback evidence: `8c6c430eadfee4ff14b7d02144e55f85601d34f12342a83adf93c882d7834980`

Rollback proved:

- Binding bytes unchanged on load, exact three-key scope, no migration
- Group, P2P, and topic behavior on `zai/glm-5.3`
- Agent/main continuity
- Server-side topic target equality
- Runtime stop and deletion of both rollback and handoff raw states before final PASS
- Driver, matrix evidence, handoff evidence, and frozen Harness package-scope identities still equal after cleanup

The first group and P2P attempts encountered a transient primary-route rate limit. No fallback was permitted. Both were retried on the same primary route and passed; topic passed on its first attempt.

After the successful final gate, `runtime.stop()`, and complete raw-state scrub, the isolated legacy-base process retained an idle handle. The executor terminated that already-stopped process. This did not change the passing functional, target-equality, Binding-integrity, or cleanup evidence.

## Frozen full-repository verification

Command (proxies removed; suites serialized):

```text
DSH_HARNESS_ROOT=/private/tmp/dsh-harness-rc5-pr27-audit \
node --test --test-concurrency=1 'packages/*/test/*.test.js'
```

Result:

- Tests: 615
- Passed: 612
- Failed: 0
- Skipped: 3
- Cancelled: 0
- Duration: 145109.688958 ms

Governance verification also passed: vendored bytes match `governance.lock.json`, adoption is accepted, and the accepted UX Spec remains byte-identical.

## Logging-redaction closure

The shared sanitizer now runs before the sink and covers normalized sensitive-key families plus exact secret literals. Adversarial coverage includes descriptor-only reads and proves no getter, `toJSON`, unknown-object coercion, or input mutation path. The connector suite and frozen full-repository run passed.

Independent randomized sanitizer review exercised 5,000 cases with zero leaks.

## Contract compliance

```text
SPEC_GOVERNANCE_MODE = COMPLIANCE
PRIMARY_GOVERNING_SPEC = AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V2
GOVERNING_SPEC_REVISION = 3dd886854d7f6884e2495022b3e7ce3a4ccde531
CONTRACT_C_AMENDMENT_REVISION = a734a481bbcdf4852d49505a2e91f57bf27490dc
IMPLEMENTATION_COMMIT = 4ad9a60288e1fd6873f64591eadc14df9f48a9ed
ENVIRONMENT = dedicated non-production Feishu App + frozen Harness 0.1.0-rc.5
EVALUATED_AT = 2026-08-22T01:46:25Z
IMPLEMENTATION_STATE = COMPLETE
VERIFICATION_STATE = SUFFICIENT
CONFORMANCE = VERIFIED
CONTRACTS_TOTAL = 5
CONTRACTS_VERIFIED = 5
CONTRACTS_DRIFTED = 0
CONTRACTS_UNKNOWN = 0
CONTRACTS_NOT_APPLICABLE = 0
IMPLEMENTATION_READY_TO_MERGE = YES
```

Both accepted governing Spec blobs were already present, byte-identically, in the implementation base.

| Contract | Result | Evidence relation | Qualified observations |
|---|---|---|---|
| A — Gate Fail Closed | VERIFIED | EVD-A SATISFIES | OBS-001 frozen full suite; OBS-002 live matrix |
| B — Preserve V0 `@all` Eligibility | VERIFIED | EVD-B SATISFIES | OBS-001 mention/gate tests; OBS-002 bot/P2P/`@all`/no-mention matrix |
| C — Full identity/metadata/attachment preservation with semantic text compatibility | VERIFIED | EVD-C SATISFIES | OBS-001 differential/post/file-link/no-renormalization tests; OBS-002 live ingress matrix |
| D — SDK Async Dispatch and Full-Turn Promise | VERIFIED | EVD-D SATISFIES | OBS-001 real-SDK/current-main/error-path tests; OBS-002 renewable-lock exact replay |
| E — `create_thread` Product Semantics | VERIFIED | EVD-E SATISFIES | OBS-002 live create/follow-up/target equality; OBS-003 rollback target equality |

Additional observations: OBS-004 governance/spec/scope integrity passed; OBS-005 independent sanitizer review ran 5,000 randomized cases with zero leaks. Evidence limitations and exact counters are recorded in the companion JSON.

## Scope and privacy

The diff is confined to the Feishu connector, its focused production-runtime wiring/readiness seam, tests/fixtures, the canary driver, and these reports. Forbidden product surfaces are unchanged.

Retained report evidence contains no App Secret, token, Authorization value, human name, message body, or unnecessary raw ID. Raw canary states, session homes, copied auth state, disposable rollback states, and temporary test credentials were scrubbed.

## Disclosed non-final attempts

The following are recorded for audit but are not treated as final evidence:

1. A primary timeout before any provider result; fallback was not authorized.
2. Matrix attempts that exposed and corrected evidence-driver attribution/gating defects.
3. A rollback attempt using a non-existent legacy `ready()` API; fail-safe cleanup removed both raw states.
4. A rollback attempt before the frozen Harness package bridge was linked; fail-safe cleanup again removed both raw states.
5. Transient rollback primary-route rate limits; same-route retries passed.

No failed attempt is promoted into the final PASS.
