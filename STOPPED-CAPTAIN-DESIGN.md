# STOPPED-CAPTAIN-DESIGN

> 当前状态：R2 停点已由 R3b 处置；PR #649 已创建且未合并。下列 R1/R2 STOP 状态为历史记录。

```text
CURRENT_STATE = R2B_STOP_DISPOSED_BY_R3B
DISPOSITION = PYTHON_WHOLE_FILE_REWRITE
PUBLICATION_STATE_AT_DISPOSITION = PENDING
OPERATION_ALLOWED_NOW = NO
```

```text
STATE = STOPPED_AT_DOCUMENT_CHECK
OBSERVED_AT_UTC = 2026-11-07T07:19:56.200041+00:00
TASK = BRIEF-CAPTAIN-DESIGN
AUTHORIZATION = owner-20261107-preauth-v2-supplement; docs-only; no appointment
STOP_RULE = user explicit: 失败即停写STOPPED-CAPTAIN-DESIGN.md
WORKTREE = /private/tmp/fleet-captain-design-docs
BRANCH = docs/release-captain-design-v1
HEAD = f6e332d7568b01c5253618449bfef5839102c851
SEMANTIC_COMMIT = NOT_CREATED
PUSH = NOT_ATTEMPTED
PR = NOT_CREATED
FINAL_HEAD_REVIEW = NOT_PERFORMED
OPERATION_ALLOWED_NOW = NO
```

## 真实停点

本轮静态文档检查的 Python heredoc 经 exec_command 返回 **raw rc=1**。此前主代理已写方案、覆盖回执、来源坐标及现有 validator 隔离探针。检查先完成 governance verifier（`python3 .agents/tools/verify_governance.py --target . --require-accepted`，未触发其非零退出分支）、来源 commit/blob/SHA256 和 Owner canonical hash 重算，然后在扫描 Markdown 链接时中止。组合检查没有生成 `checks.json`，不能把整项静态检查报告为 PASS。

实际 traceback：

```text
Traceback (most recent call last):
  File "<stdin>", line 20, in <module>
AssertionError: (PosixPath('/private/tmp/fleet-captain-design-docs/docs/reports/captain-design-20261107/control-probe.md'), 'item, writer_uid=502, now_epoch=namespace["stamp"]("2026-11-04T12:00:00Z"')
```

触发检查片段为：

```python
for p in files:
    for link in re.findall(r'\]\(([^)]+)\)', p.read_text()):
        if '://' in link or link.startswith('#'):
            continue
        target = (p.parent / link.split('#')[0]).resolve()
        assert target.is_file(), (p, link)
```

归因：正则没有跳过 fenced code，把 `namespace["validate_authority"](item, ...)` 这一代码调用里的 `](` 当作 Markdown 链接，进而试图检查不存在的伪路径。这是检查器误报的具体反例，不是已经证明的交付文档断链。完整链接覆盖仍未验证；不凭归因抹掉 rc1，也不擅自修复/重跑。`git diff --check`、暂存/提交、最终候选审查、push 和 PR 出版尚未执行。

按本任务停止规则，此后只写本 STOP 文件；没有修复正文/回执/探针、重跑失败检查、暂存、commit、push 或创建 PR。已通知两名只读协作审查者停止，无人在本轮获得生产 verifier/Captain 身份。

## 已有结果与局限

