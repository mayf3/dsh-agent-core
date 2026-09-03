---
spec_id: AGENT_CORE_WORKFLOW_EXECUTE_RECEIPT_RECOVERY_V1
status: accepted
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: contracts
date: 2026-09-03
accepted_date: 2026-09-03
accepted_by: mayf3
accepted_reviewed_base: 495b163caea28c4c34b1aa65d131f93184e7f068
accepted_reviewed_spec_commit: f028c6cfb3eeba8288ca74b4dd9ccd4e12f6051c
acceptance_review_verdict: PASS
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
superseded_by: AGENT_CORE_WORKFLOW_EXECUTE_RECEIPT_RECOVERY_V2
owners:
  - mayf3
---

# AGENT_CORE_WORKFLOW_EXECUTE_RECEIPT_RECOVERY_V1

> **ACCEPTED / RECEIPT-RECOVERY AUTHORITY.** Owner、exact reviewed proposal head 与
> PASS verdict 只取本文件 frontmatter 的 accepted_by、accepted_reviewed_spec_commit
> 与 acceptance_review_verdict；BLOCKERS = 0。本 acceptance 仅开放本文冻结的
> receipt-only artifact/Owner transaction 链；production apply 仍须 ONE targeted
> artifact Gate PASS 与 macOS native Owner authorization，不授权任何其他 mutation。

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

唯一允许的 durable production-side output 是创建：

```text
/Users/yanfenma/workspace/deployment-artifacts/
  workflow-execute-unified-a7e732f/DEPLOYMENT_RECEIPT_RECOVERY_V1.json
```

- `DURABLE_OUTPUT_ALLOWLIST` 恰为上述一个 absolute path；执行前 user-side 与
  root-side 均 MUST 证明目标不存在（包含 symlink 的 `lstat` 检查）。若存在，事务
  `STOPPED_ALREADY_EXISTS`，禁止覆盖、替换、删除或重试；
- Artifact manifest MUST 冻结一个随机 nonce，并把
  `TRANSIENT_MACHINERY_ALLOWLIST` 冻结为 same-filesystem 下一个 exact absolute
  root-owned 0700 staging directory 及其中一个 exact temporary receipt path；不得使用
  glob、未解析变量或第二个 transient path。publication 后只允许删除该 exact temp 与
  空 staging directory；
- 发布 MUST 使用经 artifact Gate 证明的 atomic no-clobber primitive；普通可覆盖式
  `rename(2)` / `mv` 不合格。最终文件 MUST 为 regular file、`nlink=1`、无 symlink、
  最终 `root:wheel 0644`；
- temporary receipt 必须经过 nonempty、`jq -e` schema、`fsync`、user/root 双 hash
  gate 后才可 no-clobber publish；
- 原零字节 `DEPLOYMENT_RECEIPT.json` MUST byte-and-identity-preserved。执行前冻结并在
  publication 后逐项比较：`device=16777230`、`inode=62490135`、`size=0`、`uid=0`、
  `gid=0`、`mode=0644`、`mtime_epoch=1788391655`、`birthtime_epoch=1788391655`、
  `nlink=1`、SHA-256 = empty-file hash、flags = `-`、ACL = empty、xattr = empty。
  任一字段变化均为 FAIL；不得 chmod/chown、改 ACL/xattr、删除、移动或重建；
- 除 `DURABLE_OUTPUT_ALLOWLIST` 与 `TRANSIENT_MACHINERY_ALLOWLIST` 外，所有
  production write 均禁止。P1/P2、launchd plist、runtime state、Grant、credential、
  auth-service、svc-workflow 与其他文件均不得写。

## 4. Evidence taxonomy (CTR-RR-002)

Recovery receipt 中每项事实 MUST 显式标记下列一种 provenance：

- `PRE_RECOVERY_DURABLE`：在 receipt recovery 之前形成、现在仍可机械定位和校验的
  durable evidence；可来自原部署事务，也可来自随后独立的 header/E2E turn；
- `CONTROL_FLOW_DERIVED`：由 exact audited wrapper bytes、Owner/root exit status 与
  immutable transcript 推导出的控制流结论；
- `CURRENT_REOBSERVED`：recovery 轮重新只读采集的当前状态；
- `UNKNOWN_NOT_DURABLY_RECORDED`：原事务值没有 durable exact source。

