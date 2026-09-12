---
spec_id: AGENT_CORE_BROKER_AUTH_SERVICE_ORIGIN_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
production_apply_authority: none
date: 2026-08-30
scope:
  - packages/broker authServiceOrigin origin-form contract (plugin Config -> gateway -> transport token endpoint primitive)
  - production broker auth-service token endpoint origin freeze (BROKER_AUTH_ORIGIN / compose opts.broker.authServiceOrigin)
governed_by:
  - AGENT_CORE_WORKFLOW_BROKER_ERROR_PRESERVATION_V1
  - AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1
external_authorities: []
supersedes: []
superseded_by: null
owners:
  - mayf3
---

# AGENT_CORE_BROKER_AUTH_SERVICE_ORIGIN_V1 — Broker authServiceOrigin 回环 HTTP 例外与形态冻结

> 状态：**proposed**。本轮只提交 docs-only Draft PR，不实现、不接受、不 merge。
> `PRODUCT_CODE_CHANGE = NONE`；`PRODUCTION_CHANGE = NONE`。
> `implementation_authority = none`：acceptance 事务（`proposed -> accepted`、
> `none -> contracts` 翻转）保留给独立审计轮（NEXT_TASK = 回环 审计），
> 与 `AGENT_CORE_WORKFLOW_GLOBAL_INSTANCES_CAPABILITY_V2` authoring 轮同一先例。
>
> 本 Spec 是 **focused amendment**：它给 Broker 通用 HTTP transport 的
> auth-service token endpoint origin（`authServiceOrigin`）冻结一个最小、
> fail-closed 的形态契约。它不修改任何 accepted Spec 的 normative body
> （`PARENT_SPEC_FILE_MODIFIED = NO` 对两个 `governed_by` 父权威均成立），
> 不重复、不放宽、不重新解释它们已冻结的任何合同。

## 0. Machine-readable freeze

```text
SPEC_ID = AGENT_CORE_BROKER_AUTH_SERVICE_ORIGIN_V1
SPEC_KIND = implementation
SPEC_STATUS = proposed
IMPLEMENTATION_AUTHORITY = none            （acceptance 翻转前不授权任何代码改动）
PRODUCTION_APPLY_AUTHORITY = none

PLAIN_HTTP_ALLOWED_FORM = http://127.0.0.1:<explicit-port>[/]
PLAIN_HTTP_RAW_AUTHORITY_CHECK = BEFORE_WHATWG_PARSE
PLAIN_HTTP_RAW_HOST = 127.0.0.1             （原始 authority 中的 hostname 必须逐字符精确相等）
PLAIN_HTTP_HOST_FORBIDDEN = localhost | IPv6 | 非规范/别名 IPv4 | 尾点形式 | 任何域名 | 任何非 127.0.0.1 的 IP
NON_LOOPBACK_SCHEME = https                 （强制；本 amendment 不放宽任何既有 HTTPS 要求）
RAW_PATH = empty | /                        （dot-segment 与任何其他 path 均非法）
FORBIDDEN_URL_COMPONENTS = query（空或非空） | hash(fragment，空或非空) | userinfo(username/password)
PLAIN_HTTP_PORT = 原始 authority 中必须出现的显式十进制端口，1..65535（含显式 :80；省略端口 = 非法；端口 0 = 非法）
HTTPS_PORT = 可选（省略 = 443）

VALIDATION_PRIMITIVE = requestAccessToken   （transport.js 的单一 token mint 原语；三路调用方全覆盖）
VALIDATION_EFFECT = 任何非法 origin：在任何网络尝试之前失败（fetch 调用数 = 0），fail-closed，绝不静默回退默认值
TOKEN_REQUEST_REDIRECT = FORBIDDEN          （3xx 一律 DENIAL，绝不跟随；Basic 凭据绝不发往第二个 origin）
AUTH_BYPASS = FORBIDDEN                     （credential seam / client_credentials / Bearer / scope 钉死 / 401 策略全部不变）
PRODUCTION_AUTH_SERVICE_ORIGIN = http://127.0.0.1:4001   （frozen；含 plugin 默认值与生产 env seam）

DOCS_ONLY_THIS_ROUND = YES
PRODUCT_CODE_CHANGE = NONE
PRODUCTION_CHANGE = NONE
```

## 1. Goal

Broker 通用 HTTP transport（`packages/broker`）通过
`authServiceOrigin` + 固定路径 `/oauth/token`（`TOKEN_ENDPOINT_PATH`，
`transport.js:66` on authoring base `e2e1e22`）向 auth-service 的 token
endpoint 发起 `client_credentials` 请求。该字段今天是一个**零校验的任意
字符串**（`index.js:103` `z.string().default(DEFAULT_AUTH_SERVICE_ORIGIN)`），
其值经 `Config` / `opts.broker?.authServiceOrigin` /
`process.env.BROKER_AUTH_ORIGIN` 三条 seam 进入 wiring（`index.js:153,182`、
`gateway.js:66,140`、`compose.js:304,367`），最终在
`requestAccessToken`（`transport.js:134`）里被字符串拼接为
`` `${authServiceOrigin}${TOKEN_ENDPOINT_PATH}` ``（`transport.js:150`）后
fetch——**且未设置 `redirect` 策略**（fetch 默认 `follow`）。

