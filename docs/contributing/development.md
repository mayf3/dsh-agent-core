# 本地开发

> status: current · 面向贡献者的开发约定。

## 开发环境

见 [getting-started/installation](../getting-started/installation.md)（Node + DSH
checkout + 模型凭据）。本仓库是 npm workspaces monorepo；根 `package.json` 聚合
test / verify 脚本。

## 开发协议（必须遵守）

本仓库用 **Knowledge Governance** 管理改动（governing Spec：
`docs/specs/AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1.md`，accepted）：

- 三类 authority：`docs/investigations/`（查到了什么）→ `docs/specs/`（这次允许改变
  什么，唯一 merge/implementation authority）→ `docs/decisions/`（长期 invariant）。
- **non-trivial 改动前**：读 [AGENTS.md](../../AGENTS.md) →
  [`.agents/README.md`](../../.agents/README.md)，输出 `DEVELOPMENT_PREFLIGHT`
  （模板 `.agents/templates/development-preflight.md`）。**没有 accepted Spec 不得
  开工实现**。
- **实现完成后**：输出 `SPEC_COMPLIANCE`（模板
  `.agents/templates/spec-compliance.md`）。合并条件 = `SPEC_GATE = PASS` +
  `SPEC_COMPLIANCE = PASS` + `TESTS = PASS`。
- 实现 PR 不得修改它正在实现的 governing Spec（GOVERNING_SPEC_UNMODIFIED）。

## 工作流约定（现状）

- 分支按 `docs/<spec-id>`（Spec 轮）与 `feat/<spec-id>`（实现轮）命名，使用独立
  linked worktree 开发；main 只接受经 review 的 merge。
- 当前文档树维护规则：**current 文档事实改变时直接改写对应 authority 页，禁止底部
  追加「更新（日期）」时间轴**（时间演化属于 decisions / history / git history）。

## License 状态

仓库尚无 LICENSE（`package.json license = UNLICENSED`）。License 决策属 Project
Owner；在该决策落地前，外部贡献渠道（CLA / CONTRIBUTING 流程）暂不开放。

相关：[testing](testing.md) · [architecture-rules](architecture-rules.md)。
