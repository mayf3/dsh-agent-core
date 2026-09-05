# SHARED_SKILL_ROOT_PRODUCTION_ACTIVATION_V1 — Production Activation Packet

- DATE: 2026-09-05
- GOAL_MODE: RESUME_GOAL / CURRENT_PHASE = FRESH_MAIN_INTEGRATION_CENSUS（已完成）
- GOAL_TERMINAL_BOUNDARY = PRODUCTION_READY
- STATUS: census COMPLETE，activation artifact 就绪；**apply 被两道门阻塞**（见 BLOCKERS）

## 1. Census 结果（2026-09-05 fresh）

| 项 | 结果 | 证据 |
|---|---|---|
| SOURCE_IN_MAIN | **YES** | exact head `114956bc` 是 origin/main `4bb01e00` 的祖先；`scripts/production-runtime-launchd.mjs` 在 main 上含 `PASS_THROUGH_ENV += 'DSH_AGENTS_HOME'`（line 109）；回归测试 `packages/production-runtime/test/agents-home-skill-root-passthrough.test.js` 在 main 上 |
| 生产 plist | **仍缺 DSH_AGENTS_HOME** | `/Library/LaunchDaemons/ai.agent-core.runtime.plist`（root:wheel 644，mtime Sep 1 06:13）EnvironmentVariables 无该键；`HOME=/Users/authsvc` |
| 生产 fallback root | **不存在** | `/Users/authsvc/.agents/` 无此目录 → 生产 child 当前 shared skills 全空，非"错误技能"而是"零技能" |
| canonical root | 17 项 | `/Users/yanfenma/.agents/skills/`（brave-browser-agent、smart-search、hr-submit 等） |
| 生产 runtime | pid 72082（authsvc，system domain，10:56 启动） | ps + `/health` on 8790 = `{"ok":true,"service":"agent-core-notification-ingress",...}` |
| parent→child env 链 | 透传成立 | 部署树 `packages/production-runtime/src/compose.js:148` "agentEnv spreads process.env" → plist 单键插入即达 child Harness（contract `config.agentsHome ?? $DSH_AGENTS_HOME ?? ~/.agents`） |
| 生产 mutation slot | **被 WDA 持有** | `docs/evidence/visit-activation-dispatch-ready-v1-20260905/REPORT.md:78`：CANARY_RESULT.json 仍 absent（fresh find 0 hits）；近 4h 仓库无新文件活动 |

结论：**不 cherry-pick、不重复实现**（source 已在 main）；激活 = 生产 plist 单键插入 + shared runtime 重启。

## 2. Exact Change（最小 lossless）

对 `/Library/LaunchDaemons/ai.agent-core.runtime.plist` 的 EnvironmentVariables **只插入一个键**：

```xml
<key>DSH_AGENTS_HOME</key>
<string>/Users/yanfenma/.agents</string>
```

干跑已验证（见 `ai.agent-core.runtime.plist.staged-new` + `staged-plist.diff`）：`plutil -lint OK`，diff 恰 2 行新增、0 删改。

选 surgical insert 而非 script 重渲染的原因：重渲染会引入其他键的 re-render drift；surgical = key-only，与 feishu-recovery v1（plutil + preimage + diff gate）先例一致。repo 侧 `PASS_THROUGH_ENV` 修复保证未来任何经 `scripts/production-runtime-launchd.mjs` 的重渲染（installer env 设有该键时）会携带此键——两条路径收敛于同一终态。

## 3. Apply（Owner，需 sudo）

```bash
sudo bash docs/evidence/shared-skill-root-activation-v1-20260905/owner-apply-shared-skill-root-v1.sh
```

脚本内置：root 检查 → 幂等前置（键已存在则 ABORT）→ preimage `.bak-shared-skill-root-v1-<ts>` → plutil insert → lint → **key-only diff gate**（失败自动还原）→ `bootout + bootstrap system/ai.agent-core.runtime`（不用 kickstart -k：它不重读 plist env）→ 新 pid + env + health 自动回读。

**执行时机**：仅当生产 mutation slot 空闲（WDA canary 调试进行中勿跑；本脚本自身即 slot 消费者，由 Owner 手上自然串行化）。重启会打断 in-flight turns（与今日 10:56 重启同级别，KeepAlive 会自动拉起）。

## 4. Post-Activation Verification（apply 后，对应 COMPLETION_CONDITIONS）

| 条件 | 验证 |
|---|---|
| PRODUCTION_PARENT_ENV_DSH_AGENTS_HOME | `sudo launchctl print system/ai.agent-core.runtime` 含 `DSH_AGENTS_HOME = /Users/yanfenma/.agents`（apply 脚本已自动回读） |
| PRODUCTION_CHILD_ENV_DSH_AGENTS_HOME | 生产 child canary：向生产 feishu agent 发消息令其回显 `$DSH_AGENTS_HOME`（agentEnv spread 透传） |
| CANONICAL_SHARED_SKILL_ROOT | plist 值 == `/Users/yanfenma/.agents`；skills 目录 17 项在位 |
| SHARED_SKILL_DISCOVERY / LOAD = PASS | 生产 child canary：发现并加载一个 canonical-only skill（生产旧 fallback root 不存在，**任何** canonical skill 命中即判别性证明；建议 `hr-submit` 或 `smart-search`） |
| PER_AGENT_DSH_HOME = UNCHANGED | 结构性保证：`resolveDshHome` precedence = configured ?? env，生产 compose 以 `applyBootstrap({agentsHome: layout.homesRoot})` 绑定 configured root 压过 env（历史审计结论，双语义陷阱记录于 memory，不重查） |
| WORKSPACE_RESOLUTION = UNCHANGED | 该路径不消费 DSH_AGENTS_HOME；plist 单键不触及 workspace 语义（同上，历史审计） |
| RUNTIME_HEALTH = PASS | 新 pid 稳定 + `curl http://127.0.0.1:8790/health` ok:true + 生产 feishu canary 正常回复 |
| UNRELATED_RUNTIME_REGRESSION = NONE | 对照面：mobile 8787 正常、scheduler runtime（pid 1696，独立 root）不受影响、legacy runtime（pid 18234，feishu channel OFF）不动 |

## 5. Rollback

```bash
sudo bash docs/evidence/shared-skill-root-activation-v1-20260905/rollback-shared-skill-root-v1.sh
```

默认取最新 preimage，恢复 plist + bootout/bootstrap。

## 6. BLOCKERS（apply 前必须清空）

1. **NATIVE_PRIVILEGED_AUTH**：plist 写入与 system-domain bootout/bootstrap 需 root；本会话 `sudo -n` 不可用 → Owner 执行 §3。
2. **PRODUCTION_MUTATION_SLOT**：WDA canary lane 仍持有并发槽（CANARY_RESULT.json absent）。Owner 在 slot 空闲时运行 §3 即同时解决两道门。

## 7. DO_NOT_BUILD → FOLLOW_UP_DEBT（未做，维持 dispatch 裁定）

skill watcher / hot reload / skill registry redesign / digest-fingerprint / generic policy framework / new primitive / publishing platform — 全部不建。另有历史债：skill root 归属/immutable、`scripts/trusted-cp-*-verify.mjs` 的 `DSH_AGENTS_HOME=HOMES_DIR` 双语义残留。

## 8. 冻结边界确认

不触碰：per-Agent DSH_HOME、workspace root、agent profile、Harness Skill API、agent identity、scheduler（pid 1696）、workflow、session messaging、legacy runtime（pid 18234）、user-domain plist（feishu-recovery 已定态）。
