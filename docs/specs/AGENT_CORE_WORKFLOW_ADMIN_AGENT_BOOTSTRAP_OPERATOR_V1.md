---
spec_id: AGENT_CORE_WORKFLOW_ADMIN_AGENT_BOOTSTRAP_OPERATOR_V1
status: proposed
date: 2026-08-29
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
scope:
  - mayf3/dsh-agent-core
  - >-
    single-use local uid502→uid505 execution channel for exactly one accepted
    operation (workflow_admin_agent_bootstrap_v1) with exactly one subject
    (agt_workflow-admin-agent) — a dedicated local-only Unix-domain operator
    endpoint composed in-process into the existing authsvc (uid 505) trusted
    production runtime; docs-only authoring round (this round writes no code,
    no runtime state, no secret)
governed_by:
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
depends_on:
  - AGENT_CORE_WORKFLOW_ADMIN_AGENT_BOOTSTRAP_V1
  - AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1
external_authorities:
  - repository: mayf3/auth-service
    authority_id: MINIMAL_AUTH_FOUNDATION_V2
    revision: b88512881135dd8a0d382e8ca76650059df33725
    relation: depends_on
  - repository: mayf3/auth-service
    authority_id: AUTH_SERVICE_OWNERLESS_AGENT_PRINCIPAL_V1
    revision: b88512881135dd8a0d382e8ca76650059df33725
    relation: depends_on
  - repository: mayf3/auth-service
    authority_id: AUTH_SERVICE_AGENTCORE_IDENTITY_RESOLUTION_V1
    revision: b88512881135dd8a0d382e8ca76650059df33725
    relation: depends_on
supersedes: []
superseded_by: null
owners:
  - mayf3
type: dedicated-bootstrap-operator-channel-spec
references:
  - >-
    docs/specs/AGENT_CORE_WORKFLOW_ADMIN_AGENT_BOOTSTRAP_V1.md (accepted; on
    authoring base df3b299 as blob a190c4496a889432ace9e874e0dc50ca8005ca9a;
    accepted head bb0db2855470650da531431c35c4b0e2a7ae1157; merge
    91cab8473c5042e833b559ea9c4f35723d147739; its CTR-WA-001..012, execution
    order T1–T9, attempt ledger, final receipt, outcome_unknown decision trees
    and SAFE_DISABLED_STAGED_IDENTITY terminal state are INHERITED and NOT
    modified by this Spec)
  - >-
    docs/specs/AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1.md (accepted; Part
    C.4 deterministic external_refs, Part D/D.5 verification mint
    classification, D.7 Phase A order, E.4(c) bootstrap provisioner
    prerequisite, Part G store write contract, Part H secret handoff are
    INHERITED and NOT modified by this Spec)
  - >-
    docs/reports/trusted-control-plane-deployment-hardening-v1.md (accepted
    production topology evidence: trusted install /usr/local/libexec/agent-core,
    authsvc uid 505 control plane, config 0700, trusted Node, uid 502
    read-only over all trusted code/config)
  - >-
    docs/reports/trusted-credential-505-final-acceptance-v2.md (uid 505 / uid
    502 privilege boundary acceptance precedent: 505-private credential zone,
    uid 502 store read DENIED)
---

# AGENT_CORE_WORKFLOW_ADMIN_AGENT_BOOTSTRAP_OPERATOR_V1 — 单 Agent bootstrap 的 uid502→uid505 本地执行通道权威

> **PROPOSED / DOCS-ONLY / SPEC ONLY — 本轮不实现 operator、不部署、不执行任何运行时写入。**
>
> 本 Spec 是已 accepted 并进入 main 的
> `AGENT_CORE_WORKFLOW_ADMIN_AGENT_BOOTSTRAP_V1`（下称 **Bootstrap Spec**）的
> **child authority**：为它的单次「身份 执行」round 建立一条**最小、exact-subject、
> secret-safe** 的 uid502→uid505 本地执行通道。生产拓扑下（OBS-OP-003/OBS-OP-004），
> Bootstrap Spec 要求的全部运行时写入目标——生产 `agents.json`（canonical Agent
> Definition writer）、trusted credential store（Part G）、S1/S2 与 verification
> mint——都在 authsvc（uid 505）私有边界内，uid 502（`yanfenma`，本机
> authorized local requester）对它们零写权限。因此执行通道必须在 uid 505 内部
> 承载执行，而 uid 502 只能以**一个固定的、已 accepted 的 exact operation** 发起。
>
> 本通道最终只允许完成一件事：**`agt_workflow-admin-agent` 这一名 Agent 的一次
> Bootstrap**（operation = `workflow_admin_agent_bootstrap_v1`）。它不是通用
> operator，不是 authsvc shell，不是通用文件 writer，不提供任意 method /
> command / path / Agent ID / Principal UUID / Client ID / secret / Token /
> Authorization / Grant / Binding / Root / activation 参数的任何入口。
>
> 治理权威形式冻结（继承 Bootstrap Spec DEC-WA-008 / CTR-WA-008 的同一形式）：
>
> ```text
> DOCS_MERGE_DEPLOYS_OPERATOR = NO
> ACCEPTED_AND_MERGED_SPEC_AUTHORIZES_IMPLEMENTATION = YES
> SEPARATE_OPERATOR_IMPLEMENTATION_TASK_REQUIRED = YES
> SEPARATE_OPERATOR_DEPLOYMENT_AND_AUDIT_REQUIRED = YES
> BOOTSTRAP_RUNTIME_WRITE_AUTHORIZED_BY_THIS_AUTHORING_ROUND = NO
> ```
>
> 即：本 Spec accepted + 合入 main 后，成为 operator 代码实现（独立任务）、
> operator 部署与 pinning（独立任务 + 独立审计）、以及**经由该通道执行的
> Bootstrap Spec 单次执行 round**（独立任务）的合法实现权威；文档合并本身不
> 部署、不启用、不执行任何东西。本轮（authoring round）只交付本文件与
> `docs/specs/README.md` 的 index 行，不创建 attempt ledger、不创建
> Agent/Principal/Client/secret、不调用 auth-service resolution/S1/S2、不创建
> Workspace/Home/Binding/Grant/Root、不执行 activation、不修改
> owner/group/mode/ACL/sudoers、不使用 root/sudo/launchctl、不输出或读取任何
> secret、不 accepted、不 Ready、不 merge。

---

## 0. Owner 冻结决策（frozen — 实现轮不得更改、不得重新决定）

以下决策由 Owner 派发指令冻结，效力高于本 Spec 任何实现轮的裁量：

```text
CANONICAL_RUNTIME_USER =
authsvc

CANONICAL_RUNTIME_UID =
505

AUTHORIZED_LOCAL_REQUESTER_USER =
yanfenma

AUTHORIZED_LOCAL_REQUESTER_UID =
502

EXACT_AGENT_ID =
agt_workflow-admin-agent

EXACT_DISPLAY_NAME =
工作流总管

EXACT_PRINCIPAL_EXTERNAL_REF =
agentcore:v1:principal:agt_workflow-admin-agent

EXACT_CLIENT_EXTERNAL_REF =
agentcore:v1:client:agt_workflow-admin-agent

EXACT_OPERATION =
workflow_admin_agent_bootstrap_v1

GENERAL_OPERATOR_CAPABILITY =
FORBIDDEN

ARBITRARY_AGENT_ID =
FORBIDDEN

SHELL_EXECUTION =
FORBIDDEN

SECRET_CROSSES_UID_BOUNDARY =
NO

AUTH_SERVICE_NEW_PROVISIONER_CHILD_REQUIRED =
NO

ROLLBACK_TARGET =
SAFE_DISABLED_STAGED_IDENTITY

OPERATOR_CAPABILITY_SCOPE =
single Spec + single exact subject

OPERATOR_DEFAULT_STATE =
disabled / unavailable until its own deployment gate passes

OPERATOR_AFTER_TERMINAL_SUCCESS =
reject all new bootstrap attempts
```

---

## 1. Goal

为 Bootstrap Spec 的单次「身份 执行」round 建立**唯一合法的 uid502→uid505 发起
通道**权威：一个 dedicated local-only Unix-domain operator endpoint，运行在现有
authsvc（uid 505）trusted production runtime 进程内，只接受本机 uid 502 的**一个
固定 operation**（`workflow_admin_agent_bootstrap_v1`），在 uid 505 边界内完整执行
Bootstrap Spec 冻结的 T4–T8（disabled Agent Definition 写入 → S1/S2 → secret 内存
→ Part G store 原子写 → 父 D.5 verification mint），只返回非秘密闭合结果。

```text
AUTHORITY_ID          = AGENT_CORE_WORKFLOW_ADMIN_AGENT_BOOTSTRAP_OPERATOR_V1
AUTHORITY_KIND        = governing_spec (implementation kind, docs-only delivery)
SUBJECT               = exactly one bootstrap of agt_workflow-admin-agent via
                       exactly one operation workflow_admin_agent_bootstrap_v1
THIS_ROUND            = SPEC_ONLY (single new file + README index row; no execution)
ACTIVATION            = independent review + Owner acceptance + merge to main
POST_MERGE_AUTHORITY  = bounded implementation authority (implementation_authority: contracts)
BOOTSTRAP_RUNTIME_WRITE_PERFORMED_IN_THIS_ROUND = NO
```

## 2. Scope and non-goals

### 2.1 In scope（仅在各自独立任务的门全部满足后）

- 定义 operator 的 transport 与 caller 边界：exact socket path、uid 505 属主、
  kernel-verified peer credentials、仅本机、无网络监听（CTR-OP-002）。
- 定义 request 的非秘密闭合字段集合与 fail-closed 校验（CTR-OP-001）。
- 定义 operator 在 uid 505 内部的完整事务顺序（含 canonical writers、S1/S2、
  Part G store 写、父 D.5 verification、uid 505 私有 transaction state、非秘密
  response）（CTR-OP-007 / CTR-OP-009）。
- 定义 bootstrap provisioner（credential spec E.4(c)）的 fresh revalidation 义务
  与失败 STOP 语义（CTR-OP-006）。
- 定义 one-shot、幂等、防重放与崩溃恢复语义（CTR-OP-010）。
- 定义失败与安全终态（继承 `SAFE_DISABLED_STAGED_IDENTITY`）（CTR-OP-011）。
- 定义通道生命周期（默认 disabled、terminal success 后永久拒绝、retirement 归
  后续 Spec）（CTR-OP-012）。
- 定义 operator 自身的部署门与审计边界（CTR-OP-014）。

### 2.2 Explicit non-goals（本 Spec 明确不授权）

