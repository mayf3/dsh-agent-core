# LUNA_FALLBACK_ACTIVATION_CANDIDATE_V1 — 备用 执行（candidate round）

> TASK_NAME = 备用 执行 · TASK_TYPE = 执行 · 2026-08-30
> 性质：**开发 + 构建 + 测试 + 产出候选**。零生产配置写、零生产重启、零真实业务任务、
> 零真实 Luna model call、零 OAuth 内容读取（stat-only）、零 oc-go 临时 fallback。
> 证据目录：`docs/evidence/luna-fallback-candidate-20260830/`（16 文件 + MANIFEST sha256，
> whitespace-normalized）。候选运行时本体：`/Users/yanfenma/workspace/luna-fallback-candidate-20260830/`。

## 0. DEVELOPMENT_PREFLIGHT（Standing Order 输出）

```text
GOVERNING_ACCEPTED_SPEC =
  AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_ACTIVATION_V2（accepted 2026-08-29，reviewed_head 85431b5，
    PR #103 merge f54679c ∈ main；production_apply_authority=contracts — 本轮=§10.1 candidate 阶段）
  父 policy = AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V2（同事务 accepted；hop/STOP/identity/providerEnv 合同）
  实现 authority = AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_IMPL_V2（implementation_authority=contracts；
    §3 授权文件含 packages/production-runtime/src/model-overrides.js 与 route-chain 测试目录）
ROUND_AUTHORITY = 只开发/构建/测试/产出候选；NO_PRODUCTION_DEPLOYMENT = YES
RELEVANT_INVESTIGATIONS = AGT_CTO_LUNA_COLD_BACKUP_V2_EVIDENCE.md；route-chain-fallback-canary-plan-v1.md；
  ROUTE_OC_GO_QUOTA_DELIVERY_INVESTIGATION_V1（38eed56）；luna-manual-backup-v1.md（proxy 现场值）
REJECTED_ALTERNATIVES_RESPECTED = 全部遵守（见 §6 边界）
```

## 1. Worktree Gate

```text
AGENT_CORE_BASE = e2e1e22efabe99896bc0f83e02ac5e93d2c97f8d
  （fetch 时 fresh origin/main = PR #112 merge；创建 worktree 前即时 fetch 记录）
WORKTREE = /Users/yanfenma/workspace/project/dsh-agent-core.worktree-luna-fallback-candidate
  branch = impl/luna-fallback-candidate-v1（clean worktree；dirty checkout 未触碰、未带入构建）
HARNESS_PIN = 514ab7b0029141b88c807704764d0d3e1eea1da4
  （deepseek-harness origin/master 上真实 commit；既有 clean worktree
   deepseek-harness-clean-coldbackup-514ab7b 恰在该 commit，git status EMPTY）
构建源 = 上述两个 clean worktree；生产混合目录（/usr/local/libexec/agent-core/**）只读观察，从未作为构建源
```

## 2. 候选实现（in-scope 最小 delta）

PR #115（Draft）= branch `impl/luna-fallback-candidate-v1`，head
`8dd5845050ca46cba1814cf14272dd89fcaa79dd`，base `e2e1e22`，ONE commit / 3 files：

1. `packages/production-runtime/src/model-overrides.js` — **subscription route 的
   processConfig.omitEnv 追加 `OPENCODE_GO_API_KEY` + `OC_GO_API_KEY`**。事实依据：
   `process/env.js agentEnv()` 会给每个 spawn 从 `<home>/.credentials.yaml` 注入
   OPENCODE_GO_API_KEY，launchd parent 可携带 OC_GO_API_KEY，而旧 omitEnv 只有
   OPENAI_API_KEY —— Luna child 将能触达错误 provider（违反 Parent V2 §8/§10：
   Luna 只用 in-place OAuth store；no silent success with wrong provider）。
   **builtin route 保持逐字节旧 omitEnv**（glm53/其余 Agent 零漂移）。
2. `packages/production-runtime/test/model-overrides.test.js` — omitEnv 契约 +
   agentEnv 边界证明（Luna child 三键全无；builtin child 行为不变）。
3. `packages/agent-router/test/route-chain/quota-classifier.test.js` — 任务场景 5、7 的
   显式测试（见 §5 映射）。

## 3. 可复现构建身份（blocker 1/4 候选级闭环）

