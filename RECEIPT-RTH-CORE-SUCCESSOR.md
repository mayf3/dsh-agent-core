# RECEIPT-RTH-CORE-SUCCESSOR

本次交付 **WEC V5 + PPR V2 两份完整 SUPERSEDE 提案**，proposed/implementation none/
production none；拟在未来 Owner 正式接受事务中承接 contracts 实施权。本次不接受、不退休
当前权威、不实现、不合并、不做生产写入。#1377 的原 STOPPED 和实施闸门保持。

## 1. 授权、坐标与路由

- Task/mandate：[BRIEF-RTH-CORE-SUCCESSOR](BRIEF-RTH-CORE-SUCCESSOR.md)，本地用户原文；
  只在 `/private/tmp/h1377-minimpl` 文档面写入，交付新分支 `docs/rth-core-successor`、push、
  open PR(base main)，不合并。其他旧 Brief/STOPPED 未跟踪文件保留，不混入本交付。
- `BASE_HEAD = b6ddc2a67ba041b8b13ed33d331104cf809d4985`，从该 detached main 快照建分支。
  起始无 tracked diff；#655→#657→#658 依次已合入，不能以 source body 的历史“待合入”否定祖先事实。
- 首次 source hash 采集：`2026-11-07T21:33:34.497520+00:00`（本机 UTC），文档日期按本地 2026-11-08。
- fresh `CURRENT_BASE_HEAD = b177d3fcce3febb09711135c145cc4b43e63aa8e`；fetch/log/diff 证明
  仅增加 #663 WEC4 implementation 的源码/测试/证据；相关 authority、治理、Architecture/
  Current Decisions 未变。本候选保持原 parent，不把 #663 源码写进 docs-only 分支。
- Svc main 只读坐标：`b5096782f666ad22aa3508fdbf9562278a977c0f`；详细来源/限制在
  [Svc readback](docs/reports/rth-core-successor/svc-authority-readback.md)。没有生产 DB/凭据/运行态读取。

授权原件：`/Users/yanfenma/Documents/Codex/2026-10-18/zcode-assist/tools/b7ctl/DISPATCH-REGISTRY.json`，
只选择所需 ruling；canonical 方法 `json.dumps(ensure_ascii=False,sort_keys=True,separators=(',',':'))`
的 UTF-8 SHA256，已与仓内接受事务核对，不把本地 registry 当作产品合同或操作完成证据。

| Selector | fresh canonical SHA256 | 本任务效力 |
|---|---|---|
| `$.rulings[id=owner-20261107-standing-delegation]`，items[2] 原 §3B | `01cc059c2bf0e0493588f00032ca06eb73e3a0a13cb33f4078996fdccb79dad3` | 已决定语义所必需的整权继任/Core-Svc 配套起草；正式载体 Standing Delegation V1 CTR-SOD-003 保留独立审查/真实接受者/互斥权威门 |
| `$.rulings[id=owner-20261107-four-pr-rulings]`，items[2] ③ | `677bfe608a67d67f8f9092d817fff0e4f4d040f1bc6e0a0184a69315bc54d7b7` | RTH 独立 reason、严格 discrepancy-only、原身份/UNKNOWN 安全语义限定接受；Core whole successors/Svc 正式配套前不实施 |
| `$.rulings[id=owner-20261107-five-decisions]` | `95290062529cf24c31d3c7f6c748a22e5e369d14458cf623f562eee5c90cedc8` | 原③是 #643 aging 的限定接受；RTH 对应后续四 PR 裁定③，不能混用编号 |

仓内可持久复核来源：[Standing Delegation 的原文快照](docs/reports/standing-delegation-formal-20261107/owner-ruling.json)、
[R4 RTH 接受记录](docs/reports/succession-r4-step4/acceptance-transaction.md)、RTH1 frontmatter 的
accepted reviewed head/hash/selector。作者本次不执行 §3B 接受委托；本用户任务明确只到 proposed PR。

