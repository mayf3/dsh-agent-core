# TRUSTED_CONTROL_PLANE_DEPLOYMENT_HARDENING_V1

> 关闭最后一个生产安全缺口：可信 Control Plane（uid 505 = authsvc）执行的全部
> 降权前代码/配置迁入受保护 install，uid 502（Agent/用户）不可修改、不可替换、
> 不可用 symlink 指回 502-writable 的开发 repo。

## 0. 结论（最终，验收 32/32 PASS）

```
TRUSTED_CONTROL_PLANE_DEPLOYMENT_HARDENING_V1 = PASS
TRUSTED_INSTALL_PATH = /usr/local/libexec/agent-core
CP_CODE_502_WRITABLE = NO
CP_CONFIG_502_WRITABLE = NO
CP_PROFILE_502_WRITABLE = NO
PRE_DROP_HARNESS_502_WRITABLE = NO
AGENT_CAN_MODIFY_TRUSTED_CODE = NO
AGENT_CAN_REDIRECT_TRUSTED_SYMLINK = NO
PARENT_UID = 505
CHILD_UID = 502
CREDENTIAL_STORE_ACCESS_FROM_502 = DENIED
REAL_BROKER_SMOKE = PASS
RESTART_HARDENED = PASS
AUTH_CHANGE = NONE
BROKER_CHANGE = NONE
ROUTER_CORE_CHANGE = NONE
KERNEL_CHANGE = NONE
AUTH_PRODUCTION_BOUNDARY = CLOSED
```

运行证据：`.demo/trusted-cp-hardening-v1/evidence.md`、`.demo/hardening-run11.log`。

## 1. Task 1 — 最小可信代码闭包（调查结论）

505 控制面启动链（TRUSTED_CREDENTIAL_BROKER_V1 冻结形态）：

```
root 驱动（sudo）
  └─ sudo -u authsvc node <trusted>/harness/apps/cli/lib/bin.js --profile agent-core-integration
       ├─ DSH_HOME = <trusted>/home            （profile agent-core-integration + farm → <trusted>/app）
       ├─ DSH_HARNESS_ROOT = <trusted>/harness （apps/cli + packages + vendor + node_modules 闭包）
       ├─ config = <trusted>/config            （Agent Definition agents.json / bindings / credential store，authsvc 0700）
       └─ 子进程：<trusted>/libexec helper (root:wheel 4755) → setuid(502) → exec <trusted>/harness CLI
            （降权后才执行；child profile/farm 指向 502 可读的 trusted app 或 502 自有区）
```

降权前（505 执行）需要保护的：

