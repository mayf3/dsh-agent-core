# BRIEF-D1D2-IMPL — 六类拒绝校验接线实施（accepted AGENT_CORE_FLEET_WINDOW_AUTHORITY_VALIDATION_V1，contracts 权限）

## 授权与纪律

- **实施权威 = accepted 合同**：`docs/specs/AGENT_CORE_FLEET_WINDOW_AUTHORITY_VALIDATION_V1.md`（PR #686 已合并，main 417cc8ee；implementation_authority: contracts；基线 main 5f3133dd 评审 HEAD f3e8340a）
- 允许修改面：`scripts/fleet-window/`（window_helper_core.py / window_helper.py / runner 及其测试）+ 新增测试文件 + 本简报/实施回执。**其他一切不动**
- 生产写入=0；不运行真实窗口；不激活任何 LaunchDaemon/profile；测试全部隔离/干跑
- 失败即停写 STOPPED；不采信自述（回执带测试原文 rc）

## 任务

按 accepted spec 的 wire points 与验收对照表实施：

1. ** appointment/issuer 校验（Δ1）**：在 spec 指定的现有校验链挂点实现——Mandate 引用字段（accepted SRA revision、任命 selector+canonical SHA256+生命周期、caller principal/session、A/W/V/C 冲突矩阵声明）的核验逻辑；自报身份不授权；appointment 数据从现行 registry 只读 reader 获取（可注入 fixture 路径，生产路径默认存在但测试用注入）
2. **范围/期限/撤销 fresh 检查（Δ2）**：效果 ⊆ 任命∩Mandate∩profile 交集；STANDARD_RECOVERABLE 五判据分类；window∩任命 UTC；每写/生命周期边界前 fresh 撤销读取；缺失/重复 selector/读失败/UNKNOWN → 拒绝
3. **六类拒绝 wire points**：未任命/越界/过期/撤销/候选漂移/缺门——按 spec 挂点接线，沿用现有错误出口
4. **验收测试**：实现 spec 验收表的 16 条方法为可执行测试（隔离 fixture/干跑），全部从 NOT_EXECUTED 变为已执行并在回执附原文（命令+rc+断言计数）

## 完成定义

实现 + 测试全绿 + 回执（含：改动文件清单与行数、每条 spec 合同对应的实现坐标、16 条验收原文 rc、UNKNOWN 清单）→ 单 commit → push origin ops/d1d2-validator-impl → gh pr create --repo mayf3/dsh-agent-core --base main（标题 'feat(fleet-window): wire six-refusal authority validation per accepted V1'）→ **不合并**（等独立审查+验收复核）。

## 工具指令（强制）

- 只用 shell git/gh；**禁 MCP github 工具**；写后自证落盘
- push 失败（代理 127.0.0.1:7890）：本地 commit + git bundle 交接（/tmp/transfer-<name>.bundle + push.log），输出"待监管传输"，不重试
- 现有测试如因本次改动失败：如实记录并最小修复或说明，不跳过

## 本次实施路由（2026-11-09）

- `BASE_HEAD=417cc8ee6e7ef9a5e840e900a11c30fe58d648da`；隔离 worktree 为本目录，唯一集成写入者为本次根会话，子任务只在各自 `/tmp/d1d2-*` 副本写补丁。
- `AUTHORITY_ACTION=REUSE; PLAN_LEVEL=BRIEF; ASSURANCE_LEVEL=CONTROLLED; ROUTE_STAGE=IMPLEMENTATION; AUTHORITY_ACCEPTED_IN_BASE=YES`。
- 源码实施/隔离 fixture 写入由当前用户指令授权；`OPERATION_ALLOWED=NO; MERGE_ALLOWED=NO`。不执行真实窗口、sudo、launchctl、installer、settlement，不更改任命或生产入口资格。
- 阶段解释已独立复核：accepted frontmatter、`fa617851` 接受事务和 Spec 索引 L444 明确授权 B 六类接线；正文 CTR001/原 AUTHOR 路由仍绑定旧提案任务，且明确独立接受并 main 落地后的新任务实施。ACC001 对 `5f3133dd→f3e8340a` 原 AUTHOR diff 实际执行隔离核验；本次实现 diff 另按本简报核允许面，不将其报告为 docs-only。accepted Spec 字节不改。
- 执行步骤：纯校验/只读 reader 消费 → helper/runner 原边界接线 → 16 条隔离验收和受影响既有测试 → 非作者受影响合同复核 → 单 commit / 一次 push / PR 或 bundle。失配/非零结果先保全原文，按简报最小修复；超范围或真实权限缺口停止依赖路径。
- 当前 reader 只有原 registry JSON 只读能力，缺受信 caller/currentness/防回退资格，默认拒绝；测试只注入进程外观察边界。内部多写 child 未获证时在 dispatch 前拒绝，不宣称 installer/settlement/recursive copy 已具内部接线资格。
- `DONE_WHEN` 沿上文；`EXPANSION_TRIGGER` 为新信任根、扩权、生产效果、accepted 含义冲突或越出允许面。原 B facade/receipt/错误通道 RETAIN；旧缺证明 Mandate 拒绝，不增兼容放行或第二授权模型。

- 文件系统限制：原 worktree 的共享 Git 元数据为只读；交付使用 `/tmp/d1d2-delivery-gitdir.txt` 指向的独立 Git 元数据，绑定同一 parent、`ops/d1d2-validator-impl` ref 和本目录的单一候选树。原 worktree HEAD/索引不改；最终 commit 与 bundle 的确切坐标写在外部传输回执，不把原 HEAD 冒称新提交。
