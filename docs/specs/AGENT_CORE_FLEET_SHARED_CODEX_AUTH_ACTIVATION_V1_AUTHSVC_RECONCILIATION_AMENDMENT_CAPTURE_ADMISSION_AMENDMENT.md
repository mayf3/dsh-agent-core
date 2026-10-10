---
spec_id: AGENT_CORE_FLEET_SHARED_CODEX_AUTH_ACTIVATION_V1_AUTHSVC_RECONCILIATION_AMENDMENT_CAPTURE_ADMISSION_AMENDMENT
status: proposed
proposed_date: 2026-10-10
amends: AGENT_CORE_FLEET_SHARED_CODEX_AUTH_ACTIVATION_V1_AUTHSVC_RECONCILIATION_AMENDMENT（accepted 2026-09-21；本部署包内钉住的 accepted-spec-copy-b08db324aa179af962536a804d275866fa2bb7f2.md 即其副本）
parent_authority: AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V3（accepted，superseded_by=null）
supersedes: []
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: authorized upon acceptance per §4 execution chain
review_gate: Independent review → Owner exact-head acceptance → merge（docs/specs/）→ 方可按 §4 执行 r21 链
owners:
  - mayf3
---

# CAPTURE ADMISSION AMENDMENT（依赖采集准入合同修订）

## 0. 一句话

authsvc 域 B7 部署线的 cohort 消费者预采集（`capture-boundaries.mjs` dependencyObservation）对**本部署自己钉住的 dsh-codex-0.2.3 工件**在结构上不可能通过：本修订把依赖准入的三处冻结参数/语义修正为与已接受工件的现实一致——秘密名检查只绑定文件条目、摘除公开名白名单（证据仅记录 custody+摘要、永不记录内容）、共享依赖字节预算重标定——除此之外零语义变更。

## 1. 根因与证据（2026-10-10 部署执行链，全部为已执行 Observation）

部署执行（r20，op b7-packet-r20-5316903e3f7838b5，tx-1146f06f602e4d2bb15f3d0e61ff12e1）首次到达外层 stageAndSeal 后，被 `SIX_TARGET_BATCH_INCOMPLETE` 拒止。逐层定位（脱敏记录见 #424 2026-10-10 评论链）：

```text
OBS-1 六个消费者（agt_data-engineer / family-insurance-manager / investment-manager /
      lw-lifecycle-canary / machine-learning-engineer / technical-writer，即 2026-10-07
      B7_SIX_FIXED_SCOPE_USER_AUTHORIZED_20261007 批次的目标六家）以同参数复刻采集，
      全部 THROW DEPENDENCY_SECRET_PATH。
OBS-2 触发物为钉住工件 dsh-codex-0.2.3-release.tgz（sha256 869b8e64…，2409 个条目）
      自带的 @aws-sdk 依赖树内 1599 个 aws-sdk 路径，其中 `dist-*/auth` 源码目录命中
      secretName 启发式的裸名 `auth` 规则。六家现装插件与钉住 tgz 逐字节一致
      （lib/index.js = e1b22e29…），非误装。
OBS-3 形态穷尽：真实目录形态 → DEPENDENCY_SECRET_PATH；符号链接（受管）形态 →
      插件读取 chain() 拒绝中间符号链接组件（INPUT_SYMLINK）；硬链接 → nlink!=1 →
      DEPENDENCY_UNSUPPORTED。按冻结合同三种形态全部不可采集（完全死锁证明）。
OBS-4 修复秘密名层后暴露第二层：公开名白名单缺 11 类扩展/命名（.py×113、.json×56、
      .sh×22、.sha256×10、.log×11、.d.mts、.tmpl、.marker、.sql、.jsonl、.c、.patch、
      无扩展×4；合计 223 个非秘密文件被 DEPENDENCY_NOT_PUBLIC 拒止；秘密文件 0、
      非法类型 0）。钉住工件为整仓冻结快照（含 .agents/、.gitignore 等）。
OBS-5 修复前两层后暴露第三层：共享依赖字节预算 512MB < 六家 × 176MB = 1059MB，
      字母序末两家 DEPENDENCY_BOUND。
OBS-6 三处修正（§2）落地于沙盒同构副本后，全量 collectCohortPre（98 ids、含 harness
      闭包）PASS：noHome=[]、blocked=[]、harnessClosure.treeSha256=4fa78d38…（1178
      entries）；负例保持：auth/ 目录内 .env 文件仍正确整体拒收（DEPENDENCY_SECRET_PATH）。
CLM-1（SUPPORTED）上述三处为"冻结合同 vs 已接受工件"的潜在漂移，非执行误操作；
      原 10-08 执行线因死于更早的准入门而从未暴露。
```