```text
GENERAL_OPERATOR_CAPABILITY      = FORBIDDEN（不得演化成通用 privileged API）
ARBITRARY_AGENT_ID               = FORBIDDEN（第二 Agent subject = rejected）
SHELL_EXECUTION                  = FORBIDDEN（无 shell、无任意 argv/exec）
ARBITRARY_METHOD_COMMAND_PATH    = FORBIDDEN（不存在任意 method/command/path 面）
TCP_OR_PUBLIC_HTTP_TRANSPORT     = FORBIDDEN
ROOT_HOST_EXEC                   = FORBIDDEN
SUDO_OR_LAUNCHCTL_ASUSER_BYPASS  = FORBIDDEN
DIRECT_DATABASE_WRITE            = FORBIDDEN
GENERIC_FILE_WRITER              = FORBIDDEN（operator 不是通用文件写入器）
SUDOERS_OR_ACL_CHANGE            = NOT_AUTHORIZED_BY_THIS_SPEC
PROVISIONER_CREDENTIAL_CHANGE    = NOT_AUTHORIZED_BY_THIS_SPEC（复用现有 accepted
  auth-service provisioner authorities；不定义、不修改其 credential）
AUTH_SERVICE_CODE_CHANGE         = NO_IN_REPO
PRODUCT_CODE_CHANGE_IN_AUTHORING_ROUND = NONE（本轮零代码）
ACTIVATION                       = NO（不得自动启用
  AGENT_CORE_WORKFLOW_ADMIN_AGENT_ACTIVATION_V1；disabled:true → false 仍仅归
  该独立 activation authority，Bootstrap Spec CTR-WA-009）
BINDING_GRANT_ROOT_CREATION      = NO
WORKSPACE_HOME_CREATION          = NO
```

Bootstrap Spec §2.2 的全部 non-goals（Slice 分离：无 svc-workflow grant、无 Feishu
Binding、无 designation root、无 workspace/Home provisioning、无 capability/
Scheduler/Runtime/fleet 变更）在本通道内**逐字继续有效**：operator 的动作集合是
Bootstrap Spec CTR-WA-007 封闭动作清单的 uid 505 侧子集，不得扩张。

### 2.3 通道参与方与职责分工（composition，不修改父契约）

Bootstrap Spec 的「身份 执行」round 义务按下列分工联合履行（round 级
Contract-by-Contract conformance 仍按 Bootstrap Spec 评估）：

```text
REQUESTER（uid 502 执行任务的职责）:
  T1 re-baseline / preflight（父 CTR-WA-008 四条件）;
  T2/T3 生产面只读检查的 coordination;
  T3.5 PREPARED attempt ledger 的准备与 docs-only evidence commit（先于任何
      运行时写入落盘，满足父 CTR-WA-010 "首个外部写入前" 义务）;
  调用 operator（一次 UDS request）;
  响应后：按 operator 返回的非秘密结果更新同一 attempt ledger、写父 CTR-WA-006
      六字段 final receipt、提交 docs-only evidence commit。

OPERATOR（uid 505 内部职责，本 Spec 冻结）:
  验证（spec pin / evidence commit / PREPARED ledger / provisioner /
      pre-state）→ 父 T4–T8 的 uid 505 侧执行（canonical Definition writer、
      exact resolution/S1/S2、secret 内存路径、Part G 原子 store 写、父 D.5
      verification mint 分类）→ uid 505 私有 transaction state → 非秘密 response。
```

operator MUST NOT 写 dsh-agent-core 仓库工作树（502 属主；且 trusted CP 的冻结
posture 是 505 进程不打开 dev-repo 文件，OBS-OP-003）。repo 侧 ledger/receipt/
evidence 全部由 requester 侧提交。

## 3. Authority and dependencies

```text
PRIMARY_PARENT_AUTHORITY = AGENT_CORE_WORKFLOW_ADMIN_AGENT_BOOTSTRAP_V1
  repository = mayf3/dsh-agent-core
  blob on authoring base (github/main df3b299) = a190c4496a889432ace9e874e0dc50ca8005ca9a
  accepted_head = bb0db2855470650da531431c35c4b0e2a7ae1157 (in main ancestry)
  merge_commit = 91cab8473c5042e833b559ea9c4f35723d147739 (PR #80, in main ancestry)
  relation = depends_on（本 Spec 是该 accepted 权威对「执行通道」这一实现侧面的
    subject-bounded child authority；不修改其任何冻结；其全部 CTR-WA-* 在本通道
    执行内继续逐字有效）

INHERITED_IN_REPO_AUTHORITY = AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1
  blob on authoring base = df74e92759ad3083328dfd337667fc8a4ec618a0
  inherited_seams = Part C.4 external_ref 纯函数 · Part D/D.7 Phase A 固定顺序 ·
    D.5 verification mint 分类表 · E.4(c) bootstrap provisioner 前置 ·
    Part G store 写契约 · Part H secret handoff
  relation = reuse（零修改）

PRODUCTION_RUNTIME_REFERENCE = TRUSTED_CONTROL_PLANE_DEPLOYMENT_HARDENING_V1 /
  TRUSTED_CREDENTIAL_505_FINAL_ACCEPTANCE_V2（docs/reports；生产拓扑 evidence）
  trusted install root = /usr/local/libexec/agent-core（authsvc:authsvc，uid 502 只读）
  control plane = uid 505 authsvc 进程（trusted Node + trusted harness/app 闭包）
  config = <trusted>/config（agents.json / bindings / credential store，authsvc 0700/0600）
  relation = constrained_by（operator 是该拓扑内的 additive endpoint，不得削弱
    其任何已验收边界：trusted Node、502 只读、store 505-private、CP 不打开
    dev-repo 文件）

EXTERNAL (interoperates_with / depends_on, no local supersession):
  mayf3/auth-service github/main = b88512881135dd8a0d382e8ca76650059df33725
    （2026-08-29 fetch；较 Bootstrap Spec authoring 时的 observed 325e781 前进，
     新增 delta 仅 AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_* closure Specs——
     不涉及 provisioner Principal/Client authority、S1/S2、secret handoff 或
     同范围 operator authority，OBS-OP-007）
  MINIMAL_AUTH_FOUNDATION_V2 = accepted（docs/contracts/minimal-auth-v2/）
  AUTH_SERVICE_OWNERLESS_AGENT_PRINCIPAL_V1 = accepted（ownerless agent principal）
  AUTH_SERVICE_AGENTCORE_IDENTITY_RESOLUTION_V1 = accepted（exact external_ref
    resolution seams；operator 的 resolution/outcome_unknown 解析按其语义）
  现有 provisioner Principal/Client authority、S1/S2 幂等 seam、
  rotate/revoke/disable authority = 由 auth-service 侧各自权威持有；本 Spec 只读
  复用（AUTH_SERVICE_NEW_PROVISIONER_CHILD_REQUIRED = NO）
  auth-service 行为由其自身权威治理，本 Spec 仅引用不改。

GOVERNANCE = AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0 (accepted, current)
```

权威边界一句话：**「这一次 bootstrap 执行什么」全部在 Bootstrap Spec；「uid502
如何合法地发起、uid505 如何在边界内执行、如何保证只此一次」在本 Spec。**

## 4. Current State

- `STATE-OP-001` — 截至 authoring 基准（dsh-agent-core github/main `df3b299`，
  2026-08-29 fetch），Bootstrap Spec `status: accepted` 且已在 main（blob
  `a190c44`；accepted head `bb0db28` 与 merge `91cab84` 均在 main ancestry）；
  仓库内不存在任何 bootstrap-operator 同范围 Spec、branch、PR 或未提交草案
  （OBS-OP-001 / OBS-OP-008）。执行轮必须在执行时重新核实（CTR-OP-005）。
- `STATE-OP-002` — 生产控制面拓扑为 uid 505 authsvc trusted install
  （`/usr/local/libexec/agent-core`；config 0700；trusted Node；502 对全部
  trusted code/config 只读；credential store 505-private 0600；505 进程打开
  0 个 dev-repo 文件）（OBS-OP-003）。因此 Bootstrap Spec 要求的全部运行时
  写入目标都在 uid 505 边界内，uid 502 无直接写路径（OBS-OP-004）。
- `STATE-OP-003` — current main 代码中不存在任何可精确限制到单一 operation 的
  uid 505-owned 本地控制面入口：无 UDS server 代码；trusted broker gateway 为
  进程内组件（无 listener）；CP 对外仅 localhost TCP（通用 agent RPC）；spawn
  helper 是单向 505→502 降权（OBS-OP-002）。

## 5. Observations

### OBS-OP-001 — Bootstrap Spec 已 accepted 并进入 main

- Subject: `docs/specs/AGENT_CORE_WORKFLOW_ADMIN_AGENT_BOOTSTRAP_V1.md`。
- Source revision: dsh-agent-core github/main `df3b299ec5ab78a2f1c944c01803a5e1caf28f85`。
- Method: `git rev-parse github/main:docs/specs/...`（blob =
  `a190c4496a889432ace9e874e0dc50ca8005ca9a`）；`git merge-base --is-ancestor
  bb0db28... HEAD` 与 `91cab84... HEAD`（均 true）；frontmatter `status:
  accepted`、`implementation_authority: contracts`、acceptance receipt
  2026-08-27（reviewer `deepseek-harness-local-independent-spec-reviewer-clean-r4`，
  `SEMANTIC_DELTA_AFTER_REVIEW = NONE`）。
- Result: Bootstrap Spec 是 main 上的 active authority，且
  `SEPARATE_EXECUTION_TASK_REQUIRED = YES`、`SEPARATE_EXECUTION_SPEC_REQUIRED =
  NO`（身份动作本身无需第二份 Spec；本 Spec 只治理「执行通道」，不重复定义
  bootstrap 动作）。
- Provenance: 本轮 git 命令记录。

### OBS-OP-002 — 不存在可复用的、可精确限制本 operation 的 uid505 本地控制面 seam

- Subject: current main 全部 uid 505 侧本地入口。
- Source revision: dsh-agent-core `df3b299`。
- Method: 全仓 grep（`unix.?domain|\.sock|createServer.*socket|UDS`，排除
  node_modules）；读取 `docs/reports/trusted-credential-broker-integration-v1.md`、
  `trusted-credential-505-final-acceptance-v2.md`、
  `trusted-control-plane-deployment-hardening-v1.md`。
- Result:
  - 仓库内无任何 Unix-domain socket server 代码（唯一 grep 命中是一个测试中
    对 `net.Socket` connect 的 mock guard，非 server）；
  - trusted broker gateway 是控制面进程**内**组件，无 socket 可连（验收字段
    `A_DIRECT_TCB_ACCESS` 实测无 listener）；复用它将把单次管理 operation 混入
    通用 agent RPC 面（禁止，§7/CTR-OP-013），且该面经 localhost TCP（本 Spec
    禁止的 transport）；
  - CP 服务端口为 localhost TCP（验收驱动预检端口 8787），属通用 agent 面；
  - spawn helper（`/usr/local/libexec/dsh-agent-spawn-helper`，root:wheel 4755）
    是单向 505→502 降权 exec（只接受 502/20、清 supplemental groups、固定
    argv、无 shell），不是 operation 入口；
  - 既有验收明言「未新建任何 daemon / IPC / 通用 sudo 框架 / Auth」。
