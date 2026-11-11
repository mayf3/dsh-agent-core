# BRIEF-W1-IMPL — CTR-W1 合同内实施（caller 等待上限按 surface/agent class 可配置）

## 授权
accepted AGENT_DELIVERY_RESILIENCE_V1 §4.3 CTR-W1（contracts 权威）；普查报告 PR #691（c461bbcb）给出最小差量。已有合同内修复，不另造 Spec。

## 任务
1. **核现状**（先读后写）：`packages/agent-router/src/deadline-config.js:45-70` 四生命周期字段（turnTimeoutMs=300000）+ env 兼容（DSH_AGENT_TURN_TIMEOUT_MS/旧名）；Router caller-wait 层的现有 caller budget 通道（普查坐标）
2. **实施 W1**：caller 等待上限按可信 surface/agent class 可配置——接入现有 caller budget/deadline 通道；**默认值保持现行为**（300000ms 或现值，不变更行为）；配置文档记录默认值与优先级（env → class 配置 → 默认）
3. **测试**：新配置面的单元测试（surface/class 选择、默认回退、env 兼容不破坏）——真实跑 rc=0；全量 lib 回归
4. **边界**：不改 UNKNOWN/D-009 语义；不动 reconciliation；不激活配置（安装/启用=部署链）；production apply none
5. **交付**：单 commit → push origin feat/w1-caller-wait-config → PR(base main) 不合并；push 失败（代理 7890）→ bundle 交接 /tmp/transfer-w1.bundle

## 工具指令
shell git/gh；禁 MCP github；写后自证；cargo 在 /opt/homebrew/bin（export PATH）。

## 执行路由（2026-11-10）

- TARGET_REPOSITORY=`mayf3/dsh-agent-core`；BASE_HEAD/CURRENT_BASE_HEAD/初始 HEAD=`bf39bf47a52721972a9845b5f158974225c8d139`（origin/main，#691 已合并）；isolated worktree=`/private/tmp/w1-impl`，ref=`feat/w1-caller-wait-config`。
- SPEC_GOVERNANCE_MODE=PREFLIGHT；ROUTE_STAGE=IMPLEMENTATION；AUTHORITY_ACTION=REUSE；PLAN_LEVEL=BRIEF；ASSURANCE_LEVEL=DURABLE。
- PRIMARY_AUTHORITY=`AGENT_DELIVERY_RESILIENCE_V1` accepted/contracts，§4.3 CTR-W1、ACC-W1，base blob 由本提交 parent 可复现；AUTHORITY_ACCEPTED_IN_BASE=YES；IMPLEMENTATION_AUTHORITY=contracts。
- RELATED_AUTHORITIES：Product Architecture 的 thin Router/AgentDefinition ownership；D-008/D-009；Lifecycle Hardening V4 §5 四字段；D009_ALIGNMENT_V1；local governance/adoption V3 与 code structure V3。历史 proposed/activation-pending 文案不覆盖已在本 main 基线合入的 acceptance。
- GOAL_OR_TARGET：可信入口 surface 与静态 agent class 选择 caller 等待预算；CURRENT_GAP：已有 per-Agent 生命周期回退与 caller 通道，缺 selector/接线/配置文档。
- MUTATION_AUTHORIZATION=VALID（用户明确执行本 Brief）；ISOLATED_WRITE_SURFACE=YES；原 checkout Git 元数据位于只读共享目录，交付改用 `/private/tmp/w1-impl-delivery.git` 独立 index/HEAD/ref，parent 固定上述 B，不改其他 checkout。
- IMPLEMENTATION_ALLOWED=YES；MERGE_READY=NO（本任务不合并）；OPERATION_ALLOWED=NO；CONTROLLED_RUNBOOK_REQUIRED=NO；SPEC_GAP_DEPENDENCY=NONE；LIVE_AUTHORITY_GAP=NONE；EVIDENCE_REVIEWABILITY=PASS（源码与本机可复现离线测试）；OWNER_DECISION_REQUIRED=NO；NEXT_ACTION=CONTINUE。
- 设计：Router deployment config `callerWait.{bySurface,byClass,agentClasses}`；`DSH_AGENT_CALLER_WAIT_TIMEOUT_MS` > class > surface > 原有 `perAgent(agentId).turnTimeoutMs`。surface 由现有可信 adapter namespace 决定，class 仅由静态 Agent id 映射，不接受消息自报；Scheduler 显式 deadline 保留。
- Convergence disposition=RETAIN：四生命周期字段及其新旧 env 是受支持的独立责任，沿用原解析器；caller budget 沿用 route-chain 与 turn 第四参，不建第二个计时/结算模型。AgentDefinition schema 不扩展。
- EVIDENCE_NEEDED：selector/入口接线单测、现有 deadline/route-chain 回归、全量 `npm test` 与 `scripts/lib` Node 测试、结构/治理完整性检查、独立 affected-contract review。当前仓库无 Cargo.toml/Rust lib，不能虚报 cargo 执行。
- DONE_WHEN：一个实现 commit、测试 rc/计数与审查证据，push/未合并 PR 或可验证 `/tmp/transfer-w1.bundle`；EXPANSION_TRIGGER：accepted authority 冲突、需改四字段/UNKNOWN/reconciliation 含义或超出 source-only 范围；生产 apply=none；NEXT_REAL_ACTION：实现 selector 与入口接线。

