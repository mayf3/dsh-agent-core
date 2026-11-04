# 合同式交办：EKR-preflight-r3 — 续作（含停机纪律粒度裁定）

## 监管对停机纪律的裁定（覆盖前两轮的过宽解释）
**"失败即停"的触发条件 = 以下之一**：① 产品源码验证断言失败且无法解释；② 发现必须改动产品源码才能继续的冲突；
③ 依赖数据缺失或矛盾；④ 被明确禁止的操作被要求。**不包括**：探索性命令的非零返回（如 rg 无命中、
zsh 通配符无匹配、目录不存在）、路径定位迭代、可重试的临时环境噪声。这类探索失败如实记录在回执即可，继续工作。
（前两轮的早停点：rg 非零/KeyError/zsh no matches——均属此类。）

## 背景
STOPPED-EKR-PRE.md（G1 完整+B4 harness bug）+ STOPPED-EKR-PRE-R2.md（zsh no matches 停）。
DEFECT-MATRIX.md 已有 G1 双版本对照+§2 WAE V3 冲突记录+调度契约部分清点。

## 任务（顺序）
1. 修组 5/B4 harness 的 SOURCE/REV 替换顺序 bug（先 REV 后 SOURCE 或 sentinel 隔离）——只改脚手架
2. 重跑组 5/B4 → 完成剩余组（B1/B2/B3 动态、P1-A obligation、P1-B 副作用、调度契约清点剩余）
3. 每组结果续写进 DEFECT-MATRIX.md（保留 G1 原文不改写）→ 全部完成后标注 COMPLETE + push + PR 引用 #1374（禁 merge）
4. 产品级验证失败仍按①停

## 红线
只读源码核查；内存桩隔离；零生产写入；失败即停按上述粒度裁定执行
## 回执（RECEIPT-EKR-PRE-R3.md）
harness diff、各组结果原文、矩阵定稿、PR URL、UNKNOWN