- Consequence: Owner 冻结的选择顺序第 1 项（复用既有 seam）不可用；本 Spec
  按第 2 项冻结 dedicated local UDS endpoint（DEC-OP-001）。
- Provenance: grep 命令与三份 reports。

### OBS-OP-003 — 生产拓扑已冻结并验收：trusted install / uid505 / 502 只读

- Subject: 生产控制面部署形态。
- Source revision: docs/reports/trusted-control-plane-deployment-hardening-v1.md
  与 trusted-credential-505-final-acceptance-v2.md（main `df3b299` 在场）。
- Method: report 全文读取。
- Result: trusted install root `/usr/local/libexec/agent-core`（authsvc:authsvc，
  0755/0644，uid 502 写/替换/symlink 全部 DENIED——攻击矩阵实测）；CP 以
  `sudo -u authsvc` + trusted Node 运行（uid 505）；config（agents.json /
  bindings / credential store）authsvc 0700、store 0600；credential store 读取
  自 502 DENIED；505 进程打开 0 个 dev-repo 文件（lsof 断言）。
- Provenance: 两份 reports 的验收字段。

### OBS-OP-004 — Bootstrap Spec 的运行时写入目标全部 uid505 属主，uid502 零直接写路径

- Subject: 生产 `agents.json`、trusted credential store、auth-service 调用面。
- Source revision: Bootstrap Spec CTR-WA-001/CTR-WA-004 + OBS-OP-003 拓扑。
- Method: 契约与拓扑交叉推导。
- Result: 生产 `agents.json` 在 `<trusted>/config`（authsvc 0700）；store 按
  Part G.1 在 505-private trusted 目录 0600；canonical Agent Definition writer
  seam（`createAgentInConfig` 家族，Bootstrap Spec OBS-WA-011 清点）在 trusted
  code 内执行时进程身份即 uid 505。uid 502 进程对该三面零写权限（OBS-OP-003
  攻击矩阵实测 DENIED）。
- Provenance: Bootstrap Spec §9 与 hardening report §4 攻击矩阵。

### OBS-OP-005 — 父执行链（T4–T8）所需 seam 在 current main 全部在场

- Subject: canonical Agent Definition writer、Part G store 写、S1/S2、D.5 mint。
- Source revision: Bootstrap Spec OBS-WA-011（writer 清点）、
  AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1 Part C.4/D.5/G/H、auth-service
  `src/routes/idempotent.ts`（Bootstrap Spec OBS-WA-006 三修订一致）。
- Method: 权威文件读取。
- Result: `createAgentInConfig`/`writeAgentDefinition` 家族、Part G 同目录
  0600-temp+rename 原子写、S1 `POST /api/v1/principals` / S2
  `POST /api/v1/clients` 幂等 seam、exact external_ref resolution 路由
  （auth-service main `45b1b890` 起在场）、D.5 mode-aware 分类表——operator
  需要的全部机制在 current main 与既有 accepted 权威中**已存在**，无需新建
  任何 product seam。
- Provenance: 两份 Specs 与 auth-service 源码坐标（经 Bootstrap Spec OBS 转引）。

### OBS-OP-006 — macOS 内核为 UDS 提供 peer credential（LOCAL_PEERCRED）

- Subject: 本机（darwin 25.5.0 arm64）Unix-domain socket 的本地 caller 证明能力。
- Source revision: 平台 API（SOL_LOCAL / `LOCAL_PEERCRED` / `struct xucred`，
  `cr_uid` 字段）。
- Method: 平台文档知识 + 本机为 darwin（生产 CP 同机运行，OBS-OP-003）。
- Result: UDS 上 `getsockopt(fd, SOL_LOCAL, LOCAL_PEERCRED, &xucred)` 返回由
  **内核**提供的对端有效 uid/gid，连接方无法自报伪造。该能力使「只允许本机
  uid 502」可以构造性闭合（CTR-OP-002）。
- Limitations: authoring round 未在本机运行代码验证（DOCS-ONLY）；implementation/
  deployment 任务必须在部署主机现场验证该 syscall 行为（ACC-OP-002 required
  evidence），验证失败即 STOP 并报告 Owner decision（DEC-OP-002）。
- Provenance: darwin socket API。

### OBS-OP-007 — auth-service main 前进（325e781→b885128），delta 与本 scope 无交集

- Subject: mayf3/auth-service github/main。
- Source revision: `b88512881135dd8a0d382e8ca76650059df33725`（2026-08-29
  `git ls-remote` + fetch）。
- Method: `git log --oneline 325e781..github/main`（3 commits + merge）。
- Result: 新增 delta 全部为
  `AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_IMPLEMENTATION_CLOSURE_V2`
  及其 elaboration/acceptance（notification ingress closure、validate.mjs、
  audience registry）——不涉及 canonical Agent Definition writer、
  credential-store writer、local control-plane/UDS/operator、auth-service
  provisioner、secret handoff 或同范围 operator authority。
  `MINIMAL_AUTH_FOUNDATION_V2` / `AUTH_SERVICE_OWNERLESS_AGENT_PRINCIPAL_V1` /
  `AUTH_SERVICE_AGENTCORE_IDENTITY_RESOLUTION_V1` 在该修订均为 accepted。
- Provenance: auth-service 仓库 git 记录（只读）。

### OBS-OP-008 — 无同范围重复 authority

- Subject: dsh-agent-core branches / open PRs / specs 目录 / 未提交草案。
- Source revision: `df3b299` + `git ls-remote github` + `gh pr list`（2026-08-29）。
- Method: `grep -iE "operator|bootstrap"` over spec dir、branch 名、open PR
  标题；main worktree dirty 文件扫描。
- Result: 无 `*_BOOTSTRAP_OPERATOR_*` Spec 文件；无 operator-scope branch/PR；
  main worktree 未提交草案与本 scope 无交集（既有 open PR #62
  `AGENT_TRUSTED_HOME_CROSS_UID_ACCESS_V1` 是 Homes/Workspace 跨 UID 权限模型
  draft，属不同 authority 面，与本通道无重叠）。DUPLICATE_SPEC_RISK = NONE。
- Provenance: 本轮命令记录。

## 6. Claims and assumptions

### CLM-OP-001 — 复用既有 seam 不可行，dedicated local UDS endpoint 是唯一符合冻结选择顺序的模型

- Support state: SUPPORTED
- Supported by evidence: `EVD-OP-001`
- Contradicted by evidence: none known
- Uncertainty: none（OBS-OP-002 的清点是 current main 的构造性事实；未来新增
  seam 属新权威裁量，不改变本 Spec 选择）。

### CLM-OP-002 — UDS peer credentials 可在本机可靠限制 caller 为 uid 502

- Support state: SUPPORTED
- Supported by evidence: `EVD-OP-002`
- Contradicted by evidence: none known
- Uncertainty: authoring round 未现场执行 syscall 验证（OBS-OP-006 limitations）；
  implementation/deployment 任务必须现场验证，失败即 STOP 报 Owner（DEC-OP-002）。

### CLM-OP-003 — operator 可在 uid 505 内完整执行父 T4–T8，零新增 product seam

- Support state: SUPPORTED
- Supported by evidence: `EVD-OP-003`
- Contradicted by evidence: none known
- Uncertainty: 部署面实际 auth-service 运行修订仍按 Bootstrap Spec OBS-WA-007
  的现场确认义务处理（operator 侧继承，不降低）。

### CLM-OP-004 — 该通道不授予 uid 502 任何 authsvc 侧特权

- Support state: SUPPORTED
- Supported by evidence: `EVD-OP-004`
- Contradicted by evidence: none known
- Uncertainty: none（response 闭合集合 + secret 边界 + 单 operation 构造性保证；
  uid 502 下其他进程能到达 socket 也只能触发同一 exact operation，§7/CTR-OP-002）。

## 7. Evidence relations

### EVD-OP-001 — 入口清零观察支持「无既有 seam 可复用」

- Source observations: `OBS-OP-002`
- Target: `CLM-OP-001`
- Relation: SUPPORTS
- Bound coordinates: dsh-agent-core `df3b299`（grep + 三份 reports）
- Strength/sufficiency: 对 current main 充分
- Limitations: 不覆盖未来新增 surface
- Provenance: OBS-OP-002 所列命令与文件

### EVD-OP-002 — 平台能力支持「kernel-verified caller proof」

- Source observations: `OBS-OP-006`, `OBS-OP-003`（生产 CP 同机 darwin）
- Target: `CLM-OP-002`
- Relation: SUPPORTS
- Bound coordinates: darwin 25.5.0 arm64（本机 = 生产主机，OBS-OP-003 拓扑）
- Strength/sufficiency: 平台 API 层面充分
- Limitations: 未现场执行验证（由 ACC-OP-002 兜底）
- Provenance: OBS-OP-006

### EVD-OP-003 — 权威在场清单支持「零新增 product seam 可执行」

- Source observations: `OBS-OP-005`, `OBS-OP-001`
- Target: `CLM-OP-003`
- Relation: SUPPORTS
- Bound coordinates: dsh-agent-core `df3b299` + auth-service `b885128`
- Strength/sufficiency: 对所列 seam 充分
- Limitations: 部署面 auth 修订现场确认义务保留（Bootstrap Spec OBS-WA-007）
- Provenance: OBS-OP-005 所列权威坐标

### EVD-OP-004 — 拓扑与闭合集合支持「通道 ≠ 特权」

- Source observations: `OBS-OP-003`, `OBS-OP-004`
- Target: `CLM-OP-004`
- Relation: SUPPORTS
- Bound coordinates: trusted install 拓扑（hardening report 验收字段）
- Strength/sufficiency: 充分
- Limitations: none
- Provenance: OBS-OP-003 / OBS-OP-004

## 8. Decisions

### DEC-OP-001 — Operator 模型：现有 authsvc runtime 内的 dedicated local-only UDS endpoint（进程内组合）

