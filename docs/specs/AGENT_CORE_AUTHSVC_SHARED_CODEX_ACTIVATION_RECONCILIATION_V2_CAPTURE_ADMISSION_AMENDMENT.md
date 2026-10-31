---
spec_id: AGENT_CORE_AUTHSVC_SHARED_CODEX_ACTIVATION_RECONCILIATION_V2_CAPTURE_ADMISSION_AMENDMENT
status: proposed
proposed_date: 2026-10-10
amends: AGENT_CORE_AUTHSVC_SHARED_CODEX_ACTIVATION_RECONCILIATION_V2（accepted 2026-10-04，PR #452；本修订为其窄范围 successor-amendment，未列出的 V2 条款全部原样保留）
parent_authority: AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V3
supersedes: []
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
source_preparation_authority: accepted contracts once merged into implementation base
operation_scope: existing Product 414 B7 deployment only
review_gate: independent exact-head review PASS → Owner exact-head acceptance → merge（docs/specs/）→ 方可作为 source-preparation 合同进入实现基座
owners:
  - mayf3
---

# CAPTURE ADMISSION AMENDMENT（v2 依赖采集准入修订）

## 0. 一句话

在本域现行权威 RECONCILIATION_V2 的 cohort 预采集实现（`capture-boundaries.mjs` dependencyObservation）之上做窄范围修订：秘密名准入只绑定文件条目；为已核实的钉住 dsh-codex 工件（A1 钉住 tgz，sha256 869b8e64…）的**精确成员**（路径+摘要，21737 项）建立唯一额外准入例外；共享依赖字节预算按实测重标定。除此之外公开名白名单、秘密文件拒收、路径链/链接、内容漂移、边界等全部检查原样保留。

本文件合并进入实现基座后，仅作为 **source-preparation 合同**生效（V2 `source_preparation_authority` 语义）。`production_apply_authority: none` 不变：规范接受不授予任何生产执行权；生产操作仍需 V2 §5 的既有精确 operation mandate 与工件/marker 绑定。

## 1. 根因与证据（2026-10-10 部署执行链；完整哈希/diff/命令结果见私有 #424 2026-10-10 评论链）

部署执行（r20）首次到达外层 stageAndSeal 后被 `SIX_TARGET_BATCH_INCOMPLETE` 拒止。逐层定位：

```text
OBS-1 六个固定范围目标消费者（2026-10-07 六件套批次 B7_SIX_FIXED_SCOPE_
      USER_AUTHORIZED_20261007 的目标集，即 R∖F：runtime_env 路由消费者；
      身份绑定于私有 operation packet，本公开文档不列）以同参数复刻采集全部
      THROW DEPENDENCY_SECRET_PATH。
OBS-2 触发物为已接受钉住工件 dsh-codex-0.2.3-release.tgz（A1 钉住 sha256
      869b8e64…）自带的 @aws-sdk 依赖树（1599 个 aws-sdk 路径）：`dist-*/auth`
      源码目录命中 secretName 裸名 `auth` 规则。六家现装插件与钉住 tgz 逐字节
      一致（lib/index.js=e1b22e29…），非误装。
OBS-3 形态穷尽（完全死锁证明）：真实目录→DEPENDENCY_SECRET_PATH；受管符号链接
      →插件读取 chain() 拒收中间链接（INPUT_SYMLINK）；硬链接→nlink!=1→
      DEPENDENCY_UNSUPPORTED。
OBS-4 修秘密名层后暴露：公开名白名单对钉住工件内容不足（实测非秘密文件跨
      .py×113/.json×56/.sh×22/.sha256×10/.log×11/.d.mts/.tmpl/.marker/.sql/
      .jsonl/.c/.patch/无扩展等 11+ 类被 DEPENDENCY_NOT_PUBLIC 拒止；秘密文件 0）。
OBS-5 修前两层后暴露：共享依赖字节预算 512MB < 六家实测 6×176MB=1059MB
      （末两家 DEPENDENCY_BOUND）。
OBS-6 本修订三条 Contract 于沙盒同构副本（放置树工具副本 + 钉住 tgz 成员清单）
      全量验证：全 registry（98 ids）collectCohortPre noHome=[]、blocked=[]、
      harness 闭包 treeSha256=4fa78d38…（1178 entries）；负例 AC-2/3/4 全部正确
      拒收（见 §3）。完整工具/工件哈希、最小 diff、命令结果存私有 #424。
U-1 已核（2026-10-10）：R=98（registry 非禁用全集）、F=92（v2 config overrides
    键集，= V2 legacy 迁移集）、六件套批次目标集 = R∖F（6，runtime_env 路由）。
    集合精确闭合，无代换。批次目标不是 F-集成员（本文件初稿 OBS-1 的措辞已按此
    修正）。
U-2 r20 保留事务（tx-1146f06f…）在新工具字节下能否复用——未核（r20 包 pin 的是
    修订前工具）；任何生产进入都按 V2 operationBinding 重新绑定。
CLM-1（SUPPORTED）三处为"冻结合同 vs 已接受工件"的潜在漂移，非执行误操作；
      原 10-08 线死于更早准入门，从未暴露此层。
```