本 Spec 冻结一个最小、可机械验收的形态契约：

1. **回环例外**——明文 HTTP **只允许** `http://127.0.0.1:<port>` 或
   `http://127.0.0.1:<port>/`；在 WHATWG parse **之前**从原始 authority
   检查 host 逐字符等于 `127.0.0.1`、端口显式且为十进制 `1..65535`，
   并拒绝 userinfo、任何 query/fragment（包括空 `?` / `#`）及 dot-segment path；
2. **非回环不放宽**——不满足上述 HTTP 原始字面量白名单的 origin **必须**
   是 HTTPS（本 amendment 不创造任何新的明文传输面）；
3. **禁止重定向**——token endpoint 请求绝不跟随 redirect，任何 3xx 是
   DENIAL（Basic 凭据绝不能被重定向送往第二个 origin）；
4. **不绕过鉴权**——回环例外只改变 token endpoint 这一段的传输加密要求，
   授权语义零变化；
5. **生产值冻结**——`http://127.0.0.1:4001`。

## 2. Scope and non-goals

In scope（accept 后的实现面，见 §10 闭包）：

- `packages/broker` 的 `authServiceOrigin` 形态校验契约（校验落点 =
  `requestAccessToken` 单一原语，见 CTR-ORI-005）；
- token endpoint 请求的 redirect 禁令（CTR-ORI-006）；
- 生产 origin 值冻结（CTR-ORI-008）；
- 冻结的 accept/reject 测试向量表（§10，供实现轮与审计轮机械复核）。

Out of scope / 明确不授权：

- **任何代码实现**——本 Spec 为 SPEC ONLY / DOCS ONLY；在 accepted 且
  `implementation_authority` 翻转为 `contracts` 之前，任何实现开工都违反
  governance 前置。
- **姊妹消费者的 origin 契约**：`notification-ingress` 的
  `auth.json#authServiceOrigin`（HTTPS origin 必填，
  `NOTIFICATION_INGRESS_SERVICE_AUTH_AND_IDEMPOTENCY_V1` 已冻结）与
  `agent-credential-provisioning` 的 `auth-client.js#normalizeOrigin`
  （HTTPS-only）**不在本 Spec scope**，本 Spec 不修改、不放宽、不统一它们
  （其与生产 loopback 事实的已知张力记录为 OQ-001）。
- **业务 target origin 面**：`targets.js` 的 `allowedOrigin`
  （svc-forum/svc-workflow/svc-okr，当前同为 `http://127.0.0.1:<port>`）
  不在本 Spec scope——那是 target registry 的数据面，非 token endpoint
  配置面（OQ-002）。
- **TLS/mTLS、证书校验、任何新传输安全体系**：HTTPS 形态沿用运行时默认
  证书校验，本 Spec 不新增任何 TLS 配置面。
- **错误信封变化**：不新增任何 transport 错误码；校验失败以**既有**失败
  类别 surface（见 CTR-ORI-005），`AGENT_CORE_WORKFLOW_BROKER_ERROR_PRESERVATION_V1`
  冻结的错误表/信封/闭包零触碰。
- production deploy / restart / 任何生产变更
  （`production_apply_authority = none`）。
- `packages/broker` 之外的任何产品代码（compose.js / gateway.js /
  index.js 预期零改动，见 §10 闭包说明）。

## 3. Authority and dependencies

`governed_by`（均已 accepted，本地权威；按约束强度排序）：

- `AGENT_CORE_WORKFLOW_BROKER_ERROR_PRESERVATION_V1`（accepted 2026-08-27，
  PR #68）：Broker generic HTTP transport 的错误信封（code/status/sanitized
  detail/requestId）、fail-closed code resolution、分页校验与
  9-file 实现闭包。**本 Spec 与它的关系**：本 Spec 冻结的 origin 校验失败
  必须落进它已冻结的失败类别（token endpoint 失败类），不新增 wire 错误码、
  不触碰其闭包文件之外新增改动的语义（transport.js 本在其闭包内）。
- `AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1`（accepted）：冻结
  credential/gateway/token 的层归属（credential 存在性 -> Broker gateway；
  能否 mint -> auth-service token endpoint；能否执行业务 -> downstream）与
  trusted gateway 模型（child 不持凭据）。**本 Spec 与它的关系**：回环
  HTTP 例外零改变层归属与凭据边界；CTR-ORI-007 逐项重申其不变量。

