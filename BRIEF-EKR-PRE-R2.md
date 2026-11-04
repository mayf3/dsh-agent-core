# 合同式交办：EKR-preflight-r2 — 修 harness 替换 bug + 完成剩余验证组（G2-G8）

## 背景（先读 STOPPED-EKR-PRE.md 与 DEFECT-MATRIX.md）
组 5/B4 的内存验证 harness 因 SOURCE/REV 替换顺序 bug（NEEDS_REVIEW 被误改成 NEEDS_"fa4510be"IEW）
致两 Node 子进程 rc=1；三个分组按纪律停。已交付：G1（P0-A 完整双版本对照）、部分调度契约清点、
live 三文件对照、WAE V3 CTR 冲突定位（B1/B2/B4 需正式 spec 路由——已记入矩阵 §2）。

## 监管裁定
1. **修 harness 替换顺序**（先 REV 后 SOURCE，或用带 sentinel 的独立替换步骤），只改测试脚手架
2. **续作剩余验证组**：G2-G8 中尚未完成的（B1/B2/B3/B4 动态验证、P1-A obligation、P1-B 副作用、调度契约清点剩余）
3. B1/B2/B4 的 spec 冲突**不阻塞动态验证**——验证记录现状行为与任务书期望的差距即可（矩阵已有 §2 记录）

## 任务顺序
1. 修替换 bug → 重跑组 5/B4 → 结果如实
2. 完成剩余未跑组 → 每组输出进 DEFECT-MATRIX.md（续写，保留 G1 原文）
3. 全部完成后：RECEIPT-EKR-PRE-R2.md + 矩阵定稿标注 COMPLETE；push + PR 引用 #1374（禁 merge）
4. 失败即停写 STOPPED-EKR-PRE-R2.md

## 红线
只读源码核查；隔离 harness 用内存桩；零生产写入；live 树只读；matrix 已有内容不许改写
## 回执
harness diff、剩余组结果原文、矩阵定稿、PR URL、UNKNOWN
