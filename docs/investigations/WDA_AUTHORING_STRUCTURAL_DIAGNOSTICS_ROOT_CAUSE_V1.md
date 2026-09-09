# WDA Authoring Structural Diagnostics — Root Cause V1（investigation，read-only 证据）

> TASK_TYPE = 调查 · GOAL = WORKFLOW_DEFINITION_AUTHOREING_PRODUCTION_RECOVERY_V1
> （拼写勘误：AUTHORING）· 2026-09-09 · PRODUCTION_MUTATION = NONE
> 所有生产读操作 = 只读（psql READ ONLY 事务 / 日志 grep / 文件 stat+diff / 离线 Node 复现）。

## 1. 生产坐标 fresh-verify（全部与 dispatch 一致，零 drift）

```text
DOMAIN        f9b5682c-1c9c-5ace-a7b1-01b9a3be5965  build-in-public-dogfood   EXISTS
DEFINITION    c95cf647-6c83-42ed-87df-3d6b411f1bc4  bip_gpt6_podcast_v1_202609 EXISTS
DRAFT VERSION 2cba2687-073a-420e-a49c-ab271d1583aa  v1 / DRAFT / semantic_model_version=3
              definition_digest = NULL（图从未写入成功）· context_schema 已有（458B）
              created_at = 2026-09-09 10:14:27+08
调用者        sub=d5b3aeb2-e754-49a9-9914-b963521c0985 (agent)
              client=mc_ohDTyGYRpBLI4qN_sVU88aob · audience=svc-workflow · scope=workflow.execute
DB            postgres 本机 svc_workflow_dogfood_clean（只读事务）
```

svc 请求日志（/Users/yanfenma/Library/Logs/svc-workflow/stdout.log，49938 行）：
该 definition 仅 3 次触达——09-09T02:14:16Z POST definitions（建定义）、
02:14:27Z POST versions（建 draft）、02:15:39Z POST versions（第二次，未产生新行）。
**`PUT .../draft` = 0 次**。结论：所有 replace_draft_graph 尝试全部死于
Broker 内部，从未到达 svc。

## 2. Contract trace（端到端冻结）

```text
MODEL_VISIBLE_SCHEMA   live registry buildToolDefinition / dsh-tools parameterSchemaSpecToJsonSchema
                       （宿主 deep-enforce 嵌套 items：node/transition/steps 闭形状 + enum；
                        根级 open——graph 包装、跨 op 参数误带在宿主层放行）
BROKER_INPUT_SCHEMA    manifest op 级 additionalProperties:false 闭集
                       {domainId, definitionId, definitionVersionId, contextSchema,
                        nodes, transitions, steps, terminalOutcome}；
                       mapping.js 类型分支覆盖 number/integer/string/boolean/object
                       —— array/json 不校验（嵌套深度校验由宿主承担）
BROKER_NORMALIZED_PAYLOAD  linear steps+terminalOutcome →（gateway prepareWorkflowDraft，
                       CTR-WDA-010）编译为 canonical nodes+transitions；
                       http.body = definitionVersionId, contextSchema, nodes, transitions
                       （camelCase 顶层）+ Idempotency-Key（trusted seam）
BACKEND_ROUTE_SCHEMA   svc ReplaceDraftGraphBody：serde rename_all=camelCase + deny_unknown_fields
                       （顶层 definitionVersionId/contextSchema/nodes/transitions）
                       RawNodeDefinition / RawTransitionDefinition：无 rename（wire = snake_case）
                       ——与 broker 嵌套 schema 逐字节一致（V4 CTR-WDA-002 混合 wire 形状）
DOMAIN_GRAPH_SCHEMA    semantic model 3（VISIT_ACTIVATION_V1）：
                       节点恰 TASK|TERMINAL；恰一 entry TASK（无入 ADVANCE）；
                       每 TASK 恰一 owner 引用 ∈ {WORKFLOW_CREATOR, DOMAIN_OWNER,
                       FIXED_PRINCIPAL}（INSTANCE_INPUT_PRINCIPAL 在 model 3 被禁）+ 恰一 primary ADVANCE；
                       primary 链无环且终于 TERMINAL；TERMINAL 无 owner 无出边；
                       RETURN 仅指更早可达 TASK；非 primary TERMINATE 仅指 TERMINAL；全图 entry 可达
SEMANTIC_MODEL_VERSION draft=3（Visit Activation；LEGACY=1 默认、MINIMAL=2）
ERROR_MAPPING          svc GraphValidationError{rule code + node-key message} → HTTP 422
                       graph_validation_failed（rule 以空格分隔 token 进 top-level message，
                       长码 sanitizer 可逆；raw details 不出服务）
                       （authority: SVC_WORKFLOW_DEFINITION_GRAPH_DIAGNOSTICS_V1 @ 0d56d1e，
                        V4 frontmatter depends_on；运行二进制 0f60c6f0 = 0d56d1e + 两处
                        SQLx enum::TEXT cast + 1 测试扩展，recovery receipt SOURCE_DELTA）
BROKER 422 渲染        registry renderError 例外（CTR-WDA-007(b)）：code=graph_validation_failed
                       && status=422 → 追加 ": " + sanitizeErrorDetail(detail)
```