## 2. 规范修订（normative delta）

仅修订 cohort 依赖采集准入（dependencyObservation 及 collectCohortPre limits）；其余 V2 条款与其携带的 A1–A4 义务零变更。

```text
C1 秘密名准入只绑定文件条目：目录条目名命中 secretName（auth/settings/tokens/
   secrets/credentials 类裸名）一律递归；其内任何秘密名【文件】仍整体拒收
   （DEPENDENCY_SECRET_PATH，语义不变）。
C2 钉住工件成员例外：非公开名文件获得准许，当且仅当
   (a) 其相对路径以 `dsh-codex/` 为前缀，且
   (b) 其（相对路径，sha256）精确命中钉住工件成员清单——该清单由 A1 钉住 tgz
       （sha256 869b8e64…）的全体文件成员生成（实测 21737 项；清单文件自身的
       sha256 与生成方法绑定进实现 pin），采集时逐文件核对摘要。
   成员清单之外或摘要不符 → DEPENDENCY_NOT_PUBLIC（不变）。原有 .bin 启动器
   shebang 准入规则原样保留并优先。秘密名文件、秘密名【文件】、路径链
   （chain/INPUT_SYMLINK）、INPUT_CHANGED 三次漂移校验、bounds 全部不变。
C3 共享依赖字节预算 512MB → 4GB；单根 256MB、每根条目 50000、maxConsumers 256
   不变。依据：六家 × 176MB = 1059MB（OBS-5），4GB ≥ 3.7× 实测并留增长余量。
```

## 3. 验收映射（全部已按本提案沙盒实测）

```text
AC-1 C1/C2 正例：六家现装（与钉住 tgz 逐字节一致）全量采集 → readiness=
     PRE_OBSERVATIONS_ONLY、preRows=6、missing=null（实测 PASS）。
AC-2 C1 负例：auth/ 目录内 .env → 整体拒收 DEPENDENCY_SECRET_PATH（实测拒收）。
AC-3 C2 负例 A：成员清单外的非公开名新文件（dsh-codex/EXTRA-*.json）→
     DEPENDENCY_NOT_PUBLIC（实测拒收）。
AC-4 C2 负例 B：清单内成员被篡改（parser.d.mts 追加字节）→ 摘要不符 →
     DEPENDENCY_NOT_PUBLIC（实测拒收）。
AC-5 C3：全 registry 98 ids + harness 闭包 → blocked=[]、闭包 treeSha256 在位
     （实测 PASS）。
AC-6 回归：.bin 启动器 shebang 准入（闭包 .bin/acorn PASS）、INPUT_SYMLINK/
     INPUT_CHANGED/bounds 行为与本修订前一致。
```

## 4. 实现边界（source-preparation only；不含生产授权）

本修订合入实现基座后，**仅**授权以下 source-preparation 合同：

```text
I1 在实现基座按 §2 落地 capture-boundaries.mjs 的精确 delta；提交绑定新 head。
I2 按原打包合同重生成：成员清单文件的生成与 pin、pack provenance、app/operation
   工件摘要、SOURCE-CONTENT.sha256、INSTALL-PINS.json、SEED 模板。
```

**显式不含（每次均需其自身的既有授权路径，不接受规范合并视为批准）：**
放置树/既有保留对象的处置（含 r20 的 holder、放置树、seed）、holder 清除、
任何 UNKNOWN/RETAINED 事务的重放或新开部署代际、任何生产 apply/激活/业务请求。
生产进入仍按 V2：exact operation mandate + operationBinding + accepted
artifact/marker 绑定，且 U-1/U-2 未核事项须先对齐。

## 5. 非目标

不修改秘密名【文件】拒收语义；不放宽 INPUT_SYMLINK/chain/custody/INPUT_CHANGED；
不变更 seal/apply/六件套批次语义；不重写任何既有接受记录；不披露私有 packet 的
身份与路径；除 C1–C3 外不为任何对象授权任何新行为。

---

## ACCEPTANCE RECORD（Owner exact-head acceptance，2026-10-10）

```text
AMENDMENT_ACCEPTED = YES
accepted_by = mayf3（Owner 于部署会话中审阅最终 head 并指令"继续"——接受指示，2026-10-10）
reviewed_head = 83c857e0af83f6feafb131d5756b21dec387cde8
accepted_date = 2026-10-10
accepted_head = 7bf2958afbdf86b2971780dbc00035b8b4f26cfe（merge commit，2026-10-10）
bound evidence = #424 2026-10-10 私有评论链（r20/resume/死锁证明/沙盒验证/哈希与 diff）
P1 处置 = 两条均已在 83c857e0 修复并回复（4236822753/4236822993）
```
