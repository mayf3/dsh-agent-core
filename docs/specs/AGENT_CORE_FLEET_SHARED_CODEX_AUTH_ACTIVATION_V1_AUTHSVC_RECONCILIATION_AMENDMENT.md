---
spec_id: AGENT_CORE_FLEET_SHARED_CODEX_AUTH_ACTIVATION_V1_AUTHSVC_RECONCILIATION_AMENDMENT
status: accepted
accepted_by: mayf3
accepted_date: 2026-09-21
proposed_at: 2026-09-10
amends: AGENT_CORE_FLEET_SHARED_CODEX_AUTH_ACTIVATION_V1（authsvc-domain authority，
        superseded as CURRENT production activation but retained verbatim as
        "the authority for the authsvc domain's own future use"），
        针对 2026-09-10 之后已改变的真实 preimage 做窄范围 fresh reconciliation
parent_authority: AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V3（accepted，superseded_by=null）
supersedes: []
external_evidence: docs/evidence/openai-codex-refresh-token-reused-v1-20260910/（CENSUS/PROBE/B2_APPLY/PHASE_EF_CLOSE/plugin-upgrade r2–r4 review chain）
production_apply_authority: authorized upon acceptance per §4 execution chain
  (armed --apply → feishu REAL canary commit gate → --commit); restart safety gate (Phase D)
  remains a hard precondition before any production mutation
review_gate: Independent review = PASS（r4–r12 chain；r13 closure review PASS/0 gaps 2026-09-20；
  A4 provisioning independent review PASS @ 81382b7 2026-09-2x）→ Owner exact-head acceptance
  = GRANTED 2026-09-21 → merge（docs/specs/）→ 然后方可执行升级脚本
---

> ## ACCEPTANCE RECORD（Owner exact-head acceptance，2026-09-21）
>
> `AMENDMENT_ACCEPTED = YES` —— Owner decision for GOAL
> `OPENAI_CODEX_REFRESH_TOKEN_REUSED_V2_PERMANENT_FIX_PRODUCTION_CLOSURE`：
> 接受范围严格绑定现有已冻结物料与已记录 SHA，不授权语义扩张。本记录为该决定的正式化；
> 正文（§0–§5 + ReviewDisposition）自 r12 起 verbatim 冻结，零语义改动。
>
> `ACCEPTANCE_BOUND_SHAS`（与 G1 marker 同一字段集）：
>
> ```text
> specHead              = <the merge commit of this file into docs/specs/>（40-hex，merge 后回填 marker）
> carrier（r12 script） = 9f835448ded70f1941293bcc194389743fa9b0f3c41442e22b367b0ba2668966
> dsh-codex plugin tgz  = d4f0d0ec794a84d9e3daa346a3a51c5d61a5ebf5504ac0397707d298216dfea2
> codex-deps scopes tgz = 7c628e30f142569916a355b772a311acfbfebf35d8efdb47bf1f1cfda45f8c77
> deploymentRoot        = /Users/authsvc/.agent-core
> txSchema              = 1
> A4 reviewed HEAD      = 81382b7bf591c8cea8f7c5013d253b917f39873f（provisioningCommit binding）
> ```
>
> 接受范围排除：任何未 review 的新字节/新设计；A4 merge 前 semantic delta 须重新独立 review；
> Phase D restart safety gate 保持硬门。


# FLEET SHARED CODEX AUTH — AUTHSVC RECONCILIATION AMENDMENT（DRAFT v2）

> v1 DRAFT（2026-09-10 早）REJECTED：其 A1 事实前提不成立——accepted source pin
> `75d98d5b…` **本身已包含** credentialFile / withOwnerReauth / refresh-intent /
> OpenAICodexReauthRequiredError（已独立拉取该 commit 源码核实，13 处命中）。
> 本 v2 全部重写。

## 0. 一句话

authsvc 92-agent fleet 的 openai-codex 消费从"同一 lineage 复制进 92 个 per-home
store（且在役 plugin 是**未忠实构建 accepted pin 的错误 tgz**）"收敛为
"ONE authsvc-owned canonical store + 从 accepted commit `75d98d5b` **可重复重建并
冻结的 exact-pin artifact**（shared-mode lock+intent+atomic）"，按 ACTIVATION_V1
为本域保留的 authority 语义 + 本修正案的 fresh reconciliation 执行一次。