同域既有 accepted Specs（能力面，均经由本 transport 执行，本 Spec 不触碰
其能力合同）：`AGENT_CORE_WORKFLOW_GLOBAL_INSTANCES_CAPABILITY_V2`、
`AGENT_CORE_WORKFLOW_DOMAIN_INSTANCES_BROKER_V1`、
`AGENT_CORE_WORKFLOW_DOMAIN_INSTANCES_PAGINATION_V2`、
`AGENT_CORE_WORKFLOW_ASSIGNEE_TRANSITION_CAPABILITY_V1`、
`AGENT_CORE_FORUM_MODERATION_CAPABILITIES_V2`、
`AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V1`（其 compose 侧 `assertGrant`
 直调 `requestAccessToken`，见 STATE-004——这正是校验落点选在原语层的
 直接原因）。

外部权威：无（auth-service 仓库侧不受本 Spec 约束；token endpoint 契约
`/oauth/token` + `client_credentials` 是既有事实，本 Spec 只约束 client 侧
origin 配置形态）。

## 4. Current State

- `STATE-001` — Broker plugin 默认 token endpoint origin 已是回环 HTTP 明文。
  `packages/broker/src/index.js:86`
  `DEFAULT_AUTH_SERVICE_ORIGIN = 'http://127.0.0.1:4001'`；
  `Config.authServiceOrigin = z.string().default(...)`（`index.js:103`）
  **无任何形态校验**。
  As of: github/main `e2e1e22`（authoring base）。Basis: OBS-001。
- `STATE-002` — origin 以字符串拼接进入 token fetch：
  `requestAccessToken`（`transport.js:134`）在 `transport.js:150`
  `` fetchImpl(`${authServiceOrigin}${TOKEN_ENDPOINT_PATH}`) ``，
  `TOKEN_ENDPOINT_PATH = '/oauth/token'`（`transport.js:66`）。fetch init
  **未设置 `redirect`**——Node/undici 默认 `follow`。Basis: OBS-001。
- `STATE-003` — `authServiceOrigin` 的三条 wiring seam 全部汇入同一原语：
  gateway transport（`createHttpTransport({ ..., authServiceOrigin })`，
  `gateway.js:140`）、gateway LOCAL capability grant check
  （`requestAccessToken({ credential, authServiceOrigin, ... })`，
  `gateway.js:235` 附近）、plugin Config（`index.js:153,182`）。
  As of: github/main `e2e1e22`。Basis: OBS-001。
- `STATE-004` — control-plane 侧存在**第四路直调**：production-runtime
  self-service scheduler 的 `assertGrant` 直接调用
  `requestAccessToken({ credential, authServiceOrigin:
  opts.broker?.authServiceOrigin ?? process.env.BROKER_AUTH_ORIGIN, ... })`
  （`compose.js:367,374`），**不经过** `createBrokerGateway`。
  As of: github/main `e2e1e22`。Basis: OBS-001。
- `STATE-005` — 生产值实证：生产 broker 的 auth-service origin =
  `http://127.0.0.1:4001`（`BROKER_AUTH_ORIGIN`）。
  Environment: 生产 control-plane。Observed: 2026-08-30（authoring 轮
  证据引用）。Basis: OBS-002（`docs/investigations/test-agent-feishu-product-semantics-v1.md:88`
  的生产 wiring 实证 + `docs/evidence/account-recovery-phase-a-20260823/delivery.md`
  的生产事实引用）。
- `STATE-006` — 姊妹消费者各自的 origin 契约（不受本 Spec 治理）：
  `notification-ingress` 要求 HTTPS origin（accepted Spec 冻结，
  `auth.js:218-220` 强制）；
  `agent-credential-provisioning` 的 `normalizeOrigin`（`auth-client.js:11-22`）
  强制 `https:` + `pathname === '/'` + 无 search/hash（未查 userinfo）。
  As of: github/main `e2e1e22`。Basis: OBS-003。
- `STATE-007` — 本 Spec authoring 时点，`docs/specs/` 无任何 accepted 或
  proposed Spec 覆盖 broker `authServiceOrigin` 的形态契约
  （`docs/reports/broker-transport-v1.md` 是描述性报告，governance 明确
  Report ≠ implementation authority）。Basis: OBS-004。

## 5. Observations

- `OBS-001` — Subject: broker token endpoint wiring 源码。
  Source revision: github/main `e2e1e22`。Method: 行级源码核对
  （`index.js:86,103,153,182`；`transport.js:66,134,150`；
  `gateway.js:66,140,235`；`compose.js:304,367,374`）。
  Result: 无 origin 形态校验；token fetch 无 redirect 策略；
  所有调用路径汇聚于 `requestAccessToken`。
  Observed at: 2026-08-30。
- `OBS-002` — Subject: 生产 `BROKER_AUTH_ORIGIN` 值。
  Source: `docs/investigations/test-agent-feishu-product-semantics-v1.md:88`
  （生产 wiring 实证 `BROKER_AUTH_ORIGIN=http://127.0.0.1:4001`）；
  `docs/evidence/account-recovery-phase-a-20260823/delivery.md`
  （"production auth-service is http://127.0.0.1:4001 per BROKER_AUTH_ORIGIN"）。
  Result: 生产值 = `http://127.0.0.1:4001`。Observed at: 2026-08-30
  （引用既有 evidence，authoring 轮零生产访问）。