- Decision owner: `mayf3`（派发指令冻结选择顺序）
- Decision: `SELECTED_OPERATOR_MODEL = dedicated local-only Unix-domain operator
  endpoint (single fixed operation workflow_admin_agent_bootstrap_v1), composed
  in-process into the existing trusted authsvc (uid 505) control-plane runtime
  within the trusted install closure`。选择顺序按 Owner 指令执行：第 1 项
  （复用既有 uid505 seam）经 OBS-OP-002 清点不可用；第 2 项即本决定；第 3 项
  全部禁止（TCP/公网 HTTP、通用 shell、通用文件 writer、root host-exec、
  sudo、launchctl-asuser、数据库直写）。冻结：
  ```text
  OPERATOR_SOCKET_PATH =
  /usr/local/libexec/agent-core/run/workflow-admin-bootstrap-operator.sock

  OPERATOR_SOCKET_DIR = /usr/local/libexec/agent-core/run
    （authsvc:authsvc 0755——目录可遍历；socket 文件 authsvc 属主）

  OPERATOR_STATE_DIR =
  /usr/local/libexec/agent-core/config/operator/workflow-admin-bootstrap-v1
    （authsvc:authsvc 0700——uid 505 私有）

  OPERATOR_STATE_PATH = <OPERATOR_STATE_DIR>/state.json（0600，原子 temp+rename）
  OPERATOR_CONFIG_PATH = <OPERATOR_STATE_DIR>/operator-config.json
    （0600，deployment 任务写入并 pin；runtime 只读）
  ```
  socket 文件权限**不是** caller 授权机制（macOS UDS 无按 uid 的 connect ACL）；
  唯一授权机制是 kernel peer credentials（CTR-OP-002）。socket mode MAY 为
  0666（允许 connect），但任何 mode 都 MUST NOT 替代 peer-credential gate。
  不新建 daemon（与既有「进程内组合优先」验收先例一致）；endpoint 生命周期
  随 CP 进程，但 one-shot 状态不依赖进程存活（CTR-OP-010）。
- Rejected alternatives: 见 §11（复用 broker gateway / CP TCP / spawn helper /
  sudo wrapper / root daemon / 通用文件 writer / TCP localhost）。
- Owner input remaining: none。

### DEC-OP-002 — Caller 授权 = 本机 OS 边界 + exact accepted operation；无 per-process proof

- Decision owner: `mayf3`
- Decision:
  ```text
  AUTHORIZED_CALLER_UID = 502
  CALLER_AUTHORIZATION_SOURCE = local operating-system boundary + exact accepted operation
  CALLER_IS_RUNTIME_ACTOR = NO
  ```
  operator MUST 在处理任何 request 前 `getsockopt(LOCAL_PEERCRED)` 取 kernel
  提供的 `cr_uid` 并要求 `== 502`，否则 fail closed、零运行时写入。任何 uid ≠ 502
  的连接 MUST 在读取 body 前关闭。UID502 获得的**不是**：authsvc shell、canonical
  file read/write、provisioner credential、通用 operator、其他 Agent 创建权限。
  即使 uid 502 下其他进程能到达该本地入口，operator 也只能执行这一个已经
  accepted 的 exact operation，且只有一个 exact subject（无 per-process 区分——
  这是本通道接受的冻结边界，非缺陷）。若部署主机验证 LOCAL_PEERCRED 行为失败，
  MUST STOP 并报告 Owner decision（不得假装已闭合）。
- Rejected alternative: per-process token / mTLS / 二次 secret 认证（引入 secret
  通道，违反 SECRET_CROSSES_UID_BOUNDARY = NO 且无必要）；文件属主授权（macOS
  UDS 无此能力）。
- Owner input remaining: none。

### DEC-OP-003 — Revision 绑定两阶段：deployment pin + execution match + 只读 GitHub evidence 验证

- Decision owner: `mayf3`
- Decision: operator 对「exact accepted Spec 已进入 main」与「evidence commit 与
  PREPARED attempt ledger」的验证按两阶段冻结：
  **Deployment 阶段**（独立部署任务）：验证 Bootstrap Spec accepted + 已在
  dsh-agent-core main；把下列值 pin 进 `OPERATOR_CONFIG_PATH`（uid 505 私有）：
  ```text
  PIN_PARENT_SPEC_BLOB_SHA（部署时实测的 accepted Spec 文件 blob sha）
  PIN_PARENT_ACCEPTED_HEAD / PIN_PARENT_MERGE（ancestry 证据）
  PIN_ALLOWED_CALLER_UID = 502
  PIN_AGENT_ID / PIN_PRINCIPAL_EXTERNAL_REF / PIN_CLIENT_EXTERNAL_REF
  PIN_SOCKET_PATH / PIN_STATE_PATH
  PIN_AUTH_SERVICE_ORIGIN（生产 auth-service origin，与 trusted broker 同源）
  PIN_PROVISIONER_COORDINATES（非 secret 引用：principal external_ref、client id、
    audience svc-auth、scope auth.identity.provision）
  ```
  **Execution 阶段**（每次 request，operator 内部、只读、零 repo 写入）：
  1. `request.acceptedSpecRevision == PIN_PARENT_SPEC_BLOB_SHA`（不匹配 ⇒ fail
     closed）；
  2. 只读 GitHub 验证（HTTPS，`git ls-remote github mayf3/dsh-agent-core main`
     或等价 API）：current main HEAD == `request.evidenceCommit`；
  3. 只读获取 `evidenceCommit` 处
     `docs/evidence/workflow-admin-agent-bootstrap-v1/attempt-ledger.json`
     （父 CTR-WA-010 冻结 path）：state == `PREPARED`、canonical sha256 ==
     `request.attemptLedgerDigest`、其绑定字段（attemptId / specRevision /
     base == request.implementationBase / agentId / external_refs / s1、s2
     request digest）与 request 字段逐字相等；
  4. `evidenceCommit` 恰为 `implementationBase` 之上**一个** docs-only commit
     且只改该 ledger 文件（只读 diff 验证）；该 commit 处 Bootstrap Spec 文件
     blob == pin。
  任一验证失败 ⇒ fail closed、零运行时写入。operator 不得写任何仓库状态；本地
  git / dev-repo 文件读取禁止（保持 OBS-OP-003 的「505 进程打开 0 个 dev-repo
  文件」posture——operator 是 trusted CP 进程内组件）。
- Rejected alternatives: operator 现场做完整 git fetch/clone（新增可写状态与
  攻击面）；信任 request 自带 ledger 内容（request 字段闭合集合冻结，不含内容）；
  由 uid502 传入文件路径（禁止任意 path）。
- Owner input remaining: none。

### DEC-OP-004 — 职责分工：requester 准备 ledger / operator 执行 uid505 侧 / requester 落盘 receipt

- Decision owner: `mayf3`
- Decision: 按 §2.3 冻结分工。PREPARED attempt ledger 在任何运行时写入前已
  持久化于 main（满足并强于父 CTR-WA-010「首个外部写入前原子创建」——此处为
  commit 级持久化）；operator 侧阶段事实记入 uid 505 私有 `OPERATOR_STATE_PATH`
  （事务内的 authoritative 记录）；repo ledger 的阶段更新、父 CTR-WA-006 final
  receipt 与 evidence commit 由 requester 在收到 operator response 后完成，
  数据来源仅为 response 的非秘密闭合字段与 operator state 的非秘密引用。
- Rejected alternative: operator 直接写 repo evidence（502 属主区 + 破坏
  trusted posture + 需要 git 凭据面）。
- Owner input remaining: none。

### DEC-OP-005 — Provisioner 复用（零新增 auth-service child）；每次执行 fresh revalidation

- Decision owner: `mayf3`
- Decision:
  ```text
  AUTH_SERVICE_NEW_PROVISIONER_CHILD_REQUIRED = NO
  ```
  operator 复用现有 accepted auth-service provisioner authorities（E.4(c) 元组：
  active service principal + active machine client + usable client secret +
  MachineAccessGrant(audience svc-auth, scope auth.identity.provision)，全部
  位于 trusted deployment/operator zone）。每次执行前 MUST 在 uid 505 内 fresh
  revalidate：provisioner Principal active、Client active、audience 正确、
  `auth.identity.provision` grant 存在、credential 可用（in-memory token mint
  验证）、credential 不离开 uid 505。任何 revalidation 失败：
  ```text
  BOOTSTRAP_OPERATOR_RESULT = STOPPED
  ```
  零 Definition / S1 / S2 / store 写入。本 Spec 不定义、不修改 provisioner
  credential；provisioner 身份坐标只在 deployment pin 中以非 secret 引用存在。
- Rejected alternative: 为本次 bootstrap 新建 provisioner child（冗余 authority，
  AUTH_SERVICE_NEW_PROVISIONER_CHILD_REQUIRED = NO）；operator 跳过 revalidation
  直接复用缓存 token（违反 fresh 语义）。
- Owner input remaining: none。

### DEC-OP-006 — One-shot 语义与 uid505 私有 durable operator state

- Decision owner: `mayf3`
- Decision: operator MUST 维护 `OPERATOR_STATE_PATH`（uid 505 私有、0600、原子
  temp+rename），绑定 exact attemptId、exact Spec revision、exact implementation
  Base、request digest（全部 request 字段的 canonical sha256）、operation、
  subject、阶段与结果。语义冻结：
  ```text
  same attempt + same request digest = resume / reconcile 或 terminal replay
  same attempt + different request digest = conflict / fail loud
  new attempt after terminal success = rejected
  second Agent subject = rejected
  ```
  operator MUST NOT 仅依赖 socket 进程存活保存状态（CP 重启后从 durable state
  恢复；进程内缓存只是加速）。完成或安全终止后：operator 不得再次创建对象、
  不得生成第二 Client、不得更换 external_ref、不得删除 durable audit。
- Rejected alternative: 状态只存进程内存（崩溃即失忆，防重放失效）；按
  caller-session 记账（无会话语义）。
- Owner input remaining: none。

### DEC-OP-007 — Secret 边界冻结

- Decision owner: `mayf3`
- Decision:
  ```text
  S2 secret =
  auth-service response memory
  → canonical credential-store writer (Part G)
  → memory zeroization / release
  ```
  禁止：secret 进入 uid 502、operator response、socket/request、argv/env、日志、
  临时文件、attempt ledger、evidence、Git/PR/chat。任何异常日志路径只能记录
  `secretPresent = true|false`，不得记录值或可逆编码。provisioner token（fresh
  revalidation 所 mint）同样只存在于 uid 505 进程内存，用后释放。
- Rejected alternative: 把 secret 回传 requester 由其写 store（uid 502 无写权限
  且违反 Part H）；secret 经 env 传给子进程（Part H 禁止清单）。
- Owner input remaining: none。

### DEC-OP-008 — 失败终态继承 SAFE_DISABLED_STAGED_IDENTITY；零 Definition remove 依赖

