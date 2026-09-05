---
spec_id: AGENT_CORE_FLEET_SHARED_CODEX_AUTH_ACTIVATION_V1
status: accepted
date: 2026-09-03
amendment: 2026-09-05 fleet-92 + CLOSURE_REFREEZE_V2 (Owner APPROVE_MINIMAL_ACTIVATION_SPEC_AMENDMENT_DIRECTION; supersedes stale proposed head dc22db8)
accepted_by: mayf3
accepted_date: 2026-09-05
accepted_reviewed_head: b5717e3345ad98b063709f995750f8ddf934437f
acceptance_semantics: FLEET_ROSTER_COUNT=92 exact; AGENTS_CANONICAL_TARGET=92/92; CLOSURE_REFREEZE_V2 accepted; COMPOSE_IN_CLOSURE=NO; v2->v3 = version:3 + canonical credentialFile injection atomically; SAFE_QUOTA_HOP preserved; outcome_unknown=STOP_CHAIN; ONE_LOGICAL_TURN + NO_DUPLICATE_WORK/TOOL/EXTERNAL_DELIVERY REQUIRED; TEN_GATE_BOOTSTRAP REQUIRED; OWNER_REAUTH forbidden for this incident; PRODUCTION_MUTATION_CONCURRENCY=1
type: activation/deployment authority (docs-only this round; one bounded implementation contract inside the already-merged implementation surface)
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
supersedes: []
superseded_by: null
governed_by:
  - AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V2
  - AGENT_PROCESS_LIFECYCLE_HARDENING_V2
  - SCHEDULER_TIMEOUT_OUTCOME_V2
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
external_authorities:
  - repository: Yan-Zero/dsh-codex
    authority_id: DSH_CODEX_RELEASE_V1
    revision: 75d98d5b10bb926d53108e49019668c1bde2a9eb
    relation: interoperates_with
scope:
  - exact selective per-file deployment closure for the fleet shared Codex auth implementation
  - one bounded implementation contract inside the merged shared-codex migration runner (bootstrap candidate class)
  - the one-time LEGACY_CONVERGED_BOOTSTRAP production transaction plan under CTR-SCA-017
  - quiesce/fencing, fresh-production gate, canary, small-batch and 92/92 rollout/rollback plans
owners:
  - repository-maintainers
---

# AGENT_CORE_FLEET_SHARED_CODEX_AUTH_ACTIVATION_V1

> `TASK_NAME = 激活 制备` · `ROUND = AUTHORITY_AUTHORING` · docs only this round。
> 本 Spec 在 `AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V2`（accepted，PR #150）之下提供被 V2 自身
> 要求的 "later controlled activation authority"（V2 §12 / CTR-SCA-014 / CTR-SCA-017）。
> 它不修改 V2 的任何产品语义；`FLEET_PRODUCTION_APPLY = HOLD`（Owner 2026-09-03）期间
> 本授权只做非生产 readiness。生产 apply 在独立 acceptance + shared production lock 之后。
> **AMENDMENT（2026-09-05，Owner APPROVE_MINIMAL_ACTIVATION_SPEC_AMENDMENT_DIRECTION）**：
> (1) 权威 fleet registry 91→**92**（一次性现行生产 reconcile，不是动态 N/N 框架）；
> (2) 部署闭包改绑 **CLOSURE_REFREEZE_V2**（main 513c691，compose EXCLUDED）。除此之外
> 零语义变化；stale proposed head dc22db8 由本 head 取代。母授权 V2 CTR-SCA-017
> 门 3/4/5/10 与 CTR-SCA-014 step 10 的字面 91（含 fixtures）在本一次性事务中按
> Owner ruling 同步适用为 92——V2 accepted 文本不改，本句即 controlled exception。

## 1. Goal

把已合并并已审计的 fleet shared Codex auth 实现（PR #127）部署进生产，用 accepted V2
CTR-SCA-017 的一次性 LEGACY_CONVERGED_BOOTSTRAP 建立 canonical credential 域，随后按
canary → small batch → 92/92 的判别阶梯完成 fleet rollout——全部在 fail-closed、可精确回滚、
不触碰任何非本 Goal 生产面的约束下进行。