- `OBS-003` — Subject: 同仓库既有 origin 校验先例。
  Source revision: github/main `e2e1e22`
  （`agent-credential-provisioning/src/auth-client.js:11-22`；
  `notification-ingress/src/auth.js:160-252` 及其 accepted Spec）。
  Result: 既有先例均为 HTTPS-only，且都要求 path `/`、无 query/hash；
  provisioning 侧因 HTTPS-only 与生产 loopback 事实的张力，在
  account-recovery 轮被迫使用 "localhost HTTP adapter for the injected
  auth seam" workaround（evidence 原文）。Observed at: 2026-08-30。
- `OBS-004` — Subject: `docs/specs/` 全量扫描（authoring 轮）。
  Method: 对 github/main `e2e1e22` 的 47 个 spec 文件 grep
  `authServiceOrigin`。Result: 唯一命中 =
  `NOTIFICATION_INGRESS_SERVICE_AUTH_AND_IDEMPOTENCY_V1`（ingress 自己的
  auth.json 契约）；broker transport 的 origin 形态无任何 Spec 覆盖。
  Observed at: 2026-08-30。
- `OBS-005` — Subject: WHATWG URL 解析行为（Node v25.6.1，2026-08-30
  实测）。Result（对 §10 向量表有直接影响的事实）：
  (a) 非规范 IPv4 写法 `127.1`、`127.000.000.001`、`2130706433`、
  `0x7f.0.0.1`、`127.0.0.1.`（尾点）解析后 **hostname 均规范化为
  `127.0.0.1`**，故只检查 parsed hostname 会错误接受别名形态；
  (b) `[::1]` 的 hostname 序列化为 `'[::1]'`（含方括号），与
  `'127.0.0.1'` 不相等；
  (c) 端口 `0` 可被 URL 解析（`port === '0'`），省略端口时
  `port === ''`，而显式 HTTP 默认端口 `:80` 也会被规范化为
  `port === ''`，故必须从原始 authority 区分「未写端口」与显式 `:80`；
  (d) 空 query `?`、空 fragment `#` 与 dot-segment path 可能在 parsed
  `search` / `hash` / `pathname` 叶字段中丢失其原始形态，故这些禁止项也
  必须以原始输入 presence/path 检查，不能只检查规范化后的叶字段。
  Basis: authoring 轮本地 node 实测（只读，零网络）。

## 6. Claims and assumptions

- `CLM-001` — `requestAccessToken` 是（且在本 Spec 生命期内保持）所有
  auth-service token mint 的单一原语：gateway transport、gateway LOCAL
  grant check、compose `assertGrant` 三路均经它（STATE-003/004）。若未来
  出现第四路绕过该原语直 fetch token endpoint，属对本 Spec 的违例，
  需要新 authority。
- `CLM-002` — 生产 auth-service 仅监听 `127.0.0.1:4001`，明文 HTTP 仅在
  回环接口可达（STATE-005 及 auth-service 部署事实）。回环明文的残余
  风险面 = 同主机进程窃听，已被既有生产部署接受（与三业务 target 的
  回环 HTTP 同判）。
- `CLM-003` — `new URL()`（WHATWG）解析失败（如无 scheme 的
  `127.0.0.1:4001`）抛 `TypeError`，可作 parse-fail 拒绝路径（OBS-005）。
- `CLM-004` — 假设：本 Spec accept 前，不会有任何 accepted Spec 与本
  契约冲突（OBS-004 的 authority gate + `governed_by` 两父权威的错误
  信封/层归属语义与 CTR-ORI-005/007 兼容）。

## 7. Evidence relations

- `EVD-001` — STATE-001..004 / OBS-001 ← github/main `e2e1e22` 源码行级
  核对（authoring 轮，只读）。
- `EVD-002` — STATE-005 / OBS-002 ←
  `docs/investigations/test-agent-feishu-product-semantics-v1.md:88`；
  `docs/evidence/account-recovery-phase-a-20260823/delivery.md`（管理
  授权段）。两者均为既有已入库 evidence，authoring 轮零生产访问。
- `EVD-003` — STATE-006 / OBS-003 ← github/main `e2e1e22`
  `auth-client.js:11-22`、`auth.js:218-220` + accepted
  `NOTIFICATION_INGRESS_SERVICE_AUTH_AND_IDEMPOTENCY_V1`。
- `EVD-004` — STATE-007 / OBS-004 ← authoring 轮对 github/main `e2e1e22`
  `docs/specs/`（47 文件）的 grep authority gate。
- `EVD-005` — OBS-005 ← authoring 轮 Node v25.6.1 本地 URL 解析实测
  （§5 向量清单，零网络）。

## 8. Decisions