- Decision owner: `mayf3`
- Decision: `ROLLBACK_TARGET = SAFE_DISABLED_STAGED_IDENTITY`（父 CTR-WA-011
  逐字继承）；operator MUST NOT 依赖 Agent Definition remove seam（current main
  不存在，父 OBS-WA-011）。全部失败模式（§9 CTR-OP-011 列举）的合法终态保持：
  Agent Definition present or absent according to completed stage；若 present：
  disabled=true、non-routable、non-runnable、defaultAgentId 不变、无 Binding、
  无 workflow Grant、无 Root、无 activation。
- Rejected alternative: 失败后删除 entry 回滚（依赖不存在 seam）；伪装「从未写入」。
- Owner input remaining: none。

### DEC-OP-009 — 通道生命周期：默认 disabled、单 Spec 单 subject、terminal success 后永久拒绝

- Decision owner: `mayf3`
- Decision:
  ```text
  OPERATOR_CAPABILITY_SCOPE = single Spec + single exact subject
  OPERATOR_DEFAULT_STATE = disabled / unavailable until its own deployment gate passes
  OPERATOR_AFTER_TERMINAL_SUCCESS = reject all new bootstrap attempts
  ```
  该通道 MUST NOT 永久成为通用管理入口。是否删除 socket/code 由后续 retirement
  Spec 决定，但功能上 MUST 永久拒绝第二次 bootstrap。operator MUST NOT 自动启用
  `AGENT_CORE_WORKFLOW_ADMIN_AGENT_ACTIVATION_V1`，也不得对其前置做任何动作。
- Rejected alternative: 保留为长期 admin 面（通用 privileged API 演化，禁止）。
- Owner input remaining: none。

### DEC-OP-010 — 治理形式：contracts + 三段分离（implementation / deployment+audit / bootstrap 执行）

- Decision owner: `mayf3`
- Decision: 本 Spec 以 `implementation_authority: contracts` 为唯一授权形式，
  不携带任何治理协议未识别的 authority 字段。冻结：文档合并不部署 operator
  （`DOCS_MERGE_DEPLOYS_OPERATOR = NO`）；accepted+merged 后依次需要：
  (1) **独立的 operator implementation 任务**（写代码 + 测试，按本 Spec Contracts）；
  (2) **独立的 operator deployment 任务 + 独立审计**（进入 trusted install、
  pin、部署门通过后才可用；`SEPARATE_OPERATOR_DEPLOYMENT_AND_AUDIT_REQUIRED =
  YES`）；(3) **独立的 Bootstrap 执行任务**（uid 502 requester 侧，按 §2.3
  分工 + 父 CTR-WA-008 四条件）。本轮 authoring 不执行其中任何一段。
- Rejected alternative: merge 即部署/启用（违反 docs-merge 零部署语义）；单任务
  连写带部署带执行（失去独立审计）。
- Owner input remaining: none。

## 9. Contracts

### CTR-OP-001 — Exact 单 operation 与 request 闭合字段集合

operator MUST 只接受一个固定 operation：`workflow_admin_agent_bootstrap_v1`。
request MUST 为单个 JSON 对象，字段集合**严格且仅为**（键名逐字）：

```text
operation
acceptedSpecRevision
implementationBase
attemptId
agentId
principalExternalRef
clientExternalRef
s1RequestDigest
s2RequestDigest
attemptLedgerDigest
evidenceCommit
```

固定值：`operation = workflow_admin_agent_bootstrap_v1`、`agentId =
agt_workflow-admin-agent`、`principalExternalRef =
agentcore:v1:principal:agt_workflow-admin-agent`、`clientExternalRef =
agentcore:v1:client:agt_workflow-admin-agent`。operator MUST NOT 接收：任意命令、
shell argv、文件路径、任意 Agent ID、Principal UUID、Client ID、secret、Token、
Authorization、业务 Grant、Binding、Root、activation 参数。任何多余字段、缺失
字段、错误 subject、错误 Spec SHA、错误 digest ⇒ **fail closed，零运行时写入**，
返回结构化拒绝（含原因码，零秘密）。每连接至多一个 request，response 后即关闭
连接；无 session、无 streaming、无 method 路由表。

### CTR-OP-002 — 仅本地 transport 与 kernel caller 边界

operator MUST 只经 exact socket path
`/usr/local/libexec/agent-core/run/workflow-admin-bootstrap-operator.sock`
（DEC-OP-001 冻结；目录 authsvc:authsvc 0755、socket authsvc 属主）接受连接；
MUST NOT 监听任何 TCP/网络端口（local-only 构造性保证：filesystem namespace）。
operator MUST 在读取 request body 前 `getsockopt(LOCAL_PEERCRED)` 取 kernel 提供
的 `cr_uid`，且仅当 `cr_uid == 502` 才继续；uid ≠ 502 ⇒ 关闭连接、零读取、零
运行时写入。socket 文件权限 MUST NOT 被当作授权机制（唯一授权 = kernel peer
credentials + exact accepted operation）。该授权授予 uid 502 的仅是「发起这一个
operation」——NOT authsvc shell、NOT canonical file read/write、NOT provisioner
credential、NOT 通用 operator、NOT 其他 Agent 创建权限（`CALLER_IS_RUNTIME_ACTOR
= NO`）。

### CTR-OP-003 — Exact subject 冻结；任意 Agent 拒绝

operator 的唯一 subject 是 `agt_workflow-admin-agent`（displayName `工作流总管`）。
request 中 agentId / principalExternalRef / clientExternalRef 与 §0 冻结值任一
不匹配 ⇒ fail closed、零运行时写入。operator MUST NOT 接受、创建、枚举或操作
任何第二 Agent subject（`second Agent subject = rejected`；`ARBITRARY_AGENT_ID =
FORBIDDEN`）。operator state 中 subject 字段与 request 不一致 ⇒ conflict / fail
loud。

### CTR-OP-004 — 治理绑定与三段分离；无特权绕过

operator 是 Bootstrap Spec 的 child implementation authority：仅当
`AGENT_CORE_WORKFLOW_ADMIN_AGENT_BOOTSTRAP_OPERATOR_V1` **accepted 且已在
implementation base** 时才允许实现；仅当其 **deployment gate 通过并 pin 完成**
后才可用；仅当 Bootstrap Spec **accepted 且在执行 base** 时才允许执行
operation。冻结：

```text
DOCS_MERGE_DEPLOYS_OPERATOR = NO
ACCEPTED_AND_MERGED_SPEC_AUTHORIZES_IMPLEMENTATION = YES
SEPARATE_OPERATOR_IMPLEMENTATION_TASK_REQUIRED = YES
SEPARATE_OPERATOR_DEPLOYMENT_AND_AUDIT_REQUIRED = YES
BOOTSTRAP_RUNTIME_WRITE_AUTHORIZED_BY_THIS_AUTHORING_ROUND = NO
```

operator 自身 MUST NOT 以 root host-exec、sudo、launchctl asuser、直连数据库或
任何 sudoers/ACL 变更实现其任何功能；其全部动作在 uid 505 进程内完成。本 Spec
authoring round 的 repo delta 仅为新 Spec 文件 + README index 行。

### CTR-OP-005 — 执行前置验证（spec pin / evidence commit / PREPARED ledger）

operator 在任何运行时写入前 MUST 全部完成（DEC-OP-003 冻结机制，只读、零 repo
写入）：

```text
1. request.acceptedSpecRevision == PIN_PARENT_SPEC_BLOB_SHA
2. read-only GitHub 验证：dsh-agent-core current main HEAD == request.evidenceCommit
3. evidenceCommit 处（只读获取）父冻结 path 的 attempt ledger：
   state == PREPARED
   canonical sha256 == request.attemptLedgerDigest
   绑定字段（attemptId / specRevision / implementationBase / agentId /
     principalExternalRef / clientExternalRef / s1RequestDigest /
     s2RequestDigest）与 request 逐字相等
4. evidenceCommit == implementationBase + 恰一个 docs-only commit（只改该
   ledger 文件）；该 commit 处 Bootstrap Spec blob == pin
```

任一项失败 ⇒ fail closed、零运行时写入。**ledger 尚未在 main 持久化（PREPARED
未验证）时，operator MUST NOT 执行任何运行时写入**（父 CTR-WA-010 的强化表述：
commit 级持久化先于运行时写入）。

### CTR-OP-006 — Provisioner fresh revalidation；失败即 STOP

operator MUST 在每次执行任何写动作前，于 uid 505 内 fresh revalidate 现有
accepted auth-service provisioner（credential spec E.4(c) 元组；零新增
auth-service provisioner child）：

```text
provisioner Principal active
provisioner Client active
audience 正确（svc-auth）
auth.identity.provision grant 存在
credential 可用（in-memory client_credentials mint 验证）
credential 不离开 uid 505（token/secret 均仅进程内存，用后释放）
```

任何 revalidation 失败 ⇒ `BOOTSTRAP_OPERATOR_RESULT = STOPPED`，零 Definition /
S1 / S2 / store 写入，response 如实报告 STOPPED 与原因码（零秘密）。revalidation
通过后、S1/S2 调用前的窗口内 operator MUST NOT 缓存跨执行复用（每次执行 fresh）。
本 Spec 不定义、不修改 provisioner credential；provisioner 坐标仅以非 secret
引用存在于 deployment pin。

### CTR-OP-007 — uid505 内部事务与 canonical writers（封闭顺序）

operator MUST 完全在 uid 505/authsvc 边界中按下列固定顺序执行（每步之间原子
更新 `OPERATOR_STATE_PATH`；任一步失败按 CTR-OP-011 终止）：

```text
1. 验证 exact accepted Spec 已进入 main（CTR-OP-005）
2. 验证 evidence commit 与 PREPARED attempt ledger（CTR-OP-005）
3. fresh revalidate provisioner Principal/Client（CTR-OP-006）
4. 检查 canonical Definition/store pre-state：
   - 生产 agents.json 中 agt_workflow-admin-agent entry 与目标 credential
     store entry 的在场性；store entry 存在 ⇒ ZERO_AUTH_CALL_STOP（父
     CTR-WA-003 reentry 语义逐字继承：current invocation STOPPED，零新
     durable write）
5. 经 canonical Agent Definition writer（createAgentInConfig /
   writeAgentDefinition 家族）写 disabled Agent Definition：
   { id: agt_workflow-admin-agent, name: 工作流总管, disabled: true,
     description: null }（父 CTR-WA-001 逐字；defaultAgentId 不变；不触碰
   任何既有 entry；不写 enabled Agent）
6. 调用 exact resolution / S1 / S2（调用体父 CTR-WA-002 逐字冻结；resolution
   用于 pre-state 与 outcome_unknown 分类，AUTH_SERVICE_AGENTCORE_IDENTITY_
   RESOLUTION_V1 语义；每次 S1/S2 调用前先持久化 operator state 的 request
   digest；outcome_unknown 按父 CTR-WA-010 决策树闭合）
7. S2 created secret 只保留在当前 uid 505 进程内存（CTR-OP-008）
8. 经 canonical credential-store writer（Part G validate-preserve-atomic，
   同目录 0600 temp + rename）原子写 credential store
9. 执行父 D.5 verification mint 并按父 D.5 mode-aware 表分类
   （CREDENTIAL_LAYER_VERIFICATION / BUSINESS_GRANT_READINESS /
   BOOTSTRAP_RESULT 三层；exact zero-Grant `400 invalid_scope` reason =
   machine_grant_missing ⇒ PASS / NOT_READY / SUCCESS_IDENTITY_ONLY）
10. 写 uid505 私有 transaction state（阶段、结果、时间、digest；零 secret）
11. 只返回非秘密结果（CTR-OP-009 闭合集合）
```

