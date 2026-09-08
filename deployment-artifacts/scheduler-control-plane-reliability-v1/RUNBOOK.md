# SCHEDULER_CONTROL_PLANE_RELIABILITY_V1 — PRODUCTION DEPLOYMENT RUNBOOK (FROZEN TEMPLATE)

> status: **READY_FOR_PRODUCTION_SLOT** — 本 runbook 是冻结的执行模板。**任何 §3 步骤都不得在
> P0（WORKFLOW_ASSIGNEE_CANONICAL_IDENTITY_RECONCILIATION_V1）释放生产 slot 之前执行**
> （PRODUCTION_MUTATION_CONCURRENCY = 1）。执行前提 = Owner 显式释放 + §1 fresh census 全 PASS。
> Source authority: docs/specs/SCHEDULER_CONTROL_PLANE_RELIABILITY_V1.md（accepted，RE-AUDIT ACCEPT）。
> 执行轮必须随 Owner 输入补齐 §0 的三个占位符后再冻结执行副本。

## §0 Frozen constants（执行轮以 fresh census 复核后钉死）

```text
LIVE_ROOT                = /usr/local/libexec/agent-core/app        （canonical 生产树；唯一部署目标）
RUNTIME_LABEL            = system 域 launchd ai.agent-core.runtime（user authsvc；--catchup 0）
AUTHORITATIVE_STORE      = /Users/authsvc/.agent-core/scheduler/jobs.json（V2）
CLI_INSTALL_PATH         = /usr/local/bin/agentcore-cron            （现状=symlink→dev worktree 旧字节，SB4 待修）
CLI_PINNED_TARGET        = /usr/local/libexec/agent-core/app/scripts/agentcore-cron.mjs
CLI_EXPECTED_STORE_ENV   = AGENTCORE_EXPECTED_STORE=/Users/authsvc/.agent-core/scheduler/jobs.json
EVIDENCE_CHANNEL         = SCHEDULER_RECONCILIATION_EVIDENCE_FILE=
                           /usr/local/var/scheduler-watchdog/reconciliation-evidence.jsonl
WATCHDOG_STATE_DIR       = /Users/authsvc/.agent-core/control/scheduler-watchdog（W1/W2 共享，§5.7 互检）
DESIRED_STATE_PATH       = /usr/local/libexec/agent-core/config/scheduler-desired-state.json
W1_PLIST / W2_PLIST      = deployment-artifacts/scheduler-control-plane-reliability-v1/*.plist.tmpl
__OWNER_CHAT_ID__        = <Owner 飞书 chat id —— 执行轮 Owner 提供>
__CRITICAL_INVENTORY__   = <critical jobs + logicalKey 方案 —— 执行轮 Owner 评审冻结>
__MERGE_SHA__            = <source merge commit —— merge 后回填>
```

## §1 Preconditions（全部 PASS 才准进 §3）

1. **SLOT**：Owner 显式宣布 P0 释放（PRODUCTION_MUTATION_CONCURRENCY=1 空闲）。
2. **FRESH CENSUS（只读）**：`launchctl print system/ai.agent-core.runtime`（state/pid/--catchup 0/
   env 基线含 AGENT_CORE_CREDENTIALS_FILE）；store raw 读（version:2、jobs 计数、无 .lock/.tmp 残留）；
   当前 `/usr/local/bin/agentcore-cron` 解析目标 + sha（记录 SB4 前像）；live app manifest sha 基线。
3. **SOURCE**：`__MERGE_SHA__` 处 suites 全绿（scheduler/broker/scheduler-router）+ audit ACCEPT（已具备）。
4. **OWNER INPUTS**：__OWNER_CHAT_ID__、__CRITICAL_INVENTORY__（含存量 22 jobs 的 logicalKey 回填方案，
   建议 `<agentId>:<name>`，由 Owner 逐条评审）。

## §3 Apply sequence（顺序不可调换；每步留 preimage）