```text
ACTIVATION_END_STATE =
  canonical store live at /Users/authsvc/.agent-core/shared-credentials/openai-codex/.openai-codex-auth.json
  AGENTS_CANONICAL = 92/92
  PER_HOME_RUNTIME_OAUTH_USE = 0
  closure files = CLOSURE_REFREEZE_V2 exact audited blobs (main 513c691; compose EXCLUDED)
  MEMORY_FIX_PRESERVED = PASS
PRODUCTION_APPLY_REMAINS_SEPARATELY_GATED = YES
```

## 2. Scope and non-goals

### 2.1 In scope

- §4 冻结的 selective per-file deployment closure（CLOSURE_REFREEZE_V2：8 blob 全部取自 main `513c691`，compose EXCLUDED，BLOBS.manifest 逐 oid 冻结）；
- CTR-ACT-005 的 bounded runner bootstrap 分支（≈10 行 + 测试；其余 runner 行为逐字节不变）；
- 一次性 CTR-SCA-017 十门事务的 gate script 与 transaction bindings 设计；
- `agent-model-overrides.json` v2→v3 语义不变升级 + `credentialFile` 注入的原子顺序；
- quiesce/fence、fresh-production gate、canonical canaries（CEO/HR/Podcast/Shopping）、
  small batch（5-agent 判别集）、92/92 rollout 与各阶段 rollback 计划。

### 2.2 Out of scope

- GLM/Luna route 语义变更与 fleet route mutation（PHASE 2 另有判别与授权路径；本 Spec 只
  迁移 credential carrier，CTR-SCA-005/DEC-SCA-005 不变）；
- memory.js（`MEMORY_FIX_ROLE = PRODUCTION_PRESERVATION_GATE_ONLY`；闭包结构上不含它）；
- 其他 Goal 的任何未部署面（session-messaging `agent_session_send`、scheduler run-history、
  WDA、Shared Skill Root 等——R1 census 已证 main compose.js 含其变更，禁入闭包）；
- OWNER reauth / production OAuth（V2 对本 incident 明令禁止）；
- 92 份 per-home OAuth 文件的修改或删除（保持只读 forensic evidence）；
- dsh-codex 版本升级（PIN 冻结 0.2.3-line @ `75d98d5b`）。

## 3. Authority and dependencies

```text
PARENT = AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V2 (accepted 2026-09-03, PR #150, main 40d0924)
IMPLEMENTATION_SOURCE = PR #127 merge tree 1fdf8c3（42/42 focused、1191 full suite、10/20/50
  bursts、crash windows、91-store reauth 演练、structure gate PASS——已审计实现面）
R1_CENSUS = deployment-artifacts/model-fleet-glm-luna-production-goal-state/reports/
  R1-DEPLOYMENT-CLOSURE-CENSUS.md（installed vs main vs PR#127 逐文件机械判定）
FRESH_RECONCILIATION = docs/evidence/glm-luna-fallback-reconciliation-v1-20260905/
  （GLM_LUNA_FALLBACK_PRODUCTION_V1, 2026-09-05：CENSUS + AUDIT_PR121_R1 + CLOSURE_REFREEZE_V2；
  PR #121 merged @ main 513c691；Owner APPROVE_MINIMAL_ACTIVATION_SPEC_AMENDMENT_DIRECTION）
PRODUCTION_QUEUE = GLOBAL_PRODUCTION_MUTATION_CONCURRENCY = 1；不得与 WDA Agent Core、
  Shared Skill Root、agent_session_send、Scheduler/Traceability 或任何其他 credential/route/
  runtime mutation 并发。
```

proposal 阶段本 Spec 不可执行任何生产步骤；acceptance transaction 由 Owner 与 production
lock 同时授出（唯一 activation decision）。

## 4. Current State（fresh 2026-09-03；reconciled 2026-09-05；activation 前 Gate 必须 fresh 重读）

