---
spec_id: AGENT_CORE_WORKFLOW_EXECUTE_PRODUCTION_READY_RESOLUTION_V1
status: accepted
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
date: 2026-09-03
accepted_by: mayf3
accepted_date: 2026-09-03
accepted_reviewed_base: 97ac086907d6a1f18c6743294e3330a4f14fd10c
accepted_reviewed_spec_commit: b1c12102d1fec4ae2750ad612be40362289e74ab
acceptance_review_verdict: PASS
scope:
  - mayf3/dsh-agent-core
  - workflow_execute receipt recovery composite-conclusion rule only
governed_by:
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
  - AGENT_CORE_WORKFLOW_EXECUTE_RECEIPT_RECOVERY_V2
supersedes: []
superseded_by: null
owners:
  - mayf3
---

# AGENT_CORE_WORKFLOW_EXECUTE_PRODUCTION_READY_RESOLUTION_V1

> **ACCEPTED / RESOLUTION AUTHORITY.** V2 §9 composite 规则按本文件 §2
> 修订；resolution record 按 §3 落盘。不授权任何生产动作。

## 1. Problem statement and new evidence (NEW_ACCEPTED_AUTHORITY_CONFLICT)

accepted `AGENT_CORE_WORKFLOW_EXECUTE_RECEIPT_RECOVERY_V2`（PR #151，lifecycle
`062120bd3a588c4bede5d3130772355f7d4c25e0`）§9 要求 composite 结论
`WORKFLOW_EXECUTE_PRODUCTION_READY = YES` 的证据合取包含
"Owner/root exit-zero 与由 exact wrapper 导出的安全 assertions"，并在
"任一缺失或 provenance 为 unknown 时 MUST 写 NOT_ESTABLISHED"。

publication 已按 V2 全链执行并独立审计 PASS（evidence：
`docs/evidence/workflow-execute-receipt-recovery-v2-20260903/PUBLICATION_AUDIT.md`
@ PR #152 `31d078a`；addendum `GRANT_READBACK.md` @ PR #153 `04c5dad`）：

- Owner 执行 transcript exit_code=0（durable，locator/time/digest 齐全）；
- original receipt identity_after 与 identity_before 逐字节一致；
- supplement 发布面（schema/hash/root:wheel 0644/nlink=1）PASS；
- P1/P2/PID/health/current-credential 只读回查 PASS；
- current-Grant 只读回查 PASS（GRANT_READBACK.md：workflow.execute active
  clients=105、svc-workflow machine_access_grants=298、auth_audiences DB face、
  全部含 locator/time/digest）。

唯一未满足的合取项：**原部署事务**的 `owner_root_exit_zero_*` 与
`original_transaction.*` —— 该值在原事务发生时即无 durable 记录（零字节
receipt 的成因本身），不存在任何可采集来源，属 Goal 明示的
`UNKNOWN_NOT_DURABLY_RECORDED` 设计内永久历史未知。这不是证据缺失，而是
证据对象不存在；任何后续轮次都无法改变。

冲突：按 §9 字面，一个永久不可得的**历史**未知将永久阻断综合结论 YES，
而 recovery 自身的 exit-zero（transcript）与全部可采集合取项均已 PASS。
此冲突真实阻断 Goal 定义的 terminal 结论，构成最小修正的合法前提。

## 2. Amendment (focused, single-clause)

对 V2 §9 的 composite 规则作唯一修订（V2 其余全部 bytes 冻结不动）：

- **不阻断类**：原事务历史值——封闭集合：`original_transaction` 的
  `transaction_id` / `a4_before` / `grant_before_sha256` /
  `credential_before_sha256` 四字段、原事务 `owner_root_exit_zero_evidence`
  / `_time` / `_extract_sha256` / `conclusion` 四字段、以及由原 wrapper
  bytes 导出的原事务安全 assertions——凡 provenance 已按 CTR-RR-002
  记为 `UNKNOWN_NOT_DURABLY_RECORDED` 且在 evidence 中显式列出的，不阻断
  composite 结论——因为不存在也不曾存在其 durable 证据来源；RECEIPT
  TERMINALIZATION 的目的恰是以带 provenance 的 supplement + 独立 audit
  承载这一不可重建性。本封闭集合之外无任何"等"类推空间。
- **仍阻断类**：以下任一缺失/provenance unknown 仍 MUST 写
  NOT_ESTABLISHED——(i) pre-recovery durable target-live catalog；(ii)
  create/transition/final-readback E2E 事件链；(iii) **recovery 事务自身**
  的 Owner transcript exit-zero（locator/time/digest）；(iv) recovery 时
  P1/P2/PID/health/current-Grant/current-credential 只读回查；(v) 本
  recovery 的 publication audit PASS。
- 判定不变量：NO_FABRICATION（不得为历史未知构造任何 value）、
  NO_PROVENANCE_UPGRADE（unknown 不得升格）、conclusion 记录位置 =
  declared audit evidence path。

## 3. Resolution record (post-acceptance, docs-only addendum)

Owner 接受 + 本 Spec merge 后，授权在
`docs/evidence/workflow-execute-receipt-recovery-v2-20260903/` 追加
`PRODUCTION_READY_RESOLUTION.md`：引用 PUBLICATION_AUDIT.md +
GRANT_READBACK.md 的全部 records，按修订后规则写出：

```text
WORKFLOW_EXECUTE_PRODUCTION_READY = YES
（historical unknowns carried: original_transaction.*,
 owner_root_exit_zero_* = UNKNOWN_NOT_DURABLY_RECORDED）
```

本 Spec 不授权任何 production mutation、E2E、Grant/credential、部署或
restart；resolution record 纯 docs-only。

## 4. Acceptance scheme

proposed → 独立审计（判断：冲突真实性、focused 形式有效性、修订后规则
的可判定性、resolution record 内容与 evidence 指针一致性）→ Owner 对
exact head 接受 → lifecycle allowlist（frontmatter `status:
proposed -> accepted`、`implementation_authority: none -> contracts`，
`production_apply_authority` 保持 `none` 不翻转；
`accepted_by/accepted_date/accepted_reviewed_base/
accepted_reviewed_spec_commit/acceptance_review_verdict` 五字段置值；
banner FROM→TO 替换；README 行 lifecycle/authority 同步）→
FINAL_HEAD_RECHECK → merge。Literal `FROM` = 本文件标题下 banner；`TO`：

```text
> **ACCEPTED / RESOLUTION AUTHORITY.** V2 §9 composite 规则按本文件 §2
> 修订；resolution record 按 §3 落盘。不授权任何生产动作。
```

README 仅允许本 Spec 行 lifecycle/authority 同步。
