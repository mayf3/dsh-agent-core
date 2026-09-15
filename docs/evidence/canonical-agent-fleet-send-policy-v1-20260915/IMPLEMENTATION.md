# CANONICAL_AGENT_FLEET_SEND_POLICY_V1 — IMPLEMENTATION_EVIDENCE (pre-deployment)

- date: 2026-09-15
- governing_spec: `docs/specs/AGENT_CORE_CANONICAL_AGENT_FLEET_SEND_POLICY_V1.md`
  (Owner exact-head acceptance **6bce155**; GOVERNING_SPEC_UNMODIFIED=YES)
- implementation_repo: mayf3/auth-service, branch `goal/canonical-agent-fleet-send-policy-v1`,
  commit **7f600e5** (single implementation commit on top of main 170736e)
- dsh side: D3 zero broker/runtime semantic bytes — this repo's packages/ untouched
  (this file is docs-only evidence, D2).

## Change surface (auth-service @ 7f600e5)

```text
M  src/lib/oauth/audit.ts                  +3 AuditEventType members (additive)
M  src/routes/idempotent.ts               POST /api/v1/clients birth-stamp call (§B of contract)
A  src/lib/oauth/v1/fleet-send-grant.ts   constants + pure planner + ensureFleetSessionSendGrant
A  scripts/reconcile-fleet-send-grants.ts reconcile CLI (force-added; scripts/ is gitignored)
A  tests/oauth/fleet-send-grant.test.ts   8 DB-free unit tests (injected store)
A  docs/contracts/AUTH_SERVICE_SESSION_SEND_FLEET_GRANT_PROVISIONING_V1.md
```

I4 proof: `git diff --stat` over `src/lib/oauth/v1/direct.ts`,
`src/lib/oauth/v1/idempotent.ts`, `src/lib/oauth/v1/grant-migration.ts`,
`src/lib/oauth/token-issuance.ts` = EMPTY (issuance + deny paths byte-untouched).

## Verification record

```text
tsc --noEmit -p tsconfig.json                          CLEAN
npm run contract:v1:validate                           MINIMAL_AUTH_V1_BUNDLE_VALID=true
scripts/reconcile-fleet-send-grants.ts --selftest      SELFTEST_ALL_OK (3 fixtures)
tests/oauth/fleet-send-grant.test.ts                   8/8 PASS
npm run test:contract-v1                               37 PASS / 1 FAIL
  FAIL = migration-v1-static 'schema.prisma exceeds 500 lines'
         PRE-EXISTING static hygiene debt (schema outgrew the frozen limit
         before this work; zero relation to this change; verified failing on
         untouched baseline)
tests/idempotent-conformance.test.ts                   UNCHANGED (exercises the
  createOrGetClient library, not the route; requires live DB → Owner env)
```

Environment repair performed in passing (dev node_modules only, untracked):
`@esbuild/darwin-arm64` installed + `prisma generate` re-run — the dev
node_modules carried x64 binaries on this arm64 host, which had made the
entire TS test baseline unrunnable (pre-existing LOCAL_ARM64_NORMALIZATION debt).

## Registry drift decision (I3 / reviewer note N3)

Attempted in-bundle backport of the `agent-session-messaging` row was
**reverted**: `validate.mjs` mechanically refuses first-wave audience-set
changes (frozen bundle `registry_version 1.2.0` vs deployed ledger `1.12.0`;
7 deployed-only audiences, each with its own AUTH_SERVICE authority). The
companion contract (§D/§E) instead freezes the row content repository-side,
records the drift ledger, and marks bundle backport as explicit separate
owner-gated DEBT. Fleet machinery is drift-robust by construction (birth-stamp
skips without the audience; reconcile exits 2 fail-closed; issuance never
mints on a missing grant row).

## Deployment / execution gates remaining (all Owner-gated)

```text
1. auth-service independent review (CODE_REVIEW/SECURITY_REVIEW) on 7f600e5
2. auth-service PR + Owner merge
3. auth-service redeploy (birth-stamp becomes effective)
4. Owner runs scripts/reconcile-fleet-send-grants.ts on the authsvc host:
   --selftest → DRY_RUN (census: expect PRODUCTION_CANONICAL_AGENT_COUNT≈89,
   SEND_ENTITLEMENT_MISSING_COUNT≈87) → --apply (exit 0 with
   POST_APPLY_VERIFICATION_OK)
5. Governing Spec §10 acceptance: 10.1 three paths → production E2E A–F →
   readback ladder → Done When
```

## Pre-existing uncommitted work disclosure

The auth-service dev checkout carried two unrelated uncommitted edits from
earlier work: `src/cli/machine-admin.ts` (+`import 'dotenv/config'`) and a
whitespace-only serialization normalization of
`contract-bundles/minimal-auth-v1/audience-registry.json`. The former was
left untouched and uncommitted. The latter was discarded (file restored to
committed state) when the registry experiment was reverted — semantics
byte-identical (pure formatting), disclosed here for the record.
