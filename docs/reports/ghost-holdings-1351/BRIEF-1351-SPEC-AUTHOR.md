# BRIEF-1351-SPEC-AUTHOR — 幽灵 holdings 四道闸 Spec 提案（AUTHOR，docs-first）

## 授权链
- issue mayf3/agent-control#1351 正文四道闸 + 收敛评论（三处置区分：GC门禁不拦disable/交接=过户/退役=过户+离册）
- 常设授权 §3C（同类非扩权可靠性改进：责任活性/故障隔离/可观测性）——本提案走受托接受链
- 前次 worker PREFLIGHT 停点（STOPPED-1351-GATES.md）已实名定位全部 surface——**作为唯一输入复用，不重复探索**
- 零生产写入。docs-first。

## 任务
1. 读 STOPPED-1351-GATES.md 的定位表（四 surface 真实坐标 + 缺件清单）
2. 起草 `AGENT_CORE_GHOST_HOLDINGS_PROTECTION_V1.md`（或按仓库命名惯例）：
   - **C1 GC 删除门禁**：agent-definition disable ≠ 删除；删除/离册 callable 前强制 svc holdings 查询（活跃实例 assignee + enabled 角色绑定）非空拒绝；disable 保持直通（紧急停权）
   - **C2 幽灵巡检 role 维**：明确既有 NOT_IN_REGISTRY 检查器 owner 与扩展点（worker 未绑定 owner repo——提案需把"绑定真实检查器"列为接受前置或定义 Core 侧实现位）
   - **C3 owner 活性校验**（svc 侧）：upsert_role_binding/replace_domain_owner/establish_domain_owner 写入时校验 principal 在册且 enabled（当前只锁 principals.enabled 本地查——需跨服务一致性声明）
   - **C4 离职过户 runbook**：实例→对口角色、owner→对口角色标准流程（复用既有 workflow authoring）
   - 跨服务边界：Core 侧合同 + Svc 侧配套（照 WEC V5/PPR V2 paired acceptance 模式：Core 接受不替代 Svc 配套正式接受）
   - 验收 = issue 三条：删除被拦截/巡检含幽灵 holdings 清单/幽灵 owner 被拒
3. 路由判定（NEW/AMEND）逐条款对照既有权威；frontmatter 如实（proposed/none）
4. commit → push → PR(base main) 不合并 + 报告（路由判定论证 + 前置清单：非作者独审/Svc 配套接受）

## 边界
不改产品代码；失败语义=探索性空结果≠失败，仅必需输入缺失/谓词非预期才停；失败写 STOPPED-1351-SPEC.md
