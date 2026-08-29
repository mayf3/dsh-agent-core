---
spec_id: AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_ACTIVATION_V2
status: proposed
date: 2026-08-29
type: implementation-spec (complete standalone whole-authority successor of AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_ACTIVATION_V1; docs only this round)
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: contracts
replaces_on_acceptance: AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_ACTIVATION_V1
parent_policy_authority: AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V2
supersedes: []
superseded_by: null
governed_by:
  - AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V2
  - AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_IMPL_V2
  - AGENT_PROCESS_LIFECYCLE_HARDENING_V2
  - SCHEDULER_TIMEOUT_OUTCOME_V2
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
external_authorities: []
scope:
  - agt_cto-agent GLM strict 生产终态的完整保留
  - Luna 既有 OAuth 与 dsh-codex@0.2.3 资产原位复用
  - Harness identity fail-loud closure
  - GLM terminal pre-generation quota classifier exact correction
  - glm53 primary + luna cold fallback 的 gated activation 与一次性 canary
owners:
  - repository-maintainers
references:
  - docs/specs/AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_ACTIVATION_V1.md
  - docs/specs/AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1.md
  - docs/specs/AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_IMPL_V1.md
  - docs/specs/AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V2.md
  - docs/specs/AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_IMPL_V2.md
  - docs/investigations/AGT_CTO_LUNA_COLD_BACKUP_V2_EVIDENCE.md
  - docs/specs/AGENT_PROCESS_LIFECYCLE_HARDENING_V2.md
---

# AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_ACTIVATION_V2 — GLM primary + Luna cold backup activation

> **状态：proposed。** 本文件是 V1 activation authority 的完整、自包含、
> standalone whole-authority successor。V2 在 future independent review PASS、Owner
> acceptance finalize、V1↔V2 lifecycle backlink 原子事务完成并 merge into main 之前，
> 不覆盖 V1，不授予实现或 production apply 权限。
>
> 本轮 `TASK_NAME = 冷备 执行`，DOCS ONLY：不修改产品代码、production、现行 GLM
> strict override、credential、OAuth 或 plugin；不调用 Luna；不进行 ARM64 迁移。

---

## 0. Authoring result

```text
V2_SPEC = AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_ACTIVATION_V2
REPLACES_ON_ACCEPTANCE = AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_ACTIVATION_V1
AUTHORITY_FORM = COMPLETE_STANDALONE_WHOLE_AUTHORITY_SUCCESSOR
SPEC_STATUS = proposed
IMPLEMENTATION_ALLOWED_NOW = NO
PRODUCTION_APPLY_ALLOWED_NOW = NO
READY_FOR_INDEPENDENT_REVIEW = YES
```

本文件完整重述 V2 activation 所需的 current truth、policy、implementation closure、
readiness、production target、canary、rollback 与 acceptance；不依赖 V1 的未重述条款
才能执行。V1 仍是当前 active activation authority，且本 authoring PR 不修改 V1。

---

## 1. Goal and exact authority delta

### 1.1 Product goal

```text
PRODUCTION_TARGET = GLM_PRIMARY_WITH_LUNA_QUOTA_BACKUP
TARGET_AGENT = agt_cto-agent
PRIMARY_ROUTE = glm53
FALLBACKS = [luna]
LUNA_BACKUP_FOR_PROVEN_NO_ADMISSION = YES
GLM_429_FAILURE_CLASS = provider_quota_rejected_before_generation
GLM_429_HOP_ALLOWED = YES
LUNA_BACKUP_FOR_GLM_429_QUOTA = YES
```

GLM 继续作为主模型；Luna 只作为自动冷备，覆盖本 Spec 封闭列举的
proven-no-admission failure，以及证据完整的独立
`provider_quota_rejected_before_generation` failure。任何 ambiguous/partial/tool/unknown 429
仍 STOP。完成 Stage-2 后才允许另行处理 x64→ARM64；本 Spec 不授权 ARM64、HR
Dispatcher 或 Workflow 工作。

### 1.2 V1 → V2 complete replacement delta

V1 Amendment 1 的当前有效 baseline 是 `STAGE_1 = GLM_STRICT` 且
`STAGE_2 = LUNA_COLD_FALLBACK_DEFERRED`。V2 保留已完成的 GLM strict 终态与全部
安全 invariant，并在 Owner renewed authorization 下 whole-supersede 该 deferred
activation meaning：两项实现安全修复与全部 readiness gate 通过后，把既有 Luna
资产作为一条 subscription fallback 加入 agt_cto-agent 的 ordered chain。

V2 对 V1 的旧 Luna bootstrap 动作作 complete replacement：

| V1 历史动作 | V2 current contract |
|---|---|
| install / reinstall dsh-codex | 禁止；只读验证既有 exact 0.2.3、profile registration、19/19 peers、offline load；不满足即 BLOCKED |
| Owner fresh interactive OAuth | 禁止重新 OAuth；Owner 显式接受既有文件 provenance 后原位复用；不接受或失效即 BLOCKED |
| OAuth delete/copy/refresh | 始终禁止 |
| 无界/重复 Luna readiness probe | 删除；candidate 与 final production 各允许一个受控 canary、各恰一次 Luna call，均禁止重试 |
| GLM+Luna 一次性同时 bootstrap | GLM strict 已是生产前态；V2 只做 gated Luna cold-backup activation |

这不是 V1 partial amendment。V2 acceptance transaction 原子替换 V1 全 authority。

---

## 2. Authority lifecycle and atomic supersession

### 2.1 Before acceptance and merge

```text
REPLACEMENT_FORM = COMPLETE_STANDALONE_WHOLE_AUTHORITY
REPLACEMENT_SPEC_ID = AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_ACTIVATION_V2
REPLACED_SPEC_ID = AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_ACTIVATION_V1
THREE_V2_CURRENT_STATUS = proposed
THREE_V2_ACTIVE_AUTHORITY = NO
THREE_V1_CURRENT_STATUS = accepted
THREE_V1_ACTIVE_AUTHORITY = YES
V1_V2_MIXED_EFFECT = FORBIDDEN
PARTIAL_SUPERSESSION = NONE
V1_FILE_CHANGED_IN_AUTHORING_PR = NO
IMPLEMENTATION_ALLOWED_NOW = NO
PRODUCTION_APPLY_ALLOWED_NOW = NO
```

proposed V2 与 unmerged accepted-looking branch 均不是 active authority。

### 2.2 Future acceptance transaction

仅在 fresh full review 对 Parent V2、IMPL V2、Activation V2 的 exact heads 全部 PASS
后，Owner 可在**同一个** docs-only atomic transaction 中执行三对 whole supersession：

