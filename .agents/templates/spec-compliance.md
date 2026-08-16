# SPEC_COMPLIANCE

> 用途：实现完成后，作为「实现是否在 scope 内」评审的固有字段。
> 模板来自 `docs/specs/AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1.md` §9（status: accepted）。
> 其中 §9 冻结了 merge condition（`SPEC_GATE = PASS` + `SPEC_COMPLIANCE = PASS` + `TESTS = PASS`）。

```text
SPEC_COMPLIANCE

Referenced Spec =
Implemented scope =
Acceptance criteria evidence =
Out-of-spec behavior = NONE | ...
Rejected alternative accidentally reintroduced = NO | YES
Frozen boundaries respected = YES | NO
New architectural decision introduced = NO | YES
Knowledge artifacts needing update = NONE | ...

SPEC_COMPLIANCE = PASS / FAIL
```

约束：

- `SPEC_COMPLIANCE = FAIL`，或检测到 `Out-of-spec behavior = ...` 时，Reviewer 明确返回，
  不得静默放行。
- `Rejected alternative accidentally reintroduced = YES` 时直接 FAIL。