- [方案草稿](CAPTAIN-DESIGN-PROPOSAL.md) 已写七项：四 principal、uid502 比较/缓解、三元组核定方案、SRA §2 范围、12月7日建议期限、实际控制/负例、mayf3 接受/任命时序和开放问题。
- [覆盖回执草稿](RECEIPT-CAPTAIN-DESIGN.md) 保持出版前状态，不能视为完成收据。
- [Owner 来源](docs/reports/captain-design-20261107/owner-selected-records.json) 和 [source-provenance](docs/reports/captain-design-20261107/source-provenance.json) 保留真实 selector、commit/blob/hash。
- [隔离纯函数探针](docs/reports/captain-design-20261107/control-probe.md) / [实际结果](docs/reports/captain-design-20261107/control-probe-result.json) raw rc0；三种无任命/越界/自报过期任命输入被现有纯函数接受，窗口过期控制例被拒。这是现有缺口观察，不是未来控制资格 PASS、整窗结果或生产调用。
- `/root/captain_proposal_review` 的未提交正文初审暂未发现语义 Blocker，来源15坐标和两条Owner canonical hash只读检查rc0；`/root/captain_control_audit` 的§5字节初审 BLOCKERS=0。均没有 semantic commit/final-HEAD 审查，不据此认定发布 READY。前者的标准枚举值建议在失败前已由作者改为 NOT_APPLICABLE，审查者未对改后最终Head复核。
- 真实 Principal/session/任命、SRA接受、工具控制准入、W7签发和生产前态保持 UNKNOWN/未执行；没有任命、接受、激活或签发。

## 保存的精确字节

| 文件 | SHA256 |
|---|---|
| `CAPTAIN-DESIGN-PROPOSAL.md` | `bff562271cd15af449c1c0542a1386b340956a9db48fbd1a16a972e0948faa7a` |
| `RECEIPT-CAPTAIN-DESIGN.md` | `f14a1fb0f0613e66fb31dcf87596f0839ecd895518f1ea0cb0d0de5f3194ad05` |
| `docs/reports/captain-design-20261107/BRIEF-CAPTAIN-DESIGN.source.md` | `e2c973d1c00e6d94c4ce3ea15f4a8f6e9127133aeccb7bb3a90b5309f1f6bb5d` |
| `docs/reports/captain-design-20261107/control-probe-result.json` | `cf3661d782bb52058a65b95085cdf207d326f51dd093dd3135e15d427e40ff8c` |
| `docs/reports/captain-design-20261107/control-probe.md` | `d31780a1cd25f04e7fedf24ed99b4d0df6ea6cc01205ffdebd7d7c8e64b5ed31` |
| `docs/reports/captain-design-20261107/owner-selected-records.json` | `be76fca7915d7226173d0dbae3e520447655cceb05184f7b3ad686095f0eeb4b` |
| `docs/reports/captain-design-20261107/source-provenance.json` | `89986864d559bbbbf6114cc605539e961ab62c883b6c6fdfcdbc83a9065d5ab9` |

失败后只读状态（写本 STOP 文件之前）：

```text
## docs/release-captain-design-v1
?? CAPTAIN-DESIGN-PROPOSAL.md
?? RECEIPT-CAPTAIN-DESIGN.md
?? docs/reports/captain-design-20261107/
```

## 零生产边界与最小续接条件

本轮只有独立 worktree 内文档/JSON 写入、读取本仓/Owner来源/GitHub元数据及三个 AST 纯函数合成诊断。没有生产读取/写入、Auth API/DB/store/凭据访问、Grant、token mint、sudo、launchctl、installer、window --execute、privileged selftest、业务调用或生产 mutex 操作。原 fleet-roll-src 脚本改动及 SRA worktree 未由本任务修改。

最小续接是新的明确续接授权下修正该静态检查器的代码块识别，记录本次 rc1 历史并重做受影响检查，再冻结语义 commit、独立审查、push/开PR且不合并。本轮不继续这些步骤，不把STOP追记成成功。

## R2 停点追加（保留上述 R1 原文）

```text
STATE = R2_STOPPED_AT_RECEIPT_PATCH
AUTHORIZATION = user R2 continuation; docs-only; no production effects; fail-stop
WORKTREE = /private/tmp/fleet-captain-design-docs
ACTUAL_BRANCH = docs/captain-design-proposal
HEAD = f6e332d7568b01c5253618449bfef5839102c851
FULL_STATIC_CHECKS_RAW_RC = 0
PROPOSAL_SHA256 = bff562271cd15af449c1c0542a1386b340956a9db48fbd1a16a972e0948faa7a
COMMIT = NOT_CREATED
PUSH = NOT_ATTEMPTED
PR = NOT_CREATED
FINAL_HEAD_REVIEW = NOT_PERFORMED
PRODUCTION_READS / PRODUCTION_WRITES = NONE / NONE
OPERATION_ALLOWED_NOW = NO
```

