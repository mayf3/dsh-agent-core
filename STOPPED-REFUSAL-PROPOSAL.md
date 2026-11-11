# STOPPED-REFUSAL-PROPOSAL

RESULT = STOPPED_BEFORE_COMMIT_PUSH_PR

停止记录：2026-11-07T13:03:20Z；工作面 `/private/tmp/h-refusal-proposal`。
执行依据为 [BRIEF-REFUSAL-PROPOSAL.md](BRIEF-REFUSAL-PROPOSAL.md) 的明确停止条件：
“失败即停写STOPPED-REFUSAL-PROPOSAL.md”。本次必需文档检查器 rc=1，立即停止其后的
语义修改、收据完成、commit、push 和 PR；没有修复检查器后自行重跑。

## Exact coordinates and effects

```text
BRANCH = docs/refusal-terminal-proposal (local only)
BASE_HEAD = HEAD = 2d8ce9d0af6a1ffcb3c8d3bdd9364635e9ae8648
CURRENT_BASE_HEAD = 24974c720d634b965943e08bfd0862657b9be0e1
REMOTE_READBACK_AT = 2026-11-07T13:03:20Z
REMOTE_PROPOSAL_BRANCH = ABSENT (git ls-remote rc0; no matching ref)
NEW_COMMITS = 0
STAGED_FILES = 0
PUSH = NOT_RUN
PR = NOT_CREATED
INDEPENDENT_REVIEW = NOT_COMPLETED (interrupted at stop)
IMPLEMENTATION_ALLOWED = NO
READY_TO_MARK_ACCEPTED = NO
MERGE_READY = NO
OPERATION_ALLOWED = NO
```

创建了本地分支和以下未提交文档；没有产品源码、测试、配置、accepted 权威、生产或其他
worktree 写入。`git diff --stat`、`git diff --cached --stat` 输出均为空；新文件未跟踪，
因此该空输出不表示没有新文档。没有修改输入 Brief 或原 MINIMPL 停点。

| Preserved artifact | Bytes / SHA256 at stop |
|---|---|
| [Proposal](docs/specs/AGENT_CORE_REFUSAL_TERMINAL_HANDOFF_V1.md) | 30375 / `c5fe3b5da21082e417c2c78d0952ed6df2246d5e3e222316a6943152515ff212` |
| [Source provenance](docs/reports/refusal-terminal-proposal-20261107/source-provenance.json) | 4723 / `f809f59b3017474deafe39c706b1d75e3b45207daf1fdeff43af85d78b35a578` |
| Original Brief | 1831 / `eac7da6ed1b5727cd090a32de3b3394f825422d031174924c5b69fe00cba50b5` |

`RECEIPT-REFUSAL-PROPOSAL.md` 未创建；没有声称完成交付或独立审查 PASS。

## Actual failure and completed checks

执行过且 rc=0：

```text
python3 .agents/tools/verify_governance.py --target . --require-accepted
vendored governance bytes match governance.lock.json and adoption is accepted
```

随后执行一次内联 Python 文档检查器。顺序是：YAML frontmatter schema、proposed/none/NEW、
13 sections、6 Contracts/7 Acceptance definitions及反向覆盖、本地链接、7项固定 Git来源和
2项本地输入hash；然后准备新记录生命周期校验的 JSON 输入。前述 assertions 未报错，
但整个检查器未成功完成，**不能将该检查器或 lifecycle gate 标 PASS**。

失败位置是准备 candidate JSON，而非产品测试或已确认的提案语义缺陷：

```python
meta = yaml.safe_load(s.split('---', 2)[1])
# ...preceding schema/coverage/source assertions...
with tempfile.TemporaryDirectory(prefix='refusal-spec-check-') as t:
    b = Path(t) / 'base.json'
    c = Path(t) / 'candidate.json'
    b.write_text('[]')
    c.write_text(json.dumps([meta]))  # failed here
    # validate_spec_transition.py subprocess was not reached
```

原始失败输出（未重跑）：

```text
Traceback (most recent call last):
  File "<stdin>", line 20, in <module>
  ... json.dumps([meta]) ...
TypeError: Object of type date is not JSON serializable
when serializing dict item 'date'
when serializing list item 0
rc=1
```

诊断：PyYAML 把 frontmatter 的 `date: 2026-11-07` 解析为 Python `datetime.date`；
作者检查器漏了向 JSON 的日期转换。本错误不证明 frontmatter schema 或拒绝交接设计有误，
也不授权忽略用户的失败停止条件。没有启动 product/observation-cas/跨服务/生产测试。

## Preserved findings and next bounded action

Owner 裁定②原文已核对；③对 #643 提案语义的认可和 WEC/Svc 实施闸门分别记录。
候选采用 NEW 独立 proposed ID，6项约束/7项验收定义，并明确下游 Core whole successors
和 Svc 历史对象接收/幂等读回接受仍未发生。assignee discrepancy-only 是显式待 Owner/Svc
裁定的新设计，未冒称 #653 已接受该细节。当前仍不能依赖本候选实施任何行为。

STOPPED-MINIMPL 原件与 #653 固定快照哈希一致；#650 分析直接复用。来源记录保留了
精确 revisions、blob/hash、Owner选中项，不把报告或本地分支当 active Product Authority。

main 已移至 #654 diagnostic-read-separation。只读 diff 显示其改 ledger diagnostic readers、
engine候选选择和相关装配；相关 accepted LIVENESS/WEC/WAE、recovery/refusal/operation/
automatic-ledger 与 Broker Assistance 入口未变。未发现这次移动关闭上述协议缺口；该分析
不代替未完成的独立 final-head/base-impact 审查，也没有切换或重置本工作分支。

后续恢复时的最小动作：仅修复作者检查器的日期 JSON 归一化（不借此修改产品或权威语义），
重跑本次未完成的文档门，再完成独立语义审查/收据/最终坐标核验和原授权 docs发布链。
此次没有执行这些动作。原 authoring DONE_WHEN 未满足；原 #1377/MINIMPL 停点未关闭。
