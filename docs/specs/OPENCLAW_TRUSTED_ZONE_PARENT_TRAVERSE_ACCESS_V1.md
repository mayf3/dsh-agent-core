---
spec_id: OPENCLAW_TRUSTED_ZONE_PARENT_TRAVERSE_ACCESS_V1
status: proposed
date: 2026-08-24
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
production_apply_authority: none
scope:
  - exactly one directory-level ACL mutation on /Users/yanfenma/.openclaw itself (add one non-inherited ACE granting the frozen production child identity uid 502 traverse+readattr) as the precondition enabler for the accepted in-place Workspace cutover lines
  - preservation of the 2026-08-09 trusted-zone parent boundary (owner authsvc:authsvc, mode 0700, existing 3 ACEs, no list, no write, no recursion, no content mutation, no group-ACL reliance, no spawn-helper change)
  - canary-first staged production apply transaction (first canary agt_build-in-public-agent), evidence methodology under the real helper child identity, and exact single-ACE rollback
governed_by:
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
external_authorities:
  - repository: mayf3/openclaw-adc-canary-extension
    authority_id: OPENCLAW_TRUSTED_ZONE_PARENT_OWNERSHIP_FIX_V1
    revision: 07129f381a2deeca78e4330f6c48e5bb86510f03
    relation: constrained_by
supersedes: []
superseded_by: null
owners:
  - mayf3
references:
  - docs/investigations/openclaw-ancestor-traverse-drift-v1.md (穿越 调查, 2026-08-24: single root cause confirmed, helper child probe matrix, getgroups illusion identified, SELECTED_REPAIR_MODEL = B frozen; read-only evidence authority, commits no implementation permission)
  - docs/reports/build-in-public-canary-home-boot-audit-v1.md (启动 审计, 2026-08-24: first production-child-identity EACCES reproduction; HOME/HARNESS/PROVIDER excluded; 映射 执行 declared BLOCKED)
  - docs/specs/AGENT_PRIMARY_WORKSPACE_OPENCLAW_COMPATIBILITY_V3.md (accepted @f02691c, merged 6ec83fa: exact-86 in-place Workspace authority; its frozen object is the Workspace itself, not the .openclaw ancestor directory; NOT modified by this Spec)
  - docs/specs/AGENT_TRUSTED_FLEET_CUTOVER_V1.md (accepted @eb2189c, merged at 344975d: fleet cutover plan whose path-traversal preconditions this repair unblocks; NOT modified by this Spec)
  - docs/specs/AGT_CTO_AGENT_PRIMARY_WORKSPACE_OPENCLAW_IN_PLACE_V1.md (accepted @06feadf, merged at 73ec666: single-Agent companion line sharing the same ancestor directory; NOT modified by this Spec)
  - scripts/dsh-agent-spawn-helper.c (frozen TRUSTED_CREDENTIAL_BROKER child identity contract uid 502 / gid 20 with supplemental groups cleared; unchanged by this Spec)
---

# OPENCLAW_TRUSTED_ZONE_PARENT_TRAVERSE_ACCESS_V1 — historical OpenClaw trusted-zone 根目录 production child 穿越权限修复（单目录最小 authority）

> **PROPOSED / DOCS-ONLY / NO IMPLEMENTATION OR PRODUCTION AUTHORITY.**
>
> 本 Spec 是**目录边界（directory-bounded）的独立最小 authority**：唯一 mutation 对象是
> `/Users/yanfenma/.openclaw` 这一个目录自身的 ACL——恰追加一条非继承 ACE
> `user:yanfenma allow search,readattr`，使 frozen production child 身份（uid 502 /
> gid 20，补充组恒空）能够穿越该祖先目录到达 exact historical OpenClaw Workspaces。
> 该故障是 2026-08-24「穿越 调查」确认的单一根因：exact Workspace 下
> `process.cwd()`/`getcwd` EACCES → child 在 plugin tree load 前退出 →
> fleet/cto 两条已 accepted 的 in-place cutover 线的路径穿越前置全部 BLOCKED。
>
> 本 Spec **不是**对任何既有 accepted Spec 的修改、amendment 或 supersession：
> V3 / fleet cutover / AGT_CTO 三条 authority 冻结的对象都是 Workspace 本体与接管
> 控制面，均未治理 `.openclaw` 祖先目录的 owner/mode/ACL（见 §8 OBS-TZ-006）；把
> trusted-zone 边界义务塞进其中任何一个都构成 scope 扩张，违反 SPEC_FORMAT_V0 §14.2
> 对 AMEND 的前提，必须走 NEW（§14.3）。`supersedes: []`；无 partial supersession。
>
> 本 Spec 同时受外部边界 authority **约束**（`constrained_by`）：
> `mayf3/openclaw-adc-canary-extension` 侧 2026-08-09 执行的
> `OPENCLAW_TRUSTED_ZONE_PARENT_OWNERSHIP_FIX_V1`（report 随该 repo
> `07129f381a2deeca78e4330f6c48e5bb86510f03` 存档，执行 commit `e495785`）把
> `~/.openclaw` 归 `authsvc:authsvc`（mode 700）以关闭 uid502 对 trusted 顶层条目的
> create/unlink/rename/replace 与 secret 读取。本 Spec 的修复**必须完整保持**该边界
> 目标（DEC-TZ-002 / CTR-TZ-003）；不重开、不削弱、不替代该外部 authority。
>
> 本轮（authoring）：只写本 Spec 一个文件。不修改 production、owner、mode、ACL、
> Workspace、Runtime、`primary-workspaces.json`、Binding、spawn-helper；不实现、
> 不 production apply、不 accept、不 merge。`status: proposed`、
> `implementation_authority: none`、`production_apply_authority: none` 是初始冻结
> 状态，不得由 authoring agent 自行翻转。

## 0. Authoring record

```text
TASK_NAME = 穿越 执行
TASK_TYPE = 执行
TASK_SCOPE = DOCS_ONLY_SPEC_AUTHORING
SPEC_GOVERNANCE_MODE = AUTHOR
SPEC_ID = OPENCLAW_TRUSTED_ZONE_PARENT_TRAVERSE_ACCESS_V1
STATUS = proposed
AUTHORITY_RELATION = NEW_INDEPENDENT_CHILD_AUTHORITY
SUPERSEDES = []（none；无 partial supersession）
IMPLEMENTATION_AUTHORITY = none
PRODUCTION_APPLY_AUTHORITY = none
IMPLEMENTATION_ALLOWED_NOW = NO
PRODUCTION_APPLY_ALLOWED_NOW = NO
READY_FOR_INDEPENDENT_REVIEW = YES
NEXT_TASK = 穿越 审计
```

## 1. Goal

把「穿越 调查」确认的单一根因与 Owner 选定的最小修复（Model B）冻结为 repository
authority：在不改变 `/Users/yanfenma/.openclaw` 属主（authsvc:authsvc）、模式（0700）
与既有 3 条 ACL 的前提下，**恰追加一条目录生效、非继承的**
`user:yanfenma allow search,readattr` ACE，使 frozen production child 身份
（uid 502 / gid 20 / 补充组恒空）获得且仅获得对该目录的穿越（search）与自身
metadata stat（readattr），从而：

