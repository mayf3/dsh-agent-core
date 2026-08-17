---
status: historical
as_of: 2026-08-15
superseded_by: ../../guides/integrations.md
public: PUBLIC
---

> HISTORICAL ENGINEERING RECORD
>
> This document describes the system as of 2026-08-15.
> It is **not** current architecture documentation.
>
> Current documentation: [docs/guides/integrations.md](../../guides/integrations.md)
# Agent Core on DSH — Generic Broker V1

> 本轮把 V0 的 calculator fixture adapter 泛化为真正的「Broker capability → DSH tool」
> 通用适配层。只修改 `packages/broker/` 与本文档。V0 calculator 语义 1:1 保留
>（已验收用例 multiply(6,7)=42 复跑通过）。

---

## 1. 目标与范围

**目标**：让「一个 Agent Core capability（外部 harness 能力宿主的外名）→ 一个模型可见
DSH tool」这条桥变成 manifest 驱动的通用机制。已有能力只用**数据**（manifest）+ **执行代码**
（handler）就能注册为新 tool，无需为每个能力重写注册逻辑。

**本轮范围**（已交付）：

1. Capability manifest schema 与校验（`src/schema.js`，纯函数）；
2. Tool 注册：manifest → ONE DSH tool（`src/registry.js`，`ctx.tools` 依赖收口到注册函数）；
3. 请求/响应/错误映射（`src/mapping.js`，纯函数，直接测），与 V0 语义 1:1；
4. 身份来源内部接口 `resolvePrincipal`（`src/identity.js`，占位实现 + 单一获取点）；
5. calculator 改为 manifest 数据（`src/calculator.manifest.js`），不再硬编码在注册代码里；
6. 通用机制证明：同一注册逻辑用第二个 manifest（echo）能注册出**不同** tool（测试 #6）。

**明确不做**：最终 process credential 注入（不写 spawn、不写凭据文件读写）、Forum/Workflow/OKR
专用 adapter、除 `packages/broker/` 与 `docs/reports/broker-v1.md` 外的任何文件改动。

---

## 2. Capability manifest schema

Manifest 是**纯数据**（JSON 可序列化，无函数）。结构：

```js
{
  id: 'external.calculator',     // wire 能力名，点号命名保留（external.calculator）
  toolName: 'external_calculator', // DSH tool 名下划线语法；缺省 = id 点号→下划线
  name: 'Calculator',            // 展示名（可选）
  description: '...',            // 发给模型的能力描述
  errors: [                      // 能力级错误码表
    { code: 'invalid_arguments', description: '...' },
    { code: 'unsupported_operation', description: '...' },
    { code: 'divide_by_zero', description: '...' },
  ],
  operations: [                  // 至少一个 operation
    {
      name: 'multiply',
      description: '...',
      arguments: { properties: { a: { type: 'number' }, b: { type: 'number' } },
                   required: ['a', 'b'] },   // operation 自身参数 schema
      result: { type: 'number' },            // operation 结果 schema
      errors: ['invalid_arguments'],         // 该 operation 允许的错误码（须在表中声明）
    },
  ],
}
```

校验（`validateManifest`）强制：
- `id`：非空、点号命名的 wire id（`^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$`）——**点号保留**是硬要求；
- `operations` 非空、operation 名唯一且为小写标识符；
- `errors`：code 为小写标识符、无重复；operation 引用的 `errors` 码必须在表内声明（fail-closed 于 schema 层）；
- 参数 schema：`properties` 每项 `type` ∈ 白名单、`required` 是字符串数组。

**重要**：manifest 只描述**契约表面**（名字、schema、错误码、描述），不承载执行逻辑。
真正执行操作的是独立的 **handler 纯函数**（见 §5），按 `capabilityId → operationName` 挂载。
这一步让「manifest 用数据表达」与「calculator 能真正算出 42」同时成立。

---

## 3. 一个 capability → 一个 tool vs 每 operation 一个 tool

**决策：一个 capability → 一个 tool（多 operation 参数分派）。**

理由：

1. **保留 V0 验收形态（硬约束）**：V0 已验收的模型可见形态是
   `external_calculator` + `{operation:'multiply', a:6, b:7}`。一个 capability 一个 tool，
   `operation` 作为必选参数枚举分派，恰好逐字节保留该形态；若改成每 operation 一个 tool，
   模型要调 `external_calculator_multiply`，V0 已验收链路立即不兼容。
2. **匹配旧 external-harness 的能力粒度**：wire 标识是 `external.calculator`（能力级），
   operations 是该能力下的操作枚举——一层映射一层，wire id 与 tool 一一对应，审计/归里自然。
3. **模型侧工具面更小**：N 个 operation 不摊成 N 个 tool，减少模型选择负担；`operation` 的 enum 即引导。
4. **每 operation 的严格 schema 仍在映射层执行**：tool 的粗粒度参数 schema 只是模型提示，
   派发后在 `mapping.invoke` 按该 operation 自己的 `arguments` schema 严格校验，错误码也在那里定。

