# fleet-window 固化工具（2026-11-04 入库）

背景：v5 执行器包装器此前仅存于 /tmp（会话现场产物），一度不可寻——固化脚本未固化是真流程债务。
本目录收编全部窗口作业工具，此后窗口一律从 Git 取用，禁止 /tmp 现场造物。

## 内容
- `window-executor-v5.sh`：v5 执行器（历史原件在 `55d306a`；15 节点：00-13 整数 + 05b）；内嵌 Python 按现行500行规则拆至同目录 `window_executor_state.py` / `window_executor_helper.py`
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
