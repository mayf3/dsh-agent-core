# D13 r2：HR 日志签名核对（只读）

`SIGNATURE_MATCH = UNKNOWN`；`IMPLEMENTATION = STOPPED`。

已实测存在 `trusted source turn proof missing or stale` 拒绝，但现有获准日志不能建立同一进程/代际中 `maintenance → prompt 在维护期间排队 → driver 在旧 async scope 醒来 → exact carrier 缺失` 的因果链。没有把缺少 maintenance 日志当作排除该机制的反证；也没有把短轮拒绝直接推断为另一根因。用户要求“吻合才修”的前置条件未满足，本子任务不改实现、不续期、不放宽 proof、不延长硬 deadline。

## 坐标和授权

- 观察日期：2026-11-01，源代码 worktree `/tmp/proddsh-d14-fix`，branch `ac-D14D13-spawn-proof`，HEAD `1921f8795e2212506a7a833bc79b84c17ba50ea1`。
- r1 既存调查/路线：`/tmp/proddsh-d14d13-evidence-20261101/preflight.md`；r1 isolated mechanism 记录：`STOPPED.md:23-34`。该复现是机制证据，不继承为生产因果证明。
- 用户 r2 显式授权的只读操作：`sudo -n cat/grep/tail` 读取 runtime.err.log 和 home session.jsonl；未写生产、未改权限、未移动、未重启/部署。共享 checkout 未写入。
- 仓库治理入口、local README、spec-governance PREFLIGHT 已读；复用 r1 既存 REUSE/BRIEF 路线。当前仅只读调查，无产品语义修改。

## 原始来源与可复核投影

HR 来源：

```text
/Users/authsvc/.agent-core/homes/agt_hr-agent/sessions/--Users-yanfenma-.openclaw-groups-workspace-oc_a5e904510bbf4b983d6cd97b9f7bbb74--/main/session.jsonl
SHA256 b551b76b8ca3edb59003c666ad9227a9ce416f3f72f217471e4e1a5e770680fe
21013 lines at readback
```

`project.py` 通过 `sudo -n cat <source> | python3 <local-projector>` 计算哈希并只保留事件类型、seq、时间、turn、step、工具名及少量状态。真实拒绝必须同时满足：前置 `tool/call.name = agent_session_send`、相同 turn、精确 source/tool-result callId 一致，以及本次工具结果文本的精确 send 前缀和错误后缀。错误字段从该工具自己的渲染文本解析，编码形式明确记录为 rendered text，未虚构原始 JSON error 字段。字符串搜索命中只作为检索索引，引用历史、grep、read、forum、scheduler 结果单列排除。`hr-main-projection.json` 不含完整用户/助手正文、工具参数或 replayState。`denial-timeline.json` 只关联真实直接拒绝及其原生 turn/start、turn/end。

runtime 来源：

```text
/Users/authsvc/.agent-core/logs/runtime.err.log
SHA256 98a3e24be4a868ab690a86377d36ee5e32fc22b47467a18c998cab405f515c14
100508 lines at readback
```

`runtime-err-projection.json` 保留匹配行号和标记，未保存完整日志。运行日志会增长，哈希只绑定本次读取字节。

## 观察

1. HR main 中只有 **2 次真实直接拒绝，均在 turn 7**：`tool/call :777 → tool/result :778` 与 `:779 → :780`，工具名均为 `agent_session_send`，各自 exact callId 一致，工具结果自身错误为 `internal_error: trusted source turn proof missing or stale`。
2. **首次拒绝**：`session.jsonl:778`，seq 4531，turn 7/step 3，`2026-10-21T14:38:15.814Z`（上海时间 22:38:15.814）。对应 turn/start：`:718`、seq 4471、`14:37:59.693Z`，因此首拒发生在轮开始后 **16.121 秒**。第二次 `:780`、seq 4533、`14:38:15.863Z`，为轮开始后 **16.170 秒**。`:799` 的 turn/end 为 `completed`，整轮 **22.034 秒**。不是长轮尾部才出现的现象。
3. 首拒前一轮：`:716`，turn 6 completed，`14:37:59.681Z`；`:717` inbox/spliced，`:718` turn 7 start，12 毫秒后开始新轮。这个顺序支持“新轮在先前 driver 活动之后继续”的描述，但**没有记录 driver async scope 或 Router execution handle，不能证明载体丢失**。
4. 此文件首次 `compaction/start` 为 `:2704`，seq 23426，turn 28，`2026-10-21T22:47:18.109Z`，晚于首次 proof 拒绝。首次拒绝前没有 compaction 事件；整个事件类型清单中没有 maintenance/spawn 类型。**compaction 不是全部 native maintenance 的同义词，不能据此宣称首拒前绝无 maintenance。**
5. 其余 **15 条文本搜索命中全部排除**，对应调用名为 `forum_search_threads`（3）、`forum_reply`（1）、`grep`（4）、`read`（6）、`scheduler`（1）。这些是对历史错误的引用或检索/读取结果，不能计作新的 session_send 拒绝。两次真实拒绝均发生于同一短轮，不能从这些记录推出 proof 按巡查时长过期；源码亦未见此 proof TTL。
6. runtime.err.log 没有精确 proof 拒绝签名。仅两条 maintenance 文本匹配（`:19889`、`:19929`）是其他 Agent 的 maintenance-canary 用户提示文本，不能用作 HR 维护事件。HR spawn/ready/generation 字样有匹配，但这些行本身无事件时间，不能绑定到上述 HR turn 或首拒时间。未借用远处时间戳归因。

## 源码语义与差异

- `packages/production-runtime/src/agent-session-messaging.js:187-190`：检查非空 `context.sourceTurnExecutionId`，缺失即拒；没有 TTL。
- `packages/agent-router/src/parent-rpc-relay.js:36-42`：要求 rpcMeta 非空、execution 存在于本进程 map、未 settled；当前拒绝文本无法区分“child carrier 缺失”与“parent execution 不存在/已 settled”。
- `packages/demo-server/src/index.js:204-207`：仅在 prompt/followup 调用外包 AsyncLocalStorage；r1 已在 isolated native harness 复现维护排队后载体丢失。该源码风险仍成立，但不是此次生产日志已证明的因果链。
- 不能用“活动续期/显式续期”解决尚未证明存在的 TTL，也不能改为取当前活动轮的 handle：这会使旧 A 借用新 B，削弱 exact-source 契约。当前 accepted `AGENT_PROCESS_LIFECYCLE_HARDENING_V4` 的 C-001/C-005 绝对执行 deadline 仍必须保留；V3 已 superseded，本记录不以其作为现行权威。

## 独立 review 纠错

初版 projector 错将 raw 子串搜索命中当作真实拒绝，曾误报“17 条/11 次/7 轮”及相应轮时长范围。独立 review 发现后已撤回这些统计，并重写 projector，以工具名、精确 callId 和本次工具结果自身错误三者关联。重新读取原始日志的 SHA-256 和行数均与初次相同，因此修正来自分类方法，不是日志漂移。真实计数为上述 2 次/turn 7，15 条引用/检索命中明确单列排除。UNKNOWN/STOPPED 结论不变。

## 进入修复前仍缺的最小证据

对某一实际拒绝，至少需要同一进程/代际的 native maintenance 排队/结束、对应真实 prompt messageId/turn 与 Router execution handle 的绑定，以及 RPC 发送时 carrier/parent map 的缺失或 settlement 状态。当前获准来源没有这些关联字段，因此结论保持 UNKNOWN，受影响修复 STOPPED。无需重新跑 r1 复现来伪装生产核对已通过。