```text
CHILD_TRAVERSE_ENABLED   = YES（穿越 .openclaw；getcwd = exact Workspace；
                            路径解析到达 Workspace 子树）
TRUSTED_ZONE_BOUNDARY    = PRESERVED（uid502 无 list、无任何写权；
                            trusted 文件 0600 不可读；authsvc owner 权限不减）
CUTOVER_LINES_UNBLOCKED  = PRECONDITION-ONLY（fleet / cto 线的路径穿越前置
                            恢复可满足；本 Spec 不执行任何 cutover 步骤）
```

本 Spec 的授权范围是且仅是这**一个目录的一条 ACE**；它不是 cutover authority、
不是 mapping/Binding authority、不是 Workspace 内容 authority、不是 spawn-helper
authority。

## 2. Scope and non-goals

### 2.1 In scope

- 冻结目标目录现状（owner/group/mode/既有 ACL 的 exact 文本）为 mutation 前置断言；
- 冻结 Model B 的恰一条 ACE mutation 语义（含全部禁止项）；
- 冻结修复后的安全边界断言（child 能/不能做什么；authsvc 语义不变）；
- 冻结证据方法论：一切修复前后验证必须在**真实 production spawn-helper child 身份**
  下执行，`id` / `getgroups()` 输出不得当作 VFS 授权成立的证据；
- 冻结 canary-first staged production transaction（第一 canary =
  `agt_build-in-public-agent`）与其不可弱化的顺序、exact rerun NOOP、失败回滚；
- 冻结修复 transaction 的纯净性：ACL 修复本身不得顺手写 mapping / Binding / 任何
  控制面状态。

### 2.2 Non-goals / forbidden（本轮与本 authority 边界）

```text
PRODUCT_CODE_CHANGE        = NONE
SCRIPT_CHANGE              = NONE（含 spawn-helper：不重编译、不重装、不改契约）
ACL_CHANGE                 = NONE（本轮 authoring 零执行）
OWNER_CHANGE               = NONE
MODE_CHANGE                = NONE
PRODUCTION_CHANGE          = NONE
PRIMARY_WORKSPACES_CHANGE  = NONE（本 authority 不写 primary-workspaces.json）
BINDING_CHANGE             = NONE（本 authority 不写 Binding）
AGENTS_JSON_CHANGE         = NONE
RUNTIME_RELOAD             = NO
WORKSPACE_FILE_CHANGE      = NONE（本 authority 全程；RECURSIVE_MUTATION = NONE；
                              CONTENT_MUTATION = NONE）
MAPPING_EXECUTION          = OUT_OF_SCOPE（映射 执行 是独立线；本 Spec 只解除其
                              路径穿越前置 BLOCKED，不执行它）
FLEET_ROLLOUT              = OUT_OF_SCOPE（fleet 85-agent rollout 由 fleet authority
                              线治理）
CTO_CUTOVER_EXECUTION      = OUT_OF_SCOPE（AGT_CTO 线 T1–T9 由其自身 authority 治理）
OPENCLAW_RUNTIME_START     = FORBIDDEN（historical OpenClaw Runtime 保持停止，
                              对齐 V3 CTR-OW-005）
OTHER_DIRECTORY_WIDENING   = FORBIDDEN（本 authority 不得用于 .openclaw 以外的任何
                              目录；不得用于任何其他 OS 用户）
ACCEPT_OR_MERGE            = FORBIDDEN_THIS_ROUND
```

## 3. Authority and dependencies

### 3.1 Authority map

```text
Repository governance       = AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0 (accepted)
Trusted-zone boundary       = OPENCLAW_TRUSTED_ZONE_PARENT_OWNERSHIP_FIX_V1
                              (external, mayf3/openclaw-adc-canary-extension
                               @07129f3；执行 commit e495785；本 Spec constrained_by
                               ——保持其边界目标，不重开)
Fleet workspace authority   = AGENT_PRIMARY_WORKSPACE_OPENCLAW_COMPATIBILITY_V3
                              (accepted @f02691c，merged 6ec83fa —— 不因本 Spec 修改)
Fleet cutover plan          = AGENT_TRUSTED_FLEET_CUTOVER_V1
                              (accepted @eb2189c，merged at 344975d —— 不因本 Spec 修改)
CTO companion line          = AGT_CTO_AGENT_PRIMARY_WORKSPACE_OPENCLAW_IN_PLACE_V1
                              (accepted @06feadf，merged at 73ec666 —— 不因本 Spec 修改)
This Spec (proposed)        = OPENCLAW_TRUSTED_ZONE_PARENT_TRAVERSE_ACCESS_V1
                              （.openclaw 祖先目录穿越权限的最小 authority；
                                proposed 阶段零 authority）
Child identity contract     = scripts/dsh-agent-spawn-helper.c（frozen
                              TRUSTED_CREDENTIAL_BROKER 契约：uid 502 / gid 20、
                              setgroups(0,NULL) 清空补充组、root:wheel 4755 —— 零修改）
Evidence authorities        = docs/investigations/openclaw-ancestor-traverse-drift-v1.md
                              + docs/reports/build-in-public-canary-home-boot-audit-v1.md
                              （read-only evidence；不授予实现权限）
```

### 3.2 Authority relation（判定记录）

- **AMEND 不可行**：V3 / fleet / AGT_CTO 都是 accepted Spec；SPEC_FORMAT_V0 §14.2
  要求 AMEND 的 scope 与 authority ownership 不变。`.openclaw` 祖先目录 ACL 是三者
  scope 之外的新对象；为其追加义务属于「new independent obligation」，§14.3 明确
  要求 NEW。
- **SUPERSEDE / whole-authority replacement 不可行**：没有任何既有 authority 被
  替换——V3 仍是 fleet Workspace authority，fleet / AGT_CTO 计划原样有效；本 Spec
  与它们是**使能（precondition enabler）关系**，不是替代关系。
- **Partial supersede**：`supersedes: []`，无任何 backlink 义务；对 V3 / fleet /
  AGT_CTO 零文本修改。
- 结论：**新独立 child authority**（与 AGT_CTO 作为「单 subject companion」的先例
  同构，本 Spec 是「单目录 companion」）。

### 3.3 Implementation / production gates

本 Spec `proposed` 阶段：`IMPLEMENTATION_ALLOWED_NOW = NO`、
`PRODUCTION_APPLY_ALLOWED_NOW = NO`。任何 ACL mutation 必须同时满足：

1. 本 Spec 经独立 review（穿越 审计）并由 authorized maintainer 合法 accepted，
   且 accepted snapshot 进入 main；
2. `production_apply_authority = none` 不因 acceptance 自动升级——production apply
   仍需独立的 production run approval / 执行轮（owner 以 sudo 执行单条 ACE 追加）；
3. 执行轮以实际 pre-state 重定基线（§6 G1：若 `.openclaw` 现状与本 Spec §5 冻结值
   不符，STOP 并回到 owner 裁决，不得在漂移状态上直接套用）。

缺一项即 `PRODUCTION_APPLY_ALLOWED = NO`。

## 4. Frozen repair（Model B，逐字冻结）

