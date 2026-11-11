# 合同式交办：stage_05b 结算脚本 D-009 对齐 + 零-inflight 前置工具

## 权威输入
1. docs/specs/AGENT_DELIVERY_RESILIENCE_D009_ALIGNMENT_V1.md（main @ 76b9f9f9 已合）——三态语义权威
2. /tmp/settle-all-pending.mjs（现状参考，2260B，Nov 3 版）
3. gh issue view 527 --repo mayf3/dsh-agent-core ——D-009 裁定评论

## 任务（branch chore/fleet-window-tools 续）
1. **scripts/fleet-window/settle_unresolved_runtime_down.mjs**（新文件，替代 /tmp 版）：
   - 仅结算 initialOutcome==='outcome_unknown' 且终止证据可信（child_real_exit，stage_05 进程退出证明）
     → settleLate(terminated_without_outcome, child_real_exit)
   - **删除 blanket settleDirect(failed) 分支**——非 unknown 记录不动（由重启后 runtime 自身 reconcile 按 D-009 处理）
   - 无证据/不可信 → 零写 UNKNOWN（保留记录）
   - 保留 worker 全灭 ps 证据门 + writeDurableRecoveryStore + exit 5 语义
   - 模块导入路径改为参数化（--source-root），不再硬编码 file:///tmp/...
2. **scripts/fleet-window/precheck_zero_inflight.mjs**（新文件）：standalone 零-inflight 核验——
   复用 census 的 readRestartDrainCensus（同 turnRecoveryStore/jobsStore 路径来源：/Users/authsvc/.agent-core/control/
   与 prod scheduler/jobs.json），输出 {inflightTurns, unresolvedLostTurns, inflightOccurrences} 三列表 + exit 码
   （全空=0 / 非空=1）。只读。
3. **执行器 stage_05b**：脚本路径改 Git 版 + 注释语义更正为"per AGENT_DELIVERY_RESILIENCE_D009_ALIGNMENT_V1"
4. 合成测试（/usr/local/v5-boot-isolation/settle-test/）：合成 fixture store 三场景
   （unknown+可信终止→terminated_without_outcome / 非 unknown→不动 / 无证据→零写）全 PASS
5. commit + push + PR；**不 merge**；零生产接触（合成 store 测试不碰真实 /Users/authsvc store）

## 红线
生产 store 只读（合成测试用 fixture 副本）；15 节点其余逻辑不动；失败即停写 STOPPED-SETTLE.md
## 回执（RECEIPT-SETTLE.md）
两脚本 diff、三场景合成测试输出、执行器 diff、UNKNOWN

## PREFLIGHT (2026-11-04)

- schema_version: 2; mode: PREFLIGHT; route: REUSE / BRIEF / DURABLE / IMPLEMENTATION.
- Repository/worktree/ref: mayf3/dsh-agent-core, /private/tmp/dsh-fleet-window-tools,
  chore/fleet-window-tools; BASE_HEAD = b40a495dce664b4f95463849f8937e08c8c072f6.
- PRIMARY_AUTHORITY: accepted AGENT_DELIVERY_RESILIENCE_D009_ALIGNMENT_V1
  CTR-527D2-002/003/004 in base; parent D-009; implementation_authority=contracts.
- Mutation mandate: user's contract above. Source + isolated fixtures + commit/push/PR only.
  Production operation and merge prohibited. Isolated write surface: this worktree and
  /usr/local/v5-boot-isolation/settle-test/; production stores will not be opened.
- CURRENT_GAP: old external script blanket-fails non-unknown records, assumes termination,
  constructs a recovery-writing store and always persists. Stage_05b cites reversed semantics.
- Evidence gate: fresh stage_05 old-exit + matching post-bootout store hash/epoch;
  current ps must show all recorded PIDs and worker-like processes absent. Each selected
  record additionally needs its own durable exact child_real_exit observation, not a bare label.
- Model convergence: MIGRATE stage_05b to Git script; RETAIN /tmp original as history only.
  Discovered quiet branch still invokes old script before shutdown: dependent disposition
  pending user's scope clarification; no silent change to another node.
- SPEC_GAP_DEPENDENCY=NONE; IMPLEMENTATION_ALLOWED=YES; OPERATION_ALLOWED=NO;
  MERGE_READY=NO (user explicitly prohibits merge); independent semantic review required.
- EVIDENCE_NEEDED: three synthetic scenarios, mixed-store immutable rows, worker/invalid-proof
  refusal, census three-list exit checks, syntax, isolated existing selftest, governance/structure.
- DONE_WHEN: focused checks PASS, independent affected-contract review PASS, receipt,
  commit/push and open unmerged PR. UNKNOWN: production execution and business outcomes.
- EXPANSION_TRIGGER: authority conflict, semantic/test failure, production access or unrelated
  node change. Any verification failure stops writes except STOPPED-SETTLE.md/evidence.
