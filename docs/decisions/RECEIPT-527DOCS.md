# RECEIPT-527DOCS — #527 D1/D2 docs-first delivery

记录日期：2026-11-04。此文件为交付回执，不是 Product Authority 或接受记录。

## Mandate and exact coordinates

- Repository：`mayf3/dsh-agent-core`。
- 唯一写 worktree：`/private/tmp/dsh-527-authority`。
- Branch：`ac-527-authority-docs`。
- 固定 base：`f767e8d6608cdb0917aad2d471ba0454d0966a0f`。
- 两份文档的 reviewed semantic HEAD：`159938d7c84c9d429ee197cc784a8e132948f337`。
- 本回执是该 semantic HEAD 之后的 receipt-only 增量；最终 delivery HEAD 由 PR 的远端 ref 和随后 PR body 的 final-head readback 绑定，避免回执自引用哈希。
- PR：[mayf3/dsh-agent-core#610](https://github.com/mayf3/dsh-agent-core/pull/610)，base `main`，head `ac-527-authority-docs`；创建时 `OPEN / merged=false`，创建时 base 仍为指定 base。
- 授权：用户本次合同式交办；原始文本保留在本工作位既有 `BRIEF-527-DOCS.md`，未修改、未纳入提交。
- `BRIEF-527-DOCS.md` SHA-256：`14621f0f79902dc9adb2d6f561e0e84523975378f6f196fb9c0fb477e5621849`。
- 只读停止记录：`/private/tmp/dsh-527-scheduler/STOPPED-527.md`，SHA-256 `058f4cd6964aa57cc69e5eb880a17a8a94d9fc592ccc133c9c1aa6f49de89000`。
- Owner R1：[6622745350](https://github.com/mayf3/dsh-agent-core/issues/527#issuecomment-6622745350)，作者 mayf3，`2026-11-04T04:41:56Z`。
- Owner R2：[6622874788](https://github.com/mayf3/dsh-agent-core/issues/527#issuecomment-6622874788)，作者 mayf3，`2026-11-04T04:51:28Z`。
- 通过 `gh issue view 527 --repo mayf3/dsh-agent-core --comments` 和 GitHub connector 读回 issue 与评论。当前两条 Owner 评论优先于旧正文的直接实现/blanket success 理解。

## Deliverables and stable IDs

| 新文档路径 | Stable ID | 文档 SHA-256 | 状态 |
|---|---|---|---|
| `docs/specs/SCHEDULER_PROMPT_RECEIPT_DEADLINE_V1.md` | `SCHEDULER_PROMPT_RECEIPT_DEADLINE_V1` | `6645ef08708300cedfcc54e10e1c3fe188e21b4532ca6261c9db9208bcab6a8f` | proposed / SUPERSEDE 指定条款范围 / implementation_authority=none |
| `docs/specs/AGENT_DELIVERY_RESILIENCE_D009_ALIGNMENT_V1.md` | `AGENT_DELIVERY_RESILIENCE_D009_ALIGNMENT_V1` | `517878814a88d6179d7d13f1d972b7e2c8ccd26b5be2701564c420b60f8e13e2` | proposed / corrective AMEND / implementation_authority=none |

D1 以 `supersedes_clauses` 和正文精确指向 V4 `CLAUSE-PROC-DEADLINE-CONFIG` §5.1；
frontmatter `supersedes: []` 不声称整份 V4 被替代。D1 条款范围、D2 纠偏 AMEND 均按用户明确合同与 R2
作为本次特定例外公开记录，未伪装成普通 whole-authority transition 或无语义变化的加法。
接受者必须明确接受此范围、精确内容与最终 head；schema PASS 本身不能接受例外。

## D1 conflict crosswalk — full text

| 旧条款原文与行号 | 新语义 / 保留关系 | Owner 裁定锚点 |
|---|---|---|
| V4:852–870 §5.1；861「不得由…Scheduler 动态覆盖」；866 receipt 默认 `30000` | §6 完整重述四字段，仅 Scheduler receipt 可按 Job 字段或比例默认选择；其余字段及非 Scheduler 默认保留 | [R1 D1](https://github.com/mayf3/dsh-agent-core/issues/527#issuecomment-6622745350)、[R2 D1](https://github.com/mayf3/dsh-agent-core/issues/527#issuecomment-6622874788) |
| V4:874–877 `per-Agent static override > global deployment value > code default`；880–920 env、legacy 和启动冻结 | Scheduler 的 per-job > deployment 层 > 继任默认；deployment 层内部完整保留 static > env > legacy；不修改已运行 process 配置 | [R2 优先级、兼容](https://github.com/mayf3/dsh-agent-core/issues/527#issuecomment-6622874788)；本次交办明确保留静态值 |
| V4:870「positive safe integers」「fail-loud」；920 非法配置拒绝 | 新秒字段及转换结果同样校验，禁止无效值静默降级；旧 deployment 校验保留 | [R2 校验与兼容](https://github.com/mayf3/dsh-agent-core/issues/527#issuecomment-6622874788) |
| V4:2024–2026「per-message / Scheduler dynamic timeout override…拒绝」 | 仅本文 receipt 选择是显式例外；任意消息、其他 deadline override 仍禁止 | [R2 D1 §5.1 继任范围](https://github.com/mayf3/dsh-agent-core/issues/527#issuecomment-6622874788) |
| V4:943–949 prompt receipt 同时受更早 active turn deadline 限制 | 原义保留；配置窗口不能延长 turn deadline、重置 retry deadline 或改变 UNKNOWN 处理 | [R2 继任范围、兼容](https://github.com/mayf3/dsh-agent-core/issues/527#issuecomment-6622874788) |
| V4 静态配置可运维调整；R1 指定 `DSH_AGENT_PROMPT_RECEIPT_TIMEOUT_MS=120000` 过渡缓解 | 仍是 startup-only deployment 值；生效只能走另行授权的舰队窗口，本 PR 无运行时效果 | [R1 第 2 项](https://github.com/mayf3/dsh-agent-core/issues/527#issuecomment-6622745350) |

## D2 conflict crosswalk — full text

| 旧条款原文与行号 | 新语义 / 保留关系 | Owner 裁定锚点 |
|---|---|---|
| RESILIENCE:13–22 `AMENDMENT_1`：`lateOutcome=terminated_without_outcome -> failed`；321–322「重跑安全」 | 只保留为旧接受历史；当前政策须验证 exact trusted termination，保持 `outcome_unknown`，追加 termination settlement；不自动重跑 | [R2 D2 仅终止分支](https://github.com/mayf3/dsh-agent-core/issues/527#issuecomment-6622874788) |
| RESILIENCE:35–45 references/parent_authorities 的 Timeout V1、D-007；28 的政策层描述 | 当前引用改为 `SCHEDULER_TIMEOUT_OUTCOME_V3` 与 D-009 / `SCHEDULER_OCCURRENCE_OUTCOME_V3`；CONTROL_PLANE_RELIABILITY_V1 保留 | [R2 修正废弃引用](https://github.com/mayf3/dsh-agent-core/issues/527#issuecomment-6622874788) |
| RESILIENCE:223–230 DEC-004、303–305 CTR-W3、335–337 CTR-S5、383–398 authority pass 的 D-007/Timeout V1 相容论证 | 用 D-009/Timeout V3 的 business-outcome 与 termination 分离解释；旧相容性 PASS 仅为当时记录，不能压过当前父权威 | [R2 D-009 胜出及引用修正](https://github.com/mayf3/dsh-agent-core/issues/527#issuecomment-6622874788) |
| RESILIENCE:319–320 exact success→succeeded、exact failure→failed（「下个 slot 重跑」） | 可信且 exact 的业务结果各归其态；本政策不创建 retry/replay，未来自然槽仍走原调度/准入规则 | [R2 D2 业务结果区分、无重试](https://github.com/mayf3/dsh-agent-core/issues/527#issuecomment-6622874788) |
| RESILIENCE:323–324 `terminationEvidence=child_real_exit ... -> failed` | 只有 exact、可信、适用 epoch 的终止证明才写 `terminated_without_outcome`；business state 仍 UNKNOWN，未过证明门不写 | [R2 D2 仅终止分支](https://github.com/mayf3/dsh-agent-core/issues/527#issuecomment-6622874788) |
| RESILIENCE:323–325 registry 无记录→failed；其他不动作 | registry-absent、丢失、过期、不可信或冲突证据全部保留 UNKNOWN/fence，零 authoritative reconciliation 写入 | [R2 缺失/不可信证据零写 UNKNOWN](https://github.com/mayf3/dsh-agent-core/issues/527#issuecomment-6622874788) |
| RESILIENCE:331–333 CTR-S4、371–373 ACC-S2/S3：旧 janitor 44 决策逐条一致（含 AMENDMENT_1） | 默认 OFF 保留；验收 oracle 改为本文三态映射，旧台账作为输入须按证据重分类，不能要求复制错误输出；无证据零写验收保留且覆盖 registry-absent | [R2 D-009 胜出、三态与零写](https://github.com/mayf3/dsh-agent-core/issues/527#issuecomment-6622874788) |
| D-009:48–54、574–600；watchdog:388–424 | PRESERVE：exact outcome 优先；termination-only 与 business state 正交；缺证据零写；aggregate fence 不误清另一 unknown | [R2 明确 D-009 胜出](https://github.com/mayf3/dsh-agent-core/issues/527#issuecomment-6622874788) |
| #527 原正文 blanket `exact_terminal_then_idle -> succeeded` | 该标签单独不能证明业务成功；仍须区分 exact success/failure/termination-only，无证据不得推断 | [R2 三态裁定取代原始理解](https://github.com/mayf3/dsh-agent-core/issues/527#issuecomment-6622874788) |

以上两张表由两份候选的 §5 原样提取，行号均绑定固定 base；不是根据当前行号或旧代码重推语义。

## Executed verification

| 实际检查 | 结果与边界 |
|---|---|
| `.agents/tools/verify_governance.py --target . --require-accepted` | rc=0；vendored bytes 匹配 accepted lock；不代表新候选已 accepted |
| 两份 frontmatter 对 `.agents/schemas/spec-frontmatter.schema.json` 的 JSON Schema 校验 | PASS；使用 Python yaml/jsonschema；strict ID、proposed/none 均通过 |
| `validate_spec_transition.validate_transition([], new_proposed_records)` | PASS；仅检查新增 proposed records 的元数据合法性，不是假称已验证整份 V4 supersession 或实际 acceptance transaction |
| Contract/Acceptance IDs 与本地 references | 两份各 4 CTR，D1 4 ACC、D2 5 ACC；每 CTR 有 Acceptance；所有本地 reference 存在 |
| Stable Spec ID 唯一性与冲突表 Owner 锚点 | PASS；新 ID 在 docs 中唯一；冲突表逐行带 R1/R2 链接 |
| 固定 base 到 semantic HEAD 的路径清单与 `git diff --check` | PASS；仅新增两份 docs/specs 文件，411 行；无 whitespace errors |
| 既有 V4、RESILIENCE_V1、D-009、watchdog 原文字节对比 | 四份均与固定 base byte-identical |
| Push 与远端读回 | semantic HEAD 已 push 到 origin/ac-527-authority-docs；`git ls-remote` 返回精确相同 SHA；remote main 当时仍为固定 base |
| GitHub PR 创建 | #610 创建成功；初次读回 head 为 semantic HEAD，base 为固定 base，merged=false |

检查过程加载本地 transition verifier 曾自动生成一个 `__pycache__/validate_spec_transition.cpython-314.pyc`；
已删除该次生成的唯一文件及空目录，未提交、未保留非 docs 变更。随后 Python 检查用 `-B`。

未运行 npm/pnpm、源码或行为测试、生产核证。文档中 Acceptance 是定义，不是执行结果。
未碰 `523-integration` worktree；只读输入 STOPPED 所在 worktree，无该处写入。

## Independent review — exact semantic head

Reviewer `/root/authority_audit` 未编写候选语义、未写文件、未做 Git mutation；独立只读核对 Owner 评论、
accepted 父条款、exact diff、两份候选和 SHA-256。结论为审查建议，不是 Owner acceptance。

```text
SPEC_GOVERNANCE_MODE = REVIEW
REVIEW_KIND = SPEC
REPOSITORY = mayf3/dsh-agent-core
REVIEW_TARGET_HEAD = 159938d7c84c9d429ee197cc784a8e132948f337
BASE_HEAD = f767e8d6608cdb0917aad2d471ba0454d0966a0f
CURRENT_BASE_HEAD = f767e8d6608cdb0917aad2d471ba0454d0966a0f (bounded review base; no fresh remote-main claim by reviewer)
REVIEWER_ID = /root/authority_audit
AUTHOR_ID = /root
AUTHOR_INDEPENDENCE = PASS
ASSURANCE_LEVEL = DURABLE
REVIEW_SCOPE = FULL
FULL_REVIEW_BASIS = INITIAL_REVIEW
SCOPE_REASON = initial independent review of the two #527 authority candidates
SPEC_REVIEW = ACCEPT
AUTHORITY_REVIEW = PASS
PRIMITIVE_BOUNDARY_REVIEW = PASS
CONTRACT_REVIEW = PASS
ACCEPTANCE_COVERAGE_REVIEW = PASS
MANDATE_SCOPE_REVIEW = PASS
EVIDENCE_REVIEWABILITY = PASS
BASE_IMPACT = NONE
BLOCKERS = 0
SPEC_GAPS = 0
FOLLOW_UPS = 0
TOOLING_DEBT = 0
FROZEN_BLOCKER_UNION = []
IMPLEMENTATION_ALLOWED = NO
MERGE_READY = NO (authorized acceptance transaction remains pending)
OPERATION_ALLOWED = NO
NEXT_ACTION = CONTINUE (docs-only PR delivery; no merge)
```

独立审查核实：D1 的静态层、legacy、默认公式、safe-integer 校验及 earlier-turn cap 相容；
D2 三态、UNKNOWN、aggregate fence、幂等、OFF/one-shot 控制及全部 dependent 旧 oracle 有明确处置；
两份文件的新语义可追溯 R1/R2 或保留父条款，未冒称运行/业务验收。
Reviewer 独立执行 diff --check rc=0、文件哈希和 Owner API 读回；作者的 schema/governance 检查未冒充 reviewer 独立复跑。
本回执后的 final-head delta review 另绑定最终提交和远端读回，记录于 PR body。

## UNKNOWN and remaining boundaries

| 项目 | 真实状态 / UNKNOWN 范围 |
|---|---|
| 新文档 acceptance / main activation | PENDING；本任务明确不 merge；不得把 Owner 方向批准或独审 ACCEPT 当作候选已 accepted |
| D1/D2 源码 conformance、字段真实接入及兼容 | UNKNOWN / NOT_RUN；零源码改动，待包含 accepted 文档的新 base |
| 新行为 runtime-loaded / enabled / business-verified | UNKNOWN / NOT_RUN；未检查或触碰生产 |
| 旧 44 次 janitor 操作的真实业务结果与既有受保护记录 | UNKNOWN；保留历史 OBS，不追认、不重放、不改写 |
| D4 persistent notification 合规 | UNKNOWN；按 R2 留待 D1/D2 权威就位后的独立有界核证 |
| D3 | #608 已包含于指定 base，保留不重做；本任务没有新增运行时验收声明 |
| 本 PR 的远端 CI / 分支保护与监管接受 | 不在本文声称的 PASS 范围；以 PR 实际读回和监管结论为准 |

未发生语义失败或待定语义，本次不生成 STOPPED-527DOCS.md。若后续出现具体失败，停止其依赖步骤并另记 STOPPED；
不得把没有 STOPPED 文件解释为接受或实现完成。

## Effects and handoff

本交付只新增两份 proposed 权威文档和本回执，均在 `docs/specs/` / `docs/decisions/`。
未修改 V4 稳定 ID 本体或其他 accepted 原文；无代码、schema 实现、配置、依赖、store、生产、
launchd/restart、merge、UNKNOWN replay 或 fence clearing。原 BRIEF 保留。

下一真实动作归监管/获授权接受者：核验 exact PR head、两份语义哈希及本次明确范围例外，
完成 Owner acceptance/main merge。之后另行从新 base 开展 D1/D2/D4；本回执不自行授予该权限。