```text
Parent V2: proposed->accepted；supersedes []->[Parent V1]
Parent V1: accepted->superseded；superseded_by null->Parent V2
IMPL V2: proposed->accepted；supersedes []->[IMPL V1]
IMPL V1: accepted->superseded；superseded_by null->IMPL V2
Activation V2: proposed->accepted；supersedes []->[Activation V1]
Activation V1: accepted->superseded；superseded_by null->Activation V2
README: three V2 accepted/current；three V1 superseded/historical
review binding: reviewed base + three reviewed spec commits + reviewer ids
  + final accepted head + acceptance actor/time + semantic delta after review=NONE
```

任一 V2 未通过、任一 lifecycle edge 缺失或三者未在同一 commit ⇒ transaction abort。
完整 transaction merge main 前，三份 V1 继续是唯一 active authorities；禁止 Parent/
IMPL/Activation 的 V1/V2 mixed effect。merge 后三份 V2 同时成为各自唯一 active authority。

---

## 3. Current production truth and read-only evidence

### 3.1 GLM strict production terminal state

Owner 已冻结并提供真实生产证据：

```text
GLM_STRICT_PRODUCTION_READY = YES
primary = glm53
fallbacks = []
provider = zai
model = glm-5.3
FINAL_OUTCOME = success
```

V2 不重开、不重跑、不修改该终态。现行 production override 在 V2 全 gate 通过前
保持 strict；V2 authoring / review / implementation audit 均不得提前加入 Luna。

### 3.2 Production Definition and Home

production runtime launch root = `/Users/authsvc/.agent-core`；`agents.json` symlink
实际指向 `/usr/local/libexec/agent-core/config/agents.json`。目标 Agent id =
`agt_cto-agent`，其既有 Home =
`/Users/authsvc/.agent-core/homes/agt_cto-agent`。Definition、Binding、Home path
不是本 Spec 的写入面。

### 3.3 Existing Luna OAuth asset

只读 stat（未读取内容、未计算 hash/digest）：

```text
PATH = <TARGET_HOME>/.openai-codex-auth.json
PRESENT = YES
TYPE = regular file
OWNER_UID = 502
MODE = 0600
SIZE = 2092
MTIME = 2026-08-20T06:46:21+0800
METADATA_UNCHANGED_DURING_INVESTIGATION = YES
LUNA_REAUTH_REQUIRED = NO
```

TARGET_HOME 本身保持 directory mode `0755` / owner uid502；V2 不授权改 Home mode。
metadata 只证明文件边界，不证明 token 在线有效。V2 不授权通过 probe、refresh 或
重新登录验证 token。Owner 必须对 exact path + metadata 的 provenance 显式接受；
否则 readiness BLOCKED。任何 credential missing/revoked 状态只报告 blocker。

### 3.4 Existing dsh-codex asset

```text
DSH_CODEX_VERSION = 0.2.3 exact
PROFILE_REGISTERED = YES
PLUGIN_ENTRY_PRESENT = YES
PEER_DEPENDENCIES_READY = 19/19
OFFLINE_PLUGIN_ENTRY_IMPORT = PASS
PRODUCTION_NODE = v25.6.1 / darwin x64
NATIVE_ADDON_PAIRING = x64 Node + darwin-x64 addons
DSH_CODEX_REINSTALL_REQUIRED = NO
```

离线 import 使用 `HOME=/var/empty` 与不可达网络代理，未读取 OAuth、未调用模型。
缺失、版本漂移、peer 不全或 load failure 一律 BLOCKED；禁止 install/reinstall/upgrade。

### 3.5 Harness identity blocker

production Harness = `@deepseek-ai/dsh-root@0.1.0-rc.8`，目标 pin：

```text
DSH_VERSION_PIN = 0.1.0-rc.8
DSH_COMMIT_PIN = 514ab7b0029141b88c807704764d0d3e1eea1da4
HARNESS_GIT_PRESENT = NO
HARNESS_SOURCE_STAMP_PRESENT = NO
HARNESS_IDENTITY_READY = NO
OBSERVED_FAILURE = dsh_commit_mismatch (fail-loud)
```

这是当前唯一已证实的 Luna asset readiness blocker。它不得被误写成 OAuth
不可复用，也不得触发重新 OAuth、plugin install 或 `.git` copy。

### 3.6 Real GLM 429 evidence

真实 production transcript 同一 turn 顺序：`turn/start` → `user/message` →
`request/header(provider=zai,model=glm-5.3)` → usage input/output `0/0` → HTTP 429
QUOTA `Usage limit reached for 5 hour` → `turn/end(error)`。

```text
PROVIDER_FAILURE_CLASS = account_quota_exhausted
POLICY_ROUTE_FAILURE_CLASS = provider_quota_rejected_before_generation
PROVIDER_REQUEST_SENT = YES
HTTP_STATUS = 429
RESPONSE_TERMINAL = YES (turn/end(error), no timeout)
MODEL_OUTPUT_TOKEN_COUNT = 0
PARTIAL_OUTPUT = NO
ASSISTANT_CONTENT = NO
TOOL_CALL = NO
TOOL_STARTED = NO
EXTERNAL_SIDE_EFFECT = NO
OUTCOME_UNKNOWN = NO
TRANSPORT_TIMEOUT = NO
USER_TRANSCRIPT_PRODUCED = YES
POLICY_HOP_ALLOWED = YES (when fallback exists)
```

user transcript 与 provider request 不等于模型生成，也不得被伪装成
`proven_no_admission`。HTTP status、message 或 provider taxonomy 单独均不足；上列完整终态、
零输出、零工具、零副作用证据共同成立才允许新 quota class。该历史 transcript 只作为分类
证据，不得重复消耗额度制造 429；当时 strict config 无 Luna，故不声称历史 turn 实际 hop。

### 3.7 Stable observations and evidence relations

canonical immutable evidence artifact =
`docs/investigations/AGT_CTO_LUNA_COLD_BACKUP_V2_EVIDENCE.md` at the same reviewed spec
commit；其中固定 repository base/blob、runtime environment、method/result/limitations，并为
EVD-V2-001..006 声明 relation、target revision、strength/sufficiency。以下为规范内摘要；
冲突时 evidence artifact 只证明 observation，不改写本 Spec policy。全部 observed at
`2026-08-29 +0800`，且未读取或持久化 token/hash/provider raw body：

