# 网站询问只读合同提案 V2（PROPOSED — 按 6195099040 修订）

Status: PROPOSED — 本分支为**仅文档差量**，显式堆叠依赖 PR #513（afae2635）；合并本 PR 不得连带合入 #513 未合并实现（堆叠声明见文末）。按本仓 AGENTS 提交原评审，不接受不实现。

## 修订对照（6195099040 P1/P1-b）
- 删除 V1 的 path 字段要求与"无权/不存在/过期"三态区分；统一 NOT_FOUND_OR_NOT_VISIBLE。
- 修正存储描述：Site 存私有不可变 transport intent；本仓 records.js 已持久 digest-bound message——缺口是**返回合同**，非存储。
- 问题重读择一：**扩展原 own-read 显式 question selector/投影**（方案2，无新路由面）；原 /question 新路径提案撤回。Gateway 当前 accepted 五条闭合路由、own-read 仅 content_cursor——新增 selector 须 Gateway/DSH 所属合同差量评审，不在本提案内自行生效。
- Workflow 事实 provider 明确：**svc-workflow 为真实 provider**；accepted WEBSITE_HUMAN_WORKFLOW_INQUIRY_V1:79,168 标记的 GAP-WHI-001（网站 Human 的 Workflow 只读读取）就是本合同 A 要关闭的缺口；不得借 Agent/MCP/admin 身份补足。

## 合同 A：Workflow 只读读取（关闭 GAP-WHI-001 的所属差量）
- 真实 provider：svc-workflow；可信 caller：原 Human Owner（经 Auth Human 身份，非 Agent/MCP/admin 身份）；对象 ACL：原工作流可见域逐次校验。
- 按 accepted WEBSITE_HUMAN_WORKFLOW_INQUIRY_V1 的差量流程提出：新增只读 endpoint/selector 的 route/DTO/错误码/版本绑定，逐字段：
  instance_id、definition_id/version、current node/visit/stateVersion、节点进入时间、submission/transition 记录（原 ID+时间）、已登记产物引用（artifact_id/source_ref/version/size/hash——**不含 path**；确需路径仅明确根内安全相对名）。
- 纪律：缺字段逐项 UNKNOWN/NOT_RETURNED（区别标注）；缺节点进入时间不算停滞；对象拒绝统一 NOT_FOUND_OR_NOT_VISIBLE（不泄露存在性）；每页重验当前 ACL；分页 keyset+coverage+truncated。

## 合同 B：负责人解析（角色定义修订）
- 输入：当前节点的 **assignee AGENT Principal**（现有 exact resolver 的输入形态）；Auth 持有 canonical 映射。
- 角色区分：**业务 Owner Principal ≠ 当前节点 assignee Principal ≠ canonical Agent ID**——Human Owner 可能不是 assignee；三者分列返回，不把 Human Owner 强转成 Agent。
- 冲突/失败：无 assignee、assignee 非 Agent Principal、canonical 映射缺失、多映射冲突——逐项有限错误码；Human/Agent 角色选择规则、实际 Auth 调用授权、发送前再核验（节点/Owner/版本变化即失效重解析）都在本合同内定义。
- 输出加 binding 证据：解析时间、来源版本、Auth 调用引用（脱敏）。

## 合同 C：原问题正文重读（方案2）
- 形式：原 own-read 扩展 question 投影/selector（对 exact RID 绑定的原始 UTF-8 字节），不新增 /question 路径、不建第二存储/代理。
- 返回：原始字节、bytes 数、SHA256、原 message 坐标（未发送=坐标 null/NOT_RETURNED）；授权前一律 NOT_FOUND_OR_NOT_VISIBLE，授权后才可返回该对象过期等细节；每页/每次重验 ACL；no-store。
- 分页：历史/事件沿用既有 seq/high-water 合同；本合同只定义 question 字节投影，不扩展通用历史。
- 保留策略与 Site/Gateway 投影同步冻结（ppd PR #10 V2 提案 R6/R7 同步更新）。

## 堆叠与评审声明
- 本 PR（823f161 后续提交）= **仅文档**；显式堆叠于 #513（afae2635）。合并策略二选一由维护者定：① 等待/先行合并 #513 后本 PR rebase；② 以 cherry-pick 单文件方式只取 docs/ 文件。#513 继承源码上的自动审查意见（high-water、写入前确定拒绝、恢复失败事件等）路由回 **#513 原实现逐项核实**，不以本文档 PR 关闭。
- 消费者：ppd 投影（PR #9 将同步/被 PR #10 的 V2 替代）。