```text
schema_version = 2
SPEC_GOVERNANCE_MODE = AUTHOR
GOAL_OR_TARGET = RTH refused protocol 的 Core contracts 整权承接提案及配套核对
CURRENT_GAP = 语义已限定接受；WEC4/PPR1 仍排除新 reason/terminal append，Svc 配套未证明接受
AUTHORITY_ACTION = SUPERSEDE
PRIMARY_AUTHORITY = accepted Architecture + D008/D009 + WEC4/PPR1/RTH1 @ BASE_HEAD
PLAN_LEVEL = BRIEF (单 docs-only 提案交付；不执行跨仓实现/迁移)
ASSURANCE_LEVEL = CONTROLLED (跨仓持久协议/生命周期；本次无生产操作)
ROUTE_STAGE = AUTHORITY_AUTHORING
AUTHORITY_ACCEPTED_IN_BASE = NO (two new successors)
DOCS_FIRST_REQUIRED = YES
IMPLEMENTATION_AUTHORITY = none (both proposed docs)
ACCEPTED_TARGET_IMPLEMENTATION_AUTHORITY = contracts (future explicit Owner transaction)
IMPLEMENTATION_ALLOWED = NO
MERGE_READY = NO (acceptance/merge excluded)
OPERATION_ALLOWED = NO
EVIDENCE_NEEDED = exact sources/hashes + crosswalk + syntax/lifecycle/carry checks + independent review
DONE_WHEN = docs/specs proposals + this receipt + independent review + commit/push + open base-main PR; no merge
EXPANSION_TRIGGER = failed required gate; conflict beyond declared delta; product/production write need
FAILURE_ACTION = stop dependent work and append STOPPED-1377-MINIMPL.md
```

## 2. 路线论证与推荐

| 路线 | 结论 | 具体原因 |
|---|---|---|
| a. 独立 NEW refused implementation Spec，supersedes[] | 拒绝作为可激活实施权威 | RTH1 §3.1:103–125 已明示 owning Core 整权继任；NEW 不能覆盖 WEC closed reason、PPR terminal no-append。可达反例：历史 visit 合法 refusal 仍被旧系统入口/current 门拒绝，Core 擅自追加则违反原 terminal 约束 |
| b. AMEND accepted PPR V1 | 拒绝 | PPR1 §2/§8/CTR-PPR-004 明确排除 refused-terminal 新 protocol；改变其通过集合和失败/终态含义不满足 SPEC_FORMAT_V0 §14.2 的纯 additive seam，且不能替代 WEC/Svc 接收权威 |
| c. WEC V5 + PPR V2 两个完整 SUPERSEDE | **推荐并已起草** | 各自携完整有效正文/Acceptance，只列直接 current predecessor，显式承接 RTH 六合同；控制/恢复范围各自可审、共同配对 gate；不从已退休的 WEC3/WAE3/Liveness1 再分叉 |
| d. 一个同时 whole-supersede WEC4/PPR1 的完整合并后继 | 合法备选，未采用 | 必须同样完整携带双方所有有效义务与互斥退休；本次两份文件已覆盖，不为减少文件数引入更大合并权威 |

提案文件：

- [WEC V5](docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V5.md)：完整 WEC4 body，10 inherited +
  3 new Contracts；新增系统分支、责任投影/非 resume、配对与兼容门。
- [PPR V2](docs/specs/AGENT_CORE_WORKFLOW_PRE_ADMISSION_RECOVERY_V2.md)：完整 PPR1 body，
  内含完整 WAE/Liveness；27 inherited + 原 RTH 6 + 1 窄例外/不扩准入 gate，合计34 Contracts。
- RTH1 保留 accepted/none，不将其旧 stable ID 改为 contracts，不退休 RBAH/SRE 或其他独立权威。
  当前不改 index/current pointers 或任何 predecessor frontmatter/backlink。

两份 proposed 元数据都为 none，符合零实施权要求。未来接受必须显式转 contracts；如果仍以
none 接受，**不能声称目标实施闸门已关闭**。只有正式接受并进入各 base 的新 Contract 才赋实施权。

## 3. WEC/WAE/Liveness 整权继任核对

以下所有 Core 行号固定在 `BASE_HEAD`，并非新文件偏移。

