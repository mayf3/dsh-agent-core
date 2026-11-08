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
