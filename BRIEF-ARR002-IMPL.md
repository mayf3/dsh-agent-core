# BRIEF-ARR002-IMPL — CTR-ARR-002 有界 bind retry 实施（accepted AGENT_CORE_ADMISSION_RUNTIME_RELIABILITY_V1）

## 授权
accepted 合同（本 worktree docs/specs/ 已含全文 §5 DEC-ARR-001..003 / §6 CTR-ARR-001..）。contracts 权威。A 面 containment 已由 #555 落地（勿重开其 closure）。

## 合同原文（逐条满足）
启用并满足既有 history activation 的 mount，初次 listen 失败后只对 EADDRNOTAVAIL/EADDRINUSE/EACCES 这些尚未成功绑定的 bind error 重试：固定 60,000ms 间隔，最多 30 次追加 listen（初次+30，最多31次）。EACCES 仅可等配置外部恢复，绝不 chmod/提权/改端口/改 identity。
每 mount 同时最多一个 in-flight listen、一个 pending timer，timer MUST unref；成功 listening 后取消 pending retry、停止该 bind budget；非 allowlist/耗尽进入 history-unavailable，保持 runtime/admission 存活。成功绑定后的 serve error 只 contained/log，不借此重开 bind budget、热换 generation 或重启其他 surface。新 mount 的 budget 只能随其合法生命周期重建。

## 任务
1. 核现状：packages/product-api/src/history-listener.js 当前 listen/error 处理（#555 后状态）+ index.js mount 包裹——确认 containment 在位、重试缺失
2. 实施 CTR-ARR-002：bounded retry 状态机（mount 生命周期内 budget=30+1；仅三类 bind error 重试；60s unref timer；成功后取消；耗尽→history-unavailable 保持 runtime/admission 存活；成功绑定后 serve error 只 contained）
3. 测试：新 retry 行为单元测试（fake server/timer 或注入 clock——覆盖：bind error 三类各自触发 retry、非 allowlist 错误不重试、30 次耗尽进入 unavailable、成功绑定取消 timer、serve error 不重开 budget）真实 rc=0；既有 history-listener 测试回归
4. 边界：不改 D-009/UNKNOWN 语义；不改 default-off 激活条件；不 chmod/提权/改端口
5. 交付：单 commit → push origin feat/admission-reliability-bface → PR(base main) 不合并；push 失败（代理 7890）→ bundle 交接 /tmp/transfer-arr002.bundle

## 工具指令
node=/usr/local/libexec/agent-core/node-runtime/bin/node（agent-router 风格测试）；产品 API 测试按仓内现有 runner；写后自证。

## 实施 preflight（2026-11-10）

```text
TARGET_REPOSITORY = mayf3/dsh-agent-core
BASE_HEAD = 19c2261f6b8733edbfe05100e34cfc7226f4e609
CURRENT_BASE_HEAD = 19c2261f6b8733edbfe05100e34cfc7226f4e609 (origin/main snapshot)
ROUTE_STAGE = IMPLEMENTATION
AUTHORITY_ACCEPTED_IN_BASE = YES
AUTHORITY_ACTION = REUSE
PRIMARY_AUTHORITY = AGENT_CORE_ADMISSION_RUNTIME_RELIABILITY_V1@da7227fa33b0455c69051a6926be0cf27f46b4e6 / CTR-ARR-002
IMPLEMENTATION_AUTHORITY = contracts
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = DURABLE
MUTATION_AUTHORIZATION = user request to execute this Brief
ISOLATED_WRITE_SURFACE = /private/tmp/arr002-impl, standalone clone, feat/admission-reliability-bface
GOAL_OR_TARGET = bounded optional history bind recovery and disposal without affecting admission
CURRENT_GAP = existing containment has one listen and no retry; production teardown bypasses listener.close
IMPLEMENTATION_ALLOWED = YES
OPERATION_ALLOWED = NO
SPEC_GAP_DEPENDENCY = NONE
EVIDENCE_NEEDED = deterministic retry/dispose tests, real disposable bind smoke, history/auth/API/IAD regression, independent affected review
DONE_WHEN = one commit, passing affected tests and review, unmerged PR or verified /tmp/transfer-arr002.bundle
EXPANSION_TRIGGER = accepted Contract conflict, auth/activation changes, production effects or required gate failure
```

The original `/private/tmp/bface-impl` has a pre-existing unstaged change that
removes ARR acceptance metadata and sets `status: proposed`; it is preserved
untouched. It is not included in this implementation. This clean clone uses
the accepted ARR bytes already in the exact base (also local origin/main),
including the recorded independent acceptance. No authority text is changed.
Historical authoring-stage body text is retained as accepted by the base's
explicit acceptance transaction; it is not a new implementation prohibition.

Scope stays within CTR-ARR-002 and its directly dependent containment/teardown
invariants. Existing #555 closure is retained. No Scheduler/D-009, identity,
host/port, default activation, directory request retry or production changes.

## 实施与证据（2026-11-10）

