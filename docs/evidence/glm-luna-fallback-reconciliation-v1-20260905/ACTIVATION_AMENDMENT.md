# ACTIVATION AUTHORITY AMENDMENT — fleet 92 + CLOSURE_REFREEZE_V2 (2026-09-05)

Goal: GLM_LUNA_FALLBACK_PRODUCTION_V1 · Mode: CONTINUE_SAME_GOAL · Owner decision: APPROVE_MINIMAL_ACTIVATION_SPEC_AMENDMENT_DIRECTION.

## Authority chain

- OLD_PROPOSED_HEAD (STALE, superseded): `dc22db8504aa3b565421492ee9093a9ccefddfd1` — invalidated by fresh reconciliation (registry 91→92; closure stale).
- **NEW_REVIEWED_HEAD: `b5717e3345ad98b063709f995750f8ddf934437f`** (branch `codex/fleet-shared-codex-activation-amend`, pushed to origin).
- Commit chain: dc22db8 → `181836a33c86e3de57961307fa85cb2435e4f4c0` (amendment proper, +63/−35) → `b5717e3` (review-round-1 mechanical fixes, +5/−3).

## Semantic delta = ONLY_OWNER_APPROVED_RECONCILIATION (independently verified)

1. **Fleet 92**: every normative cardinality site updated to exact 92 (frontmatter scope, §1 ACTIVATION_END_STATE `AGENTS_CANONICAL = 92/92`, CTR-ACT-004 quiesce baseline, CTR-ACT-005 receipt binding, CTR-ACT-006 roster=92 + 92/92 equality, CTR-ACT-008 92 profiles, CTR-ACT-009 92 per-home files, CTR-ACT-010 ladder 禁止 0/92→92/92, CTR-ACT-011 `FLEET_ROSTER_COUNT=92` / `PER_HOME_OAUTH_COUNT=92` / `BYTE_EQUALITY_92=YES`, ACC-ACT-003 fixtures 92 等值/91+1). One-time reconcile framing; dynamic N/N explicitly negated. 92nd member = `agt_huanhuan-thought-agent` (v6 fleet-join 2026-09-03); identity closure + bijection + BYTE_EQUALITY_92 mechanically proven at the activation gate; 91+unknown/disabled/orphan fail-closed.
2. **Closure rebind**: CTR-ACT-001 rewritten to CLOSURE_REFREEZE_V2 (8 blobs @ main 513c691, BLOBS.manifest-frozen; **compose EXCLUDED** with the decoupling/interface-compatibility proof); §4 preimage line corrected to the 2026-09-05 fresh census; CTR-ACT-003 corrected per fresh v3-loader proof (openai-codex route REQUIRES credentialFile ⇒ v2→v3 upgrade + injection one atomic transaction step; runner `switchFleetConfig` idempotent re-affirm) — sandbox-verified SIM_ALL_OK 16/16.
3. Review-round-1 hardening (mechanical, non-semantic): controlled-exception clause naming V2 CTR-SCA-017 gates 3/4/5/10 + CTR-SCA-014 step 10 literal-91-applies-as-92 under the Owner ruling (V2 accepted text unchanged); pre-existing §2.1 cross-ref typo CTR-ACT-009→005; redundant phrase removed.

Preserved untouched: route/fallback semantics, quota hop, outcome_unknown=STOP_CHAIN, ONE_LOGICAL_TURN, NO_DUPLICATE_*, canonical credential model, dsh-codex pin 0.2.3 @ 75d98d5b, no-reauth, secret boundary, quiesce/fence, ten-gate, copy-once, Model A, canary→batch→fleet ladder, concurrency=1, rollback boundaries, memory.js gate-only (CTR-ACT-002 byte-identical).

## Review record

- R1 (ONE independent exact-head semantic review, read-only subagent): **ACCEPT**, BLOCKER_UNION empty, DELTA_CLASSIFICATION = ONLY_OWNER_APPROVED_RECONCILIATION; all technical claims verified against the frozen blobs (v3-forces/v2-forbids credentialFile; loader does not stat the credential file; 090f5471 decoupling; 8/8 blob oids == BLOBS.manifest == origin/main; installed compose e539ef45 sole imports verified live).
- Re-audit after fix-once (same independent reviewer, delta-scoped to the 3 mechanical hunks 181836a..b5717e3): **ACCEPT**, BLOCKER_UNION empty — exactly the three authorized hunks, no cardinality/semantic drift re-introduced (only new "91" is the exception clause naming the parent's frozen literal), DELTA_CLASSIFICATION = ONLY_OWNER_APPROVED_RECONCILIATION confirmed.

## ROSTER_92 evidence posture (honest boundary)

Authoritative registry = `/Users/authsvc/.agent-core/agents.json` (uid502: EACCES, fail-closed — no privileged context in this authoring round). Current readable evidence: v6 fleet-join script (mechanical membership semantics), 2026-09-03 census ledger (agents.json 91→92 defs, overrides 92 keys, 92 OAuth byte-identical), production runtime healthy on that registry. The binding mechanical proof of the 92 identity closure, bijection, and BYTE_EQUALITY_92 is the activation-time ten-gate/fresh-gate receipt (by design, CTR-ACT-006/011) under privileged context — fail-closed on any unresolved identity.

## Owner gate

OWNER_ACTION_REQUIRED = **EXACT_HEAD_ACCEPTANCE** for head `b5717e3345ad98b063709f995750f8ddf934437f`. After acceptance + merge: bindings fill + production packet finalize; production apply remains gated by the shared mutation slot (PRODUCTION_APPLY_ALLOWED = NO).
