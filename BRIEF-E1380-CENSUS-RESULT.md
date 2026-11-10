# E1380 — 跨 attempt 业务效果承接只读核查结果

执行范围：原 [BRIEF-E1380-CENSUS.md](BRIEF-E1380-CENSUS.md) 五节；[agent-control #1380](https://github.com/mayf3/agent-control/issues/1380)、[#1374 §5](https://github.com/mayf3/agent-control/issues/1374)。核查日期 2026-11-10（Asia/Shanghai）。本报告是 Investigation/Evidence，不创设产品合同、执行权或风险接受。

**结果：五节核查完成。已有 managed 三操作稳定效果机制和跨 attempt 丢响应回归；六对实例仍开放，未找到可证明重复发布或证明零发布的平台效果证据，外部效果为 UNKNOWN。** 生产写入=0；未重放、部署、重启、改权限、清 fence、取消实例或调用业务写入口。仅文档 commit/push/PR 获授权，不合并。

```text
schema_version: 2
SPEC_GOVERNANCE_MODE = PREFLIGHT
TARGET_REPOSITORY = mayf3/dsh-agent-core
BASE_HEAD = 1cde410046a5e2a45819455f078cd72b22671d6f
SOURCE_REVIEW_HEAD = BASE_HEAD
ISOLATED_WORKTREE = /private/tmp/e1380-census
BRANCH = census/e1380-effect-succession
GOAL_OR_TARGET = 五节只读核查并交付简报+报告的未合并 PR，push 失败则 bundle
CURRENT_GAP = 历史源码基线过期，六对承接及外部效果尚未证实
AUTHORITY_ACTION = REUSE
ROUTE_STAGE = OPERATION
AUTHORITY_ACCEPTED_IN_BASE = YES
PRIMARY_AUTHORITY = AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V3 + accepted lock rc.3
RELATED_AUTHORITIES = WEC V5 + PPR V2 + Owner Obligation Workflows V2
IMPLEMENTATION_AUTHORITY = not_applicable
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = DURABLE
EXECUTION_MANDATE = VALID (当前用户任务 + 原简报；只读 DB + 两份文档交付)
MUTATION_AUTHORIZATION = VALID (仅隔离文档、git 分支及未合并 PR)
ISOLATED_WRITE_SURFACE = YES (单一文档 writer；并行核查者只读)
CONTROLLED_RUNBOOK_REQUIRED = NO (未执行 Controlled mutation)
SPEC_GAP_DEPENDENCY = NONE (本次证据核查不依赖新增产品决定)
IMPLEMENTATION_ALLOWED = NO
OPERATION_ALLOWED = YES (仅本 brief 指定读取和文档交付)
MERGE_READY = NO (用户明确禁止合并)
EVIDENCE_NEEDED = 固定源码/差异、DB只读快照/准确ID、证据局限、独立文档复核
DONE_WHEN = 五节完成 + commit/push origin及PR(base main)，或可验证bundle
EXPANSION_TRIGGER = 需要生产写入/重放/新权限/产品语义改变即停止依赖动作
NEXT_REAL_ACTION = 交付只读报告；产品接线/业务承接留原责任链
```

已读 `.agents/README.md`、`.agents/local/README.md`、spec-governance/PREFLIGHT、Product Architecture、Current Decision index/D-009 及直接相关 governing Specs。当前 main 的顶层为 accepted **WEC V5/PPR V2/Owner Workflows V2**；WEC4/PPR1 已有 reciprocal successor 链，local README 的旧版本导航不能替代该 accepted lifecycle。这里仅注明导航漂移，不修改权威或由此授权实现。所有源码链接固定到上述 Core SHA 或 Svc main `7d32fbb419acb2e982275f94332beb9cfe007a15`（查询时 remote main 与本地 origin/main 一致）。后者是源码坐标，不是当前服务 loaded SHA。

## 1. attempt-identity 现状及与 eb8fd189 的差异

[packages/workflow-execution/src/attempt-identity.js:27](https://github.com/mayf3/dsh-agent-core/blob/1cde410046a5e2a45819455f078cd72b22671d6f/packages/workflow-execution/src/attempt-identity.js#L27)：`attemptIdFor(nodeVisitId,generation)` 先小写 NodeVisit UUID；g1 哈希 UUID，gN 哈希 `UUID#genN`，取 SHA256 前24 hex，前缀 `wfeat-`。同 visit/generation 稳定，合法下一 generation 改变 attemptId。

与旧 Core `eb8fd18934d827cec98faacaef987869c5cb92e7` 相比，本文件仅 **+20/-0**；生成算法未改。新增的是 [packages/workflow-execution/src/attempt-identity.js:7](https://github.com/mayf3/dsh-agent-core/blob/1cde410046a5e2a45819455f078cd72b22671d6f/packages/workflow-execution/src/attempt-identity.js#L7) 的 `validateObservationIdentity` 和提交锁内 `staleObservation`：独立比较 expectedAttemptId、expectedGeneration，不匹配返回 `stale_observation`、不 append。旧基线的“attemptId 随 generation 变化”仍成立，不能据此认定现有业务效果必然重复。

[packages/workflow-execution/src/ledger-admission.js:110](https://github.com/mayf3/dsh-agent-core/blob/1cde410046a5e2a45819455f078cd72b22671d6f/packages/workflow-execution/src/ledger-admission.js#L110)：新 visit 为 g1，默认阻止已有 attempt；只有合法 stale reentry/Owner resume 等原门通过才可生成 gN+1。[packages/workflow-execution/src/engine.js:65](https://github.com/mayf3/dsh-agent-core/blob/1cde410046a5e2a45819455f078cd72b22671d6f/packages/workflow-execution/src/engine.js#L65) 将可信 provenance 绑定 instance/visit/attempt；`:96–110` 使用 `requestId=attemptId`。

三类身份保持分离：attempt generation 是同 visit 的执行尝试序号；[packages/agent-router/src/process-registry.js:69](https://github.com/mayf3/dsh-agent-core/blob/1cde410046a5e2a45819455f078cd72b22671d6f/packages/agent-router/src/process-registry.js#L69) 是 per-Agent `processGeneration`；[packages/agent-router/src/reconciliation/store.js:59](https://github.com/mayf3/dsh-agent-core/blob/1cde410046a5e2a45819455f078cd72b22671d6f/packages/agent-router/src/reconciliation/store.js#L59) 的 runtimeEpoch 默认 UUID。它们不互为业务 operation identity，数值相等也不能替换证明。

`ledger-events.js` 对旧基线为 **+17/-4**：增加 deliveryProtocol/recovery_checked/readback_checked 等投影/审计，核心 fence 未变。[packages/workflow-execution/src/ledger-events.js:171](https://github.com/mayf3/dsh-agent-core/blob/1cde410046a5e2a45819455f078cd72b22671d6f/packages/workflow-execution/src/ledger-events.js#L171)、`:395–402` 仍约束**同一个 attempt 至多一条 delivery_started**。这是投递 WAL，不是跨 attempt、跨实例的平台效果唯一性证明。

复核方法：`git diff --numstat <旧Core> <本次Core> -- 上述两文件` 及完整 diff/源码阅读；未运行模型、Run 或业务测试。

## 2. workflow_operation_effects 的实现、覆盖和存储

Core [packages/broker/src/capabilities/workflow/owner-operation-registry.js:2](https://github.com/mayf3/dsh-agent-core/blob/1cde410046a5e2a45819455f078cd72b22671d6f/packages/broker/src/capabilities/workflow/owner-operation-registry.js#L2) 与 Svc [src/domain/definition/owner_obligation.rs:70](https://github.com/mayf3/svc-workflow/blob/7d32fbb419acb2e982275f94332beb9cfe007a15/src/domain/definition/owner_obligation.rs#L70) 是闭合三类 registry：

| 支持范围 | 操作 | 当前实现边界 |
|---|---|---|
| Managed INTAKE/REVIEW | `workflow.create_instance` | 创建固定 published Version/digest 的普通依赖叶子 |
| Managed REVIEW | `workflow.assistance.resolve_current_review` | 同 case、真实 child proof 的既有 assistance resolve |
| Managed assistance | `workflow.assistance.escalate_to_human` | 既有 assistance 的授权升级 |
| 六对普通分发实例/任意平台发布/任意工具 | 不在以上闭合 registry | 不能凭同名 metadata 或替代关系认定被覆盖；其他后端能力需逐入口取证 |

[migrations/0031_owner_obligation_workflows.sql:62](https://github.com/mayf3/svc-workflow/blob/7d32fbb419acb2e982275f94332beb9cfe007a15/migrations/0031_owner_obligation_workflows.sql#L62) 持久表拥有 effect_id、descriptor、intent/request digest、state、command_id、result/result_digest/failure。稳定唯一键为：

```text
(case_id, managed_instance_id, definition_version_id,
 node_definition_id, slot_key, logical_occurrence=1)
```

键不含 attempt、NodeVisit、Owner、CAS 或输入 digest；同槽换输入应冲突，而非另造效果。state 为 `PREPARED|STARTED|SUCCEEDED|REJECTED_ZERO_FACTS|UNKNOWN`；command_id 唯一，成功必须绑定 command/result/digest。migration `:86–106` 固定语义身份和终态，`:251–284` 用 deferred constraints 关联真实 receipt/Event/create origin 或 assistance facts。该表由 Svc 拥有，不是 Core attempts.jsonl。

[src/store/postgres/workflow_instance_repository/owner_obligation/effects.rs:83](https://github.com/mayf3/svc-workflow/blob/7d32fbb419acb2e982275f94332beb9cfe007a15/src/store/postgres/workflow_instance_repository/owner_obligation/effects.rs#L83) 在 Domain/source+managed Instance 锁和事务内检查 current Owner、assignee、visit、published descriptor；`:114–132` 比较 business intent，同槽不同输入 `409 idempotency_conflict`，SUCCEEDED 重放原结果，其他未决状态 `503 outcome_unknown`。`:166–180` 由服务端生成 effect UUID，再派生 `owner-effect:{effect}` command key。`:228–294` 在现有事务内完成 receipt claim、实际 DB 操作和 result；确定拒绝回滚事实并保存 `REJECTED_ZERO_FACTS`/STOP，5xx 不伪造零效果。

[src/store/postgres/workflow_instance_repository/owner_obligation/reads.rs:86](https://github.com/mayf3/svc-workflow/blob/7d32fbb419acb2e982275f94332beb9cfe007a15/src/store/postgres/workflow_instance_repository/owner_obligation/reads.rs#L86) 读 exact stable 槽并核原 completed receipt/body/digest；`:136–229` 的 managed relation 一致只读查询可找回丢失首响应的 effectId，`:231–246` 支持已知 ID 的 effect GET。权限仍由 [src/http/handlers/owner_obligation.rs:26](https://github.com/mayf3/svc-workflow/blob/7d32fbb419acb2e982275f94332beb9cfe007a15/src/http/handlers/owner_obligation.rs#L26) 的 `workflow.read` / `:54–80` 的 `workflow.execute` 加 current Owner/assignee 校验决定，不扩大为全局枚举或平台发布权。

**历史对照：** Svc main 相对 `59daec042786f0416a6a9061c0b638ba56c0d83e`，`effects.rs`、`reads.rs`、migration 0031 三文件 diff 均为空；blob 分别为 `a7de48233b2d7464580feaf7ad791a2bb7be2c54`、`702f5146b51bb5eef8b91db855ce5a369ddc5327`、`052896b90024c5150f9962735a48cf74d3fdaed0`。Core owner guard/read manifest/registry 对旧 Core 也未变。不要把已有机制重报为新缺口。

## 3. 六对原／替代发布实例的当前 DB 核查

使用 `/opt/homebrew/bin/psql -X -w -v ON_ERROR_STOP=1`，仅从本机既有凭据读入连接环境，未打印 secret。强制 `PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=15000'`，每次包裹 `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; … ROLLBACK;`。未使用 sudo、DDL、DML、临时表、存储过程或写接口。首次无凭据 socket 连接被拒（`fe_sendauth: no password supplied`），随后用现有本地凭据完成授权读取，未改连接配置或角色。

主快照 **2026-11-10 21:21:35.643088+08**：DB `svc_workflow_dogfood_clean`，role `svc_wf`，`::1:5432`，read_only=`on`，isolation=`repeatable read`，snapshot=`3546263:3546263:`。补充 assistance/计数快照 **21:23:39.204658+08**，同一 snapshot ID；这是两次事务，未声称同一个事务。以下全部为本机该 DB 的当时观察，不推定任意远端或外部平台状态。

以未取消、未归档、metadata 含 `replacesInstanceId` 的替代实例关联原实例，共 **6对/12实例**；它们全部属于 `single_platform_dist_v1`，两侧均 cancelled=false、archived_at=NULL。

| 原 v5 实例 | 替代 v6 实例 | platform / contentId | 原节点 / sv | 替代节点 / sv |
|---|---|---|---|---|
| `06905ef3-2073-43ad-8b70-830257dee1ee` | `a70577fb-d2e6-4f2f-8a5a-6cea6c5c62d3` | 知乎 / 2026-11-04 | waiting_authorization / 6 | publishing / 4 |
| `407141d7-2013-4ec9-b830-bb6297308920` | `0f960c7f-2542-4b9a-9f7d-fde84a7a0da3` | CSDN / 2026-11-04 | waiting_authorization / 6 | publishing / 4 |
| `5f5fa1e4-4d86-4851-af84-ac1ccf7879c8` | `a65e1cb2-89c5-415a-8126-8666dbb3ccb0` | CSDN / 2026-11-05 | waiting_authorization / 9 | publishing / 4 |
| `9975aa98-0c5a-4a24-a312-1df8828327a4` | `0e17efaa-a355-414e-9bfe-7b458d5e261a` | 掘金 / 2026-11-04 | waiting_authorization / 6 | publishing / 4 |
| `b08748ff-2e83-4e17-a7fb-b22703c37a48` | `57f81c18-3eaa-4b06-9709-1356cee75188` | 知乎 / 2026-11-05 | waiting_authorization / 9 | publishing / 4 |
| `ead8fc1f-a06d-4856-be8b-dc87f3c78cb2` | `e266baff-41b4-45d7-9f26-20faf0e98363` | 掘金 / 2026-11-05 | publishing / 5 | publishing / 4 |

六对的 `platform/contentId/sourceUrl/sourceArtifactRef/parentInstanceId` 逐字段比较全部相等。原 metadata.dedupeKey 为 `article:<日期>:<平台>:7640f918或f2b2df75`；替代值为 `replacement:<原实例短ID>:single-platform-v6`。这是不同 metadata 文本，不是已验证的后端唯一键。字段相等只是同一意图线索，未证明不可变内容版本、可信许可、唯一执行权或平台原子去重。

历史另有 `8bb8c723-3858-4fa0-9185-e9f0968717d2` 同样 replaces `5f5fa1e4…` 且与 `a65e1cb2…` metadata.dedupeKey 相同，但已 cancelled=true、sv3，archived_at=`2026-11-09 13:49:52.539457+08`；因此没有算成第七个开放替代实例。**这证明该 metadata 值未阻止两条 Workflow 记录创建，不证明平台重复发布。** 原历史未改。

事件/结果观察：

| 12实例内证据 | 实测 |
|---|---|
| `workflow_events` | 65条：INSTANCE_CREATED 12、TRANSITION_COMMITTED 11、ASSISTANCE_REQUESTED 20、RESOLVED 8、ESCALATED_TO_HUMAN 14 |
| 最后 transition | `2026-11-09 13:51:38.370764+08`；六个v6都是 entry→publishing；五个v5 publishing→waiting_authorization |
| 最后事件 | `2026-11-09 13:53:06.123623+08`；本快照之前11/10无这12实例的新事件 |
| 当前 assistance | 12条开放 case，全为 HUMAN_REQUIRED，绑定各自 current visit；case和visit准确ID见下表 |
| `workflow_submissions` | 仅5条，全部 `to-waiting-authorization`，payload keys=`evidence_gaps,authorizationRequested`；没有 url/postId/verificationResult |
| operation-effects | 对这12个 `managed_instance_id` 查询，各0行；其v5/v6全部 node metadata 无 `workflowOperation` |
| 关联 command receipts | 65条 COMPLETED，类型计数与上述5种内部事件一致；200/201是内部建单/转移/求助回执，不能当平台发布成功 |
| 历史/current context、submission、event_data 的对象键遍历 | URL/postId/readback/receipt/contentVersion/verification/operation 候选中仅12个 context `.sourceUrl`；不是发布目标回执。遍历不解析文本内叙述或数组，不能证明记录之外没有效果 |

v5 Version=`6942c246-f9fb-4dd7-9d15-0a500cd1f4ca`，v6=`0175f649-d7e2-47b8-9f5a-31f25a9febd9`。v7 **已 PUBLISHED**：`0562891a-4839-4b23-9430-6eb868fd4867`，published_at=`2026-11-10 20:26:11.248590+08`，definition_digest=`eeb4b6ffef7814926deae633e4e89871f4f65f61cf8295ba84d51815c5266167`。保留该既有成果；发布v7没有自动迁移这12实例。两个 parent 当时仍为 `89f19a8b-da6a-4eed-819b-730b49aa670c` verification/sv32、`2a5c8a00-8716-4bae-8ac4-a37fea07ab6f` publishing/sv41，未将它们的既有线索混成子实例已验收。

**证据结论：** 六对的当前状态、相同业务线索及未闭合责任均已证；实际发布次数、原效果是否发生、是否重复、哪个身份仍可执行、平台读回与父验收均为 **UNKNOWN/未证明**。没有调用外部平台适配器或重发来“验证”。无 effect 行、无 Workflow 新事件、无结构化发布回执都不能推出零外部效果；HUMAN_REQUIRED 也不自动证明通知已送达或责任可运行。

<details>
<summary>12实例 current visit / 开放 assistance / context digest 坐标</summary>

| 实例 | current nodeVisitId | assistanceCaseId | current context payload_digest |
|---|---|---|---|
| `06905ef3-2073-43ad-8b70-830257dee1ee` | `47783eef-17b4-4505-a2f2-6500aadbabdd` | `c055554d-5040-43c5-8194-aeb92967d684` | `a05a377dbe15a8ec52f93538f979cbe8e5e29d82dfc8c4e9b703d7328a00a6dc` |
| `0e17efaa-a355-414e-9bfe-7b458d5e261a` | `342f76ab-9a33-4fa8-8752-ce20cb025c20` | `cae8c2fd-c25f-4cc0-b135-313c06a94426` | `5ddb1673769410b45b146247e81849cbe0e5576a18b4a2ee915fb23225a6b4fb` |
| `0f960c7f-2542-4b9a-9f7d-fde84a7a0da3` | `077d7400-f761-4677-8507-0f747a84a1f0` | `12ac4200-01c3-4985-93ea-d64564e170e9` | `749f39b2d968942d4394f967bda7e0e5ed707dd983a81211543c14ab6ba6a52f` |
| `407141d7-2013-4ec9-b830-bb6297308920` | `c433e74f-6130-4e4a-9417-536806c4e2f7` | `e78f720a-0a0e-49b9-abbf-4889f9b3d9e6` | `3de52c5882976f858575d25a954b6b063876400b3737d4b2ff0d1bf5de49cc30` |
| `57f81c18-3eaa-4b06-9709-1356cee75188` | `1641ea2d-c427-4516-b619-029539b03317` | `e1d488cd-0356-4105-8198-814f1e89c6f9` | `da2c857b48cf66a0ff091ed4f1e84612fe594aec953ff07f1a4d352c8f857c2f` |
| `5f5fa1e4-4d86-4851-af84-ac1ccf7879c8` | `bc928e6a-0929-4d9a-bd41-3cc1e2b021a3` | `12b949a1-f573-4bac-932e-e4f2cf6f3713` | `973bd9e1fa2e3608d09963f5048bbf4267c834d3ea1c7a6eafe7d010828a22ec` |
| `9975aa98-0c5a-4a24-a312-1df8828327a4` | `56f0e024-e921-4547-880e-2ee20d6ba9de` | `469c6f4d-dac4-475f-a28f-df2b97457170` | `0f8a2ae2c17200abf0f22b7066b402986183feda4d20c8aa5e63ec87d8fb3b3f` |
| `a65e1cb2-89c5-415a-8126-8666dbb3ccb0` | `21f42757-f4f0-4bdb-a434-7cca656aaa07` | `0075f925-2b3d-47dd-a523-8a89c70f2402` | `acd2bc9dc65774d799edb36b22fd5c951d8f432b632e4da95b12761977e6c3df` |
| `a70577fb-d2e6-4f2f-8a5a-6cea6c5c62d3` | `5ee67658-21b1-4af7-af03-15909ec2c581` | `502658c3-7b16-4229-a75c-b53738aa09f2` | `d9be92b647a7fa15f4254d2925dfa9d4298a6a87d18ecbce1de0201c6e814ff9` |
| `b08748ff-2e83-4e17-a7fb-b22703c37a48` | `519b8d83-d9d3-4b6b-a011-167ac1c87bc8` | `e0c87ef8-2b5f-47bc-a341-4c44f4d0e7e2` | `e77b603572d708a21423d9be69747f967517a102cd7506974102d5309429be92` |
| `e266baff-41b4-45d7-9f26-20faf0e98363` | `a9a1bffe-21bc-49ed-8438-2b8a522b4adb` | `428ac865-70de-4363-ab84-a17bb44b385f` | `df4328c9de512a992c9d7c70857343760c46af2985b4ed430275335363b5235f` |
| `ead8fc1f-a06d-4856-be8b-dc87f3c78cb2` | `b4c5cf3e-c08a-4f02-8284-537fa30ba727` | `d9b0e79d-3571-450b-bd9d-4e5863171c4e` | `50e315793358d31e6b271a120f277e4e4615b5fb1676e2e3e3ad743b9ebce98a` |

</details>

<details>
<summary>已执行 SQL 与脱敏原始输出的校验及复现</summary>

以下是本次实际执行的 SQL 原文；均由前述只读事务包装。凭据由有权操作者在本机环境提供；报告不包含 URL密码、token、业务正文或完整生产记录。原始输出保留 `/tmp`，Git 内提供有限坐标和结论；未来复查必须记录新时间/快照，不能冒称重现历史状态。

| 文件 | SHA256 |
|---|---|
| `/tmp/e1380-census.sql` | `9898a76af89058b25e67412c8dfff96dff8091d2657b38b6d7867c540350a919` |
| `/tmp/e1380-census-raw.txt` | `dabaf18c6af960562504b62798b59c30cf56cbe5f4a66d2dff62516cc6bee637` |
| `/tmp/e1380-summary.sql` | `69aa94a48289817956b7635b5f3777e308198f9224307e94fedbf4838dec656f` |
| `/tmp/e1380-summary-raw.txt` | `0dd3e9609850ed1469ae4798f79d537418db35e3646515209a87a96ec585c2ed` |
| `/tmp/e1380-evidence-discovery.sql` | `71b2275f1c573cf5e486ce432a2d118f320f8c8c4577336cdbc9a602b34a899e` |
| `/tmp/e1380-evidence-discovery.txt` | `cbfb4dd6665ca728a9f5c8aa8a3d86a3c17507d6a6f442cc4ee6c11a78136c26` |

`e1380-census.sql`：

```sql
SELECT clock_timestamp() AS sampled_at,current_database(),current_user,inet_server_addr(),inet_server_port(),current_setting('transaction_read_only'),current_setting('transaction_isolation'),pg_current_snapshot();
WITH pairs AS (SELECT workflow_instance_id AS replacement_id,(metadata->>'replacesInstanceId')::uuid AS original_id FROM workflow_instances WHERE metadata ? 'replacesInstanceId' AND NOT cancelled AND archived_at IS NULL), targets AS (SELECT original_id AS id FROM pairs UNION SELECT replacement_id FROM pairs) SELECT p.original_id,p.replacement_id,d.definition_key,v.version_number,n.node_key,n.node_type,i.workflow_state_version,i.current_node_visit_id,i.cancelled,i.archived_at,i.updated_at,c.payload_digest,c.payload->>'platform' AS platform,c.payload->>'contentId' AS content_id,c.payload->>'parentInstanceId' AS parent_id,i.metadata->>'dedupeKey' AS metadata_dedupe_key
FROM pairs p JOIN workflow_instances i ON i.workflow_instance_id IN(p.original_id,p.replacement_id) JOIN workflow_definition_versions v ON v.definition_version_id=i.definition_version_id JOIN workflow_definitions d USING(workflow_definition_id) LEFT JOIN workflow_node_visits nv ON nv.node_visit_id=i.current_node_visit_id LEFT JOIN workflow_node_definitions n ON n.node_id=nv.node_id LEFT JOIN workflow_context_revisions c ON c.context_revision_id=i.current_context_revision_id ORDER BY p.original_id,v.version_number;
WITH pairs AS (SELECT workflow_instance_id AS replacement_id,(metadata->>'replacesInstanceId')::uuid AS original_id FROM workflow_instances WHERE metadata ? 'replacesInstanceId' AND NOT cancelled AND archived_at IS NULL), targets AS (SELECT original_id AS id FROM pairs UNION SELECT replacement_id FROM pairs) SELECT p.original_id,p.replacement_id,
co.payload->'platform'=cr.payload->'platform' AS same_platform,co.payload->'contentId'=cr.payload->'contentId' AS same_content_id,co.payload->'sourceUrl'=cr.payload->'sourceUrl' AS same_source_url,co.payload->'sourceArtifactRef'=cr.payload->'sourceArtifactRef' AS same_artifact_ref,co.payload->'parentInstanceId'=cr.payload->'parentInstanceId' AS same_parent,
ARRAY(SELECT jsonb_object_keys(co.payload)) AS original_context_keys,ARRAY(SELECT jsonb_object_keys(cr.payload)) AS replacement_context_keys
FROM pairs p JOIN workflow_instances io ON io.workflow_instance_id=p.original_id JOIN workflow_instances ir ON ir.workflow_instance_id=p.replacement_id JOIN workflow_context_revisions co ON co.context_revision_id=io.current_context_revision_id JOIN workflow_context_revisions cr ON cr.context_revision_id=ir.current_context_revision_id ORDER BY p.original_id;
WITH pairs AS (SELECT workflow_instance_id AS replacement_id,(metadata->>'replacesInstanceId')::uuid AS original_id FROM workflow_instances WHERE metadata ? 'replacesInstanceId' AND NOT cancelled AND archived_at IS NULL), targets AS (SELECT original_id AS id FROM pairs UNION SELECT replacement_id FROM pairs) SELECT e.workflow_instance_id,e.event_type,count(*) AS count,min(e.created_at) AS first_at,max(e.created_at) AS last_at FROM workflow_events e JOIN targets t ON t.id=e.workflow_instance_id GROUP BY 1,2 ORDER BY 1,2;
WITH pairs AS (SELECT workflow_instance_id AS replacement_id,(metadata->>'replacesInstanceId')::uuid AS original_id FROM workflow_instances WHERE metadata ? 'replacesInstanceId' AND NOT cancelled AND archived_at IS NULL), targets AS (SELECT original_id AS id FROM pairs UNION SELECT replacement_id FROM pairs) SELECT s.workflow_instance_id,s.submission_id,n.node_key,tr.transition_key,s.created_at,s.payload_digest,ARRAY(SELECT jsonb_object_keys(s.payload)) AS payload_keys,s.payload->>'verificationResult' AS verification_result,CASE WHEN s.payload?'url' THEN jsonb_typeof(s.payload->'url') END AS url_type,CASE WHEN s.payload?'postId' THEN jsonb_typeof(s.payload->'postId') END AS post_id_type
FROM workflow_submissions s JOIN targets t ON t.id=s.workflow_instance_id LEFT JOIN workflow_node_visits nv ON nv.node_visit_id=s.source_node_visit_id LEFT JOIN workflow_node_definitions n ON n.node_id=nv.node_id LEFT JOIN workflow_transition_definitions tr ON tr.transition_id=s.transition_id ORDER BY 1,5;
WITH pairs AS (SELECT workflow_instance_id AS replacement_id,(metadata->>'replacesInstanceId')::uuid AS original_id FROM workflow_instances WHERE metadata ? 'replacesInstanceId' AND NOT cancelled AND archived_at IS NULL), targets AS (SELECT original_id AS id FROM pairs UNION SELECT replacement_id FROM pairs) SELECT t.id, count(e.effect_id) AS managed_effects,count(e.effect_id) FILTER(WHERE e.state='SUCCEEDED') AS succeeded_effects FROM targets t LEFT JOIN workflow_operation_effects e ON e.managed_instance_id=t.id GROUP BY 1 ORDER BY 1;
WITH pairs AS (SELECT workflow_instance_id AS replacement_id,(metadata->>'replacesInstanceId')::uuid AS original_id FROM workflow_instances WHERE metadata ? 'replacesInstanceId' AND NOT cancelled AND archived_at IS NULL), targets AS (SELECT original_id AS id FROM pairs UNION SELECT replacement_id FROM pairs) SELECT DISTINCT r.command_id,r.command_type,r.receipt_status,r.response_status,r.request_hash,r.created_at,r.completed_at FROM workflow_command_receipts r JOIN workflow_events e ON e.command_id=r.command_id JOIN targets t ON t.id=e.workflow_instance_id ORDER BY r.created_at;
SELECT v.definition_version_id,v.version_number,v.version_status,v.definition_digest,v.created_at,v.published_at FROM workflow_definition_versions v JOIN workflow_definitions d USING(workflow_definition_id) WHERE d.definition_key='single_platform_dist_v1' ORDER BY version_number;
SELECT workflow_instance_id,cancelled,archived_at,workflow_state_version,updated_at FROM workflow_instances WHERE workflow_instance_id='8bb8c723-3858-4fa0-9185-e9f0968717d2';
```

`e1380-summary.sql`：

```sql
SELECT clock_timestamp() AS sampled_at,current_database(),current_user,current_setting('transaction_read_only'),current_setting('transaction_isolation'),pg_current_snapshot();
WITH pairs AS (SELECT workflow_instance_id AS replacement_id,(metadata->>'replacesInstanceId')::uuid AS original_id FROM workflow_instances WHERE metadata ? 'replacesInstanceId' AND NOT cancelled AND archived_at IS NULL), targets AS (SELECT original_id AS id FROM pairs UNION SELECT replacement_id FROM pairs) SELECT t.id,c.assistance_case_id,c.status,c.node_visit_id,c.updated_at FROM targets t LEFT JOIN workflow_assistance_cases c ON c.workflow_instance_id=t.id AND c.status IN ('OWNER_PENDING','HUMAN_REQUIRED') ORDER BY t.id;
WITH pairs AS (SELECT workflow_instance_id AS replacement_id,(metadata->>'replacesInstanceId')::uuid AS original_id FROM workflow_instances WHERE metadata ? 'replacesInstanceId' AND NOT cancelled AND archived_at IS NULL), targets AS (SELECT original_id AS id FROM pairs UNION SELECT replacement_id FROM pairs) SELECT e.event_type,count(*) AS events,min(e.created_at) AS first_at,max(e.created_at) AS last_at FROM workflow_events e JOIN targets t ON t.id=e.workflow_instance_id GROUP BY 1 ORDER BY 1;
WITH pairs AS (SELECT workflow_instance_id AS replacement_id,(metadata->>'replacesInstanceId')::uuid AS original_id FROM workflow_instances WHERE metadata ? 'replacesInstanceId' AND NOT cancelled AND archived_at IS NULL), targets AS (SELECT original_id AS id FROM pairs UNION SELECT replacement_id FROM pairs) SELECT r.command_type,r.receipt_status,r.response_status,count(*) FROM workflow_command_receipts r JOIN workflow_events e ON e.command_id=r.command_id JOIN targets t ON t.id=e.workflow_instance_id GROUP BY 1,2,3 ORDER BY 1;
WITH pairs AS (SELECT workflow_instance_id AS replacement_id,(metadata->>'replacesInstanceId')::uuid AS original_id FROM workflow_instances WHERE metadata ? 'replacesInstanceId' AND NOT cancelled AND archived_at IS NULL), targets AS (SELECT original_id AS id FROM pairs UNION SELECT replacement_id FROM pairs) SELECT t.id,count(*) FILTER (WHERE n.metadata ? 'workflowOperation') AS declared_operations FROM targets t JOIN workflow_instances i ON i.workflow_instance_id=t.id JOIN workflow_node_definitions n ON n.definition_version_id=i.definition_version_id GROUP BY 1 ORDER BY 1;
SELECT i.workflow_instance_id,n.node_key,i.workflow_state_version,i.updated_at FROM workflow_instances i LEFT JOIN workflow_node_visits v ON v.node_visit_id=i.current_node_visit_id LEFT JOIN workflow_node_definitions n ON n.node_id=v.node_id WHERE i.workflow_instance_id IN ('89f19a8b-da6a-4eed-819b-730b49aa670c','2a5c8a00-8716-4bae-8ac4-a37fea07ab6f') ORDER BY 1;
```

`e1380-evidence-discovery.sql`：

```sql
SELECT table_name,string_agg(column_name||':'||data_type,', ' ORDER BY ordinal_position) FROM information_schema.columns WHERE table_schema='public' AND table_name LIKE '%assistance%' GROUP BY table_name;
WITH RECURSIVE pairs AS (SELECT workflow_instance_id AS replacement_id,(metadata->>'replacesInstanceId')::uuid AS original_id FROM workflow_instances WHERE metadata ? 'replacesInstanceId' AND NOT cancelled AND archived_at IS NULL), targets AS (SELECT original_id AS id FROM pairs UNION SELECT replacement_id FROM pairs), docs AS (
SELECT 'context' AS kind,c.context_revision_id::text AS id,c.payload AS doc FROM workflow_context_revisions c JOIN targets t ON t.id=c.workflow_instance_id
UNION ALL SELECT 'submission',s.submission_id::text,s.payload FROM workflow_submissions s JOIN targets t ON t.id=s.workflow_instance_id
UNION ALL SELECT 'event',e.event_id::text,e.event_data FROM workflow_events e JOIN targets t ON t.id=e.workflow_instance_id
), walk AS (SELECT kind,id,''::text AS path,doc AS value FROM docs UNION ALL SELECT w.kind,w.id,w.path||'.'||j.key,j.value FROM walk w CROSS JOIN LATERAL jsonb_each(CASE WHEN jsonb_typeof(w.value)='object' THEN w.value ELSE '{}'::jsonb END) j)
SELECT kind,path,jsonb_typeof(value) AS value_type,count(*) FROM walk WHERE path ~* '(url|post.?id|readback|receipt|content.?version|verification|operation)' GROUP BY 1,2,3 ORDER BY 1,2,3;
```


补查11条转移的from/to精确节点（独立只读事务）：

```text
BEGIN
          sampled_at           | current_setting | current_setting | pg_current_snapshot
-------------------------------+-----------------+-----------------+---------------------
 2026-11-10 21:27:53.862841+08 | on              | repeatable read | 3546263:3546263:
(1 row)

```

`/tmp/e1380-transitions.sql` SHA256=`841900cb627ed1b45244eec96e8d6ab764d401c1c42dee6f674661cc590cf7ed`。

`/tmp/e1380-transitions-raw.txt` SHA256=`1c26352a31c71501d3066fff140b45515111e67fc1a83851fd34d7da07241bfb`。

```sql
SELECT clock_timestamp() AS sampled_at,current_setting('transaction_read_only'),current_setting('transaction_isolation'),pg_current_snapshot();
WITH pairs AS (SELECT workflow_instance_id AS replacement_id,(metadata->>'replacesInstanceId')::uuid AS original_id FROM workflow_instances WHERE metadata ? 'replacesInstanceId' AND NOT cancelled AND archived_at IS NULL), targets AS (SELECT original_id AS id FROM pairs UNION SELECT replacement_id FROM pairs) SELECT e.workflow_instance_id,e.event_id,src.node_key AS source_node,dst.node_key AS target_node,e.created_at FROM workflow_events e JOIN targets t ON t.id=e.workflow_instance_id LEFT JOIN workflow_node_definitions src ON src.node_id=e.from_node_id LEFT JOIN workflow_node_definitions dst ON dst.node_id=e.to_node_id WHERE e.event_type='WORKFLOW_TRANSITION_COMMITTED' ORDER BY e.created_at;
```

</details>

## 4. 幂等读回、dedupeKey/operationKey 与 UNKNOWN 边界

[packages/broker/src/capabilities/workflow/owner-obligation-guard.js:83](https://github.com/mayf3/dsh-agent-core/blob/1cde410046a5e2a45819455f078cd72b22671d6f/packages/broker/src/capabilities/workflow/owner-obligation-guard.js#L83) 从可信 runtime provenance、服务端 managed relation、exact node/descriptor/slot 选路。只有权威 `owner_obligation_not_managed` 可走原 unmanaged 路；read失败、错误关系、`PREPARED/STARTED/UNKNOWN` 不走 generic fallback。`:145–164` 将 managedInstance/nodeVisit/slot 发到既有 guarded endpoint，不把 attemptId 或 processGeneration 当业务 DTO 键；已成功重入须匹配原 effectId、commandId、resultDigest/result，且 replayed=true。[packages/broker/src/capabilities/workflow/owner-obligation.js:20](https://github.com/mayf3/dsh-agent-core/blob/1cde410046a5e2a45819455f078cd72b22671d6f/packages/broker/src/capabilities/workflow/owner-obligation.js#L20) 的 read/read_effect GET 已存在。

当前 main 新增 `171ecf848` 的 [packages/broker/test/capabilities/workflow-execution/owner-obligation-attempt.test.js:176](https://github.com/mayf3/dsh-agent-core/blob/1cde410046a5e2a45819455f078cd72b22671d6f/packages/broker/test/capabilities/workflow-execution/owner-obligation-attempt.test.js#L176) 已定义三操作×SUCCEEDED/UNKNOWN六场景：首次业务 handler 成功保存、HTTP响应丢失，ledger重开后 g1→g2→g3，attemptId不同；成功路径3次guarded POST但handler仅1次，UNKNOWN路径首次1 POST、后续仅relation GET，不造替代行/command/改写UNKNOWN。`:70` fixture stableKey绑定 managed instance/definition/node/slot/occurrence；`:82–84` 检查无 attempt/generation 幂等参数。

**本轮仅审阅测试源码，没有重跑或报PASS。** `:224` 已明确真实Core ledger/context/gateway+loopback HTTP，Svc表是fixture，admission/quiescence seeded，未证明live DB/process/生产。Svc现有真实DB回归定义见 [tests/owner_obligations/effects.rs:14](https://github.com/mayf3/svc-workflow/blob/7d32fbb419acb2e982275f94332beb9cfe007a15/tests/owner_obligations/effects.rs#L14)（并发/丢响应/换输入）、`:106`（确定零事实拒绝）、`:162`（RETURN复用）、`:232`（真实create后的存储失败回滚）。这些可复用，但本次不作它们的执行结果声明。

[packages/fixed-operation/src/registry.js:99](https://github.com/mayf3/dsh-agent-core/blob/1cde410046a5e2a45819455f078cd72b22671d6f/packages/fixed-operation/src/registry.js#L99) 的 `operationKey` 是注册操作类型；`:124–147` 的 invocationId 哈希包含 trusted workflow（含attemptId），每次先执行 handler 再产 receipt，无持久业务去重或结果查询。[packages/production-runtime/src/fixed-operation-runtime.js:1](https://github.com/mayf3/dsh-agent-core/blob/1cde410046a5e2a45819455f078cd72b22671d6f/packages/production-runtime/src/fixed-operation-runtime.js#L1) 仅 fixture.echo/sum，不是生产发布效果后端。普通 metadata.dedupeKey 不参与上述 effects 唯一键；Core execution-history 的同名分页排序、development-execution 的开发任务去重也不是此业务键。

| 后端能力 | 本次已知边界 | UNKNOWN 后可声称的行为 |
|---|---|---|
| 已有 managed 三操作的稳定键+结果读回 | Svc持久槽/command receipt/原子内部DB事实，Core可信wrapper已接 | 读回原effect；已成功保持原结果，未决不新键重做；源码存在不等于本机已装载验收 |
| 六对所涉平台若仅有结果读回 | 本次未核实际适配器合同，归类待证 | 读回本身不消除查询-执行竞态；不能自动宣称可安全重发 |
| 无稳定键且无可靠读回的入口 | 本次未证明任意真实平台属于此类，作为条件边界 | 无法区分零效果与丢回执时保持UNKNOWN和合法对账/升级责任，不能新attempt/新key假造未发生 |

[packages/workflow-execution/src/judgment.js:170](https://github.com/mayf3/dsh-agent-core/blob/1cde410046a5e2a45819455f078cd72b22671d6f/packages/workflow-execution/src/judgment.js#L170) 的 timeout/5xx/malformed/still-processing 与 `:342–370` 的未验证Run linkage/lost/restart_lost 保留UNKNOWN/delivery_unverified；success-shaped结果不等于业务事实（`:300–302`）。[packages/workflow-execution/src/projection.js:73](https://github.com/mayf3/dsh-agent-core/blob/1cde410046a5e2a45819455f078cd72b22671d6f/packages/workflow-execution/src/projection.js#L73) 显示 OUTCOME_UNKNOWN，不映射成业务成功或零效果失败。

[packages/workflow-execution/src/recovery/operation.js:80](https://github.com/mayf3/dsh-agent-core/blob/1cde410046a5e2a45819455f078cd72b22671d6f/packages/workflow-execution/src/recovery/operation.js#L80) 只有 resolution_blocked、无 deliveryStarted/delivered、fresh exact Router `never_existed` 且无linkage时可沿原同attempt恢复；pending/evicted/restart_lost/unreadable不是零事实证明。`:179–203` 先WAL再同attempt投递；[packages/workflow-execution/src/recovery/readback.js:26](https://github.com/mayf3/dsh-agent-core/blob/1cde410046a5e2a45819455f078cd72b22671d6f/packages/workflow-execution/src/recovery/readback.js#L26) 的有界持久再读不调用业务投递，[packages/workflow-execution/src/recovery/readback-ledger.js:53](https://github.com/mayf3/dsh-agent-core/blob/1cde410046a5e2a45819455f078cd72b22671d6f/packages/workflow-execution/src/recovery/readback-ledger.js#L53) 按exact attempt/revision CAS保businessOutcome UNKNOWN。终止/visit关闭不结清原外部效果，也不授权这六对发布重做。

## 5. #1380 最小剩余差量（五行）及已有可复用项

1. Managed三操作已具稳定effect接线与跨attempt丢响应回归，复用现状，不重报“完全缺机制”。
2. 六对仍需将目标/动作/输入版本/可信许可绑定到服务端认可的稳定业务identity，明确唯一执行者与仅吸收结果者。
3. 选一个现有受支持发布入口，核原效果、原/替代及父任务的正式承接；metadata替代关系不自动提供上述授权。
4. 原入口补/复用丢ACK、并发、迟到回执、重启和改输入冲突的有限验证；缺平台证据保UNKNOWN，不新键重传。
5. 分别交源码、协议/DB回归、部署装载和真实业务效果证据；本次只读核查不替代#1380实现或生产验收。

| 可复用项 | 固定坐标/用途 |
|---|---|
| Trusted managed guard + 三类 registry + GET | 第2/4节已有Core/Svc路径；复用服务端槽和receipt，不增平行账本 |
| attempt observation CAS | `packages/workflow-execution/test/observation-cas/ledger-identity.test.js:12,37,62`；拒绝旧观察和缺字段 |
| 临时503持久再读 | `packages/workflow-execution/test/observation-cas/readback.test.js:42,107,145`；原UNKNOWN不改Router/Scheduler fence |
| 同attempt合法投递恢复 | `packages/workflow-execution/test/recovery.test.js:90,140,184,206,374`；并发/WAL/false-negative拒绝 |
| Core effect跨attempt六场景 | `packages/broker/test/capabilities/workflow-execution/owner-obligation-attempt.test.js:176–224`；保留fixture限制 |
| RETURN/冲突/原receipt绑定 | `packages/broker/test/capabilities/workflow-execution/owner-obligation.test.js:112,125,219,256,283` |
| Svc真DB rollback/并发/RETURN及约束反例定义 | `tests/owner_obligations/effects.rs:14,106,162,232`；`tests/owner_obligations/independent_counterexamples.rs:22,105` |
| 现有发布图 | v7准确Version/hash见第3节；保留，不重新author或迁移实例 |

验证与交付边界：`python3 .agents/tools/verify_governance.py --target . --require-accepted` 实测rc=0（vendored bytes与accepted lock一致）；SQL主查、补充计数、结构键盘点及转移补查均rc=0且ROLLBACK完成。源码测试仅索引，未重跑。候选只允许新增原简报与本报告两文件；独立复核、准确commit、push/PR(base main)及main影响复查记录在PR正文，未授权merge。原简报原样保留，SHA256=`c15ac3a387c84c699fed40b8dd3c71f9fd3b3e8cecd5704ca2f994c9ae3a7003`。本次 CENSUS_COMPLETE 不表示 #1380、六对业务或无人值守整体 DONE。

文档机械复核：5个编号章节、24个固定SHA源码行锚点均存在；SQL正文与已执行文件逐字匹配，原简报hash不变。仅对文档运行格式/坐标检查，不将其称为产品回归或生产验收。
