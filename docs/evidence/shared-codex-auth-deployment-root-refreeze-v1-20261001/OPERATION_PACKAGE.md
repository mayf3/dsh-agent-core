# OPERATION_PACKAGE — SHARED_CODEX_AUTH_DEPLOYMENT_ROOT_REFREEZE_V1（2026-10-01）

Goal：把 B7（#414）从 2026-10-01 STAGE 1 失败推进到 **可部署的 NEW 冻结包边界**。
本 Goal 零 production mutation、零 OAuth login、零 credential bytes 读取（全程
hashes/metadata）、零 credential 复制、零共享树在役面改动（本目录为本 Goal 新增产物；
`.worktrees/b7-refreeze-source-20261001` 为唯一新源码 checkout，已 commit、未 push）。
**旧 2097e4f 冻结包（shared-codex-auth-post-router-prep-v1-20260925/）原样保留，零改动。**

上游 authority（fresh 重读，全部只读）：

```text
Product 要求        = #414 [PRODUCT B7] deploymentRoot-safe re-freeze（DONE_WHEN 1-7 本包范围）
incident 取证       = #376 comments 5927663468 / 5930514483（2026-10-01 STAGE 0/1 全记录）
amendment（accepted）= AGENT_CORE_FLEET_SHARED_CODEX_AUTH_ACTIVATION_V1_AUTHSVC_RECONCILIATION_AMENDMENT
                      specHead b08db324（PR #311）；A2 canonical-by-deployment-root / A4 / §5
user-domain freeze  = ACTIVATION_V2 CTR-ACT2-001/002（minimal compose adjustment 预期 + 值冻结）
prior frozen pin    = 2097e4f948dca77a12d24afa1ff9fb42e9ec7756（.worktrees/deploy-2097e4f 完整保留）
NEW source pin      = d8ddf54605da7b1b9a1f951949e3f6062a6a2004（base origin/main 360756e3，
                      branch svc/b7-shared-codex-deployment-root-refreeze-20261001）
```

---

## 0. 判定字段（本 run 终值）

```text
ROOT_REPRO                  = YES（三项全部机械复现：①installer §8 同款 grep 对 2097e4f 打包树
                              → FAIL 恰三条 seam；②同款对当前 main 360756e3 → FAIL 同三文件；
                              ③custody census verdicts() 对 2026-10-01T174051 真实 census
                              （94 store 行）→ ReferenceError: readFileSync is not defined）
SOURCE_REFREEZE             = YES（三 seam deploymentRoot/security-surface 参数化 + compose 最小
                              接线，user-domain 行为 byte/semantic 等价；+17 专项 cross-surface
                              测试全绿；回归 = baseline 平价）
INDEPENDENT_REVIEW          = PASS / SHIP_BLOCKERS = NONE（exact head d8ddf546，C1-C9 全 PASS，
                              3 条 NON_BLOCKING gaps 全部吸收进本包 §7；全文见
                              INDEPENDENT_REVIEW.md）
RELEASE_TOOL_FIXES          = 2/2（installer §0b pre-mutation gate + §8 truthful late-gate +
                              wrapper 去除虚假 "NOTHING was deployed"；census verdicts()
                              readFileSync import —— 两处均经只读功能性验证）
OLD_PREIMAGE_PRESERVED      = YES（agent-core.bak-20261001-174434 未触碰、禁删至新部署
                              rollback/readback 证明完成）
PRODUCTION_MUTATION         = NO（本 Goal 全程；fleet availability 保持，lineage
                              12616dbff17f 未触碰）
PROD_AUTH                   = PREPARED（WAITING_PROD_AUTH：STAGE 0→2 全部 Owner 门）
```

---

## 1. 当日机械复核（2026-10-01，全部只读 hashes/metadata）

