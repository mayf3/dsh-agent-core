# AGENT_CORE_DSH_PROCESS_MODEL_DEMO_V0 — 报告

> 验证「一长期 Agent 一 DSH 进程 + idle eviction + cold resume」的资源与
> 生命周期模型。基于当前 Bootstrap V0（`dsh --profile agent-core-demo` =
> dsh-base + @agent-core/bundle-demo），不迁移任何功能。基准只压 DSH
> runtime 本身：idle 进程零 LLM 调用，功能测试仅少量顺序真实调用。

## 1. 被测形态

```text
一长期 Agent = 一个 DSH 进程（node apps/cli/bin.js --profile agent-core-demo）
  ├─ dsh-base                     # V0 原版运行时（~90 行插件，未修改）
  ├─ @agent-core/demo-server      # 长驻 app：stdio JSON-RPC（官方 SDK wire）
  │                               #   + persistence-aware create/resume
  ├─ @agent-core/owner-guard      # 单 owner 进程守卫（O_EXCL 锁 + PID 活性 + 陈旧锁接管）
  └─ 每 Agent 独立 DSH_HOME / workspace / sessions/（JSONL 持久化）
```

驱动：`scripts/process-model-demo.mjs`（A–F 六组测试，指标见 §3）。

## 2. 资源曲线（idle 进程，本机 49GiB / 15 核）

| n | RSS total (GiB) | RSS per proc (MiB, median) | idle CPU (%/core, median) | ready p50/p95 (s) |
|---|---|---|---|---|
| 1  | 0.16 | 162 | 0.00 | 0.75 / 0.75 |
| 10 | 1.63 | 166 | 0.00 | 1.39 / 1.42 |
| 30 | 4.89 | 167 | 0.00 | 3.44 / 3.57 |
| 60 | 8.88 | 152 | 0.00 | 7.97 / 8.28 |
| 100 | 14.38 | 148 | 0.00 | 12.82 / 13.35 |

```text
RSS_PER_IDLE_AGENT=151132        # ~148 MiB/进程，n=1..100 恒定（甚至微降）
MAX_TESTED_PROCESSES=100
TOTAL_RSS=15077884               # 100 × ~151 MiB = 14.4 GiB（机器 29%）
IDLE_CPU=0.00                    # 事件循环完全 parked
COLD_START_P50/P95=8.29/13.28    # 100 个并行 spawn 的墙钟（含 15 核 CPU 竞争）
RESUME_P50/P95=0.07/0.08         # spawn→prompt-accept，含 session 持久化加载
```

要点：

- **单进程冷启动 ~0.75s**；并行 spawn 吞吐 ~8 进程/s（15 核竞争，p50 随 n
  近线性上移，单进程成本不变）。ready 不含任何 LLM 调用。
- **resume 几乎免费**：进程重启后首条 prompt 的持久化加载仅 ~0.07s
  （JSONL 读取 + 事件重建），模型继续原对话（8 次 kill -9 循环全部正确
  回忆 code word，JSONL 数据层同步断言）。
- **idle 进程零 CPU**：常驻的唯一成本是内存（~0.15 GiB/Agent），无 CPU
  浪费。

## 3. 功能验证（B–F，均 PASS）

| 检查 | 结果 |
|---|---|
| SAME_AGENT_SINGLE_PROCESS | 同 Agent 连续 3 条消息复用同一 PID |
| MULTI_CONVERSATION_SAME_AGENT | 两个 conversation 映射同一 Agent → 同一 PID，artifacts 同 home |
| AGENT_ISOLATION | 不同 Agent → 不同 PID / DSH_HOME / workspace / session 存储 |
| SESSION_RESUME | kill -9 → 重启同 home → `resumed(N events)` → 继续原对话 |
| SINGLE_WRITER_ENFORCED | 第二 owner 启动被拒（`already owned by live process`）；并发双启恰好 1 存活；陈旧锁（死 PID）自动接管；优雅退出释放锁 |

## 4. 结论

```text
RESOURCE_GROWTH=LINEAR            # RSS/进程恒定 ~150 MiB，total 线性，CPU 恒 0
SAFE_RESIDENT_PROCESS_COUNT≈150   # 49GiB 机器、60% RAM 预算 ≈196；留活跃余量取 150
ALWAYS_RESIDENT=YES               # ≤100（实测）~≤150（推算）可全常驻
LAZY_SPAWN_REQUIRED=NO            # 当前规模不需要；Agent 数 >~200 后线性成本不可扩展
IDLE_EVICTION_REQUIRED=NO         # 正确性不需要（resume 已保证冷恢复）；省内存优化
RECOMMENDED_IDLE_TIMEOUT=1800     # 30 min：idle 零 CPU、resume <1s，eviction 只省内存，
                                  # 超时宜宽松以保留热状态；逼近内存上限时可调至 900
```

**推荐 V1 lifecycle：LAZY_SPAWN + IDLE_EVICTION 为默认，ALWAYS_RESIDENT 为
小规模（≤100）过渡形态。** 依据：

1. **长期性不在进程里。** 长期 Agent 的长期性来自 workspace / DSH_HOME /
   session / memory / credential 的持久化，而不是进程永久常驻。进程只是
   可丢弃的执行载体：杀进程不丢任何状态（JSONL 写后落盘 + resume 重建）。
2. **lazy spawn 的惩罚可忽略**：冷启动 0.75s + resume 0.07s，无额外 LLM
   往返；首个 prompt 的延迟与常驻进程无差别（resume 在 prompt 时同步完成）。
3. **常驻成本线性且可观**：~0.15 GiB/Agent。100 个 14.4 GiB，每增 100 个
   Agent 再增 ~15 GiB；超过 ~200 个就必须引入 eviction。
4. **eviction 只需一个 owner guard + resume**：本 demo 已完整演示——
   evict（kill -9）→ stale lock 接管 → 重启同 home → `resumed` → 继续对话；
   单 owner 保证任意时刻只有一个写者。

## 5. 架构结论（写入 V1 决策）

> **长期 Agent 的长期性来自 workspace / DSH_HOME / session / memory /
> credential 的持久化，而不是进程永久常驻。**

V1 最简单的 process lifecycle（本轮不实现生产级 supervisor）：

```text
supervisor registry（agentId → home/workspace/lock）
  ├─ 路由消息：Agent 有活进程 → 直接投递；无 → spawn（~0.8s）后投递
  ├─ idle 计时（≥30 min）→ evict：SIGTERM/SIGKILL，保留 home
  ├─ owner guard：spawn 前/内校验单 owner（demo 已有进程内守卫）
  └─ 崩溃恢复：进程消失 → lock 变陈旧 → 下次消息 spawn 接管 → resume
```

## 6. 保留件与已知问题

- **保留** `packages/demo-server`（resume-aware 长驻 server）与
  `packages/owner-guard`（单 owner 守卫）：它们是后续 Agent Core control
  plane / agent-server 的实现基础，**不要删除**。
- 官方 `dsh-sdk-jsonrpc-server` 不支持 session resume（其 getOrCreate 永远
  `agents.create()` fresh）；demo-server 是必要的最小替代（复用官方 wire
  协议 + `agents.resume()`）。
- 演示级守卫用「PID 活性」判陈旧锁，存在 PID 复用误判窗口；生产应改用
  flock(2) 或 supervisor 注册表（demo 内已注明）。
- 本机实测期间仓库存在并发的 V1 broker 迁移改动；demo 组成已与 broker
  解耦（bundle-demo 不依赖 broker），不受影响。