```text
TARGET_PATH = /Users/yanfenma/.openclaw

CURRENT_OWNER = authsvc
CURRENT_GROUP = authsvc
CURRENT_MODE  = 0700

EXISTING_ACL_PRE（3 条，mutation 前必须逐条在场；任何缺失/多出 → STOP 重定基线）：
  0: user:yanfenma allow list,add_file,add_subdirectory,readattr,writeattr,readextattr,writeextattr,file_inherit,only_inherit
  1: group:oc-canary allow list,search,readattr,readextattr
  2: user:oc-canary-runtime allow search

SELECTED_REPAIR_MODEL = B

EXACT_ACE（恰一条；本 authority 的全部 mutation 面）：
  user:yanfenma allow search,readattr

EXACT_COMMAND_FORM（执行轮 owner 以 sudo 执行；语义冻结，非本轮执行）：
  chmod +a "user:yanfenma allow search,readattr" /Users/yanfenma/.openclaw

ACE 约束（逐项冻结）：
  NOT_ONLY_INHERIT          —— 不带 only_inherit（目录生效，非仅继承）
  NO_INHERIT_FLAGS          —— 不带 file_inherit / directory_inherit（不递归；
                               对本目录生效，对未来子项零影响）
  NO_LIST                   —— 不授予 list（比既有 group:oc-canary ACE 更紧：
                               child 不能枚举 .openclaw 顶层条目）
  NO_FILE_CONTENT_READ      —— readattr 仅 stat 本目录 metadata；不授予读任何
                               文件内容（trusted 文件自身 0600 继续不可读）
  NO_WRITE_PERMS            —— 不授予 writeattr / add_file / add_subdirectory /
                               delete_child / writeextattr 等任何写权
  NO_OTHER_ACE_MODIFICATION —— 既有 3 条 ACE 原样保留，零改动
  NO_OWNER_GROUP_MODE_CHANGE —— owner = authsvc / group = authsvc / mode = 0700
                               全程不变
  NO_RECURSION              —— 不递归；不触碰任何子目录或文件
  NO_GROUP_ACL_RELIANCE     —— 不依赖 group ACL（对 helper child 实证不可靠）
  NO_SPAWN_HELPER_CHANGE    —— 不修改 spawn-helper（契约冻结）

RECURSIVE_MUTATION = NONE
CONTENT_MUTATION   = NONE
WORKSPACE_FILE_CHANGE = NONE
```

充分性依据（调查 §4 已证）：Workspace 本体（0700 yanfenma:staff）、`memory/`
（0700 yanfenma:staff）、`.openclaw/.git`（0755 yanfenma:staff）在获得祖先穿越后
对 child 全部可用；uid502 的 POSIX owner 匹配在 VFS 层对 helper child 有效已由
`.openclaw-cli/cli-config.json`（0600，不在 .openclaw 下）可读探针证明。

## 5. Current State

- `STATE-TZ-001` — `/Users/yanfenma/.openclaw` 现为 `authsvc(505):authsvc(601)`
  `drwx------`（0700），带 §4 所列 3 条 ACL（user:yanfenma 条目 only_inherit 且无
  search；group:oc-canary 条目对 helper child 无效；user:oc-canary-runtime 非本 uid）。
  observed at 2026-08-24（调查 §1 + 本轮 authoring 时 live stat 复核一致）。Basis:
  `OBS-TZ-001`, `EVD-TZ-001`。
- `STATE-TZ-002` — frozen production child（uid 502 / gid 20 / 补充组恒空，唯一合法
  spawn 路径 = `/usr/local/libexec/dsh-agent-spawn-helper`，root:wheel 4755，
  `setgroups(0,NULL)` → `setgid(20)` → `setuid(502)`，仅接受 502/20，其他 uid/gid
  拒绝）对 `.openclaw` 无有效 search：child 身份 stat 子路径 / getcwd / read 全
  EACCES。Basis: `OBS-TZ-002`, `OBS-TZ-003`, `EVD-TZ-002`。
- `STATE-TZ-003` — production child boot 到达 exact Workspace 时在 plugin tree load
  前退出（`loadLayeredEnv` `process.cwd()` EACCES，exit 1；Phase D 隔离证明 Home /
  插件树 / provider 非因果）。Basis: `OBS-TZ-004`, `EVD-TZ-003`。
- `STATE-TZ-004` — 既有 accepted cutover authorities 均未治理 `.openclaw` 祖先目录
  ACL；映射 执行 被记录为 BLOCKED（路径穿越前置必失败）。Basis: `OBS-TZ-006`,
  `OBS-TZ-007`, `EVD-TZ-005`。
- `STATE-TZ-005` — drift provenance：`.openclaw` 属主自 2026-08-09
  `OPENCLAW_TRUSTED_ZONE_PARENT_OWNERSHIP_FIX_V1` 执行（外部 repo commit `e495785`）
  起即为现值；该轮 UID502 回归验证在带完整补充组的交互凭据下进行，从未测 helper
  child 身份——本缺陷的直接成因。2026-08-18 12:21:07 的一次 ctime/mtime 同秒跳变
  为未归因 metadata 触碰，不是属主翻转。Basis: `OBS-TZ-005`, `EVD-TZ-004`。
- `STATE-TZ-006` — 本 authoring round 不改变任何 authority、production state、
  `.openclaw` 权限、Workspace 文件或产品代码。Basis: direct Git changed-file boundary
  and this Spec status。

## 6. Observations

### OBS-TZ-001 — `.openclaw` 现状（owner/group/mode/ACL exact 文本）

- Subject: `/Users/yanfenma/.openclaw` 目录 metadata
- Source: docs/investigations/openclaw-ancestor-traverse-drift-v1.md §1 path-chain
  audit（2026-08-24）；本轮 authoring 时 live `ls -lae`/`stat` 复核逐字节一致
- Environment: production host；auditor uid 502 read-only
- Observed at: 2026-08-24
- Method: read-only stat / ACL 列出（零 mutation）
- Result: `authsvc:authsvc` `drwx------`；ACL 恰 §4 所列 3 条；xattr
  `com.apple.provenance`；mtime=ctime=2026-08-18 12:21:07（birth 03-07）
- Provenance: 调查 §1 表 + 本轮 live 复核回执

### OBS-TZ-002 — helper child 身份探针矩阵（无副作用）

- Subject: production spawn-helper exec 的 child（502/20/补充组恒空）对路径链的
  实际 VFS 授权
- Source: docs/investigations/openclaw-ancestor-traverse-drift-v1.md §2
- Environment: production host；`/usr/local/libexec/dsh-agent-spawn-helper`（root:wheel
  4755）；探针程序须带 ≥1 参数（argc≥5 usage 约束）
- Observed at: 2026-08-24
- Method: helper exec 无副作用探针（stat/list/cd+pwd/read 对照矩阵）
- Result: `stat /Users/yanfenma/.openclaw` PASS（仅需父目录 search）；`list
  .openclaw` EACCES；`stat <EXACT_WORKSPACE>`（经 .openclaw 解析）EACCES ★根因；
  `stat <EXACT_WORKSPACE>/memory` EACCES；`cd && getcwd` FAIL（Node `uv_cwd`
  EACCES）；`read <EXACT_WORKSPACE>/AGENTS.md` EACCES。对照：登录 shell（同
  `id` 输出、VFS 凭据含 599）同路径 list/search 全 PASS；child 读
  `/Users/yanfenma/.openclaw-cli/cli-config.json`（yanfenma:staff 0600，不在
  .openclaw 下）PASS——证明 uid502 POSIX owner 匹配对 child 在 VFS 层有效
- Provenance: 调查 §2 探针回执（零残留）

### OBS-TZ-003 — spawn-helper 冻结身份契约（生产二进制与源码一致）

