# INDEPENDENT_REVIEW — SHARED_CODEX_AUTH_DEPLOYMENT_ROOT_REFREEZE_V1（2026-10-01）

```text
REVIEWER   = fresh-context independent subagent（非本 Goal 执行者；与作者零共享上下文）
TARGET     = exact head d8ddf54605da7b1b9a1f951949e3f6062a6a2004
             （base origin/main 360756e3；9 changed files）
             + 两枚未跟踪 release-tool 就地修复（census verdicts import / wrapper deploy 文案）
CONSTRAINT = 只读评审；评审人独立复跑测试矩阵（node v25.6.1 + DSH_HARNESS_ROOT）、
             独立复算打包集 scan、dirname³ 对抗边例、§0b/§3 选择规则同一性比对
VERDICT    = PASS
SHIP_BLOCKERS = NONE
```

## 判定原文（评审人输出冻结）

```text
INDEPENDENT_CHANGED_SURFACE_REVIEW
TARGET = d8ddf54605da7b1b9a1f951949e3f6062a6a2004 (+ 2 untracked evidence-tool fixes)
VERDICT = PASS
SHIP_BLOCKERS = 0
GAPS = 3 (all NON_BLOCKING)
```

## Checkpoints（评审人独立结论，C1–C9 全 PASS）

```text
C1 SEMANTIC PRESERVATION（user domain）= PASS
  seam A 常量 = canonicalOpenAICodexCredentialFileFor(join(homedir(),'.agent-core'))
  （shared-codex.js:65），本机取值 = 旧字面量 byte-identical；seam B re-export
  （model-overrides.js:38,44）；loader 比较与错误信息换用 ownCanonicalCredentialFile
  （:466,468）；既有 rig 契约未变（realignment 9/9、model-overrides 25/25）；fence 数学
  等价经求值证明（rooted('/', fencePathFor(dirname³(canonical))) = 旧字面量路径；sandbox
  rig 落点 byte-identical；refreeze 套件 11/11 双域覆盖）。
C2 CROSS-SURFACE FAIL-CLOSED = PASS
  deploymentRootOfCanonicalPath（migration-executable.js:33-42）：非绝对拒；dirname³ +
  精确重推导相等；8 组对抗边例（//、尾/、x/../、短路径、相对、非 store 名）全拒；
  混面 config 双向 SHARED_CODEX_PATH_INVALID；loader 恰接受 pin 根一个 canonical
  （model-overrides.js:389-392），deploymentRoot 非法 credential_path_invalid
  （shared-codex.js:41-43）；switchFleetConfig 只 stamp 形状校验过的 config canonical。
C3 GATE INVARIANT = PASS
  评审人用真 helper + 共享白名单在 /tmp 独立重打 §0b staging 并跑 §8 同款 scan：
  仓库打包集零命中（两枚 pre-existing 排除工具除外）；gate-mirror 测试机械锁定三 seam。
C4 INSTALLER 0b GATE = PASS
  §0b 于 installer:403-451，先于 §1 backup mv（:452-455）＝pre-mutation；选择规则同一
  （共享 APP_SCRIPTS_WHITELIST 11 项内容/顺序与改前 §3 列表一致、同 helper、同
  bundle/profile 集；0b 跳过的字节（.sh stamp / 空 node_modules）对 §8 scan 亦不可见 ⇒
  scan 字节集同一）；grep 模式与排除 byte-identical（:848-851）；staging 用后即删；
  set -euo pipefail 下打包失败先于 mutation 中止；失败 exit 2 零 mutation，§8 失败路径
  现输出 MUTATION TRUTH + BAK 精确 restore（:852-864）；--validate-source(:217)/
  --selftest-provenance(:331) 先于 0b 退出不受影响；bash -n OK；
  --selftest-provenance 实跑 PASS。
C5 CENSUS FIX = PASS
  verdicts() 补 import（census.sh:103）+ 注释（:100-102），聚合逻辑 inspection 零改动；
  --selftest PASS。wrapper（g2-g7:111-127）死亡信息为 mutation truth + 精确 restore，
  无 "NOTHING was deployed" 断言。
C6 SCOPE = PASS
  git diff --stat 恰 9 文件；无 secret（仅路径与既有 artifact pin）；EXPECTED_FLEET=92
  未动（migration-executable.js:100）；CANARIES 不变（:28）；carrier/tgz/marker/
  package.json 零触碰；两枚未跟踪工具 delta 限于两缺陷本身。
C7 TEST MATRIX = PASS（评审人独立复跑）
  provisioning 29/29、model-overrides 25/25、model-overrides-runtime 5/5、
  default-model-route 5/5、shared-codex-migration 11/11、yanfenma-realignment 9/9、
  bootstrap 8/8、compose 12/12、subscription-refreeze 11/11、compose-deployment-root 2/2、
  provisioning-refreeze 4/4、router trio 37/37；luna-credential-chain 3 败 = pristine
  main 同款 documented pre-existing（agent-router 本 commit 未触碰）。
C8 COMPOSE WIRING = PASS
  两处调用点均 pin { deploymentRoot: layout.root }（compose.js:263,264）；compose diff
  仅此 8 行（注释 + 两调用）。
C9 HOMEDIR DERIVATION = PASS
  常量与 defaultProductionRoot() 同源（paths.js:61-62 同式）⇒ 默认根与默认 canonical
  永不分歧；生产消费点全显式 pin（compose layout.root / process-registry resolveProduction
  Root:329 PR#312 血统 / persist deploymentRoot+agentHome 守卫 index.js:483-489）；
  subscriptionProcessConfigBlock 携带 ROUTE 自身已验证 credentialFile；不存在「异 uid 运行
  且依赖模块默认值」的消费者。
```