## 1. 根因修订（ROOT_CAUSE 修正记录）

```text
INCIDENT = OPENAI_CODEX_REFRESH_TOKEN_REUSED_V1
ROOT_CAUSE_CLASS = DUPLICATED_CREDENTIAL_STORE（不变）
CONTRIBUTING_CAUSE = ARTIFACT_PROVENANCE_INSTALL_DRIFT（本修正案新增定性）：
  accepted pin 75d98d5b 支持 shared mode；
  staging tgz（artifactSha256 2d29f95f…）与 92 homes 在役 build（chunk src-0oSwUgNO）
  均为该 pin 的错误/失真构建——无 credentialFile 支持；
  install drift 使 fleet 从未真正运行 accepted authority 的机制。
RE_PIN_REQUIRED = NO
EXACT_PIN_REBUILD_OR_REINSTALL_REQUIRED = YES
```

## 2. 授权变更（accept 后生效）

A1. **Exact-pin artifact rebuild + freeze（完整闭包）**：从 accepted source commit
    `75d98d5b10bb926d53108e49019668c1bde2a9eb`（Yan-Zero/dsh-codex）可重复构建，
    冻结**两份**工件至 `staging/chatgpt-subscription-provider-v1-authsvc/`：
    ① plugin tgz；② 依赖 scopes tgz（@deepseek-ai/@earendil-works，来自 luna-rc8
    harness 的 tested dependency set——构建流程记录于 evidence，消费时零 mutable-source
    拷贝）。两份各自记录 SHA-256；升级脚本 G1/G2 机械验证：marker 绑定 SHA == 冻结
    SHA == 消费 SHA 三方一致 + 解包后 REQUIRED_EXPORTS（credentialFile /
    withOwnerReauth / OpenAICodexReauthRequiredError / refresh-intent）≥ 阈值命中——
    显式拒绝旧错误 tgz。旧 pin `2d29f95f/75d98d5b-build` 登记为
    INSTALL_DRIFT_ARTEFACT（审计），不再作为 authsvc 面工件。
A2. **Canonical-by-deployment-root**（沿 v1 draft，不变）：
    `<deploymentRoot>/shared-credentials/openai-codex/.openai-codex-auth.json`；
    authsvc 面 deploymentRoot=/Users/authsvc/.agent-core。0600/0700、非 symlink、
    nlink=1、no tombstone 边界不变。
