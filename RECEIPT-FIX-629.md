# #629 stage04 观察路径冲突闭合收据

日期：2026-11-09；范围：source-only。**选择方案 A**：删除 quiet 中停机前的
`settle-all-pending.sealed.mjs` 调用及 `settle-at-quiet.log` 追加，不改 accepted Spec
或 mandate，不把日志静默解释为 exact termination，不扩大 stage05b 权限。

## 任务与 PREFLIGHT

- 授权：用户要求执行 `/tmp/fix-629/FIX-BRIEF.md`，核权威后二选一、仅本分支相关文件、
  单 commit 推 `origin chore/fleet-window-tools`，失败 bundle 交接。
- Brief SHA256：`a6fa77a8000467737aca86dceb63e9d50ef6358b922eae5895fae7f99195e05a`。
- 隔离写面：`/private/tmp/fix-629/repo`，唯一当前 worktree，
  branch=`chore/fleet-window-tools`，起始工作树干净。
- `REVIEW_TARGET_HEAD / BASE_HEAD`：`63e195ddd79786b4d5f52a2b3f1d730c69a85b5b`。
- 本地 main 权威快照：`origin/main@ca0025f82c94413a125e621d34ea10d2af26ba0d`；
  与分支 merge-base=`e61458e0666bc6aa962d31561beeff1ada4a4f56`。
- 该 main 快照不是本次远端 fresh read：`git fetch origin main chore/fleet-window-tools`
  rc128（127.0.0.1:7890 不可达）；仅当次进程去除代理环境的 `git ls-remote` 亦 rc128
  （github.com:443 不可达）。未更改网络/Git 配置，当前远端状态 UNKNOWN。

```text
SPEC_GOVERNANCE_MODE = PREFLIGHT
ROUTE_STAGE = IMPLEMENTATION
GOAL_OR_TARGET = 移除 quiet 停机前 settle 副作用，保留观察和既有拒绝边界
CURRENT_GAP = mandate stage04 纯观察与 helper 停机前批量结算冲突
AUTHORITY_ACTION = REUSE
PRIMARY_AUTHORITY = SCHEDULER_OCCURRENCE_OUTCOME_V3, PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1
AUTHORITY_ACCEPTED_IN_BASE = YES
IMPLEMENTATION_AUTHORITY = contracts (DCP); D-009 constrains exact termination/UNKNOWN
RELATED_AUTHORITIES = main WEC5 CTR-WEC1-008 / CTR-WEC4-010; branch WEC3 exact-settled boundary
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = DURABLE
MUTATION_AUTHORIZATION = VALID (user task, source-only scope)
EXECUTION_MANDATE = VALID_FOR_SOURCE_FIX_ONLY
ISOLATED_WRITE_SURFACE = YES
CONTROLLED_RUNBOOK_REQUIRED = NO (no production operation)
SPEC_GAP_DEPENDENCY = NONE for removal; no new settlement behavior authorized
EVIDENCE_REVIEWABILITY = PASS (pinned Git objects and hermetic tests)
OWNER_DECISION_REQUIRED = NO
IMPLEMENTATION_ALLOWED = YES
MERGE_READY = NOT_APPLICABLE (push only; no merge requested)
OPERATION_ALLOWED = NO
DONE_WHEN = bounded conflict closed, focused evidence/review, one commit, push or verified bundle
EXPANSION_TRIGGER = accepted meaning change, production access, new settlement/admission behavior
NEXT_REAL_ACTION = verify affected delta, commit once, push or bundle
```

## 权威依据与方案选择

以下 main 坐标均绑定上述 `ca0025f8` 快照；分支坐标绑定起始 `63e195dd`。

| 权威 / 操作边界 | 精确坐标 | 本次结论 |
|---|---|---|
| D-009（branch/main 相同） | `docs/decisions/SCHEDULER_OCCURRENCE_OUTCOME_V3.md` §8.2 L534–542、§8.3 L544–572、§8.4 L574–588、§8.5 L592–600 | 需要正向 exact termination，保留 UNKNOWN 历史；current epoch/exact tuple/无冲突是 termination-only settlement 条件，pending/missing/conflict 等零写。mtime 不是这些证据。 |
| DCP（branch/main 相同） | `docs/specs/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1.md` L40–44、CTR-DCP-011 L266–283、CTR-DCP-012 L285–296 | 保留 Scheduler/Router UNKNOWN；不盲 replay，未证状态 quarantine；先 quiesce/prove old exit。DCP 不是 blanket settle 授权，亦未直接写有一条名为“停机前 settle 禁令”的 Contract。 |
| WEC5（main accepted/contracts，production none，L1–18） | `docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V5.md` CTR-WEC1-008 L635–666、L694–704，CTR-WEC4-010 L758–814 | 锁外例外仅两类 remote read；回同锁 replay CURRENT、fresh exact validation 后才单次 append。pending/unknown 不等于 settled；不能由锁外采集推导出批量结算许可。 |
| 本分支 WEC3 | `docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V3.md` CTR-WEC1-008 L204–225、L259–279 | 既有 positively settled、pending/unknown 无资格边界已在 base；本修复无需引入 WEC5 的新实现或改其接受事务。 |
| W6 mandate V2（一次操作约束，非 Product Authority） | `EXECUTION-MANDATE-W6-V2.md` §4 L133–139，stage04/05/05b L155–157 | stage04 纯观察；禁止 quiet 前后批量结算造 clean；停机后才可消费逐条 exact 证据。 |

方案 B 没有可引用的停机前 blanket settlement 授权，也没有从 mtime 到 exact
termination 的证据桥梁。文件 root seal/hash 仅证明字节身份，不证明记录级资格。
因此不能靠改 mandate 将该副作用合法化；A 移除依赖，保留已接受边界。