- Subject: helper 二进制与 frozen 契约
- Source: scripts/dsh-agent-spawn-helper.c:28-29（`FROZEN_CHILD_UID 502` /
  `FROZEN_CHILD_GID 20`）、:53-55（`setgroups(0,NULL)` → `setgid(20)` →
  `setuid(502)`）、:43-46（非 502/20 拒绝）、:62（`execv` 直执行）；生产
  `/usr/local/libexec/dsh-agent-spawn-helper` root:wheel 4755；`strings` 实证含
  `setgroups(clear)`；消费方 packages/agent-router/src/process.js
  `childSpawnConfig`（`<helper> <uid> <gid> <program> [args...]`）
- Environment: production host + 本 repo 源码
- Observed at: 2026-08-24
- Method: 源码逐行核对 + 生产二进制 metadata/strings（read-only）
- Result: child VFS 凭据 = uid502/gid20/无补充组；userland `getgroups`/`id` 列出
  599(oc-canary) 等全部 OD 派生组属于**假象**——同进程内
  `group:oc-canary allow list,search` ACE 不生效即为实证
- Provenance: 调查 §2 + 本轮源码复核

### OBS-TZ-004 — production child boot 复现与三排除

- Subject: agt_build-in-public-agent frozen-subject child boot
- Source: docs/reports/build-in-public-canary-home-boot-audit-v1.md §3–§5
- Environment: cwd = EXACT_WORKSPACE
  `/Users/yanfenma/.openclaw/groups/workspace-oc_95bd40ab17712fe0f3a7cf7eb6f4e24a`；
  spawn 链逐字节复刻 agent-router process.js；env = launchd
  system/ai.agent-core.runtime
- Observed at: 2026-08-24 00:43–00:51
- Method: throwaway production-equivalent child boot + RPC initialize（零 production
  写入）
- Result: Phase F child 秒退 exit 1（`loadLayeredEnv` `process.cwd()` EACCES，
  plugin tree load 前死）；Phase D（仅 cwd 偏移 /private/tmp）插件树 + initialize
  全 PASS，随后 `EACCES mkdir <WS>/memory` 同源崩溃。
  `HOME_MODEL_CAUSAL = NO`、`HARNESS_CAUSAL = NO`、`PROVIDER_CAUSAL = NO`；判定 =
  workspace 侧祖先穿越权限漂移（D/OTHER）
- Provenance: boot-audit §3/§5 + /private/tmp/canary-boot-audit/ 回执

### OBS-TZ-005 — drift provenance（08-09 外部修复 → 本缺陷）

- Subject: `.openclaw` 属主/ACL 演变史
- Source: mayf3/openclaw-adc-canary-extension repo
  `OPENCLAW_TRUSTED_ZONE_PARENT_OWNERSHIP_FIX_V1_REPORT.md`（随 `07129f3` 存档，
  执行 commit `e495785`，2026-08-09 10:34）：明文 `chown ~/.openclaw →
  authsvc:authsvc (mode 700)`、移除过渡 `user:authsvc` 写 ACL、保留
  `group:oc-canary` + `user:oc-canary-runtime` 读遍历 ACL；其
  `UID502_RUNTIME_REGRESSION_PASS` 在带完整补充组的交互/admin 凭据下验证
- Environment: 外部 repo + 本 host 文件系统历史（08-11 边界审计佐证；08-18 12:21:07
  ctime=mtime 同秒跳变 = 未归因 metadata 触碰，非属主翻转；08-23 两份 plan 抄录
  "0700(uid502)" 判定为陈旧抄录，非实况）
- Observed at: 2026-08-24（调查轮复核）
- Method: 文档 + filesystem 时间戳交叉
- Result: 权限状态自 2026-08-09 起即为现值；helper-spawn 模型 08-23/24 首次落到该
  Workspace 路径才暴露
- Provenance: 调查 §3

### OBS-TZ-006 — 既有 accepted authorities 均不覆盖本修复

- Subject: repository authority 覆盖面（针对 `.openclaw` 祖先目录 ACL mutation）
- Source: docs/specs/AGENT_PRIMARY_WORKSPACE_OPENCLAW_COMPATIBILITY_V3.md（scope =
  exact-86 Workspace 本体原地复用；CTR-OW-004 禁 chmod/chown 的对象是 Workspace
  内容/元数据；§3.2 PRODUCTION_APPLY FORBIDDEN）；
  docs/specs/AGENT_TRUSTED_FLEET_CUTOVER_V1.md（§8 控制面 transaction 不含该目录
  权限变更）；
  docs/specs/AGT_CTO_AGENT_PRIMARY_WORKSPACE_OPENCLAW_IN_PLACE_V1.md（CTR-CW-007
  G1–G4/T1–T9 同样不含）
- Environment: origin/main@73ec666
- Observed at: 2026-08-24
- Method: inspect accepted authority text（scope 与 contracts 逐项）
- Result: `EXISTING_AUTHORITY_COVERS_REPAIR = NO`；`NEW_AUTHORITY_REQUIRED = YES`
- Provenance: 本轮 source-verified + 调查 §5 同结论

### OBS-TZ-007 — cutover 线穿越前置被本故障阻塞

- Subject: fleet / cto cutover 线的可执行性
- Source: fleet §8 step 2/7（exact path verify + child cwd gate）、V3 CTR-OW-009
  canary 证明、AGT_CTO CTR-CW-007 T6/T7；boot-audit §6 明文「映射 执行 维持
  BLOCKED（其 G2 uid 502 child 路径穿越可达前置与 step 7 child-cwd gate 现必失败）」
- Environment: origin/main@73ec666 + production host
- Observed at: 2026-08-24
- Method: authority 前置条件与实况对照
- Result: 在本修复生效并验证前，两条 accepted cutover 线的路径穿越前置不可满足
- Provenance: boot-audit §6 + 调查 §5

## 7. Claims and assumptions

### CLM-TZ-001 — 根因单一：`.openclaw` 祖先无有效 search

- Support state: SUPPORTED
- Supported by: `EVD-TZ-001`, `EVD-TZ-002`, `EVD-TZ-003`
- Contradicted by: none known
- Uncertainty: none。Home / Harness / Provider 已被 Phase D 隔离实验排除
  （HOME_MODEL_CAUSAL = NO、HARNESS_CAUSAL = NO、PROVIDER_CAUSAL = NO）。

### CLM-TZ-002 — Model B 充分：单条 search,readattr ACE 即恢复全部所需可达性

- Support state: SUPPORTED
- Supported by: `EVD-TZ-002`
- Contradicted by: none known
- Uncertainty: 执行轮以探针复验为准（ACC-TZ-003/004）；若实况与调查快照漂移，
  G1 fail-closed 收敛。

### CLM-TZ-003 — Model B 保持 trusted-zone 边界（不重开 08-09 修复目标）

- Support state: SUPPORTED
- Supported by: `EVD-TZ-004`, `EVD-TZ-001`
- Contradicted by: none known
- Uncertainty: 边界断言（无 list、无写权、trusted 文件不可读、authsvc 权限不减）
  在执行轮以探针复证（ACC-TZ-003）；本 Spec 冻结的 ACE 权限集本身不含任何越界
  权限位。

### CLM-TZ-004 — group ACL 对 helper child 授权不可靠；uid 限定是唯一可靠原语

- Support state: SUPPORTED
- Supported by: `EVD-TZ-002`, `OBS-TZ-003`
- Contradicted by: none known
- Uncertainty: none（同进程 getgroups 假象 vs VFS 拒绝已构成决定性对照）。

