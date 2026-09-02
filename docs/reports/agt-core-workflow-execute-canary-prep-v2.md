# AGT_CORE_WORKFLOW_EXECUTE_CANARY_PREP_V2 (TASK_NAME = 验收 执行)

- date: 2026-08-31
- type: canary fixture preparation (provisioning runner + offline verification + read-only production posture audit)
- production change this round: **NONE** (the single fixture-only write path is packaged as an owner sudo command; see §1)

## 0. 结论（TL;DR）

```
CANARY_INSTANCE_PROVISIONED = NO (RUNNER READY; owner sudo command pending — credential is authsvc-private)
CANARY_CONFIG   = NOT_GENERATED (requires the real instance facts the owner command produces)
CANARY_CONFIG_SHA256 = UNAVAILABLE (same reason)
CANARY_WRITES   = 0            # zero workflow_transition submissions, zero reloads, zero allowlist changes
PRODUCTION_CHANGE = NONE       # this round; the owner command's exact scope = CANARY_FIXTURE_ONLY
READY_FOR_COMBINED_DEPLOY_REVIEW = NO   # two blockers in/around the sealed combined-deploy-v2 canary (§3)
```

本轮产出可直接执行的 fixture-only provisioning runner（离线全路径验证通过），
并对生产做了全只读的姿态审计。审计发现**两个会导致合署部署 canary 必然失败
的 blocker**（与 fixture 无关，分别是 sealed runner 内嵌 canary 程序的
detail 结果形状错配、以及 canary 身份对 workflow-todo-dogfood 无
DOMAIN_OWNER 导致分页 403）——详见 §3。二者修复都不在本轮授权范围内。

## 1. 交付物：provisioning runner（owner 单命令）

- **RUNNER** = `/tmp/run-agent-core-workflow-canary-prep-v2.sh`
- **RUNNER_SHA256** = `f7d39de934088e3d70bd3f710a653f9feef55b011bc68a9e271e7543a92b7438`
  （sealed byte-identical copy: `docs/evidence/workflow-execute-canary-prep-v2-20260831/`）
- Owner command:
  `sudo bash /tmp/run-agent-core-workflow-canary-prep-v2.sh`
  （interactive phrase: `APPLY WORKFLOW_CANARY_PREP_V2`）
- 为什么需要 owner：冻结 canary 身份的 clientSecret 只存在于
  `/usr/local/libexec/agent-core/config/agent-credentials.json`（0600, uid 505
  authsvc），本会话（yanfenma，无 sudo）无法读取；伪造/绕过身份被
  identity-auth 调查（A_CAN_SPOOF_B=NO 架构）禁止。runner 内 secret 只存在于
  root 进程的 shell 变量，永不回显、永不落盘。
- runner 逐步：G0 前置（root/文件/健康/**allowlist 必须缺席**/写闸门已开核
  实）→ W1 凭据（断言 agentId/clientId）→ W2 token + claims 断言（sub ==
  d5b3aeb2…、client_id、scopes 含 workflow.execute）→ W3 创建**恰 1 个**
  canary fixture（`externalReference=workflow_execute_canary_v1`，entry 节点
  WORKFLOW_CREATOR ⇒ current assignee 即冻结 canary principal）→ W3b 创建
  恰 1 个 control fixture（见 §2）→ W4 双实例基线只读冻结（visibility=full、
  assignee、node=open、非终态、advance-to-completed 的 transition_id /
  submission_schema / executable_for_actor，并与 DB 冻结值
  `7493f6ca-6cf0-4ebf-95f8-f565f2b231ec` 交叉核对）→ W4b 分页姿态探针
  （只读，见 §3 BLOCKER-2）→ W5 只读 SQL 回执/事件基线 + 零 transition 断言
  → W6 生成 `/tmp/agent-core-workflow-canary-v1.json`（值全部来自服务端响应）
  → W7 用 **VERBATIM** sealed-runner validator（byte-diff 证明 4518/4518）
  自校验，要求 CANARY_PREREQS_READY=YES 并打印 SHA256 → W8 边界复核
  （allowlist 仍缺席 / 0 reload / 0 transition）。