operator 的动作集合是父 CTR-WA-007 封闭动作清单的 uid 505 侧子集：MUST NOT
修改 defaultAgentId、MUST NOT 创建 enabled Agent、MUST NOT 创建任何
Binding/Grant/Root、MUST NOT 执行 activation 或 `disabled:true → false` 的任何
路径、MUST NOT 生成第二 Client、MUST NOT 更换 external_ref。

### CTR-OP-008 — Secret 边界（uid 505 内闭合）

S2 secret 的唯一路径冻结（父 Part H 逐字继承 + 通道侧强化）：

```text
auth-service HTTPS response body
→ uid 505 operator 进程内存
→ canonical credential-store writer（Part G，0600 原子写）
→ memory zeroization / release
```

secret MUST NOT 进入：uid 502（任何形式）、operator response、socket/request、
argv/env、日志、临时文件、attempt ledger、evidence、Git/PR/chat。任何异常/诊断
日志路径只能记录 `secretPresent = true|false`，不得记录值或可逆编码（Base64/
hex/截断/前缀均禁止）。provisioner token 同样仅 uid 505 进程内存。父 Part H
禁止清单（curl -u、child 传递、workspace、IM 等）逐字有效。

### CTR-OP-009 — Response 闭合字段集合（非秘密）

operator response MUST 为单个 JSON 对象，字段集合**严格且仅为**（键名逐字）：

```text
attemptId
principalId
clientId
credentialDigest
credentialLayerVerification
businessGrantReadiness
bootstrapResult
evidenceRefs
```

语义冻结：`principalId` / `clientId` 为 exact 解析值（未解析时 null）；
`credentialDigest` = store 原子写完成后 credential-store **文档字节**的 sha256
（hex；非 secret 派生、uid 505 侧可复算验证；MUST NOT 是 secret 或其可逆编码）；
`credentialLayerVerification ∈ PASS | FAIL | INCONCLUSIVE`；`businessGrantReadiness
∈ READY | NOT_READY`；`bootstrapResult ∈ SUCCESS_IDENTITY_ONLY | INCOMPLETE |
STOPPED`；`evidenceRefs` = 非秘密引用数组（如 operator state 文件标签与
evidenceCommit）。operator MUST NOT 返回：secret、Token、Authorization、
provisioner credential、credential-store 内容、其他 Agent 配置。任何额外字段 ⇒
实现违规。

### CTR-OP-010 — One-shot、幂等与防重放（durable uid505 state）

operator MUST 维护 `OPERATOR_STATE_PATH`（DEC-OP-006 冻结绑定字段；0600；原子
temp+rename；每阶段更新）。语义逐字冻结：

```text
same attemptId + same request digest  → resume / reconcile（按父 outcome_unknown
  树与已完成阶段继续）或 terminal replay（返回已持久化的终态结果，零新对象创建）
same attemptId + different request digest → conflict / fail loud（零运行时写入）
new attemptId after terminal success → rejected（零运行时写入）
second Agent subject → rejected（零运行时写入）
```

operator MUST NOT 仅依赖 socket 进程存活保存状态（CP 崩溃/重启后从 durable
state 恢复同一 attempt 的 same-attempt reconciliation）。完成或安全终止后：
operator MUST NOT 再次创建对象、MUST NOT 生成第二 Client、MUST NOT 更换
external_ref、MUST NOT 删除 durable audit（operator state 只追加/原子替换，
永不删除）。

### CTR-OP-011 — 失败与安全终态（SAFE_DISABLED_STAGED_IDENTITY 继承）

`ROLLBACK_TARGET = SAFE_DISABLED_STAGED_IDENTITY`（父 CTR-WA-011 逐字）；MUST NOT
依赖 Agent Definition remove seam。operator MUST 覆盖并闭合下列失败模式（分类
与动作全部继承父权威，通道侧不得弱化）：

```text
- Agent Definition 写后 S1 失败          → 按父 DEC-WA-006/CTR-WA-002 处置 + 状态记录
- S1 outcome_unknown                    → 父 CTR-WA-010 决策树（resolve exact
                                           principal external_ref：ABSENT 同
                                           attempt 重试 / PRESENT exact-match 继续
                                           / PRESENT conflict STOP）
- S2 outcome_unknown                    → 父 CTR-WA-010 决策树（CLIENT_ABSENT 同
                                           attempt 重试 / 已本地验证继续 /
                                           CLIENT_PRESENT_AND_SECRET_UNAVAILABLE
                                           STOP + INCOMPLETE；零第二 Client、零
                                           external_ref 变更、零伪造 secret）
- Client 存在但 secret 不可恢复         → STOP + INCOMPLETE；唯一恢复路径 =
                                           独立受控 SAME-client rotation 执行
                                           （父 CTR-WA-010 冻结；operator 不得
                                           自动 rotate）
- store 写失败                          → 状态记录 + 按已完成阶段收敛（secret
                                           不落任何非 Part G 位置）
- verification 失败/不确定              → 父 D.5 分类（FAIL/INCONCLUSIVE ⇒
                                           INCOMPLETE；零 blind rotation）
- operator 崩溃/重启                    → durable state 恢复；same attemptId +
                                           same digest 请求 ⇒ reconcile/replay
- response 丢失                         → requester 重发同 digest 请求 ⇒
                                           terminal replay（不重复执行已终态动作）
- uid502 重复提交                       → 同 attempt 同 digest = replay；新
                                           attempt / 不同 digest = rejected/conflict
```

安全终态 MUST 保持：Agent Definition present or absent according to completed
stage；若 present：`disabled=true`、non-routable、non-runnable、
`defaultAgentId` unchanged、无 Binding、无 workflow Grant、无 Root、无 activation。

### CTR-OP-012 — 通道生命周期（默认 disabled；terminal success 后永久拒绝）

```text
OPERATOR_CAPABILITY_SCOPE = single Spec + single exact subject
OPERATOR_DEFAULT_STATE = disabled / unavailable until its own deployment gate passes
OPERATOR_AFTER_TERMINAL_SUCCESS = reject all new bootstrap attempts
```

deployment gate 通过前 operator MUST 处于 disabled/unavailable（socket 不存在或
拒绝一切请求）。terminal success（`bootstrapResult = SUCCESS_IDENTITY_ONLY` 已
持久化于 operator state）后，operator MUST 永久拒绝所有新 bootstrap attempts
（新 attemptId、新 subject、任何变形），返回结构化 rejected，零运行时写入。
socket/code 的删除由后续 retirement Spec 决定；本 Spec 不授权删除，但功能拒绝
必须立即生效且不可被配置关闭。operator MUST NOT 自动启用
`AGENT_CORE_WORKFLOW_ADMIN_AGENT_ACTIVATION_V1` 或对其八项前置做任何动作。

### CTR-OP-013 — 能力封闭（不得演化为通用 privileged API）

operator MUST NOT 提供（且其实现 MUST NOT 留有任何可启用面）：create arbitrary
Agent、rotate arbitrary Client、read credential store（读取操作也不提供——
operator 只按 CTR-OP-007 顺序写与验证，无读回接口）、modify arbitrary config、
general privileged RPC、任意 method/command/path 分发、shell/exec、文件读写入口。
request 集合在 CTR-OP-001 冻结后 MUST NOT 以任何配置、feature flag、版本或参数
扩展；扩展即需新的 accepted authority（whole successor 或新 child）。

### CTR-OP-014 — Operator 部署门与审计边界

operator 代码 MUST 经独立 implementation 任务实现（按本 Spec Contracts + 测试），
经独立 deployment 任务进入 trusted install（authsvc 属主、uid 502 只读、trusted
Node 执行——与既有 hardening 拓扑一致），并经独立审计后才可用。deployment 任务
MUST：验证本 Spec accepted + 在 main；验证 Bootstrap Spec accepted + 在 main；
完成 DEC-OP-003 的全部 pin；在部署主机现场验证 LOCAL_PEERCRED 行为（ACC-OP-002）；
记录部署坐标（commit、pin 值、socket/state 路径、验收输出）。operator 的
durable audit（operator state、部署 pin、验证输出）MUST NOT 被任何后续任务删除。
本 Spec 不授权任何 sudoers/ACL/owner/group/mode 变更，除 operator 自身的
socket/state/config 文件按 DEC-OP-001 冻结的属主与模式创建外。

## 10. Acceptance

### ACC-OP-001 — Request 闭合集合与 fail-closed

- Contracts: `CTR-OP-001`
- Method/environment: operator 单元/集成测试（畸形 request 矩阵）
- Expected: 11 字段 exact key-set 校验；固定值字段逐字匹配；任何多余/缺失/
  错值字段 ⇒ 结构化拒绝 + 零运行时写入（验证 writers 与 auth client 零调用）
- Required evidence: 测试用例矩阵（含每类畸形 request）与零写入断言输出
- Failure condition: 任何畸形 request 触发写动作；任一禁止类字段（command/
  shell/path/任意 agentId/UUID/ClientID/secret/Token/Authorization/Grant/
  Binding/Root/activation）被接受
- Negative path: 携带 `command`、`argv`、`path`、`agentId: agt_other`、
  `principalUuid`、`secret`、`authorization` 字段的 request ⇒ 全部拒绝且零写入

### ACC-OP-002 — 仅本地 transport 与 caller 边界

- Contracts: `CTR-OP-002`
- Method/environment: 部署主机现场验证（deployment gate）+ 测试
- Expected: socket 仅存在于冻结 path；进程无任何 TCP listener（`lsof`/`netstat`
  断言）；LOCAL_PEERCRED 现场验证返回 kernel uid；uid 502 连接被处理、uid ≠ 502
  （含 root、505 自连、其他本地 uid）连接在 body 读取前关闭且零写入；socket
  mode 变化不改变授权结果
- Required evidence: 部署主机 syscall 验证记录、多 uid 连接测试矩阵、listener
  断言输出
- Failure condition: 任何网络监听存在；任何 uid ≠ 502 的连接被处理；授权依赖
  socket 文件 mode 而非 peer credentials；LOCAL_PEERCRED 现场验证失败却继续部署
