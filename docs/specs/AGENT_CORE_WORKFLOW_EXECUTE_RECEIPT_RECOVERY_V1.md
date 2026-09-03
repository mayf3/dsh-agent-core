---
spec_id: AGENT_CORE_WORKFLOW_EXECUTE_RECEIPT_RECOVERY_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
production_apply_authority: none
date: 2026-09-03
type: implementation-spec (one-shot receipt recovery authority proposal; docs-only authoring round)
scope:
  - mayf3/dsh-agent-core
  - workflow_execute unified deployment receipt terminalization only
governed_by:
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
  - AGENT_CORE_WORKFLOW_EXECUTE_UNIFIED_DEPLOYMENT_V1
  - AGENT_CORE_WORKFLOW_TRANSITION_PINNED_HOTFIX_DEPLOYMENT_V1
external_authorities: []
supersedes: []
superseded_by: null
owners:
  - mayf3
---

# AGENT_CORE_WORKFLOW_EXECUTE_RECEIPT_RECOVERY_V1

> **PROPOSED / NOT ACCEPTED.** 本文件只提出一次性的 receipt recovery Authority。
> 本 authoring 轮仅可写本文与索引；不得写 production、不得 sudo、不得修改
> P1/P2、不得重启或回滚 runtime、不得重复 Workflow E2E、不得修改 Grant 或
> credential。只有独立审计 PASS、Owner 对 exact reviewed head 作出接受决定并把
> lifecycle/authority 字段翻转后，才可能进入 artifact 轮。

## 1. Problem statement and new evidence

`AGENT_CORE_WORKFLOW_EXECUTE_UNIFIED_DEPLOYMENT_V1` 已授权并完成的两文件部署在
生产 runtime 上机械读回为 target blobs，真实 normal-user Agent header 已出现唯一
`workflow_execute`（operations 恰为 `create_instance`、`transition`）且 standalone
`workflow_transition` 不存在；同一个 disposable instance 的 create、一次 transition
与 terminal readback 均已 PASS。

唯一未闭合项是原 Owner execution 的 terminal receipt：

- 原 audited wrapper SHA-256 =
  `9aa3dfc0c308a8f95d97be8f043e4644eabd356cd8a54f5b12868ec7bfb9ff21`；
- success path 使用 `failure_cause:($cause|select(length>0))`。当 `$cause=""` 时，
  jq 输出空流但退出 0；后续 `install` 因而发布了零字节文件；
- 原 receipt 路径 =
  `/Users/yanfenma/workspace/deployment-artifacts/workflow-execute-unified-a7e732f/DEPLOYMENT_RECEIPT.json`；
- 该文件 read-only census = `size=0 uid=0 gid=0 mode=0644`，SHA-256 =
  `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`；
- 原 scratch/root stage 已随 wrapper 退出删除；原 `tx_id`、A4 before census、Grant
  before hash、credential before hash 没有独立 durable exact value source。

因此这是 `EVIDENCE_TERMINALIZATION_BLOCKER`，不是 runtime functional blocker；不得
借 recovery 重新执行已经 PASS 的 deployment 或 E2E。

## 2. Authority gap and chosen form

父 Authority 的 CTR-UD-001 只允许两个 runtime 文件，CTR-UD-003 的 post-deploy
proof 全部只读；继承的 CTR-HD-006 固定 deployment execution → deployment audit
链，CTR-HD-008 规定 artifact 改变即使旧 artifact audit 与 Owner authorization
失效。CTR-HD-009 对 root-owned receipt 的要求，不自动授权部署结束后另起一次
root 写事务。

本 Spec 是 narrow child Authority：不修改或 supersede 父 Spec 的产品、部署或 E2E
语义，只新增一个彼此独立、一次性的 `RECEIPT_RECOVERY` Owner transaction。它不能
重建已经丢失的 contemporaneous evidence，只能发布带 provenance 的 supplement。

## 3. Frozen production write surface (CTR-RR-001)

唯一允许的 production-side write 是创建：

```text
/Users/yanfenma/workspace/deployment-artifacts/
  workflow-execute-unified-a7e732f/DEPLOYMENT_RECEIPT_RECOVERY_V1.json
```