每个关键事实必须是独立 evidence record，至少含 `value`、`provenance`、exact
`path/session_id`、event `seq` 或文件 identity、epoch-ms `time` 和该 exact evidence
extract 的 SHA-256。禁止用一个对象级 provenance 覆盖多个不同来源字段。

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
    "identity_before": {
      "value": "device=16777230 inode=62490135 size=0 uid=0 gid=0 mode=0644 mtime_epoch=1788391655 birthtime_epoch=1788391655 nlink=1 flags=- acl=empty xattr=empty sha256=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "path": "/Users/yanfenma/workspace/deployment-artifacts/workflow-execute-unified-a7e732f/DEPLOYMENT_RECEIPT.json",
      "time": "<recovery preflight epoch-ms>",
      "extract_sha256": "<exact census extract hash>",
      "provenance": "CURRENT_REOBSERVED"
    },
    "identity_after": {
      "value": "<must exactly equal identity_before value>",
      "path": "/Users/yanfenma/workspace/deployment-artifacts/workflow-execute-unified-a7e732f/DEPLOYMENT_RECEIPT.json",
      "time": "<post-publication epoch-ms>",
      "extract_sha256": "<exact census extract hash>",
      "provenance": "CURRENT_REOBSERVED"
    }
  },
  "original_transaction": {
    "transaction_id": null,
    "a4_before": null,
    "grant_before_sha256": null,
    "credential_before_sha256": null,
    "provenance_by_field": "UNKNOWN_NOT_DURABLY_RECORDED"
  },
  "control_flow": {
    "audited_wrapper_sha256": "9aa3dfc0c308a8f95d97be8f043e4644eabd356cd8a54f5b12868ec7bfb9ff21",
    "owner_root_exit_zero_evidence": "<durable locator or null>",
    "owner_root_exit_zero_time": "<epoch-ms or null>",
    "owner_root_exit_zero_extract_sha256": "<sha256 or null>",
    "conclusion": "<bounded derived conclusion or null>",
    "provenance": "<CONTROL_FLOW_DERIVED only when locator/time/digest are all present; otherwise UNKNOWN_NOT_DURABLY_RECORDED>"
  },
  "pre_recovery_durable": {
    "catalog_header": {
      "value": "workflow_execute visible; operations=create_instance,transition; workflow_transition absent",
      "session_id": "/Users/authsvc/.agent-core/homes/agt_efficiency-agent/sessions/--Users-yanfenma-.openclaw-groups-workspace-oc_c6fa97d6255912b25a277e25441f6c11--/main/session.jsonl",
      "seq": 49984,
      "time": 1788391646586,
      "extract_sha256": "9e17c49b828651f4aa062b60a7a50e0be83fa1cb7053ada914765c74663dc7e9",
      "provenance": "PRE_RECOVERY_DURABLE"
    },
    "e2e_events": [
      {"value":"create_instance call: external_reference=wfexec-production-ready-canary-20260903-0742, disposable=true","session_id":"/Users/authsvc/.agent-core/homes/agt_efficiency-agent/sessions/--Users-yanfenma-.openclaw-groups-workspace-oc_c6fa97d6255912b25a277e25441f6c11--/main/session.jsonl","seq":50593,"time":1788392601576,"extract_sha256":"eae7d5bd8c75ffa63ec68e43f1d3f3b3493a6f99820b7d5a184bea5ed3fa38f3","provenance":"PRE_RECOVERY_DURABLE"},
      {"value":"create_instance PASS: instance=dbf46d4c-26bd-410a-b8fa-441758ec0658, version=1, node_visit=b1cf751e-6174-44ce-9911-f72e1d092524, event_sequence=1","session_id":"/Users/authsvc/.agent-core/homes/agt_efficiency-agent/sessions/--Users-yanfenma-.openclaw-groups-workspace-oc_c6fa97d6255912b25a277e25441f6c11--/main/session.jsonl","seq":50594,"time":1788392601763,"extract_sha256":"6b587ea7f2b75fa7507c04587c3f57383d63dead520edf98af3cd19165134dbf","provenance":"PRE_RECOVERY_DURABLE"},
      {"value":"transition call exactly once: instance=dbf46d4c-26bd-410a-b8fa-441758ec0658, transition=7493f6ca-6cf0-4ebf-95f8-f565f2b231ec, expected_version=1","session_id":"/Users/authsvc/.agent-core/homes/agt_efficiency-agent/sessions/--Users-yanfenma-.openclaw-groups-workspace-oc_c6fa97d6255912b25a277e25441f6c11--/main/session.jsonl","seq":50976,"time":1788392635037,"extract_sha256":"61271699713f1459a3b3117bfe867657029a7fa268a650a8df5225144e6ab386","provenance":"PRE_RECOVERY_DURABLE"},
      {"value":"transition PASS: same instance, version=2, node_visit=734910f2-c59d-4522-9c32-3285fd19dbff, submission=269d55c9-452a-48eb-9d36-e37805fb1b17, event_sequence=2","session_id":"/Users/authsvc/.agent-core/homes/agt_efficiency-agent/sessions/--Users-yanfenma-.openclaw-groups-workspace-oc_c6fa97d6255912b25a277e25441f6c11--/main/session.jsonl","seq":50977,"time":1788392635135,"extract_sha256":"55c89022619c3eb10f7ea0ce4aab15386ec12fc7741d3858730a87f75ecbb440","provenance":"PRE_RECOVERY_DURABLE"},
      {"value":"final read call: instance=dbf46d4c-26bd-410a-b8fa-441758ec0658","session_id":"/Users/authsvc/.agent-core/homes/agt_efficiency-agent/sessions/--Users-yanfenma-.openclaw-groups-workspace-oc_c6fa97d6255912b25a277e25441f6c11--/main/session.jsonl","seq":51037,"time":1788392640436,"extract_sha256":"9d736e23807d6d279eb6b5e24539caf90c80378e13768b700a1ffc981e751497","provenance":"PRE_RECOVERY_DURABLE"},
      {"value":"final readback PASS: same instance, version=2, node=completed, node_type=TERMINAL, is_terminal=true, outgoing_transitions=empty; together with the single transition call/result binds EXACTLY_ONCE=PASS","session_id":"/Users/authsvc/.agent-core/homes/agt_efficiency-agent/sessions/--Users-yanfenma-.openclaw-groups-workspace-oc_c6fa97d6255912b25a277e25441f6c11--/main/session.jsonl","seq":51038,"time":1788392640488,"extract_sha256":"536f7c82683bc811f7087c6d35b45cc7210c8a36cd69b01132be79b86248ad38","provenance":"PRE_RECOVERY_DURABLE"}
    ]
  },
  "current_reobserved": {
    "runtime_health": "<independent fact record>",
    "p1_git_blob": "<independent fact record>",
    "p2_git_blob": "<independent fact record>",
    "parent_child_pid_start": "<independent fact records>",
    "grant_current": "<independent fact record; never labelled unchanged without valid control-flow evidence>",
    "credential_current": "<independent fact record; never labelled unchanged without valid control-flow evidence>"
  },
  "receipt_recovery_publication": "PASS",
  "workflow_execute_production_ready": "<YES or NOT_ESTABLISHED>"
}
```

`owner_root_exit_zero_evidence` 只有在 durable locator 能机械回读时才能填值；否则为
`null`，其 time/digest/conclusion 也必须为 `null`，provenance 必须是
`UNKNOWN_NOT_DURABLY_RECORDED`。上述 event digest 定义为 exact JSONL event 经
`jq -c 'select(.seq==N)'` 生成并追加一个 LF 后的 SHA-256；所有 E2E event 共用上述
exact session path，receipt 中 MUST 对每项显式重复该 path，不能靠对象级继承省略。

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
2. durable allowlist 恰为一个 supplement 路径，transient allowlist 是 manifest 冻结的
   exact nonce directory/temp path；目标预先不存在且 no-clobber，原 receipt
   byte-and-identity-preserved；
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

publication audit 必须验证新文件 nonempty、JSON schema、hash、`root:wheel 0644`、
`nlink=1`；原 receipt 的 device/inode/size/hash/uid/gid/mode/mtime/birthtime/nlink/
flags/ACL/xattr 全部不变；transient allowlist 已清空；P1/P2 blobs 不变、parent/child
PIDs 与 start time 不因本事务改变、runtime health PASS、无
Grant/credential/Workflow/business mutation。

## 8. Explicit prohibitions (CTR-RR-006)

本 Authority 永不授权：

- reinstall、repair 或 replace P1/P2；
- restart/kickstart、rollback、process termination 或 session refresh；
- 再跑 catalog probe、create/transition E2E 或其他 Workflow write；
- Grant、credential、principal、client、scope 或 auth configuration 变化；
- 覆盖原 receipt；
- 覆盖或重试已存在的 supplement；supplement path 已存在时只能 STOP；
- 宣称恢复了原 contemporaneous receipt 或所有父 Spec §5 evidence；
- 以 receipt closure 阻断其他 Lane 的 read-only Authority/artifact/Gate 准备。

## 9. Success criterion

Supplement publication 成功只允许写：

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
```

