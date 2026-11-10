# BRIEF-W3-IMPL — CTR-W3 合同内实施（outcome_unknown 入口可见性）

## 授权
accepted AGENT_DELIVERY_RESILIENCE_V1 §4.3 CTR-W3（contracts 权威）；普查 PR #691 最小差量；W1（#692）/W2（#693）已入 main。无现有作者（#1388 评论区核验 2026-11-10）。

## 合同原文（逐条满足）
任何 stop:outcome_unknown MUST：
(a) 走既有 reconciliation（D-007：unknown never terminal）——**已存在，保留不动**；
(b) 向入口 surface 通知「该轮结果未证实，稍后随结算补投或请重发」，与 CTR-W2 的结算钩子衔接。

## 任务
1. **核现状**：stop:outcome_unknown 现路径（spawn.js AGENT_PROCESS_TURN_OUTCOME_UNKNOWN reject + caller-wait 通道）；入口通知现缺（这就是 W3 缺口）
2. **实施 W3(b)**：outcome_unknown 拒绝/记录点向原入口 surface（飞书原话题通道，复用 W2 的 ingress 通道设施）发出通知，文本含「该轮结果未证实，稍后随结算补投或请重发」语义；与 W2 结算钩子衔接（后续 exact success → W2（补投）路径自然接管）
3. **边界**：UNKNOWN never terminal 不触碰（不把 unknown 定为终态、不提示用户"重跑原业务"即统一重执行——通知语义是"未证实+稍后补投或请重发"，不是"重新执行任务"）；FAILED 路径不发本通知；无生产激活
4. **测试**：新通知路径单元测试（unknown→通知发出且文本含三要素、FAILED 不发、W2 补投后不重复通知）真实 rc=0；全量 lib 回归
5. **交付**：单 commit → push origin feat/w3-unknown-ingress-visibility → PR(base main) 不合并；push 失败 → bundle 交接 /tmp/transfer-w3.bundle

## 工具指令
shell git/gh；禁 MCP github；node=/usr/local/libexec/agent-core/node-runtime/bin/node（agent-router 测试）；写后自证。

## 执行路由与坐标

- schema_version=2；SPEC_GOVERNANCE_MODE=PREFLIGHT；AUTHORITY_ACTION=REUSE；PLAN_LEVEL=BRIEF；ASSURANCE_LEVEL=DURABLE；ROUTE_STAGE=IMPLEMENTATION。
- TARGET_REPOSITORY=mayf3/dsh-agent-core；初始 HEAD/local origin/main=`90493d5433a83b27288da1c7fa4ea6343ed71550`；实施 parent/BASE_HEAD=`57a8b9c95da430593505d3ae7bd0024230f150ba`（W2 原交接提交，已有本地 object/ref/bundle）。用户说明 #693 已入 main；shell git/gh 无法连接 GitHub，CURRENT_BASE_HEAD=UNKNOWN，不把本机旧 origin/main 或 W2 feature ref 称为远端 main 现状。
- PRIMARY_AUTHORITY=`docs/specs/AGENT_DELIVERY_RESILIENCE_V1.md` accepted/contracts §4.3 CTR-W3，及 CTR-W2；其权威 blob 与初始 main 相同且已在 base。相关权威为 Product Architecture 薄 Router、D-008/D-009、D009_ALIGNMENT_V1、local governance/structure V3。D-007 为历史引用，当前 Decision 为 D-009；UNKNOWN 业务事实及既有 reconciliation 不改。
- AUTHORITY_ACCEPTED_IN_BASE=YES；IMPLEMENTATION_AUTHORITY=contracts；IMPLEMENTATION_ALLOWED=YES；MERGE_READY=NO（不执行合并）；OPERATION_ALLOWED=NO；CONTROLLED_RUNBOOK_REQUIRED=NO；SPEC_GAP_DEPENDENCY=NONE；LIVE_AUTHORITY_GAP=NONE；OWNER_DECISION_REQUIRED=NO。
- MUTATION_AUTHORIZATION=VALID（用户明确执行本 Brief）；ISOLATED_WRITE_SURFACE=YES：`/private/tmp/w3-impl`，独立交付 Git directory=`/private/tmp/w3-impl-delivery.git`、ref=`feat/w3-unknown-ingress-visibility`。原共享 `.git`/其他 checkout 不改；独立 index/ref 以 W2 提交为 parent，仅本次 W3 为一个新 commit。
- GOAL_OR_TARGET=UNKNOWN 原入口可见性并衔接现有 W2；CURRENT_GAP=spawn 的 child-exit unknown reject 与 turn-execution 的 caller-wait unknown carrier 最终均到 ingress catch，但回执只有底层 delivery failed，无 CTR-W3 文案。
- Model convergence=RETAIN：reconciliation 仍唯一 outcome/结算权威；W2 仍是 exact late success 原调用方消费者。本次只复用其原目标和已消费状态，通知不写终态、不清 fence、不自动重试或二次 admission，不增加长期 outcome/业务状态模型。
- EVIDENCE_NEEDED=W3 正反例、通知失败、原话题、W2 先结算/发送中/已送达竞态、相关入口/W2 回归、全量 scripts/lib Node 回归、结构/治理完整性、独立 affected-contract/final-head review。EVIDENCE_REVIEWABILITY=PASS（离线可复现源码与日志）。
- DONE_WHEN=单 W3 commit + rc/测试计数 + 独立审查 + 未合并 PR 或已验证 `/tmp/transfer-w3.bundle`；EXPANSION_TRIGGER=authority 冲突、需改 UNKNOWN/身份/权限/正文保密语义或生产效果；NEXT_REAL_ACTION=实现并验证原入口通知；NEXT_ACTION=CONTINUE。