- `OBS-V2-001` — production root/Definition/Home。Method：只读解析
  `/Library/LaunchDaemons/ai.agent-core.runtime.plist` 的 Label + ProgramArguments，
  得到 `--root /Users/authsvc/.agent-core`；只读 `readlink/realpath`
  `/Users/authsvc/.agent-core/agents.json` →
  `/usr/local/libexec/agent-core/config/agents.json`；stat target Home。Result：
  `<TARGET_HOME>=/Users/authsvc/.agent-core/homes/agt_cto-agent`，directory
  `0755/uid502`。Retrieval：frozen evidence artifact `#obs-v2-001`。
- `OBS-V2-002` — OAuth metadata。Method：`stat` exact
  `<TARGET_HOME>/.openai-codex-auth.json` before/after offline checks。Result：regular、
  uid502、0600、2092B、mtime `2026-08-20T06:46:21+0800`，before=after。
  内容/hash/digest 未读。Retrieval：frozen evidence artifact `#obs-v2-002`。
- `OBS-V2-003` — plugin/profile。Coordinates：
  `<TARGET_HOME>/profiles/node_modules/dsh-codex/package.json:1-89`（version/main/
  19 peerDependencies）与
  `<TARGET_HOME>/profiles/agent-core-production/package.json:7-16`（bundles）。
  Method：production x64 Node ESM `import.meta.resolve` 19/19；`HOME=/var/empty`、
  unreachable proxy 下 import plugin entry。Result：19/19 + import PASS，OAuth stat
  unchanged。Retrieval：frozen evidence artifact `#obs-v2-003` + listed runtime files。
- `OBS-V2-004` — Node/Harness identity。Coordinates：
  `/usr/local/libexec/agent-core/harness/package.json:1-10`；deployed
  `/usr/local/libexec/agent-core/app/packages/agent-provisioning/src/index.js:81-143,
  173-190`。Method：production Node reports v25.6.1/darwin/x64；`file` verifies x64
  addons；test `.git`/`.source-stamp` absence；invoke deployed `readHarnessIdentity`
  read-only。Result：`dsh_commit_mismatch` because both git and stamp unavailable。
- `OBS-V2-005` — real GLM quota turn。Coordinate：
  `<TARGET_HOME>/sessions/--Users-authsvc-.agent-core-workspaces-agt_cto-agent--/
  main/session.jsonl:600-609`。Result：turn/user transcript/request header precede usage
  0/0 and exact 429 QUOTA terminal；no assistant message/tool event in bounded turn。
- `OBS-V2-006` — classifier defect。Coordinates：
  `packages/agent-router/src/route-chain.js:104-156,276-313`（provider set checked
  before failed+accepted receipt）；`packages/agent-router/src/process/provider-errors.js:
  22-31,58-65`；test gap at
  `packages/agent-router/test/route-chain/route-chain.test.js:93-118`。Method：construct
  real-shape `failed + promptReceipt=accepted + account_quota_exhausted` carrier and call
  classifier。Result：current code returns
  `initialize_provider_unavailable/proven_no_admission`（defect）。
- `OBS-V2-007` — GLM strict success。Coordinate：同 production session
  `session.jsonl:610-625`，request header = zai/glm-5.3，assistant terminal success；
  Owner task input independently freezes `GLM_STRICT_PRODUCTION_READY=YES`。

Qualified evidence relations（exact relation/target revision/environment/strength/limitations
以 frozen evidence artifact 的同名表行为 normative qualification）：

```text
EVD-V2-001 SUPPORTS target Definition/Home current metadata
EVD-V2-002 SUPPORTS existing Luna asset metadata/offline-load readiness only
EVD-V2-003 SUPPORTS CLM-V2-003 current Harness identity blocker/fix need
EVD-V2-004 SUPPORTS CLM-V2-004 observed real-429 terminal pre-generation evidence (hop predicates are policy)
EVD-V2-005 SUPPORTS CLM-V2-005 current classifier fix need at pinned source blobs
EVD-V2-006 SUPPORTS CLM-V2-006 bounded GLM strict success observation
```

局限：不调用 Luna，故 OAuth token 在线有效性仍 unknown；该 unknown 不授权 reauth，
只会使 final production canary 成功前 `ACTIVATION_COMPLETE` 保持 NO。

---

## 4. Complete preserved route-chain policy

### 4.1 Configuration-owned ordered chain

```text
ROUTE_CHAIN = [primary, ...fallbacks]
MAX_CONFIGURED_ROUTES = 4
MAX_ROUTE_ATTEMPTS = chain length
MAX_FALLBACK_ATTEMPTS = chain length - 1
ROUTE_ORDER_AUTHORITY = deployment-owned agent-model-overrides.json version 2
ROUTE_ORDER_HARDCODED_IN_CODE = FORBIDDEN
```

routeRef 必须解析；重复 routeRef、重复 canonical identity、未知 route、malformed
schema 或 chain length >4 均 startup fail-loud。每个 canonical route 每 turn 至多
attempt 一次；禁止 cycle、return、chain restart 与 unbounded attempts。

### 4.2 Route kinds and canonical identity

```text
routeKind = builtin | subscription
builtin: plugin/pluginVersion keys ABSENT；providerEnv 按 route contract ABSENT/present canonical
subscription: plugin + exact pluginVersion required；providerEnv 按 route contract ABSENT/present canonical
本 authority 的 exact glm53 tuple 要求 providerEnv ABSENT（键存在即 malformed）
```

canonical identity **恰好由七个有序字段**组成：routeKind、provider、model、
plugin-or-ABSENT、pluginVersion-or-ABSENT、credentialReadiness ref、canonical
providerEnv；不得增删字段或以未 canonical 的对象身份参与复用判断。
不同 identity 的 process 不复用；route change 使用 new process generation。

### 4.3 Per-hop closed classes

route_i → route_i+1 仅允许以下两条互斥路径之一：

1. attempt i 的 prompt admission 被机械证明为假，且 failure class 恰为：
   - `spawn_failed_without_child`；
   - `initialize_provider_unavailable`，且明确发生在 initialize、process 未达 READY、
     prompt admission=false；
   - `session_create_resume_rejection`，structured 且非 timeout/unknown；
   - `turnqueue_not_admitted`，即 validation/capacity fail 或 proven pre-send zero-byte rejection；
2. failure class=`provider_quota_rejected_before_generation`，且 request 已发出、status=429
   或结构化 quota-exhausted code、response 完整终态、output tokens=0、无 partial/content、
   无 tool call/start、无 external side effect、无 outcome_unknown、无 transport timeout。

新 quota class 是独立 failure class，不是 `initialize_provider_unavailable`，也不得伪装为
`proven_no_admission`。白名单外类别默认 STOP；HTTP code/message/provider taxonomy 单独不是
lifecycle proof。