```text
NEW source worktree .worktrees/b7-refreeze-source-20261001
                    = HEAD d8ddf54605da7b1b9a1f951949e3f6062a6a2004，status clean，
                      tree 18fcc6b83874cd23857a3626ef6ef9aa7920b88d ✓
plugin tgz  staging /Users/yanfenma/.agent-core/staging/chatgpt-subscription-provider-v1-authsvc/
            dsh-codex-0.2.3-75d98d5b.tgz
                    = d4f0d0ec794a84d9e3daa346a3a51c5d61a5ebf5504ac0397707d298216dfea2 == marker ✓
scopes tgz  同目录 codex-deps-scopes-rc8.tgz
                    = 7c628e30f142569916a355b772a311acfbfebf35d8efdb47bf1f1cfda45f8c77 == marker ✓
carrier     docs/evidence/openai-codex-refresh-token-reused-v1-20260910/owner-authsvc-plugin-upgrade.sh
                    = 9f835448ded70f1941293bcc194389743fa9b0f3c41442e22b367b0ba2668966 == marker ✓
marker      docs/evidence/openai-codex-refresh-token-reused-v1-20260910/AMENDMENT_ACCEPTED.marker
                    （deploymentRoot=/Users/authsvc/.agent-core，txSchema=1；STAGE 2 G1 逐字段复验）
旧 pin worktree .worktrees/deploy-2097e4f = HEAD 2097e4f… 完整保留（R4：禁止原地换件） ✓
跨面 gate 终验：同款 §8 grep 对 NEW pin 打包树 = PASS（零命中）✓
```

---

## 2. NEW pin 相对 2097e4f 的语义（评审全文佐证）

```text
seam A  packages/agent-provisioning/src/shared-codex.js
        CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE = 执行面自身的 canonical
        （canonicalOpenAICodexCredentialFileFor(<home>/.agent-core)——yanfenma 面取值与
        CTR-ACT2-002 冻结值 byte-identical；authsvc 面在 authsvc 进程下解析为自身 canonical；
        生产消费点全部显式 pin，homedir 非 load-bearing——评审 C9）
seam B  packages/production-runtime/src/model-overrides.js
        常量单源化自 seam A 并 re-export；loadAgentModelOverrides(+options.deploymentRoot)
        恰接受 pin 根自身的 canonical——外来面 lineage 或任意第三路径 fail closed
        （AGENT_MODEL_OVERRIDE_INVALID）
compose 接线（CTR-ACT2-001 预期的 minimal compose adjustment）
        两处调用点传 deploymentRoot: layout.root（--root 权威，launchd/argv 决定，不依赖
        执行用户 HOME）；model-overrides-runtime fixture 按 A2 对齐为「per-root 自身 canonical」
seam C  packages/production-runtime/src/shared-codex-migration-executable.js
        事务域身份由 config.canonicalCredentialPath 结构承载（deploymentRootOfCanonicalPath
        经 seam A 形状校验）；shared-config/fence 期望值由该根推导——跨面混配 config
        SHARED_CODEX_PATH_INVALID fail-closed；switchFleetConfig/fleetConfigUsesCanonical
        改用域 canonical（config 携带），user-domain fence 落点与冻结行为 byte-identical
不变量   EXPECTED_FLEET=92、CANARIES=STOCK/CEO/CTO、artifact pin（0.2.3/2d29f95f 与
        0.2.3-dshr1/160bbefc）、rollback-never-restores-legacy 全部零触碰
```

## 2.1 打包面 gate 不变量（本次 re-freeze 的存在理由）

```text
打包闭包（scripts 白名单 11 项 + packages package.json/src/public-root-entries
[trusted-app-package-copy.mjs] + bundle-*/profile-* 元数据）内 /Users/yanfenma 字面量 = 0
（新增 gate-mirror 测试机械锁定三 seam 源文件；installer §0b 对全打包集复扫）。
已知预期例外（评审 GAP-2，非缺陷）：两枚 scan-excluded 工具自身
（trusted-cp-deploy-install.sh / trusted-cp-hardening-v1-verify.mjs——非 control-plane
执行码，排除规则 pre-existing）仍含该字面量；本包如实登记。
```

---

## 3. 两个 release-tool 缺陷修复（incident 证据驱动）