### CLM-TZ-005 — authsvc 侧语义与 validatePrimaryWorkspaces 不受影响

- Support state: INFERRED
- Supported by: `EVD-TZ-001`
- Contradicted by: none known
- Uncertainty: 追加一条 `user:yanfenma` allow ACE 不改变 authsvc 作为 owner 的
  rwx 与既有 ACE 语义（macOS ACL 语义推论）；执行轮以 validatePrimaryWorkspaces
  实跑 PASS 复证（ACC-TZ-003），不实跑不得宣称。

Open authority-changing assumptions: **NONE**（全部 load-bearing 输入已冻结于 §4/§5；
执行差异由 G1 fail-closed 收敛）。

## 8. Evidence relations

### EVD-TZ-001 — 现状观测支持根因与边界判定

- Source observations: `OBS-TZ-001`
- Target: `STATE-TZ-001`, `CLM-TZ-001`, `CLM-TZ-003`, `CLM-TZ-005`
- Relation: SUPPORTS
- Bound coordinates: production host，2026-08-24，read-only stat
- Strength: exact owner/group/mode/ACL 文本，双轮一致（调查 + authoring live 复核）
- Limitation: 时点快照；执行轮 G1 重核
- Provenance: 调查 §1 + 本轮复核回执

### EVD-TZ-002 — 探针矩阵支持根因、充分性与 group 不可靠判定

- Source observations: `OBS-TZ-002`, `OBS-TZ-003`
- Target: `CLM-TZ-001`, `CLM-TZ-002`, `CLM-TZ-004`, `STATE-TZ-002`
- Relation: SUPPORTS
- Bound coordinates: production spawn-helper child 身份，2026-08-24
- Strength: 决定性对照（child EACCES vs 登录 shell PASS vs 0600 owner-match PASS）
- Limitation: 探针为无副作用只读操作；不覆盖修复后状态（由执行轮复验）
- Provenance: 调查 §2

### EVD-TZ-003 — boot 复现支持「plugin tree load 前退出」与三排除

- Source observations: `OBS-TZ-004`
- Target: `CLM-TZ-001`, `STATE-TZ-003`
- Relation: SUPPORTS
- Bound coordinates: frozen-subject child boot，2026-08-24 00:43–00:51
- Strength: 两阶段隔离实验（F 全败 / D 仅 cwd 偏移即插件树 PASS）
- Limitation: throwaway boot；未发飞书、未建业务 turn
- Provenance: boot-audit §3

### EVD-TZ-004 — 外部修复 provenance 支持边界保持义务

- Source observations: `OBS-TZ-005`
- Target: `CLM-TZ-003`, `STATE-TZ-005`
- Relation: SUPPORTS
- Bound coordinates: mayf3/openclaw-adc-canary-extension @07129f3（执行 commit
  e495785），2026-08-09
- Strength: 明文执行记录 + 回归口径（补充组凭据）识别
- Limitation: 外部 repo 的 authority 状态不受本 repo 治理；本 Spec 仅以
  constrained_by 引用其边界目标
- Provenance: 外部执行报告

### EVD-TZ-005 — authority 覆盖面观测支持 NEW 判定

- Source observations: `OBS-TZ-006`, `OBS-TZ-007`
- Target: `STATE-TZ-004`, §3.2 authority relation
- Relation: SUPPORTS
- Bound coordinates: origin/main@73ec666，2026-08-24
- Strength: 三份 accepted Spec 的 scope/contracts 逐项核对
- Limitation: none known
- Provenance: 本轮 source-verified

## 9. Decisions

### DEC-TZ-001 — 新独立 child authority（不 amend、不 supersede、不 partial）

- Decision owner: mayf3
- Selected direction: 新建本 directory-bounded 最小 authority；V3 / fleet / AGT_CTO /
  外部 OWNERSHIP_FIX_V1 全部零修改；`supersedes: []`。
- Rejected: amend V3 / fleet / AGT_CTO（scope 扩张，违反 SPEC_FORMAT_V0 §14.2，
  §14.3 要求 NEW）；whole-authority replacement（无替换对象）；partial supersede
  （治理禁止）。
- Reason: 修复对象（`.openclaw` 祖先目录 ACL）不在任何 accepted authority 的
  scope 内；调查 §5 `EXISTING_AUTHORITY_COVERS_REPAIR = NO`。
- Owner input remaining: NONE.

### DEC-TZ-002 — Model B 选定；A / C / D 拒绝（NEW_EVIDENCE = child 身份探针）

- Decision owner: mayf3
- Selected direction: 保持 authsvc:authsvc 0700 + 恰追加一条非继承
  `user:yanfenma allow search,readattr` ACE（§4 逐字冻结）。
- Rejected: A（恢复 yanfenma:staff 0700 + authsvc 精确 ACL）——重开 2026-08-09
  已关闭的 trusted-zone 边界（uid502 恢复 owner ⇒ 顶层 create/unlink/rename/replace
  全回归），且需为 authsvc 重建写 ACE = 重引入已删除的过渡结构；C（依赖
  oc-canary group ACL）——实证对 helper child 不可靠（getgroups 假象）；D（修改
  spawn-helper 补充组行为）——使 child 全文件系统获得组授权，远超本需求，且违反
  frozen TRUSTED_CREDENTIAL_BROKER 契约（setuid 二进制 + root 重装）。
- Reason: 唯一同时满足 child 可达、authsvc 零影响、边界不回退、变更量最小
  （1 条 ACE、可逆）的模型。
- Owner input remaining: NONE.

### DEC-TZ-003 — uid 限定是唯一可靠授权原语；证据方法论冻结

- Decision owner: mayf3
- Selected direction: 对 helper child 的一切授权设计只使用 uid 限定原语
  （user ACE / POSIX owner 匹配）；`GROUP_ACL_RELIABLE_FOR_HELPER_CHILD = NO` 冻结；
  修复前后验证必须在真实 production spawn-helper child 身份下执行，
  `id` / `getgroups()` 显示 oc-canary **不得**当作 VFS 授权成立的证据。
- Rejected: 以 userland 组表输出为依据的任何授权/验证结论；以交互 shell（带完整
  补充组）探针代替 child 身份探针。
- Reason: 08-09 修复的回归验证缺口正是「用带补充组的凭据验证」造成的；本决策
  堵死同类缺陷的再现路径。
- Owner input remaining: NONE.

### DEC-TZ-004 — 修复 transaction 纯净：不顺手写 mapping / Binding / 控制面

- Decision owner: mayf3
- Selected direction: ACL 修复 transaction 的 mutation 面有且只有那一条 ACE；
  `primary-workspaces.json` / Binding / `agents.json` / Runtime reload / 任何 cutover
  步骤均不得在修复 transaction 内执行（CTR-TZ-006）。
- Rejected: 修复+映射一次做完；修复时顺带 restart；任何「顺路」控制面写入。
- Reason: mutation 面最小化 + 可归因回滚；映射/接管各有自己的 accepted authority
  与审批线。
- Owner input remaining: NONE.

### DEC-TZ-005 — Canary-first staged transaction + 失败即完全回滚

