# RECEIPT — REFUSAL-PROPOSAL

状态：R2 文档检查已通过；发布执行中，此版本不预填 commit/push/PR 成功。

授权为 [R2 原文与边界](docs/reports/refusal-terminal-proposal-20261107/R2-EXECUTION.md) 和
[原 Brief](BRIEF-REFUSAL-PROPOSAL.md)。工作面 `/private/tmp/h-refusal-proposal`，分支
`docs/refusal-terminal-proposal`；parent/base `2d8ce9d0af6a1ffcb3c8d3bdd9364635e9ae8648`。
[R1 停止记录](STOPPED-REFUSAL-PROPOSAL.md) 原样保留；R1 日期序列化 rc1 不改成 PASS。

[提案](docs/specs/AGENT_CORE_REFUSAL_TERMINAL_HANDOFF_V1.md) 保持 30375 bytes，
SHA256 `c5fe3b5da21082e417c2c78d0952ed6df2246d5e3e222316a6943152515ff212`；
proposed / implementation_authority none / production_apply_authority none / NEW。
本任务不接受、不合并、不实现；原 #1377 MINIMPL 停点与业务 UNKNOWN 不关闭。

## 日期修复和检查证据

原检查器在 `json.dumps([meta])` 遇到 PyYAML `datetime.date`，未进入 lifecycle 子进程。
R2 在 YAML parse 后、schema/lifecycle 校验前用
`json.loads(json.dumps(raw_fm, default=str))` 转换为 JSON 可序列化对象。
提案、前言/schema、accepted authority 和 vendored checker 未改。
完整作者检查保存在 [check_documents.py](docs/reports/refusal-terminal-proposal-20261107/check_documents.py)，
不安装为产品工具；每个门的完整 stdout/stderr、argv/时间/rc/hash 在同目录持久化。

实际执行结果（R2；非沿用 R1 的未完成检查）：

| 文档门 | 实际结果与原文 |
|---|---|
| accepted governance integrity | rc0；[完整 stdout](docs/reports/refusal-terminal-proposal-20261107/governance.stdout.txt) / [stderr](docs/reports/refusal-terminal-proposal-20261107/governance.stderr.txt) / [argv/rc/hash](docs/reports/refusal-terminal-proposal-20261107/governance.command.json) |
| 完整作者文档检查 | rc0；日期转换/schema/proposed/none/NEW、13节、6/7覆盖、7 Git/2本地来源、相对链接、docs-only/原文件保全、NEW lifecycle 均通过；[完整 stdout](docs/reports/refusal-terminal-proposal-20261107/documents.stdout.txt) / [stderr](docs/reports/refusal-terminal-proposal-20261107/documents.stderr.txt) / [argv/rc/hash](docs/reports/refusal-terminal-proposal-20261107/documents.command.json) |
| 独立检查器复核 | PASS / 0 blockers，脚本 SHA256 `fd586e0c2c0472dd3372e9b1e2c0319f33859b5de541e7c70200bdda577d6211`；[review](docs/reports/refusal-terminal-proposal-20261107/checker-review.md) |
| staged whitespace | `git diff --cached --check` rc0，stdout/stderr 均空；[argv/rc/hash](docs/reports/refusal-terminal-proposal-20261107/whitespace.command.json) / [完整 stdout](docs/reports/refusal-terminal-proposal-20261107/whitespace.stdout.txt) / [stderr](docs/reports/refusal-terminal-proposal-20261107/whitespace.stderr.txt) |

生命周期检查原文为 `Spec transition is a valid whole-authority lifecycle state`、`lifecycle rc=0`。
该输入限于本次 NEW 记录，不声称整仓历史 corpus 无债务。工具版本与 Python 路径写在完整输出中。

## 与 #643 同构和独立边界

| 六约束 | #643 aging | 本提案 refused-terminal |
|---|---|---|
| 触发 | B1/B4 等待预算到期，独立于失败数 | B2 合法 refusal terminal + 原 cadence；不要求 aging |
| Actor/资格 | 真实系统 actor / 既有 Assistance | 同机制；新增历史对象及 discrepancy-only 待接受资格，保留原 tuple |
| UNKNOWN/零重放 | 未知结果及原事件保全 | 同义务；不解除 fence、不 settlement、不重开执行 |
| 交接义务 | 幂等服务事实→接收→消费者→答复→再触发 | 同完整链，失败保原自动责任；case/ACK 不是完成 |
| DTO/兼容 | closed reason 与旧消费者 fail-closed | 独立 reason，原 resume DTO 不扩展；配套接受/兼容实证前不启 producer |
| 接受/#1379 | 独立接受、只消费合法传输证明 | 独立接受；不实现 Wake，不将 #643 接受视为本提案接受 |

复用唯一 ledger、系统 Assistance、Svc command/receipt、Owner 消费骨架；未新增第二账本或业务重试引擎。
本提案不承接 #650 a/b 自动关闭，不声称原 Run 完成，也不把 Owner case resolve 当 admission permit。

**当前状态更正**：R1 提案 §3.1 的 “#643 fixed head proposed / PR 未合并” 是
[来源记录](docs/reports/refusal-terminal-proposal-20261107/source-provenance.json)
在 2026-11-07T12:58:52.877453+00:00 保存的历史观察。R2 实读 main
`9df5bd2fdea17f04bcd1762cd6800c350efcf9c3` 已含 #643 的 Owner 限定接受与 main 合并，
status=accepted，但 implementation/production authority 仍 none，WEC/Svc 配套权威门仍保留。
此处更正实时状态；R1 原文保留其固定来源时点，不再当作当前 PR 状态。
直接相关十个权威/拒绝恢复条目的 Git identity 不变；#654 只改诊断读面。
见 [main 影响分析](docs/reports/refusal-terminal-proposal-20261107/base-impact.json)、
[main 原始差量](docs/reports/refusal-terminal-proposal-20261107/main-movement.raw.txt) 和
[独立复核](docs/reports/refusal-terminal-proposal-20261107/independent-review.md)。
本次不切换/合并/rebase 该工作分支。

## 开放接受面和验证界限

Core WEC/LIVENESS/WAE 整权 successors 的 ID/接受/主线坐标仍 REQUIRED；Svc 历史对象、
closed case、discrepancy-only、原 Domain 当前合法 Owner、Owner 变更再接收、历史 case
inbox/detail/action、幂等读回和 request/resolution provenance 的配对权威及正式调用面仍未接受。
两提案须分别接受、分别启用；本次语义审查通过只允许文档交付。

独立初审 `/root/proposal_review` PASS，frozen blocker union NONE，6/6 Contracts 有验收定义；
最终 Head delta 与发布事实后续据实登记。定义不是测试执行，文档/函数存在不是运行验证。
产品测试、跨服务 E2E、安装、生产读写、部署、Assistance/Owner 发送均 NOT_RUN；零生产写入。
structure runner 本 base 的 V3 资格适配由其他任务负责，本次 docs-only 无适用源码结构差量。
