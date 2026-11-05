# RECEIPT-EXECUTION-MANDATE

结果：**DOCUMENT_DRAFT_COMPLETE / DEPENDENT_EXECUTION_STOPPED**。2026-11-06，Asia/Shanghai。交付是供 Owner 审阅的一次窗口草案，不是生产执行许可、安装回执、运行验收或业务完成证明。执行冲突已写 [STOPPED-EXECUTION-MANDATE.md](STOPPED-EXECUTION-MANDATE.md)，未静默选择权威解释。

## 1. 授权、写面和起止边界

- 来源：用户本轮“Execution Mandate 起草（Owner 裁定执行序第3节）”，原文另存为既有 `BRIEF-EXECUTION-MANDATE.md`。指定 branch `chore/fleet-window-tools`，工作树 `/private/tmp/dsh-fleet-window-tools`（`pwd` 显示 `/tmp/dsh-fleet-window-tools`，同一目录）。
- 起始 HEAD/parent：`e61458e0666bc6aa962d31561beeff1ada4a4f56`；初始相对本地 origin/chore/fleet-window-tools ahead 1。保留该已有提交，不 rebase/reset，不修改任何既有未跟踪材料。
- 本次仅新增根目录 `EXECUTION-MANDATE-W6-V1.md`、本回执及按红线要求的 `STOPPED-EXECUTION-MANDATE.md`。源码与既有窗口工具零改动。只将这三个文件加入本次提交。
- 起始未跟踪文件：`BRIEF-EXECUTION-MANDATE.md`、`BRIEF-FORK-MAP.md`、`BRIEF-WINDOW-ANARROWED.md`、`STOPPED-C7.md`、`scripts/fleet-window/PRODUCTION-FORK-BEHAVIOR-MAP-V1.md`、`scripts/fleet-window/RECEIPT-FORK-MAP.md`、`scripts/fleet-window/WINDOW-PREP-20261106.md`。不顺手提交、改写或删除。
- 唯一文档写者为 root Codex；三个并行助手分别只读 fork处置、窗口机制、冻结组合/闭包。不是向生产 Agent 派发任务，没有外部消息发送。生产唯一 writer 未指定、未签发，不生成 authority JSON。

## 2. PREFLIGHT 与直接权威

```text
SPEC_GOVERNANCE_MODE = PREFLIGHT
TARGET_REPOSITORY = mayf3/dsh-agent-core
REVIEW_TARGET_HEAD = 新文档提交（parent见上；提交后用git show复核）
BASE_HEAD = e61458e0666bc6aa962d31561beeff1ada4a4f56
CURRENT_BASE_HEAD = 起草时GitHub main实测75ece578301b014a23b987568d1eb8af96795300
GOAL_OR_TARGET = 指定冻结组合的可审阅Mandate、31处置及实测回执
CURRENT_GAP = 无闭环操作方案；存在具体执行scope/工具绑定/验收缺口
AUTHORITY_ACTION = REUSE；不改变长期Contract
PLAN_LEVEL = BRIEF（用户交办，拟窗口ExecPlan嵌入Mandate）
ASSURANCE_LEVEL = ROUTINE（仅文档）；未来窗口CONTROLLED
ROUTE_STAGE = OPERATION（文档/只读调查；没有production operation）
AUTHORITY_ACCEPTED_IN_BASE = YES（所引既有accepted authorities；不包含proposed后继）
IMPLEMENTATION_AUTHORITY = not_applicable
ATOMIC_SPEC_IMPLEMENTATION_PERMITTED = NO（不适用本次工作）
MUTATION_AUTHORIZATION = VALID（仅文档、提交与用户要求的PR）
ISOLATED_WRITE_SURFACE = YES（指定工具worktree、parent、branch）
EXECUTION_MANDATE = VALID_FOR_DRAFT_ONLY / INVALID_FOR_PRODUCTION
CONTROLLED_RUNBOOK_REQUIRED = YES_FOR_FUTURE_WINDOW（嵌入Mandate）
SPEC_GAP_DEPENDENCY = NONE_FOR_DRAFT；后继权威缺口只阻依赖执行
EVIDENCE_REVIEWABILITY = PASS_FOR_DOCUMENT（固定对象/原始receipt坐标）
LIVE_AUTHORITY_GAP = 未授予production；实际live未探测
OWNER_DECISION_REQUIRED = YES_FOR_EXECUTION
IMPLEMENTATION_ALLOWED = NO
MERGE_READY = NOT_APPLICABLE（本轮不merge）
OPERATION_ALLOWED = NO（production）；只读取证和文档交付允许
DONE_WHEN = 两份指定文档+STOP记录、新提交、gh可用则PR引#605
EXPANSION_TRIGGER = 需要源码/生产/权限/真实结算操作则停止该依赖
NEXT_REAL_ACTION = 交付Owner审阅；不进入stage_00
```

