# BRIEF-SRA-CONTROL-CENSUS — SRA 生效前置④：控制面能力普查与最小差量提案（docs-first）

## 授权与纪律

- 常设授权 §2/§3：调查/起草/审查合规 PR 自主推进；docs-only，`MERGE_ALLOWED=NO`，生产写入=0
- 本任务是**普查+设计**，不实施代码、不激活 controller/profile、不建第二套审批平台（SRA-C-002 排除项与 Owner V2 §6 边界）
- 执行身份：本地工程 worker；只读生产面允许（lstat/read/ps 级），无认证面调用
- 失败语义：探索空结果≠失败；仅当工具持续不可用才停写 STOPPED

## 任务

SRA-C-006 第 5 步（委托实际生效）要求"真实执行控制能拒绝未任命/越界/过期/撤销/候选漂移/缺门的签发或写入"，且控制绑定须有实际入口版本/hash 与资格收据。现状：SRA V1 已 ACTIVE_ON_MAIN（#682），条件式任命登记已落（CAPTAIN-APPOINTMENT-REGISTRATION-20261109.md，recon/pertarget-successors b7a1d889）。生效前缺 = 条件④。

**交付一份普查报告 `CONTROL-CENSUS-SRA-EFFECTIVENESS.md`（repo 根）+ PR(base main) 不合并**，含四节：

1. **现有机制盘点**（每项给文件/合同/工具坐标）：
   - `docs/specs/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1.md` 各 CTR（尤其 009/011/012/013）对 mandate 校验/receipt/preimage 的既有要求
   - fleet-window 工具链（PR #629 分支 `chore/fleet-window-tools`：W6 mandate V2、S04 receipt、S05 bounds——读该分支文件）
   - 现有 deploy/ITOps 链的 profile/mandate 模板与收据字段
   - DISPATCH-REGISTRY governance rulings 的 selector+canonical SHA 机制（作为 issuer/授权绑定参照）
   - M7 dispatch 的幂等/锁/原子写机制（作为单 writer/mutex 参照）
2. **六类拒绝能力判定表**：`未任命 / 越界 / 过期 / 撤销 / 候选漂移 / 缺门` × {现有能力坐标, 判定 EXISTS/PARTIAL/MISSING, 缺口一句话}
3. **最小差量提案**：优先复用现有入口（DCP mandate 校验、fleet-window 工具、registry 查询）；每项差量说明改哪个既有文件/工具、语义、为何不是新平台；明确"不需要新建"的项也要列出（防止过度设计）
4. **§6.5 负向测试设计**：六类各一条具体测试用例（输入构造、预期拒绝行为、观察点、pass 判据），供后续独立 verifier 执行；测试须可在隔离环境/干跑模式运行，不得设计成需要真实生产写入

## 硬边界

- 不修改任何 spec/accepted 权威；不写产品代码；PR 只含普查报告与测试设计文档
- 报告中每个 EXISTS 判定必须有可复核坐标；不确定的写 PARTIAL 并说明 UNKNOWN
- 预算：单轮 worker 交付；未完成部分如实写 PARTIAL/STOPPED，不虚构

## 工具指令（上一轮教训，强制）

- **Git/GitHub 操作一律用 shell 的 `git` 与 `gh` CLI**（`gh pr create --repo mayf3/dsh-agent-core --base main`）。**禁止使用 MCP github 工具**（codex_apps/github.* 会被审批策略拒绝）。
- 文件写入用普通 shell（cat heredoc 或 python），写完立即 `wc -l` + `head -20` 自证落盘。
