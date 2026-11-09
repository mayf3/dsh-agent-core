独立 affected-delta 审查 **PASS**；B654-001 已闭合。未发现新 Blocker、SPEC_GAP 或断言放宽。

```text
schema_version = 2
SPEC_GOVERNANCE_MODE = REVIEW
REVIEW_KIND = AFFECTED_CONTRACT
REVIEW_SCOPE = DELTA
REVIEWER_ID = /root/r7_semantic_review
AUTHOR_INDEPENDENCE = PASS
REVIEW_TARGET = working-tree delta identified by SHA256 below
REVIEW_TARGET_PARENT_HEAD = 84b1e612aa31f4caa5a0de0ca39e3abca545bcef
BASE_HEAD = 2d8ce9d0af6a1ffcb3c8d3bdd9364635e9ae8648
CURRENT_BASE_HEAD = same local origin/main; no reviewer network request
AUTHORITY_ACTION = REUSE
ASSURANCE_LEVEL = DURABLE
AUTHORITY_REVIEW = PASS
PRIMITIVE_BOUNDARY_REVIEW = PASS
CONTRACT_REVIEW = PASS
ACCEPTANCE_COVERAGE_REVIEW = PASS
MANDATE_SCOPE_REVIEW = PASS
EVIDENCE_REVIEWABILITY = PASS
BASE_IMPACT = NONE
BLOCKERS = 0
SPEC_GAPS = 0
FOLLOW_UPS = 0
TOOLING_DEBT = 0
MERGE_READY = NOT_APPLICABLE (not authorized)
OPERATION_ALLOWED = NO
NEXT_ACTION = CONTINUE authorized serial delivery; final-Head recheck remains
```

审查依据为 accepted-in-base WEC V3 `CTR-WEC1-001/002/003` 与 §4，以及 WAE V3 `CTR-WAE-002/005/006`。两份 governing Spec 当前字节均与 integration base 相同。

本轮产品修复仅给 `inspectProjection` 增加 `result !== null`。未知 instance/visit 的投影继续返回 `null`，因此真实 route 的原有 `404/not_found` 分支重新可达；已知 trace 和 attention 的尾部标注逻辑保持原样。ledger、engine、OwnerLock、admission、identity/CAS、UNKNOWN 逻辑没有本轮修改。

新增测试使用真实 ledger、mount 和 route，四个失败组合与独审一致，保留相同的 `status === 404`、`error.code === 'not_found'` 断言，并增加事件文件哈希保持及禁止 mutation/repair/append 的检查。两个健康对照同样保留。

只读检查作者实际捕获的原文与元数据，逐项核对 raw SHA256、源/测试文件 SHA256 和 TAP 计数：

| 捕获 | 核验结果 |
|---|---|
| RED | rc1，6测/2过/4失败；恰为四个 `200 !== 404` |
| 新回归 GREEN | rc0，6/6；全部404、not_found、事件哈希不变 |
| 原目标 | rc0，8/8 |
| 原诊断全文件 | rc0，11/11 |
| observation-cas | rc0，110/110，包含原104及新增6项 |
| workflow | rc0，316/316 |
| integration | rc0，29/29 |
| broker | rc0，80/80 |
| shutdown/API | rc0，12/12 |

审查绑定：

| 文件 | SHA256 |
|---|---|
| `packages/production-runtime/src/workflow/capability-runtime.js` | `53dbddaa6cdbf140da020515c1a2b45beb7712715f3c4c4624ad65708c576ada` |
| `packages/workflow-execution/test/observation-cas/diagnostic-missing-trace.test.js` | `72e23f26b5adde0a8351db9fd4c684b80d4b347a0db7105e096b4abc15f8bebb` |
| 原 `diagnostic-read.test.js` | `4b29cb5577be6f836becb6ad016216e5d4c189051146368fd6554fbb7f216580` |

RED/GREEN 的新增测试哈希相同，只有 mount 源码由原哈希变为上述修复哈希。原11项测试字节保持不变。

本 reviewer 只做静态阅读、哈希和已执行证据核验；没有运行测试、网络请求、写文件、修改索引或 refs。本 PASS 绑定上述工作树内容，不冒称尚未产生的提交、push、最终 PR HEAD 或生产验收。
