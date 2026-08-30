# 飞书「播客制作人」Agent 空回复 / 截断调查 V1（TASK_NAME = 回复 调查）

> 性质：**只读调查**（TASK_TYPE = 调查）— 未修改代码 / 未部署 / 未重启 / 未重发原任务。
> 日期：2026-08-30 · 仓库：`mayf3/dsh-agent-core` · 分支：`docs/lark-ux-phase1-v2-spec`
> 证据目录：`docs/evidence/feishu-podcast-agent-reply-investigation-20260830/`（MANIFEST sha256 见该目录）
> 本轮未触碰：冷备、GLM/Luna 路由、ARM64、Scheduler、HR、Workflow 相关路径。

---

## 0. Final Output

```text
TASK_NAME                 = 回复 调查
AGENT_ID                  = agt_podcast-producer-agent（openclaw id: podcast-producer-agent，显示名「播客制作人」；
                            飞书侧 bot 显示名「李逍遥」不在任何本地配置文件，身份按 chat binding 判定，未按显示名猜测）
FEISHU_CHAT_ID            = oc_516baf0ca1dee279bd080ec1e929bac0（群聊；openclaw + agent-core 两层 binding 一致）
SESSION_ID                = main（agent-core Binding activeSessionId = "main"；session key
                            "consolidation:session:main" 出现在 workspace MEMORY.md 条目 Source 中）
DSH_HOME                  = /Users/authsvc/.agent-core（live agent-core 运行时 root，pid 53919，只读边界外；
                            同结构可读拷贝 /Users/yanfenma/.agent-core 为 stale 测试副本，用于证据）
WORKSPACE                 = /Users/yanfenma/.openclaw/groups/workspace-oc_516baf0ca1dee279bd080ec1e929bac0
                            （播客制作人主 workspace；转录输入文件位于 voice-tech workspace
                             oc_90142ae290925820dcbac9717011d4af/output/ 下）

INCIDENT_A:  TURN_STATE = 有 terminal 但 final text 为空（session 无任何 assistant text）
             SESSION_FINAL_TEXT_LENGTH = 0
             OUTBOUND_PAYLOAD_LENGTH   = 0（{"text":""} 空 reply 被发送，Feishu 渲染成"回复 mayf3:"+引用壳）
             FEISHU_MESSAGE_LENGTH     = 0（正文 0 字节；用户可见仅引用壳）
             TRUNCATION_LAYER = MODEL_OR_TURN
             ROOT_CAUSE = 模型回合返回空 final text；运行时对空 reply 无守卫，直接以空 text 发出引用回复
INCIDENT_B:  TURN_STATE = 首回合无 terminal final text（仅 3 条进度 assistant 消息，之后卡住）
             SESSION_FINAL_TEXT_LENGTH = 0（首回合；用户 nudge 后新回合才产出完整规划）
             OUTBOUND_PAYLOAD_LENGTH   = 0（首回合无 final 可发）
             FEISHU_MESSAGE_LENGTH     = 0
             TRUNCATION_LAYER = TOOL_WAIT_OR_LIFECYCLE
             ROOT_CAUSE = 长工具回合（读转录 + 读记忆 + 读历史稿）始终未产出 final，回合无 terminal；
                          与同一 agent 历史日志中反复出现的 LLM timeout / lane wait exceeded 同一类故障形态
INCIDENT_C:  TURN_STATE = 回合有 terminal 但 final text 中途截断（"把它立为主题" 处结束）
             SESSION_FINAL_TEXT_LENGTH = ~460 字节（截断于"把它立为主题"）
             OUTBOUND_PAYLOAD_LENGTH   = SAME（截断文本原样发出）
             FEISHU_MESSAGE_LENGTH     = SAME（用户看到的就是截断正文）
             TRUNCATION_LAYER = MODEL_OR_TURN
             ROOT_CAUSE = 模型生成在长稿开头即被截断（疑似 provider 输出上限/提前终止；finish_reason 无法从
                          只读边界外取证的 session jsonl 确认，见 §6 开放问题）

EMPTY_REPLY_ROOT_CAUSE          = 模型回合产生空/空白 final；agent-core router 的 feishu.reply 无非空守卫
                                  （packages/feishu-connector/src/api.js textContent('') → {"text":""} 照发）
MID_SENTENCE_TRUNCATION_ROOT_CAUSE = 模型生成中途停止（长稿生成场景；provider 输出上限/提前终止的疑似位）
REACTION_STUCK_ROOT_CAUSE       = 机制：turn 开始置 processing(OK) reaction、turn 结束删除；本轮可读证据无 reaction 日志，
                                  无法确认是否残留（live 运行时 reaction 日志在 /Users/authsvc/** 只读边界外）。
                                  用户感知的"processing 后无正文"与 A/B 的"无 final 可发"自洽（详见 §5）。

PRODUCT_FIX_SCOPE = （建议，供 回复 执行 轮参考）
  1. empty-reply 守卫：router onIngress 中 reply 为空/纯空白时，不发空 text，改为发可见占位
     （如"[agent-core] 本轮未生成正文，请重试"）或直接走错误分支；feishu-connector api.js 增加非空校验。
  2. 无 terminal / turn timeout 的可见化：turn 超时/无 final 时按 catch 分支发可见错误（现 catch 已有
     "[agent-core] delivery failed: ..." 文案，但空 reply 分支绕过它）。
  3. 长回合保障：turn 内 progress 已发后，若模型最终回合为空/截断，给用户可见的续写/重试提示；
     评估 DSH_AGENT_TURN_TIMEOUT（默认 300s）与 GLM-5.3 长生成的匹配度。
  4. 输出上限对齐：核对 zai/glm-5.3 的 maxTokens/输出上限配置（agent home settings.yaml 仅声明模型 id，
     未配 maxTokens），与长稿生成的截断疑似相关。
TESTS_REQUIRED = （建议，供 回复 执行 轮参考）
  - 单测：feishu-connector textContent/reply 对空串、空白串、超长串的行为；router onIngress 空 reply 分支。
  - 集成（离线 sandbox，不发真实群消息）：空 final → 发出可见占位；turn timeout → 保留可见错误文案；
    C 类截断 → payload 与 session final 逐字节一致（证明截断发生在模型层而非聚合/发送层）。

PRODUCT_CODE_CHANGE = NONE
PRODUCTION_CHANGE    = NONE
READY_FOR_IMPLEMENTATION = YES（待 回复 执行 轮按上面 PRODUCT_FIX_SCOPE / TESTS_REQUIRED 立项；本轮只读，未实施）
NEXT_TASK = 回复 执行
```