- 文件 MUST 为 regular file、无 symlink、无 hardlink，最终 `root:wheel 0644`；
- MUST 使用 root-owned 0700 same-filesystem staging、nonempty gate、`jq -e` schema
  gate、`fsync` 与 atomic rename；
- 原零字节 `DEPLOYMENT_RECEIPT.json` MUST byte-preserved，不得覆盖、删除、移动或
  伪装成 repaired original；
- 除上述新文件外，`PRODUCTION_WRITE_ALLOWLIST = EMPTY`。P1/P2、launchd plist、
  runtime state、Grant、credential、auth-service、svc-workflow 与其他文件均不得写。

## 4. Evidence taxonomy (CTR-RR-002)

Recovery receipt 中每项事实 MUST 显式标记下列一种 provenance：

- `ORIGINAL_DURABLE`：来自原事务期间形成、现在仍可机械定位和校验的 durable
  evidence；
- `CONTROL_FLOW_DERIVED`：由 exact audited wrapper bytes、Owner/root exit status 与
  immutable transcript 推导出的控制流结论；
- `CURRENT_REOBSERVED`：recovery 轮重新只读采集的当前状态；
- `UNKNOWN_NOT_DURABLY_RECORDED`：原事务值没有 durable exact source。

禁止：

- 用 `CURRENT_REOBSERVED` 冒充原 transaction before/after；
- 推测或重新生成原 `tx_id`；
- 把 wrapper 当时通过 equality assertion 的控制流事实写成已恢复的原 hash value；
- 将 Agent prose 自述用作 catalog truth。

原 `tx_id`、A4 before census、Grant before hash、credential before hash 如不能引用独立
durable exact source，MUST 写为 `null` 且 provenance =
`UNKNOWN_NOT_DURABLY_RECORDED`。

## 5. Supplement receipt contract (CTR-RR-003)

新 JSON 至少包含：

```json
{
  "receipt_kind": "RECEIPT_RECOVERY_SUPPLEMENT_V1",
  "recovery_transaction_id": "<new opaque id>",
  "recovery_authority": {
    "spec_id": "AGENT_CORE_WORKFLOW_EXECUTE_RECEIPT_RECOVERY_V1",
    "accepted_commit": "<exact accepted commit>",
    "artifact_sha256": "<exact audited artifact hash>"
  },
  "original_receipt": {
    "path": "<exact original path>",
    "size": 0,
    "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "provenance": "ORIGINAL_DURABLE"
  },
  "original_transaction": {
    "transaction_id": null,
    "a4_before": null,
    "grant_before_sha256": null,
    "credential_before_sha256": null,
    "provenance": "UNKNOWN_NOT_DURABLY_RECORDED"
  },
  "control_flow": {
    "audited_wrapper_sha256": "9aa3dfc0c308a8f95d97be8f043e4644eabd356cd8a54f5b12868ec7bfb9ff21",
    "owner_root_exit_zero_evidence": "<durable locator or null>",
    "conclusion": "<bounded derived conclusion or unavailable>",
    "provenance": "CONTROL_FLOW_DERIVED"
  },
  "current_reobserved": {
    "runtime_health": "PASS",
    "workflow_execute_visible": true,
    "workflow_execute_operations": ["create_instance", "transition"],
    "workflow_transition_visible": false,
    "p1_git_blob": "db7688fe1cc428aa1260e1372920ff744a076013",
    "p2_git_blob": "2f5e55b772e25093b7fec480a76fe47d6993b860",
    "grant_changed": "NOT_RECONSTRUCTABLE_FROM_CURRENT_STATE",
    "credential_changed": "NOT_RECONSTRUCTABLE_FROM_CURRENT_STATE",
    "provenance": "CURRENT_REOBSERVED"
  },
  "e2e_evidence": {
    "workflow_instance_id": "dbf46d4c-26bd-410a-b8fa-441758ec0658",
    "create_instance": "PASS",
    "transition": "PASS",
    "exactly_once": "PASS",
    "final_state": "completed",
    "final_version": 2,
    "provenance": "ORIGINAL_DURABLE"
  },
  "recovery_result": "PASS"
}
```

`owner_root_exit_zero_evidence` 只有在 durable locator 能机械回读时才能填值；否则为
`null`，且 `control_flow.conclusion` 不得声称原 equality checks 已通过。

