# RECEIPT — EKR P1-B ONLY (2026-11-06 第4派)

STATUS = TESTS_PASS_LOCAL_COMMITTED_TLS_HANDOFF
P1-B only (P1-A blocked on spec-author)

## 固定坐标、授权和范围

- Repository / worktree / branch: `mayf3/dsh-agent-core` / `/private/tmp/dsh-ekr-p1-new` / `ac-ekr-p1-new`。
- BASE_HEAD = `f6a1f77a8b7b878bcb9821a68836925755ca7076`。
- REVIEW_TARGET_HEAD / TEST_SOURCE_HEAD = `171ecf8482ddf9df61233880f3cf24cbaa0f3816`（本回执的 head SHA 为实际测试及独立语义审查候选）。
- 最终交付为该候选之后的 evidence/receipt-only 提交；其精确 SHA 通过 `git rev-parse ac-ekr-p1-new` 及提交日志读取，避免在自身内容内伪造 self-referential SHA。测试文件字节保持不变。
- 连接器最后读取远端 main 仍为同 base；方法、UTC 时间及坐标见 [remote-main-final.json](docs/evidence/ekr-p1b/remote-main-final.json)。没有 rebase/fetch/切换分支。
- 授权：[BRIEF-EKR-P1B-ONLY.md](BRIEF-EKR-P1B-ONLY.md) 原文未改。本次仅新增测试、必要交付文档和证据，保留前派未跟踪交接文件原样且不纳入提交。
- PREFLIGHT = REUSE / BRIEF / ROUTINE / IMPLEMENTATION；accepted Owner Workflows V2 §§2/4/5/8，WAE V3 和既有 stale re-entry 为受影响机制依据。完整坐标和授权哈希见 [preflight.json](docs/evidence/ekr-p1b/preflight.json)。
- P1-A 通知/答复/验证/重唤醒、Svc obligation 后继、Core continuation 引擎均未实施；未修改任何产品源码、Spec 或既有测试，未触碰 #622/#624/#625 已落语义。

## 新测试验证内容

三操作 `create_instance`、`resolve_current_governance_review`、`escalate_to_human`，各测 SUCCEEDED 与 UNKNOWN，共六场景。第一次既有 guarded POST 在本地 Svc substitute 保存 effect row、执行一次 synthetic business handler 后，真实断开 socket，Core 得到 `transport_failure` 且未自动重发。随后实际 ledger generation 2/3 使用不同 attemptId，重建 ledger、可信 turn context 与 Gateway。

- SUCCEEDED：同一 slot/key 和原 effectId/commandId/result，Svc substitute 返回 `replayed:true`；总计三个 guarded POST，但 business handler 只执行一次。请求体只有现有四字段；无新业务 key、attempt/generation、Idempotency-Key 或 generic fallback。
- UNKNOWN：第二、第三 attempt 均只 relation GET；POST 总数仍为一次，原 UNKNOWN row 不变，不推断零效果、不补造 command/success。
- resolve 重入复用原不可变 proof，不要求新的 ADMISSIBLE，也不重复业务 resolve。

该测试的 admission eligibility/quiescence 明确为预置，只验证**已准入不同 attempt 的业务副作用边界**；不声称丢回执或 UNKNOWN 本身可授权新 attempt。

## Diff stat

实际 source candidate `base..TEST_SOURCE_HEAD`：

```text
 BRIEF-EKR-P1B-ONLY.md                              |  27 +++
 .../owner-obligation-attempt.test.js               | 227 +++++++++++++++++++++
 2 files changed, 254 insertions(+)
```

最终交付另包含本回执及 `docs/evidence/ekr-p1b/`；最终 staged stat 原文见 [delivery-diff-stat.raw.txt](docs/evidence/ekr-p1b/delivery-diff-stat.raw.txt)（统计记录本身在记录后追加）。

## 实际执行和独立审查