```text
INSTALLED_APP = /usr/local/libexec/agent-core/app（Luna-only breakglass 基线）
CLOSURE_PREIMAGES（2026-09-05 fresh 重证）= model-overrides ea44819a / provisioning index
  b1d7b94d / route-chain 010df799 / compose e539ef45；shared-codex.js、plugin-artifact.js、
  migration-cli/executable/migration ABSENT（ingress-delivery 36e8674f 与 agent-router index
  c6806a42 同 main）
CONFIG = agent-model-overrides.json v2，92/92 primary=luna fallbacks=[]，catalog=[luna]
CANONICAL_DOMAIN = ABSENT；PER_HOME_OAUTH = 92（roster 双射）；BYTE_EQUALITY_92 = YES（2026-09-03
  readiness evidence，非 production-time truth——activation Gate 必须 fresh 重证）
FLEET_ROSTER = 92（authoritative registry = /Users/authsvc/.agent-core/agents.json，禁用 homes/
  目录列表充数）。第 92 成员 = agt_huanhuan-thought-agent（2026-09-03 v6 fleet-join 事务注册：
  agents.json 91→92 defs、overrides 克隆 luna 链、home + OAuth byte-identical；E2E 已实质通过）。
  其 identity closure、92/92 双射与 BYTE_EQUALITY_92 由 activation Gate fresh 机械证明；
  任何未解析身份 / 非双射 / 91+unknown / 91+disabled / 91+orphan ⇒ fail closed。
MEMORY_JS = 99d59bde…（known-good production blob；gate-only）
RUNTIME = launchd ai.agent-core.runtime，health PASS（4001/8790/8989；2026-09-05 pid 72082）
DRIFT_LEDGER_0905 = overrides 0600 uid502 EACCES（fail-closed，mtime 2026-09-03 未再漂移）；
  compose installed = e539ef45（陈旧 staging blob，不在 main 历史）；migration-executable main
  演进 4444375d→090f5471（07102da 解耦重构）——均见 CLOSURE_REFREEZE_V2 drift ledger D4/D5
```

## 5. Contracts

### CTR-ACT-001 — Exact deployment closure

生产代码闭包 = CLOSURE_REFREEZE_V2 冻结的 8 blob，全部取 main `513c691`（逐 blob git-oid 在
`CANDIDATE_CONTENT_V2/BLOBS.manifest` 冻结，byte-identity 8/8 机械验证）：route-chain e2f69dac /
model-overrides 380f5264 / provisioning index 34479d81 + shared-codex 963d03be + plugin-artifact
89394ab3 / migration-cli a8620ea9 + migration-executable 090f5471 + shared-codex-migration 70e74439。
**compose.js EXCLUDED**（AMEND-2）：migration 路径已与 compose 解耦（090f5471 import
shared-codex-migration 70e74439，不再 import compose），installed compose e539ef45 的唯一
provisioning import（resolveHarnessRoot）与唯一 overrides 调用（loadAgentModelOverrides(file,
registeredAgentIds)）与 v3 blob 签名兼容——装 main compose 反而拖入 scheduler-history 闭包并
突变 72082 runtime 面。禁止装入任何未冻结变体；`package.json`、tests、broker、memory.js、
任何 profile 业务文件不在闭包内（memory gate CTR-ACT-002 不变）。

### CTR-ACT-002 — Memory-free closure proof

apply 时机械证明：`MEMORY_JS_BEFORE = known-good live blob`（fresh sha，expect 99d59bde…）；
`DEPLOYMENT_CLOSURE_TOUCHES_MEMORY_JS = NO`（manifest 路径集合不含该路径）；transaction 后
`MEMORY_JS_AFTER = MEMORY_JS_BEFORE`；`MEMORY_FIX_PRESERVED = PASS`。任一不成立 ⇒ fail closed。

### CTR-ACT-003 — v2/v3 atomic window

installed loader 仅收 v2；闭包 loader 仅收 v3。代码安装与 config `version: 3` 升级必须在
同一 quiesce 窗口内完成；重启暴露的任何中间态都 fail-loud（loader throw），不产生 admission。
v2→v3 升级（fresh 修正）：v3 loader 对 openai-codex subscription route 强制携带
`credentialFile`（=CANONICAL 常量），v2 白名单则禁止该键——故升级 = `version:3` +
credentialFile 注入**一步原子**完成（transaction migrator script，v2 白名单 fail-closed 校验后
same-dir rename，overrides 语义零变化；canonical 文件此时尚未建立是合法中间态——loader 只校验
config 字段不 stat 文件）。runner `switchFleetConfig` 在 canonical commit 与 Model A 探针之后
幂等再确认注入。preimage/rollback 同时覆盖 config 文件。sandbox 正/负验证：
tools/v2_to_v3_migrator.mjs + sandbox_migration_simulator.mjs（SIM_ALL_OK 16/16）。