## 2. 规范修订（normative delta）

仅修订 cohort 依赖采集准入（`capture-boundaries.mjs` dependencyObservation 及其 limits），其余冻结语义零变更：

```text
C1 秘密名准入只绑定文件条目。目录条目即使名字命中 secretName（auth/settings/
   tokens/secrets/credentials 类裸名）也一律递归；其内任何秘密名【文件】仍然
   整体拒收采集（DEPENDENCY_SECRET_PATH，行为与现状一致）。
C2 摘除公开名白名单（publicName/DEPENDENCY_NOT_PUBLIC/deferredVerdicts/.bin
   shebang 检查）。依赖证据只记录 custody 元数据与内容摘要（sha256），从不记录
   文件内容本身；因此对非秘密文件的 admitted 采集不构成机密性暴露。秘密名文件
   依旧拒收（不读、不采）。
C3 共享依赖字节预算从 512MB 重标定为 4GB；单根上限 256MB、每根条目上限 50000、
   maxConsumers 256 均不变。依据：六个 0.2.3 消费者实测 6×176MB=1059MB，
   4GB ≥ 3.7× 实测并保留增长余量。
不变项（显式）：bounds（bytes/entries）、INPUT_CHANGED 三次校验、chain()/
   INPUT_SYMLINK 路径链规则、stableChain、CANONICAL_CUSTODY、publicProfile 的
   stub 字节准入、秘密名【文件】拒收语义、schema 检查。
```

## 3. 验收映射

```text
AC-1 C1 正例：auth/ 目录仅含公开内容文件 → 采集 PASS。
     Method=dependencyObservation；Environment=沙盒同构副本；Required evidence=
     执行记录；Expected=无 DEPENDENCY_SECRET_PATH；Failure=出现该拒止。
AC-2 C1 负例：auth/ 目录含 .env → 整体拒收。
     Expected=DEPENDENCY_SECRET_PATH；Failure=采集通过。
AC-3 C2 正例：含 .py/.sh/.d.mts/.agents/ 的真实钉住工件树 → PASS（本提案已实测，
     6 家 preRows=6、missing=null）。
AC-4 C2 负例保留：秘密名文件（.env/.npmrc/id_rsa 等）→ 拒收不变。
AC-5 C3：六家 + harness 闭包全量采集 PASS（已实测 blocked=[]）。
     Failure=任一消费者 readiness=BLOCKED 或闭包缺 treeSha256。
AC-6 回归：INPUT_SYMLINK/INPUT_CHANGED/bounds 行为与本修订前一致（负例任取）。
```

## 4. 实现授权与执行链（implementation_authority: contracts）

本修订被 Owner exact-head 接受并合入 docs/specs/ 后，以下实现被授权：

```text
I1 在 Documents 应用源仓（appSource，当前 pin head 5e44edd5…/tree db9da59e…）按
   §2 落地 capture-boundaries.mjs 的精确 delta（§2 即其规范文本），提交为新 head。
I2 按原打包合同重生成：pack provenance 回执、app/operation 工件摘要、
   SOURCE-CONTENT.sha256、INSTALL-PINS.json、SEED 模板。
I3 下一代部署包（r21）：PACKET.json/stage 常量/CI/SS/mf/files 行按既有代际配方
   重 pin；pair 安装 → 注册 → 以 r20 保留事务合同为模板重新进入 Owner 执行。
I4 执行链复用既有合同：placement → checkpoint → validateAppSource → 外层 →
   seal → apply → Owner 见证（MY_SESSIONS/PONG）→ 终态。r20 的 RETAINED 事务
   因插件内容随 I1-I2 变化而不可复用其放置树时，按既有代际处置惯例清理并由
   r21 全新进入；r20 的执行记录保留为证据。
前置条件：实现 PR 的 base 中必须已含本修订的 accepted 文本（docs-first）。
```

## 5. 非目标

不修改秘密名【文件】拒收语义；不放宽 INPUT_SYMLINK/chain/custody 规则；不变更
seal/apply/六件套批次的任何既有语义；不追溯重写任何既有接受记录；不为其它域或
其它工件授权任何新行为。本修订仅使已接受钉住工件在其自身部署合同下可被采集。

---

## ACCEPTANCE RECORD（Owner exact-head acceptance——接受后回填）

```text
AMENDMENT_ACCEPTED = YES/NO
accepted_by = mayf3
accepted_date = <date>
accepted_head = <merge commit of this file into docs/specs/>
bound evidence = #424 2026-10-10 评论链（r20/resume/死锁证明/沙盒验证）
```
