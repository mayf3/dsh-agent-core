#!/usr/bin/env node
/**
 * scripts/notification-ingress-service-auth-v1-verify.mjs — the acceptance
 * driver for NOTIFICATION_INGRESS_SERVICE_AUTH_AND_IDEMPOTENCY_V1.
 *
 * Executes the full fault matrix F-01..F-25 (spec §11) against the real
 * ingress over a TEMPORARY root with a stub auth-service token endpoint
 * (fetchImpl seam) and a recorder agentRouter stub — plus the structural
 * gates the unit suites cannot prove from inside node --test:
 *
 *   - AC-CMP-02 authoritative zero-diff: no file under the frozen NO-CHANGE
 *     packages (agent-router / scheduler / agent-process surfaces / broker /
 *     agent-credential-provisioning) differs from the implementation base;
 *   - CONTRACT/ACCEPTANCE presence counts: every one of the 39 C-* contract
 *     ids and 27 AC-* acceptance ids appears in the test sources;
 *   - a full secret scan over every artifact the driver produces.
 *
 * No real Client/Grant is created, no auth-service is modified, nothing is
 * deployed. Exit code 0 only when every item reports PASS.
 */

import { runAuthFaults } from '../packages/notification-ingress/test/verify-auth-faults.mjs'
import { runIdempotencyFaults } from '../packages/notification-ingress/test/verify-idempotency-faults.mjs'
import { runScopeChecks } from '../packages/notification-ingress/test/verify-scope-checks.mjs'
import { results } from '../packages/notification-ingress/test/verify-support.mjs'

process.stdout.write('notification-ingress-service-auth-v1 fault matrix\n===============================================\n')
await runAuthFaults()
await runIdempotencyFaults()
await runScopeChecks()

// ── summary ────────────────────────────────────────────────────────────────

const failed = results.filter((r) => !r.ok)
process.stdout.write('===============================================\n')
process.stdout.write(`TOTAL ${results.length} / PASS ${results.length - failed.length} / FAIL ${failed.length}\n`)
if (failed.length > 0) {
  for (const f of failed) process.stdout.write(`FAILED: ${f.id} — ${f.detail}\n`)
  process.exitCode = 1
}
