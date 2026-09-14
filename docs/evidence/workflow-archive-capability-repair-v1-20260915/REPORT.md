# WORKFLOW_DOMAIN_OWNER_ARCHIVE_CAPABILITY_REPAIR_V1 — EVIDENCE REPORT

date: 2026-09-15 (incident window 2026-09-14 23:12–23:13 +08)
actor: agt_cto-agent (4e5a4578-0645-4133-bd35-b80e453dfee9)
branch: goal/workflow-domain-owner-archive-capability-repair-v1 (7a258ec, off origin/main aefb68e)
status: ROOT_CAUSE_KNOWN + FIX_IMPLEMENTED(462/462) + PREIMAGE_VERIFIED + CANARY_PENDING_OWNER_CHANNEL

## 0. TL;DR

6 次 archive 失败与 DOMAIN_OWNER 授权无关：全部 6 次调用**漏传必填 `reason`**，
被 broker 本地 per-op 参数校验拒绝（invalid_arguments，零下游 HTTP）。
模型漏传的系统性根因是 model-visible schema 生成链的三缺陷叠加
（description 被 canonical 丢弃渲染成字面 "undefined"、扁平 schema 丢失
per-op required、violation detail 被 opt-in 机制丢弃导致模型无法自纠）。
修复全部落在既有 accepted Spec 机制内，462/462 测试 PASS。
fresh census 修正了 GOAL 前提：6 实例中 4 个早在 8 月已 archived，
真正待 archive 的只有 2 个（de9a45aa、25cefee7），执行通道 = Owner 飞书触发。

## 1. FAILED_CALL_SHAPE（journal 实录，agt_cto-agent main session）

- 23:12:38 六次 `workflow_execute cancel_instance`，args = {operation, workflowInstanceId, reason:"明确测试验证实例，按 Domain Owner 要求清理"}
  - de9a45aa：**ok:true**（fresh，svc receipt 43719c2f @23:12:37.940，replayed=false，state v10）
  - 其余 5 个：**already_cancelled (409)**（8 月已 cancel；GOAL 前提"6/6 cancel success"系对 transcript 的误读）
- 23:12:46 六次 `workflow_execute archive_instance`，args = **{operation, workflowInstanceId}** — reason MISSING
  - 6/6 `failed: invalid_arguments`；HTTP_REQUEST_SENT=NO；requestId 不存在（未出 broker）
- 23:13:01 重试六次，args 增加错误字段 `domainId`（非 archive 模型面，ACC-011 a2 违禁字段方向），reason 仍缺失 → 6/6 invalid_arguments

## 2. INVALID_ARGUMENTS_ORIGIN = BROKER_MAPPING_VALIDATION

broker 本地 per-operation 参数校验（mapping.js validateInvocation → validateArgumentsDetailed
"missing required property \"reason\""），先于 token/HTTP。非 MODEL_SCHEMA_VALIDATION
（模型可见 schema 无法捕获——见 RC2），非 DOWNSTREAM_SVC（零 HTTP）。

## 3. ROOT_CAUSE（三缺陷叠加，均已定位到行）

| # | 文件 | 缺陷 | 证据 |
|---|---|---|---|
| RC1 | packages/broker/src/schema.js validateManifest | `description`/`name` 被校验但**从不拷入 canonical manifest**；registry.js 模板渲染出 `Agent Core capability \`X\`: undefined Supported operations: ...`，CTR-013 冻结的 cleanup 纪律文本（含 "archive_instance ... Only workflowInstanceId + reason are accepted"）从未送达模型。main 上 isWorkflowAuthoring ternary 即对该缺陷的窄 workaround | journal header L1918 全部 71 工具 description 含 "undefined"；workflow-authoring-model-render.test.js:102 曾把该 bug pin 成期望值 |
| RC2 | packages/broker/src/registry.js | 扁平 model-visible schema 仅 `operation` required（CTR-011 粗 schema pin 是**正确**的），per-op required（cancel/archive 的 workflowInstanceId+reason）除已丢失的 description 文本外无处可见 | journal header：top-level required=['operation']；reason 属性 description 只剩 cancel 的文案 |
| RC3 | packages/broker/src/mapping.js + workflow-execute.js | workflow_execute 四 op 均未 opt-in `structuralDiagnostics`，validator 的精确违规文本被丢弃；模型只看到裸 invalid_arguments，无法自纠，重试误加 domainId | L2149/L2192 完整失败行无任何 detail；AMENDMENT_1 (SD-4) 的 per-op opt-in 机制已在位但本 manifest 未采用 |

