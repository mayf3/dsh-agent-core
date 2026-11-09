# fleet-window 固化工具（2026-11-04 入库）

背景：v5 执行器包装器此前仅存于 /tmp（会话现场产物），一度不可寻——固化脚本未固化是真流程债务。
本目录收编全部窗口作业工具，此后窗口一律从 Git 取用，禁止 /tmp 现场造物。

## 内容
- `window-executor-v5.sh`：v5 执行器（历史原件在 `55d306a`；A 修订为17节点：00-13整数 + 03b/05b/06a）；03b候选状态加载、06a存活期全树预镜像、04纯观察、05物理退出与分类、05b精确结算、06停后仅复核。Python 拆至同目录 helper 模块。
- `settle_unresolved_runtime_down.mjs`：stage_05b 的 D-009 termination-only 工具；要求 `--source-root`、`--stage-05-receipt-dir`，可用 `--store` 指定隔离 fixture。仅同 epoch、exitObservedAt 与成功 exit_wait/child_real_exit 完整且无冲突的 UNKNOWN 可结算；无证据原样保留并返回0，生成 carry-forward 回执；隔离/读写/结算失败返回5。运行生产仍需独立窗口授权。
- `anarrowed/candidate-state.mjs`：03b真实候选运行时加载脱敏 recovery 副本，验证 UNKNOWN 与 Agent-scoped fence、无重放/覆盖；`--rollback-check` 用旧候选实际 Router/Scheduler reader 检查当前状态副本，不兼容则保持停止、仅 V3-aware forward fix，不恢复旧业务快照。
- `precheck_zero_inflight.mjs`：只读三列表核验；`--source-root` 必需，默认 authsvc control recovery 与 scheduler jobs 路径，可用 `--turn-recovery-store` / `--jobs-store` 指向 fixture。三空返回 0，非空或读取不可验证返回 1 / UNKNOWN。
- `settle_unresolved_runtime_down.test.mjs`：合成 store 验证，所有文件只创建在 `/usr/local/v5-boot-isolation/settle-test/` 下的独立 run 目录。
- `window_close.py` / `C7-INPUTS.md`：stage13 R6 命名收账、R7 最新两代及保护代的精确待删清单；仅列出，未实现删除
- `window-selftest.py`：`--selftest` 入口；固定隔离根下的00–04机制校验、A修订负向隔离/竞态/部分失败/候选启动/回退schema测试与官方真实 stdio canary；生产阶段未执行，不能作窗口 GO
- `stage_06_v2.py`：预镜像节点 v2（预算制/分块清单/三清单分离/哨兵禁入相等判断；38 隔离用例验证；修复历史 3h57m 失败根因——ditto 丢空值 xattr + 逐条子进程扫描）
- `assemble-runner.sh`：隔离装配 runner（官方安装器配方对齐版，行号映射见 ASSEMBLY-RECIPE-C5R3.md）
- `ASSEMBLY-RECIPE-C5R3.md`：官方安装器装配配方逐行映射
- `WINDOW-READINESS.md`：窗口放行条件 C1-C8 裁决书（2026-11-04 NO-GO 基线）
- `C6-PREIMAGE-ANALYSIS.md`：stage_06 历史失败根因分析（H1-H4 假设排序+V1-V7 验证清单）

## 规则
1. 窗口执行一律引用本目录脚本（Git SHA 钉定），禁止使用 /tmp 或会话工作区副本
2. 任何节点修改须经 selftest + 回执后合入本目录
3. 入口 C 流程见 ../../docs SOP-DEPLOY-MASTER（b7ctl 档案）

## FWAV V1 源码适配

`authority_validation/` 消费 accepted FWAV V1 的六类拒绝合同；执行器和 helper
在实际效果前重读同一授权观察，并保留原 mutex、phase FAIL、STOP 和诊断出口。
`reader.py` 只读原 registry；当前缺受信 caller/currentness/防回退适配，默认拒绝，
不能用 JSON 中的身份/布尔值取得资格。未证明内部逐写控制的 installer、settlement、
复制/递归命令在 dispatch 前拒绝。source/隔离 PASS 不等于 installed/loaded/profile/EFFECTIVE。

隔离验收入口（不运行窗口或原 canary selftest）：

```sh
python3 -B scripts/fleet-window/authority_validation/tests/test_fwav.py
python3 -B scripts/fleet-window/authority_validation/tests/test_xattrfix_r3.py
```

旧 xattr 测试移入该测试目录，以保持本层直接子项数不增加；其 fixture root
改为临时目录。原带真实 isolated canary 的 `--selftest` 仍是单独环境中的检查，
本次只核其受影响的纯函数入口。ACC001 按原 AUTHOR 固定坐标核验；本次允许面另核。
