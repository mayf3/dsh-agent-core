# AGENT_CORE_DEPLOY_9BB5B97_LIVE_DRIFT_V3 — 接入 调查（LIVE_MANIFEST_DRIFT_AND_DEPLOY_V3_PREP）

Round: 2026-08-31 · Author: investigation agent · Docs-only（本报告 + evidence）。
Evidence: `docs/evidence/deploy-9bb5b97-live-drift-v3-20260831/`（本文所有机械断言的可复现转录）。

```text
TASK_NAME         = 接入 调查
TARGET_COMMIT     = 9bb5b97442c7155da36f06e867d1a655410544ac (PR #114 merge, 仍是 github/main 祖先)
LIVE (recomputed) = 132 files / 9ac84954fefc3d5893b7e5ca7045b2bb7cf0ad7492d121607d2b0659a230f4b1
                    （与生产执行时报告的 count/digest 逐字一致 —— 当前无进一步漂移）

LIVE_SOURCE_CLASSIFICATION =
  125 files = 审计 BASE（15793b0e…/131）原件，自 v1 审计以来零变化（重构证明 B）
  + 6 files = 9bb5b97 目标内容（5 个 PR #111 文件 + PR #114 workflow.js + 新增 canary），
    由已审计的 deploy v2 于 2026-08-30T16:06:18Z 应用（ledger + backup README 佐证）
  + 1 file  = packages/production-runtime/src/model-overrides.js
    live blob ea44819a… = 9bb5b97 blob f1e09d47… 删除 3 行 V2-activation scope guard
    （00:23 breakglass luna fleet 手工编辑；blob 不存在于 git 对象库任何 commit/ref/对象）

MANIFEST_DRIFT_FILES =
  vs BASE(131/15793b0e…):  6 文件（deploy v2 全量 delta，全部有 authority）
  vs TARGET(132/6ea0b614…): 恰 1 文件 —— model-overrides.js（重构证明 A：live 仅回换该行
                            即逐位复现 6ea0b614…；diff 恰为 guard 块，别无其他差异）
  其余 125 文件：零漂移（重构证明 B：live 回退 6 处 + 删 canary 行即逐位复现 15793b0e…/131）

AUTHORITY_FOR_EACH_DRIFT =
  1. index.js b37f9dac / ingress-delivery.js c8cdc089 / route-chain.js 010df799 /
     compose.js f5c7a8d3 / route-chain-canary.js 97b678b2 —— PR #111 (merge b53ebd6, MERGED)
  2. workflow.js 04ca8550 —— PR #114 (merge == 9bb5b97, MERGED)
     （1+2 经由：已审计 runner v2 sha256 c64b452e…、deploy ledger 2026-08-30T16:06:18Z
      state=TARGET、backup README + 6 份 BASE 副本 —— 全链 authority 合法）
  3. model-overrides.js ea44819a —— /tmp/agent-core-breakglass-luna-fleet-v1.sh
     (sha256 65aee43a…, root + 短语确认, 有备份/回滚/健康门) 的紧急破窗写入；
     不绑定任何 merged PR/commit（全对象搜索 0 命中）；repo 内无任何 spec/decision/report
     记录该操作 —— AUTHORITY = EMERGENCY_BREAKGLASS_PENDING_OWNER_RATIFICATION
     （不满足任务第 4 条「必须绑定已 merge PR/commit」，如实上报，不追认）

DEPLOYMENT_DELTA =
  9bb5b97 仍缺失面 = NONE（任务前提「PR #114 workflow.js 仍缺失」不成立：v2 已于 00:06
  全量应用，workflow.js live OID == 04ca8550 == 9bb5b97）。当前 live 与 9bb5b97 的唯一
  差异是「多出」的 breakglass guard 删除 —— 方向相反，且为生产承重内容（91/91 agent
  luna-primary overrides 下，guard 若复原会使启动即 invalid；服务现健康运行），任何
  单文件回退都会造成生产事故，必须与 overrides JSON 协同、走独立授权轮。
  审计后进入生产的其它动作（app manifest 之外）：00:15 glm53 fleet cutover v1（仅
  settings/plist；v2 从未到写入阶段）、00:23 breakglass（harness 重装 514ab7b x64 +
  91 homes + overrides）、00:30 restore-home-modes。

V3_RUNNER  = /tmp/run-agent-core-deploy-9bb5b97-v3.sh（sealed 副本在 evidence，逐字节同）
V3_SHA256  = a4b74918c3c97cc8c9b6f54a55a15099d3976afd0e25788865ce3b8cf385ced8
READY_FOR_INDEPENDENT_REVIEW = YES（--apply 本轮未执行；PRODUCTION_CHANGE = NONE）
```

## 1. 任务前提修正（最重要发现）

任务假设 live 132 文件 = BASE + 热备 5 文件 closure（缺 workflow.js）。机械取证证明实际是：

- **deploy v2 已经成功执行完毕**（2026-08-30T16:06:18Z，ledger `state=TARGET`，backup
  README 记录 runner=/tmp/run-agent-core-deploy-9bb5b97-v2.sh、base_manifest=15793b0e/131）。
  9bb5b97 的 6 文件面**一个都不缺**。
- 132/9ac84954 的成因是**之后 17 分钟**的 breakglass luna fleet（16:23:58Z 备份目录时间戳）
  对 model-overrides.js 的唯一 app 写入。live 与任务报告 digest 逐字一致（本轮重算）。

## 2. 三方逐文件比较（数学证明，可复现）

