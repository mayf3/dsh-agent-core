# #1351 幽灵 holdings 四闸 — AUTHOR 交付记录

## 授权、坐标和实际范围

- 授权：本次用户明确要求按 [Brief 固定副本](BRIEF-1351-SPEC-AUTHOR.md) 起草 Spec，
  commit→push→PR(base `main`)，不合并。原 root 文件保留，未将旧 IMPL Brief 当当前执行令。
- 仓库：`mayf3/dsh-agent-core`；隔离 worktree：
  `/Users/yanfenma/workspace/project/worktrees/h1351-gates`；单 writer=`/root`。
- 分支：`docs/1351-gates-spec`；authoring parent / integration base：
  `1d3cef866f2bac545a4aa62ca53f5b0e178dd2a1`；首次远端 main 核对同此 SHA。
- [输入 provenance](provenance.json) 绑定原文件 SHA256/完整副本、固定 Core 权威 blob/hash、
  Svc 固定参考 `b5096782f666ad22aa3508fdbf9562278a977c0f` 和封存时间。
- issue 正文及收敛评论由 GitHub connector 只读取得，完整业务文本见
  [issue snapshot](issue-1351.json)。读取时间未单独采集，封存时间不冒充 API 返回时间。
- 产品源码、产品行为测试、schema、配置、生产、相邻 checkout/ref：本次均无写入。
  仅本仓文档、Git 提交/推送及用户明确要求的 PR 是允许效果。

## 路由与有界 ExecPlan

```text
schema_version = 2
SPEC_GOVERNANCE_MODE = AUTHOR
GOAL_OR_TARGET = #1351 four-gate proposed authority + route/prerequisite evidence + open base-main PR
CURRENT_GAP = accepted-in-base four-gate contracts missing; real removal/checker bindings unresolved
AUTHORITY_ACTION = NEW (Core); Svc owning successor review required, not Core acceptance
PRIMARY_AUTHORITY = accepted local governance / Architecture / D-008; Standing Delegation CTR-SOD-003 section 3C
TARGET_PROPOSAL = AGENT_CORE_GHOST_HOLDINGS_PROTECTION_V1
PLAN_LEVEL = EXEC_PLAN
ASSURANCE_LEVEL = CONTROLLED
ROUTE_STAGE = AUTHORITY_AUTHORING
AUTHORITY_ACCEPTED_IN_BASE = NO (new four-gate obligations only)
IMPLEMENTATION_AUTHORITY = none
IMPLEMENTATION_ALLOWED = NO
MERGE_READY = NO
OPERATION_ALLOWED = NO
EVIDENCE_NEEDED = source provenance; exact-head nonauthor review; deterministic document checks; remote PR readback
DONE_WHEN = proposed docs committed/pushed, base-main PR created and read back; no merge
EXPANSION_TRIGGER = actual accepted-authority conflict or code/production/new-privilege request
NEXT_REAL_ACTION = review/check proposed docs, then deliver authorized commit/push/PR
```

本次执行计划只覆盖 authoring/delivery，不是未来生产 runbook：

1. 完整读入口、Brief、STOPPED 表及直接权威；复用已有 surface 坐标，不重做源码探索。
2. 固定来源与逐条权威路由；起草 proposed/none Spec、四闸验收和缺件门。
3. 做 schema/coverage/lifecycle/integrity 和文档范围检查；提交精确 candidate 给非作者审查。
4. 检查 final candidate 与 base 变化；push 新分支，创建 base-main PR，读回 head/base/open/merge 状态。
5. 到此停止。原授权不含本轮正式接受、合并、产品实现或运行验收。

常规文档修订不改变 accepted stable IDs。若审查发现真实权威冲突，停止依赖、记录具体
反例；非阻断建议不扩成新平台/全仓审计。意外必要输入/必需谓词失败按 Brief 写根目录
`STOPPED-1351-SPEC.md`，不把探索性 rg 空结果、缺想象路径或有效空 holdings 当测试失败。

