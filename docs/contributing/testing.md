# 测试与验收约定

> status: current · 本页描述当前测试面与验收文化。

## 单测

- 框架：Node 内置 `node --test`（零外部测试依赖）。
- 位置：每个包自带 `packages/<pkg>/test/*.test.js`；根 `npm test` 全量聚合
  （`node --test 'packages/*/test/*.test.js'`）。
- 子集：如 `npm run test:scheduler`、`npm run test:scheduler-router`。

## 验收驱动（verify scripts）

本仓库的迭代文化是 **Spec → 实现 → verify 脚本验收**：每个 Spec 轮实现都伴随一个
可重复执行的 `scripts/*-verify.mjs`（输出断言式 PASS/FAIL 证据）。当前全集见
[reference/cli](../reference/cli.md) 的 developer verification 一节。

- verify 脚本是 **developer verification**（本机可重复），不是 CI 产品门禁
  （CI/徽章未建设）。
- 历史各轮的验收证据（测试计数、断言清单）归档在
  [docs/history/reports/](../history/reports/)——历史，当前事实以脚本本身为准。

## 合并门禁

`SPEC_GATE = PASS` + `SPEC_COMPLIANCE = PASS` + `TESTS = PASS`
（`docs/specs/AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1.md` §9）。

## 写测试的边界

- 产品行为测试放对应包的 `test/`；一次性验收放 `scripts/`。
- 不为已废弃的 V0 切片补测试（`examples/v0-vertical-slice/` 冻结为历史）。
