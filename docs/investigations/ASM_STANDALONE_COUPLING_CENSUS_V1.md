---
investigation_id: ASM_STANDALONE_COUPLING_CENSUS_V1
status: complete
date: 2026-09-04
goal: AGENT_SESSION_SEND_STANDALONE_PRODUCTION_V1
parent_goal: CORE_RUNTIME_DAILY_AUTONOMY_OVERNIGHT_V1
governing_accepted_specs:
  - AGENT_CORE_AGENT_SESSION_MESSAGING_V1 (r3, accepted 2026-09-02)
  - AGENT_CORE_AGENT_SESSION_MESSAGING_DEPLOYMENT_V1 (r3, accepted 2026-09-03)
  - AUTH_SERVICE_AGENT_SESSION_SEND_OPERATIONAL_GRANT_V1 (auth PR #50, MERGED)
historical_input_only:
  - amend/asm-release-closure-boot-v3 (r3 28-file boot-generation closure, MERGED to main)
  - amend/asm-release-closure-r3a-count (count touch-up, MERGED to main)
  - reconciliation spec §4 (coupling recorded as fleet-codex subscription discipline)
---

# ASM_STANDALONE_COUPLING_CENSUS_V1

目的：为 `AGENT_SESSION_SEND_STANDALONE_PRODUCTION_V1` 完成 §8 要求的文件级机械普查，
判定 CASE A/B/C，并给出 ASM-only 组合 closure 的精确定义。

## 1. Fresh 坐标（2026-09-04 普查时点）

```text
CURRENT_DSH_MAIN   = 7c7c03afa53703cbad9cc686e18fa7f5658eb8e6 (origin/main fresh fetch)
CURRENT_AUTH_MAIN  = 31cef95c462e5a65843cbc70ab659697b9be1087 (github/main fresh fetch)
CURRENT_RUNTIME    = pid 72000, launchd ai.agent-core.runtime (system),
                     root /usr/local/libexec/agent-core/app, /healthz ok (8989 ingress face)
CURRENT_RUNTIME_GEN= baseline face + 10-file scheduler release（ASM 文件全部 ABSENT）
CURRENT_ASM_TOOL_VISIBLE = NO（runtime 级证据：live 树字节副本 broker/src/index.js
                     import 执行 DEFAULT_MANIFESTS = 19 manifests，无 agent_session_send；
                     沙盒 /private/tmp/asm-census-live-20260904T213747，136 文件哈希验证）
WORKFLOW_EXECUTE   = VISIBLE in live face（19 manifests 内含 workflow_execute ×7 面）
SCHEDULER          = VISIBLE in live face（scheduler manifest 在场）
AUTH PRODUCTION    = 1.7.0 / digest 577a1879… / pid 56983 /health ok
CURRENT_ASM_GRANT  = LIVE_V2：machine_access_grants 唯一行
                     mc_cF81DF-XND9Zmzao4F08rOK_（uuid 695d1eeb…）× agent-session-messaging
                     × {agent.session.send} × version 2 × revoked_at NULL
                     client active / principal agt_efficiency-agent active
                     audience agent-session-messaging active registered_scopes={agent.session.send} v1
GRANT_AUTHORITY    = AUTH_SERVICE_AGENT_SESSION_SEND_OPERATIONAL_GRANT_V1（auth PR #50 MERGED，
                     docs-only）：PERMANENT_OPERATIONAL，tuple 精确匹配 live 行。
                     版本注：spec 车辆写 version=1；live 为 version=2（单调再激活计数，
                     部署 assertGrantState 仅 version<1 fail-closed → 功能等价）。
MISMATCH           = NO（按 tuple/意图精确覆盖；version 差异为机械计数，不作 DB 写）
```

## 2. 旧 28-file closure 三方 blob 矩阵（LIVE vs ASM@7921f4a vs main@7c7c03a）

26/28 文件 ASM blob == 当前 main blob（source merge 已完成且 main 即 ASM 世代）。例外：

| seq | file | LIVE | ASM | MAIN | 说明 |
|-----|------|------|-----|------|------|
| 14 | production-runtime/src/compose.js | f5c7a8d3 | cdd3eacf | c407b064 | 三代各异；main=ASM+SchedulerHistory(50行) |
| 26 | broker/src/registry.js | 2f5e55b7 | 7cd71350 | 2f5e55b7 | LIVE==MAIN（scheduler release 已更新），ASM 世代为旧 |

model-overrides（不在 closure）：LIVE=ea44819a（breakglass）≠ MAIN=380f5264（V3 六字段订阅 schema）。

## 3. 耦合机械形态（§8 A/B/C 答案）

**A. ASM 必需字节**（全部已被 accepted `AGENT_CORE_AGENT_SESSION_MESSAGING_V1` r3 冻结、
全部存在于 main@7c7c03a，与 ASM@7921f4a blob 一致）：

- 新文件 ×4：`broker/src/capabilities/agent-session-messaging.js`（零 import 自包含）、
  `production-runtime/src/agent-session-messaging.js`（import node:crypto + capability id + reply-wait）、
  `production-runtime/src/agent-session-reply-wait.js`（自包含）、
  `production-runtime/src/agent-session-messaging-audit.js`（node:fs/crypto）。
- broker 共享文件增量 hunks：
  - `index.js`：恰好 4 个纯增量 hunk（import manifests / DEFAULT_MANIFESTS spread /
    auditDenial 透传 / localHandlerResolver 第三 provider agentSessionMessagingAccess）。
  - `gateway.js`：auditDenial L0 hook（R12）——delta 100% ASM。
  - `relay.js`：agent_session_send envelope 纪律（uncertainSessionSend / validSessionSendResult /
    validDeclaredFailure）——delta 100% ASM（outcome_unknown 不自动重试语义）。
  - `mapping.js`：+nonBlank、+allOrNone 校验（**纯增量**，+11 行代码；live manifests 均未声明
    这些特性 → 零行为变更；ASM capability 声明 nonBlank 需要此支持，见 spec F12）。
  - `schema.js`：+61/-2（allOrNone/nonBlank schema 支持 + HTTP_METHODS 加 PATCH；
    removed 仅 PATCH 方法集与文档行；face 内无 capability 声明 PATCH → 零行为变更）。
- agent-router 增量（R3/R4 溯源与投递链）：
  - `index.js`：+1 行 `resolveAgentById`。
  - `ingress-delivery.js`：delta 100% ASM（validateMessageOrigin 精确 allowlist + deliver 第二参
    + AGENT_DISABLED 细化）。
  - `parent-rpc-relay.js`：provenSourceTurnExecutionId（R3 源 turn 证明）——100% ASM。
  - `process/turn-execution.js`：+3 行 messageOrigin 透传。
- production-runtime：
  - `notification-ingress-runtime.js`：deliver wrapper `(req) =>` 改 `(req, ...rest) =>` ——
    **必须**（live wrapper 会丢弃 controlOpts/messageOrigin，破坏 R4 合同）。
  - `compose.js`：ASM wiring（agent-session-messaging/audit import、agentSessionAudit、
    auditDenial hook、ctx.provide agentSessionMessagingAccess）。

**B. Fleet 订阅纪律字节**（禁止带入，§5）：

- `agent-provisioning/src/index.js`（main gen 34479d81）：dsh-codex 校验 4→6 字段
  （sourceCommit 40-hex + artifactSha256 64-hex + 本地工件/stamp 硬校验）——生产 canary 失败根因
  （turn 期 provisionExactProfilePlugin 抛 plugin_source_mismatch / plugin_artifact_mismatch）。
- `agent-provisioning/src/shared-codex.js`、`plugin-artifact.js`（仅被上述 main gen index import）。
- `production-runtime/src/shared-codex-migration.js` / `-executable.js`（Fleet 迁移工具；
  在 compose.js 中仅以 5 行 re-export 出现，注释明言 "for the existing tests and the executable"）。
- `model-overrides.js` main gen（380f5264）：V3 schema 强制六字段订阅 + canonical credentialFile。
- `agent-router/src/route-chain.js` 增量：reuse identity 的 credentialFile resolve（Fleet 语义，非 ASM）。

**C. 其他 Goal 字节**（禁止夹带）：

- Forum v2/moderation：main gen `broker/index.js` 的 forumNormalManifests/forumModeratorManifests
  machinery + `capabilities/forum-moderation.js`（新文件）+ `capabilities/forum.js` main gen
  （186 行：stats 等）+ `transport.js`（sanitizer 抽取 + PATCH；非 ASM）+ `demo-server/*`
  （非 daemon-reachable，r3 即已按 non-daemon 3 文件审计）。
- Scheduler History（Lane D）：main gen compose.js 的 mountSchedulerHistoryRuntime /
  createObservedSchedulerInvoker import（live 树无 scheduler-history-runtime.js /
  scheduler-invoker.js，属 Lane D 面，生产 dormant）。

**D. 自洽 import closure 判定**：YES——保留 live 的 agent-provisioning（4 字段校验，与生产
profile 配置自洽）、model-overrides（V2 loader，compose 仅用 loadAgentModelOverrides，签名一致）、
forum 面（7 工具）、registry（LIVE==MAIN 无需动）、workflow.js、scheduler 面；ASM 增量全部
可在 live 依赖集合上加载（见 §5 验证）。

**E. 是否需要 source code 修改**：不需要新逻辑。所有 ASM hunks 逐字来自 accepted main；
组合 = live 基底 + ASM hunks 选择性字节组合（2 个组合文件：index.js、compose.js；
组合规则见 §4）。→ **CASE A = SELECTIVE_COMPOSED_CLOSURE**（deployment composition）。

## 4. ASM_STANDALONE_FACE（17 文件，2026-09-04 定稿）

```text
NEW ×4（blob = main@7c7c03a == ASM@7921f4a）:
  packages/broker/src/capabilities/agent-session-messaging.js   (109d3ce4)
  packages/production-runtime/src/agent-session-messaging.js    (e3420bbe)
  packages/production-runtime/src/agent-session-reply-wait.js   (6968cc2a)
  packages/production-runtime/src/agent-session-messaging-audit.js (ecd23618)

WHOLESALE main-gen ×11（delta 经 hunk 级分类 100% ASM 或纯增量校验器）:
  packages/broker/src/gateway.js                                (68ec4eec)
  packages/broker/src/relay.js                                  (2ec4acf7)
  packages/broker/src/mapping.js                                (74e83e11)
  packages/broker/src/schema.js                                 (1bd36bbe)
  packages/agent-router/src/index.js                            (c6806a42, +1 行)
  packages/agent-router/src/ingress-delivery.js                 (36e8674f)
  packages/agent-router/src/parent-rpc-relay.js                 (c80eefbc)
  packages/agent-router/src/process/turn-execution.js           (ac4bcd05)
  packages/production-runtime/src/notification-ingress-runtime.js (5aa34d53)
  packages/demo-server/src/index.js                             (main; R4 messageOrigin 传参)
  packages/demo-server/src/session-seam.js                      (main; R4 sidecar 消费端)

COMPOSED ×2（live 基底 + ASM hunks 逐字组合；禁止含 Fleet/Forum/SchedulerHistory hunks）:
  packages/broker/src/index.js
    = LIVE(6c4a60af) + [import agentSessionMessagingManifests,
       DEFAULT_MANIFESTS spread, auditDenial 透传, localHandlerResolver 第三 provider]
    （排除：forum normal/moderator machinery 全部）
  packages/production-runtime/src/compose.js
    = LIVE(f5c7a8d3) + [import createAgentSessionMessagingAccess/createAgentSessionMessagingAudit,
       agentSessionAudit 构造, auditDenial hook, ctx.provide agentSessionMessagingAccess]
    （排除：shared-codex re-export 5 行、model-overrides "version 3" 注释词——保留 live "version 2"）
    性质：相对 live 纯增量（零删行，已机械验证）。

KEEP LIVE（明确不动）：agent-provisioning/*、model-overrides.js、route-chain.js、transport.js、
  registry.js（LIVE==MAIN）、forum.js、workflow.js、scheduler*、feishu-connector、
  scheduler-router、shared-codex*（不存在于 live）、forum-moderation.js（不存在于 live）、
  error-detail-sanitizer.js（不存在于 live）、harness/*（repo 外）。

demo-server 说明：daemon boot BFS 不可达（r3 同结论），但它是 accepted 套件中 messageOrigin
sidecar 的 in-repo 消费端（integration 套件经 FakeProc→createSessionSeam 验证 R4 消费合同），
且 delta 100% ASM（7+43 行全 messageOrigin）→ 计入 face（与 r3 先例一致）。
组合产物 sha256 前缀见 /Users/yanfenma/workspace/deployment-artifacts/asm-standalone-candidate-v1/face/
（compose_face.py 可复现：NEW/WHOLESALE 从 main@7c7c03a 字节拷贝 + composed 规则）。
```

预期 boot 后 face：19 + 1 = 20 manifests（agent_session_send 追加；forum 仍 7、workflow 仍 7、
scheduler 仍 1、moderator 0）。

## 5. 验证门（Gate → ASM_NO_FLEET_COUPLING_GATE）——2026-09-04 执行结果

- [x] blob 三方矩阵（§2）
- [x] hunk 级分类（§3，逐文件 diff 全量阅读）
- [x] ASM capability 零非 live 依赖（import 面）
- [x] live provider 导出面满足 compose/router import（resolveHarnessRoot/provisionAgentHome/cliBin/
      readFinalAssistantOutput/onTurnReconciled 均在 live）
- [x] node --check 全 17 face 文件（PASS）
- [x] 组合面双向 diff：composed index vs live = 恰 4 ASM hunks（零删行）；
      composed compose vs live = 纯增量（零删行）；composed compose vs cdd3eacf =
      恰 re-export 移除 + "version 3"→"version 2"
- [x] composed sandbox（/private/tmp/asm-candidate-sb-215657）= live + 恰 17 文件面
      （逐文件哈希：11 diff + 4 new + 2 demo-server diff = 17，零其他漂移）
- [x] import census（组合面 runtime 模块执行）：20 manifests，agent_session_send 在场且
      schema 与 accepted 合同逐字段一致（3 参 args / requiredScopes [agent.session.send] /
      15 错误分类）；forum=7、moderator=0、workflow×7、scheduler 在场
- [x] boot rehearsal 对照（生产 node 二进制、--catchup 0、env -i 去代理）：
      live 基线 = "15 http / 3 local"；candidate = "15 http / 4 local"（恰 +1 local）；
      ready + scheduler loop online；/health ok+deliverReady+storeReady；存活 91s ≥ 60s；
      SIGTERM stopped cleanly
- [x] 原实现测试对组合面（生产 node，去代理 env）：
      broker agent-session-messaging 14/14 PASS；
      production-runtime agent-session-messaging 29/29 PASS；
      production-runtime integration（A2A 全链路含 FakeProc→session-seam messageOrigin 消费）
      8/8 PASS（Case C+G/A/B/F/F23/disabled/G/R12）
      沙盒环境注记：integration 需要可写 node_modules（provisionHome 向 repo 农牧 @agent-core
      符号链接；live 树为 root-owned → 初跑 EACCES 属沙盒限制，非组合缺陷；生产 runtime 以
      root 运行真实树，r3 canary 已证 provisioning 农牧可用）
- [x] Fleet non-activation（结构性）：face 无 shared-codex*/provisioning 增量/model-overrides
      增量/route-chain 增量；boot 无任何 Fleet 迁移路径可触发；model-overrides V2 loader
      接受 synthetic v2 文件
- [x] workflow/scheduler 回归（面级）：workflow.js/scheduler* 零字节改动（哈希验证）+
      catalog 在场 + boot scheduler loop online；auth face 1.7.0 未触碰
- [ ] FULL_PREMUTATION_SIMULATION（§18 failure families）——待 artifact 轮
- [ ] ASM_NO_FLEET_COUPLING_GATE 终判（deployment closure 冻结后，全 NO + IMPORT_CLOSURE=PASS）

## 6. CASE 判定

**CASE A = SELECTIVE_COMPOSED_CLOSURE**（判定依据 §3.E：无需新逻辑、无需源码补丁；
组合产物是 deployment composition，ASM 语义 = accepted AGENT_CORE_AGENT_SESSION_MESSAGING_V1）。

Authority 路径（goal §10 case-A 分支）：建立最小新的
`AGENT_SESSION_SEND_STANDALONE_DEPLOYMENT_AUTHORITY`（冻结 §4 face 的精确 blob/组合规则、
preimage、rollback、receipt schema、post-deploy proofs、canary plan、
ASM_NO_FLEET_COUPLING_GATE），走 author → ONE independent review → freeze blocker union →
one repair → ONE re-audit → Owner exact-head acceptance。

SOURCE 处置：`AGENT_SESSION_SEND_SOURCE = REUSED`（goal §25 允许；组合文件为部署组合产物，
不回写 main——回写会使 main 丢失 forum v2 / scheduler-history 世代，违反 §5 禁区）。

## 7. 其他 Goal 冲突普查（WORKTREE_CONFLICT_CENSUS）

- `prep/session-messaging-investigation-v1` / `prep/session-spec-revision-v1` worktrees 属
  production-rnd-parallel-preparation goal——只读记录，未触碰。
- pid 65083（/private/tmp/sched-rehearsal-65074，端口 18900）= 他人 rehearsal 沙盒——只读记录。
- amend/asm-release-closure-boot-v3 / r3a-count 分支：已 MERGED into main（历史输入）。
- 本 Goal worktree：/Users/yanfenma/workspace/project/dsh-agent-core-asm-standalone-v1
  （branch goal/asm-standalone-production-v1 @ 7c7c03a）。
- 无任何活跃 Goal 正在修改本 face 文件。