- **A（live→TARGET）**：live manifest 仅将 model-overrides.js 行 `ea44819a→f1e09d47` 后
  = `6ea0b614…`（== 审计 TARGET pin）。⇒ live 与 9bb5b97 的差异**恰为 1 文件**。
- **B（live→BASE）**：live 回退 5 个部署 OID + model-overrides.js + 删 canary 行后 =
  131 文件 / `15793b0e…`（== 审计 BASE pin）。⇒ **其余 125 文件自审计起零漂移**。
- 7 个关键路径 OID 表（live/9bb5b97/e2e1e22 三列）+ model-overrides.js 全 ref blob 史
  （7 个 blob，最新 merged=f1e09d47@main，PR #115 draft=07805faf，**无 ea44819a**）见
  evidence `three-way-comparison.txt`。
- 字节级 diff（`model-overrides-diff-9bb5b97-vs-live.txt`）：恰为 breakglass 脚本内嵌
  `old` 串的 3 行 guard 删除，无其他差异；breakglass 备份副本哈希 = f1e09d47（== 9bb5b97）
  ⇒ 00:23 前 live 与 TARGET 完全一致。

## 3. v3 设计（为何不是「把新 digest 填进旧 runner」）

- **双合法态状态机**（均 132 文件）：FROZEN = `9ac84954…`（现状，零缺失）；PRE_V3 =
  `926c6b9d…`（同树但 workflow.js@289a76cf 的假想态，机械导出）。其余任何 manifest =
  exit 2 零写拒止。
- **增量 = 0 或恰 1 文件**：FROZEN → `--apply` 零写 NOOP；PRE_V3 → 仅部署 workflow.js
  289a76cf→04ca8550（任务第 7 条两个分支都成立：无缺失 ⇒ 冻结；若缺失 ⇒ 只补它）。
- **model-overrides.js 永不写入**：显式 pin `ea44819a` 仅作漂移检测（任一方向变化即
  fail-closed，报错文案指向 ratification/协同回退），header 记录全部 provenance 与
  「单文件回退=生产事故」的机械理由。v3 不追认也不回退该内容 —— 属 Owner 决策。
- **fsync 契约全保留**（v2 同款 python3 helper）：每次写入 install→fsync(file)→rename→
  fsync(parent)；rollback 写入同契约。
- **O-3 修复**：新增非退出型 `verify_tree_status` 供 cleanup 使用 —— 回滚内验证失败不再
  以 exit 2 逃逸，必然走 ROLLBACK_INCOMPLETE exit 3（lock+backup 保留）。
- **authority gate 调整（有意为之，非弱化）**：github/main == pin 改为
  `merge-base --is-ancestor pin github/main` + 全 blob OID pin 不变 + main 前移时输出
  NOTICE。理由：main 已前移至 9386ac4（见 §4），严格相等会使 v3 的冻结/验证使命永久
  拒止；逐字节权威由 OID pin 承担，单调头追踪交由下一轮。git-as-root 于 00:06 已被
  v2 实跑验证可行。
- 验证：`bash -n` OK；静态扫描（无 sudo/eval/base64/ssh/scp；curl 仅 127.0.0.1:8790/health；
  rm 全部有界于 mktemp/tmp-stage/自有 lock）；`--check` 实跑 **rc=0 PASS**
  （LIVE_STATE=FROZEN；FROZEN case 分支与 breakglass pin 均被实跑覆盖；NOTICE 正确输出）。
  本轮**未执行** `--apply`（任务第 9 条）。

## 4. github/main 已前移（下一轮输入）

`9bb5b97..9386ac4` = 「feat: enable scheduler success Feishu cards」：动 2 个 app-surface
src 文件（feishu-connector/index.js、scheduler-router/index.js）+ 3 测试文件，**未部署**。
9bb5b97 仍是 merged 祖先。下一个 monotonic deploy 轮必须以 9386ac4 为目标重新审计
（evidence `main-advanced-9386ac4.txt`）。

## 5. Owner 决策清单（本调查不代决）

1. **breakglass model-overrides.js 的去向**：(a) 经 Spec/PR 追认 fleet luna（将 guard 删除
   合法化为 merged commit）；或 (b) 协同回退（loader guard + 91-agent overrides JSON +
   fleet settings 一起），需独立授权轮。在此之前 v3 把它钉死为禁改。
2. 9386ac4（scheduler 卡片）是否开下一轮 monotonic deploy。
3. 热备 activation runner（工作区未提交修订版）已被 breakglass 事实取代，去向待定。

## 6. Boundaries

DOCS ONLY（1 报告 + 1 evidence 目录 8 文件含 MANIFEST sha256 与 sealed runner）；
生产访问全部只读（manifest 重算、ledger/backup/overrides 读取、/health、launchctl print）；
ZERO sudo；ZERO 生产写入；v3 未以 --apply 运行；未触碰 breakglass/overrides/harness/homes；
既有 WIP（含未提交的 hot-standby evidence 修订、broker 修改、untracked docs）原样保留；
新文件按显式路径 staging；git diff --cached --check = PASS。

## 7. FINAL

接入 调查 = COMPLETE · LIVE = 132/9ac84954（与报告全等）· DRIFT = 恰 1 文件
（model-overrides.js，breakglass，pending ratification）· 9bb5b97 缺失面 = NONE ·
v3 = a4b74918… · --check = PASS · PRODUCTION_CHANGE = NONE ·
NEXT = 独立审计 v3 → Owner 决策 §5 → （另行）9386ac4 轮。
