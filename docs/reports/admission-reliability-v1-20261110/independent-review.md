Reading additional input from stdin...
OpenAI Codex v0.164.0
--------
workdir: /tmp/review-609
model: gpt-6.1-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR]
reasoning effort: ultra
reasoning summaries: none
session id: 01a1c27b-271c-7652-ac32-cf31ace9775c
--------
user
非作者独立语义审查（标准内联）。仓库 /tmp/review-609/repo（分支 docs/554-admission-runtime-spec-r4，勿 fetch；对照 origin/main）。审查对象 docs/specs/AGENT_CORE_ADMISSION_RUNTIME_RELIABILITY_V1.md（#554 B 面：admission 单点依赖辅 runtime 的可靠性 Spec，proposed）。审查人声明未参与创作。

六项判定：
1. frontmatter 合规：status=proposed、production none、external_authorities/production_apply_authority 等强制字段齐（对照 SPEC_FORMAT_V0）；无冒充 accepted
2. 语义与现状对齐：B 面问题陈述（admission core 单点依赖辅 runtime、503 事故模式）与 main 现状一致；A 面（#555 已合并的监听器韧性）不被该 spec 重复或矛盾
3. 不扩权：spec 不新增执行权限/信任边界；不改 SRA/DCP/SOD 语义
4. 与既有权威一致性：引用的 accepted 合同（WEC/DCP/admission 相关）抽查 2 项坐标真实且语义相符
5. 验收/开放问题如实：TBD 列明（proposed 允许）
6. 上游一致性：引用 #554/#555 坐标抽查 1-2 项

输出逐项 PASS/FAIL/UNKNOWN + 坐标；最终行 FINAL_VERDICT=PASS|PASS_WITH_TBD|FAIL 与 FROZEN_BLOCKER_UNION=[...]。零写入（/tmp 除外）。不修复。
2026-11-09T22:43:35.306494Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 403 Forbidden, url: wss://chatgpt.com/backend-api/codex/responses
2026-11-09T22:43:37.226293Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 403 Forbidden, url: wss://chatgpt.com/backend-api/codex/responses
2026-11-09T22:43:37.686081Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 403 Forbidden, url: wss://chatgpt.com/backend-api/codex/responses
ERROR: Reconnecting... 2/5
2026-11-09T22:43:37.862579Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when UnexpectedServerResponse("HTTP 502: ")
2026-11-09T22:43:38.292425Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 403 Forbidden, url: wss://chatgpt.com/backend-api/codex/responses
ERROR: Reconnecting... 3/5
2026-11-09T22:43:39.255913Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 403 Forbidden, url: wss://chatgpt.com/backend-api/codex/responses
ERROR: Reconnecting... 4/5
2026-11-09T22:43:41.047100Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 403 Forbidden, url: wss://chatgpt.com/backend-api/codex/responses
ERROR: Reconnecting... 5/5
2026-11-09T22:43:41.795622Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when UnexpectedServerResponse("HTTP 502: ")
2026-11-09T22:43:44.717426Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 403 Forbidden, url: wss://chatgpt.com/backend-api/codex/responses
warning: Falling back from WebSockets to HTTPS transport. unexpected status 403 Forbidden: <html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style global>body{font-family:Arial,Helveti, url: wss://chatgpt.com/backend-api/codex/responses, cf-ray: a580568de803220f-HKG
2026-11-09T22:43:45.830305Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when UnexpectedServerResponse("HTTP 502: ")
codex
我会仅用本地分支和 `origin/main` 做只读核查，不 fetch、不修改。先确认审查身份、HEAD 与规范基准，再并行检查语义、权威引用和上游坐标。
exec
/bin/zsh -lc "rg -n 'dsh-agent-core|SPEC_FORMAT_V0|#554|#555|admission|WEC|DCP' /Users/yanfenma/.codex/memories/MEMORY.md" in /tmp/review-609
 succeeded in 0ms:
123:# Task Group: dsh-agent-core / ZCode network reconnect diagnosis
125:applies_to: cwd=/Users/yanfenma/workspace/project/dsh-agent-core with diagnostic state under /Users/yanfenma/.zcode; reuse_rule=the layered process generalizes, but proxy settings, endpoints, logs, provider state, and recovery status are time-sensitive and require fresh readback.
131:- rollout_summaries/2026-11-02T15-39-21-nSCg-zcode_network_reconnect_upstream_502_503.md (cwd=/Users/yanfenma/workspace/project/dsh-agent-core, rollout_path=/Users/yanfenma/.codex/sessions/2026/11/02/rollout-2026-11-02T23-39-22-01a19cea-47ed-7be3-b430-a677dba49ff4.jsonl, updated_at=2026-11-02T15:42:51+00:00, thread_id=01a19cea-47ed-7be3-b430-a677dba49ff4, read-only diagnosis; upstream recovery unverified)
240:# Task Group: dsh-agent-core / unattended workflow watchdog mechanism audit
242:applies_to: cwd=/Users/yanfenma/workspace/project/dsh-agent-core (and production-backlog-remediation artifacts); reuse_rule=event-level diagnosis and state-machine safeguards generalize; production installation, instance version, event history, and authorization require fresh readback.
248:- rollout_summaries/2026-10-26T01-54-14-E5qN-unattended_workflow_watchdog_mechanism_audit.md (cwd=/Users/yanfenma/workspace/project/dsh-agent-core, rollout_path=/Users/yanfenma/.codex/sessions/2026/10/26/rollout-2026-10-26T09-54-14-01a175ea-5880-7b23-b40e-1738883401f1.jsonl, updated_at=2026-11-01T02:20:38+00:00, thread_id=01a175ea-5880-7b23-b40e-1738883401f1, read-only audit; no production repair or autonomous closure claimed)
258:- rollout_summaries/2026-10-26T01-54-14-E5qN-unattended_workflow_watchdog_mechanism_audit.md (cwd=/Users/yanfenma/workspace/project/dsh-agent-core, rollout_path=/Users/yanfenma/.codex/sessions/2026/10/26/rollout-2026-10-26T09-54-14-01a175ea-5880-7b23-b40e-1738883401f1.jsonl, updated_at=2026-11-01T02:20:38+00:00, thread_id=01a175ea-5880-7b23-b40e-1738883401f1, persistent-record and fault-injection acceptance criteria)
284:# Task Group: dsh-agent-core / B7 R50-R51 governance-loop correction and deployment supervision
286:applies_to: cwd=/Users/yanfenma/workspace/project/dsh-agent-core; reuse_rule=authority attribution, lifecycle separation, and evidence reuse generalize; B7 authority, consumer contracts, preimages, and production state require fresh readback.
292:- rollout_summaries/2026-10-13T23-16-47-IFYr-r50_r51_governance_correction_and_deployment_loop_optimizati.md (cwd=/Users/yanfenma/workspace/project/dsh-agent-core, rollout_path=/Users/yanfenma/.codex/sessions/2026/10/14/rollout-2026-10-14T07-16-47-01a1378d-e052-7021-9992-f0760eb9f9e7.jsonl, updated_at=2026-11-02T23:43:27+00:00, thread_id=01a1378d-e052-7021-9992-f0760eb9f9e7, R51 remains source-only and non-executable)
302:- rollout_summaries/2026-10-13T23-16-47-IFYr-r50_r51_governance_correction_and_deployment_loop_optimizati.md (cwd=/Users/yanfenma/workspace/project/dsh-agent-core, rollout_path=/Users/yanfenma/.codex/sessions/2026/10/14/rollout-2026-10-14T07-16-47-01a1378d-e052-7021-9992-f0760eb9f9e7.jsonl, updated_at=2026-11-02T23:43:27+00:00, thread_id=01a1378d-e052-7021-9992-f0760eb9f9e7, correction delivered; no source or production action)
320:- The corrective path is one isolated successor chain: reuse R49/R50 57/57 tests and 21/21 admission evidence where applicable, then finish final candidate closure, publication interface, A4 two-snapshot transaction/recovery, actual consumer ordering/positive-negative tests, and one affected non-author review. Do not rerun old gates or dispatch per pin. [Task 1]
407:# Task Group: dsh-agent-core / agent-control #1256 SOURCE_ONLY remediation
409:applies_to: cwd=/Users/yanfenma/workspace/project/dsh-agent-core; reuse_rule=source-only contract and artifact checks generalize, but branch, dirty state, manifests, installed/runtime state, and adoption require fresh readback.
415:- rollout_summaries/2026-10-22T14-18-48-2Ok8-agent_control_1256_source_only_continuation_complete.md (cwd=/Users/yanfenma/workspace/project/dsh-agent-core, rollout_path=/Users/yanfenma/.codex/sessions/2026/10/22/rollout-2026-10-22T22-18-48-01a163fa-93db-7693-b21a-3cf1152d7b18.jsonl, updated_at=2026-10-23T11:32:20+00:00, thread_id=01a163fa-93db-7693-b21a-3cf1152d7b18, all finite findings dispositioned; no production adoption)
440:# Task Group: dsh-agent-core / Workflow stagnation and external-side-effect outcome-unknown recovery
442:applies_to: cwd=/Users/yanfenma/workspace/project/dsh-agent-core (with conditional svc-workflow source review); reuse_rule=state classification and exact-ID comparison generalize, but every instance, visit, actor, receipt, and live outcome needs fresh authorized readback.
448:- rollout_summaries/2026-10-20T11-13-13-yDtS-workflow_stagnation_and_shopping_outcome_unknown_analysis.md (cwd=/Users/yanfenma/workspace/project/dsh-agent-core, rollout_path=/Users/yanfenma/.codex/sessions/2026/10/20/rollout-2026-10-20T19-13-13-01a15903-f166-79f0-a504-0f60a36db958.jsonl, updated_at=2026-10-25T08:12:37+00:00, thread_id=01a15903-f166-79f0-a504-0f60a36db958, deeper read-only root-cause analysis; production unverified)
458:- rollout_summaries/2026-10-20T11-13-13-yDtS-workflow_stagnation_and_shopping_outcome_unknown_analysis.md (cwd=/Users/yanfenma/workspace/project/dsh-agent-core, rollout_path=/Users/yanfenma/.codex/sessions/2026/10/20/rollout-2026-10-20T19-13-13-01a15903-f166-79f0-a504-0f60a36db958.jsonl, updated_at=2026-10-25T08:12:37+00:00, thread_id=01a15903-f166-79f0-a504-0f60a36db958, session execution and partial side effects confirmed; parent termination and fresh remote state unknown)
468:- extension source `extensions/ad_hoc/notes/20261027T002500Z-workflow-unattended-goal.md` (cwd=/Users/yanfenma/workspace/project/dsh-agent-core, rollout_path=not recorded, updated_at=2026-10-27, thread_id=not recorded, authoritative user clarification; no rollout summary) [ad-hoc note]
476:- when the user asked to “深入思考” why Agent Core does not advance tasks -> distinguish business evidence, Definition/transition contracts, capability, transport/admission, identity, and visibility; do not blame Agents generically. [Task 1]
480:- for the dsh-agent-core workflow-governance task, the user clarified that “the entire workflow runs unattended” -> do not call Codex continuously watching, reminding actors, correcting each node, or manually advancing/merging “unattended closure”; keep source implementation, isolated validation, manual-assisted closure, and autonomous end-to-end execution separate. [Task 3] [ad-hoc note]
484:- Workflow non-progress has at least six classes: undelivered/transport admission, received with no business submission, capability gap, missing business evidence, Definition/transition contract defect, and legitimate DRAFT/HUMAN/manual waiting. `ACTIONABLE_NOW` is only time eligibility; `accepted` only means entry to the Agent session, not business progress. `NON_BUSINESS_TEST` governance-node progress also does not prove original-business recovery. [Task 1]
497:- `WAIT_FOR_EVIDENCE`, `RETURN`, or `HUMAN_REQUIRED` must specify `blocked_reason`, `required_evidence`, `owner`, `resume_condition`, a wake-up event, and an escalation condition; otherwise they only rename `ACTIONABLE` stagnation. A governance Workflow cannot replace an independently authorized control-plane repair path when it relies on the same broken dispatch/admission/identity/visibility chain. [Task 1]
645:# Task Group: dsh-agent-core / Codex-session coordination for Deployment, Website, and MCP
647:applies_to: cwd=/Users/yanfenma/workspace/project/dsh-agent-core; reuse_rule=single-writer and evidence-lifecycle rules generalize, but exact session IDs, PR heads, browser/provider state, permissions, and business rollout require fresh readback.
653:- rollout_summaries/2026-10-17T05-53-55-vqft-coordinate_deployment_website_mcp_continuation.md (cwd=/Users/yanfenma/workspace/project/dsh-agent-core, rollout_path=/Users/yanfenma/.codex/sessions/2026/10/17/rollout-2026-10-17T13-53-55-01a1486c-8987-7262-a874-3a9632a601bf.jsonl, updated_at=2026-10-17T23:35:02+00:00, thread_id=01a1486c-8987-7262-a874-3a9632a601bf, continuation delivered; all business goals incomplete)
681:applies_to: cwd=/Users/yanfenma/workspace/project/svc-workflow (with dsh-agent-core Scheduler read interfaces); reuse_rule=receipt semantics and correlation rules generalize, but instance/job state, identities, slots, logs, and live-reader authorization require fresh readback.
723:# Task Group: dsh-agent-core / dot-read-mcp external connector and controlled MCP handoff
725:applies_to: cwd=/Users/yanfenma/workspace/project/dsh-agent-core (also dot-read-mcp, project-progress-desk, and agent-control); reuse_rule=read-only, UNKNOWN, external-connector, and single-writer rules generalize; all live connector state, Site version, permissions, bindings, and business results require fresh readback.
731:- rollout_summaries/2026-10-14T15-49-58-vqRI-mcp_external_connector_recovery_and_controlled_readonly_hand.md (cwd=/Users/yanfenma/workspace/project/dsh-agent-core, rollout_path=/Users/yanfenma/.codex/sessions/2026/10/14/rollout-2026-10-14T23-49-59-01a13b1b-2c4b-7112-b255-f1cb677e2ec2.jsonl, updated_at=2026-10-20T02:05:03+00:00, thread_id=01a13b1b-2c4b-7112-b255-f1cb677e2ec2, controlled read-only handoff; no send or production change)
741:- rollout_summaries/2026-10-14T15-49-58-vqRI-mcp_external_connector_recovery_and_controlled_readonly_hand.md (cwd=/Users/yanfenma/workspace/project/dsh-agent-core, rollout_path=/Users/yanfenma/.codex/sessions/2026/10/14/rollout-2026-10-14T23-49-59-01a13b1b-2c4b-7112-b255-f1cb677e2ec2.jsonl, updated_at=2026-10-20T02:05:03+00:00, thread_id=01a13b1b-2c4b-7112-b255-f1cb677e2ec2, 15-page read-only census validated)
751:- rollout_summaries/2026-10-14T15-49-58-vqRI-mcp_external_connector_recovery_and_controlled_readonly_hand.md (cwd=/Users/yanfenma/workspace/project/dsh-agent-core, rollout_path=/Users/yanfenma/.codex/sessions/2026/10/14/rollout-2026-10-14T23-49-59-01a13b1b-2c4b-7112-b255-f1cb677e2ec2.jsonl, updated_at=2026-10-20T02:05:03+00:00, thread_id=01a13b1b-2c4b-7112-b255-f1cb677e2ec2, repeated one-shot recovery units remained 429-blocked)
761:- rollout_summaries/2026-10-16T00-08-43-faXF-prepare_agent_control_1156_fixed_mcp_deployment_packet.md (cwd=/Users/yanfenma/workspace/project/dsh-agent-core, rollout_path=/Users/yanfenma/.codex/sessions/2026/10/16/rollout-2026-10-16T08-08-43-01a1420a-252b-7280-b93e-941f155a72a3.jsonl, updated_at=2026-10-16T22:17:23+00:00, thread_id=01a1420a-252b-7280-b93e-941f155a72a3, additive approval packet only; no production execution)
771:- rollout_summaries/2026-10-16T00-08-43-faXF-prepare_agent_control_1156_fixed_mcp_deployment_packet.md (cwd=/Users/yanfenma/workspace/project/dsh-agent-core, rollout_path=/Users/yanfenma/.codex/sessions/2026/10/16/rollout-2026-10-16T08-08-43-01a1420a-252b-7280-b93e-941f155a72a3.jsonl, updated_at=2026-10-16T22:17:23+00:00, thread_id=01a1420a-252b-7280-b93e-941f155a72a3, Auth PR #90 remains Draft/proposed)
804:# Task Group: dsh-agent-core / Website Human inquiry diagnosis and fixed-Agent launch preparation
806:applies_to: cwd=/Users/yanfenma/workspace/project/dsh-agent-core (with Site, Gateway, Auth, and agent-control authorities); reuse_rule=contract invariants generalize, but exact PR heads, accepted authority, installed runtime, Clients/Grants/bindings, and live behavior require fresh verification.
812:- rollout_summaries/2026-10-12T23-46-42-7tHl-private_progress_site_agent_control_inquiry_diagnostic.md (cwd=/Users/yanfenma/workspace/project/dsh-agent-core, rollout_path=/Users/yanfenma/.codex/sessions/2026/10/13/rollout-2026-10-13T07-46-42-01a13282-e895-78f3-a0ba-cea68de7b4cb.jsonl, updated_at=2026-10-19T07:56:21+00:00, thread_id=01a13282-e895-78f3-a0ba-cea68de7b4cb, v278 presentation deployed; Human inquiry unprovisioned and unsent)
822:- rollout_summaries/2026-10-12T23-46-42-7tHl-private_progress_site_agent_control_inquiry_diagnostic.md (cwd=/Users/yanfenma/workspace/project/dsh-agent-core, rollout_path=/Users/yanfenma/.codex/sessions/2026/10/13/rollout-2026-10-13T07-46-42-01a13282-e895-78f3-a0ba-cea68de7b4cb.jsonl, updated_at=2026-10-19T07:56:21+00:00, thread_id=01a13282-e895-78f3-a0ba-cea68de7b4cb, candidate relay/install state remains distinct from production)
832:- rollout_summaries/2026-10-16T00-26-14-LtPo-single_mac_local_https_website_agent_inquiry_preparation.md (cwd=/Users/yanfenma/workspace/project/dsh-agent-core, rollout_path=/Users/yanfenma/.codex/sessions/2026/10/16/rollout-2026-10-16T08-26-14-01a1421a-2d8f-7fc0-9450-38715d26e9fe.jsonl, updated_at=2026-10-16T11:15:25+00:00, thread_id=01a1421a-2d8f-7fc0-9450-38715d26e9fe, proposed-only local transport and supported source workflow)
842:- when a cancelled repair “不替代该确认” -> preserve the original admission/session and obtain explicit continuation authorization; do not bypass cancellation by changing issue, identity, or tool. [Task 2]
843:- the user asked for current → proposed deployment delta with exact versions, owner, permissions, order, verification, and rollback, with unknowns unfilled; require real browser/request/message/reply evidence rather than health, queue admission, or process exit. [Task 1]
920:# Task Group: dsh-agent-core / B7 checkpoint binding, e29 closure, and controlled executor handoff
921:scope: B7 first-batch admission, fixed-subject e29 closure, candidate binding, provenance repair, and single-writer handoff; use before reporting B7 executable, loaded, committed, or proposing an Owner command.
922:applies_to: cwd=/Users/yanfenma/workspace/project/dsh-agent-core; reuse_rule=read-only control-plane boundaries and predicate checks generalize, but every operation, candidate hash, owner binding, journal, receipt, lock, and production state requires fresh readback.
928:- rollout_summaries/2026-10-16T06-52-40-ygpl-r41_e42r3_publish_register_without_execute.md (cwd=/Users/yanfenma/workspace/project/dsh-agent-core, rollout_path=/Users/yanfenma/.codex/sessions/2026/10/16/rollout-2026-10-16T14-52-40-01a1437b-f9f3-7a33-a253-8f7fce9459f3.jsonl, updated_at=2026-10-20T02:19:27+00:00, thread_id=01a1437b-f9f3-7a33-a253-8f7fce9459f3, release/register completed; EXECUTE intentionally left to ZCode)
938:- rollout_summaries/2026-10-16T00-26-26-Mwrw-b7_takeover_e29_closure_provenance_repair.md (cwd=/Users/yanfenma/workspace/project/dsh-agent-core, rollout_path=/Users/yanfenma/.codex/sessions/2026/10/16/rollout-2026-10-16T08-26-26-01a1421a-5bbe-70d3-8ce0-a595ed9b9e7a.jsonl, updated_at=2026-10-16T11:15:20+00:00, thread_id=01a1421a-5bbe-70d3-8ce0-a595ed9b9e7a, real DS disposal/STATUS closure read back)
948:- rollout_summaries/2026-10-16T00-26-26-Mwrw-b7_takeover_e29_closure_provenance_repair.md (cwd=/Users/yanfenma/workspace/project/dsh-agent-core, rollout_path=/Users/yanfenma/.codex/sessions/2026/10/16/rollout-2026-10-16T08-26-26-01a1421a-5bbe-70d3-8ce0-a595ed9b9e7a.jsonl, updated_at=2026-10-16T11:15:20+00:00, thread_id=01a1421a-5bbe-70d3-8ce0-a595ed9b9e7a, root/uid-502 provenance repair not deployed)
958:- rollout_summaries/2026-10-16T00-26-26-Mwrw-b7_takeover_e29_closure_provenance_repair.md (cwd=/Users/yanfenma/workspace/project/dsh-agent-core, rollout_path=/Users/yanfenma/.codex/sessions/2026/10/16/rollout-2026-10-16T08-26-26-01a1421a-5bbe-70d3-8ce0-a595ed9b9e7a.jsonl, updated_at=2026-10-16T11:15:20+00:00, thread_id=01a1421a-5bbe-70d3-8ce0-a595ed9b9e7a, amendment accepted but unimplemented/undeployed)
968:- rollout_summaries/2026-10-13T00-05-30-iEZr-b7_e6_hr_architecture_and_zcode_followup.md (cwd=/Users/yanfenma/workspace/project/dsh-agent-core, rollout_path=/Users/yanfenma/.codex/archived_sessions/rollout-2026-10-13T08-05-30-01a13294-2024-7083-a0d4-c9ab53ef6ae1.jsonl, updated_at=2026-10-13T23:14:29+00:00, thread_id=01a13294-2024-7083-a0d4-c9ab53ef6ae1, read-only review and candidate preparation; B7 rollout incomplete)
978:- rollout_summaries/2026-10-11T23-29-50-FK9E-b7_apply_carrier_hash_trace_and_controlled_handoff.md (cwd=/Users/yanfenma/workspace/project/dsh-agent-core, rollout_path=/Users/yanfenma/.codex/archived_sessions/rollout-2026-10-12T07-29-50-01a12d4d-1b84-7a22-80ca-96b2f0275fc6.jsonl, updated_at=2026-10-13T20:52:09+00:00, thread_id=01a12d4d-1b84-7a22-80ca-96b2f0275fc6, root cause traced; B7 deployment incomplete and coordination stopped)
1012:# Task Group: dsh-agent-core / Scheduler UNKNOWN root-cause repair, production acceptance, and PR #509
1014:applies_to: cwd=/Users/yanfenma/workspace/project/dsh-agent-core; reuse_rule=the evidence-propagation pattern and proof standard generalize; deployed SHA, receipt, PID, occurrences, lock, and provider state require fresh readback.
1020:- rollout_summaries/2026-10-12T12-49-17-gxa6-scheduler_unknown_root_cause_fix_production_acceptance.md (cwd=/Users/yanfenma/workspace/project/dsh-agent-core, rollout_path=/Users/yanfenma/.codex/sessions/2026/10/12/rollout-2026-10-12T20-49-17-01a13029-07af-71f1-bab8-1514c7481f96.jsonl, updated_at=2026-10-13T15:15:04+00:00, thread_id=01a13029-07af-71f1-bab8-1514c7481f96, production receipt/real-child acceptance PASS; PR #509 merged)
1030:- rollout_summaries/2026-10-12T12-49-17-gxa6-scheduler_unknown_root_cause_fix_production_acceptance.md (cwd=/Users/yanfenma/workspace/project/dsh-agent-core, rollout_path=/Users/yanfenma/.codex/sessions/2026/10/12/rollout-2026-10-12T20-49-17-01a13029-07af-71f1-bab8-1514c7481f96.jsonl, updated_at=2026-10-13T15:15:04+00:00, thread_id=01a13029-07af-71f1-bab8-1514c7481f96, completed original release; real natural-slot proof)
1066:- rollout_summaries/2026-10-13T14-17-34-SqVe-ai_evolution_video_opus_style_production.md (cwd=/Users/yanfenma/workspace/project/dsh-agent-core, rollout_path=/Users/yanfenma/.codex/sessions/2026/10/13/rollout-2026-10-13T22-17-34-01a135a0-359a-7bb2-9005-099b42d42144.jsonl, updated_at=2026-10-13T18:43:49+00:00, thread_id=01a135a0-359a-7bb2-9005-099b42d42144, research and finished local deliverable)
1076:- rollout_summaries/2026-10-13T14-17-34-SqVe-ai_evolution_video_opus_style_production.md (cwd=/Users/yanfenma/workspace/project/dsh-agent-core, rollout_path=/Users/yanfenma/.codex/sessions/2026/10/13/rollout-2026-10-13T22-17-34-01a135a0-359a-7bb2-9005-099b42d42144.jsonl, updated_at=2026-10-13T18:43:49+00:00, thread_id=01a135a0-359a-7bb2-9005-099b42d42144, 1080p/share MP4s and local-player checks passed)
1101:# Task Group: dsh-agent-core / production deployment control plane and same-HR availability recovery
1103:applies_to: cwd=/Users/yanfenma/workspace/project/dsh-agent-core; reuse_rule=architecture and failure shields generalize, but all worktree heads, artifact hashes, grants, reviews, and authorization state are time-sensitive and require fresh verification.
1109:- rollout_summaries/2026-09-17T01-40-56-LWOn-production_control_plane_hr_availability_recovery.md (cwd=/Users/yanfenma/workspace/project/dsh-agent-core, rollout_path=/Users/yanfenma/.codex/sessions/2026/09/17/rollout-2026-09-17T09-40-56-01a0ad06-249f-7632-809b-961b93c3b113.jsonl, updated_at=2026-10-13T01:37:48+00:00, thread_id=01a0ad06-249f-7632-809b-961b93c3b113, docs-first investigation; no deployment daemon or production mutation found)
1119:- rollout_summaries/2026-09-17T01-40-56-LWOn-production_control_plane_hr_availability_recovery.md (cwd=/Users/yanfenma/workspace/project/dsh-agent-core, rollout_path=/Users/yanfenma/.codex/sessions/2026/09/17/rollout-2026-09-17T09-40-56-01a0ad06-249f-7632-809b-961b93c3b113.jsonl, updated_at=2026-10-13T01:37:48+00:00, thread_id=01a0ad06-249f-7632-809b-961b93c3b113, controller-crash recovery remained RED; no production proof)
1129:- rollout_summaries/2026-09-23T01-17-54-htjt-pdc_exclusive_takeover_offline_candidate_blocked_on_rollback.md (cwd=/Users/yanfenma/workspace/project/dsh-agent-core, rollout_path=/Users/yanfenma/.codex/sessions/2026/09/23/rollout-2026-09-23T09-17-54-01a0cbd7-368a-76a3-a58b-d1e35309a083.jsonl, updated_at=2026-09-25T09:35:05+00:00, thread_id=01a0cbd7-368a-76a3-a58b-d1e35309a083, offline fixes/review passed; production blocked on exact rollback authorization/package)
1155:# Task Group: dsh-agent-core / controlled openai-codex recovery and B7 SB1 continuation
1157:applies_to: cwd=/Users/yanfenma/workspace/project/dsh-agent-core; reuse_rule=the no-replay, credential-domain, and rollback-preimage boundaries generalize, but controller issues, sessions, operation IDs, locks, credentials, and live baseline state are time-sensitive and require fresh supported readback.
1163:- rollout_summaries/2026-10-11T22-16-31-Q4NY-controlled_openai_codex_recovery_and_b7_sb1_continuation.md (cwd=/Users/yanfenma/workspace/project/dsh-agent-core, rollout_path=/Users/yanfenma/.codex/sessions/2026/10/12/rollout-2026-10-12T06-16-31-01a12d09-fa37-7c51-9255-631ae941330a.jsonl, updated_at=2026-10-12T00:02:41+00:00, thread_id=01a12d09-fa37-7c51-9255-631ae941330a, temporary recovery/canary passed; permanent B7 completion unachieved)
1173:- rollout_summaries/2026-10-11T22-16-31-Q4NY-controlled_openai_codex_recovery_and_b7_sb1_continuation.md (cwd=/Users/yanfenma/workspace/project/dsh-agent-core, rollout_path=/Users/yanfenma/.codex/sessions/2026/10/12/rollout-2026-10-12T06-16-31-01a12d09-fa37-7c51-9255-631ae941330a.jsonl, updated_at=2026-10-12T00:02:41+00:00, thread_id=01a12d09-fa37-7c51-9255-631ae941330a, `REGISTERED_ONLY`; no execution or maintenance window)
1230:applies_to: cwd=/Users/yanfenma/workspace/project/dsh-agent-core (primary work) plus ~/.agents, ~/.claude, ~/.codex, ~/.openclaw; reuse_rule=loader roots, catalog counts, symlink targets, and upstream pins are time-specific; classify-first, hash-guarded migration and validation boundaries generalize.
1236:- rollout_summaries/2026-09-25T10-49-10-VWlm-skill_audit_openclaw_isolation_and_targeted_optimization.md (cwd=/Users/yanfenma/workspace/project/dsh-agent-core, rollout_path=/Users/yanfenma/.codex/sessions/2026/09/25/rollout-2026-09-25T18-49-10-01a0d82e-f2ec-7c83-9e00-0a2f58e59b8c.jsonl, updated_at=2026-09-25T11:41:40+00:00, thread_id=01a0d82e-f2ec-7c83-9e00-0a2f58e59b8c, 64/64 hash-preserved migration and independent verification)
1246:- rollout_summaries/2026-09-25T10-49-10-VWlm-skill_audit_openclaw_isolation_and_targeted_optimization.md (cwd=/Users/yanfenma/workspace/project/dsh-agent-core, rollout_path=/Users/yanfenma/.codex/sessions/2026/09/25/rollout-2026-09-25T18-49-10-01a0d82e-f2ec-7c83-9e00-0a2f58e59b8c.jsonl, updated_at=2026-09-25T11:41:40+00:00, thread_id=01a0d82e-f2ec-7c83-9e00-0a2f58e59b8c, official-validator/candidate checks passed; external acceptance not run)
1340:- svc-workflow, launch-readiness, WEC, QUEUE.json, canonical backlog r78, NONE_ADMITTED, mutation concurrency 1, business_acceptance=NO, forward-only-recovery, TEST_DATABASE_URL
1371:# Task Group: dsh-agent-core / article-publisher outcome_unknown recovery and Lark V3 external-image canary
1373:applies_to: cwd=/Users/yanfenma/workspace/project/dsh-agent-core; reuse_rule=Agent/session coordinates, deployment bytes, candidate seals, and lane state are time-specific; no-replay, exact termination proof, and production-canary boundaries generalize.
1379:- rollout_summaries/2026-09-15T12-11-47-LWzk-outcome_unknown_recovery_and_lark_canary_freeze.md (cwd=/Users/yanfenma/workspace/project/dsh-agent-core, rollout_path=/Users/yanfenma/.codex/sessions/2026/09/15/rollout-2026-09-15T20-11-47-01a0a4fa-ff16-7bb1-a0ac-4b165d28998e.jsonl, updated_at=2026-09-18T23:03:05+00:00, thread_id=01a0a4fa-ff16-7bb1-a0ac-4b165d28998e, real Feishu E2E and production store readback passed)
1389:- rollout_summaries/2026-09-15T12-11-47-LWzk-outcome_unknown_recovery_and_lark_canary_freeze.md (cwd=/Users/yanfenma/workspace/project/dsh-agent-core, rollout_path=/Users/yanfenma/.codex/sessions/2026/09/15/rollout-2026-09-15T20-11-47-01a0a4fa-ff16-7bb1-a0ac-4b165d28998e.jsonl, updated_at=2026-09-18T23:03:05+00:00, thread_id=01a0a4fa-ff16-7bb1-a0ac-4b165d28998e, production mutation freeze stopped the canary)
1405:- Exact termination proof is distinct from business outcome. Valid proof is exact terminal plus trusted same-session idle, exact queue removal, or exact child real exit; kill requested/sent, elapsed time, idle alone, or missing PID are insufficient. Recovery is parent-Runtime-owned, outside ordinary prompt admission, settles once, and old-generation late events cannot affect a newer generation.
1418:# Task Group: dsh-agent-core / WORKFLOW_ACTIVE_POOL_DISPOSITION_V1 frozen release readiness
1420:applies_to: cwd=/Users/yanfenma/workspace/project/dsh-agent-core; reuse_rule=counts, frozen SHAs, preimages, runtime generation, and admin status are time-specific; active predicate and frozen-release gates generalize.
1426:- rollout_summaries/2026-09-15T23-02-33-DCUY-workflow_active_pool_frozen_release_readiness_partial.md (cwd=/Users/yanfenma/workspace/project/dsh-agent-core, rollout_path=/Users/yanfenma/.codex/archived_sessions/rollout-2026-09-16T07-02-33-01a0a74e-ca7d-7852-a31c-d6f81e820e4c.jsonl, updated_at=2026-09-16T23:37:27+00:00, thread_id=01a0a74e-ca7d-7852-a31c-d6f81e820e4c, read-only census; no HR query or mutation)
1436:- rollout_summaries/2026-09-15T23-02-33-DCUY-workflow_active_pool_frozen_release_readiness_partial.md (cwd=/Users/yanfenma/workspace/project/dsh-agent-core, rollout_path=/Users/yanfenma/.codex/archived_sessions/rollout-2026-09-16T07-02-33-01a0a74e-ca7d-7852-a31c-d6f81e820e4c.jsonl, updated_at=2026-09-16T23:37:27+00:00, thread_id=01a0a74e-ca7d-7852-a31c-d6f81e820e4c, plan/fixtures passed; admin authorization incomplete)
1461:# Task Group: dsh-agent-core / frozen Product Authority review target verification
1463:applies_to: cwd=/Users/yanfenma/workspace/project/dsh-agent-core; reuse_rule=branches, commits, candidate bytes, and remote visibility are time-specific; stale-target stop rule generalizes.
1469:- rollout_summaries/2026-09-13T15-54-04-tt9L-frozen_g1_review_target_stale.md (cwd=/Users/yanfenma/workspace/project/dsh-agent-core, rollout_path=/Users/yanfenma/.codex/sessions/2026/09/13/rollout-2026-09-13T23-54-04-01a09b79-c6ac-7bd0-a2da-363e630fb2e9.jsonl, updated_at=2026-09-13T15:54:55+00:00, thread_id=01a09b79-c6ac-7bd0-a2da-363e630fb2e9, stale/unverifiable target; stopped before semantics)
1492:# Task Group: dsh-agent-core / Workflow real dispatch chain closure
1494:applies_to: cwd=/Users/yanfenma/workspace/project/dsh-agent-core; reuse_rule=PR heads, deployed runtime capability, instance state, and accepted authority require fresh verification; fail-closed execution and outcome-unknown rules generalize.
1500:- rollout_summaries/2026-09-09T14-17-05-n76Z-workflow_real_dispatch_closure_blocked_at_owner_and_review_g.md (cwd=/Users/yanfenma/workspace/project/dsh-agent-core, rollout_path=/Users/yanfenma/.codex/sessions/2026/09/09/rollout-2026-09-09T22-17-05-01a08687-8bb1-7b31-afd5-15c1b31e43c5.jsonl, updated_at=2026-09-09T20:51:31+00:00, thread_id=01a08687-8bb1-7b31-afd5-15c1b31e43c5, candidate validated locally; review/authority blockers remain)
1510:- rollout_summaries/2026-09-09T14-17-05-n76Z-workflow_real_dispatch_closure_blocked_at_owner_and_review_g.md (cwd=/Users/yanfenma/workspace/project/dsh-agent-core, rollout_path=/Users/yanfenma/.codex/sessions/2026/09/09/rollout-2026-09-09T22-17-05-01a08687-8bb1-7b31-afd5-15c1b31e43c5.jsonl, updated_at=2026-09-09T20:51:31+00:00, thread_id=01a08687-8bb1-7b31-afd5-15c1b31e43c5, Goal marked blocked after repeated review-service failure)
1537:scope: attachment-derived, read-only governance census across dsh-agent-core, svc-workflow, auth-service, and agent-forum; use before selecting one next write item per repository.
1602:# Task Group: dsh-agent-core / Visit Activation production deployment recovery
1604:applies_to: cwd=/Users/yanfenma/workspace/project/dsh-agent-core (also svc-workflow, deployment-artifacts, and the designated OpenClaw workspace); reuse_rule=Principal mapping, frozen SHAs, database state, receipt, process state, and authorization are time-sensitive—revalidate before any privileged action and never replay an unknown attempt.
1610:- rollout_summaries/2026-09-05T05-18-38-03uk-visit_activation_production_deployment_preflight_partial.md (cwd=/Users/yanfenma/workspace/project/dsh-agent-core, rollout_path=/Users/yanfenma/.codex/archived_sessions/rollout-2026-09-05T13-18-38-01a07001-26f2-71b3-a6f4-94c37d10cd44.jsonl, updated_at=2026-09-05T08:37:56+00:00, thread_id=01a07001-26f2-71b3-a6f4-94c37d10cd44, identity decision established; deployment outcome remains unobserved)
1620:- rollout_summaries/2026-09-05T05-18-38-03uk-visit_activation_production_deployment_preflight_partial.md (cwd=/Users/yanfenma/workspace/project/dsh-agent-core, rollout_path=/Users/yanfenma/.codex/archived_sessions/rollout-2026-09-05T13-18-38-01a07001-26f2-71b3-a6f4-94c37d10cd44.jsonl, updated_at=2026-09-05T08:37:56+00:00, thread_id=01a07001-26f2-71b3-a6f4-94c37d10cd44, native read-only preflight passed; final apply has no captured receipt)
1645:# Task Group: dsh-agent-core / HR dispatch delivery readiness and minimal Session Messaging authority
1647:applies_to: cwd=/Users/yanfenma/workspace/project/dsh-agent-core (isolated worktree=/Users/yanfenma/workspace/worktrees/hr-dispatch-delivery-readiness-v1, with auth-service); reuse_rule=the candidate SHA, active client, protected Auth state, and production gates are time-sensitive; do not treat local tests or an imported denial as live authorization proof.
1653:- rollout_summaries/2026-09-05T07-36-16-AFyB-hr_dispatch_delivery_readiness_census.md (cwd=/Users/yanfenma/workspace/project/dsh-agent-core, rollout_path=/Users/yanfenma/.codex/archived_sessions/rollout-2026-09-05T15-36-16-01a0707f-2625-76d1-a1bf-3ed4cb173945.jsonl, updated_at=2026-09-05T07:47:12+00:00, thread_id=01a0707f-2625-76d1-a1bf-3ed4cb173945, fixture verified; HR authority candidate REVISE and production held)
1678:# Task Group: dsh-agent-core / production Harness skill catalog root diagnosis
1680:applies_to: cwd=/Users/yanfenma/workspace/project/dsh-agent-core (diagnostic worktree=/Users/yanfenma/workspace/project/dsh-agent-core-skill-catalog-parity-v1); reuse_rule=production child environment and catalog contents are time-specific; the experimental branch is explicitly not reusable implementation authority.
1686:- rollout_summaries/2026-09-02T23-52-45-IeTq-skill_catalog_root_drift_ab_test.md (cwd=/Users/yanfenma/workspace/project/dsh-agent-core, rollout_path=/Users/yanfenma/.codex/archived_sessions/rollout-2026-09-03T07-52-45-01a0648a-13dd-7151-a888-13e91bee6c34.jsonl, updated_at=2026-09-03T01:11:43+00:00, thread_id=01a0648a-13dd-7151-a888-13e91bee6c34, read-only A/B proof; experimental branch abandoned)
1710:# Task Group: dsh-agent-core / Master Goal acceptance, exact-head merge, and paused workflow recovery
1712:applies_to: cwd=/Users/yanfenma/workspace/project/dsh-agent-core; reuse_rule=acceptance heads and lane state are checkout/time-specific; fresh-read governing pins and production state before any action.
1718:- rollout_summaries/2026-09-02T16-26-41-FhAv-core_runtime_master_goal_acceptance_merge_and_auth_prereq.md (cwd=/Users/yanfenma/workspace/project/dsh-agent-core, rollout_path=/Users/yanfenma/.codex/archived_sessions/rollout-2026-09-03T00-26-41-01a062f1-ae1b-78c2-944c-560dd77c9113.jsonl, updated_at=2026-09-03T01:44:09+00:00, thread_id=01a062f1-ae1b-78c2-944c-560dd77c9113, PR #147/#149 merged; workflow lane paused)
1741:# Task Group: dsh-agent-core / Agent Session Messaging V1 outcome governance
1743:applies_to: cwd=/Users/yanfenma/workspace/project/dsh-agent-core (implementation worktree=/Users/yanfenma/workspace/project/wt-ssend-impl); reuse_rule=exact branch/head and production state are time-sensitive; final candidate is integration-ready, not merged or deployed.
1749:- rollout_summaries/2026-09-02T14-47-57-RRx9-agent_session_messaging_independent_audit_ready_for_integrat.md (cwd=/Users/yanfenma/workspace/project/dsh-agent-core, rollout_path=/Users/yanfenma/.codex/archived_sessions/rollout-2026-09-02T22-47-57-01a06297-4a32-7331-ae07-a13bfae512f3.jsonl, updated_at=2026-09-02T15:18:42+00:00, thread_id=01a06297-4a32-7331-ae07-a13bfae512f3, integration-ready; merge/deployment not run)
1759:- rollout_summaries/2026-09-02T16-26-41-FhAv-core_runtime_master_goal_acceptance_merge_and_auth_prereq.md (cwd=/Users/yanfenma/workspace/project/dsh-agent-core, rollout_path=/Users/yanfenma/.codex/archived_sessions/rollout-2026-09-03T00-26-41-01a062f1-ae1b-78c2-944c-560dd77c9113.jsonl, updated_at=2026-09-03T01:44:09+00:00, thread_id=01a062f1-ae1b-78c2-944c-560dd77c9113, prerequisite identified; no Auth mutation)
1785:# Task Group: dsh-agent-core / PR #96 workflow transition and PR #97 Forum moderation fixed-SHA audits
1787:applies_to: cwd=/Users/yanfenma/workspace/project/dsh-agent-core; reuse_rule=SHA, branch, PR state, and svc-workflow revision are time-sensitive; reuse the audit method and failure shields only after re-pinning remote refs and governing Specs.
1793:- rollout_summaries/2026-08-28T14-38-36-F0Ib-pr97_forum_moderation_fixed_sha_audit_revise.md (cwd=/Users/yanfenma/workspace/project/dsh-agent-core, rollout_path=/Users/yanfenma/.codex/archived_sessions/rollout-2026-08-28T22-38-36-01a048ce-f18c-7920-b00d-eba808825cfb.jsonl, updated_at=2026-08-28T14:51:24+00:00, thread_id=01a048ce-f18c-7920-b00d-eba808825cfb, fixed-SHA implementation audit REVISE)
1817:# Task Group: dsh-agent-core / controlled Z.AI GLM-5.3 production cutover and human Feishu smoke
1819:applies_to: cwd=/Users/yanfenma/workspace/project/dsh-agent-core with runtime assets under `/Users/yanfenma/.agent-core`; reuse_rule=production state is time-sensitive; revalidate actual runtime and wait for requested Owner actions.
1825:- rollout_summaries/2026-08-20T12-43-33-W8Zw-glm53_human_feishu_retry_paused_at_smoke.md (cwd=/Users/yanfenma/workspace/project/dsh-agent-core, rollout_path=/Users/yanfenma/.codex/sessions/2026/08/20/rollout-2026-08-20T20-43-33-01a01f32-ba30-72f0-9246-9f1a76d84b96.jsonl, updated_at=2026-08-20T13:19:00+00:00, thread_id=01a01f32-ba30-72f0-9246-9f1a76d84b96, cutover passed; paused pending Owner human smoke)
1849:# Task Group: dsh-agent-core / ChatGPT subscription provider Spec, target-only rollback, and docs-only acceptance review
1851:applies_to: cwd=/Users/yanfenma/workspace/project/dsh-agent-core; reuse_rule=accepted-Spec governance and isolation checks are reusable; exact commits, tarball hash, DSH/plugin compatibility, and production activation prerequisites must be re-pinned before reuse.
1857:- rollout_summaries/2026-08-18T23-21-45-gmHQ-chatgpt_subscription_provider_spec_and_implementation_merge.md (cwd=/Users/yanfenma/workspace/project/dsh-agent-core, rollout_path=/Users/yanfenma/.codex/sessions/2026/08/19/rollout-2026-08-19T07-21-45-01a0172e-4ed1-79e0-a3f5-61bde53974b6.jsonl, updated_at=2026-08-19T14:20:13+00:00, thread_id=01a0172e-4ed1-79e0-a3f5-61bde53974b6, complete Spec ancestry merged at `eaebb28`)
1867:- rollout_summaries/2026-08-18T23-21-45-gmHQ-chatgpt_subscription_provider_spec_and_implementation_merge.md (cwd=/Users/yanfenma/workspace/project/dsh-agent-core, rollout_path=/Users/yanfenma/.codex/sessions/2026/08/19/rollout-2026-08-19T07-21-45-01a0172e-4ed1-79e0-a3f5-61bde53974b6.jsonl, updated_at=2026-08-19T14:20:13+00:00, thread_id=01a0172e-4ed1-79e0-a3f5-61bde53974b6, PR #18 merged; `origin/main=fe2c639`)
1892:- Symptom: isolated smoke fails despite implementation correctness. Cause: a temp path did not end in `dsh-agent-core` or lacks the Harness bridge. Fix: use a repository-compatible temporary path, temporary `DSH_HOME`, pinned Harness, and `npm run install:integration`; serialize real-boot tests with `node --test --test-concurrency=1` because shared gitignored bridge state flakes in parallel. [Task 2]
1935:# Task Group: dsh-agent-core / HR Dispatcher fenced-occurrence diagnosis and termination-only recovery
1937:applies_to: cwd=/Users/yanfenma/workspace/project/dsh-agent-core; reuse_rule=job IDs, Runtime PIDs, store state, Router disposition, and sudo boundaries require fresh verification; termination-only method is safe only under its exact preconditions.
1943:- rollout_summaries/2026-09-13T05-28-21-XLji-hr_dispatcher_termination_only_recovery.md (cwd=/Users/yanfenma/workspace/project/dsh-agent-core, rollout_path=/Users/yanfenma/.codex/archived_sessions/rollout-2026-09-13T13-28-21-01a0993c-ea35-75d1-9bc0-cc97914a3fd0.jsonl, updated_at=2026-09-14T21:33:38+00:00, thread_id=01a0993c-ea35-75d1-9bc0-cc97914a3fd0, constrained production recovery passed)
1969:# Task Group: dsh-agent-core / dispatch session traceability V2 implementation and production canary
1971:applies_to: cwd=/Users/yanfenma/workspace/project/dsh-agent-core; reuse_rule=deployment SHAs, artifacts, PIDs, and canary coordinates are time-specific; coordinate, read boundary, and excluded-drift safeguards generalize.
1977:- rollout_summaries/2026-09-14T00-11-38-H2oV-dispatch_session_traceability_v2_production_canary.md (cwd=/Users/yanfenma/workspace/project/dsh-agent-core, rollout_path=/Users/yanfenma/.codex/archived_sessions/rollout-2026-09-14T08-11-38-01a09d41-4f7f-70d1-b4d9-bca0a2aacf39.jsonl, updated_at=2026-09-15T14:16:48+00:00, thread_id=01a09d41-4f7f-70d1-b4d9-bca0a2aacf39, implementation, deployment, and canary passed)

exec
/bin/zsh -lc "pwd; git status --short; git branch --show-current; git rev-parse HEAD; git rev-parse origin/main; rg --files -g 'AGENTS.md' -g 'SPEC_FORMAT_V0*' -g '*AGENT_CORE_ADMISSION_RUNTIME_RELIABILITY_V1*'" in /tmp/review-609/repo
 succeeded in 398ms:
/private/tmp/review-609/repo
docs/554-admission-runtime-spec-r4
7f4cf5b5e3ea9ada879617d506e3c921cefe8308
937d9cbc58431fe8421405066f04b2a226928ee6
AGENTS.md
docs/specs/AGENT_CORE_ADMISSION_RUNTIME_RELIABILITY_V1.md

exec
/bin/zsh -lc "cat AGENTS.md; nl -ba docs/specs/AGENT_CORE_ADMISSION_RUNTIME_RELIABILITY_V1.md; rg --files docs | rg 'SPEC_FORMAT|WORKFLOW_EXECUTION|DISPATCH|ADMISSION|SESSION.*ADMISSION|SRA|SOD'; git diff --stat origin/main...HEAD; git remote -v" in /tmp/review-609/repo
 succeeded in 0ms:
# Agent entrypoint

Before non-mechanical work in `mayf3/dsh-agent-core`:

1. read `.agents/README.md` (vendored shared grammar);
2. read `.agents/local/README.md` (this repository's authority and constraints);
3. read the directly relevant Product Architecture, current Decisions, and accepted governing Specs;
4. read `.agents/skills/spec-governance/SKILL.md` and only the selected mode file.

For `REUSE`, implement within the existing accepted implementation-authorizing
Contracts in the base; an in-contract bug fix needs no new Spec. A bounded
`AMEND/NEW + ROUTINE/DURABLE` may combine its Spec delta and code only under the
active local permission described in `.agents/local/README.md`. `CONTROLLED`
changes and every `SUPERSEDE` remain docs-first. A proposed adoption branch does
not activate that permission or authorize product implementation.

Do not treat code, tests, runtime state, chat history, the newest-looking document, or an unmerged accepted-looking branch as higher authority than the repository's accepted local authorities.

When authority conflicts or drift are found, stop the dependent work and report the concrete conflict; unrelated authorized work may continue. Do not silently choose a side or rewrite accepted meaning under the same stable ID.
     1	---
     2	spec_id: AGENT_CORE_ADMISSION_RUNTIME_RELIABILITY_V1
     3	status: proposed
     4	spec_kind: implementation
     5	authority_level: governing_spec
     6	implementation_authority: contracts
     7	production_apply_authority: none
     8	scope:
     9	  - mayf3/dsh-agent-core
    10	  - optional history bind resilience and managed admission directory convergence for issue 554
    11	governed_by:
    12	  - AGENT_CORE_PRODUCT_ARCHITECTURE_V1
    13	  - AGENT_CORE_INTERNAL_AGENT_DIRECTORY_V1
    14	  - PRODUCT_API_AUTHENTICATION_V1
    15	external_authorities: []
    16	supersedes: []
    17	superseded_by: null
    18	owners: [mayf3]
    19	---
    20	
    21	# AGENT_CORE_ADMISSION_RUNTIME_RELIABILITY_V1
    22	
    23	## 1. Goal 与当前效力
    24	
    25	消除可选 history bind 故障拖死 admission 的事故类别，并让 Workflow admission
    26	摆脱 gui 域、源码 checkout 辅 runtime 的单点生命周期依赖。终态复用当前受管
    27	production runtime 上的既有 IAD，不另造目录服务、身份模型或发布控制器。
    28	
    29	本稿是 #554 r4 的 **proposed implementation-authorizing Spec**：
    30	`implementation_authority: contracts` 仅在独立语义审阅、Owner/明确授权 maintainer
    31	绑定 exact reviewed/final head 接受且进入实现 base 后生效。当前不允许实现、merge、
    32	部署、重启、切换 env 或删除 aux；本稿本身永远不是生产操作 mandate。
    33	
    34	```text
    35	SPEC_GOVERNANCE_MODE = AUTHOR
    36	AUTHORITY_ACTION = NEW
    37	AUTHORITY_OWNERSHIP = resolved
    38	ROUTE_STAGE = AUTHORITY_AUTHORING
    39	AUTHORITY_ACCEPTED_IN_BASE = NO
    40	PLAN_LEVEL = EXEC_PLAN
    41	ASSURANCE_LEVEL = CONTROLLED
    42	DOCS_FIRST_REQUIRED = YES
    43	IMPLEMENTATION_READY = NO
    44	PRODUCTION_READY = NO
    45	SPEC_ACCEPTANCE = PENDING
    46	```
    47	
    48	## 2. Scope 与非目标
    49	
    50	- Scope A：保留 PR #555 已接受并合入的 async bind containment；补齐
    51	  `e9a61dee` 的 bounded-retry/专用测试余项及其必要的 shutdown 边界。
    52	- Scope B：冻结终态承载、明确到仓的迁移责任、aux 退出 admission 的边界；
    53	  给出可由后续实现和独立生产 mandate 验收的条件。
    54	- 不改 IAD wire/auth/snapshot/deadline/no-cache/no-retry，不改变 Workflow 业务授权、
    55	  Principal/Grant、history Tailnet identity/activation 或已有错误码。
    56	- 不承诺所有生产故障零停机或全局 HA；本目标针对 **aux 生命周期单点依赖**。
    57	  production runtime 自身的停机和 Auth/JWKS 故障仍按既有 authority fail-closed。
    58	- 不复活关闭的 B7 发布线，不新增 watcher/watchdog、映射库、影子 registry、
    59	  directory 专用 SERVICE/Client 或第二生产 writer；不在此治理其他 aux 业务退役、
    60	  Scheduler UNKNOWN 清理或历史工件 watchdog 的全局移除。
    61	
    62	## 3. Authority、授权输入与版本边界
    63	
    64	所有仓内 authority/源码引用以 Core base
    65	`f767e8d6608cdb0917aad2d471ba0454d0966a0f` 为观察坐标：
    66	
    67	| 约束来源 | 本稿关系 |
    68	|---|---|
    69	| [Product Architecture](../AGENT_CORE_PRODUCT_ARCHITECTURE_V1.md) | 保留 Core Registry/Definition ownership、薄层和外部 Workflow 业务边界 |
    70	| [IAD V1](AGENT_CORE_INTERNAL_AGENT_DIRECTORY_V1.md) CTR-IAD-001..006 | 保留 production server 上 exact directory、generic internal caller、权威同步 snapshot、fresh/no-store/no-auto-retry、独立 release/rollback |
    71	| [Product API Authentication V1](PRODUCT_API_AUTHENTICATION_V1.md) CTR-PA-001/009/010 | Product API loopback-only；history-only Tailnet listener/default-off/activation/restart-only generation 不变 |
    72	| [Production Deployment Control Plane V1](PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1.md) | accepted source framework 的 artifact/profile/mutex 边界；production_apply_authority 仍为 none，不证明已安装可调用 |
    73	| [Delivery Resilience V1](AGENT_DELIVERY_RESILIENCE_V1.md) | 其明确排除的 #554 admission 拓扑由本稿单独处理，不扩展 delivery retry |
    74	| [仓库本地治理](../../.agents/local/README.md) | docs-first、独立审阅、可归属 mandate、唯一 writer；治理流程输入不提升为 Product Contract |
    75	
    76	本稿为 NEW：此前没有独立冻结 post-B7 aux 退出和 admission 承载收敛的 bounded
    77	Decision；不修改 IAD accepted CTR-IAD-001..006 或 history activation 的既有含义，
    78	因此 `supersedes: []`，不执行 partial supersession。IAD 文内 #525
    79	CTR-IAD-007/008 在本 base 明标 proposed；本稿不会通过复述源码把它们标成 accepted，
    80	也不修写 IAD 的历史状态文字。若后续必须改变 accepted 意义，应另走 whole-authority
    81	SUPERSEDE，本稿不能充当豁免。
    82	
    83	设计授权输入：
    84	
    85	- [#554 c6595519762](https://github.com/mayf3/dsh-agent-core/issues/554#issuecomment-6595519762)
    86	  持久化 Owner “按 agent 侧专业建议办”与 Scope A 余项收尾。
    87	- r3/r4 任务补正明确解释为**设计权已授给工程侧**：本稿负责推荐三项具体设计，
    88	  不要求先行推荐方案原文。r4 同时允许自行修正 r3 的 CLI 参数笔误。
    89	  本轮将该解释随本稿/PR 持久化，替代 r2 的“须定位先行文档”任务前提。
    90	- 这些输入授权 authoring，推荐设计仍待本稿 exact-head 接受；不是对本文全部
    91	  Contracts 的预先接受，也不是生产权限。
    92	- svc-workflow 和 agent-control 的职责见 CTR-ARR-005；本稿约束 Core 的交付与终态
    93	  接受，**不单方面授权其他仓源码或生产操作**。各仓须以自己的 active authority
    94	  和明确 mandate 接续。没有新增直接 external-authority pin；IAD 原有 Auth dependency
    95	  原样保留，不复制或重定其规范。
    96	
    97	## 4. 已修 / 未修与 Evidence
    98	
    99	### OBS-ARR-001 — source 范围核查
   100	
   101	- Source：Core Git objects、当前源码；environment：独立 clone，非生产；
   102	  observed：2026-11-03；method：exact object/ancestry/diff/path read。
   103	- Range：`fa4510beb6b01e5c40000a2ae36a62c526759e76` →
   104	  `ce1d13c1e8585759c6a5f194fb5553d990574b5b` → 上述 base。
   105	  fresh fetch/remote main 与 base 一致。
   106	
   107	| 子问题 | fa4510be | ce1d13c1 / 本 base | 判定 |
   108	|---|---|---|---|
   109	| history async bind containment | 无 server error handler | 有；handler 在 listen 前 | 已修，`0ffb21754500551923be73ba88b6382474fb6b0b` 经 PR #555 / merge `3c651a6ea4cab45d9c8520f6ecc92f9478312eab` |
   110	| bounded retry / 专用 bind-resilience tests | 无 | 无 | `e9a61deea1a01790d11a665e3e2fb5186ab6c5fc` 非 ce1/main ancestor；余项待集成 |
   111	| exact IAD route 与 production composition | 已有 | 已有 | 不新增重复目录路由 |
   112	| #525 missing-JWKS composition guard / health observations | 无该增量 | 已集成 | `0e440f83` → `893d6f37` → PR #604 / merge ce1d13c1；不等于 CTR-IAD-007/008 接受或终态迁移 |
   113	
   114	可复核源码：
   115	[history-listener.js](../../packages/product-api/src/history-listener.js) 的 server error/listen；
   116	[Product API mount](../../packages/product-api/src/index.js) 的 history 异步 mount/disposal；
   117	[workflow-admission.js](../../packages/product-api/src/workflow-admission.js) 的 exact route；
   118	[compose.js](../../packages/production-runtime/src/compose.js) 的 Definition/handler/Product API；
   119	[product-api-admission.js](../../packages/production-runtime/src/identity/product-api-admission.js)
   120	的 composition seam。history blob 从 `9abdd61fc14c0d556352a57a8baff19673d72dc2`
   121	变为 `e5e372276bdc4bc61e097466479b82d122976a64`；后者在 ce1/base 相同。
   122	
   123	### OBS-ARR-002 — 已通过历史修复与余项的证据边界
   124	
   125	[PR #555 证据](https://github.com/mayf3/dsh-agent-core/pull/555#issuecomment-6370558723)
   126	及 [Scope A source closure](https://github.com/mayf3/dsh-agent-core/issues/554#issuecomment-6370660745)
   127	记录 exact `0ffb2175` 的 RED/GREEN、differential regression、独立 review 与 source merge。
   128	这是历史结果，本轮没有重新执行其测试或生产 canary。历史 aux 安装/业务成功只证明当时
   129	partial-aux tuple，不证明当前生产。
   130	
   131	直接读取 e9a61dee 的 diff 可见：初次失败后最多 30 次、60 秒间隔、unref timer 的
   132	重试草图，以及不可路由 bind/loopback bind 两个测试；没有完整验证 retry exhaustion、
   133	取消 timer 或 admission 连续性。因此它是可复用起点，不是可直接宣布本稿全部 Acceptance
   134	通过的证据，也不得使已接受 containment 重新变成未修。
   135	
   136	### OBS-ARR-003 — 设计输入与机制边界
   137	
   138	Source：#554 正文及截至本轮的全部 12 条评论、c6595519762、r3/r4 task，
   139	2026-11-03 read；以及 pinned-base 机制源码/历史 runbook（第 9 节）。
   140	历史 issue 的 8787→8788 代表当时部署观察；本 base Product API 默认 8787、
   141	optional history 默认 8788。默认值或历史端口不能识别当前生产 server 角色。
   142	
   143	### STATE-ARR-001 与 Claims
   144	
   145	- 本 base：containment SOURCE_MERGED；retry/test remainder NOT_IN_MAIN；
   146	  directory source PRESENT；Scope B installed/loaded/consumer/business = UNKNOWN。
   147	- 本轮无生产读取、无测试/服务启动。未见当前工件、loaded env、controller slot、
   148	  consumer wiring 或 live business receipt；不把未知写成“尚不存在”。
   149	- CLM-ARR-001，SUPPORTED：真实 source 增量是余项集成，不是重新修 containment/
   150	  新增 IAD；依据 EVD-ARR-001。
   151	- CLM-ARR-002，INFERRED design rationale：受管同一权威 Definition 的生产承载加
   152	  aux admission retirement 能消除已描述的 gui/checkout 故障耦合；依据 EVD-ARR-002。
   153	  这是待接受设计判断，未证明现网已达到。
   154	- CLM-ARR-003，SUPPORTED：工程侧有提出三项推荐的 authoring 授权；
   155	  不等于 Spec 已接受；依据 EVD-ARR-003。
   156	
   157	| Evidence ID | Source → target / relation | 坐标、充分性与限制 |
   158	|---|---|---|
   159	| EVD-ARR-001 | OBS-ARR-001/002 → CLM-ARR-001、STATE-ARR-001 / SUPPORTS | 上述 Git range/base 与 PR receipt；足够划分 source 已修/余项，不支持当前安装/业务 |
   160	| EVD-ARR-002 | OBS-ARR-003、IAD 001/003/005 → CLM-ARR-002 / SUPPORTS rationale | base + issue 历史；支持设计动机，runtime 可用性/迁移尚无执行证据 |
   161	| EVD-ARR-003 | OBS-ARR-003 → CLM-ARR-003 / SUPPORTS | c6595519762 + 本轮 r3/r4 authoring mandate；仅足够进入 AUTHOR，acceptance/production 权限仍无 |
   162	
   163	## 5. 三项推荐设计
   164	
   165	三项 Decision 的 decision owner 为 Core Owner/授权 maintainer；engineering 在本稿中
   166	选择推荐，接受前不生效。没有等待补写的规范选择；具体生产坐标属于未来操作 preflight。
   167	
   168	### DEC-ARR-001 — 终态承载
   169	
   170	选择：**当前受管 production runtime 的既有 loopback Product API/IAD**，由当前
   171	受信发布控制器持有其 artifact/generation/lifecycle；读取该 runtime 的权威 Definition。
   172	history 保持独立 optional listener，不能成为目录的启动/重试/ready 前置。
   173	
   174	理由：复用已存在且 accepted 的 IAD 认证/观察和 Core ownership，去除 gui/checkout
   175	耦合，不增加权威数据副本。这里“受管”要求实际可绑定工件与 loaded generation；
   176	进程名字或端口不构成证明。
   177	
   178	| 备选 | 取舍 |
   179	|---|---|
   180	| 保留 gui aux 为长期主路或 hot fallback | 拒绝：保留本次要消除的生命周期与 checkout 依赖 |
   181	| 新建独立 directory daemon/registry mirror | 拒绝：增加独立模型、snapshot 一致性和运维面，本目标不需要 |
   182	| managed production runtime 上既有 IAD | 推荐：最小机制复用，仍以安全 fail-closed 承受其自身停机 |
   183	
   184	### DEC-ARR-002 — 迁移责任明确到仓
   185	
   186	选择 Core producer/既有 DS release authority、svc-workflow consumer、agent-control
   187	跨仓协调的分工（CTR-ARR-005），在 #554 同一业务 lineage 留下 producer→consumer→retirement
   188	证据。生产只允许当前有效授权面的一位 writer，不沿用旧 #525/B7 的已关闭授权。
   189	
   190	理由：Core 不能把 consumer env“默认为外部已切”，svc-workflow 不能凭 /health 选目录，
   191	controller 不能用工件安装代替业务证明。
   192	
   193	| 备选 | 取舍 |
   194	|---|---|
   195	| Core 单仓宣布业务迁移完成 | 拒绝：不拥有 Workflow 业务配置与 commit 判断 |
   196	| 复活旧 B7 或另起独立发布平台 | 拒绝：旧授权不可转用，产生并行 writer |
   197	| 三仓各自 authority、同一受控交接 | 推荐：责任可审计，接受与执行权限保持分离 |
   198	
   199	### DEC-ARR-003 — aux 的退出边界
   200	
   201	选择：aux 的 **admission directory 承载角色 MIGRATE → RETIRE**；终态所有受影响
   202	consumer 的 normal/fallback/restart/recovery 都不能依赖或重建此角色。aux 上经独立
   203	authority 支持的其他职责 RETAIN，不默认停整进程或删历史。
   204	
   205	允许切换前的显式 TEMPORARY_BRIDGE：只服务经盘点确认的真实旧 consumer，绑定一个
   206	受控切换任务及其结束条件。完成终态接受即退出；任务中止时保留 interim/blocked 状态，
   207	由现有操作责任方处置，不能因超时自动删除，也不能无期限默认为终态。
   208	
   209	| 备选 | 取舍 |
   210	|---|---|
   211	| aux 永久备用/请求失败时自动回切 | 拒绝：复活单点依赖，可能读取另一世代 Definition |
   212	| 无盘点即 shutdown/delete 整个 aux | 拒绝：可能破坏独立职责或尚未迁移 consumer |
   213	| 角色级迁移、负向证明、保留历史与独立职责 | 推荐：退出可验证，范围足够且有界 |
   214	
   215	## 6. Contracts
   216	
   217	以下 MUST/MUST NOT 只在本 Spec 被接受后成为新 obligations。
   218	
   219	### CTR-ARR-001 — 保留 optional containment 与安全边界
   220	
   221	history 同步 mount/listen 失败、异步 bind error、后续 serve error MUST 被该 optional
   222	surface contained，不得成为 uncaught exception 或触发 runtime/admission 的退出、
   223	重启或 gate 失败。未绑定时 history 不可用；不得由“listening”日志冒充成功。
   224	已有 server error handler 语义保留。实现只补真实余项，不重开 PR #555 closure。
   225	
   226	history 的 default-off、Tailnet-only history activation、WhoIs/profile immutable
   227	generation 与 Product API loopback-only 约束 MUST 保持；本稿不自动启用 history、
   228	改 host 为 loopback/wildcard、修改权限、绕过 identity readiness 或重启配置 generation。
   229	
   230	### CTR-ARR-002 — 有界 bind retry、恢复与 teardown
   231	
   232	启用并满足既有 history activation 的 mount，初次 listen 失败后只对
   233	`EADDRNOTAVAIL/EADDRINUSE/EACCES` 这些 **尚未成功绑定的 bind error** 重试：
   234	固定 60,000 ms 间隔，最多 30 次追加 listen（初次 + 30，最多 31 次）。
   235	EACCES 仅可等配置外部恢复，绝不 chmod、提权、改端口或改 identity。
   236	
   237	每 mount 同时最多一个 in-flight listen、一个 pending timer，timer MUST unref；成功 listening 后取消 pending
   238	retry、停止该 bind budget；非 allowlist/耗尽进入 history-unavailable，保持 runtime/
   239	admission 存活。成功绑定后的 serve error 只 contained/log，不借此重开 bind budget、
   240	热换 generation 或重启其他 surface。新 mount 的 budget 只能随其合法生命周期重建。
   241	
   242	close/dispose MUST 先标记已停止、清除 timer，再关闭 server；幂等、未绑定可终止。
   243	生产 Product API 的 ctx.effect teardown MUST 进入同一停止/取消边界，不能仅修公开
   244	listener.close() 而仍由现有直接 server.close() 路径绕过；异步 mount 完成与 disposal
   245	交错时也不能留下活动 listener/timer。
   246	已排队 callback 必须复核 mount 未停止且未 listening；同步 listen throw 也 contained，
   247	不得逃逸 timer。日志失败不改变 containment，日志不得泄露 token/profile/credentials。
   248	恢复 bind 仍用本 mount 原 host/port/auth generation，不自动重试 directory/业务请求。
   249	
   250	### CTR-ARR-003 — 受管权威 producer
   251	
   252	终态 IAD MUST 只从当前受管 production runtime 的已审 artifact/loaded generation
   253	对外供受影响 consumer 使用，读取既有权威 Agent Definition；不得依赖 gui aux、
   254	开发 checkout 的文件或进程，或新增持久 mirror/缓存真值。
   255	
   256	沿用 exact `GET /v1/directory/agents/:agentId`、IAD caller/auth/error/1s deadline/
   257	no-store/no-auto-retry 全部语义；不得改用 mobile `/v1/agents`、history listener、
   258	display-name/prefix 猜测或非权威 healthy response。无需新增同功能 route。
   259	
   260	### CTR-ARR-004 — 端点绑定与 release eligibility
   261	
   262	交接 MUST 绑定角色、实际 origin/port、runtime unit、artifact/source hash、loaded
   263	generation、Definition 来源、IAD verifier 配置来源与 consumer 的 base URL；
   264	这是既有 release record 的必要证据，不引入新持久协议/身份。不得记录 Secret 值。
   265	
   266	角色识别 MUST 包含正确受签 caller 的 exact directory 请求及 malformed/unauthorized/
   267	disabled/missing target 负向结果；`/health`=200、端口名、PID、boot marker、
   268	IAD health.ready 均不充分。Product API 保持 loopback-only；本稿不授权跨主机公网暴露，
   269	若实际 consumer 无法在既有允许网络下到达，应停在迁移前，另行处理 authority gap。
   270	“8788”仅当证据证明它是正确 IAD server 时才是可选配置值。
   271	
   272	### CTR-ARR-005 — 仓库责任与权限
   273	
   274	| 仓库/角色 | 必须提供的交接内容 | 不得代行 |
   275	|---|---|---|
   276	| mayf3/dsh-agent-core | producer/retry/tests、rebuildable artifact closure、权威目录及 history 隔离证据 | svc-workflow 业务授权、未经 mandate 的生产写入 |
   277	| mayf3/svc-workflow | 自有 active authority 下核对 admission consumer；准备/应用其 WORKFLOW_ADMISSION_CORE_BASE_URL 切换、fresh observation/commit fail-closed 测试及业务结果 | 新 lookup identity、用 Core health 替代业务验收 |
   278	| mayf3/dsh-agent-core 的既有 DS/release authority 对应操作者 | 在当前有效生产 authority 下绑定唯一 writer、preimage/rollback、drain/canary、apply 与 receipt/readback；未来 mandate 必须 fresh-verify 其 installed callable path | 把 source framework 当已安装控制器、旧 B7/#525 授权复活或另建发布 writer |
   279	| mayf3/agent-control | 跨仓任务/证据交接，绑定上述实际 release owner 和 svc-workflow consumer owner | 不因协调而取得部署/业务权限，不把 Spec 当操作批准 |
   280	| Auth owning repository | 沿用 IAD 的既有 caller issuance/verification 权限；如需自仓变更，走该仓 authority | 本稿不授权新 per-consumer directory Principal/Client/Grant |
   281	
   282	当前 controller 的 installed callable path 未在本轮查证，状态 UNKNOWN；不得假定存在。
   283	上述责任是 Core 接受跨仓交接的条件，不授予其他仓实现权。后续执行须记录具体有效
   284	操作者与 task/slot、exact owning accepted heads；责任未绑定时生产阶段不 ready，
   285	无需再悬置本文三项设计决定。
   286	
   287	### CTR-ARR-006 — 分阶段 consumer 切换与 bridge
   288	
   289	迁移 MUST 依次完成：(1) 冻结受影响 consumer 的 normal/fallback/startup/recovery
   290	配置及真实调用方；(2) producer 工件/隔离 gate；(3) 当前 mandate 下 producer
   291	loaded proof；(4) svc-workflow 单一生效 endpoint 切换与自有业务 canary；
   292	(5) aux admission role 退出及恢复路径负向验收。每阶段持久化 exact tuple，不跳步。
   293	
   294	桥接仅限第 4 步前盘点到的旧 consumer；记录 consumer/责任仓/起始 tuple、切换任务、
   295	退出条件“所有已盘点 consumer 切换并通过第 5 步”及任务 abort 责任。不得新添 bridge
   296	consumer、在一个 admission command 内向两端竞速/多数表决或自动 fallback。task 到期/
   297	abort 不能冒充迁移完成；保留已知 interim truth，交回当前 release owner。
   298	
   299	仅替换 endpoint 不改变原 caller、actor/assignee 校验、事务边界、每 command freshness
   300	或 target exact identity。未知覆盖记 UNKNOWN，不把未盘点当零 consumer。
   301	
   302	### CTR-ARR-007 — aux 角色退役与恢复收敛
   303	
   304	宣布终态前 MUST 证明所有盘点 consumer 的正常调用、fallback、进程重启、controller
   305	恢复及 rollback 配置不会访问/启动 aux admission directory。aux 停止或其历史地址
   306	拒绝连接时，正确 managed producer 上允许/拒绝行为不变，aux 请求数为零。
   307	
   308	retirement 只移除 admission executable eligibility；保留审计/历史 receipts，其他职责
   309	逐项 RETAIN/MIGRATE/RETIRE。不得凭此关闭/删除未经授权的 aux 数据或独立服务。
   310	终态之后 recovery/rollback 只能使用仍符合本拓扑的 last-good managed generation；
   311	需要回到 aux 的 incident containment 必须有独立、显式、临时 Owner 授权，并使终态
   312	conformance 退回不满足，不能伪称普通 rollback。
   313	
   314	### CTR-ARR-008 — 复用 release/drain/fresh-child 机制
   315	
   316	未来发布 MUST 使用当前有效的既有受信 release 路径、bounded reviewed artifact、
   317	共享 mutation slot 和 preimage/rollback/readback。不得 whole-latest-main 部署或重建
   318	第二 installer。需要 planned runtime restart 时复用现有 restart-drain census/
   319	refusal；busy/unavailable/unknown 不得强制越过，也不得为 canary 发起未授权业务。
   320	
   321	assembled candidate 的 closure-resolution 与 fresh-child boot gate按其适用 release
   322	authority 运行；本稿不扩大其 allowlist 或把历史 PASS 复制到新 tuple。其 PASS 之外
   323	仍需 producer runtime/IAD 和 consumer 证据。工件切换不得先 retire 仍被 live boot/
   324	spawn 依赖的 last-good artifact 再留下不可恢复空窗；由既有 controller 证明连续可用，
   325	不以新增 watchdog 代替受控交接。
   326	
   327	### CTR-ARR-009 — 故障、回滚和 UNKNOWN
   328	
   329	producer 不可达、配置/认证失败或权威查询错误时受影响 admission MUST 按既有 owning
   330	语义 fail-closed，不把 transport error 改成 exists:false/业务允许，不读旧 positive
   331	cache，不自动切 aux。目录自身 401/403/409/500/504 和 consumer 的既有业务错误映射
   332	由原 authority 决定，本稿不重定义。
   333	
   334	预切换 gate 失败不切 consumer；切换后失败按 exact preimage/兼容性和当前 mandate
   335	回滚。退役完成前可在该次明确 bridge 范围内恢复冻结的旧 tuple，但应标明
   336	MIGRATION_INCOMPLETE；退役后受 CTR-ARR-007 限制。不得修改或重放历史
   337	outcome_unknown、清 fence、用 termination 冒充业务成功，或为了验证创建未授权业务。
   338	
   339	### CTR-ARR-010 — 证据与完成声明
   340	
   341	每个结果 MUST 分列 source integrated、artifact packaged、installed、loaded、
   342	producer callable、consumer switched、aux role retired、business verified，
   343	并绑定 authority/head/artifact/environment/time/method/actor/原始 receipt。
   344	未执行或不可见为 UNKNOWN/NOT_EXECUTED；测试定义和本稿 Acceptance 表不是执行证据。
   345	
   346	Scope A merged containment 的既有 PASS 保留；新余项用受影响 tests/review，不要求无理由
   347	重跑旧 lifecycle。#554 保持开放，直到 Scope A 余项 source closure 与 Scope B 全部终态
   348	及业务 acceptance 有合格证据；docs PR、独立 authoring review 或 source merge 都不能关单。
   349	
   350	## 7. Acceptance（定义，尚未执行）
   351	
   352	每项结果须绑定后续 candidate SHA、owning accepted Spec revision、环境与执行时间。
   353	本稿交付仅检查定义完整性，不宣称这些运行验收通过。
   354	
   355	| Acceptance / Contracts | Method | Environment / inputs | Required evidence | Expected result | Failure condition |
   356	|---|---|---|---|---|---|
   357	| ACC-ARR-001 / CTR-ARR-001 | child-process fault injection + auth boundary regression | isolated temp home；history disabled、合法 enabled 后 sync listen throw / async EADDRNOTAVAIL / serve error | child exit/liveness、signed IAD request transcript、route/side-effect spies、existing history auth cases | runtime与目录保持存活/原有允许拒绝；history unavailable 不扩权限 | uncaught exit、history failure带走目录、default-on/host/auth改变、日志虚报绑定 |
   358	| ACC-ARR-002 / CTR-ARR-002 | deterministic server/fake-clock 生命周期 tests + disposable bind smoke | no production addresses；三 allowlist code、nonallowlist、30 retries exhaustion、恢复、生产ctx.effect/mount-dispose/timer race、throwing log sink | listen timestamps/counts、pending timer/unref/真实teardown observation、signed IAD continuity、专用 bind-resilience suite | 初次+最多30、每次60s、单 timer；成功/实际dispose 后零新 listen；原 generation；loopback fixture 正常 | 无限/多重retry、reset budget、公开close通过但生产dispose后复活、同步throw逃逸、仅检查error handler而无行为证明 |
   359	| ACC-ARR-003 / CTR-ARR-003 | producer composition + snapshot/auth differential fixtures | assembled candidate temp deployment，aux absent、checkout inaccessible；exact/invalid/disabled/missing/ambiguous/timeout targets | IAD regression results、Definition来源/工件 closure、文件/网络依赖 spies | IAD 001..006 不变，managed Definition 唯一，no history/aux dependency | 新route/副本、mobile projection代替、stale positive、认证或deadline改变 |
   360	| ACC-ARR-004 / CTR-ARR-004 | role-binding probe and negative substitution tests | isolated candidate，再由独立 future mandate 在实际目标 readback；wrong port/history/health-only impostor | signed exact route transcripts、unit/artifact/loaded/consumer配置角色表，secret-sanitized | 正确角色可证；假端点即使health=200也拒绝；loopback约束保留 | 单凭8788/health/PID ready、缺tuple、Secret披露、越权跨主机暴露 |
   361	| ACC-ARR-005 / CTR-ARR-005 | cross-repo handoff/permission audit | Core/Svc/controller 各自 exact accepted head 和现行 task；不接受旧B7 mandate | producer/consumer/controller responsibility 与唯一writer/slot/授权、review记录 | 每仓有其实际交接与权限；Core不替Svc宣布业务成功 | 缺责任仓、第二writer、旧授权复活、本文被当生产mandate |
   362	| ACC-ARR-006 / CTR-ARR-006 | staged integration + bridge negative fixtures | disposable Core/Svc pair；旧consumer、单一新endpoint、failover与partial-phase faults | phase receipts、全部已盘点调用/配置来源及call counts、command-window观察和业务结果 | 顺序受控、无dual endpoint、abort仍interim、fresh/actor/事务不变 | 跳步、未盘点当零、bridge无限期/新consumer、race/fallback或freshness回退 |
   363	| ACC-ARR-007 / CTR-ARR-007 | retirement and restart/recovery/rollback fault matrix | isolated pair/controller recovery fixture；aux endpoint拒绝连接，停止其角色；其他角色sentinel；未来受控目标只按mandate | normal/fallback/restart/recovery/rollback每行trace与零aux调用、角色处置表 | managed允许/拒绝正确；aux不被访问/复活；其他职责与历史保留 | restart恢复aux、隐式fallback、删独立职责、仅grep配置无执行负向证明 |
   364	| ACC-ARR-008 / CTR-ARR-008 | existing closure/fresh-child + drain refusal + artifact handoff checks | assembled disposable release；drained/busy/census unavailable、bad closure、artifact切换中止 | 当前gate结果/receipts、候选与loaded绑定、last-good可恢复性、原store无写spy | bad closure/refused drain阻断apply；合格boot只证明其边界；live依赖无retire空窗 | 强制restart/放宽gate、最新main整树、fresh-child PASS冒充IAD/业务、丢last-good |
   365	| ACC-ARR-009 / CTR-ARR-009 | transport/JWKS/snapshot故障及rollback tests | isolated producer/consumer，pre/post-retirement两种状态；UNKNOWN sentinel records | denied admission/零commit、原错误映射、精确rollback与protected-record hash/调用trace（fixture） | fail-closed，无cache/aux/replay；rollback状态诚实区分 | transport变允许/exists:false、旧UNKNOWN重放/清fence、退役后无授权回aux |
   366	| ACC-ARR-010 / CTR-ARR-010 | evidence/release truth audit | source PR + future受控操作/业务receipts | 逐阶段tuple与qualified Evidence关系；缺项显式UNKNOWN；#554回填 | 仅已实测阶段可PASS，完整source/终态/业务才提请关单 | docs/source/health/历史aux成功被宣称当前业务完成或未执行写PASS |
   367	
   368	### 双向覆盖
   369	
   370	| Contract | Acceptance |
   371	|---|---|
   372	| CTR-ARR-001 | ACC-ARR-001 |
   373	| CTR-ARR-002 | ACC-ARR-002 |
   374	| CTR-ARR-003 | ACC-ARR-003 |
   375	| CTR-ARR-004 | ACC-ARR-004 |
   376	| CTR-ARR-005 | ACC-ARR-005 |
   377	| CTR-ARR-006 | ACC-ARR-006 |
   378	| CTR-ARR-007 | ACC-ARR-007 |
   379	| CTR-ARR-008 | ACC-ARR-008 |
   380	| CTR-ARR-009 | ACC-ARR-009 |
   381	| CTR-ARR-010 | ACC-ARR-010 |
   382	
   383	## 8. 后续实现 / 迁移次序
   384	
   385	本节是依赖次序，不是可执行生产 runbook：
   386	
   387	1. 本 Spec 独立 semantic review、exact-head Owner acceptance、进入 main。
   388	2. Core 新任务 REUSE preflight；在 isolated surface 复用 e9a61dee 的适用字节并补足
   389	   teardown/cadence/exhaustion/admission continuity，不 blind cherry-pick 或重写已过修复；
   390	   固定实际 changed-file closure，按 guardrails 拆分、focused tests 和独立 affected review。
   391	3. Core producer artifact 在 disposable 环境通过相应 Acceptance；svc-workflow 在自己
   392	   accepted authority 下准备 consumer 集成。新跨仓语义若超出现有 authority，先在该仓
   393	   docs-first 接受；不能在 Core PR 中偷授权限。
   394	4. 当前 controller/release owner 创建独立、一次范围有效的 mandate/runbook，fresh-read
   395	   实际拓扑、工件、loaded env、actor、slot、preimage/rollback；绑定具体 origin/port。
   396	   本稿的设计不因这些未采集的 live 坐标而留有 normative TBD。
   397	5. 依 CTR-ARR-006 顺序 apply/readback/canary/role retirement；失败停止受影响阶段，
   398	   保留原记录。满足全部证据后向 #554 回填终态，提请有权者关单。
   399	   当前只有第 1 步的 proposed 文档，后续全部 NOT_EXECUTED。
   400	
   401	## 9. restart-drain / fresh-child 引用兼容性
   402	
   403	本 base 没有发现以这两个机制名命名的独立 active governing Spec；以下是具体机制/
   404	历史 evidence，不能伪称它们是新生产授权：
   405	
   406	- [C11-R3 frozen runbook](../../deployment-artifacts/c11r3-restart-safe-v1/RUNBOOK.md)
   407	  仅对历史 `04bae91c` exact packet 生效。复用的是
   408	  [scheduler-cp-admission](../../scripts/scheduler-cp-admission.mjs)
   409	  及其调用的现有 drain/refusal 机制；不重用历史批准、restart次数或紧急 override。
   410	- [fresh-child boot canary](../../scripts/lib/trusted-cp-fresh-child-boot-canary.mjs)
   411	  在 throwaway home 下验证 assembled candidate child/plugin closure；
   412	  [closure-resolution gate](../../scripts/lib/trusted-cp-closure-resolution-gate.mjs)
   413	  和 [runtime app graph gate](../../scripts/lib/trusted-cp-runtime-app-graph-gate.mjs)
   414	  有各自边界。历史
   415	  [operation package](../evidence/shared-codex-auth-deployment-root-refreeze-v2-20261002/OPERATION_PACKAGE_V2.md)
   416	  只作为 gate 来源和局限证据。
   417	- fresh child boot/closure 不证明 production-runtime directory handler ready、
   418	  当前 JWKS/caller可用、consumer 已切换、business admission 成功或 aux 已退出。
   419	  CTR-ARR-004/006/007 的证据必须另有对应执行；本轮未运行上述工具。
   420	
   421	## 10. Authoring 结束边界
   422	
   423	```text
   424	STATUS = proposed
   425	IMPLEMENTATION_AUTHORITY = contracts (effective only after acceptance in base)
   426	PRIMARY_PARENT_AUTHORITY = AGENT_CORE_PRODUCT_ARCHITECTURE_V1
   427	OPEN_OWNER_DECISIONS = NONE
   428	NORMATIVE_TBD = NONE
   429	UNRESOLVED_AUTHORITY_CONFLICT = NONE
   430	PARTIAL_SUPERSESSION = NONE
   431	CONTRACT_COUNT = 10
   432	CONTRACTS_WITH_ACCEPTANCE = 10
   433	AUTHORING_READY_FOR_REVIEW = YES
   434	READY_TO_MARK_ACCEPTED = NO
   435	NEXT_ACTION = REVIEW
   436	```
   437	
   438	仍待：独立 exact-head Spec acceptance；之后的实现/release/consumer/终态业务验证。
   439	本稿、PR open 或 #554 回填均不跨越这些边界。
docs/reports/HR_H5_PRIVATE_ADMISSION_PREFLIGHT.md
docs/audits/HR_DISPATCH_DELIVERY_IMPLEMENTATION_AUDIT_V1.md
docs/reports/OWNED_DISPATCH_STATUS_AMENDMENT_BRIEF_20261027.md
docs/runbooks/ADMISSION_SEAM_OPERATOR_RUNBOOK_V1.md
docs/investigations/WORKFLOW_DISPATCH_STARVATION_ROOT_CAUSE_V1.md
docs/investigations/HR_DISPATCH_DELIVERY_READINESS_V1.md
docs/specs/AGENT_CORE_WORKFLOW_CANONICAL_ADMISSION_V1.md
docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V1.md
docs/specs/AGENT_CORE_ADMISSION_RUNTIME_RELIABILITY_V1.md
docs/specs/AGENT_CORE_WORKFLOW_DISPATCH_INTENT_BROKER_V1.md
docs/specs/AGENT_CORE_NATIVE_GOAL_CONTINUATION_ADMISSION_V1.md
docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CLASS_BROKER_V1.md
docs/specs/AGENT_CORE_AUTHSVC_SHARED_CODEX_ACTIVATION_RECONCILIATION_V2_CAPTURE_ADMISSION_AMENDMENT.md
docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V3.md
docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V2.md
 .../AGENT_CORE_ADMISSION_RUNTIME_RELIABILITY_V1.md | 439 +++++++++++++++++++++
 1 file changed, 439 insertions(+)
origin	https://github.com/mayf3/dsh-agent-core.git (fetch)
origin	https://github.com/mayf3/dsh-agent-core.git (push)

exec
/bin/zsh -lc "sed -n '1785,1815p' /Users/yanfenma/.codex/memories/MEMORY.md; rg --files /tmp/review-609 -g AGENTS.md" in /tmp/review-609
 succeeded in 0ms:
# Task Group: dsh-agent-core / PR #96 workflow transition and PR #97 Forum moderation fixed-SHA audits
scope: read-only fixed-SHA review of proposed workflow-transition Spec closure and Forum moderation implementation; use before acceptance or merge, never as authority to alter Grant, Forum data, product code, or production state.
applies_to: cwd=/Users/yanfenma/workspace/project/dsh-agent-core; reuse_rule=SHA, branch, PR state, and svc-workflow revision are time-sensitive; reuse the audit method and failure shields only after re-pinning remote refs and governing Specs.

## Task 1: audit PR #97 AGENT_CORE_FORUM_MODERATION_CAPABILITIES_V1 implementation, REVISE

### rollout_summary_files

- rollout_summaries/2026-08-28T14-38-36-F0Ib-pr97_forum_moderation_fixed_sha_audit_revise.md (cwd=/Users/yanfenma/workspace/project/dsh-agent-core, rollout_path=/Users/yanfenma/.codex/archived_sessions/rollout-2026-08-28T22-38-36-01a048ce-f18c-7920-b00d-eba808825cfb.jsonl, updated_at=2026-08-28T14:51:24+00:00, thread_id=01a048ce-f18c-7920-b00d-eba808825cfb, fixed-SHA implementation audit REVISE)

### keywords

- PR97, forum-moderation, SPEC_AUTH_SCHEME_RE, sanitizeErrorDetail, AUTH_REDACTED, CODE_STRUCTURE_GUARDRAILS_V1, structure-gate, forum.js, transport.js, 202/202

## User preferences

- when the user requires “本轮只读” or “不修改、不 merge、不 deploy、不改 Grant、不改 Forum 数据” -> pin and revalidate `REVIEW_BASE`/`REVIEW_HEAD` before major phases and the final report; make no acceptance, merge, implementation, Grant, Forum-data, or deployment change [Task 2]
- when the requested audit names PASS/REVISE, blockers, required fixes, and readiness -> report every gate explicitly and do not recommend acceptance/merge while any requested gate fails [Task 2]

## Reusable knowledge

- Related skill: skills/fixed-sha-pr-audit/SKILL.md [Task 2]
- A supplied PR base can be `baseRefOid` rather than a head ancestor. Use the three-dot diff and actual merge-base to assess PR scope; PR #97 retained its nine authorized files despite a non-ancestor supplied base. [Task 1]
- For PR #97, `npm test` in `packages/broker` passed `202/202`; governance and `git diff --check` passed. Full-repository failures reproduced at head and base from missing `@larksuite/channel`, `@deepseek-ai/dsh-llm`, and platform-gated cases, so were not PR regressions. `node scripts/verify-code-structure.mjs --base <base> --head <head>` exposed blockers that functional tests missed. [Task 1]

## Failures and how to do differently

- Symptom: sanitizer tests pass but lowercase/mixed-case credentials remain visible. Cause: `SPEC_AUTH_SCHEME_RE` lacks `/i`; `sanitizeErrorDetail('basic QUJDREVG')` returned raw material. Fix: add the case-insensitive flag and lowercase/mixed-case `<AUTH_REDACTED>` regression vectors. [Task 1]
- Symptom: all focused tests pass yet the structure gate fails. Cause: `forum.js` exceeded 500 lines, `transport.js`/`transport.test.js` exceeded `MUST_NOT_GROW`, and an unregistered legacy test was touched; the accepted nine-file closure forbids required splits. Fix: amend the Spec closure first, split the files, then rerun the structure gate against supplied base and merge-base. [Task 1]


/tmp/review-609/repo/AGENTS.md

exec
/bin/zsh -lc "cat .agents/README.md; cat .agents/local/README.md; cat .agents/skills/spec-governance/SKILL.md; rg --files .agents docs | rg 'SPEC_FORMAT|spec-governance|DECISION|Decisions|decisions|PRODUCT_ARCHITECTURE'" in /tmp/review-609/repo
 succeeded in 0ms:
# Development Grammar V1

```text
GRAMMAR_VERSION = 2.0.0-rc.1
GOVERNING_AUTHORITY = AGENT_DEVELOPMENT_GOVERNANCE_V1
STATUS = accepted
ENFORCEMENT_LEVEL = manual_policy_plus_deterministic_integrity
```

This is the shared operating grammar for repositories developed across many Agent sessions. Product Direction, Architecture, governing Specs, investigations, implementation records, and runtime evidence remain in their owning repository.

After this file, read `.agents/local/README.md` when present.

## Context budget

For an ordinary task, load only:

1. this grammar;
2. repository-local governance;
3. directly relevant accepted authorities;
4. the Spec-governance router and one selected mode.

Do not preload every protocol, template, rationale, prior review, or example. Resume from the existing current task/release record and its directly referenced active authorities and Evidence. Read historical records only to resolve a specific provenance or dependency question; their age or filename does not determine authority. Keep historical evidence readable without loading it as the control plane.

## Minimum loop

```text
1. Fix target repository, candidate Head, and integration Base.
2. State GOAL/TARGET and CURRENT_GAP.
3. Locate Product Authority in precedence order.
4. Separate OBSERVATION from WORKING_GUESS when interpretation affects routing.
5. Classify independently: AUTHORITY_ACTION, PLAN_LEVEL, ASSURANCE_LEVEL.
6. Check Execution Mandate, load-bearing SPEC_GAP, Evidence reviewability,
   live authority gap, and candidate/Base movement.
7. Select the shortest authorized route and artifact set.
8. Execute only within accepted Contracts and the mandate.
9. Review the affected surface with executed Evidence.
10. DONE_WHEN met without EXPANSION_TRIGGER -> STOP.
```

## Semantic primitives

Epistemic entities:

- **Observation** — direct recorded result with source, revision, environment, time, method, result, and provenance.
- **Claim** — interpretation with `SUPPORTED`, `INFERRED`, or `OPEN_ASSUMPTION` support state.
- **State** — a time- and coordinate-bound projection from Observations and necessary Claims.

Normative entities:

- **Goal** — desired outcome; it does not authorize mutation.
- **Decision** — selected direction made by an owning authority.
- **Contract** — stable testable obligation created by an accepted Decision.

**Evidence** is a qualified relation from Observation(s) to a named Claim, State assertion, or Contract at exact coordinates.

```text
Test Definition != Observation
Executed Result with coordinates = Observation
Qualified Observation-to-target relation = Evidence
Activity != Knowledge
Activity != Progress
```

Load-bearing Evidence in a governing Spec or Conformance Record uses stable `EVD-*` identity and records source, target, relation, coordinates, sufficiency, limitations, and provenance. A Routine Change Brief does not require a complete research graph unless a load-bearing interpretation depends on it.

## Product Authority and Execution Mandate

Only active accepted Product Direction, Architecture/invariant authority, or governing Spec in the owning repository may create or change long-lived Product Contracts.

These do not create Product Authority:

```text
Investigation
Task or prompt
Change Brief
ExecPlan
Execution Mandate
Controlled Runbook
test definition
runtime state
Review comment
```

A valid **Execution Mandate** authorizes and constrains one task or operation. It binds an attributable issuer, target, scope, allowed/forbidden effects, and `DONE_WHEN`. A controlled mutation additionally binds actor/role, environment, exact operation or operation class, abort conditions, Secret handling, receipt requirements, and validity/attempt bounds. It cannot create or weaken Product Contracts. An Agent-authored Brief cannot self-authorize.

Every mutation—including code, documentation, configuration, schema, behavior-defining tests, generated files, and operational state—MUST have attributable authorization before it begins. The authorization may be carried by a Task, Issue, PR, Brief, or dedicated mandate; it need not become a separate large document, but it MUST remain persistent and reviewable. All write work MUST use an isolated worktree or equivalent isolated write surface bound to an exact parent, isolated ref, and single intended tree without mutating another active checkout.

## Three independent PREFLIGHT axes

### Authority action

```text
REUSE | AMEND | SUPERSEDE | NEW
```

- `REUSE`: active accepted Product Authority already decides the behavior and no Contract meaning changes.
- `AMEND`: a named proposed authority changes inside its declared scope, ownership, and bounded Decision identity; or accepted authority gets strictly additive new IDs under unchanged Goal, scope, ownership, and accepted Decisions.
- `SUPERSEDE`: accepted meaning is deleted, narrowed, expanded, reversed, replaced, or receives different failure semantics. Use a whole-authority successor and atomic backlinks.
- `NEW`: no active accepted authority owns the bounded independent decision, or a targeted proposal's scope, ownership, or bounded Decision identity changes.

`AMEND_OR_NEW_PENDING_OWNERSHIP` is investigation-only and must resolve before any readiness boundary.

An accepted authority permits implementation only when it declares `implementation_authority: contracts` and the request is inside those Contracts. An accepted Program or `implementation_authority: none` does not authorize child implementation.

### Plan level

```text
NONE | BRIEF | EXEC_PLAN
```

- `NONE`: trivial bounded work with machine-supported semantic identity.
- `BRIEF`: bounded non-trivial work.
- `EXEC_PLAN`: multi-phase, cross-component, dependency-sensitive, migratory, or otherwise complex execution.

Risk alone does not create an ExecPlan.

### Assurance level

```text
ROUTINE | DURABLE | CONTROLLED
```

- `ROUTINE`: readily reversible and low consequence.
- `DURABLE`: persisted/public/package/lifecycle/migration surface requiring independent affected-Contract review.
- `CONTROLLED`: identity, auth, permission, Secret, Grant, destructive migration, deletion, production activation, cross-repository public protocol, irreversible operation, or comparable high consequence.

A Controlled Runbook is an Assurance artifact, not a Plan level. A one-shot operation may be `BRIEF + CONTROLLED`.

## Default routes

| Authority | Assurance | Default route |
|---|---|---|
| `REUSE` | `ROUTINE` | Brief as needed + implementation + focused Evidence |
| `REUSE` | `DURABLE` | Brief/ExecPlan + implementation + independent affected-Contract review |
| `REUSE` | `CONTROLLED` | valid mandate + exact runbook + receipt + independent post-state verification; no new Spec solely for risk |
| `AMEND/NEW` | `ROUTINE/DURABLE` | Spec delta and implementation may share one atomic PR when local authority permits |
| `AMEND/NEW` | `CONTROLLED` | docs-first Product Authority, then controlled execution |
| `SUPERSEDE` | any | docs-first whole-authority successor |

### Route stage and docs-first gate

Every structured route records:

```text
ROUTE_STAGE = AUTHORITY_AUTHORING | IMPLEMENTATION | OPERATION
AUTHORITY_ACCEPTED_IN_BASE = YES | NO | NOT_APPLICABLE
```

`AMEND/NEW + CONTROLLED` remains in `AUTHORITY_AUTHORING` with implementation and operation forbidden until the new authority is accepted in the relevant base. Every `SUPERSEDE` route is docs-first and cannot share a same-stage implementation or operation. After the authority is accepted, the actual implementation or operation is a new task routed as `REUSE`.

`AMEND/NEW + ROUTINE/DURABLE` MAY combine Spec delta and implementation only when local authority explicitly permits that atomic route. This exception never applies to `CONTROLLED` or `SUPERSEDE`.

Implementation detail does not become a Contract because an Investigation, PR body, test, or Reviewer repeats it. A public interface, permission, security, durable-data, lifecycle, or compatibility obligation cannot be demoted by calling it an implementation detail.

## One legal effect per artifact

- Standing Spec / Spec delta — Product Authority.
- Change Brief — one change's goal, gap, route, scope, Evidence, and stop boundary.
- ExecPlan — phases, dependencies, checkpoints, rollback, and re-PREFLIGHT triggers.
- Execution Mandate — one operation's authorization and limits.
- Controlled Runbook — dangerous operation steps, aborts, receipts, and verification.
- Receipt / Conformance Record — what happened and what it verifies.
- Investigation — durable non-authoritative findings and alternatives.

## Load-bearing gaps and Evidence

A Reviewer may identify a missing long-lived decision but cannot write it in Review. When implementation, merge, or operation depends on it:

```text
SPEC_GAP_DEPENDENCY = LOAD_BEARING
AUTHORITY_ACTION = AMEND | SUPERSEDE | NEW
at least one applicable readiness boundary = NO
all readiness boundaries = NOT_APPLICABLE  # forbidden
NEXT_ACTION = RE_PREFLIGHT
```

`REUSE` and `AMEND_OR_NEW_PENDING_OWNERSHIP` cannot cross this readiness boundary. `OWNER_DECISION_REQUIRED = YES` may record that the re-PREFLIGHT needs an Owner decision, but `OWNER_DECISION` cannot replace the required `RE_PREFLIGHT` route result.

A stopping gap needs a concrete diagnosis in the existing record: the affected action, missing long-lived decision, authority inventory searched, reachable counterexample, impact, minimum closure, and whether removing the dependency or using an already-authorized bounded path avoids it. A missing decision cannot cite its own nonexistent Contract; it must demonstrate the dependency instead. An invalid or incomplete diagnosis does not grant execution permission: retain a safe pause on genuinely uncertain affected work, request only the missing fact, and do not launch speculative redesign.

Required Evidence must be accessible to the designated independent Reviewer, reproducible in an authorized environment, or represented by a sanitized coordinate-bound receipt from a legally independent actor.

```text
inaccessible / unverifiable / unknown provenance -> REQUIRED_GATE_FAILURE
fabricated / materially distorted / falsely claimed execution -> FALSE_EVIDENCE
```

Secret values are not exposed to prove reviewability.

## Model convergence and retirement

When the current task actually touches historical alternatives — historical IDs, duplicate models, old fields or configuration keys, old API/CLI entrypoints, legacy state stores, fallback paths, compatibility adapters, replacement dependencies, or old runtimes/recovery paths — inspect whether the same business responsibility is served by multiple independently maintained executable models. Different identifiers alone are not duplication: preserve genuinely distinct entities such as multi-credential, multi-tenant, per-service eligibility, and supported-protocol differences, and never merge on name similarity, prefixes, or unverified historical mapping.

Prefer migrating real consumers and retiring the replaced executable path over adding a permanent mapping, fallback, or compatibility layer. Record each affected fact as one disposition:

```text
RETAIN           distinct responsibility or still-supported surface; no merge
RETIRE           obsolete executable path exits execution
MIGRATE          consumers move to the current model, then the old path exits
TEMPORARY_BRIDGE bounded compatibility with a real consumer and an exit condition
```

A stable supported public facade may remain permanently; it is not an obsolete path merely because it is old. Only a temporary migration bridge owes a real consumer and an objectively verifiable exit condition.

Declaring final convergence requires evidence that the new path is usable, the retired executable path is excluded from affected normal, fallback, and restart/recovery routes, and recovery does not revive it. Retirement removes execution, never historical evidence: audits, receipts, migration records, and necessary tombstones stay readable without granting present eligibility. Unknown or unexecuted coverage stays unknown; it must not become zero or PASS.

Convergence questions apply only to affected work. An unrelated small fix keeps its normal short route: no global census, no empty matrix, no new approval. Parallel or multi-Agent work remains optional; every actual write still needs its own attributable authorization and isolated write surface. Practical refactoring technique beyond this rule is optional method guidance, never a new MUST.

## Live state ahead of authority

```text
LIVE_STATE = Observation, not authority
EXPANSION = FROZEN
AUTO_DELETE = NO
PERMANENT_GRANDFATHER = NO
```

An authorized Owner/risk actor issues temporary scope-bound containment with an expiry or closure condition. Close the long-lived gap docs-first, perform minimum reconcile after acceptance, independently verify conformance, end containment, and stop.

## Emergency containment

A pre-Spec emergency action is limited to rollback, disablement or shutdown, revocation, isolation, or equivalent containment. It MUST have attributable Owner authorization and an incident reference, MUST NOT introduce durable new behavior, and MUST require permanent repair to return through normal PREFLIGHT and Product Authority. Emergency containment may authorize the minimum operation needed to reduce harm; it does not authorize feature implementation, merge, or permanent semantics.

## Review coordinates and Blockers

```text
REVIEW_TARGET_HEAD = exact candidate under review
BASE_HEAD = integration snapshot used for review
CURRENT_BASE_HEAD = current branch tip at impact recheck
```

Unrelated Base movement is not candidate-Head drift. Re-review affected semantics only when candidate semantics, relevant authority, affected behavior/Evidence, or a real conflict changes. A receipt-only or lifecycle-only Head change still gets independent final-Head delta recheck, not automatic full review. A bounded semantic repair gets independent delta review of that repair and invalidated dependencies. Full review needs an initial review, an identified accepted full-review gate, or demonstrated unbounded impact; a new SHA is not a sufficient reason.

A Blocker uses one class:

```text
CONTRACT_VIOLATION
REPOSITORY_INVARIANT_VIOLATION
CONCRETE_REGRESSION
SECURITY_OR_DATA_LOSS
FALSE_EVIDENCE
SCOPE_ESCALATION
REQUIRED_GATE_FAILURE
```

Every Blocker states `SOURCE`, `COUNTEREXAMPLE`, `IMPACT`, and `MINIMAL_CLOSURE`. Name the affected readiness boundaries; an open Blocker requires at least one of them to be `NO` and none to be `YES`. Unrelated authorized work may continue. A load-bearing `SPEC_GAP` is a separate finding type but not an exemption from justifying a stop. Legal sources are active accepted Product Authority, accepted local governance/invariant authority, a pre-existing active machine gate, or a valid Execution Mandate. Investigation, proposed tests, task product prose, Reviewer preference, and Review comments are not Product-Contract sources.

Current or resumed decisions use route `schema_version: 2` and every open Blocker names `affected_readiness`. The default validator rejects schema-v1 input. Historical schema-v1 findings may be viewed with the explicit `--legacy-inspection` mode, which preserves their structural semantics without inventing a global stop and never certifies current readiness. History is not rewritten; a current decision is a new v2 record with its real scope and applicable authority.

Other findings are `SPEC_GAP`, `FOLLOW_UP`, or `TOOLING_DEBT`. Tooling debt blocks a product only when it causes false pass, harms non-test data, hides a concrete security/data-loss failure, or is itself an accepted deliverable.

## Goal and stop controls

Every non-trivial route records:

```text
GOAL_OR_TARGET
CURRENT_GAP
AUTHORITY_ACTION
PRIMARY_AUTHORITY
PLAN_LEVEL
ASSURANCE_LEVEL
EVIDENCE_NEEDED
DONE_WHEN
```

Durable, controlled, or expansion-prone work also records `EXPANSION_TRIGGER`. Use `NEXT_REAL_ACTION` when governance/infrastructure drift is plausible.

```text
DONE_WHEN met + EXPANSION_TRIGGER not fired -> STOP
```

Optional platform work, extra fault research, Agent availability, sunk effort, and non-load-bearing harness imperfection are not expansion triggers.

## Proportional conformance

A Conformance Record binds exact Product Authority revision, implementation revision, environment, evaluation time, implementation state, verification state, `conformance_result`, executed Observations, and Evidence relations.

Standard review covers affected Contracts and directly dependent accepted invariants. Controlled operations, releases, explicit full audits, and unbounded surfaces use the complete applicable matrix. The complete applicable matrix is complete for the bounded release/operation, not every Contract in every reachable repository. Identify its scope before execution. A prior mechanism is not rerun unless the new change invalidates it. Rebind unaffected evidence through an explicit impact check; never copy an old `VERIFIED` claim onto changed coordinates. Fresh runtime/authority/pre-state checks remain fresh where the applicable gate requires them.

`VERIFIED` applies only to the exact bound tuple and is never a permanent property of a Spec.

## Bounded delivery loop

Use one current Brief, task, PR, or release record, not a new control-plane document. It references the accepted scope, applicable gates, actual authorization, valid blockers, last real action, and next executable action; a status field never creates authority.

Freeze the acceptance scope and applicable gates for that delivery. Reviewers may expose violations and genuinely missing dependencies, not silently add product requirements. Newly discovered concrete security/data-loss risks, missing authority, false Evidence, required-gate failures, and business/runtime canary failures still stop affected work. Optional hardening remains follow-up debt. Changing the accepted scope or gates needs the owning authority's explicit disposition, not a review preference.

Retain review/repair history against the original business outcome, not proposal filenames or candidate names. Suggested working pattern: one initial review, a consolidated repair pass, then affected delta review. Repeated work without new evidence is a reason to reassess scope, split optional work, or try a simpler authorized path. This is diagnostic guidance, not a numeric cutoff, new acceptance gate, or reason to forbid an otherwise authorized repair. Any task-specific budget comes from its applicable authorization; existing Blockers, Done When, and Expansion Trigger remain controlling.

When the next action is within current authorization and its required gates pass, perform it rather than producing another unchanged ready packet. If it is blocked, report that action, the failed prerequisite, its owner, and the minimum fix. Do not try a known unsafe or unauthorized action merely to obtain an error. No new observation means no new recursive review or authority-reconciliation cycle. Report real waiting states as waiting; a child review task's completion is not delivery of the business outcome.

During an incident, prefer an existing accepted recovery path with a valid mandate, abort/rollback controls, and receipts. Separate optional generalized recovery hardening. Incident status never authorizes blind retry, fence removal, privilege bypass, or a second Run while external effects remain unknown.

## Adoption and history

This source repository is not automatically authoritative in a consumer. A consumer vendors an exact commit, reviews it locally, records preparation separately from acceptance, and activates it only after merge into its authority branch.

Do not bulk-rewrite history. Apply V1 from the next applicable change forward.

`.agents/protocol/SPEC_GOVERNANCE_V0.md` is historical compatibility material. The active workflow is `.agents/protocol/SPEC_GOVERNANCE_V1.md`.
# Repository-local governance — dsh-agent-core

This file is owned by `mayf3/dsh-agent-core`. It is not part of the vendored distribution and is not overwritten by governance updates.

## Repository identity

```text
REPOSITORY = mayf3/dsh-agent-core
AUTHORITY_BRANCH = main
GOVERNANCE_LOCK = .agents/governance.lock.json
ADOPTION_ACTIVATION = accepted lock + accepted adoption Spec merged into main
```

A proposed lock on a feature branch is only an adoption candidate. It is not active repository authority.

## Authority precedence

```text
explicit Product Direction authority, when one is accepted
> accepted Product Architecture and standalone long-lived Current Decisions
> accepted implementation-authorizing Specs
> code, tests, runtime state, migration records, and operational evidence
```

Current repository authority locations:

```text
PRODUCT_DIRECTION = NONE_STANDALONE
PRODUCT_ARCHITECTURE = docs/AGENT_CORE_PRODUCT_ARCHITECTURE_V1.md
ROADMAP / STRATEGIC_CONTEXT = docs/AGENT_CORE_ROADMAP_V1.md
CURRENT_DECISION_INDEX = docs/decisions/README.md
DECISIONS = docs/decisions/
SPECS = docs/specs/
```

Local rules:

- an implementation Spec may refine Architecture or a Current Decision, but may not silently contradict it;
- changing accepted long-lived meaning requires a new whole-authority supersession transaction;
- a Program Spec with `implementation_authority: none` coordinates work but does not authorize product implementation;
- an accepted-looking document on an unmerged branch is not active authority;
- code, tests, reports, and runtime evidence may prove conformance or drift but do not rewrite normative authority.

## Bounded-development route (effective on V3 adoption only)

These local choices become active only with the accepted
`AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V3` and accepted lock merged into `main`.
Until then, the authority branch's existing rules remain controlling.

- `REUSE` inside an accepted implementation Contract needs no new Spec or
  standalone Spec review merely because code changes. Use focused tests and the
  review required by its Assurance level.
- Explicitly permit one atomic Spec-delta-and-code PR for bounded
  `AMEND/NEW + ROUTINE/DURABLE` work under the owner's task authorization. The
  delta must be independently accepted before merge; it cannot contradict
  Architecture, replace accepted meaning, widen privileges, change Secret/Grant
  boundaries, introduce destructive migration, or authorize production effects.
- `CONTROLLED` and `SUPERSEDE` remain docs-first. Implementation and production
  permissions are separate; missing production permission does not itself stop
  unrelated authorized nonproduction work.
- Review the affected change and invalidated dependencies. A new SHA alone does
  not require a full audit. Use the vendored explicit scope/impact checks.
- Ordinary tasks use the existing PR/Brief; no mandatory extra Agent formation,
  full-corpus review, or new control-plane document is introduced here.

## Acceptance and review actors

```text
SPEC_ACCEPTANCE_ACTORS = repository owner mayf3, or an explicitly authorized maintainer recorded in the PR
INDEPENDENT_SEMANTIC_REVIEWER = a reviewer who did not author the reviewed semantic delta
MECHANICAL_EXEMPTION_REVIEWERS = independent reviewer; final disposition by mayf3 or an authorized maintainer
EMERGENCY_AUTHORIZATION_ACTORS = mayf3 or an explicitly authorized maintainer
```

A review recommendation does not itself perform acceptance. Acceptance must bind the reviewed commit and the final accepted head.

## Governing and persistence locations

```text
SPECS = docs/specs/
INVESTIGATIONS = docs/investigations/
LONG_LIVED_DECISIONS = docs/decisions/
IMPLEMENTATION_CONFORMANCE = implementation PR record
CROSS_ENVIRONMENT_OR_PRODUCTION_CONFORMANCE = docs/reports/ plus pinned runtime provenance
SEMANTIC_REVIEW_RECORD = persistent PR conversation or docs/reports/
EMERGENCY / INCIDENT_REFERENCE = persistent issue, PR, or report
```

## Current Owner-obligation Workflow authority

The accepted paired governing authorities are `docs/specs/SVC_WORKFLOW_OWNER_OBLIGATION_WORKFLOWS_V2.md` in svc-workflow and `docs/specs/AGENT_CORE_WORKFLOW_OWNER_OBLIGATION_WORKFLOWS_V2.md` here, accepted by Root under user-delegated authority at reviewed semantic heads Svc `39587c33c8bcf26ad5689127f5c92a6abc8b562e` and Core `ac83fe5cea3701eb9436f74d1b5f6ed0013256a9`. The accepted Core whole successors are WAE V3, Assignee Transition Capability V3, WEC V3, GCR V2, WPO V4, and Owner Workflows V2. Assignee Transition Capability V2 is superseded by V3, and Owner Workflows V1 by V2, with reciprocal lifecycle links. The paired Svc acceptance-context successor is `SVC_WORKFLOW_ACCEPTANCE_CONTEXT_BINDING_V2`. Governing Contracts authorize source implementation only after their accepted revisions are present in the implementation base; production apply remains none.

## Code structure rules

Current binding repository-local rule: [`.agents/local/CODE_STRUCTURE_GUARDRAILS_V2.md`](CODE_STRUCTURE_GUARDRAILS_V2.md)
(frozen limits, fixed-baseline registry validation, candidate-delta gate and visible
historical debt). V2 and its V1 supersession activate atomically on main.
The implementation contract is
[`CODE_STRUCTURE_VERIFIER_CONFORMANCE_V1`](../../docs/specs/CODE_STRUCTURE_VERIFIER_CONFORMANCE_V1.md).
Implementation starts only after both accepted authorities are in its base.
The existing V1 runner remains unqualified for V2 until the implementation lands.

```text
RULE = .agents/local/CODE_STRUCTURE_GUARDRAILS_V2.md
EXCEPTION_REGISTRY = .agents/structure-registry.json
VERIFIER = node scripts/verify-code-structure.mjs --base <ref> --head <ref> [--json]
NPM = npm run verify:structure
```

Raw logs may remain outside Git, but every load-bearing Observation or Evidence relation must retain enough provenance to retrieve and interpret the source.

## Legacy transition

Before this adoption candidate, the repository had a local bootstrap in `AGENTS.md`, `.agents/README.md`, and two helper templates, governed by `AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1`.

This adoption is forward-only:

```text
NO_BULK_HISTORY_REWRITE = YES
EXISTING_ACCEPTED_ARTIFACTS_REMAIN_HISTORICAL_AUTHORITIES_UNTIL_EXPLICITLY_TOUCHED = YES
NEW_PARTIAL_SUPERSESSION = FORBIDDEN
```

Existing prose that describes partial supersession is legacy state. It is not a template for new work. When such an authority must change, create a complete standalone replacement and perform an atomic whole-authority supersession.

The pre-adoption local helpers:

```text
.agents/templates/development-preflight.md
.agents/templates/spec-compliance.md
```

remain compatibility aids only. They are not authority. New work uses the vendored Skill modes and templates.

At local adoption acceptance, `AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0` supersedes `AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1` as the repository's development-governance authority. The old Spec remains historical rationale.

## Enforcement maturity

Actual enforcement is:

```text
ENFORCEMENT_LEVEL = MANUAL_POLICY
DISTRIBUTION_INTEGRITY_CHECK = AVAILABLE
SPEC_FRONTMATTER_SCHEMA = AVAILABLE_REFERENCE
SEMANTIC_SPEC_VERIFIER = NOT_IMPLEMENTED
BASE_BRANCH_GATE = NOT_IMPLEMENTED
REQUIRED_BRANCH_PROTECTION = NOT_ENABLED
AUTOMATIC_SPEC_ACCEPTANCE = NO
CODE_STRUCTURE_VERIFIER = AVAILABLE (scripts/verify-code-structure.mjs; run via npm run verify:structure)
```

Run the vendored integrity verifier:

```bash
python3 .agents/tools/verify_governance.py --target .
```

After adoption is active on `main`, use `--require-accepted` when verifying the authority branch.

## Delivery convergence and proportional rollout

These repository-local rules refine review and rollout behavior without weakening the vendored blocker classes, Product Authority precedence, or Controlled-operation gates. They never authorize merge, deployment, or mutation while a known binding Blocker remains open.

### Recovery first when accepted mechanisms already exist

For an active availability incident, if an existing accepted operator/admin mechanism can safely restore service without changing long-lived Product Contracts, restore the service first and keep the permanent redesign in a separate lane.

```text
SAFE_EXISTING_RECOVERY_PATH = prefer now
LONG_TERM_REDESIGN = separate lane
INCIDENT_RECOVERY_MUST_NOT_WAIT_FOR_OPTIONAL_GOVERNANCE_WORK = YES
```

This does not permit blind retry, destructive repair, privilege bypass, or reinterpretation of an unknown external side effect.

For an authorized recovery, keep the old `outcome_unknown` record and its
business-side-effect uncertainty; do not replay its prompt or tools, erase it,
or infer success or failure from termination-only evidence. Before admitting an
explicitly new Session, Turn, or request, the exact mandate/runbook must prove
that both the old worker and its already-dispatched tool operations are
terminated or isolated from external effects, or that each actual write/delivery
boundary rejects the old identity. An epoch gate that only suppresses replies
is insufficient. If this proof is unavailable, keep the affected fence and stop.

Label offline tests as mechanism evidence. Claim live recovery only after a
fresh, explicitly new request succeeds through the authorized path with
attributable readback; do not count an old UNKNOWN replay as that request.
Protected-record hash forensics remain a prerequisite only for an accepted
recovery path that requires them, not a universal prerequisite for every
authorized recovery mode. Apply each selected path's mandatory gates without
delaying safe recovery for optional governance work.

### Recovery and deployment reuse handoff

Apply the existing recovery-first and proportional-review rules to the actual
execution path, not only to source readiness. For the affected incident, record
these facts in the existing handoff/Brief; no second queue, ledger, or mandatory
standalone report is needed:

- Distinguish accepted design, source readiness, installed callable capability,
  and live business acceptance. An offline test or merged reader is not a live
  recovery result. Attach time/revision-bound evidence; do not invent a percentage
  complete or call an unverified downstream path the last blocker.
- Before investing in a new recovery component, check its end-to-end call path:
  installed entrypoint, caller/operation scope, artifact/host constraints, result
  query, and failure exit. Use existing authorized observations; inaccessible
  evidence remains an explicit gap, not permission for a new protected read.
- Separate ordinary application release, business-state recovery, and deployment
  controller/profile changes. Prefer existing admitted mechanisms; explain a
  concrete shared-capability gap before proposing another incident-specific
  installer or privileged binding. Risk alone does not require a new Product Spec.
- Keep the old business turn, bootstrap transaction, and controller update as
  distinct evidence subjects. No journal status grants retry, a replacement ID,
  fence clearing, or new admission; apply the selected accepted path's conditions.
  The old business outcome may remain UNKNOWN under the recovery rule above.
- Carry incident history and unresolved dependencies across task/PR handoffs.
  Renaming a task does not erase failed attempts or restart an incident from zero.
  Reuse still-valid evidence and review only affected changes; this does not
  waive real blockers or add a new global review counter.

The [HR recovery/deployment reuse handoff](../../docs/reports/HR_RECOVERY_DEPLOYMENT_REUSE_HANDOFF_20260929.md)
records the motivating evidence and bounded follow-up objectives. Its proposed
implementation work is not Product Authority or production authorization. It must
not become an additional prerequisite for an already-safe authorized recovery.

### Release governance is not Product Authority

A rollout, canary, dogfood, or one-operation safety concern remains a Controlled-operation concern unless it creates a genuinely load-bearing long-lived Product Contract.

Do not invent persistent product state, a new durable protocol, or a new Product Spec solely to make a bounded release procedure easier to prove when an exact Execution Mandate / Controlled Runbook can contain the risk.

If review proves that a long-lived Product Contract is genuinely missing, stop and re-PREFLIGHT through `AMEND`, `SUPERSEDE`, or `NEW`; do not smuggle that contract into a release document.

```text
RELEASE_GOVERNANCE_IS_NOT_PRODUCT_AUTHORITY = YES
ONE_OPERATION_RISK_DEFAULT_HOME = mandate/runbook/receipt
PERSISTENT_PRODUCT_PROTOCOL_FOR_RELEASE_ONLY = FORBIDDEN
```

### Freeze the review blocker union

The first independent review of a candidate records the complete known ship-blocker set as `FROZEN_BLOCKER_UNION`.

The normal repair cycle is:

```text
initial independent review
-> freeze blocker union
-> one blocker-union repair pass
-> one exact-head re-audit
```

A re-audit may add a new ship blocker only when it is a valid blocker under the vendored grammar and has a concrete, reachable counterexample against the current affected surface. Reviewer preference, speculative hardening, hypothetical races without a reachable current counterexample, and optional robustness improvements are `FOLLOW_UP`, not reasons to restart the candidate indefinitely.

A newly discovered concrete `SECURITY_OR_DATA_LOSS`, `FALSE_EVIDENCE`, `REQUIRED_GATE_FAILURE`, `CONTRACT_VIOLATION`, `REPOSITORY_INVARIANT_VIOLATION`, `CONCRETE_REGRESSION`, or `SCOPE_ESCALATION` remains blocking; this section never suppresses a real blocker.

### Convergence checkpoint (effective on V3 adoption only)

Retain review/repair history for the same business outcome across candidate
renames. Repetition without new evidence calls for reassessing scope or choosing
an existing simpler recovery path; it is not progress merely because another
report exists. This is diagnostic guidance, not a universal numeric cutoff.
Task-specific budgets require applicable authorization; they neither waive real
Blockers nor forbid an otherwise authorized necessary repair solely by round count.
Do not stop a usable service merely because a development candidate is paused.
The old three-round local guard remains controlling before V3 is active on main.

### Minimum live slice first

When a merged capability is decomposable and the full rollout keeps expanding the proof surface, deploy the smallest independently useful low-risk slice first.

Default order:

```text
read-only visibility/status
-> one bounded exact mutation canary, if needed
-> broader self-service mutations only after the earlier slice is live and proven
```

Optional dogfood, critical-job mutation, broad admin behavior, or unrelated compatibility work MUST NOT gate a read-only slice unless an accepted Product Contract explicitly requires atomic delivery.

Each production slice keeps its own Controlled-operation gate, rollback/readback, and receipts.

### Proportional re-review

Intermediate re-audits review:

- the frozen blocker closures;
- semantics changed by the repair;
- directly dependent Evidence/invariants invalidated by that repair.

Do not rerun unrelated prior mechanisms merely because the candidate Head changed mechanically. The final Controlled production boundary still runs the complete applicable matrix required by accepted authority.

### Stop discipline

Once `DONE_WHEN` is met and no valid `EXPANSION_TRIGGER` fired, stop. Do not convert optional hardening discovered during review into mandatory same-Goal work.

## Local operating loop

```text
1. Read only the current task, relevant local authorities, and required evidence.
2. Classify Authority, Plan, and Assurance independently.
3. REUSE: implement within the accepted base Contracts; no new Spec for internal choices.
4. AMEND/NEW: use the active local atomic permission only where applicable.
5. CONTROLLED/SUPERSEDE or no active atomic permission: keep the docs-first boundary.
6. Review the actual affected surface; acceptance is by the authorized maintainer.
7. Run relevant tests and report implementation, installation, and business results separately.
8. Scope any real blocker to dependent work; do not restart unrelated completed checks.
9. Prefer existing safe recovery; optional generalized maintenance stays separate.
10. DONE_WHEN met without a valid EXPANSION_TRIGGER -> STOP.
```

Local extensions may refine the vendored governance but may not silently weaken or contradict the pinned distribution. Updating the distribution requires a separate docs-only adoption/update review.
---
name: spec-governance
description: Route goal-driven work through independent Authority, Plan, and Assurance decisions without conflating Product Authority, one-operation mandates, implementation, runtime state, or Evidence.
---

# Spec Governance Skill V1

Use exactly one primary mode per invocation:

```text
PREFLIGHT   classify Authority, Plan, Assurance, readiness, and next action
AUTHOR      create or revise Product Authority when the route requires it
REVIEW      independently review an exact authority/change/final Head
COMPLIANCE  evaluate exact implementation or operation against exact Contracts
```

Change Briefs, ExecPlans, Execution Mandates, and Controlled Runbooks are artifacts, not modes.

## Read order

1. `AGENTS.md`;
2. `.agents/README.md`;
3. `.agents/local/README.md`;
4. directly relevant accepted authorities;
5. only the selected mode file.

Read the V1 protocol and Spec format only as needed.

## Shared invariants

```text
Product Authority creates long-lived obligations.
Execution Mandate constrains one operation.
Every mutation needs attributable target/scope/effects/Done When authorization and an isolated write surface.
Complexity determines Plan.
Failure consequence determines Assurance.
Investigation / Task / test / Review comment do not create Product Authority.
AMEND/NEW + CONTROLLED and every SUPERSEDE route are docs-first.
Load-bearing SPEC_GAP -> AMEND/SUPERSEDE/NEW + readiness NO + RE_PREFLIGHT.
Inaccessible required Evidence -> REQUIRED_GATE_FAILURE, not automatically FALSE_EVIDENCE.
Runtime is Observation, not authority.
Emergency pre-Spec action is Owner-authorized incident containment only; no durable new behavior.
DONE_WHEN met without EXPANSION_TRIGGER -> STOP.
```

For every mode, bind exact coordinates, preserve stable accepted IDs and whole-authority backlinks, separate Observation from Working Guess when it affects routing, distinguish deterministic checks from semantic judgment, and persist load-bearing results outside chat.

Choose `PREFLIGHT` before non-trivial code/operation unless a persisted record covers the exact request and coordinates. Choose `AUTHOR` only for `AMEND`, `SUPERSEDE`, or `NEW`; `REUSE` normally uses a Brief/ExecPlan. Choose `REVIEW` for independent exact-Head/affected-Contract/final-Head review. Choose `COMPLIANCE` after implementation or operation exists.

One Agent may perform Recorder, PREFLIGHT, and Planner cognitive functions. Independence is required only where Durable/Controlled assurance, authority, or local policy requires it; do not create a fixed Agent formation.
docs/reviews/SCHEDULER_OCCURRENCE_OUTCOME_V3_DECISION_REVIEW.md
.agents/skills/spec-governance/SKILL.md
.agents/skills/spec-governance/modes/REVIEW.md
.agents/skills/spec-governance/modes/AUTHOR.md
.agents/skills/spec-governance/modes/COMPLIANCE.md
.agents/skills/spec-governance/modes/PREFLIGHT.md
.agents/protocol/SPEC_FORMAT_V0.md
docs/AGENT_CORE_PRODUCT_ARCHITECTURE_V1.md
docs/decisions/BINDING_AND_SWITCH_V1.md
docs/decisions/README.md
docs/decisions/AGENT_SESSION_CHANNEL_MODEL_V1.md
docs/decisions/SCHEDULER_V1.md
docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V2.md
docs/decisions/SCHEDULER_OCCURRENCE_OUTCOME_V2.md
docs/decisions/AGENT_SESSION_CHANNEL_MODEL_V1.api.json
docs/decisions/MEMORY_V1.md
docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V3.md
docs/decisions/SCHEDULER_OCCURRENCE_OUTCOME_V3.md
docs/reports/HR_RESTART_LOST_FENCE_TRUSTED_RECOVERY_V1_OWNER_DECISION_PACKET.md
docs/reports/SCHEDULER_WATCHDOG_ROUTING_AND_STUCK_OCCURRENCE_RECOVERY_V1_OWNER_DECISION.md
docs/reports/e42-capacity-method-a-v2-20261019/E42-CAPACITY-PLAN-A-V2-ORIGINAL-QUALIFIED-DECISION-20261019.json
docs/reports/e42-fixed-capacity-facts-20261019/ORIGINAL-QUALIFIED-DECISION.json
docs/investigations/b7-e42-q3-npm-basis-accepted-20261019/ORIGINAL-QUALIFIED-DECISION.json
docs/investigations/b7-first-anchor-predicate-recording-accepted-20261020/ORIGINAL-TECHNICAL-DECISION.json
docs/investigations/b7-fixed-offline-continuation-accepted-20261020/ORIGINAL-QUALIFIED-DECISION.json
docs/investigations/b7-selected-e1c-app-export-accepted-20261020/ORIGINAL-QUALIFIED-DECISION.json
docs/investigations/b7-fresh-six-carrier-accepted-20261020/ORIGINAL-QUALIFIED-DECISION.json
docs/investigations/b7-app-anonymous-transport-accepted-20261020/ORIGINAL-QUALIFIED-DECISION.json
docs/investigations/b7-exact-p-third-call-accepted-20261020/ORIGINAL-QUALIFIED-DECISION.json
docs/investigations/b7-e42-pre-npm-lineage-accepted-20261020/ORIGINAL-QUALIFIED-DECISION.json
docs/investigations/b7-e42-fixed-g-budget-accepted-20261019/ORIGINAL-QUALIFIED-DECISION.json
docs/investigations/b7-e42-public-selector-groups-accepted-20261019/ORIGINAL-QUALIFIED-DECISION.json

codex
已固定审查坐标：候选 `7f4cf5b5e3ea9ada879617d506e3c921cefe8308`，本地 `origin/main=937d9cbc58431fe8421405066f04b2a226928ee6`；工作树干净，差异仅为目标 Spec。本人未参与该稿创作。本轮按仓内 `spec-governance` 的 REVIEW 模式审查，判定不构成接受或执行授权。
2026-11-09T22:44:18.655910Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 403 Forbidden, url: wss://chatgpt.com/backend-api/codex/responses
2026-11-09T22:44:19.579238Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 403 Forbidden, url: wss://chatgpt.com/backend-api/codex/responses
2026-11-09T22:44:20.026220Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 403 Forbidden, url: wss://chatgpt.com/backend-api/codex/responses
2026-11-09T22:44:20.646586Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 403 Forbidden, url: wss://chatgpt.com/backend-api/codex/responses
2026-11-09T22:44:21.619308Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 403 Forbidden, url: wss://chatgpt.com/backend-api/codex/responses
2026-11-09T22:44:22.000332Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when UnexpectedServerResponse("HTTP 502: ")
2026-11-09T22:44:23.360223Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 403 Forbidden, url: wss://chatgpt.com/backend-api/codex/responses
2026-11-09T22:44:24.709087Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when UnexpectedServerResponse("HTTP 502: ")
2026-11-09T22:44:25.564856Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 403 Forbidden, url: wss://chatgpt.com/backend-api/codex/responses
2026-11-09T22:44:26.562134Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 403 Forbidden, url: wss://chatgpt.com/backend-api/codex/responses
2026-11-09T22:44:26.813271Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 403 Forbidden, url: wss://chatgpt.com/backend-api/codex/responses
2026-11-09T22:44:26.986116Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 403 Forbidden, url: wss://chatgpt.com/backend-api/codex/responses
2026-11-09T22:44:27.650207Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 403 Forbidden, url: wss://chatgpt.com/backend-api/codex/responses
2026-11-09T22:44:27.944061Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when UnexpectedServerResponse("HTTP 502: ")
2026-11-09T22:44:28.532920Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when UnexpectedServerResponse("HTTP 502: ")
2026-11-09T22:44:28.710169Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 403 Forbidden, url: wss://chatgpt.com/backend-api/codex/responses
2026-11-09T22:44:30.430238Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 403 Forbidden, url: wss://chatgpt.com/backend-api/codex/responses
2026-11-09T22:44:30.613707Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when UnexpectedServerResponse("HTTP 502: ")
2026-11-09T22:44:32.855931Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 403 Forbidden, url: wss://chatgpt.com/backend-api/codex/responses
2026-11-09T22:44:33.851906Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 403 Forbidden, url: wss://chatgpt.com/backend-api/codex/responses
2026-11-09T22:44:33.854135Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 403 Forbidden, url: wss://chatgpt.com/backend-api/codex/responses
2026-11-09T22:44:34.326041Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 403 Forbidden, url: wss://chatgpt.com/backend-api/codex/responses
2026-11-09T22:44:34.915119Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 403 Forbidden, url: wss://chatgpt.com/backend-api/codex/responses
2026-11-09T22:44:34.956926Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when UnexpectedServerResponse("HTTP 502: ")
2026-11-09T22:44:35.935122Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 403 Forbidden, url: wss://chatgpt.com/backend-api/codex/responses
2026-11-09T22:44:36.388464Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when UnexpectedServerResponse("HTTP 502: ")
2026-11-09T22:44:37.669071Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 403 Forbidden, url: wss://chatgpt.com/backend-api/codex/responses
exec
/bin/zsh -lc "cat .agents/skills/spec-governance/modes/REVIEW.md; nl -ba .agents/protocol/SPEC_FORMAT_V0.md; nl -ba .agents/local/README.md | sed -n '1,95p'; nl -ba docs/decisions/README.md" in /tmp/review-609/repo
 succeeded in 0ms:
# REVIEW mode

## Goal

Independently evaluate an exact candidate, affected implementation surface, controlled operation, or final accepted Head without creating Product Authority or expanding into open-ended research.

## Coordinates

```text
REPOSITORY
REVIEW_KIND = SPEC | AFFECTED_CONTRACT | CONTROLLED_OPERATION | FINAL_HEAD
REVIEW_TARGET_HEAD
BASE_HEAD
CURRENT_BASE_HEAD
REVIEWER_ID
AUTHOR_ID
ASSURANCE_LEVEL
```

Do not rely on unrecorded chat or inaccessible author-only material.

## Review scope

Use `review.scope = DELTA` for receipt-only Head changes, bounded semantic repairs, or bounded relevant Base changes; still independently recheck the final Head and all invalidated dependencies. Record `scope_reason` and `impact_evidence`. Use `FULL` only for `INITIAL_REVIEW`, an identified `ACCEPTED_FULL_GATE`, or demonstrated `UNBOUNDED_IMPACT`; a new SHA alone never requires it. The complete applicable production matrix stays mandatory, but unchanged mechanisms are not rerun without invalidation. Freeze scope/gates, not the ability to identify real risks.

Follow the grammar's bounded delivery cycle. Review repairs and reachable regressions; do not restart full-system research under a new candidate or packet name. Historical reviews remain evidence, not new authority. Prefer persisting recheck receipts in the PR conversation, so recording the result does not change the reviewed candidate Head.

## Passes

- **Authority/route:** local ownership, exact parents/refs, one unique Authority action, explicit implementation authority, proposal boundaries, no partial supersession, mandate scope.
- **Primitives/Evidence:** Observation versus interpretation, State coordinates, Claim support, load-bearing Evidence relations, reviewability, Secret-safe receipts.
- **Scope/stop:** Goal/Gap, non-goals, allowed/forbidden effects, Done When, Expansion Trigger, optional infrastructure not masquerading as progress.
- **Contracts/Acceptance:** relevant semantic paths; each Acceptance can produce Required Evidence and reject a concrete wrong implementation.
- **Base impact:** unrelated Base movement gets bounded conflict/authority/behavior/Evidence checking; candidate/relevant authority/behavior/conflict changes invalidate affected review.

### Convergence exit (conditional)

Applies only when the change claims convergence, retirement, or migration completion; otherwise `NOT_APPLICABLE`. Before final convergence may pass, verify with bound evidence:

```text
NEW_PATH_USABLE                    the current path satisfies applicable business
                                   and safety Contracts, with executed evidence
OLD_EXECUTION_PATH_RETIRED         the retired executable path cannot re-enter new
                                   work through affected normal or fallback paths
RECOVERY_DOES_NOT_REVIVE_OLD_PATH  applicable restart, recovery, retry, replay, and
                                   migration reruns do not recreate the retired
                                   model or transfer authority improperly
```

Bind each proof to scope, revision, environment, and observation time. Validate the Change Brief's RETAIN / RETIRE / MIGRATE / TEMPORARY_BRIDGE dispositions and, for any remaining bridge, its real consumer and exit condition. Retiring an executable path is not deleting history: audits, receipts, migration records, and necessary tombstones stay readable without granting present eligibility. A stable supported public facade may remain permanently and never blocks convergence; only a temporary migration bridge owes a real consumer and an objectively verifiable exit condition. Unknown or unexecuted coverage stays unknown — it must not become zero, PASS, or fabricated execution. A remaining bridge means a bounded stage, not final retirement. Review uses the parent's existing blocker classes and legal sources; already authorized contract-preserving cleanup needs no new approval merely because it is refactoring.

## Findings

A Blocker uses one class:

```text
CONTRACT_VIOLATION
REPOSITORY_INVARIANT_VIOLATION
CONCRETE_REGRESSION
SECURITY_OR_DATA_LOSS
FALSE_EVIDENCE
SCOPE_ESCALATION
REQUIRED_GATE_FAILURE
```

Every Blocker states `SOURCE`, `COUNTEREXAMPLE`, `IMPACT`, `MINIMAL_CLOSURE`. Legal sources are accepted Product Authority, accepted local governance/invariant authority, a pre-existing active machine gate, or a valid Execution Mandate.

Use `SPEC_GAP`, `FOLLOW_UP`, or `TOOLING_DEBT` for non-Blockers. A load-bearing gap still makes dependent readiness false, but must carry the protocol's concrete `spec_gap_detail` diagnosis. Reviewer preference or an unproven dependency cannot silently create a new product requirement. An unresolved safety uncertainty remains a narrow pause for fact-finding, not permission to execute. An open Blocker's named `affected_readiness` boundaries must include an explicit `NO` and no `YES`; do not stop unrelated authorized work. Inaccessible required Evidence is `REQUIRED_GATE_FAILURE`; use `FALSE_EVIDENCE` only for fabrication, material distortion, or false execution claim.

## Output

```text
SPEC_GOVERNANCE_MODE = REVIEW
REVIEW_KIND = SPEC | AFFECTED_CONTRACT | CONTROLLED_OPERATION | FINAL_HEAD
SPEC_REVIEW = ACCEPT | REVISE | NOT_APPLICABLE
REVIEW_TARGET_HEAD = <sha>
BASE_HEAD = <sha>
CURRENT_BASE_HEAD = <sha>
REVIEWER_ID = <identity>
AUTHOR_INDEPENDENCE = PASS | FAIL | NOT_REQUIRED
AUTHORITY_REVIEW = PASS | FAIL
PRIMITIVE_BOUNDARY_REVIEW = PASS | FAIL | NOT_APPLICABLE
CONTRACT_REVIEW = PASS | FAIL | NOT_APPLICABLE
ACCEPTANCE_COVERAGE_REVIEW = PASS | FAIL | NOT_APPLICABLE
MANDATE_SCOPE_REVIEW = PASS | FAIL | NOT_APPLICABLE
EVIDENCE_REVIEWABILITY = PASS | FAIL | NOT_APPLICABLE
BASE_IMPACT = NONE | BOUNDED | RELEVANT
REVIEW_SCOPE = NONE | DELTA | FULL
SCOPE_REASON = <when review or recheck is required>
IMPACT_EVIDENCE = <bound diff and dependent evidence checks>
FULL_REVIEW_BASIS = INITIAL_REVIEW | ACCEPTED_FULL_GATE | UNBOUNDED_IMPACT
                   # only for FULL
BLOCKERS = <n>
SPEC_GAPS = <n>
FOLLOW_UPS = <n>
TOOLING_DEBT = <n>
IMPLEMENTATION_ALLOWED = YES | NO | NOT_APPLICABLE
MERGE_READY = YES | NO | NOT_APPLICABLE
OPERATION_ALLOWED = YES | NO | NOT_APPLICABLE
NEXT_ACTION = CONTINUE | STOP | RE_PREFLIGHT | OWNER_DECISION
```

Review is not acceptance.

Final accepted-Head recheck binds `FINAL_ACCEPTED_HEAD`, `ACCEPTANCE_ACTOR`, `ACCEPTED_AT`, `SEMANTIC_DELTA_AFTER_REVIEW`, and `FINAL_HEAD_RECHECK`. Any normative semantic delta requires a new independent review.
     1	# Governing Spec Format V0
     2	
     3	```text
     4	FORMAT_VERSION = 1.0.0
     5	STATUS = accepted
     6	```
     7	
     8	This file defines the minimum syntax contract for governing Specs. It is deliberately narrower than semantic review.
     9	
    10	---
    11	
    12	## 1. Location and identity
    13	
    14	Governing Specs use a stable path:
    15	
    16	```text
    17	docs/specs/<SPEC_ID>.md
    18	```
    19	
    20	Do not move Specs among `proposed/`, `accepted/`, `rejected/`, or `implemented/` directories. Lifecycle is metadata; implementation and conformance are separate records.
    21	
    22	`SPEC_ID` is stable, uppercase, and versioned. Every new proposed or accepted governing Spec MUST match:
    23	
    24	```text
    25	^[A-Z][A-Z0-9_]*_V[0-9]+$
    26	```
    27	
    28	Examples:
    29	
    30	```text
    31	AGENT_FORUM_CORE_INVARIANTS_V1
    32	AUTH_SERVICE_CREDENTIAL_ROTATION_V2
    33	```
    34	
    35	The schema's legacy-ID allowance applies only to an already-existing historical authority in its atomically
    36	superseded state. It MUST NOT be used to create a proposed or accepted legacy identifier such as a new
    37	`*_AMENDMENT` Spec.
    38	
    39	A change to existing accepted normative meaning, or a new independent normative
    40	meaning, uses a new Spec ID.
    41	
    42	A strictly additive bounded elaboration under an existing accepted Decision
    43	follows §14.2.
    44	
    45	---
    46	
    47	## 2. Required frontmatter
    48	
    49	```yaml
    50	---
    51	spec_id: EXAMPLE_BEHAVIOR_V1
    52	status: proposed
    53	spec_kind: implementation
    54	authority_level: governing_spec
    55	implementation_authority: contracts
    56	scope:
    57	  - example-service
    58	governed_by:
    59	  - EXAMPLE_PRODUCT_DIRECTION_V1
    60	external_authorities: []
    61	supersedes: []
    62	superseded_by: null
    63	owners:
    64	  - repository-maintainers
    65	---
    66	```
    67	
    68	### 2.1 `status`
    69	
    70	```text
    71	proposed | accepted | superseded
    72	```
    73	
    74	`status: accepted` becomes active repository authority only when that exact content is present in the repository's designated authority branch. Merely setting the field on an unmerged PR branch does not activate it.
    75	
    76	### 2.2 `spec_kind`
    77	
    78	```text
    79	invariant | program | implementation
    80	```
    81	
    82	### 2.3 `authority_level`
    83	
    84	For governing Specs:
    85	
    86	```text
    87	governing_spec
    88	```
    89	
    90	Product Direction and Architecture authorities may use equivalent frontmatter with `authority_id` and their own `authority_kind`; downstream Specs reference those stable IDs through `governed_by`.
    91	
    92	### 2.4 `implementation_authority`
    93	
    94	```text
    95	none | contracts
    96	```
    97	
    98	`none` means acceptance does not authorize code. `contracts` means accepted Contracts may authorize bounded implementation after all base-branch and review rules are satisfied.
    99	
   100	### 2.5 `governed_by`
   101	
   102	Local parent authority IDs in precedence order. An empty list is allowed only when the repository explicitly identifies the Spec as a top-level local authority and the authorized maintainer accepts that role.
   103	
   104	### 2.6 `external_authorities`
   105	
   106	Each entry contains:
   107	
   108	```yaml
   109	external_authorities:
   110	  - repository: mayf3/auth-service
   111	    authority_id: AUTH_SERVICE_EXAMPLE_V1
   112	    revision: 0123456789abcdef0123456789abcdef01234567
   113	    relation: depends_on
   114	```
   115	
   116	Allowed relationships include:
   117	
   118	```text
   119	depends_on
   120	constrained_by
   121	interoperates_with
   122	```
   123	
   124	An external reference does not grant local supersession authority.
   125	
   126	### 2.7 `supersedes` and `superseded_by`
   127	
   128	V0 uses whole-Spec IDs only. Contract fragments such as `OLD_SPEC#CTR-003` are forbidden in supersession metadata.
   129	
   130	Transition rules:
   131	
   132	- proposed Spec: `superseded_by: null`;
   133	- accepted replacement: `supersedes` names every fully replaced authority;
   134	- superseded Spec: `superseded_by` names the accepted replacement;
   135	- backlinks change atomically in the same docs-only change.
   136	
   137	For the narrow legacy identifier retirement rule defined in this section and enforced by `.agents/tools/validate_spec_transition.py`:
   138	
   139	- a new proposed or accepted `spec_id` remains strict `_V<number>` only;
   140	- an already-existing legacy `spec_id` in the narrow
   141	  `^[A-Z][A-Z0-9_]*_V[0-9]+_[A-Z][A-Z0-9_]*$` class, excluding IDs that also match the strict form, is
   142	  schema-valid only when `status: superseded`;
   143	- `supersedes` may carry the matching whole legacy ID as a retirement reference;
   144	- `superseded_by` remains null or a strict `_V<number>` successor;
   145	- `governed_by` and external authority IDs remain strict and cannot depend on legacy IDs;
   146	- existence in the transition base and atomic bidirectional closure are cross-record validator requirements, not
   147	  facts inferred from single-record schema validity.
   148	
   149	The legacy path cannot introduce partial supersession or increase the active legacy-authority set.
   150	
   151	---
   152	
   153	## 3. Required sections
   154	
   155	A governing Spec contains these sections in this logical order. Additional sections are allowed when they do not blur primitive types.
   156	
   157	```text
   158	1. Goal
   159	2. Scope and non-goals
   160	3. Authority and dependencies
   161	4. Current State
   162	5. Observations
   163	6. Claims and assumptions
   164	7. Evidence relations
   165	8. Decisions
   166	9. Contracts
   167	10. Acceptance
   168	11. Alternatives and disposition
   169	12. Migration, compatibility, and rollback
   170	13. Open questions
   171	```
   172	
   173	A section may state `Not applicable` with a reason. It may not be silently omitted when the topic is relevant.
   174	
   175	---
   176	
   177	## 4. Stable item IDs
   178	
   179	Recommended forms:
   180	
   181	```text
   182	OBS-001
   183	CLM-001
   184	STATE-001
   185	EVD-001
   186	DEC-001
   187	CTR-AUTH-001
   188	ACC-AUTH-001
   189	ALT-001
   190	```
   191	
   192	Rules:
   193	
   194	- IDs are stable after acceptance;
   195	- IDs are never renumbered to close gaps;
   196	- IDs are never reused after deletion or supersession;
   197	- references use the exact ID, not only a section number;
   198	- a Contract’s global identity is `<SPEC_ID>#<CONTRACT_ID>`.
   199	
   200	---
   201	
   202	## 5. Current State syntax
   203	
   204	A load-bearing State statement records or references:
   205	
   206	```text
   207	subject
   208	as_of_commit or artifact revision
   209	environment
   210	observed_at
   211	basis: OBS-* / CLM-* / provenance
   212	```
   213	
   214	Example:
   215	
   216	```markdown
   217	- `STATE-AUTH-001` — Production token issuance mode is `v1` on deployment
   218	  `deploy-2026-08-18.3`, observed at `2026-08-18T10:20:00Z`.
   219	  Basis: `OBS-AUTH-003`, `OBS-AUTH-004`, `CLM-AUTH-001`.
   220	```
   221	
   222	Invalid:
   223	
   224	```markdown
   225	The current system guarantees v1 behavior.
   226	```
   227	
   228	The invalid form lacks subject coordinates and also coerces descriptive State into a normative Contract.
   229	
   230	---
   231	
   232	## 6. Observation syntax
   233	
   234	Example:
   235	
   236	```markdown
   237	### OBS-AUTH-003 — Runtime banner reports v1 mode
   238	
   239	- Subject: production auth-service process
   240	- Source revision: `abc123...`
   241	- Environment: production host group `auth-primary`
   242	- Observed at: `2026-08-18T10:20:00Z`
   243	- Method: inspect startup banner after verified restart
   244	- Result: banner reports `mode=v1`
   245	- Provenance: deployment log reference `...`
   246	```
   247	
   248	Do not add causal interpretation to the Observation result. Put interpretation in a Claim.
   249	
   250	---
   251	
   252	## 7. Claim syntax
   253	
   254	Example:
   255	
   256	```markdown
   257	### CLM-AUTH-001 — The v1 issuer path is the active production path
   258	
   259	- Support state: SUPPORTED
   260	- Supported by evidence: `EVD-AUTH-001`
   261	- Contradicted by evidence: none known
   262	- Uncertainty: runtime evidence covers the observed deployment only
   263	```
   264	
   265	Allowed support states:
   266	
   267	```text
   268	SUPPORTED | INFERRED | OPEN_ASSUMPTION
   269	```
   270	
   271	An `OPEN_ASSUMPTION` that changes authority or Contract meaning blocks acceptance unless converted into an explicit owner decision or bounded risk Contract.
   272	
   273	---
   274	
   275	## 8. Evidence relation syntax
   276	
   277	Example for a Claim or State assertion:
   278	
   279	```markdown
   280	### EVD-AUTH-001 — Runtime observations support the active-path Claim
   281	
   282	- Source observations: `OBS-AUTH-003`, `OBS-AUTH-004`
   283	- Target: `CLM-AUTH-001`
   284	- Relation: SUPPORTS
   285	- Bound coordinates: auth-service `abc123...`, production `auth-primary`, observed `2026-08-18T10:20:00Z`
   286	- Strength/sufficiency: strong for the observed deployment
   287	- Limitations: does not establish behavior on unobserved replicas or future revisions
   288	- Provenance: deployment log and audit-query references `...`
   289	```
   290	
   291	In a governing Spec, the target is a Claim or State assertion and the relation is `SUPPORTS` or `CONTRADICTS`. Evidence that evaluates a Contract at an exact Spec revision uses `SATISFIES`, `VIOLATES`, or `INCONCLUSIVE` and is recorded later in a Conformance Record.
   292	
   293	Raw files, screenshots, logs, or test definitions are provenance material. An executed result with coordinates is an Observation. The explicit source-to-target relation is Evidence.
   294	
   295	---
   296	
   297	## 9. Decision syntax
   298	
   299	Example:
   300	
   301	```markdown
   302	### DEC-AUTH-001 — External consumers remain offline-verification-only
   303	
   304	- Decision owner: repository owner
   305	- Decision: external resource consumers validate signed tokens offline.
   306	- Rejected alternative: generic online introspection.
   307	- Reason: preserve the frozen trust boundary and avoid a new live dependency.
   308	```
   309	
   310	A Decision does not hide implementation detail that materially affects external behavior, failure semantics, security, migration, or lifecycle.
   311	
   312	---
   313	
   314	## 10. Contract syntax
   315	
   316	Each Contract is independently reviewable and testable.
   317	
   318	Example:
   319	
   320	```markdown
   321	### CTR-AUTH-001 — No external live status lookup
   322	
   323	External resource consumers MUST validate Access Tokens using offline signature and
   324	claim verification. They MUST NOT call auth-service for live principal, client,
   325	or token status during request authorization.
   326	```
   327	
   328	Use normative verbs consistently:
   329	
   330	```text
   331	MUST
   332	MUST NOT
   333	MAY
   334	```
   335	
   336	A Contract states caller, subject, conditions, result, and relevant failures. Avoid vague forms such as “should work,” “handle correctly,” or “be secure.”
   337	
   338	---
   339	
   340	## 11. Acceptance syntax
   341	
   342	Every active Contract has at least one Acceptance mapping.
   343	
   344	Example:
   345	
   346	```markdown
   347	### ACC-AUTH-001 — Offline consumer verification
   348	
   349	- Contracts: `CTR-AUTH-001`
   350	- Method: integration test with auth-service unavailable after JWKS cache warmup
   351	- Environment: staging
   352	- Required evidence: executed command, implementation commit, configuration,
   353	  request/response record, and service-call audit showing zero introspection calls
   354	- Expected result: authorization succeeds from cached JWKS data with zero live
   355	  auth-service calls
   356	- Failure condition: any authorization-time call to auth-service fails acceptance
   357	```
   358	
   359	The syntax pass checks both directions:
   360	
   361	- every referenced Contract exists;
   362	- every active Contract has Acceptance coverage or an explicit evidence exception.
   363	
   364	---
   365	
   366	## 12. Alternatives and investigation disposition
   367	
   368	A Spec records rejected alternatives that directly explain its accepted Decision.
   369	
   370	When an investigation produces no new governing Spec, persist an Investigation Record instead. Do not leave a forever-proposed Spec solely to preserve rejected reasoning.
   371	
   372	---
   373	
   374	## 13. Open questions and acceptance
   375	
   376	Before `status: accepted`:
   377	
   378	```text
   379	OPEN_OWNER_DECISIONS = NONE
   380	NORMATIVE_TBD = NONE
   381	UNRESOLVED_AUTHORITY_CONFLICT = NONE
   382	PARTIAL_SUPERSESSION = NONE
   383	```
   384	
   385	Non-normative follow-up work may remain when it cannot change Decision or Contract meaning.
   386	
   387	---
   388	
   389	## 14. Accepted immutability
   390	
   391	An accepted rule may later be replaced, but an existing stable ID always keeps
   392	the meaning that was accepted for that ID.
   393	
   394	### 14.1 Existing stable IDs
   395	
   396	Text associated with an existing accepted Decision, Contract, Acceptance item,
   397	or other stable normative ID may receive only editorial changes with proven
   398	semantic delta `NONE`. An existing ID may not be narrowed, expanded, reversed,
   399	deleted and reused, or assigned a different meaning.
   400	
   401	### 14.2 Strictly additive amendment under the same `spec_id`
   402	
   403	A docs-only `AMEND` MAY add new stable IDs to the same accepted Spec only when
   404	all of the following are true:
   405	
   406	- Goal is unchanged;
   407	- scope and authority ownership are unchanged;
   408	- `governed_by` and external-authority boundaries are unchanged;
   409	- every accepted Decision remains unchanged;
   410	- every existing stable ID and its Acceptance meaning remain unchanged;
   411	- each new Contract is a bounded elaboration of an already accepted Decision,
   412	  not a new independent product or architecture choice;
   413	- the new IDs and their Contract-to-Acceptance mappings receive independent,
   414	  exact-revision review;
   415	- no partial supersession is introduced.
   416	
   417	This seam permits a newly identified `CTR-*` that makes an existing accepted
   418	Decision operationally complete. It does not permit changing an existing
   419	`CTR-*` or smuggling a new Decision into the old authority.
   420	
   421	### 14.3 `NEW` and `SUPERSEDE` boundaries
   422	
   423	`NEW` is required for:
   424	
   425	- a new Decision;
   426	- expanded scope or changed authority ownership;
   427	- a new independent obligation;
   428	- an obligation that is not entailed by the existing accepted Decisions.
   429	
   430	`SUPERSEDE` is required for:
   431	
   432	- deletion, narrowing, expansion, reversal, or replacement of existing
   433	  normative meaning;
   434	- changed identity, authorization, failure, retry, timeout, transaction,
   435	  lifecycle, migration, compatibility, or security semantics;
   436	- removal of an existing obligation;
   437	- changed Acceptance meaning that could cause a previously passing
   438	  implementation to fail or a previously failing implementation to pass.
   439	
   440	---
   441	
   442	## 15. Syntax versus semantics
   443	
   444	A deterministic parser may check:
   445	
   446	- frontmatter presence and enums;
   447	- ID uniqueness and patterns;
   448	- required sections;
   449	- local backlinks;
   450	- Contract-to-Acceptance references;
   451	- forbidden partial-supersession references;
   452	- unresolved placeholders;
   453	- governance lock integrity;
   454	- presence and status of a Spec in a known base.
   455	
   456	It cannot decide:
   457	
   458	- whether a Claim is justified;
   459	- whether a Contract is complete;
   460	- whether an alternative was honestly considered;
   461	- whether Product Direction has been silently overridden;
   462	- whether evidence is sufficient in the real environment.
   463	
   464	Those remain semantic review responsibilities.
     1	# Repository-local governance — dsh-agent-core
     2	
     3	This file is owned by `mayf3/dsh-agent-core`. It is not part of the vendored distribution and is not overwritten by governance updates.
     4	
     5	## Repository identity
     6	
     7	```text
     8	REPOSITORY = mayf3/dsh-agent-core
     9	AUTHORITY_BRANCH = main
    10	GOVERNANCE_LOCK = .agents/governance.lock.json
    11	ADOPTION_ACTIVATION = accepted lock + accepted adoption Spec merged into main
    12	```
    13	
    14	A proposed lock on a feature branch is only an adoption candidate. It is not active repository authority.
    15	
    16	## Authority precedence
    17	
    18	```text
    19	explicit Product Direction authority, when one is accepted
    20	> accepted Product Architecture and standalone long-lived Current Decisions
    21	> accepted implementation-authorizing Specs
    22	> code, tests, runtime state, migration records, and operational evidence
    23	```
    24	
    25	Current repository authority locations:
    26	
    27	```text
    28	PRODUCT_DIRECTION = NONE_STANDALONE
    29	PRODUCT_ARCHITECTURE = docs/AGENT_CORE_PRODUCT_ARCHITECTURE_V1.md
    30	ROADMAP / STRATEGIC_CONTEXT = docs/AGENT_CORE_ROADMAP_V1.md
    31	CURRENT_DECISION_INDEX = docs/decisions/README.md
    32	DECISIONS = docs/decisions/
    33	SPECS = docs/specs/
    34	```
    35	
    36	Local rules:
    37	
    38	- an implementation Spec may refine Architecture or a Current Decision, but may not silently contradict it;
    39	- changing accepted long-lived meaning requires a new whole-authority supersession transaction;
    40	- a Program Spec with `implementation_authority: none` coordinates work but does not authorize product implementation;
    41	- an accepted-looking document on an unmerged branch is not active authority;
    42	- code, tests, reports, and runtime evidence may prove conformance or drift but do not rewrite normative authority.
    43	
    44	## Bounded-development route (effective on V3 adoption only)
    45	
    46	These local choices become active only with the accepted
    47	`AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V3` and accepted lock merged into `main`.
    48	Until then, the authority branch's existing rules remain controlling.
    49	
    50	- `REUSE` inside an accepted implementation Contract needs no new Spec or
    51	  standalone Spec review merely because code changes. Use focused tests and the
    52	  review required by its Assurance level.
    53	- Explicitly permit one atomic Spec-delta-and-code PR for bounded
    54	  `AMEND/NEW + ROUTINE/DURABLE` work under the owner's task authorization. The
    55	  delta must be independently accepted before merge; it cannot contradict
    56	  Architecture, replace accepted meaning, widen privileges, change Secret/Grant
    57	  boundaries, introduce destructive migration, or authorize production effects.
    58	- `CONTROLLED` and `SUPERSEDE` remain docs-first. Implementation and production
    59	  permissions are separate; missing production permission does not itself stop
    60	  unrelated authorized nonproduction work.
    61	- Review the affected change and invalidated dependencies. A new SHA alone does
    62	  not require a full audit. Use the vendored explicit scope/impact checks.
    63	- Ordinary tasks use the existing PR/Brief; no mandatory extra Agent formation,
    64	  full-corpus review, or new control-plane document is introduced here.
    65	
    66	## Acceptance and review actors
    67	
    68	```text
    69	SPEC_ACCEPTANCE_ACTORS = repository owner mayf3, or an explicitly authorized maintainer recorded in the PR
    70	INDEPENDENT_SEMANTIC_REVIEWER = a reviewer who did not author the reviewed semantic delta
    71	MECHANICAL_EXEMPTION_REVIEWERS = independent reviewer; final disposition by mayf3 or an authorized maintainer
    72	EMERGENCY_AUTHORIZATION_ACTORS = mayf3 or an explicitly authorized maintainer
    73	```
    74	
    75	A review recommendation does not itself perform acceptance. Acceptance must bind the reviewed commit and the final accepted head.
    76	
    77	## Governing and persistence locations
    78	
    79	```text
    80	SPECS = docs/specs/
    81	INVESTIGATIONS = docs/investigations/
    82	LONG_LIVED_DECISIONS = docs/decisions/
    83	IMPLEMENTATION_CONFORMANCE = implementation PR record
    84	CROSS_ENVIRONMENT_OR_PRODUCTION_CONFORMANCE = docs/reports/ plus pinned runtime provenance
    85	SEMANTIC_REVIEW_RECORD = persistent PR conversation or docs/reports/
    86	EMERGENCY / INCIDENT_REFERENCE = persistent issue, PR, or report
    87	```
    88	
    89	## Current Owner-obligation Workflow authority
    90	
    91	The accepted paired governing authorities are `docs/specs/SVC_WORKFLOW_OWNER_OBLIGATION_WORKFLOWS_V2.md` in svc-workflow and `docs/specs/AGENT_CORE_WORKFLOW_OWNER_OBLIGATION_WORKFLOWS_V2.md` here, accepted by Root under user-delegated authority at reviewed semantic heads Svc `39587c33c8bcf26ad5689127f5c92a6abc8b562e` and Core `ac83fe5cea3701eb9436f74d1b5f6ed0013256a9`. The accepted Core whole successors are WAE V3, Assignee Transition Capability V3, WEC V3, GCR V2, WPO V4, and Owner Workflows V2. Assignee Transition Capability V2 is superseded by V3, and Owner Workflows V1 by V2, with reciprocal lifecycle links. The paired Svc acceptance-context successor is `SVC_WORKFLOW_ACCEPTANCE_CONTEXT_BINDING_V2`. Governing Contracts authorize source implementation only after their accepted revisions are present in the implementation base; production apply remains none.
    92	
    93	## Code structure rules
    94	
    95	Current binding repository-local rule: [`.agents/local/CODE_STRUCTURE_GUARDRAILS_V2.md`](CODE_STRUCTURE_GUARDRAILS_V2.md)
     1	# Decisions — Agent Core on DSH
     2	
     3	决策记录。每条决策格式：
     4	
     5	```markdown
     6	## D-<NNN>: <标题>
     7	
     8	- 状态: proposed | accepted | superseded-by-D-<NNN>
     9	- 日期: YYYY-MM-DD
    10	- 背景: 为什么需要决策
    11	- 决策: 选择了什么
    12	- 替代方案: 否决了什么
    13	- 影响: 对文档结构 / 代码 / 迁移的影响
    14	```
    15	
    16	已登记决策：
    17	
    18	## D-009: Scheduler Occurrence / Outcome / Session / Migration Current Decision（V3）
    19	
    20	- 状态: accepted（2026-09-13；Current Scheduler Authority；无 implementation / production authority；全文见
    21	  `docs/decisions/SCHEDULER_OCCURRENCE_OUTCOME_V3.md`）
    22	- 日期: 2026-09-13
    23	- 背景: D-007 将 `outcome_unknown` 与 same-job fence 绑定，但当前 Router 已能精确证明
    24	  `terminated_without_outcome`：旧 execution 不再继续，业务 outcome 与副作用仍未知。若继续保持
    25	  fence，Agent 无法安全恢复自己的未来 natural schedule；若映射为 failed/succeeded，则伪造业务结果。
    26	- 决策: 保留 D-007 全部 job/occurrence/at-most-once/retry/session/migration/store 语义，仅把
    27	  business-outcome uncertainty 与 execution termination 分开。可信 exact termination-only settlement
    28	  保持 occurrence=`outcome_unknown`、保存 UNKNOWN 业务事实、解除 execution fence，且不自动 retry；
    29	  允许 trusted-caller-scoped 的 exact self reconciliation，禁止模型选择结果、跨 Agent、raw store、
    30	  trigger_once、runtime reload、kill、run-as/OBO 或权限自增。
    31	- 替代方案: partial amendment D-007、termination=failed/succeeded、模型提供 Router handle/PID、
    32	  title 猜 job、raw fence 删除、shadow Scheduler、self trigger/reload bridge——均拒绝。
    33	- 影响: 独立 exact-final-head `1b41d76fc445846d2a65b5641d10fece79a1d506` review PASS 后，
    34	  authorized acceptance transaction 已完成；D-009 取代 D-007，D-005 历史状态不变。后续仍需 complete `SCHEDULER_TIMEOUT_OUTCOME_V3` 和
    35	  `AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V3` accepted/merged 后才可实现。
    36	
    37	## D-008: Agent / Workspace / Session / main 长期产品模型 Current Decision（V3）
    38	
    39	- 状态: accepted（2026-09-01；standalone Current Decision；Current Authority；
    40	  supersedes D-006 / V2；全文见
    41	  `docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V3.md`）
    42	- 日期: 2026-08-31（`TASK_NAME = 模型 执行`）
    43	- 背景: D-006 把普通 Agent-to-Agent Messaging 与 explicit Delegation 合并成单一
    44	  per-task non-main 模型；Owner Current Model 要求前者进入 target Agent canonical main、
    45	  后者保持 per-task non-main，并继续保持 cron per-execution non-main。
    46	- 决策: V3 完整重述 D-006 的仍有效 Current Truth，只把 A2A 拆成两个明确
    47	  primitive：Messaging → target canonical main（reuse/establish same main；each send = new
    48	  Run/Turn, not Session）；Delegation → one task one target non-main；Cron → one execution one
    49	  target non-main。Session 选择由 interaction primitive 决定；target/executing Agent 保持其
    50	  自己的 Workspace、Principal、credential 与 grants。
    51	- 替代方案: 保持所有 A2A per-task、所有 A2A 都进 main、long-lived pair Session、Scheduler
    52	  `run_once` 代替 Messaging、只 amendment D-006 §11——均拒绝，详见 V3 §30。
    53	- 影响: D-006 已原子标记 superseded-by-D-008；七份 active child authority 全部 PRESERVE。
    54	  本次 acceptance 不接受或实现 proposed `AGENT_CORE_AGENT_SESSION_MESSAGING_V1 r2`，不修改
    55	  child Spec、代码、Grant、Scheduler、Workflow、部署或 production state；后续 `会话 执行`
    56	  仍需形成独立 implementation-authorizing Spec。
    57	
    58	## D-007: Scheduler Occurrence / Outcome / Session / Migration Decision（V2，historical）
    59	
    60	- 状态: superseded-by-D-009（此前为 standalone Current Scheduler Authority；历史正文见
    61	  `docs/decisions/SCHEDULER_OCCURRENCE_OUTCOME_V2.md`）
    62	- 日期: 2026-08-19（2026-08-20 accepted；supersedes D-005）
    63	- 背景: D-005 的 job-level execution model（timeout=ordinary error、runningAtMs
    64	  去重、stable per-job Session、legacy catch-up）与真实 fleet evidence 冲突：140 个
    65	  enabled job 绝大多数产生非幂等外部副作用（NON_IDEMPOTENT_SIDE_EFFECT=113）、63/140
    66	  已有 timeout/error，而 Router/AgentProcess 无 cancel + proven termination——重复
    67	  admission 会产生重叠外部副作用；D-005 已 accepted，normative meaning 变化必须完整
    68	  supersession，不得同 stable ID amendment。
    69	- 决策: execution identity 从 job-level 移到 occurrence-level——每逻辑 occurrence 持久
    70	  occurrenceId / runId / idempotencyKey，durable reserve before Router，同 occurrence
    71	  at-most-once admission；timeout without proven termination = outcome_unknown（非
    72	  ordinary failed；same-job execution fence 直到 trusted late settlement / operator
    73	  reconcile；无自动 retry / re-admission；late settlement 只解析状态不重放）；ordinary
    74	  failed retry = 新 occurrence；durable states = admitted / running / succeeded /
    75	  failed / outcome_unknown；exact jobs.json 原子持久化、runs.jsonl 10MB evidence、
    76	  cross-process mutation protocol、CLI control-only 全部 PRESERVE；scheduled Session
    77	  = 每 occurrence fresh non-main + same Agent primary Workspace（D-006）；OpenClaw
    78	  migration = definition-only import + strip legacy execution state + NO_CATCH_UP
    79	  （94 missed 不补跑）；restore gate = READY_TO_RESTORE_BEFORE_HARDENING 0。
    80	- 替代方案: amendment D-005——否决（normative meaning 实质变化）；timeout=failed、
    81	  same-occurrence retry、stale marker 清除重跑、unknown 放行下一自然 occurrence、
    82	  stable per-job Session、Session Mapping DB、补跑 94 次 missed——全部否决（见
    83	  `docs/specs/SCHEDULER_TIMEOUT_OUTCOME_V1.md` §10 与 D-007 §1）。
    84	- 影响: D-005 标记 superseded-by-D-007（保留为历史 authority，不删除、不改写历史
    85	  正文）；governing spec = accepted SCHEDULER_TIMEOUT_OUTCOME_V1；Scheduler
    86	  implementation 仍需独立 implementation round；本轮 acceptance = docs only（无代码、
    87	  无 production jobs、无 Scheduler store 修改、无 Kernel change、无 merge）。
    88	
    89	## D-006: Agent / Workspace / Session / main 长期产品模型 Current Decision（V2）
    90	
    91	- 状态: superseded-by-D-008（此前为 standalone Current Decision；历史正文保留；Current
    92	  Authority 已由 D-008 / V3 接管，全文见
    93	  `docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V2.md`）
    94	- 日期: 2026-08-17
    95	- 背景: 旧 authority 之间出现需人工 merge 才能理解的产品模型分叉（D-002「Agent 固定
    96	  拥有唯一 workspace」→ BINDING_WORKSPACE_V1「Binding 决定 effective workspace」→
    97	  FEISHU_WORKSPACE_MEMORY_ALIGNMENT_V1「conversation workspace」）；需要一份
    98	  standalone Current Decision 收敛长期产品模型，不再叠 amendment。
    99	- 决策: 一个 Feishu conversation → 一个长期 Agent → 一个 Workspace → 一个 canonical
   100	  main；Agent 拥有独立 agentId（≠ conversationId）；Agent 出生 = 自动创建，trigger =
   101	  FIRST_ELIGIBLE_HUMAN_MESSAGE（transport ingress eligibility 前置：p2p 首条真人消息 /
   102	  首次 @bot / no-mention 群首条 eligible 真人消息 → create；requireMention=true 未 @ →
   103	  drop 不创建）；出生 provisioning 非阻塞 —— AGENT_BIRTH_BLOCKS_ON_CREDENTIAL = NO
   104	  （AGENT_CHAT_READY = agentId + Workspace + AGENTS.md + canonical main/runtime；
   105	  principal/credential/baseline grants 失败不阻塞聊天，受影响 Broker capability
   106	  fail-closed + 后续 retry，MAIN_RESET != CAPABILITY_REPAIR）；Workspace = Agent 长期
   107	  状态（bootstrap 只 seed AGENTS.md，其余 Agent 自管）；Session = 只隔离 trajectory
   108	  （main / cron-run-* / agent-task-* / background-* 同 Agent 同 Workspace 同
   109	  security domain）；main = 可 reset 的 logical slot（reset 只影响 main，不动
   110	  Workspace/Binding）；cron = 每次执行 fresh session；Agent-to-Agent = 每 task 一个
   111	  session（不建永久 pair session）；non-main 不 merge 回 main，跨 Session continuity
   112	  靠 Workspace + MEMORY.md + 显式 task result；Feishu = FIXED（不切 Agent），Mobile =
   113	  SWITCHABLE（activeAgent only，不创建 Agent）；switch_agent 只限 switchable Product
   114	  Surface（Mobile main ALLOWED，Feishu/cron/agent-task NOT_ALLOWED）；security domain
   115	  = Agent（principal/credential/grants 属 Agent）。
   116	- 替代方案: 继续在旧 Spec 上叠 amendment——否决（Current Truth 更难找）；per-conversation
   117	  workspace 作为长期产品模型——否决（机制能力 ≠ 产品模型，ONE_AGENT_ONE_WORKSPACE 冻结）。
   118	- 影响: 文档 disposition：D-002 PARTIALLY_SUPERSEDE / D-004 PARTIALLY_SUPERSEDE
   119	  （机制保留：Binding owner / 持久化 / single-flight / switch≠角色扮演 / 薄 adapter；
   120	  产品语义被取代：Feishu 通用 switch / 全可 switch / first-contact→default Agent /
   121	  targetSessionId 人类入口状态）/ D-003 PARTIALLY_SUPERSEDE（产品 invariant 保留：
   122	  Memory 属 Agent Workspace / file-first / MEMORY.md / per-Agent 隔离；consolidation
   123	  时机等具体策略 = RETAIN_AS_IMPLEMENTED_STRATEGY，非产品 authority）/
   124	  AGENT_CORE_BINDING_WORKSPACE_V1 PARTIALLY_SUPERSEDE（机制保留，产品模型条款被取代）/
   125	  FEISHU_WORKSPACE_MEMORY_ALIGNMENT_V1 @ 6071dfd DO_NOT_ACCEPT（→ REPLACE_WITH_SMALLER_SPEC）。
   126	  OWNER_RULING_SYNC = PASS（R2 FIX_REQUIRED 四项已修：creation trigger / birth
   127	  readiness / D-004 / MEMORY_V1）。PRODUCT_CODE_CHANGE = NONE / RUNTIME_CHANGE = NONE /
   128	  MIGRATION = NONE / KERNEL_CHANGE = NONE。
   129	
   130	## D-004: Router / Binding 域操作与持久化（Product Integration V1）
   131	
   132	- 状态: accepted（分支 feat/product-integration-v1 已实现并真实验收，见
   133	  `docs/reports/product-integration-v1.md`；全文见
   134	  `docs/decisions/BINDING_AND_SWITCH_V1.md`）
   135	- 日期: 2026-08-15
   136	- 背景: Integration V1 的 Binding 是 Router 进程内 Map，重启即丢；没有统一切换
   137	  原语；Feishu 与未来 Mobile/Web 两条入口即将并存，路由规则必须只有一套。
   138	- 决策: Router / Control Plane 是 Binding 的唯一 owner；唯一切换原语
   139	  `Router.switchAgent(bindingContext, targetAgentId, { targetSessionId? })`——
   140	  1) Registry 验证 target Agent 存在，2) Router 选 Session（显式 sessionId，缺省
   141	  main，无 LLM 猜测），3) 更新并持久化 Binding，4) 返回新 Binding。所有入口
   142	  （Feishu connector / 未来 Product API / per-Agent DSH switch 工具）最终都调用
   143	  它；入口协议不进入核心路由规则。持久化 = 原子 JSON 单文档
   144	  （`<home>/.dsh/bindings/bindings.json`，tmp+rename，fail-loud），无数据库 /
   145	  event sourcing。DSH 工具 `agent_core.switch_agent` 是纯 adapter（经 demo-server
   146	  parent-RPC 转发），不拥有持久化 / 查找 / Session 选择 / 入口分支 / 导航历史。
   147	- 替代方案: Binding 留内存（重启丢——否决）；SQLite/Redis（本轮不需要——否决）；
   148	  tool 侧解析 Agent/选 Session（策略必须集中 Router——否决）；Feishu/Mobile 两套
   149	  Router（入口协议进核心规则——否决）。
   150	- 影响: agent-router 新增 BindingStore + switchAgent/getBinding + registry 校验 +
   151	  parent-RPC 钩子；demo-server 新增无状态 parent-RPC passthrough；新增
   152	  `packages/agent-switch/`、`bundle-agent-switch/`、`profile-integration-agent/`；
   153	  bundle-integration 新增 agent-registry 行与 router 配置 env 化；验收
   154	  `scripts/product-integration-v1-verify.mjs`。
   155	
   156	## D-005: Scheduler Replacement V1 — 最小 job 模型、持久化与执行语义
   157	
   158	- 状态: superseded-by-D-007（Scheduler authority 已由 D-007
   159	  SCHEDULER_OCCURRENCE_OUTCOME_V2 接管，见
   160	  `docs/decisions/SCHEDULER_OCCURRENCE_OUTCOME_V2.md`；此前 accepted，分支
   161	  feat/scheduler-replacement-v1 已实现并真实验收，见
   162	  `docs/reports/scheduler-replacement-v1.md`）
   163	- 日期: 2026-08-15
   164	- 背景: OpenClaw Gateway 内嵌 cron scheduler 是 141 个 enabled job（90 个
   165	  announce 回飞书群）的唯一执行者，是关闭 OpenClaw 的最大 blocker；需要最小替代
   166	  执行面，不复制 OpenClaw cron 系统。
   167	- 决策: Job 模型 = 现网字段真子集（cron/at/every + announce/none/silent + opaque
   168	  sessionKey + state 机）；持久化 = 单文件原子 JSON + runs.jsonl（无分布式栈）；
   169	  执行语义 = OpenClaw 忠实最小复刻（at 至多一次、cron/every 循环 + backoff、
   170	  停机补跑每 job 至多一次、invoke 前落 runningAtMs 防重复）；调用缝 = 注入式
   171	  `invokeAgent` seam（fake/noop，Router 后续接线）；投递缝 = opaque
   172	  `deliver` seam（无 Feishu SDK，`chat:oc_*` 不解释）；daemon 提交面 =
   173	  `scripts/agentcore-cron.mjs`（openclaw cron add/list/runs 1:1 flag）。
   174	- 替代方案: 完整 cron API clone——否决（现网只用了 3 个 CLI 面）；DSH
   175	  `dsh-schedule`——否决（无 cron/at、无跨会话存储）；分布式队列——否决（无多机
   176	  实证）。
   177	- 影响: 新增 `packages/scheduler/`（零 DSH 依赖）+ 3 个 scripts + 3 篇文档；
   178	  未触碰 agent-router/broker/feishu-connector/bundle/profile；迁移 =
   179	  `openclaw-job-import.mjs --write`（97.9% importable，3 条无 agentId legacy
   180	  job 需人工补）。
   181	- 追加（2026-08-15 第二轮审计，VERDICT: MERGE AFTER SMALL FIX）:
   182	  tick 单飞 + 最新态写回（FIX 1）；CLI 纯控制面、永不执行（FIX 2）；单一
   183	  mutation authority = 跨进程锁内重读最新再应用增量（FIX 3）；persist 失败 RAM
   184	  回滚（FIX 4）；import 已有 store 默认拒绝 + in-flight 只报告（FIX 5）。
   185	  详见 `docs/reports/scheduler-replacement-v1.md` §11。
   186	
   187	## D-003: Memory V1 — per-agent file-first 长期记忆（Agent Core memory glue）
   188	
   189	- 状态: accepted（分支 feat/agent-memory-v1 已实现并真实验收，见
   190	  `docs/reports/memory-v1.md`）
   191	- 日期: 2026-08-15
   192	- 背景: Session trajectory ≠ Agent long-term memory；调查收敛裁决 3 定「V1 以文件
   193	  记忆为主」，consolidation 是唯一完全缺失层。
   194	- 决策: 记忆 = `<workspace>/MEMORY.md`（curated 唯一事实源）+ `<workspace>/memory/
   195	  YYYY-MM-DD.md`（episodic）；隔离 = 物理目录隔离（per-agent workspace），无全局
   196	  库；新 session 拿记忆 = `systemPrompt.context` 同步重读注入 + `memory_*` 工具；
   197	  consolidation 时机 = turn/end + 防抖 + 显式工具/服务；输入 = session surface 证据
   198	  （直接用户消息 + 助手回复，seq 水位去重，输出逐条校验）；人工查看/编辑/删除 =
   199	  直接编辑 MEMORY.md（file-first，人工优先）；fallback = 原始证据始终落 daily note。
   200	- 替代方案: SQLite+镜像双写（mneme 式）——否决（全局库破坏隔离、双写复杂）；MCP
   201	  记忆服务——保留为可选后端；向量/embedding——DEFER。
   202	- 影响: 新增 `packages/agent-memory/` + `bundle-memory/` + `profile-memory/` +
   203	  `scripts/memory-v1-verify.mjs`；未触碰 agent-router/agent-registry/agent-session。
   204	
   205	## D-002: Agent / Session / Channel / Binding 模型与 API 契约（V1）
   206	
   207	- 状态: proposed
   208	- 日期: 2026-08-15
   209	- 背景: Router、渠道适配器（feishu-connector 等）与各端 UI 需要一个渠道无关的
   210	  统一「会话归属」契约，避免每个渠道各自发明一套语义。
   211	- 决策: 最小实体集 = Agent / Session / ChannelConversation / Binding。Agent 是长期
   212	  实体（固定拥有 workspace / DSH_HOME / credential / memory，V1 API 不暴露）；
   213	  Session 属于 Agent（main 长期主会话 + normal 可新建/归档/定期清理）；Channel 只是
   214	  UI/传输，不拥有 Agent 与 Session；「切换 Agent」= `switchAgent(ccv, agentId,
   215	  sessionId?)` 只改 Binding，不是角色扮演；未传 sessionId 固定进入目标 Agent 的
   216	  main；「换回来」= 客户端再次 switchAgent，V1 后端不保存切换 history/stack。
   217	  渠道落地入口 = 幂等 `resolveChannelConversation(channel, externalId)`：一步返回
   218	  ChannelConversation + Binding（首次创建时建立默认 Agent + main 的初始 Binding），
   219	  飞书只有 chatId 时即可直接 dispatch。端点清单 + 错误码 + 通用约定见
   220	  `AGENT_SESSION_CHANNEL_MODEL_V1.md`；Android 可直接 mock 的机器可读契约见
   221	  `AGENT_SESSION_CHANNEL_MODEL_V1.api.json`。
   222	- 替代方案: 把 Session 挂在 ChannelConversation 之下（Channel 拥有 Session）——否决：
   223	  与「Agent 是长期实体、跨渠道延续」原则冲突；把「切换」做成角色扮演/复制 Agent——
   224	  否决：产生状态分裂。
   225	- 影响: 入站消息按 Binding.activeAgentId 路由到 per-agent 进程（Router #9）；渠道
   226	  适配器只做 externalId ↔ ChannelConversation 映射 + 调 API；不实现后端。
   227	
   228	## D-001: V1 调查收敛 — 能力结论与首个实现里程碑
   229	
   230	- 状态: proposed
   231	- 日期: 2026-08-14
   232	- 背景: 五主题并行调查（identity-auth/memory/workspace-files/dashboard/always-on）
   233	  完成，需要收敛冲突结论并确定下一步唯一 milestone（详见 `docs/CAPABILITY_MATRIX.md`
   234	  与 `docs/README.md`）。
   235	- 决策:
   236	  1. 六项 BUILD 为「必须自己做」最小清单：workspace-bootstrap、跨会话 consolidation、
   237	     控制面（= 常驻 daemon）、jobs 持久化 + cron、控制面面板、Broker 侧
   238	     credential→principal 绑定（协作项）；
   239	  2. 四项冲突裁决（见 CAPABILITY_MATRIX §2）：多 agent 常驻 = per-agent 进程（方案 B
   240	     硬约束）；控制面 ≡ daemon 为同一组件；V1 记忆以文件为主、MCP 为可选后端；
   241	     全局 jobs 面板依赖 jobs 持久化；
   242	  3. 下一 milestone = **M1: per-agent workspace-bootstrap**（唯一自包含、纯 DSH 侧、
   243	     不触碰 Auth/Broker 的根依赖项）。
   244	- 替代方案: 以 identity-auth 方案 B（per-agent 进程编排）作为首个 milestone ——
   245	  否决理由：依赖 Broker 侧协作且需部署形态变更，范围过大，不符合「先单进程稳定、
   246	  再动编排」的 V0 既定节奏。
   247	- 影响: M1 只新增一个 Cordis 插件与验收断言；不实现任何其余调查结论，不修改
   248	  DSH/Auth/Broker/旧 Agent Core。

exec
/bin/zsh -lc "cat /Users/yanfenma/.codex/memories/skills/fixed-sha-pr-audit/SKILL.md; sed -n '1,100p' /Users/yanfenma/.codex/memories/rollout_summaries/2026-08-28T14-38-36-F0Ib-pr97_forum_moderation_fixed_sha_audit_revise.md" in /tmp/review-609
 succeeded in 0ms:
---
name: fixed-sha-pr-audit
description: Run a read-only fixed-SHA PR audit when asked to pin head/base, report Blocker/High counts, and decide merge readiness.
argument-hint: "[repo path] [PR number] [focus]"
user-invocable: false
allowed-tools: Read, Grep, Glob, Bash
---

# Fixed-SHA PR audit

## When to use

Use for requests such as “不修改代码、不部署、不合并”, fixed `REVIEWED_HEAD`/`BASE_SHA`, or an explicit Blocker/High and merge-readiness review. `$0` is the repository; `$1` is the PR number; `$2` optionally narrows the contract or behavior to audit.

Do not use this to implement a fix, deploy, merge, or certify a branch that was not rechecked remotely. For a broad architecture review without a pinned PR, use the architecture-audit workflow instead.

## Inputs and context

1. Record the supplied PR number, head SHA, base SHA, requested scope exclusions, and requested severity threshold.
2. Inspect working-tree state without altering it; use an isolated detached worktree/archive only if needed.
3. Obtain remote `refs/pull/$1/head` and the base object. Record changed files and verify the supplied objects exactly match; if the supplied base is not a head ancestor, also record the actual merge-base and assess the three-dot diff.
4. Identify the real runtime/persistence evidence for the focus area, including any supplied real record or canary database.

## Procedure

1. Establish the audit boundary first: exact PR number, head/base, changed-file set, no-write constraint, and excluded subsystems. Recheck `PR_NUMBER`, `REVIEWED_HEAD`, and `BASE_SHA` before every major phase (code review, migration/data test, test run, and final report); stop and report any mismatch rather than auditing a moving or unrelated target.
2. Trace the feature end to end: public entry point, runtime path, persisted state/journal, external receipt/protocol, and restart/replay behavior. Registry presence, source code, or a focused unit test alone is not execution proof.
3. If migration/recovery is in scope, copy the supplied database/record and test the exact historical identity. Do not substitute a new source ID; capture pre/post status and whether the original flow can resume.
4. Exercise the state matrix: normal success, duplicate/replay, crash boundary, malformed/old/transport response, terminal rejection, and mixed-version compatibility when the protocol changed.
5. Run targeted tests plus the relevant build/check and `git diff --check`. Run the repository structure gate when present, including against the actual merge-base when the supplied base is non-ancestor. For a failing broad suite, repeat at base to distinguish a pre-existing failure from a PR regression; report platform-gated tests that run zero tests.
6. Classify only evidence-backed Blocker/High findings. End with exact head/base, validation status, `BLOCKER_COUNT`, `HIGH_COUNT`, and `READY_TO_MERGE`; do not modify, deploy, or merge.

## Efficiency plan

- Pin remote objects and obtain the changed-file list before reading broad code; search only call paths reachable from those files and the requested contract terms.
- Cache a compact evidence table: claim -> entry point -> persistence/protocol -> test/reproduction -> verdict.
- Test copied data and failure boundaries early when idempotency or migration is central; stop expanding unrelated architecture once scope exclusions and real provenance agree.

## Pitfalls and fixes

- Symptom: a local branch or merged PR is treated as the reviewed object. Cause: remote head/base were not revalidated. Fix: compare remote refs to supplied SHAs before conclusions.
- Symptom: a migration claim is proved with a synthetic record. Cause: the historical root identity was replaced. Fix: use the supplied record on a copy and state its exact post-migration result.
- Symptom: an idempotency claim passes happy paths but replays earlier work. Cause: the idempotency key begins after planning/generation or journal writes are non-atomic. Fix: probe the full handler and crash/restart windows.
- Symptom: a full suite failure is called a PR failure. Cause: no base comparison. Fix: reproduce at base and label it pre-existing only when the same failure occurs there.
- Symptom: a Spec names structured downstream error fields but the current transport only preserves a sanitized string. Cause: the declared closure omits transport/mapping/schema/relay work. Fix: trace the complete error path and either narrow the contract or enumerate the missing implementation and tests.
- Symptom: focused behavior passes while structure validation blocks merge. Cause: file-size/grandfathered limits or an accepted file closure conflict with required splits. Fix: report both facts; amend the governing closure before restructuring, then rerun the gate.

## Verification checklist

- [ ] Remote PR number, head, and base equal the fixed review objects at start and before the final report.
- [ ] Changed files and scope exclusions were recorded.
- [ ] When base is non-ancestor, merge-base and three-dot scope are explicit; structure gate status is explicit when available.
- [ ] Runtime/persistence/protocol provenance was traced for each material claim.
- [ ] Supplied historical records were tested on copies when recovery/migration was in scope.
- [ ] Targeted tests, build/check, whitespace check, and broad-suite/base-comparison status are explicit.
- [ ] Final report gives evidence-backed Blocker/High counts and merge readiness without changing state.
thread_id: 01a048ce-f18c-7920-b00d-eba808825cfb
updated_at: 2026-08-28T14:51:24+00:00
rollout_path: /Users/yanfenma/.codex/archived_sessions/rollout-2026-08-28T22-38-36-01a048ce-f18c-7920-b00d-eba808825cfb.jsonl
cwd: /Users/yanfenma/workspace/project/dsh-agent-core
git_branch: docs/lark-ux-phase1-v2-spec

# PR #97 fixed-SHA audit reached REVISE

Rollout context: Read-only implementation review of mayf3/dsh-agent-core PR #97 against base `91cab8473c5042e833b559ea9c4f35723d147739`, head `ad4e9e316aa445609f31e2522f64bf53f72db2ad`, governing Spec `AGENT_CORE_FORUM_MODERATION_CAPABILITIES_V1`. No code, merge, deploy, Grant, or Forum-data changes were performed.

## Task 1: Audit Forum moderation implementation

Outcome: partial

Preference signals:
- The user explicitly required fixed-SHA, read-only auditing: “不修改、不 merge、不 deploy、不改 Grant、不改 Forum 数据” and demanded explicit gate fields and PASS/REVISE. Future audits should preserve this boundary, recheck remote SHAs before final conclusions, and avoid merge recommendations until every requested gate passes.

Key steps:
- Verified remote PR head remained exactly `ad4e9e316aa445609f31e2522f64bf53f72db2ad`; no head drift.
- Found supplied base is not a head ancestor; merge-base is Spec merge commit `97ff7863e9ca93f139818d11233ce3c08fdf438f`. PR three-dot diff nevertheless contains exactly the nine specified files and no extras.
- Used a clean detached implementation worktree at the pinned head and a separate base worktree for A/B comparison.
- Broker package tests passed exactly `202/202`; coverage included normal/moderator packs, visibility, scopes, PATCH, nonBlank, enum fail-fast, soft-delete routes, resolve/archive, report queue/actions, admin unread, sanitizer, and frozen seven-tool projections.
- Governance verifier passed: `vendored governance bytes match governance.lock.json`.
- `git diff --check` passed.
- Full repository tests failed in both head and base due environment/dependency issues such as missing `@larksuite/channel` and `@deepseek-ai/dsh-llm`; these were not counted as PR regressions.

Failures and how to do differently:
- Blocker: `packages/broker/src/transport.js:376` defines `SPEC_AUTH_SCHEME_RE` without the required case-insensitive `i` flag. Direct oracle: `sanitizeErrorDetail('basic QUJDREVG')` returned `basic QUJDREVG`, leaking material; mixed/lowercase Bearer also failed the exact `<AUTH_REDACTED>` policy. Fix regex and add lowercase/mixed-case regression vectors.
- Blocker: structure verifier failed identically against both the supplied base and actual merge-base: `forum.js` crossed 500 lines, `transport.js` and `transport.test.js` grew beyond grandfathered ceilings, and `packages/broker/test/capabilities.test.js` was touched despite being unregistered legacy structure. Because the accepted Spec freezes a nine-file closure that excludes split files, amend the Spec before restructuring, then split and rerun the structure gate.

Reusable knowledge:
- `node scripts/verify-code-structure.mjs --base <base> --head <head>` can expose real closure/structure conflicts even when functional tests pass; always run it with both the supplied base and the actual PR merge-base when the fixed base is non-ancestor.
- Final verdict: `REVISE`, `BLOCKER_COUNT=2`, `HIGH_COUNT=0`, `READY_FOR_MERGE=NO`; all Grant, Forum-data, production, and deployment changes remained none/no.

References:
- PR head: `ad4e9e316aa445609f31e2522f64bf53f72db2ad`
- Base: `91cab8473c5042e833b559ea9c4f35723d147739`
- Spec merge-base: `97ff7863e9ca93f139818d11233ce3c08fdf438f`
- Functional command: `npm test` from `packages/broker` -> `202/202 PASS`
- Governance: `python3 .agents/tools/verify_governance.py --target .` -> pass
- Sanitizer defect: `SPEC_AUTH_SCHEME_RE = /\\b(Bearer|Basic)[ \\t]+[^ \\t\\r\\n,;]+/g`

2026-11-09T22:44:39.659377Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when UnexpectedServerResponse("HTTP 502: ")
2026-11-09T22:44:41.017935Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 403 Forbidden, url: wss://chatgpt.com/backend-api/codex/responses
2026-11-09T22:44:43.974162Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when UnexpectedServerResponse("HTTP 502: ")
exec
/bin/zsh -lc "nl -ba .agents/local/README.md | sed -n '1,85p'; nl -ba .agents/protocol/SPEC_FORMAT_V0.md | sed -n '365,460p'; nl -ba docs/specs/AGENT_CORE_ADMISSION_RUNTIME_RELIABILITY_V1.md | sed -n '250,340p'; nl -ba docs/decisions/README.md | sed -n '1,65p'" in /tmp/review-609/repo
 succeeded in 0ms:
     1	# Repository-local governance — dsh-agent-core
     2	
     3	This file is owned by `mayf3/dsh-agent-core`. It is not part of the vendored distribution and is not overwritten by governance updates.
     4	
     5	## Repository identity
     6	
     7	```text
     8	REPOSITORY = mayf3/dsh-agent-core
     9	AUTHORITY_BRANCH = main
    10	GOVERNANCE_LOCK = .agents/governance.lock.json
    11	ADOPTION_ACTIVATION = accepted lock + accepted adoption Spec merged into main
    12	```
    13	
    14	A proposed lock on a feature branch is only an adoption candidate. It is not active repository authority.
    15	
    16	## Authority precedence
    17	
    18	```text
    19	explicit Product Direction authority, when one is accepted
    20	> accepted Product Architecture and standalone long-lived Current Decisions
    21	> accepted implementation-authorizing Specs
    22	> code, tests, runtime state, migration records, and operational evidence
    23	```
    24	
    25	Current repository authority locations:
    26	
    27	```text
    28	PRODUCT_DIRECTION = NONE_STANDALONE
    29	PRODUCT_ARCHITECTURE = docs/AGENT_CORE_PRODUCT_ARCHITECTURE_V1.md
    30	ROADMAP / STRATEGIC_CONTEXT = docs/AGENT_CORE_ROADMAP_V1.md
    31	CURRENT_DECISION_INDEX = docs/decisions/README.md
    32	DECISIONS = docs/decisions/
    33	SPECS = docs/specs/
    34	```
    35	
    36	Local rules:
    37	
    38	- an implementation Spec may refine Architecture or a Current Decision, but may not silently contradict it;
    39	- changing accepted long-lived meaning requires a new whole-authority supersession transaction;
    40	- a Program Spec with `implementation_authority: none` coordinates work but does not authorize product implementation;
    41	- an accepted-looking document on an unmerged branch is not active authority;
    42	- code, tests, reports, and runtime evidence may prove conformance or drift but do not rewrite normative authority.
    43	
    44	## Bounded-development route (effective on V3 adoption only)
    45	
    46	These local choices become active only with the accepted
    47	`AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V3` and accepted lock merged into `main`.
    48	Until then, the authority branch's existing rules remain controlling.
    49	
    50	- `REUSE` inside an accepted implementation Contract needs no new Spec or
    51	  standalone Spec review merely because code changes. Use focused tests and the
    52	  review required by its Assurance level.
    53	- Explicitly permit one atomic Spec-delta-and-code PR for bounded
    54	  `AMEND/NEW + ROUTINE/DURABLE` work under the owner's task authorization. The
    55	  delta must be independently accepted before merge; it cannot contradict
    56	  Architecture, replace accepted meaning, widen privileges, change Secret/Grant
    57	  boundaries, introduce destructive migration, or authorize production effects.
    58	- `CONTROLLED` and `SUPERSEDE` remain docs-first. Implementation and production
    59	  permissions are separate; missing production permission does not itself stop
    60	  unrelated authorized nonproduction work.
    61	- Review the affected change and invalidated dependencies. A new SHA alone does
    62	  not require a full audit. Use the vendored explicit scope/impact checks.
    63	- Ordinary tasks use the existing PR/Brief; no mandatory extra Agent formation,
    64	  full-corpus review, or new control-plane document is introduced here.
    65	
    66	## Acceptance and review actors
    67	
    68	```text
    69	SPEC_ACCEPTANCE_ACTORS = repository owner mayf3, or an explicitly authorized maintainer recorded in the PR
    70	INDEPENDENT_SEMANTIC_REVIEWER = a reviewer who did not author the reviewed semantic delta
    71	MECHANICAL_EXEMPTION_REVIEWERS = independent reviewer; final disposition by mayf3 or an authorized maintainer
    72	EMERGENCY_AUTHORIZATION_ACTORS = mayf3 or an explicitly authorized maintainer
    73	```
    74	
    75	A review recommendation does not itself perform acceptance. Acceptance must bind the reviewed commit and the final accepted head.
    76	
    77	## Governing and persistence locations
    78	
    79	```text
    80	SPECS = docs/specs/
    81	INVESTIGATIONS = docs/investigations/
    82	LONG_LIVED_DECISIONS = docs/decisions/
    83	IMPLEMENTATION_CONFORMANCE = implementation PR record
    84	CROSS_ENVIRONMENT_OR_PRODUCTION_CONFORMANCE = docs/reports/ plus pinned runtime provenance
    85	SEMANTIC_REVIEW_RECORD = persistent PR conversation or docs/reports/
   365	
   366	## 12. Alternatives and investigation disposition
   367	
   368	A Spec records rejected alternatives that directly explain its accepted Decision.
   369	
   370	When an investigation produces no new governing Spec, persist an Investigation Record instead. Do not leave a forever-proposed Spec solely to preserve rejected reasoning.
   371	
   372	---
   373	
   374	## 13. Open questions and acceptance
   375	
   376	Before `status: accepted`:
   377	
   378	```text
   379	OPEN_OWNER_DECISIONS = NONE
   380	NORMATIVE_TBD = NONE
   381	UNRESOLVED_AUTHORITY_CONFLICT = NONE
   382	PARTIAL_SUPERSESSION = NONE
   383	```
   384	
   385	Non-normative follow-up work may remain when it cannot change Decision or Contract meaning.
   386	
   387	---
   388	
   389	## 14. Accepted immutability
   390	
   391	An accepted rule may later be replaced, but an existing stable ID always keeps
   392	the meaning that was accepted for that ID.
   393	
   394	### 14.1 Existing stable IDs
   395	
   396	Text associated with an existing accepted Decision, Contract, Acceptance item,
   397	or other stable normative ID may receive only editorial changes with proven
   398	semantic delta `NONE`. An existing ID may not be narrowed, expanded, reversed,
   399	deleted and reused, or assigned a different meaning.
   400	
   401	### 14.2 Strictly additive amendment under the same `spec_id`
   402	
   403	A docs-only `AMEND` MAY add new stable IDs to the same accepted Spec only when
   404	all of the following are true:
   405	
   406	- Goal is unchanged;
   407	- scope and authority ownership are unchanged;
   408	- `governed_by` and external-authority boundaries are unchanged;
   409	- every accepted Decision remains unchanged;
   410	- every existing stable ID and its Acceptance meaning remain unchanged;
   411	- each new Contract is a bounded elaboration of an already accepted Decision,
   412	  not a new independent product or architecture choice;
   413	- the new IDs and their Contract-to-Acceptance mappings receive independent,
   414	  exact-revision review;
   415	- no partial supersession is introduced.
   416	
   417	This seam permits a newly identified `CTR-*` that makes an existing accepted
   418	Decision operationally complete. It does not permit changing an existing
   419	`CTR-*` or smuggling a new Decision into the old authority.
   420	
   421	### 14.3 `NEW` and `SUPERSEDE` boundaries
   422	
   423	`NEW` is required for:
   424	
   425	- a new Decision;
   426	- expanded scope or changed authority ownership;
   427	- a new independent obligation;
   428	- an obligation that is not entailed by the existing accepted Decisions.
   429	
   430	`SUPERSEDE` is required for:
   431	
   432	- deletion, narrowing, expansion, reversal, or replacement of existing
   433	  normative meaning;
   434	- changed identity, authorization, failure, retry, timeout, transaction,
   435	  lifecycle, migration, compatibility, or security semantics;
   436	- removal of an existing obligation;
   437	- changed Acceptance meaning that could cause a previously passing
   438	  implementation to fail or a previously failing implementation to pass.
   439	
   440	---
   441	
   442	## 15. Syntax versus semantics
   443	
   444	A deterministic parser may check:
   445	
   446	- frontmatter presence and enums;
   447	- ID uniqueness and patterns;
   448	- required sections;
   449	- local backlinks;
   450	- Contract-to-Acceptance references;
   451	- forbidden partial-supersession references;
   452	- unresolved placeholders;
   453	- governance lock integrity;
   454	- presence and status of a Spec in a known base.
   455	
   456	It cannot decide:
   457	
   458	- whether a Claim is justified;
   459	- whether a Contract is complete;
   460	- whether an alternative was honestly considered;
   250	### CTR-ARR-003 — 受管权威 producer
   251	
   252	终态 IAD MUST 只从当前受管 production runtime 的已审 artifact/loaded generation
   253	对外供受影响 consumer 使用，读取既有权威 Agent Definition；不得依赖 gui aux、
   254	开发 checkout 的文件或进程，或新增持久 mirror/缓存真值。
   255	
   256	沿用 exact `GET /v1/directory/agents/:agentId`、IAD caller/auth/error/1s deadline/
   257	no-store/no-auto-retry 全部语义；不得改用 mobile `/v1/agents`、history listener、
   258	display-name/prefix 猜测或非权威 healthy response。无需新增同功能 route。
   259	
   260	### CTR-ARR-004 — 端点绑定与 release eligibility
   261	
   262	交接 MUST 绑定角色、实际 origin/port、runtime unit、artifact/source hash、loaded
   263	generation、Definition 来源、IAD verifier 配置来源与 consumer 的 base URL；
   264	这是既有 release record 的必要证据，不引入新持久协议/身份。不得记录 Secret 值。
   265	
   266	角色识别 MUST 包含正确受签 caller 的 exact directory 请求及 malformed/unauthorized/
   267	disabled/missing target 负向结果；`/health`=200、端口名、PID、boot marker、
   268	IAD health.ready 均不充分。Product API 保持 loopback-only；本稿不授权跨主机公网暴露，
   269	若实际 consumer 无法在既有允许网络下到达，应停在迁移前，另行处理 authority gap。
   270	“8788”仅当证据证明它是正确 IAD server 时才是可选配置值。
   271	
   272	### CTR-ARR-005 — 仓库责任与权限
   273	
   274	| 仓库/角色 | 必须提供的交接内容 | 不得代行 |
   275	|---|---|---|
   276	| mayf3/dsh-agent-core | producer/retry/tests、rebuildable artifact closure、权威目录及 history 隔离证据 | svc-workflow 业务授权、未经 mandate 的生产写入 |
   277	| mayf3/svc-workflow | 自有 active authority 下核对 admission consumer；准备/应用其 WORKFLOW_ADMISSION_CORE_BASE_URL 切换、fresh observation/commit fail-closed 测试及业务结果 | 新 lookup identity、用 Core health 替代业务验收 |
   278	| mayf3/dsh-agent-core 的既有 DS/release authority 对应操作者 | 在当前有效生产 authority 下绑定唯一 writer、preimage/rollback、drain/canary、apply 与 receipt/readback；未来 mandate 必须 fresh-verify 其 installed callable path | 把 source framework 当已安装控制器、旧 B7/#525 授权复活或另建发布 writer |
   279	| mayf3/agent-control | 跨仓任务/证据交接，绑定上述实际 release owner 和 svc-workflow consumer owner | 不因协调而取得部署/业务权限，不把 Spec 当操作批准 |
   280	| Auth owning repository | 沿用 IAD 的既有 caller issuance/verification 权限；如需自仓变更，走该仓 authority | 本稿不授权新 per-consumer directory Principal/Client/Grant |
   281	
   282	当前 controller 的 installed callable path 未在本轮查证，状态 UNKNOWN；不得假定存在。
   283	上述责任是 Core 接受跨仓交接的条件，不授予其他仓实现权。后续执行须记录具体有效
   284	操作者与 task/slot、exact owning accepted heads；责任未绑定时生产阶段不 ready，
   285	无需再悬置本文三项设计决定。
   286	
   287	### CTR-ARR-006 — 分阶段 consumer 切换与 bridge
   288	
   289	迁移 MUST 依次完成：(1) 冻结受影响 consumer 的 normal/fallback/startup/recovery
   290	配置及真实调用方；(2) producer 工件/隔离 gate；(3) 当前 mandate 下 producer
   291	loaded proof；(4) svc-workflow 单一生效 endpoint 切换与自有业务 canary；
   292	(5) aux admission role 退出及恢复路径负向验收。每阶段持久化 exact tuple，不跳步。
   293	
   294	桥接仅限第 4 步前盘点到的旧 consumer；记录 consumer/责任仓/起始 tuple、切换任务、
   295	退出条件“所有已盘点 consumer 切换并通过第 5 步”及任务 abort 责任。不得新添 bridge
   296	consumer、在一个 admission command 内向两端竞速/多数表决或自动 fallback。task 到期/
   297	abort 不能冒充迁移完成；保留已知 interim truth，交回当前 release owner。
   298	
   299	仅替换 endpoint 不改变原 caller、actor/assignee 校验、事务边界、每 command freshness
   300	或 target exact identity。未知覆盖记 UNKNOWN，不把未盘点当零 consumer。
   301	
   302	### CTR-ARR-007 — aux 角色退役与恢复收敛
   303	
   304	宣布终态前 MUST 证明所有盘点 consumer 的正常调用、fallback、进程重启、controller
   305	恢复及 rollback 配置不会访问/启动 aux admission directory。aux 停止或其历史地址
   306	拒绝连接时，正确 managed producer 上允许/拒绝行为不变，aux 请求数为零。
   307	
   308	retirement 只移除 admission executable eligibility；保留审计/历史 receipts，其他职责
   309	逐项 RETAIN/MIGRATE/RETIRE。不得凭此关闭/删除未经授权的 aux 数据或独立服务。
   310	终态之后 recovery/rollback 只能使用仍符合本拓扑的 last-good managed generation；
   311	需要回到 aux 的 incident containment 必须有独立、显式、临时 Owner 授权，并使终态
   312	conformance 退回不满足，不能伪称普通 rollback。
   313	
   314	### CTR-ARR-008 — 复用 release/drain/fresh-child 机制
   315	
   316	未来发布 MUST 使用当前有效的既有受信 release 路径、bounded reviewed artifact、
   317	共享 mutation slot 和 preimage/rollback/readback。不得 whole-latest-main 部署或重建
   318	第二 installer。需要 planned runtime restart 时复用现有 restart-drain census/
   319	refusal；busy/unavailable/unknown 不得强制越过，也不得为 canary 发起未授权业务。
   320	
   321	assembled candidate 的 closure-resolution 与 fresh-child boot gate按其适用 release
   322	authority 运行；本稿不扩大其 allowlist 或把历史 PASS 复制到新 tuple。其 PASS 之外
   323	仍需 producer runtime/IAD 和 consumer 证据。工件切换不得先 retire 仍被 live boot/
   324	spawn 依赖的 last-good artifact 再留下不可恢复空窗；由既有 controller 证明连续可用，
   325	不以新增 watchdog 代替受控交接。
   326	
   327	### CTR-ARR-009 — 故障、回滚和 UNKNOWN
   328	
   329	producer 不可达、配置/认证失败或权威查询错误时受影响 admission MUST 按既有 owning
   330	语义 fail-closed，不把 transport error 改成 exists:false/业务允许，不读旧 positive
   331	cache，不自动切 aux。目录自身 401/403/409/500/504 和 consumer 的既有业务错误映射
   332	由原 authority 决定，本稿不重定义。
   333	
   334	预切换 gate 失败不切 consumer；切换后失败按 exact preimage/兼容性和当前 mandate
   335	回滚。退役完成前可在该次明确 bridge 范围内恢复冻结的旧 tuple，但应标明
   336	MIGRATION_INCOMPLETE；退役后受 CTR-ARR-007 限制。不得修改或重放历史
   337	outcome_unknown、清 fence、用 termination 冒充业务成功，或为了验证创建未授权业务。
   338	
   339	### CTR-ARR-010 — 证据与完成声明
   340	
     1	# Decisions — Agent Core on DSH
     2	
     3	决策记录。每条决策格式：
     4	
     5	```markdown
     6	## D-<NNN>: <标题>
     7	
     8	- 状态: proposed | accepted | superseded-by-D-<NNN>
     9	- 日期: YYYY-MM-DD
    10	- 背景: 为什么需要决策
    11	- 决策: 选择了什么
    12	- 替代方案: 否决了什么
    13	- 影响: 对文档结构 / 代码 / 迁移的影响
    14	```
    15	
    16	已登记决策：
    17	
    18	## D-009: Scheduler Occurrence / Outcome / Session / Migration Current Decision（V3）
    19	
    20	- 状态: accepted（2026-09-13；Current Scheduler Authority；无 implementation / production authority；全文见
    21	  `docs/decisions/SCHEDULER_OCCURRENCE_OUTCOME_V3.md`）
    22	- 日期: 2026-09-13
    23	- 背景: D-007 将 `outcome_unknown` 与 same-job fence 绑定，但当前 Router 已能精确证明
    24	  `terminated_without_outcome`：旧 execution 不再继续，业务 outcome 与副作用仍未知。若继续保持
    25	  fence，Agent 无法安全恢复自己的未来 natural schedule；若映射为 failed/succeeded，则伪造业务结果。
    26	- 决策: 保留 D-007 全部 job/occurrence/at-most-once/retry/session/migration/store 语义，仅把
    27	  business-outcome uncertainty 与 execution termination 分开。可信 exact termination-only settlement
    28	  保持 occurrence=`outcome_unknown`、保存 UNKNOWN 业务事实、解除 execution fence，且不自动 retry；
    29	  允许 trusted-caller-scoped 的 exact self reconciliation，禁止模型选择结果、跨 Agent、raw store、
    30	  trigger_once、runtime reload、kill、run-as/OBO 或权限自增。
    31	- 替代方案: partial amendment D-007、termination=failed/succeeded、模型提供 Router handle/PID、
    32	  title 猜 job、raw fence 删除、shadow Scheduler、self trigger/reload bridge——均拒绝。
    33	- 影响: 独立 exact-final-head `1b41d76fc445846d2a65b5641d10fece79a1d506` review PASS 后，
    34	  authorized acceptance transaction 已完成；D-009 取代 D-007，D-005 历史状态不变。后续仍需 complete `SCHEDULER_TIMEOUT_OUTCOME_V3` 和
    35	  `AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V3` accepted/merged 后才可实现。
    36	
    37	## D-008: Agent / Workspace / Session / main 长期产品模型 Current Decision（V3）
    38	
    39	- 状态: accepted（2026-09-01；standalone Current Decision；Current Authority；
    40	  supersedes D-006 / V2；全文见
    41	  `docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V3.md`）
    42	- 日期: 2026-08-31（`TASK_NAME = 模型 执行`）
    43	- 背景: D-006 把普通 Agent-to-Agent Messaging 与 explicit Delegation 合并成单一
    44	  per-task non-main 模型；Owner Current Model 要求前者进入 target Agent canonical main、
    45	  后者保持 per-task non-main，并继续保持 cron per-execution non-main。
    46	- 决策: V3 完整重述 D-006 的仍有效 Current Truth，只把 A2A 拆成两个明确
    47	  primitive：Messaging → target canonical main（reuse/establish same main；each send = new
    48	  Run/Turn, not Session）；Delegation → one task one target non-main；Cron → one execution one
    49	  target non-main。Session 选择由 interaction primitive 决定；target/executing Agent 保持其
    50	  自己的 Workspace、Principal、credential 与 grants。
    51	- 替代方案: 保持所有 A2A per-task、所有 A2A 都进 main、long-lived pair Session、Scheduler
    52	  `run_once` 代替 Messaging、只 amendment D-006 §11——均拒绝，详见 V3 §30。
    53	- 影响: D-006 已原子标记 superseded-by-D-008；七份 active child authority 全部 PRESERVE。
    54	  本次 acceptance 不接受或实现 proposed `AGENT_CORE_AGENT_SESSION_MESSAGING_V1 r2`，不修改
    55	  child Spec、代码、Grant、Scheduler、Workflow、部署或 production state；后续 `会话 执行`
    56	  仍需形成独立 implementation-authorizing Spec。
    57	
    58	## D-007: Scheduler Occurrence / Outcome / Session / Migration Decision（V2，historical）
    59	
    60	- 状态: superseded-by-D-009（此前为 standalone Current Scheduler Authority；历史正文见
    61	  `docs/decisions/SCHEDULER_OCCURRENCE_OUTCOME_V2.md`）
    62	- 日期: 2026-08-19（2026-08-20 accepted；supersedes D-005）
    63	- 背景: D-005 的 job-level execution model（timeout=ordinary error、runningAtMs
    64	  去重、stable per-job Session、legacy catch-up）与真实 fleet evidence 冲突：140 个
    65	  enabled job 绝大多数产生非幂等外部副作用（NON_IDEMPOTENT_SIDE_EFFECT=113）、63/140

exec
/bin/zsh -lc "nl -ba docs/AGENT_CORE_PRODUCT_ARCHITECTURE_V1.md | sed -n '1,245p'; rg --files .agents/tools .agents/schema .agents/schemas 2>/dev/null; git diff --name-status origin/main...HEAD; git merge-base origin/main HEAD; git log -6 --format='%h %an <%ae> %s'" in /tmp/review-609/repo
 succeeded in 0ms:
     1	# Agent Core Product Architecture V1
     2	
     3	> 状态：冻结草案（docs-only）· 日期：2026-08-15  
     4	> Authority amendment：2026-08-18  
     5	> 基线：`69273a9`（Integration V1 已合并）；契约：`AGENT_SESSION_CHANNEL_MODEL_V1`（D-002）  
     6	> 本文件回答：**最终 Agent Core 到底是什么、每一层归谁负责、哪些边界永不跨越**。
     7	>
     8	> **安全域声明修订：**本文件原先把“one Agent = one DSH process”直接冻结为
     9	> peer-Agent 对抗性安全域。该 claim 已被
    10	> [`AGENT_CORE_HARDENING_PROGRAM_V1`](specs/AGENT_CORE_HARDENING_PROGRAM_V1.md)
    11	> amendment：
    12	>
    13	> ```text
    14	> PEER_AGENT_SECURITY_DOMAIN_CLAIM = SUPERSEDED
    15	> REPLACED_BY = AGENT_CORE_HARDENING_PROGRAM_V1
    16	>
    17	> one Agent = one DSH process
    18	> = runtime / lifecycle / DSH_HOME / Session-owner boundary
    19	> != current adversarial peer-Agent isolation boundary
    20	> ```
    21	>
    22	> 当前同主机、共享运行身份的 Agents 属于 cooperative shared-host trust domain；
    23	> Control Plane、Broker credential 与 service credential 仍必须对 Agent 保密。
    24	> 本文件其余 ownership / thin-layer / DSH-native 边界不受该 amendment 影响。
    25	
    26	---
    27	
    28	## 0. 一句话总结
    29	
    30	**Agent Core 是基于 DeepSeek Harness 的一层薄组织层：把 DSH 的通用 Agent 运行时组织成
    31	一批长期存在的「数字员工」——每个员工有稳定身份、专属 workspace 与 DSH 进程、多个
    32	会话、跨会话记忆、独立进程身份，能调用外部业务能力，也能长出新技能。**
    33	
    34	它**不重做** DSH 的任何运行时能力，也不替代 Forum / Workflow / OKR——它只负责
    35	「员工是谁、在哪里办公、正在和谁聊、什么时候上班、怎么安全地访问外部系统」。
    36	
    37	类比（帮助理解，不替代定义）：
    38	
    39	| 概念 | 人话 |
    40	|---|---|
    41	| Agent | 花名册上的一个员工 |
    42	| Workspace / DSH_HOME | 员工的专属办公桌和抽屉 |
    43	| Session | 员工和不同人谈不同事情留下的谈话记录 |
    44	| Memory | 员工跨所有事情沉淀下来的长期经验 |
    45	| ChannelConversation | 某个聊天软件里的一条会话 |
    46	| Binding | 「这个聊天窗口当前连的是哪位员工」的工牌插槽 |
    47	| Router / Control Plane | 前台 + 调度员 |
    48	| Process | 员工今天上班的工位（一个 Agent = 一个独立工位/进程） |
    49	| Process Credential | 门禁卡（证明我是这位员工） |
    50	| Broker | 公司唯一的对外业务窗口 |
    51	| Plugin Lifecycle | 学会并保留新技能 |
    52	
    53	---
    54	
    55	## 1. 目标形态与分层
    56	
    57	```
    58	Channels / Product UI
    59	  Feishu / WeChat / Mobile / Web
    60	            ↓  只做传输与展示
    61	ChannelConversation + Binding
    62	            ↓  渠道落地入口（幂等 resolve；Binding 表达“当前在聊谁”）
    63	Agent Core Control Plane
    64	  ├─ Agent Registry      = 花名册（这个 Agent 是谁）
    65	  ├─ Session             = 谈话记录管理（这个 Agent 有哪些独立对话）
    66	  ├─ Workspace Bootstrap = 办公桌在哪（agentId → workspace / DSH_HOME）
    67	  ├─ Router / Process Supervisor = 前台/调度员（消息找谁 + 进程何时启动/恢复）
    68	  ├─ Memory              = 跨 Session 的长期经验
    69	  ├─ Plugin Lifecycle    = 新技能（实验 → 验证 → 保留 → 回滚）
    70	  └─ Proactive Runtime   = 没人催也会继续工作（schedule/goal/inbox 之上的薄层）
    71	            ↓
    72	one Agent = one DSH process
    73	  （运行时 / 生命周期 / DSH_HOME / Session-owner 边界；
    74	    当前不是 shared-host peer-Agent 对抗性隔离边界）
    75	            ↓
    76	DSH（Runtime）
    77	  loop / tools / fs / shell / skills / agent-instructions
    78	  subagents / compaction / goal / inbox / session persistence
    79	            ↓
    80	Generic Broker Bridge（统一外部能力入口，进程凭据身份）
    81	            ↓
    82	Forum / Workflow / OKR / 其他外部业务系统
    83	```
    84	
    85	---
    86	
    87	## 2. Product Concepts — 精确含义与所有权
    88	
    89	### Agent（长期实体）
    90	
    91	- **定义**：全局唯一的长期实体，代表一位「数字员工」。拥有并独占：workspace、
    92	  DSH_HOME、credential、memory、会话存储、进程身份。
    93	- **生命周期**：预置时自动创建其 `main` session；存在与生命周期不依赖任何 Channel。
    94	- **人话**：花名册上的一个员工——有工号、有办公桌、有自己的抽屉，不管今天有没有人
    95	  来找他聊天，他都存在。
    96	- **所有权**：Agent Core Control Plane（Registry 登记身份，Workspace Bootstrap 给
    97	  办公桌，Process Supervisor 管工位）。
    98	
    99	### Session（属于 Agent）
   100	
   101	- **定义**：Agent 之下的一条独立对话。**Session identity = (agentId, sessionId)**
   102	  （实验证据，Session V1 PoC 已定案）：DSH SessionId 作用域是 per-Agent DSH_HOME，
   103	  非全局，因此 Agent A/main 与 Agent B/main 可同时存在。`main` 为每个 Agent 的
   104	  保留 SessionId（长期主会话，不可归档/删除）；`normal` 会话用其他 opaque
   105	  sessionId，可新建、归档（软）、删除（硬）、定期清理（保留期=配置）。
   106	- **人话**：员工和不同人谈不同事情的谈话记录——「和论文导师聊论文」一条，「和财务
   107	  对报销」另一条；记录本放在员工自己的抽屉里（per-agent DSH_HOME）。
   108	- **所有权**：Agent 拥有；**Session Runtime 全部由 DSH 原生负责**（identity /
   109	  trajectory persistence / create / resume / process death recovery）。Agent Core
   110	  **不建 Session mapping layer、不建独立 session 包**（product sessionId = DSH
   111	  native sessionId）；Product API milestone 只维护产品元数据（title / kind /
   112	  archived / lastActiveAt）。
   113	
   114	### ChannelConversation（渠道侧会话）
   115	
   116	- **定义**：某个渠道里的一条会话，`(channel, externalId)` 全局唯一。渠道标识是
   117	  不透明字符串（`feishu` / `wechat` / `android` / `web`），API 不解释其值。
   118	- **人话**：微信里和某人的聊天窗口、飞书里的某个群——窗口本身不决定里面是谁在
   119	  服务。
   120	- **所有权**：控制面登记；**Channel 不拥有它上面的 Agent / Session**。
   121	
   122	### Binding（ChannelConversation → 当前 (agent, session)）
   123	
   124	- **定义**：每个 ChannelConversation 至多一条；表达「这个窗口当前正在和哪个 Agent
   125	  的哪个 Session 对话」。`switchAgent` 只写 Binding（不创建/移动/复制任何
   126	  Agent/Session，无角色扮演、无切换历史）。
   127	- **人话**：窗口上的工牌插槽——今天这个窗口接的是张三，明天可以插上李四的工牌，
   128	  人没变，只是窗口换了服务对象。
   129	- **所有权**：控制面持有；渠道适配器不保存任何 Agent/Session 状态。
   130	
   131	### Workspace（专属目录）
   132	
   133	- **定义**：agentId 唯一对应的长期工作目录（`~/.dsh/workspaces/<agentId>`）与
   134	  DSH_HOME（`~/.dsh/agents/<agentId>`）。AGENTS.md 播种、文件工具基准、会话存储
   135	  都落在这里。
   136	- **人话**：办公桌——所有东西固定放这张桌子，换人进来（进程重启）桌子还在。
   137	- **所有权**：**workspace-bootstrap 是 agentId → 路径映射的唯一 owner**；Router 只
   138	  决定什么时候启动进程，不复制映射规则（Integration V1 边界清理已定案）。
   139	
   140	### Memory（长期经验）
   141	
   142	- **定义**：Agent 跨 Session 的 curated 长期记忆（区别于 DSH session 日志）。
   143	  形式待定（文件记忆 / MCP 记忆 / 混合），但**不是第二套 session history**——
   144	  它是对经历提炼后的产物。
   145	- **人话**：员工跨所有事情沉淀下来的长期经验（「客户喜欢简洁回复」「这个项目用
   146	  React」），不是某一次谈话的完整录音。
   147	- **所有权**：Agent 拥有；Agent Memory 组件负责 consolidate / recall / 隔离；
   148	  存储通道优先复用 DSH 已支持的 MCP 与文件约定。
   149	
   150	### Process（进程身份与生命周期）
   151	
   152	- **定义**：一个 Agent = 一个 DSH 进程（per-agent DSH_HOME）。进程是该 Agent 的
   153	  **运行时、生命周期、DSH_HOME 与 Session-owner 边界**：可惰性启动、复用，
   154	  崩溃后自动 respawn + resume。
   155	- **当前信任语义**：共享主机 / 共享运行身份下的 peer Agents 属于 cooperative trust
   156	  domain；当前进程划分不承诺 adversarial peer-Agent isolation。若未来需要 A 无法攻击
   157	  B，必须由独立 `PER_AGENT_SECURITY_DOMAIN_V1` 冻结 per-Agent UID / container / VM /
   158	  sandbox 等额外隔离。
   159	- **人话**：员工上班的工位——一个员工一个工位，工位塌了（进程死了）重新搭一个，
   160	  抽屉里的东西（持久化）原样搬回来；但当前同一办公室里的合作员工不按敌对租户隔离。
   161	- **所有权**：Router / Process Supervisor 管「何时启动/恢复/回收」；进程凭据由
   162	  控制面注入（Phase 3），用于保护 Control Plane / Broker 身份，不等同于 peer-Agent
   163	  文件与主机隔离。
   164	
   165	### Plugin / Capability
   166	
   167	- **定义**：Agent 可动态获得的能力（DSH Cordis 动态插件 / tool）。Agent Core 提供
   168	  生命周期治理（实验 → 测试/证据 → reviewer → promote → disable/rollback），不
   169	  发明新的运行时。
   170	- **人话**：学会并保留新技能——先练手，确认靠谱后正式上岗，出问题随时停用。
   171	- **所有权**：Agent 进程内执行；当前 peer Agents 属于 cooperative trust domain。
   172	  Control Plane / Broker 仍只相信进程外建立的 caller relationship 与 credential，
   173	  进程内 initiator 只用于归因；Plugin Lifecycle 组件负责治理流程。
   174	
   175	---
   176	
   177	## 3. 层与职责（谁负责什么）
   178	
   179	| 层 | 负责 | 不负责 |
   180	|---|---|---|
   181	| Channels / UI | 传输、展示、渠道原生标识 ↔ ChannelConversation 映射 | 不拥有 Agent/Session；不做业务决策 |
   182	| ChannelConversation + Binding | 表达「这个窗口当前在聊谁」；幂等 resolve 落地 | 不保存 Agent/Session 状态 |
   183	| Agent Registry | 这个 Agent 是谁（身份、展示、存在性） | 不拥有 process/session/memory/workspace 规则 |
   184	| Session | Agent 有哪些会话、生命周期（main 保护、归档/清理） | 不重做对话引擎（用 DSH session） |
   185	| Workspace Bootstrap | agentId → workspace / DSH_HOME 唯一映射 + 幂等创建/播种 | 不决定进程生命周期 |
   186	| Router / Process Supervisor | 消息找谁（Binding 路由）+ 进程何时启动/复用/恢复 | 不拥有 workspace 路径规则；不演化成大 Kernel |
   187	| Memory | 跨 Session 巩固/召回/隔离 | 不成为第二套 session history |
   188	| Plugin Lifecycle | 新技能治理流程 | 不重做工具/插件运行时 |
   189	| Proactive Runtime | schedule/goal/inbox 之上的薄封装与常驻 | 不重做调度原语 |
   190	| DSH | Agent 真正怎么思考：loop/tools/fs/shell/skills/subagents/compaction/persistence | — |
   191	| Broker Bridge | 以进程外建立的真实 Agent 身份安全访问 Forum/Workflow/OKR 等 | 不相信请求体自报身份；不把外部系统变成内部特例 |
   192	| Forum / Workflow / OKR | 外部业务系统 | 不由 Agent Core 重做 |
   193	
   194	---
   195	
   196	## 4. 冻结的负面边界（永不跨越）
   197	
   198	1. **Agent Core 不重做 DSH Runtime**：不写第二套 agent loop / event log / llm 路由 /
   199	   session engine。
   200	2. **Agent Core 不重做 Tool / Skill 系统**：工具注册、skill 发现与加载全部吃 DSH
   201	   （tools / skill-filesystem / tool-fs / tool-bash…）。
   202	3. **Agent Core 不重做 fs / shell / subagent**：文件、命令执行、子 agent 全部来自
   203	   DSH。
   204	4. **Agent Core 不重做 Session Engine**：session 事件日志、持久化、resume、
   205	   compaction 全部来自 DSH。
   206	5. **Agent Core 不重做 schedule / goal / inbox 底层原语**：只在其上做薄层
   207	   （常驻、恢复编排、jobs 持久化）。
   208	6. **Agent Core 不把 Forum / Workflow / OKR 变成内部产品特例**：它们在外面，经
   209	   Generic Broker Bridge 统一接入，不写专用 adapter。
   210	7. **Channel 不拥有 Agent / Session 状态**：适配器只做映射 + dispatch。
   211	8. **Router 不拥有 workspace 路径规则**：映射唯一归 workspace-bootstrap。
   212	9. **Registry 不拥有 process / session / memory**：Registry 只登记身份，其余各归其主。
   213	10. **Memory 不成为第二套 Session history**：curated 产物 ≠ 原始日志。
   214	11. **一切外部可解决的问题尽量留在 DSH / plugin / Broker / userspace**：不重新长成
   215	    一个「大 Control Plane」。Router 只做「消息给谁 + 进程何时启动」。
   216	
   217	---
   218	
   219	## 5. FROZEN（本文件冻结）vs OPEN（暂不冻结）
   220	
   221	### FROZEN — 可以冻结的决策
   222	
   223	- **所有权边界**：Agent 拥有 workspace / DSH_HOME / credential / memory；Session
   224	  属于 Agent；Channel ≠ Agent ≠ Session；Binding 只表达当前归属。
   225	- **one Agent = one DSH process 是 runtime owner boundary**：每个 Agent 独占其
   226	  DSH process / DSH_HOME / native Session owner；Control Plane 从真实 proc
   227	  relationship 决定 Broker caller identity。原“当前进程即 peer-Agent 对抗性安全域”
   228	  claim 已 superseded；当前 shared-host Agents 是 cooperative trust domain。
   229	- **workspace-bootstrap 是 agentId → workspace/DSH_HOME 映射的唯一 owner**。
   230	- **DSH 是 Runtime**：loop/tools/fs/shell/skills/subagents/compaction/persistence
   231	  全部来自 DSH，Agent Core 不重做。
   232	- **Agent Core product sessionId = DSH native sessionId（YES，实验已定案）**：
   233	  Session identity = (agentId, sessionId)（DSH SessionId 作用域 = per-Agent
   234	  DSH_HOME）；`main` 是每个 Agent 的保留 SessionId；**不建 Session mapping layer、
   235	  不建独立 session 包**；DSH 原生负责 session identity / trajectory persistence /
   236	  create / resume / 崩溃恢复；Agent Core 只在 Product API milestone 维护产品
   237	  metadata（title / kind / archived / lastActiveAt）。
   238	- **Forum / Workflow / OKR 在外部**，不是 Agent Core 内部模块。
   239	- **Broker 是统一外部能力入口**：capability manifest → DSH tool 的通用桥，
   240	  Forum/Workflow/OKR 只提供 manifest + handler，不写专用 adapter。
   241	- **Channel 是入口不是状态所有者**：适配器零 Agent/Session 状态。
   242	
   243	### OPEN — 暂不冻结（未经实验不冻结实现细节）
   244	
   245	- Memory consolidation 的精确触发时机（compaction 前 / turn 尾 / 定时）。
.agents/tools/validate_governance_route.py
.agents/tools/validate_spec_transition.py
.agents/tools/verify_governance.py
.agents/schemas/governance-lock.schema.json
.agents/schemas/governance-route.schema.json
.agents/schemas/spec-frontmatter.schema.json
.agents/schemas/distribution-manifest.schema.json
A	docs/specs/AGENT_CORE_ADMISSION_RUNTIME_RELIABILITY_V1.md
f767e8d6608cdb0917aad2d471ba0454d0966a0f
7f4cf5b5 mayf3 <daretobeyourself.m.y.f@gmail.com> docs: propose admission runtime reliability Spec for #554
f767e8d6 mayf3 <mayf3@users.noreply.github.com> Merge pull request #608 from mayf3/ac-527-no-next-run-probe
1a4f1f6c mayf3 <daretobeyourself.m.y.f@gmail.com> docs: bind #527 validation and independent review receipts
22ec9d93 mayf3 <daretobeyourself.m.y.f@gmail.com> fix(scheduler): preserve UNKNOWN and native catch-up in #527 probe
334e5036 mayf3 <mayf3@users.noreply.github.com> Merge pull request #606 from mayf3/dsh-523-impl
fa7fea60 mayf3 <daretobeyourself.m.y.f@gmail.com> docs: amend D-008 switch source scope for #523

exec
/bin/zsh -lc "sed -n '1,210p' .agents/tools/validate_spec_transition.py; cat .agents/schemas/spec-frontmatter.schema.json; git diff --name-only f767e8d6608cdb0917aad2d471ba0454d0966a0f..origin/main; git diff --check origin/main...HEAD" in /tmp/review-609/repo
 succeeded in 0ms:
#!/usr/bin/env python3
"""Validate whole-authority lifecycle transitions, including legacy-ID retirement.

Inputs are JSON arrays of governing-Spec frontmatter objects at the transition base
and candidate states. This tool complements JSON Schema: it checks cross-record
existence, lifecycle closure, and atomic backlinks that a single-record schema cannot.

Chains of any legal depth are supported: a superseded record may backlink a
successor that is itself superseded, as long as following ``superseded_by`` links
terminates at exactly one accepted authority per chain (cycles and premature
terminations are rejected). Records are accepted raw and unnormalized: historical
superseded records that predate the current frontmatter schema may omit the
``governed_by``/``supersedes`` array fields, which are then treated as empty;
active (proposed/accepted) records must still carry well-formed metadata.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

STRICT_SPEC_ID_RE = re.compile(r"^[A-Z][A-Z0-9_]*_V[0-9]+$")
LEGACY_SPEC_ID_RE = re.compile(
    r"^[A-Z][A-Z0-9_]*_V[0-9]+_[A-Z][A-Z0-9_]*$"
)
STATUSES = {"proposed", "accepted", "superseded"}
IMMUTABLE_AUTHORITY_FIELDS = (
    "spec_kind",
    "authority_level",
    "implementation_authority",
    "scope",
    "governed_by",
    "external_authorities",
    "owners",
)


def is_strict_spec_id(value: object) -> bool:
    return isinstance(value, str) and STRICT_SPEC_ID_RE.fullmatch(value) is not None


def is_legacy_spec_id(value: object) -> bool:
    return (
        isinstance(value, str)
        and LEGACY_SPEC_ID_RE.fullmatch(value) is not None
        and not is_strict_spec_id(value)
    )


def is_reference_id(value: object) -> bool:
    return is_strict_spec_id(value) or is_legacy_spec_id(value)


def index_records(records: object, label: str, errors: list[str]) -> dict[str, dict[str, Any]]:
    if not isinstance(records, list):
        errors.append(f"{label} is not an array")
        return {}
    indexed: dict[str, dict[str, Any]] = {}
    for position, record in enumerate(records):
        if not isinstance(record, dict):
            errors.append(f"{label}[{position}] is not an object")
            continue
        spec_id = record.get("spec_id")
        if not isinstance(spec_id, str):
            errors.append(f"{label}[{position}].spec_id is not a string")
            continue
        if spec_id in indexed:
            errors.append(f"{label} contains duplicate spec_id: {spec_id}")
            continue
        indexed[spec_id] = record
    return indexed


def is_absent_optional_array(value: object, status: object) -> bool:
    """True when a missing/null list field is legacy-tolerated on a superseded record."""
    return value is None and status == "superseded"


def validate_metadata(record: dict[str, Any], label: str = "record") -> list[str]:
    errors: list[str] = []
    spec_id = record.get("spec_id")
    status = record.get("status")

    if status not in STATUSES:
        errors.append(f"{label}.status is invalid")
    if status == "superseded":
        if not is_reference_id(spec_id):
            errors.append(f"{label}.spec_id is not a strict or legacy historical ID")
    elif not is_strict_spec_id(spec_id):
        errors.append(f"{label}.spec_id must be a strict _V<number> ID while active")

    governed_by = record.get("governed_by")
    if not isinstance(governed_by, list):
        if not is_absent_optional_array(governed_by, status):
            errors.append(f"{label}.governed_by is not an array")
    else:
        for authority_id in governed_by:
            if not is_strict_spec_id(authority_id):
                errors.append(f"{label}.governed_by contains a non-strict ID: {authority_id}")

    supersedes = record.get("supersedes")
    if not isinstance(supersedes, list):
        if not is_absent_optional_array(supersedes, status):
            errors.append(f"{label}.supersedes is not an array")
    else:
        if len(supersedes) != len(set(map(str, supersedes))):
            errors.append(f"{label}.supersedes contains duplicates")
        for authority_id in supersedes:
            if not is_reference_id(authority_id):
                errors.append(f"{label}.supersedes contains an invalid whole-authority ID: {authority_id}")

    superseded_by = record.get("superseded_by")
    if status == "superseded":
        if not is_strict_spec_id(superseded_by):
            errors.append(f"{label}.superseded_by must name a strict successor")
    elif superseded_by is not None:
        errors.append(f"{label}.superseded_by must be null while active")

    return errors


def validate_transition(base_records: object, candidate_records: object) -> list[str]:
    errors: list[str] = []
    base = index_records(base_records, "base", errors)
    candidate = index_records(candidate_records, "candidate", errors)

    for spec_id, record in candidate.items():
        errors.extend(validate_metadata(record, f"candidate[{spec_id}]"))

    for spec_id in sorted(set(base) - set(candidate)):
        errors.append(f"candidate omits base authority: {spec_id}")

    for spec_id, base_record in base.items():
        candidate_record = candidate.get(spec_id)
        if candidate_record is None:
            continue
        old_status = base_record.get("status")
        new_status = candidate_record.get("status")
        if old_status in {"accepted", "superseded"}:
            for field in IMMUTABLE_AUTHORITY_FIELDS:
                if candidate_record.get(field) != base_record.get(field):
                    errors.append(f"{spec_id} mutates accepted authority field: {field}")
        allowed_statuses = {
            "proposed": {"proposed", "accepted"},
            "accepted": {"accepted", "superseded"},
            "superseded": {"superseded"},
        }.get(old_status, set())
        if new_status not in allowed_statuses:
            errors.append(f"{spec_id} has forbidden lifecycle transition: {old_status} -> {new_status}")

        if old_status in {"accepted", "superseded"}:
            if candidate_record.get("supersedes") != base_record.get("supersedes"):
                errors.append(f"{spec_id} mutates accepted supersedes metadata")
        if old_status == "accepted" and new_status == "accepted":
            if candidate_record.get("superseded_by") != base_record.get("superseded_by"):
                errors.append(f"{spec_id} mutates active superseded_by metadata")
        if old_status == "superseded":
            if candidate_record.get("superseded_by") != base_record.get("superseded_by"):
                errors.append(f"{spec_id} mutates historical successor backlink")

    base_active_legacy = {
        spec_id
        for spec_id, record in base.items()
        if is_legacy_spec_id(spec_id) and record.get("status") == "accepted"
    }
    candidate_active_legacy = {
        spec_id
        for spec_id, record in candidate.items()
        if is_legacy_spec_id(spec_id) and record.get("status") == "accepted"
    }

    for spec_id in sorted(candidate_active_legacy - base_active_legacy):
        errors.append(f"candidate creates active legacy authority: {spec_id}")

    for spec_id, record in sorted(candidate.items()):
        if is_legacy_spec_id(spec_id) and spec_id not in base:
            errors.append(f"candidate invents legacy authority: {spec_id}")
        if record.get("status") == "superseded" and spec_id not in base:
            errors.append(f"candidate creates already-superseded authority: {spec_id}")

    referenced_old: dict[str, list[str]] = {}
    for successor_id, successor in candidate.items():
        supersedes = successor.get("supersedes")
        if not isinstance(supersedes, list):
            continue
        successor_status = successor.get("status")
        for old_id in supersedes:
            if not isinstance(old_id, str) or not is_reference_id(old_id):
                continue
            referenced_old.setdefault(old_id, []).append(successor_id)
            old_base = base.get(old_id)
            old_candidate = candidate.get(old_id)
            if old_base is None:
                errors.append(f"{successor_id} supersedes nonexistent base authority: {old_id}")
                continue
            if not is_strict_spec_id(successor_id):
                errors.append(f"successor must use a strict ID: {successor_id}")
            if old_candidate is None:
                errors.append(f"candidate omits superseded authority: {old_id}")
                continue

            if successor_status == "proposed":
                if old_base.get("status") != "accepted":
                    errors.append(
                        f"proposed successor {successor_id} targets non-accepted "
                        f"base authority: {old_id}"
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "urn:mayf3:agent-development-governance:spec-frontmatter:v0",
  "title": "Governing Spec frontmatter V0",
  "type": "object",
  "additionalProperties": true,
  "$defs": {
    "strictSpecId": {
      "type": "string",
      "pattern": "^[A-Z][A-Z0-9_]*_V[0-9]+$"
    },
    "legacyHistoricalSpecId": {
      "type": "string",
      "pattern": "^[A-Z][A-Z0-9_]*_V[0-9]+_[A-Z][A-Z0-9_]*$",
      "not": {
        "pattern": "^[A-Z][A-Z0-9_]*_V[0-9]+$"
      }
    }
  },
  "required": [
    "spec_id",
    "status",
    "spec_kind",
    "authority_level",
    "implementation_authority",
    "scope",
    "governed_by",
    "external_authorities",
    "supersedes",
    "superseded_by",
    "owners"
  ],
  "properties": {
    "spec_id": {
      "type": "string"
    },
    "status": {
      "enum": [
        "proposed",
        "accepted",
        "superseded"
      ]
    },
    "spec_kind": {
      "enum": [
        "invariant",
        "program",
        "implementation"
      ]
    },
    "authority_level": {
      "const": "governing_spec"
    },
    "implementation_authority": {
      "enum": [
        "none",
        "contracts"
      ]
    },
    "scope": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "string",
        "minLength": 1
      },
      "uniqueItems": true
    },
    "governed_by": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/strictSpecId"
      },
      "uniqueItems": true
    },
    "external_authorities": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "repository",
          "authority_id",
          "revision",
          "relation"
        ],
        "properties": {
          "repository": {
            "type": "string",
            "pattern": "^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$"
          },
          "authority_id": {
            "$ref": "#/$defs/strictSpecId"
          },
          "revision": {
            "type": "string",
            "pattern": "^[0-9a-f]{40}$"
          },
          "relation": {
            "enum": [
              "depends_on",
              "constrained_by",
              "interoperates_with"
            ]
          }
        }
      }
    },
    "supersedes": {
      "type": "array",
      "items": {
        "oneOf": [
          {
            "$ref": "#/$defs/strictSpecId"
          },
          {
            "$ref": "#/$defs/legacyHistoricalSpecId"
          }
        ]
      },
      "uniqueItems": true,
      "description": "Whole-authority predecessor IDs. On a proposed successor these entries declare non-active replacement intent; predecessors remain accepted and unbacklinked until atomic acceptance."
    },
    "superseded_by": {
      "oneOf": [
        {
          "type": "null"
        },
        {
          "$ref": "#/$defs/strictSpecId"
        }
      ]
    },
    "owners": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "string",
        "minLength": 1
      },
      "uniqueItems": true
    }
  },
  "allOf": [
    {
      "if": {
        "properties": {
          "status": {
            "const": "superseded"
          }
        },
        "required": [
          "status"
        ]
      },
      "then": {
        "properties": {
          "spec_id": {
            "oneOf": [
              {
                "$ref": "#/$defs/strictSpecId"
              },
              {
                "$ref": "#/$defs/legacyHistoricalSpecId"
              }
            ]
          },
          "superseded_by": {
            "$ref": "#/$defs/strictSpecId"
          }
        }
      },
      "else": {
        "properties": {
          "spec_id": {
            "$ref": "#/$defs/strictSpecId"
          },
          "superseded_by": {
            "type": "null"
          }
        }
      }
    }
  ]
}
.agents/README.md
.agents/governance.lock.json
.agents/local/CODE_STRUCTURE_GUARDRAILS_V2.md
.agents/local/CODE_STRUCTURE_GUARDRAILS_V3.md
.agents/local/README.md
.agents/tools/validate_governance_route.py
.agents/tools/validate_spec_transition.py
ALIGNMENT-REPORT-20261108.md
ASSESSMENT-603-REVERIFY.md
BRIEF-1257-R1-R4.md
BRIEF-1364-ADMISSION-BUDGET.md
BRIEF-1365-RETIRE.md
BRIEF-1366-LOCKTIMING-IMPL.md
BRIEF-1367-READSEP.md
BRIEF-1370-IMPL.md
BRIEF-1376-AMEND-AUTHOR.md
BRIEF-1376-WAIT-BUDGET.md
BRIEF-1377-B2.md
BRIEF-523-R2.md
BRIEF-523-R3.md
BRIEF-523.md
BRIEF-547-D-RELEASE-PREP.md
BRIEF-547-STORE-DIAG.md
BRIEF-603-REVERIFY.md
BRIEF-605-R2.md
BRIEF-637-DEFECT-A-R2.md
BRIEF-637-DEFECT-A.md
BRIEF-642-PHASE2.md
BRIEF-643-ACCEPT.md
BRIEF-BUSINESS-RECON-20261108.md
BRIEF-C-GATE-R2.md
BRIEF-C-GATE.md
BRIEF-C7.md
BRIEF-CAPTAIN-AUTH-CREATE.md
BRIEF-D0-ENTRY-PROVENANCE.md
BRIEF-D1D2-IMPL.md
BRIEF-DELEGATION-FORMAL.md
BRIEF-DISK-STAGE1.md
BRIEF-EKR-B1B4.md
BRIEF-EKR-B3-R2.md
BRIEF-EKR-B3.md
BRIEF-EKR-P0A.md
BRIEF-EKR-P1B-ONLY.md
BRIEF-EKR-PRE-R2.md
BRIEF-EKR-PRE-R3.md
BRIEF-EKR-PREFLIGHT.md
BRIEF-ENTRY-BINDING.md
BRIEF-GOV-ALIGN-20261108.md
BRIEF-MERGE-C7.md
BRIEF-MERGE-R2.md
BRIEF-PERTARGET-SUCCESSOR-RECON.md
BRIEF-PLANNED-PROPOSAL.md
BRIEF-RC3-READOPT-TEV1-V3.md
BRIEF-REFUSAL-PROPOSAL.md
BRIEF-RTH-CORE-SUCCESSOR.md
BRIEF-S05-MANDATE-FINAL.md
BRIEF-SETTLE.md
BRIEF-SRA-CONTROL-CENSUS.md
BRIEF-SRA-FORMALIZE.md
BRIEF-SUCCESSION-ORDER.md
BRIEF-SUCCESSION-R2.md
BRIEF-V3-EXCEPTION-R2.md
BRIEF-V3-EXCEPTION.md
BRIEF-WINDOW-ANARROWED-R2.md
BRIEF-WINDOW-ANARROWED.md
BRIEF-XATTRFIX-R2.md
BRIEF-XATTRFIX-R3.md
BRIEF-XATTRFIX-R4.md
BRIEF-XATTRFIX.md
BUSINESS-RECON-20261108.md
CAPTAIN-APPOINTMENT-REGISTRATION-20261109.md
CAPTAIN-AUTH-CREATE-RECEIPT.md
CAPTAIN-REMAINING-CONDITIONS-20261109.md
CONTROL-CENSUS-SRA-EFFECTIVENESS.md
D-RELEASE-PACKAGE-547.md
D-STORE-QA-547.md
D0-ENTRY-PROVENANCE-CENSUS.md
DISK-STAGE1-INVENTORY.md
ENTRY-BINDING-CENSUS.md
EXECUTION-MANDATE-W6-V1.md
EXECUTION-MANDATE-W6-V2.md
HR-OBSERVATION-STANDARD-V2.md
IMPL-RECEIPT-1370.md
INVESTIGATION-W6-S05.md
P1P2-BINDING-1351.md
PERTARGET-SUCCESSOR-RECON.md
POLICY-PROPOSAL-1370.md
RECEIPT-1364-BUDGET.md
RECEIPT-1365-RETIRE.md
RECEIPT-1366-IMPL.md
RECEIPT-1366-SUPERSEDE.md
RECEIPT-1367-READSEP.md
RECEIPT-1376-AMEND.md
RECEIPT-1376-BUDGET.md
RECEIPT-1377-B2.md
RECEIPT-523-R2.md
RECEIPT-523-R3.md
RECEIPT-523.md
RECEIPT-603-REVERIFY.md
RECEIPT-605-R2.md
RECEIPT-642-PHASE2.md
RECEIPT-C7.md
RECEIPT-D1D2-IMPL.md
RECEIPT-DELEGATION-FORMAL.md
RECEIPT-EKR-B1B4.md
RECEIPT-EKR-B3-R2.md
RECEIPT-EKR-B3.md
RECEIPT-EKR-P0A.md
RECEIPT-EKR-P1B.md
RECEIPT-EXECUTION-MANDATE.md
RECEIPT-FIX-629.md
RECEIPT-MERGE-R2.md
RECEIPT-MERGE.md
RECEIPT-PLANNED-PROPOSAL.md
RECEIPT-REFUSAL-PROPOSAL.md
RECEIPT-RTH-CORE-SUCCESSOR.md
RECEIPT-S05-MANDATE-FINAL.md
RECEIPT-SEMANTIC-DELTA-CONSOLIDATION.md
RECEIPT-SETTLE.md
RECEIPT-SRA-V1.md
RECEIPT-SUCCESSION-ORDER.md
RECEIPT-V3-EXCEPTION-R2.md
RECEIPT-VERIFIER-ADAPT.md
RECEIPT-W6-S04-R2.md
RECEIPT-W6-S04.md
RECEIPT-WINDOW-ANARROWED-R2.md
RECEIPT-XATTRFIX-R2.md
RECEIPT-XATTRFIX-R3.md
RECEIPT-XATTRFIX-R4.md
RECEIPT-XATTRFIX.md
SEMANTIC-DELTA-CONSOLIDATION.md
SEMANTIC-VERIFY-1370.md
STANDING-RELEASE-AUTHORIZATION-V1-DRAFT.md
STOPPED-1364-BUDGET.md
STOPPED-1365-RETIRE.md
STOPPED-1366-IMPL.md
STOPPED-1366-LOCKSCOPE.md
STOPPED-1367-READSEP.md
STOPPED-1370-IMPL.md
STOPPED-1376-BUDGET.md
STOPPED-1377-B2.md
STOPPED-523-R2.md
STOPPED-523.md
STOPPED-547-D-RELEASE-PREP.md
STOPPED-547-STORE-DIAG.md
STOPPED-603-REVERIFY.md
STOPPED-605-R2.md
STOPPED-637-R2.md
STOPPED-637.md
STOPPED-CAPTAIN-AUTH-CREATE.md
STOPPED-DELEGATION-FORMAL.md
STOPPED-EKR-B1B4.md
STOPPED-EKR-B3.md
STOPPED-EKR-P0A.md
STOPPED-EKR-PRE-R2.md
STOPPED-EKR-PRE.md
STOPPED-EXECUTION-MANDATE.md
STOPPED-GOV-ALIGN.md
STOPPED-MERGE-R2.md
STOPPED-MERGE.md
STOPPED-REFUSAL-PROPOSAL.md
STOPPED-S05-MANDATE-FINAL.md
STOPPED-SRA-V1.md
STOPPED-SUCCESSION-ORDER.md
STOPPED-V3-EXCEPTION.md
STOPPED-W6-S04.md
STOPPED-WINDOW-ANARROWED.md
STOPPED-XATTRFIX-R2.md
STOPPED-XATTRFIX-R3.md
STOPPED-XATTRFIX-R4.md
STOPPED-XATTRFIX.md
SUCCESSION-ORDER-AND-CONFLICTS.md
docs/decisions/RECEIPT-527DOCS.md
docs/decisions/RECEIPT-WAE.md
docs/evidence/1364-admission-budget-r2/RECEIPT-1364-R1.md
docs/evidence/1364-admission-budget-r2/REVIEW-1364-R2-PREPUBLICATION.md
docs/evidence/1364-admission-budget-r2/REVIEW-1364-R2.md
docs/evidence/1364-admission-budget-r2/SHA256SUMS.txt
docs/evidence/1364-admission-budget-r2/STOPPED-1364-R1.md
docs/evidence/1364-admission-budget-r2/baseline.test.mjs
docs/evidence/1364-admission-budget-r2/fetch-main.log
docs/evidence/1364-admission-budget-r2/green.tap
docs/evidence/1364-admission-budget-r2/implementation.json
docs/evidence/1364-admission-budget-r2/in-tree-red.tap
docs/evidence/1364-admission-budget-r2/initial-push.command.json
docs/evidence/1364-admission-budget-r2/initial-push.log
docs/evidence/1364-admission-budget-r2/integrated-candidate.json
docs/evidence/1364-admission-budget-r2/integrated-related.json
docs/evidence/1364-admission-budget-r2/integrated-related.tap
docs/evidence/1364-admission-budget-r2/integrated-source.patch
docs/evidence/1364-admission-budget-r2/integrated-structure.command.json
docs/evidence/1364-admission-budget-r2/integrated-structure.json.txt
docs/evidence/1364-admission-budget-r2/integrated-structure.stderr
docs/evidence/1364-admission-budget-r2/integrated-targeted.json
docs/evidence/1364-admission-budget-r2/integrated-targeted.tap
docs/evidence/1364-admission-budget-r2/integration-base.json
docs/evidence/1364-admission-budget-r2/integration.log
docs/evidence/1364-admission-budget-r2/line-counts.json
docs/evidence/1364-admission-budget-r2/main-644-engine.patch
docs/evidence/1364-admission-budget-r2/pr-created.json
docs/evidence/1364-admission-budget-r2/preintegration-related.json
docs/evidence/1364-admission-budget-r2/preintegration-related.tap
docs/evidence/1364-admission-budget-r2/preintegration-targeted.json
docs/evidence/1364-admission-budget-r2/preintegration-targeted.tap
docs/evidence/1364-admission-budget-r2/preintegration.patch
docs/evidence/1364-admission-budget-r2/prepublication-remote.command.json
docs/evidence/1364-admission-budget-r2/prepublication-remote.log
docs/evidence/1364-admission-budget-r2/source-commit.log
docs/evidence/1364-admission-budget-r2/stash.json
docs/evidence/1365-retire/R2-GREEN.json
docs/evidence/1365-retire/R2-GREEN.tap
docs/evidence/1365-retire/R2-RED.json
docs/evidence/1365-retire/R2-RED.tap
docs/evidence/1365-retire/R2-STOP.json
docs/evidence/1365-retire/R2-existing.json
docs/evidence/1365-retire/R2-existing.tap
docs/evidence/1365-retire/R3-candidate.json
docs/evidence/1365-retire/R3-candidate.patch
docs/evidence/1365-retire/R3-evidence-manifest.json
docs/evidence/1365-retire/R3-existing.json
docs/evidence/1365-retire/R3-existing.tap
docs/evidence/1365-retire/R3-implementation.json
docs/evidence/1365-retire/R3-independent-review.md
docs/evidence/1365-retire/R3-initial-push.json
docs/evidence/1365-retire/R3-pr-create.json
docs/evidence/1365-retire/R3-pr-initial-readback.json
docs/evidence/1365-retire/R3-prepublication-head-review.md
docs/evidence/1365-retire/R3-prepublication-remote.json
docs/evidence/1365-retire/R3-structure.command.json
docs/evidence/1365-retire/R3-structure.json.txt
docs/evidence/1365-retire/R3-structure.stderr
docs/evidence/1365-retire/R3-targeted.json
docs/evidence/1365-retire/R3-targeted.tap
docs/evidence/1365-retire/RED.json
docs/evidence/1365-retire/RED.tap
docs/evidence/1366-locktiming/GREEN.json
docs/evidence/1366-locktiming/GREEN.txt
docs/evidence/1366-locktiming/RED-final-fixtures.json
docs/evidence/1366-locktiming/RED-final-fixtures.txt
docs/evidence/1366-locktiming/RED.json
docs/evidence/1366-locktiming/RED.txt
docs/evidence/1366-locktiming/r2/broker.json
docs/evidence/1366-locktiming/r2/broker.txt
docs/evidence/1366-locktiming/r2/evidence-rebind.json
docs/evidence/1366-locktiming/r2/independent-review.md
docs/evidence/1366-locktiming/r2/integration.json
docs/evidence/1366-locktiming/r2/integration.txt
docs/evidence/1366-locktiming/r2/receipt-tooling.json
docs/evidence/1366-locktiming/r2/remote-open.json
docs/evidence/1366-locktiming/r2/workflow-existing.json
docs/evidence/1366-locktiming/r2/workflow-existing.txt
docs/evidence/1366-locktiming/workflow-existing.json
docs/evidence/1366-locktiming/workflow-existing.txt
docs/evidence/1367-readsep/R2-GREEN.json
docs/evidence/1367-readsep/R2-GREEN.txt
docs/evidence/1367-readsep/R2-RECEIPT.md
docs/evidence/1367-readsep/R2-RED-test.js.txt
docs/evidence/1367-readsep/R2-RED.json
docs/evidence/1367-readsep/R2-RED.txt
docs/evidence/1367-readsep/R2-REVIEW.md
docs/evidence/1367-readsep/R2-checkpoint.json
docs/evidence/1367-readsep/R2-diff-check.txt
docs/evidence/1367-readsep/R2-integration.json
docs/evidence/1367-readsep/R2-integration.txt
docs/evidence/1367-readsep/R2-product.diff
docs/evidence/1367-readsep/R2-workflow.json
docs/evidence/1367-readsep/R2-workflow.txt
docs/evidence/1367-readsep/R3-RECEIPT-READBACK.md
docs/evidence/1367-readsep/R3-RECEIPT.md
docs/evidence/1367-readsep/R3-REVIEW.md
docs/evidence/1367-readsep/R3-broker.json
docs/evidence/1367-readsep/R3-broker.txt
docs/evidence/1367-readsep/R3-checkpoint.json
docs/evidence/1367-readsep/R3-diff-check.json
docs/evidence/1367-readsep/R3-diff-check.txt
docs/evidence/1367-readsep/R3-environment.txt
docs/evidence/1367-readsep/R3-integration.json
docs/evidence/1367-readsep/R3-integration.txt
docs/evidence/1367-readsep/R3-structure.json
docs/evidence/1367-readsep/R3-structure.txt
docs/evidence/1367-readsep/R4-CANDIDATE-REVIEW.md
docs/evidence/1367-readsep/R4-PR-DRAFT.md
docs/evidence/1367-readsep/R4-RECEIPT.md
docs/evidence/1367-readsep/R4-REVIEW.md
docs/evidence/1367-readsep/R4-STOP-REVIEW.md
docs/evidence/1367-readsep/R4-checkpoint.json
docs/evidence/1367-readsep/R4-precommit-remote.json
docs/evidence/1367-readsep/R4-precommit-remote.stderr
docs/evidence/1367-readsep/R4-precommit-remote.stdout
docs/evidence/1367-readsep/R4-precommit-whitespace.json
docs/evidence/1367-readsep/R4-precommit-whitespace.stderr
docs/evidence/1367-readsep/R4-precommit-whitespace.stdout
docs/evidence/1367-readsep/R4-stop-checkpoint.json
docs/evidence/1367-readsep/R4-whitespace-corrected.json
docs/evidence/1367-readsep/R4-whitespace-corrected.stderr
docs/evidence/1367-readsep/R4-whitespace-corrected.stdout
docs/evidence/1367-readsep/R4-whitespace-scope.json
docs/evidence/1367-readsep/R4-whitespace.json
docs/evidence/1367-readsep/R4-whitespace.stderr
docs/evidence/1367-readsep/R4-whitespace.stdout
docs/evidence/1367-readsep/R5-RECEIPT.md
docs/evidence/1367-readsep/R5-STOP-REVIEW.md
docs/evidence/1367-readsep/R5-entry.json
docs/evidence/1367-readsep/R5-network-probe.json
docs/evidence/1367-readsep/R5-network-probe.stderr
docs/evidence/1367-readsep/R5-network-probe.stdout
docs/evidence/1367-readsep/R5-precommit-pr-list-wrapper.json
docs/evidence/1367-readsep/R5-precommit-pr-list-wrapper.log
docs/evidence/1367-readsep/R5-precommit-remote.json
docs/evidence/1367-readsep/R5-precommit-remote.stderr
docs/evidence/1367-readsep/R5-precommit-remote.stdout
docs/evidence/1367-readsep/R5-stop-checkpoint.json
docs/evidence/1367-readsep/R6-PR-BODY.md
docs/evidence/1367-readsep/R6-delivery.json
docs/evidence/1367-readsep/RED.json
docs/evidence/1367-readsep/RED.txt
docs/evidence/1367-readsep/r7/RED.json
docs/evidence/1367-readsep/r7/RED.txt
docs/evidence/1367-readsep/r7/SEMANTIC-REVIEW.md
docs/evidence/1367-readsep/r7/broker.json
docs/evidence/1367-readsep/r7/broker.txt
docs/evidence/1367-readsep/r7/capture.py
docs/evidence/1367-readsep/r7/checkpoint.json
docs/evidence/1367-readsep/r7/diagnostic11.json
docs/evidence/1367-readsep/r7/diagnostic11.txt
docs/evidence/1367-readsep/r7/entry-pr.json
docs/evidence/1367-readsep/r7/integration.json
docs/evidence/1367-readsep/r7/integration.txt
docs/evidence/1367-readsep/r7/observation-cas.json
docs/evidence/1367-readsep/r7/observation-cas.txt
docs/evidence/1367-readsep/r7/precommit-remote.json
docs/evidence/1367-readsep/r7/precommit-remote.stderr
docs/evidence/1367-readsep/r7/precommit-remote.stdout
docs/evidence/1367-readsep/r7/precommit-whitespace.json
docs/evidence/1367-readsep/r7/precommit-whitespace.stderr
docs/evidence/1367-readsep/r7/precommit-whitespace.stdout
docs/evidence/1367-readsep/r7/regression.json
docs/evidence/1367-readsep/r7/regression.txt
docs/evidence/1367-readsep/r7/run.py
docs/evidence/1367-readsep/r7/shutdown-api.json
docs/evidence/1367-readsep/r7/shutdown-api.txt
docs/evidence/1367-readsep/r7/structure-coordinate.json
docs/evidence/1367-readsep/r7/structure.json
docs/evidence/1367-readsep/r7/structure.stderr
docs/evidence/1367-readsep/r7/structure.stdout
docs/evidence/1367-readsep/r7/target8.json
docs/evidence/1367-readsep/r7/target8.txt
docs/evidence/1367-readsep/r7/whitespace-scope.json
docs/evidence/1367-readsep/r7/workflow.json
docs/evidence/1367-readsep/r7/workflow.txt
docs/evidence/1377-b2-r3/RECEIPT-1377-B2-R3.md
docs/evidence/1377-b2-r3/REVIEW-1377-B2-R3.md
docs/evidence/1377-b2-r3/SHA256SUMS.txt
docs/evidence/1377-b2-r3/affected-regressions.txt
docs/evidence/1377-b2-r3/blocked-targeted.txt
docs/evidence/1377-b2-r3/broker-owner-obligation-31.txt
docs/evidence/1377-b2-r3/checkpoint.json
docs/evidence/1377-b2-r3/observation-cas-47.txt
docs/evidence/1377-b2-r3/structure.json.txt
docs/evidence/1377-b2-r3/syntax.txt
docs/evidence/1377-b2-r4/SHA256SUMS.txt
docs/evidence/1377-b2-r4/blocked-targeted.txt
docs/evidence/1377-b2-r4/candidate.json
docs/evidence/1377-b2-r4/checkpoint.json
docs/evidence/1377-b2-r4/diff-check.txt
docs/evidence/1377-b2-r4/gate-summary.txt
docs/evidence/1377-b2-r4/inherited-files.json
docs/evidence/1377-b2-r4/source-delta.patch
docs/evidence/1377-b2-r4/syntax-1.txt
docs/evidence/1377-b2-r4/syntax-2.txt
docs/evidence/1377-b2-r4/syntax-3.txt
docs/evidence/1377-b2-r4/syntax-4.txt
docs/evidence/1377-b2-r4/syntax-5.txt
docs/evidence/1377-b2-r4/syntax-6.txt
docs/evidence/1377-b2-r4/syntax-7.txt
docs/evidence/1377-b2-r5/RECEIPT-1377-B2-R4.md
docs/evidence/1377-b2-r5/REVIEW-1377-B2-R5.md
docs/evidence/1377-b2-r5/SHA256SUMS.txt
docs/evidence/1377-b2-r5/affected-regressions-135.txt
docs/evidence/1377-b2-r5/blocked-targeted.txt
docs/evidence/1377-b2-r5/broker-owner-obligation-31.txt
docs/evidence/1377-b2-r5/candidate.json
docs/evidence/1377-b2-r5/checkpoint.json
docs/evidence/1377-b2-r5/diff-check.txt
docs/evidence/1377-b2-r5/gate-results.json
docs/evidence/1377-b2-r5/handwritten-docs-diff-check.txt
docs/evidence/1377-b2-r5/implementation.json
docs/evidence/1377-b2-r5/inherited-files.json
docs/evidence/1377-b2-r5/ledger-terminal-regression.txt
docs/evidence/1377-b2-r5/observation-cas-full.txt
docs/evidence/1377-b2-r5/packaging-diagnostic.txt
docs/evidence/1377-b2-r5/source-commit.txt
docs/evidence/1377-b2-r5/source-delta.patch
docs/evidence/1377-b2-r5/structure.json.txt
docs/evidence/1377-b2-r5/syntax-1.txt
docs/evidence/1377-b2-r5/syntax-2.txt
docs/evidence/1377-b2-r5/syntax-3.txt
docs/evidence/1377-b2-r5/syntax-4.txt
docs/evidence/1377-b2-r5/syntax-5.txt
docs/evidence/1377-b2-r5/syntax-6.txt
docs/evidence/1377-b2-r5/syntax-7.txt
docs/evidence/1377-b2-r5/syntax-8.txt
docs/evidence/1377-b2-r5/syntax-9.txt
docs/evidence/1377-b2-r5/verification.json
docs/evidence/603-reverify/independent-review.md
docs/evidence/603-reverify/r2/candidate-coordinates.json
docs/evidence/603-reverify/r2/candidate-working.diff
docs/evidence/603-reverify/r2/changed-runtime.command.json
docs/evidence/603-reverify/r2/changed-runtime.stderr.log
docs/evidence/603-reverify/r2/changed-runtime.stdout.log
docs/evidence/603-reverify/r2/independent-gate-review.md
docs/evidence/603-reverify/r2/independent-source-review.md
docs/evidence/603-reverify/r2/main-readback.json
docs/evidence/603-reverify/r2/prior-RECEIPT-603-REVERIFY.md
docs/evidence/603-reverify/r2/prior-STOPPED-603-REVERIFY.md
docs/evidence/603-reverify/r2/stopped-readback.json
docs/evidence/603-reverify/r2/structure.command.json
docs/evidence/603-reverify/r2/structure.stderr.log
docs/evidence/603-reverify/r2/structure.stdout.log
docs/evidence/603-reverify/r3/changed-runtime.command.json
docs/evidence/603-reverify/r3/changed-runtime.stderr.log
docs/evidence/603-reverify/r3/changed-runtime.stdout.log
docs/evidence/603-reverify/r3/environment-preflight.json
docs/evidence/603-reverify/r3/independent-d009-review.md
docs/evidence/603-reverify/r3/independent-gate-review.md
docs/evidence/603-reverify/r3/main-readback.json
docs/evidence/603-reverify/r3/pr-readback.json
docs/evidence/603-reverify/r3/prior-RECEIPT-603-REVERIFY.md
docs/evidence/603-reverify/r3/prior-STOPPED-603-REVERIFY.md
docs/evidence/603-reverify/r3/stopped-readback.json
docs/evidence/603-reverify/r4/FAILED.json
docs/evidence/603-reverify/r4/artifact-hashes.json
docs/evidence/603-reverify/r4/cached-diff-check.command.json
docs/evidence/603-reverify/r4/cached-diff-check.stderr.log
docs/evidence/603-reverify/r4/cached-diff-check.stdout.log
docs/evidence/603-reverify/r4/changed-runtime.command.json
docs/evidence/603-reverify/r4/changed-runtime.stderr.log
docs/evidence/603-reverify/r4/changed-runtime.stdout.log
docs/evidence/603-reverify/r4/delivery-runner.py
docs/evidence/603-reverify/r4/ekr-broker.command.json
docs/evidence/603-reverify/r4/ekr-broker.stderr.log
docs/evidence/603-reverify/r4/ekr-broker.stdout.log
docs/evidence/603-reverify/r4/ekr-observation-cas.command.json
docs/evidence/603-reverify/r4/ekr-observation-cas.stderr.log
docs/evidence/603-reverify/r4/ekr-observation-cas.stdout.log
docs/evidence/603-reverify/r4/ekr-runtime.command.json
docs/evidence/603-reverify/r4/ekr-runtime.stderr.log
docs/evidence/603-reverify/r4/ekr-runtime.stdout.log
docs/evidence/603-reverify/r4/ekr-workflow.command.json
docs/evidence/603-reverify/r4/ekr-workflow.stderr.log
docs/evidence/603-reverify/r4/ekr-workflow.stdout.log
docs/evidence/603-reverify/r4/environment-preflight.json
docs/evidence/603-reverify/r4/final-source-binding.command.json
docs/evidence/603-reverify/r4/final-source-binding.stderr.log
docs/evidence/603-reverify/r4/final-source-binding.stdout.log
docs/evidence/603-reverify/r4/gate-runner.py
docs/evidence/603-reverify/r4/governance.command.json
docs/evidence/603-reverify/r4/governance.stderr.log
docs/evidence/603-reverify/r4/governance.stdout.log
docs/evidence/603-reverify/r4/independent-d009-review.md
docs/evidence/603-reverify/r4/independent-gate-review.md
docs/evidence/603-reverify/r4/independent-source-final-head-review.md
docs/evidence/603-reverify/r4/independent-stop-review.md
docs/evidence/603-reverify/r4/installer-binding.command.json
docs/evidence/603-reverify/r4/installer-binding.stderr.log
docs/evidence/603-reverify/r4/installer-binding.stdout.log
docs/evidence/603-reverify/r4/installer-syntax.command.json
docs/evidence/603-reverify/r4/installer-syntax.stderr.log
docs/evidence/603-reverify/r4/installer-syntax.stdout.log
docs/evidence/603-reverify/r4/javascript-syntax.command.json
docs/evidence/603-reverify/r4/javascript-syntax.stderr.log
docs/evidence/603-reverify/r4/javascript-syntax.stdout.log
docs/evidence/603-reverify/r4/main-impact-merge-tree.command.json
docs/evidence/603-reverify/r4/main-impact-merge-tree.stderr.log
docs/evidence/603-reverify/r4/main-impact-merge-tree.stdout.log
docs/evidence/603-reverify/r4/main-impact-review.md
docs/evidence/603-reverify/r4/pr-body-before.md
docs/evidence/603-reverify/r4/pr-source-update.json
docs/evidence/603-reverify/r4/prior-RECEIPT-603-REVERIFY.md
docs/evidence/603-reverify/r4/prior-STOPPED-603-REVERIFY.md
docs/evidence/603-reverify/r4/push-source.command.json
docs/evidence/603-reverify/r4/push-source.stderr.log
docs/evidence/603-reverify/r4/push-source.stdout.log
docs/evidence/603-reverify/r4/remote-preflight.json
docs/evidence/603-reverify/r4/remote-source-readback.command.json
docs/evidence/603-reverify/r4/remote-source-readback.stderr.log
docs/evidence/603-reverify/r4/remote-source-readback.stdout.log
docs/evidence/603-reverify/r4/scheduler-router.command.json
docs/evidence/603-reverify/r4/scheduler-router.stderr.log
docs/evidence/603-reverify/r4/scheduler-router.stdout.log
docs/evidence/603-reverify/r4/scheduler.command.json
docs/evidence/603-reverify/r4/scheduler.stderr.log
docs/evidence/603-reverify/r4/scheduler.stdout.log
docs/evidence/603-reverify/r4/source-binding.command.json
docs/evidence/603-reverify/r4/source-binding.stderr.log
docs/evidence/603-reverify/r4/source-binding.stdout.log
docs/evidence/603-reverify/r4/source-commit-coordinates.json
docs/evidence/603-reverify/r4/structure-final-source.command.json
docs/evidence/603-reverify/r4/structure-final-source.stderr.log
docs/evidence/603-reverify/r4/structure-final-source.stdout.log
docs/evidence/603-reverify/r4/working-diff-check.command.json
docs/evidence/603-reverify/r4/working-diff-check.stderr.log
docs/evidence/603-reverify/r4/working-diff-check.stdout.log
docs/evidence/603-reverify/r5/FAILED.json
docs/evidence/603-reverify/r5/cached-diff-check-final.command.json
docs/evidence/603-reverify/r5/cached-diff-check-final.stderr.log
docs/evidence/603-reverify/r5/cached-diff-check-final.stdout.log
docs/evidence/603-reverify/r5/cached-diff-check.command.json
docs/evidence/603-reverify/r5/cached-diff-check.stderr.log
docs/evidence/603-reverify/r5/cached-diff-check.stdout.log
docs/evidence/603-reverify/r5/capture-command.py
docs/evidence/603-reverify/r5/check-cached-whitespace.py
docs/evidence/603-reverify/r5/docs-commit-readback.json
docs/evidence/603-reverify/r5/docs-commit.command.json
docs/evidence/603-reverify/r5/docs-commit.stderr.log
docs/evidence/603-reverify/r5/docs-commit.stdout.log
docs/evidence/603-reverify/r5/final-index-check.command.json
docs/evidence/603-reverify/r5/final-index-check.stderr.log
docs/evidence/603-reverify/r5/final-index-check.stdout.log
docs/evidence/603-reverify/r5/independent-final-head-review.md
docs/evidence/603-reverify/r5/independent-packaging-review.md
docs/evidence/603-reverify/r5/initial-index.json
docs/evidence/603-reverify/r5/pr-capability-review.md
docs/evidence/603-reverify/r5/pr-final-readback.json
docs/evidence/603-reverify/r5/pr-head-edit.command.json
docs/evidence/603-reverify/r5/pr-head-edit.stderr.log
docs/evidence/603-reverify/r5/pr-head-edit.stdout.log
docs/evidence/603-reverify/r5/pr-preflight.json
docs/evidence/603-reverify/r5/preserved-evidence.json
docs/evidence/603-reverify/r5/prior-RECEIPT-603-REVERIFY.md
docs/evidence/603-reverify/r5/prior-STOPPED-603-REVERIFY.md
docs/evidence/603-reverify/r5/remote-final-readback.command.json
docs/evidence/603-reverify/r5/remote-final-readback.stderr.log
docs/evidence/603-reverify/r5/remote-final-readback.stdout.log
docs/evidence/603-reverify/r5/remote-preflight.command.json
docs/evidence/603-reverify/r5/remote-preflight.stderr.log
docs/evidence/603-reverify/r5/remote-preflight.stdout.log
docs/evidence/603-reverify/r5/stopped-readback.json
docs/evidence/603-reverify/r5/whitespace-exemptions.json
docs/evidence/603-reverify/r6/FAILED.json
docs/evidence/603-reverify/r6/capture-command.py
docs/evidence/603-reverify/r6/independent-prepublication-review.md
docs/evidence/603-reverify/r6/independent-stop-review.md
docs/evidence/603-reverify/r6/initial-state.json
docs/evidence/603-reverify/r6/new-pr-body.md
docs/evidence/603-reverify/r6/new-pr-final-readonly.command.json
docs/evidence/603-reverify/r6/new-pr-preflight.command.json
docs/evidence/603-reverify/r6/old-pr-final-readonly.command.json
docs/evidence/603-reverify/r6/old-pr-preflight.command.json
docs/evidence/603-reverify/r6/preflight.json
docs/evidence/603-reverify/r6/prepublication-cached-check.command.json
docs/evidence/603-reverify/r6/prior-RECEIPT-603-REVERIFY.md
docs/evidence/603-reverify/r6/prior-STOPPED-603-REVERIFY.md
docs/evidence/603-reverify/r6/remote-final-readonly.command.json
docs/evidence/603-reverify/r6/remote-preflight.command.json
docs/evidence/603-reverify/r6/stopped-readback.json
docs/evidence/603-reverify/r7/FAILED.json
docs/evidence/603-reverify/r7/capture-command.py
docs/evidence/603-reverify/r7/docs-commit-readback.json
docs/evidence/603-reverify/r7/docs-commit.command.json
docs/evidence/603-reverify/r7/environment-recipe.json
docs/evidence/603-reverify/r7/final-index-check.command.json
docs/evidence/603-reverify/r7/independent-docs-head-review.md
docs/evidence/603-reverify/r7/independent-evidence-review.md
docs/evidence/603-reverify/r7/independent-prepublication-review.md
docs/evidence/603-reverify/r7/independent-stop-review.md
docs/evidence/603-reverify/r7/initial-state.json
docs/evidence/603-reverify/r7/lock-readonly.json
docs/evidence/603-reverify/r7/new-pr-body.md
docs/evidence/603-reverify/r7/new-pr-coordinate.json
docs/evidence/603-reverify/r7/new-pr-create.command.json
docs/evidence/603-reverify/r7/new-pr-created-readback.command.json
docs/evidence/603-reverify/r7/new-pr-preflight.command.json
docs/evidence/603-reverify/r7/new-pr-readback.json
docs/evidence/603-reverify/r7/old-pr-close-event.command.json
docs/evidence/603-reverify/r7/old-pr-close.command.json
docs/evidence/603-reverify/r7/old-pr-comment-coordinate.json
docs/evidence/603-reverify/r7/old-pr-comment-readback.command.json
docs/evidence/603-reverify/r7/old-pr-comment.command.json
docs/evidence/603-reverify/r7/old-pr-preflight.command.json
docs/evidence/603-reverify/r7/old-pr-superseded-comment.md
docs/evidence/603-reverify/r7/postfailure-new-pr-readonly.command.json
docs/evidence/603-reverify/r7/postfailure-old-pr-readonly.command.json
docs/evidence/603-reverify/r7/postfailure-remote-readonly.command.json
docs/evidence/603-reverify/r7/preflight.json
docs/evidence/603-reverify/r7/prepublication-cached-check.command.json
docs/evidence/603-reverify/r7/prepublication-check-binding.json
docs/evidence/603-reverify/r7/prior-RECEIPT-603-REVERIFY.md
docs/evidence/603-reverify/r7/prior-STOPPED-603-REVERIFY.md
docs/evidence/603-reverify/r7/push-docs.command.json
docs/evidence/603-reverify/r7/remote-docs-readback.command.json
docs/evidence/603-reverify/r7/remote-preflight.command.json
docs/evidence/603-reverify/r7/stage-prepublication.command.json
docs/evidence/603-reverify/r7/stopped-readback.json
docs/evidence/603-reverify/r7/terminal-supplement-location.json
docs/evidence/603-reverify/reviewed-product.diff
docs/evidence/603-reverify/source-commits.txt
docs/evidence/603-reverify/stopped-coordinates.json
docs/evidence/603-reverify/stopped-working.diff
docs/evidence/605-r5/router-open-diff.json
docs/evidence/605-r6/facts-readback.json
docs/evidence/605-r6/full-router.log
docs/evidence/605-r6/gates.json
docs/evidence/605-r6/helper-bounds.log
docs/evidence/605-r6/independent-review.txt
docs/evidence/605-r6/initial-files.json
docs/evidence/605-r6/manifest.json
docs/evidence/605-r6/matrix-cold-start.log
docs/evidence/605-r6/matrix-isolation.log
docs/evidence/605-r6/matrix-negative-persistence.log
docs/evidence/605-r6/matrix-no-replay.log
docs/evidence/605-r6/matrix-restart.log
docs/evidence/605-r6/matrix-rollback.log
docs/evidence/605-r6/r5-matrix-decode.log
docs/evidence/605-r6/r5-targeted.log
docs/evidence/605-r6/run-gate.py
docs/evidence/605-r7/F01-base.log
docs/evidence/605-r7/F02-base.log
docs/evidence/605-r7/F03-base.log
docs/evidence/605-r7/F04-base.log
docs/evidence/605-r7/F05-base.log
docs/evidence/605-r7/F06-base.log
docs/evidence/605-r7/F07-base.log
docs/evidence/605-r7/F08-base.log
docs/evidence/605-r7/F09-base.log
docs/evidence/605-r7/F10-base.log
docs/evidence/605-r7/attribution.json
docs/evidence/605-r7/attribution.md
docs/evidence/605-r7/baseline.json
docs/evidence/605-r7/cases.json
docs/evidence/605-r7/data-preservation-readback.json
docs/evidence/605-r7/delivery-readback.json
docs/evidence/605-r7/final-gates.py
docs/evidence/605-r7/final-head-source-review.txt
docs/evidence/605-r7/full-router.log
docs/evidence/605-r7/full-scheduler-consolidated.log
docs/evidence/605-r7/full-scheduler-router.log
docs/evidence/605-r7/full-scheduler.log
docs/evidence/605-r7/gates.json
docs/evidence/605-r7/historical-markdown-originals.json
docs/evidence/605-r7/independent-review.txt
docs/evidence/605-r7/manifest.json
docs/evidence/605-r7/packaging-delta.json
docs/evidence/605-r7/pre-stash-files.json
docs/evidence/605-r7/restore-verification.json
docs/evidence/605-r7/review-snapshot.json
docs/evidence/605-r7/run-suites.py
docs/evidence/605-r7/source-hashes.json
docs/evidence/605-r7/stash.json
docs/evidence/605-r7/structure.log
docs/evidence/605-r7/suite-plan.json
docs/evidence/disk-stage1-20261107/INDEPENDENT-REVIEW.md
docs/evidence/disk-stage1-20261107/SHA256SUMS
docs/evidence/disk-stage1-20261107/VALIDATION.md
docs/evidence/disk-stage1-20261107/apfs-after.stderr.txt
docs/evidence/disk-stage1-20261107/apfs-after.stdout.txt
docs/evidence/disk-stage1-20261107/apfs-before.stderr.txt
docs/evidence/disk-stage1-20261107/apfs-before.stdout.txt
docs/evidence/disk-stage1-20261107/assemble_inventory.py
docs/evidence/disk-stage1-20261107/candidates-20.json
docs/evidence/disk-stage1-20261107/codex-root-files.json
docs/evidence/disk-stage1-20261107/data-info.stderr.txt
docs/evidence/disk-stage1-20261107/data-info.stdout.txt
docs/evidence/disk-stage1-20261107/df-after.stderr.txt
docs/evidence/disk-stage1-20261107/df-after.stdout.txt
docs/evidence/disk-stage1-20261107/df-before.stderr.txt
docs/evidence/disk-stage1-20261107/df-before.stdout.txt
docs/evidence/disk-stage1-20261107/df-final.stderr.txt
docs/evidence/disk-stage1-20261107/df-final.stdout.txt
docs/evidence/disk-stage1-20261107/domain-commands.json
docs/evidence/disk-stage1-20261107/du-authsvc-depth1.stderr.txt
docs/evidence/disk-stage1-20261107/du-authsvc-depth1.stdout.txt
docs/evidence/disk-stage1-20261107/du-data-depth2.stderr.txt
docs/evidence/disk-stage1-20261107/du-data-depth2.stdout.txt
docs/evidence/disk-stage1-20261107/du-external-depth1.stderr.txt
docs/evidence/disk-stage1-20261107/du-external-depth1.stdout.txt
docs/evidence/disk-stage1-20261107/du-home-depth1.stderr.txt
docs/evidence/disk-stage1-20261107/du-home-depth1.stdout.txt
docs/evidence/disk-stage1-20261107/du-libexec-depth1.stderr.txt
docs/evidence/disk-stage1-20261107/du-libexec-depth1.stdout.txt
docs/evidence/disk-stage1-20261107/du-system-depth1.stderr.txt
docs/evidence/disk-stage1-20261107/du-system-depth1.stdout.txt
docs/evidence/disk-stage1-20261107/external-info.plist
docs/evidence/disk-stage1-20261107/methodology-sources.json
docs/evidence/disk-stage1-20261107/open-unlinked-inodes.stderr.txt
docs/evidence/disk-stage1-20261107/open-unlinked-inodes.stdout.txt
docs/evidence/disk-stage1-20261107/open-unlinked-summary.json
docs/evidence/disk-stage1-20261107/open-unlinked.stderr.txt
docs/evidence/disk-stage1-20261107/open-unlinked.stdout.txt
docs/evidence/disk-stage1-20261107/path-aliases.json
docs/evidence/disk-stage1-20261107/permission-index.json
docs/evidence/disk-stage1-20261107/physical-capability.json
docs/evidence/disk-stage1-20261107/physical-duplicate-archives.json
docs/evidence/disk-stage1-20261107/physical-initial.json
docs/evidence/disk-stage1-20261107/physical-paths-initial.json
docs/evidence/disk-stage1-20261107/physical-tmp-leaf-paths.json
docs/evidence/disk-stage1-20261107/physical-tmp-leaves.json
docs/evidence/disk-stage1-20261107/physical-workspace-additional.json
docs/evidence/disk-stage1-20261107/physical-workspace.json
docs/evidence/disk-stage1-20261107/physical_inventory.py
docs/evidence/disk-stage1-20261107/physical_probe.py
docs/evidence/disk-stage1-20261107/preflight.json
docs/evidence/disk-stage1-20261107/preservation/PRESERVATION-FINDINGS.md
docs/evidence/disk-stage1-20261107/preservation/archive-receipt-metadata.json
docs/evidence/disk-stage1-20261107/preservation/campaign-archive-chain.json
docs/evidence/disk-stage1-20261107/preservation/growth-metadata.json
docs/evidence/disk-stage1-20261107/preservation/observations.json
docs/evidence/disk-stage1-20261107/preservation/producer-process-paths.json
docs/evidence/disk-stage1-20261107/preservation/supplemental.json
docs/evidence/disk-stage1-20261107/snapshots-data.stderr.txt
docs/evidence/disk-stage1-20261107/snapshots-data.stdout.txt
docs/evidence/disk-stage1-20261107/snapshots-root.stderr.txt
docs/evidence/disk-stage1-20261107/snapshots-root.stdout.txt
docs/evidence/disk-stage1-20261107/space-commands.json
docs/evidence/disk-stage1-20261107/space-ledger.json
docs/evidence/disk-stage1-20261107/supplemental-commands.json
docs/evidence/disk-stage1-20261107/tm-local.stderr.txt
docs/evidence/disk-stage1-20261107/tm-local.stdout.txt
docs/evidence/disk-stage1-20261107/tmp/REPORT.md
docs/evidence/disk-stage1-20261107/tmp/archive-duplicate-hashes.json
docs/evidence/disk-stage1-20261107/tmp/candidate-subtrees-du.json
docs/evidence/disk-stage1-20261107/tmp/candidate-summary.json
docs/evidence/disk-stage1-20261107/tmp/candidates-metadata.json
docs/evidence/disk-stage1-20261107/tmp/dependency-symlink-readback.json
docs/evidence/disk-stage1-20261107/tmp/document-refs.json
docs/evidence/disk-stage1-20261107/tmp/du-tmp.json
docs/evidence/disk-stage1-20261107/tmp/git-and-cross-repo-refs.json
docs/evidence/disk-stage1-20261107/tmp/hardlink-accounting.json
docs/evidence/disk-stage1-20261107/tmp/last-output-metadata.json
docs/evidence/disk-stage1-20261107/tmp/live-refs.json
docs/evidence/disk-stage1-20261107/tmp/pr-readbacks.json
docs/evidence/disk-stage1-20261107/tmp/registry-refs.json
docs/evidence/disk-stage1-20261107/tmp/scheduler-refs.json
docs/evidence/disk-stage1-20261107/tmp/selected-provenance.json
docs/evidence/disk-stage1-20261107/workspace/.zcode-worktrees-du.json
docs/evidence/disk-stage1-20261107/workspace/WORKSPACE-AUDIT.md
docs/evidence/disk-stage1-20261107/workspace/a76-mandate-build-references.json
docs/evidence/disk-stage1-20261107/workspace/ac810-evidence-du.json
docs/evidence/disk-stage1-20261107/workspace/ac810-workblock-du.json
docs/evidence/disk-stage1-20261107/workspace/additional-candidate-du.json
docs/evidence/disk-stage1-20261107/workspace/additional-candidate-open-files.json
docs/evidence/disk-stage1-20261107/workspace/additional-candidate-paths.json
docs/evidence/disk-stage1-20261107/workspace/additional-candidate-references.json
docs/evidence/disk-stage1-20261107/workspace/all-candidate-sizes.json
docs/evidence/disk-stage1-20261107/workspace/artifacts-du.json
docs/evidence/disk-stage1-20261107/workspace/build-ranking-scope-initial.json
docs/evidence/disk-stage1-20261107/workspace/build-targets.json
docs/evidence/disk-stage1-20261107/workspace/candidate-binary-bindings.json
docs/evidence/disk-stage1-20261107/workspace/candidate-creation-receipts.json
docs/evidence/disk-stage1-20261107/workspace/candidate-detail-du.json
docs/evidence/disk-stage1-20261107/workspace/candidate-document-references.json
docs/evidence/disk-stage1-20261107/workspace/candidate-du.json
docs/evidence/disk-stage1-20261107/workspace/candidate-git.json
docs/evidence/disk-stage1-20261107/workspace/candidate-metadata.json
docs/evidence/disk-stage1-20261107/workspace/candidate-open-files.json
docs/evidence/disk-stage1-20261107/workspace/candidate-paths.json
docs/evidence/disk-stage1-20261107/workspace/candidate-reference-matrix.json
docs/evidence/disk-stage1-20261107/workspace/core-worktrees-du.json
docs/evidence/disk-stage1-20261107/workspace/coverage-and-exclusions.json
docs/evidence/disk-stage1-20261107/workspace/deployment-artifacts-du.json
docs/evidence/disk-stage1-20261107/workspace/deployment-worktrees-du.json
docs/evidence/disk-stage1-20261107/workspace/goal-svc-workflow-zero-ops-001-du.json
docs/evidence/disk-stage1-20261107/workspace/lsof-cwd.json
docs/evidence/disk-stage1-20261107/workspace/other-worktree-registry.json
docs/evidence/disk-stage1-20261107/workspace/processes.json
docs/evidence/disk-stage1-20261107/workspace/schedule-references.json
docs/evidence/disk-stage1-20261107/workspace/svc-pr-readback.json
docs/evidence/disk-stage1-20261107/workspace/workflow-unattended-mechanisms-20261027-du.json
docs/evidence/disk-stage1-20261107/workspace/workspace-du.json
docs/evidence/disk-stage1-20261107/workspace/worktrees-du.json
docs/evidence/disk-stage1-20261107/workspace/worktrees.json
docs/evidence/disk-stage1-20261107/workspace/zcode-svc-du.json
docs/evidence/disk-stage1-20261107/workspace/zcode-svc-git.json
docs/evidence/disk-stage1-20261107/workspace/zcode-worktrees-du.json
docs/evidence/ekr-b1b4/focused.raw.txt
docs/evidence/ekr-b1b4/governance.raw.txt
docs/evidence/ekr-b1b4/implementation.patch
docs/evidence/ekr-b1b4/structure.raw.txt
docs/evidence/ekr-b1b4/workflow-regression.raw.txt
docs/evidence/ekr-b3-r2/fault-injection.coordinates.json
docs/evidence/ekr-b3-r2/fault-injection.raw.txt
docs/evidence/ekr-b3-r2/fixture.diff
docs/evidence/ekr-b3-r2/historical-evidence-hash-verification.json
docs/evidence/ekr-b3-r2/independent-review.raw.txt
docs/evidence/ekr-b3-r2/independent-review.txt
docs/evidence/ekr-b3-r2/product-identity-and-evidence-reuse.json
docs/evidence/ekr-b3-r2/structure.coordinates.json
docs/evidence/ekr-b3-r2/structure.raw.txt
docs/evidence/ekr-b3-r2/working-diff-check.raw.txt
docs/evidence/ekr-b3/SHA256SUMS
docs/evidence/ekr-b3/candidate.diff
docs/evidence/ekr-b3/diff-checks.raw.txt
docs/evidence/ekr-b3/fault-injection.raw.txt
docs/evidence/ekr-b3/independent-review.raw.txt
docs/evidence/ekr-b3/independent-review.txt
docs/evidence/ekr-b3/review-protocol.raw.txt
docs/evidence/ekr-b3/scheduler-router.raw.txt
docs/evidence/ekr-b3/scheduler.raw.txt
docs/evidence/ekr-b3/structure.raw.txt
docs/evidence/ekr-b3/workflow.raw.txt
docs/evidence/ekr-p0a/candidate-staged.patch
docs/evidence/ekr-p0a/candidate-state.json
docs/evidence/ekr-p0a/changed-lines.raw.txt
docs/evidence/ekr-p0a/diff-status.raw.txt
docs/evidence/ekr-p0a/precommit-diff.raw.txt
docs/evidence/ekr-p1b/baseline-five.raw.txt
docs/evidence/ekr-p1b/cached-diff-check.command.json
docs/evidence/ekr-p1b/cached-diff-check.raw.txt
docs/evidence/ekr-p1b/candidate-diff-check.command.json
docs/evidence/ekr-p1b/candidate-diff-check.raw.txt
docs/evidence/ekr-p1b/candidate-diff-stat.command.json
docs/evidence/ekr-p1b/candidate-diff-stat.raw.txt
docs/evidence/ekr-p1b/commands.json
docs/evidence/ekr-p1b/delivery-diff-stat.raw.txt
docs/evidence/ekr-p1b/environment.json
docs/evidence/ekr-p1b/evidence-hashes.json
docs/evidence/ekr-p1b/final-cached-diff-check.command.json
docs/evidence/ekr-p1b/final-cached-diff-check.raw.txt
docs/evidence/ekr-p1b/final-working-diff-check.command.json
docs/evidence/ekr-p1b/final-working-diff-check.raw.txt
docs/evidence/ekr-p1b/focused.raw.txt
docs/evidence/ekr-p1b/gh-final.command.json
docs/evidence/ekr-p1b/gh-final.raw.txt
docs/evidence/ekr-p1b/governance.command.json
docs/evidence/ekr-p1b/governance.raw.txt
docs/evidence/ekr-p1b/independent-review.md
docs/evidence/ekr-p1b/pr-body.md
docs/evidence/ekr-p1b/pr-title.txt
docs/evidence/ekr-p1b/preflight.json
docs/evidence/ekr-p1b/remote-main-final.json
docs/evidence/ekr-p1b/source-scope.command.json
docs/evidence/ekr-p1b/source-scope.raw.txt
docs/evidence/ekr-p1b/structure.command.json
docs/evidence/ekr-p1b/structure.raw.txt
docs/evidence/ekr-p1b/working-diff-check.command.json
docs/evidence/ekr-p1b/working-diff-check.raw.txt
docs/evidence/ekr-preflight/DEFECT-MATRIX.md
docs/evidence/ekr-preflight/G2-G4-R3.md
docs/evidence/ekr-preflight/G6-G7-R3.md
docs/evidence/ekr-preflight/G8-R3.md
docs/evidence/ekr-preflight/RECEIPT-EKR-PRE-R3.md
docs/evidence/ekr-preflight/RECEIPT-EKR-PRE.md
docs/evidence/ekr-preflight/REVIEW-G6-G8-R3.md
docs/evidence/ekr-preflight/REVIEW-R3.md
docs/evidence/ekr-preflight/b4-harness.before.py.txt
docs/evidence/ekr-preflight/b4-harness.diff
docs/evidence/ekr-preflight/b4-harness.py
docs/evidence/ekr-preflight/g2-g4-harness.py
docs/evidence/ekr-preflight/g2-g4.raw.txt
docs/evidence/ekr-preflight/g5-b4.raw.txt
docs/evidence/ekr-preflight/g6-g7-harness.py
docs/evidence/ekr-preflight/g6-g7.raw.txt
docs/evidence/ekr-preflight/g8-harness.py
docs/evidence/ekr-preflight/g8.raw.txt
docs/evidence/ekr-preflight/r3-artifact-hashes.json
docs/evidence/ekr-preflight/r3-checks.json
docs/evidence/ekr-preflight/r3-coordinates.json
docs/evidence/ekr-preflight/r3-pr-created.json
docs/evidence/ekr-preflight/r3-structure.raw.json
docs/evidence/fleet-window-settle-20261104/SHA256.json
docs/evidence/fleet-window-settle-20261104/executor-selftest.stdout.log
docs/evidence/fleet-window-settle-20261104/fixture-report.json
docs/evidence/fleet-window-settle-20261104/implementation.patch
docs/evidence/fleet-window-settle-20261104/independent-review.md
docs/evidence/fleet-window-settle-20261104/structure-command.json
docs/evidence/fleet-window-settle-20261104/structure.stdout.json
docs/evidence/fleet-window-settle-20261104/synthetic-fixtures.tar.gz
docs/evidence/fleet-window-settle-20261104/synthetic-test.stdout.log
docs/evidence/fleet-window-settle-20261104/verification-commands.json
docs/evidence/guard-integration-523-20261104/MANIFEST.sha256
docs/evidence/guard-integration-523-20261104/agent-router.tap
docs/evidence/guard-integration-523-20261104/checks.json
docs/evidence/guard-integration-523-20261104/dependency-side-effect.json
docs/evidence/guard-integration-523-20261104/failure-extract.json
docs/evidence/guard-integration-523-20261104/guard.tap
docs/evidence/guard-integration-523-20261104/independent-review.json
docs/evidence/guard-integration-523-20261104/readback.json
docs/evidence/guard-integration-523-r2-20261104/MANIFEST.sha256
docs/evidence/guard-integration-523-r2-20261104/baseline-agent-router.tap
docs/evidence/guard-integration-523-r2-20261104/baseline-check.json
docs/evidence/guard-integration-523-r2-20261104/baseline-results.json
docs/evidence/guard-integration-523-r2-20261104/compare-tap.py
docs/evidence/guard-integration-523-r2-20261104/comparison.json
docs/evidence/guard-integration-523-r2-20261104/dependency-and-links.posttest.json
docs/evidence/guard-integration-523-r2-20261104/dependency-and-links.pretest.json
docs/evidence/guard-integration-523-r2-20261104/dependency-comparison.pretest.json
docs/evidence/guard-integration-523-r2-20261104/failure-table.md
docs/evidence/guard-integration-523-r2-20261104/independent-review.json
docs/evidence/guard-integration-523-r2-20261104/install.json
docs/evidence/guard-integration-523-r2-20261104/integration-only-failures.raw.txt
docs/evidence/guard-integration-523-r2-20261104/integration-results.json
docs/evidence/guard-integration-523-r2-20261104/local-readback.json
docs/evidence/guard-integration-523-r2-20261104/pnpm-install.raw.txt
docs/evidence/guard-integration-523-r3-20261104/MANIFEST.sha256
docs/evidence/guard-integration-523-r3-20261104/agent-router.json
docs/evidence/guard-integration-523-r3-20261104/agent-router.tap
docs/evidence/guard-integration-523-r3-20261104/comparison.json
docs/evidence/guard-integration-523-r3-20261104/dependency-and-links.post-focused.json
docs/evidence/guard-integration-523-r3-20261104/dependency-and-links.post-package.json
docs/evidence/guard-integration-523-r3-20261104/dependency-and-links.pre-focused.json
docs/evidence/guard-integration-523-r3-20261104/dependency-and-links.pre-package.json
docs/evidence/guard-integration-523-r3-20261104/dependency-comparison.json
docs/evidence/guard-integration-523-r3-20261104/diff-check.raw.txt
docs/evidence/guard-integration-523-r3-20261104/disposition.diff
docs/evidence/guard-integration-523-r3-20261104/final-results.json
docs/evidence/guard-integration-523-r3-20261104/focused-1.json
docs/evidence/guard-integration-523-r3-20261104/focused-1.tap
docs/evidence/guard-integration-523-r3-20261104/focused-2.json
docs/evidence/guard-integration-523-r3-20261104/focused-2.tap
docs/evidence/guard-integration-523-r3-20261104/focused-3.json
docs/evidence/guard-integration-523-r3-20261104/focused-3.tap
docs/evidence/guard-integration-523-r3-20261104/focused-4.json
docs/evidence/guard-integration-523-r3-20261104/focused-4.tap
docs/evidence/guard-integration-523-r3-20261104/focused-5.json
docs/evidence/guard-integration-523-r3-20261104/focused-5.tap
docs/evidence/guard-integration-523-r3-20261104/focused-6.json
docs/evidence/guard-integration-523-r3-20261104/focused-6.tap
docs/evidence/guard-integration-523-r3-20261104/focused-7.json
docs/evidence/guard-integration-523-r3-20261104/focused-7.tap
docs/evidence/guard-integration-523-r3-20261104/gates.json
docs/evidence/guard-integration-523-r3-20261104/governance.raw.txt
docs/evidence/guard-integration-523-r3-20261104/guard-results.json
docs/evidence/guard-integration-523-r3-20261104/guard.json
docs/evidence/guard-integration-523-r3-20261104/guard.tap
docs/evidence/guard-integration-523-r3-20261104/independent-review.json
docs/evidence/guard-integration-523-r3-20261104/install.json
docs/evidence/guard-integration-523-r3-20261104/pnpm-install.raw.txt
docs/evidence/guard-integration-523-r3-20261104/pre-publication-readback.json
docs/evidence/guard-integration-523-r3-20261104/publication-readback.json
docs/evidence/guard-integration-523-r3-20261104/publication.json
docs/evidence/guard-integration-523-r3-20261104/raw-evidence-whitespace.json
docs/evidence/guard-integration-523-r3-20261104/rerun-harness.source.txt
docs/evidence/guard-integration-523-r3-20261104/source-and-base-readback.json
docs/evidence/guard-integration-523-r3-20261104/source-manual-doc-diff.json
docs/evidence/guard-integration-523-r3-20261104/source-manual-doc-diff.raw.txt
docs/evidence/guard-integration-523-r3-20261104/structure.raw.txt
docs/evidence/h1370-impl-baseline-20261108/baseline-route.log
docs/evidence/h1370-impl-baseline-20261108/coordinates.json
docs/evidence/h1370-impl-baseline-20261108/install.log
docs/evidence/h1370-impl-baseline-20261108/v2/baseline-route.log
docs/evidence/h1370-impl-baseline-20261108/v2/coordinates.json
docs/evidence/h1370-impl-baseline-20261108/v2/install-result.json
docs/evidence/h1370-impl-baseline-20261108/v2/install.log
docs/evidence/h1370-impl-baseline-20261108/v2/pairing-readback.log
docs/evidence/h1370-impl-baseline-20261108/v3/baseline-route.log
docs/evidence/h1370-impl-baseline-20261108/v3/coordinates.json
docs/evidence/h1370-impl-baseline-20261108/v3/diff-check-result.json
docs/evidence/h1370-impl-baseline-20261108/v3/diff-check.log
docs/evidence/h1370-impl-baseline-20261108/v3/environment-receipt.json
docs/evidence/h1370-impl-baseline-20261108/v3/evidence-manifest.json
docs/evidence/h1370-impl-baseline-20261108/v3/final-regression-result.json
docs/evidence/h1370-impl-baseline-20261108/v3/final-regression.log
docs/evidence/h1370-impl-baseline-20261108/v3/generation-tests-result.json
docs/evidence/h1370-impl-baseline-20261108/v3/generation-tests.log
docs/evidence/h1370-impl-baseline-20261108/v3/governance-result.json
docs/evidence/h1370-impl-baseline-20261108/v3/governance.log
docs/evidence/h1370-impl-baseline-20261108/v3/independent-recheck-result.json
docs/evidence/h1370-impl-baseline-20261108/v3/independent-recheck.log
docs/evidence/h1370-impl-baseline-20261108/v3/independent-review.md
docs/evidence/h1370-impl-baseline-20261108/v3/paired-regression-result.json
docs/evidence/h1370-impl-baseline-20261108/v3/paired-regression.log
docs/evidence/h1370-impl-baseline-20261108/v3/prior-STOPPED-1370-IMPL.md
docs/evidence/h1370-impl-baseline-20261108/v3/provisioning-canonical-checkout-result.json
docs/evidence/h1370-impl-baseline-20261108/v3/provisioning-canonical-checkout.log
docs/evidence/h1370-impl-baseline-20261108/v3/proxy-free-regression-result.json
docs/evidence/h1370-impl-baseline-20261108/v3/proxy-free-regression.log
docs/evidence/h1370-impl-baseline-20261108/v3/regression-result.json
docs/evidence/h1370-impl-baseline-20261108/v3/regression.log
docs/evidence/h1370-impl-baseline-20261108/v3/review-before-harness.log
docs/evidence/h1370-impl-baseline-20261108/v3/route-loader-default-generation-result.json
docs/evidence/h1370-impl-baseline-20261108/v3/route-loader-default-generation.log
docs/evidence/h1370-impl-baseline-20261108/v3/structure-metrics.json
docs/evidence/h1370-impl-baseline-20261108/v3/structure-runner-result.json
docs/evidence/h1370-impl-baseline-20261108/v3/structure-runner.log
docs/evidence/h1370-impl-baseline-20261108/v3/verification-install-result.json
docs/evidence/h1370-impl-baseline-20261108/v3/verification-install.log
docs/evidence/h547-store-diag/.gitignore
docs/evidence/h547-store-diag/README.md
docs/evidence/h547-store-diag/candidate-audit-v3.md
docs/evidence/h547-store-diag/capture-preflight-v5.stdout.txt
docs/evidence/h547-store-diag/capture-receipt.json
docs/evidence/h547-store-diag/capture-v2-receipt.json
docs/evidence/h547-store-diag/capture-v2.py
docs/evidence/h547-store-diag/capture-v3-receipt.json
docs/evidence/h547-store-diag/capture-v3.py
docs/evidence/h547-store-diag/capture-v5.stdout.txt
docs/evidence/h547-store-diag/capture.py
docs/evidence/h547-store-diag/delivery-transition-v5.json
docs/evidence/h547-store-diag/harness-correction-v5.json
docs/evidence/h547-store-diag/independent-review-v2.md
docs/evidence/h547-store-diag/independent-review-v3.md
docs/evidence/h547-store-diag/independent-review-v4.md
docs/evidence/h547-store-diag/independent-review-v5.md
docs/evidence/h547-store-diag/independent-review.md
docs/evidence/h547-store-diag/packaging-validation-v3.json
docs/evidence/h547-store-diag/packaging-validation-v4.json
docs/evidence/h547-store-diag/packaging-validation-v5.json
docs/evidence/h547-store-diag/partial-copy-manifest.json
docs/evidence/h547-store-diag/path-selfcheck-v5.json
docs/evidence/h547-store-diag/postrun-v5.json
docs/evidence/h547-store-diag/predicates-v5.mjs
docs/evidence/h547-store-diag/predicates-v5.stderr.txt
docs/evidence/h547-store-diag/predicates-v5.stdout.txt
docs/evidence/h547-store-diag/qa-run-v5-attempt1-receipt.json
docs/evidence/h547-store-diag/qa-run-v5-attempt2-receipt.json
docs/evidence/h547-store-diag/qa-run-v5-receipt.json
docs/evidence/h547-store-diag/qa-v5-attempt1.mjs
docs/evidence/h547-store-diag/qa-v5-attempt1.stderr.txt
docs/evidence/h547-store-diag/qa-v5-attempt1.stdout.json
docs/evidence/h547-store-diag/qa-v5-attempt2.mjs
docs/evidence/h547-store-diag/qa-v5-attempt2.stderr.txt
docs/evidence/h547-store-diag/qa-v5-attempt2.stdout.json
docs/evidence/h547-store-diag/qa-v5.mjs
docs/evidence/h547-store-diag/qa-v5.stderr.txt
docs/evidence/h547-store-diag/qa-v5.stdout.json
docs/evidence/h547-store-diag/reader-manifest-v5.json
docs/evidence/h547-store-diag/sandbox-probe-v5.stderr.txt
docs/evidence/h547-store-diag/sandbox-probe-v5.stdout.txt
docs/evidence/h547-store-diag/sandbox-v5.sb
docs/evidence/h547-store-diag/scope-validation-v2.json
docs/evidence/h547-store-diag/stop-v3-receipt.json
docs/evidence/h547-store-diag/stop-v4-receipt.json
docs/evidence/h547-store-diag/stop-validation.json
docs/evidence/h547-store-diag/validate-v2-evidence.py
docs/evidence/issue-637/BASELINE-scheduler.txt
docs/evidence/issue-637/R2-BASELINE-scheduler.txt
docs/evidence/issue-637/R2-GREEN-normal-terminal.txt
docs/evidence/issue-637/R2-RED-normal-terminal.txt
docs/evidence/recovery-governance-1257-20261107/focused.coordinates.json
docs/evidence/recovery-governance-1257-20261107/focused.raw.txt
docs/evidence/recovery-governance-1257-20261107/regression.coordinates.json
docs/evidence/recovery-governance-1257-20261107/regression.raw.txt
docs/evidence/succession-order/643-owner-comment.json
docs/evidence/succession-order/owner-ruling.json
docs/evidence/succession-order/pr-snapshot.json
docs/evidence/succession-order/r2/SHA256SUMS
docs/evidence/succession-order/r2/checks.json
docs/evidence/succession-order/r2/delivery-checks.json
docs/evidence/succession-order/r2/independent-review.md
docs/evidence/succession-order/r2/owner-rulings.json
docs/evidence/succession-order/r2/pr-snapshot.json
docs/evidence/succession-order/r2/svc-authority.json
docs/evidence/succession-order/r2/svc-companion-comparison.json
docs/evidence/succession-order/svc-authority.json
docs/reports/642-phase2-20261107/C-proposal.command.json
docs/reports/642-phase2-20261107/C-proposal.stderr
docs/reports/642-phase2-20261107/C-proposal.stdout
docs/reports/642-phase2-20261107/R2-evidence-diff-check.command.json
docs/reports/642-phase2-20261107/R2-evidence-diff-check.stderr
docs/reports/642-phase2-20261107/R2-evidence-diff-check.stdout
docs/reports/642-phase2-20261107/R2-resumption.json
docs/reports/642-phase2-20261107/adoption-base.json
docs/reports/642-phase2-20261107/adoption-candidate.json
docs/reports/642-phase2-20261107/adoption-export-provenance.json
docs/reports/642-phase2-20261107/adoption-transition.command.json
docs/reports/642-phase2-20261107/adoption-transition.stderr
docs/reports/642-phase2-20261107/adoption-transition.stdout
docs/reports/642-phase2-20261107/atomic-lifecycle.diff
docs/reports/642-phase2-20261107/coordinates.json
docs/reports/642-phase2-20261107/diff-check.command.json
docs/reports/642-phase2-20261107/diff-check.stderr
docs/reports/642-phase2-20261107/diff-check.stdout
docs/reports/642-phase2-20261107/distribution-manifest.json
docs/reports/642-phase2-20261107/governance-accepted.command.json
docs/reports/642-phase2-20261107/governance-accepted.stderr
docs/reports/642-phase2-20261107/governance-accepted.stdout
docs/reports/642-phase2-20261107/manifest-parity.json
docs/reports/642-phase2-20261107/owner-comment-6701500077.json
docs/reports/642-phase2-20261107/phase2-native.command.json
docs/reports/642-phase2-20261107/phase2-native.stderr
docs/reports/642-phase2-20261107/phase2-native.stdout
docs/reports/642-phase2-20261107/preservation.json
docs/reports/642-phase2-20261107/structure-tool-increment.command.json
docs/reports/642-phase2-20261107/structure-tool-increment.stderr
docs/reports/642-phase2-20261107/structure-tool-increment.stdout
docs/reports/business-recon-20261108-evidence.json
docs/reports/c7-selftest-20261104/INDEPENDENT-REVIEW.md
docs/reports/c7-selftest-20261104/PR-CREATION.json
docs/reports/c7-selftest-20261104/SHA256SUMS.txt
docs/reports/c7-selftest-20261104/SOURCE.diff
docs/reports/c7-selftest-20261104/c7-focused.json
docs/reports/c7-selftest-20261104/c7_extraction_smoke.json
docs/reports/c7-selftest-20261104/canary-child.stderr.log
docs/reports/c7-selftest-20261104/canary-child.stdout.log
docs/reports/c7-selftest-20261104/canary-recorder.command.json
docs/reports/c7-selftest-20261104/canary-recorder.mjs.txt
docs/reports/c7-selftest-20261104/canary-recorder.stderr.log
docs/reports/c7-selftest-20261104/canary-recorder.stdout.log
docs/reports/c7-selftest-20261104/canary-result.json
docs/reports/c7-selftest-20261104/canary-spawn.json
docs/reports/c7-selftest-20261104/extracted-helper-phase.command.json
docs/reports/c7-selftest-20261104/extracted-helper-phase.stderr.log
docs/reports/c7-selftest-20261104/extracted-helper-phase.stdout.log
docs/reports/c7-selftest-20261104/function-bindings.json
docs/reports/c7-selftest-20261104/invocation.json
docs/reports/c7-selftest-20261104/names-after.json
docs/reports/c7-selftest-20261104/names-before.json
docs/reports/c7-selftest-20261104/phase-events.jsonl
docs/reports/c7-selftest-20261104/protected-routing.command.json
docs/reports/c7-selftest-20261104/protected-routing.stderr.log
docs/reports/c7-selftest-20261104/protected-routing.stdout.log
docs/reports/c7-selftest-20261104/routing-probe.mjs.txt
docs/reports/c7-selftest-20261104/routing.json
docs/reports/c7-selftest-20261104/selftest.stdout.log
docs/reports/c7-selftest-20261104/source-bindings.json
docs/reports/c7-selftest-20261104/stage_00.json
docs/reports/c7-selftest-20261104/stage_01.json
docs/reports/c7-selftest-20261104/stage_02.json
docs/reports/c7-selftest-20261104/stage_03.json
docs/reports/c7-selftest-20261104/stage_04.json
docs/reports/c7-selftest-20261104/structure-command.json
docs/reports/c7-selftest-20261104/structure.stderr.log
docs/reports/c7-selftest-20261104/structure.stdout.json
docs/reports/c7-selftest-20261104/summary.json
docs/reports/c7-selftest-20261104/validation-diff-check.stderr.log
docs/reports/c7-selftest-20261104/validation-diff-check.stdout.log
docs/reports/c7-selftest-20261104/validation-dry-run.stderr.log
docs/reports/c7-selftest-20261104/validation-dry-run.stdout.log
docs/reports/c7-selftest-20261104/validation-gates.json
docs/reports/c7-selftest-20261104/validation-python-syntax.stderr.log
docs/reports/c7-selftest-20261104/validation-python-syntax.stdout.log
docs/reports/c7-selftest-20261104/validation-recorder-syntax.stderr.log
docs/reports/c7-selftest-20261104/validation-recorder-syntax.stdout.log
docs/reports/c7-selftest-20261104/validation-selftest.stderr.log
docs/reports/c7-selftest-20261104/validation-selftest.stdout.log
docs/reports/c7-selftest-20261104/validation-shell-syntax.stderr.log
docs/reports/c7-selftest-20261104/validation-shell-syntax.stdout.log
docs/reports/captain-auth-create-20261108/independent-review.md
docs/reports/captain-auth-create-20261108/observations.json
docs/reports/captain-auth-create-20261108/owner-ruling.json
docs/reports/captain-auth-create-20261108/validation.md
docs/reports/fleet-window-authority-v1-20261109/independent-review.md
docs/reports/fleet-window-merge-c7-20261104/INDEPENDENT-STOP-REVIEW.md
docs/reports/fleet-window-merge-c7-20261104/c7-focused.command.json
docs/reports/fleet-window-merge-c7-20261104/c7-focused.stderr.log
docs/reports/fleet-window-merge-c7-20261104/c7-focused.stdout.log
docs/reports/fleet-window-merge-c7-20261104/conflict-resolution.json
docs/reports/fleet-window-merge-c7-20261104/dry-run-candidate.command.json
docs/reports/fleet-window-merge-c7-20261104/dry-run-candidate.stderr.log
docs/reports/fleet-window-merge-c7-20261104/dry-run-candidate.stdout.log
docs/reports/fleet-window-merge-c7-20261104/dry-run-original.command.json
docs/reports/fleet-window-merge-c7-20261104/dry-run-original.stderr.log
docs/reports/fleet-window-merge-c7-20261104/dry-run-original.stdout.log
docs/reports/fleet-window-merge-c7-20261104/dry-run-stderr-diff.command.json
docs/reports/fleet-window-merge-c7-20261104/dry-run-stderr-diff.stderr.log
docs/reports/fleet-window-merge-c7-20261104/dry-run-stderr-diff.stdout.log
docs/reports/fleet-window-merge-c7-20261104/dry-run-stdout-diff.command.json
docs/reports/fleet-window-merge-c7-20261104/dry-run-stdout-diff.stderr.log
docs/reports/fleet-window-merge-c7-20261104/dry-run-stdout-diff.stdout.log
docs/reports/fleet-window-merge-c7-20261104/evidence-manifest.json
docs/reports/fleet-window-merge-c7-20261104/gates.json
docs/reports/fleet-window-merge-c7-20261104/merge-conflict.json
docs/reports/fleet-window-merge-c7-20261104/selftest.command.json
docs/reports/fleet-window-merge-c7-20261104/selftest.stderr.log
docs/reports/fleet-window-merge-c7-20261104/selftest.stdout.log
docs/reports/fleet-window-merge-c7-20261104/source-snapshot.json
docs/reports/fleet-window-merge-c7-20261104/stopped-state.json
docs/reports/fleet-window-merge-c7-20261104/synthetic.command.json
docs/reports/fleet-window-merge-c7-20261104/synthetic.stderr.log
docs/reports/fleet-window-merge-c7-20261104/synthetic.stdout.log
docs/reports/fleet-window-merge-r2-20261104/INDEPENDENT-DELTA-REVIEW.md
docs/reports/fleet-window-merge-r2-20261104/INDEPENDENT-STOP-REVIEW.md
docs/reports/fleet-window-merge-r2-20261104/c7-focused.command.json
docs/reports/fleet-window-merge-r2-20261104/c7-focused.stderr.log
docs/reports/fleet-window-merge-r2-20261104/c7-focused.stdout.log
docs/reports/fleet-window-merge-r2-20261104/cached-diff-check.command.json
docs/reports/fleet-window-merge-r2-20261104/evidence-manifest.json
docs/reports/fleet-window-merge-r2-20261104/evidence-reuse.json
docs/reports/fleet-window-merge-r2-20261104/failure-provenance.json
docs/reports/fleet-window-merge-r2-20261104/final-source-bindings.json
docs/reports/fleet-window-merge-r2-20261104/harness-before.py.txt
docs/reports/fleet-window-merge-r2-20261104/harness-only.diff
docs/reports/fleet-window-merge-r2-20261104/initial-source-bindings.json
docs/reports/fleet-window-merge-r2-20261104/initial-state.json
docs/reports/fleet-window-merge-r2-20261104/isolated-c7-evidence/c7-focused.json
docs/reports/fleet-window-merge-r2-20261104/isolated-c7-evidence/dispatcher-receipts/c7-close.json
docs/reports/fleet-window-merge-r2-20261104/isolated-c7-evidence/dispatcher-receipts/c7-delete-candidates.json
docs/reports/fleet-window-merge-r2-20261104/isolated-c7-evidence/dispatcher-receipts/c7-delete-candidates.nul
docs/reports/fleet-window-merge-r2-20261104/isolated-c7-evidence/dispatcher-receipts/c7-names-before.json
docs/reports/fleet-window-merge-r2-20261104/isolated-c7-evidence/dispatcher-receipts/completion.json
docs/reports/fleet-window-merge-r2-20261104/isolated-c7-evidence/dispatcher-receipts/mutex.json
docs/reports/fleet-window-merge-r2-20261104/isolated-c7-evidence/dispatcher-receipts/stage_11_production_verify.json
docs/reports/fleet-window-merge-r2-20261104/isolated-c7-evidence/migrated_selftest_phase.json
docs/reports/fleet-window-merge-r2-20261104/isolated-c7-evidence/names-after.json
docs/reports/fleet-window-merge-r2-20261104/isolated-c7-evidence/names-before.json
docs/reports/fleet-window-merge-r2-20261104/isolated-c7-evidence/phase-events.jsonl
docs/reports/fleet-window-merge-r2-20261104/pr-initial.json
docs/reports/fleet-window-merge-r2-20261104/pr-stopped-readback.json
docs/reports/fleet-window-merge-r2-20261104/stage-all.command.json
docs/reports/fleet-window-merge-r2-20261104/stage-all.stderr.log
docs/reports/fleet-window-merge-r2-20261104/stage-all.stdout.log
docs/reports/fleet-window-merge-r2-20261104/stage-raw-evidence.command.json
docs/reports/fleet-window-merge-r2-20261104/stopped-state.json
docs/reports/human-gate-v1-20261109/independent-review.md
docs/reports/planned-recovery-proposal-20261107/remote-source-coordinates.json
docs/reports/planned-recovery-proposal-20261107/source-observations.json
docs/reports/rc3-chain-20261107/A-receipt.json
docs/reports/rc3-chain-20261107/A-verify-governance.txt
docs/reports/rc3-chain-20261107/B-base.json
docs/reports/rc3-chain-20261107/B-candidate.json
docs/reports/rc3-chain-20261107/B-receipt.json
docs/reports/rc3-chain-20261107/B-transition.txt
docs/reports/rc3-chain-20261107/C-R2-native-exit-code.txt
docs/reports/rc3-chain-20261107/C-R2-native-result.json
docs/reports/rc3-chain-20261107/C-R2-native-stderr.txt
docs/reports/rc3-chain-20261107/C-R2-prior-gate-source.txt
docs/reports/rc3-chain-20261107/C-R2-receipt.json
docs/reports/readback-aging-acceptance-20261107/acceptance-provenance.json
docs/reports/readback-aging-acceptance-20261107/acceptance-transaction.md
docs/reports/readback-aging-acceptance-20261107/checks.json
docs/reports/readback-aging-acceptance-20261107/independent-review.md
docs/reports/readback-aging-acceptance-20261107/owner-ruling.json
docs/reports/readback-aging-acceptance-20261107/pr-transcript-comment.json
docs/reports/refusal-terminal-proposal-20261107/R2-EXECUTION.md
docs/reports/refusal-terminal-proposal-20261107/base-impact.json
docs/reports/refusal-terminal-proposal-20261107/check_documents.py
docs/reports/refusal-terminal-proposal-20261107/checker-review.md
docs/reports/refusal-terminal-proposal-20261107/current-aging-frontmatter.txt
docs/reports/refusal-terminal-proposal-20261107/documents.command.json
docs/reports/refusal-terminal-proposal-20261107/documents.stderr.txt
docs/reports/refusal-terminal-proposal-20261107/documents.stdout.txt
docs/reports/refusal-terminal-proposal-20261107/governance.command.json
docs/reports/refusal-terminal-proposal-20261107/governance.stderr.txt
docs/reports/refusal-terminal-proposal-20261107/governance.stdout.txt
docs/reports/refusal-terminal-proposal-20261107/independent-review.md
docs/reports/refusal-terminal-proposal-20261107/main-movement.raw.txt
docs/reports/refusal-terminal-proposal-20261107/precommit-documents.command.json
docs/reports/refusal-terminal-proposal-20261107/precommit-documents.stderr.txt
docs/reports/refusal-terminal-proposal-20261107/precommit-documents.stdout.txt
docs/reports/refusal-terminal-proposal-20261107/precommit-stage.command.json
docs/reports/refusal-terminal-proposal-20261107/precommit-stage.stderr.txt
docs/reports/refusal-terminal-proposal-20261107/precommit-stage.stdout.txt
docs/reports/refusal-terminal-proposal-20261107/precommit-whitespace.command.json
docs/reports/refusal-terminal-proposal-20261107/precommit-whitespace.stderr.txt
docs/reports/refusal-terminal-proposal-20261107/precommit-whitespace.stdout.txt
docs/reports/refusal-terminal-proposal-20261107/source-provenance.json
docs/reports/refusal-terminal-proposal-20261107/whitespace.command.json
docs/reports/refusal-terminal-proposal-20261107/whitespace.stderr.txt
docs/reports/refusal-terminal-proposal-20261107/whitespace.stdout.txt
docs/reports/rth-core-successor/independent-review.md
docs/reports/rth-core-successor/svc-authority-readback.md
docs/reports/semantic-delta-consolidation-20261107/BRIEF-1377-MINIMPL.md
docs/reports/semantic-delta-consolidation-20261107/BRIEF-SEMANTIC-DELTA-CONSOLIDATION.md
docs/reports/semantic-delta-consolidation-20261107/STOPPED-1377-MINIMPL.md
docs/reports/semantic-delta-consolidation-20261107/paired-source-observations.json
docs/reports/semantic-delta-consolidation-20261107/source-provenance.json
docs/reports/sra-v1-draft-20261107/BRIEF-SRA-V1-DRAFT.source.md
docs/reports/sra-v1-draft-20261107/EXECUTION-MANDATE-W7-DRAFT.source.md
docs/reports/sra-v1-draft-20261107/checks-initial.json
docs/reports/sra-v1-draft-20261107/independent-review.md
docs/reports/sra-v1-draft-20261107/owner-selected-records.json
docs/reports/sra-v1-draft-20261107/remote-read-r2.json
docs/reports/sra-v1-draft-20261107/source-provenance.json
docs/reports/sra-v1-formalization-20261107/acceptance-transaction.md
docs/reports/sra-v1-formalization-20261107/conversion-checks.json
docs/reports/sra-v1-formalization-20261107/conversion-receipt.md
docs/reports/sra-v1-formalization-20261107/independent-review.md
docs/reports/sra-v1-formalization-20261107/owner-formalization-ruling.json
docs/reports/sra-v1-formalization-20261107/remote-preflight.json
docs/reports/standing-delegation-formal-20261107/acceptance-chain.jsonl
docs/reports/standing-delegation-formal-20261107/acceptance-transaction.md
docs/reports/standing-delegation-formal-20261107/accepted-checks.json
docs/reports/standing-delegation-formal-20261107/authoring-chain.jsonl
docs/reports/standing-delegation-formal-20261107/control-bindings.md
docs/reports/standing-delegation-formal-20261107/conversion-receipt.md
docs/reports/standing-delegation-formal-20261107/delivery-through-pr-create.jsonl
docs/reports/standing-delegation-formal-20261107/independent-review.md
docs/reports/standing-delegation-formal-20261107/owner-ruling.json
docs/reports/standing-delegation-formal-20261107/pre-acceptance-chain.jsonl
docs/reports/standing-delegation-formal-20261107/proposed-checks.json
docs/reports/standing-delegation-formal-20261107/r2/final-head-delta.py
docs/reports/standing-delegation-formal-20261107/r2/independent-audit.jsonl
docs/reports/standing-delegation-formal-20261107/r2/independent-review.md
docs/reports/standing-delegation-formal-20261107/r2/pre-commit-chain.jsonl
docs/reports/standing-delegation-formal-20261107/source-provenance.json
docs/reports/standing-delegation-formal-20261107/verification-source.txt
docs/reports/succession-r4-step2/acceptance-transaction.md
docs/reports/succession-r4-step3/acceptance-transaction.md
docs/reports/succession-r4-step4/acceptance-transaction.md
docs/runbooks/turn-recovery-offline.md
docs/specs/AGENT_CORE_AGENT_SESSION_MESSAGING_V1.md
docs/specs/AGENT_CORE_AGENT_SESSION_MESSAGING_V2.md
docs/specs/AGENT_CORE_FLEET_WINDOW_AUTHORITY_VALIDATION_V1.md
docs/specs/AGENT_CORE_READBACK_AGING_HANDOFF_V1.md
docs/specs/AGENT_CORE_REFUSAL_TERMINAL_HANDOFF_V1.md
docs/specs/AGENT_CORE_ROUTING_CONFIG_GENERATION_POLICY_V1.md
docs/specs/AGENT_CORE_STANDING_OPERATIONAL_DELEGATION_V1.md
docs/specs/AGENT_CORE_STANDING_RELEASE_AUTHORIZATION_V1.md
docs/specs/AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V3.md
docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V3.md
docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V4.md
docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V5.md
docs/specs/AGENT_CORE_WORKFLOW_HUMAN_GATE_PROTOCOL_V1.md
docs/specs/AGENT_CORE_WORKFLOW_PRE_ADMISSION_RECOVERY_V1.md
docs/specs/AGENT_CORE_WORKFLOW_PRE_ADMISSION_RECOVERY_V2.md
docs/specs/AGENT_CORE_WORKFLOW_RECOVERY_LIVENESS_V1.md
docs/specs/AGENT_CORE_WORKFLOW_STALE_REENTRY_V2.md
docs/specs/AGENT_DELIVERY_RESILIENCE_D009_ALIGNMENT_V1.md
docs/specs/AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V3.md
docs/specs/CODE_STRUCTURE_GUARDRAILS_V3_TRANSITION_EXCEPTION_V1.md
docs/specs/PRODUCTION_442_OPTIONAL_ADAPTER_EFFECT_BOUNDARY_V2.md
docs/specs/README.md
docs/specs/SCHEDULER_PROMPT_RECEIPT_DEADLINE_V1.md
evidence/547-d-release-prep/independent-stop-review.md
evidence/547-d-release-prep/stop-receipt.json
evidence/547-d-release-prep/v2/.gitignore
evidence/547-d-release-prep/v2/authority-impact.json
evidence/547-d-release-prep/v2/base-selected-source-manifest.json
evidence/547-d-release-prep/v2/build-attempt1-stopped.json
evidence/547-d-release-prep/v2/build-composite-attempt1.py
evidence/547-d-release-prep/v2/build-composite.py
evidence/547-d-release-prep/v2/build-harness-correction.json
evidence/547-d-release-prep/v2/candidate-delta.json
evidence/547-d-release-prep/v2/candidate-manifest.json.gz
evidence/547-d-release-prep/v2/candidate-pin.json
evidence/547-d-release-prep/v2/candidate-symlinks.json
evidence/547-d-release-prep/v2/collect-preflight-before-selection-correction.py
evidence/547-d-release-prep/v2/collect-preflight.py
evidence/547-d-release-prep/v2/delivery-validation.json
evidence/547-d-release-prep/v2/explained-discovery-errors.json
evidence/547-d-release-prep/v2/foundation-source-check.initial-selection.json
evidence/547-d-release-prep/v2/foundation-source-check.json
evidence/547-d-release-prep/v2/harness-manifest.json.gz
evidence/547-d-release-prep/v2/independent-review-v2.md
evidence/547-d-release-prep/v2/node-runtime-manifest.json.gz
evidence/547-d-release-prep/v2/observed-pack.json
evidence/547-d-release-prep/v2/path-selfcheck.json
evidence/547-d-release-prep/v2/qa-basis.json
evidence/547-d-release-prep/v2/reconstructed-foundation-manifest.json.gz
evidence/547-d-release-prep/v2/requested-selected-source-manifest.json
evidence/547-d-release-prep/v2/rollback-inventory.json
evidence/547-d-release-prep/v2/scheduler-context.diff
evidence/547-d-release-prep/v2/scheduler-context.original.diff.gz
evidence/547-d-release-prep/v2/six-file-lineage.json
evidence/547-d-release-prep/v2/source-scope-check.json
evidence/547-d-release-prep/v2/source-selection-correction.json
examples/code-structure/verify-code-structure-retirement.test.mjs
examples/code-structure/verify-code-structure-test-support.mjs
examples/code-structure/verify-code-structure-transition.test.mjs
node_modules
packages/agent-router/src/binding-resolution.js
packages/agent-router/src/deadline-config.js
packages/agent-router/src/index.js
packages/agent-router/src/process/agent-process.js
packages/agent-router/src/process/scheduler-receipt.js
packages/agent-router/src/process/turn-execution.js
packages/agent-router/src/reconciliation/admin-abandonment.js
packages/agent-router/src/reconciliation/durable-file.js
packages/agent-router/src/reconciliation/operator-authorization.js
packages/agent-router/src/reconciliation/operator-candidate.js
packages/agent-router/src/reconciliation/query.js
packages/agent-router/src/reconciliation/state-machine.js
packages/agent-router/src/route-chain.js
packages/agent-router/test/process-lifecycle/timeout.test.js
packages/agent-router/test/process-lifecycle/unknown-fence-repair.test.js
packages/agent-router/test/route-chain/reconcile-batch.test.js
packages/agent-router/test/route-chain/switch-workspace-guard.test.js
packages/agent-router/test/runtime-hygiene/recovery-compat.test.js
packages/broker/test/capabilities/workflow-execution/owner-obligation-attempt.test.js
packages/development-execution/src/engine.js
packages/development-execution/test/development-retirement.test.js
packages/development-execution/test/run-retirement-gates.py
packages/production-runtime/src/compose.js
packages/production-runtime/src/development-execution-runtime.js
packages/production-runtime/src/identity/model-routing/composition.js
packages/production-runtime/src/identity/model-routing/generation.js
packages/production-runtime/src/identity/model-routing/inputs.js
packages/production-runtime/src/identity/model-routing/validator.js
packages/production-runtime/src/model-overrides.js
packages/production-runtime/src/scheduler/auto-reconcile-runtime.js
packages/production-runtime/src/scheduler/composition-runtime.js
packages/production-runtime/src/workflow-execution-runtime.js
packages/production-runtime/src/workflow/capability-runtime.js
packages/production-runtime/test/identity/model-routing/composition.test.js
packages/production-runtime/test/identity/model-routing/context.test.js
packages/production-runtime/test/identity/model-routing/generation.test.js
packages/production-runtime/test/identity/model-routing/publication.test.js
packages/production-runtime/test/identity/model-routing/support.js
packages/production-runtime/test/scheduler/scheduler-invoker-canary.test.js
packages/production-runtime/test/workflow-execution-shutdown.test.js
packages/production-runtime/test/workflow-progress-runtime.test.js
packages/scheduler-router/src/index.js
packages/scheduler-router/test/receipt-deadline.test.js
packages/scheduler/src/auto-reconcile.js
packages/scheduler/src/control.js
packages/scheduler/src/history/history.js
packages/scheduler/src/index.js
packages/scheduler/src/job-model.js
packages/scheduler/src/occurrence-model.js
packages/scheduler/src/occurrence-reservation.js
packages/scheduler/src/occurrence.js
packages/scheduler/src/seams.js
packages/scheduler/src/self-ops/diagnosis.js
packages/scheduler/src/store.js
packages/scheduler/src/store/import-openclaw.js
packages/scheduler/src/store/lock.js
packages/scheduler/src/store/store-migration.js
packages/scheduler/test/auto-reconcile.test.js
packages/scheduler/test/cross-agent.test.js
packages/scheduler/test/import.test.js
packages/scheduler/test/occurrence-model.test.js
packages/scheduler/test/self-service/enable-idempotency.test.js
packages/scheduler/test/sigkill-lock.test.js
packages/scheduler/test/watchdog/normal-terminal-restart.test.js
packages/workflow-execution/src/attempt-identity.js
packages/workflow-execution/src/engine.js
packages/workflow-execution/src/judgment.js
packages/workflow-execution/src/ledger-admission.js
packages/workflow-execution/src/ledger-events.js
packages/workflow-execution/src/ledger-plan.js
packages/workflow-execution/src/ledger-records.js
packages/workflow-execution/src/ledger.js
packages/workflow-execution/src/owner-assistance-resume-engine.js
packages/workflow-execution/src/projection.js
packages/workflow-execution/src/recovery.js
packages/workflow-execution/src/recovery/automatic-ledger.js
packages/workflow-execution/src/recovery/automatic.js
packages/workflow-execution/src/recovery/operation.js
packages/workflow-execution/src/recovery/readback-ledger.js
packages/workflow-execution/src/recovery/readback.js
packages/workflow-execution/src/recovery/refusal.js
packages/workflow-execution/src/terminal-attempt-operations.js
packages/workflow-execution/test-support/observation-identity.js
packages/workflow-execution/test/continuation.test.js
packages/workflow-execution/test/engine.test.js
packages/workflow-execution/test/execution-control.test.js
packages/workflow-execution/test/ledger.test.js
packages/workflow-execution/test/managed-obligation.test.js
packages/workflow-execution/test/observation-cas/blocked-recovery-process.js
packages/workflow-execution/test/observation-cas/blocked-recovery-restart.test.js
packages/workflow-execution/test/observation-cas/blocked-recovery.test.js
packages/workflow-execution/test/observation-cas/blocked-refusal.test.js
packages/workflow-execution/test/observation-cas/diagnostic-missing-trace.test.js
packages/workflow-execution/test/observation-cas/diagnostic-read.test.js
packages/workflow-execution/test/observation-cas/engine-races.test.js
packages/workflow-execution/test/observation-cas/fixture.js
packages/workflow-execution/test/observation-cas/ledger-identity.test.js
packages/workflow-execution/test/observation-cas/lock-timing/fixture.js
packages/workflow-execution/test/observation-cas/lock-timing/process-writers.test.js
packages/workflow-execution/test/observation-cas/lock-timing/run-gates.py
packages/workflow-execution/test/observation-cas/lock-timing/validation.test.js
packages/workflow-execution/test/observation-cas/lock-timing/writer-process.js
packages/workflow-execution/test/observation-cas/observer-process.js
packages/workflow-execution/test/observation-cas/planned-reconciliation.test.js
packages/workflow-execution/test/observation-cas/process-race.test.js
packages/workflow-execution/test/observation-cas/readback-process.js
packages/workflow-execution/test/observation-cas/readback-restart.test.js
packages/workflow-execution/test/observation-cas/readback.test.js
packages/workflow-execution/test/observation-cas/stale-guards.test.js
packages/workflow-execution/test/observation-cas/stale-reentry.test.js
packages/workflow-execution/test/owner-assistance-resume-engine.test.js
packages/workflow-execution/test/product-449-distribution-recovery.test.js
packages/workflow-execution/test/progress-checkpoint.test.js
packages/workflow-execution/test/recovery.test.js
packages/workflow-execution/test/runtime-wiring.test.js
packages/workflow-execution/test/shutdown-contract.test.js
packages/workflow-execution/test/stale-quiescence.test.js
packages/workflow-execution/test/terminal-attempt-operations.test.js
pnpm-lock.yaml
scripts/availability-recovery/compat-reader-matrix.test.mjs
scripts/availability-recovery/compat-store-facts.mjs
scripts/availability-recovery/compat-store-facts.test.mjs
scripts/availability-recovery/drain-then-restart.mjs
scripts/availability-recovery/drain-then-restart.test.mjs
scripts/availability-recovery/recovery-monitor.mjs
scripts/availability-recovery/recovery-monitor.test.mjs
scripts/availability-recovery/turn-recovery.mjs
scripts/fleet-window/ASSEMBLY-RECIPE-C5R3.md
scripts/fleet-window/C6-PREIMAGE-ANALYSIS.md
scripts/fleet-window/C7-EXTRACTION-MAP.json
scripts/fleet-window/C7-INPUTS.md
scripts/fleet-window/README.md
scripts/fleet-window/WINDOW-READINESS.md
scripts/fleet-window/anarrowed/candidate-child.mjs
scripts/fleet-window/anarrowed/candidate-oracle.mjs
scripts/fleet-window/anarrowed/candidate-oracle.test.mjs
scripts/fleet-window/anarrowed/candidate-state.mjs
scripts/fleet-window/anarrowed/candidate-state.test.mjs
scripts/fleet-window/anarrowed/rollback.test.mjs
scripts/fleet-window/assemble-runner.sh
scripts/fleet-window/authority_validation/__init__.py
scripts/fleet-window/authority_validation/checks.py
scripts/fleet-window/authority_validation/policy.py
scripts/fleet-window/authority_validation/reader.py
scripts/fleet-window/authority_validation/tests/boundary_harness.py
scripts/fleet-window/authority_validation/tests/boundary_trace.py
scripts/fleet-window/authority_validation/tests/check_error_exit.py
scripts/fleet-window/authority_validation/tests/fw_fixture.py
scripts/fleet-window/authority_validation/tests/test_fwav.py
scripts/fleet-window/authority_validation/tests/test_xattrfix_r3.py
scripts/fleet-window/precheck_zero_inflight.mjs
scripts/fleet-window/settle_unresolved_runtime_down.mjs
scripts/fleet-window/settle_unresolved_runtime_down.test.mjs
scripts/fleet-window/stage_06_v2.py
scripts/fleet-window/test_quiet_observation.py
scripts/fleet-window/window-executor-v5.sh
scripts/fleet-window/window-selftest.py
scripts/fleet-window/window_close.py
scripts/fleet-window/window_helper.py
scripts/fleet-window/window_helper_core.py
scripts/fleet-window/window_preimage_xattr.py
scripts/governance/code-structure-authority.mjs
scripts/governance/validate_v3_phase2.py
scripts/governance/validate_v3_succession.py
scripts/openclaw-job-import.mjs
scripts/scheduler-cp-admission.mjs
scripts/trusted-cp-deploy-install.sh
scripts/verify-code-structure.mjs
ts_normalize.py

exec
/bin/zsh -lc "git show origin/main:.agents/local/README.md | sed -n '1,105p'; git diff f767e8d6608cdb0917aad2d471ba0454d0966a0f..origin/main -- .agents/protocol/SPEC_FORMAT_V0.md .agents/schemas/spec-frontmatter.schema.json .agents/skills/spec-governance/modes/REVIEW.md docs/AGENT_CORE_PRODUCT_ARCHITECTURE_V1.md; git ls-tree -r --name-only origin/main docs/specs | rg 'STANDING|PRODUCTION_DEPLOYMENT_CONTROL|SESSION.*AUTHORIZATION|OPERATIONAL|WORKFLOW_EXECUTION_CONTROL'" in /tmp/review-609/repo
 succeeded in 0ms:
# Repository-local governance — dsh-agent-core

This file is owned by `mayf3/dsh-agent-core`. It is not part of the vendored distribution and is not overwritten by governance updates.

## Repository identity

```text
REPOSITORY = mayf3/dsh-agent-core
AUTHORITY_BRANCH = main
GOVERNANCE_LOCK = .agents/governance.lock.json
ADOPTION_ACTIVATION = accepted lock + accepted adoption Spec merged into main
```

A proposed lock on a feature branch is only an adoption candidate. It is not active repository authority.

## Authority precedence

```text
explicit Product Direction authority, when one is accepted
> accepted Product Architecture and standalone long-lived Current Decisions
> accepted implementation-authorizing Specs
> code, tests, runtime state, migration records, and operational evidence
```

Current repository authority locations:

```text
PRODUCT_DIRECTION = NONE_STANDALONE
PRODUCT_ARCHITECTURE = docs/AGENT_CORE_PRODUCT_ARCHITECTURE_V1.md
ROADMAP / STRATEGIC_CONTEXT = docs/AGENT_CORE_ROADMAP_V1.md
CURRENT_DECISION_INDEX = docs/decisions/README.md
DECISIONS = docs/decisions/
SPECS = docs/specs/
```

Local rules:

- an implementation Spec may refine Architecture or a Current Decision, but may not silently contradict it;
- changing accepted long-lived meaning requires a new whole-authority supersession transaction;
- a Program Spec with `implementation_authority: none` coordinates work but does not authorize product implementation;
- an accepted-looking document on an unmerged branch is not active authority;
- code, tests, reports, and runtime evidence may prove conformance or drift but do not rewrite normative authority.

## Bounded-development route (effective on V3 adoption only)

These local choices become active only with the accepted
`AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V3` and accepted lock merged into `main`.
Until then, the authority branch's existing rules remain controlling.

- `REUSE` inside an accepted implementation Contract needs no new Spec or
  standalone Spec review merely because code changes. Use focused tests and the
  review required by its Assurance level.
- Explicitly permit one atomic Spec-delta-and-code PR for bounded
  `AMEND/NEW + ROUTINE/DURABLE` work under the owner's task authorization. The
  delta must be independently accepted before merge; it cannot contradict
  Architecture, replace accepted meaning, widen privileges, change Secret/Grant
  boundaries, introduce destructive migration, or authorize production effects.
- `CONTROLLED` and `SUPERSEDE` remain docs-first. Implementation and production
  permissions are separate; missing production permission does not itself stop
  unrelated authorized nonproduction work.
- Review the affected change and invalidated dependencies. A new SHA alone does
  not require a full audit. Use the vendored explicit scope/impact checks.
- Ordinary tasks use the existing PR/Brief; no mandatory extra Agent formation,
  full-corpus review, or new control-plane document is introduced here.

## Acceptance and review actors

```text
SPEC_ACCEPTANCE_ACTORS = repository owner mayf3, or an explicitly authorized maintainer recorded in the PR
INDEPENDENT_SEMANTIC_REVIEWER = a reviewer who did not author the reviewed semantic delta
MECHANICAL_EXEMPTION_REVIEWERS = independent reviewer; final disposition by mayf3 or an authorized maintainer
EMERGENCY_AUTHORIZATION_ACTORS = mayf3 or an explicitly authorized maintainer
```

A review recommendation does not itself perform acceptance. Acceptance must bind the reviewed commit and the final accepted head.

## Governing and persistence locations

```text
SPECS = docs/specs/
INVESTIGATIONS = docs/investigations/
LONG_LIVED_DECISIONS = docs/decisions/
IMPLEMENTATION_CONFORMANCE = implementation PR record
CROSS_ENVIRONMENT_OR_PRODUCTION_CONFORMANCE = docs/reports/ plus pinned runtime provenance
SEMANTIC_REVIEW_RECORD = persistent PR conversation or docs/reports/
EMERGENCY / INCIDENT_REFERENCE = persistent issue, PR, or report
```

## Current Owner-obligation Workflow authority

The accepted paired governing authorities are `docs/specs/SVC_WORKFLOW_OWNER_OBLIGATION_WORKFLOWS_V2.md` in svc-workflow and `docs/specs/AGENT_CORE_WORKFLOW_OWNER_OBLIGATION_WORKFLOWS_V2.md` here, accepted by Root under user-delegated authority at reviewed semantic heads Svc `39587c33c8bcf26ad5689127f5c92a6abc8b562e` and Core `ac83fe5cea3701eb9436f74d1b5f6ed0013256a9`. The accepted Core whole successors are PPR V1 (whole successor to WAE V3 and Recovery Liveness V1), Assignee Transition Capability V3, WEC V4, GCR V2, WPO V4, and Owner Workflows V2. Assignee Transition Capability V2 is superseded by V3, and Owner Workflows V1 by V2, with reciprocal lifecycle links. The paired Svc acceptance-context successor is `SVC_WORKFLOW_ACCEPTANCE_CONTEXT_BINDING_V2`. Governing Contracts authorize source implementation only after their accepted revisions are present in the implementation base; production apply remains none. WEC V4 and the reciprocal WEC V3 retirement are recorded in the R4 #655 acceptance transaction; current-main activation requires its merge after independent final-HEAD review. Until then main's WEC V3 remains controlling.

## Code structure rules

Accepted whole-authority successor:
[`.agents/local/CODE_STRUCTURE_GUARDRAILS_V3.md`](CODE_STRUCTURE_GUARDRAILS_V3.md)
(Owner 2026-11-07, reviewed semantic head `7f36750bf08d308cd7f648153e24c0b0e528e4c6`,
PR #642 comment-6701500077; `rulings[id=owner-20261107-642-643-1377]`). V3 inherits
V2 completely and absorbs TE_V1's one exact transition with all constraints.
V2 and TE_V1 are superseded with reciprocal links in the same lifecycle commit.
This transaction activates only on main merge after independent final-HEAD review;
until then, main's accepted predecessor authorities remain controlling.
The historical V1-to-V2 link and all predecessor acceptance records are retained.

The separate implementation contract remains
docs/specs/AGENT_CORE_STANDING_OPERATIONAL_DELEGATION_V1.md
docs/specs/AGENT_CORE_STANDING_RELEASE_AUTHORIZATION_V1.md
docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V1.md
docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V2.md
docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V3.md
docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V4.md
docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V5.md
docs/specs/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1.md

exec
/bin/zsh -lc "python3 -B - <<'PY'
import importlib.util, json, re
from pathlib import Path
for m in ('yaml','jsonschema'):
 print(m, bool(importlib.util.find_spec(m)))
p=Path('docs/specs/AGENT_CORE_ADMISSION_RUNTIME_RELIABILITY_V1.md')
s=p.read_text()
import yaml
fm=yaml.safe_load(s.split('---',2)[1])
print('FRONTMATTER', json.dumps(fm,ensure_ascii=False))
if importlib.util.find_spec('jsonschema'):
 import jsonschema
 errors=list(jsonschema.Draft202012Validator(json.loads(Path('.agents/schemas/spec-frontmatter.schema.json').read_text())).iter_errors(fm))
 print('SCHEMA_ERRORS', [e.message for e in errors])
ct=re.findall(r'"'^### (CTR-ARR-'"\\d+) ',s,re.M)
ac=re.findall(r'"'^'"\\| (ACC-ARR-\\d+) / (CTR-ARR-\\d+) \\|',s,re.M)
print('CONTRACTS',ct)
print('ACCEPTANCE_MAP',ac)
print('UNCOVERED_CONTRACTS',sorted(set(ct)-{c for a,c in ac}))
links=re.findall(r'\\]\\((["'^)]+)'"\\)',s)
print('MISSING_LOCAL_LINKS',[l for l in links if not l.startswith('https:') and not (p.parent/l.split('#')[0]).exists()])
PY" in /tmp/review-609/repo
 succeeded in 33ms:
yaml True
jsonschema True
FRONTMATTER {"spec_id": "AGENT_CORE_ADMISSION_RUNTIME_RELIABILITY_V1", "status": "proposed", "spec_kind": "implementation", "authority_level": "governing_spec", "implementation_authority": "contracts", "production_apply_authority": "none", "scope": ["mayf3/dsh-agent-core", "optional history bind resilience and managed admission directory convergence for issue 554"], "governed_by": ["AGENT_CORE_PRODUCT_ARCHITECTURE_V1", "AGENT_CORE_INTERNAL_AGENT_DIRECTORY_V1", "PRODUCT_API_AUTHENTICATION_V1"], "external_authorities": [], "supersedes": [], "superseded_by": null, "owners": ["mayf3"]}
SCHEMA_ERRORS []
CONTRACTS ['CTR-ARR-001', 'CTR-ARR-002', 'CTR-ARR-003', 'CTR-ARR-004', 'CTR-ARR-005', 'CTR-ARR-006', 'CTR-ARR-007', 'CTR-ARR-008', 'CTR-ARR-009', 'CTR-ARR-010']
ACCEPTANCE_MAP [('ACC-ARR-001', 'CTR-ARR-001'), ('ACC-ARR-002', 'CTR-ARR-002'), ('ACC-ARR-003', 'CTR-ARR-003'), ('ACC-ARR-004', 'CTR-ARR-004'), ('ACC-ARR-005', 'CTR-ARR-005'), ('ACC-ARR-006', 'CTR-ARR-006'), ('ACC-ARR-007', 'CTR-ARR-007'), ('ACC-ARR-008', 'CTR-ARR-008'), ('ACC-ARR-009', 'CTR-ARR-009'), ('ACC-ARR-010', 'CTR-ARR-010')]
UNCOVERED_CONTRACTS []
MISSING_LOCAL_LINKS []

codex
Frontmatter 已通过仓内 JSON Schema 校验，10 个 Contract 均有 Acceptance 映射，仓内链接全部可解析。上游抽查的三个评论和 #555 merge 坐标也已读回。正在核对本地 main 后续新增的 SRA/SOD/WEC 权威，以及 #554 后续评论是否影响该稿的边界表述。
exec
/bin/zsh -lc "git show origin/main:docs/specs/AGENT_CORE_STANDING_RELEASE_AUTHORIZATION_V1.md | nl -ba | sed -n '1,240p'; git show origin/main:docs/specs/AGENT_CORE_STANDING_OPERATIONAL_DELEGATION_V1.md | nl -ba | sed -n '1,225p'; git show origin/main:docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V5.md | sed -n '1,100p'" in /tmp/review-609/repo
 succeeded in 0ms:
     1	---
     2	spec_id: AGENT_CORE_STANDING_RELEASE_AUTHORIZATION_V1
     3	status: accepted
     4	accepted_by: mayf3
     5	accepted_date: 2026-11-07
     6	accepted_at: 2026-11-07T07:26:44.290920Z
     7	accepted_reviewed_head: 8fdd5e9dc4f9cf525188d6ac19f986e0191e9604
     8	independent_review_result: PASS
     9	independent_review_receipt: docs/reports/sra-v1-formalization-20261107/independent-review.md
    10	independent_review_receipt_sha256: 617d3179d9ff8b87a263db1ef2a9156695d5433a9ed0ff2d2b16f7e7faca9a63
    11	acceptance_authority: Owner mayf3 ruling owner-20261107-sra-formalization items[0]
    12	acceptance_authority_source: /Users/yanfenma/Documents/Codex/2026-10-18/zcode-assist/tools/b7ctl/DISPATCH-REGISTRY.json
    13	acceptance_authority_selector: $.rulings[id=owner-20261107-sra-formalization]
    14	acceptance_authority_canonical_sha256: f6ace2b1e1621da830421e57a9b886faac75de8f4bf7a895d0ecf0832438a129
    15	acceptance_semantic_source_pr: https://github.com/mayf3/dsh-agent-core/pull/648
    16	acceptance_semantic_source_head: 61b97d326e337057cd1f71c0a6ff0dc37ab72ec2
    17	acceptance_transaction_executor: /root (format conversion and transaction executor only)
    18	acceptance_authority_basis: >-
    19	  Owner mayf3 approved the six-section semantics at PR 648 head 61b97d32
    20	  and explicitly authorized this responsibility chain to perform the first
    21	  formalization/acceptance transaction. The independent nonauthor review
    22	  passed exact proposed head 8fdd5e9dc4f9cf525188d6ac19f986e0191e9604 with semantic
    23	  delta NONE. The worker records this Owner acceptance; the worker and future
    24	  Captain are not the acceptance authority. The acceptance commit is bound
    25	  by its Git object and exact FINAL_ACCEPTED_HEAD in PR 648. No personal
    26	  Owner review of the converted exact head is claimed.
    27	acceptance_final_head_review: PASS (non-author independent, final head 9529e9a5f042a52f0e2355a3b1dc027339be374f,
    28	  contract semantic delta NONE, session 01a1be9e-29d8-7143-b23a-e62c2600674f)
    29	activation_boundary: main merge after independent final-HEAD review by regulator
    30	spec_kind: invariant
    31	authority_level: governing_spec
    32	implementation_authority: none
    33	production_apply_authority: conditional_controlled_operation
    34	production_apply_conditions: >-
    35	  Only after main acceptance, SRA effectiveness, attributable Captain appointment
    36	  and qualified existing controls under original §§1/6 may the Captain issue
    37	  each complete STANDARD_RECOVERABLE Mandate under original §§3/4.
    38	  This document conversion/acceptance issues no window or production operation;
    39	  PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1 production_apply_authority remains none.
    40	scope:
    41	  - mayf3/dsh-agent-core standing release delegation governance
    42	  - existing single host fleet runtime STANDARD_RECOVERABLE release issuance
    43	  - role registration, evidence gates, stage10, STOP and lawful effectiveness
    44	governed_by:
    45	  - AGENT_CORE_PRODUCT_ARCHITECTURE_V1
    46	  - SCHEDULER_OCCURRENCE_OUTCOME_V3
    47	  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V3
    48	  - SCHEDULER_TIMEOUT_OUTCOME_V3
    49	  - AGENT_PROCESS_LIFECYCLE_HARDENING_V4
    50	  - PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1
    51	external_authorities: []
    52	supersedes: []
    53	superseded_by: null
    54	owners: [mayf3]
    55	semantic_source_pr: https://github.com/mayf3/dsh-agent-core/pull/648
    56	semantic_source_head: 61b97d326e337057cd1f71c0a6ff0dc37ab72ec2
    57	semantic_source_path: STANDING-RELEASE-AUTHORIZATION-V1-DRAFT.md
    58	formalization_ruling_id: owner-20261107-sra-formalization
    59	formalization_ruling_selector: $.rulings[id=owner-20261107-sra-formalization]
    60	formalization_ruling_canonical_sha256: f6ace2b1e1621da830421e57a9b886faac75de8f4bf7a895d0ecf0832438a129
    61	---
    62	
    63	# Agent Core Standing Release Authorization V1
    64	
    65	<!-- BEGIN SRA_ACCEPTANCE_LIFECYCLE -->
    66	> **当前生命周期：ACTIVE_ON_MAIN。** Owner mayf3 授权正式接受事务已记录（2026-11-07，PR #648 合并 `55f442c7`）；非作者独立最终 HEAD 审查 PASS（2026-11-09，审查头 `9529e9a5`，spec blob `750504f2` 自合并未变，合同语义差量 NONE）。本激活行不签发任何窗口、不任命 Captain、不改变 §§1/6 任命/生效/控制资格与 §§3/4 逐窗 Mandate 的前置要求；OPERATION 仍需其各自独立事实成立。
    67	> 接受权威是上述 Owner 裁定；转换作者/事务 worker 不是接受权威。接受 reviewed HEAD 为 `8fdd5e9dc4f9cf525188d6ac19f986e0191e9604`，独审原文及事务绑定见 [接受收据](../reports/sra-v1-formalization-20261107/acceptance-transaction.md)。
    68	> 原文保全的 proposed/ACCEPTED=NO 等起草时点标记是历史记录；本事务不任命 Captain、不证明控制生效、不签发 W7 或任何窗口，不做生产操作。
    69	<!-- END SRA_ACCEPTANCE_LIFECYCLE -->
    70	
    71	> 格式载体转换；语义来源为 PR #648 的 `61b97d326e337057cd1f71c0a6ff0dc37ab72ec2`。
    72	> 下文十三个无编号逻辑章节满足 SPEC_FORMAT_V0；所有 `§1` 至 `§6` 均指 Contracts 中保留的原六节。
    73	> 原文的草案标题、状态块及“本稿/本任务/本轮/R2”描述保留其原起草时点含义；当前生命周期以 frontmatter 及绑定的接受事务为准。
    74	> 本 worker 仅执行转换与接受事务。接受权威为 Owner 裁定 `rulings[id=owner-20261107-sra-formalization]`，不是 worker 或未来 Captain 身份。
    75	
    76	## Goal
    77	
    78	<!-- BEGIN SRA_SOURCE_GOAL -->
    79	目标是把 Owner 已决定的受托接受、标准发布签发和 stage10 原则落实为可核验的治理程序。当前缺口是角色登记、范围判定、逐门证据和现有控制的绑定尚未形成合法生效的委托。本稿只提议这项长期委托治理义务，不修改产品 Contracts，不实现或激活部署控制器。
    80	<!-- END SRA_SOURCE_GOAL -->
    81	
    82	## Scope and non-goals
    83	
    84	范围与排除项逐字保留于原 §1/§2/§6。本次转换与接受事务按 [Owner 简报](../../BRIEF-SRA-FORMALIZE.md) 执行，仅文档；不任命 Captain，不签发窗口，不做生产写入。
    85	
    86	## Authority and dependencies
    87	
    88	<!-- BEGIN SRA_SOURCE_INPUTS -->
    89	起草输入为 [BRIEF 原件快照](../reports/sra-v1-draft-20261107/BRIEF-SRA-V1-DRAFT.source.md)、[Owner 预授权 V2 六条款及提名/R2 记录](../reports/sra-v1-draft-20261107/owner-selected-records.json)。Owner ruling 选择器为 `$.rulings[id=owner-20261107-preauth-v2]`，规范化 SHA256=`087461a2a7424088b258940393ef4f9ad5939e59d0a1e420dfc57efd2829c006`。快照是来源证据，不是新接受记录。原件与本仓权威的精确 commit/blob/SHA256 见 [source-provenance](../reports/sra-v1-draft-20261107/source-provenance.json)。
    90	<!-- END SRA_SOURCE_INPUTS -->
    91	
    92	<!-- BEGIN SRA_SOURCE_AUTHORITY -->
    93	约束来源为本仓 [local README](../../.agents/local/README.md)、[Product Architecture](../AGENT_CORE_PRODUCT_ARCHITECTURE_V1.md)、[D-009](../decisions/SCHEDULER_OCCURRENCE_OUTCOME_V3.md)、[Timeout V3](../specs/SCHEDULER_TIMEOUT_OUTCOME_V3.md)、[Lifecycle V4](../specs/AGENT_PROCESS_LIFECYCLE_HARDENING_V4.md) 及 [Deployment Control Plane V1](../specs/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1.md)。这些接受状态以本仓 main 的实际权威为准；来源记录、运行态、测试、hash 或本草案均不能改写其含义。DCP V1 的 `production_apply_authority: none` 保持不变。
    94	<!-- END SRA_SOURCE_AUTHORITY -->
    95	
    96	首次接受依据为 [Owner 裁定快照](../reports/sra-v1-formalization-20261107/owner-formalization-ruling.json) 的 `items[0]`，原件、selector、规范化 hash 和观察时间见 [转换收据](../reports/sra-v1-formalization-20261107/conversion-receipt.md)。该裁定约束接受事务，快照本身不替代正式权威或生产授权。Architecture 保持其原有冻结草案标记及既有边界；本转换不改变任何父权威的状态。
    97	
    98	## Current State
    99	
   100	以下只保全源 HEAD 的起草状态，不将旧起草状态冒称本次接受结果。
   101	
   102	<!-- BEGIN SRA_SOURCE_TITLE -->
   103	# Standing Release Authorization V1 — 待审草案
   104	<!-- END SRA_SOURCE_TITLE -->
   105	
   106	<!-- BEGIN SRA_SOURCE_ROUTE -->
   107	```text
   108	SPEC_ID = STANDING-RELEASE-AUTHORIZATION-V1
   109	STATUS = PROPOSED_DRAFT_NOT_EFFECTIVE
   110	SPEC_GOVERNANCE_MODE = AUTHOR
   111	AUTHORITY_ACTION = NEW
   112	ROUTE_STAGE = AUTHORITY_AUTHORING
   113	AUTHORITY_ACCEPTED_IN_BASE = NO
   114	PLAN_LEVEL = BRIEF
   115	ASSURANCE_LEVEL = CONTROLLED
   116	DOCS_FIRST_REQUIRED = YES
   117	IMPLEMENTATION_AUTHORITY = none
   118	PRODUCTION_OPERATION_ALLOWED_NOW = NO
   119	CAPTAIN_APPOINTED_NOW = NO
   120	WINDOW_ISSUED_NOW = NONE
   121	```
   122	<!-- END SRA_SOURCE_ROUTE -->
   123	
   124	<!-- BEGIN SRA_SOURCE_BOUNDARY -->
   125	完成边界是六节草案、覆盖收据、非作者审查与 docs-only PR；不合并、不任命、不签发。发现与接受权威的冲突、扩张产品/权限/生产效果或证据失真，停止受影响工作并报告；普通缺证按 §5 处理。W7 始终不因本稿自动签发。
   126	<!-- END SRA_SOURCE_BOUNDARY -->
   127	
   128	## Observations
   129	
   130	- `OBS-SRA-FMT-001` — 来源为 PR #648 `61b97d326e337057cd1f71c0a6ff0dc37ab72ec2` 的根目录草案与既存独立审查；环境为本隔离 docs worktree，方法为 `git show` 与逐节逆转换字节对照，实际观察时间及结果见转换收据。
   131	- `OBS-SRA-FMT-002` — Owner 台账选中裁定及规范化 hash 已直接读取；方法、原件坐标、观察时间与快照见转换收据。这里只观察其记录，不推导任命或窗口已签发。
   132	
   133	## Claims and assumptions
   134	
   135	- `CLM-SRA-FMT-001` — 本文件对原六节的语义差量为零。Support state: `SUPPORTED`；由 `EVD-SRA-FMT-001` 支持。限制：格式和内容对照不证明任命、控制资格或运行结果。
   136	- 无新增规范假设；任命、期限、控制资格和逐窗事实仍按原 §1/§3/§6 绑定。
   137	
   138	## Evidence relations
   139	
   140	- `EVD-SRA-FMT-001` — Source: `OBS-SRA-FMT-001`；Target: `CLM-SRA-FMT-001`；Relation: `SUPPORTS`。Bound coordinates: 上述源 HEAD、源路径及本文件的 proposed 转换提交；逐节逆转换 hash 与实际检查见转换收据。Strength/sufficiency: 原六节内容的字节同一及独立语义审查共同支持零语义差量；Limitations: 不证明生产资格、接受完成或 main 生效。Provenance: [原独立审查](../reports/sra-v1-draft-20261107/independent-review.md) 与本次转换收据。
   141	
   142	## Decisions
   143	
   144	无新增 Decision；保留 Owner 已认可的六节决定。角色登记见原 §1，标准范围见 §2，强制门见 §3，stage10 见 §4，STOP/升级见 §5，合法接受/生效见 §6。首次接受的责任链按上述 Owner 裁定办理，worker 不成为接受权威。
   145	
   146	## Contracts
   147	
   148	以下六节保留全部原文，只改变标题层级和相对链接；`SRA-C-001` 至 `SRA-C-006` 不重命名、不复用为其他含义。
   149	
   150	<!-- BEGIN SRA_SOURCE_CONTRACTS -->
   151	### 1. 受托角色定义、登记与撤销（SRA-C-001）
   152	
   153	Owner 决定长期边界及重大新决策；受托维护者负责获准范围内的正式接受；Release Captain 负责标准可恢复发布的逐单签发；执行 Agent/ITOps 负责获准操作；QA/独立 verifier 负责独立核验。复用现有 HR、Root、ITOps、QA、Issue、PR、Mandate、Runbook、Receipt，不另建审批平台。
   154	
   155	**Release Captain 资格必须同时满足：**身份可归属到具体 principal/session 与现有授权登记，具备读取适用权威、审阅实际 installer/闭包/回滚证明、判断 UNKNOWN 和 STOP、理解实际执行入口与收据的能力；独立于本单候选或 installer 的实质作者，且不兼任本单生产 writer 或独立 verifier。相同 UID 不是独立性证明；只写角色名或自报身份不合格。各角色与独立性须有可复核记录。
   156	
   157	首任候选是**监管会话（uid 502，DISPATCH-REGISTRY 台账归属）**。来源为 `$.history[round=sra-v1-draft-dispatched]`（观察索引 660），`actions[1]`，2026-11-07 14:44，规范化子记录 SHA256=`0498d4a65f2eb5d66cc3ec686a377ccbbbc3a779d79460a7ba6569233dc004e5`。这是提名，尚非任命；精确 principal/session 尚未在本任务证据中确认。不得用历史 `reviewer_session.id`、uid 502 本身或当前执行 Agent 的身份补造任命。
   158	
   159	任命由现行体系中有权授予该角色的 Owner/明确受托维护者登记，不能由候选自授。复用已有台账/PR 中的一条可归属记录，至少包含：
   160	
   161	| 登记字段 | 强制内容 |
   162	|---|---|
   163	| 授权者与依据 | issuer 的真实 principal、明确授权来源/范围及可追溯坐标；本 SRA accepted revision 和生效记录 |
   164	| 被任命者 | Captain 的 principal/session、UID、台账归属；必要的跨 session 身份延续证明 |
   165	| 可签范围 | 本仓、既有单一 fleet runtime、标准发布类、排除项；不得转委托或自行扩域 |
   166	| 有效期 | 明确的 UTC `validFrom`、`validUntil`；未知、缺省、无限期均不得生效 |
   167	| 能力和独立性 | 实际入口/收据消费与 STOP 能力证据；与单次作者、writer、verifier 的职责分离 |
   168	| 控制绑定 | 现有执行控制如何验证 issuer/范围/时效/撤销及 Mandate；绑定入口版本/hash、资格收据 |
   169	| 生命周期 | 任命 ID、登记时间、登记者、续任/替换/撤销来源及生效时间，保留历史 |
   170	
   171	更换 session 或 worker 本身不重新请求已经给出的边界决定，但必须证明新 actor 属于原授权身份及范围；不能证明时暂停其签发能力，由原责任链补齐登记。续任必须有新的明确期限，不默认延长。
   172	
   173	Owner 或原有权任命者可在同一登记链撤销/缩窄委托，记录 actor、时间、范围、理由和受影响 Mandate。每次签发及每个依赖生产写入边界均重核有效期与撤销状态；过期/撤销后不得启动新窗口或新写入阶段。在飞操作保留 phase、mutex、UNKNOWN，按当次已批准的安全停止/恢复配方处置；撤销不自动授权 kill、回滚或重放。替任不得夺锁、覆盖旧记录或追认既有未知部署。
   174	
   175	### 2. 签发范围与标准发布判据（SRA-C-002）
   176	
   177	Owner V2 §3 的委托限于期限和范围明确的 SRA 下，Captain 签发符合 accepted Contracts 的**标准可恢复生产发布**。全部下列判据成立才可归类 `STANDARD_RECOVERABLE`：
   178	
   179	1. 候选语义在实际 main 已接受的 Contracts 内，来源和接受可追溯；无未授权长期语义、身份、认证、权限或产品边界改变。
   180	2. 复用现有完整 Execution Mandate / Runbook 框架，只作用于已获准的单一 fleet runtime 面；现有执行入口已经合法准入并能强制执行本次限制。
   181	3. app、harness、Node/平台、实际 installer/完整闭包、预期旧版与生产身份精确绑定，全部适用兼容门、回滚及负向证明可核验。
   182	4. 一次有界窗口、一名 writer、独立 verifier、明确 UTC 期限/最大尝试、完整 effects 和恢复路径；不以全局清 fence、业务快照回灌或重放作为恢复手段。
   183	5. 符合 §4：停机后旧 runtime 和已派发外部操作终止或有效隔离；stage10 结束停机 containment 后，只恢复原有合法自然准入。
   184	
   185	非标准排除项包括：bootstrap 后仍需全局暂停；新语义/危险迁移；任何扩权、跨域、首次新 runtime/目标面；新装或激活 controller/profile/trust root/setuid helper；改变运行身份/认证策略/Node 架构；无法安全回退或超出已定发布策略的重大风险。Captain 不得以本 SRA 签发这些类。缺少普通资格材料不等于新产品决策，按 §5 自行补齐后重判；真实非标准需求则明确其机制/权限缺口和适用的 Owner 升级类别。
   186	
   187	本 SRA 不把一次发布与业务状态恢复、控制器/profile 升级合并。不授予 Router 写 Scheduler 的权力，不授予清除他人 fence/锁、Secret/Grant 变更或真实业务重投。DCP V1 的 source implementation 接受不证明其 controller/profile 已在生产激活；不得借 SRA 绕过独立 bootstrap/adoption 和权限边界。
   188	
   189	Captain 签的是**每单完整、精确、可审查的 Mandate**，不是概括性的“可发布”口令。冻结的合法候选不因无关 main 前移、新 commit/session/window/PR/worker 自动要求 Owner 重批；仍须影响复核。相关接受权威、候选语义、闭包、当前状态或安全条件变化时，重核失效的门并更新精确绑定；不可将旧 PASS 贴到新 tuple。
   190	
   191	### 3. 每次签发的强制门 checklist（SRA-C-003）
   192	
   193	抽取来源为 [W7 Mandate 十节快照](../reports/sra-v1-draft-20261107/EXECUTION-MANDATE-W7-DRAFT.source.md)，SHA256=`ffe1088eca1df5b63ae8e1a4e4897d5c390aa38cf76021fcc45e323fad96c911`。下表的来源节号均指该快照；W7 的 `DRAFT_NOT_ISSUED`、`NOT_SELECTED_NOT_QUALIFIED` 只是该来源时点状态，本任务没有核验后来的 installer 资格件，不能宣称当前已合格或仍未合格。
   194	
   195	**签发前材料门与执行边界事实门分开记录。** Captain 签发前必须逐项核验下表规定的当时可得资格、范围、证据坐标和后续强制阻断；不能把未来 05/07/10/11/12 的结果提前填 PASS。窗口内证据只能在指定边界 fresh 取得，记录 `NOT_EXECUTED / REQUIRED_AT_STAGE` 和取得方式、责任人、失败出口；这不是豁免。缺少签发前必需材料不得签发，缺少执行前必需事实不得越过对应阶段。未来事实不明不能用“Captain 已签”替代。
   196	
   197	每门 receipt 都绑定 `gateID / target / authorityRevision / candidateTuple / method / environment / observedAtUTC / actor / command-or-operation / rawRC / evidencePath / sha256 / result / limitations`，给 verifier 可读取的坐标。涉及 Secret 的前镜像只在既有私有授权面保存，对外保留脱敏清单、hash、受权 verifier 的可复核收据；不通过公开 Secret 证明 reviewability。hash 只识别内容，不证明资格、身份或执行。
   198	
   199	| 门及来源 | 签发前必须核验什么、证据坐标要求 | 执行到边界的 fresh 事实与失败出口 |
   200	|---|---|---|
   201	| G01 合法委托与范围（§1/9/10） | SRA accepted revision、生效收据、Captain 任命/撤销 selector、身份/独立性与有效期；当次 `STANDARD_RECOVERABLE` 判定和完整 Mandate 最终 hash；无自签 | 00 前及后续写入边界验证控制识别同一授权；不被现行体系承认或控制不可执行即 NO，不创建有效 authority JSON |
   202	| G02 精确候选及旧版（§1；§5/02） | app commit/tree、harness commit/tree、固定 Node binary/platform/hash、source→artifact manifest/stamp、expected old SHA；最新合法生产观察的时间/来源；候选接受坐标 | 02 核 exact PID/UID/GID/lstart/plist/env/Binding/helper 和旧 SHA；不用历史 PID7188。UNKNOWN/漂移停，不现场切身份 |
   203	| G03 installer 与闭包资格（§1/2 K10、K26–30；§5/01、03；§7/8） | **实际执行** installer SHA256、完整 bundle manifest/custody、逐文件/hash、限定效果和资格回执；lock/tarball/seed；源→装配→scratch byte/link/mode 与双启动；SDK/optional package/20项x64 seed 全实际 nonzero regular bytes、lstat no-follow census；真实 stamp writer→reader→reuse→backup 兼容 | 01/03 重核封印、工具收据消费及限定清洁；旧 W6、stock hash、单次 import、旧 R5 PASS 不能替代当次资格；缺成员/不兼容停止安装，不临场补包/伪造 stamp |
   204	| G04 保留行为与实际 consumer（§2；§5/03b） | 当次 behavior-map revision/hash、每项 RETAIN/RETIRE/MIGRATE/TEMPORARY_BRIDGE 的实际消费者和依赖；配置握手及必要 consumer 的测试收据；不以 #646 替代 pause/auth | 03b 对真实形状的授权脱敏 Workflow 历史词汇、Router/Scheduler 各自 reader、auth 实际 producer→consumer/aud/scope 验读；不改事件凑兼容，不将空 fixture 当生产副本 |
   205	| G05 E01–E17 effects（§3） | 实际 installer 逐路径/行号效果、附属 plist/env/directory/backup 清单；全成员/逐叶 preimage、postimage、restore-verification 的配方/路径/hash 与覆盖资格；不能只覆盖 live+R2 冒称全量 | 06a 在旧 runtime 仍活时取得当次每叶存在性、UID/GID/mode/mtime/link/ACL/xattr 和完整可恢复前态；bootout 前缺一即停。09/恢复后核后态与恢复证明，不扩大 chmod/chown |
   206	| G06 状态、认证与 fence 兼容（§2/4；§5/03b；§9） | 当前 recovery-v3/jobs-v3/Workflow 副本的合法来源、时间/hash、真实 reader/oracle 版本/方法和结果；按 Agent fence/既有认证不变的覆盖；V3-aware rollback 路线 | 03b/06 及 bootstrap 前核当前 schema/Agent/Binding 与 auth consumer；旧 UNKNOWN 保留。V3 提交后禁 downgrade、strip 字段、旧业务快照覆盖 |
   207	| G07 writer、verifier 与互斥（§3/5/9/10） | 唯一 writer principal/UID/登记坐标、非作者独立 verifier 身份与职责、真实收据解析/核验入口版本/hash 和能力证明；环境、权限范围和 mutex 方案 | 00 确认只持本人 mutex；各边界 verifier 可达可读。缺 verifier/冲突 writer 停，不夺锁、不清他人锁、不接受字符串 PASS |
   208	| G08 窗口、尝试、预算（§5/9/10） | windowID、UTC validFrom/Until、每动作最大尝试、精确命令、总期限/各阶段/恢复可达性证据；本框架 install/bootstrap 各最多一次；预算须实际可实现 | 00/各阶段重核时效。W7 建议 05→11 为20min/硬上限30min、恢复30min/累计停机申请上限60min、HR另600s；不可无证明承诺 SLA。超时停，不推 child 已终止，不重装/第二 bootstrap |
   209	| G09 full rollback preimage（§3；§5/06a、06；§6） | 完整 app/harness/node-runtime/.cache/config/home/generations、plist/env/identity、全部 E01–E17/树外 effects 的复制及恢复方案；实际 helper 覆盖资格与容量/时间证明 | 06a 旧 runtime 仍活时封印本次 `rollback-preimage.json`、source→copy→source inventory/ACL/xattr，`preparedBeforeBootout=true`、`businessSnapshotRestoreAllowed=false`。06 仅复核，不停机后临时复制 |
   210	| G10 quiet、停机及已派发 effects（§4；§5/04、05） | quiet 观察、一次 bootout、exact worker/tool/effect census 与隔离/拒绝边界的合法方法、收据位置和必要权限；恢复前的并发排除证明 | 04 mtime≥180s、可读 census/日志稳定，允许非空；不能结算制造 quiet。05 后 supervisor/exact旧进程/ports 消失且旧 workers 和已派发写/投递操作终止或有效隔离有正证；PID absence/EMPTY/取消请求不证明 remote cancel |
   211	| G11 05b exact settlement（§4；§5/05b；§8） | current epoch、agent/handle/attempt/generation、exitObservedAt、可信 exit_wait succeeded/child_real_exit 的正反例方法与 exact operation/commit/readback 收据 | 05b 只处理无冲突 exact 记录，只解除其拥有域合法 fence contribution；保留其他贡献。禁批量结算、推断结果、重放、重新投递。CAS/第二writer/内存部分失败不发布；rename/readback 不明则 mutationTruth=UNKNOWN→停 |
   212	| G12 安装及最终组合（§5/07–09；§6） | 精确 W/argv/source/payload、installer+tee 分别真实 rc 的采集；本次 BAK/reuse marker/section5b/installLog 及 failed/success rollback 收据模型 | 07/08 核实际 rc0 和本次 unique BAK/§5b/closure；started/interrupted 不二次 install。09 核 bytes/link/mode/ACL/config/Node外部依赖、effects 前后/恢复、stamp/必要 consumer 与同一 sealed tuple；缺证 bootstrap 前停 |
   213	| G13 stage10 边界（§5/10；§7；Owner §4） | §4 的标准类字段完整、前置证据取得和拒绝配方；plist 仅 deployed SHA；一次 bootstrap 与25s稳定方法 | 所有 bootstrap 前置事实 PASS 才结束停机 containment；如还需全局 pause 而未证明跨 restart 全入口机制，STOP 于 bootstrap 前。失败不重试，先核新实例/worker/effect 隔离 |
   214	| G14 live 验证及自然HR（§5/11、12；§7/9） | 指定独立新 PID/SHA/env/UID/GID/listener owner、公开 health/capability（W7为50 HTTP/19 local）、Scheduler ready 的 readback 方法；自然 HR 完整600s观察法，不人为触发 | 11 必需 readiness 独立核验；auth 只写实测，未证仍 UNKNOWN。12 新PID稳定且可归属新HR broker execute 才过该门；没观察写 HR_NOT_OBSERVED，不重投，不从 health/ACK 推业务完成 |
   215	| G15 STOP、回滚和终收据（§5/13；§6/9/10） | 每阶段 STOP/恢复入口、attempt/权限、失败树保全与恢复证据；§5 的字段、独立 post-state、所有门/UNKNOWN矩阵；retention只列不删 | 13 未齐不宣布成功。install前只在原树完整/无并发且获准时一次old bootstrap；started/interrupted 先核真实child/log/mutation；失败/成功回退各用本次收据。R1只本次marker允许子树；R2只两精确树GID20、不改UID/mode/内容；完整旧closure+当前状态兼容/metadata恢复后才可获准old bootstrap |
   216	| G16 负向矩阵和证据复用（§8及§1–10限制） | 错epoch/null exit/竞争writer/partial settlement/bootstrap失败/旧v2 reader等必需拒绝场景的 test/fixture/tuple/version/hash/rc/限制；未变证据通过实际影响复核重绑定 | 变更影响门则重验受影响项；不能从历史75ece/R5隔离 PASS推出当前生产 PASS；不可为凑活动重跑未失效门；未知不填0或PASS |
   217	
   218	E01–E17 的精确路径和 metadata 以上述 W7 §3 快照作抽取来源，每单再绑定实际 installer 和合法清单。至少保留：E05 递归树排除 E07/E08；E06 只能是指向 `/usr/local/libexec/agent-core/config/agents.json` 的同目标 symlink，普通/未知 authority 文件不删；E07/E08 当次已存在且 GID20，RESTORE-R2 只重申两树 GID20、UID/mode/内容不改；E09/E10 只根 metadata、不递归接管 Agent 子树；E13/E14 reuse 也核 metadata；E15 只权限、不改/露 Secret；E16 实际 JSON 逐名私有清单；E17 root:wheel 且仅根0700。缺少任一实际 effects 前态/恢复覆盖不得进入 bootout。
   219	
   220	本框架保持阶段顺序 `00→01→02→03→03b→06a→04→05→05b→06→07→08→09→10→11→12→13`。改阶段、效果、尝试或安全失败语义不得靠签发时口头豁免。签发前、每个受影响依赖边界与最终收据分别保存判断；隔离机制、生产加载、认证能力、历史恢复、业务完成分列，任何前者不自动证明后者。
   221	
   222	### 4. stage10 通用原则及 Mandate 字段（SRA-C-004）
   223	
   224	Owner V2 §4 原文语义为：**标准可恢复发布在旧 runtime + 已派发外部操作终止或有效隔离 + 全部技术与合同门通过后，stage10 bootstrap 可作停机 containment 结束点；只恢复原有合法自然准入，不清历史 UNKNOWN、不绕 fence、不重放、不放宽认证；需 bootstrap 后继续全局暂停的发布属于非标准类，须另行证明机制。**
   225	
   226	“全部门通过”在 stage10 指到该边界应完成的全部适用技术、合同、安全及兼容门；11/12 的后续 live 验证必须已有强制执行/失败出口，尚未执行不能被预先宣称 PASS，也不能在后续失败时宣布整窗成功。
   227	
   228	每单 Mandate 必须明确填写以下字段并由现行执行控制验证。字段表是要求，不是本轮生成的 authority JSON：
   229	
   230	| 字段 | 标准类要求 |
   231	|---|---|
   232	| `releaseClass / issuerRef / sraRevision / appointmentRef` | `STANDARD_RECOVERABLE`；合法生效 SRA、Captain 身份/范围/有效期/未撤销证明 |
   233	| `stage10.containmentEnd / admissionAfterBootstrap` | `true / EXISTING_LAWFUL_NATURAL_ONLY`；现有各域 admission/fence/auth consumer 保持有效 |
   234	| `oldRuntimeTerminationOrIsolationRef` | exact旧runtime/worker/epoch 与所有已派发 tool/write/delivery/effect 边界终止或有效隔离正证据；单纯停 supervisor 不够 |
   235	| `preBootstrapGateRefs` | §3 到09的全部适用 fresh PASS 证据，包括 full preimage/效果/状态/认证/闭包/回滚兼容，无缺失/冲突 |
   236	| `deployedSHA / plistRef / bootstrapMaxAttempts` | 精确已装载候选绑定；plist只deployed SHA；1次bootstrap，记录真实rc及25s稳定证明 |
   237	| `historicalUnknown / fences / authentication / replay` | `PRESERVE / PRESERVE_DOMAIN_RULES / UNCHANGED / FORBIDDEN`；不清他人/全局 fence，不放宽disabled域，不补跑错过slot |
   238	| `postBootstrapGlobalPauseRequired` | 标准类必须 `false`；如为true则非标准，本SRA拒绝签发 |
   239	| `postBootstrapVerificationAndFailureRefs` | 11/12独立readback及HR观察、bootstrap失败/后续失败时exact新worker/effect隔离、STOP/恢复收据和授权范围 |
   240	
     1	---
     2	spec_id: AGENT_CORE_STANDING_OPERATIONAL_DELEGATION_V1
     3	status: accepted
     4	accepted_by: mayf3
     5	accepted_date: 2026-11-07
     6	accepted_at: 2026-11-07T15:08:54.867556+00:00
     7	accepted_reviewed_head: 3f5fb8088e7822ec5bc26d641a07847b34553a50
     8	independent_review_result: PASS
     9	independent_review_receipt: docs/reports/standing-delegation-formal-20261107/independent-review.md
    10	independent_review_receipt_sha256: 32286d908375b9da83913ac70bdd3b26dd45f68dcf1a3e64e9a81edc3700bad1
    11	acceptance_authority: Owner mayf3 ruling owner-20261107-standing-delegation, original eight sections
    12	acceptance_authority_source: /Users/yanfenma/Documents/Codex/2026-10-18/zcode-assist/tools/b7ctl/DISPATCH-REGISTRY.json
    13	acceptance_authority_selector: $.rulings[id=owner-20261107-standing-delegation]
    14	acceptance_authority_canonical_sha256: 01cc059c2bf0e0493588f00032ca06eb73e3a0a13cb33f4078996fdccb79dad3
    15	acceptance_transaction_executor: /root (format conversion and acceptance transaction executor only)
    16	acceptance_authority_basis: >-
    17	  Owner mayf3 made the original eight-section standing ruling and authorized its
    18	  formal record and control binding under section 8 and BRIEF-DELEGATION-FORMAL.
    19	  The nonauthor reviewer passed the exact proposed head bound above. The worker
    20	  records the Owner acceptance and does not accept through a self-issued role
    21	  or future Captain identity. No personal Owner review of this converted exact
    22	  head is claimed. The final acceptance commit is bound by its Git object and
    23	  independent final-head review/readback in the delivery RECEIPT and PR.
    24	spec_kind: invariant
    25	authority_level: governing_spec
    26	implementation_authority: none
    27	production_apply_authority: conditional_controlled_operation
    28	production_apply_conditions: >-
    29	  The framework grants no operation by its existence. Original sections 4/5/8
    30	  require separate appointment, control effectiveness and a complete single
    31	  Mandate through the accepted SRA. This docs-only transaction performs none.
    32	scope:
    33	  - mayf3/dsh-agent-core formal record of the Owner standing delegation framework
    34	  - existing lawful responsibility chains across the four repositories named in original section 1
    35	  - Spec acceptance, Captain identity and SRA release control bindings
    36	governed_by:
    37	  - AGENT_CORE_PRODUCT_ARCHITECTURE_V1
    38	  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V3
    39	  - AGENT_WORKSPACE_SESSION_MODEL_V3
    40	  - SCHEDULER_OCCURRENCE_OUTCOME_V3
    41	external_authorities: []
    42	supersedes: []
    43	superseded_by: null
    44	owners: [mayf3]
    45	semantic_source_ruling: owner-20261107-standing-delegation
    46	semantic_source_selector: $.rulings[id=owner-20261107-standing-delegation]
    47	semantic_source_canonical_sha256: 01cc059c2bf0e0493588f00032ca06eb73e3a0a13cb33f4078996fdccb79dad3
    48	semantic_source_snapshot: docs/reports/standing-delegation-formal-20261107/owner-ruling.json
    49	authoring_base: 24974c720d634b965943e08bfd0862657b9be0e1
    50	activation_boundary: main merge after independent final-HEAD review; operational effectiveness additionally requires original section 8 control binding
    51	---
    52	
    53	# Agent Core Standing Operational Delegation V1
    54	
    55	<!-- BEGIN SOD_LIFECYCLE -->
    56	> **Owner mayf3 授权的正式接受事务已记录；本分支未合 main，不代表实际控制生效。**
    57	> reviewed proposed HEAD 为 `3f5fb8088e7822ec5bc26d641a07847b34553a50`；非作者独审原文及接受依据见
    58	> [接受事务](../reports/standing-delegation-formal-20261107/acceptance-transaction.md)。
    59	> 接受权威是 Owner 八节裁定本尊；`/root` 仅执行转换和记录事务，不是自授的维护者或 Captain。
    60	> main 激活、Auth 主体建立、Captain 任命、控制生效、单窗签发和实际业务结果分别核验。
    61	<!-- END SOD_LIFECYCLE -->
    62	
    63	## 1. Goal
    64	
    65	把 Owner 已作出的常设授权总裁定逐字转为本仓唯一正式 governing Spec 载体，并按原 §8
    66	连接现有 Auth、Spec 接受及发布入口的控制核验。消除重复授权的决定来自原裁定；本文件
    67	不借格式转换增加决策空间。原八项逐字保存在 §9；下文“原 §n”均指第 n 个源项。
    68	
    69	## 2. Scope and non-goals
    70	
    71	原 §1/§2 记载四仓长期委托范围，本文件是该裁定在 `mayf3/dsh-agent-core` 的正式记录；
    72	不将本仓 PR 当作其他仓库已完成接受、代码加载或控制适配的证据。
    73	本任务限 [Owner Brief](../../BRIEF-DELEGATION-FORMAL.md) 的 docs-only 面：不改产品源码，
    74	不创建 Principal/Client/Secret/Grant，不任命 Captain，不签发 W7/窗口，不运行生产或合并 PR。
    75	`implementation_authority: none` 限于本总框架本身；原 §3B 对配套 implementation-authorizing
    76	合同的接受委托逐字保留，并不在本轮把任何配套权威改成 `contracts`。
    77	
    78	## 3. Authority and dependencies
    79	
    80	原件、唯一 selector、时间、canonical 算法、整条 ruling 及逐项 UTF-8 SHA256、固定 base
    81	和控制源码 blob/hash 见 [source-provenance](../reports/standing-delegation-formal-20261107/source-provenance.json)。
    82	[选中原文快照](../reports/standing-delegation-formal-20261107/owner-ruling.json) 是来源证据，
    83	快照或台账状态不能代替本仓接受程序，也不能单独证明操作授权生效。
    84	
    85	受本仓 [local governance](../../.agents/local/README.md)、Product Architecture、D-008/D-009
    86	及现有 accepted 安全边界约束。原 §3/§7 的受托接受不允许重写旧 stable ID 原义；
    87	需要整权继任时仍按现行 docs-first、独审、接受事务和互斥回链程序。
    88	
    89	本框架与 [SRA V1](AGENT_CORE_STANDING_RELEASE_AUTHORIZATION_V1.md) 互补：前者记录总委托，
    90	后者保持标准发布子机制及其完整 G01–G16 门、任命和逐窗 Mandate；`supersedes: []`，
    91	不 supersede 或修改任何现有权威。原 §4 的 canonical Principal 决定不把 SRA 历史提名
    92	变成已任命事实。[DCP V1](PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1.md) 的
    93	`production_apply_authority: none` 保持；不激活新 controller/profile/trust root。
    94	§3B 列举的 #643/#655/#657/#658 只是原决定原文，不证明各候选已接受、配对或可实施；
    95	#643 的现行限定接受与配套 WEC/Svc 前置保持，详见 provenance 的 Base movement。
    96	
    97	## 4. Current State
    98	
    99	`STATE-SOD-001` — Subject: 本次正式化工作面；as_of_commit: `24974c720d634b965943e08bfd0862657b9be0e1`；
   100	environment: 隔离 worktree `/private/tmp/h-delegation-formal`；observed_at: `2026-11-07T15:03:30.507148+00:00`；
   101	basis: `OBS-SOD-001/002/003` 及 provenance。源 ruling 有八项，指定正式 Spec 尚未存在于
   102	该 base。控制点状态是文档/源码查证结果，不是生产验证或 Captain 任命结果。
   103	本候选当前生命周期见 frontmatter 和接受事务，后续状态不可倒灌到上述观察时点。
   104	
   105	## 5. Observations
   106	
   107	- `OBS-SOD-001` — Subject: Owner 八节原文；source: provenance 中唯一选中 ruling，
   108	  canonical SHA256=`01cc059c2bf0e0493588f00032ca06eb73e3a0a13cb33f4078996fdccb79dad3`；environment: 只读本地来源；
   109	  observed_at: `2026-11-07T15:03:30.507148+00:00`；method: JSON exact id selector、唯一性检查和逐项 SHA256；
   110	  result: 唯一记录、八项；provenance: source-provenance 和原文快照。
   111	- `OBS-SOD-002` — Subject: 本仓治理和接受事务先例；source revision: 上述 base，另核远端
   112	  main `9df5bd2fdea17f04bcd1762cd6800c350efcf9c3`；environment: docs worktree/GitHub 只读；observed_at: 同 provenance；
   113	  method: 固定 Git 对象与 #648/#643 回执；result: 接受者可为 mayf3，worker 不成为接受权威，
   114	  reviewed/final HEAD 和 main 激活分开；provenance: conversion-receipt 与 source-provenance。
   115	- `OBS-SOD-003` — Subject: Auth/Spec/window 控制；source revision: 上述 base；
   116	  environment: 本地源码/权威只读，无生产调用；observed_at: 同 provenance；method: 精确文件/行查证；
   117	  result: 通用身份读取已有源码，Spec 为手工政策，window helper 未消费 SRA G01 授权链；
   118	  provenance: [控制绑定清单](../reports/standing-delegation-formal-20261107/control-bindings.md)。
   119	
   120	## 6. Claims and assumptions
   121	
   122	- `CLM-SOD-001` — 八项裁定的转换语义差量为零。Support state: `SUPPORTED`；
   123	  evidence: `EVD-SOD-001`；uncertainty: 逐字检查仅覆盖转换，正式接受还需非作者独审。
   124	- `CLM-SOD-002` — 本次文档接受不证明实际委托控制已生效。Support state: `SUPPORTED`；
   125	  evidence: `EVD-SOD-002`；uncertainty: 未检查生产，具体主体/任命/运行资格保持未验证。
   126	- 没有新增规范假设；实际 UUID、Session、任命、生效和单窗事实是待合法核验的事实，
   127	  不能用假设填充，也不阻止本次 docs-only 记录已决定的语义。
   128	
   129	## 7. Evidence relations
   130	
   131	- `EVD-SOD-001` — Source observations: `OBS-SOD-001/002`；Target: `CLM-SOD-001`；
   132	  Relation: `SUPPORTS`；Bound coordinates: ruling canonical hash、逐项 hash、proposed Git commit
   133	  和独审 reviewed HEAD；Strength/sufficiency: 八项反提取逐字相等及非作者语义审查；
   134	  Limitations: 不证明生产资格；Provenance: conversion-receipt、验证原文及独审收据。
   135	- `EVD-SOD-002` — Source observations: `OBS-SOD-003`；Target: `CLM-SOD-002`；
   136	  Relation: `SUPPORTS`；Bound coordinates: 控制清单固定源码 blob/hash、观察时点；
   137	  Strength/sufficiency: 足以区分政策要求与现有消费逻辑；Limitations: 未执行运行时负向测试，
   138	  不声明具体部署状态；Provenance: control-bindings 与 source-provenance。
   139	
   140	## 8. Decisions
   141	
   142	不新增 Owner 决定。`DEC-SOD-001` 记录原 §1/§2 的长期委托和既有链复用；
   143	`DEC-SOD-002` 记录原 §3 的 A/B/C 接受范围和独立性；`DEC-SOD-003` 记录原 §4/§5 的
   144	canonical 身份、条件任命及 SRA 单窗门；`DEC-SOD-004` 记录原 §6/§7/§8 的自主补证、
   145	四类升级、职责分离及实际控制绑定。Decision owner: Owner mayf3；决定原句见下一节，
   146	此索引不扩充或压缩决定含义。拒绝的替代与理由见 §11。
   147	
   148	## 9. Contracts
   149	
   150	以下八块各自逐字保留源 `items[0..7]`；只在块外增加标题、稳定 Contract ID 和来源索引。
   151	原 §6 的“六要素”及其全部括号列项均原样保留，不在转换中编辑。规范用词保留 Owner
   152	原中文义务表达；这些原文为本 Spec 的 MUST / MUST NOT / MAY 约束，不作强弱改写。
   153	
   154	### CTR-SOD-001 — 原 §1（items[0]）
   155	
   156	<!-- BEGIN SOD_SOURCE_001 -->
   157	常设授权总裁定(八节): 既有四仓(agent-control/dsh-agent-core/svc-workflow/auth-service)的工程开发/规范接受/跨仓协调/标准生产发布/业务验收长期委托现有合法治理与执行责任链自主推进; 消除重复授权; 不新增Goal/审批平台/调度器/控制器/第二事实账本; 授权长期有效至Owner明示撤销
   158	<!-- END SOD_SOURCE_001 -->
   159	
   160	### CTR-SOD-002 — 原 §2（items[1]）
   161	
   162	<!-- BEGIN SOD_SOURCE_002 -->
   163	§2范围: 允许自主=调查/复现/修复/重构/删无效代码/测试回归+Issue创建更新关联关闭+backlog收敛+起草审查合并合规PR+Owner已决定范围的整权继任/引用更新/正式接受/旧权威退休+跨仓Core/Svc协调/独立验证/合法实施/真实业务验收+SRA下标准可恢复发布完整链+普通缺证/构建失败/installer未资格/检查器误报/版本漂移自行修复重验; 不因SHA/PR号/Session/worker/窗口变化自动生成新Owner审批
   164	<!-- END SOD_SOURCE_002 -->
   165	
   166	### CTR-SOD-003 — 原 §3（items[2]）
   167	
   168	<!-- BEGIN SOD_SOURCE_003 -->
   169	§3规范接受委托: A=既有合同修复与等价继任; B=Owner已决定语义(#643/#655/#657/#658显式列出+必需WEC/WAE/Liveness整权继任+Core/Svc配套合同, implementation_authority:contracts允许, 生产none); C=同类非扩权可靠性改进(执行身份/防重副作用/责任活性/公平调度/故障隔离/只读恢复/可观测性); 每次须非作者独立语义审查+接受者真实身份权限+reviewed HEAD+最终接受事务+互斥权威; 作者不得自我接受新增权限; 超范围产品政策变化才§7升级
   170	<!-- END SOD_SOURCE_003 -->
   171	
   172	### CTR-SOD-004 — 原 §4（items[3]）
   173	
   174	<!-- BEGIN SOD_SOURCE_004 -->
   175	§4 Captain: 批准Auth现有合法路径创建专用Principal release-captain-agent-core-20261107(canonical身份方案; 仅身份绑定, 不附赠Client/Secret/Grant/特权helper/生产写权限); 授权责任链在五条件(唯一Principal+Session绑定/能力资格/独立性/体系承认/实际控制负向)完成后任命; validUntil=2026-12-07T16:00:00Z不追溯; 续任/替换由不同有权维护者办理(新期限+新身份核验+可撤销记录, 不候选自授自续); 若现有控制不支持委托→原责任链在现有合法机制完成适配+负向验证; 生效前不得提示词/角色名/自写JSON假装签发权
   176	<!-- END SOD_SOURCE_004 -->
   177	
   178	### CTR-SOD-005 — 原 §5（items[4]）
   179	
   180	<!-- BEGIN SOD_SOURCE_005 -->
   181	§5常设标准发布: SRA accepted+Captain appointed+control effective+单Mandate issued=四独立事实; 全成立后Captain获单一fleet runtime STANDARD_RECOVERABLE签发权不再逐窗请批; 每次绑定完整清单(真实前态/精确候选harness installer Node制品/接受权威时效范围唯一writer独立verifier/installer资格效果清单真实前态可恢复证明/原进程及已派发外部效果终止隔离/UNKNOWN fence认证状态兼容/一次性install bootstrap/阶段STOP回退读回终收据); stage10仅全部前置满足后结束containment恢复自然准入; W7=机制生效后首单候选(Captain完整核验分类签发; 本裁定不直接签发W7不承认未执行门为PASS); 同窗内已授权STOP/隔离/恢复/回退按原Mandate自主; 未知外部效果先读回不盲重试
   182	<!-- END SOD_SOURCE_005 -->
   183	
   184	### CTR-SOD-006 — 原 §6（items[5]）
   185	
   186	<!-- BEGIN SOD_SOURCE_006 -->
   187	§6缺证自主处置: 普通工程问题原链自行补齐不一律升级WAITING_OWNER; 每阻塞保留六要素(原因/受影响动作/责任主体/现有授权/最小补证/下次合法触发/恢复关闭条件); 缺证只禁依赖该证的危险动作不冻结其他无冲突已授权工作; 已决定语义不因检查失败/修复提交/新reviewer/新session/main前移重复请批
   188	<!-- END SOD_SOURCE_006 -->
   189	
   190	### CTR-SOD-007 — 原 §7（items[6]）
   191	
   192	<!-- BEGIN SOD_SOURCE_007 -->
   193	§7仅四类升级Owner: 1新生产目标/特权身份/Grant/trust root/控制器profile/安全边界扩大 2不可逆迁移/破坏性删除受保护数据/解除保留pin/无可靠恢复路径高风险 3实质改变业务归属/人工决策政策/认证模型/降低UNKNOWN-no-replay-fence安全保证 4全部合法补证与恢复途径用尽后确需Owner承担新风险或业务判断; 升级只交最小差量+事实+备选+后果; 真实HUMAN_GATE走原有可信链不伪造同意不超时默认
   194	<!-- END SOD_SOURCE_007 -->
   195	
   196	### CTR-SOD-008 — 原 §8（items[7]）
   197	
   198	<!-- BEGIN SOD_SOURCE_008 -->
   199	§8执行验收与防授权循环: 复用HR/Root/Architect/QA/ITOps/Auth/Release Captain分工; 职责分离(作者不自验收/Captain不兼writer/verifier不兼被审动作作者writer/受托维护者不自造未有权接受); 责任链须将本裁定经有权维护者正式记录与实际Auth/Spec/发布入口授权控制绑定(不得仅本地台账声明生效); 一次性制度适配后同范围操作只核现行授权与执行资格; 以真实交付衡量(源码合并/实际加载/功能启用/业务见证分列+记录重复Owner审批次数与无下一动作等待责任); 禁新建平行平台/第二生产控制/第二调度/因治理延误无关交付; 本裁定=决策空间常设授权非任意未验证操作的安全证明
   200	<!-- END SOD_SOURCE_008 -->
   201	
   202	## 10. Acceptance
   203	
   204	下列是每个原文 Contract 的验收定义，非运行测试已执行声明。所有项的方法环境为精确
   205	候选/固定 main 的非作者文档审查；涉及 Auth、任命及发布控制的实际验证，须未来在
   206	已有合法授权环境由对应责任链执行并持久绑定，当前为 `NOT_EXECUTED`。
   207	每项 Required evidence 均含源 selector/hash、Spec revision、reviewed/final HEAD、实际方法、
   208	actor、环境、时间、原文结果与 raw RC；运行项另含原权限收据及相关前后态，不能以本文替代。
   209	
   210	| Acceptance | Contracts | Method | Expected result | Failure condition |
   211	|---|---|---|---|---|
   212	| ACC-SOD-001 长期边界与复用 | CTR-SOD-001 | 比对源 item[0] 及四仓/原链范围 | 长期至明示撤销，不建并行平台或第二账本 | 把常设授权当任意操作安全证明或新平台许可 |
   213	| ACC-SOD-002 自主推进范围 | CTR-SOD-002 | 逐项比对 item[1] 与相关既有合同 | 普通工程/协作和已决定语义按原范围自主，不因新 SHA/worker 重复请批 | 缺普通材料即无限 WAITING_OWNER，或借自主推进扩权 |
   214	| ACC-SOD-003 A/B/C 规范接受 | CTR-SOD-003 | 核 item[2]、非作者独审、接受者真实权限、reviewed/final HEAD 与互斥权威 | 作者不能自我接受新增权限；配套合同按合法事务接受 | 把审查 PASS 当接受，或用本框架追认 #643 配套未过的门 |
   215	| ACC-SOD-004 Captain 条件任命 | CTR-SOD-004 | 核 item[3] 和控制清单 Auth 行；未来由原有权链取真实身份/任命/负向收据 | 只作 canonical 身份决定，五条件齐才任命；指定 validUntil，不自授自续 | 用 uid502/角色名/自写 JSON 造身份、授 Client/Grant 或追溯任命 |
   216	| ACC-SOD-005 SRA 标准生产发布 | CTR-SOD-005 | 核 item[4] 与 SRA G01–G16/完整 Mandate；未来实际边界 fresh 核验 | 四事实独立、stage10 前置和 UNKNOWN 保留；W7 未直接签发 | 以 accepted/main merge 代替 control effective、未执行门填 PASS 或盲重试 |
   217	| ACC-SOD-006 普通缺证自主处置 | CTR-SOD-006 | 逐字核 item[5] 的全部字段、责任主体、下一合法触发和恢复条件 | 仅停止依赖缺证的危险动作，其他授权工作继续 | 缺证全局冻结、漏责任/下一动作或因修复提交重请已定语义 |
   218	| ACC-SOD-007 四类 Owner 升级 | CTR-SOD-007 | 逐项对照 item[6] 与真实 HUMAN_GATE 信任链 | 只有原四类触发升级，提交最小差量/事实/备选/后果 | 超时默认人工同意、降低 UNKNOWN/no-replay/fence 或隐匿新风险 |
   219	| ACC-SOD-008 制度适配与真实交付 | CTR-SOD-008 | 核 item[7]、控制清单和分列交付证据；未来由合法控制所有者实际资格验证 | 正式记录与 Auth/Spec/入口绑定；明确源码/加载/启用/业务见证不同 | 本地台账自称 EFFECTIVE、作者自验收、Captain兼writer 或第二控制面 |
   220	
   221	覆盖为 CTR-SOD-001..008 → 同号 ACC-SOD-001..008，8/8；不增加原文之外的授权。
   222	
   223	## 11. Alternatives and disposition
   224	
   225	- RETAIN：原 HR/Root/Architect/QA/ITOps/Auth/Captain 分工、原账本/PR/Issue、SRA 标准发布子机制。
---
spec_id: AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V5
status: accepted
accepted_by: mayf3
accepted_date: 2026-11-08
accepted_at: 2026-11-08T00:00:00Z
acceptance_authority: Owner mayf3 ruling owner-20261108-three-unified items[1]
acceptance_authority_source: /Users/yanfenma/Documents/Codex/2026-10-18/zcode-assist/tools/b7ctl/DISPATCH-REGISTRY.json
acceptance_authority_selector: $.rulings[id=owner-20261108-three-unified].items[1]
acceptance_authority_canonical_sha256: 00f1fb2995d5f83a3bb9f50f442754fadb13f46274c2f1cbafd5f90253d5b218
acceptance_reviewed_head: e6e326986febeaaef7e51a632d0862fa7fc9099e
acceptance_qualifier: >-
  Implementation of new reason RECOVERY_REFUSAL_TERMINAL gated on Svc paired
  authority formal acceptance; production use gated on deployment authorization.
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
authority_action: SUPERSEDE
repository: mayf3/dsh-agent-core
date: 2026-11-08
authoring_base: b6ddc2a67ba041b8b13ed33d331104cf809d4985
scope:
  - complete effective WEC V4 authority
  - bounded refused-terminal system Assistance branch and responsibility projection
governed_by:
  - AGENT_CORE_PRODUCT_ARCHITECTURE_V1
  - AGENT_WORKSPACE_SESSION_MODEL_V3
  - SCHEDULER_OCCURRENCE_OUTCOME_V3
  - AGENT_CORE_WORKFLOW_OWNER_OBLIGATION_WORKFLOWS_V2
  - AGENT_CORE_REFUSAL_TERMINAL_HANDOFF_V1
external_authorities:
  - repository: mayf3/svc-workflow
    authority_id: SVC_WORKFLOW_EXECUTION_CONTROL_V3
    revision: b5096782f666ad22aa3508fdbf9562278a977c0f
    relation: constrained_by
supersedes:
  - AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V4
superseded_by: null
owners: [mayf3]
---

# AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V5

**当前：已按 Owner mayf3 `owner-20261108-three-unified` items[1] 完成 accepted-contracts 接受事务（PR #664）。**
`implementation_authority: contracts`，`production_apply_authority: none`；本次仅对齐已发生的接受记录。
新 `RECOVERY_REFUSAL_TERMINAL` reason 的实施仍须 Svc 配套权威正式接受并进入各自实施 base，按 §12 保留配套与生产授权闸门。

## 1. Goal

完整继承当前 WEC V4，将 RTH V1 已限定接受的 `RECOVERY_REFUSAL_TERMINAL` 系统责任
交接接入同一 WEC 实施权威。原执行失败、终态和业务 UNKNOWN 保持，Owner 接收责任不成为
执行成功或恢复许可。与完整恢复后继 PPR V2 配对，不创建第二执行模型。

## 2. Scope and non-goals

附录 A 携带 WEC V4 全部正文、十项 Contract、全部 Acceptance 和既有有效修订。
唯一新增协议是 PPR V2 §9.2 六项 RTH Contract 所限定的 B2 terminal refusal 责任分支。
不承接 #643 aging reason，不扩 ordinary planned/stale/Owner-resume，不承接 #650 a/b closure、
#1379 传输实现，不创建账本/queue/controller，不改变 Grant、身份、业务 transition 或生产状态。
WEC4 的两类远端 collection 解锁例外、fresh replay/终检与实际双 writer 验收完整保留。

## 3. Authority and dependencies

授权为用户 BRIEF-RTH-CORE-SUCCESSOR 及 accepted Standing Delegation V1 `CTR-SOD-003`
原 §3B；Owner `owner-20261107-four-pr-rulings.items[2]`（③）限定接受 RTH 语义。
原 `owner-20261107-five-decisions.items[2]`（③）涉及 #643 aging，不能误作 RTH 裁定。
来源 selectors/canonical hashes 与 fresh main 核对见 [收据](../../RECEIPT-RTH-CORE-SUCCESSOR.md)。

路线 `SUPERSEDE / BRIEF / CONTROLLED / AUTHORITY_AUTHORING`，docs-first。
RTH V1 §3.1 明确要求 owning WEC4/PPR 整权后继；SPEC_FORMAT_V0 §14 不允许用 NEW 或
PPR V1 AMEND 改变 closed reason、终态追加或旧 resume 的通过集合。

配对本仓候选为 `AGENT_CORE_WORKFLOW_PRE_ADMISSION_RECOVERY_V2`（PPR V2）。本候选不将
RTH V1、PPR V1、WAE3、Liveness1 或 SRE 退休；仅拟整体替代 WEC4。RTH V1 保留
accepted/none 语义来源角色。PPR V2 单独完整替代 PPR V1；旧 WAE3/Liveness1 的历史退休链不分叉。

上述 Svc reference 绑定已接受的**现有限制**，不声明它支持新协议。当前 V3 不接受新 reason、
historical/closed 责任 case，resume evidence 也不是交接回执。未来须以 Svc 所属完整后继
承接接收/幂等读回/答复/消费者，并绑定真实 accepted ID、reviewed head、main SHA/Contract。
本文件不预造 Svc ID 或权限；配对未完成时本 reason 的实现继续为 NO。

## 4. Current State

`STATE-WEC5-001` — subject=Core 本地接受权威及本提案；as_of_commit=
`b6ddc2a67ba041b8b13ed33d331104cf809d4985`；environment=隔离 docs worktree
`/private/tmp/h1377-minimpl`、`docs/rth-core-successor`；observed_at=2026-11-07T21:33:34Z。
WEC4/PPR1/RTH1 的 #655→#657→#658 已为该基线祖先；RTH 为 accepted/none。
附录保留的“未合 main”等是来源时点，不是当前状态。Basis: OBS-WEC5-001/002、EVD-WEC5-001。
源码、装载、运行、业务与无人值守验收均未在本任务执行。

## 5. Observations

- `OBS-WEC5-001` — 在上述时间/环境，以 git ancestry、frontmatter/正文和 SHA256 只读核对
  WEC4/PPR1/RTH1；结果及文件/来源 body hashes 见收据。WEC4 的新 reason 分支尚无实施权。
- `OBS-WEC5-002` — fresh Core main=`b177d3fcce3febb09711135c145cc4b43e63aa8e`，仅新增 #663
  实施源码/测试/证据；受影响权威、治理及 Current Decisions 字节未变。Svc main=
  `b5096782f666ad22aa3508fdbf9562278a977c0f` 的 WEC V3 仍是两旧 reason/current 门。
  方法、固定链接和读取限制见收据；没有 DB 或运行时观察。


exec
/bin/zsh -lc "git show origin/main:docs/specs/AGENT_CORE_INTERNAL_AGENT_DIRECTORY_V1.md | nl -ba | sed -n '1,210p'; git show origin/main:docs/specs/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1.md | nl -ba | sed -n '1,160p'" in /tmp/review-609/repo
 succeeded in 0ms:
     1	---
     2	spec_id: AGENT_CORE_INTERNAL_AGENT_DIRECTORY_V1
     3	status: accepted
     4	spec_kind: implementation
     5	authority_level: governing_spec
     6	implementation_authority: contracts
     7	production_apply_authority: conditional_controlled_operation
     8	scope:
     9	  - mayf3/dsh-agent-core
    10	  - generic authenticated internal exact Agent directory read (exists/enabled)
    11	governed_by: [AGENT_CORE_PRODUCT_ARCHITECTURE_V1]
    12	external_authorities:
    13	  - repository: mayf3/auth-service
    14	    authority_id: AUTH_SERVICE_INTERNAL_IDENTITY_DIRECTORY_V1
    15	    revision: f2b7d4c91ad657464816108062145ae95c21d686
    16	    relation: depends_on
    17	supersedes:
    18	  - AGENT_CORE_WORKFLOW_CANONICAL_ADMISSION_V1
    19	superseded_by: null
    20	owners: [mayf3]
    21	accepted_by: mayf3
    22	accepted_date: 2026-09-06
    23	accepted_reviewed_spec_commit: 7f620ad87ebadc9571eaf527bc370f259dfd9cc6
    24	acceptance_review_verdict: PASS
    25	acceptance_record: docs/reports/INTERNAL_AGENT_DIRECTORY_ACCEPTANCE_V1.md
    26	---
    27	
    28	# AGENT_CORE_INTERNAL_AGENT_DIRECTORY_V1
    29	
    30	## Goal, authority and evidence
    31	
    32	Expose the authoritative canonical Agent existence/enabled check as a minimal internal
    33	directory read available to ANY authenticated canonical internal Agent or SERVICE caller,
    34	so no consumer needs a dedicated per-purpose lookup identity. Agent Core remains
    35	authoritative for canonical Agent Definition existence/enabled truth; this changes WHO
    36	may perform the safe read, not HOW status is observed.
    37	
    38	Owner direction 2026-09-06 (WORKFLOW_ASSIGNEE_CANONICAL_IDENTITY_RECONCILIATION_V1,
    39	CONTINUE_SAME_GOAL): canonical identity lookup is foundational internal directory
    40	information; the previously accepted dedicated-caller model
    41	(AGENT_CORE_WORKFLOW_CANONICAL_ADMISSION_V1 @ bc88cc81, caller pinned to the single
    42	SERVICE principal cedb954a-3d99-4e5a-b568-d312441bcc56 / client
    43	svc-workflow-canonical-admission-v1, audience workflow-agent-admission, scope
    44	agent.definition.admission.read, 5-second token age) is SUPERSEDED_DIRECTION_PENDING.
    45	Nothing is deleted; the branch-local implementation (dda69b5, unmerged) is reused.
    46	
    47	DEVELOPMENT_PREFLIGHT: AUTHORITY_ACTION=SUPERSEDE (read-authorization model changed by
    48	Owner direction; observation semantics unchanged); PLAN_LEVEL=EXEC_PLAN;
    49	ASSURANCE_LEVEL=CONTROLLED; DOCS_FIRST_REQUIRED=YES. Base: current main 4b8726b plus
    50	branch-local head dda69b5. Mechanical reconciliation evidence:
    51	docs/investigations/INTERNAL_IDENTITY_DIRECTORY_RECONCILIATION_V1.md in mayf3/svc-workflow
    52	(disposition CASE C: at base, /v1/agents is unauthenticated and strips the disabled flag;
    53	/scheduler/* serves run history under a different accepted authority; the LOCAL broker
    54	resolver inherits the auth-side agent-only/HR-grant chain; no generic internal read
    55	existed).
    56	
    57	## Contracts
    58	
    59	### CTR-IAD-001 — Exact directory surface
    60	
    61	GET /v1/directory/agents/:agentId accepts one exact ID, no body/query/list. After caller
    62	authentication, validate existing accepted canonical Agent ID syntax preserving exact
    63	bytes; reject malformed/legacy/prefix-normalized/name input with 400 INVALID_AGENT_ID;
    64	never return a guessed or substituted ID. Mount only on the reviewed production runtime
    65	server; loopback placement alone is not authentication; no browser CORS credential
    66	access; the mobile /v1/agents projection is not altered and remains unauthenticated
    67	presentation data.
    68	
    69	### CTR-IAD-002 — Generic internal caller authorization
    70	
    71	Require the existing Auth V1 RS256 issuer/JWKS/time/token_use direct-machine profile
    72	(scheduler-auth verifier), exact single audience `agent-directory`, scope
    73	`agent.directory.read`, caller principal_type agent or service, with the verifier's
    74	existing time policy (the superseded 5-second issued-at pin is retired; consumers bound
    75	their own per-command freshness where their owning contracts require it). Expired/
    76	invalid/signature/issuer/audience/profile errors return 401 UNAUTHORIZED; an otherwise
    77	valid caller missing the required scope returns 403 ACCESS_DENIED before the target
    78	read. Offline JWKS verification retains the bounded revocation race already accepted for
    79	the scheduler surfaces; no Workflow-audience token, human token, provisioning identity,
    80	source IP or display-name allowlist satisfies this route.
    81	
    82	DIRECTORY_READ_ELIGIBLE_CALLERS = all ACTIVE authenticated canonical internal AGENT
    83	Principals and SERVICE Principals. The minimal canonical Agent directory read is a
    84	BASELINE INTERNAL DIRECTORY CAPABILITY: consumers MUST NOT create their own lookup
    85	Principal, lookup Client, consumer-specific directory audience, or consumer-specific
    86	directory Grant policy to obtain it; where the issuance law requires a grant, it
    87	represents ONE centrally governed baseline directory-read entitlement applied through
    88	the normal canonical identity provisioning/activation machinery, and no per-consumer
    89	directory grant decision is required (PER_CONSUMER_DIRECTORY_GRANT_DECISION_REQUIRED =
    90	NO). The retired Workflow-specific audience workflow-agent-admission, scope
    91	agent.definition.admission.read and dedicated Workflow admission identity (principal
    92	cedb954a-3d99-4e5a-b568-d312441bcc56, client svc-workflow-canonical-admission-v1)
    93	MUST NOT be provisioned or re-introduced.
    94	
    95	### CTR-IAD-003 — Authoritative exact Agent observation
    96	
    97	Read the production runtime's authoritative Agent Definition snapshot synchronously and
    98	coherently; require exactly one exact ID with valid canonical syntax. Duplicate/corrupt
    99	snapshot=409 AGENT_DEFINITION_AMBIGUOUS; unknown storage/definition error=500
   100	AGENT_DEFINITION_QUERY_FAILED; 1-second operation deadline=504
   101	AGENT_DEFINITION_TIMEOUT with late results never becoming success. Success returns
   102	exactly {agentId, exists, enabled} where exists reflects snapshot presence and enabled
   103	reflects disabled != true; a missing exact ID returns 200 with {agentId, exists:false,
   104	enabled:false} (existence is the authorized minimal datum; no error-shape guessing), and
   105	a disabled Agent returns {agentId, exists:true, enabled:false}. The superseded
   106	observationDigest field is dropped. No name/workspace/credential/config/session data is
   107	disclosed. Cache-Control: no-store; no automatic retry; no positive result cache across
   108	commands; this route verifies Agent status only and never proves an Auth Principal
   109	relation.
   110	
   111	### CTR-IAD-004 — Zero side effects and bounded integration
   112	
   113	No Agent/session/wake/send/scheduler/definition mutation, credential issuance, identity
   114	rewrite or business transition occurs. The bounded adaptation of the branch-local
   115	implementation is: route prefix rename to /v1/directory/agents, caller-predicate
   116	generalization (audience/scope per CTR-IAD-002, accept agent and service principals,
   117	drop the pinned constants and the 5-second iat check), response reshaped to
   118	{agentId, exists, enabled} with missing-ID converted from 404 to 200 exists:false, and
   119	matching test updates. Freeze exact file closure; comply with structure guardrails; no
   120	new generic registry/identity framework; the Auth directory grant registrations are not
   121	supply authority in this repository.
   122	
   123	### CTR-IAD-005 — Consumer, release and rollback conditions
   124	
   125	Consumers (Workflow admission, HR, Scheduler, Forum, other canonical callers) must
   126	authorize their own business actor separately, obtain fresh observations for every
   127	affected identity within their own command window, and commit only on exists==true &&
   128	enabled==true where their owning contract so requires. Deployment requires accepted
   129	owning heads, exact implementation review/tests, target/preimage proof, shared mutation
   130	slot IDLE, health and durable receipt/readback; deploy a bounded reviewed artifact, not
   131	whole latest main. Failure withdraws this route; never enable invalid assignments as a
   132	fallback. Existing LOCAL Broker resolver/HR dispatch remain governed by their accepted
   133	authority.
   134	
   135	### CTR-IAD-006 — Acceptance boundary
   136	
   137	| Acceptance | Contracts | Method/environment/evidence | Expected / failure |
   138	|---|---|---|---|
   139	| ACC-IAD-001 |001| exact HTTP route fixtures at implementation head | malformed/query/body/list/legacy/name inputs deny; no unintended exposure |
   140	| ACC-IAD-002 |002| real signed V1 fixtures for agent AND service callers plus verifier failure injection | both caller types succeed; human/wrong-audience/wrong-scope/expired deny before target read |
   141	| ACC-IAD-003 |003| authoritative snapshot fixtures + concurrent disable/timeout tests | exists/enabled discriminate missing/disabled/enabled; no stale cache; late result denied |
   142	| ACC-IAD-004 |004| diff/structure gate/write spies/secret sentinels | closed file set; zero side effects/disclosure; digest absent |
   143	| ACC-IAD-005 |005| consumer integration at pinned accepted owning heads | Workflow admission fail-closed intact; varied internal callers resolve; no premature Goal completion |
   144	
   145	## Additive amendment for #525 — proposed for independent acceptance
   146	
   147	Owner direction supplied in the 2026-11-02 execution task: "#525 接受".
   148	This bounded delta is proposed together with PR #535's source integration under
   149	accepted governance adoption V3's atomic AMEND + DURABLE route. Existing
   150	CTR-IAD-001..006 remain accepted and unchanged; the two new IDs below require
   151	independent review and explicit acceptance before merge. This section grants no
   152	production operation and does not change caller eligibility or target enabled truth.
   153	
   154	### CTR-IAD-007 — Configuration failure before resource acquisition
   155	
   156	When the production Product API is enabled (explicit composition option takes
   157	precedence over PRODUCT_API_ENABLED), its directory handler MUST require a nonempty
   158	JWKS URL at construction. A missing URL MUST reject composition before channel
   159	connections, listeners, scheduler or workflow engines are acquired. A disabled
   160	Product API MUST NOT construct this handler or require its JWKS configuration.
   161	Construction performs no network probe and proves configuration presence only.
   162	Invalid tokens and unavailable JWKS at request time retain CTR-IAD-002's fail-closed
   163	401 response, subject to CTR-IAD-003's existing operation deadline; no authorization
   164	or enabled gate is bypassed.
   165	
   166	### CTR-IAD-008 — Identity-free verifier observations
   167	
   168	The existing loopback Product API GET /health retains HTTP 200, ok:true and its
   169	service identifier, and adds admission: null when no directory handler is mounted,
   170	or {configured:true,state} for a configured handler. State starts as unproven;
   171	a successful token verification sets ready; an observed JWKS infrastructure
   172	verification failure sets auth_unavailable. Ordinary invalid tokens do not change
   173	state. A later successful verification restores ready without automatic retry.
   174	Ready may use the verifier's accepted bounded JWKS cache; it proves neither current
   175	JWKS reachability, caller scope, target enabled status nor cross-service/business
   176	success. This is request-driven observation, not an active canary or alert SLA.
   177	Warn once on entering auth_unavailable and once on recovery to ready. Health and
   178	warnings contain no token, principal, credential or target identity; a failing warn
   179	sink MUST NOT change admission. Directory response shapes remain unchanged.
   180	
   181	| Acceptance | Contracts | Method/environment/evidence | Expected / failure |
   182	|---|---|---|---|
   183	| ACC-IAD-007 |007| isolated production composition fixtures at exact candidate, enabled/disabled env and option combinations, ordering observation | missing URL rejects before resource mounts; disabled composition succeeds without JWKS; no network needed at construction; contrary behavior fails |
   184	| ACC-IAD-008 |008| signed JWT/JWKS fault fixtures plus loopback /health tests at exact candidate, secret sentinels and failing log sink | unproven/ready/auth_unavailable/recovery, bounded warnings, invalid-token neutrality and frozen wire shapes pass; identity disclosure, false readiness claim or admission gated by logging fails |
   185	
   186	## Status and alternatives
   187	
   188	Rejected: keeping the dedicated single-caller admission route (Owner-superseded);
   189	authenticating the mobile /v1/agents projection (changes its accepted Gate-1 contract);
   190	local registry copies; a new generic identity service; fuzzy/display-name lookup;
   191	anonymous existence probing. Acceptance obligation: the acceptance transaction must atomically flip the predecessor
   192	AGENT_CORE_WORKFLOW_CANONICAL_ADMISSION_V1 to superseded_by this Spec's accepted head in
   193	the same docs-only change, and pin this Spec's exact reviewed head into any consuming
   194	authority's external_authorities revision field.
   195	
   196	STATUS=proposed; IMPLEMENTATION_ALLOWED_NOW=NO;
   197	PRODUCTION_READY=NO. Requires independent semantic review and exact-head Owner
   198	acceptance before implementation continues under it. The superseded parent's pinned
   199	caller objects and audience workflow-agent-admission are retired by this document.
     1	---
     2	spec_id: PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1
     3	status: accepted
     4	spec_kind: implementation
     5	authority_level: governing_spec
     6	implementation_authority: contracts
     7	scope:
     8	  - host-local production deployment queue and train
     9	  - immutable multi-goal deployment units and independent receipts
    10	  - allowlisted privileged controller and explicit profile activation
    11	governed_by:
    12	  - AGENT_CORE_HARDENING_PROGRAM_V1
    13	external_authorities: []
    14	supersedes: []
    15	superseded_by: null
    16	owners:
    17	  - mayf3
    18	accepted_by: mayf3
    19	accepted_date: 2026-09-17
    20	accepted_reviewed_head: 39865536ce51005f95a98473e77c2329078512c0
    21	independent_review_result: PASS
    22	production_apply_authority: none
    23	---
    24	
    25	# Production Deployment Control Plane V1
    26	
    27	**ACCEPTED for implementation, tests, independent review and non-production
    28	verification.** Owner explicitly accepted reviewed commit `3986553` in task
    29	`01a0ad06-249f-7632-809b-961b93c3b113` on 2026-09-17. The lifecycle merge activates
    30	`implementation_authority: contracts`; production mutation, LaunchDaemon install/
    31	enablement, sudoers changes, bootstrap and live legacy-path cutover remain forbidden.
    32	
    33	## 1. Goal, scope and authority
    34	
    35	Business Goals deliver `DEPLOYMENT_READY`; one shared Train turns approved immutable
    36	releases into receipted production outcomes. Multiple development Goals may proceed
    37	concurrently; production mutation concurrency is one per host across all enrolled
    38	targets. Scope is this macOS host, not a distributed lock or general remote executor.
    39	
    40	This NEW authority owns a new durable deployment interface, permission boundary,
    41	queue lifecycle and artifact transaction protocol. It preserves hardening trust
    42	boundaries, Scheduler/Router unknown-outcome semantics, domain business authority,
    43	accepted backup retention and each Goal's acceptance. It creates no new Agent
    44	identity, Grant, business-data repair, Scheduler retry, or process-fence bypass.
    45	No active standing deployment Spec is silently amended or partially superseded.
    46	Historical exact-release mandates remain records for those releases; they do not
    47	authorize future autonomous deployment. Any active Contract conflict discovered
    48	in profile adoption requires a whole-authority successor before that profile activates.
    49	
    50	The unmerged stage-isolation document at `569720870781efdc15e36d71c8728fb29b8dc2bd`
    51	is historical input only. This Spec adopts immutable generations and separate
    52	rollback evidence but assigns generation ownership to the Train, not one Goal.
    53	
    54	Evidence and provenance: [fresh census](../investigations/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_CENSUS.md),
    55	OBS/CLM/EVD-DCP-001 through 005 as applicable. Canonical design base:
    56	`d602b592fad345fb1c9adebe2bc6611a6f5cfdc2`. Claims of production readiness are absent.
    57	
    58	## 2. Decisions
    59	
    60	- DEC-DCP-001: deploy immutable artifacts, independently verify covered Goals.
    61	- DEC-DCP-002: root `agent-deployd` enforces all admission and transaction decisions;
    62	  the non-root Train proposes grouping/order, builds and monitors but cannot grant itself authority.
    63	- DEC-DCP-003: fixed privileged profiles; no caller-supplied shell, code hook, path,
    64	  environment, UID/GID, launchctl target, migration or rollback command.
    65	- DEC-DCP-004: one durable queue and mutex; crash recovery is readback-driven, never
    66	  timeout-driven replay. Default independent-unit failure policy is `STOP_TRAIN`.
    67	- DEC-DCP-005: explicit once-per-profile bootstrap/adoption, then standing routine
    68	  authority. A new privilege/profile/controller change is not a routine release.
    69	
    70	All decisions above are proposed for Owner acceptance together. Normative choices
    71	are specified below; acceptance and privileged bootstrap remain separate acts.
    72	
    73	## 3. Components and trust
    74	
    75	```text
    76	Goal producers -> authenticated ready registry -> non-root planner/build workers
    77	                                               -> immutable release proposal
    78	trusted build/review/authority issuers ---------> root admission verifier
    79	                                                 durable queue / Train ordering
    80	                                                 GLOBAL_PRODUCTION_MUTATION_MUTEX
    81	                                                 fixed profile executor
    82	                                                 rollback + per-Goal receipts
    83	```
    84	
    85	The implementation uses a compiled native privileged core with kernel peer identity
    86	and descriptor-relative filesystem operations (Rust is the planned implementation).
    87	No package manager or candidate JavaScript/Python/shell runs as root during build,
    88	artifact validation, or generic health verification. Fixed root-executed services
    89	such as Watchdog W2 are explicit privileged payload facets, requiring the profile's
    90	root-code review policy; they cannot be hidden in an ordinary app-only artifact.
    91	
    92	Bootstrap layout: `/usr/local/libexec/agent-deployd/` executable closure,
    93	`/Library/LaunchDaemons/ai.agent-deployd.plist`,
    94	`/var/db/agent-deployd/` durable catalog/queue/journal/artifacts/rollback/receipts,
    95	and `/var/run/agent-deployd/control.sock`. Code, plist and trust/profile policy are
    96	root:wheel and non-writable by callers; protected state 0700, ordinary policy files
    97	0644, private trust/receipt material 0600. Socket parent is root-owned 0750 and
    98	socket 0660 for a dedicated bootstrap-resolved caller group. All numeric identities,
    99	ancestors, ACLs and interpreter/library closure are frozen in the bootstrap receipt.
   100	No assumption that existing `staff` membership is a safe deployment permission.
   101	
   102	## 4. Contracts
   103	
   104	### CTR-DCP-001 — readiness admission and exhaustive discovery
   105	
   106	A producer MUST register a durable readiness record with goal ID, source/repo,
   107	accepted authority revisions, artifact requirements, dependency constraints,
   108	verification profile and originating issuer. Only an authenticated producer may
   109	update its records with revision CAS. `source-fixed`, `merged`, task titles or
   110	caller strings `review=PASS` MUST NOT imply DEPLOYMENT_READY. The Train consumes a
   111	complete paginated snapshot plus cursor-based changes and records census revision;
   112	disconnection retains queued work but cannot infer new readiness. Registered
   113	producer watermark gaps block claims of an exhaustive census. Manual historical
   114	import requires provenance and an explicit importer receipt, never guessed closure.
   115	
   116	### CTR-DCP-002 — canonical immutable DeploymentUnit
   117	
   118	The canonical versioned record MUST contain:
   119	
   120	```text
   121	deployment_unit_id, deployment_profile, profile_revision, target_runtime, repo,
   122	source_sha, artifact_sha256, build_attestation_digest, manifest_digest,
   123	deployment_intent_id, desired_state_revision, expected_target_generation,
   124	covered_goal_ids[], goal_coverage[], dependency_units[], required_reviews[],
   125	preflight_policy, privileged_apply_profile, restart_profile,
   126	verification_profiles[], rollback_profile, standing_authority_revision,
   127	policy_epoch, receipts[]
   128	```
   129	
   130	Identifiers have bounded ASCII schemas; repo/profile/runtime IDs resolve only in
   131	the protected catalog. Goal coverage binds exact acceptance contract revisions,
   132	source inclusion and reviewed release-face hashes. Runtime identity includes host,
   133	launchd domain, label and install-root identity; system/gui labels are distinct.
   134	`receipts[]` are immutable references appended in the journal, not edits to the
   135	sealed artifact. Artifact identity is `(repo, source, artifact digest)`. A request
   136	ID provides transport idempotency. The daemon alone allocates a monotonic deployment
   137	intent for an authenticated desired-state revision and expected target generation;
   138	callers cannot allocate intents or reset attempt budgets by changing request IDs.
   139	Target generation identifies the daemon's installed release record, distinct from
   140	service process generation/PID. Rollback may restore that release record only with
   141	verified restored bytes/metadata and a separately recorded fresh process readback.
   142	Durable unit ID derives from the canonical immutable descriptor. Deployment dedupe
   143	is `(target, intent, profile revision, artifact digest)`; execution attempts are
   144	append-only journal records under that unit, not mutations of its descriptor.
   145	Goal/review/policy changes cannot silently mutate a unit. Late identical-artifact
   146	Goals use a new immutable coverage attachment and existing install receipt.
   147	
   148	### CTR-DCP-003 — collapse and coverage
   149	
   150	The queue MUST enforce one successful installation per intent, coalescing simultaneous
   151	submissions and transport retries. If the required artifact is already installed
   152	and its generation/metadata is verified, attach verification with zero install or
   153	restart. A legitimate A→B→A desired-state transition gets a new daemon intent and
   154	fresh B preimage; it is not a duplicate of A's historical transaction. A failed
   155	attempt may be re-admitted only under CTR-DCP-011, never by a caller-chosen new ID.
   156	It MUST collapse ready Goals into the same
   157	artifact only when one reviewed manifest proves every required face, acceptance
   158	contract and dependency is covered. Newer SHA ancestry alone does not prove
   159	coverage (reverts and integration changes are counterexamples). Profiles targeting
   160	overlapping install roots cannot create separate concurrent release ownership.

exec
/bin/zsh -lc "git show origin/main:.agents/README.md | sed -n '1,38p'; git diff f767e8d6608cdb0917aad2d471ba0454d0966a0f..origin/main -- docs/decisions/README.md docs/decisions/SCHEDULER_OCCURRENCE_OUTCOME_V3.md docs/specs/AGENT_CORE_INTERNAL_AGENT_DIRECTORY_V1.md docs/specs/PRODUCT_API_AUTHENTICATION_V1.md docs/specs/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1.md; nl -ba /Users/yanfenma/.codex/memories/MEMORY.md | sed -n '1797,1807p'; nl -ba /Users/yanfenma/.codex/memories/rollout_summaries/2026-08-28T14-38-36-F0Ib-pr97_forum_moderation_fixed_sha_audit_revise.md | sed -n '14,23p'; nl -ba /Users/yanfenma/.codex/memories/skills/fixed-sha-pr-audit/SKILL.md | sed -n '11,25p'" in /tmp/review-609/repo
 succeeded in 0ms:
# Development Grammar V1

```text
GRAMMAR_VERSION = 2.0.0-rc.3
GOVERNING_AUTHORITY = AGENT_DEVELOPMENT_GOVERNANCE_V1
STATUS = accepted
ENFORCEMENT_LEVEL = manual_policy_plus_deterministic_integrity
```

This is the shared operating grammar for repositories developed across many Agent sessions. Product Direction, Architecture, governing Specs, investigations, implementation records, and runtime evidence remain in their owning repository.

After this file, read `.agents/local/README.md` when present.

## Context budget

For an ordinary task, load only:

1. this grammar;
2. repository-local governance;
3. directly relevant accepted authorities;
4. the Spec-governance router and one selected mode.

Do not preload every protocol, template, rationale, prior review, or example. Resume from the existing current task/release record and its directly referenced active authorities and Evidence. Read historical records only to resolve a specific provenance or dependency question; their age or filename does not determine authority. Keep historical evidence readable without loading it as the control plane.

## Minimum loop

```text
1. Fix target repository, candidate Head, and integration Base.
2. State GOAL/TARGET and CURRENT_GAP.
3. Locate Product Authority in precedence order.
4. Separate OBSERVATION from WORKING_GUESS when interpretation affects routing.
5. Classify independently: AUTHORITY_ACTION, PLAN_LEVEL, ASSURANCE_LEVEL.
6. Check Execution Mandate, load-bearing SPEC_GAP, Evidence reviewability,
   live authority gap, and candidate/Base movement.
7. Select the shortest authorized route and artifact set.
8. Execute only within accepted Contracts and the mandate.
9. Review the affected surface with executed Evidence.
10. DONE_WHEN met without EXPANSION_TRIGGER -> STOP.
  1797	- PR97, forum-moderation, SPEC_AUTH_SCHEME_RE, sanitizeErrorDetail, AUTH_REDACTED, CODE_STRUCTURE_GUARDRAILS_V1, structure-gate, forum.js, transport.js, 202/202
  1798	
  1799	## User preferences
  1800	
  1801	- when the user requires “本轮只读” or “不修改、不 merge、不 deploy、不改 Grant、不改 Forum 数据” -> pin and revalidate `REVIEW_BASE`/`REVIEW_HEAD` before major phases and the final report; make no acceptance, merge, implementation, Grant, Forum-data, or deployment change [Task 2]
  1802	- when the requested audit names PASS/REVISE, blockers, required fixes, and readiness -> report every gate explicitly and do not recommend acceptance/merge while any requested gate fails [Task 2]
  1803	
  1804	## Reusable knowledge
  1805	
  1806	- Related skill: skills/fixed-sha-pr-audit/SKILL.md [Task 2]
  1807	- A supplied PR base can be `baseRefOid` rather than a head ancestor. Use the three-dot diff and actual merge-base to assess PR scope; PR #97 retained its nine authorized files despite a non-ancestor supplied base. [Task 1]
    14	
    15	Preference signals:
    16	- The user explicitly required fixed-SHA, read-only auditing: “不修改、不 merge、不 deploy、不改 Grant、不改 Forum 数据” and demanded explicit gate fields and PASS/REVISE. Future audits should preserve this boundary, recheck remote SHAs before final conclusions, and avoid merge recommendations until every requested gate passes.
    17	
    18	Key steps:
    19	- Verified remote PR head remained exactly `ad4e9e316aa445609f31e2522f64bf53f72db2ad`; no head drift.
    20	- Found supplied base is not a head ancestor; merge-base is Spec merge commit `97ff7863e9ca93f139818d11233ce3c08fdf438f`. PR three-dot diff nevertheless contains exactly the nine specified files and no extras.
    21	- Used a clean detached implementation worktree at the pinned head and a separate base worktree for A/B comparison.
    22	- Broker package tests passed exactly `202/202`; coverage included normal/moderator packs, visibility, scopes, PATCH, nonBlank, enum fail-fast, soft-delete routes, resolve/archive, report queue/actions, admin unread, sanitizer, and frozen seven-tool projections.
    23	- Governance verifier passed: `vendored governance bytes match governance.lock.json`.
    11	## When to use
    12	
    13	Use for requests such as “不修改代码、不部署、不合并”, fixed `REVIEWED_HEAD`/`BASE_SHA`, or an explicit Blocker/High and merge-readiness review. `$0` is the repository; `$1` is the PR number; `$2` optionally narrows the contract or behavior to audit.
    14	
    15	Do not use this to implement a fix, deploy, merge, or certify a branch that was not rechecked remotely. For a broad architecture review without a pinned PR, use the architecture-audit workflow instead.
    16	
    17	## Inputs and context
    18	
    19	1. Record the supplied PR number, head SHA, base SHA, requested scope exclusions, and requested severity threshold.
    20	2. Inspect working-tree state without altering it; use an isolated detached worktree/archive only if needed.
    21	3. Obtain remote `refs/pull/$1/head` and the base object. Record changed files and verify the supplied objects exactly match; if the supplied base is not a head ancestor, also record the actual merge-base and assess the three-dot diff.
    22	4. Identify the real runtime/persistence evidence for the focus area, including any supplied real record or canary database.
    23	
    24	## Procedure
    25	

codex
关键核对已完成：本地 main 保留 #555 的 containment，但未见 `e9a61dee` 或等价的 bind retry／专用测试增量，Spec 的已修／未修划分成立。#554 后续评论中“e9 已 main”的表述与本地源码不符。SRA、DCP、SOD 检查未发现扩权冲突；该稿仍将生产拓扑、装载与业务结果标为 UNKNOWN。
exec
/bin/zsh -lc "git show origin/main:packages/product-api/src/history-listener.js | nl -ba | sed -n '196,225p'; git show origin/main:docs/runbooks/ADMISSION_SEAM_OPERATOR_RUNBOOK_V1.md | nl -ba | sed -n '1,52p'; git show origin/main:docs/specs/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1.md | nl -ba | sed -n '210,238p'; git diff f767e8d6608cdb0917aad2d471ba0454d0966a0f..origin/main -- .agents/README.md" in /tmp/review-609/repo
 succeeded in 0ms:
   196	        if (outcome.pageCount !== undefined) fields.push(`pageCount=${outcome.pageCount}`)
   197	        writeLog(fields.join(' '))
   198	      })
   199	      .catch(() => {
   200	        if (!res.headersSent) sendJson(res, 500, errorEnvelope('INTERNAL_ERROR', 'internal error'))
   201	        else res.destroy()
   202	      })
   203	  })
   204	
   205	  server.requestTimeout = 0
   206	  server.headersTimeout = 30000
   207	  // The history surface is OPTIONAL: a bind failure (e.g. the pinned
   208	  // tailscale IP disappearing across a network change, 2026-10-23) emits an
   209	  // async 'error' event. Without a handler it escapes as an uncaught
   210	  // exception and kills the WHOLE runtime — taking the admission core
   211	  // (served by the same process) down with it. Log and stay up instead.
   212	  server.on('error', (error) => {
   213	    console.error(`[history-listener] bind/serve failed; history route unavailable: ${error?.code ?? ''} ${error?.message ?? error}`)
   214	  })
   215	  server.listen(port, host)
   216	
   217	  return {
   218	    server,
   219	    address: () => server.address(),
   220	    close: () => new Promise((resolveClose) => server.close(() => resolveClose())),
   221	  }
   222	}
     1	# ADMISSION_SEAM_OPERATOR_RUNBOOK_V1
     2	
     3	Goal: 把 svc-workflow admission 链路（10-17 事故面，PRODUCT #525）的**稳定脱敏错误码**映射到
     4	操作员动作，并冻结 agent 侧求助/重试规约（P4+P5）。本文件零生产变更；P2 跨服务 canary 探针
     5	**不在本 runbook 内**（deferred，与 #523 R3 绑定漂移、#527 D3 scheduler health 合并评审，
     6	禁止重复 watcher/probe）。
     7	
     8	**脱敏红线（继承 AGENT_CORE_WORKFLOW_BROKER_ERROR_PRESERVATION_V1 R3）**：错误码/detail 永远
     9	不含 principal UUID、token、URL 凭据、会话内容。本 runbook 只记录 code 名与动作，不记录任何
    10	身份素材。
    11	
    12	## §1 Admission 链路坐标（哪个环节断了，code 会说话）
    13	
    14	```text
    15	agent ──mint──▶ auth-service ──token──▶ svc-workflow admission
    16	                                          │  (WORKFLOW_ADMISSION_ENABLED=1)
    17	                                          ├─ AUTH_BASE_URL  → auth-service 验 token
    18	                                          └─ CORE_BASE_URL  → agent-core 目录读
    19	                                               GET /v1/directory/agents/:agentId
    20	                                               （agent-core 侧验证器 JWKS 来源 =
    21	                                                AGENT_DIRECTORY_AUTH_JWKS_URL）
    22	```
    23	
    24	- svc-workflow 侧 env：`WORKFLOW_ADMISSION_ENABLED` / `WORKFLOW_ADMISSION_AUTH_BASE_URL` /
    25	  `WORKFLOW_ADMISSION_CORE_BASE_URL`（svc github/main bfc28c15 src/auth/admission.rs）。
    26	- agent-core 侧 env：`AGENT_DIRECTORY_AUTH_JWKS_URL`（compose 挂载
    27	  `createWorkflowAdmissionHandler`；**缺失即拒绝组合启动**——P1 fail-loud，不再静默全 401。
    28	  精确语义：仅当 product API enabled 时要求该 env；`PRODUCT_API_ENABLED=0` 的组合不受影响）。
    29	
    30	## §2 svc-workflow `admission_*` 稳定错误码 → 操作员动作
    31	
    32	来源：svc @ bfc28c15320acab8cf7d7a36128cd5c9db9a1b1a `sanitized_code()/sanitized_status()`
    33	（已核对 github/main）。**422 = 单 principal 业务拒绝；503 = 基础设施/不确定，全局性**——
    34	先看 4xx/5xx 分类即可分辨"我的参数错了"还是"基础设施挂了"（#525 P4c）。
    35	
    36	| code | HTTP | 含义 | 操作员动作 |
    37	|---|---|---|---|
    38	| `admission_rejected` | 422 | principal 被 admission 拒绝（单主体） | 核对该 agent 的 principal/enabled 状态；确认 agent 在 auth-service ACTIVE 且未被禁用 |
    39	| `admission_denied` | 422 | 该 caller 的 assignment admission 被拒（单主体） | 核对 caller 对目标 assignment 的授权关系；无需重启任何服务 |
    40	| `admission_timeout` | 422 | admission 检查超时未出决定 | 先重试一次（见 §4）；连续超时→检查 auth/agent-core 目录服务延迟与健康位 |
    41	| `admission_unavailable` | 503 | admission 目录不可达（**全局性**） | 检查 agent-core product-api 是否存活：`GET /health` 看 `admission.state`；检查 `WORKFLOW_ADMISSION_CORE_BASE_URL` 指向 |
    42	| `admission_configuration` | 503 | admission 目录配置错误（**全局性**） | 核对 svc 侧两个 BASE_URL env 与 agent-core 侧 `AGENT_DIRECTORY_AUTH_JWKS_URL`；配置修复需重启对应 runtime（走部署授权，勿热改） |
    43	| `admission_malformed_response` | 503 | 目录返回畸形响应（**全局性**） | 抓 agent-core 侧日志/evidence；多半是版本错配——对齐两侧部署代次 |
    44	| `admission_commit_outcome_unknown` | 503 | commit 阶段结果不确定，服务端已 fail-closed | **不是盲目重试信号**：先核对实例/版本实际状态，再决定是否安全重试（§4 规约同样适用但必须先读状态） |
    45	
    46	## §3 agent-core 目录读侧码（同一链路的上游断点）
    47	
    48	路由 wire 契约冻结于 AGENT_CORE_INTERNAL_AGENT_DIRECTORY_V1（CTR-IAD-002/003），本 runbook
    49	不改码、只映射：
    50	
    51	| code | HTTP | 含义 | 操作员动作 |
    52	|---|---|---|---|
   210	Per-actor quotas/rate limits prevent one caller starving the queue. Submission ACK
   211	follows durable commit; retries return the same request/unit state without replay.
   212	Caller disconnect has no cancel semantics. Receipt output is actor-scoped/redacted.
   213	
   214	### CTR-DCP-008 — privileged profile contract
   215	
   216	Each reviewed root-side profile MUST freeze legal repo/source lineage, build/CAS
   217	origin, staging root, exact install slots, permitted file types/UID/GID/mode/ACL,
   218	launchd domains/labels, typed config keys/destinations, rollback semantics, probes,
   219	root-executed closure review and resource/time limits. Runtime app code must run as
   220	the existing service identity, not as an arbitrary root verifier. External programs
   221	use fixed absolute executable/argument templates, sanitized environment and no shell.
   222	No environment override, PATH fallback, arbitrary chmod/chown/launchctl or recursive
   223	ownership repair. Profiles cannot load candidate-supplied plugins. Updating daemon,
   224	its policy/trust roots or expanding targets/privilege requires separate Owner authority.
   225	
   226	### CTR-DCP-009 — one mutex over the transaction
   227	
   228	The permanent root-owned mutex inode is `/var/db/agent-deployd/production.lock`;
   229	only the daemon owns its exclusive OS lock. It is never unlinked/replaced for
   230	stale-lock recovery. All enrolled targets share it, even across repositories.
   231	Speculative read-only preflight may run earlier; authoritative PRECHECK, APPLY,
   232	ROUTING/CONFIG, RESTART, READBACK, ACCEPTANCE, ROLLBACK/FINALIZE and RELEASE all
   233	execute under one acquisition. Profile components cannot acquire independent locks,
   234	accept “lock held” strings or release their parent's lock. Pending queue wait does
   235	not hold the mutex. Child operations are bounded/owned and must be reconciled before
   236	releasing transaction ownership; daemon exit alone is not proof they stopped.
   237	
   238	### CTR-DCP-010 — queue order and dependency failures
diff --git a/.agents/README.md b/.agents/README.md
index 707369d6..e3493fbf 100644
--- a/.agents/README.md
+++ b/.agents/README.md
@@ -1,7 +1,7 @@
 # Development Grammar V1
 
 ```text
-GRAMMAR_VERSION = 2.0.0-rc.1
+GRAMMAR_VERSION = 2.0.0-rc.3
 GOVERNING_AUTHORITY = AGENT_DEVELOPMENT_GOVERNANCE_V1
 STATUS = accepted
 ENFORCEMENT_LEVEL = manual_policy_plus_deterministic_integrity

exec
/bin/zsh -lc 'GIT_OPTIONAL_LOCKS=0 git status --short; git rev-parse HEAD origin/main; git diff --numstat origin/main...HEAD; git diff --check origin/main...HEAD; shasum -a 256 docs/specs/AGENT_CORE_ADMISSION_RUNTIME_RELIABILITY_V1.md; git rev-parse HEAD:docs/specs/AGENT_CORE_ADMISSION_RUNTIME_RELIABILITY_V1.md' in /tmp/review-609/repo
 succeeded in 37ms:
7f4cf5b5e3ea9ada879617d506e3c921cefe8308
937d9cbc58431fe8421405066f04b2a226928ee6
439	0	docs/specs/AGENT_CORE_ADMISSION_RUNTIME_RELIABILITY_V1.md
47077699890115b69cfb8e3978ad742f3f1d3a8f7b47d92b102bc895b4f457ea  docs/specs/AGENT_CORE_ADMISSION_RUNTIME_RELIABILITY_V1.md
163d177aa9658ce0a49a4e7e5ab176df789a633c

codex
本人未参与该稿创作，`AUTHOR_INDEPENDENCE=PASS`。六项均 PASS；结论仅针对 proposed Spec 的语义，不构成正式接受或生产授权。

审查坐标：

- HEAD：`7f4cf5b5e3ea9ada879617d506e3c921cefe8308`
- 本地 `origin/main`：`937d9cbc58431fe8421405066f04b2a226928ee6`
- merge-base：`f767e8d6608cdb0917aad2d471ba0454d0966a0f`

1. **PASS — frontmatter。** 必填字段齐全，`status=proposed`、`production_apply_authority=none`、`external_authorities=[]`；仓内 Schema 校验零错误，未冒充 accepted。[Spec:1](/tmp/review-609/repo/docs/specs/AGENT_CORE_ADMISSION_RUNTIME_RELIABILITY_V1.md:1)、[SPEC_FORMAT §2](/tmp/review-609/repo/.agents/protocol/SPEC_FORMAT_V0.md:47)。

2. **PASS — 现状与 A/B 分界。** main 已有 #555 containment，listener 在 `listen` 前注册 error handler；仍无 bind retry／专用韧性测试，`e9a61dee` 非 main ancestor。目录不可达→503 模式与 main runbook 相符。Spec 保留已修部分，仅补余项；当前生产拓扑明确 UNKNOWN。[Spec:97](/tmp/review-609/repo/docs/specs/AGENT_CORE_ADMISSION_RUNTIME_RELIABILITY_V1.md:97)、[listener:207](/tmp/review-609/repo/packages/product-api/src/history-listener.js:207)、[runbook:41](/tmp/review-609/repo/docs/runbooks/ADMISSION_SEAM_OPERATOR_RUNBOOK_V1.md:41)。

3. **PASS — 不扩权。** 保留 loopback/Tailnet、caller/actor、freshness、fail-closed、UNKNOWN/no-replay/fence。独立单次 mandate 与当前 main 的 `SRA-C-002`、`CTR-SOD-003/005` 相符，不要求逐窗重新请 Owner 批准；未改变 DCP 权限。[Spec:219](/tmp/review-609/repo/docs/specs/AGENT_CORE_ADMISSION_RUNTIME_RELIABILITY_V1.md:219)、[Spec:272](/tmp/review-609/repo/docs/specs/AGENT_CORE_ADMISSION_RUNTIME_RELIABILITY_V1.md:272)、[Spec:314](/tmp/review-609/repo/docs/specs/AGENT_CORE_ADMISSION_RUNTIME_RELIABILITY_V1.md:314)。

4. **PASS — accepted 合同抽查。** IAD `CTR-IAD-001/003` 的 exact directory、权威快照、1 秒 deadline、no-store/no-auto-retry，以及 DCP `CTR-DCP-008/009` 的固定 profile／共享事务 mutex，坐标真实且语义相符；两份权威从观察 base 到 main 字节未变。[IAD:59](/tmp/review-609/repo/docs/specs/AGENT_CORE_INTERNAL_AGENT_DIRECTORY_V1.md:59)、[IAD:95](/tmp/review-609/repo/docs/specs/AGENT_CORE_INTERNAL_AGENT_DIRECTORY_V1.md:95)、[DCP:214](/tmp/review-609/repo/docs/specs/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1.md:214)。

5. **PASS — 验收与开放事项。** 10/10 Contracts 有 Acceptance 映射；`NORMATIVE_TBD=NONE`。正式接受、实现、installed/loaded、consumer 切换及业务验证均明确待执行或 UNKNOWN，没有把验收定义写成实测 PASS。[Spec:350](/tmp/review-609/repo/docs/specs/AGENT_CORE_ADMISSION_RUNTIME_RELIABILITY_V1.md:350)、[Spec:421](/tmp/review-609/repo/docs/specs/AGENT_CORE_ADMISSION_RUNTIME_RELIABILITY_V1.md:421)。

6. **PASS — 上游一致性。** 已实读 [#554 c6595519762](https://github.com/mayf3/dsh-agent-core/issues/554#issuecomment-6595519762)、[#555 c6370558723](https://github.com/mayf3/dsh-agent-core/pull/555#issuecomment-6370558723)及 [Scope A closure](https://github.com/mayf3/dsh-agent-core/issues/554#issuecomment-6370660745)，与引用相符。#555 head=`0ffb2175…`、merge=`3c651a6e…` 均吻合。后续 [c6705755897](https://github.com/mayf3/dsh-agent-core/issues/554#issuecomment-6705755897) 的“e9 已 main”与本地源码冲突，不影响目标稿历史引用的真实性。

未 fetch、未修复、未执行测试或生产操作；最终 HEAD/main 未漂移，工作树仍干净，`diff --check` 通过。

FINAL_VERDICT=PASS; FROZEN_BLOCKER_UNION=[]


tokens used
95,478
本人未参与该稿创作，`AUTHOR_INDEPENDENCE=PASS`。六项均 PASS；结论仅针对 proposed Spec 的语义，不构成正式接受或生产授权。

审查坐标：

- HEAD：`7f4cf5b5e3ea9ada879617d506e3c921cefe8308`
- 本地 `origin/main`：`937d9cbc58431fe8421405066f04b2a226928ee6`
- merge-base：`f767e8d6608cdb0917aad2d471ba0454d0966a0f`

1. **PASS — frontmatter。** 必填字段齐全，`status=proposed`、`production_apply_authority=none`、`external_authorities=[]`；仓内 Schema 校验零错误，未冒充 accepted。[Spec:1](/tmp/review-609/repo/docs/specs/AGENT_CORE_ADMISSION_RUNTIME_RELIABILITY_V1.md:1)、[SPEC_FORMAT §2](/tmp/review-609/repo/.agents/protocol/SPEC_FORMAT_V0.md:47)。

2. **PASS — 现状与 A/B 分界。** main 已有 #555 containment，listener 在 `listen` 前注册 error handler；仍无 bind retry／专用韧性测试，`e9a61dee` 非 main ancestor。目录不可达→503 模式与 main runbook 相符。Spec 保留已修部分，仅补余项；当前生产拓扑明确 UNKNOWN。[Spec:97](/tmp/review-609/repo/docs/specs/AGENT_CORE_ADMISSION_RUNTIME_RELIABILITY_V1.md:97)、[listener:207](/tmp/review-609/repo/packages/product-api/src/history-listener.js:207)、[runbook:41](/tmp/review-609/repo/docs/runbooks/ADMISSION_SEAM_OPERATOR_RUNBOOK_V1.md:41)。

3. **PASS — 不扩权。** 保留 loopback/Tailnet、caller/actor、freshness、fail-closed、UNKNOWN/no-replay/fence。独立单次 mandate 与当前 main 的 `SRA-C-002`、`CTR-SOD-003/005` 相符，不要求逐窗重新请 Owner 批准；未改变 DCP 权限。[Spec:219](/tmp/review-609/repo/docs/specs/AGENT_CORE_ADMISSION_RUNTIME_RELIABILITY_V1.md:219)、[Spec:272](/tmp/review-609/repo/docs/specs/AGENT_CORE_ADMISSION_RUNTIME_RELIABILITY_V1.md:272)、[Spec:314](/tmp/review-609/repo/docs/specs/AGENT_CORE_ADMISSION_RUNTIME_RELIABILITY_V1.md:314)。

4. **PASS — accepted 合同抽查。** IAD `CTR-IAD-001/003` 的 exact directory、权威快照、1 秒 deadline、no-store/no-auto-retry，以及 DCP `CTR-DCP-008/009` 的固定 profile／共享事务 mutex，坐标真实且语义相符；两份权威从观察 base 到 main 字节未变。[IAD:59](/tmp/review-609/repo/docs/specs/AGENT_CORE_INTERNAL_AGENT_DIRECTORY_V1.md:59)、[IAD:95](/tmp/review-609/repo/docs/specs/AGENT_CORE_INTERNAL_AGENT_DIRECTORY_V1.md:95)、[DCP:214](/tmp/review-609/repo/docs/specs/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1.md:214)。

5. **PASS — 验收与开放事项。** 10/10 Contracts 有 Acceptance 映射；`NORMATIVE_TBD=NONE`。正式接受、实现、installed/loaded、consumer 切换及业务验证均明确待执行或 UNKNOWN，没有把验收定义写成实测 PASS。[Spec:350](/tmp/review-609/repo/docs/specs/AGENT_CORE_ADMISSION_RUNTIME_RELIABILITY_V1.md:350)、[Spec:421](/tmp/review-609/repo/docs/specs/AGENT_CORE_ADMISSION_RUNTIME_RELIABILITY_V1.md:421)。

6. **PASS — 上游一致性。** 已实读 [#554 c6595519762](https://github.com/mayf3/dsh-agent-core/issues/554#issuecomment-6595519762)、[#555 c6370558723](https://github.com/mayf3/dsh-agent-core/pull/555#issuecomment-6370558723)及 [Scope A closure](https://github.com/mayf3/dsh-agent-core/issues/554#issuecomment-6370660745)，与引用相符。#555 head=`0ffb2175…`、merge=`3c651a6e…` 均吻合。后续 [c6705755897](https://github.com/mayf3/dsh-agent-core/issues/554#issuecomment-6705755897) 的“e9 已 main”与本地源码冲突，不影响目标稿历史引用的真实性。

未 fetch、未修复、未执行测试或生产操作；最终 HEAD/main 未漂移，工作树仍干净，`diff --check` 通过。

FINAL_VERDICT=PASS; FROZEN_BLOCKER_UNION=[]


