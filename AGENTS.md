# AGENTS.md — Repository Bootstrap

Coding Agent：在开始任何 **non-trivial** 开发之前，**先读** [`.agents/README.md`](.agents/README.md)。

那里定义了 repository 的开发协议 / standing order——如何用 `docs/specs/`、
`docs/investigations/`、`docs/decisions/` 找到 repository intent，以及改动第一行代码前
必须输出的 `DEVELOPMENT_PREFLIGHT`。

本文件是极薄的 bootstrap，**不复制**任何治理政策、artifact 模型或 checklist。规矩都在
`.agents/README.md` 与被引用的 accepted Spec 里。

- trivial 改动（格式化、错别字、机械 rename）：可直接处理。
- **non-trivial 改动**：先读 `.agents/README.md`，按其要求找到 governing accepted Spec 并输出
  `DEVELOPMENT_PREFLIGHT`。**没有 accepted Spec 或需要 new/amended Spec 时，不得开工实现。**