- Decision owner: mayf3
- Selected direction: 第一 canary 固定 `agt_build-in-public-agent`（其
  EXACT_WORKSPACE 作为穿越验证的冻结主体）；8 步 staged 顺序不可弱化
  （CTR-TZ-007 S1–S8）；任一步 FAIL → 只删除本轮新增 ACE、恢复 pre-ACL exact
  state（CTR-TZ-008）。
- Rejected: 直接修完不验证；全 fleet 并行依赖未验证修复；失败后保留半修复状态。
- Reason: 单条可逆 mutation + 实身份端到端验证 + 精确恢复，是生产权限变更的
  最小风险路径。
- Owner input remaining: NONE.

### DEC-TZ-006 — Authority staging：proposed 起步；acceptance 不自动授予 production 权限

- Decision owner: mayf3
- Selected direction: 本轮 proposed / implementation_authority none /
  production_apply_authority none；acceptance 后 production apply 仍需独立执行轮
  与 owner sudo 执行（§3.3）。
- Rejected: authoring agent 自行 accepted；acceptance 即视为已授权改 ACL。
- Reason: 与 V3/fleet/AGT_CTO 的 authority staging 纪律一致。
- Owner input remaining: NONE.

## 10. Contracts

### CTR-TZ-001 — 冻结目标与 pre-state fail-closed 断言

唯一 mutation 对象是 `/Users/yanfenma/.openclaw`（TARGET_PATH，exact 绝对路径）。
执行轮在任何 mutation 前 MUST 以 read-only 方式断言 pre-state 与 §4 冻结值逐项
一致：owner = authsvc、group = authsvc、mode = 0700、既有 ACL 恰为所列 3 条
（逐条文本一致、无多无少）。任何不一致（漂移）MUST 在 mutation 前 `FAIL_LOUD`
STOP 并回到 owner 裁决；MUST NOT 在漂移状态上套用本 Spec 的 mutation。执行轮
MUST 先以字节/文本方式冻结 pre-ACL（完整 ACL 文本 + digest）作为回滚基线。

### CTR-TZ-002 — Model B 恰一条 ACE mutation 语义

本 authority 授权的 mutation 有且只有：向 TARGET_PATH 自身追加恰一条 ACE
`user:yanfenma allow search,readattr`。该 ACE MUST 为目录生效、非继承（不带
only_inherit / file_inherit / directory_inherit 任何继承标志）。执行 MUST NOT：
授予 list；授予读文件内容；授予任何写权（writeattr/add_file/add_subdirectory/
delete_child/writeextattr 等）；修改或删除任何既有 ACE；修改 owner / group /
mode；递归应用；触碰任何子目录或文件；依赖 group ACL；修改 spawn-helper（含
重编译/重装/契约变更）。冻结口径：

```text
RECURSIVE_MUTATION      = NONE
CONTENT_MUTATION        = NONE
WORKSPACE_FILE_CHANGE   = NONE
OTHER_ACE_MODIFICATION  = FORBIDDEN
OWNER_GROUP_MODE_CHANGE = FORBIDDEN
SPAWN_HELPER_CHANGE     = FORBIDDEN
```

post-mutation 断言：ACL 恰为 pre-ACL 3 条（原样）+ 新 1 条；owner/group/mode 与
pre-state 逐字节一致。

### CTR-TZ-003 — 修复后安全边界（必须同时成立）

修复后 MUST 同时满足以下断言（全部在真实 helper child 身份下验证）：

```text
uid502 child CAN：
  traverse /Users/yanfenma/.openclaw（search）；
  getcwd == exact Workspace（含 fleet canary 冻结主体
    /Users/yanfenma/.openclaw/groups/workspace-oc_95bd40ab17712fe0f3a7cf7eb6f4e24a）；
  stat/read Workspace 子树内已由其自身权限（owner/mode/ACL）允许的内容；
  访问 Workspace 内 memory/；
  访问 Git metadata（/Users/yanfenma/.openclaw/.git，yanfenma:staff 0755）。

uid502 child MUST NOT（保持 denied）：
  list /Users/yanfenma/.openclaw 顶层条目（未授予 list）；
  读 .openclaw 下 trusted 文件内容（其自身 0600 authsvc 保持）；
  在 .openclaw 顶层 create/unlink/rename/replace（无任何写权）。

authsvc MUST（不减）：
  owner rwx 权限原样；validatePrimaryWorkspaces 继续 PASS；
  现有 service 运行语义不变。

全局 MUST NOT：
  使 .openclaw world-readable（不给 other 任何权限）；
  把授权扩大到 yanfenma 以外的 OS 用户（ACE 恰为 user:yanfenma）；
  启动 historical OpenClaw Runtime（保持停止）；
  修改 Workspace 内容（RECURSIVE_MUTATION/CONTENT_MUTATION = NONE）。
```

### CTR-TZ-004 — 证据方法论：真实 helper child 身份；组表输出非证据

修复前后的一切授权验证 MUST 在 production spawn-helper exec 的 child 身份
（uid 502 / gid 20 / 补充组恒空）下执行。交互 shell（带完整补充组）的结果 MUST NOT
作为 child 授权证据。`id` / `getgroups()` 显示 oc-canary（或任何组）MUST NOT 当作
VFS 授权成立的证据（userland 组表为 OD 派生假象）。任何基于 group ACL 的 child
授权设计在本 authority 下 `GROUP_ACL_RELIABLE_FOR_HELPER_CHILD = NO`——MUST NOT
采用。

### CTR-TZ-005 — 授权边界：单目录、单 OS 用户、不可外推

本 authority 的授权 MUST NOT 外推到：`.openclaw` 以外的任何目录；yanfenma 以外的
任何 OS 用户；第二条 ACE；任何 future 子项（无继承标志）。任何后续权限需求
（包括更宽的可见性、其他 agent 路径、其他主体）MUST 另走独立 authority。

### CTR-TZ-006 — 修复 transaction 纯净性（零控制面副作用）

ACL 修复 transaction 期间 MUST NOT 写 `primary-workspaces.json`、MUST NOT 写
Binding、MUST NOT 改 `agents.json`、MUST NOT reload/restart Runtime、MUST NOT 执行
任何 cutover 步骤（fleet 或 cto）、MUST NOT 发送任何飞书消息。修复与映射/接管
是不同 authority 线的不同 transaction；修复成功只解除前置 BLOCKED，不推进任何
cutover 步骤。

### CTR-TZ-007 — Canary-first staged production transaction（顺序不可弱化）

第一 canary 固定 `agt_build-in-public-agent`（穿越验证冻结主体 =
`/Users/yanfenma/.openclaw/groups/workspace-oc_95bd40ab17712fe0f3a7cf7eb6f4e24a`）。
production transaction MUST 按以下顺序执行（任一步 FAIL → STOP 并按 CTR-TZ-008
回滚）：

```text
S1 字节/文本冻结 pre-ACL（完整 ACL 文本 + digest）＋ CTR-TZ-001 pre-state 断言
S2 只新增目标 ACE（恰一条；§4 exact 语义）
S3 用 production spawn-helper 执行无副作用 traversal probe（child 身份）：
   stat exact Workspace PASS · getcwd PASS · memory 可达 · Git metadata 可达 ·
   list .openclaw 顶层仍 EACCES · 读 trusted 文件仍 denied；
   并在同阶段 authsvc 侧实跑 validatePrimaryWorkspaces PASS 复证（CLM-TZ-005 收敛）
S4 重跑真实 child boot + RPC initialize（冻结主体；plugin tree load 达成 +
   initialize 应答）
S5 确认 exact Workspace cwd（child cwd / getcwd == 冻结主体路径）
S6 确认 memory/ 与 Git metadata 对 child 可见
S7 确认无 Workspace 内容变化（Workspace git-status / metadata digest 前后一致）
S8 exact rerun = NOOP（重跑 S2 语义 = 已存在等价 ACE → 零新增 mutation）

失败处置（覆盖 S1–S8 任一步 FAIL）：只删除本轮新增 ACE，恢复 pre-ACL exact
state（文本 + digest 与 S1 基线一致），记录在案，STOP 等待 owner/审计处置。
```