1. **逻辑键回填（一次性、audited）**：Owner 授权 sudo 下，以 authsvc 身份运行一次性脚本
   （临时 artifact，packet 轮按 __CRITICAL_INVENTORY__ 生成）——经 `updateJobOp`（同锁同 op 面）
   逐 job 写入 logicalKey；前后 sha256 入 runs.jsonl（self_service_mutation 审计模式）；
   完成后 canonical read-back 全量核对 22/22。
2. **desired-state 冻结**：按 __CRITICAL_INVENTORY__ 写 `DESIRED_STATE_PATH`（authsvc 属主 0444）；
   sha256 记入 packet。
3. **source overlay**：按 scheduler-v2-deploy-target-v1 的 blob-pinned 原子 overlay 机制，把
   `__MERGE_SHA__` 相对 live 基线的 delta（broker readiness/gateway/relay/validation/manifest +
   scheduler control/job-model/self-service/watchdog + scripts/agentcore-cron.mjs + scheduler-watchdog.mjs）
   逐文件 temp+rename 替换（保持 mode/uid/gid）；preservation manifest 覆盖其余全部文件。
4. **plist env 增补 + 一次重启**：runtime plist 增 `AGENTCORE_EXPECTED_STORE`（供 CLI 守卫继承）与
   `SCHEDULER_RECONCILIATION_EVIDENCE_FILE`（child uid 502 可写、authsvc 可读）；plist preimage 备份；
   `sudo launchctl kickstart -k system/ai.agent-core.runtime`；health 等待。
5. **CLI 钉死（SB4 闭环）**：备份旧 symlink 指向（前像=dev worktree 旧字节）；重定
   `/usr/local/bin/agentcore-cron → CLI_PINNED_TARGET`；`shasum` == `__MERGE_SHA__` 版本字节 →
   **CLI_BYTES_MATCH_EXPECTED** 门。
6. **watchdog 供给面**：以 authsvc 预创建 `WATCHDOG_STATE_DIR`（先于任何 RunAtLoad——root 先建会导致
   W1 不可写）；预创建 evidence-channel 目录（dedicated group，收紧 0777 占位）。
7. **watchdog 安装**：由 §0 模板实例化两份 plist（`__OWNER_CHAT_ID__` 填入；W1 grace=2700000ms、
   W2 grace=1800000ms），`sudo launchctl bootstrap system` 各自加载；观察互检心跳文件生成。
8. **证据通道 env 生效验证**：以 scratch store 设 `SCHEDULER_RECONCILIATION_EVIDENCE_FILE` 手工触发
   一次 STILL_UNKNOWN 路径（--dry-run 式）确认文件落行。

## §5 Verification gates（全 PASS 才算部署成功）

- **G1 runtime**：新 pid、env 四值+新增两值在位、health 200 `ok:true`、logs 无 fatal。
- **G2 readiness（live）**：无 credential provider 的用户域 child 视图中 scheduler mutation 工具被
  扣除（或调用回 `capability_unavailable`）；canonical child 的 create 正常。
- **G3 CLI 三门**：`CLI_BYTES_MATCH_EXPECTED`（§3.5）；`CLI_STORE_TARGET=CANONICAL`——以非 authsvc
  身份+AGENTCORE_EXPECTED_STORE 跑 add → 拒绝且零建库（负例）；`CLI_MUTATION_SEMANTICS_MATCH_BROKER`
  ——scratch store 上 add→add(replay)=already applied→单 job→conflict exit1。
- **G4 canary（生产、有界）**：真实 agent 经 broker create（logical_key=canary 标记）→ 直回 jobId；
  同 key 重放 → 成功 + 审计 `alreadyApplied:true` + store 恒 1；冲突 payload → logical_key_conflict；
  完毕删除 canary（remove + 证据留存）。
- **G5 watchdog**：W1/W2 心跳互见；手工 W2 停止演练 → W1 告警 → 恢复；**scheduler-down 演练不触碰
  生产**——以 `HEALTH_URL=http://127.0.0.1:1` 手工单跑 w1 证明 UNHEALTHY 告警路径；evidence jsonl
  出现行。
- **G6 八问终检**：spec §6 的 CAN_*_SILENTLY 八项以 G1–G5 证据逐条勾销。