| Accepted coordinate | 已覆盖 / 当前限制 | 本提案处置 |
|---|---|---|
| RTH1 §3.1:103–125；CTR-RTH-001..006:206–353 | 已接受独立 reason、历史关系、discrepancy-only、闭合 DTO、幂等/失败保责语义；implementation none | 六 Contracts 逐字携入 PPR2 §9.2，保留 source 全局 ID；激活由本 whole successors 与 Svc 配对，而非 NEW 引用 |
| WEC4 CTR-WEC1-005:377–394 | 两旧到限 reason、真实系统入口、精确 Owner Principal、wfassist/inter_agent、admission 后留事实、失败再试 | whole WEC5 增独立 RTH reason 分支，旧 trigger/权限/DTO 不松动；不冒称到限或 assignee |
| WEC4 CTR-WEC1-002:326–348、007:406–427 | 原执行/Owner attention/Forum 投影 | 完整携带；RTH 附属责任投影不替换 UNKNOWN/terminal/SETTLED 或归因 |
| WEC4 CTR-WEC1-008:429–545 | ACTIVE/current、两 ingress/两 policy reason、known delivery、positive settled、baseline、事件序列、单代 permit/restart | 全部 RETAIN；RTH receipt/reason/resolve 均不能成为 resume/admission permit，不扩旧 evidence DTO |
| WEC4 CTR-WEC4-010:552–660 | 仅两类 collection 锁外、重获原锁/重放/终检；实际双 writer 门 | 全部 RETAIN；不授 RTH/PPR 恢复 gate 新解锁例外，不以本次文审证明性能 |
| PPR1 §2:68–83、§8:217–231、CTR-PPR-004:307–324 | 已有完整恢复权威，但明示 terminal 后无新 append/reason/closure | whole PPR2 仅增加 RTH handoff-only append；closure/recovery/re-refuse 继续禁止 |
| PPR1 附录 A CTR-WAE-005:813–833、012:996–1057；附录 B §8:1439–1451、CTR-EKRWAE-003:1481–1496 | 唯一 append-only ledger/WAL；terminal 例外只 B1/B4 | PPR2 明列 B2 RTH 元数据窄例外，原事件/tuple/UNKNOWN/fsync/锁/CAS 保留；不套用历史 partial-supersession 例外 |
| CTR-WAE-013 E3/E5:1083/1085；CTR-EKRWAE-004/005:1498–1536 | terminal recover no-op、blocked first-admission 原 gate、合法 world-drift refusal、terminal 前 cadence | RETAIN；RTH 是原 refused 责任消费分支，不改 recoverAttempt 成写入口、不重复 refusal、不重新 delivery |
| CTR-EKRWAE-007:1556–1565、CTR-PPR-004:307–324 | 合法接收、后续消费者、答复验证、再触发，失败保责 | 义务已覆盖，**不等于新入口/新 metadata 权限已覆盖**；本后继补具体可实施协议并保持所有失败条件 |
| CTR-WAE-007/008:863–884；CTR-PPR-002:259–270 | 普通 Assistance 为 target 自身 Principal、immutable assignee；真实系统 requester 与接收方分列 | RETAIN；system actor 不冒充 assignee，不授 OBO/run-as/Grant |
| CTR-PPR-001..003/005/006:245–368 | 初始 ordinary generation=1 planned 闭包/正面零投递证明/原 WAL、原 identity；#644 边界 | RETAIN；不扩后继代/Owner/stale/legacy；不换 plannedRecoveryProof V1 tag、不填候选 revision 或补造 writer 证明 |
| D-009 §8.4/8.5:574–600；CTR-EKRWAE-001:1455–1467 | 业务结果/termination-only/无证据三分，UNKNOWN 和 at-most-once | RETAIN；零 business/termination settlement、Router/Scheduler fence/occurrence/nextRun 写 |
| D-008 §11:353–380、§22 security:636–651；Architecture §3/4 | Owner 自己 Principal/Workspace/canonical main、外部 Svc 业务所有权、Broker 真实身份 | RETAIN；Owner 例外处置者不等于原 workflow executor；Core 不替 Svc 自造历史关系 |

