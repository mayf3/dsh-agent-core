# RECEIPT — 常设授权总裁定 V1 正式化与控制绑定

记录时间：`2026-11-07T15:10:46.252306+00:00`。PR [#660](https://github.com/mayf3/dsh-agent-core/pull/660)，base `main`，
branch `docs/standing-delegation-v1`，原始读回 `OPEN` / `mergedAt=null`。
本收据时点的远端/接受HEAD为 `0b61ef6911421a43aef77d6620b72cb72dbb6556`；下方保留真实首次交付链。

| 坐标/交付 | 实际值 |
|---|---|
| worktree / authoring base | `/private/tmp/h-delegation-formal` / `24974c720d634b965943e08bfd0862657b9be0e1` |
| current main（读回） | `9df5bd2fdea17f04bcd1762cd6800c350efcf9c3`；只新增#643文档事务，无相关权威冲突 |
| proposed conversion + 索引 | `3f5fb8088e7822ec5bc26d641a07847b34553a50` |
| reviewed HEAD | `3f5fb8088e7822ec5bc26d641a07847b34553a50`；非作者独审 PASS，blocker union `[]` |
| Owner接受事务commit | `0b61ef6911421a43aef77d6620b72cb72dbb6556`；accepted_by `mayf3`，`/root`仅事务执行者 |
| ruling canonical SHA256 | `01cc059c2bf0e0493588f00032ca06eb73e3a0a13cb33f4078996fdccb79dad3` |
| independent review SHA256 | `32286d908375b9da83913ac70bdd3b26dd45f68dcf1a3e64e9a81edc3700bad1` |
| 已执行检查 | 八项逐字/逐项hash、13节、schema、8/8 Contract→Acceptance、lifecycle、18个权威/控制文件及旧索引不变、governance、whitespace；必需命令均rc0 |
| 首次push/PR/create/readback | 全部rc0；原文见下方与完整JSONL |
| 控制/运行事实 | G01实际绑定 NOT_VERIFIED；Auth/任命/运行负向 NOT_EXECUTED；无任何窗口签发 |
| 生产/源码/合并 | 零产品源码、零生产写入；未合并；无Principal/Client/Secret/Grant创建、无任命 |
| 重复Owner审批 | 0；无新增Owner请批或无责任的WAITING_OWNER |

正式 [Spec](docs/specs/AGENT_CORE_STANDING_OPERATIONAL_DELEGATION_V1.md)、
[权威索引](docs/specs/README.md)、[来源与hash](docs/reports/standing-delegation-formal-20261107/source-provenance.json)、
[原文快照](docs/reports/standing-delegation-formal-20261107/owner-ruling.json)、
[非作者独审原文](docs/reports/standing-delegation-formal-20261107/independent-review.md)、
[接受事务](docs/reports/standing-delegation-formal-20261107/acceptance-transaction.md) 已入提交。
`supersedes: []`；总框架与SRA标准发布子机制互补；既有权威均不改义。

## §8控制绑定清单（完整）

坐标：base `24974c720d634b965943e08bfd0862657b9be0e1`；源码 blob/hash 和时间见
[source-provenance](docs/reports/standing-delegation-formal-20261107/source-provenance.json)。原裁定 §3/§4/§5/§8 与
[SRA G01/§1/§6](docs/specs/AGENT_CORE_STANDING_RELEASE_AUTHORIZATION_V1.md) 为要求来源。
独立只读查证者 `/root/control_binding_audit` 未修改候选或调用生产。下面列的是既有控制点、
必须如何核验以及未完成处置；没有实际发起 Auth、window executor 或生产负向试验。

| 控制面 | 控制点 / 实际入口 | 验证方式 / 必需绑定 | 负向拒绝场景 | 本轮实测边界与责任 |
|---|---|---|---|---|
| Auth 唯一 canonical 主体 | 原 §4 指定 `release-captain-agent-core-20261107`；由 Auth 现有合法管理路径建立/精确查询主体，不自行发明创建或按名称查询 API | 取 Auth 权威 UUID、唯一 canonical 名、主体类型/status 与真实创建者收据；正式记录唯一 Principal/Session/跨 session 延续。主体类型和实际 UUID 本轮 UNKNOWN；不把同名字符串当 UUID | 重复名称/歧义、disabled/不存在、只有 uid502/角色名/历史 reviewer session 或自报 UUID、同名多身份；创建身份顺带 Client/Secret/Grant/生产写权限 | 未执行主体创建或线上查询；Auth 合法维护者补齐，身份建立不等于任命 |
| Auth 已有 AGENT Principal 读取（仅在真实类型适用时） | accepted [Exact Resolution V2](docs/specs/AGENT_CORE_EXACT_PRINCIPAL_AGENT_RESOLUTION_V2.md) CTR-EPAR-002..004：`GET /api/v1/agent-principals/<UUID>/agent`；[Reverse V1](docs/specs/AGENT_CORE_AGENT_PRINCIPAL_REVERSE_RESOLUTION_V1.md) CTR-APR-003：`GET /api/v1/directory/agents/{agentId}/principal`；接线 `packages/production-runtime/src/identity/capability-runtime.js:12-70` | 真实 caller 的既有凭据由可信 parent 获取，既定 audience/scope；正反向 exact UUID/agentId 相等、fresh Auth + Definition enabled；无重写/猜名/cache。canonical 名不满足 `agt_...` grammar，绝不能把它当模型工具 agentId 硬塞；仅真实 AGENT 关系可用该读取能力 | 非 AGENT session 套 Agent 映射、错误 caller/token、未知字段、malformed/mismatch/ambiguous/disabled、查询不可用当成功；身份查询成功自动赋签发权 | 通用只读源码可定位，Captain 是否有适用关系和实际运行能力未验证；不追加 Grant 或修复身份 |
| 任命登记、时效、撤销 | SRA §1 原现有台账/PR 的 attributable appointment selector；不存在本任务新建的登记服务 | 查正式 appointment ID/selector、issuer真实权限、本总框架与SRA accepted revision、生效收据、Principal/Session/UID、scope、能力/独立性、validFrom、`validUntil=2026-12-07T16:00:00Z`、撤销历史；每次签发和后续写入边界 fresh 查；续任/替换由不同有权维护者办 | 提名充任命、自授/自续、缺期限/无限期/过期/撤销、主体或 Session 归属不闭合、控制资格欠缺；用本地 JSON 自证授权 | 手工政策；本仓未见 Captain 专用可执行登记/撤销查询器；未完成则不得签发，由原任命责任链补齐 |
| Spec accepted / 接受者与互斥权威（原 §3C/§8） | `.agents/local/README.md:68-76` 与 `:155-162`；`.agents/protocol/SPEC_FORMAT_V0.md` §§2/13/14；`docs/specs/`、索引、独审与接受事务；SRA §6 | 非作者语义审查 exact HEAD；mayf3/明确受托维护者真实权限范围，作者不得自接受新增权限；记录 accepted_by/at、Owner裁定来源hash、reviewed HEAD、final Git对象和独立delta review；main 激活才有效；真正继任原子互斥回链。本总框架 `supersedes: []` 与 SRA 互补、保留两者独立职责 | 作者/事务worker把自己当新增权限接受权威；review PASS 代替接受；accepted-looking未合分支当main；改旧stable ID原义；双active替代权威或把总框架当SRA替身 | 当前 MANUAL_POLICY；semantic/base gate NOT_IMPLEMENTED，branch protection NOT_ENABLED，automatic acceptance NO。schema/transition只验结构，人工有权接受与独立review仍必需，不宣称机器已拦截自接受 |
| 发布入口 authority JSON 必须绑定 SRA G01 | `scripts/fleet-window/window-executor-v5.sh:157` → `window_helper.py:5` → `window_helper_core.py:25-38`；SRA G01（Spec:200） | 在创建有效authority JSON前核同一总委托/SRA accepted revision、生效收据、appointment/revocation selector、issuer/Principal/Session、scope/UTC/独立性、STANDARD_RECOVERABLE判定及完整Mandate最终hash；window/writer/candidate tuple与JSON相同；00前及每个依赖写入边界核现行授权。证据可在原Mandate/Receipt绑定，本文件不臆造新JSON字段或新schema | 未任命/过期/撤销/越界/缺门/错SHA/错执行者、自签或G01材料不能被实际控制消费；仅自写 `G01=PASS`、角色名、hash或旧控制能接收JSON | **G01绑定尚未证明，CONTROL_EFFECTIVE=NOT_VERIFIED**。现 `validate_authority` 仅验必填、writer_uid、固定旧SHA、scopes、UTC；`authority():88-91` 后续仅重核期限，未消费SRA revision/appointment/issuer/revocation/G01。由既有入口/授权控制所有者在合法范围适配并独立负向核验；缺口关闭前 G01=NO，不创建有效委托authority JSON |

原 §5 四事实必须独立读回：`SRA accepted`、`Captain appointed`、`control effective`、
`single Mandate issued`。总框架 accepted 不替代其中任何一个。运行负向试验清单至少覆盖
未任命、越界、过期、撤销、缺门、错候选 SHA、错执行者；本轮全部 `NOT_EXECUTED`，
不是 PASS，也不为制造拒绝证明而在生产尝试。

后续唯一责任链：Auth 维护者负责主体和真实权限来源；原任命责任链负责任命/撤销与期限；
有权维护者与非作者 reviewer 负责 Spec 接受互斥；原发布入口所有者和独立 verifier 负责
G01实际消费/负向资格；有权 Captain 满足全部门后才按单签发。普通缺证按原 §6
保留原因、受影响动作、责任主体、现有授权、最小补证、下次合法触发和恢复关闭条件；
本次没有引入新的Owner审批次数（0），没有把后续执行事实改成新Owner语义审批。


## 全链原始执行记录

[delivery-through-pr-create.jsonl](docs/reports/standing-delegation-formal-20261107/delivery-through-pr-create.jsonl)
逐条保留必需命令 `argv / observed_at_utc / stdout / stderr / rc`，截至上方PR首次读回
全部rc0；[独审原文](docs/reports/standing-delegation-formal-20261107/independent-review.md)
另含审查者实际命令和原始输出。只读发现的无匹配/错误路径和无关目录权限错误已在转换收据
明确区分，未计为成功验收或生产证据；必需事务链无失败/重试。

以下为commit/push/PR和远端首次读回的原始记录（未删改stdout/stderr）：

```jsonl
{"observed_at_utc": "2026-11-07T15:04:45.282542+00:00", "argv": ["git", "commit", "-m", "docs: formalize standing operational delegation proposal and control bindings"], "rc": 0, "stdout": "[docs/standing-delegation-v1 3f5fb808] docs: formalize standing operational delegation proposal and control bindings\n 10 files changed, 668 insertions(+)\n create mode 100644 BRIEF-DELEGATION-FORMAL.md\n create mode 100644 docs/reports/standing-delegation-formal-20261107/authoring-chain.jsonl\n create mode 100644 docs/reports/standing-delegation-formal-20261107/control-bindings.md\n create mode 100644 docs/reports/standing-delegation-formal-20261107/conversion-receipt.md\n create mode 100644 docs/reports/standing-delegation-formal-20261107/owner-ruling.json\n create mode 100644 docs/reports/standing-delegation-formal-20261107/proposed-checks.json\n create mode 100644 docs/reports/standing-delegation-formal-20261107/source-provenance.json\n create mode 100644 docs/reports/standing-delegation-formal-20261107/verification-source.txt\n create mode 100644 docs/specs/AGENT_CORE_STANDING_OPERATIONAL_DELEGATION_V1.md\n", "stderr": ""}
{"observed_at_utc": "2026-11-07T15:04:45.346068+00:00", "argv": ["git", "rev-parse", "HEAD"], "rc": 0, "stdout": "3f5fb8088e7822ec5bc26d641a07847b34553a50\n", "stderr": ""}
{"observed_at_utc": "2026-11-07T15:09:09.107444+00:00", "argv": ["git", "commit", "-m", "docs: record Owner acceptance of standing delegation and reviewed head"], "rc": 0, "stdout": "[docs/standing-delegation-v1 0b61ef69] docs: record Owner acceptance of standing delegation and reviewed head\n 7 files changed, 309 insertions(+), 5 deletions(-)\n create mode 100644 docs/reports/standing-delegation-formal-20261107/acceptance-chain.jsonl\n create mode 100644 docs/reports/standing-delegation-formal-20261107/acceptance-transaction.md\n create mode 100644 docs/reports/standing-delegation-formal-20261107/accepted-checks.json\n create mode 100644 docs/reports/standing-delegation-formal-20261107/independent-review.md\n create mode 100644 docs/reports/standing-delegation-formal-20261107/pre-acceptance-chain.jsonl\n", "stderr": ""}
{"observed_at_utc": "2026-11-07T15:09:09.157103+00:00", "argv": ["git", "rev-parse", "HEAD"], "rc": 0, "stdout": "0b61ef6911421a43aef77d6620b72cb72dbb6556\n", "stderr": ""}
{"observed_at_utc": "2026-11-07T15:09:34.355423+00:00", "argv": ["git", "push", "-u", "origin", "docs/standing-delegation-v1"], "rc": 0, "stdout": "branch 'docs/standing-delegation-v1' set up to track 'origin/docs/standing-delegation-v1'.\n", "stderr": "remote: \nremote: Create a pull request for 'docs/standing-delegation-v1' on GitHub by visiting:        \nremote:      https://github.com/mayf3/dsh-agent-core/pull/new/docs/standing-delegation-v1        \nremote: \nTo https://github.com/mayf3/dsh-agent-core.git\n * [new branch]        docs/standing-delegation-v1 -> docs/standing-delegation-v1\n"}
{"observed_at_utc": "2026-11-07T15:09:36.843272+00:00", "argv": ["gh", "pr", "create", "--repo", "mayf3/dsh-agent-core", "--base", "main", "--head", "docs/standing-delegation-v1", "--title", "docs: formalize Owner standing operational delegation V1 and control bindings", "--body-file", "/private/tmp/delegation-formal-evidence/pr-body.md"], "rc": 0, "stdout": "https://github.com/mayf3/dsh-agent-core/pull/660\n", "stderr": ""}
{"observed_at_utc": "2026-11-07T15:09:50.818923+00:00", "argv": ["gh", "pr", "view", "660", "--repo", "mayf3/dsh-agent-core", "--json", "url,number,state,mergedAt,baseRefName,headRefName,headRefOid,isDraft"], "rc": 0, "stdout": "{\"baseRefName\":\"main\",\"headRefName\":\"docs/standing-delegation-v1\",\"headRefOid\":\"0b61ef6911421a43aef77d6620b72cb72dbb6556\",\"isDraft\":false,\"mergedAt\":null,\"number\":660,\"state\":\"OPEN\",\"url\":\"https://github.com/mayf3/dsh-agent-core/pull/660\"}\n", "stderr": ""}
{"observed_at_utc": "2026-11-07T15:09:51.717634+00:00", "argv": ["git", "ls-remote", "--heads", "origin", "main", "docs/standing-delegation-v1"], "rc": 0, "stdout": "0b61ef6911421a43aef77d6620b72cb72dbb6556\trefs/heads/docs/standing-delegation-v1\n9df5bd2fdea17f04bcd1762cd6800c350efcf9c3\trefs/heads/main\n", "stderr": ""}
```

## 收据提交后的精确最终绑定

本RECEIPT及上述已发生证据将形成一个 receipt-only commit；它不改接受Spec/八项原文或
控制要求。该commit的完整SHA由Git对象读回，再做非作者最终HEAD差量复核、push和PR读回。
这些后续结果不预填为PASS：最终SHA、独立原文、每步原始rc及远端HEAD一致性在
[PR #660最终交付回执](https://github.com/mayf3/dsh-agent-core/pull/660)持久绑定。
这避免Git自引用伪造，也不把receipt-only新SHA当作重审已通过语义的理由。

main激活等待监管独立决定与合并；当前任务明确不合并。实际Auth/任命/G01控制资格仍由
清单中的原责任链补齐，缺证不得签发/启动依赖的危险动作，其他无冲突授权工作不冻结。
后续重复审批次数与无下一合法动作等待责任按原§8继续记录，不以本RECEIPT冒称业务验收。
