# #700/#701 当前构建前提核查

```text
INVESTIGATION_ID = AC700-CURRENT-BUILD-20261031
REPOSITORY = mayf3/dsh-agent-core
SUBJECT = agt_family-steward-agent upstream retry-buffer error
OPENED_AT = 2026-10-31T03:52:44Z
DISPOSITION = deferred
PREREQUISITE_RESULT = INCONCLUSIVE
CURRENT_BUILD_REPRODUCTION = UNKNOWN
BUILD_EVOLUTION_RESOLVED = NOT_PROVEN
ORIGINAL_SIDE_EFFECT = UNKNOWN
PRODUCT_IMPLEMENTATION = NONE
PRODUCTION_WRITES = 0
PROBE_MESSAGES_SENT = 0
```

当前保留记录证明家庭会话在历史失败后正常完成过多轮；**尚不能证明当前运行代际已复现该错误，或该错误已被构建演进消解。** 当前保留 recovery store 中，其所声明当前 epoch 的家庭记录数为零；合法最小探测入口在目标解析前被 MCP SSE 隧道 429 阻断。因此不进入根因/修复，不建议以“已消解”关闭 #700 或同步关闭 #701。

## 授权、范围与 DEVELOPMENT_PREFLIGHT

本次授权来自用户的 #700/#701 工作简报：先读完整 issue 及关联业务 #10，可用 sudo -n 做 family-steward 会话/回执状态的只读核查；必要最小消息须先去重且最多一次；在 #700 评论交付。旧 #701 任务中的“不 sudo”由本次明确授权覆盖。授权不包含安装、重启、成员变更、私有正文/Secret 读取或旧请求重放。

```text
DEVELOPMENT_PREFLIGHT
SPEC_GOVERNANCE_MODE = PREFLIGHT
TARGET_REPOSITORY = mayf3/dsh-agent-core
REVIEW_TARGET_HEAD = 0386b34a3d1054c71cbe51a2310fdff4d55c992b (evidence base)
BASE_HEAD = 0386b34a3d1054c71cbe51a2310fdff4d55c992b
CURRENT_BASE_HEAD = 0386b34a3d1054c71cbe51a2310fdff4d55c992b (initial origin/main snapshot)
ROUTE_STAGE = OPERATION
AUTHORITY_ACCEPTED_IN_BASE = YES
GOAL_OR_TARGET = 当前构建前提核查和有证据的 issue 交付
CURRENT_GAP = 缺当前 runtime epoch 的家庭调用结果
AUTHORITY_ACTION = REUSE
PRIMARY_AUTHORITY = AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V3@base
RELATED_AUTHORITIES = .agents/README.md; .agents/local/README.md; local governance lock
IMPLEMENTATION_AUTHORITY = not_applicable
ATOMIC_SPEC_IMPLEMENTATION_PERMITTED = NO
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = DURABLE
EXECUTION_MANDATE = VALID (user brief; exact target, effects and attempt bounds above)
MUTATION_AUTHORIZATION = VALID (isolated evidence documents and requested issue comments only)
ISOLATED_WRITE_SURFACE = YES
CONTROLLED_RUNBOOK_REQUIRED = NO (no production mutation admitted)
SPEC_GAP_DEPENDENCY = NONE (no new product behavior proposed)
EVIDENCE_REVIEWABILITY = PASS (coordinate-bound sanitized receipts and reproducible observer)
LIVE_AUTHORITY_GAP = NONE (no new live behavior proposed)
OWNER_DECISION_REQUIRED = NO
EMERGENCY_STATE = NONE
EMERGENCY_ACTION = NONE
INCIDENT_REFERENCE = mayf3/agent-control#700 and #701
BASE_IMPACT = NONE
IMPLEMENTATION_ALLOWED = NO
MERGE_READY = NOT_APPLICABLE
OPERATION_ALLOWED = YES (metadata reads and authorized issue delivery only)
EVIDENCE_NEEDED = current-epoch exact family reply if supported entry becomes available
DONE_WHEN = persist bounded findings, independent review, #700 delivery and #701 disposition
EXPANSION_TRIGGER = current-build reproduction with attributable failure metadata
NEXT_REAL_ACTION = publish reviewed prerequisite findings; restore supported observation entry
NEXT_ACTION = CONTINUE (evidence delivery only)
```

隔离工作树：`/Users/yanfenma/workspace/worktrees/ac700-buffer-limit-diagnosis`；分支 `ac-task/700-buffer-limit-diagnosis`。原共享 checkout 的 staged/untracked 工作未修改。新基线采用已接受治理 V3；原 checkout 的旧 knowledge Spec 已在该基线 superseded，未沿用其旧 helper 作为当前 authority。

## 观察与证据