代价（已知，见 §8）：不同 operation 参数不同时，tool 层参数 schema 取「并集」，共享字段仅当
**所有** operation 都必填时才标 required——粗粒度 schema 由映射层补齐严格性。

---

## 4. 身份接口设计（`resolvePrincipal`）

`src/identity.js` 导出：
- `createIdentityResolver({ source?, injected? })` → 返回 `resolvePrincipal(ctx)` 内部接口；
- 常量 `PRINCIPAL_ENV = 'AGENT_CORE_PRINCIPAL'`。

**柱位实现**（本轮）：`resolvePrincipal` 从进程环境变量 `AGENT_CORE_PRINCIPAL` 读取，缺省回落到
注入的固定值。源代码注释明确写「最终形态 = per-agent 进程凭据注入（方案 B），本轮不实现」。

**单点获取纪律**（三条，含测试断言）：
1. **tool schema 无 principal 字段**：`buildToolDefinition` 生成的参数 schema 只有
   `operation` + capability 自有参数，绝不注入 principal/agentId/credential 字段（测试断言遍历）。
2. **adapter 忽略模型侧身份输入**：`mapping.invoke` 只读 `call.args` 中的业务参数，遇到
   `principalId` 走私字段既不读取也不转发；`unsupported_operation`/`invalid_arguments` 均不看它
   （测试：`{a:6,b:7,principalId:'AGENT_B'}` 仍返回 42）。
3. **身份获取点唯一**：handler 需要 principal 时只经 `resolvePrincipal()`；`invoke` 把
   `deps.resolvePrincipal()` 结果作为 `principal` 传给 handler（测试：注入 spy resolver，断言恰被调用一次、
   值正确传递）。

**指向最终形态**：参考 `docs/TRUST-BOUNDARY-REPORT.md` 与 `docs/investigations/identity-auth.md`——
方案 B（每 Agent 独立 DSH 进程 + spawn 时注入 per-process credential，Broker 侧
credential→principal 绑定）。`resolvePrincipal` 在最终形态绑定进程凭据；本轮既不做 spawn 也不读写凭据文件。
本设计的保证是「设计约束 + 测试断言」，不是运行时强制——跨进程不可伪造性最终由方案 B 的进程隔离提供。

---

## 5. 通用机制 + calculator 数据化

- `src/calculator.manifest.js`：`external.calculator` 的 manifest 数据 + 独立 handler 映射
  （`add/subtract/multiply/divide` 纯函数；其中 `divide` 对 `b===0` 返回 `{errorCode:'divide_by_zero'}`）。
  不再硬编码在注册代码里。
- `src/registry.js`：`buildToolDefinition({manifest,handlers,deps})` 把 manifest/handler 转成
  `defineTool` options；`registerCapability(capability, registry, define)` 用一个 `registry.register`
  回调 + `define` 函数收口对 `ctx.tools.register`/`defineTool` 的全部依赖——**测试不需要真 DSH**。
- `src/index.js` Cordis 壳：`name='broker'`（与 V0 一致，避免破坏已安装 profile；bundle patch 引用的是
  `package.json` 的包名 `@agent-core/broker`，未改）、`inject=['tools']`、`Config={manifests:[...]}`、
  `apply` 遍历 manifests 注册。handler 由 `handlersByCapability`（capabilityId → handlers）提供。

**「将来无需新代码」性质**：Forum / Workflow / OKR 未来只要提供各自的 manifest 数据 + handler 映射
（挂进 `handlersByCapability` 或等价注册 seam），就复用 `schema/mapping/registry/identity` 全套——**不需要
为它们写新的通用机制**。本轮不实现它们本身。

---

## 6. Mapping 语义表（与 V0 1:1）

| 输入/情形 | 映射输出 |
|---|---|
| `operation` 在 manifest 不存在 / handler 缺失 | `{ ok:false, error:{ code:'unsupported_operation' } }` |
| 参数违反该 operation 的 `arguments` schema（缺字段/类型错/enum 越界/非有限数） | `{ ok:false, error:{ code:'invalid_arguments' } }` |
| handler 返回普通值 | `{ ok:true, result:<值> }` |
| handler 返回 `{ errorCode:'divide_by_zero' }` | `{ ok:false, error:{ code:'divide_by_zero' } }`（码经错误码表校验） |
| handler 抛异常 | `{ ok:false, error:{ code:'invalid_arguments' } }`（fail-closed 到已声明码） |
| handler 产生的错误码不在错误码表 | 降级到 fallback → 逐级 fail-closed 到 `invalid_arguments` |

成功信封 `{ok:true,result}`、失败信封 `{ok:false,error:{code}}` 与 V0 完全一致。

---

## 7. 验证结果（node --test，node v25.6.1）

命令：`cd packages/broker && npm test`（即 `node --test`）。**21/21 通过**。