```text
RT-1 installer late-gate（scripts/trusted-cp-deploy-install.sh @ NEW pin，sha256 dfb262b6…）：
  新增 §0b PRE-MUTATION cross-surface gate——把 app closure 以与 §3 完全相同的选择规则
  （共享 APP_SCRIPTS_WHITELIST / 同一 trusted-app-package-copy.mjs / 同 bundle-profile 集）
  打入 scratch staging 并跑与 §8 逐字节相同的 scan，位置在首个 production mutation
  （§1 backup mv）之前 ⇒ 污染失败零代价；§8 保留为 post-pack 复验，其失败路径改为如实
  报告 mutation truth + 精确 restore 命令（不再静默 exit 2）。
  验证：0b 功能 harness 对 NEW pin = PASS；植入污染 fixture = FAIL(2) 且报
  "NOTHING was mutated"；bash -n OK；--validate-source/--selftest-provenance 不受影响。
RT-2 执行器与 census（证据目录内就地修复，sha256 见 §4.0）：
  owner-router-closure-g2-g7.sh（WGR 原件，4b1c1829…）deploy 分支不再断言
  "NOTHING was deployed"，改为如实指引核对最新 agent-core.bak-* preimage 并精确恢复；
  owner-auth-custody-census.sh（7556029d…）verdicts() 补回缺失的
  readFileSync import（2026-10-01 STAGE 0c crash 修复；verdict 逻辑零改动；对当日真实
  census 94 行复跑全量 verdicts 输出 + --selftest PASS）。
```

---

## 4. 冻结部署包（OPERATION_PACKAGE_READY=YES）

### 4.0 Exact artifacts（唯一允许进生产的字节集）

```text
APP deploy source   = d8ddf54605da7b1b9a1f951949e3f6062a6a2004
                      （tree 18fcc6b83874cd23857a3626ef6ef9aa7920b88d）
deploy checkout     = .worktrees/b7-refreeze-source-20261001（clean；deploy 前复核
                      HEAD/tree/status 三元组）
binding-time 安装器 = 该 checkout 内 scripts/trusted-cp-deploy-install.sh
                      sha256 dfb262b61fdf23e55fbf6ce7327b83f7f35494fda2bc98d60cbff08a7f239a05
STAGE 1 执行器      = 本目录 owner-router-closure-g2-g7.sh（rebound copy）
                      sha256 b0a5efe0ed151557429b3514bfdec1667d18697be2e962c78ce75deed05d5973
                      （内含 EXPECTED_SHA/TREE/DEPLOY_SRC/EVIDENCE 四重绑定 + selftest PASS）
custody census      = docs/evidence/router-durable-generation-restart-safety-v1-20260921/
                      owner-auth-custody-census.sh
                      sha256 7556029d6f005b02663669d2f26be16d7edad5605ba5a4bc94897f5321127dad
codex plugin tgz    = d4f0d0ec…（staging dsh-codex-0.2.3-75d98d5b.tgz，source pin 75d98d5b）
codex scopes tgz    = 7c628e30…（staging codex-deps-scopes-rc8.tgz）
carrier             = owner-authsvc-plugin-upgrade.sh r12 = 9f835448…
marker              = AMENDMENT_ACCEPTED.marker（V1 evidence dir；deploymentRoot=
                      /Users/authsvc/.agent-core，txSchema=1）
明确排除            = 旧 2097e4f 树作为 deploy 输入、任何 main HEAD 构建、任何未审本地字节、
                      旧 drift tgz（2d29f95f 作为 artifact 身份保留在 pin 内，不作为 tgz 消费）
```

### 4.1 执行顺序（不可倒置；每步 Owner 门；本包自身零执行）

