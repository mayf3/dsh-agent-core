# #953 第 2 轮：脱敏案例来源回读

本文件仅记录既有 Issue 的只读检索及最小项目证据，不保存完整 Issue、私有会话正文、凭据或认证文件。未发送消息、招聘、建群、授权、运行 apply 或重放任何业务请求。GitHub 读取成功不等于该历史业务对象当前仍有效。

采集时间：2026-10-30T20:55:33Z–20:55:37Z（UTC），即 2026-10-31 04:55:33–04:55:37（Asia/Shanghai）。以下六条命令由 Python `subprocess.run(argv, text=True, capture_output=True)` 顺序调用；每条 rc=0。原始 JSON 只在内存中解析，未另存全文。

## 1. 可复验检索及有界负证据

| UTC 完成时间 | 精确命令 | rc | 最小输出 |
|---|---|---|---|
| 2026-10-30T20:55:33.215398Z | `gh issue list --repo mayf3/agent-control --state all --search '"招聘" in:title,body' --limit 100 --json number,title,createdAt,updatedAt,url` | 0 | 仅 #953、#965 |
| 2026-10-30T20:55:34.052096Z | `gh issue list --repo mayf3/agent-control --state all --search '"新员工" in:title,body' --limit 100 --json number,title,createdAt,updatedAt,url` | 0 | 仅 #953、#965 |
| 2026-10-30T20:55:34.707843Z | `gh issue list --repo mayf3/agent-control --state all --search 'recruit in:title,body' --limit 100 --json number,title,createdAt,updatedAt,url` | 0 | 仅 #953 |

对应的搜索结果元数据：