### CTR-ACT-004 — Quiesce and durable fence（对 LIVE Luna-enabled 基线）

`LUNA_DISPATCH_QUIESCED` / `REFRESH_WRITERS_QUIESCED` 必须对当前 92/92 Luna-strict LIVE 基线
建立（比 2026-09-01 incident 时点更强），并持久化到
`/Users/authsvc/.agent-core/control/shared-codex-migration-fence.json`（runner 已冻结该路径）。
fence 之前任何 per-home OAuth 写/refresh 即 fail closed。

### CTR-ACT-005 — Bootstrap candidate class（bounded implementation）

`executeFleetSharedCodexMigration` 增加：config.candidateClass ===
`BOOTSTRAP_FROM_CONVERGED_SNAPSHOT` 时，要求 `bootstrapGateReceiptPath`（CTR-SCA-017 十门
全 PASS 的 gate script receipt，含 92 registry 路径绑定与 inode/mtime/content 双 fence 结果）
与 `bootstrapStore`（等值集内 registry member）；selection 固定为
`{legacyCredentialReuseAllowed:true, authoritativeStore:bootstrapStore, bootstrap:true,
canonicalReauthRequired:false}`；bootstrap 模式下 `validateConfig` 豁免
`ownerReauthCanonical`（不要求提供），且 config 若提供该键 ⇒ fail closed（Owner 对本
incident 禁 reauth/OAuth）。非 bootstrap 模式行为逐字节不变；V1 provenance 与
fail-closed reauth 契约（CTR-SCA-008/009）保留。

### CTR-ACT-006 — Ten-gate receipt is the only credential-acquisition authority

gate script（transaction 脚本，非 product code）机械产出十门 receipt：roster=92（authoritative
registry，禁用 homes/ 目录列表充数）、92/92 byte equality、shape/account 一致、canonical intent
absent、双 fence（inode/mtime/size/content 前+后）、fence 后零已知 refresh 事件、≥1 liveness
member。任何 FAIL ⇒ canonical commit = 0，`OPERATOR_BLOCKED`，Luna 维持 quiesce 直至 Owner。

### CTR-ACT-007 — Copy exactly once, then prove Model A

canonical 目录 authsvc 0700 + 精确 ACL；copy-once（temp 0600 + same-dir rename）；
`CANONICAL_COMMIT_COUNT = 1`；`validateCanonical` + 四探针（uid502 read / uid502 atomic
replace / authsvc control-plane / third-uid denied）全 PASS 才允许 config 注入。post-copy
drift ⇒ 不激活、保留证据、bounded rollback 仅删未激活副本（CTR-SCA-017 原文语义）。

### CTR-ACT-008 — Artifact pin and profile stamp

`installPinnedArtifact` 安装 dsh-codex `0.2.3` @ `75d98d5b`、sha256 `2d29f95f…` 到 92 profile
并写 receipt（含 sourceStamp）；post-install receipt 必须与 PIN 精确相等（runner 已实现）。
禁止 opportunistic upgrade。

### CTR-ACT-009 — Zero per-home runtime use

`verifyZeroPerHomeRuntimeOpens` 通过（CTR-SCA-005）：92 份 per-home 文件此后 read-only
forensic；任何 runtime open/refresh/fallback ⇒ fail closed 并按共享 auth 故障面处置。

### CTR-ACT-010 — Canary → small batch → 92/92 判别阶梯

禁止 0/92 → 92/92。顺序与判定字段：
1. **canonical canaries**（Luna canonical authentication + 真实 turn）：CEO → HR → Podcast →
   Shopping，PASS 才继续；任一 FAIL ⇒ 停止扩面、保留 canonical、按 AUTH/RUNTIME/MODEL 分类。