### 4.4 STOP_CHAIN closed set

以下任一成立即 `NO_FURTHER_FALLBACK = YES`，fail-loud / outcome_unknown，绝不 replay：

- outcome_unknown；
- transport timeout 或 response termination 未证明；
- partial assistant/model output 或任何 assistant content；
- tool call emitted/materialized 或 tool started/executed；
- external side effect 或 side-effect uncertainty；
- ambiguous/text-only quota，或缺少 §4.3 quota path 任一 positive-zero/terminal evidence；
- unknown failure class 或 lifecycle evidence missing。

provider request、prompt receipt 或 user transcript 本身不等于 assistant/model generation，
也不单独触发 STOP；但它们绝不替代完整 quota safety evidence。

### 4.5 ONE_LOGICAL_TURN

整条 chain 对外仅一个 logical turn、一个 user transcript、一个 external delivery、
一份业务回复或失败回执。禁止重复 reply、重复 tool side effect、重复 occurrence。
所有 route 共享一个 turn deadline budget；per-hop deadline refresh 禁止。
下一 turn 总从 primary 开始，不做跨 turn fallback stickiness。

### 4.6 Entry points and Scheduler

Feishu synchronous ingress、Delivery admission 与 Scheduler invoker 必须汇入同一个
route-chain executor。Scheduler job 未显式 model 时仅继承 Agent chain；显式
model/route 为 strict 单 route；job/request 不得携带 fallback arrays。Scheduler
不得硬编码 route 或独立维护 policy。

### 4.7 Journal and redaction

每 attempt 必须记录且只依赖父 authority 已冻结的字段：routeChainId、attemptIndex、
routeRef、failureClass、admissionProven、attemptOutcome。final block 保持：finalRoute、
finalOutcome、totalRouteAttempts。canary 所需 primary/fallback/count/activated 值由 immutable
chain snapshot + attempt records 机械派生，不扩张 durable journal schema。classifier 可读取
现有 execution evidence 的 output/tool/side-effect tri-state；false 需 positive zero-evidence
proof，unknown 强制 STOP，但本 Spec 不把它们新增为 route journal 字段。

禁止 journal/log/output/PR 记录 raw provider body、prompt body、token、credential、
Authorization 或 OAuth object。raw credential 不进入 override、launchd、settings、
argv、prompt、Feishu 或 evidence。

---

## 5. Exact target routes and credential boundaries

### 5.1 glm53

```text
routeRef = glm53
routeKind = builtin
provider = zai
model = glm-5.3
credentialReadiness = zai-api-key-home
plugin = ABSENT
pluginVersion = ABSENT
```

ZAI_API_KEY 只存在于 target Home `.credentials.yaml`，0600/uid502；override 仅引用
readiness，不含 raw key。现行 GLM strict tuple 不变；`agent-default-model`、其余
settings 与 launchd 全局 provider/model 不变。

### 5.2 luna

```text
routeRef = luna
routeKind = subscription
provider = openai-codex
model = gpt-5.6-luna
plugin = dsh-codex
pluginVersion = 0.2.3
credentialReadiness = luna-oauth-home
credentialStore = <TARGET_HOME>/.openai-codex-auth.json
```

credential 只原位读取；禁止复制旧 root、`~/.codex/auth.json` 或其他 OAuth；禁止
OPENAI_API_KEY/API credits 路径。

### CTR-V2-005 — Luna providerEnv closed boundary

`providerEnv` 只能 ABSENT 或为 exact 四键 object：`HTTP_PROXY`、`HTTPS_PROXY`、
`NO_PROXY`、`NODE_USE_ENV_PROXY`；额外/缺失键 fail-loud。Luna target tuple 必须 present：
HTTP/HTTPS proxy 是现场核验的 non-secret URL，禁止 userinfo/credential；NO_PROXY 是
非空 comma-separated host-list；`NODE_USE_ENV_PROXY` 恰为字符串 `"1"`。该 map 只注入
agt_cto-agent 的 Luna child generation；不得进入 launchd/global env，不得注入 glm53
或其他 Agent。runtime 继承任一 proxy variant 即 startup fail-loud；通过后 child spawn
才先 strip 全集、再注入 exact closed map。Node 必须 exact 25.6.1；process-lifetime
immutable；日志只允许键名与 redacted presence。live gate 分别验证 HTTP/WebSocket/
auxiliary proxy、non-target absent、Feishu reply、cold restart、rollback/re-enable。网络只能
沿既有单一 outbound transport；禁止 generic arbitrary per-Agent env、global proxy、proxy
auto-discovery/health switching；禁止创建第二 transport/daemon/consumer。providerEnv reload
只许 target generation，不许 shared restart。

---

## 6. Authorized deployment closure — Harness identity

### DEC-V2-001 — trusted source-stamp fallback

production Harness 无 `.git` 时，`readHarnessIdentity` 只允许读取部署拥有的
`<harnessRoot>/.source-stamp`：

```json
{"commit":"<40-lowercase-hex>","dirtyCount":0}
```

规则：git 可用时 git identity 优先且 stamp 被忽略；git 不可用时 stamp key set
必须 exact `{commit,dirtyCount}`；commit 必须 40-char lowercase hex；dirtyCount
必须 integer >=0 且必须 =0。git+stamp missing、stamp malformed/dirty、commit mismatch
全部精确归 `dsh_commit_mismatch`；仅 package version mismatch 归
`dsh_version_mismatch`。两类均 fail-loud。package version alone 不足；复制 `.git` 到
production 永久禁止。stamp owner=authsvc(505)、mode=0644，随 Harness tree 管理。

### CTR-V2-001 — source-stamp deployment only

当前 main/deployed `readHarnessIdentity` 已具备 trusted fallback；本 authority 不授权为
identity 修改产品代码。修复只允许：对 exact deployed code 复跑既有 git/stamp/pin tests，
随后由 deployment step 生成并核验 `.source-stamp` 与非 secret evidence。

测试至少覆盖 git precedence、valid stamp、missing、malformed、dirtyCount nonzero、
version mismatch、commit mismatch。生产 stamp 必须来自受控 installed-tree vs exact clean
checkout 比对；未经测定写 `dirtyCount:0` 是伪造，禁止。若现有 code 不满足 contract，
activation BLOCKED，须另行合法 implementation authority；不得在执行轮顺手改代码。

---

## 7. Activation dependency — IMPL V2 429 classifier closure

### DEC-V2-002 — safety evidence precedes exact quota evidence, taxonomy last