- [#953](https://github.com/mayf3/agent-control/issues/953)：createdAt=`2026-10-12T01:42:36Z`，updatedAt=`2026-10-12T07:43:19Z`。
- [#965](https://github.com/mayf3/agent-control/issues/965)：createdAt=`2026-10-12T07:23:13Z`，updatedAt=`2026-10-12T07:44:15Z`。

这些结果只说明上述仓库、关键词和 title/body 搜索范围内未返回新增案例；不证明所有系统或私有会话中没有案例，也不把检索未命中归为员工“不存在”。

## 2. 上游 #965 原交付及失败样本缺口

- 命令：`gh issue view 965 --repo mayf3/agent-control --json number,title,url,comments`
- UTC 完成时间：`2026-10-30T20:55:35.365768Z`；rc=0。
- 原件：[#965 终结评论 6119953594](https://github.com/mayf3/agent-control/issues/965#issuecomment-6119953594)，createdAt=`2026-10-12T07:44:10Z`。
- 最小终结字段：`status: completed`、`error: none`、`exit_code: 0`、`finished_at: 2026-10-12T07:44:08.112105+00:00`。
- 回读逐字命中：“最近失败样本与最后成功用例在脱敏回执中缺席”。原交付将该缺口保持为 UNKNOWN，并明确不能由隔离 fixture 推导现网根因。
- 本次失败招聘的 request/operation/delivery ID：**UNKNOWN**；该回执未提供可归属本次新员工失败的业务关联值。执行器 session、Git SHA、Issue/comment ID 均不能代替招聘 operation ID。

## 3. 既有成功工作员工对照：仅通信链成功

### 3.1 #419 已接受的历史证据

- 命令：`gh issue view 419 --repo mayf3/dsh-agent-core --json number,title,url,comments`
- UTC 完成时间：`2026-10-30T20:55:35.972161Z`；rc=0。
- 原件：[Core #419 评论 5936848762](https://github.com/mayf3/dsh-agent-core/issues/419#issuecomment-5936848762)，createdAt=`2026-10-01T17:29:16Z`。
- 最小回读字段：`BUSINESS_VERIFIED = yes`，其说明引用 `2026-09-17 §10.2 production E2E A–D PASS / E–F DENY + L2 dual-chain receipt`；当轮另增加 composed TEST_IDENTITY 证明。
- 此处 2026-09-17 是被引用的生产验收日期；2026-10-01 是该评论时间，不能互相替代。

### 3.2 #469 后续只读复核指出的具体成功通信双方

- 命令：`gh issue view 469 --repo mayf3/agent-control --json number,title,url,comments`
- UTC 完成时间：`2026-10-30T20:55:36.650200Z`；rc=0。
- 原件：[#469 终结评论 6011218324](https://github.com/mayf3/agent-control/issues/469#issuecomment-6011218324)，createdAt=`2026-10-06T07:06:41Z`。
- 最小相关摘录：“2026-09-17 接受的 §10.2 生产周期（A: `agt_build-in-public-agent` → `agt_content-ops-agent` 通过；E/F 拒绝分支；持久回执）”。该评论明确未重新运行该生产发送。
- 该回执还记录 receiver 在自身 process/workspace 中执行、运行时冻结 sender、持久 receipt 和回复关联的既有证明；本轮仅回读项目记录，没有调用这些能力。
- 该成功通信的精确 request/operation/delivery/message ID：**UNKNOWN**；上述被选回执未给出可独立读回该 2026-09-17 发送的业务 ID。工具名 `agent_session_send`、字段名 `requestId` / `invocationCorrelation`、TEST_IDENTITY 测试、其他 WDA 运行坐标都不能代替该历史发送的实际值。
- 招聘创建入口、原入群接受回执、新员工岗位合同、当次群绑定与 principal 全链：**UNKNOWN**。通信成功不能补齐这些步骤，也不能称为完整“招聘成功样本”。

## 4. 本次失败与历史成功对照

| 关联字段/阶段 | F：#953 所报新员工失败 | S：2026-09-17 既有员工通信成功 |
|---|---|---|
| 原始请求、准确时间 | UNKNOWN | 生产验收日期已被 #419/#469 引用；具体发送时间 UNKNOWN |
| canonical 参与方 | UNKNOWN | sender=`agt_build-in-public-agent`，receiver=`agt_content-ops-agent`（#469 回执） |
| 招聘 operation / 请求幂等键 | UNKNOWN | UNKNOWN；本例只证明通信 |
| 创建/加入群被实际接受 | UNKNOWN | UNKNOWN |
| 同次 activeAgentId 正反绑定 | UNKNOWN | UNKNOWN |
| 同次 runtime/canonical/principal/启停投影 | UNKNOWN | 历史通信 receiver 身份证明被接受；本轮当前身份 UNKNOWN |
| 岗位合同、最小 entitlement/scope/role | UNKNOWN | #419 的 fleet send entitlement 已有历史验收；不能外推其他岗位权限 |
| 工具运行、持久回执、回复关联 | UNKNOWN | 历史生产通信 PASS 被 #419/#469 接受；精确业务 ID UNKNOWN |

**可证结论**：本次业务第一个断点仍为 UNKNOWN。证据链先缺“失败入职意图 → canonical 员工/群/operation”的可关联原件，无法把 SOURCE 缺项或历史其他员工错误判作本次断点。六分类中的“错身份”“缺配置”“合法 DENIED”等均需同一意图的实际证据后才能作出。

需要原招聘/provisioning 入口维护方导出的两份脱敏收据：失败 F 和最后成功 S，各含准确时间、caller canonical ID、目标 canonical ID、operation/request ID、群键或稳定摘要、岗位 accepted 合同、原错误与最后成功阶段；随后用这些值精确核对现有非秘密绑定/runtime/principal/工具装配投影。不需新建员工、读取秘密或重放请求。

## 5. 明确排除的相邻材料

- [#655 花名册回执](https://github.com/mayf3/agent-control/issues/655#issuecomment-6053143350)（2026-10-08）是 registry/binding/principal 分层快照，非本次招聘 operation。
- [Core #473 历史分类矩阵](https://github.com/mayf3/dsh-agent-core/issues/473#issuecomment-6011777609)（2026-10-06）记录双 HR principal 职责差异，非当前身份/授权权威，不能将旧 `hr-agent` 的错误移给本次新员工。
- [#996 终结回执](https://github.com/mayf3/agent-control/issues/996#issuecomment-6135001283)（2026-10-13）是 Workflow Definition 创建，非招聘数字员工。
- 本地历史 `docs/investigations/huanhuan-binding-investigation-v1.md:78-108`（2026-09-03）记录旧 OpenClaw 创建流程漏写 Agent Core definition/binding，非 #953 本次失败；未将它充作 F。
