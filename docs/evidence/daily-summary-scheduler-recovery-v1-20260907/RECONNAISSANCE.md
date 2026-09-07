# DAILY_RAW_DISTILLED_SUMMARY_SCHEDULER_RECOVERY_V1 — RECONNAISSANCE (2026-09-07)

> READ-ONLY reconnaissance + bounded-mutation preparation. Production mutation count this round = 0.
> All findings below are mechanical (process/launchd/file/source-of-live-app evidence), no credential bytes touched.

## 1. 拓扑现态（机械实证）

| 实例 | 进程 | root / store | 角色 |
|---|---|---|---|
| system 域 `ai.agent-core.runtime` | pid 51361 (`launchctl print system/…` state=running) | `/Users/authsvc/.agent-core`；store=`…/scheduler/jobs.json` | **CANONICAL 生产**（feishu 活跃面；09-05 ASM canary f1dda993 实证经此执行） |
| gui 域 `ai.agent-core.runtime` | pid 35940（runtime-evidence.jsonl: 20:47 SIGTERM 18404 → composed/ready 35940） | `/Users/yanfenma/.agent-core`；store=33B 空 V1（mtime Aug 17 未变） | 用户域 runtime（glm53 wrapper；feishu:false） |
| gui 域 `ai.agent-core.scheduler-v2` | pid 60339 | `/Users/yanfenma/.agent-core-scheduler-v2`；store=version2、恰 1 job=`stock-daily-market-brief-001`(disabled) | NON-CANONICAL 历史证据（08-30 stock canary），DO_NOT_WRITE |

## 2. 三个 store 的 read-back 结果（本轮实测）

1. `~/.agent-core-scheduler-v2/scheduler/jobs.json`（可直读）：仅 stock job（disabled）。**无「每日摘要检查」任务**。
2. `~/.agent-core/scheduler/jobs.json`（可直读）：33B 空 V1，mtime Aug 17。**无任务、也无第一次 mutation 落盘痕迹**。
3. `/Users/authsvc/.agent-core/scheduler/jobs.json`（canonical）：**本 shell Permission denied**（`ls`/`sudo -n` 实测；sudo 需密码，本轮未取得）。与 09-05 REQUIRED_SCHEDULER_JOBS_INVENTORY_V1 REPORT §0 记录的权限边界一致（「生产 Scheduler store 对本 shell 不可读…fresh readback 须经 Owner sudo 只读通道（先例：ASM goal scheduler.list RAW）」）。

⇒ `TARGET_TASK_FOUND = UNKNOWN`（canonical store 未读）；`PREVIOUS_MUTATION_OUTCOME = STILL_UNKNOWN`。
依据 MUTATION_RULE：state unknown ⇒ **禁止 create**；先 read-back 再分支。

## 3. credential_unavailable 调用链定位（presence/metadata only）

调用链（live app 源码在证）：
`Agent/CLI → broker gateway（production-runtime in-process, compose.js:311-314, mode:'gateway', "Trusted CP seam"）→ loadCredentialFor(AGENT_CORE_CREDENTIALS_FILE, agentId)（credential-store.js:109-113）→ 无 entry ⇒ gateway.js:158 fail-closed 'No MachineClient credential bound to agent' ⇒ transport 错误码 credential_unavailable`

| Goal 要求的字段 | 机械判定 |
|---|---|
| CURRENT_AGENT_ID | ZCode main agent（workspace dsh-agent-core，OS 用户 yanfenma）；非 broker registry 的 agt_ Agent，无（也不应有）MachineClient credential |
| CURRENT_PROFILE | agent-core-production 工作面（本 ZCode 会话不在 agent-core runtime 内） |
| SCHEDULER_READ_AVAILABLE | 本 shell 直读 store=NO（§2 权限）；经生产 CLI=需 authsvc 身份；经 broker=需 credential ⇒ 需 Owner sudo 通道 |
| SCHEDULER_MUTATION_TOOL_VISIBLE | broker scheduler capability 存在于 live app（`app/packages/broker/src/capabilities/scheduler.js`，manifest 含 credential_unavailable / mutation_outcome_unknown 错误码声明）；本 ZCode 会话无内置 scheduler 工具（cron-helper fail-loud 条款适用） |
| EXPECTED_CREDENTIAL_SOURCE | `AGENT_CORE_CREDENTIALS_FILE` = `/usr/local/libexec/agent-core/config/agent-credentials.json`（launchctl print system/ai.agent-core.runtime 实证） |
| CREDENTIAL_SOURCE_PRESENT | YES——文件存在（`ls`：0600 authsvc，Aug 28，11723B）；内容按设计不可读（未读） |
| CREDENTIAL_INJECTION_PRESENT | 生产 system 域 runtime=YES（launchctl env 在证）；**用户域 runtime=NO**（plist env + `agent-core-runtime-glm53-wrapper.zsh` 全文在证：仅注入 ZAI 模型 key 与 DSH_SETTINGS_SOURCE，无 AGENT_CORE_CREDENTIALS_FILE/BROKER_AUTH_ORIGIN） |
| CALLER_ENTITLEMENT_PRESENT | 生产面 caller（效率管家 agt_efficiency-agent，principal b21ddb23-…，active）=YES（09-05 inventory REPORT：「效率管家已实证 scheduler.create/list 可用」+ ASM 验证 A） |
| FAILURE_LAYER | **credential injection 层**：第二次 mutation 的通道所在的 runtime 未配置 credentials provider（用户域 runtime credentialsFile=undefined ⇒ 恒 credential_unavailable，与 caller 无关）。生产 canonical credential 链本身健康（有 09-05 成功先例） |