### CTR-TZ-008 — Rollback：恰删一条 ACE，恢复 exact pre-state

回滚 MUST 且只需：删除本轮新增的 `user:yanfenma allow search,readattr` 这一条
ACE，并验证恢复后完整 ACL 文本与 digest 与 S1 冻结的 pre-ACL 基线逐字节一致。
回滚 MUST NOT：chown；chmod（改 mode）；`chmod -N`（清空全部 ACL）；递归改 ACL；
删除或修改任何其他既有 ACE；触碰任何子目录/文件。回滚后 MUST 复证 child 身份
回到修复前行为（traversal probe 恢复 EACCES）与 authsvc 语义不变。

### CTR-TZ-009 — Authority and production gates

本 Spec `proposed` 阶段零 authority：不授权任何 implementation / production
动作。accepted 后 `production_apply_authority` 仍为 none——production apply 需
§3.3 全部条件 + 独立 production approval（owner sudo 执行）。本 authoring round：
只新增本 Spec 一个文件；不修改任何既有 Spec / 产品代码 / 脚本 / production /
`.openclaw` 权限；不 accept、不 merge。

## 11. Acceptance

> 本节为未来执行轮的验收契约（accepted 后由下游执行与审计）；本轮 authoring 的
> 验收是 docs 边界本身（ACC-TZ-001 的 authoring 投影 + 本 Spec 独立 review）。

### ACC-TZ-001 — Authoring / lifecycle boundary

- Contracts: `CTR-TZ-009`
- Method: inspect authoring branch diff 与 frontmatter。
- Expected: 本轮 changed files = 仅本 Spec 一个文件；status = proposed；
  implementation_authority = none；production_apply_authority = none；无
  implementation / product / script / production / ACL / owner / mode / workspace
  变更；未 accept、未 merge；V3 / fleet / AGT_CTO / 外部 OWNERSHIP_FIX_V1 零修改。
- Failure: 任一额外文件被修改；状态字段被 authoring agent 翻转；production 或
  `.openclaw` 被触碰。

### ACC-TZ-002 — Pre-state freeze + 恰一条 ACE 语义

- Contracts: `CTR-TZ-001`, `CTR-TZ-002`
- Method: 审计执行记录：S1 pre-ACL 文本 + digest 在案；S2 后 ACL = pre 3 条（原样）
  + 新 1 条 `user:yanfenma allow search,readattr`；新 ACE 无任何继承标志；无
  list / 写权限位；owner/group/mode 逐字节不变；无任何子目录/文件被触碰。
- Expected: mutation 面恰一条 ACE；pre-state 断言先于 mutation；漂移即 STOP。
- Failure: 出现第二条 mutation 面；pre-ACE 被改动；继承标志出现；owner/mode 变化。

### ACC-TZ-003 — 修复后安全边界探针（child 身份）

- Contracts: `CTR-TZ-003`, `CTR-TZ-004`
- Method: production spawn-helper 无副作用探针矩阵 + authsvc 侧
  validatePrimaryWorkspaces 实跑（均在 S3 阶段，child 身份探针为准）。
- Expected: §CTR-TZ-003 全部 CAN 断言成立（traverse / getcwd == 冻结主体路径 /
  memory / Git metadata）；全部 MUST-NOT 断言保持（list 仍 EACCES、trusted 文件
  仍 denied、无写权、非 world-readable）；authsvc owner 权限与 service 语义不变。
- Failure: 任一 CAN 失败（修复不充分）或任一 MUST-NOT 反转（边界泄漏）；
  验证用交互 shell 而非 child 身份（方法论违规即 FAIL）。

### ACC-TZ-004 — 真实 child boot + RPC initialize（冻结主体）

- Contracts: `CTR-TZ-003`, `CTR-TZ-007`
- Method: S4–S5 执行回执审计：以 production spawn 链（cwd = 冻结主体路径）重跑
  child boot。
- Expected: plugin tree load 达成（不再死于 `loadLayeredEnv` process.cwd()）；
  RPC initialize 应答；child cwd / getcwd == exact Workspace。
- Failure: child 仍于 plugin tree load 前退出；initialize 无应答；cwd 非冻结主体
  路径。

### ACC-TZ-005 — Workspace 零变化 + NOOP rerun

- Contracts: `CTR-TZ-002`, `CTR-TZ-007`
- Method: S7 前后 Workspace git-status / metadata digest 对比；S8 幂等重跑。
- Expected: Workspace 内容与元数据零变化（RECURSIVE_MUTATION/CONTENT_MUTATION/
  WORKSPACE_FILE_CHANGE = NONE）；rerun 零新增 mutation。
- Failure: digest 不一致；rerun 产生第二条 mutation 面或任何副作用。

### ACC-TZ-006 — Transaction 纯净性

- Contracts: `CTR-TZ-006`
- Method: 审计修复 transaction 全程记录：`primary-workspaces.json` / Binding /
  agents.json / Runtime 状态前后对比。
- Expected: 上述全部零变化；无 cutover 步骤、无飞书消息混入修复 transaction。
- Failure: 任一控制面写入或 restart 出现在修复 transaction 内。

### ACC-TZ-007 — Rollback 演练与禁令

- Contracts: `CTR-TZ-008`
- Method: rollback 演练（或失败场景实滚）记录审计：只删除新增 ACE；恢复后 ACL
  文本 + digest 与 S1 基线逐字节一致；child 探针恢复修复前行为；禁令清单
  （chown / chmod / chmod -N / 递归 / 删其他 ACE）全部缺席。
- Expected: 恰删一条、exact 恢复、无禁令操作。
- Failure: 恢复后 ACL 与基线不一致；出现任何禁令操作。

### Success receipt（未来执行轮成功回执）

```text
TRAVERSE_REPAIR_APPLIED       = YES（恰一条 ACE）
TARGET_PATH                   = /Users/yanfenma/.openclaw
EXACT_ACE                     = user:yanfenma allow search,readattr
CHILD_TRAVERSE_PROBE          = PASS（child 身份：stat/getcwd/memory/git 可达；
                                list/trusted-read/write 保持 denied）
CHILD_BOOT_RPC_INITIALIZE     = PASS（冻结主体 agt_build-in-public-agent）
EXACT_WORKSPACE_CWD           = PASS
WORKSPACE_CONTENT_UNCHANGED   = PASS（digest 前后一致）
AUTHSVC_VALIDATION_PASS       = PASS（validatePrimaryWorkspaces 实跑）
EXACT_RERUN_RESULT            = NOOP
ROLLBACK_DRILL_RESULT         = PASS（恰删一条，exact pre-ACL 恢复）
任一 FAIL -> STOP（按 CTR-TZ-008 回滚，记录在案，等待 Owner/审计处置）。
```

### Contract coverage