## 四条路由论证与复用边界

完整 crosswalk 见 [提案 §3](../../specs/AGENT_CORE_GHOST_HOLDINGS_PROTECTION_V1.md)。

| 条款 | 本次处置 | 不能冒称的既有授权 |
|---|---|---|
| C1 删除 | Core NEW；真实 callable 绑定为接受前置 P1；disable 直通不加 GC 依赖 | 精确 resolver/read/admission 不授删除权；没有造 remove helper |
| C2 巡检 | Core NEW；真实 NOT_IN_REGISTRY owner/扩展点绑定为接受前置 P2 | Scheduler W1/W2 不是已绑定的 holdings 检查器；无命中不证明不存在 |
| C3 活性 | Core NEW 的配套要求；Svc 角色合同由 Svc 正式承接 | 本地 enabled 通过集合受新增 registry 拒绝影响，Svc 必须处理 owning whole successor，不是同 ID“修 bug” |
| C4 过户流程 | Core NEW 流程决策；authoring/execute 能力 REUSE | 发布真实 workflow 不授任意 reassignment；一次固定 OLD/NEW migration 不能泛化 |

Svc 原 `IDENTITY_PROVISIONING_API_V0` §5–6 只要求本地 exists+enabled；新增 registry
缺失/disabled/不可用拒绝改变旧通过集合及失败语义，应由 Svc 路由完整 SUPERSEDE。
若同时影响 coordinator reconcile target 的 `CTR-CP-003/DEC-CP-007`，也须由其 owning
authority 处理；不向已 disabled 的 source 额外要求 enabled，不把合法 human owner 当幽灵。

WEC5/PPR2 是 paired **模式来源**，不是本四闸的新授权。其当前 frontmatter 已为
accepted/contracts，但新的 RTH 仍保留 Svc 配套门。本提案保持 proposed/none，不照抄
历史 authoring 段落倒改它们的现态，不更新任何 current pointer 或 lifecycle backlink。

## 接受/实施前置清单（本次未跨越）

- P1：真实删除 owner repo/commit/path/symbol/invocation、全部同效离册路径及并发边界，UNKNOWN。
- P2：真实 NOT_IN_REGISTRY owner/commit/invocation/role 扩展点与报告面，UNKNOWN。
- P3：Svc 正式配套 authority ID/Contracts/hash、reviewed semantic SHA、真实接受者权限/时间、
  final accepted SHA、main SHA/实施 base 包含关系、独立 final-head 核验，REQUIRED/UNKNOWN。
  覆盖全量 holdings 读、全写点、wire/timeout/freshness、删除竞态和合法过户命令；不能预造接口。
- P4：非作者精确候选语义审查、合法接受者和最终正式接受事务。本轮 proposal review 可产生
  审查结果，但不代正式接受；需另次明确 `none→contracts`，且对应 accepted refs 进入实施 base。
- 实际调用资格、安装、启用、隔离三条业务验收、生产 Mandate/业务读回：NOT_EXECUTED。

提案明确 `READY_TO_MARK_ACCEPTED=NO`，允许缺件未闭合的提案交审；缺件不阻断本次已授权
docs PR，也不会因为本 PR 创建而消失。它不把缺生产授权当作停止普通文档工作的理由。

## 检查与审查实态

本次只做文档检查，不运行产品测试，不宣称三条业务验收 PASS。实际检查原文及 rc 将保存
在 [validation.txt](validation.txt)。非作者 proposal review 与最终交付坐标记录在本 PR
的 body/readback；本文件不嵌入自指 commit/hash，也不以作者报告冒充独审接受事务。

只读子任务 `/root/paired_authority` 检查 WEC5/PPR2 和固定 Svc 权威，未起草语义 delta、
未修改文件、未签接受；独立语义审查由另一个未参与作者工作的 reviewer 执行。
提交/推送/PR 的最终坐标以 Git 对象及远端 PR 读回为准。