五个机械判定：

```text
MODEL_SCHEMA_MATCHES_BROKER          = YES（模型可见 = manifest 投影，host 深度强制）
BROKER_SCHEMA_MATCHES_BACKEND        = YES（camelCase 顶层 + snake_case 嵌套逐字节兼容）
BROKER_PAYLOAD_PRESERVES_NESTED_GRAPH = YES（nodes/transitions 原样转发；linear 编译器
                                       产 canonical snake_case 图）
BACKEND_VALIDATOR_ACCEPTS_ACCEPTED_MINIMAL_GRAPH = 待 sandbox 实证（静态规则逐条比对 PASS）
ERROR_DETAIL_LOST                    = YES —— 见 §3（唯一断裂点）
```

## 3. 第一断裂点（机械证明）

`packages/broker/src/mapping.js` `validateInvocation`（live == main ac6f727）：

```js
const structural = validateArgumentsDetailed(op.arguments, args)
if (structural.violations.length > 0) {
  const resolved = resolveCode(manifest, structural.code ?? FALLBACK_ERRORS.invalid_arguments, ...)
  return { ok: false,
    error: structural.code === undefined ? resolved : { ...resolved, detail: structural.violations.join('; ') } }
}
```

`structural.code` 只有 violations 触及 `validationError` 声明叶子（Scheduler 类
bounds）才被设置。authoring manifest 未声明任何 `validationError` →
一切 structural 违规（unknown property / missing required / 标量类型）走
`resolved` 分支 → **violations 丢弃，envelope = 裸 `{code:'invalid_arguments'}`**。

离线复现（/tmp/wda-repro，live 字节直接 import）：

| 形状 | host 层 | child mapping 层 | parent compiler 层 | 模型可见 |
|---|---|---|---|---|
| A steps+terminalOutcome（干净） | PASS | PASS | PASS→编译→**应达 svc** | — |
| B snake_case nodes+transitions | PASS | PASS | PASS→**应达 svc** | — |
| C `graph` 包装 + contextSchema | PASS（根级 open） | **REJECT 裸码** | 未达 | `failed: invalid_arguments` |
| D camelCase 嵌套 | **REJECT（宿主 detail）** | 未达 | 未达 | 宿主 invalid arguments… |
| E 缺 required | PASS | **REJECT 裸码** | 未达 | `failed: invalid_arguments` |
| A′ steps 但带 semanticModelVersion | PASS（根级 open） | **REJECT 裸码** | 未达 | `failed: invalid_arguments` |

生产"多形状无差别塌缩为 invalid_arguments"与 **C/E/A′ 类**（structural 裸码、
零 svc 接触）完全吻合；svc 日志零 PUT 与全部 6 行一致。A/B 干净形状在 live
字节下必然产生 svc 日志——其缺失反证生产尝试未以干净形状发出。

## 4. Root cause classification

```text
ROOT_CAUSE = G（Broker collapses validation detail）
  精确机制：mapping.js validateInvocation 对无 validationError 声明码的
  structural violations 丢弃 violations 字符串，使 CTR-WDA-007(b) 的
  detail 渲染授权无米下锅。
CURRENT_CLASSIFICATION = IMPLEMENTATION / BROKER CONTRACT REGRESSION
  （accepted authority WDA V4 已 mandate detail；实现缺口在 mapping 层）
ERROR_DETAIL_LOST = YES
H（live 字节 ≠ accepted 实现）= NO（live broker WDA 相关 9 文件 == main；
  live index.js 差异 = life-workbench/热修线，与 WDA 无关）
```

"invalid_arguments" 本身不是 root cause：它是唯一被允许到达模型的塌缩码，
而使其不可诊断的机制是上述 detail 丢弃。

## 5. 修复路径（授权链）

- mapping.js/schema.js 的信封语义 authority = accepted
  `AGENT_CORE_WORKFLOW_BROKER_ERROR_PRESERVATION_V1`（R1/R4/R5；闭包含
  mapping/schema）→ 修正案挂该 Spec：**AMENDMENT_1**（manifest 声明式
  `structuralDiagnostics` opt-in → structural violations 以 detail 附着，
  500 字符硬上限；未 opt-in capability 信封字节不变）。
- manifest 数据改动 authority = accepted WDA V4 CTR-WDA-007 产品代码
  白名单（"the Workflow Authoring manifest"）→ 仅 replace_draft_graph
  声明 opt-in（与其 (b) 渲染授权范围精确对齐）。
- 模型可见 schema / validation predicate / 注册计数 / dispatch 语义 /
  credential seam / svc-workflow：全部零变化。

## 6. 证据边界

- 调用侧 transcript（authsvc runtime journal/session）需 sudo，未取证；
  §3 的形状归因由 svc 零日志 + 分层复现联合机械推出，不依赖 transcript。
- 运行中 svc 二进制（0f60c6f0）源对象不在本地 odb（recovery 用已删除
  fresh clone 构建）；其与 0d56d1e 的等价性依据 recovery receipt
  SOURCE_DELTA（两处 cast + 1 测试），422 rule-token 行为在 sandbox
  阶段用 0d56d1e 同源构建实证（V4 depends_on 精确 revision）。