## 实施与验证（source-only）

UNKNOWN 的 status/envelope 与 `AGENT_PROCESS_TURN_OUTCOME_UNKNOWN` code 均使用 CTR-W3 固定文案，通过 W2 在 await 前捕获的原飞书消息/话题目标发送；普通 FAILED 保留原双参数 failure reply。原 caller 的 W2 watch 继续按 exact handle 结算；补投已持久 claim 或已送达时跳过过时 UNKNOWN 通知。通知失败不改 outcome、不清 fence、不妨碍后续 exact success 补投。本次没有新增业务状态模型或自动业务重试。

| 实际执行（指定 Node v25.6.1） | rc | 计数 / 结果 |
|---|---:|---|
| 新 W3 单文件 | 0 | tests=11/pass=11/fail=0/cancelled=0/skipped=0；原话题/unknown 两通道/FAILED/通知失败/W2 衔接/竞态/non-Feishu |
| 最终八文件联合回归（W3、W2、UX、caller-wait、delivery-resilience、reconciliation、late-settlement、timeout） | 0 | tests=117/pass=117/fail=0/cancelled=0/skipped=0 |
| 全量 `node --test 'scripts/lib/*.test.mjs' 'scripts/lib/*/*.test.mjs' 'scripts/lib/*/test/*.test.mjs'` | 0 | tests=163/pass=162/fail=0/cancelled=0/skipped=1、suites=13；跳过未配置的 live-closure integration，约154秒 |
| 治理 integrity `--require-accepted`、`git diff --check` | 0 | vendored bytes 与 accepted lock 一致；diff clean |

如实保留早期失败：首次相关回归 rc=1（72 pass、2 file-level failure，缺 schemastery）；临时使用 `/tmp/w3-validation-node-modules` 中本机隔离依赖后，一次联合回归发现 UX-SEAM-4 既有源码形状 gate。修复恢复普通失败调用原形，仅提取 UNKNOWN helper；最终117项全部通过，未改旧测试或权威。原 tracked node_modules 链接在交付前恢复，不提交依赖变化。全量 lib 已通过后仅此入口 helper/注释改动，无 scripts/lib 受影响依赖，不机械重跑。

独立审查记录、结构 gate、最终 commit/tree 与 bundle 哈希/导入结果在随交付的 `/tmp/transfer-w3-receipt.md` 和 evidence 包中精确绑定。FROZEN_BLOCKER_UNION=[W3-GATE-1（既有UX源码形状检查）]，该项已修复且最终UX行为/结构测试通过。最终 head 还需独立 delta 绑定；不声明全仓测试、merge readiness、生产安装、真实通知投递或生产 ACC-W2 验收完成。所有产品消息测试均为本地 fake。
