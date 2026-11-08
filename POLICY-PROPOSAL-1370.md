# #1370 路由配置代政策提案交付记录

## 授权、坐标与停点

Owner 要求按根目录 `BRIEF-1370-POLICY-AUTHOR.md` 起草最小差量，授权 docs-first 文档
commit→push→PR(base main)，不合并、不实施、不改产品代码/测试、不写生产；失败即停并写
`STOPPED-1370-POLICY.md`。本记录不作政策接受或产品完成声明。

| 项目 | 绑定 |
| --- | --- |
| Repository / worktree | mayf3/dsh-agent-core / `/Users/yanfenma/workspace/project/worktrees/h1370-policy` |
| Branch / exact parent | `docs/routing-generation-policy` / `45d008a5e4df2c8a44f83fe5d4dca150d2772c7f` |
| main 初始核对 | 远端 main 与 parent 一致；PR #667 已合入，#668 登记修复已合入 |
| Brief SHA-256 | `d4fe36e47330882cf81b429ff462c2254bfdb8c60332e8b43914de5d021e7483`；原文件保留，不纳入提案差量 |
| 上位分析输入 | main 的 SEMANTIC-VERIFY-1370.md，SHA-256 `7fe9507d161ca0cc1020f6867e3cb7a56cf259cdd48cf6162a3009a9cdd3b0f6`，PR #667 |
| 输出 | [AGENT_CORE_ROUTING_CONFIG_GENERATION_POLICY_V1](docs/specs/AGENT_CORE_ROUTING_CONFIG_GENERATION_POLICY_V1.md) 与本报告；仅新增文档 |
| 当前阶段 | AUTHOR 提案交付；PR #669 open / 未合并，政策仍 proposed/none |

GOAL_OR_TARGET：关闭 SEMANTIC-VERIFY §6 的五要素，提供受托路由维护者可审查/接受的
最小政策提案。CURRENT_GAP：现有 accepted inventory 未决定失败候选后的可信旧代消费
资格。EVIDENCE_NEEDED：main 固定权威、Issue 正文、静态调用链、逐条关系和负向验收。
DONE_WHEN：提案和报告完成、commit/push、base main 的 PR 保持未合并。
EXPANSION_TRIGGER：所依赖权威冲突、必须证据不可得或交付检查失败则停止并写指定
STOPPED；产品实施、接受事务、WEC/Svc 整理和生产动作不扩入本轮。

## 路由判定

`NEW / BRIEF / DURABLE / AUTHORITY_AUTHORING`，本任务明确 docs-first。

新增的是配置代发布/激活及候选失败后旧可信代的封闭继续政策。AMEND 不适用，因为
这个新选择并非 Fleet credential topology 或 Default default-routing 已接受 Decision
的必然细化。SUPERSEDE 当前不适用，因为下列已接受条款含义与通过集合保持：

| 既有条款 | 实际差量 / 保持依据 |
| --- | --- |
| Fleet V3 CTR-SCA-003/012 schema 与 unknown/duplicate/cycle rejection | 候选 C 仍整代失败，绝不局部接纳；运行值只能来自已完整验证的 G0。没有让 C 通过 |
| Fleet V3 CTR-SCA-004 startup/child/reuse 身份门 | G0 继续也必须当前通过；无凭据/插件/产物身份降级 |
| Fleet V3 CTR-SCA-012 execution/fallback/STOP/snapshot | 原规则保持，代选择不新增 hop、不重放 |
| Default V1 §3 explicit-wins / closed priority | A 自身无效/修改/删除均拒绝；只允许目标完整输入闭包完全相同才继续 G0 |
| Default V1 §4 原任务 non-goal | 不改写历史任务范围，不删 loader 校验；另立发布/消费政策面 |
| GPT6 V1 CTR-G6R-001–006 / ACC-G6R-005 | 所有 tuple/effort/artifact/非法字段拒绝保持，非法字段不属本继续类别 |
| D-008 / Process V4 / D-009 UNKNOWN | 不改 Agent/Workspace/Session/Principal；配置恢复不推断终止、不解除 fence、不重放 |

完整条款关系及固定行坐标见提案 §3。核心反例仍为 G1 中 A→r1/B→missing：既不能
消费 G1 的 r1，也不能用 G0 的 r0 掩盖新显式意图，必须拒绝。仅 A 未变、完整错误
集合只有无关已注册 B 的 unknown routeRef，且 G0 当前仍合格时，提案才允许消费 G0。
同 ref 的 descriptor/effort/providerEnv/artifact 变化不等于未变。解析歧义、未知
envelope、不可读、未处理变化、无可信代均拒绝。