---

## 1. 对象确认（未按显示名猜 agentId）

1. **飞书通道**：服务生产群聊的是 DSH agent-core 运行时（本仓库实现的 `production-runtime.mjs`），
   不是 openclaw gateway。证据：
   - openclaw gateway（pid 832，authsvc，`openclaw-gateway`）的 `gateway.log` 在 **2026-08-19 ~ 08-29 连续 11 天空档**，
     且对群 `oc_516baf` 的最后一条 `[feishu]` 事件停在 2026-08-15（`openclaw-gateway-gap-evidence.txt`）。
   - 播客 workspace 记忆条目的 `Source: consolidation:session:main`（agent-core 的 Binding
     `activeSessionId = "main"` 命名），与 openclaw 的 session key（`agent:...:feishu:group:...`）不同。
2. **Binding 双层一致**（未依赖显示名）：
   - openclaw：`bindings[] {agentId: podcast-producer-agent, match: {channel: feishu, peer: {kind: group, id: oc_516baf0ca1dee279bd080ec1e929bac0}}}`
   - agent-core：`bindings.json → feishu:oc_516baf0ca1dee279bd080ec1e929bac0 → activeAgentId: agt_podcast-producer-agent, activeSessionId: main`
   - agent-core `primary-workspaces.json → agt_podcast-producer-agent → workspace-oc_516baf0ca1dee279bd080ec1e929bac0`