- Negative path: root/sudo/launchctl 路径尝试到达 operator ⇒ 拒绝（caller uid
  ≠ 502）；502 直读 uid505 store 的独立攻击 ⇒ 仍 DENIED（store 0600 authsvc
  不因本通道改变）

### ACC-OP-003 — Exact subject

- Contracts: `CTR-OP-003`
- Method/environment: 测试（subject 漂移矩阵）
- Expected: 仅冻结 agentId + 两个 external_refs 的组合被接受；其他任何组合 ⇒
  拒绝 + 零写入；operator state subject 与 request 不一致 ⇒ conflict fail-loud
- Required evidence: 漂移矩阵测试输出
- Failure condition: 任意第二 Agent subject 被接受或创建
- Negative path: `agentId: agt_anything-else` / 修改任一 external_ref ⇒ 拒绝

### ACC-OP-004 — 治理形式与三段分离

- Contracts: `CTR-OP-004`
- Method/environment: 本 PR repo delta + frontmatter 检查 + 校验工具；operator
  实现侧代码审查（无 sudo/launchctl/DB/root exec 调用面）
- Expected: frontmatter 恰为 `implementation_authority: contracts`，零自创
  authority 字段；本 authoring round delta = 新 Spec 文件 + README index 行；
  operator 实现不含 privilege-bypass 调用；`git diff --check` PASS、
  `python3 .agents/tools/verify_governance.py --target . --require-accepted`
  PASS、`npm run verify:structure -- --base github/main` PASS
- Required evidence: 本 PR diff 与校验输出；operator implementation PR 的代码
  审查记录
- Failure condition: 携带额外文件 delta；operator 实现引入 sudo/launchctl/
  直连 DB/root exec；specs/authority 字段漂移
- Negative path: 以 `sudo -u authsvc`、修改 sudoers、launchctl asuser 实现
  通道任一功能 ⇒ 违规

### ACC-OP-005 — 执行前置验证

- Contracts: `CTR-OP-005`
- Method/environment: 集成测试（pin/commit/ledger 漂移矩阵，mock GitHub 只读源）
- Expected: 四项验证逐项执行且全部通过才进入 CTR-OP-006/007；错误
  acceptedSpecRevision、main HEAD ≠ evidenceCommit、ledger 非 PREPARED、digest
  不匹配、绑定字段不等、evidence commit 非单 commit/多文件 ⇒ 全部 fail closed
  零写入
- Required evidence: 漂移矩阵测试输出（每项的拒绝原因码与零写入断言）
- Failure condition: 任一验证缺失或失败后仍发生任何运行时写入（含 Definition
  写、Auth 调用、store 写）；**ledger 未在 main 持久化即执行运行时写入**
- Negative path: (1) 错误 Spec revision ⇒ 拒绝；(2) request 引用未 commit 的
  ledger（main HEAD 不同）⇒ 拒绝零写入

### ACC-OP-006 — Provisioner fresh revalidation

- Contracts: `CTR-OP-006`
- Method/environment: 集成测试（provisioner 状态故障注入矩阵：principal
  disabled / client inactive / grant 缺失 / credential 不可用）
- Expected: 每次执行前逐项 revalidate；任一失败 ⇒ `bootstrapResult = STOPPED`
  + 原因码 + 零 Definition/S1/S2/store 写入；provisioner token 仅内存（响应/
  日志/状态零 token 材料）
- Required evidence: 故障注入矩阵输出 + 零写入断言 + secret 扫描
- Failure condition: revalidation 失败后仍执行任何写动作；provisioner
  credential/token 材料出现在任何输出
- Negative path: (1) grant `auth.identity.provision` 缺失仍执行 ⇒ 违规；
  (2) provisioner secret 经 response/env/log 跨 UID ⇒ 违规

### ACC-OP-007 — uid505 内部事务与 canonical writers

- Contracts: `CTR-OP-007`
- Method/environment: 集成测试（顺序断言、writer 调用面、pre-state 分支）+
  生产面 post-state 核查（future 执行轮）
- Expected: 11 步顺序执行且阶段间 operator state 原子更新；Definition 写入经
  canonical writer（disabled:true entry、defaultAgentId 不变、其他 entry 字节
  不变）；store 写入 Part G validate-preserve-atomic；verification 按父 D.5
  三层分类；store entry 存在 ⇒ ZERO_AUTH_CALL_STOP reentry 语义
- Required evidence: 顺序/阶段断言、agents.json 与 store 前后快照（sha256 +
  解析 diff）、D.5 分类记录
- Failure condition: 任一步越序或跳过；defaultAgentId 变化；enabled Agent 被
  创建；Binding/Grant/Root/activation 被创建；第二 Client 或 external_ref 更换
- Negative path: (1) 写 enabled entry ⇒ 违规；(2) defaultAgentId 漂移 ⇒ 违规；
  (3) 顺手创建任何 Binding/Grant ⇒ 违规

### ACC-OP-008 — Secret 边界

- Contracts: `CTR-OP-008`
- Method/environment: 全产出物 secret 扫描（response、socket 采样、日志、
  env、argv、tmp、operator state、attempt ledger、evidence、PR/chat 约定）
  + 内存路径代码审查
- Expected: secret 仅存在于 S2 response→store 写之间的 uid 505 进程内存与最终
  0600 store entry；写后 zeroization；异常日志仅 `secretPresent` 布尔；扫描零
  命中（含可逆编码）
- Required evidence: 扫描命令与结果、zeroization 代码审查记录、store 权限记录
- Failure condition: secret（或其可逆编码/截断/前缀）出现在任何扫描面
- Negative path: secret 进入 response/log/tmp/env/argv 任一通道 ⇒ 必须被捕获
  并判定违规

### ACC-OP-009 — Response 闭合集合

- Contracts: `CTR-OP-009`
- Method/environment: response schema exact-equality 测试 + secret 扫描
- Expected: 恰 8 字段；credentialDigest 为 store 文档 sha256（uid 505 侧可复算
  相等）；principalId/clientId null 规则正确；枚举值域正确
- Required evidence: response 样本（脱敏）+ digest 复算记录
- Failure condition: 任何额外字段；返回 credential-store 内容、其他 Agent 配置、
  secret/Token/Authorization/provisioner credential
- Negative path: response 携带 `store`、其他 agent entry、token 材料 ⇒ 违规

### ACC-OP-010 — One-shot / 幂等 / 防重放 / 崩溃恢复

- Contracts: `CTR-OP-010`
- Method/environment: 状态机测试（同/异 digest 重放、崩溃注入（kill -9 后重启
  operator）、跨进程重启恢复）
- Expected: 四条语义逐字成立；operator state 每阶段原子持久；崩溃后同 attempt
  同 digest 请求 ⇒ reconcile 或 terminal replay，零第二身份；terminal success
  后一切新 attempt 拒绝
- Required evidence: 状态机测试矩阵 + 崩溃注入恢复记录
- Failure condition: 状态仅存进程内存；same attempt + different digest 被执行；
  terminal success 后第二次执行被接受；崩溃后无法 same-attempt reconciliation
- Negative path: (1) terminal success 后重放新 attemptId ⇒ rejected；(2) 同
  attemptId 换 digest ⇒ conflict fail-loud；(3) operator 重启后另起 attempt ⇒
  违规

### ACC-OP-011 — 失败终态安全

- Contracts: `CTR-OP-011`
- Method/environment: 故障注入矩阵（§CTR-OP-011 九类失败逐类注入）+ post-state
  核查
- Expected: 每类失败按父分类树闭合；终态满足 SAFE_DISABLED_STAGED_IDENTITY 八
  属性（present-or-absent by stage / disabled=true / non-routable /
  non-runnable / defaultAgentId unchanged / 无 Binding / 无 Grant / 无 Root /
  无 activation）；零 unrecorded rotation、零第二 Client、零 external_ref 变更
- Required evidence: 每类注入的 post-state 快照（agents.json 解析、store 状态、
  auth 对象、operator state 阶段记录）
- Failure condition: 任一失败模式未闭合即产生不一致状态；终态违反任一属性；
  rollback 依赖 Definition remove seam
- Negative path: (1) S2 response 丢失后创建 second Client ⇒ 违规；(2) 更换
  external_ref 重试 ⇒ 违规；(3) 伪造/回显旧 secret ⇒ 违规

### ACC-OP-012 — 通道生命周期

- Contracts: `CTR-OP-012`
- Method/environment: 状态机测试（deployment-gate 前不可用；terminal success
  后永久拒绝）
- Expected: gate 前 socket 不可用/全拒绝；terminal success 后任何新 attempt
  （含新 subject、变形 request）⇒ 结构化 rejected + 零写入；功能拒绝不可经
  配置关闭；无任何自动 activation 触发
- Required evidence: 生命周期测试输出
- Failure condition: gate 前可用；terminal success 后任何新 bootstrap 被接受；
  存在关闭永久拒绝的配置开关
- Negative path: terminal success 后以新 attemptId/新 agentId 重试 ⇒ 必须
  rejected

### ACC-OP-013 — 能力封闭

- Contracts: `CTR-OP-013`
- Method/environment: 代码审查 + 接口面测试（尝试任意 method/command/path/
  config/store 读取构造）
- Expected: 无任何通用面存在或可启用；request 集合与 CTR-OP-001 完全一致；
  无 feature flag 扩展点
- Required evidence: 接口面清单与测试输出、实现代码审查记录
- Failure condition: 实现中存在任意 method 分发、exec、文件读写、store 读回、
  arbitrary agent/client 操作的可达代码路径
- Negative path: operator 演化为通用 privileged API（新增任意 operation/
  method/config 面）⇒ 违规

### ACC-OP-014 — 部署门与审计边界

- Contracts: `CTR-OP-014`
- Method/environment: deployment 任务执行记录 + 独立审计报告
- Expected: 三段分离可追溯（implementation PR / deployment 记录 / 独立审计）；
  pin 完整（spec blob、accepted head、caller uid、subject、socket/state 路径、
  auth origin、provisioner 非 secret 坐标）；operator 文件 authsvc 属主且
  502 只读；LOCAL_PEERCRED 现场验证记录在场；durable audit 永不删除
- Required evidence: 部署记录（坐标 + pin 值 + 验收输出）、审计报告、文件
  属主/模式快照
- Failure condition: 部署跳过任一 pin 或现场验证；operator 代码 502 可写；
  durable audit 被删除或改写历史
- Negative path: 未经独立审计即启用 operator ⇒ 违规

