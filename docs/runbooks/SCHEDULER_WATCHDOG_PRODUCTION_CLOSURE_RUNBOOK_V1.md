# SCHEDULER_WATCHDOG_PRODUCTION_CLOSURE_RUNBOOK_V1

Goal: RESTORE_BUILD_IN_PUBLIC_END_TO_END（North Star）。Source 阶段已闭合（main=95a8c9664c9e36f163a0077ef70ee2c75bc7b3a9：writer defect 54b4342 + NO_SILENT_SLOT_LOSS 95a8c96）。本 runbook 冻结 designation 到手后的**全部**执行坐标；除 §0 的 Owner 决策外不返回请求 approval。SOURCE_FIXED != PRODUCTION_FIXED，四旗不齐不宣称 Goal 完成。

**SOURCE merge ≠ PRODUCTION DEPLOY。本文件零生产变更。**

## §0 唯一 Owner 决策（当前 blocker）

```text
CANONICAL_SCHEDULER_OPS_TARGET = { "channel": "feishu", "to": "<OWNER 指定的专用 Scheduler ops chat_id>" }
VALID_EXISTING_CANDIDATE_COUNT=0 → 不得用 business delivery target / current chat / last-active chat 兜底
```

## §1 Protected routing input（root 执行，mode 0600）

```bash
umask 077
cat > /usr/local/libexec/agent-core/config/scheduler-routing-candidate.json <<'EOF'
{
  "version": 1,
  "canonicalOpsTarget": { "channel": "feishu", "to": "<§0 chat_id>" },
  "ownerTargets": {},
  "jobFailureTargets": {}
}
EOF
chown root:wheel /usr/local/libexec/agent-core/config/scheduler-routing-candidate.json
chmod 0600 /usr/local/libexec/agent-core/config/scheduler-routing-candidate.json
shasum -a 256 /usr/local/libexec/agent-core/config/scheduler-routing-candidate.json   # = EXPECTED_CANDIDATE_SHA256，冻结
```

Enrichment 门（机械）：对 production store 每个 `enabled:true` 的 job，`resolveNotificationRoute(JOB_FAILURE)` 必须命中（jobFailureTargets 显式 → ownerTargets[agentId] → canonicalOpsTarget）。任何 enabled job 无路由 = ENRICHMENT_NOT_COMPLETE，禁止 apply（需要时把 agentId→chat 加进 ownerTargets 再冻结）。

## §2 Exact apply coordinates（apply 时冻结为本节参数）

```text
candidatePath   = /usr/local/libexec/agent-core/config/scheduler-routing-candidate.json
expectedSha256  = <§1 冻结值>
targetPath      = /Users/authsvc/.agent-core/scheduler/routing.json     (layout.schedulerRoutingManifest)
expectedUid     = 0          expectedGid = <SCHEDULER_ROUTING_READER_GID，即 runtime 可读 gid>
targetBoundary  = /          mode = plan → apply
artifactsDir    = <本次部署 deployment-artifacts 目录>（rollback/ 内出 preimage + routing-install-receipt.json）
```

调用 `installSchedulerRoutingManifest`（packages/production-runtime/src/scheduler/deployment-routing.js）：
plan（零写入）读回 candidateSha256==expectedSha256 与 preimageSha256 → apply → readback：receipt.status=INSTALLED、target uid/gid/0640、targetSha256==candidateSha256。

## §3 Fresh production transaction safety check（apply 前一步内 fresh 执行；任一 NO/MISMATCH = FAIL_CLOSED NO APPLY）

```text
ROOT_PRODUCTION_TRANSACTION_SLOT=FREE        （近 60min svc receipts/audits/events + HR workspace 无新 mutation）
SCHEDULER_PRODUCTION_MUTATION_SLOT=FREE
NO_CONFLICTING_SCHEDULER_TRANSACTION=YES
EXPECTED_DEPLOYED_SHA          == 95a8c9664c9e36f163a0077ef70ee2c75bc7b3a9 所在部署代
EXPECTED_RUNTIME_GENERATION    == <apply 时实读>
EXPECTED_STORE_GENERATION      == <apply 时实读>
EXPECTED_STORE_SHA256          == <jobs.json 实读 sha>
EXPECTED_ROUTING_TARGET_HASH   == <routing.json 实读 sha / null(pre-installed)>
```

## §4 Deploy current main（Owner slot 执行既有部署通道）

部署含 95a8c96 的 main 生成（既有 canonical runtime 部署机制不变）；本 goal 不新开 deploy 工具。

## §5 Runtime/readiness readback

`assertSchedulerStartupReady`（health.complete==true）+ health provenance（store/routing sha）+ W1 evidence `w1_run` 正常 + routing readback（`readProtectedRoutingManifest` uid 0 / gid / 0640）。

## §6 Build in Public Scheduler 验收（不以 deployment succeeded 为验收）

1. 创建/选取真实 BIP scheduled job（既有 BIP 链路）。
2. 到达真实 due slot。
3. `slot_accounting` / occurrence 必须给出 durable disposition：
   - 正常：occurrence created → invocation → execution（runs.jsonl occurrence_reserved/outcome 全链）。
   - 未正常：owning Agent 从飞书调 `self_ops.job_disposition`，必须回答 expectedSlot / slotClassification / LAST_PROVEN_STAGE / FIRST_MISSING_STAGE / durableReason / recommendedSafeAction。
4. 禁止再现：runs=0 + error=none + nextRun 跳明天 + 无人知道昨晚发生了什么。

## §7 既有 outcome_unknown / fenced occurrences

仅 termination proof 足够（Router 当前 readback 证据 + 严格终止证明）的 occurrence：owning Agent 飞书内 `self_ops.reconcile_turn` → persisted receipt readback → fence release → 下一 future natural slot 真实运行。证据不足继续 quarantine（含 occ:0f774c6c7a36f5a3 —— 不因任何 merge/部署获得强行 unfence）。NO_BLIND_RETRY / NO_RAW_STORE_EDIT。

## §8 终局四旗（全 YES 才许宣称 Scheduler Goal 完成）

```text
BUILD_IN_PUBLIC_SCHEDULER_READY=YES
DUE_SLOT_SILENTLY_LOST=NO
MISSED_RUN_EXPLAINABLE_FROM_FEISHU=YES
SAFE_RECOVERY_FROM_FEISHU=YES
REAL_FUTURE_SLOT_EXECUTION=PASS
```

## §9 冻结（本 runbook 生效期间）

暂停：retention 优化、新 contract 研究、额外 fault taxonomy、非 BIP blocker 的 Scheduler debt。