| 验证点 | 用例 | 结果 |
|---|---|---|
| 1. schema 校验 | 合法 calculator 通过并规范化；`toolName` 缺省从 id 派生（点号→下划线） | ✔ |
| 1. schema 校验 | 非对象/null/数字/数组被拒 | ✔ |
| 1. schema 校验 | 缺 operations / operations 空 被拒 | ✔ |
| 1. schema 校验 | 错误码表非法：非小写 code、重复 code、operation 引用未声明 code 全被拒 | ✔ |
| 1. schema 校验 | 参数 schema 非法：非法 `type`、`required` 非字符串数组 被拒 | ✔ |
| 2. V0 回归 | mapping 层直接调用 multiply(6,7)=42 | ✔ |
| 3. error mapping | divide_by_zero / invalid_arguments / unsupported_operation 全映射正确；4 个 operation 结果正确 | ✔ |
| 3. error mapping | 未知错误码 fail-closed 到已声明码；`resolveCode` 降级 | ✔ |
| 4. tool 注册 | 最小 ctx stub：`external_calculator` 的 name/描述/`operation` enum/`a,:b` required 符合预期 | ✔ |
| 5. 身份纪律 | tool 参数 schema 无 principal/agentId/credential 字段（含嵌套） | ✔ |
| 5. 身份纪律 | 参数走私 `principalId` 被忽略，仍返回 42 | ✔ |
| 5. 身份纪律 | mapping 只经注入的 `resolvePrincipal` 获取身份：spy 恰被调用 1 次、值正确传 handler | ✔ |
| 5. 身份纪律 | 占位 resolver：读 env / 回落 injected / 两者皆无 = undefined | ✔ |
| 6. manifest 驱动 | 同一注册逻辑用 echo manifest 注册出 `demo_echo`（不同 name/描述/参数，calculator 字段不泄漏） | ✔ |
| 6. manifest 驱动 | echo 经同一 pipeline 执行返回 `{ok:true,result:{message:'hi'}}` | ✔ |

**端到端复核（独立于单测）**：`plugin.apply(ctxStub)` 实际产出 `external_calculator` ToolDefinition
（编译后 `required=["operation","a","b"]`、enum 正确）；用真实 `@deepseek-ai/dsh-tools` 的 `defineTool`
编译后 `execute({operation:'multiply',a:6,b:7})` → `{ok:true,result:42}`（V0 验收）、
`subtract(100,37)` → `{ok:true,result:63}`（V0 第二条 launcher 验证）。

---

## 8. 已知限制

- **多 capability 的同名 tool 冲突**：manifest `toolName` 若是手工指定可能撞名。当前不加防重；
  生产上应由注册方（配置/加载方）保证全局唯一，或由 registry 在注册前做去重断言（见 §9 未决）。
- **tool 层参数 schema 是「并集 + 全必填才 required」**：不是每个 operation 的精确 schema。
  模型看到的是较宽的粗 schema，严格校验下放到映射层——模型可能被粗 schema 误导去填某 operation
  不用的字段（无害，会被忽略）。
- **身份只有「进程内占位」**：本轮无任何真实凭据语义，抗伪造的跨进程保证完全依赖方案 B（未实现）。
- **handler 抛异常一律 fail-closed 到 `invalid_arguments`**：不区分内部错误码；更细的错误分类后可再扩展。
- **错误码不做国际化**：错误码是稳定标识符，描述文本目前为英文（供模型）；展示层未引入多语言。

---

## 9. 未决问题

1. **多 capability 的 tool 命名冲突**：多个 manifest `toolName` 冲突时由谁、在哪一层做唯一性保证（注册时断言？
   配置层登记表？）尚未定。
2. **动态 manifest 加载**：manifests 目前来自插件 `Config`（静态数组）。将来是按目录热加载 / 运行时 API
   注册 / 由控制面注入，未定。若走热加载，「注册/反注册」生命周期与 DSH tool 的 `register` disposer 如何衔接需设计。
3. **错误码国际化与文案**：manifests 的描述/错误码描述目前硬编码英文。是否允许多语言 manifest、展示层如何取语，
   未定。
4. **handler 注册 seam 的形状**：`handlersByCapability` 是包内静态映射；跨包能力（Forum/Workflow）的 handler
   「注册进 broker」的公共接口形态未定（现在只是规划为「提供 manifest + handler」，无统一运行时契约）。
5. **identity 占位最终替换**：方案 B 落地的 credential 注入、`resolvePrincipal` 绑定逻辑、Broker 侧
   credential→principal ACL 均未实现；占位接口的兼容面未冻结。

---

## 10. 下一步

- 把 Manager 运行/会话面与 capability-host 迁移并进：以同一验收用例在连续部署上稳定复跑 broker tool。
- 落一个「第二个真实能力」的 manifest 样例（非 calculator），验证跨 package 的 handler 注册 seam 并冻结接口。
- 启动方案 B 的最小可运行切片（控制面 spawn per-agent 进程 + 注入凭据 + Broker 侧绑定），让 `resolvePrincipal`
  从占位升级为绑 real credential，并跑 TRUST-BOUNDARY §6 的最小攻击测试。