所有下列 JSON 均位于 [evidence 目录](../evidence/ac700-buffer-limit-diagnosis-20261031/)。采样时间、路径、实际字节数、SHA-256、mtime 和过滤方法保留在回执内；没有保存消息正文、assistant 输出、工具参数/结果、认证配置或 Secret。

### OBS-700-001 — 原任务及既有交接

- 用 `gh issue view` 读取了 mayf3/agent-control #700/#701 和 mayf3/agent-workflow-operations #10 全文及全部评论。坐标、GitHub 时间和各正文 hash 保存在 `issue-source-metadata.json`。
- [#700 的后续成功读回](https://github.com/mayf3/agent-control/issues/700#issuecomment-6071988521)早在 10-09 已存在；同日成功不证明后续构建修好了故障。
- [#700 最新交接](https://github.com/mayf3/agent-control/issues/700#issuecomment-6394360252)保留原副作用 UNKNOWN，旧 SOURCE 独立审查结果 UNKNOWN，禁止重复 reviewer/重放。
- Fresh `gh pr view`：既有 [harness PR #3](https://github.com/mayf3/deepseek-harness/pull/3) 仍 OPEN、draft，head `6af7aafc638c62fa70866ca0bebba5f96dc56e94`，mergedAt=null。本轮只核元数据，没有重新审查、重做或运行该分类补丁。

### OBS-700-002 — 当前磁盘构建及受支持观察面的实际限制

`readonly-metadata.json`（采样 `2026-10-31T03:59:59.945345+00:00`）记录：

| 对象 | 实测值 | 证据边界 |
|---|---|---|
| installed harness package | `0.1.0-rc.8` | 磁盘包，不冒充 family 当前加载证明 |
| installed llm-pi-ai package | `0.1.0-rc.8` | 同上 |
| shared dsh-codex package | `0.2.3`，package SHA `ac6352ee0be926b459e6a2d523bf456f3233f86f3d978371ba7d41b5c2b2d359` | 不证明本轮模型请求使用它 |
| shared current symlink | `gen-b7-tx-757bcc57a36b46a08417987914c57b35-f87047de260e0f03/node_modules` | 与用户简报一致的磁盘链接 |
| installed app provenance source | `bdbaf8a00dffbede37794c6ed1585bccf8d6f84f` | 制品声明，不升级为加载/业务验收 |

合法 CLI 位于 `/usr/local/libexec/agent-deploy-system/ds_client.py`，PATH 中没有同名命令。执行了 `inspect` 与 `runtime-inputs`；原始安全投影分别保存在 `ds-inspect.json` / `ds-runtime-inputs.json`。二者均明确 `current_runtime_verified=false`。runtime-inputs 返回 loaded argv 与 plist hash 匹配，但不绑定 family 的模型请求；其 credential 投影是 lstat-only UNKNOWN，未跟进读取凭据。

一次 `unit-status --unit agent-core-runtime` 返回 `PROFILE_NOT_AUTHORIZED`，保存于 `ds-unit-status-denial.json`；没有重试该 subject、改身份或借其他入口执行该被拒操作。

### OBS-700-003 — 当前保留的家庭主会话终态

只读取会话结构元数据，实际正文、工具参数/结果和 assistant 输出不导出、不解释。

- 当前 `main/session.jsonl`：714 行，1,032,840 bytes，SHA-256 `4af39a50b0c6eabd7dca80061446da8a4b3d93019953078733a0b1f94a0d5b9b`；解析错误 0。
- 保留的 `turn/start` / `turn/end` 各 9 条，9 条终态全部为 `completed`；第一轮 10-21，最后终态 `2026-10-25T22:01:58.128Z`，seq 5909。
- 精确 buffer 错误文本命中 0；这仅覆盖当前保留文件，不代表完整历史、所有请求大小或相同 PI 路径均已通过。
- 独立 reconciliation 记录对应最后两轮：`s303` / `s304` 均 `state=settled, outcome=completed`，messageId 分别 `dbfc87cc-914b-4b68-aa90-8c1fb7915dbb` / `adc8a7f8-da45-4495-b4a6-5a121a5ae58f`。
- 这两轮属于 epoch `232ecb22-c491-4d06-972a-a1fe6436beeb`；采样时该保留 store 所声明的当前 epoch 是 `87c04aeb-8a2d-4649-a82b-0585ab0957c1`，该 store 内该 epoch 的家庭记录数为 **0**。不将有限留存扩大为全系统没有执行。不能用旧 epoch 的成功当当前 epoch 的验收。
- family 锁文件含 PID 17364，但 `ps -p 17364` rc=1；锁文件存在不等当前 worker 存活。

### OBS-700-004 — 原请求去重/副作用核查

原请求：`om_x100b63b755c5bca8b1ceb9b2c452815`。

对当前保留 main、runtime-evidence、agent-session-messaging-audit 和 turn-recovery 的结构化 ID 字段做精确核对，没有取得该原请求的绑定执行/副作用 receipt。当前 recovery store 有家庭记录 256 条（246 completed / 10 failed），仍不能把其他请求终态用于该原请求。

runtime.err.log 有该错误文本的 2 个行命中，但同一行没有 family ID 或原 request ID；未据邻接关系、日志 mtime 或无时间戳片段推导实例归属、原 HTTP 507、requestBytes、retryCount 或工具执行阶段。缺证仍是 **UNKNOWN**，不是“未执行/零副作用”。

本轮没有重发旧成员请求、没有新成员写入、没有补偿/恢复/清 fence。任何未来探测都必须是独立的只读消息，并按支持的主体合同核验其稳定 key；这些历史空命中不授重放许可。

### OBS-700-005 — 当前最小探测没有发出

通过可用 `myf的 mcp` 插件两次调用只读 `resolve_agent_target(agt_family-steward-agent)`；均在 OpenAI MCP SSE 隧道返回 429/UNAVAILABLE。另一次 #701 task-result 读取也在同隧道 429。实际调用时间未单独捕获；`probe-entry-status.json` 保留的是记录时间，不伪造成调用时间。

没有取得 target_handle，`send_agent_message` 调用数 **0**，没有调用带凭据的私有 HTTP 入口、换身份或改会话补发。此 429 是观察入口失败，**不是原家庭上游缓冲错误复现**。

## Claim 与处置

| Claim | 支持状态 | 理由 |
|---|---|---|
| 原错误后家庭会话正常完成过请求 | SUPPORTED | OBS-700-001/003；明确历史坐标 |
| 当前共享磁盘构建已演进为 rc.8 / codex 0.2.3 / gen-757… | SUPPORTED（磁盘范围） | OBS-700-002 |
| 当前运行代际仍复现原缓冲错误 | OPEN_ASSUMPTION / UNKNOWN | 当前保留 store 未提供该代际家庭执行结果，探测入口不可用 |
| 该错误已被构建演进消解 | OPEN_ASSUMPTION / NOT_PROVEN | 旧构建当日也成功过；缺当前加载与对照证据 |
| 原成员请求没有副作用 | OPEN_ASSUMPTION / UNKNOWN | 缺原执行及 mutation receipt |

`DISPOSITION=deferred`，`IMPLEMENTATION_ALLOWED=NO`。本次没有进入 llm-pi-ai/网关的根因或代码修复阶段；RED→GREEN 为 NOT_APPLICABLE，不能复用旧分类补丁测试充当本轮复现或业务验收。

不建议现在关闭 #700/#701。#701 的原 SOURCE PR 及 review-unknown 交接保持原样；本次非作者审查仅审核此调查证据与交付结论，不替代该 PR 的 exact-head review。

## 下一最小动作与重新进入条件

1. 责任在 MCP 隧道/connector 可用性维护方：恢复原受支持观察/通信入口；不需要用户提供 token 或重建主密钥。本轮不为 429 改控制器、部署系统或网络权限。
2. 入口恢复后，先查稳定的新只读探测 key 是否已有结果，再 resolve 同一 canonical target；有已有结果就复用。必须核当前主体准入与会话/fence；不得为测试解除限制。确有必要且合法时最多发送一次：`只回复 AC700_READONLY_OK；不要调用工具、恢复旧任务或执行写操作。` 本轮未保留/使用任何新发送 key。
3. 保存当前 epoch/实际加载身份、exact request/message/reply 与终态；成功仅支持该当前探测路径未复现，不能证明原 PI 请求体尺寸/路径故障永久消失，更不能改变旧成员副作用 UNKNOWN。
4. 若当前同类错误再次出现，再依本任务进入确切失败层及请求/重试元数据定位；若需要实现，重新核 owning repository 的 governing accepted Contract 后做最小 RED→GREEN 及非作者审查。

## 验证与稳定引用

- 观察器：[observe-readonly.py](../evidence/ac700-buffer-limit-diagnosis-20261031/observe-readonly.py)，仅向 stdout 输出白名单元数据；实际以 `sudo -n /usr/bin/python3 <observer>` 执行，rc=0。观察脚本及 JSON 是诊断证据，不是产品实现。
- JSON 解析、跨记录末轮绑定、9/9 终态、当前 epoch 零 family 记录、零发送及证据 SHA 核验见 `VALIDATION.txt` / `MANIFEST.sha256`。
- 非作者审查见 `INDEPENDENT_REVIEW.md`。评论发布和远端读回由交付回执记录。
- [#700](https://github.com/mayf3/agent-control/issues/700)、[#701](https://github.com/mayf3/agent-control/issues/701)、[业务 #10](https://github.com/mayf3/agent-workflow-operations/issues/10)。
