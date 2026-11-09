# 合同式交办：EKR P1-B ONLY 纵向测试（2026-11-06 第4派）

## 范围（仅此一项）
P1-B 跨 attempt 副作用稳定性的纵向测试补齐：
- "回执丢失后换 attempt" 场景：同一业务操作在新 attempt 重入时，必须复用既有稳定业务 effect key（attempt ID/generation 不得成为业务 key），且外部工具已 UNKNOWN 的效果不得重做
- 复用既有 managed 三操作机制（workflow_operation_effects），不新增产品行为、不改既有语义
- 纯测试交付（新增测试 + 必要的既有测试文件内补充）；如测试暴露真实产品缺口 → 停，写 STOPPED，不修产品

## 明确排除（P1-A 已 blocked-on-spec，勿触碰）
- HUMAN_REQUIRED 通知/答复/验证/重唤醒协议 —— 待 Spec AUTHOR（#1352 Owner 裁定）
- obligation 持久化/后继归属 —— 归 svc-workflow 实现线（#1378）
- 任何 Core 侧 case/phase continuation 引擎

## 已消除的停止条件（监管预置，不再构成停止依据）
- dsh-tools 依赖已修（符号链接→物理包 0.1.0-rc.8）；第3派已实测基线 67/67 rc=0
- base=f6a1f77a 未动；branch ac-ekr-p1-new 续用；上游若移动 → 停并报告，不自行 rebase

## 机械教训
apply_patch 锚点必须完整行（含声明全文），禁部分行/正则匹配；一次失败即停。

## 交付定义
1. 新测试全绿 + 既有五件套基线 67/67 仍全绿（原始输出存 docs/evidence/ekr-p1b/）
2. RECEIPT-EKR-P1B.md：base/head SHA、diff stat、全部测试输出原文、UNKNOWN 如实
3. git push origin ac-ekr-p1-new；gh 可用时创建 PR 引 #1374 标注 "P1-B only (P1-A blocked on spec-author)"，不 merge；gh 不可用（TLS 超时）→ 完成提交并停，推送由监管补做，不算失败

## 红线
零生产写入；不动窗口工具；不动 #622/#624/#625 已落语义；失败即停写 STOPPED-EKR-P1B.md