| Gate | 结果 | 坐标/证据 |
|---|---|---|
| 新纵向测试 | rc=0，6 tests / 6 pass / 0 fail | `171ecf8482ddf9df61233880f3cf24cbaa0f3816`；[focused.raw.txt](docs/evidence/ekr-p1b/focused.raw.txt) |
| 原五件套 | rc=0，67 tests / 67 pass / 0 fail | `f6a1f77a8b7b878bcb9821a68836925755ca7076`；[baseline-five.raw.txt](docs/evidence/ekr-p1b/baseline-five.raw.txt) |
| 未受影响基线重绑定 | PASS | 五个文件哈希及全部产品源码在 candidate 未变；未声称在 candidate 重跑 |
| 结构门 V2 | rc=0，CANDIDATE_DELTA_PASS_WITH_BASELINE_DEBT | 0 candidate violations / 28 inherited debt；非全仓无债务 PASS；[structure.raw.txt](docs/evidence/ekr-p1b/structure.raw.txt) |
| 治理完整性 | rc=0，require-accepted | [governance.raw.txt](docs/evidence/ekr-p1b/governance.raw.txt) |
| candidate/working/cached diff check | rc=0 | [命令与 raw 文件](docs/evidence/ekr-p1b/)；证据未排除 |
| 独立受影响合同审查 | PASS / BLOCKERS=0 / SPEC_GAPS=0 | `/root/p1b_test_review`，exact candidate；[independent-review.md](docs/evidence/ekr-p1b/independent-review.md) |
| 全仓 npm test、真实 Svc DB/进程崩溃/生产 E2E | NOT_RUN | 超出本次纯测试范围，不推断通过 |

全部测试命令、起止 UTC、rc、sourceSha、raw SHA-256 和测试文件 SHA-256 见 [commands.json](docs/evidence/ekr-p1b/commands.json)。上海日期为 2026-11-06；原始 UTC 时间照实记录。

## 提交、推送和 PR

- 测试 source commit = `171ecf8482ddf9df61233880f3cf24cbaa0f3816`，后续仅提交本交付包。
- gh 实际命令：`gh api repos/mayf3/dsh-agent-core/commits/main --jq .sha`，rc=1，TLS handshake timeout。完整进程 stdout/stderr 合并原文及时间见 [gh-final.raw.txt](docs/evidence/ekr-p1b/gh-final.raw.txt)、[gh-final.command.json](docs/evidence/ekr-p1b/gh-final.command.json)。
- 按用户合同的明确 fallback「gh 不可用（TLS 超时）→ 完成提交并停，推送由监管补做，不算失败」执行：PUSH = NOT_RUN / SUPERVISOR_HANDOFF；PR = NOT_CREATED；MERGE = NOT_RUN。不是假称已推送，也不把该明确 fallback 记作产品或测试失败。
- 已备好 [PR title](docs/evidence/ekr-p1b/pr-title.txt) 与 [PR body](docs/evidence/ekr-p1b/pr-body.md)，引用 `mayf3/agent-control#1374` 并带指定 P1-B only 标记。监管可先核 main 未移动，再 `git push origin ac-ekr-p1-new`、用文件正文创建 PR；不 merge。
- PRODUCTION_WRITES = 0；WINDOW_TOOLS_USED = NO；PRODUCT_IMPLEMENTATION_CHANGED = NO。

## UNKNOWN

真实 `workflow_operation_effects` 数据库唯一约束/原子性、跨进程及真实崩溃恢复、已安装/已加载版本、外部工具生产效果和一般工具幂等能力、业务完成/无人值守 E2E、Svc 当前 writer/DB、真人通知/答复验收仍 UNKNOWN/NOT_VERIFIED。fake Svc 的持久 JSON 与同进程对象重建不能升级为这些证明。远端 main 是最后成功读取时的观察，不是未来不变承诺；远端 feature branch/push/PR/CI 状态未验证。

## 全部测试输出原文

以下逐字嵌入两个实际 subprocess 的合并 stdout/stderr；对应 raw 文件保留原字节。

### 新测试

```sh
node --test packages/broker/test/capabilities/workflow-execution/owner-obligation-attempt.test.js
```