- `DEC-001`（HTTP 校验语义 = 原始 authority 字面量先验，而非 parsed
  hostname 等值）——在调用 WHATWG `new URL()` **之前**，从原始输入中
  定位 `http://` 后、首个 `/` / `?` / `#` 前的 authority，并要求其形态
  恰为 `127.0.0.1:<decimal-port>`：无 `@`，hostname 逐字符等于
  `127.0.0.1`，无尾点、无 IPv6 bracket、无别名或非规范 IPv4。故
  `127.1`、`127.000.000.001`、`2130706433`、`0x7f.0.0.1`、
  `127.0.0.1.`、`localhost` 与全部 IPv6 均**拒绝**；不得先让 WHATWG
  规范化后再作 host allowlist 判定（OBS-005(a)）。通过原始检查后仍须
  WHATWG parse 并满足其余合同；判定永不依赖 DNS。
- `DEC-002`（回环形态要求原始 authority 中的显式端口，范围
  1..65535）——必须在 WHATWG parse 前从原始 authority 证明冒号和端口
  数字真实存在，以区分「未写端口」与「显式 `:80`」；两者在 parsed
  `port` 中都可能呈现 `''`（OBS-005(c)），但前者拒绝、后者接受。端口
  只允许 ASCII 十进制数字，数值范围 `1..65535`；`0`、超范围、空端口、
  带符号或非十进制写法均拒绝。HTTPS 形态端口可选（省略 = 443）。
- `DEC-003`（3xx = DENIAL，绝不跟随）——token 请求携带
  `Authorization: Basic base64(clientId:clientSecret)`；若跟随重定向，
  该凭据会被重新发给**任意第二个 origin**（配置者可控的凭据外送面）。
  禁令对**两种允许形态一律适用**（回环 HTTPS 也可能被重定向到远程）。
- `DEC-004`(校验落点 = `requestAccessToken` 原语层，而非 gateway 构造层)——
  STATE-004 证明存在绕过 gateway 的直调路径（compose `assertGrant`）；
  只有把校验放进所有调用方共享的原语，契约才能全覆盖。wiring 层
  （gateway 构造时）更早的 fail-loud 校验**允许**（permitted, not
  required）作为体验优化，但不满足本契约的充分性要求。
- `DEC-005`（不新增 wire 错误码）——校验失败在 token endpoint 语义层
  属配置错误，与 token endpoint 不可达同类：原语抛错（现有
  `transport_failure` 类路径 / gateway LOCAL `access_denied` 路径 /
  compose `assertGrant` catch-false 路径），错误表零变化，
  `AGENT_CORE_WORKFLOW_BROKER_ERROR_PRESERVATION_V1` 闭包与信封不触碰。
- `DEC-006`（生产值冻结为 plugin 默认值 = 生产 env 值 =
  `http://127.0.0.1:4001`）——三处 seam 已一致（STATE-001/005）；冻结
  后任何一处改为其他值都需要新的 authority transaction（CTR-ORI-008）。
- `DEC-007`（不统一姊妹消费者）——ingress（HTTPS 契约）与 provisioning
  （HTTPS-only）的 origin 契约维持各自治理；provisioning 侧与生产
  loopback 事实的张力（OBS-003）是独立问题（OQ-001），本 Spec 只给
  broker 侧立法，不为其他 package 预设答案。
- `DEC-008`（`targets.js` 业务 origin 面排除在外）——target registry 的
  `allowedOrigin` 是**可信数据**（模型不可控、targetId 间接引用），与
  token endpoint 的**配置 seam** 属不同信任面；回环例外若要推广到
  target registry，需独立评估（OQ-002）。本 Spec 零改动该面。

## 9. Contracts

以下合同在 accepted + `implementation_authority: contracts` 后生效；
任何实现轮必须逐条满足，审计轮逐条复核。

- `CTR-ORI-001`（形态白名单与检查顺序）——校验必须先检查原始字符串，
  再调用 WHATWG URL（Node `new URL()`）；不得用 WHATWG 规范化结果替代
  CTR-ORI-002/003/004 的原始形态检查。原始检查通过后，输入仍必须能被
  WHATWG parse，且 parsed `protocol ∈ {'http:', 'https:'}`；任何其他
  scheme（含解析失败）非法。不满足 HTTP 原始字面量白名单的 origin 必须
  为 HTTPS。
- `CTR-ORI-002`（原始 HTTP authority host 精确为 127.0.0.1）——对原始
  scheme token 为 HTTP（ASCII 大小写不敏感）的输入，在 WHATWG parse
  **之前**提取原始 authority；authority 必须恰由 host、一个端口分隔冒号
  和端口组成，不得含 `@`。其中 host 必须逐字符等于 `127.0.0.1`。
  **禁止**：`127.1`、`127.000.000.001`、`2130706433`、
  `0x7f.0.0.1`、`127.0.0.1.`、`localhost`、任何 IPv6（含 `[::1]`）、
  `0.0.0.0`、任何域名及任何其他 IP（含全部私网/局域网段）。HTTPS
  形态的 host 遵循标准 URL host 规则，本层不另设 host allowlist。
