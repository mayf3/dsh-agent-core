# BRIEF-547-STORE-DIAG — 生产 Router 持久 Store `durable_store_invalid` 故障定位（只读+隔离副本分析）

## 授权链
- Owner 2026-11-08 Path A 指令："由 #547 原维护责任链利用不依赖故障 Router 的既有合规维护入口，处理持久 Store 启动故障。先做一致副本、实际失败谓词定位与隔离验证，不擅自裁剪 epoch、修改生产账本、清 fence 或盲目重启。"
- 常设授权 §2（调查/复现/诊断）。**零生产写入**——本任务只读 + 隔离副本分析，不做任何恢复动作。

## 已知事实（监管已核实）
- 生产 runtime：PID 396，authsvc 属主，`/usr/local/libexec/agent-core/app/scripts/production-runtime.mjs --root /Users/authsvc/.agent-core --catchup 0`，live SHA `393a0afc`（dsh-agent-core 谱系）。
- 症状：飞书交办消息送达成功，但 Agent 接单被 `durable_store_invalid` 拦截。
- 错误串来源谱系：`packages/agent-router/src/reconciliation/`（store.js / durable-file.js / startup-recovery.js 在 deployed app 内）。
- `/Users/authsvc/.agent-core/` 顶层对 UID502 可读（drwxr-xr-x authsvc）；`dev-execution/ledger` 为空（非目标）；`control/`、部分子目录 0700 不可读。
- authsvc 上下文可用：`sudo -n -u authsvc <cmd>`（部署链同款既有权限机制，**仅限只读访问**）。

## 任务
1. **读 deployed 源码**（`/usr/local/libexec/agent-core/app/packages/agent-router/src/reconciliation/*.js`）：找出产生 `durable_store_invalid` 的精确校验谓词（引用原文+行坐标），及 store 文件的路径解析规则（文件名/目录约定）。
2. **定位实际 store 文件**：按源码路径规则在 `/Users/authsvc/.agent-core/` 下找到实际持久 store（authsvc 0700 处用 `sudo -n -u authsvc ls/cat` 只读访问）。
3. **一致副本先行**：将实际 store 文件（含相邻 meta/锁文件）整体复制到隔离工作区（本 worktree 下 `docs/evidence/h547-store-diag/`），记录 SHA-256 + 复制时刻；**绝不修改原文件**。
4. **谓词定位（离线分析副本）**：在副本上运行 deployed 源码同一校验逻辑（只读 import，沙箱隔离，不连生产进程），定位到精确失败点（文件/记录/字节坐标 + 谓词原文 + 实际值 vs 期望值）。
5. **根因假设 + 最小恢复提案**（不执行）：写明每个候选修复动作会改什么、依据哪条规则、需要什么授权面。

## 硬边界
- 零生产写入：不改 /Users/authsvc/.agent-core 任何文件、不重启 PID 396、不裁剪 epoch、不清 fence、不写生产账本。
- sudo -u authsvc 仅用于只读（ls/cat/find/cp-out）；不得以 authsvc 执行任何写命令。
- 失败即停写 `STOPPED-547-STORE-DIAG.md`。

## 完成定义
`DURABLE-STORE-DIAG-547.md`：谓词原文+坐标、store 文件路径+SHA、副本坐标+SHA、离线复现输出原文、根因假设、最小恢复提案（分级：无需授权可逆动作 / 需维护链动作 / 需 Owner 最小操作）。commit → push → PR(base main) 不合并。

## 续办补充（v2，2026-11-08 监管裁定）
- v1 停点已核：root 属主 `.bak-pre-epoch-fix2-20261106` 等历史备份**排除**出副本集（非启动依赖，`paths.js` 源码消费集不含它们）；不扩大 sudo 身份读 root 文件。
- **副本边界（v2）** = `control/turn-recovery-v3.json` + `control/turn-recovery-v3.json.faults.json`（若存在）+ `control/turn-recovery-v3.json.abandonment-declarations.json`（若存在）+ 目录内现存 `.tmp-*`/lock/history 文件（仅 authsvc 可读者）。逐文件：采集前 stat → 复制 → 采集后 stat → 双 hash 一致性判定。
- 首轮已取得的 active store 单读副本（SHA `85c4b0ce…`）保留为参考；v2 需建立一致性副本后在其上离线复现。
- **离线复现（必须项）**：用 deployed 源码（/usr/local/libexec/agent-core/app）同一校验谓词集（store.js:111-121 分类 + durable-file.js 候选校验 + capacity.js 上限 256）对一致性副本运行只读校验，输出**实际失败谓词 + 记录/字段坐标 + 实际值 vs 期望值**。
- 新线索纳入分析：① root 属主 `.bak-pre-epoch-fix2-20261106` 文件名表明 2026-11-06 曾对生产 store 做过"epoch fix2"手术（是谁/依据什么授权 = UNKNOWN，如实记录）；② PID 396 于今日 13:56:34 重启（--catchup 0，重启者 UNKNOWN）。若当前 store 已通过校验（离线复现无失败），则如实报告"durable_store_invalid 现象可能已被重启清掉/或只在启动窗口出现"，并给出验证方法。
- 纪律不变：零生产写入、authsvc 只读、失败再停。