2. **small batch**（fresh verify 可运行性后取 5：podcast-producer / hr / efficiency /
   shopping-list / cto）：`GLM_NORMAL_SUCCESS / LUNA_AUTH / QUOTA_FALLBACK_SEMANTICS /
   OUTCOME_UNKNOWN_STOP / NO_REFRESH_TOKEN_REUSED / AGENT_PROCESS_HEALTH` 全 PASS 才进入
   fleet 批次（GLM route 面按其自身授权轮执行）。
3. **92/92**：批次展开 + `NEW_AGENT_DEFAULT` 与 provisioning 默认检查（防半迁移态）。
每阶段有独立 preimage/rollback；阶段 rollback 只回本阶段拥有面，canonical credential 永不
回退（runner rollback 语义 + CTR-ACT-009）。

### CTR-ACT-011 — Fresh-production Gate

activation 前 gate script fresh-read 八项：`FLEET_ROSTER_COUNT=92`、`PER_HOME_OAUTH_COUNT=92`、
`ROSTER_BIJECTION=PASS`、`BYTE_EQUALITY_92=YES`、`CANONICAL_CREDENTIAL_PRESTATE=expected`、
`CURRENT_ROUTE_BASELINE=fresh-read`、`RUNTIME_HEALTH=PASS`、`MEMORY_FIX_PRESERVED=PASS`。
任何漂移 ⇒ fail closed，只调查具体 drift，不重启 architecture lifecycle。

### CTR-ACT-012 — Secret boundary

事务/证据/receipt 只允许 provider、model、路径、metadata、generationId、判定字段；禁止
token/hash/digest/内容（含 p1-originals：不 push、不复制入 artifact、非 PHASE 2 必要不读取）。

## 6. Acceptance（本 Spec）

- ACC-ACT-001：closure 8 blob 与 manifest 逐哈希一致；main 污染面零进入（对照 R1 census）。
- ACC-ACT-002：bootstrap 分支单测矩阵（accept/reject；bootstrap 模式下 reauth binding 拒绝；
  非 bootstrap 模式回归 0 diff）。
- ACC-ACT-003：gate script 对 fixture 集合（92 等值 / 91+1 / fence 漂移 / pending intent /
  liveness 缺失）产出且仅产出预期 receipt，fail-closed 路径 commit=0。
- ACC-ACT-004：v2→v3 升级器对现生产 config 快照（脱敏结构）产出语义不变 v3；注入后
  loader 解析通过且 route order 不变。
- ACC-ACT-005：dry-run 全事务（root=隔离沙盒，non-production binding 集）端到端 PASS +
  rollback 演练（runtime-only 回滚，canonical 保留）。
- ACC-ACT-006：secret 扫描（artifact 全成员 + receipt + plans）零命中。

## 7. Rollback

代码面：per-file preimage 恢复（8 文件各自等价回滚）+ config preimage；仅在 quiesce 后执行，
且不得恢复任何 per-home runtime 使用（CTR-SCA-014 rollback 条款不变）。canonical credential
与 fence/intent 证据永不被 rollback 删除或覆盖。rollback 后重新证明 RUNTIME_HEALTH=PASS、
PRODUCTION_USABLE=YES，继续原 Goal（deployment failure 不是新 Goal）。

## 8. Open questions

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
READY_FOR_INDEPENDENT_REVIEW = YES
ACCEPTANCE_FORM = 唯一 activation decision（与 shared production lock 同时授出）
```

## 9. Authoring output

```text
TASK_NAME = 激活 制备
ROUND = AUTHORITY_AUTHORING → ACCEPTED（Owner exact-head acceptance 2026-09-05 @ b5717e3…）
STATUS = accepted
IMPLEMENTATION_AUTHORITY = contracts
PRODUCTION_APPLY_AUTHORITY = none
FLEET_PRODUCTION_APPLY = HOLD
CLOSURE_FILES = 8 blob（main 513c691；compose EXCLUDED；CLOSURE_REFREEZE_V2）
BOOTSTRAP_IMPL_DELTA = bounded（CTR-ACT-005）
MEMORY_TOUCH = NONE（结构不可能）
PRODUCT_CODE_CHANGE = bounded runner delta only（本轮 docs，未执行）
PRODUCTION_CHANGE = NONE
NEXT_TASK = 激活 审计（ONE independent review）
```