依入口读取 shared grammar/local README、Spec-governance router 和唯一选定 PREFLIGHT mode，直接核对 Product Architecture、D-008/D-009 与下列相关 governing authority。文件坐标固定于 app `75ece578301b014a23b987568d1eb8af96795300`，不以工具工作树的旧 checkout 代替。

| 文件 | Git blob（SHA-1）/ lifecycle 边界 |
|---|---|
| `docs/AGENT_CORE_PRODUCT_ARCHITECTURE_V1.md` | `f260b482564a561cf97f1b94676b048f67bd2f90`；文首冻结草案，保留其原状 |
| `docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V3.md` | `0c3f6f6005794edec2faf666e4fb035a9c87b009`；D-008 accepted |
| `docs/decisions/SCHEDULER_OCCURRENCE_OUTCOME_V3.md` | `fd4ee0df516fd1cda800e586dd05cab8bfc355eb`；D-009 accepted |
| `docs/specs/AGENT_PROCESS_LIFECYCLE_HARDENING_V4.md` | `06d735aa706c0da706d9b9f5e6e81a7406a7d4f0`；accepted/contracts，不授权production |
| `docs/specs/AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V3.md` | `ffa4defa97973b8c25240c2a4e7191dc6fee4167`；accepted/contracts，production none |
| `docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V3.md` | `f7623521fd031f661ecc74fe61cf9ec52e69ba13`；accepted/contracts，production none |
| `docs/specs/AGENT_DELIVERY_RESILIENCE_D009_ALIGNMENT_V1.md` | `00924a3a83cf0a5fa28c8a15f8c2267726071fcf`；accepted/contracts；三态/无证据零写 |
| `docs/specs/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1.md` | `af655bb5801ca5af956003c8a7fabc2b27b4b6de`；accepted/contracts，production none；不启用controller |
| `docs/specs/AGENT_CORE_WORKFLOW_RECOVERY_LIVENESS_V1.md` | `de7d22c26c9d3efc245ea1d1edc01708632b04a0`；**proposed/none**，不能因实现merge而改称accepted |

另核 Timeout V3 accepted frontmatter；Scheduler Tools V3 已 superseded，不将其当现行执行许可。本次不改任何治理/Spec lifecycle。

## 3. 冻结组合：实测命令输出

2026-11-05T23:29:56.550625Z（本地2026-11-06）两仓只读对象核查输出如下；Node随后重新核对一致。

```text
app repo: /Users/yanfenma/workspace/project/production-dsh-agent-core
app commit: 75ece578301b014a23b987568d1eb8af96795300
app tree: 7a68ac22c8eef6340131dacafe1c0f2aa5dfa0d6
source closure: 2383 entries / 269899 bytes / 0 gitlinks
ls-tree NUL bytes SHA256: 396f3e441c5ab2db47fdf54e3da1e33829bab845115019bd643dd5f276040262

harness repo: /tmp/v5-rebuild/harness-src
HEAD: 13ecda5c759263c7ce7ab93b678f862f65513f34
tree: 81a047cd4d6574614e88cffe04c5e013cc43535b
porcelain: empty
source closure: 7839 entries / 881047 bytes / 0 gitlinks
ls-tree NUL bytes SHA256: 43e6ea35a4f68449273e21855663786835e828021f3697b65da417a354e62863

Node: /private/tmp/fleet-v5-prep/scratch/node-runtime/bin/node
file: Mach-O 64-bit executable x86_64
-p: {"version":"v25.6.1","arch":"x64","platform":"darwin"}
SHA256: c6c9bfa8eb5d0c6799e1fd7e246f5c6036d4863b5d3173625f37d952576ca93b
```

