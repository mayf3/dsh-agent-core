# 安装（开发者前置）

> status: current · 本页是「把仓库跑起来需要什么」的唯一 authority。产品级安装路径
> 尚不存在（见 [quick-start](quick-start.md)）。

## 前置

1. **Node.js**（ESM；`node --test` 可用）。
2. **DeepSeek Harness（DSH）checkout**：默认期望在 `../../github/deepseek-harness`，
   或以 `DSH_HARNESS_ROOT` 指定。Agent 子进程就是 `dsh --profile <profile>`
   （`cliBin()` 由 `@agent-core/agent-provisioning` 解析）。
3. **模型凭据**：`~/.dsh/.credentials.yaml`（含 `OPENCODE_GO_API_KEY`）。
4. **模型路由**（可选）：`~/.dsh/settings.yaml`（provider / model；生产可经
   `DSH_AGENT_PROVIDER` / `DSH_AGENT_MODEL` 覆盖）。
5. **飞书凭据**（可选，仅接 channel 时）：`FEISHU_CREDS_PATH` 指向的 creds 文件
   （缺省 channel OFF）。

凭据机制详见 [security/credentials](../security/credentials.md)——只描述位置，value
不入库。

## 安装

```bash
git clone <repo> && cd dsh-agent-core
npm install        # npm workspaces（packages/* + 根依赖 schemastery / lark SDK / croner）
```

## 验证安装

```bash
npm test
npm run install:integration   # （可选）把控制面 profile 装入 DSH home（symlink，additive）
npm run verify:product-integration
```

仓库为 npm workspaces monorepo：每个 `packages/*` 自带 `src/` + `test/`；根
`package.json` 聚合 test / verify 脚本。目录总览见
[architecture/overview](../architecture/overview.md) 的包清单。

下一步：[quick-start](quick-start.md)。