3. **「李逍遥」**：在 openclaw.json、agentClients、employees.json、各配置文件均无此字符串；
   它是飞书侧 bot 显示名（飞书开发者后台层面），本地不可见。本调查以 chat id 为准。
4. **模型路由**（agent-core home settings.yaml，Aug 20 烘焙副本）：`agent-default-model: {provider: zai, model: glm-5.3}`；
   另配置 oc-go/deepseek-v4-flash、opencode-go、ollama 作为 fallback 池。
5. **输入文件**：转录位于 voice-tech workspace
   `/Users/yanfenma/.openclaw/groups/workspace-oc_90142ae290925820dcbac9717011d4af/output/逸林港式茶餐厅 5-转录.md`
   （mtime 2026-08-29 16:33 +08，由语音技术专家群 oc_90142ae 的转录回合产出，该群记忆完整、无本次事故）。

---

## 2. 事故源会话（证据 = agent-core workspace 记忆，即 session 层镜像）

会话发生在播客群 oc_516baf，agent-core 写入 `workspace-oc_516baf/memory/2026-08-29.md`（mtime 08-29 17:46）
与 `2026-08-30.md`（mtime 08-30 15:06:37）。会话时间线（依据记忆文件与文件 mtime）：

1. **08-29 ~16:33–17:16**：用户给出转录路径 → 要求基于转录规划播客稿。
   assistant 依次产出 3 条进度消息：
   - "我先看一下这个转录文稿的内容。"
   - "我先看一下这个目录里的其他材料（比如之前的几期稿子和成品）…"
   - "看到了，这个 workspace 里之前还有几期转录。我快速看下记忆文件和过往稿件风格，好对齐你们的常规范式。"
   **此处回合无 final text**（存储中随后直接是 user 消息"看完了吗"）→ **INCIDENT B 首回合**。
2. **08-29 ~17:16**：用户 nudge "看完了吗" → assistant 产出完整规划（约 4.6KB）并保存
   `oc_90142ae/output/逸林港式茶餐厅 5-播客稿规划.md`（mtime 08-29 17:16）。该回合 terminal 完整。
3. **08-29 ~17:44–17:46**：用户 A："就是理科生和社科生两个身份就行了 / 然后你出个稿子吧，就是推荐怎么样一个聚焦的专业主题"。
   **记忆/会话中无任何 assistant 消息**（2026-08-29.md 止于该 user 消息，mtime 17:46）→ **INCIDENT A**：空回复。
4. **08-30 ~15:06 前**：用户 nudge "hi" → assistant 产出：
   "收到！两位身份定了：… ## 🎯 聚焦主题推荐 ### 《贵的模型卖不动了：AI 进入性价比时代》 … 把它立为主题"
       **正文在此截断**（memory/2026-08-30.md 文件本身止于"把它立为主题"，mtime 08-30 15:06:37；
   MEMORY.md 同分钟 consolidation 到"推荐聚焦主题为《贵的模型卖不动了：AI 进入性价比时代》"）
   → **INCIDENT C**：中途截断。

> 说明：本次事故对象运行时（agent-core @ /Users/authsvc/.agent-core）的 session jsonl、turn 元数据
> （turnExecutionId / generation / childPid / finish_reason）位于 `/Users/authsvc/**` 只读边界外（
> 与本仓库历史轮次的既有边界一致）。以上会话层证据来自 agent-core 记忆插件（packages/agent-memory，
> `<workspace>/memory/YYYY-MM-DD.md` + `MEMORY.md`，`Source: consolidation:session:main`）在 turn 终点写入的
> 原始会话镜像——可证明"session 中最终文本为空 / 无 terminal / 截断"这一裁决所需的全部事实。

---

## 3. 四层对账（逐起事故）

### 3.1 A：空回复（用户："理科生和社科生…出个稿子吧"）