**最少所需整权继任：WEC4→WEC5；PPR1→PPR2。** WAE3/Liveness1 已整体退休于 PPR1，
不再对其直接新建 active successor。当前既有 source scopes 及验收均完整 carry；不需要单独
重开已接受的 blocked 修复。来源阶段 lifecycle/旧前驱退休测试不机械重演，当前生命周期由新
ACC-WEC5-001/ACC-PPR2-001 与 §12 检查；原产品安全负控/持久/双 writer 要求保持。

## 4. Svc 配套合同清单与状态

坐标为 Svc `b5096782f666ad22aa3508fdbf9562278a977c0f`，不是运行时状态。
详情与固定链接见 [Svc readback](docs/reports/rth-core-successor/svc-authority-readback.md)。

| Svc obligation / RTH mapping | 现有 accepted authority | 配对要求 / 当前状态 |
|---|---|---|
| 系统接收、鉴权、historical/closed/discrepancy-only；RTH002/004 | WEC V3 CTR-SWEC-004:365–395 | **需 WEC whole successor**：新 reason 单独分支，真实 system scope/direct token/binding、原 tuple/来源/历史关系、两种 assignee 值及原 Domain 当前 enabled Owner；现只有两旧 reason + CURRENT/nonterminal，不覆盖 |
| 原子命令/幂等收据与同意图读回；RTH004/005 | CTR-SWEC-004:376–395；既有 Product/Storage command receipt 原则 | 现有 open case escalated:false 不能充同意图成功；需封闭 request/response、同 key/body/冲突、request sequence/receipt/关系可读回；新 DTO/查询权威 REQUIRED |
| 真正接收者、同请求 delivery/correlation；RTH002/005 | CTR-SWEC-009:514–601 既有 Owner wake/身份/outbox 骨架 | 保留旧身份/credential/scope 与 retry，不等于 RTH consumer 注册；需历史 Domain→当前 Owner、Owner 变更的合法再接收及 exact admission；2xx/ACK 不能移交 |
| Owner inbox/detail/后续消费者；RTH004/005 | Owner Obligation Workflows V3 §5:348–354 | 当前 Owner inbox 投影不能证明 historical RTH 可处理；需明列可发现/可读/持续消费与失败监测，不自造第二平台 |
| 历史 case resolve/escalate 与持久答复验证；RTH005 | 原 request/resolution provenance；Owner Workflows V3 §5/7/8 | 当前 action 仍有 current visit 门（源码观察见 readback）；需 reason-specific 合法历史 action、真实 resolver/角色、request<resolution<=readVersion 及同 case/key/tuple；仅开放 create 不足 |
| resume/admission 拒绝新 reason；RTH006 | WEC V3 CTR-SWEC-010:603–701 | **完整 RETAIN** 两 reason/ACTIVE/current/baseline/settled；不得把该 active DTO 改作历史 receipt/reply；新 reason/resolve 不授恢复 |
| managed Owner policy/retirement 交互；RTH005消费者 | Owner Workflows V3 §2–3:251–305、§8:402 | request-time pinned opt-in、suppression naked chat、source cancel/archive/VOID retirement 保留。RTH historical 消费如何共存须 Svc 明定，不能以直接 wake 绕过；若需变已接受含义，应整权继任 owning Spec |

本次查索引/文件/PR 未发现 RTH 配套已接受合同，**新 successor ID / accepted reviewed HEAD /
main SHA = REQUIRED / UNKNOWN**。这不是证明任意私有分支都不存在。Core 无权宣告 Svc 接受；
是否还需 Product/Owner Workflows 等整权继任，由 Svc 针对实际意义变化判定，不能先假定无需。

## 5. 实施闸门矩阵与 #644/PPR 边界

“可实施”仅指未来合法新任务的 source 实施，不含启用/发布/生产/业务完成。本任务所有源码面为 NO。

