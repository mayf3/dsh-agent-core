# PRODUCTION_PACKET — yanfenma-domain shared Codex activation (ACTIVATION_V2)

GOAL = GLM_LUNA_FALLBACK_PRODUCTION_V1 · STATUS = READY_FOR_PRODUCTION_SLOT (frame: yanfenma-88 / owner-reauth / stock+ceo+cto)
AUTHORITY = AGENT_CORE_FLEET_SHARED_CODEX_AUTH_ACTIVATION_V2 @161e2ff (accepted, d55d453, superseded_by=null) · PARENT = AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V3
PRODUCTION_APPLY_ALLOWED = NO until the Owner releases the slot (PRODUCTION_MUTATION_CONCURRENCY = 1 global). No apply happens from this packet without that release + a fresh Agent.
SECRET BOUNDARY (CTR-ACT2-008 / CTR-SCA-011): only provider, model, paths, metadata, generationId, verdict fields in any evidence. No token/hash-of-secret/credential content anywhere.

## 0. Exact coordinates (frozen 2026-09-06)
- SPEC base evidence: docs/evidence/glm-luna-fallback-reconciliation-v1-20260905/ (supersession reconciliation 6a6870d + this packet)
- Implementation: dsh main 34b2b49 = PR #187 (06f094e) — audit ACCEPT→(1 blocker→repair)→re-audit ACCEPT/BLOCKERS empty
- Closure: deployment-artifacts/model-fleet-glm-luna-activation-v2-r1/CANDIDATE_CONTENT_V2 (12 blobs; 11 verbatim main; compose = 549dace + minimal delta; BLOBS.manifest + .sha256)
- Deployment checkout: /Users/yanfenma/workspace/project/production-dsh-agent-core @ 549dace (loader accepts v1 ONLY — fresh census decides the real preimage shape)
- Production root: /Users/yanfenma/.agent-core · registry 88 · config v1 sha256 00182231… (apply-time fresh census authoritative)
- Canonical prestate: ABSENT · per-home OAuth: exactly one store (homes/agt_cto-agent, mtime 2026-08-20)
- Provenance expectation (CTR-ACT2-005 step 4): ZERO proven generations in this domain ⇒ canonicalReauthRequired=true ⇒ exactly ONE ownerReauthCanonical. If the inventory yields a proven generation, ABORT + re-run the fresh gate (contradicts spec §4).

## 1. Apply-time fresh gates (ALL must PASS; any drift ⇒ FAIL_CLOSED, no N/N generalization)
G1 production lock: PRODUCTION_RUNTIME_LOCK=IDLE, no competing mutation (fresh census, single check, no polling)
G2 fresh preimage census per CTR-ACT2-003: 8787 listener table w/ pids+cmdlines+cwd; registry blob (88); config preimage bytes; the 12 closure-target files' CURRENT bytes in the deployment checkout as per-file preimage (3 PRESENT at 549dace + 9 ABSENT); harness root identity; canonical absence proof; per-home OAuth inventory (paths+mtimes)
G3 closure manifest: all 12 blobs hash-verify against BLOBS.manifest.sha256 at install time
G4 config preimage whitelist: real installed config parses as v1 (or legacy v2) under the migrator whitelist; anything else ⇒ FAIL_CLOSED
G5 provenance inspection: selectAuthoritativeCodexGeneration over the domain's real legacy candidate inventory (expected zero proven)
G6 spec-state guard: ACTIVATION_V2 still accepted, superseded_by=null on main (git show docs/specs/...ACTIVATION_V2.md frontmatter)

