# CAPTAIN-REMAINING-CONDITIONS-20261109 — 差量3：条件接续与等待门清理

坐标： Principal `5964fd61-1de1-4dd5-a28f-bac00f95c5a3`（external_ref `release-captain-agent-core-20261107`，agent/active/ownerless，identity-only，双读回 PRESENT，PR #665 闭环）。权威：`owner-20261107-sra-formalization` 二、（五条件）＋ `owner-20261107-five-decisions` ①（顺序）＋ 常设授权 §4/§5。当前状态：**NOMINATED_NOT_APPOINTED，不得签发 W7**（该纪律不变）。

## 1. 撤销"待 Router 长稳"等待门

逐条核对了 sra-formalization 五条件、five-decisions ①、four-pr-rulings ①、standing-delegation §4/§5、three-unified ① 与 phase-receipt-deltas ⑤：**没有任何一份在任裁定把"Router 长期稳定"列为 Captain 任命或 SRA 激活的条件**。该门是此前轮次报告自行附加的等待项，无合同依据，按 Owner 2026-11-09 差量3 指令**撤销，不新增等待门**。Router 健康继续按 [HR-OBSERVATION-STANDARD-V2](HR-OBSERVATION-STANDARD-V2.md) 作为运行观察项报告，但不构成任命前置。

## 2. 五条件精确状态（五条均有可结束的下一步，无开放式等待）

| 条件（sra-formalization 原文） | 状态 | 剩余动作（可结束） |
|---|---|---|
| ① 唯一确认 Principal/Session/跨会话身份 | **部分**（Auth 身份记录 DONE；Session 绑定/跨会话延续未证） | 5964fd61 经正式 v1 API 创建+双读回；uid502 未被当作身份。**Session/跨会话延续证明待条件④ §6.5 控制验证时与实际入口一并绑定**（登记文件被任命者字段同步声明，不预支） |
| ② 能力＋独立于候选作者/生产 writer/独立 verifier | 部分 | 独立性结构 = PR #649 四 principal（A 监管线 Mandate 作者 / W 发布 worker / V 独立 verifier / C 专用 Captain），需在任命登记中落为可核对的身份映射表并核四者互异；能力由 ④ 的控制验证实证 |
| ③ 现行体系认可任命签发撤销审计路径 | **登记 DONE**（CAPTAIN-APPT-REG-20261109-01，2026-11-09，b7a1d889） | 七字段齐备（scope=STANDARD_RECOVERABLE、validFrom=生效收据时刻、validUntil=2026-12-07T16:00:00Z 不自动续期、撤销与审计坐标），入现行 DISPATCH-REGISTRY 治理账（非第二账本）；剩余=条件④通过后的正式任命（不再请批） |
| ④ 实际控制验证（越界/过期/缺门/错SHA/错执行者拒绝） | 未做 | §6.5 五项负向测试：对 mandate 校验机制逐项注入非法 mandate 并证明拒绝。前置=控制面适配（常设授权 §4"若现有控制不支持委托→原责任链在现有合法机制完成适配+负向验证"），这是当前**最大真实工作项**，非等待门 |
| ⑤ SRA 接受合 main＋控制资格独立验证 | **SRA 侧 DONE**（ACTIVE_ON_MAIN=YES）；控制资格侧=条件④未做 | 接受事务已录（2026-11-07）；非作者独立 final-HEAD 审查 PASS（2026-11-09，审查头 9529e9a5，blob 750504f2，语义差量 NONE）；激活 PR #682 已合并（04:51Z）。剩余仅控制资格独立验证（=条件④，见 PR #683 普查与 PR #684 Δ0） |

## 3. 生效顺序（five-decisions ①，保持）

身份记录核验（DONE）→ **任命登记（已完成：CAPTAIN-APPT-REG-20261109-01，条件式 NOMINATED_APPOINTMENT_PENDING_VERIFICATION）** → §6.5 控制生效验证（条件④，Δ0 普查 PR #684 已完成，Δ1–Δ5 待实施）→ 生效（五条件全满足后按 sra-formalization 二、由原合法任命责任链完成正式任命，不再请批）。

## 4. 生产边界（不变）

OPERATION_ALLOWED_NOW=NO；SRA accepted / Captain appointed / control effective / Mandate issued 是四种独立事实；W7 不自动签发；本文件不构成任何签发权。