## 6. Recovery artifact and one targeted Gate (CTR-RR-004)

Artifact Author MUST 产生新的、私有 0700 目录内的 receipt-only wrapper 和 manifest，
并冻结 exact SHA-256。Wrapper 必须使用 total jq expression，例如：

```jq
failure_cause:(if ($cause|length)>0 then $cause else null end)
```

安装前 MUST 同时满足：temporary receipt bytes > 0、`jq -e` 验证 required fields、
user-side hash 与 root-side hash 相等。任一失败 → 不发布、无其他写入。

只做 ONE targeted independent Gate，范围限于：

1. exact accepted Authority / artifact / output path pins；
2. allowlist 恰为一个 supplement 路径，原 receipt byte-preserved；
3. jq totality、nonempty、schema、hash、ownership、atomicity；
4. evidence provenance 无升级、无伪造、unknown 字段保持 unknown；
5. wrapper 中不存在 install P1/P2、launchctl、restart、rollback、Workflow E2E、
   Grant/credential mutation 或网络 mutation 路径。

Gate PASS 后 artifact 任一 byte 改变都使 Gate 与 Owner authorization 失效。

## 7. Owner transaction and post-publication audit (CTR-RR-005)

执行必须经 macOS 原生管理员授权对话框；不得在聊天中索取、传输或保存密码。Owner
只授权 Gate PASS 的 exact artifact hash 执行一次。执行链严格为：

```text
AUTHORITY_ACCEPTED
→ ARTIFACT_BUILD
→ ONE_TARGETED_ARTIFACT_GATE
→ OWNER_RECEIPT_RECOVERY_EXECUTION
→ INDEPENDENT_READ_ONLY_PUBLICATION_AUDIT
```

publication audit 必须验证新文件 nonempty、JSON schema、hash、`root:wheel 0644`、原
receipt hash仍为 empty-file hash、P1/P2 blobs 不变、parent/child PIDs 与 start time
不因本事务改变、runtime health PASS、无 Grant/credential/Workflow/business mutation。

## 8. Explicit prohibitions (CTR-RR-006)

本 Authority 永不授权：

- reinstall、repair 或 replace P1/P2；
- restart/kickstart、rollback、process termination 或 session refresh；
- 再跑 catalog probe、create/transition E2E 或其他 Workflow write；
- Grant、credential、principal、client、scope 或 auth configuration 变化；
- 覆盖原 receipt；
- 宣称恢复了原 contemporaneous receipt 或所有父 Spec §5 evidence；
- 以 receipt closure 阻断其他 Lane 的 read-only Authority/artifact/Gate 准备。

## 9. Success criterion

只有下列全部成立才可写：

```text
RECEIPT_RECOVERY_AUTHORITY = ACCEPTED
RECEIPT_RECOVERY_ARTIFACT_GATE = PASS
RECEIPT_RECOVERY_PUBLICATION = PASS
ORIGINAL_RECEIPT_PRESERVED = YES
P1_P2_UNCHANGED = YES
RUNTIME_RESTARTED = NO
WORKFLOW_E2E_REPEATED = NO
GRANT_CHANGED = NO
CREDENTIAL_CHANGED = NO
UNRELATED_PRODUCTION_MUTATION = NONE
WORKFLOW_EXECUTE_RECEIPT_TERMINALIZATION = PASS
WORKFLOW_EXECUTE_PRODUCTION_READY = YES
```

unknown original values remain unknown and do not become PASS claims. 本 Spec 只关闭 receipt
publication 缺口，不改写原 deployment transaction 的历史证据强度。

## 10. Acceptance scheme

当前为 docs-only proposal：`status: proposed`、`implementation_authority: none`、
`production_apply_authority: none`。独立审计必须明确判断 narrow child form 是否有效；
若审计判定新增 root-write transaction 必须 whole-Spec successor，则本 proposal =
BLOCKED，必须先按该结论改用 successor，不能自行接受。

审计 PASS 后，Owner 对 exact reviewed head 作出接受决定；独立 lifecycle transaction
才可把 `status` 翻转为 `accepted`，将 `implementation_authority` 与
`production_apply_authority` 翻转为 `contracts`，记录 reviewed head/verdict/date，
并保持 §1–§9 normative bytes 不变。