如果正式审查发现任何已接受 rejection/failure 或 explicit-wins 含义确被改变，停止
依赖 NEW 路线并 RE_PREFLIGHT，对实际 authority 完整 SUPERSEDE。作者不预设整权继任，
也不把“NEW”名称当作无需语义裁定。未更改任何既有 accepted Spec 或 lifecycle。

## 五要素覆盖

| SEMANTIC-VERIFY §6 要素 | 提案条款 / 负向验收 |
| --- | --- |
| 1 发布与运行分离 | CTR-RCG-001/002；ACC-RCG-001/002，不消费失败候选的局部字段 |
| 2 验证与精确激活、snapshot 归因 | CTR-RCG-001/002；TOCTOU/并发/混代/chainId不足反例 |
| 3 失败政策、旧代资格/终止、无可信代 | CTR-RCG-003；ACC-RCG-003，封闭 unknown routeRef 类别、完整资格与停止边界 |
| 4 A无效/显式变更/删除/缺失及B坏A未变 | CTR-RCG-004 全表；ACC-RCG-004，完整输入闭包、closed priority、无效≠absence |
| 5 启动/后续/child/重启恢复一致与既有规则 | CTR-RCG-005/006；ACC-RCG-005/006，重启全验证、不从残留恢复旧许可、保留UNKNOWN |

六个 Contract 均有 Method/Environment/Required evidence/Expected result/Failure condition
映射；本轮只写验收定义，产品测试 NOT_RUN，runtime conformance UNKNOWN。

## 未来实施影响面及 RE_PREFLIGHT

| 代码路径（本轮只读） | 未来需要独立实施任务解决的影响 |
| --- | --- |
| `packages/production-runtime/src/model-overrides.js:274–492` | 复用整代 validator；分离 immutable captured candidate、激活代和诊断投影；保留全部校验，不能 catch-and-skip |
| `packages/production-runtime/src/compose.js:247–261` | 统一启动/发布/后续消费；替换 resolver 每次全文件建立信任；global/default上下文及失败准入状态同代绑定 |
| `packages/agent-router/src/route-chain.js:309–324` | 消费 generation-bound snapshot，区分拒绝候选/目标拒绝/合格G0；保留零尝试错误和现有 executor/STOP 边界，必要时仅扩脱敏归因 |
| child spawn/reuse、provisioning 与 restart/recovery 的实际 callers | RE_PREFLIGHT 时按真实调用链确定最小代码面；相同代/当前身份门，不复制 executor，不降低资格、不复活旧许可 |
| 对应 focused suites | 未来执行六个 ACC；验证 Default/GPT6/route-chain受影响回归，不能复用本轮文档检查冒充产品通过 |

现有 full-reload 信任入口的 disposition=MIGRATE，validator/default/executor=RETAIN；
旧拒绝和 UNKNOWN Evidence=RETAIN。无第二套长期 loader、缓存旁路或新控制服务要求。
G0 继续资格限当前 runtime；跨重启持久可信代不是本次新增需求。

实施前先核对政策 exact accepted revision 已在 base、有真实 implementation contracts、
有效新任务及当前 authority/调用链，再 RE_PREFLIGHT。当前 proposed/none 不授权实现；
若接受者拟在正式接受时改为 contracts，须先在最终候选明示并独立复核，不能把原样
none 接受当成实现权。生产仍另需 mandate，零生产写入不因 PR 变化而解除。

## 审查、接受和交付核对

起草前已有独立只读路由分析 `/root/route_audit`，结论支持上述有界 NEW，并明确它
不是精确提案 HEAD 的审查，也不是受托维护者接受。提案 §13 列出非作者独审、真实
受托接受者、reviewed/final HEAD、正式事务和 base 激活的全部前置门。

### 精确语义 HEAD 审查回执