## §4 Rollback（任一步失败/中断即入）

| 步骤 | preimage |
|---|---|
| §3.1 回填 | 逐 job 反向写回（logicalKey 删除经 updateJobOp），审计同模式 |
| §3.2 manifest | 移除 DESIRED_STATE_PATH 文件（注意：W1 会转 UNHEALTHY 提示——回滚含 bootout W1/W2，见下） |
| §3.3 overlay | 全量备份（BASE manifest 校验）→ 逐文件 temp+rename 还原 → TARGET 校验 |
| §3.4 plist | preimage 还原 + `kickstart -k` |
| §3.5 CLI | symlink 指回前像目标 + sha 复核（回到 SB4 前状态意味着 SB4 重新 OPEN——须 Owner 记录） |
| §3.7 watchdog | `launchctl bootout system/…` 两个 label + 删 plist + 清 state dir（恢复部署前静默） |
| store | **永不回滚 store 文件**（V2 occurrences 是证据）；仅逻辑反向 |

## §6 Forbidden（执行轮）

不直写 jobs.json（一切经 control ops/锁）；不跑 catch-up；不建第二 credential 路径（不给用户域
runtime 复制凭据）；不修改 occurrence/run 语义；SECRET_OUTPUT=NO；P0 未释放不得执行 §3 任何步骤。

---

## §7 EXECUTED RECORD (2026-09-08, PRODUCTION_ADOPTION complete)

Admission executed via scripts/scheduler-cp-admission.mjs (PR #204/#205/#207/#208, terminal receipt:
/Users/yanfenma/workspace/artifacts/production-candidates/SCHEDULER_CONTROL_PLANE_RELIABILITY_V1-admission/terminal-receipt.json).

Deviations from the frozen template (all recorded, none silent):
1. §3.5 executed as a NEW SEALED OPERATOR GENERATION
   (SCHEDULER_CONTROL_PLANE_RELIABILITY_V1--dsh-agent-core--db93649--x86_64--g1, full ESM closure +
   vendored croner, atomic flip, cutover receipt) — the operator surface moved to the stage-isolation
   sealed-generation system after this RUNBOOK froze; generation flip is mechanically stronger than the
   planned symlink repoint. First apply crashed the engine via the full-diff overlay
   (model-overrides v3-strict vs host v1 config — Model Fleet migration dependency, NOT this goal's
   authority); RUNBOOK §4 preimage rollback RESTORED SERVICE (evidence: boot-failure-runtime-err.tail),
   then the overlay universe was narrowed to packages/broker/** ∪ packages/scheduler/** ∪ the watchdog
   script with a fail-closed import-closure check (2026-09-09 amendment).
2. Critical predicates anchored on FROZEN RECOVERY-LEDGER ID PREFIXES after the guard's
   FAILED_NO_MUTATION on ambiguity: daily=fa13b0ea…, hr=b115cb96… (the store holds two same-agent
   same-cron enabled jobs; attribute matching retired as ambiguous-by-reality). The guard refusing
   WAS the design working.
3. §3.1 backfill executed for the two criticals only (audited, revision-invariant asserted, store
   ownership restored to authsvc after the root-run write).
4. Owner inputs consumed: alert chat DERIVED from the critical daily job's persisted delivery.to
   (directive A — no Owner ask); critical inventory = the directive-named two as CRITICAL_PRODUCTION
   with the full 23-job census classified (NORMAL 13 / DISABLED_INTENTIONAL 4 / none UNKNOWN —
   full table in the admission commit PR #207); ONE consolidated sudo gate total.

Post-adoption state: overlay 0-diff (converged), health ok, operator bytes 98a2a031… == sealed,
W1/W2 installed and scheduled (mutual heartbeat), evidence channel provisioned.
POST-TERMINAL NATURAL VERIFICATION (non-blocking): first W1/W2 fire (≤15m from install) and the
22:00 daily job run through the monitored pipeline tonight — healthy silence is the success signal;
any real failure now fires the live alert path (Feishu direct → Owner chat; park-file fallback).
