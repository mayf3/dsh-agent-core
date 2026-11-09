# BRIEF-D1-D2-VALIDATOR-PROPOSAL — fleet-window 权威校验适配 Spec 提案（Δ1+Δ2，docs-first）

## 授权与纪律

- 常设授权 §3：同类非扩权可靠性改进（执行身份/责任活性）允许起草+非作者审查+受托接受；**生产 none**
- 上游依据：PR #683 `CONTROL-CENSUS-SRA-EFFECTIVENESS.md` §2 六类判定表 + §3 Δ1/Δ2 设计（非权威输入）；SRA V1（accepted，ACTIVE_ON_MAIN）SRA-C-001/002/006；DCP V1 既有 CTRs
- **本任务只产出 Spec 提案（PROPOSED，不接受、不合并、不实施代码）**；修改 accepted 权威=禁止；实施留给后续独立接受事务
- 失败语义：探索空结果≠失败；工具持续不可用才 STOPPED

## 任务

交付 spec 提案 `docs/specs-proposals/AGENT_CORE_FLEET_WINDOW_AUTHORITY_VALIDATION_V1.md`（若仓内无 proposals 目录则按现行 spec 目录惯例放 `docs/specs/` 并在 frontmatter 标 `status: proposed`；先读 1-2 个现有 accepted spec 的 frontmatter 格式再写）+ PR(base main) 不合并。

**提案范围（B 入口路径：`scripts/fleet-window/window_helper_core.py` 的 validate_authority/authority 链，坐标以 main 5f3133dd 为准）：**

1. **Δ1 issuer/appointment 核验语义**：Mandate 内新增引用字段（accepted SRA revision、唯一任命 selector+canonical SHA256+生命周期状态、真实 caller principal/session、A/W/V/C 冲突矩阵声明）及其校验规则；自报身份不授予角色的负面规则；跨 session 身份延续归原身份链
2. **Δ2 范围/期限/撤销 fresh 检查语义**：请求效果 ⊆ 任命范围 ∩ Mandate 范围 ∩ 已准入 profile effects 交集判定；STANDARD_RECOVERABLE 五判据+排除项的机械分类规则；window UTC ∩ 任命 UTC；签发及每个写/生命周期边界前 fresh 可归属撤销读取；缺失/重复 selector/读失败/过期回退/UNKNOWN → 不签发不写入；在飞按原获准安全配方
3. **六类拒绝的 wire points**：每类拒绝在现有 validate_authority/authority 调用序列中的精确挂点（现有函数/行号坐标）+ 拒绝输出形态（沿用现有错误路径，不新增错误通道）
4. **非目标**：D（deployment_system.py）侧适配显式 out-of-scope（Δ0 结论：来源 repo 未定位）；不建撤销服务/第二台账/新信任根；不改 DCP stable ID 与 SRA 语义
5. **验收对照表**：每条语义一条验收方法（隔离/干跑可执行），对应 SRA-C-006 第 5 步要求

## 硬边界

- 只新增提案文件+简报；不改任何现有文件；PR 不合并
- 提案须标注 `status: proposed`、非权威、依赖上游（#683/#684 普查结论）非权威输入
- 每个"现有挂点"声明必须带 `git show 5f3133dd:...` 可复核坐标；读不到的写 UNKNOWN

## 工具指令（强制）

- 只用 shell `git`/`gh`；**禁 MCP github 工具**；写后 `wc -l` 自证
- push 失败（代理 127.0.0.1:7890）时：记录原文，在**本地 commit** 后停止并输出"push 失败待监管传输"，不重试