### v2 执行坐标与预检（2026-11-08）
- `schema_version=2; SPEC_GOVERNANCE_MODE=PREFLIGHT; AUTHORITY_ACTION=REUSE; PLAN_LEVEL=BRIEF; ASSURANCE_LEVEL=DURABLE; ROUTE_STAGE=OPERATION`。
- 原隔离分支 `diag/547-durable-store`，v2 parent `7d5979a94096ea4ffd41bbc5f2e29e0773916fb9`；integration/current remote main `95a8e1cb512fc99dc018209d837250dd51b4d08f`（本轮 ls-remote 核实）。现有 PR #670 续交付，不新建平行 PR。
- `PRIMARY_AUTHORITY=AGENT_PROCESS_LIFECYCLE_HARDENING_V4` C-018/C-019/BOUNDED；相关 `HR_RESTART_LOST_FENCE_TRUSTED_RECOVERY_SPEC_V2` RQ-003/RQ-006（production_apply_authority=none）。两者 accepted 于 base；本轮不改长期 Contract。
- `EXECUTION_MANDATE=VALID; MUTATION_AUTHORIZATION=VALID` 仅适用于用户 v2 授权的本地隔离采集/分析/报告及 commit/push/PR；生产写入、恢复、merge 禁止。`ISOLATED_WRITE_SURFACE=YES; IMPLEMENTATION_ALLOWED=NO; OPERATION_ALLOWED=YES`（只读诊断）；`MERGE_READY=NO`（用户要求不合并）。
- `SPEC_GAP_DEPENDENCY=NONE; LIVE_AUTHORITY_GAP=NONE; OWNER_DECISION_REQUIRED=NO`。历史备份 RETAIN（历史证据，排除启动消费集），不 RETIRE/MIGRATE/新增 bridge。
- `CURRENT_GAP`：v1 一致性/离线复现未完成。`EVIDENCE_NEEDED`：三遍稳定文件集、每遍逐文件 pre-stat/copy/post-stat/第二读取 hash、源码字节绑定、同谓词离线输出、独立受影响面复核。
- `DONE_WHEN` 沿用上文诊断文档 + 不合并 PR。`EXPANSION_TRIGGER`：任一读取/一致性/工具执行失败、需超出只读身份/副本边界或真实 authority 冲突；立即停止依赖动作，追加 v2 STOPPED，保留 v1 历史，不自动重试。
- `NEXT_ACTION=CONTINUE; NEXT_REAL_ACTION`：单次三遍只读采集；无 atomic snapshot 声称。当前磁盘 provenance 已变为 `08102a550cf2f5e14646c6858786d7fe7a50c61d`（main_repo_head 仍声明 `393a0afc…`）；PID 396 loaded bytes 未认证，列为 UNKNOWN，不把磁盘版本当加载证明。

### v2 当前状态：STOPPED（采集范围错误）
- 三遍采集于 `2026-11-08T07:00:23.742502Z..07:00:24.956394Z` 完成，但事后本地范围复核发现 `capture-v2.py:54` 将历史文件名中的 `unblock` 错当 `lock`，额外读了 authsvc 可读的 `turn-recovery-v3.pre-fleet-unblock-20261002-111745.json`。
- `CONTENT_CONSISTENCY=THREE_PASS_STABLE; CAPTURE_SCOPE=FAIL; OPERATION_ALLOWED=NO; NEXT_ACTION=STOP`。不自动重采，不再读取生产，不继续离线同谓词校验；仅保存/复核停止记录并更新 PR。该范围错误不改变实际 hash 一致的观察，也不构成诊断通过。
- `DONE_WHEN=NOT_MET`；见 [STOPPED-547-STORE-DIAG.md](STOPPED-547-STORE-DIAG.md) 的 v2 节。原始执行脚本和 receipt 原样留存，不改成“正确执行”的版本。