`WORKFLOW_EXECUTE_PRODUCTION_READY = YES` 是独立的综合结论，只能在以下 evidence
全部具有可校验 locator/time/digest 且彼此一致时成立：pre-recovery durable target-live
catalog、create/transition/final-readback E2E、Owner/root exit-zero 与由 exact wrapper
导出的安全 assertions、recovery 时 P1/P2/PID/health/current Grant/current credential
只读回查。任一缺失或 provenance 为 unknown 时，MUST 写
`WORKFLOW_EXECUTE_PRODUCTION_READY = NOT_ESTABLISHED`；receipt recovery 不得自行
升级父事务证据。unknown original values 永远保持 unknown。

## 10. Acceptance scheme

当前为 docs-only proposal：`status: proposed`、`implementation_authority: none`、
`production_apply_authority: none`。独立审计必须明确判断 narrow child form 是否有效；
若审计判定新增 root-write transaction 必须 whole-Spec successor，则本 proposal =
BLOCKED，必须先按该结论改用 successor，不能自行接受。

审计 PASS 后，Owner 对 exact reviewed head 作出接受决定。Lifecycle transaction 的
exhaustive allowlist 仅为：

1. frontmatter `status: proposed -> accepted`、两项 authority `none -> contracts`；
2. `accepted_date: null -> 2026-09-03`、`accepted_by: null -> mayf3`、
   `accepted_reviewed_base: null -> <审计冻结的 exact base>`、
   `accepted_reviewed_spec_commit: null -> <审计冻结的 exact proposal head>`、
   `acceptance_review_verdict: null -> PASS`；