classifier precedence 必须精确冻结为：(1) output/content/tool/side-effect/outcome_unknown/
timeout/termination uncertainty；(2) 明确终态 quota rejection 的完整 evidence；(3) provider
taxonomy/message 文本只作 subtype。既有 lifecycle stage class 仍须由自身结构化 evidence
独立证明，不得覆盖第1项或借 taxonomy 伪造 origin。`account_quota_exhausted` 文本单独不证明
initialize、no-admission 或安全 quota hop。

当前 defect：`FAIL_LOUD_PROVIDER_ERRORS` precedence 可把 quota carrier 错分为
`initialize_provider_unavailable / proven_no_admission`。修复后不得继续该误分类，也不得把
所有 429 粗暴 STOP；只有精确新 class 的完整证据允许 hop。

### CTR-V2-002 — exact quota-class correction acceptance dependency

文件 ownership 与实现授权只来自 `AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_IMPL_V2`。
Activation V2 不直接授权 `route-chain.js` 或测试改动；这里只冻结 production activation
必须等待的 observable contract。IMPL V2 scope 外 evidence 文件不得修改；若现有 carrier
不足，GATE-6 保持 BLOCKED。

IMPL V2 implementation + independent audit 必须证明：

1. exact terminal quota rejection + output tokens0 + zero partial/content/tool/side-effect +
   outcome known + no timeout → `provider_quota_rejected_before_generation` → hop；
2. partial output、assistant content、tool call/start、external side effect、outcome_unknown、
   timeout 或 termination unknown 任一优先命中 STOP；
3. bare/text-only quota/429 缺完整 evidence → unknown + STOP；
4. explicit initialize-origin + never READY + admission=false 只归既有 class 2；
5. 新 quota class 不得归 initialize，也不得标记 proven_no_admission。

回归测试必须覆盖用户要求的 A-D：A exact controlled 429 fixture 使 glm53 attempt1 → luna
attempt2 → success，TOTAL=2、fallback=true、FINAL_ROUTE=luna、Luna call1；B 429+partial、
C 429+outcome_unknown、D 429+tool started 均 attempts1、Luna0、STOP。另覆盖 assistant
content/tool call/side effect/timeout/termination unknown/text-only negatives。

```text
QUOTA_CLASSIFIER_FIX_REQUIRED = YES
GLM_429_FAILURE_CLASS = provider_quota_rejected_before_generation
GLM_429_HOP_ALLOWED = YES
LUNA_BACKUP_FOR_GLM_429_QUOTA = YES
```

---

## 8. Stage-2 readiness gates

全部 gate 为 AND；任何 FAIL/UNKNOWN 均保持 GLM strict：

```text
GATE-1 AUTHORITY
  Parent V2 + IMPL V2 + Activation V2 fresh full review PASS
  AND all three accepted in one atomic supersession transaction AND merged main

GATE-2 GLM_STRICT_BASELINE
  current primary=glm53/fallbacks=[] production evidence remains PASS；不重开 Stage 1

GATE-3 EXISTING_OAUTH
  exact file metadata valid AND Owner explicitly accepts provenance
  AND zero re-OAuth/refresh/delete/copy；失效/不接受 = BLOCKED

GATE-4 EXISTING_PLUGIN
  exact 0.2.3 + registered + entry present + peers 19/19 + offline load PASS
  zero install/reinstall/upgrade；任一 failure = BLOCKED

GATE-5 HARNESS_IDENTITY
  exact rc.8 + commit pin + clean trusted identity PASS
  current state = FAIL (source-stamp missing)

GATE-6 CLASSIFIER_SAFETY
  IMPL V2 CTR-I2-008..011 implementation merged main + independent audit PASS

GATE-7 CANDIDATE_CANARY
  §10.1 PASS on exact audited merged commit/path→blob manifest intended for production
  AND candidate runtime artifact identity matches manifest；Luna model call count = exactly 1

GATE-8 PRODUCTION_CANARY_AUTH
  Owner authorizes exactly one production canary against exact audited/deployed head
```

当前：`HARNESS_IDENTITY_READY = NO`，故 activation BLOCKED。不得用 credential 或
OAuth 操作绕过 identity。

---

## 9. Production target config and activation order

### CTR-V2-003 — exact v2 config

全部 gates 通过前禁止写。目标 `/Users/authsvc/.agent-core/agent-model-overrides.json`：

```jsonc
{
  "version": 2,
  "routeCatalog": {
    "glm53": {
      "routeKind": "builtin",
      "provider": "zai",
      "model": "glm-5.3",
      "credentialReadiness": "zai-api-key-home"
    },
    "luna": {
      "routeKind": "subscription",
      "provider": "openai-codex",
      "model": "gpt-5.6-luna",
      "plugin": "dsh-codex",
      "pluginVersion": "0.2.3",
      "credentialReadiness": "luna-oauth-home",
      "providerEnv": {
        "HTTP_PROXY": "<现场核验值>",
        "HTTPS_PROXY": "<现场核验值>",
        "NO_PROXY": "<现场核验非空 comma-separated host-list>",
        "NODE_USE_ENV_PROXY": "1"
      }
    }
  },
  "overrides": {
    "agt_cto-agent": {
      "model": {"primary":"glm53","fallbacks":["luna"]}
    }
  }
}
```

providerEnv 必须满足 CTR-V2-005；raw credential 禁止。配置文件 owner=authsvc(505)、
mode=0644；写入采用同目录 atomic replace，loader read-back + no-secret scan PASS。
overrides 合法 key 恰为 `{agt_cto-agent}`；其他 Agent 零变化。

### CTR-V2-006 — audited path→blob deployment and rollback

执行轮必须在写 production 前冻结 exact path→blob manifest，覆盖 classifier + canary
seam 的已审计 route-chain/runtime closure；identity code 只做 deployed blob audit（本 V2 不
授权 identity code delta），`.source-stamp` 作为单独 deployment artifact 记录。唯一合法提取源是
`git show <audited-merged-commit>:<path>`；禁止从 worktree、dirty checkout、未审计
latest head 或临时目录复制。逐 path 记录 before/after blob；rollback 恢复 before blob
与 strict config，不夹带 manifest 外文件。

### CTR-V2-004 — order

