# WDA Authoring Production Recovery V1 — TERMINAL（2026-09-10）

GOAL = WORKFLOW_DEFINITION_AUTHORING_PRODUCTION_RECOVERY_V1 · GOAL_STATUS = COMPLETE / PRODUCTION_READY · SLOT RELEASED

## 1. 交付与坐标

```text
ROOT_CAUSE              = G（broker mapping 层丢 structural detail → 裸 invalid_arguments）
AUTHORITY               = ERROR_PRESERVATION_V1 AMENDMENT_1（R6 structuralDiagnostics，Owner AMENDMENT_1_ACCEPTED @2a3a107）
IMPLEMENTATION          = 09d9eb3（独立 audit ACCEPT/BLOCKERS=[]，12/12 checkpoints）
MERGED                  = PR #225 → main be99dac；packet V1.1 PR #226 → main 5fa6b8d
DEPLOYED                = 3 文件窄闭包（mapping.js/schema.js/workflow-definition-authoring.js）
                          Owner 一命令 --apply：readback==targets / guard 六文件含热修线 index.js 不动 /
                          in-place smoke PASS / kickstart pid 83093→2053 running
```

## 2. 生产链全记录（全部经 Broker tools，零 CLI/DB 写/内部 API/凭据触碰）

### 第一幕：合同修复的生产证明（2026-09-09 晚）
```text
STRUCTURAL_DIAGNOSTICS  podcast agent 探测实得字段级 detail
                        `missing required property "definitionId"`（修复前=裸 invalid_arguments）
                        → 模型据此自纠（漏传→补传）→ replace PASS
                        svc log：PUT /draft ×2 @18:28:56Z/18:29:10Z（部署后首批）
EXACT_DRAFT_REPLACE     draft 2cba2687（v1, semver3）：素材整理→播客初稿→审核定稿→播客稿完成
PUBLISH                 v1 PUBLISHED digest 09627b10…（18:29:19Z）
CREATE_INSTANCE(v1)     cebf4816，entry step_1 assignee=61819256(stale)
PERMISSION BOUNDARY     podcast agent transition→403 principal_not_assignee（正确拒代推）
```

### 第二幕：SELF_TRANSITION 死端根因（机械钉死）
```text
61819256 = 已知 STALE principal（successor line 在库：→9e3adced，
STALE_PRINCIPAL_WITH_UNIQUE_REPAIR @09-07 identity_repair_v1）
HR 派发 fail-closed 正确：EAPR 对裸 agentId「writing-style-analyst-agent」
违反 ^agt_[a-z0-9-]+$ → identity_resolution_unavailable（拒 display-name fallback ✓）
transition Step7 精确 UUID 比对（transition_transaction.rs:211）无 successor admission
→ 9e3adced 亦不能代推 ⇒ cebf4816 step_1 by-design 死端（authoring 期选了 stale principal）
```

### 第三幕：Owner A_WITH_SAFETY_AMENDMENT → v2 身份修正 + 真实闭环（2026-09-10）
```text
v2（同 Definition，identity-only 修正）
  create_draft_version(semver3) → 65be31fd v2
  replace_draft_graph：linear 三步（素材整理/播客初稿/审核定稿）
    assigneePrincipalId 全= 9e3adced-575f-4fb2-b351-f7698b59127d（canonical analyst）
  publish → PUBLISHED digest e0626f72…（2026-09-10T13:21:02Z）
READ-BACK GATE（DB 只读）STALE_PRINCIPAL_REFERENCE_COUNT=0 · 三步全=9e3adced(enabled) ·
  ADVANCE 链 advance_1..3 完整 · v1 未动
NEW INSTANCE             085b41f2（frozen contextPayload 同旧实例；metadata null）
  entry visit step_1 assignee=9e3adced · event 链恰 1 条 INSTANCE_CREATED
  detail：nextTransition advance_1，executableForActor=false/blockedReason=
  ACTOR_NOT_CURRENT_ASSIGNEE（对非 assignee 的解释面生效）
REAL_DISPATCH（HR）
  agent_resolve_principal(9e3adced) = {agentId: agt_writing-style-analyst-agent} ok:true
  agent_session_send → status:replied（analyst 实际回复）
TARGET_OWN_CONTEXT_READ  analyst 以自己身份读任务/上下文，产出真实交付物
  docs/workflow/085b41f2-materials-prep.md（含事实边界与 20min vs 25–35min 时长冲突标注）
SELF_TRANSITION（DB 终验）
  event#2 WORKFLOW_TRANSITION_COMMITTED ADVANCE actor=9e3adced state 1→2（恰一次，22:09:13Z）
  current: state v2 / step_2 播客初稿 / assignee=9e3adced（按 v2 定义继续推进）
```

## 3. Final acceptance（Owner 清单逐项）

```text
NEW_DEFINITION_VERSION_PUBLISHED = PASS   65be31fd v2 PUBLISHED e0626f72
STALE_ASSIGNEE_IN_NEW_VERSION    = NO     STALE=0（successor-line join 复核）
NEW_INSTANCE_CREATED             = PASS   085b41f2 state v1→v2
NEW_INSTANCE_CANONICAL_ASSIGNEE  = PASS   entry/current = 9e3adced
REAL_DISPATCH                    = PASS   EAPR ok:true + session_send replied
TARGET_AGENT_OWN_READ            = PASS   analyst 自读自做（交付物+上下文细节为证）
SELF_TRANSITION                  = PASS   actor==assignee==9e3adced，恰一次 1→2
OLD_INSTANCE_DUPLICATE_EXECUTION = NO     cebf4816 state=1 / events=1 / cancelled=false
OLD_INSTANCE_CANCELLED_OR_QUARANTINED = PASS
  OLD_INSTANCE_QUARANTINED = YES
  OLD_INSTANCE_CANCEL = BLOCKED_BY_AUTHORIZED_CONTROL_PLANE（broker 无 cancel 面，机械核实）
  DO_NOT_RECOVER_OLD_INSTANCE = cebf4816…（至正式 cancel；successor-execution authority
  上线后亦不得自动恢复）；archive 决策留待未来授权 lane
FIRST_REAL_WORKFLOW_CHAIN        = PASS   dispatch→own read→real work→transition 全真实链路
```

## 4. 登记不修（Owner §6）

```text
GAP_1 authoring/discovery 期 stale principal 显现为 canonical（无 STALE/SUCCESSOR_AVAILABLE/
      NOT_SELECTABLE 标注）——本次事故的直接成因面
GAP_2 EAPR 语法违规（legacy 裸 agentId）塌缩为 identity_resolution_unavailable（数据无效≠传输不可用）
SUCCESSOR_EXECUTION_CHANGE = NO（Step7 精确 UUID 比对保持；代执行走未来独立 authority）
```

## 5. 合同修复效果存证（R6 前后对照）

```text
修复前（历史）：任意 structural 违规 → 裸 invalid_arguments（mapping.js 丢 violations，
  svc 零 PUT 记录证明全部死于 broker 内部，多形状无差别塌缩，不可诊断）
修复后（生产）：missing required property "definitionId" 等 field-path detail 直接可见，
  模型一次自纠；unknown property / missing required / 类型错误均带字段级定位
```
