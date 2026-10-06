# AGENT_FLEET_SEND_ENTITLEMENT_E2E_V1 — TEST_IDENTITY proof record (Product #419 / Epic B9)

Date: 2026-10-02
Mode: TEST_IDENTITY (ACCEPTANCE_MODE per Product #419). Zero production mutation: no deploy, no restart, no sudo, no credentials, no data mutation, no Remote Desktop, no UNKNOWN replay.
Governing authority: AGENT_CORE_CANONICAL_AGENT_FLEET_SEND_POLICY_V1 (accepted r4, joint 2026-09-16) §10.1 legs + §10.2 proof facets, executed as TEST_IDENTITY (not the §10.2 production E2E, which was already accepted 2026-09-17 and is NOT re-run here).

## Delta

One test-only file (GOVERNING_SPEC_UNMODIFIED; §9-D3 zero broker/runtime/agent-router semantic-byte change):

- `packages/production-runtime/test/agent-session/fleet-send-entitlement-e2e.test.js` — ONE cross-Agent TEST_IDENTITY E2E (2 composed scenarios) over the REAL broker gateway (credential + token entitlement gate), REAL trusted ASM provider, REAL router admission/delivery chain, REAL AgentProcess event correlation (fake stdio child; the `agent-router/test/helpers/fake-child.js` harness pattern), REAL file-backed L1 audit + reconcile lookup, and a stub auth-service implementing the accepted fleet grant semantics (per-client MachineAccessGrant rows; issuance-time active check).

## Environment

- dsh-agent-core base: origin/main `47aadec12139bf5d82edb67aa98a32801962af25` (fresh read at execution time; PR #203 lineage verified present on main in evolved form: `agent-session-reconcile.js`, `parent-rpc-relay.js`, `renderErrorDetail`, `invocationCorrelation`/`failureCode` L1 persistence — PR #203 head `39e8999e` itself is the open production-apply vehicle, READY_FOR_PRODUCTION_APPLY=YES/HOLD, separately tracked).
- mayf3/auth-service main: `862eab3` — companion spec AUTH_SERVICE_CANONICAL_AGENT_FLEET_SEND_GRANT_PROVISIONING_V1 accepted; `src/lib/oauth/v1/fleet-send-grant.ts` + birth-stamp wiring + `scripts/reconcile-fleet-send-grants.ts` present.
- node v25.6.1 (pinned target runtime; compose asserts `TARGET_PROXY_NODE_VERSION`), proxy-free env.
- Isolated worktree: `.worktrees/b9-fleet-send-entitlement-e2e-v1`, branch `impl/agent-fleet-send-entitlement-e2e-v1`.

## Results (frozen outputs in this directory)

1. `E2E_RUN_OUTPUT.txt` — the new E2E: **tests 2 / pass 2 / fail 0** (~0.78s).
   - Scenario 1 (lifecycle): not-yet-materialized member → `access_denied` + L0 denial row, zero delivery bytes; canonical fleet materialization (exactly `['agent.session.send']`, the reconcile/birth-stamp ADD shape) flips the SAME member to `accepted` with ZERO dsh-side change (agents.json + credentials-store byte-identical before/after, asserted) and no allowlist anywhere; principal deactivation → `credential_invalid` (401 invalid_client `client_or_principal_inactive` shape) while the grant row remains — deny is issuance-time-active, never row deletion; the receiver's independent inspection scope is ISSUED (200) only to the lawful dual-scope member (AMENDMENT_1 shape), never to the send-only sender.
   - Scenario 2 (flow): L1 intent row precedes outcome row (same requestId); delivery lands in the receiver's OWN process/workspace carrying the runtime-frozen `inter_agent` origin (`sourceAgentId` = actual caller, `correlation` = proven source-turn proof); model-supplied identity fields rejected `invalid_arguments` BEFORE any delivery or audit intent; bounded send settles `replied` with the EXACT final assistant output of the target Run (REPLY_ASSOCIATION); the invocation anchor (`invocationCorrelation`) is persisted in the outcome row; after a FULL runtime restart a fresh instance resolves the caller-bound `agent_session_send_reconcile` lookup from the SAME audit file (retained V2 coordinate: status replied, targetAgentId, messageId), and a FOREIGN entitled caller resolving the SAME anchor gets `invocationCorrelationFound=false` (caller-binding negative).
2. `ADJACENT_SUITES_RUN_OUTPUT.txt` — adjacent-suite regression pass (same worktree/env): **79/79** across
   `production-runtime/test/agent-session/*.test.js` (incl. this E2E), `production-runtime/test/agent-session-messaging.test.js`,
   `production-runtime/test/agent-directory-session-send-e2e.test.js`, `broker/test/agent-session-messaging.test.js`.
3. `AUTH_SERVICE_FLEET_TESTS_OUTPUT.txt` — auth-service (repo `862eab3` = github/main): `tests/oauth/fleet-send-grant.test.ts` (FLEET_STAMP_* ×10) + `tests/oauth/fleet-send-regression.test.ts` (RG1/RG2/RG3) = **13/13 pass** (exit 0); `scripts/reconcile-fleet-send-grants.ts --selftest` = **SELFTEST_ALL_OK** (exit 0; add/keep/normalize/census cases). The DB/credential-bound suites (`idempotent-conformance.test.ts`, `v1-direct.test.ts`) are NOT runnable in this context (`.env` EACCES to this principal + no test DB) — untouched per boundaries; their legs carry the accepted production records of 2026-09-16/17 (§10.1 NEW_AGENT_PROVISIONING / EXISTING_FLEET_RECONCILIATION apply MISSING=0 / DISABLE_REVOKE DENY 401 invalid_client).

## Independent review

One focused fresh-context review of the exact head (diff-scope mechanical check, stub-vs-accepted-semantics fidelity, per-claim detection power, double run for flake, isolation, evidence cross-check): **VERDICT=PASS / BLOCKERS=NONE**; reviewer reproduced tests 2/2 twice (771.5ms / 765.2ms) and adjacent 79/79. Non-blocking notes absorbed in the reviewed head: foreign-caller reconcile-lookup negative added; dsh-side artifact byte-snapshot assertion added (agents.json + credentials-store); scenario-1 tmpdir cleanup added; adjacent-suite and auth-service outputs frozen as evidence files (this directory). Notes accepted as-is: unmaterialized member modeled as present-row-with-empty-scopes (identical wire semantics: 403 machine_grant_missing, per spec §0 production evidence); the dual-scope gate-pass assertion is complemented by the issuance-200 filter.

## Facet → evidence map (Product DONE_WHEN 4)

```text
existing fleet backfill via canonical path   = E2E scenario 1 (row materialization flips admit; identical gate request;
                                               no dsh-side allowlist anywhere) + auth-service reconcile selftest
                                               SELFTEST_ALL_OK + 13/13 fleet tests + 2026-09-17 apply record (MISSING=0)
future auto-provisioning = same entitlement   = E2E scenario 1 (birth-shaped ADD admits without any manual step) +
                                               auth-service FLEET_STAMP_* suite (agent stamp / service never stamped /
                                               idempotent KEEP / normalize) 
disable/revoke/retire invalidates             = E2E scenario 1 (deactivation → credential_invalid, row inert) +
                                               issuance-time-active check (direct.ts, frozen) + 2026-09-17 production record
cross-Agent TEST_IDENTITY E2E                 = E2E scenario 2: sender identity (frozen origin sidecar + R2 forgery
                                               rejection), receiver identity/grants (own process/workspace; independent
                                               inspection scope never issued to sender), durable receipt (L1 rows +
                                               full-restart caller-bound reconcile lookup), reply association
                                               ('replied' = exact target Run final output)
```

## Lifecycle truth (independent values)

```text
SOURCE = merged (dsh main 47aadec1 carries the full reliability/entitlement consumption surface; auth-service main 862eab3 carries the accepted provisioning surface)
INSTALLED = yes (auth-service fleet grant path applied in production 2026-09-16/17; dsh runtime consumption surface verified at the source level + composed tests; dsh-side production deploy of the #203 reliability packet remains a SEPARATE tracked debt and is NOT required for the entitlement)
ENABLED = yes (fleet baseline entitlement issuing tokens fleet-wide since 2026-09-16/17; no per-Agent allowlist)
BUSINESS_VERIFIED = yes (recorded 2026-09-17 §10.2 production E2E A–D PASS / E–F DENY + L2 dual-chain receipt; this round adds the composed TEST_IDENTITY E2E proof on current main)
```

FOLLOW_UP_DEBT (unchanged, out of scope here): PR #203 production apply (frozen packet, HOLD while P0 owns the slot) — deployment debt of the reliability surface, not of the entitlement.