## 2. Execution sequence — ONE quiesce window, P1→P5, fail-closed at every step (CTR-ACT2-005 order)
P1 PRE-STAGE (before any credential work): install the 12-blob closure per RELEASE_MANIFEST (destination = the deployment checkout paths; 3 files replaced + 9 created + compose replaced) → run tools/v1_to_v3_migrator.mjs on the real config with --annex (stock/ceo Luna routes + overrides) AND --preimage-copy (rollback authority). One atomic same-dir rename. NO restart in this state is admitted (v3 loader demands credentialFile on codex routes; canonical absent is a legal intermediate — loader validates fields, does not stat).
P2 QUIESCE+FENCE: quiesceLunaDispatch + quiesceRefreshWriters (bindings §canaries/quiesce) → runner writes the durable fence. COMPETING_REFRESH_WRITERS=NONE proven; desktop Codex app excluded as a separate generation.
P3 CREDENTIAL: provenance inspection (G5) → OWNER GATE: exactly ONE interactive OpenAI Codex login writing DIRECTLY into the canonical path (mechanism frozen at apply review; direct-to-canonical only; no ~/.codex copy, no agent-home login, no upload, no legacy CTO copy) → validateCanonical (parses, 0600, group/world zero) → four probes (uid502 read; uid502 atomic replace; canonical-owner control-plane uid502; third-uid denied).
P4 SWITCH+VERIFY: switchFleetConfig (config ALREADY v3; idempotent credentialFile injection re-check) → zero per-home runtime opens → pinned artifact receipt exact-match → controlled restart (same wrapper/env identity).
P5 CANARIES+FLEET: STOCK → CEO → CTO, each proving provider=openai-codex, model=gpt-5.6-luna, REAL reply, no oc-go/GLM use, no per-home OAuth open, attribution from child/turn evidence → Luna-set fleet health. THEN the Goal-terminal proofs: GLM primary + Luna fallback on the routed chain (PRIMARY=zai/glm-5.3, FALLBACK=openai-codex/gpt-5.6-luna), safe quota-hop pass, unsafe-failure STOP_CHAIN pass, ONE_LOGICAL_TURN / NO_DUPLICATE_WORK / NO_DUPLICATE_TOOL / NO_DUPLICATE_EXTERNAL_DELIVERY pass ⇒ GLM_LUNA_FALLBACK_PRODUCTION_READY=YES ⇒ GOAL COMPLETE.

## 3. Rollback boundaries (CTR-ACT2-007; canonical NEVER rolls back)
Runtime-only rollback after quiesce: restore the 12 per-file preimages (3 replaced files from census bytes; 9 created files removed; compose restored from census byte) + config v1 preimage restore (the --preimage-copy byte copy) + canonical directory removal ONLY IF the canonical store was never activated. Post-reauth the canonical credential, fence, and intent evidence are NEVER rolled back or deleted. Rollback restores PRODUCTION_USABLE=YES via pre-existing routes (CTO route returns exactly as found; per-home runtime use MUST NOT resume once zero-per-home was proven — Luna stays disabled until a later authority action). Rollback command surface: CLI rollback + rollbackRuntime binding; refresh-intent present ⇒ SHARED_CODEX_REAUTH_REQUIRED (never roll back across an ambiguous generation).

## 4. OUTCOME_UNKNOWN handling
Any step with unknown outcome ⇒ STOP_CHAIN: preserve evidence, Luna disabled pending Owner investigation, NO retry, claim nothing. First canonical refresh failure `refresh_token_reused`/`invalid_grant` ⇒ FAIL_CLOSED + OPERATOR_BLOCKED per CTR-ACT2-006 (V3 CTR-SCA-006/007/008 carried verbatim).

## 5. Secret-free receipts schema
receipt = { gate: string, phase: 'pre'|'post', result: 'PASS'|'FAIL', root, captured_at, items: [{path, sha256, mode, mtime}] , verdicts: {...} } — paths/hashes/modes/mtimes only. No credential bytes, no provider-side identities beyond generationId/accountId.

## 6. What this packet does NOT touch
authsvc domain (its own future activation remains ACTIVATION_V1); broker/scheduler/workflow/memory surfaces (UNRELATED_MAIN_BLOBS excluded by census proof); Mobile lane; per-home writable OAuth use (FORBIDDEN post-activation, V3 CTR-SCA-005).
