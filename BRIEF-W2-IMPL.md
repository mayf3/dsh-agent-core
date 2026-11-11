# BRIEF-W2-IMPL — CTR-W2 合同内实施（late 回复补投）

## 授权
accepted AGENT_DELIVERY_RESILIENCE_V1 §4.3 CTR-W2（contracts 权威）；普查 PR #691（c461bbcb）最小差量；W1 已入 main（#692，caller-wait-config.js）。已有合同内修复，不另造 Spec。

## 合同原文（必须逐条满足）
turn 在 caller 上限后 settle 且 outcomeEvidence=exact_turn_end_success 时：
(a) 目的地仍可接受（如飞书原话题）→ MUST 补投一次回复，并附「（补投）」标记；
(b) 不可投递 → MUST 落入可检索记录并触发 CTR-R5 计数；
静默丢弃 MUST NOT 是唯一路径。

## 任务
1. **核现状**：late settlement 存储面（reconciliation store 的 late_completed 记录、finalAssistantOutput 读回——现已有存储无补投）；确定补投挂点（settle 钩子后）
2. **实施 W2(a)**：exact_turn_end_success 的 late settle 后，向原入口（飞书原话题 reply 通道）补投一次回复，文本带「（补投）」标记；一次语义（去重防重放）
3. **实施 W2(b)**：补投不可投递 → 可检索记录（dead-letter/处置记录）+ CTR-R5 计数触发；不得静默
4. **边界**：UNKNOWN/D-009 不触碰（late_failed/terminated_without_outcome 不补投）；正文不可用/截断按普查边界处理；无生产激活
5. **测试**：新补投路径单元测试（成功补投带标记、不可投递入记录+计数、非 exact_turn_end_success 不触发、去重）真实 rc=0；全量 lib 回归
6. **交付**：单 commit → push origin feat/w2-late-reply-redelivery → PR(base main) 不合并；push 失败 → bundle 交接 /tmp/transfer-w2.bundle

## 工具指令
shell git/gh；禁 MCP github；写后自证；cargo/node 路径 export（cargo=/opt/homebrew/bin, node 用 /usr/local/libexec/agent-core/node-runtime/bin/node 跑 agent-router 测试）。

## 执行路由

- PREFLIGHT / REUSE / BRIEF / DURABLE；ROUTE_STAGE=IMPLEMENTATION。
- TARGET_REPOSITORY=mayf3/dsh-agent-core；BASE_HEAD/CURRENT_BASE_HEAD/初始 HEAD=`90493d5433a83b27288da1c7fa4ea6343ed71550`，本机 origin/main，#691/#692 已在基线。
- PRIMARY_AUTHORITY=`AGENT_DELIVERY_RESILIENCE_V1` accepted/contracts §4.3 CTR-W2、CTR-R5；相关权威为 Product Architecture thin Router、D-008/D-009、Lifecycle V4 C-018/有界正文规则、D009_ALIGNMENT_V1、local adoption/structure V3。具体 base blob 均可从本提交 parent 复现。
- AUTHORITY_ACCEPTED_IN_BASE=YES；IMPLEMENTATION_AUTHORITY=contracts；IMPLEMENTATION_ALLOWED=YES；MERGE_READY=NO（交付不合并）；OPERATION_ALLOWED=NO；CONTROLLED_RUNBOOK_REQUIRED=NO；SPEC_GAP_DEPENDENCY=NONE；LIVE_AUTHORITY_GAP=NONE；OWNER_DECISION_REQUIRED=NO。
- MUTATION_AUTHORIZATION=VALID（用户明确执行本 Brief）；ISOLATED_WRITE_SURFACE=YES：`/private/tmp/w2-impl`，ref=`feat/w2-late-reply-redelivery`。共享 Git 元数据只读；交付使用 `/private/tmp/w2-impl-delivery.git` 的独立 HEAD/index/ref，parent 固定上述 B，不改其他 checkout。
- GOAL_OR_TARGET=原 caller 上限后的 exact 成功向原飞书目标补投一次，不能投则可查询处置+CTR-R5；CURRENT_GAP=仅有 settlement/store/query，无原入口消费者。
- 设计：Router ingress consumer 按原 exact handle 订阅并立即 readback；复用同一 failure store/CTR-R5/getter，原目标先冻结；发送前持久 attempted，未知/重启不重发。记录仅含目标 metadata、output digest/bytes/truncated、原因、回执，不存答案正文，不改变 durable recovery 格式。
- Model convergence=RETAIN：reconciliation 仍唯一 outcome/query authority；新文件仅是原调用方 delivery disposition，无第二 turn 模型；Product API 既有 pull 恢复独立保留。
- EVIDENCE_NEEDED=新 W2 成功/失败/非exact/去重/竞态/截断/重启测试、相关入口回归、全量 scripts/lib Node 回归、结构/治理完整性、独立 affected-contract 与 final-head 核查。仓库无 Cargo.toml/Rust lib，不虚报 cargo 测试。
- EVIDENCE_REVIEWABILITY=PASS（离线源码和测试可复现）；DONE_WHEN=单 commit，测试 rc/计数、独立审查与未合并 PR 或可验证 `/tmp/transfer-w2.bundle`；EXPANSION_TRIGGER=authority 冲突、需改 UNKNOWN/权限/正文保密含义或生产效果；NEXT_ACTION=CONTINUE。

