# 合同式交办：xattrfix-r2 — 按裁定授权实施消费者适配（SCOPE_ESCALATION 闭合）

## 监管裁定（授权你 STOPPED-XATTRFIX.md 的三点最小适配方案）
1. prerequisites 普通记录遍历排除 `_xattrs_map` 保留键
2. preserve-config 普通记录遍历排除保留键；xattr 子集比较按现存文件路径逐项比较（补齐后完整 inventory 相等仍含完整属性表）
3. final-binding 完整属性表直接比较；uid/gid 剥离与 kind/uid/gid/mode 检查只处理文件记录
保留键命名建议 `_xattrs_map`（下划线前缀+文档注明 reserved）；其余实现按你 STOPPED 前的设计（xattr -lr 单进程、
按 path 分段解析、ditto 后空值重贴、非空差异硬失败、fail-closed）。

## 任务
1. 实施 xattr 修复 + 三点消费者适配（ STOPPED-XATTRFIX.md 最小可审阅范围扩展 1-3）
2. 合成树测试（五类夹具：有值/空值/多属性/无属性/dangling）全 PASS 输出原文
3. 执行器 dry-run PASS + git diff --check 过
4. commit 到 branch chore/fleet-window-tools（本 worktree）+ push + PR 引用本任务；**不 merge**
5. 失败/新消费者冲突即停写 STOPPED-XATTRFIX-R2.md（列精确冲突坐标）

## 红线
15 节点其余逻辑一字不动；零生产接触；失败即停
## 回执（RECEIPT-XATTRFIX-R2.md）
patch diff（含三处适配）、合成测试输出、dry-run 输出、PR URL、UNKNOWN