- `CTR-ORI-003`（原始 path/query/hash + userinfo，对两种形态一律适用）——
  原始 authority 后的 path 只允许**省略**或恰为 `/`；任何其他 path
  均非法，尤其禁止 `/.`、`/./`、`/..`、`/../`、`/a/../` 及其 percent-
  encoded dot-segment 等会被 WHATWG 消解/规范化的形态。原始输入中不得
  出现 query delimiter `?` 或 fragment delimiter `#`，无论其后内容为空
  或非空；因此空 query `...?` 与空 fragment `...#` 也必须拒绝。原始
  authority 不得含 userinfo，且 parsed `username === '' && password === ''`。
  违反任一项即非法（token endpoint 路径是代码常量 `/oauth/token`）。
- `CTR-ORI-004`（端口）——HTTP 回环形态必须在原始 authority 中携带
  **显式 ASCII 十进制端口**，且数值 `1..65535`；必须基于原始 authority
  区分省略端口与显式 `:80`，即省略非法、显式 `:80` 合法，即使 WHATWG
  对两者都可能给出 parsed `port === ''`。空端口、`0`、`65536`、带符号
  或非十进制端口均非法。HTTPS 形态端口可选（省略 = 443）。
- `CTR-ORI-005`（校验落点与失败模式）——形态校验的**强制**落点是
  `requestAccessToken`（DEC-004；覆盖 gateway transport / gateway
  LOCAL grant check / compose `assertGrant` 全部调用方）。非法 origin
  必须：(a) 在**任何网络尝试之前**抛错（断言 `fetch` 调用数 = 0）；
  (b) fail-closed，绝不静默回退到 `DEFAULT_AUTH_SERVICE_ORIGIN` 或任何
  其他值；(c) 以既有失败类别 surface（DEC-005），不新增 wire 错误码。
  允许（非要求）gateway/Config wiring 层更早的 fail-loud 校验。
- `CTR-ORI-006`（禁止重定向）——token endpoint 请求必须以不跟随
  redirect 的方式发出（fetch `redirect: 'error'` 或等价 fail-closed
  处理）。任何 3xx（含 301/302/303/307/308，无论 `Location` 指向）
  一律按 token endpoint 失败处理（DENIAL），`Authorization: Basic`
  凭据绝不被发往第二个 origin（DEC-003）。
- `CTR-ORI-007`（不绕过鉴权/token 校验）——回环 HTTP 例外**仅**改变
  token endpoint 请求这一段的传输加密要求。以下不变量逐项保持，任何
  实现不得因 origin 形态放宽：
  (a) credential seam fail-closed（无凭据 = `credential_unavailable`，
  绝无匿名请求）；
  (b) token 只经 `client_credentials` + `Basic(clientId:clientSecret)`
  换取，凭据只来自 trusted seam/store；
  (c) `resource` / `scope` 只来自可信 manifest/target registry，模型
  参数永不影响；
  (d) downstream 请求必须携带 Bearer token（沿用既有 pin 面）；
  (e) 401 重试策略不变（GET 或 `idempotencyKey: true` 写请求限一次）；
  (f) LOCAL capability 的 grant check 语义不变；
  (g) 本地不做任何授权判断/复制/缓存（授权权威 =
  auth-service + downstream，`AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1`
  层归属不变）。
- `CTR-ORI-008`（生产值冻结）——`PRODUCTION_AUTH_SERVICE_ORIGIN =
  'http://127.0.0.1:4001'`。plugin 默认值
  （`DEFAULT_AUTH_SERVICE_ORIGIN`）、生产 env seam（`BROKER_AUTH_ORIGIN`）
  与 compose seam（`opts.broker?.authServiceOrigin`）的生效值必须等于
  冻结值；把任何一处改为其他值（即使新值合法）属于生产配置变更，
  需要新的 authority transaction，本 Spec 不授权。
- `CTR-ORI-009`（实现闭包预期）——见 §10 的 3-file 预期闭包；
  `EXTRA_IMPLEMENTATION_FILE_COUNT = 0` 语义沿用既有 Spec 惯例
  （超出闭包的改动不在授权范围）。

## 10. Acceptance

### 10.1 预期实现闭包（authoring 冻结，实现轮验证）

```text
M packages/broker/src/transport.js            （origin 校验 + redirect 禁令；单一原语层）
M packages/broker/test/transport.test.js      （§10.2/10.3 向量与 redirect 断言）
M packages/broker/test/gateway.test.js        （gateway 路径 e2e：非法 origin 零网络；生产值放行）
```

`index.js` / `gateway.js` / `compose.js` 预期**零改动**（校验在原语层即可
全覆盖，DEC-004；wiring 层 fail-loud 属允许项，若实现选择增加则闭包相应
扩展并在实现 PR 中说明）。闭包成员行的任何偏差在实现轮评审中裁决。

### 10.2 冻结 reject 向量表（每项：校验失败 + `fetch` 调用数 = 0）