## 4. SCHEMA 三方对照

- SOURCE_SCHEMA = **PASS**：origin/main(aefb68e) `packages/broker/src/capabilities/workflow-execute.js` archive_instance 恰 required ['workflowInstanceId','reason']，POST /internal/v1/workflow-instances/{workflowInstanceId}/archive，body ['reason']，idempotencyKey:true，error 表 13 码全（CTR-012 对拍）。
- DEPLOYED_SCHEMA = **PASS（manifest 面）**：runtime /usr/local/libexec/agent-core/app/packages/broker/src/capabilities/workflow-execute.js 与 production clone 逐字节同；registry/schema/mapping/transport 十一文件 clone==runtime。⚠ registry.js 部署 bytes 落后 main（无 renderErrorDetail 门控/infrastructure 过滤/selector）——属部署 drift，本修复合并后需一次 broker 刷新（独立授权）。
- MODEL_VISIBLE_SCHEMA（journal L1918 header，production runtime 实录）= **FAIL → 已修复**：operations 枚举四 op ✓；但 description="undefined"（RC1）、required=['operation'] 且 per-op required 不可见（RC2）。

## 5. BROKER_REQUEST_SHAPE / DOWNSTREAM_REQUEST_SHAPE（§5 验证）

测试钉死（workflow-execute.test.js REPAIR §8-A/F + 既有 cancel/archive binding pins）：
PATH_MATCH=YES（/internal/v1/workflow-instances/{workflowInstanceId}/archive）；
BODY_EXACT={reason}（workflowInstanceId 只进 path，不进 body；executionClass 式
undefined 字段零泄漏）；Idempotency-Key 由 transport 生成（ik-workflow-execute-*）；
未误转 cancel endpoint。授权 = token scope workflow.execute + svc 侧 DOMAIN_OWNER
（fresh DB：domain 22222222-…-100 的 enabled DOMAIN_OWNER=4e5a4578，旧 owner binding disabled）。

## 6. ERROR_PROPAGATION（§6）

- 本地：missing workflowInstanceId / missing reason / unknown argument → invalid_arguments
  + **detail 逐项命名**（修复后，SD-2/SD-1 语义）；500-cap sanitize（SD-7）。
- 下游：not_domain_owner(403)/instance_not_terminal(409)/already_archived(409)/
  active_activation_exists(409)/invalid_reason(422)/idempotency_conflict(409) 逐码保留
  （status + x-request-id 附着，REPAIR §8-D/G + 既有 409 pin 测试）。
- 不再把 downstream archive errors 塌缩成 invalid_arguments（transport error 表逐码解析，
  未声明码才降级 http_4xx/5xx）。

## 7. FIX（commit 7a258ec，全部在 accepted Spec 机制内）

1. `schema.js`：canonical 保留已校验的 description/name。
2. `registry.js`：tool description 追加确定性 per-op required 参数行
   （`Required arguments per operation — …`；manifest 序，无 required 参数的工具零变化）。
3. `capabilities/workflow-execute.js`：manifest `renderErrorDetail:true`；四 op
   `structuralDiagnostics:true` + `additionalProperties:false`（Scheduler V1 closed 先例）；
   transition 显式声明 `executable_for_actor`（frozen description 文本点名的 advisory 字段，
   仍不转发）。
4. 行为收紧：identity-seam 字段（principalId/agentId/actor/idempotencyKey/assigneePrincipalId）
   从"静默忽略"升级为"逐项命名拒绝"（同一保证的更强形式；测试同步改写并保留原意图断言）。

Tests: broker 包 462/462 PASS（含 §8 A–I 回归集；bug-pin 修正：calculator "undefined"
期望值 → 真实 description，NEW_EVIDENCE=本 incident journal）。

## 8. FRESH PREIMAGE（只读 SELECT @2026-09-15 00:2x，svc_workflow_dogfood_clean）