可复现源码清单为 `git -C <repo> ls-tree -r --full-tree -z <full commit>` 原始字节；不要把换行版/排序后JSON摘要混作同一hash。Node没有本任务可归属的Git tree，使用二进制SHA。源码索引不是装配依赖闭包。

| 从冻结对象读取并实测 SHA-256 的输入 | SHA-256 |
|---|---|
| app `package.json` | `d57644033f2ed7458272262dedad91c1cabc86aa51bc75bcc1f35184029299cd` |
| app `pnpm-lock.yaml` | `e086823c00d7afcc3919514131721aad54a32893df1a1583c4ff08474f395baa` |
| harness `package.json` | `3ccd0eb74c9fc529b363e1404519207839c6d6bb942efce9103c1d08355ba852` |
| harness `pnpm-lock.yaml` | `3b6b86e68d13b38db4b5a402952688f8be01a2ec694cb8ae0510972b670eca95` |
| harness `pnpm-workspace.yaml` | `39d569ce64de5fcfff5db3467304d143bbc6816c03442357af854827f3718f5f` |
| app `scripts/trusted-cp-deploy-install.sh` | `99cc67c971406cd1fc287f2e50b85012bf3123e9532ff0890f925fa8f6edad8c` |
| app `scripts/lib/trusted-cp-closure-resolution-gate.mjs` | `af43b33739ba05c0b178f5a87347edd774866dc7395ca302ce2a2b962ffded88` |
| app `scripts/lib/trusted-cp-fresh-child-boot-canary.mjs` | `b737d6b42460383f305a741fb9d5f12babe9b1e292f933d3735d68a907447802` |

## 4. 既有证据读回与适用限制

| 本次只读文件 | 实测 SHA-256 / 结果 |
|---|---|
| `scripts/fleet-window/PRODUCTION-FORK-BEHAVIOR-MAP-V1.md` | `90f57e79c0113fb730f7cc0e2cfd6d755a652bec0f02ba522392455abaf6b7b9`；旧固定P/M的37项调查 |
| `scripts/fleet-window/RECEIPT-FORK-MAP.md` | `4922efbdc1ef4eceecacd4ef3164ed50b3254571620c6f6845573295c21ad2fe`；原分类6/29/2 |
| `/usr/local/v5-boot-isolation/c7-selftest-t7y8u_9h/summary.json` | `1154abead3dbb35c0689f83f41b267974bd6f853c28d9267f39f97a2b07fa1bb`；PASS_ISOLATED_CHECKS_AND_STDIO_CANARY，productionWrite=false，windowGO=false |
| 同 selftest `anarrowed-settlement.command.json` | `588bb3cc857af6123181dc6af9dd13d661387749089386124a2b69e4750018a3`；exit_code=0 |
| 同 `anarrowed-rollback.command.json` | `81d3af9e8268e5ae5bc2e5ea2c35632891724fd66a902982ed09f39c95814933`；exit_code=0 |
| 同 `anarrowed-candidate-state.command.json` | `078728ad1d78f4a2d9b905fc0d218080395c4cae40660b7f443233404ed24637`；exit_code=0 |
| `/private/tmp/fleet-v5-prep/r3/accepted-r2-inputs.sha256` | `a688975db5559e623cb804369be8ad924ce4f9d9814d632d57a60cdc2ab8b8c9`；73,779行，旧组合 |
| `/private/tmp/fleet-v5-prep/r2/canary-receipt.json` | `733efa34bf339287348a84fcae6330f3a1d44d918219e6a2b238c3357d6b0219`；旧组合 |
| `/private/tmp/fleet-v5-prep/r3/attempt-02/runtime-boot-receipt.json` | `17601d3bd8a12e358a6e505794f80b08e7f4a362f358ca614eeedf22b28ce589`；sourceHead=ce1d13c1，empty fixture |
| `/usr/local/v5-boot-isolation/RECEIPT-C5-FINAL.md` | `ee96f779119c9e1f986ee582224c7bd9c06b6f8e193f647559cb0e8766f7a024`；C5r11仍ce1d，历史cold-session未执行 |
| `/tmp/v5-rebuild/c5r7-receipt/assembled-root-final.manifest.jsonl` | `c08793e825f8a8f80b7c4ed178bc0d9fc35f1bfb58649caae0e33ae16181775c`；旧装配闭包，不是75ece组合 |