```text
CANDIDATE_AGENT_CORE_COMMIT = 8dd5845050ca46cba1814cf14272dd89fcaa79dd（PR #115 head）
CANDIDATE_HARNESS_COMMIT    = 514ab7b0029141b88c807704764d0d3e1eea1da4（= POL-V2-010 pin）
CANDIDATE_ARTIFACT_DIGEST   = sha256:14e62445d67045c6b761385cbdc9a7fef03d12022342896c082e6ceed91485aa
                             （artifacts/harness-installed-tree.tar，1,031,446,528 bytes，
                               全 installed tree 含 node_modules 与内嵌 runtime stamp）
SOURCE_STAMP_PATH = /Users/yanfenma/workspace/luna-fallback-candidate-20260830/stamps/candidate-harness-stamp.json
                    （rich stamp：repository/commit/builtAt/dirty=false/dirtyCount 实测 0/
                     artifact digest/build command+node25.6.1+pnpm11.7.0/pins）
                    + harness/.source-stamp = {"commit":"514ab7b…","dirtyCount":0}
                    （DEC-V2-001 精确闭合 schema，随 tree 部署，0644）
SOURCE_STAMP_VALID = YES
  正向：readHarnessIdentity(无 .git 候选 tree) → {version 0.1.0-rc.8, commit 514ab7b…}，双 pin 全中
  负向 drill x3：stamp commit 不匹配 / dirtyCount=1 / stamp 缺失 → 全部 dsh_commit_mismatch FAIL_CLOSED
  （identity-negative.txt；单元级另有 provisioning.test 5 个 stamp 用例 12/12 PASS）
dirtyCount=0 是实测（build 前后 git status --porcelain 均为空），非假设（ALT-ACT-007 禁止项未违反）
构建 = 本轮亲跑 `corepack pnpm build`（pnpm 11.7.0 = packageManager 精确版本，~25s，exit 0，
  tracked 零改动）；产物↔stamp digest 互绑（stamp 记 digest，artifact 内嵌 runtime stamp 的 commit）
```

**subscription spawn 的 dsh_commit_mismatch 风险（blocker 4）候选级闭环**：候选 harness tree
（无 .git + 合法 stamp）下 identity 解析精确命中双 pin ⇒ `provisionExactProfilePlugin` 的
dshVersion/dshCommit pin gate 在候选上不再 fail；三类篡改 drill 全部 fail-closed。
生产部署（GATE-5）仍待部署轮按 CTR-V2-001 只做部署侧 stamp 生成（identity 代码未改）。

## 4. Luna provider / route / 凭证证据（blocker 2/3 候选级）

```text
GLM_ROUTE  = glm53 = builtin / zai / glm-5.3 / credentialReadiness zai-api-key-home
             （plugin/pluginVersion/providerEnv ABSENT；pi-ai@0.82.1 zai provider 内置；
               目标 home settings.yaml zai 块 apiKeyEnv=ZAI_API_KEY models=[glm-5.3]；
               目标 home .credentials.yaml 键名含 ZAI_API_KEY —— 均非 secret 字段）
LUNA_ROUTE = luna = subscription / openai-codex / gpt-5.6-luna / dsh-codex@0.2.3 /
             credentialReadiness luna-oauth-home + providerEnv 精确四键
             （HTTP_PROXY=http://127.0.0.1:7890, HTTPS_PROXY=同, NO_PROXY=localhost,127.0.0.1,::1,
               NODE_USE_ENV_PROXY="1" —— runbook 现场核验非 secret 值；本轮 TCP 探活 REACHABLE）
LUNA_PROVIDER_REGISTERED = YES — 插件源码 `OPENAI_CODEX_PROVIDER = 'openai-codex'` 精确注册名；
             配置/代码无 luna→别名模糊映射（canonical identity 七字段 + alias duplicate fail-loud）
LUNA_MODEL = gpt-5.6-luna — 存在于 harness 内置 pi-ai@0.82.1 openai-codex 模型目录
             （7 个 codex 模型含 gpt-5.6-luna/sol/terra）
SUBSCRIPTION_PROFILE = dsh-codex@0.2.3（目标 home 既有，package.json version 实读=0.2.3；
             production profile bundles 已注册）+ openai-codex OAuth store
             `.openai-codex-auth.json`（插件 OPENAI_CODEX_AUTH_FILENAME 常量=配置 credentialFile 一致）
             + ChatGPT 订阅路径（OPENAI_API_KEY 恒 omitted；无 API-credits 路径）
OAUTH_PROVENANCE_VERIFIED = PARTIAL（候选级上限）
             - 元数据实测：regular / uid502 / 0600 / 2092B / mtime 2026-08-20T06:46:21+0800，
               与 OBS-V2-002 冻结值逐项一致（本轮零内容读取、零 hash、零改动）
             - 不可信 → fail closed 机制在位：credential_missing / credential_permission_invalid
               fail-loud（provisioning.test 覆盖）+ GATE-3 Owner 接受是部署闸
             - 未闭环：mtime 早于激活授权的 provenance 异常仍在，Owner GATE-3 接受未记录；
               token 在线有效性 unknown（本轮不探测，POL-V2-007 授权读取者清单不含 status probe）
OPENCODE_GO_API_KEY 不继承 = YES（本轮修复 + 测试证明；builtin 链不变）
~/.codex/auth.json：本会话零读取零改动（stat-only）。注：其 mtime=2026-08-30T14:44:14+0800
             （本会话首次 stat 前数分钟由外部进程变更 —— 非本会话所为，如实记录；该文件本就不在
               Luna 边界内，Luna OAuth 独立且未动）
```