| Surface | 当前 proposed | 仅 Core 双 successor 正式 accepted/contracts 入 base | Core + Svc 必要配套 accepted 入各 base 后 | 仍须保留的门 |
|---|---|---|---|---|
| #644 原 blocked B2、拒绝前 cadence/terminal 只读消费者 | 现有 accepted 范围不变；本任务不实施 | 可独立 REUSE，不能重做当新交付 | 同左 | 原 gate/顺序/WAL/审计/失败消费者/UNKNOWN/default OFF；原生产/业务状态 UNKNOWN |
| PPR 初始 ordinary planned generation=1 | PPR1 accepted/contracts 权限不因新 proposed 取消 | 由完整 PPR2 保持，可独立 REUSE；不得声称已有源码交付 | 同左，非 RTH reason | 原 writer/WAL proof、原 baseline、正面零投递/工具不存在、fresh gate、隔离双 writer 与持久验收；旧缺证继续拒绝 |
| RTH 原 ledger intent/receipt/reply/retrigger 窄追加 | NO | **NO**（RTH 配对未全，不能先造假 intent/收据） | 可在新 REUSE 任务内实现 | 原 cadence/provenance、terminal 元数据白名单、fsync/锁/CAS/幂等/旧代隔离；失败保责 |
| 新 system reason/historical case 创建 | NO | **NO**（不能解除 Svc 限制） | 可按已接受配对实现 | 封闭 DTO、真实 system actor、历史关系/严格 discrepancy-only、current enabled Owner；服务/消费者资格先证 |
| 同请求接收、Owner inbox/action/reply/monitor 链 | NO | **NO** | 可实现对应配对面；实际闭环另验收 | 同意图收据→真实接收→consumer→合法持久 reply→durable retrigger；缺一保原自动责任 |
| HANDED_OFF 投影 | NO | NO | 只在全链可核对时可实现投影 | 不等 SETTLED/业务完成，移交后监测继续；ACK/caseId/函数存在不算 |
| RTH receipt/resolve 导出 resume/新 generation | 禁止 | 禁止 | **仍禁止** | 原 WEC Owner-resume 专属 DTO/两 reason/ACTIVE/current/known settled/baseline/单 permit 保留 |
| #650 a/b 自动 closure、无 cadence/proof 补造、#643 aging、#1379 传输实现 | 范围外 | 范围外 | **仍范围外** | 各自独立接受/任务，不借本协议夹带 |
| UNKNOWN replay/业务或 termination 结算、fence/occurrence/nextRun 改写、run-as/Grant | 禁止 | 禁止 | **仍禁止** | 各自既有安全权威/明确授权；RTH 不提供任何此类许可 |
| producer 开启、生产 apply、业务与无人值守验收 | NO/NOT_RUN | NO | 仍需实际兼容/实现验收和独立合法 operation/release 门 | 本提案 production none；真实 source→loaded/caller/control/单窗/回滚/读回与业务 witness 不由文档替代 |

