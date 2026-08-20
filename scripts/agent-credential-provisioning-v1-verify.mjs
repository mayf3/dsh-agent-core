#!/usr/bin/env node

/**
 * Phase A (clean bootstrap) acceptance driver. It executes fake-authority/unit
 * seams only; it never reads production configuration, contacts Auth, or
 * provisions a real credential. Phase B (existing-credential reconciliation)
 * is deliberately not implemented and must not be claimed here.
 */

import { spawnSync } from 'node:child_process'

const tests = [
  'packages/agent-credential-provisioning/test/auth-client.test.js',
  'packages/agent-credential-provisioning/test/provisioning.test.js',
  'packages/agent-credential-provisioning/test/store-writer.test.js',
]

const result = spawnSync(process.execPath, ['--test', ...tests], {
  cwd: new URL('..', import.meta.url),
  stdio: 'inherit',
  env: {
    PATH: process.env.PATH,
    TMPDIR: process.env.TMPDIR,
  },
})

if (result.error) {
  process.stderr.write('AGENT_CREDENTIAL_PROVISIONING_V1_PHASE_A = ERROR\n')
  process.exitCode = 1
} else if (result.status !== 0) {
  process.stderr.write('AGENT_CREDENTIAL_PROVISIONING_V1_PHASE_A = FAIL\n')
  process.exitCode = result.status ?? 1
} else {
  process.stdout.write([
    'AGENT_CREDENTIAL_PROVISIONING_V1_PHASE_A = PASS',
    'PHASE_A_UNIT_ACCEPTANCE_PA1_TO_PA5 = PASS',
    'PURE_TOOL_NEGATIVES = PASS',
    'STORE_CONTRACT_UNIT_ACCEPTANCE = PASS',
    'SECRET_NON_DISCLOSURE_TESTS = PASS',
    'PHASE_B_IMPLEMENTED = NO',
    'REAL_PRINCIPAL_CREATED = NO',
    'REAL_CLIENT_CREATED = NO',
    'REAL_GRANT_CREATED = NO',
    'PRODUCTION_STATE_CHANGE = NONE',
  ].join('\n') + '\n')
}