```text
✔ P1-B create_instance: lost response then new attempts preserve SUCCEEDED effect (227.273458ms)
ℹ {"operation":"create_instance","outcome":"SUCCEEDED","attempts":[{"attemptId":"wfeat-78ce25d4b4df4a8a7995a6c1","generation":1},{"attemptId":"wfeat-03ae48b05e3cf4d431746519","generation":2},{"attemptId":"wfeat-b6a457ad3b1e12c7c2e9a690","generation":3}],"effectId":"00000013-0000-4000-8000-000000000000","stableKey":"[\"00000001-0000-4000-8000-000000000000\",\"00000007-0000-4000-8000-000000000000\",\"00000008-0000-4000-8000-000000000000\",\"supplier\",1]","businessExecutions":1,"guardedPosts":3,"limitations":"real Core ledger/context/gateway + loopback HTTP; Svc table is a fixture; admission eligibility and quiescence seeded; no live DB/process/production proof"}
✔ P1-B create_instance: lost response then new attempts preserve UNKNOWN effect (158.616458ms)
ℹ {"operation":"create_instance","outcome":"UNKNOWN","attempts":[{"attemptId":"wfeat-78ce25d4b4df4a8a7995a6c1","generation":1},{"attemptId":"wfeat-03ae48b05e3cf4d431746519","generation":2},{"attemptId":"wfeat-b6a457ad3b1e12c7c2e9a690","generation":3}],"effectId":"00000013-0000-4000-8000-000000000000","stableKey":"[\"00000001-0000-4000-8000-000000000000\",\"00000007-0000-4000-8000-000000000000\",\"00000008-0000-4000-8000-000000000000\",\"supplier\",1]","businessExecutions":1,"guardedPosts":1,"limitations":"real Core ledger/context/gateway + loopback HTTP; Svc table is a fixture; admission eligibility and quiescence seeded; no live DB/process/production proof"}
✔ P1-B resolve_current_governance_review: lost response then new attempts preserve SUCCEEDED effect (180.708416ms)
ℹ {"operation":"resolve_current_governance_review","outcome":"SUCCEEDED","attempts":[{"attemptId":"wfeat-78ce25d4b4df4a8a7995a6c1","generation":1},{"attemptId":"wfeat-03ae48b05e3cf4d431746519","generation":2},{"attemptId":"wfeat-b6a457ad3b1e12c7c2e9a690","generation":3}],"effectId":"00000013-0000-4000-8000-000000000000","stableKey":"[\"00000001-0000-4000-8000-000000000000\",\"00000007-0000-4000-8000-000000000000\",\"00000008-0000-4000-8000-000000000000\",\"review\",1]","businessExecutions":1,"guardedPosts":3,"limitations":"real Core ledger/context/gateway + loopback HTTP; Svc table is a fixture; admission eligibility and quiescence seeded; no live DB/process/production proof"}
✔ P1-B resolve_current_governance_review: lost response then new attempts preserve UNKNOWN effect (159.208083ms)
ℹ {"operation":"resolve_current_governance_review","outcome":"UNKNOWN","attempts":[{"attemptId":"wfeat-78ce25d4b4df4a8a7995a6c1","generation":1},{"attemptId":"wfeat-03ae48b05e3cf4d431746519","generation":2},{"attemptId":"wfeat-b6a457ad3b1e12c7c2e9a690","generation":3}],"effectId":"00000013-0000-4000-8000-000000000000","stableKey":"[\"00000001-0000-4000-8000-000000000000\",\"00000007-0000-4000-8000-000000000000\",\"00000008-0000-4000-8000-000000000000\",\"review\",1]","businessExecutions":1,"guardedPosts":1,"limitations":"real Core ledger/context/gateway + loopback HTTP; Svc table is a fixture; admission eligibility and quiescence seeded; no live DB/process/production proof"}
✔ P1-B escalate_to_human: lost response then new attempts preserve SUCCEEDED effect (177.218209ms)
ℹ {"operation":"escalate_to_human","outcome":"SUCCEEDED","attempts":[{"attemptId":"wfeat-78ce25d4b4df4a8a7995a6c1","generation":1},{"attemptId":"wfeat-03ae48b05e3cf4d431746519","generation":2},{"attemptId":"wfeat-b6a457ad3b1e12c7c2e9a690","generation":3}],"effectId":"00000013-0000-4000-8000-000000000000","stableKey":"[\"00000001-0000-4000-8000-000000000000\",\"00000007-0000-4000-8000-000000000000\",\"00000008-0000-4000-8000-000000000000\",\"review\",1]","businessExecutions":1,"guardedPosts":3,"limitations":"real Core ledger/context/gateway + loopback HTTP; Svc table is a fixture; admission eligibility and quiescence seeded; no live DB/process/production proof"}
✔ P1-B escalate_to_human: lost response then new attempts preserve UNKNOWN effect (161.660875ms)
ℹ {"operation":"escalate_to_human","outcome":"UNKNOWN","attempts":[{"attemptId":"wfeat-78ce25d4b4df4a8a7995a6c1","generation":1},{"attemptId":"wfeat-03ae48b05e3cf4d431746519","generation":2},{"attemptId":"wfeat-b6a457ad3b1e12c7c2e9a690","generation":3}],"effectId":"00000013-0000-4000-8000-000000000000","stableKey":"[\"00000001-0000-4000-8000-000000000000\",\"00000007-0000-4000-8000-000000000000\",\"00000008-0000-4000-8000-000000000000\",\"review\",1]","businessExecutions":1,"guardedPosts":1,"limitations":"real Core ledger/context/gateway + loopback HTTP; Svc table is a fixture; admission eligibility and quiescence seeded; no live DB/process/production proof"}
ℹ tests 6
ℹ suites 0
ℹ pass 6
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1149.8395
```