```text
1. accepted/merged authority + audited implementation closure
2. deploy exact audited path→blob set
3. generate and verify honest .source-stamp
4. Owner 选择 shared-runtime maintenance window；关闭所有受该 runtime 影响的 ingress/admission
5. 对全部 resident Agent/Scheduler delivery 核验 zero in-flight 或已证明 terminal；任一 unknown/busy 无法 drain => postpone，禁止 restart
6. controlled system/ai.agent-core.runtime restart on still-strict config
7. verify runtime up、single Feishu WebSocket、all non-target config/route/env semantics unchanged（PID restart 只作为已授权运维事实记录）、target strict health、classifier fix live
8. atomically write target v2 config
9. controlled target-only new generation；providerEnv/config reload 禁止 shared restart；若 deployed loader 无法 target-only apply，则 activation BLOCKED，须另行 lawful implementation，不得降级 contract
10. verify chain snapshot length=2；保持 target admission quiesced
11. execute production canary A–D 的逐-case admission transaction
12. clear/verify injection；final clean GLM
13. resume target admission；仅在所有其他 ingress health PASS 后恢复 shared admission
```

配置先于代码、hot reload、watcher apply、per-hop deadline refresh 均禁止。不改
launchd、Definition、Binding、Scheduler job/store、global env、第二 Feishu consumer。

---

## 10. Canary contracts

### 10.1 Candidate / staging seam

candidate 必须从已 merged + independently audited implementation commit 以
`git show <commit>:<path>` 构建；先冻结 exact commit、每个 path→blob、build artifact digest、
Harness version/commit/dirty=0 和 dsh-codex pin。candidate runtime read-back 必须逐项匹配
该 manifest，且 manifest 恰为 CTR-V2-006 intended production after-set；任何 source/build
差异使结果 invalid 并要求新 canary，禁止 worktree/dirty/latest-head substitute。

candidate 必须使用 CTR-I2-015 同一 runtime-root-relative seam，descriptor exact path 为
`<candidateRuntimeRoot>/route-chain-canary-injection.json`；candidate root owner/mode 与
production rule 同构且 production absolute path lstat before/after 均不变。不得使用临时 test-only seam 替代。
随后在隔离 candidate ingress 使用受控 fixture：glm53 attempt 发出受 observer 证明的 provider
request，fixture 返回 exact terminal 429/quota-exhausted、output tokens0、零 partial/content、
零 tool call/start、零 external side effect、outcome known、无 timeout、termination proven；
classifier 必须归 `provider_quota_rejected_before_generation`，再 hop Luna success。fixture 不得
真实消耗 GLM 额度，也不得靠重复真实 429。candidate 不写 production override、不改变生产
ingress；只按 Parent V2 边界原位使用既有 OAuth，由 exact dsh-codex@0.2.3 发起恰一次
Luna call。执行前必须 Parent/IMPL/Activation V2 已原子 accepted+merged、classifier
implementation 已审计、Harness identity ready；失败不重试。

```text
GLM_ATTEMPTS = 1
LUNA_ROUTE_ATTEMPTS = 1
LUNA_MODEL_CALL_COUNT = 1
TOTAL_ROUTE_ATTEMPTS = 2
FALLBACK_ACTIVATED = true
FINAL_ROUTE = luna
FINAL_OUTCOME = success
ONE_LOGICAL_TURN = YES
DUPLICATE_REPLY = NO
```

同一 suite 必须证明 429+partial output、429+outcome_unknown、429+tool started，以及
assistant content/tool call/external side effect/transport timeout/termination unknown/bare或text-only
quota 均 STOP 且 second acquire=0、Luna call=0。

### 10.2 Final production A–D

仅 GATE-1..8 全 PASS 后执行。每个 case 都必须同时取得两条互不替代的 evidence
channels：(1) Owner 通过真实 Feishu ingress 观察业务回复/失败回执；(2) structured
machine evidence = fixed durable route journal（attempt/count/STOP）+ CTR-I2-015 durable
canary observer（model-call/retry/onStart/onDispatch/transcript/external-delivery counts）。
route attempt 不得替代 model-call count；journal 不伪造 duplicate fields。缺任一 channel
或 machine sub-source 即 FAIL。整组仅 CANARY-B 调用 Luna，恰一次：

```text
CANARY-A CLEAN PRIMARY
  glm53=1；luna=0；TOTAL=1；FINAL_ROUTE=glm53；success；fallback=false

CANARY-B ONE CONTROLLED QUOTA FALLBACK
  使用受控 exact terminal-429 fixture；不得真实耗尽额度制造 429
  failureClass=provider_quota_rejected_before_generation
  glm53=1；luna=1；TOTAL=2；fallback=true
  FINAL_ROUTE=luna；FINAL_OUTCOME=success
  ONE_LOGICAL_TURN=YES；DUPLICATE_REPLY=NO
  LUNA_MODEL_CALL_COUNT=1

CANARY-C OUTCOME_UNKNOWN STOP
  glm53=1；luna=0；STOP_CHAIN；no replay；one failure receipt

CANARY-D DUPLICATE/DELIVERY INVARIANTS OVER A-C
  A/B: onStart=1, onDispatch=1, transcript=1, external delivery=1
  C pre-acquire STOP: onStart=0, onDispatch=0, transcript=1 failure receipt,
    external delivery=1 failure receipt
  every case: one logical turn；no count > expected；duplicate reply=NO

TOTAL_REAL_LUNA_MODEL_CALLS_ACROSS_A_TO_D = 1
```

逐-case injection/admission transaction（target-only，其他 Agent 零影响）：

```text
A: target admission quiesced -> verify no injection -> open exactly one A turn
   -> await terminal + both evidence channels -> quiesce target
B: install one bounded reversible glm53-only exact terminal-quota fixture
   -> verify luna credential/path untouched -> open exactly one B turn
   -> prove glm request dispatch then controlled zero-generation terminal 429 -> luna success
   -> await terminal + both channels -> quiesce -> clear B injection -> verify absent
C: install a distinct bounded glm53-only outcome_unknown injection
   -> open exactly one C turn -> await failure receipt + both evidence channels -> quiesce
   -> clear C injection -> verify absent -> prove C process acquire=0, no new generation created,
      and the pre-existing target generation identity/state is unchanged
D: while quiesced, aggregate A-C duplicate/delivery evidence; no new model turn
FINAL: restore/verify clean config+injection state -> controlled clean generation
   -> open exactly one clean GLM verification turn -> resume normal target admission
```

