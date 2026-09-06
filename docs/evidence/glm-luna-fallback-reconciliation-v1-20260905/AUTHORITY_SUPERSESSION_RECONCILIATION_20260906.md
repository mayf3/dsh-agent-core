# AUTHORITY_SUPERSESSION_RECONCILIATION_20260906 — GLM_LUNA_FALLBACK_PRODUCTION_V1 resume, fresh reconciliation

```text
GOAL_NAME = GLM_LUNA_FALLBACK_PRODUCTION_V1
GOAL_MODE = RESUME_GOAL (Owner dispatch 2026-09-06 evening)
DISPATCH_PHASE = POST_ACCEPTANCE_CURRENT_MAIN_RECONCILIATION_AND_PREDEPLOYMENT_CLOSURE
DISPATCH_ANCHORED_AUTHORITY = AGENT_CORE_FLEET_SHARED_CODEX_AUTH_ACTIVATION_V1 @ b5717e3345ad98b063709f995750f8ddf934437f
CURRENT_MAIN = origin/main 600d4df (Merge PR #183)
RETURN_REASON = TRUE SEMANTIC OWNER GATE #1 (genuinely changed semantic exact-head Authority)
PRODUCTION_MUTATION = NONE (unchanged; PRODUCTION_APPLY = HOLD per dispatch)
PRODUCT_CODE_CHANGE = NONE
ARTIFACT_CHANGE = NONE (frozen V1 packet preserved verbatim)
```

## 1. What the dispatch assumed vs what fresh reconciliation found

Dispatch (correctly) ordered: "Fresh reconcile current durable truth before assuming old
intermediate states." Fresh reconciliation found the anchored authority premise is no longer
current on main.

### 1.1 Timeline (all +0800, all commits ancestor-verified against origin/main 600d4df)

```text
2026-09-05 22:41  797952e  PR #175 merged — ACTIVATION_V1 @ b5717e3 accepted (Owner exact-head)
2026-09-06 05:59  16e1423  PR #176 merged — CTR-ACT-005 bounded bootstrap runner
2026-09-06 06:00  14c0c7a  (evidence branch) PRODUCTION_PACKET_FROZEN per V1 semantics
2026-09-06 09:17  7519215  PR #178 merged (HR terminal record; GLM apply HOLD reason cleared)
2026-09-06 09:36  161e2ff  propose FLEET_SHARED_CODEX_AUTH_V3 + ACTIVATION_V2 (trust-domain realignment)
2026-09-06 10:32  d55d453  OWNER_ACCEPTANCE_TRANSACTION — V3 + ACTIVATION_V2 accepted @ 161e2ff
2026-09-06 10:34  b2421ee  PR #179 merged (docs-only: 5 spec files, zero product code)
2026-09-06 14:14→18:45  PRs #180–#183 (WDA mainline; no fleet/codex surface)
```

### 1.2 The supersession (d55d453, mechanically verified on current main)

- `AGENT_CORE_FLEET_SHARED_CODEX_AUTH_ACTIVATION_V1`: status `superseded`,
  `superseded_by: AGENT_CORE_FLEET_SHARED_CODEX_AUTH_ACTIVATION_V2` — superseded
  **as CURRENT production activation**; "remains authority for the authsvc domain's own future use".
- `AGENT_CORE_FLEET_SHARED_CODEX_AUTH_ACTIVATION_V2`: status `accepted`,
  `accepted_reviewed_head: 161e2ff…`, review ACCEPT / 0 blockers.
- `AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V3` (parent authority): status `accepted`,
  replaces umbrella V2; `superseded_by: null` — no further succession exists.

### 1.3 Why this is a genuine semantic change (not a mechanical lifecycle refresh)

Accepted ACTIVATION_V2 materially re-frames the production activation the V1 packet targeted:

```text
                       V1 @ b5717e3 (packet 14c0c7a)         ACTIVATION_V2 @ 161e2ff (current)
TARGET DOMAIN          authsvc domain (uid /Users/authsvc)   yanfenma unified backend (127.0.0.1:8787,
                                                            root /Users/yanfenma/.agent-core)
REGISTRY CARDINALITY   exactly 92 (fail-closed otherwise)    88 (92-check binds only in bootstrap branch)
CREDENTIAL ACQUISITION TEN_GATE_BOOTSTRAP from converged      ONE_CANONICAL_OWNER_REAUTH
                       snapshot (legacyCredentialReuse)      (LEGACY_CONVERGED_BOOTSTRAP_SELECTED = NO)
LUNA SCOPE             92/92 rollout (canary→batch→fleet)    agt_stock_agent + agt_ceo-agent (+ agt_cto-agent
                                                            legacy-route migration); all-88 OUT of scope
RUNNER                 CTR-ACT-005 bootstrap candidate class normal reauth path; bootstrap branch NOT selected
CLOSURE                CLOSURE_REFREEZE_V2 8-blob            CTR-ACT2-001 minimal blob set for THIS domain
                                                            (may REUSE the 8-blob target bytes if byte-complete)
DOMAIN ISOLATION       n/a                                  MUST NOT touch /Users/authsvc/**
```