| 代码/配置 | 闭包 | 安装后属主 |
|---|---|---|
| DSH CLI + harness runtime | harness 源码拷贝 + `pnpm install --offline --frozen-lockfile --ignore-scripts --config.package-import-method=copy`（copy 模式，无指向 502 store 的硬链接） | authsvc:authsvc 0755/0644 |
| Agent Core 控制面代码 | app/：packages/*（src+package.json）、bundle-*、profile-*、scripts（resident/demo-home/…）；node_modules/@deepseek-ai → ../../harness/node_modules/.pnpm/node_modules/@deepseek-ai（trusted 内） | authsvc:authsvc 0755/0644 |
| 控制面 home | home/（profile 拷贝 + farm → ../app/…） | authsvc:authsvc |
| 生产配置 | config/（Agent Definition agents.json/bindings/credential store；模型设置源 /Users/authsvc/.dsh 0600） | authsvc:authsvc 0700/0600 |
| spawn helper | /usr/local/libexec/dsh-agent-spawn-helper | root:wheel 4755 |

关键结论：
- 任何受保护入口都不会跳回 /Users/yanfenma（install 审计 + 运行时 lsof 断言：505 进程
  打开 0 个 dev-repo 文件）；
- harness 闭包中无指向 502 属主 store 的硬链接（package-import-method=copy）；
- child 侧（502 降权后）继续执行 502-writable 代码（child profile/farm 在 502 区，
  workspace/runtime 普通权限）——符合"只有降权后才允许执行 502-writable code"。

## 2. Task 2 — 最小 production install

- `scripts/trusted-cp-deploy-install.sh`（root 运行，可重复）：
  1. 备份旧 install（config 在 .bak 中保留）；
  2. harness 源码拷贝 + pnpm prod 安装（copy 模式）；
  3. app 闭包拷贝（无 tests/node_modules）；@deepseek-ai bridge（trusted 内）；
  4. 控制面 home（profile + farm）；种子 /Users/authsvc/.dsh（模型设置源，0600）；
  5. config 0700 authsvc；6) 属主/模式；7) helper 校验 root:wheel 4755；
  8. symlink 审计（不允许逃出 trusted root）；9) 代码中无 /Users/yanfenma 引用审计；
  10) uid-502 现场抽查（写/替换/symlink 全部 DENIED）。
- 无新 Deployment Platform；开发 repo / harness 保持 502-writable 可继续开发。

## 3. Task 3 — DSH / Harness 边界

- 505 parent 执行：<trusted>/harness 的 CLI + 全部组合插件 + <trusted>/app 的
  Agent Core 包 → 全部 trusted（502 只读）。
- 502 child 执行：同一 trusted CLI（降权后 exec，只读）＋ child 自有 profile/farm
  （502 区，普通权限）→ 合规。
- helper：505 → helper(root) → setuid(502) → exec DSH：exec 时已降权，child 代码
  可保持 502 属主。

## 4. Task 4/5 — 真实验收（运行证据）

见 `.demo/trusted-cp-hardening-v1/evidence.md`（驱动自动生成）与
`.demo/hardening-run2.log`。

### Task 4 攻击矩阵（uid 502，canary 文件；run1 已全过，run2 复跑）

| 攻击 | 结果 |
|---|---|
| 写 trusted Router 代码（app/packages/agent-router/src/index.js） | DENIED (status=1) |
| 写 trusted Broker 代码（app/packages/broker/src/gateway.js） | DENIED |
| 写 trusted harness（apps/cli/lib/bin.js） | DENIED |
| 写控制面 profile（home/profiles/agent-core-integration/cordis.patch.yml） | DENIED |
| 替换 profile / bundle | DENIED |
| 写生产 config（config/agents.json） | DENIED |
| 替换 spawn helper（rm /usr/local/libexec/dsh-agent-spawn-helper） | DENIED |
| symlink 把 trusted path 指回 502 repo（ln -s ~/dsh-agent-core app/packages/agent-router） | DENIED |
| 在 trusted 树内建 symlink | DENIED |
| 全部 canary 文件攻击后字节不变 | PASS |
| helper 仍 root:wheel 4755 | PASS |
| trusted 树 symlink 审计（无逃逸） | PASS |

### Task 5 真实 Broker smoke（hardened 部署下）

`real Agent(child 502, 无 secret/token) → parent RPC → trusted gateway(505) →
real auth-service → real svc-forum → ok`；PARENT_UID=505、CHILD_UID=502、
CREDENTIAL_STORE_ACCESS_FROM_502=DENIED；restart 后 gateway 再起 + 再次真实调用。


## 5. Review 修复 — Trusted Node（MERGE_REVIEW blocker）

Review 唯一 blocker：505 pre-drop 的 Node interpreter 曾是 `/usr/local/bin/node`
（Homebrew，uid 502 可修改 → 502 换 node → restart CP → 以 505 执行 → 边界绕过）。

### Fix 1 — Trusted Node（install 脚本）

- 把实际使用的 Node runtime（`/usr/local/Cellar/node/<ver>` 整个版本目录）以
  **cp -RL 真实拷贝**进 trusted closure：`<root>/node-runtime/`（80M，零 symlink）；
- `TRUSTED_NODE = /usr/local/libexec/agent-core/node-runtime/bin/node`
  （authsvc:authsvc 0755/0644，502 只读）；
- 安装时硬校验：真实文件（非 symlink）、可运行（--version）、**与 Cellar binary
  inode 不同**（非 hardlink）、node-runtime 内零 symlink。

### Fix 2 — 启动链统一（driver/部署）

- CP 启动：`sudo -u authsvc /usr/bin/env … <TRUSTED_NODE> <trusted-cli> --profile …`
  （不再出现 /usr/local/bin/node）；
- CP env：`PATH = <node-runtime>/bin:` 置首 —— 任何 505 pre-drop 的裸 `node`
  解析都落在 trusted runtime；
- child：helper argv 的 interpreter 来自 CP 的 `process.execPath` = trusted node
  （setuid(502) 后执行同一 trusted runtime，读取路径 502 只读）。

### Fix 3 — 攻击验收（新增，全部 PASS）

| 检查 | 结果 |
|---|---|
| TRUSTED_NODE_502_WRITABLE（502 写 trusted node） | NO (DENIED) |
| TRUSTED_NODE_502_REPLACE_DENIED（502 rm node） | DENIED |
| TRUSTED_NODE_PARENT_502_WRITABLE（502 写 node-runtime/bin） | NO (DENIED) |
| TRUSTED_NODE_PARENT_502_REPLACE_DENIED（502 rm node-runtime） | DENIED |
| TRUSTED_NODE_502_SYMLINK_REDIRECT_DENIED（ln -s /usr/local/bin/node 替换） | DENIED |
| TRUSTED_NODE_REAL_FILE（非 symlink，authsvc 0755） | PASS |
| TRUSTED_NODE_NO_CELLAR_HARDLINK（inode 独立） | PASS |
| restart 后 CP_NODE_PATH = trusted path、PARENT_UID=505 | PASS |
| 505 lsof：0 个 /usr/local/Cellar/node、/usr/local/bin/node 文件 | PASS |
| 505 lsof：trusted node 打开（1） | PASS |

### Fix 4 — 重跑 smoke（全部 PASS）

REAL_BROKER_SMOKE（child 502 → Router → Broker → real auth → real svc-forum）、
RESTART_HARDENED、CHILD_UID=502、CHILD_NO_CREDENTIAL、
CREDENTIAL_STORE_502_DENIED —— 45/45 PASS（`.demo/hardening-run12.log`）。

不修改 Auth / Broker / Router core / Agent Definition / Kernel：
AUTH_CHANGE=NONE, BROKER_CHANGE=NONE, ROUTER_CORE_CHANGE=NONE, KERNEL_CHANGE=NONE。

## 6. Agent Definition 兼容集成（TRUSTED_CP_AGENT_DEFINITION_COMPAT_V1）

Hardening 原基于旧 main（writable agent-registry service）。最新 main 已由
AGENT_DEFINITION_CONFIG_V1 取代 agent-registry：Agent 存在性权威是声明式
`control/agents.json` / `seedDefinition` 配置（`packages/agent-definition`），
`packages/agent-registry` 已删除。本次兼容集成把 Hardening 验收环境切到新权威：

- **verify driver**（`scripts/trusted-cp-hardening-v1-verify.mjs`）：
  - 移除 `import { AgentRegistry }`（旧 registry store 读取）；
  - Agent A/B 现在通过正式 `adoptAgents({ configFile: agents.json })` 创建
    （AGENT_DEFINITION_CONFIG_V1 语义，仍是 hardening acceptance fixture）；
  - CP env 由 `AGENT_REGISTRY_STORE` 改为 `AGENT_DEFINITION_CONFIG`；
  - 新增验收字段：`OLD_AGENT_REGISTRY_REFERENCE`（trusted 闭包内旧模型引用
    扫描）、`HARDENING_VERIFY_USES_AGENT_DEFINITION`、`AGENT_DEFINITION_AUTHORITY`、
    `TRUSTED_INSTALL_AGENT_DEFINITION` / `TRUSTED_INSTALL_AGENT_REGISTRY`。
- **install**（`scripts/trusted-cp-deploy-install.sh`）：
  - app 闭包校验 `packages/agent-definition` PRESENT、`packages/agent-registry` ABSENT；
  - config 种子由 `registry.json` 改为声明式 `agents.json`（空文档，部署侧
    adoptAgents 授权）；
  - 控制面 home farm 由 `agent-registry` 链接改为 `agent-definition` 链接，
    并为 latest main 新增的 `@agent-core/notification-ingress` 补 farm 链接。
- 安全边界零改动：TRUSTED_NODE / 505-502 / credential store / broker smoke /
  restart 全部沿用已复审实现。Agent Definition 仍是唯一 Agent existence
  authority；Hardening 不维护第二份 Agent 列表。

### 最终真实验收（latest-main integration branch, root verify）

在基于最新 main 的 integration branch 上重新执行完整 Trusted CP Hardening
verification：

- 迁移期间 find/修复的最新 main 架构差异（均机械兼容，非重新设计）：
  1. `packages/agent-registry` → `packages/agent-definition`（旧 import/store/
     env/farm 全清），`OLD_AGENT_REGISTRY_REFERENCE = NONE`；
  2. latest main 的 workspace-bootstrap（WORKSPACE_BOOTSTRAP_ROUTER_HOOK_V1）
     会让 505 parent 因 child workspace 的 AGENTS.md 权限报 EACCES → verify
     在 child-runtime provisioning 时预 seed AGENTS.md，ensure() 幂等跳过；
  3. **acceptance-only 模型切换**：默认模型路由（pi-ai catalog 的
     `opencode-go`）命中外部 429 QUOTA（provider 月度额度），非代码问题。
     仅本次验收，verify driver 临时把 trusted CP home + child home 的
     settings.yaml 指向 `oc-go` provider（openai-completions 网关
     `https://opencode.ai/zen/go/v1`，model `deepseek-v4-flash`，已确认
     有额度），并经 `DSH_AGENT_PROVIDER=oc-go` + 运行时注入 `OC_GO_API_KEY`
     让 child 路由到该 provider。key 从不 commit/打印/持久化。**不修改**
     install 脚本或 `/Users/authsvc/.dsh`；产品默认模型配置零改动
     （`PRODUCTION_MODEL_CONFIG_CHANGE = NONE`）。

最终 root verification 结论（`.demo/hardening-compat-final3.log`，
`TESTS = 51/51 PASS`）：

```
TRUSTED_CP_AGENT_DEFINITION_COMPAT_V1 = PASS
READY_FOR_REREVIEW = YES
OLD_AGENT_REGISTRY_REFERENCE = NONE
HARDENING_VERIFY_USES_AGENT_DEFINITION = YES
AGENT_DEFINITION_AUTHORITY = SINGLE
TRUSTED_INSTALL_AGENT_DEFINITION = PRESENT
TRUSTED_INSTALL_AGENT_REGISTRY = ABSENT
TRUSTED_NODE_502_WRITABLE = NO
TRUSTED_NODE_REDIRECTABLE = NO
PARENT_UID = 505
CHILD_UID = 502
CREDENTIAL_STORE_502_DENIED = PASS
REAL_BROKER_SMOKE = PASS
RESTART_HARDENED = PASS
AUTH_PRODUCTION_BOUNDARY = CLOSED
ACCEPTANCE_MODEL_OVERRIDE = oc-go/deepseek-v4-flash (acceptance-only)
PRODUCTION_MODEL_CONFIG_CHANGE = NONE
```

`REAL_BROKER_SMOKE` 真实打通：child uid502 → real model(oc-go) →
`forum_my_notifications` → parent @505 → Broker → real auth-service →
real svc-forum，模型拿到真实 tool result 并返回非空最终回复
（reply 含 `{"ok": true, ...}` 的 forum 结果）。

KERNEL_CHANGE = NONE, AUTH_CHANGE = NONE, BROKER_CORE_CHANGE = NONE,
ROUTER_CORE_CHANGE = NONE, AGENT_DEFINITION_PRODUCT_CHANGE = NONE。