#644 fresh GitHub readback：merged，merge=`4f7df01bcf087075c114901a96a7a54573110f61`，
head=`8f68a94668764f957043640fa1eb23740a760a29`；为本基线祖先。#1377 评论
[6701777981](https://github.com/mayf3/agent-control/issues/1377#issuecomment-6701777981)
拆分 blocked 已交付与 ordinary planned 当时未交付。之后 PPR 接受只补**权威**，不能改称源码/
运行交付已发生；本轮不复验/覆盖旧 receipt，RTH 只承接 refusal 后责任链。

## 6. 开放问题、下一合法触发与停止边界

| Item / owner | 当前状态、最小关闭与下一触发 |
|---|---|
| Core exact candidate 接受 / Owner mayf3 | 本次交 proposed；待独立精确 head 审查，再由 Owner 另事务 accepted/contracts 与整权互斥退休、current carrier 更新；不重问已决定语义，不本轮接受 |
| Svc 整权配套 / Svc 有权维护者与 Owner | REQUIRED/UNKNOWN；最小补齐上表接收/读回/历史 action/consumer 及 policy 交互，独审/接受/main 绑定后再开 RTH 实施 RE_PREFLIGHT |
| Owner 变化/旧请求再接收 / Svc paired author | 固定原 body/key 不能默改 recipient 或换 key 规避；须 paired 合同明确合法再接收链，缺证保持监测/PENDING/next-check |
| 实际能力/兼容/安装 / 未来实现与独立 verifier | UNKNOWN；正式隔离持久正负矩阵、真实重启、跨版本 reader/service/consumer 与源到装载资格；不把函数名当注册事实 |
| 运行/生产/业务/无人值守 / 既有合法责任链 | 本轮 NOT_RUN；独立 release/operation/业务 witness 门；原 UNKNOWN 不关闭、不写百分比 |

无已发现的、超出本次明确提出差量之外的 authority conflict。新 delta 未接受是实施 gate，
不阻止已获授权的 docs-only 起草。若独审或必要检查失败，按用户停止条件追加原
STOPPED-1377-MINIMPL.md 并停依赖交付，不自行修复后冒称一轮通过。

## 7. 来源哈希、校验与交付状态

所有 source hashes 均为实际文件字节，非 historical reviewed semantic hash。

| Source @ BASE_HEAD | Whole-file SHA256 | frontmatter 后 body SHA256 |
|---|---|---|
| WEC4 | `194c97c1b0f05cef4615d1a2e93e0a8e260c5fbb32df45eecb82f54201867bc3` | `e4bebaa6188bf8a65a8e5d14f1727580c603c1750573ae60ad744febed5249aa` |
| PPR1 | `2d5afac9e627c1d3288a8b3e4218baf5987df5484dad8961de9eb0fadf2f171f` | `babb74a2bef6cdbc31deac52f54b5bb82015e9a4c81c0e15116ab658d4dc8c1b` |
| RTH1 | `ddef9c63c4b4084043ec308a111f4b287c28ca6bded7e2cabc9f72a7e7cf7052` | `f4789d92b89788b50dfd7f03e945d6c91c55b9b6f9ce77cd5fd1c08bbc71cfea` |

已执行文档检查（均 rc0）：

- `git diff --cached --check`；5 个新增 Markdown 文件，零 existing authority/产品路径修改。
- `python3 .agents/tools/verify_governance.py --target . --require-accepted`：vendored bytes/accepted lock 一致。
- Python `yaml.safe_load` + `jsonschema.validate`（仓内 spec-frontmatter schema）：两份 proposed/none，
  13 个外层必需章节、整份 supersedes intent、null backlink；unique Contract headings=13/34。
- 抽取 `BEGIN COMPLETE WEC4/PPR1 SOURCE` markers，与 `git show BASE_HEAD:<source>` 去 frontmatter
  后字节直接比较：PASS；PPR2 内 RTH Contracts/Acceptance marker 内容与 RTH1 对应整节逐字比较：PASS。
- 以 WEC4/PPR1/RTH1 及递归 whole supersedes/backlinks 闭包 10 份 frontmatter 作 base，添加两份
  proposed metadata 后调用仓内 `validate_spec_transition.validate_transition`：空 error 列表，未退休任何前驱。
- authored 区域 local file links 均存在（旧 source appendix links 不重新认证）；fresh main 对相关 authority
  路径 diff 为空。静态检查不声称能够自动判断语义/跨仓能力或独立验收。

| 本候选或携入节 | 实测 SHA256 |
|---|---|
| WEC5 | `68b4d5de54810b47a515f80208b423cbb92f07242ab6acf4439e66d26b04ee11` |
| PPR2 | `85675e5cc6089e689580eef7f51d6e03663d3eb864a634d974e44f79f4001193` |
| RTH Contracts carried section | `f218ea4cae3d712077dc092c7be16d61c99eca7aa838cc2e35ff57d17171506f` |
| RTH Acceptance carried section | `d01565645c56de608f1ab47ccd9c9f2800e92fdfbf3504f12b4717b2e4c46d68` |
| Svc readback evidence | `f50d641930d6f434918cc1a2a63964ebc71176141bc3a019521f21b1018842c1` |

独立审查/commit/push/PR 状态将在实际发生后追加；不预报 PASS。
产品测试、安装、运行、生产与业务验收均 NOT_RUN（docs-only），没有产品源码或生产写入。