## 实施、验证与交付（source-only）

实现复用 Router 原调用方 exact reconciliation handle、Connector 原消息/原话题 reply、同一个 delivery failure store/CTR-R5/getter。仅在本次已进入 turn 的 outcome_unknown caller 超时上登记，不允许被旧 fence 拒绝的新请求接管旧回复。late_completed + exact_turn_end_success 且正文完整非空才发送，附 `（补投）`；无正文/截断/目标不可用/发送失败或结果不明均留 metadata-only 可查询处置和结构化计数。发送前 durable attempted，重复通知、重复登记、重启后的 uncertain attempt 不自动重发。保留原 outcome/query/UNKNOWN 结算和各 API 原有 pull 语义。

独立审查通过的源码 head=`02dcbad2b0c5b87063008ac965e8a95dd77d0ae1`、tree=`4cfb1cc86cfa7c198c438cf5efd93228c4c019cd`；最终同 parent 的 amend 仅追加本节记录，七个源码/测试 blob 不变。

| 实际执行 | rc | 计数 / 结果 |
|---|---:|---|
| 指定 `/usr/local/libexec/agent-core/node-runtime/bin/node` 新 W2 测试 | 0 | tests=22/pass=22/fail=0/cancelled=0/skipped=0；含成功标记、失败计数、非exact、去重、竞态、正文、重启、损坏旧记录隔离及两种旧fence拒绝负例 |
| 新 W2 + feishu-ux-seam、caller-wait-config、delivery-resilience、reconciliation-store 五文件联合回归 | 0 | tests=74/pass=74/fail=0/cancelled=0/skipped=0 |
| 全量 `node --test 'scripts/lib/*.test.mjs' 'scripts/lib/*/*.test.mjs' 'scripts/lib/*/test/*.test.mjs'` | 0 | 指定 runtime v25.6.1 与 Homebrew v26.7.0 均 tests=163/pass=162/fail=0/cancelled=0/skipped=1、suites=13；skip 为未配置的 live-closure integration |
| 结构 verifier B→通过审查的源码 head | 0 | CANDIDATE_DELTA_PASS_WITH_BASELINE_DEBT，candidate_violations=0、baseline_debt=28 |
| 治理 integrity `--require-accepted`；`git diff --check` | 0 | vendored bytes/accepted adoption 一致；diff clean |

全量 lib 两次启动在有界修复前；后续变化仅是 dead-letter 逐文件隔离、入口 old-fence gate 与新测试的分组/负例，未改变任何 scripts/lib 消费面；该修复及失效证据由最终 74 项与独立 delta review 覆盖。没有以新 SHA 机械重跑无关已通过机制。

额外旧 `process-lifecycle/feishu-reply-delivery-result.test.js` + UX 测试尝试 rc=1：UX 四项通过，前者因本地缺 git-pinned `@larksuite/channel` 无法 import（file-level failure），不是该通道回归 PASS。没有全仓 `npm test` 或生产 ACC-W2 七天观测的完成声明；不安装、启用配置、访问生产或发外部产品消息。测试依赖仅在隔离工作区临时复用本机非生产依赖，交付恢复原 tracked node_modules 链接。

独立审查 `/root/w2_review` 持久记录在随 bundle 的 evidence 包。FROZEN_BLOCKER_UNION=[W2-B1（损坏旧死信阻断恢复）,W2-GATE-1（新测试所在目录超宽）,W2-B2（Root自查：被拒新入口误绑旧caller）]；均以具体修复/回归关闭：逐文件隔离且保留损坏原件；新测试放入已有 runtime-hygiene recovery 分组；本次 accepted unknown carrier gate。修复后的 affected-contract / delta review PASS，BLOCKERS=0、SPEC_GAPS=0，最终 receipt-only head 另作独立绑定。

实际 push rc=128：github.com:443 无法连接；remote main 当前值 UNKNOWN，未创建 PR、未合并。按授权交付 `/tmp/transfer-w2.bundle`，prerequisite 为上述 B，单 commit。最终 commit/tree、bundle SHA-256、verify/独立 receiver import 与 final-head 核查精确结果在 `/tmp/transfer-w2-receipt.md`；原 checkout 共享 `.git`/HEAD 不改。源码交付完成状态以该回执为准；production apply=none、运行时/业务接受未验证。