**覆盖对照**：CTR-OP-001→ACC-OP-001 · 002→002 · 003→003 · 004→004 ·
005→005 · 006→006 · 007→007 · 008→008 · 009→009 · 010→010 · 011→011 ·
012→012 · 013→013 · 014→014（CONTRACT_COUNT = 14；CONTRACTS_WITH_ACCEPTANCE
= 14；ACCEPTANCE_COUNT = 14；DANGLING_CONTRACT_REFERENCES = 0；
UNCOVERED_CONTRACTS = 0；ACCEPTANCE_WITHOUT_FAILURE_CONDITION = 0。涉及
operator 运行面的证据属未来独立 implementation/deployment/execution 任务，
为 runtime/manual evidence 类，理由：其 subject 在 authoring round 中依法
不存在）。

**Owner 派发的 18 项拒绝构造 → 验收映射**：

```text
1  uid502 直接读取 uid505 store           → ACC-OP-002（negative）/ ACC-OP-008
2  provisioner secret 跨 UID              → ACC-OP-006（negative）
3  root/sudo/launchctl 绕过               → ACC-OP-004（negative）/ ACC-OP-002
4  任意 Agent ID                          → ACC-OP-003
5  任意 shell/command/path                → ACC-OP-001（negative）
6  错误 Spec revision                     → ACC-OP-005（negative (1)）
7  ledger 未持久化即写运行时              → ACC-OP-005（negative (2)）
8  provisioner revalidation 失败后仍执行  → ACC-OP-006（negative (1)）
9  secret 出现在 response/log/tmp/env/argv→ ACC-OP-008 / ACC-OP-009
10 second Client                          → ACC-OP-011（negative (1)）
11 更换 external_ref                      → ACC-OP-011（negative (2)）/ ACC-OP-007
12 terminal success 后第二次执行          → ACC-OP-010（negative (1)）/ ACC-OP-012
13 修改 defaultAgentId                    → ACC-OP-007（negative (2)）
14 创建 enabled Agent                     → ACC-OP-007（negative (1)）
15 创建 Binding/Grant/Root/activation     → ACC-OP-007（negative (3)）
16 operator 崩溃后无法 same-attempt reconciliation → ACC-OP-010（negative (3)）
17 返回其他 Agent 配置或 credential       → ACC-OP-009（negative）
18 operator 演化为通用 privileged API     → ACC-OP-013（negative）
```

## 11. Alternatives and disposition

- **复用既有 uid505 本地控制面 seam（Owner 顺序第 1 项）**：否决——OBS-OP-002
  清点：无 UDS server；broker gateway 进程内无 listener，复用即把单次管理
  operation 混入通用 agent RPC 面且经 localhost TCP（禁止 transport）；spawn
  helper 单向 505→502，非 operation 入口。
- **localhost TCP / 公网 HTTP endpoint**：否决——Owner 冻结 FORBIDDEN；TCP
  无本机 uid 构造性证明，且产生网络监听面。
- **sudo / sudoers / launchctl asuser 包装**：否决——Owner 冻结 FORBIDDEN；
  等于授予 uid502 通用 authsvc 执行权，无法精确限制单一 operation。
- **root host-exec daemon / setuid operator**：否决——引入常驻 root 面；
  operator 全部动作可在 uid 505 完成（OBS-OP-005），无需提权。
- **通用文件 writer（uid502 写请求文件、uid505 轮询执行）**：否决——通用
  文件 writer 禁止；无精确 caller proof（文件属主可伪造上下文）；轮询引入
  TOCTOU。
- **SSH 到 authsvc 账户执行**：否决——SHELL_EXECUTION FORBIDDEN；授予 shell
  即授予全部能力。
- **数据库直写（直接改 auth DB 建 principal/client）**：否决——绕过 S1/S2
  幂等 seam 与全部审计；父 CTR-WA-002 明令禁止。
- **uid502 直接执行 bootstrap（不经通道）**：不可行——全部写入目标 uid505
  属主（OBS-OP-004），且 secret 按 Part H 只能进 uid505 私有 store。
- **独立 operator daemon（新进程）**：否决——与既有「进程内组合优先、未新建
  daemon」拓扑先例冲突；in-process endpoint 足够且状态经 durable 文件不依赖
  进程存活。
- **operator 现场做完整 git fetch/clone 验证 evidence**：否决——新增可写
  状态与攻击面；改为只读 GitHub 验证（DEC-OP-003）。
- **为本次 bootstrap 新建 auth-service provisioner child**：否决——
  AUTH_SERVICE_NEW_PROVISIONER_CHILD_REQUIRED = NO；复用现有 accepted
  provisioner authorities + fresh revalidation（DEC-OP-005）。
- **per-process token/mTLS 认证 caller**：否决——引入 secret 通道
  （SECRET_CROSSES_UID_BOUNDARY = NO）；OS 边界 + exact operation 已闭合
  所需边界（DEC-OP-002）。

## 12. Migration, compatibility, and rollback

- **本轮（authoring）**：docs-only，新增本文件 + README index 行；零代码、零
  运行时写入、零部署。
- **实现轮**：独立 implementation 任务按本 Spec Contracts 实现 operator（新
  代码进入 trusted closure 的方式由 deployment 任务执行）；不修改任何既有
  product 包的语义（operator 是 additive 组合组件）。
- **部署轮**：独立 deployment 任务 + 独立审计；pin 完成且部署门通过前 operator
  保持 disabled；不改变既有 hardening 边界（trusted Node、502 只读、store
  505-private、CP 不打开 dev-repo 文件全部保持）。
- **执行轮**：独立 Bootstrap 执行任务（uid 502 requester 侧）；父 CTR-WA-008
  四条件 + 本 Spec CTR-OP-005 前置全部满足后恰一次。
- **回滚（通道侧）**：随时可禁用 operator（移除 socket / 停用 endpoint）；
  operator state 与全部 durable audit 永不删除（审计事实）。bootstrap 侧失败
  终态继承 `SAFE_DISABLED_STAGED_IDENTITY`（CTR-OP-011）；通道禁用不改变已
  完成阶段的合法终态。
- **权威回滚**：本 Spec 未 accepted ⇒ PR 关闭即无痕；accepted 后撤回需
  whole-authority successor（SPEC_GOVERNANCE_V0 §9.2）。retirement Spec（是否
  删除 socket/code）是后续独立权威。

## 13. Open questions

```text
OPEN_OWNER_DECISIONS = NONE（§0 全部冻结）
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE
DUPLICATE_SPEC_RISK = NONE（OBS-OP-008 零命中）
```

非规范跟进（不改变本 Spec 语义）：operator retirement Spec（terminal success
或永久放弃后是否删除 socket/code）；Bootstrap Spec 既有非规范跟进（activation
authority、target-admission child、Client rotation recovery 权威、部署面
auth-service 修订现场确认）继续由各自权威持有。

## 14. Final Output（authoring round 冻结输出）

```text
AGENT_CORE_WORKFLOW_ADMIN_AGENT_BOOTSTRAP_OPERATOR_V1 = PROPOSED_CANDIDATE
  (docs-only; zero code, zero runtime write, zero secret)

SELECTED_OPERATOR_MODEL =
dedicated local-only Unix-domain operator endpoint (single fixed operation
workflow_admin_agent_bootstrap_v1), composed in-process into the existing
trusted authsvc (uid 505) control-plane runtime within the trusted install
closure; caller authorization = kernel-verified UDS peer credentials
(LOCAL_PEERCRED) restricted to uid 502

OPERATOR_SOCKET_PATH = /usr/local/libexec/agent-core/run/workflow-admin-bootstrap-operator.sock
OPERATOR_STATE_PATH  = /usr/local/libexec/agent-core/config/operator/workflow-admin-bootstrap-v1/state.json
OPERATOR_CONFIG_PATH = /usr/local/libexec/agent-core/config/operator/workflow-admin-bootstrap-v1/operator-config.json

AUTHORIZED_CALLER_UID = 502
OPERATOR_RUNTIME_UID = 505
EXACT_AGENT_ID = agt_workflow-admin-agent
EXACT_OPERATION = workflow_admin_agent_bootstrap_v1
GENERAL_OPERATOR_CAPABILITY = NO
AUTH_SERVICE_NEW_PROVISIONER_CHILD_REQUIRED = NO
SECRET_CROSSES_UID_BOUNDARY = NO
ROLLBACK_TARGET = SAFE_DISABLED_STAGED_IDENTITY
OPERATOR_DEFAULT_STATE = disabled / unavailable until its own deployment gate passes
OPERATOR_AFTER_TERMINAL_SUCCESS = reject all new bootstrap attempts
DOCS_MERGE_DEPLOYS_OPERATOR = NO
SEPARATE_OPERATOR_IMPLEMENTATION_TASK_REQUIRED = YES
SEPARATE_OPERATOR_DEPLOYMENT_AND_AUDIT_REQUIRED = YES
BOOTSTRAP_RUNTIME_WRITE_PERFORMED_IN_THIS_ROUND = NO

CONTRACT_COUNT = 14
CONTRACTS_WITH_ACCEPTANCE = 14
ACCEPTANCE_COUNT = 14
DANGLING_CONTRACT_REFERENCES = 0
UNCOVERED_CONTRACTS = 0
ACCEPTANCE_WITHOUT_FAILURE_CONDITION = 0

AUTHORING_ROUND：PRODUCT_CODE_CHANGE = NONE · OPERATOR_IMPLEMENTED = NO ·
OPERATOR_DEPLOYED = NO · AGENTS_JSON_CHANGE = NO · CREDENTIAL_STORE_CHANGE = NO ·
AUTH_IDENTITY_CREATED = 0 · ATTEMPT_LEDGER_CREATED = NO ·
AGENT_PRINCIPAL_CLIENT_SECRET_CREATED = NO · WORKSPACE_HOME_CREATED = NO ·
BINDING_GRANT_ROOT_CREATED = NO · ACTIVATION_PERFORMED = NO ·
SUDOERS_ACL_OWNER_GROUP_MODE_CHANGE = NO · ROOT_SUDO_LAUNCHCTL_USED = NO ·
AUTH_SERVICE_RESOLUTION_S1_S2_CALLED = NO · MERGE_PERFORMED = NO ·
SECRET_READ_OR_EXPOSED = NO

权威激活路径 = 独立 review PASS + Owner acceptance + merge to main ⇒
  本 Spec 成为 operator 实现/部署/审计与经通道执行的 Bootstrap 单次执行的
  合法实现权威（docs merge 本身零部署零执行）⇒ 独立 implementation 任务 ⇒
  独立 deployment 任务 + 独立审计（gate 通过后 operator 可用）⇒ 独立 Bootstrap
  执行任务在全部前置满足后恰执行一次

NEXT_TASK = 通道 审计（全新的本地审计 Agent 对本 proposed head 做独立 review；
  FRESH_FULL_REVIEW_REQUIRED = YES；MERGE_ALLOWED = NO until review PASS +
  Owner acceptance）
```