| Contract | Acceptance |
|---|---|
| CTR-TZ-001 | ACC-TZ-002 |
| CTR-TZ-002 | ACC-TZ-002, ACC-TZ-005 |
| CTR-TZ-003 | ACC-TZ-003, ACC-TZ-004 |
| CTR-TZ-004 | ACC-TZ-003 |
| CTR-TZ-005 | ACC-TZ-003, ACC-TZ-002 |
| CTR-TZ-006 | ACC-TZ-006 |
| CTR-TZ-007 | ACC-TZ-004, ACC-TZ-005 |
| CTR-TZ-008 | ACC-TZ-007 |
| CTR-TZ-009 | ACC-TZ-001 |

## 12. Alternatives and disposition

| Alternative | Disposition | Reason |
|---|---|---|
| Amend V3 / fleet / AGT_CTO 加入本修复 | REJECTED | scope 扩张违反 SPEC_FORMAT_V0 §14.2/§14.3；三者的冻结对象不含 `.openclaw` 祖先目录 ACL |
| Whole-authority replacement | REJECTED | 无替换对象；三条 authority 原样有效 |
| Partial supersede | FORBIDDEN | 治理协议禁止；`supersedes: []` |
| 修复 A：恢复 yanfenma:staff 0700 + authsvc 精确 ACL | REJECTED | 重开 2026-08-09 已关闭边界（uid502 顶层 create/unlink/rename/replace 回归）；需重引入已删除过渡 ACL；变更量 ≥3 项 |
| 修复 C：依赖 oc-canary group ACL | REJECTED | 实证对 helper child 不可靠（getgroups 假象 vs VFS 拒绝）；`GROUP_ACL_RELIABLE_FOR_HELPER_CHILD = NO` |
| 修复 D：修改 spawn-helper 补充组行为 | REJECTED | child 全文件系统获得组授权，远超本需求；违反 frozen TRUSTED_CREDENTIAL_BROKER 契约（setuid 二进制 + root 重装） |
| 授予 list（复刻 group:oc-canary ACE 全集） | REJECTED | 比选定 ACE 更宽：child 可枚举 `.openclaw` 顶层条目，超出穿越需求且违反 `不授予 list` 冻结项 |
| 把 ACE 做成继承（file_inherit/directory_inherit） | REJECTED | 违反非递归边界；未来子项权限必须由各自 authority 决定 |
| world/other 读权限 | REJECTED | `MUST NOT make .openclaw world-readable` |
| 修复 transaction 顺带写 mapping / Binding / restart | REJECTED | CTR-TZ-006 纯净性冻结；映射/接管各有独立 authority 与审批线 |
| 修复后直接推进 fleet 85-agent rollout | REJECTED | 本 Spec 只解除前置；rollout 由 fleet authority 线（canary → 审计 → 85）治理 |
| 以交互 shell / userland 组表输出作为验证证据 | REJECTED | DEC-TZ-003 方法论冻结；08-09 回归验证缺口的直接成因 |
| 回滚用 `chmod -N` 清空全部 ACL 或 chown/chmod | REJECTED | CTR-TZ-008 禁令；只删本轮新增一条 |
| authoring agent 自行 accepted / merge | FORBIDDEN | 只有 authorized maintainer 可在独立 review 后 accept |
| 本 authority 用于第二个目录 / 第二个 OS 用户 / 第二条 ACE | REJECTED | CTR-TZ-005 单目录单用户冻结 |

## 13. Migration, compatibility, and rollback

### 13.1 Authority migration

本 round 只新增 proposed 本 Spec；不 supersede 任何 Spec；V3 / V1 / V2 / fleet /
AGT_CTO lifecycle 不变；外部 OWNERSHIP_FIX_V1 状态不受本 repo 治理影响。未来经
独立 review（穿越 审计）+ authorized acceptance transaction 后，本 Spec 成为
`.openclaw` 祖先目录穿越权限的 authority。该 lifecycle transition 本身仍不授权
任何 production 动作。

### 13.2 Runtime compatibility

- 修复不改变任何进程身份契约：spawn-helper、Router spawn 链、child uid/gid 全部
  原样；
- 修复不改变 Workspace 本体任何权限/内容（Workspace 0700 yanfenma:staff、
  memory/、`.git` 0755 原样——它们对 child 的可用性由穿越 + 自身 owner 匹配给出）；
- authsvc 侧：owner rwx 不减、validatePrimaryWorkspaces 语义不变、gateway
  tmp+rename 写路径不受影响（owner 写权限与 ACE 无关）；
- fleet / cto 两条 cutover 线：本修复只把其路径穿越前置从必失败恢复为可满足；
  两条线的 transaction、审批、rollback 均由各自 authority 治理，本 Spec 零侵入。

### 13.3 Rollback

回滚 = 恰删除本轮新增 ACE 并恢复 pre-ACL exact state（CTR-TZ-008）。回滚后系统
回到修复前状态（child 穿越恢复 EACCES、cutover 前置恢复 BLOCKED——这是已知的、
有调查记录的状态，不是新增损坏）。若本 authority 本身需要逆转（例如放弃 Model B
改走其他模型），用新的 whole-authority superseding Spec 处理。

## 14. Open questions

```text
OPEN_OWNER_DECISIONS = NONE（修复模型/边界/canary 均已冻结；本 Spec 即 owner
  裁决的 authority 化）
NORMATIVE_TBD        = NONE
IMPLEMENTATION_TBD   = 执行轮细节：pre-ACL 冻结的具体工具形态（ls -le 文本 +
  digest 的机械化）、S3 探针程序形态、S7 digest 的精确字段集 —— 均不得弱化任何
  Contract
PRODUCTION_APPROVAL  = 独立 gate，本 Spec 不授予（acceptance 后仍需 §3.3 全条件）
RELATED_LINES        = 修复验证全绿后：重跑 启动 审计 冻结主体轮 → 全 PASS 方可进
  映射 执行（investigation §5 顺序）；该顺序属下游线的 gate，不由本 Spec 重叠治理
```

## 15. Authoring boundary

```text
DOCS_ONLY = YES
CHANGED_FILES = docs/specs/OPENCLAW_TRUSTED_ZONE_PARENT_TRAVERSE_ACCESS_V1.md only
BASE = origin/main@73ec666fb860d7257b2f48c3dc76bc967bb578cd
PRODUCT_CODE_CHANGE = NONE
SCRIPT_CHANGE = NONE
ACL_CHANGE = NONE
OWNER_CHANGE = NONE
MODE_CHANGE = NONE
PRODUCTION_CHANGE = NONE
WORKSPACE_FILE_CHANGE = NONE
PRIMARY_WORKSPACES_CHANGE = NONE
BINDING_CHANGE = NONE
AGENTS_JSON_CHANGE = NONE
RUNTIME_RELOAD = NO
SPAWN_HELPER_CHANGE = NONE
V3_CHANGE = NONE
FLEET_SPEC_CHANGE = NONE
CTO_SPEC_CHANGE = NONE
OPENCLAW_RUNTIME_STARTED = NO
IMPLEMENTATION = NONE
ACCEPT_OR_MERGE = NO
SPEC_STATUS = proposed（implementation_authority = none；production_apply_authority = none）
READY_FOR_INDEPENDENT_REVIEW = YES
VALIDATION = git diff --check / verify_governance.py / npm run verify:structure
NEXT_TASK = 穿越 审计
```