| instance | cancelled | archived | open_activations | domain owner (enabled) | 处置 |
|---|---|---|---|---|---|
| de9a45aa-08cc-46d2-8907-dc52ec8f2bbc | YES(09-14 23:12:38) | NO | 0 | 4e5a4578 ✓ | **CANARY → 待 archive** |
| 25cefee7-10cd-41d5-b5ba-7c716311daa6 | YES(08-05) | NO | 0 | 4e5a4578 ✓ | 待 archive（第 2 条） |
| 0fc34b2a-a63e-4636-8fea-6995853e02ca | YES(08-01) | YES(08-01) | 0 | — | 已归档，无需动作 |
| fc4f4187-7174-4b0f-b716-95829d050eb1 | YES(08-01) | YES(08-01 15:03) | 0 | — | 已归档，无需动作 |
| 062940b2-7fe0-46c7-9370-3cd891e40dd7 | YES(08-02) | YES(08-02) | 0 | — | 已归档，无需动作 |
| e6297aa5-f223-402c-9770-45117858575e | YES(08-02) | YES(08-02) | 0 | — | 已归档，无需动作 |

## 9. CANARY_PACKET（等 Owner 通道；执行者=agt_cto-agent 自有 broker 工具）

步骤 1（canary，单条）：

```
workflow_execute operation=archive_instance
workflowInstanceId=de9a45aa-08cc-46d2-8907-dc52ec8f2bbc
reason=Domain Owner directed cleanup: verified test/validation instance cancelled 2026-09-14 23:12; archiving per WORKFLOW_DOMAIN_OWNER_ARCHIVE_CAPABILITY_REPAIR_V1 (no active activations; lifecycle legal)
```

readback：ARCHIVE_RESULT=PASS、archived_at != null、cancel 历史（cancelled_at/cancel_reason）
保留、workflowStateVersion 无业务推进、无新实例。步骤 2：同参数对 25cefee7 执行。
其余 4 条**不重放**（already_archived，零 mutation）。预期 6/6 ARCHIVED。

## 10. SAFETY 对账

raw DB archive=NO（全程只读 SELECT）；物理删除=无；recreate=无；fake transition=无；
DOMAIN_OWNER 变更=无（22:58 的 owner replace 是本 incident 之前的独立授权操作）；
coordinator authority 未扩；六条 cancellation 状态全保留。

## 11. CANARY 结果（2026-09-15 05:07，Owner 飞书触发 agt_cto-agent 执行）

- de9a45aa：svc receipt ARCHIVE_WORKFLOW_INSTANCE COMPLETED/200 @05:07:26
  （principal 4e5a4578，replayed=false，state v10→v11 = 仅 archive 事件追加）；
  DB readback：archived_at=2026-09-15 05:07:26，archive_reason=packet 原文，
  cancelled_at/cancel_reason（09-14 23:12:38 原文）完整保留。
- 25cefee7：COMPLETED/200 @05:07:38（v2→v3）；archived_at=05:07:38，cancel 历史
  （08-05 08:47:00）保留。
- 其余 4 条零触碰（archived_at 仍为 8 月原值）；域内零新实例。
- 备注：CTO agent 回读"未见 archived_at"属合同正常——archive/cancel 响应信封按
  CTR-012 为 {workflowInstanceId, workflowStateVersion, eventSequence, replayed}，
  archived_at 在 detail 投影；DB 层已独立确证。

## 12. DONE_WHEN 终态

INVALID_ARGUMENTS_ROOT_CAUSE=KNOWN / SOURCE_ARCHIVE_SCHEMA=PASS /
DEPLOYED_ARCHIVE_SCHEMA=PASS（manifest 面；registry.js 部署 drift 记债需 broker 刷新授权）/
MODEL_VISIBLE_ARCHIVE_SCHEMA=PASS（修复分支 7a258ec；runtime 刷新前生产面仍旧缺陷）/
ARCHIVE_REQUEST_MAPPING=PASS / ARCHIVE_ERROR_PROPAGATION=PASS（修复分支测试钉死）/
CANARY_ARCHIVE=PASS / SIX_CANCELLED_INSTANCES: ARCHIVED=6/6 /
OTHER_INSTANCE_MUTATION=0 / RAW_DB_WRITE=NO / BLOCKERS=NONE

