# fleet-window 固化工具（2026-11-04 入库）

背景：v5 执行器包装器此前仅存于 /tmp（会话现场产物），一度不可寻——固化脚本未固化是真流程债务。
本目录收编全部窗口作业工具，此后窗口一律从 Git 取用，禁止 /tmp 现场造物。

## 内容
- `window-executor-v5.sh`：v5 执行器（历史原件在 `55d306a`；15 节点：00-13 整数 + 05b）；内嵌 Python 按现行500行规则拆至同目录 `window_helper_core.py` / `window_helper.py` / `window_preimage_xattr.py`
- `settle_unresolved_runtime_down.mjs`：stage_05b 的 D-009 termination-only 工具；要求 `--source-root`、`--stage-05-receipt-dir`，可用 `--store` 指定隔离 fixture。仅 exact durable child exit 的 unknown 可结算；非 unknown / 无证据原样保留，未解决返回 5。运行生产仍需独立窗口授权。
- `precheck_zero_inflight.mjs`：只读三列表核验；`--source-root` 必需，默认 authsvc control recovery 与 scheduler jobs 路径，可用 `--turn-recovery-store` / `--jobs-store` 指向 fixture。三空返回 0，非空或读取不可验证返回 1 / UNKNOWN。
- `settle_unresolved_runtime_down.test.mjs`：合成 store 验证，所有文件只创建在 `/usr/local/v5-boot-isolation/settle-test/` 下的独立 run 目录。
- `window_close.py` / `C7-INPUTS.md`：stage13 R6 命名收账、R7 最新两代及保护代的精确待删清单；仅列出，未实现删除
- `window-selftest.py`：`--selftest` 入口；固定隔离根下的00–04机制校验与官方真实 stdio canary；生产阶段未执行，不能作窗口 GO
- `stage_06_v2.py`：预镜像节点 v2（预算制/分块清单/三清单分离/哨兵禁入相等判断；38 隔离用例验证；修复历史 3h57m 失败根因——ditto 丢空值 xattr + 逐条子进程扫描）
- `assemble-runner.sh`：隔离装配 runner（官方安装器配方对齐版，行号映射见 ASSEMBLY-RECIPE-C5R3.md）
- `ASSEMBLY-RECIPE-C5R3.md`：官方安装器装配配方逐行映射
- `WINDOW-READINESS.md`：窗口放行条件 C1-C8 裁决书（2026-11-04 NO-GO 基线）
- `C6-PREIMAGE-ANALYSIS.md`：stage_06 历史失败根因分析（H1-H4 假设排序+V1-V7 验证清单）

## 规则
1. 窗口执行一律引用本目录脚本（Git SHA 钉定），禁止使用 /tmp 或会话工作区副本
2. 任何节点修改须经 selftest + 回执后合入本目录
3. 入口 C 流程见 ../../docs SOP-DEPLOY-MASTER（b7ctl 档案）

## #629 stage04 观察边界（方案 A，2026-11-09）

`window_helper.py` 的 `quiet` 只核对授权、旧进程身份、日志 mtime 与只读 census，
并向本次 RD 写观察收据；不再执行 `settle-all-pending.sealed.mjs`，也不再追加
`/tmp/fleet-v5-prep/settle-at-quiet.log`。mtime≥180s 不是 exact termination 证据；
不得通过结算制造 clean census。停机后的逐条 exact termination-only settlement
仍仅属于既有 stage05b，保留业务 UNKNOWN，且需要独立有效窗口授权。

本修复保留 `census()` 的三空硬门：非空、不可读或证据漂移均不能得到 quiet PASS。
runner 仍对 rc=1/10 最多轮询 80×30s，耗尽返回42；未放宽成 mandate V2 stage04
允许非空的完整实现，亦未修正其他窗口就绪差距。`--dry-run` 的历史边界文本仍为
150s，实际 quiet 门为180s。当前修改仅闭合停机前 settle 副作用，不代表窗口 GO。

本次有界 selftest：`python3 -B scripts/fleet-window/test_quiet_observation.py`。
它仅以内存替身运行实际 quiet/census AST，不启动 helper/runner/deploy 入口或子进程，
不读取生产路径。权威坐标、验证结果与限制见 [`RECEIPT-FIX-629.md`](../../RECEIPT-FIX-629.md)。
