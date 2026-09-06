# TERMINAL — WORKFLOW_DEFINITION_AUTHORING_PRODUCTION_V1 · RESUME_GOAL_FRESH_REGRESSION（2026-09-06）

**GOAL_STATUS = COMPLETE（回归闭环）· WORKFLOW_DEFINITION_AUTHORING_PRODUCTION_READY = YES（已恢复）· OWNER_ACTION_REQUIRED = NONE**

## 验收清单（REAL acceptance test，正常 Agent 面生产实测）

| 项 | 结果 |
|---|---|
| MODEL_FACING_AUTHORING | **PASS**（agt_hr-agent 真实 turn，仅经 broker 模型面能力，无内部 runner） |
| DOMAIN_RESOLUTION | **PASS**（HR 经 `workflow_my_domains` 自行解析 hr-onboarding `cdb96dbf`，零 Owner UUID 手输） |
| OWNER_MANUAL_DOMAIN_UUID_REQUIRED | **NO** |
| DEFINITION_CREATED | YES（`788a0725-1f0f-4e21-aa09-2c5aa1ebd274`，key `wda_regression_fix_v1_0906`） |
| DEFINITION_VALIDATED | YES（Legacy 最小图 replace 通过；semanticModelVersion=3 误用 4 次全部 fail-closed 500 = 顺带负面证明） |
| DEFINITION_PUBLISHED | YES（`cf51e7d6-854c-42cc-ba5f-b23d6bdd07ac` = PUBLISHED） |
| INSTANCE_CREATED | YES（`b57f323a-592e-45c0-8e9e-cd632960764b`，created_by = dc702687 即 HR 本体） |
| READY_FOR_HR_DISCOVERY | YES（实例 live，按指令停在派发之前） |

DB 回读（auth_ro 只读）与 Agent 自报坐标逐项一致：`AGENT_REPORT_MATCHES = true`。

## 回归根因与修复链（SHIP_BLOCKER = MODEL_FACING_DEFINITION_AUTHORING_DOMAIN_BINDING）

1. **机械分解**：`missing required property "domainId"` 出自 broker 必填校验（mapping.js:72）→ 模型面工具早已暴露并要求 domainId（CTR-WDA-001 冻结显式绑定，部署==源码 diff IDENTICAL）→ 真实缝 = **域解析引导缺失**（判别式裁定 A；NEW_AUTHORITY_REQUIRED=NO，MECHANICAL_CONFORMANCE_FIX）。
2. **修复 1（PR #180 @ main 296c735）**：4 op 的 domainId description + 工具级 description 指向既有 canonical 读面 `workflow_my_domains`/DOMAIN_OWNER；focused 7/7 + broker 341/341；独立实现 audit ACCEPT（BLOCKER_UNION=[]，结构同一性证明 + 变异测试 pin 真实）。
3. **部署 r1**：preimage `f2accbd2` → `4514ab60`，kickstart（17035→53198）；生产负面证明三负一正 PASS（malformed=400 / unknown=403 / unauthorized=404，均 fail-closed；authorized 控制组 PASS）。
4. **FIX-ONCE（PR #181 @ main a95410e）**：生产 negproofs 的 my_domains `roles=[null]` 暴露 svc `MyDomainItem` serde 是 snake_case `caller_role`（引导文本首版写了 callerRole）→ 文本对齐 + pin 断言扩展；独立复核 agent 因用量限额不可用，由主线机械复核替代（结构同一性 TRUE vs 父、callerRole 零残留、341/341，如实记录）。
5. **部署 r2**：`4514ab60` → `60ad96c9`，kickstart（53198→69604）；生产 catalog 引导在场；my_domains 正确返回 `caller_role`（10 个 canary owner 域）；negproofs 复跑 PASS（authorized 控制 `fbca5174`）。
6. **真实验收**：飞书 4 轮正常操作交互（含两次正常纠偏：domainId 必填带上重试 → 成功；semanticModelVersion=3 误用 → 指示用默认 Legacy → 成功），最终 Agent 全链自达 create→draft→graph→validate→publish→instantiate。

## FOLLOW_UP_DEBT

1. `semanticModelVersion` 参数缺描述引导（模型误选 3 导致 4 次 500）——建议补一句"省略 = Legacy 1 = 生产默认；3 仅 Visit Activation 图"。
2. svc 图校验错误映射 500 且不给规则名（已知既有债）。
3. broker 必填参数错误信息可附"参数在 schema 中存在但未提供"语义项，减少模型误读为"未暴露"。
4. 本轮生产部署脚本首版 pid 检查对 launchctl print 输出格式过敏（已修幂等）。

## 证据清单（本目录）

- `NEGPROOFS_RESULT.json` / `NEGPROOF_MY_DOMAINS.json`（r1/r2 生产负面证明 + 域解析回读）
- `DEPLOY_CATALOG_PROOF.json`（生产模型面 catalog 引导在场证明）
- `PREIMAGE_*.js`（两次部署 preimage，sha 见文件名）
- `feishu-report.json`（Agent 自报坐标 → DB 回读输入）
- 部署/验收 runner 与 driver：`deployment-artifacts/wda-regression-fix-v1/`（selftest 离线 stub 全流程 PASS）
- 代码变更：PR #180 / #181（main `296c735` / `a95410e`），生产部署 sha `4514ab60`（r1）→ `60ad96c9`（r2，现役）