## GAPS（3，全部 NON_BLOCKING，已吸收进 OPERATION_PACKAGE §2.1/§7）

```text
GAP-1 canonicalDefaultGlobalRoute 内建默认 subscription block 仍携带执行面（homedir 派生）
  canonical 而非 layout.root 派生——pre-existing 分歧类（改前对任意 --root 恒指 yanfenma），
  生产拓扑不可达；未来加固项，不入本包。
GAP-2 打包闭包仍物理含 /Users/yanfenma 字面量于两枚 scan-excluded 工具自身
  （trusted-cp-deploy-install.sh gate 文案 / trusted-cp-hardening-v1-verify.mjs）——
  pre-existing 排除（非 control-plane 执行码），本 commit 未改；re-freeze manifest 如实登记。
GAP-3 os.homedir() 尊重 $HOME：伪造 HOME 的带外未 pin 调用方会解析不同默认常量；全部生产
  路径显式 pin，不受影响。
```

## NOTES（评审人移交 re-freeze 包的执行条件，已入 OPERATION_PACKAGE）

```text
- R4 合规：本变更 = 新源冻结（新 HEAD/tree ⇒ 包冻结时取新 EXPECTED_SOURCE_SHA/TREE），
  非 in-place patch；artifact pin 有意不动，SHA re-binding 在包冻结完成（本包 §1/§4.0）。
- 安装器新前置：首次 mutation 前 PATH 内须有 node（§0b 缺失即 exit 2）。
- 两枚未跟踪工具修复位于主 checkout 的 WGR 证据目录（release tooling，不进打包闭包）。
- 测试环境条件：node v25.6.1 + DSH_HARNESS_ROOT；新套件 yanfenma byte-freeze 断言带
  homedir 守卫，其余 homedir 无关 ⇒ 套件可在 authsvc 验收机移植。
- 残余部署风险与改前同位：§8 保留为 post-pack 复验；0b↔§3 间源漂移由 P5 TOCTOU stamp
  捕获（documented abort shape + BAK restore）。
```

## 判定

```text
INDEPENDENT_REVIEW = PASS / SHIP_BLOCKERS = NONE
无 r2 必要：无 REVISE 级 gap；3 条 NON_BLOCKING 全部为登记类，已由作者吸收进包文档。
```