A3. **Migration semantics**（载体 = 证据目录 `owner-authsvc-plugin-upgrade.sh` r12（final，已冻结），SHA
    `9f835448ded70f1941293bcc194389743fa9b0f3c41442e22b367b0ba2668966`，accept 时以
    receipt 复核）：**持久事务状态机**
    `PREPARED → QUIESCING → FENCE_CREATING → MUTATING_NO_FENCE → MUTATING_FENCED →
    APPLIED_AWAITING_PONG → COMMITTING → COMMITTED_PENDING_FENCE_CLEAR → COMMITTED` /
    `MUTATING|APPLIED → ROLLING_BACK → ROLLBACK_APPLIED → ABORTED_PENDING_FENCE_CLEAR →
    ABORTED / ABORT_INCOMPLETE`——事务 ID、全部绝对路径、
    script/tgz/closure SHA、manifest digest 持久化于 **root-only 信任域**
    `/var/db/agent-core/authsvc-codex-migration/`（0700 root；TX root:wheel 0600；
    fence+lock 同域；**可恢复锁**：PID + 进程元数据 + 随机 NONCE 元组，存活探测，死锁经**原子 rename 隔离**接管（并发竞争恰一方成功），release 校验 nonce 防误删，锁生命周期与 armed 生命周期解耦）。`--apply` 完成全部
    硬门（bootout 真 quiesce → durable fence → journal 化 freeze [intent fsync →
    atomic rename-away → done fsync + intent-only SIGKILL reconcile；journal 演进期（PREPARED…MUTATING_FENCED）不做 manifest digest 校验，digest 绑定自 APPLIED_AWAITING_PONG（freeze 冻结点）起生效] → current
    版本化 gen 原子切换 [current→GEN_DIR；home→current/dsh-codex；realpath 验证] →
    bootstrap 受控重启 → 92/92 import smoke → 92×effective-credentialFile 机械链
    证明 → zero-per-home-open 硬门 → credential-layer model canary [失败自动回滚]）
    后持久化 `APPLIED_AWAITING_PONG` 并安全解除进程级回滚；Owner feishu REAL
    delivery canary 为 COMMIT GATE：`--commit --transaction <id>` 在
    **全量 topology 重验**（current→GEN_DIR 符号链接、92 home realpath+chain、
    zero-open、runtime 存活）通过后经 `COMMITTING`（**禁止 --abort 竞态**）幂等落 `COMMITTED_PENDING_FENCE_CLEAR`
    → fence clear → `COMMITTED`（receipt 强制 `.txId == 本事务` 绑定，陈旧 receipt
    拒绝；`COMMITTED_PENDING_FENCE_CLEAR` 跨进程可重入续跑）；`--abort` 经 `ROLLING_BACK → ROLLBACK_APPLIED → ABORTED_PENDING_FENCE_CLEAR → ABORTED`，含 marker+归档
    manifest 的**已回滚重入识别**（不重放 rollback_all；`ABORTED_PENDING_FENCE_CLEAR` 同样可重入续跑）；任何中途失败或信号
    （armed 时 ERR/INT/TERM/HUP/EXIT）自动回滚并落 ABORTED/ABORT_INCOMPLETE；
    进程死亡由 re-entry gate（tx 非 TERMINAL → 拒绝新事务，指引
    --commit/--abort reconcile）兜底；tx_load 对加载路径做固定前缀 + 非 symlink
    校验（currentLink 按设计为 symlink，单独校验 target==GEN_DIR）。
A4. **Reprovision 对齐（执行合同，非文字）**：luna-routed home 的 provisioning
    必须持久化 canonical credentialFile（persistOpenAICodexCredentialFile 语义、
    canonical 按 A2 参数化）——provisioning 修正以独立 PR 交付（实现+测试）并作为
    apply 前置 gate（见 §4 第 3 步）；未 merge 期间 fleet homes 重建仍会装回旧
    tgz 工件，故此 gate 不可跳过。

## 3. Fresh reconciliation（本修正案对 preimage 变化的窄范围处理）

2026-09-10 已发生且不可逆的事实：canonical 建立（09:33 owner 登录，lineage
`1d4278a8be53`，access 至 2026-09-20 09:33:56 +0800——**最迟风险边界**，非精确死线）、
92 副本临时收敛（temporary-converge，备份
`control/incident-backups/luna-per-home-20260910-095504`）、fleet config v2 恢复。
本修正案不回滚这些事实，以它们为新的执行 preimage，并要求执行脚本 §0 机械证明：
config v2 / overrides==92 / roster 双射 / canonical 边界与未过期 / tombstone absent。

## 3.5 Draft PR 评审头（2026-09-11，Owner/codex r12 裁定）

```text
status: proposed
production_apply_authority: none
REVIEW_APPROVAL = BLOCKED（until r12 的三项 P0 修复经独立复审确认）
PRODUCTION_EXECUTION = FORBIDDEN
known_blockers:
  1. spec commit / provisioning commit 的远端真伪验证（main ancestry + accepted
     frontmatter + 触及文件核对）——PR 评审 gate
  2. T10B 的 runtime bootstrap 在 probe 模式被短路——真实服务恢复证明需生产
     slot 内受控重启时补证（probe 结果仅证明状态机与文件回滚）
  3. A4 provisioning PR（实现+测试）merge 为 apply 前置 gate（见 A4/§4）
```

## 4. 执行顺序（不可倒置）