唯一合法机制是 IMPL V2 CTR-I2-015 的 exact one-shot descriptor：
`/Users/authsvc/.agent-core/route-chain-canary-injection.json`（authsvc505/0600）。B mode=
`provider_quota_rejected_before_generation`，C mode=`outcome_unknown`；每 case 用新 nonce、future expiry、
maxUses=1，并写 exact binding `{channel:"feishu",senderOpenId:<Owner authenticated ingress id>,
marker:<entire exact canary prompt>}`。Owner 只能从该 sender 发送 entire marker；不得靠 prompt
自报身份。consume=descriptor 原子 rename 到
`route-chain-canary-injection.used.<nonce>`；仅 rename winner 可 inject。
install=同目录 write+fsync+atomic rename；verify=lstat owner/mode + recursive no-duplicate
schema parse + read-back exact values；clear=unlink descriptor/temp/exact used marker + 全部 lstat
ENOENT。所有操作在 target quiesced 时完成；consume audit=1，provider/model/retry/duplicate/
delivery observer counts 必须 exact。禁止其他 command/seam/provider mutation；不得触碰
credential/providerEnv或影响其他 Agent。

禁止通过消耗 GLM 额度、删除 ZAI_API_KEY、损坏 credential、修改真实 provider、
重新 OAuth 或重复调用 Luna 制造 fallback。

### 10.3 Injection cleanup and failure order

成功：先清除 injection 并机械验证 absent，再执行一次 clean GLM verification。

失败/unknown/证据不完整：

```text
1. immediately quiesce target; classify suspect scope = TARGET_ONLY | SHARED_ARTIFACT | UNKNOWN
2. TARGET_ONLY only if deployed code+stamp+runtime health are independently PASS;
   otherwise treat as SHARED_ARTIFACT
3. TARGET_ONLY: restore strict config -> clear/verify injection -> reconcile old target generation
   -> controlled target restart -> clean GLM verification
4. SHARED_ARTIFACT/UNKNOWN: close all affected ingress -> drain every resident Agent/Scheduler
   delivery to proven terminal (busy/unknown => remain quiesced, no restart)
5. restore every before-blob from CTR-V2-006 manifest + strict config; clear/verify injections;
   fsync/read-back/hash against before manifest；不得恢复已知 stamp-absent broken identity state
6. re-measure restored installed tree vs exact clean checkout and generate a new honest
   .source-stamp for the restored before-blob tree；无法证明 clean/pinned => remain BLOCKED,
   no restart/admission
7. controlled shared-runtime restart only after all-runtime drain; verify single connector,
   non-target config/route/env semantics, target strict GLM and trusted restored-tree identity
8. resume admissions only after corresponding health PASS; otherwise remain blocked/quiesced
9. stop; no retry without new Owner authority
```

CTR-V2-006 before-blob restoration is mandatory whenever code/stamp is suspect or cause unknown；
target-only rollback不得宣称恢复 shared artifact。注入仍存在时禁止创建 generation。
rollback 不删除/复制/refresh OAuth，不卸载 plugin。

---

## 11. Rollback and terminal states

```text
STRICT_SAFE_TERMINAL = routeCatalog glm53 only + primary=glm53 + fallbacks=[]
ACTIVATED_TERMINAL = glm53 primary + [luna] + A-D PASS + injection absent
BLOCKED_TERMINAL = strict config unchanged + explicit blocker record
```

任一 identity/plugin/OAuth/classifier/canary gate failure都进入 BLOCKED 或 strict safe
terminal；不得 silent fallback、不得降级安全条件。正常 config/canary rollback 只作用目标
Agent generation；shared deployed code/stamp suspect 或 cause unknown 时必须执行 §10.3
all-runtime drain + before-blob restoration。无论路径，其他 Agent 的 config/route/env、
Scheduler store/job、Binding、Definition、launchd 均不改；shared restart 的 PID/liveness
变化须作为已授权 maintenance evidence 记录，不得隐瞒为“零变化”。

---

## 12. Governance primitive record

### 12.1 Current State

Three V1 authorities are current；production remains GLM strict；Luna config absent。CLM-V2-003
and CLM-V2-005 are supported blockers。This proposed file has no apply effect。

### 12.2 Observations, Claims and Evidence

§3.7 and the frozen investigation define OBS-V2-001..007, `SUPPORTED` CLM-V2-001..006 and
EVD-V2-001..006 with backlinks/qualifications。Execution evidence below is distinct and must be
recorded at exact future revisions。

### 12.3 Decisions

DEC-V2-001/CTR-V2-001=honest stamp deployment only；DEC-V2-002/CTR-V2-002=IMPL-owned
admission-first closure；DEC-V2-003=exact target config (CTR-V2-003/005)；DEC-V2-004=audited
path/blob + ordered all-runtime-safe deployment/rollback (CTR-V2-004/006)；DEC-V2-005=two
counted canary stages with closed one-shot seam (§10)。

### 12.4 Scope/non-goals, authority/dependencies, migration/rollback, open questions

Scope/non-goals are frontmatter/§§1/13-14；authority/dependencies and current lifecycle are §2；
migration is §9；rollback is §§10.3/11。`OPEN_QUESTIONS = NONE`；all unknown readiness values
fail closed as gates and do not authorize execution choices。

## 13. Contract-by-contract acceptance

Each row requires executed evidence attached at exact implementation/deployment/config revision；
missing evidence or any Reject condition fails activation。