3. 标题下方 proposal banner 必须进行下述 exact literal `FROM` → `TO` 替换；
4. `docs/specs/README.md` 本 Spec 行只允许 lifecycle `proposed -> accepted` 与
   authority `none -> contracts` 两处同步。

除此之外，本文（含本节）与索引其他 bytes 全部冻结；不得追加 acceptance footer 或
顺手修文。Lifecycle commit 形成后，必须由独立 Reviewer 对新 exact head 执行
`FINAL_HEAD_RECHECK = PASS`，证明 delta 恰为以上 allowlist、Owner decision 与 review
provenance 一致、normative semantic drift = NONE。只有通过 recheck 的 exact head 且
随后不再变化才可 merge；否则 acceptance 与后续 artifact authority 均无效。

Literal `FROM`：

```text
> **PROPOSED / NOT ACCEPTED.** 本文件只提出一次性的 receipt recovery Authority。
> 本 authoring 轮仅可写本文与索引；不得写 production、不得 sudo、不得修改
> P1/P2、不得重启或回滚 runtime、不得重复 Workflow E2E、不得修改 Grant 或
> credential。只有独立审计 PASS、Owner 对 exact reviewed head 作出接受决定并把
> lifecycle/authority 字段翻转后，才可能进入 artifact 轮。
```

Literal `TO`：

```text
> **ACCEPTED / RECEIPT-RECOVERY AUTHORITY.** Owner、exact reviewed proposal head 与
> PASS verdict 只取本文件 frontmatter 的 accepted_by、accepted_reviewed_spec_commit
> 与 acceptance_review_verdict；BLOCKERS = 0。本 acceptance 仅开放本文冻结的
> receipt-only artifact/Owner transaction 链；production apply 仍须 ONE targeted
> artifact Gate PASS 与 macOS native Owner authorization，不授权任何其他 mutation。
```