| # | 输入 | 拒绝依据 |
|---|---|---|
| R1 | `http://127.1:4001/` | 原始 HTTP host 不是逐字符 `127.0.0.1`（CTR-ORI-002） |
| R2 | `http://2130706433:4001/` | 整数 IPv4 alias（CTR-ORI-002） |
| R3 | `http://0x7f.0.0.1:4001/` | 十六进制 IPv4 alias（CTR-ORI-002） |
| R4 | `http://127.000.000.001:4001/` | 非规范 IPv4 alias（CTR-ORI-002） |
| R5 | `http://127.0.0.1.:4001/` | 尾点 host（CTR-ORI-002） |
| R6 | `http://localhost:4001/` | hostname `localhost` 非允许字面量（CTR-ORI-002） |
| R7 | `http://0.0.0.0:4001/` | 非允许 IP 字面量（CTR-ORI-002） |
| R8 | `http://[::1]:4001/` | IPv6 回环（CTR-ORI-002） |
| R9 | `http://[2001:db8::1]:4001/` | IPv6 非回环（CTR-ORI-002） |
| R10 | `http://192.168.1.10:4001/` | 局域网段明文（CTR-ORI-002） |
| R11 | `http://10.0.0.5:4001/` | 私网段明文（CTR-ORI-002） |
| R12 | `http://172.16.0.5:4001/` | 私网段明文（CTR-ORI-002） |
| R13 | `http://auth.internal:4001/` | 域名明文（CTR-ORI-002） |
| R14 | `http://127.0.0.1:4001/prefix` | 原始 path 非 empty 或 `/`（CTR-ORI-003） |
| R15 | `http://127.0.0.1:4001/./` | dot-segment path（CTR-ORI-003） |
| R16 | `http://127.0.0.1:4001/a/../` | 可规范化为根的 dot-segment path（CTR-ORI-003） |
| R17 | `http://127.0.0.1:4001/?audience=x` | 非空 query（CTR-ORI-003） |
| R18 | `http://127.0.0.1:4001/?` | 空 query delimiter 仍存在（CTR-ORI-003） |
| R19 | `http://127.0.0.1:4001/#frag` | 非空 fragment（CTR-ORI-003） |
| R20 | `http://127.0.0.1:4001/#` | 空 fragment delimiter 仍存在（CTR-ORI-003） |
| R21 | `http://user:secret@127.0.0.1:4001/` | userinfo 存在（CTR-ORI-002/003） |
| R22 | `http://127.0.0.1` | HTTP 形态省略端口（CTR-ORI-004） |
| R23 | `http://127.0.0.1:0/` | 端口 0（CTR-ORI-004） |
| R24 | `http://127.0.0.1:65536/` | 端口超范围（CTR-ORI-004） |
| R25 | `ftp://127.0.0.1:4001/` | scheme ∉ {http, https}（CTR-ORI-001） |
| R26 | `127.0.0.1:4001`（无 scheme） | URL 解析失败（CTR-ORI-001 / CLM-003） |
| R27 | `https://auth.example.com/path` | HTTPS 但 path 非 empty 或 `/`（CTR-ORI-003） |
| R28 | `https://auth.example.com/./` | HTTPS dot-segment path（CTR-ORI-003） |
| R29 | `https://user@auth.example.com/` | HTTPS 但 userinfo 存在（CTR-ORI-003） |
| R30 | `https://auth.example.com/?x=1` | HTTPS 非空 query（CTR-ORI-003） |
| R31 | `https://auth.example.com/?` | HTTPS 空 query（CTR-ORI-003） |
| R32 | `https://auth.example.com/#frag` | HTTPS 非空 fragment（CTR-ORI-003） |
| R33 | `https://auth.example.com/#` | HTTPS 空 fragment（CTR-ORI-003） |

### 10.3 冻结 accept 向量表

| # | 输入 | 说明 |
|---|---|---|
| A1 | `http://127.0.0.1:4001` | 冻结生产值（CTR-ORI-008） |
| A2 | `http://127.0.0.1:4001/` | 冻结生产值的显式根路径等价形态 |
| A3 | `http://127.0.0.1:80/` | 显式 `:80`；必须与省略端口区分（DEC-002） |
| A4 | `http://127.0.0.1:8443/` | 任意显式合法端口 |
| A5 | `https://auth.example.com/` | 非回环 HTTPS（CTR-ORI-001） |
| A6 | `https://auth.example.com:8443/` | HTTPS + 显式端口 |
| A7 | `https://127.0.0.1:9443/` | 回环上的 HTTPS（允许；严于要求） |

accept 判定的运行时断言：token 请求 URL 恰有一个 `/oauth/token` path
分隔，无双重斜杠、无残留组件。

### 10.4 验收项（ACC）

- `ACC-ORI-001`（reject 全表 + 零网络）——§10.2 R1..R33 逐项：校验
  抛错且注入的 `fetchImpl` 调用数 = 0；尤其 alias host、空 query/
  fragment、dot-segment 与省略端口不得因 WHATWG 规范化而漏过。
- `ACC-ORI-002`（accept 全表 + 精确 URL）——§10.3 A1..A7 逐项：token
  请求发出且最终 URL 恰有一个 `/oauth/token` path 分隔。
