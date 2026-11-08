# STOPPED-GOV-ALIGN — 2026-11-08

本任务按 BRIEF-GOV-ALIGN-20261108.md 的“失败即停”停止，未完成治理记录对齐。
仅本停止记录写入工作区；不继续修复、commit、push、创建 PR 或合并。

## 坐标与边界

- UTC: `2026-11-08T02:56:24.511282+00:00`
- Worktree: `/Users/yanfenma/workspace/project/worktrees/h-gov-align`
- Branch: `docs/gov-record-alignment-20261108`
- Base: `1d5bda0d6301995806f33d0d15e46673acfb4c13`
- Current HEAD: `1d5bda0d6301995806f33d0d15e46673acfb4c13`

Owner 授权链只读核验通过：`owner-20261108-three-unified` items[1]；整条 ruling
canonical SHA256 `00f1fb2995d5f83a3bb9f50f442754fadb13f46274c2f1cbafd5f90253d5b218`，
与两份 successor frontmatter 一致。本次停止原因是执行定位检查失败，不是重新请求接受决策。
PR #664 merge `e8d6d333743f812945d47b96ace61b817f35f9cf`、PR #658 merge
`b6ddc2a67ba041b8b13ed33d331104cf809d4985` 已通过 GitHub 只读查询核实。

## 失败原文

阶段：编辑准备脚本；exit code 1。

```text
Traceback (most recent call last):
  File "<stdin>", line 23, in <module>
  File "<stdin>", line 12, in edit
AssertionError: ('docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V4.md', 'supersedes:\n  - AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V3\nsuperseded_by: null\n', 2)
```

执行者的替换锚点按全文件计数，待删字段组合在 frontmatter 和历史附录中共出现两次，
未满足唯一匹配断言。脚本先在内存准备全部变更，最后才统一写文件；异常在写文件循环前发生。
异常处理仅生成本 STOPPED 文件。没有对目标文件落盘，也没有修复依赖或扩大范围。

## 停止后只读回查原文

```text
## docs/gov-record-alignment-20261108...origin/main
?? BRIEF-GOV-ALIGN-20261108.md
?? STOPPED-GOV-ALIGN.md
git diff --check: rc=0
stdout=''
stderr=''
UNCHANGED docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V5.md sha256=6188f2599593722f11545266c4d21728a286622fa522598965cc76742bcfd883
UNCHANGED docs/specs/AGENT_CORE_WORKFLOW_PRE_ADMISSION_RECOVERY_V2.md sha256=2c598a053a42c039ce79a9649b95f7c11994452e3ee35b4b697c032e7f71c38d
UNCHANGED docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V4.md sha256=537aab98ccbce7fc10744f967d6994712b7f7b209625042474d55ba26c4e0d2b
UNCHANGED docs/specs/AGENT_CORE_WORKFLOW_PRE_ADMISSION_RECOVERY_V1.md sha256=2d5afac9e627c1d3288a8b3e4218baf5987df5484dad8961de9eb0fadf2f171f
UNCHANGED docs/specs/AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V3.md sha256=2e735f3ca1c8b2b0fcde1ae4892d524a158a470d42f00b52b550d39ca55083c1
UNCHANGED docs/specs/AGENT_CORE_WORKFLOW_RECOVERY_LIVENESS_V1.md sha256=135e3c4247225992c6717ea7b177f9252d719e394286c23da618b143ffb1efd9
UNCHANGED docs/specs/AGENT_CORE_REFUSAL_TERMINAL_HANDOFF_V1.md sha256=ddef9c63c4b4084043ec308a111f4b287c28ca6bded7e2cabc9f72a7e7cf7052
UNCHANGED docs/specs/README.md sha256=de3900ec7121a8e5831a74a17acabc7d6b484e43829926f32cf2c562e9b5cad8
```

8 个目标文件均与 base 逐字节相同。RTH V1 的 frontmatter/权限字段、全部 Spec §1 以下正文、
全部 acceptance_authority* 字段均未变。生产写入为零。
`git diff --check` rc0 只证明空 tracked diff 无空白错误，不构成对齐完成证据。
改后重复键扫描、YAML 解析、index 一致性验证和最终候选独立复核均为 NOT_RUN。
未生成成功交付的 ALIGNMENT-REPORT-20261108.md；无新 commit、push、PR 或 merge。

## 后续最小动作与停止边界

责任主体为本执行 agent。重新执行时的最小技术修正是将编辑锚点限定在首个 YAML
frontmatter 内，完整保留历史附录；这不是依赖修复或新接受决策。
因本简报要求失败即停，本轮不执行该修正。后续续办仍须保持原 docs-only 范围、
RTH none、§1 以下字节不变及直接/传递退休链，完成全部验证、报告、commit、push 和 base main PR，
不合并、不生产写入。
