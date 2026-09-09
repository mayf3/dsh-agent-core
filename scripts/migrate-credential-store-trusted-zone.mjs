#!/usr/bin/env node
// migrate-credential-store-trusted-zone.mjs — the trusted-zone deployment
// migration operator CLI (AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1
// deployment conformance, DECISION_3; generation-safe rollback per the owner
// ruling CRITICAL_ROLLBACK_CORRECTION).
//
// STATUS: CANDIDATE PACKAGE — production application requires the union
// acceptance (PRODUCTION_OPERATION_AUTHORIZED = NO until then). Dry-run is
// the default; --apply / --rollback are root-gated; --selftest runs the full
// fixture state machine unprivileged.
//
// Modes:
//   (no flag)     dry-run: layout + plan, zero mutation
//   --apply       perform the migration (root; idempotent; crash-resumable)
//   --rollback    generation-safe rollback (CASE A layout restore / CASE B
//                 current-generation preservation / BLOCKED when unprovable)
//   --status      read-only layout report
//   --selftest    fixture state-machine suite (see credential-store-trusted-zone.test.mjs)

import { classifyLayout } from './credential-store-trusted-zone-lib.mjs'

const PINNED_STORE = '/usr/local/libexec/agent-core/config/agent-credentials.json'
const ZONE_DIR = '/usr/local/libexec/agent-core/credential-store'
const ZONE_STORE = '/usr/local/libexec/agent-core/credential-store/agent-credentials.json'
const PREIMAGE_FILE = '/Users/yanfenma/workspace/deployment-artifacts/canonical-onboarding-v1/preimages/agent-credentials.json.preimage'
const PREIMAGE_DIR = '/Users/yanfenma/workspace/deployment-artifacts/canonical-onboarding-v1/preimages'
const RECEIPT_FILE = '/Users/yanfenma/workspace/deployment-artifacts/canonical-onboarding-v1/migration-receipt.json'

const args = process.argv.slice(2)

function emit(payload) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`)
}

if (args.includes('--selftest')) {
  const { spawnSync } = await import('node:child_process')
  const run = spawnSync(process.execPath, ['--test', new URL('./credential-store-trusted-zone.test.mjs', import.meta.url).pathname], {
    stdio: 'inherit',
  })
  process.exit(run.status ?? 1)
}

const faces = { pinnedStore: PINNED_STORE, zoneDir: ZONE_DIR, zoneStore: ZONE_STORE, preimageFile: PREIMAGE_FILE, preimageDir: PREIMAGE_DIR, receiptFile: RECEIPT_FILE }

if (args.includes('--status')) {
  emit({ ok: true, mode: 'status', layout: classifyLayout(faces), receiptExists: (await import('node:fs')).existsSync(RECEIPT_FILE) })
  process.exit(0)
}

const { applyMigration, rollbackMigration } = await import('./credential-store-trusted-zone-lib.mjs')

try {
  if (args.includes('--rollback')) {
    emit({ ok: true, mode: 'rollback', ...rollbackMigration(faces) })
    process.exit(0)
  }
  if (args.includes('--apply')) {
    emit({ ok: true, mode: 'apply', ...applyMigration(faces) })
    process.exit(0)
  }
  // dry-run: classification + plan only
  emit({
    ok: true,
    mode: 'dry-run',
    layout: classifyLayout(faces),
    plan: {
      preimage: PREIMAGE_FILE,
      receipt: RECEIPT_FILE,
      zone: { dir: ZONE_DIR, mode: '0700', owner: 'authsvc (from the live store file)' },
      move: { from: PINNED_STORE, to: ZONE_STORE },
      symlink: { at: PINNED_STORE, target: '../credential-store/agent-credentials.json' },
      note: 'no mutation performed; --apply (as root) executes; --rollback is generation-safe (CASE A/B) and BLOCKED when the generation is unprovable',
    },
  })
} catch (error) {
  emit({ ok: false, fail_code: error?.code ?? 'MIGRATION_FAILED', message: error?.message ?? String(error), ...(error ?? {}) })
  process.exit(2)
}