- `ACC-ORI-003`(redirect 禁令)——token endpoint 以 301/302/307/308
  （`Location` 指向攻击者 origin）响应时：DENIAL；`fetchImpl` 以
  `redirect: 'error'`（或等价）调用；不出现第二次请求；Basic 凭据
  未发往 `Location` 目标。
- `ACC-ORI-004`(鉴权零绕过非回归)——既有测试语义不回退：
  `credential_unavailable` fail-closed；401 重试策略（GET / IK 写）
  不变；错误表无新增码；既有 broker 测试套件全绿（实现轮在
  authoring 后的 fresh main 上全量跑）。
- `ACC-ORI-005`(生产值守卫)——断言 `DEFAULT_AUTH_SERVICE_ORIGIN ===
  'http://127.0.0.1:4001'` 且通过校验（回归守卫，防默认值漂移）。

### 10.5 本轮（authoring）验收

本 PR 自身 = DOCS ONLY：恰好一个新增文件
（`docs/specs/AGENT_CORE_BROKER_AUTH_SERVICE_ORIGIN_V1.md`），
`PRODUCT_CODE_CHANGE = NONE`；`PRODUCTION_CHANGE = NONE`；不实现、
不接受、不 merge（Draft）。独立审计（NEXT_TASK = 回环 审计）产生
VERDICT 后，由 Owner 走 acceptance 事务。

## 11. Alternatives and disposition

- `ALT-001`（HTTPS-only，无回环例外——与 provisioning `normalizeOrigin`
  同判）——拒绝为**本 Spec 的基线**：生产 auth-service 事实上以
  `http://127.0.0.1:4001` 部署（STATE-005），HTTPS-only 会使当前唯一
  生产 wiring 非法；provisioning 侧因此被迫引入 adapter workaround
  （OBS-003），不应复制该张力。回环例外把明文面收敛到「精确一个
  字面量地址 + 显式端口 + 根路径」，是可机械验收的最小放宽。
- `ALT-002`（允许 `localhost` 与 `127.0.0.1` 并列）——拒绝：`localhost`
  依赖名字解析（hosts 文件/解析器可把它指向 `::1` 或非回环地址），
  违反「host 必须精确为 127.0.0.1」的任务约束；字面量判定不依赖任何
  解析（DEC-001）。
- `ALT-003`（允许 `[::1]` 作为回环）——拒绝：任务冻结 host 精确为
  `127.0.0.1`；IPv6 回环是不同地址族，且生产部署不使用它。若未来
  需要，走新 authority。
- `ALT-004`（校验放 gateway 构造层，启动即 fail-loud）——作为**唯一**
  校验点被拒绝（STATE-004 的 compose 直调路径会绕过）；作为**补充**
  体验优化被允许（CTR-ORI-005 允许项）。
- `ALT-005`（新增 `invalid_auth_origin` wire 错误码）——拒绝：错误表
  变化会触碰 ERROR_PRESERVATION 冻结面与全部 manifest 错误表；配置
  错误在 mint 语义层与 endpoint 不可达同类（DEC-005），不值得扩表。
- `ALT-006`(统一全仓 authServiceOrigin 校验器为共享模块)——拒绝于本
  Spec：三消费者治理边界不同（DEC-007）；统一属重构，需独立 evidence
  与 authority（OQ-001）。

## 12. Migration, compatibility, and rollback

- **兼容性**：冻结生产值 `http://127.0.0.1:4001` 即当前默认值与生产
  env 值（STATE-001/005）——accept 后合法部署面零变化；唯一行为变化
  是非法形态从「静默产生任意 URL 的 fetch」变为「零网络 + fail-closed
  抛错」，与全部现行合法配置兼容。
- **redirect 行为变化**：从默认 `follow` 变为 `error`。当前生产
  auth-service 对 `/oauth/token` 不发 3xx（既有 e2e/fixture 全绿为证），
  该收紧是纯防御；若上游未来引入合法 3xx，属新契约，需新 authority。
- **回滚**：实现若需回滚，回滚 commit 即可恢复原行为（无数据迁移、
  无配置迁移）；回滚不违反本 Spec 的存在（Spec 是 authority，实现
  状态独立记录）。
- **部署**：`production_apply_authority = none`——部署/重启不在本 Spec
  授权内。

## 13. Open questions

- `OQ-001` — 姊妹消费者统一问题：provisioning 的 HTTPS-only（及其
  adapter workaround，OBS-003）与 ingress 的 HTTPS 契约是否应引入与
  本 Spec 相同的回环例外？属独立 package 的 authority，本 Spec 不预设
  答案。
- `OQ-002` — target registry（`targets.js` `allowedOrigin`，当前三
  target 均回环 HTTP）是否应套用同一形态契约？属可信数据面的独立
  评估（DEC-008）。
- `OQ-003` — gateway/Config wiring 层的启动期 fail-loud 校验（允许项）
  是否值得在某实现轮加做（更早暴露配置错误 vs 闭包最小化的权衡）？
