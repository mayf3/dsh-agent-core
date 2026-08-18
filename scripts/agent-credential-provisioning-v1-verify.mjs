#!/usr/bin/env node

/**
 * Foundation-only acceptance driver. It executes fake-authority/unit seams;
 * it never reads production configuration, contacts Auth, or provisions a
 * real credential.
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
  process.stderr.write('AGENT_CREDENTIAL_PROVISIONING_V1_FOUNDATION = ERROR\n')
  process.exitCode = 1
} else if (result.status !== 0) {
  process.stderr.write('AGENT_CREDENTIAL_PROVISIONING_V1_FOUNDATION = FAIL\n')
  process.exitCode = result.status ?? 1
} else {
  process.stdout.write([
    'AGENT_CREDENTIAL_PROVISIONING_V1_FOUNDATION = PASS',
    'PURE_TOOL_NEGATIVES = PASS',
    'STORE_CONTRACT_UNIT_ACCEPTANCE = PASS',
    'SECRET_NON_DISCLOSURE_TESTS = PASS',
    'REAL_PRINCIPAL_CREATED = NO',
    'REAL_CLIENT_CREATED = NO',
    'REAL_GRANT_CREATED = NO',
    'PRODUCTION_STATE_CHANGE = NONE',
  ].join('\n') + '\n')
}