## 5. 路由语义 + 10 场景测试证据

目标链 `routes[0]=glm53 → routes[1]=luna`，仅 proven-no-admission 四类白名单或证据完整的
`provider_quota_rejected_before_generation` 允许单跳；Luna 失败不回跳、无循环、单 logical turn、
单 deadline、不盲跳 timeout、429 非完整证据一律 STOP —— 全部由 main 既有实现（PR #76/#111）
+ 本轮 delta 的测试矩阵证明：

| # | 任务场景 | 证据（全 PASS） |
|---|---|---|
| 1 | glm53 initialize 前明确拒绝 → hop 一次 | route-chain.test「each whitelisted failure hops exactly once」+ quota-classifier「the other three no-admission classes still hop」 |
| 2 | glm53 proven-no-admission quota → hop 一次 | quota-classifier「A (real process): terminal pre-generation 429 hops glm53→luna→success」（TOTAL=2, FINAL=luna, Luna call=1） |
| 3 | glm53 post-admission quota → STOP | quota-classifier「B (real process): 429 after partial assistant output STOPs」+「text-only quota → STOP post-admission」 |
| 4 | glm53 timeout + outcome unknown → STOP | quota-classifier「C: never terminates ⇒ outcome_unknown STOP」+「429+transport timeout ⇒ STOP」+ route-chain CTR-005 全族 |
| 5 | Luna 初始化失败 → STOP 不回跳 | **本轮新增** scenario 5（attempts=2 终止、无第三次 acquire、无回跳、finalRoute=NONE） |
| 6 | Luna turn 成功 → 只一个最终结果 | A(real process) + scenario 7（单 result、单 route_chain_final） |
| 7 | fallback 禁止重复工具调用 | **本轮新增** scenario 7（失败 attempt 零工具、Luna 恰一次工具、单 dispatch）+ canary-seam observer counts |
| 8 | stamp commit 不匹配 → fail closed | provisioning.test「stamp identity feeds pin check (mismatch fail-loud)」5 用例 + 本轮 3 个 live drill |
| 9 | OAuth/profile provenance 不可信 → fail closed | provisioning.test「credential boundaries fail loud」（credential_missing/permission）+ loader credentialReadiness fail-loud + GATE-3 部署闸（机制级） |
| 10 | 配置缺 luna route → 启动前拒绝、不回退 oc-go | model-overrides.test「unknown ref fail loud」+ 本轮 live drill（AGENT_MODEL_OVERRIDE_INVALID，loader 抛错非 passthrough） |

```text
ORDERED_FALLBACK_TESTS      = 21/21 quota-classifier + 16/16 route-chain + 10/10 provider-route
                              + 8/8 process-registry-route-gate + 15/15 canary-seam
NO_DOUBLE_DELIVERY_TESTS    = scenario 7 新增 + A(real) 单 reply/onDispatch-once +
                              canary-seam exact-counts/one-shot-race/crash-post-rename 族
POST_ADMISSION_STOP_TESTS   = B(real) / text-only / unsafe-flag B-D 矩阵 / C(outcome_unknown) /
                              transport-timeout / termination-unknown（attempts=1, Luna=0, STOP）
IDENTITY_FAIL_CLOSED_TESTS  = provisioning 12/12（git 优先/valid stamp/dirty≠0/malformed/missing/
                              pin-mismatch）+ live drill x3 + loader scenario10 live drill
套件总量 = agent-router 235（233 pass）+ agent-provisioning 12/12 + production-runtime 42（35 pass）
```

**失败清点（全部预存，零新增）**：agent-router 2 个失败与 production-runtime 6 个失败在
**精确 base 内容 e2e1e22**（同环境、candidate delta 三文件 checkout 回 base）复现一致
（preexisting-failures-stash-proof.txt）：feishu-regression 1 个（PR #111 给 turn opts 加
`feishuSenderOpenId` 后未更新断言 —— main 预存回归，该测试文件不在 IMPL V2 §3 scope，未动）；
child-env T3（真实 harness boot，解析到未 pin 的 dev harness —— 环境）；production-runtime 6 个
全部是 git 依赖 `@larksuite/channel` 本地从未安装（npm pack/git clone 均被网络阻断；在 PR #111
worktree 与主 checkout 同样失败 —— 跨 checkout 预存环境缺失，与本候选 delta 无关）。

## 6. 候选组装与边界

