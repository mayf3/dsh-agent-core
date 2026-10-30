# #953 HR 招聘后入群到可工作链路：诊断续段 R2

## Status

有界只读诊断交付；evidence status = proposed。**本次事故根因 / 第一个业务断点 = UNKNOWN**。
证据链首先缺少「失败入职意图 → 员工 canonical ID / 群 / operation」关联原件，
不能把源码关口、历史 HR 错误或测试 fixture 当作本次失败。
本轮零产品 diff；不修改生产；修复方案仅为提案。

- 任务：[agent-control #953](https://github.com/mayf3/agent-control/issues/953)；
  上游：[2026-10-12 SOURCE 回执](https://github.com/mayf3/agent-control/issues/953#issuecomment-6119942432)。
- 续接分支：`ac-task/953-onboarding-entry-source`，父提交 `f5a530ef7f0baf9f6ca86e3a9e59fd660ba59437`，原 base `e9699aee`。
- 原 worktree 在允许写入范围外；只读确认其 HEAD 和 tracked/untracked status 干净，
  在仓内 `.worktrees/953-diagnostic-round2` 建立同分支的隔离 clone，不改原 worktree/ref。
- 采集：2026-10-31（Asia/Shanghai；机器 UTC 为 2026-10-30，精确时间见各证据）。
- SOURCE 比较基线：本轮重新 fetch 的 `origin/main@20e60dd72a42a0ef69e0acb8516b15c1893ffb01`，
  只用于辨别漂移；未 merge/rebase/cherry-pick 到续接分支。
- checkout/命令原件：[git-preflight.json](../evidence/hr-onboarding-diagnostic-r2-20261031/git-preflight.json)；
  preflight 与独立核对：[delivery-notes.md](../evidence/hr-onboarding-diagnostic-r2-20261031/delivery-notes.md)；
  交付文件实测哈希：[SHA256SUMS](../evidence/hr-onboarding-diagnostic-r2-20261031/SHA256SUMS)。

## Problem

按 #953 最小诊断第 2–4 层回收群绑定、runtime/canonical/principal、岗位必要 auth 与工具暴露，
以最近失败和既有成功为对照。创建成功、渠道/消息 accepted、正确接收者、完成工作分别取证。
不触发真实招聘、建群、授权、调用受保护业务接口或重放任何未知副作用。

## Evidence

所有下列 `f5:` 行号指父提交 `f5a530ef`，`main:` 行号指上述 fetch 固定 SHA；
`disk:` 指采集时只读的 `/usr/local/libexec/agent-core/app/` 文件，**不证明进程加载**。
精确摘录、blob/file SHA-256 和采集命令见
[source-excerpts.md](../evidence/hr-onboarding-diagnostic-r2-20261031/source-excerpts.md)。

### 1. 新群绑定：UNKNOWN

| 事实 | 本轮结论与证据 |
|---|---|
| 真实创建/加入群被接受 | UNKNOWN：缺目标群、原平台回执、时间、operation ID；#953 正文及原交付均未给出 |
| 消息 accepted | UNKNOWN：没有本次渠道消息或发送回执；不得用定义创建响应代替 |
| activeAgentId 唯一且为正确接收者 | UNKNOWN：缺目标员工/群键；`bindings/bindings.json` stat 返回 EACCES，未读内容 |
| 群→Agent→群反查 | UNKNOWN：未拿到同一时点正向 Binding 与该 exact Agent 的反向行集合，不能凭名称或一个群推出唯一性 |
| SOURCE 入口 | **本轮第 2 层（绑定）最早可证关口是 PREBOUND_ONLY ingress gate**；未绑定群在 Router 前返回 `reason:'unbound'`，不建立默认绑定、不 spawn；不声称早于 transport eligibility/dedup/classify |

重要纠偏：上游「首触绑定 DEFAULT、需 switch」描述的是 generic Router，遗漏生产组合层。
`f5:packages/production-runtime/src/compose.js:234-246` 已装配 gate，
`f5:packages/production-runtime/src/v2-ingress-gate.js:71-90` 定义拒绝，
`f5:packages/feishu-connector/src/core.js:739-757` 在 `onEvent` 前返回；固定未绑定回执在 `:694-695`。
这与 accepted `f5:docs/specs/AGENT_WORKSPACE_SESSION_V2_CORE_ALIGNMENT_SPEC.md:226-254`
冻结的 PREBOUND_ONLY 一致，automatic birth 在此实施合同中明确 OUT_OF_SCOPE。
`disk:packages/production-runtime/src/compose.js:290-308` 与 `v2-ingress-gate.js:71-90`
仍含这一装配/拒绝；磁盘存在不等于加载生效。

**条件分类**：若同次失败回执证实为 `unbound`，且实际加载该合同，则该跳为「合法 DENIED」。
目前没有该回执，**本次层级结论仍是 UNKNOWN**；不能直接判定它是 #953 的事故根因，
也不建议以 Feishu 通用 switch 绕过固定群模型。

### 2. principal / runtime 身份：UNKNOWN

有限非秘密投影见 [readback.json](../evidence/hr-onboarding-diagnostic-r2-20261031/readback.json)：

- definition 文件真实路径 `/usr/local/libexec/agent-core/config/agents.json`；
  SHA-256 `e0800b0fde6fc46b2873decd0f83c9b807b48b56cc3c9ad9cf578a5685b5b6fe`。
  共 98 行、重复 exact ID 数 0；canonical HR `agt_hr-agent` 恰一行、`disabled:false`；
  exact legacy `hr-agent` 行数 0。未输出员工描述或整份 registry。
- 这只证明该磁盘 definition 投影；**不是本次新员工存在、当前运行、实际 principal 或调用者证明**。
  不从相似名称/旧别名/孤儿种子选取员工；缺 target ID，未枚举候选来猜。
- `sudo -n /bin/launchctl list` 与 `ps -axo pid,uid,comm` 被当前沙箱拒绝执行
  （PermissionError errno 1；初次 shell 回显 `operation not permitted: sudo`）；
  普通 `launchctl list` rc=1、无输出。未升级权限或绕路，因此启停状态/PID/实际进程 UID/loaded generation UNKNOWN，
  不能将空输出写成「未运行」。control 目录仅 stat，未读内容。
- 实际 principal、client 绑定及同次 broker caller 全为 UNKNOWN；未读任何 credential store、token、
  secret、完整认证文件、私有会话或 Auth `.env`。

SOURCE 身份约束：`f5:packages/agent-router/src/index.js:499-510` 用 Definition 判定可运行，
`:581-610` 只以 ACTUAL `proc.agentId` 作 broker caller，忽略 child 自报身份；
`f5:packages/agent-definition/src/definition.js:373-384` 的名称解析会取首项，故调查必须用 exact ID。
非秘密 principal metadata 必须来自 Auth 权威，不能把 runtime ID 或 OS UID 当作 principal。

### 3. 既有 auth 配置与工具暴露：UNKNOWN

| 核对面 | SOURCE / 磁盘可证内容 | 本次 LOADED / EXPOSED / BUSINESS 结论 |
|---|---|---|
| 岗位 accepted 合同 | 未给出目标员工岗位/任务合同 | UNKNOWN；不能推导应有 scope/role/entitlement |
| 招聘工具 manifest | 复用 `agent.definition.write` / `agent_definition_write` / `create {name,description?}`；`f5:packages/broker/src/capabilities/agent-definition.js:70-138`；磁盘相应文件已测 hash | manifest 存在；该员工 child 实际 tool registry / 已加载版本 UNKNOWN |
| broker/运行时装配 | `f5:packages/broker/src/index.js:66-80,148-182,194-216` 分别处理 manifest、gateway handler、child relay；`f5:packages/production-runtime/src/compose.js:249-257` 装配 gateway | SOURCE 已有；目标员工实际装配 UNKNOWN，不能据工具目录推断 entitlement |
| credential / principal / grants | `AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1` Part B/D/E/G 分离 authority、identity 与 grant | UNKNOWN；本轮不读取私有 store，不做 token mint 或业务权限试探 |
| 较新 provisioning 实现 | `main:packages/agent-credential-provisioning/src/index.js:111` 已有 `ensureAgentCredential`；`disk:` 同路径文件存在，hash `84a5b2764f24de2828aebdd02ac788c1c506247796cd6adfff520ee2fa78767d` | 上游「0 命中/未实现」仅是旧 ref 结论，不能沿用为现状；自动串接与实际成功仍 UNKNOWN |
| definition create 的职责 | `main:` 与 `disk:packages/agent-definition/src/access.js:84-97` 都仍是 create+refresh，无 ensure 调用 | SOURCE 缺跨阶段自动串接不等于本次 auth 回归，更不等于可以直接扩大 create 合同 |

磁盘 pack metadata 的 `source_head_sha` 自报 `bdbaf8a00dffbede37794c6ed1585bccf8d6f84f`；
文件 hash `1e2093b9c2411e608896bd781e623850290a823ececc3a6a1fede440ae121541`。
其 note 明写 “Source-only reviewed profile idempotence successor. No production installation or business acceptance.”
因此只记录为 **ON_DISK_PRESENT**，不宣称完整包已验证、已部署、LOADED 或业务通过；
没有重算整包 tree digest，9 个相关代码文件的实测 hash 单列在 readback。

错误码也不能替代本次分层：`f5:packages/broker/src/gateway.js:130-184` 与
`transport.js:95-120` 表明 credential 缺失/不可读可汇为 `credential_unavailable`，
token 拒绝、上游异常/不可达等可汇为 `access_denied`。单个错误码不足以判「不存在」「缺配置」或「合法 DENIED」。

未执行看似只读的 `canonical-agent-onboarding.mjs status`：
`main:scripts/canonical-onboarding-lib.mjs:202-216` 仍会读取完整私有 credential store。
既有 trusted-parent metadata seam 见 `main:packages/broker/src/credential-store.js:135-172`；
后续应由原受信进程输出 exact-ID 的闭合脱敏投影，PRESENT 仍不证明 principal/grant/mintability。

### 4. 最近失败与既有成功对照：UNKNOWN

完整检索命令/rc/回执链接/时间与对照表见
[case-evidence.md](../evidence/hr-onboarding-diagnostic-r2-20261031/case-evidence.md)。

| 项目 | F：#953 最近失败 | S：既有成功工作员工 |
|---|---|---|
| 可用原件 | #953 正文和 [#965 终结回执](https://github.com/mayf3/agent-control/issues/965#issuecomment-6119953594) 都明确缺原始样本 | [Core #419](https://github.com/mayf3/dsh-agent-core/issues/419#issuecomment-5936848762) 和 [#469](https://github.com/mayf3/agent-control/issues/469#issuecomment-6011218324) 回读已接受的 2026-09-17 生产通信 |
| canonical 员工 | UNKNOWN | sender=`agt_build-in-public-agent` → receiver=`agt_content-ops-agent`（历史回执） |
| 招聘 operation / 群接受 / 正反绑定 / 岗位合同 | 全部 UNKNOWN | 全部 UNKNOWN；这不是完整招聘成功样本 |
| 持久结果与回复关联 | UNKNOWN | 历史通信 PASS 被接受；所选回执未提供实际 operation/delivery ID，本轮没有重放 |
| 能否定位本次首断点 | 不能 | 只能证明已有通信成功先例，不能补齐本次入职链 |

「招聘」「新员工」「recruit」的 agent-control title/body 有界检索未找到新增案例；
检索未命中不证明对象不存在。旧 HR/其他 Agent 的拒绝、#655 花名册快照和 #996 Workflow Definition 创建
均不充作本次失败；上游隔离成功 fixture 不充作现网成功。

## Options considered

1. 直接加新 `hr_*` 工具、把 session-send 当完整入职、给 HR 管理员或批量补权限：无事实/合同依据，排除。
2. 按旧报告重做 credential provisioning：较新代码与磁盘已有实现，排除重复建设。
3. 直接将 generic Router 默认绑定或 switch 接入新群：忽略既有 PREBOUND_ONLY/固定群模型，排除。
4. 保留 UNKNOWN，修正 SOURCE 结论，复用现有 seam 提出精确元数据补件与差额修复：本轮采用。

## Findings

- 四层本次结论均为 **UNKNOWN**，各自所缺材料已分列；未误用六分类。
- **本轮绑定层第一个可证 SOURCE 关口**：未绑定群的 PREBOUND_ONLY gate；其拒绝符合 accepted 合同。
  **第一个本次业务断点**：UNKNOWN。证据链先断在失败意图关联原件，二者不能混写。
- 上游 SOURCE 结论需两处更新：生产 Feishu 路径不能套 generic default/switch；
  新版本已有 provisioning 实现，旧 ref 的 0 命中不能证明当前未实现。
- 六分类的判定门槛：exact authoritative lookup 为无才判「不存在」；预期模块缺正式包才判「未安装」；
  manifest 已装但目标 child registry 缺项才判「未暴露」；同次绑定/caller/principal 对不上才判「错身份」；
  accepted 岗位所需配置被权威投影证实缺失才判「缺配置」；符合当次实际合同的明确拒绝才判「合法 DENIED」。
  目录不可读、无样本、generic `access_denied` 均为 UNKNOWN。

## Recommendation

以下是提案，**没有执行任何生产变更**；由原唯一协调 Owner 收集并交同一 intent 的材料。

| 精确变更/取证面 | 下一 Owner 与必要输入 | 授权要求 / 允许结论 |
|---|---|---|
| 原招聘入口的脱敏 F/S 收据 | HR/provisioning 维护方：各给准确时间、caller/target canonical ID、operation/request ID、群键或稳定摘要、岗位 accepted 合同、原错误、最后成功阶段 | 导出既有非秘密项目回执即可；不读私有会话，不重试招聘；缺此不能定首断点 |
| Router 同时点只读投影：`registrySnapshot` / `bindingsSnapshot`（`f5:packages/agent-router/src/index.js:833-843`） | 原 runtime Owner：F/S exact 群→activeAgentId，及各 exact Agent→绑定群集合；输出群稳定摘要、计数、对应 canonical/main 校验，勿导出全量私有群信息 | 使用现有受信进程/已有合法观察面；本沙箱不能 sudo，不能 raw-edit bindings；如确证错误，另给精确旧/新 row、唯一性、回滚与写授权 |
| Auth principal/client/岗位 entitlement/scope/role 的 metadata 投影 | Auth Owner：同一 exact target 的 principal 状态、client 绑定、所需 grant 有/无、policy/contract version；trusted-parent credential metadata 只返回 exact-ID PRESENT/ABSENT 与 clientId | 不给 HR secret，不读/拷完整 store；配置类修复需 Owner 批准 target/principal/audience/scopes/roles 的明确差额，不能沿用历史 apply |
| process 与加载证据 | runtime/工具 Owner：同次 proc.agentId、启停、generation、实际 loaded bundle hashes、child 工具名列表与 broker manifest/handler 版本 | 只读 status 投影；磁盘 pack 声明不能替代；不得为取证重启/安装 |
| 若确需 definition→identity→baseline 的源码串接 | lifecycle Owner 先复核现有 `scripts/canonical-agent-onboarding.mjs` / `canonical-onboarding-lib.mjs` 与 `packages/agent-credential-provisioning/`；候选边界见 `main:docs/specs/AGENT_CORE_CANONICAL_ONBOARDING_COMPLETION_V1.md:1-10,29-42,64-69` | 该 child contract 当前仍 proposed-candidate、implementation_authority=none_until_accepted、production_apply_authority=none；先独立评审/Owner acceptance，再做有界实现。不要本轮改 `agent-definition/src/access.js` 扩大 create 合同；不重建平台 |

若后续同次回执证实原因为 `unbound`，且实际加载上述 accepted 合同，才归「合法 DENIED」并交既有绑定/生命周期 Owner；
固定「未绑定」文案本身不能区分 `unbound`、`gate_error`、`non_primary_workspace`；
若证实 broker 配置缺项，则交 Auth/Deployment Owner 做岗位最小差额；
只有证实源码接线偏离已接受合同且修法明确，才在原分支做针对性 RED→GREEN。

## Open questions

F/S 原始入职收据、目标员工/群、accepted 岗位合同、实际 principal、启停/loaded generation、
同次工具 registry、精确 grant 与实际错误均 UNKNOWN。完整“招聘到可工作”业务验收未进行。
本轮诊断交付不关闭 #953，也不代表 issue 正文成功路径已验收。

## Validation

完整命令、依赖、隔离插桩与原始输出见
[validation.md](../evidence/hr-onboarding-diagnostic-r2-20261031/validation.md)。

- 现有完整测试目标（相同 glob，单并发避免既有 fake `/tmp/home` 路径竞争）：
  `node --test --test-concurrency=1 packages/*/test/*.test.js` → **rc 1；463 tests，460 pass / 1 fail / 2 skipped**。
  唯一失败为未改动的 `packages/agent-provisioning/test/provisioning.test.js:90-96`：
  要求 Harness `rc.5 @ a12bb03c6861969985f066bfbf0cb7e5dd5ac567`，
  本机 `rc.8 @ 514ab7b0029141b88c807704764d0d3e1eea1da4`。
  5 个 onboarding-entry 与 12 个 V2 gate 既有测试均通过。
- 初跑 `npm test` 的 4 失败及修正本地 bridge/并发配置后的 1 失败均保留原件；
  不删失败输出、不改测试断言、不伪造 Harness 版本。
- 全部 134 个 `packages/`、`scripts/` JS/MJS/CJS 的 `node --check` → rc 0。
  `package.json` 无 build script；语法检查不冒充 build。
- 测试仅使用本地真实 node_modules 目录及第三方依赖链接；不把 node_modules 整体链接到生产。
  `os.homedir()` preload 指向空 scratch home，阻止既有 provisioning 测试读取真实凭据；
  未赋值 HOME/CODEX_HOME。该插桩及语义影响已披露，不能外推为未插桩的生产行为。
- 相对父提交，产品/既有测试字节零差额。不新增镜像测试；未运行任何生产验收。

**验收限制**：有界调查与分支/issue 交付可完成；“现有测试不红”尚未满足，不能报全绿或 build PASS。
源码 PASS、on-disk presence、LOADED/EXPOSED 与业务通过保持分开。

## Related

- Governing evidence placement：`docs/specs/AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1.md:165-186`（accepted）。
- Definition entry：`packages/broker/src/capabilities/agent-definition.js:70-138`；既有 `packages/broker/test/onboarding-entry.test.js`。
- Identity authority：`docs/specs/AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1.md:548,706,852,993`（父 ref accepted）。
- Feishu accepted implementation：`docs/specs/AGENT_WORKSPACE_SESSION_V2_CORE_ALIGNMENT_SPEC.md:226-254`；
  父 ref D-006 的 supersession 处置在 `docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V2.md:661-669`。
- fetched main 的当前 Decision 为 D-008/V3，整份取代 D-006，仍保留 fixed Feishu：
  `main:docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V3.md:3-19,32-35`；不是把旧分支的 D-006 当现网 authority。

`SPEC_COMPLIANCE = PASS (investigation-only)`：不改 accepted Spec/产品/既有测试，
不重开被否的默认群绑定、旧身份迁移或 OpenClaw 回退方案；`KERNEL_CHANGE=NONE`。