## 实施与验证记录（source-only）

最终实现仅为本 Brief、配置文档、Router composition/ingress 两处接线、独立 caller selector 及其测试六文件。`deadline-config.js`、route-chain、AgentProcess 四字段、UNKNOWN/D-009 与 reconciliation 均未修改。新配置缺省时延续原预算；静态配置只提供能力，未写生产配置或部署。源码审查 head=`0b3b50b2d882735f7c92364f7cac4679f3f1c48e`；最终同一 parent 的 amend 仅追加本节事实，五个实现/测试/配置文档 blob 不变。

| 实际执行 | rc | 计数 / 结果 |
|---|---:|---|
| `node --test packages/agent-router/test/route-chain/caller-wait-config.test.js packages/agent-router/test/deadline-config.test.js` | 0 | tests=17/pass=17/fail=0/cancelled=0/skipped=0；其中新测试8项 |
| 上述两文件 + `packages/agent-router/test/process-lifecycle/timeout.test.js packages/agent-router/test/single-flight.test.js` | 0 | tests=29/pass=29/fail=0/cancelled=0/skipped=0；最后一次在私有 Git HEAD 的实现字节上执行 |
| `node --test 'scripts/lib/*.test.mjs' 'scripts/lib/*/*.test.mjs' 'scripts/lib/*/test/*.test.mjs'` | 0 | 全量 Node lib：tests=163/pass=162/fail=0/cancelled=0/skipped=1（live-closure integration 未执行）；suites=13 |
| Router route-chain 目录 + deadline-config 广回归 | 1 | tests=197/pass=193/fail=4/cancelled=0/skipped=0；三项缺 paired native build，一项 listen EPERM |
| 额外全包 `npm test`；随后加 timeout/force-exit 的相同两层 package glob | 130 | 多次启动后因环境失败/挂住中断，无完整总计；不是 PASS。保留所有日志，完整计数 UNKNOWN |
| 结构 verifier，B→审查 head | 0 | `CANDIDATE_DELTA_PASS_WITH_BASELINE_DEBT`；candidate_violations=0，baseline_debt=28；无 registry/authority 修改 |
| `python3 .agents/tools/verify_governance.py --target . --require-accepted`；`git diff --check` | 0 | lock 字节一致 / adoption accepted；diff clean |

额外全包失败包含沙箱拒绝 loopback listen、缺 git-pinned `@larksuite/channel`、未配置 `NGC_HARNESS_ROOT`，以及并发短 deadline 失败，不能全部归为已证实的环境问题。相关 quota / durable persistence 两文件由独立审查方单独重跑 rc=0、25/25；我方并发重跑 rc=1、24/25（25ms RPC deadline expired before write），原始相反结果一并留存。相关 route-chain/lifecycle 源码未被本次修改；未发现本 diff 的 concrete regression，但不宣称全仓 PASS 或 merge readiness。

依赖准备仅在此隔离工作区进行：初始 tracked `node_modules` 为 dangling symlink；验证时连接本机非生产 checkout 中与 lock 一致的直接依赖与本工作区 `@agent-core` 包。该准备不提交，交付前恢复原链接。未安装生产 profile，未启动生产进程。

独立审查 `/root/w1_review` 未写候选：affected-contract review PASS，`FROZEN_BLOCKER_UNION=[]`、BLOCKERS=0、SPEC_GAPS=0，绑定上述源码 head 与五个未变 blob；final receipt-only amend 另核 exact head。审查只覆盖本次未合并源码/bundle，不授予 merge、安装、配置启用或 production acceptance。

交付：`git push origin feat/w1-caller-wait-config` 实际 rc=128（无法连接 github.com:443），因此按 Brief 改为 `/tmp/transfer-w1.bundle`；不声称 PR 已创建。bundle prerequisite 为 B；最终 commit、bundle verify、log SHA-256 与独立 final-head 结果在随附 `/tmp/transfer-w1-receipt.md` 及证据包中精确绑定。源码交付的 DONE_WHEN 在 bundle 验证完成时满足；广包测试限制保留，production apply=none。