R2 已完成：读取当前治理及 R1 停点；保存 R1 初始 hash 到本机
`/private/tmp/captain-r2-original-hashes.json`；确认 STOPPED 所列七个 R1 文件
与历史 SHA256 一致；GitHub main fresh readback 为上述 HEAD，PR648 仍 OPEN、
mergedAt=null、head=61b97d326e337057cd1f71c0a6ff0dc37ab72ec2。

新增 [静态检查器](docs/reports/captain-design-20261107/static-checks.md) 使用行状态机
跳过 backtick/tilde 围栏和行内代码，再匹配完整 Markdown 链接；没有修改方案正文。
原误报 `control-probe.md:32` 的 `:5–41` 围栏及其他排除围栏的坐标/理由已登记。
[checks.json](docs/reports/captain-design-20261107/checks.json) 保存实际完整 stdout、
空 stderr、执行时间、检查器 SHA256 和整体 raw_rc=0。原始输出最后一行为：

```text
ALL_STATIC_CHECKS_PASS raw_rc=0
```

该次检查通过：governance accepted integrity；base ancestry；方案字节不变；
15 个来源 commit/blob/SHA256 与 BRIEF hash；两条 Owner canonical hash；
R1 probe 证据复用（未重执行）；docs-only 允许路径；6 份 Markdown 的 30 个本地链接；
JSON 解析；working/cached `git diff --check` 和全部未跟踪文档空白检查。
2 个外链仅登记，未声称网络可达；章节 slug 不作语义判定。
该检查时间先于本次 STOP 追加，不能视为对后来追加字节的最终候选检查。

随后执行 `git checkout -b docs/captain-design-proposal f6e332d7568b01c5253618449bfef5839102c851`
成功（raw rc0，`Switched to a new branch 'docs/captain-design-proposal'`）。
紧接着更新回执的 apply_patch 因作者提供了不匹配的上下文而被原子拒绝；
没有发生回执部分修改，回执头部 BRANCH 因而仍是 R1 的旧分支名。
失败原文如下，不将其称为链接假阳性：

```text
apply_patch verification failed: Failed to find expected lines in /private/tmp/fleet-captain-design-docs/RECEIPT-CAPTAIN-DESIGN.md:
NEXT_REAL_ACTION 是独立精确 Head 审查后推送开 PR，绝不任命、接受、签发、合并或生产执行。
```

按用户“失败即停照旧”，没有重试补丁，没有 stage/commit/push/PR；后续写入仅为本 STOP
追加。已通知只读协作者停止。其检查器及 R1 检查覆盖审查为 BLOCKERS=0，
不是冻结 commit 或 final-Head 审查；一次显示层转义误判已按实际字节核对后撤回。
R2 尚未完成出版及完成收据；不得以全量检查 rc0 冒充交付完成。

最小续接差量：修正回执中的当前分支和已执行检查状态，冻结文档提交，独立精确 Head
审查，向 `mayf3/dsh-agent-core` 推送指定分支并 `gh pr create --base main`，不合并，
完成真实出版读回及回执。本地没有 remote/main；已通过 GitHub API 核实 main 基线，
未修改共享 worktree 的 remote 或其他 checkout。生产身份、授权、任命与 W7 全部仍未执行。

## R2b 处置与检查通过

R3b 明确续接授权，记录时间 `2026-11-07T07:29:42.625565+00:00`。以 Python 读取现内容后整体重写追加，
没有使用 patch。R1 的链接扫描假阳性已由 R2 检查器通过跳过代码围栏和行内代码处置；
`control-probe.md:32` 位于 `:5–41` Python 围栏。R2 全量检查实际通过后，
回执 patch 因上下文不匹配被原子拒绝；本轮整体重写修正回执分支/检查状态，
并将该机械停点标记为已由 R3b 处置。历史 rc1 和 patch 错误保留，不回写为成功。

