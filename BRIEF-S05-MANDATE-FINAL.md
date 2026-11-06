# 合同式交办：W6-S05 实质解除 + Mandate 终稿（2026-11-06，Owner 裁定后）

## 输入（全部已就位）
- 草案基线：EXECUTION-MANDATE-W6-V1.md（PR #629）+ S04 收据（PR #630：20命令rc0/16检查/cold三例零模型调用）
- Owner 裁定②：installer 权效写授权=仅冻结安装器已列精确路径+安装/回退必需；RESTORE-R2 树外路径单独枚举绑定本次 preimage/receipt；权限前后态+回退可恢复证明
- Owner 裁定③：05b 机制已接受；生产权限待终稿获批；四禁止（批量结算/业务结果推断/重放/重新投递）；仅移除该记录有权解除的 fence contribution
- S05 R1 事实：pause JSON stamp writer/reader 版本冲突 + main 不读暂停文件（fork map）

## 任务
1. **S05 实质解除**（只读调查+方案，不实现生产代码）：
   - pause 继承：窗口操作边界内如何跨切换保持准入停止（候选不读旧 JSON → 用 launchd/system 层还是窗口阶段显式停止？给出与现行已接受机制兼容的最小方案 + 依据；不可解则如实 STOP-UNKNOWN 边界）
   - stamp writer/reader 冲突：26813473 writer 格式 vs main reader 期望的精确差异 + 处置建议
2. **Mandate 终稿**（EXECUTION-MANDATE-W6-V2.md）：
   - 草案基线 + S04 收据 + 裁定②③全部落实
   - §效果清单：installer 权效写**逐路径枚举**（从冻结安装器 1150-1218 提取精确路径表）+ RESTORE-R2 树外路径单独表（绑定 preimage/receipt 坐标）
   - §05b 边界：四禁止 + fence contribution 精确语义
   - §执行参数：精确 HEAD（app 75ece578/harness 13ecda5c/Node v25.6.1+二进制SHA）、writer 身份、窗口时段建议（待 Owner 定时间，文档给推荐段）、每阶段 PASS 条件+失败 STOP 配方+时间预算
   - §恢复：预镜像坐标（bootout 前）、RESTORE-R1/R2 配方、回退兼容边界（D-009 v3 schema 版本线）
   - §剩余 UNKNOWN：如 haltable token aud、真实 consumer——如实列
   - §执行申请：请求批准的精确 scope + "批准前零 stage_00"
3. 交付：两文档 + RECEIPT-S05-MANDATE-FINAL.md + 提交 push + PR 引 #605（gh 超时提交即停）

## 红线
零生产写入；零源码改动（Mandate 引用既有合并产物 SHA）；不启动 stage_00；不创建 authority JSON；失败即停写 STOPPED