- 幂等：marker + `external_reference` 双通道 adopt；重跑零新实例、config
  字节一致（mock 实测同 sha256）。

## 2. fixture 设计要点（含 control instance 的必要性）

- domain `workflow-todo-dogfood` = `10000000-0000-0000-0000-000000000100`；
  definition `personal_quick_item_v1` = `95aacea2-5599-4e74-b576-e2eeb61e27a0`
  （v1 PUBLISHED，仅存在于该域）；图：open(DRAFT, WORKFLOW_CREATOR) →
  completed/cancelled(TERMINAL)；出口 advance-to-completed（ADVANCE，schema
  required=["summary"], additionalProperties=false）与 cancel。
- **恰 1 个 canary instance**（dispatch 要求）；另 provision 恰 1 个
  **control fixture**（`externalReference=workflow_execute_canary_v1_control`，
  永不 transition）。必要性（全部只读实证）：instance-detail 可见性仅
  owner / current-assignee / creator-draft / historical-participant
  （`query_visibility.rs classify_visibility`），而 canary principal 一生
  created=0、assigned=0 ⇒ **不存在任何它可读的既有实例**；真实业务实例又禁止
  改动。deploy canary 程序要求 control 同域、前后 detail 字节相等 ⇒ 只能由
  canary 身份自建。两个 fixture 均为显式 disposable 标记的非业务行。
- submission payload（冻结进 config）：`{"summary": "workflow_execute_canary_v1:
  combined deploy canary transition (disposable fixture)"}`（满足
  additionalProperties=false）。
- config pagination 字段：`paginationLimit=2, expectedMinimumPages=2,
  expectedMinimumInstances=10`（域内 192 实例 + 2 fixture，append-only 只增不减，
  floor 保守成立）。

## 3. BLOCKERS（合署部署 canary 必然失败的两个原因；修复均不在本轮授权内）

### BLOCKER-1 — sealed runner 内嵌 canary 程序读错 detail 结果形状（致命，独立于 fixture）

`workflow_instance_detail` 的 broker 结果是**原样 HTTP body**
`{"visibility":"full","detail":{…}}`（TARGET `2392a41` mapping.js `return { ok:
true, result: raw }`；transport.js 成功路径 `return await res.json()`；manifest
`result:{type:'json'}`；svc-workflow `dto.rs detail_response`）。但 canary 程序
读的是**顶层** `before.title` / `before.workflow_state_version` /
`before.current_assignee_principal_id` / `before.outgoing_transitions` /
`before.current_node_visit` —— 全部 undefined（真实位置：
`detail.current_context.payload.title`、`detail.instance.workflow_state_version`、
`detail.current_visit.assignee_principal_id`、`detail.outgoing_transitions`、
`detail.current_node_visit_id`）⇒ 即使 BLOCKER-2 解决，首个 `assert.equal(
before.title, …)` 即失败 ⇒ durable rollback。该程序从未被 live 执行过（v1
runner 被阻塞未跑、authoring 轮只做 smoke 模拟且明确 "the smoke sim never
constructed a gateway"）。修复 = 修订 sealed runner 的 canary 程序（Owner
决定；实现 PR 亦受 GOVERNING_SPEC_UNMODIFIED 约束走独立轮）。

### BLOCKER-2 — canary 身份对 workflow-todo-dogfood 无 DOMAIN_OWNER ⇒ 分页 403