```text
schema_version = 2
SPEC_GOVERNANCE_MODE = REVIEW
REVIEW_KIND = SPEC
SPEC_REVIEW = ACCEPT  # 独立审查建议，不是正式接受事务
REVIEW_TARGET_HEAD = cad041d84784b00cdc4dfd3685376e24e1a5ab75
BASE_HEAD = 45d008a5e4df2c8a44f83fe5d4dca150d2772c7f
CURRENT_BASE_HEAD = 45d008a5e4df2c8a44f83fe5d4dca150d2772c7f
REVIEWED_AT = 2026-11-08T03:23:38Z
REVIEWER_ID = /root/proposal_review
AUTHOR_ID = /root
AUTHOR_INDEPENDENCE = PASS
REVIEW_SCOPE = FULL
FULL_REVIEW_BASIS = INITIAL_REVIEW
AUTHORITY_REVIEW = PASS
PRIMITIVE_BOUNDARY_REVIEW = PASS
CONTRACT_REVIEW = PASS
ACCEPTANCE_COVERAGE_REVIEW = PASS
MANDATE_SCOPE_REVIEW = PASS
EVIDENCE_REVIEWABILITY = PASS
BASE_IMPACT = NONE
FROZEN_BLOCKER_UNION = []
BLOCKERS = 0
SPEC_GAPS = 0
PROPOSAL_PR_DELIVERY_READY = YES
FORMAL_ACCEPTANCE_COMPLETE = NO
IMPLEMENTATION_ALLOWED = NO
MERGE_READY = NO
OPERATION_ALLOWED = NO
```

该审查明确支持 NEW、五要素和六条 Contract 的完整性。额外非作者窄反例检查
`/root/proposal_review/counterexample_check` 对 explicit-wins/rejection 同样未发现
具体冲突。Spec SHA-256 为
`91230bafc7a72e67376c62d6734592669155dcc256b606e6fb518af9dd5c7ad1`。
本报告此后仅补交付收据，提案规范文本不变；最终 HEAD 的差量复核绑定并持久化于
同一 PR body，不通过反复修改本文自引用其自身 commit。

### 已执行的文档与范围检查

| 检查 | 结果与限制 |
| --- | --- |
| 候选 frontmatter 对 `.agents/schemas/spec-frontmatter.schema.json` | PASS，proposed/none、supersedes=[] |
| vendored `validate_spec_transition([], [candidate])` | PASS；仅 NEW 候选生命周期，不冒充全库语义审查 |
| 13 必需章节、稳定 ID、6/6 Contract→Acceptance、本地链接路径 | PASS，反向映射完整；不代表未来产品验收已执行 |
| 直接相关 governed Specs 的 accepted 状态读取 | PASS，绑定本报告 base；候选后继不当 active |
| `python3 .agents/tools/verify_governance.py --target . --require-accepted` | rc0，vendored bytes 与 accepted lock 一致 |
| `git diff --check 45d008a5e4df2c8a44f83fe5d4dca150d2772c7f...cad041d84784b00cdc4dfd3685376e24e1a5ab75` | rc0；差量仅本报告与提案两个新增文档 |
| Brief/SEMANTIC-VERIFY SHA-256 复读 | 均与上表一致；未修改原始输入、前次 STOPPED、accepted Spec、代码/测试/配置 |
| 产品/运行/生产验证 | NOT_RUN / UNKNOWN / 零生产写入；本任务不以文档检查替代运行验证 |

### Git 与 PR

- 语义提案 commit：`cad041d84784b00cdc4dfd3685376e24e1a5ab75`，parent 为本报告固定 base。
- `git push -u origin docs/routing-generation-policy` rc0，远端新分支建立成功。
- [PR #669](https://github.com/mayf3/dsh-agent-core/pull/669)，base=`main`，
  head=`docs/routing-generation-policy`；2026-11-08T03:24:08Z connector 创建回读
  `state=open / merged=false / merge_commit_sha=null`。
- 本报告交付收据作为随后独立 commit 推送同一分支；最终完整 HEAD、远端一致性和
  report-only delta 独立复核结果保存在该 PR 的交付回执。规范内容摘要保持上值。

```text
schema_version = 2
SPEC_GOVERNANCE_MODE = AUTHOR
AUTHORITY_ACTION = NEW
ROUTE_STAGE = AUTHORITY_AUTHORING
AUTHORITY_ACCEPTED_IN_BASE = NO
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = DURABLE
DOCS_FIRST_REQUIRED = YES
POLICY_STATUS = proposed
IMPLEMENTATION_AUTHORITY = none
IMPLEMENTATION_ALLOWED = NO
IMPLEMENTATION_READY_TO_MERGE = NO
OPERATION_ALLOWED = NO
FORMAL_ACCEPTANCE_COMPLETE = NO
PRODUCT_TESTS = NOT_RUN
RUNTIME_CONFORMANCE = UNKNOWN
PRODUCTION_WRITES = 0
NEXT_PRODUCT_ACTION = INDEPENDENT_REVIEW_AND_DELEGATED_FORMAL_ACCEPTANCE_THEN_RE_PREFLIGHT
```

作者不自行标 accepted，不代任何生产维护者签署接受，不合并 PR。未触发任务失败
停点，不生成虚假的 STOPPED；完成本次文档交付即停，不扩展为实施或接受任务。