ROOT_CAUSE_CLASSIFICATION = **B/C 复合（credential 存在于生产但未注入发起调用的 runtime / provider 未在该 runtime 注册）**。
诚实边界：第二次 mutation 的确切调用命令无法从本 shell 恢复（前会话 rollout 已清理）；但两类候选根因（用户域 runtime 未注入 vs 无 entry 的 agentId）的修复路径相同——改用 canonical 通道，不改变行动。

## 4. SCHEDULER_FAILURE_DEPENDS_ON_CURRENT_P0 = NO

- 生产 canonical credential 链（authsvc runtime + agent-credentials.json + 有效 caller）**健康且已实证**，无需等待 P0 的 canonical caller/directory 重建。
- 断点修复 = 换用 canonical 执行通道（authsvc 身份运行生产 live CLI `agentcore-cron`；shell history 有同款 `sudo -u authsvc env -i …` 先例：stock job disable）。
- 不造临时 credential、不复制 credential、不给用户域 runtime 配第二套 credentials（那正是 Goal 禁止的「第二套授权路径」）。
- P0 p4-agent-caller provision（今日 20:41 有文件活动）与本 Goal 无文件级依赖冲突。

## 5. 任务规格（冻结自 Goal TARGET_BEHAVIOR，业务原型=family fixture）

- 目标 Agent = `agt_daily-thought-agent`（primary-workspaces.json + bindings.json 在证：workspace=`workspace-oc_f2a66066…`，即 daily-thoughts raw/distilled 所在群；delivery to=`chat:oc_f2a6606689691fd7f0a7c7078a0bf2e9`）
- 命名对齐 fixture 族（`daily-thoughts-summary-001` 旧 OpenClaw 原型，expr/tz 不同——新任务按 TARGET_BEHAVIOR=22:00 Asia/Shanghai，滚动 7 自然日，raw 只读，只补缺失/明显不完整，最后发预览）
- 执行载体：live app `scripts/agentcore-cron.mjs`（CONTROL-ONLY CLI：写经 cross-process lock 单一 mutation authority；identity=effective OS user，非 request input——免 credential gate 的 canonical operator 面而**非**绕过：它与 broker capability 同受 store 锁与 V2 引擎消费）

## 6. 交付物自测（Owner 纪律：先自测再交）

`RUN_RECOVERY.sh --selftest` = PASS（/tmp stub store，同一 CLI binary 同一参数面）：
list 空 store → add（生产参数面，返回 jobId + next occurrence `2026-09-07T14:00:00Z`=北京 22:00 本日 ✓）→ update 语义保留 → list --json readback 全断言（TASK_SINGLETON/ENABLED/SCHEDULE/TIMEZONE/WINDOW/CHECK_RAW/CHECK_DISTILLED/RAW_RECORD_MUTATION/FINAL_RESULT_PREVIEW/NEXT_RUN）→ 负例声明（重复 add 会产生重复 ⇒ MUTATION_RULE 禁止，生产分支内建）。
自测中发现并修复：`update` 子命令无 `--enable` flag（stub 实测报 nothing to update）→ enable 走独立 `enable <id>` 子命令。

## 7. 生产执行（等 Owner 一次 sudo 授权）

```
sudo -v && bash docs/evidence/daily-summary-scheduler-recovery-v1-20260907/RUN_RECOVERY.sh
```

单次授权内依序完成：READ-BACK（pre.json）→ MUTATION_RULE 分支（found>1 停；=1 有界 update 仅补 TARGET_BEHAVIOR 偏差；=0 恰一次 add）→ FINAL_READBACK（post.json + COMPLETION_CONDITIONS 机械断言 + NEXT_RUN 证明）。全程不触碰 credential 字节、不写用户域/scheduler-v2 store、不重启任何服务。
