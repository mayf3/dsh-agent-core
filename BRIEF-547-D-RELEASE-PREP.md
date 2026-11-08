# BRIEF-547-D-RELEASE-PREP — D 最小发布准备包（为 ITOps 条件切换备齐三缺项）

## 授权链
- Owner Watch3（comment 6718344408）："D 的生产切换是条件性授权"——原 ITOps 在既有有效 exact-head 安装权限内，满足【隔离 QA ✓ 已过 / 独立 QA ✓ / 精确 artifact pin ✗ / 原发布回滚合同 ✗ / 在途排空 ✗ / sidecar 一致性 ✓】后才可按原 Controlled runbook 受控切换；**若既有安装授权不覆盖该确切候选 → 提交唯一精确缺项**。
- 机制 QA 基础 = 已合并 `D-STORE-QA-547.md`（PR #670，merge `f8b7a0e4`）：5/5 识别+阻断、141 断言、4/4 no-replay、28 窄容忍负例 PASS。
- 本任务 = **发布准备**（工程构建/固定/清单），**不执行生产切换/安装/重启**。零生产写入。

## 任务（三缺项逐一备齐）
### 1. 精确制品 pin（NOT_SATISFIED → READY）
- 从 main `95a8e1cb`（含 42487e65 三件套）构建候选安装包：走既有 pack 装配流程（参照 `/usr/local/libexec/agent-core/app/pack-provenance.json` 现行格式与 ASSEMBLY-RECIPE 模式），输出：source commit、完整文件 manifest+SHA、Node 运行时绑定（生产 node-runtime 路径/版本）、pack 总 digest。
- 候选包落隔离区（本 worktree evidence/），**不安装到生产路径**。
- 与现役 pack `393a0afccedc5cce7be8b492c82d68d8d52206f6` 做差量清单（文件级：改了什么/为什么必须——只允许 42487e65 谱系 + 其直接必需依赖，无夹带）。
### 2. 回滚就绪（NOT_READY → READY）
- 确认现役 393a0afc pack 完整备份在位（hash 固定、可重装声明）。
- 回滚后兼容性核查计划：旧 reader 读新 store 副本的兼容性矩阵（新 store 在切换窗口产生的记录，回滚后旧版加载行为——引用 QA 文档窄容忍结论）；回滚后 no-replay 验证步骤。
### 3. 在途排空方案（UNKNOWN → 可执行清单）
- 基于 Watch3 事实（现 PID 23085 多 agent 子进程在途），写真实 drain 核验清单：turn/occurrence/generation 逐类查法（只读命令原文）、排空判定标准、切换窗口单写者保障、fence 状态预检步骤。
- **不执行排空，只交付清单**（排空属 ITOps 切换窗口动作）。

## 交付
`D-RELEASE-PACKAGE-547.md`：三缺项逐一 READY/仍缺声明 + 候选包 manifest + 差量清单 + 回滚/排空清单 + **ITOps 执行入口说明**（既有安装权限覆盖性初判：覆盖→可按 runbook 执行；不覆盖→唯一精确缺项四要素）。commit → push → PR(base main) 不合并。失败即停写 STOPPED。

## 边界
不安装、不重启、不清 fence、不写生产账本、不发真实业务请求；生产只读探针仅限监督委托的必要性核实（authsvc 只读）。