1. 本修正案于 docs/specs/ 正式评审 → Owner exact-head accept → merge。
2. Agent 依 A1 从 75d98d5b 构建 + 冻结 plugin tgz 与 scopes tgz（SHA 落 staging + evidence）。
3. **A4 provisioning PR（实现+测试）merge**——作为 apply 前置 gate（防重建漂移）。
4. Owner 落结构化 AMENDMENT_ACCEPTED.marker（绑定 specHead / 脚本 SHA / 两个 tgz SHA /
   deploymentRoot / txSchema——脚本 G1 逐字段核验）→ 执行 `--apply`（armed 退出）。
5. Owner 发 feishu REAL canary → PASS 后 `--commit --transaction <id>`；FAIL 则 `--abort`。
6. final topology census → EMERGENCY_RECOVERY 判定。

## 5. 冻结不变 / 明确不做

（沿 v1 draft §3/§5 全文：one lineage one owner、禁复制 lineage、禁 token surgery、
92 旧 store 留证、无 coordinator 服务、不碰 Workflow/Scheduler/Forum/routing、
yanfenma credential 不给 authsvc 消费。）

## ReviewDisposition

- v1 DRAFT REJECT（Owner/codex 2026-09-10）：A1 前提不成立 + 形态不合法 + 脚本工程 blocker。
- v2 DRAFT 两轮静态审查 REJECT（同日）：r4 七项（quiesce 时序/journal 窗口/gen 删除/分阶段
  canary/SC2320 等）→ r5 修复；r5 五项 P0（跨进程事务/未初始化变量/权限边界/G3 查错对象/
  marker 弱绑定）→ r6 修复；r6 七项（current symlink 校验悖论/TX 信任域/abort 不清 fence/
  终态顺序/topology 重验不完整/载体 SHA 过期/spec gate 自洽）→ **r7 修复**。
- r7 两项（同日）：锁生命周期被 armed trap 覆盖、SIGKILL 锁残留、T7 fixture 失真、
  MUTATING-fence 窗口、归档后 abort 重放、receipt 无 txId 绑定、fence-clear cosmetic、
  TXPROBE 泄漏生产入口 → **r8 修复**（R8 状态机全集 + 可恢复锁 + T8 四组跨 shell 实测）。
- r8 五项（同日）：manifest ABSENT-digest 崩溃拒载、fence 写入窗口、pending 状态无入口、on_lifecycle 不走状态机、锁并发删除/nonce/SHA 失同步 → **r9 修复**。
- r9 三项（同日）：SHA 失同步、manifest ABSENT-digest 崩溃拒载、fence 窗口/pending
  无入口/on_lifecycle 状态机/锁 nonce+并发/Receipt 域 → **r10 修复**（状态感知 current
  校验、四态 no-mutation abort、ROLLING_BACK 归档容忍、lstart 三元组锁 + 双边 trim、
  root-only confirmation、四符号独立导出验证、scope-digests 落盘、EXPECTED_FLEET 门控、
  **T10 双 shell 完整 commit/abort 入口至终态实测**）。
- r10 四项（同日）：shellcheck SC2015、G2 `$SRC` 未定义且 match=FAIL 不生效、rollback 态
  current 校验悖论、跨进程 quiescence 不可见、公开 receipt 绕过确认、scope-digests 时机 →
  **r11 修复**（G2 记录性闭包+无 SRC、ROLLING_BACK 系归 PRE 类、ensure_runtime_running
  真实探测、confirmation 仅 root-only、receipt 移至 COMMITTED 后生成、reentry gate
  tx-aware、shellcheck 清零）。
- r11 三项 P0（同日）：pending-commit resume 依赖公开 receipt、runtime 恢复失败仍落
  ABORTED、on_lifecycle 未复用状态机 → **r12 修复**：统一 abort transition
  （recovery → fence → ensure_runtime_running 必须成功 → ABORTED；失败落
  ABORTED_PENDING_RUNTIME_RESTORE 可重入态）、pending-commit resume 改验 root-only
  confirmation、COMMITTED 后才生成公开 receipt；T10B 升级为跨进程完整 abort 入口实测。
- r12（SHA `9f835448ded7…`，selftest 12 项 + shellcheck 全零）为本修正案 §A3 载体。