| 层 | 证据 | 结论 |
|---|---|---|
| A. 模型/Session | 记忆无任何 assistant text；`SESSION_FINAL_TEXT_LENGTH = 0` | final text 为空；回合有 terminal（后续用户无需再次 nudge 也能发"hi"），但产出为空 |
| B. Runtime | router `feishu.reply(replyTo, reply)` 对空串无守卫；`api.js textContent('') → {"text":""}` 照发 | 空 final 被直接发送，无 fallback 文案 |
| C. Delivery | `OUTBOUND_PAYLOAD_LENGTH = 0`；Feishu 渲染空正文引用回复 = "回复 mayf3:"+引用壳 | 与用户所见一致；payload 与 session final 逐字节一致（都是 0） |
| D. Reaction | 无 live 日志可读；机制上 turn 结束会删 processing reaction | 无法确证残留；用户感知"processing 后无正文"与空 final 自洽 |

**TRUNCATION_LAYER = MODEL_OR_TURN**（session final 本身为空；任务裁决规则第 1 条）。

### 3.2 B：转录读取回合无 final（用户：给转录路径要求规划）

| 层 | 证据 | 结论 |
|---|---|---|
| A. 模型/Session | 首回合仅 3 条进度 assistant 消息，无 final text（随后是 user"看完了吗"） | 首回合无 terminal；`SESSION_FINAL_TEXT_LENGTH(首回合) = 0` |
| B. Runtime | 无 final 可聚合；`DSH_AGENT_TURN_TIMEOUT` 默认 300s（process.js:386）；同 agent 历史（openclaw 期 08-15）反复出现 `FailoverError: LLM request timed out` + `lane wait exceeded` | 长工具回合未在窗口内产出 final；catch 分支的"[agent-core] delivery failed"文案未出现在任何可读记忆（若走了 catch，用户会看到可见错误；记忆无此文案 → 更可能仍处于运行中或产出被吞） |
| C. Delivery | 用户只看到 3 条进度消息，之后无内容 | 无 final 可发；非 payload 截断 |
| D. Reaction | 同上 | 无法确证 |

**TRUNCATION_LAYER = TOOL_WAIT_OR_LIFECYCLE**（首回合根本没有 terminal；任务裁决规则第 4 条）。
注意：B 的"完整规划"在用户 nudge 后正常产出，说明工具链与模型本身可用，问题在"首个长回合未收敛到 final"。

### 3.3 C：主题推荐后截断（用户："hi" → 截断于"把它立为主题"）

| 层 | 证据 | 结论 |
|---|---|---|
| A. 模型/Session | memory/2026-08-30.md 文件本体止于"把它立为主题"（mtime 15:06:37）；MEMORY.md 同分钟 consolidation 一致 | session final text 截断于该处；记忆在 turn 终点写入，故截断在 session 内，非写入截断 |
| B. Runtime | 无聚合丢失证据（payload 与 session final 一致即可证明） | 未观察到 RUNTIME_AGGREGATION 证据 |
| C. Delivery | 用户所见正文即截断文本；`OUTBOUND_PAYLOAD_LENGTH ≈ SESSION_FINAL_TEXT_LENGTH ≈ 460B` | 发送层原样发送；非发送截断 |
| D. Reaction | 同上 | 无法确证 |

**TRUNCATION_LAYER = MODEL_OR_TURN**（session final 本身截断；任务裁决规则第 1 条）。
截断形态：回合从"主题推荐"转入"上完整稿"的衔接处断掉——典型的长稿生成被提前终止形态
（候选：provider 输出上限 maxTokens、上下文上限、provider 端提前 stop；finish_reason 需 session jsonl 确认，见 §6）。

---

## 4. 高概率问题清单核对