### 既有五件套

```sh
node --test packages/production-runtime/test/workflow-owner-assistance-wake.test.js packages/production-runtime/test/owner-assistance-resume-evidence.test.js packages/workflow-execution/test/owner-assistance-resume.test.js packages/workflow-execution/test/owner-assistance-resume-engine.test.js packages/broker/test/capabilities/workflow-execution/owner-obligation.test.js
```

```text
✔ Owner obligation read is a closed, read-only capability (0.69075ms)
✔ managed create uses exact slot + one same-caller detail CAS, preserving original response (26.56375ms)
✔ dependency leaf cannot fork and UNKNOWN cannot write or fall through (8.21075ms)
✔ successful create after RETURN verifies original semantic intent without creating a new effect (8.441208ms)
✔ successful create cannot credit changed business body, target, or unknown arguments (12.776083ms)
✔ managed REVIEW uses actual admission + same-caller detail without inventing DELIVERED (7.142833ms)
✔ managed REVIEW independently rejects each wrong Owner/lineage/proof/CAS and caller collision (56.9145ms)
✔ managed escalation retains explicit stale CAS and the existing business payload (8.403792ms)
✔ own resolve replay uses immutable original proof and explicit old CAS without new ADMISSIBLE (7.515667ms)
✔ own resolve replay rejects changed message, changed allowed descriptor and wrong case (11.885416ms)
✔ own resolve replay cannot synthesize missing proof or trust mismatched immutable lineage (24.566583ms)
✔ a claimed replay must bind the same original command, result and effect (20.073209ms)
✔ only authoritative not-managed permits fallback; opaque 404/storage and malformed relations do not (58.474542ms)
✔ Svc rejection or malformed success is not retried or claimed as success (8.699458ms)
✔ missing resolver for a proven workflow turn fails closed; generic managed assistance cannot bypass (8.689375ms)
✔ read capability rejects extra arguments and invalid UUID before transport (7.661542ms)
✔ unmanaged REVIEW preserves DELIVERED/OUTSTANDING legacy requirement (3.742667ms)
✔ opaque service slot keys are URL encoded, never model selected or concatenated as paths (5.161125ms)
✔ managed and leaf turns cannot open nested assistance through the separate existing request tool (15.719417ms)
✔ existing write manifests preserve managed refusal codes through the child invoke mapper (0.276625ms)
✔ managed INTAKE transition forwards full Context unchanged through existing wire without discovery joins (8.634958ms)
✔ Context omission preserves ordinary and managed transition body, receipt and trusted idempotency (16.051625ms)
✔ present Context rejects null/nonobjects and unknown arguments before HTTP (22.468625ms)
✔ present Context cannot use unmanaged, unproven, stale, stopped or non-INTAKE provenance (46.442041ms)
✔ managed Context preserves actual Svc gate/schema/CAS errors without local guessing or retries (24.582708ms)
✔ direct evidence GET uses fixed route, exact query, and trusted workflow.read bearer token (1.019958ms)
▶ transport, token, non-200, and malformed envelope fail closed
  ✔ token unavailable (0.174667ms)
  ✔ transport failure (0.116375ms)
  ✔ service failure (0.073917ms)
  ✔ extra response field (0.073042ms)
✔ transport, token, non-200, and malformed envelope fail closed (0.80525ms)
✔ governance child review wake carries exact evidence instructions and recipient-bound identity (0.994208ms)
✔ review redelivery uses reviewWakeId even when the same Owner Principal returns (0.176ms)
✔ owner assistance wake resolves exact principal and uses stable inter-agent delivery (0.114125ms)
✔ existing pending/settled caller correlation suppresses duplicate prompt (0.061958ms)
✔ delivery error is accepted only when caller correlation proves admission (0.087458ms)
✔ owner principal resolution failure prevents delivery and stays retryable (0.053792ms)
✔ settled Owner assistance resumes the exact visit once, with a fresh proof and cap bypass (151.947708ms)
✔ unsettled predecessor cannot use Owner evidence or bypass the attempt fence (108.716ms)
▶ pre-plan refuses mismatched current activation identity and terminal instances
  ✔ instance identity (63.502625ms)
  ✔ visit identity (62.847708ms)
  ✔ assignee identity (63.088917ms)
  ✔ terminal instance (61.026375ms)
✔ pre-plan refuses mismatched current activation identity and terminal instances (251.035083ms)
✔ execution-policy Assistance proof is bound to the exact persisted opaque predecessor ID (115.209875ms)
✔ attempt-cap policy assistance preserves the run-ended predecessor and admits one authorized next generation (340.071375ms)
▶ a higher-generation predecessor rejects its superseded policy case and UNKNOWN stays fenced
  ✔ policy evidence bound to a superseded generation cannot resume the latest attempt (148.387ms)
  ✔ run_outcome_unknown does not read Owner evidence or resume (98.580917ms)
✔ a higher-generation predecessor rejects its superseded policy case and UNKNOWN stays fenced (247.659417ms)
✔ planned Owner-resume crash continues the same attempt only on exact never_existed proof (118.847375ms)
✔ planned Owner-resume recheck drift falls through to delivery_unverified without a delivery failure event (121.430958ms)
✔ planned Owner-resume with contradictory never_existed fields is fenced without replay (121.754333ms)
▶ planned Owner-resume stays fenced for pending or unknown Router correlation
  ✔ pending (117.381917ms)
  ✔ unknown (132.384667ms)
  ✔ settled (118.795166ms)
✔ planned Owner-resume stays fenced for pending or unknown Router correlation (369.366542ms)
✔ managed per-Visit cap cannot use the legacy Owner-resume exemption (200.555709ms)
✔ accepts exact current-assignee Assistance proof after the previous attempt baseline (1.24825ms)
✔ accepts execution-policy proof bound to the exact opaque previous attempt (0.092ms)
✔ rejects identity drift, non-active activation, or version drift (0.128375ms)
✔ rejects events outside the previous-baseline and current-version interval (0.087959ms)
✔ ordinary ingress requires current assignee requester and null policy fields (0.100792ms)
✔ policy ingress requires an enumerated reason and persisted previous attempt ID (0.069458ms)
✔ rejects malformed, missing, or extra evidence fields without coercion (0.065125ms)
✔ replay admits one Owner-resume generation with complete settled predecessor and preserves the consumed case (0.345208ms)
✔ replay refuses an Owner-resume plan against unknown, unsettled, or mismatched predecessor (0.273042ms)
✔ replay refuses a reused case ID and malformed Owner proof on a later generation (0.268083ms)
ℹ tests 67
ℹ suites 0
ℹ pass 67
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2199.965875
```
