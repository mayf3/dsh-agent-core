# SESSION_CENTRIC_EXECUTION_TRACEABILITY_V1 — Real Acceptance Record (§13)

- date: 2026-09-24
- method: STRICTLY READ-ONLY against existing production data on this machine (uid 502). Zero production side effects: no writes, no restarts, no deploy, no new dispatches. Content-free output: coordinates and verdicts only.
- implementation: branch `goal/session-centric-execution-traceability-v1` @ `8070b670`; spec `AGENT_CORE_SESSION_CENTRIC_EXECUTION_TRACEABILITY_V1` accepted @ `822477ab`.
- data roots exercised:
  - `~/.agent-core-scheduler-v2` (real scheduler fixture occurrences + homes; uid-502 readable)
  - `/Users/authsvc/.agent-core` (canonical runtime root; `homes/**` world-readable; `control/`, `scheduler/`, `workflow-execution/` are 700 authsvc → deliberate degradation legs)

## A1 — real scheduler job → occurrence/run → SessionRef ⇒ **PASS**

```jsonc
{"pickedOccurrenceId":"occ:dce1a037b1a56a16","jobId":"stock-daily-market-brief-001","agentId":"agt_stock_agent",
 "state":"succeeded","nativeSessionId":"cron-run-occ:dce1a037b1a56a16"}
→ execution_trace_query root=scheduler_run (self, zero-Auth face equivalent):
{"reportId":"ehq-5681123e51849d24","occurrenceSessionRef":"cron-run-occ:dce1a037b1a56a16",
 "sessionCreated":"created","journalLocated":true,
 "journalSessionId":"agt_stock_agent/cron-run-occ~003Adce1a037b1a56a16",
 "joinStrength":"DERIVED_EXACT","agentExecution":"STARTED"}
```

- New CTR-SCT-003/007 semantics observed on real data: ledger disposition `created` + journal existence proof ⇒ `DERIVED_EXACT` (no weak-name claim).
- Disabled-job leg verdicts honestly as `LEGAL_SKIP` (existing taxonomy, no new states).
- Canonical-root scheduler store unreadable from this uid ⇒ `scheduler_record_not_found` (404 family) — honest degradation, nothing fabricated.

## A2 — real agent_session_send ⇒ **PARTIAL (as designed; gap is environmental, not logical)**

- Target-side exact coordinates ARE durably present in real production journals: 3 real `inter_agent` landings found, each with `sourceAgentId` and `correlation` in the `turn:` namespace (CTR-ASM2-004 sidecar; e.g. `agt_16cf59bc…/main` ← `agt_hr-agent`; `agt_3d-print-agent/main` ← `agt_course-community-agent-2`).
- Reverse location from those coordinates via root=agent_session succeeds (`interAgentLegs:1`).
- Caller-side ASM audit rows live under canonical `control/` (700 authsvc) — unreadable from this uid. The query layer responds with an explicit `CORRELATION_GAP{stage:'inbound_dispatch'}` instead of a time/name-based guess — the no-fuzzy invariant holding on production data.
- The full dual-session chain closure (source turn → requestId → target messageId) is proven mechanically by T4 fixtures including WPA-1 archive-only rebuild; production in-process closure requires the canonical runtime identity (Phase B, post-deploy).

## A3 — real workflow attempt ⇒ **GAP (honest; consistent with census G6)**

- `workflow-execution/attempts.jsonl` absent/unreadable for this uid; no engine-dispatched WAE production sample exists at acceptance time (census G6: chain not yet exercised in production).
- The query layer reports SOURCE_ABSENT/CORRELATION_GAP — never inferred. Chain mechanics (attempt → SessionRef → `run_delivered.messageId` → business-commit bridge or explicit SOURCE_ABSENT) are proven by fixtures (T5), including the no-fabrication direction for a receipt-less run.

## A4 — plain non-workflow session via listing + sessionId query ⇒ **PASS**

```jsonc
listAgentSessions(viewer=agt_biz-reviewer): {"totalListed":2,"kinds":["main","other"],
 "plain":{"sessionId":"main","createdAtUtc":"2026-09-23T10:59:06.566Z","lastActiveAtUtc":"2026-09-23T11:01:03.206Z",
          "origins":{"user":false,"inter_agent":true,"workflow_execution":false}},"coordinateOnly":true}
→ root=agent_session (self): {"reportId":"ehq-54120f6b0c725ac5","turns":true,
  "fiveDimensions":{"evidenceIntegrity":"PARTIAL", ...honest UNKNOWN where canonical sources are out of boundary}}
```

- MY_SESSIONS surface works on real homes; kind/createdAt/lastActive/origins correct; response is coordinate-only (no content fields).
- `evidenceIntegrity: PARTIAL` honestly reflects that this process cannot read every source at the canonical root — "已查全" is never claimed.

## Verdict

ACCEPTANCE_STATUS = PASS_WITH_HONEST_GAPS — A1/A4 PASS on real production data; A2 PARTIAL and A3 GAP are environmental/production-scope facts reported by the system exactly as designed (SC-2 ABSENT ⇒ explicit gap), with the underlying mechanics proven by the T1-T9 fixture suite. No fuzzy correlation, no second ledger, no privacy boundary crossing, no production mutation.