| 疑点 | 结论 |
|---|---|
| 引用回复 wrapper 已发送但 final body 为空字符串 | **命中（A）**：空 reply 无守卫，`{"text":""}` 照发，Feishu 渲染引用壳 |
| 只把 reasoning/progress 文本当回复，final answer 没生成 | **命中（B）**：进度消息已发，final 未产出 |
| 流式回复只落了首个 chunk | 未命中（可读证据显示进度消息是 3 条独立 assistant 消息） |
| card final update 丢失 | 未命中（本链路发 text 消息，非 card） |
| tool call 完成后没有继续模型 turn | 未命中（B 在 nudge 后正常继续） |
| 文件读取任务仍在进行，前台进度文本被当成最终回复 | **命中（B）**：读转录/记忆/历史稿的长回合把进度当可见回复，final 缺位 |
| caller wait 超时或 outcome_unknown | **命中（B 机制）**：turn timeout（300s 默认）与 lane wait exceeded（openclaw 期同 agent 历史） |
| 模型 finish_reason=stop 但输出只到半句 | 疑似（C；finish_reason 需边界外 session jsonl 确认） |
| 最大输出 token / context 限制 | 疑似（C；zai/glm-5.3 在 agent home settings 未配 maxTokens） |
| Markdown / card 长度切分错误 | 未命中（text 消息，无分片逻辑介入） |
| assistant text 发送前被 trim/filter 成空 | 未命中（空来自模型产出；无 trim 证据；api.js 无 trim） |

---

## 5. Reaction 层结论

- 机制（agent-core v1 反应日志 `feishu-reactions.jsonl`，Jun 期 canary）：
  `set {emojiType:OK, status:processing}` → 完成 `delete` / 失败 `set {emojiType:ERROR, status:failed}`。
- 本轮三起事故的 reaction 状态无 live 日志可读（live reaction 记录在 `/Users/authsvc/.agent-core/**` 内）；
  但"processing 显示后没有完整正文"与 A/B（无 final 可发）完全自洽：reaction 的删除只绑定回合结束，
  不绑定"final 正文非空"，因此空/缺 final 的回合结束后，用户看到 reaction 消失但正文始终没有来——
  表现为"processing 后无正文"。**REACTION_STUCK_ROOT_CAUSE = 无 final 正文时无可见兜底文案，
  reaction 生命周期无法消除"空等"体验**（机制上不作为残留事故确证，因 live 日志不可读）。

## 6. 开放问题 / 边界

- **O1（证据边界）**：live 运行时 session jsonl（含 turnExecutionId、generation、childPid、finish_reason、
  max_tokens）位于 `/Users/authsvc/.agent-core/**` 与 `/Users/authsvc/.dsh/**`，本轮 yanfenma 身份无读权限
  （与本仓库历史轮次"no access to /Users/authsvc/**"边界一致）。C 的 finish_reason 与 A 的
  provider 空响应原因在 回复 执行 轮需 Owner 侧或授权读取确认。
- **O2（运行时版本）**：本轮代码证据取自本仓库源码（`docs/lark-ux-phase1-v2-spec` 分支），live 运行时为
  安装版 `/usr/local/libexec/agent-core/app`（pid 53919，root `/Users/authsvc/.agent-core`，08-30 15:33 重启）；
  二者语义一致（router/connector 契约），但字节级对齐未验证。
- **O3（时间戳）**：A 的 user 消息落在 08-29 17:46 记忆写入前；C 落在 08-30 15:06:37 记忆写入前。
  未从 live session 取到逐消息毫秒时间戳。
- **O4（无关事件）**：openclaw gateway 08-30 01:29 的 `tenant_access_token undefined`（delivery-queue 残留条目，
  ceo 群）属于 openclaw 侧重启窗口故障，与本次事故（agent-core 侧、15:06 时点、oc_516baf 群）不同链路，
  不作为根因归因；保留为事件上下文。

## 7. 一句话结论

三起事故截断全部发生在 **模型/回合层**（session final 为空 / 无 terminal / 中途截断），
Delivery 层忠实发送了 session 产出的内容（含空壳），真正的产品缺口是：**空回复无守卫、无 terminal 回合无兜底、
长回合无收敛保障、长稿生成无输出上限护栏**——四者都是可供 回复 执行 轮立项的修复点。

VERDICT = READ_ONLY_INVESTIGATION_COMPLETE
PRODUCT_CODE_CHANGE = NONE
PRODUCTION_CHANGE = NONE
NEXT_TASK = 回复 执行