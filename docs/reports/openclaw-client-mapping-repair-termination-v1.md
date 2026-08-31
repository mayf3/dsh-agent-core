# 旧链 终止 — OpenClaw Client Mapping Repair 终止轮报告（V1）

- TASK_NAME = 旧链 终止
- OWNER_RULING = **DO_NOT_RESTORE_OPENCLAW**
- TASK_STATUS = **CANCELLED_BY_OWNER**
- 日期: 2026-08-31（21:26–21:40 +0800）
- PRODUCTION_CHANGE = **NONE**
- 本轮性质: docs-only 终止轮。落盘 D-008 决策
  （`docs/decisions/OPENCLAW_RETIREMENT_V1.md`）+ 证据封存。**零 sudo、零
  production 写入、零进程操作**；五项禁止全部遵守（未修 restart、未动 gateway、
  未触碰 `openclaw.json`、未执行 runner、未写任何兼容代码）。

## 1. 终止对象与终态核实（全部只读）

| 对象 | 终态（2026-08-31 21:26–21:30 复核） |
|---|---|
| `scripts/repair-efficiency-agent-client-mapping-canary.sh` | 无运行进程；repo 内 untracked 保留原地（sha256 `4a383831…`），另封存去执行位副本 |
| `gui/505/ai.openclaw.gateway` | 未运行：18789 无监听（`nc -z` rc=1）、无 gateway 进程；yanfenma 无法打印 gui/505 域（125），root kickstart 两次同样 125（见封存 run log） |
| 端口 `18789` | 关闭 |
| `~/.openclaw/openclaw.json` | sha256 == runner 的 PRE_SHA256 `3d34b79c…`——两次修复的映射替换已被 runner 自动字节级回滚，**从未生效**；本轮未做任何再写入 |
| repair lock（`.efficiency-client-mapping-repair.lock`） | 无残留 |
| pre-image 备份 ×2 | `~/.openclaw/openclaw.json.pre-efficiency-client-20260831T{015151Z,124501Z}-3d34b79c….bak`（hardlink，authsvc 属主，均 == PRE_SHA256）保留为历史证据 |

完整命令与输出见 `docs/evidence/openclaw-mapping-repair-termination-20260831/state-snapshot-20260831-2126.txt`。

## 2. 事件时间线（据封存日志与文件时间戳重建）

- 2026-08-31 08:43–08:52：`/tmp/dsh-efficiency-sigtrap-20260831.0B57y0`（efficiency
  agent SIGTRAP 复现工作目录）——事件起源侧证，属另一工作流，本轮未触碰。
- 2026-08-31 ≈09:51 +0800（备份时间戳 `015151Z`）：修复第一次以 root 执行；
  日志被第二次运行同路径覆盖，只剩备份文件名；按第二次行为推断同样失败于
  gateway 重启缝（无证据表明 09:51 时域状态不同）。
- 2026-08-31 20:44–20:45：`efficiency-repair-launch.scpt`（osascript admin）触发
  第二次执行 → 备份 → `openclaw.json` 原子替换成功 → `launchctl kickstart` 两次
  `125: Domain does not support specified action` → `ERROR=gateway_restart_health_timeout`
  → cleanup 将配置 RENAME_SWAP 回 PRE（成功）→ 回滚后 runtime reconcile restart
  仍 125 → `ROLLBACK_RUNTIME_RECONCILE=FAILED` / `ROLLBACK=FAILED`（仅指重启
  reconcile；配置字节已恢复）→ `RUNNER_EXIT_RC=1`。
- 2026-08-31 21:26：Owner 终止指令 → 本轮。

## 3. 本轮产出

1. **D-008 决策**：`docs/decisions/OPENCLAW_RETIREMENT_V1.md`（+
   `docs/decisions/README.md` 索引行）——五项禁止、efficiency-agent 后续迁移路径、
   重开条件 = 仅 NEW_OWNER_RULING。
2. **证据封存**：`docs/evidence/openclaw-mapping-repair-termination-20260831/`
   （MANIFEST 含逐文件 sha256）——run log、launch.scpt、runner 密封副本
   （DO-NOT-RUN，去执行位）、终止时点状态快照。
3. 原地工件**不动**：runner 留在 `scripts/`（untracked）、备份与 `/tmp` 日志保留。

## 4. 边界与如实声明

- DEVELOPMENT_PREFLIGHT / SPEC_COMPLIANCE：不适用——本轮零代码、零实现，
  纯治理文档（closing ruling），无 governing implementation Spec。
- `audit2-mapping.diff`（/tmp, 20:53）经核对属**另一条并发的 Broker schema
  工作流**（allOrNone 校验），与本旧链无关，未纳入本证据目录。
- `~/.openclaw/groups/…/smart-home` 的 video/ir 两个 python bridge 进程不在终止
  清单内，未触碰，留待 Owner 另行处置。
- 第一次运行日志缺失（被覆盖）——如实记录为证据缺口，不做推断性补写。
- 未删除任何 LaunchAgents plist（含历史 .bak）——保留为历史证据。
- pre-existing WIP（broker 修改、未跟踪 docs、暂存区既有内容）一律未动；本轮
  新文件仅按显式路径提交。

## 5. FINAL

- 旧链 终止 = **COMPLETE**（D-008 accepted；五项禁止生效）
- OPENCLAW_MAPPING_REPAIR = **CANCELLED_BY_OWNER**（配置在 PRE，从未生效）
- GATEWAY = **DOWN / 不恢复**（18789 关闭；禁止 bootstrap/kickstart/修 restart）
- PRODUCTION_CHANGE = NONE；SUDO = 0；RUNNER_EXECUTED_THIS_ROUND = 0
- NEXT_TASK = efficiency-agent 迁入 Agent Core / DSH Broker 正式链路的独立
  investigation（新 round，走 `.agents/README.md` 治理流程；不得以恢复 OpenClaw
  为方案）
