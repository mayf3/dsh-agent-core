# .agents/README.md — Agent Development Protocol

本目录是 **Agent-facing 的开发协议 / 索引**，**不是**第四套 Knowledge Authority。
Repository 的知识权威是 `docs/`（见下）；`.agents/` 只是告诉 Coding Agent 怎么用它们。

> 约束来源：`docs/specs/AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1.md`（status: **accepted**）中的
> `.agents/` 设计（§12 / §13）——该 Spec 冻结了 Spec 作为 merge / implementation authority 的语义。

---

## 三个 Knowledge Authority（在 `docs/`，不在本目录）

| Artifact | Authority question | 落位 | 说明 |
|---|---|---|---|
| Investigation | 我们查到了什么？(Evidence) | `docs/investigations/` | evidence authority，**不授予实现权限** |
| Spec | 这次允许改变什么？(Implementation/Change) | `docs/specs/<SPEC_ID>.md` | 唯一 merge / implementation authority |
| Decision | repo 长期坚持什么？(Invariant) | `docs/decisions/` | 跨多个 Spec 长期成立的 repository invariant |

一句话区分：**Investigation = 我们知道什么；Decision = repo 长期坚持什么；Spec = 这次允许改变什么；
Implementation = 代码实际做了什么。**

---

## Standing Order（non-trivial 开发前必须完成）

在改动第一行代码前，按顺序：

1. **Search** `docs/investigations/`、`docs/decisions/`、`docs/specs/`，
   找与本改动相关的既有 artifact。
2. **Identify** governing accepted Spec、relevant investigations、relevant long-lived decisions、
   以及 rejected / superseded alternatives（含其拒绝原因）。
3. **Emit** `DEVELOPMENT_PREFLIGHT`（模板见
   `.agents/templates/development-preflight.md`），证明已理解 repository intent。
4. **No accepted Spec → do not implement**。
   若改动没有被任何 `status: accepted` 的 Spec 覆盖，不得开工（对齐 merge-gate G2）。
5. **Existing rejected proposal → do not reopen without NEW_EVIDENCE**。
   若相关方案已被 rejected，必须显式给出 `NEW_EVIDENCE = ...` 才能走评审路径；否则 decision
   stays closed。
6. **Spec insufficient → amend / supersede before coding**。
   若 scope 需要澄清/纠正但方向未变，走 AMEND；方向实质改变，走 SUPERSEDE。先合并
   amendment/superseding Spec，再实现。
7. **Implementation Agent → cannot expand its own governing Spec。**
   实现 PR 不得修改它自己正在实现的 governing Spec 文件（守护 `GOVERNING_SPEC_UNMODIFIED`）。

> 判断是 semantic judgment，属于 Reviewer，不由本目录的机械规则替你下结论。

---

## 实现完成后

- 输出 `SPEC_COMPLIANCE`（模板见 `.agents/templates/spec-compliance.md`），作为实现后评审的固有字段。
- 检测到 out-of-spec behavior 或 reintroduced rejected alternative 时，`SPEC_COMPLIANCE = FAIL`，
  Reviewer 显式返回，不得静默放行。
- 合并条件（对齐 merge-gate Spec）：`SPEC_GATE = PASS` + `SPEC_COMPLIANCE = PASS` + `TESTS = PASS`。

---

## 明确禁止建设

- **不建** `.agents/notes/`、`.agents/rejected/`、`.agents/archive/`。
  rejected/superseded 用 Spec / Decision 的 `status` metadata + 正文拒绝原因表达，不建物理目录。
- **不建**第四套 Knowledge Authority。仅当真实调查证明 `docs/` 三类无法承载某需求时，才允许在
  Spec 内提出新的 notes storage（需要 evidence，不默认开放式）。
- 本协议不引入任何 Runtime / Router / Scheduler / Auth / Broker / Kernel 变更。