Git blob 复核：

- DCP：branch/main 均 `af655bb5801ca5af956003c8a7fabc2b27b4b6de`。
- D-009：branch/main 均 `fd4ee0df516fd1cda800e586dd05cab8bfc355eb`。
- main WEC5：`b65e597573eec7b0ec29d5f57a463eb7422a2a19`。
- 不声称本分支包含 main WEC5；其新协议实施不在本任务内。

## 实际改动和保留边界

`window_helper.py` 只删除 quiet 的七条 AST statement（原 L132–137）：subprocess
import、sealed 路径/regular/hash、sudo run、外部 append 和 rc45 检查。其余 op AST
相对起始 HEAD 完全相同，`window_helper_core.py` 与 runner 未改。

当前 quiet：授权/旧身份核对 → 日志 metadata → `quiet-last.json` → 未满180s返回10 →
只读 census → 日志未变检查 → `quiet-pass.json`。只写 RD 观察收据，不写 Router/
Scheduler/业务状态，不追加外部 settle 日志，不调用 settlement。

**保留的更严限制**：`census()` 仍要求三个列表为空；非空不产生 quiet PASS。
runner 对 rc1/10 仍最多80×30s轮询，耗尽rc42；其他错误依既有路径拒绝。
本次没有实现 mandate stage04“允许非空”的全部通过条件，也不证明05b或完整窗口就绪。
`--dry-run` 历史文本150s与实际180s不一致、其他 readiness gaps 保持；不得据此窗口 GO。
无生产读取/写入，无 window/helper/runner/deploy 入口执行，无生产 canary 或 runtime 验收。

模型处置：quiet 内 blanket settlement 可执行路径 `RETIRE`；stage05b 的独立停机后
exact termination-only 责任 `RETAIN`。历史 seal/patch/receipt 不改写、不删除。

## 执行证据（隔离，2026-11-09）

| 命令 / 方法 | 实测结果 | 限制 |
|---|---|---|
| `python3 -B scripts/fleet-window/test_quiet_observation.py` | rc0，9 tests PASS；三类非空、读取错误/坏JSON、缺epoch、身份/log/store drift、180s边界、UNKNOWN/fence 保留 | 仅提取实际 quiet/census/quiet_ready AST，以内存替身替代所有依赖，无子进程或落盘；不是生产窗口运行。 |
| 同成功用例换成 `git show 63e195dd:.../window_helper.py` 的 quiet AST | baseline RED：`ImportError: __import__ not found`（原L132）；确认旧 quiet 试图进入 subprocess。验证 harness 将此预期失败判定 rc0 | 非正常 PASS；只验证测试能阻止已知副作用路径。 |
| `PYTHONPATH=scripts/fleet-window python3 -B -m unittest test_xattrfix_r3.Selftest.test_fix629_dispatch_delta test_xattrfix_r3.Selftest.test_split_limits_and_syntax` | rc0，2 tests PASS；仅 quiet 七条删除，其他 op AST 完全相同；compile/`bash -n` PASS | 只读 Git/源码与语法解析，不执行 window 程序。 |
| `python3 -B .agents/tools/verify_governance.py --target . --require-accepted` | rc0，vendored bytes/accepted lock PASS | 治理完整性，不等于运行验收。 |
| `git diff --check` | rc0 | whitespace 检查。 |

曾在 repo 根未设 PYTHONPATH 导致旧测试模块 import error，修正命令后如上通过。
旧 `Selftest.test_stage_and_dispatch_identity` 另实测失败：L304 的 runner/C7 suffix
比对不等。独立只读复核 `SHELL_CURRENT_EQUALS_PARENT=True`、parent 和 current 的
suffix 均不等而 C7 本身相等，故这是起始 HEAD 已有 `TOOLING_DEBT=1`，不是本次回归。
本次未扩修历史 runner 基线；未报告全量旧 selftest PASS，未运行会调用 window 入口的旧用例。

变更文件 SHA256（收据自身由包含它的最终 commit 绑定）：

```text
6b6193d4f9c6d9dd4bedb5a67931bcd8daaaa3b355f382a8cd79a05a07b5c82c  scripts/fleet-window/window_helper.py
5c75d2686f9002fe18d3973b43a54a7036a922936860da4d3acb48b8c6d6e75a  scripts/fleet-window/test_quiet_observation.py
ce2e6eca7d0ba06f88cf78c7eab740b852d1b02cb35369e825641f388a973c62  scripts/fleet-window/test_xattrfix_r3.py
9fb2c0754382c36667f237513f99dec27af3783a2b4e26cde69ef4b035ca9195  scripts/fleet-window/README.md
```

## 独立复核与交付

独立 reviewer：`/root/authority_review`（未作者/修改文件）。已核权威、最小方案 A、
实际代码 delta 与残余边界；`FROZEN_BLOCKER_UNION=[]`；旧 suffix 失败独立确认在 parent 已存在。
完整 delta 及本收据的独立复核为 `PASS / BLOCKERS=0 / SPEC_GAPS=0`；reviewer 独立
重跑9项行为测试和2项delta/语法测试均rc0，四份变更文件哈希与上表一致。
`SOURCE_FIX_PUSH_READY=YES / OPERATION_ALLOWED=NO`；本次只将此处 pending 更新为实际结果，
不改变受审 source 语义。提交后的 final-HEAD 机械复核随交付记录提供。

交付只允许一个 commit，标题固定为
`chore(fleet-window): reconcile stage04 observe mandate with helper settle path`。
提交后读回 parent/HEAD、结构 gate、独立 final-HEAD delta；随后推指定 ref。
若推送不可达，交接校验过的 bundle 和 SHA256；remote delivery 不伪报成功。
