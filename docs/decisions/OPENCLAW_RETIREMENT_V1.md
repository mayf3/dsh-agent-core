# OpenClaw Retirement — DO_NOT_RESTORE 终局裁决（D-008）

- 状态: **accepted**（Owner 终局裁决；TASK_NAME = 旧链 终止；
  OWNER_RULING = **DO_NOT_RESTORE_OPENCLAW**；TASK_STATUS = CANCELLED_BY_OWNER）
- 日期: 2026-08-31
- 性质: 架构/流程终局裁决（closing ruling）。本决策**不授权任何实现**，只关闭方向；
  后续任何"让 agent 经旧 OpenClaw 链路可用"的方案不得再立。

---

## 1. 裁决内容

**OpenClaw 已退出目标运行架构。** 以下工作流就地终止（CANCELLED_BY_OWNER）：

- `scripts/repair-efficiency-agent-client-mapping-canary.sh`
  （EFFICIENCY_SUCCESSOR_CLIENT_MAPPING_CANARY 修复 runner）
- `gui/505/ai.openclaw.gateway`（authsvc 用户域的 OpenClaw gateway）
- 端口 `18789`
- "OpenClaw client mapping repair" 整条工作流

**五项禁止**（对后续所有 round 生效，除非 Owner 新裁决显式重开）：

1. **不修 restart**——不调试/修复 `launchctl kickstart gui/505/ai.openclaw.gateway`
   的 `125: Domain does not support specified action` 等加载问题；
2. **不恢复 gateway**——不 bootstrap/bootout/load 任何 `ai.openclaw.*` LaunchAgent，
   不拉起 OpenClaw gateway 进程；
3. **不修改 `openclaw.json`**——`~/.openclaw/openclaw.json` 保持当前 PRE image
   （sha256 `3d34b79c…`），不做任何再写入（包括"再改一次clientId""清理""整理"）；
4. **不执行 mapping runner**——`repair-efficiency-agent-client-mapping-canary.sh`
   及其任何后继/变体不再执行；
5. **不为兼容旧 OpenClaw 增加任何代码**——Agent Core / Broker / runtime 不得引入
   OpenClaw 兼容层、适配层或分支逻辑。

**效率管家（efficiency-agent）后续路径**：若仍不可用，应**单独开 round 调查如何迁入
当前 Agent Core / DSH Broker 正式链路**（按 `.agents/README.md` 治理流程：investigation
→ accepted Spec → implementation）。**不得以恢复 OpenClaw 作为方案**（含部分恢复、
临时恢复、"先救活再迁"）。

## 2. 背景：2026-08-31 旧链修复两次失败的事实

- 2026-08-31 当日，client-mapping canary 修复 runner 以 root 执行了**两次**
  （备份文件名时间戳 `20260831T015151Z`≈09:51 与 `20260831T124501Z`≈20:45 +0800；
  第二次的完整日志封存于 evidence）。
- 两次均在**gateway 重启缝**失败：`launchctl kickstart -k gui/505/ai.openclaw.gateway`
  返回 `125: Domain does not support specified action`（服务在 gui/505 域不可
  kickstart），`wait_gateway` 20 秒超时 → `ERROR=gateway_restart_health_timeout`。
- runner 的自动回滚把 `openclaw.json` **字节级换回 PRE image**（本轮独立复核：
  当前 sha256 == PRE_SHA256 `3d34b79c…`）；`ROLLBACK=FAILED` 仅指"回滚后的 runtime
  reconcile restart 也失败"，配置文件本身已恢复。两次运行均 RC=1，映射替换
  （`mc_oc_itSaJ…` → `mc_cF81DF…`）**从未生效**。
- 终止时点机器状态（全部只读复核，见 evidence snapshot）：18789 无监听；
  无 OpenClaw gateway 进程；repair lock 无残留；现存运行链路上的 gateway 仅
  `~/.dsh/profiles/web` 的 dsh-remote-plugin `gateway.cjs`（当前 DSH 链，与本裁决无关）。

## 3. 历史证据保全（保留为历史证据，不删除、不迁移）

| 工件 | 位置 | sha256 / 标识 |
|---|---|---|
| 修复 runner（repo 内，untracked，保留原地） | `scripts/repair-efficiency-agent-client-mapping-canary.sh` | `4a383831…`（见 evidence MANIFEST） |
| runner 密封副本（去执行位，DO-NOT-RUN） | `docs/evidence/openclaw-mapping-repair-termination-20260831/` | 同上 |
| 第二次运行日志（root，RC=1） | `/tmp/efficiency-repair-v2-run.log` + 密封副本 | `660d9edc…` |
| 提权启动脚本（osascript admin） | `/tmp/efficiency-repair-launch.scpt` + 密封副本 | `0f92834c…` |
| pre-image 备份 ×2（hardlink，authsvc 属主，保留原地） | `~/.openclaw/openclaw.json.pre-efficiency-client-2026{0831T015151Z,0831T124501Z}-3d34b79c….bak` | 均 == PRE_SHA256 |
| 终止时点状态快照（本轮只读采集） | evidence 目录 `state-snapshot-20260831-2126.txt` | `45157506…` |

注：第一次（01:51Z）运行的日志被第二次运行的同路径重定向覆盖，仅剩备份文件名时间戳
为证；如实记录，不推断其输出差异。

## 4. 与既有 artifacts 的关系

- `docs/README.md` 2026-08-15 的 "Path B 恢复三个 caller 到 OpenClaw" 是**历史事实**，
  记录当时的回退；本裁决之后 Path B 类"回 OpenClaw"路径**永久关闭**。
- D-005 / D-007（Scheduler 迁移）、`cto-openclaw-recovery-v5/v6` 审计、
  `openclaw-*` investigations 等均为历史 evidence/authority，不因本裁决改写；
  其中任何"以 OpenClaw 为运行面"的表述自 2026-08-31 起以本裁决为准。
- `~/.openclaw/groups/…/smart-home` 两个 python bridge 进程（video/ir）不在本裁决
  列举范围内，本轮未触碰；如需处置由 Owner 另行裁决。

## 5. 重开条件

本裁决为终局（closing）。重开条件只有一个：**Owner 新裁决（NEW_OWNER_RULING）**
显式撤销或修订 DO_NOT_RESTORE_OPENCLAW。任何 session 不得以"效率管家不可用"或
其他 incident 自行重开旧链方向。
