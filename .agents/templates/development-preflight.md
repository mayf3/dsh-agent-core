# DEVELOPMENT_PREFLIGHT

> 用途：Coding Agent 在改动第一行代码前，先证明自己理解 repository intent。
> 模板来自 `docs/specs/AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1.md` §8（status: accepted）。
> 保持精简——**不是** 50 项 checklist。

```text
DEVELOPMENT_PREFLIGHT

Problem =
Governing Spec =
Spec status =

Relevant investigations =
Relevant decisions =
Previously rejected alternatives =

Frozen boundaries =

Implementation scope =
Out-of-scope =

New evidence =

Need new/amended Spec = YES / NO
```

约束：

- `Spec status` 必须是 `accepted` 才具备实现许可。
- `Need new/amended Spec = YES` 时，**不得开工实现**，先走 AMEND / SUPERSEDE 评审路径。
- 若相关 proposal 已 `rejected`，必须在此显式给出 `New evidence = ...` 才能重新打开。