Implemented one initial listen plus at most 30 additional listens at 60,000 ms,
only for the three bind codes, with one unref timer/in-flight attempt. Success
latches the original generation and ends retry eligibility; close cancels first
and is idempotent while unbound. Production uses the same close boundary and
registers disposal before imports. Bind/listen/log failures remain contained,
and success logging waits for listening. Activation, request auth and IAD logic
are unchanged. The mount helper keeps index.js below the accepted file cap.

Environment: macOS managed workspace-write sandbox; Node v25.6.1 at
`/usr/local/libexec/agent-core/node-runtime/bin/node`. Baseline tracked
`node_modules` is a dangling symlink to `/private/tmp/dsh-ekr-p1-new/node_modules`.
For tests only, a local dependency directory linked installed schemastery 3.18.1
and dsh-session 0.1.0-rc.8 from `/usr/local/libexec/agent-core/harness`, and linked
this clone's session-history package. The original tracked symlink was restored
after testing, with no dependency or package changes in the commit. Initial
regression attempts recorded module-resolution failures (including missing
croner for api.test.js); these are not represented as passed tests.

Executed results (raw logs in `/private/tmp/arr002-evidence`):

| Scope | rc | counts | Evidence |
|---|---:|---|---|
| deterministic new retry + production mount + real RS256/JWKS-stub IAD continuity | 0 | 32 tests / 32 pass / 0 fail | arr002-deterministic.log |
| full new suite including two disposable real sockets | 1 | 34 tests / 32 pass / 2 fail | arr002-full-new.log |
| existing history-auth + workflow-admission | 0 | 21 tests / 21 pass / 0 fail | arr002-auth-iad.log |
| existing history-listener, 3000 ms per-test timeout | 1 | 7 tests / 1 pass / 0 fail / 6 cancelled (timeout) | arr002-history-regression.log |

All commands use the Node path above with native `--test`. The deterministic
run selects names using
`--test-name-pattern='^(?:EADDR|EACCES|non-allowlist|exactly|duplicate|listening|successful|close|closing|synchronous|throwing|bind|production|mount|late|rejected|unready|immediate|disposal|default|explicitly|empty|IPv4|IPv6|star|missing|signed)'`
on `packages/product-api/test/history-listener-bind-resilience.test.js` and
`packages/product-api/test/history-mount.test.js`; the full run uses those same
files without a filter. Existing regression uses the named `.test.js` files.
The signed continuity case executes the real directory handler with fake
history server/timers, not a real production runtime or live JWKS.

Raw log SHA-256, in table order:

```text
333f8118d5a8f50490ec81277ff2db185981f0231212beeea988182a9c741e95
ea49808bab30243c057d0c3f8664b566f94a547352b2a65ceafcc5dfcd27be8a
5108ba49034918a2f4b232381aecc1f3a7a4e804a66eb444d767c65236500b24
60809bdd6ec5d8cb068e3353f25beb02eb011488d8f74ccfbe308514644de8fc
```

Independent affected semantic review: `/root/review_arr002` (non-author),
initial FULL review of the bounded affected surface. Product semantic result
PASS; product blocker union, Spec gaps and follow-ups empty. Source SHA-256:

```text
history-listener.js f55b413dfaeb87b0263b1426d22147e74e2a5b7793d57dc64f31a0dcd9a98edc
history-mount.js 77d1cfd70d8800a6092289e67121713745162eba9cfcac5a705193ae9a7a8a17
index.js 7a9cc8a216189ae61802b5212e99a53a7c4fa1570a43d27e923d14ba4e05eeb0
```

FROZEN_BLOCKER_UNION = {RG-001 REQUIRED_GATE_FAILURE}.
SOURCE: Brief task 3 / accepted ACC-ARR-002, existing history regression.
COUNTEREXAMPLE: an independent minimal `createServer().listen(0,'127.0.0.1')`
probe returns EPERM/rc=1 in this sandbox; both full-suite socket tests fail with
that exact error, and existing HTTP tests wait for unavailable listening events.
IMPACT: real bind/HTTP recovery and full ACC-ARR-002 conformance remain unverified.
MINIMAL_CLOSURE: rerun both complete new suites and existing history regression
in an authorized environment allowing disposable local sockets, using the exact
candidate and actual pinned dependencies. No permissions were bypassed.
affected_readiness = [MERGE_READY, CONFORMANCE_READY]; both NO.

Vendored governance integrity with `--require-accepted`: rc=0.
Syntax checks of changed listener/mount: rc=0. `git diff --check`: rc=0.
SOURCE_IMPLEMENTED = YES; SOURCE_INTEGRATED = NO; CONFORMANCE = NOT_VERIFIED;
PRODUCTION = NOT_EXECUTED; BUSINESS_ACCEPTANCE = UNKNOWN.
DELIVERY_STATUS = STOPPED (RG-001); preserve one reviewable commit and bundle,
without merge or production activation. A source semantic PASS is not the
missing full-suite PASS. The bundle is a blocked candidate handoff.