| Acceptance | Contract/gate | Method | Environment | Expected result / required executed evidence | Reject when |
|---|---|---|---|---|---|
| ACC-V2-001 | §2 / GATE-1 | exact-head governance diff | repository | three V2 PASS + six atomic links + V1 bytes pre-transaction unchanged | partial/mixed/unreviewed head |
| ACC-V2-002 | GATE-2 / §3.1 | read config + bounded clean GLM turn | production strict target | glm53 only, terminal success, journal1 | Luna configured/baseline fails |
| ACC-V2-003 | GATE-3 | lstat before/after + Owner provenance record | target Home | exact path uid502 mode0600 metadata unchanged; no OAuth ops | metadata drift/no Owner acceptance |
| ACC-V2-004 | GATE-4 | package/profile/19 peers/offline import | production x64 offline | exact0.2.3, registered, 19/19, PASS, install0 | mismatch/install/mutation |
| ACC-V2-005 | CTR-V2-001 / GATE-5 | source tests + installed-tree comparison + stamp read-back | test + production | rc8/exact commit/dirty0; negatives fail-loud | forged/missing/malformed/dirty/version trust |
| ACC-V2-006 | CTR-V2-002 / GATE-6 | IMPL CTR-I2-008..011 A-D/negative suite + independent audit | pinned merged implementation | exact terminal quota class hops; partial/outcome_unknown/tool-started/ambiguous 429 acquire1/Luna0 STOP | misclassification, unsafe hop, or audit failure |
| ACC-V2-007 | §10.1 / GATE-7 | manifest-bound isolated candidate using candidate-root controlled terminal-429 seam | audited candidate artifact | glm attempt1→luna attempt2, Luna call1/retry0, one turn, production injection path untouched, no real quota exhaustion | source mismatch/temporary seam/call≠1/real 429 manufacture |
| ACC-V2-008 | CTR-V2-003/005 | recursive parse, atomic write/read-back, secret scan | production target config | exact two routes/order/providerEnv; only target override; no raw secret | schema/owner/mode/secret/non-target drift |
| ACC-V2-009 | CTR-V2-006 | before/after path→blob manifest and read-back hashes | deployment staging + production | only audited merged blobs/stamp artifact | worktree/latest/unlisted file |
| ACC-V2-010 | CTR-V2-004 | all-affected ingress close + drain ledger + restart health | shared production runtime | zero unknown in-flight; single connector; non-target semantics unchanged | busy/unknown restart or health drift |
| ACC-V2-011 | §10.2 A/B | Owner Feishu + journal + canary observer | production target | A glm success; B controlled terminal-quota attempts2/Luna call1/retry0/delivery1; no real quota exhaustion | missing channel/count mismatch/retry/real 429 manufacture |
| ACC-V2-012 | §10.2 C/D | bound outcome_unknown descriptor + both channels | production target | C pre-acquire start/dispatch0, STOP/Luna0; per-case exact counts/no duplicates | dispatch in C/hop/duplicate/missing evidence |
| ACC-V2-013 | CTR-I2-015 / §10.2 | schema/binding/atomic rename/cleanup read-backs | candidate + production roots | correct root, authenticated binding, consume1, used/temp absent | path traversal/wrong root/collision/leftover |
| ACC-V2-014 | §§10.3/11 | target and shared-suspect rollback drills/review | controlled production maintenance | strict config; before blobs; honest restored-tree stamp; safe health | trusted identity impossible/partial restore |
| ACC-V2-015 | CTR-V2-005 | inherited-env/Node/immutability + independent live observers | test + controlled production | HTTP/WS/aux/Feishu/cold/target-only rollback/re-enable PASS | shared reload/global env/missing observer |
| ACC-V2-016 | §§4/10 | durable journal + observer/redaction scan | candidate + production | fixed journal fields + bounded counts; no raw secret/prompt/body | transient evidence/field forgery/leak |

`ACTIVATION_COMPLETE = YES` only if ACC-V2-001..016 all PASS。

---

## 14. Security and operational boundaries

- 仅 exact `dsh-codex@0.2.3` 可在 target Luna route process 内存读取既有 OAuth：
  candidate 与 final production CANARY-B 各恰一次；ACTIVATED_TERMINAL 后 ordinary
  proven-no-admission 或 `provider_quota_rejected_before_generation` fallback 也可按 Parent V2
  chain contract 读取。operator/audit/其他
  process 永不读取或输出 token；禁止 hash、复制、删除、refresh、自动 refresh、持久化
  改写或重新登录；若
  protocol 要求 refresh 则 canary fail-loud + rollback，不得触发 refresh；
- dsh-codex 不安装、重装、升级或从临时目录复制；
- `.git` 不复制到 production；source-stamp 必须部署拥有、诚实生成；
- raw ZAI/OpenAI credential 不进入 override、launchd、settings、argv、prompt、日志、PR；
- provider raw response body 不进入 route journal；
- Luna model call 在 candidate=1、production final A–D total=1；两阶段各自失败均不重试；
- 禁止 dsh-zai/fake ZAI plugin carrier；glm53 只能使用 Harness builtin zai provider；
- 禁止修改 shared profile/template、全局 bundles 或建立第二 outbound transport/daemon/
  Feishu consumer；既有 dsh-codex 只在 target Home profile 内；
- ambiguous/partial-output/tool-started/outcome_unknown/timeout/termination-unknown 429 永远 STOP；
  仅完整证据的 `provider_quota_rejected_before_generation` 可 hop；
- 不修改当前 GLM strict override，直到 production apply gates 全 PASS；
- ARM64_MIGRATION = HOLD；HR_DISPATCHER = OUT_OF_SCOPE；WORKFLOW = OUT_OF_SCOPE。

---

## 15. Rejected alternatives

| Alternative | Disposition |
|---|---|
| V1 in-place partial Amendment | REJECTED：repository governance forbids new partial supersession |
| parallel second active route authority | REJECTED：atomic V2 acceptance leaves exactly one active authority |
| re-OAuth / refresh / copy credential | REJECTED |
| install/reinstall/upgrade dsh-codex | REJECTED |
| treat HTTP 429/text as sufficient hop proof | REJECTED：必须全部终态/零生成安全证据 |
| classify quota rejection as initialize or proven_no_admission | REJECTED：新 class 独立 |
| partial-output/tool-started/side-effect quota replay | REJECTED |
| outcome_unknown fallback | REJECTED |
| consume quota/delete key/corrupt provider to test | REJECTED |
| Scheduler hardcoded route order | REJECTED |
| per-hop deadline reset | REJECTED |
| config-first deployment | REJECTED |

---

## 16. Authoring final output

```text
TASK_NAME = 冷备 执行
V2_SPEC = AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_ACTIVATION_V2
V2_STATUS = proposed
V1_SUPERSESSION_MODE = ATOMIC_ON_V2_ACCEPTANCE_AND_MERGE

LUNA_REAUTH_REQUIRED = NO
DSH_CODEX_REINSTALL_REQUIRED = NO
HARNESS_IDENTITY_FIX_REQUIRED = YES
QUOTA_CLASSIFIER_FIX_REQUIRED = YES

LUNA_BACKUP_FOR_PROVEN_NO_ADMISSION = YES
GLM_429_FAILURE_CLASS = provider_quota_rejected_before_generation
GLM_429_HOP_ALLOWED = YES
LUNA_BACKUP_FOR_GLM_429_QUOTA = YES
AMBIGUOUS_429_STOP_CHAIN = YES
PARTIAL_OUTPUT_429_STOP_CHAIN = YES
TOOL_STARTED_429_STOP_CHAIN = YES
OUTCOME_UNKNOWN_429_STOP_CHAIN = YES

PRODUCT_CODE_CHANGE = NONE
PRODUCTION_CHANGE = NONE
OVERRIDE_CHANGE = NONE
CREDENTIAL_CHANGE = NONE
LUNA_MODEL_CALL = NO
LUNA_OAUTH_TOUCHED = NO
DSH_CODEX_INSTALL = NO
ARM64_MIGRATION = HOLD

READY_FOR_INDEPENDENT_REVIEW = YES
NEXT_TASK = 冷备 审计
```