```text
STAGE 0  前置核查（同一天窗口内；全部 Owner sudo/交互）：
  a. production-deploy.lock holder 核查（安装器 fail-closed 打印 holder；禁手清锁）
  b. sudo <本目录>owner-router-closure-g2-g7.sh preflight   # durable load + floor 普查
  c. FRESH LIVE PREIMAGE RE-PIN（#414 DONE_WHEN 7）：对当前在役树取全新时间戳备份
     （算法：sudo rsync -a /usr/local/libexec/agent-core/
      /usr/local/libexec/agent-core.bak-<UTC-timestamp>-pre-b7-refreeze/ 并 diff 校验）；
     agent-core.bak-20261001-174434 原样保留（禁删/禁覆盖），直至新部署 rollback/readback 证明
  d. fleet lineage/health 复核：8790 ok:true/deliverReady:true；canonical lineage =
     12616dbff17f（metadata only）；若 KNOWN_EXPIRY（2026-10-11 17:43 +0800）临近或已过 ⇒
     先 FRESH_LOGIN（owner-authsvc-login-20260920.sh，exactly-once，直落 canonical），
     新 lineage 成为 §0 preimage
  e. sudo owner-auth-custody-census.sh receipt（修复版脚本；四 Done-When flag 由脚本
     verdicts 直接产出——RT-2 后无需人工聚合）
STAGE 1  Router/app deploy（root）：sudo <本目录>owner-router-closure-g2-g7.sh deploy
  （内含 EXPECTED_SOURCE_SHA=d8ddf546…/EXPECTED_SOURCE_TREE=18fcc6b8…/GENERATION_LABEL
  三重强制；安装器 §0b 先 pre-mutation gate，再 §1 backup mv（=自动 per-deploy preimage
  <算法同上，安装器内建>），失败时如实报告 mutation truth + 精确 restore）
  → health → G4/G5 两轮真实 turn snapshot/verify-restart → close ⇒
  ROUTER_RESTART_SAFETY=PROVEN（副作用收益：A4 provisioner + 本 refreeze 三 seam 随之在役）
STAGE 2  Codex closure Phase E/F（carrier r12，原 r12 内建硬门原样生效）：
  §0 fresh reconciliation → G1 marker 逐字段 → G2 三方 SHA 一致 + REQUIRED_EXPORTS →
  armed --apply（事务状态机 …zero-per-home-open 硬门 → credential-layer model canary
  [失败自动回滚]）→ APPLIED_AWAITING_PONG → Owner feishu REAL PONG（COMMIT GATE）→
  --commit --transaction <id>（全量 topology 重验）→ COMMITTED_PENDING_FENCE_CLEAR →
  fence clear → COMMITTED → final topology census +
  sudo owner-auth-custody-census.sh post-census → POST_ACTIVATION_RECEIPT +
  DEPLOYMENT_HANDOFF.md → EMERGENCY_RECOVERY 判定（预期 NO）
STAGE 3  生产验收（#414 DONE_WHEN 9）：health ok:true/deliverReady:true；real Luna canary
  （driver，真 luna 调用）；小型并发 delivery 零 refresh_token_reused；新/未来 home 解析
  canonical 而非 92 路复制；restart/readback 证明 loaded identity；rollback/readback 对
  新 generation 有效
STAGE 4  （仅验收后）临时 92-home 重复 credentials 与过旧部署备份的清理——独立 transaction
```

### 4.2 Rollback / preimage

```text
preimage 算法（冻结）：
  P-1 安装器内建：§1 backup mv ⇒ /usr/local/libexec/agent-core.bak-<YYYYMMDD-HHMMSS>
      （每 deploy 自动一份；rsync -a --delete 语义可整树恢复）
  P-2 部署前 Owner 再 pin（§4.1 STAGE 0c）：agent-core.bak-<UTC-ts>-pre-b7-refreeze
  P-3 存量证物：agent-core.bak-20261001-174434（trusted live tree 的 exact preimage）
      —— 本包存续期内禁删；STAGE 3 验收完成前禁清理任何 backup/preimage 目录
router 侧恢复（truthful 版）：rm -rf /usr/local/libexec/agent-core &&
  mv <最新 agent-core.bak-*> /usr/local/libexec/agent-core（执行前记录 evidence；
  恢复即回旧代码 ⇒ 重新引入 floor 缺失与未参数化 seam，恢复理由必须记档）
carrier 侧：r12 回滚合同原样（armed ERR/INT/TERM/HUP/EXIT 自动回滚；re-entry gate；
  回滚永不恢复 legacy per-home；92 旧 store 留证不删）
```

### 4.3 Tombstone / fail-closed 边界（冻结不变，沿 20260925 包 §4.3 全文）

```text
canonical 0600/0700、非 symlink、nlink=1、tombstone absent；store poisoned/unavailable ⇒
admission fail-closed；carrier 任何硬门失败 ⇒ 自动回滚；zero-per-home-open 为硬门；
one lineage one owner、禁复制 lineage、禁 token surgery、yanfenma credential 永不给
authsvc 消费（§5）——NEW pin 的三 seam 把最后一条从「纪律」升级为「结构拒绝」。
```

---

## 5. OWNER_OAUTH_CUSTODY_REQUIRED（独立 gate，沿 20260925 包 §5）

```text
ACTIVATION_MODE 二选一（Owner 裁定）：RATIFY 当前 lineage（12616dbff17f，fresh 至
2026-10-11 17:43 +0800——若 STAGE 2 可在 expiry 前完成）或 FRESH_LOGIN（同款 exactly-once
工具，在 --apply 之前，新 lineage 成为 §0 preimage）。receipt →（activation）→ post-census
全链 Owner sudo/交互；Agent 侧无剩余可做项。
```