检查坐标：[checks.json](docs/reports/captain-design-20261107/checks.json)，
JSON selectors 为 `$.started_at_utc` / `$.finished_at_utc` / `$.raw_rc` / `$.stdout` / `$.stderr`；
执行区间 `2026-11-07T07:25:12.709180+00:00` 至 `2026-11-07T07:25:13.354296+00:00`，
整体 `raw_rc=0`，`stderr` 原文为空串。
检查器 SHA256=`e1362f2d7f18eab0dc9ef04b36d63aac753cb22be9a2d61dac14d375665a1d32`。以下为 `$.stdout` 完整原文：

```text
PASS fenced-code/inline-code regression; real link retained
{"argv": ["python3", ".agents/tools/verify_governance.py", "--target", ".", "--require-accepted"], "raw_rc": 0, "stdout": "vendored governance bytes match governance.lock.json and adoption is accepted\n", "stderr": ""}
{"argv": ["git", "merge-base", "HEAD", "f6e332d7568b01c5253618449bfef5839102c851"], "raw_rc": 0, "stdout": "f6e332d7568b01c5253618449bfef5839102c851\n", "stderr": ""}
PASS exact base ancestry and R1 proposal byte identity bff562271cd15af449c1c0542a1386b340956a9db48fbd1a16a972e0948faa7a
PASS source commit/blob/SHA256 coordinates=15; BRIEF hash
PASS Owner canonical hashes=2; R1 probe evidence rebound without re-execution
{"argv": ["git", "diff", "--name-only", "f6e332d7568b01c5253618449bfef5839102c851"], "raw_rc": 0, "stdout": "", "stderr": ""}
{"argv": ["git", "ls-files", "--others", "--exclude-standard"], "raw_rc": 0, "stdout": "CAPTAIN-DESIGN-PROPOSAL.md\nRECEIPT-CAPTAIN-DESIGN.md\nSTOPPED-CAPTAIN-DESIGN.md\ndocs/reports/captain-design-20261107/BRIEF-CAPTAIN-DESIGN.source.md\ndocs/reports/captain-design-20261107/control-probe-result.json\ndocs/reports/captain-design-20261107/control-probe.md\ndocs/reports/captain-design-20261107/owner-selected-records.json\ndocs/reports/captain-design-20261107/source-provenance.json\ndocs/reports/captain-design-20261107/static-checks.md\n", "stderr": ""}
PASS docs-only changed-path scope files=9
{"local_markdown_links": [{"path": "CAPTAIN-DESIGN-PROPOSAL.md", "line": 24, "target": "docs/reports/captain-design-20261107/BRIEF-CAPTAIN-DESIGN.source.md"}, {"path": "CAPTAIN-DESIGN-PROPOSAL.md", "line": 24, "target": "docs/reports/captain-design-20261107/owner-selected-records.json"}, {"path": "CAPTAIN-DESIGN-PROPOSAL.md", "line": 26, "target": ".agents/local/README.md"}, {"path": "CAPTAIN-DESIGN-PROPOSAL.md", "line": 26, "target": "docs/AGENT_CORE_PRODUCT_ARCHITECTURE_V1.md"}, {"path": "CAPTAIN-DESIGN-PROPOSAL.md", "line": 26, "target": "docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V3.md#22-security-domain-与来源边界"}, {"path": "CAPTAIN-DESIGN-PROPOSAL.md", "line": 26, "target": "docs/specs/AGENT_CORE_HARDENING_PROGRAM_V1.md"}, {"path": "CAPTAIN-DESIGN-PROPOSAL.md", "line": 26, "target": "docs/specs/AGENT_CORE_CREDENTIAL_METADATA_RESOLUTION_V1.md"}, {"path": "CAPTAIN-DESIGN-PROPOSAL.md", "line": 26, "target": "docs/specs/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1.md"}, {"path": "CAPTAIN-DESIGN-PROPOSAL.md", "line": 30, "target": "docs/reports/captain-design-20261107/source-provenance.json"}, {"path": "CAPTAIN-DESIGN-PROPOSAL.md", "line": 121, "target": "scripts/fleet-window/window_helper_core.py#L25"}, {"path": "CAPTAIN-DESIGN-PROPOSAL.md", "line": 121, "target": "scripts/fleet-window/window_helper.py#L5"}, {"path": "CAPTAIN-DESIGN-PROPOSAL.md", "line": 121, "target": "scripts/fleet-window/window-executor-v5.sh#L30"}, {"path": "CAPTAIN-DESIGN-PROPOSAL.md", "line": 123, "target": "RECEIPT-CAPTAIN-DESIGN.md"}, {"path": "RECEIPT-CAPTAIN-DESIGN.md", "line": 33, "target": "CAPTAIN-DESIGN-PROPOSAL.md"}, {"path": "RECEIPT-CAPTAIN-DESIGN.md", "line": 33, "target": "docs/reports/captain-design-20261107/owner-selected-records.json"}, {"path": "RECEIPT-CAPTAIN-DESIGN.md", "line": 52, "target": "docs/reports/captain-design-20261107/source-provenance.json"}, {"path": "RECEIPT-CAPTAIN-DESIGN.md", "line": 53, "target": "docs/reports/captain-design-20261107/owner-selected-records.json"}, {"path": "RECEIPT-CAPTAIN-DESIGN.md", "line": 54, "target": "docs/reports/captain-design-20261107/source-provenance.json"}, {"path": "RECEIPT-CAPTAIN-DESIGN.md", "line": 55, "target": "docs/reports/captain-design-20261107/control-probe.md"}, {"path": "RECEIPT-CAPTAIN-DESIGN.md", "line": 55, "target": "docs/reports/captain-design-20261107/control-probe-result.json"}, {"path": "RECEIPT-CAPTAIN-DESIGN.md", "line": 84, "target": "STOPPED-CAPTAIN-DESIGN.md"}, {"path": "RECEIPT-CAPTAIN-DESIGN.md", "line": 87, "target": "docs/reports/captain-design-20261107/control-probe.md#L32"}, {"path": "RECEIPT-CAPTAIN-DESIGN.md", "line": 90, "target": "docs/reports/captain-design-20261107/static-checks.md"}, {"path": "STOPPED-CAPTAIN-DESIGN.md", "line": 48, "target": "CAPTAIN-DESIGN-PROPOSAL.md"}, {"path": "STOPPED-CAPTAIN-DESIGN.md", "line": 49, "target": "RECEIPT-CAPTAIN-DESIGN.md"}, {"path": "STOPPED-CAPTAIN-DESIGN.md", "line": 50, "target": "docs/reports/captain-design-20261107/owner-selected-records.json"}, {"path": "STOPPED-CAPTAIN-DESIGN.md", "line": 50, "target": "docs/reports/captain-design-20261107/source-provenance.json"}, {"path": "STOPPED-CAPTAIN-DESIGN.md", "line": 51, "target": "docs/reports/captain-design-20261107/control-probe.md"}, {"path": "STOPPED-CAPTAIN-DESIGN.md", "line": 51, "target": "docs/reports/captain-design-20261107/control-probe-result.json"}, {"path": "docs/reports/captain-design-20261107/control-probe.md", "line": 3, "target": "control-probe-result.json"}], "external_links_not_network_checked": [{"path": "CAPTAIN-DESIGN-PROPOSAL.md", "line": 28, "target": "https://github.com/mayf3/dsh-agent-core/pull/648"}, {"path": "CAPTAIN-DESIGN-PROPOSAL.md", "line": 28, "target": "https://github.com/mayf3/dsh-agent-core/blob/61b97d326e337057cd1f71c0a6ff0dc37ab72ec2/STANDING-RELEASE-AUTHORIZATION-V1-DRAFT.md"}], "excluded_fences": [{"path": "CAPTAIN-DESIGN-PROPOSAL.md", "start": 3, "end": 16, "reason": "fenced code"}, {"path": "CAPTAIN-DESIGN-PROPOSAL.md", "start": 36, "end": 44, "reason": "fenced code"}, {"path": "CAPTAIN-DESIGN-PROPOSAL.md", "start": 166, "end": 186, "reason": "fenced code"}, {"path": "RECEIPT-CAPTAIN-DESIGN.md", "start": 3, "end": 25, "reason": "fenced code"}, {"path": "RECEIPT-CAPTAIN-DESIGN.md", "start": 67, "end": 76, "reason": "fenced code"}, {"path": "STOPPED-CAPTAIN-DESIGN.md", "start": 3, "end": 17, "reason": "fenced code"}, {"path": "STOPPED-CAPTAIN-DESIGN.md", "start": 25, "end": 29, "reason": "fenced code"}, {"path": "STOPPED-CAPTAIN-DESIGN.md", "start": 33, "end": 40, "reason": "fenced code"}, {"path": "STOPPED-CAPTAIN-DESIGN.md", "start": 69, "end": 74, "reason": "fenced code"}, {"path": "docs/reports/captain-design-20261107/control-probe.md", "start": 5, "end": 41, "reason": "fenced code"}, {"path": "docs/reports/captain-design-20261107/static-checks.md", "start": 18, "end": 145, "reason": "fenced code"}]}
PASS Markdown links files=6; local=30; external=2
{"argv": ["git", "diff", "--check"], "raw_rc": 0, "stdout": "", "stderr": ""}
{"argv": ["git", "diff", "--cached", "--check"], "raw_rc": 0, "stdout": "", "stderr": ""}
PASS git diff --check; cached diff --check; all changed/untracked docs whitespace
ALL_STATIC_CHECKS_PASS raw_rc=0
```