The dispatch's frozen semantics (FLEET_ROSTER_COUNT=92 gates, TEN_GATE_BOOTSTRAP=REQUIRED,
COPY_EXACTLY_ONCE, canary→small-batch→92/92 rollout) are V1-frame; executing them would prepare a
packet that accepted ACTIVATION_V2 explicitly de-scopes from the current production backend, while
executing the V2 frame would contradict the dispatch's frozen semantics. The choice of governing
lane for this Goal is irreducibly the Owner's (OWNER_GATE_POLICY gate 1).

## 2. Fresh verification performed (all read-only)

```text
V1  ANCESTRY        b5717e3, 16e1423, 797952e, d55d453, 161e2ff — ALL ancestors of origin/main 600d4df  PASS
V2  CLOSURE DRIFT   all 8 CLOSURE_REFREEZE_V2 blobs: git-oid at 600d4df == frozen manifest oids,
                    8/8 IDENTICAL (route-chain e2f69dac / model-overrides 380f5264 / provisioning
                    index 34479d81 + shared-codex 963d03be + plugin-artifact 89394ab3 /
                    migration-cli a8620ea9 / migration-executable 6e29b5f8 / migration 70e74439)  PASS
V3  PR #179 SCOPE   docs-only (spec files + README lifecycle; PRODUCT_CODE_CHANGE=NONE) —
                    consistent with V2 (zero closure drift since 16e1423)                          PASS
V4  NEWER AUTHORITY superseded_by = null on V3 and ACTIVATION_V2 — no successor past V2 frame     PASS
V5  ARTIFACT DRIFT  deployment-artifacts/model-fleet-glm-luna-activation-prep-r4/ untouched since
                    2026-09-06 05:53 (no V2-era prep exists: CTR-ACT2-002 implementation,
                    ACC-ACT2-001..006 all NOT STARTED on main)                                   PASS
V6  SECRET SCAN     artifact set unchanged since SECRET_SCAN=PASS at 14c0c7a (no writes this round) PASS
```

## 3. Dispatch READY_FOR_PRODUCTION_SLOT conditions — fresh state

```text
ACCEPTED_AUTHORITY       MERGED=yes, CURRENT=NO  ← FAILS: superseded-as-current by accepted ACTIVATION_V2 @161e2ff
CTR_ACT_005              IMPLEMENTED_AND_MERGED  PASS (16e1423 ∈ main; blob-identical at 600d4df)
BINDINGS                 FINAL                   PASS (r4 artifacts, preserved)
FOCUSED_TESTS            PASS                    PASS (8/8 @16e1423; closure bytes unchanged ⇒ proof carries)
TEN_GATE_SIMULATION      PASS                    PASS (22/22 @16e1423; simulator + CANDIDATE_CONTENT_V2 untouched)
ROLLBACK_SIMULATION      PASS                    PASS (same basis)
IMPLEMENTATION_AUDIT     PASS                    PASS (audit PASS / BLOCKER_UNION=∅ @PR #176)
BLOCKERS                 0                       PASS
ARTIFACT                 FROZEN                  PASS (byte-preserved)
PRODUCTION_PACKET        READY                   PASS for the V1/authsvc frame (14c0c7a); NOT the current frame
SECRET_SCAN              PASS                    PASS
PRODUCTION_MUTATION      NONE                    PASS
READY_FOR_PRODUCTION_SLOT                        NOT DECLARED — blocked only by ACCEPTED_AUTHORITY=CURRENT
```

## 4. Disposition

- No lifecycle recreated, no acceptance commits touched (per dispatch: reuse merged lifecycle).
- No V2-frame implementation started (would exceed this dispatch's frozen V1 semantics without
  an Owner lane decision).
- Frozen V1 packet/artifacts preserved verbatim as the authsvc-domain closure of record
  (ACTIVATION_V2 §Out-of-scope keeps ACTIVATION_V1 as that domain's own future authority, and
  CTR-ACT2-001 permits reuse of the 8-blob target bytes if byte-complete for the new domain).
- GOAL_STATUS = ACTIVE; phase remains POST_ACCEPTANCE_CURRENT_MAIN_RECONCILIATION; returned at
  TRUE SEMANTIC OWNER GATE with two executable options:
  (A) REALIGN this Goal's predeployment lane to accepted ACTIVATION_V2 @161e2ff
      (yanfenma-88 / owner-reauth / stock+ceo+cto; V2 predeployment work = CTR-ACT2-001 closure
      freeze for the new domain + CTR-ACT2-002 domain-constants realignment + ACC-ACT2-001..006);
  (B) KEEP the V1 lane explicitly scoped to the authsvc domain (packet 14c0c7a already satisfies
      all V1-frame ready conditions; nothing further to build — Goal would sit READY_FOR_PRODUCTION_SLOT
      for that domain only).
- PRODUCTION_APPLY = HOLD_BY_OWNER (both frames); no slot claimed.
```