## 6. TESTS（评审独立复跑 + 本 run 记录）

```text
评审 C7（fresh-context，node v25.6.1 + DSH_HARNESS_ROOT）：provisioning 29/29、
model-overrides 25/25、model-overrides-runtime 5/5、default-model-route 5/5、
shared-codex-migration 11/11、yanfenma-realignment 9/9、bootstrap 8/8、compose 12/12、
NEW refreeze 三件套 11/11 + 2/2 + 4/4、router trio 37/37 —— 全绿。
luna-credential-chain 3 败 = pristine main 同款 documented pre-existing（child-spawn 环境，
PR #312 记录在案）＝ baseline 平价。
RED-first 存证：源改动前同三件套 = 7+2 败（authsvc 接受面/跨面矩阵/gate-mirror 全红）→
改动后全绿。
apply 时刻复跑（写入 §4.1 顺序内）：multiprocess-shared-auth-acceptance.mjs 对在役 GEN_DIR、
92×effective-credentialFile 机械链、zero-per-home-open、全量 topology census。
```

## 7. 风险与评审 gaps（如实登记）

```text
R1 部署执行窗内 fleet availability：STAGE 1 受控重启沿用 trusted-cp 线既有合同；STAGE 0c
   先取 fresh preimage ⇒ 双 preimage（174434 存证 + fresh）覆盖回滚。
R2 lineage expiry 2026-10-11 17:43 +0800：逾期即先 FRESH_LOGIN（§4.1 STAGE 0d 分支）。
R3 production-deploy.lock：规则不变（安装器 fail-closed 兜底；Owner 按 holder 找责；禁手清）。
R4 本包冻结件生命周期：staging tgz 与 carrier 为 immutable 冻结字节（今日 SHA 复核一致）；
   NEW pin 为唯一 deploy 输入；上游再需更新 ⇒ 新 amendment/新冻结，禁止原地换件。
G-1（评审 NON_BLOCKING）canonicalDefaultGlobalRoute 的内建默认 subscription block 仍携带
   执行面（homedir 派生）canonical 而非 layout.root 派生——pre-existing 分歧类（改动前对
   任意 --root 恒指 yanfenma），生产拓扑不可达（launchd 以面属主运行；A2 pin authsvc 根 =
   其 homedir 默认）；未来加固项，不入本包。
G-2（评审 NON_BLOCKING）两枚 scan-excluded 工具自身仍含字面量（§2.1 已登记）。
G-3（评审 NON_BLOCKING）os.homedir() 尊重 $HOME：未 pin 的带外调用方在伪造 HOME 下会解析
   出不同默认常量；全部生产路径显式 pin，不受影响。
runbook 新增前置：安装器 §0b 要求 PATH 内有 node（缺失 exit 2，先于一切 mutation）。
```

## 8. INDEPENDENT_REVIEW

```text
REVIEWER = fresh-context independent subagent（非本 Goal 执行者，零共享上下文）
TARGET   = exact head d8ddf54605da7b1b9a1f951949e3f6062a6a2004（+ 两枚未跟踪 release-tool
           就地修复）
VERDICT  = PASS / SHIP_BLOCKERS = NONE（C1-C9 全 PASS；评审人独立复算 staged 打包集 grep
           零命中、dirname³ 八组对抗边例全拒、§0b/§3 选择规则同一性逐条核验、全测试矩阵
           独立复跑全绿；3 条 NON_BLOCKING gaps 已吸收于 §2.1/§7）
全文     = 本目录 INDEPENDENT_REVIEW.md
```

## 9. HANDOFF

```text
HANDOFF_PATH = docs/evidence/shared-codex-auth-deployment-root-refreeze-v1-20261001/
               OPERATION_PACKAGE.md + INDEPENDENT_REVIEW.md + owner-router-closure-g2-g7.sh
               + MANIFEST.sha256（本目录为 git 未跟踪新 evidence；commit/push/PR 归属
               Owner 决定的 dedicated evidence commit，不混入其他 lane）
NEXT ACTION（全部 Owner）= §4.1 STAGE 0 → 1 → 2 → 3；PROD_AUTH=PREPARED /
               WAITING_PROD_AUTH —— 本 Goal 无剩余 Agent 侧 gate
PRODUCTION_MUTATION = NO（本 Goal 全程）
```