上述执行早于 R2 STOP 追加和本次重写；它不覆盖后来新增字节。R3b 仅补受影响检查，
不重跑已通过机制；新的提交/出版结果以更新后的 RECEIPT 与 PR 为准。

| 文件与绑定阶段 | SHA256 |
|---|---|
| `CAPTAIN-DESIGN-PROPOSAL.md`（R3b，正文未改） | `bff562271cd15af449c1c0542a1386b340956a9db48fbd1a16a972e0948faa7a` |
| `RECEIPT-CAPTAIN-DESIGN.md`（R3b 机械续接节写入后、出版回执追加前） | `d34ce7b33495972c60cca70e9ba4d65fed21b1ece8aa42ded544380d59f2f94a` |
| `docs/reports/captain-design-20261107/checks.json`（R2 原证据，未改） | `50697af39ddb5e9ee3dc4b256b82b829d6feac1c7c06662a973a17e20c3c2d16` |
| `STOPPED-CAPTAIN-DESIGN.md`（R3b 重写前历史原件） | `a1cd8c1e34403c67663dcfe70df565a5efcbc134f9ded1d55d4fd57891746819` |

```text
R2B_STOP_STATUS = DISPOSED_BY_R3B
BRANCH = docs/captain-design-proposal
PARENT_HEAD = f6e332d7568b01c5253618449bfef5839102c851
COMMIT / PUSH / PR_AT_THIS_WRITE = NOT_YET / NOT_YET / NOT_YET
PRODUCTION_READS / PRODUCTION_WRITES = NONE / NONE
OPERATION_ALLOWED_NOW = NO
```

## R3b 出版状态读回

[PR #649](https://github.com/mayf3/dsh-agent-core/pull/649) 已创建，首次 push 和创建均 raw_rc=0，
读回 OPEN、mergedAt=null、head=`8bb66baf4a850c9c6c6de23fe89ed579549932ba`。
R2b 机械停点已处置；原 R1/R2 失败及上述 disposition 时点的 PENDING 状态是历史记录。
另线 SRA PR #648 已入 main=`55f442c74414dc723306a6d8e0cdba73d78eb8da`，
不再以初始来源快照描述当前生命周期。完整坐标、局限与后续最终 HEAD 回执位置见
[RECEIPT §6](RECEIPT-CAPTAIN-DESIGN.md#6-r3b-pr-出版回执)。本任务没有合并、任命、
激活、签发、生产读取或生产写入。
