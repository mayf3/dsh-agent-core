# BRIEF-605-R2 — 兼容 reader + writer guard 实现（换基重启, 前置条件已满足）

授权: Owner 裁定②(#605产品lane)+常设预授权V1§1。原任务书: /private/tmp/h605-compat/BRIEF-605-COMPAT.md(可只读); 先前停点: /private/tmp/h605-compat/STOPPED-605-COMPAT.md(三段, 可只读)。
工作面: 本worktree(detach @ 新main 4f7df01b, 含V3链+#644)。零生产写入。停止条件: 失败即停写STOPPED-605-R2.md。

## 前置条件核验(先做, 换基的理由)
原停点卡在: TE_V1格式更正门rc1(base校验器仅支持dict)。**该前置现已在main闭合**: #642合并(489ce93b)携带rc.3分发(校验器支持list[dict])+TE_V1已更正并superseded(V3 governing, 双向回链)。先核验此状态(git show/grep坐标), PASS后进入实现; 若发现与预期不符如实停。

## 任务(按原任务书验证矩阵)
1. **兼容reader**: durable decoder对畸形三态记录(state=blocked/queryState=pending/fenceState=cleared, initOutcome=outcome_unknown, exitObservedAt/terminationEvidence/settlementResult=null)不再拒绝——解码为明确需处置态; 不伪造业务结果, UNKNOWN如实保留; 不replay不清fence。
2. **writer guard**: markFenceCleared 增加 settlement/termination 证据 guard(缺证据拒绝; 与D-009三态对齐); 现有唯一调用方releaseFence语义复核。
3. **验证矩阵**(用真实脱敏副本 /private/tmp/w6-state-compat-readable/sanitized/, 只读输入+哈希在案): 解码/冷启动/重启/Agent隔离/旧操作无replay/负向持久化/回滚——逐项rc与原文。
4. 已知靶点记录(先前只读分析): admission跳过cleared记录; 3条异常在idx 5124/5125/5127(agt_needs-radar/lobster/agent-dev-engineer)。
5. 测试: 新增针对性用例+相关既有套件rc0(node --test文件展开配方; Node v26.7.0目录参数陷阱: 目录位置参数会被当模块require; 噪声: stale-quiescence版本敏感断言不计门)。
6. 交付: 分支fix/compat-reader-writer-guard(自本base), push开PR(base main)不合并; RECEIPT-605-R2.md(DONE_WHEN对照原任务书+矩阵逐项rc原文+变更清单+HEAD SHA+未交付面如实)。
# Execution preflight (2026-11-07)

REPOSITORY=mayf3/dsh-agent-core; BASE=4f7df01bcf087075c114901a96a7a54573110f61;
BRANCH=fix/compat-reader-writer-guard; isolated worktree=/private/tmp/h605-r2.
Owner's current task and original BRIEF-605-COMPAT.md authorize source/tests,
sanitized-copy validation, receipt, push and unmerged PR only.

SPEC_GOVERNANCE_MODE=PREFLIGHT; ROUTE_STAGE=IMPLEMENTATION;
AUTHORITY_ACTION=REUSE; AUTHORITY_ACCEPTED_IN_BASE=YES;
PRIMARY_AUTHORITY=AGENT_PROCESS_LIFECYCLE_HARDENING_V4 C-015/C-016/C-019/C-025;
RELATED_AUTHORITIES=D-009, SCHEDULER_TIMEOUT_OUTCOME_V3,
AGENT_PROCESS_ADMIN_TURN_ABANDONMENT_V1 C1-C5/D6,
HR_RESTART_LOST_FENCE_TRUSTED_RECOVERY_SPEC_V2;
IMPLEMENTATION_AUTHORITY=contracts; PLAN_LEVEL=BRIEF; ASSURANCE_LEVEL=DURABLE;
EXECUTION_MANDATE=VALID; MUTATION_AUTHORIZATION=VALID;
ISOLATED_WRITE_SURFACE=YES; SPEC_GAP_DEPENDENCY=NONE;
EVIDENCE_REVIEWABILITY=PASS; LIVE_AUTHORITY_GAP=NONE;
IMPLEMENTATION_ALLOWED=YES; MERGE_READY=NO-pending-independent-product-review;
OPERATION_ALLOWED=NO; NEXT_ACTION=CONTINUE.

Prerequisite: #642 merge 489ce93b is an ancestor; rc.3 lock is accepted;
TE_V1 supersedes=[]/superseded_by=V3 and reciprocal V3 predecessors exist.
Fresh GitHub readback #642 issuecomment-6701773166 confirms final independent
review and merge; historical PENDING_REGULATOR is not a new pending gate.

Model convergence: RETAIN one V3 durable store and its supported format. The
compatibility predicate recognizes an exact historical invalid tuple, adds only
a read projection, and neither creates a second executable model nor migrates
the original facts. Admin markers are preserved, not promoted to termination.
No production read/write, replay, clear, settlement, release or merge is allowed.
DONE_WHEN=current brief delivery plus original seven-row matrix and regression
evidence; independent regulator-assigned review remains a separate acceptance
gate. Any failed required gate stops this run in STOPPED-605-R2.md.

## R3 authorized resume — 2026-11-07

Owner's current R3 task authorizes stashing this exact diff, three runs of the
recorded failing test on clean base 4f7df01b, restoring the diff, and completing
the existing delivery. A clean-base failure may be annotated pre-existing;
three clean-base passes require regression classification and a reader repair,
without changing tests to accommodate it. Other required-gate failures still
stop delivery. Production operations and merge remain forbidden.

Stash 0843eb7a3c8add0b6b1900a39d7553865c755bc9 restored all ten original file
hashes exactly. All three exact-test clean-base runs returned rc0. Thus
MANDATE_CLASSIFICATION=REGRESSION, PRE_EXISTING_EXEMPTION=NO.
The historical "25ms prompt deadline" wording is inaccurate: 25ms is the
caller wait bound, while the pre-write minimum is the configured 70ms turn
deadline (receipt budget is 250ms). Two synchronous durable writes, each with
file and directory fsync, occur after its anchor and before the request.

External instrumentation did not reproduce the historical pre-write expiry:
base/candidate requests retained 51ms/54ms respectively; admission reads took
0.00525ms/0.020709ms inside that interval. The historical slow operation cannot
be isolated retrospectively; causal attribution to reader vs filesystem timing
remains unproven. This does not justify a pre-existing exemption.

Bounded reader repair: retain the original Agent/UNKNOWN admission filters
before evaluating compatibility, and evaluate the legacy predicate only for
cleared UNKNOWN records. Ordinary admission does not enter the added legacy
decoder; durable/query predicate also short-circuits ordinary records. No test,
deadline, durability, settlement or termination requirement is relaxed by R3.
Subsequent executed results, evidence hashes and the causal limitation belong
in RECEIPT-605-R2.md. The R2 STOPPED record remains historical and unchanged.

## R4 supervisory resume — 2026-11-07

AUTHORIZATION_COORDINATE = current Owner message headed
`R4续派(监管裁定, 选项a通用规则)` in this task; verbatim decision:
“枚举校验失败的任意值(含脱敏占位/未知标记/损坏值)一律解码为'不可验证历史'类记录
(显式marker+UNKNOWN如实保留+零伪造'admitted'), 只要记录结构上可用于处置即解码成功;
结构性损坏至不可处置的仍fail loud。” No literal-specific coupling is authorized.

Coordinates remain base/head/main=4f7df01bcf087075c114901a96a7a54573110f61,
isolated branch/worktree above; fresh ls-remote confirms main unchanged.
R3 regression attribution and 42/42 rc0 are accepted; no baseline rerun.
R4 extends the compatible read projection to Scheduler history enum failures.
REUSE + BRIEF + DURABLE; ROUTE_STAGE=IMPLEMENTATION;
AUTHORITY_ACCEPTED_IN_BASE=YES; IMPLEMENTATION_ALLOWED=YES;
PRIMARY_AUTHORITY=SCHEDULER_TIMEOUT_OUTCOME_V3 C-021/C-022/C-027/C-028;
RELATED_AUTHORITY=D-009 sections 8.3/8.4; existing Router authorities above.
No governing Contract is changed: the compatible projection is explicitly
unverifiable, never validated execution authority. Strict writer validation
retains C-022 corruption rejection. Preserve raw history, current outcome,
settlement evidence and fences; marker cannot authorize execution or mutation.
Model disposition=RETAIN one canonical store and supported read facade, no
alternate ledger, migration, placeholder mapping or invented history.
SPEC_GAP_DEPENDENCY=NONE; LIVE_AUTHORITY_GAP=NONE; MERGE_READY=NO;
OPERATION_ALLOWED=NO; EVIDENCE_REVIEWABILITY=PASS.
DONE_WHEN=targeted non-enum-to cases, seven matrix rows with raw rc/output,
full Router/Scheduler/Scheduler-Router rc0, independent affected-delta review,
receipt including R3/R4 coordinates, commit/push and unmerged PR against main.
EXPANSION_TRIGGER=any required-gate failure or concrete authority conflict;
NEXT_REAL_ACTION=implement the read-only unverifiable-history projection;
NEXT_ACTION=CONTINUE. Failures still stop immediately and update STOPPED.

## R5 diagnostic-first authorized resume — 2026-11-07

Owner's R5 message authorizes structured before/after attribution first, then
legal persistence continuation or a bounded reader/guard repair, seven matrix
rows with raw rc/output, full suites rc0, commit/push and unmerged PR on main.
Same isolated branch/base; REUSE + BRIEF + DURABLE; implementation only.
The existing R4 stop is resumed by this mandate, not silently discarded.

R4 teardown deleted its after file. R5 retains a fresh exact-constructor replay
and both snapshots under /private/tmp/h605-r5-evidence. Its time-dependent after
hash differs from R4; do not claim recovery of the deleted historical bytes.
Structured diff finds 255 leaf changes: root epoch 1; epoch-list positions 180
(one new epoch, one unreferenced epoch removed at cap 256); updatedAt 1 for an
already settled/blocked/active record; derived byte counts 66; answer digests 7
erased to null. Protected three records and 5227 identities remain unchanged.

CLASSIFICATION=b, evidence loss. D-009 sections 8.3/8.4/10.2 and Router V4
C-017/C-018/C-BOUNDED require retaining UNKNOWN, history and terminal evidence;
the original Brief requires cold startup and protected facts, not whole-file
equality. Repair only durableRecord's digest round-trip; preserve validated
existing hashes when answer text is absent. Epoch/capacity bookkeeping is not
business settlement. No production effect, fence release, replay or merge.
Matrix continuation uses the retained diagnostic copy after restoring its
known before image and opening with repaired code; all following rows reuse
that same copy. A new required-gate failure still stops and updates STOPPED.
Independent affected-delta/final-Head review remains required; regulator's
assigned product acceptance remains separate. NEXT_ACTION=CONTINUE.

## R6 helper-only resume — 2026-11-07

Owner's current R6 message explicitly authorizes repairing the overstrict audit
helper, then cold-start, remaining five matrix rows, full suites, commit/push
and an unmerged PR against main. R5 digest repair and its 48/48/decode evidence
remain valid; no product-code delta is authorized or needed for this repair.
REUSE + BRIEF + DURABLE; ROUTE_STAGE=IMPLEMENTATION; same isolated branch/base;
IMPLEMENTATION_ALLOWED=YES; MERGE_READY=NO-pending-review; OPERATION_ALLOWED=NO.
Append-only here includes the existing tail ring: logical append, dropping only
the oldest audit prefix at its accepted cap, with retained entries unchanged.
Router V4 CLAUSE-PROC-BOUNDED :1420-1421/:1433 defines 32 entries / 65536 UTF-8
JSON bytes per record; C-019 :1356-1378 defines audit fields/startup behavior.
Original task :7-10/:19-20/:29 protects records/UNKNOWN and requires the matrix;
D-009 :574-588/:663-695 preserves business facts; its :699-711 10 MB bound is
Scheduler runs.jsonl, not the Router action ring. No new bound is invented.
Reject unbounded audit, retained-entry rewrite/reorder, business-field changes
and record deletion. Preserve full three protected records exactly.
CURRENT_BASE_HEAD=1ff1e81cbd74a51761dab46a5fcee532c41fe4ed (fresh fetch);
BASE_IMPACT=BOUNDED: only six unrelated verifier-adaptation files, no affected
authority or Router/Scheduler changes. No rebase or product repair expansion.
New required-gate failure still stops immediately; no retry after that failure.
DONE_WHEN=original delivery and complete receipt with raw row rc/output,
R5(b)/helper coordinates and independent affected-delta/final-Head review.
NEXT_REAL_ACTION=repair helper, then execute cold-start and remaining gates;
NEXT_ACTION=CONTINUE; SPEC_GAP_DEPENDENCY=NONE; LIVE_AUTHORITY_GAP=NONE.

## R7 attribution-first authorized resume — 2026-11-07

Owner's current R7 message authorizes: locate the 10 R6 failures first; stash
all current changes; run each exact failing case once on clean base 4f7df01b;
classify clean-base failures as pre-existing with raw comparative evidence and
exclude only those from delivery gates; classify clean passes as regressions,
repair implementation without accommodating tests; then stash pop and complete
affected Scheduler/Router suites, commit, push, and unmerged PR against main.
R6 helper (32 entries / 65536 bytes), seven-row matrix and data preservation
evidence remain retained. All other required failures still stop immediately.

SPEC_GOVERNANCE_MODE=PREFLIGHT; ROUTE_STAGE=IMPLEMENTATION;
AUTHORITY_ACTION=REUSE; PLAN_LEVEL=BRIEF; ASSURANCE_LEVEL=DURABLE;
AUTHORITY_ACCEPTED_IN_BASE=YES; IMPLEMENTATION_AUTHORITY=contracts;
PRIMARY_AUTHORITY and related Contracts remain the accepted base authorities
listed above. BASE_HEAD=REVIEW_TARGET_HEAD=4f7df01bcf087075c114901a96a7a54573110f61
plus recorded uncommitted delta; isolated surface and branch unchanged.
MUTATION_AUTHORIZATION=VALID(current Owner R7); IMPLEMENTATION_ALLOWED=YES;
MERGE_READY=NO; OPERATION_ALLOWED=NO; SPEC_GAP_DEPENDENCY=NONE;
EVIDENCE_REVIEWABILITY=PASS; LIVE_AUTHORITY_GAP=NONE.
CURRENT_GAP=10 unclassified R6 failures and remaining full-suite/delivery gates.
DONE_WHEN=exact attribution table/raw evidence, restored diff, affected required
suites rc0 after only Owner-authorized pre-existing exclusions, independent
affected/final-Head review, commit/push/unmerged main PR and completed receipt.
EXPANSION_TRIGGER=new non-exempt required failure, concrete regression or
authority conflict. No production operation, replay, deployment, or merge.
NEXT_ACTION=CONTINUE; NEXT_REAL_ACTION=save hashes, stash, exact baseline runs.


R7 executed attribution:10/10 exact clean-base rc1, matching original failures;
classification pre-existing per Owner; stash pop restored all23 file hashes.
No product regression repair was needed. All affected suites passed after exact
exclusions. Before structure verification, five unchanged compatibility cases
were consolidated into existing occurrence-model.test.js (320 lines), retaining
Scheduler test child-set21 and unchanged baseline width debt. This is bounded
packaging under existing mandate, independently reviewed; no rule/test weakening.
Final Scheduler rerun rc0; qualified main1ff1e81c structure gate rc0 with baseline
debt visible; see RECEIPT and docs/evidence/605-r7 for exact evidence.
