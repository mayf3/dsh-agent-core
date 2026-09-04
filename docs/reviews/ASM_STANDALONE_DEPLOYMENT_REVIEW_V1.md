---
review_id: ASM_STANDALONE_DEPLOYMENT_REVIEW_V1
spec_under_review: AGENT_SESSION_SEND_STANDALONE_DEPLOYMENT_AUTHORITY_V1 (proposed @ goal branch)
review_round: 1 (independent deployment-closure review) + delta re-audit
date: 2026-09-05
reviewer: independent agent session (fresh, no authorship)
result: SAFE_TO_DEPLOY_ASM_WITHOUT_MODEL_FLEET_CHANGE = YES
blocker_union: NONE (frozen)
follow_up_debt_accepted: 6 items (2 repaired pre-packet, see below)
---

# ASM_STANDALONE_DEPLOYMENT_REVIEW_V1

## 1. 裁决（reviewer 独立重算，非作者数字）

```text
SAFE_TO_DEPLOY_ASM_WITHOUT_MODEL_FLEET_CHANGE = YES
BLOCKER_UNION = NONE（一次冻结）
```

九类 SHIP_BLOCKER 逐类核销：ASM-only 安全闭包成立（字节级重算 A–D）/ 无 Fleet 隐式激活
（组合排除 + 车辆 G2 + sim fleet 家族）/ 身份与 credential 传播 = accepted main 原字节 /
canonical-main 语义 = accepted 原字节 / exactly-once 与 no-auto-retry = accepted relay.js 原字节 /
Grant 合法（唯一行 tuple 精确，psql 复查）/ rollback 可用且字节精确（六回滚家族）/ runtime
terminal truth 可建立（health + 20-manifest catalog + receipt commit point）/ 无 accepted
Authority 冲突（capability spec r3 未动；旧 DEPLOYMENT_V1 r3 记为 historical_input_only）。

## 2. 独立重算矩阵（reviewer 第一手证据）

| 项 | 结果 |
|---|---|
| A face 完整性（shasum -c MANIFEST） | PASS 17/17 |
| B preimage 真实性（live 逐行重算） | PASS 13 hash + 4 ABSENT；复跑后零漂移 |
| C WHOLESALE/NEW == main@7c7c03a blob | PASS 15/15 |
| D COMPOSED 双向 diff 性质 | PASS（index.js 恰 4 ASM hunks 零删行；compose.js 纯增量零删行；无 forum/provisioning/shared-codex/scheduler-history 字节） |
| E vehicle 静态审查（gate 顺序/原子写/单 restart/rollback） | PASS（含 debt 清单） |
| F sim 复跑（reviewer 独立整跑） | PASS 12/12（2026-09-04T22:41:46Z） |
| G Grant 面（psql 只读） | PASS（mc_cF81DF × {agent.session.send} × v2 × revoked_at NULL 唯一行） |
| H live 只读性 | PASS（root:wheel 0644；无写路径） |
| 附加：worktree b8c422d 相对 7c7c03a 仅 2 docs 文件 | PASS（docs-only 成立） |

## 3. FOLLOW_UP_DEBT 处置

| # | debt（reviewer 提出） | 处置 |
|---|---|---|
| 1 | apply 期自然 I/O 失败不 engage rollback | **已修复**：fail_stop 在 APPLIED 非空时 engage do_rollback（rc=3），空时维持零写 STOP（rc=2）；delta re-audit PASS |
| 2 | 成功路径 receipt 被 finish() 覆盖、缺 spec §8 字段 | **已修复**：成功路径写富 receipt（17 文件 before/after sha256+mode、restart_count、health、catalog、backup_dir；JSON 校验失败即回滚）后直接 exit 0；delta re-audit PASS |
| 3 | G2 protected 列表未含 shared-codex/forum-moderation 字面量 | 保留 debt（G1 存在性兜底：live 无此文件，非 ABSENT 行即 STOP） |
| 4 | 无全量 17 文件 post-install read-back hash（catalog 只读 broker index） | 保留 debt（staged hash + 同卷原子 mv；富 receipt 现含 per-file after hash——车辆已半覆盖） |
| 5 | SIGKILL 时 lock 残留 | 保留 debt（fail-closed 方向安全） |
| 6 | 小项（空行/xattr/死代码/sim 恢复源） | 保留 debt（reviewer 已独立验证 sim 恢复源 == main 字节） |

## 4. 修复后回归 + delta re-audit

vehicle 修复（#1/#2）后 FULL_PREMUTATION_SIMULATION 重跑：12/12 全 PASS；
happy_path receipt = DEPLOY_OK / 17 files / health ok:true（spec §8 schema 落地）。

Delta re-audit（同一 reviewer session）：**RE_AUDIT = PASS**。静态复核确认修复 a
（fail_stop 回滚分支，调用点安全、bash3.2 set-u 守卫齐备）与修复 b（富 receipt 成功
commit point + JSON 校验失败即回滚 + 绕过 finish() 覆盖）实现正确；sim 复跑 happy_path
（rc=0，receipt files=17/restart=1/health/catalog 逐项验签，after 哈希与 reviewer 独立
复算 17/17 相等）、receipt_failure（rc=4）、partial_install（rc=4）外加 reviewer 自加的
midapply_io 定向家族（第 11 文件注入 cp EACCES → rc=3、树字节级恢复 drift=0/17）全部符合。
已知保守语义：mid-apply 自然 I/O 失败的 ROLLBACK_INCOMPLETE 为保守误报方向（fail-loud，
树实际已恢复）——Owner packet 对 rc=3 的处置指引（不动现场、报告 agent）覆盖该情况。
原裁决维持：SAFE_TO_DEPLOY_ASM_WITHOUT_MODEL_FLEET_CHANGE = YES，BLOCKER_UNION = NONE。

制品最终 seal：SEALED_INPUT_MANIFEST.sha256 24 文件（23 部署输入 + OWNER_PACKET.md 指引件；
vehicle sha256 1ddb1498… 已验签）。

## 5. 边界

reviewer 全程只读 live/DB（SELECT）；sim 复跑仅写 /private/tmp 沙盒与本制品
SIM_RESULTS.txt（时间戳已注明）；零生产 mutation；未修改 goal worktree 与制品 face。
