# BRIEF-M7-ROOTWRITER-HUNT — lark-cli-registry root 写者身份与派发现状判定（只读调查）

## 背景（监管已核）
- `lark-cli-registry.json`（root 0600，2.1MB）mtime 周期性更新（22:46 → 23:01），root 属主 = 存在 **root 上下文的活跃写者**
- dispatch.py `record()` 自带 `os.chmod(REG, 0600)` → 每次 root 调用会把文件固化为 root 0600
- 同目录 `.audit-heartbeat`（yanfenma 0644）内容实时更新（23:01:13）= 另有 uid502 监控循环
- M7 skill（uid502）四条合法解析源全部核验不可用（见 STOPPED-M7-RESOLVER.md a-d 表）

## 任务（只读，抓写者）
1. **抓 root 写者**：监控 mtime 变化窗口 + 写入瞬间 `lsof`/`ps` 快照抓调用进程（root 权限采样可用 `sudo -n`）；或用 `fs_usage`/`opensnoop`（sudo）短窗监听该文件的 open/write 调用栈，捕获进程 PID+argv
2. **判定该写者的派发行为**：确认其是否 = dispatch.py 的成功调用（读 registry 现有最新条目：最近 sent 条目的 agent/dispatchId/status/时间——root 读可查）；若最近条目 status=DELIVERED 且时间戳=近期 → **root 上下文 M7 派发实际在工作**
3. **找出 root 调用源头**：该写者被谁触发（launchd/cron/监控循环/某 agent 经 sudo）——给出触发链证据
4. **对 uid502 的可达性结论**：若 root 上下文派发工作 → HR（uid502）的合法路径 = 把派发请求路由给该 root 执行者（经什么受控接口？）——给出机制选项；若 root 写者只是历史残留/失败循环 → 如实报

## 边界
只读（sudo 仅用于读/抓采样）；零生产写入；不终止/不重启任何进程；探索空结果≠失败；仅"写者不可判定"才停写 STOPPED-M7-ROOTWRITER.md

## 完成定义
`M7-ROOTWRITER-FINDINGS.md`：写者进程身份（PID+argv+触发链）+ 最近条目派发行为判定（DELIVERED?）+ uid502 可达性机制选项 + 证据原文 → commit → push → PR(base main) 不合并