deploy canary 第一步 `paginateDomain()` 以 `cfg.agentId`（=
agt_build-in-public-agent）分页 `cfg.domainId`（= workflow-todo-dogfood）；
服务端（deployed f0c74ee = main）`list_domain_instances` 只认 enabled
DOMAIN_OWNER 绑定（`query_visibility.rs:34-50`）。角色事实（只读）：
canary principal 在该域是 DOMAIN_MEMBER（enabled），唯一 enabled owner 是
agt_efficiency-agent（b21ddb23）；它自己拥有的是 build-in-public-dogfood
（f9b5682c）。⇒ 403 `workflow_instance_not_found_or_not_visible` ⇒ canary
fail-closed ⇒ durable rollback。可选出路（Owner 裁决，本轮均不执行）：
(a) 经正式 provisioning surface 为 canary principal 增加 workflow-todo-dogfood
DOMAIN_OWNER 绑定（授权状态变更，需独立授权）；(b) 修订 runner（分页改由域
owner 身份执行或去掉域遍历步）；(c) fixture 迁至 build-in-public-dogfood（但
personal_quick_item_v1 只发布在 workflow-todo-dogfood，需换 definition，偏离
dispatch 冻结参数）。注：SPEC 层 CTR-009 的 A/B/C/D 验收流**不含**分页/控制
实例/replay——那两步是 runner 作者的扩展；fixture 本身对 SPEC 级 canary 完全
可用。

## 4. 验证（离线，零生产写）

- `bash -n` PASS；静态扫描：全文 0 处 `/transitions` 端点、0 处 launchctl；
  AUTH_V1_CANARY_ALLOWED 仅出现在两个「拒绝执行」守卫（G0/W8 只读 grep）。
- 验证器逐字性：内嵌 W7 python 与 sealed combined runner（18c1fdc6…）的
  validator 逐字节相等（4518/4518，机械 diff）。
- mock e2e（本地 mock auth/svc-workflow/凭据库/psql stub + sed 变换副本；
  sealed runner 本体未执行）：fresh 全绿（G0→W8、2 实例、
  CANARY_PREREQS_READY=YES、探针 403/200 双记录）；rerun 幂等（SKIP create、
  config 字节一致同 sha）；mock .env 未被写入。
- 负路径：错 phrase rc=1 / allowlist 已存在 rc=1（拒绝执行）/ 非 root rc=1。

## 5. 边界

- 本轮生产访问**全只读**：auth-service principal/角色查询、svc-workflow DB
  SELECT（read-only 事务）、.env 只读 grep、/healthz。零 SQL 写、零 allowlist
  设置、零 reload、零 transition、零 Broker deploy、真实业务实例零接触。
- 既有 WIP 与并行产物不动：`/tmp/run-canary-prereq-v1.sh`（并行会话的 v1
  预备 runner，含本轮明令禁止的 allowlist+reload 步骤，确认**从未执行**：
  canary principal 实例数 0、.env 无 allowlist 行、无 marker）保持原样。
- 本轮新增文件仅 evidence 目录 + 本报告（按显式路径暂存）；sealed runner
  另存于 /tmp 固定路径供 owner 执行。

## 6. 最终字段

```
TASK_NAME = 验收 执行
CANARY_INSTANCE_PROVISIONED = NO           # owner sudo command pending（runner ready, offline-proved）
CANARY_CONFIG = NOT_GENERATED              # /tmp/agent-core-workflow-canary-v1.json 由 owner 命令生成
CANARY_CONFIG_SHA256 = UNAVAILABLE
CANARY_WRITES = 0
PRODUCTION_CHANGE = NONE                   # owner 命令的既定范围 = CANARY_FIXTURE_ONLY（2 个 disposable fixture）
READY_FOR_COMBINED_DEPLOY_REVIEW = NO      # BLOCKER-1（detail 形状）+ BLOCKER-2（DOMAIN_OWNER 分页 403）
OWNER_COMMAND = sudo bash /tmp/run-agent-core-workflow-canary-prep-v2.sh   # phrase: APPLY WORKFLOW_CANARY_PREP_V2
RUNNER_SHA256 = f7d39de934088e3d70bd3f710a653f9feef55b011bc68a9e271e7543a92b7438
NEXT = Owner 决策：(1) 是否执行 fixture provisioning；(2) BLOCKER-1/2 的处置路线（provisioning-surface 授 role / 修订 runner / 迁域）
```