PR #628已实测 MERGED；head `bf7942002ef7bfb578cb2968b2b659f1fa5009a6`，merge `75ece578301b014a23b987568d1eb8af96795300`。oracle精化、65负向反例、旧reader边界均引用其冻结 `RECEIPT-WINDOW-ANARROWED-R2.md`，不重跑 unchanged gates。新 tuple 的 I01..05 均未执行，既有PASS不得迁成新组合PASS。当前scratch pack provenance仍为旧ce1d13c1。

## 5. 实际动作与查询族

执行了：只读Git对象/tree/patch/ancestry、精确文件路径/符号检索、文件hash、Node版本架构查询、gh issue/PR/branch元数据读取，随后只用apply_patch写三个文档。未执行 npm/pnpm/build/assembly/测试suite、canary/full-runtime、sudo/launchctl、生产HTTP/RPC、health探测、store读取/结算、replay、fence或权限操作。

```sh
git status --short --branch
git rev-parse HEAD --show-toplevel
git -C <object-repo> show <fixed-sha>:<path>
git -C <object-repo> ls-tree -r --full-tree -z <fixed-sha>
git -C <object-repo> diff --name-only <old-M> <app>
git -C <object-repo> merge-base --is-ancestor e61458e0666bc6aa962d31561beeff1ada4a4f56 75ece578301b014a23b987568d1eb8af96795300
rg -n '<specific-symbol>' <specific-source>
shasum -a 256 <named-evidence-file>
file <scratch-node>
<scratch-node> -p 'JSON.stringify({version:process.version,arch:process.arch,platform:process.platform})'
gh issue view 605 --repo mayf3/dsh-agent-core --json number,title,state,url,body,comments
gh pr view 628 --repo mayf3/dsh-agent-core --json number,state,url,mergeCommit,headRefOid
gh api repos/mayf3/dsh-agent-core/branches/main --jq '.commit.sha'
```

负向探索结果如实处理：工具仓本地无75ece对象（git rc128），转已指定只读生产对象仓取得；#605是Issue，首次pr view无匹配，已用issue view读回；不存在的猜测Spec路径以ls-tree校正；SOP文件限定搜索未找到，保持UNKNOWN。它们不是必要对象永远缺失，也不冒充成功查询。main API起草时为75ece，但冻结不依赖main随后移动。未fetch/checkout生产仓，未读取受保护业务内容。

## 6. 处置、复核及交付检查

- Mandate覆盖用户10项要求；31个ID唯一连续。其中2项a为冻结A既有路径承接，29项b为延后独立PR，执行前门逐项标出。原29提交→31行为单元拆分公开，请Owner确认，没有编造31个原提交。
- 五个STOP分类/坐标/最小解除与受影响NO边界保留于Mandate §10；不因未知状态任意扩大范围，不以本文件自授生产权限。
- 独立只读审阅发现并修正两点：settlement跨rename失败须writes=UNKNOWN，不能一概零发布；RD实际为run-UTC.unique，window_id通过authority绑定。另补明verify现成硬要求50/19，新隔离基线变化仍STOP，不由本文放宽。审阅者未作者/改文件。
- 已执行文档机械检查，rc=0：31个ID唯一连续（2a/29b）、10节、冻结SHA/tree/Node/hash、完整阶段顺序、I05/U11/S05与禁止当前执行字段齐全；三个文件均有末尾换行、无CR。检查时原有tracked/index diff均为空。提交前另做staged文件allowlist和空白检查。
- 独立fork处置复核通过（仅其审阅范围）：31来源/拆分/2a责任承接/29b缺口与回执边界无必改项。按建议补K26 legacy wire直接生成器坐标，不运行该helper。
- 本回执不嵌自身hash或未来提交hash。提交后最终HEAD/tree、三文件blob/hash可用 `git show --stat HEAD`、`git rev-parse 'HEAD^{tree}'`、`shasum -a 256 <三文件>` 独立取得；避免自引用hash。

外部交付按用户授权：gh可用，创建引用 [#605](https://github.com/mayf3/dsh-agent-core/issues/605) 的文档PR，不merge。PR/commit最终坐标在交付消息提供，文件内容以该提交读回为准。若push/PR失败则停止重试、保留已提交文档和本STOP证据；不动任何生产面。