- path→blob manifest：**40 个 src 文件**（agent-router/production-runtime/agent-provisioning/
  scheduler-router 全 src 面），逐一 `git show <candidate-commit>:<path>` 提取，**40/40 blob
  hash 逐一复核匹配**（candidate-path-blob-manifest.json）。生产 apply 轮按 CTR-V2-006 在
  audited merged commit 重新冻结（本 manifest 是候选闸位）。
- 候选 runtimeRoot `/Users/yanfenma/workspace/luna-fallback-candidate-20260830/root/`：
  `agent-model-overrides.json` v2（0644，glm53+luna routeCatalog、仅 agt_cto-agent override）。
  loader read-back（用**提取出的候选 tree 本体**）：chain=glm53→luna、双 identity distinct、
  luna subscription pins 精确（0.2.3/rc.8/514ab7b）、providerEnv 四键、omitEnv 含 oc-go 双键、
  非 target agent passthrough 不变、resolve() primary=zai/glm-5.3。
- 生产路径零触碰：`/Users/authsvc/.agent-core/agent-model-overrides.json` 未读写；
  launchd plist 只读 dump（无 proxy/ZAI/OPENAI 键，CTR-ACT-B08 复证）；未 restart 任何服务；
  未发送任何业务/模型请求。
- 遵守的拒绝项：未 re-OAuth/refresh/copy credential；未 install/upgrade dsh-codex；未拷 .git；
  未伪造 dirtyCount；未用 oc-go 临时 fallback；route 顺序只在配置；未把 ambiguous 429 视为可跳。

## 7. Final

```text
CANDIDATE_AGENT_CORE_COMMIT = 8dd5845050ca46cba1814cf14272dd89fcaa79dd（PR #115 Draft，base e2e1e22）
CANDIDATE_HARNESS_COMMIT    = 514ab7b0029141b88c807704764d0d3e1eea1da4
CANDIDATE_ARTIFACT_DIGEST   = sha256:14e62445d67045c6b761385cbdc9a7fef03d12022342896c082e6ceed91485aa
SOURCE_STAMP_PATH          = …/luna-fallback-candidate-20260830/stamps/candidate-harness-stamp.json（+ harness/.source-stamp）
SOURCE_STAMP_VALID         = YES（正向解析双 pin 命中；mismatch/dirty/missing 三 drill fail-closed）

GLM_ROUTE  = glm53（builtin/zai/glm-5.3）
LUNA_ROUTE = luna（subscription/openai-codex/gpt-5.6-luna/dsh-codex@0.2.3 + providerEnv 四键）

LUNA_PROVIDER_REGISTERED   = YES（'openai-codex' 精确名，无别名映射）
LUNA_MODEL                 = gpt-5.6-luna（pi-ai@0.82.1 codex 目录在册）
SUBSCRIPTION_PROFILE       = dsh-codex@0.2.3 + openai-codex OAuth store（in-place，未读）+ 订阅路径（无 API-credits）
OAUTH_PROVENANCE_VERIFIED  = PARTIAL（元数据级；Owner GATE-3 接受未记录；mtime 异常仍在）

ORDERED_FALLBACK_TESTS     = PASS（场景 1/2/5/6 全绿，见 §5 表）
NO_DOUBLE_DELIVERY_TESTS   = PASS（场景 6/7 + canary 计数族）
POST_ADMISSION_STOP_TESTS  = PASS（场景 3/4 + 全负矩阵）
IDENTITY_FAIL_CLOSED_TESTS = PASS（场景 8/9/10 + stamp 五用例 + live drill x3+1）

PRODUCTION_CHANGED            = NO
PRODUCTION_SERVICES_RESTARTED = NO
REAL_BUSINESS_TASK_SENT       = NO

REMAINING_BLOCKERS =
  B1 生产 0700/0755 drift：agent-provisioning/src/index.js assertOAuthCredentialBoundary 在
     credential 存在时要求 home 0700，而 Parent V2 POL-V2-008 冻结生产 home=0755（实测
     drwxr-xr-x）⇒ 生产 Luna spawn 将 credential_permission_invalid fail-loud。该文件不在
     IMPL V2 §3 scope ⇒ 本轮只记录；生产激活前需合法 authority 修正或 Owner 变更 home mode。
  B2 IMPL V2 GATE-I2-9：PR #111（classifier/canary 实现）独立审计未发生；GATE-6 未全绿。
  B3 GATE-3：Owner 对既有 OAuth provenance 的显式接受未记录（mtime 异常待 Owner 裁量）。
  B4 GATE-7/8：candidate canary（真实 1 次 Luna call）与 production canary 属激活轮，
     本轮按任务边界未执行。
  B5 main 预存回归 2 项（feishu-regression 断言过期、@larksuite/channel 本地缺失）——
     非本候选引入，建议独立修复轮。
READY_FOR_INDEPENDENT_AUDIT = YES

NEXT_TASK = 备用 审计
```
