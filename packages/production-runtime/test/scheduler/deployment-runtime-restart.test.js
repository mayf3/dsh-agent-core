import test from 'node:test'
import assert from 'node:assert/strict'
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

import { restartSchedulerProductionRuntime } from '../../src/scheduler/deployment-runtime-restart.js'

test('runtime restart replaces stale provenance coordinates and reads back the exact deployed SHA', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'scheduler-runtime-restart-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const launchdDir = join(root, 'launchd')
  const artifactsDir = join(root, 'artifacts')
  const binDir = join(root, 'bin')
  mkdirSync(launchdDir); mkdirSync(binDir)
  const plistPath = join(launchdDir, 'ai.agent-core.runtime.plist')
  writeFileSync(plistPath, '<plist><dict><key>AGENT_CORE_DEPLOYED_SHA</key><string>0000000000000000000000000000000000000000</string><key>HOME</key><string>/Users/authsvc</string></dict></plist>\n')
  chmodSync(plistPath, 0o600)
  if (process.platform === 'darwin') execFileSync('/usr/bin/xattr', ['-c', plistPath])
  const curl = join(binDir, 'curl')
  writeFileSync(curl, '#!/bin/sh\nprintf \'%s\\n\' \'{"ok":true}\'\n')
  chmodSync(curl, 0o700)
  const oldPath = process.env.PATH
  process.env.PATH = `${binDir}:${oldPath}`
  t.after(() => { process.env.PATH = oldPath })
  const phases = []
  const durability = []
  const receipts = []
  let loaded = true
  const sha = '1234567890abcdef1234567890abcdef12345678'
  const result = restartSchedulerProductionRuntime({
    ctx: {
      launchdDir, artifactsDir, authsvcUid: 501, authsvcGid: 20,
      isLoaded: () => loaded,
      bootout: (label) => { phases.push(`bootout:${label}`); loaded = false },
      bootstrap: (path, label) => { phases.push(`bootstrap:${path}:${label}`); loaded = true },
      runtimeReceipt: (receipt) => receipts.push(receipt),
      onDurabilityStage: (stage) => durability.push(stage),
    },
    phase: (name, ok) => phases.push(`${name}:${ok}`), sourceSha: sha,
  })
  assert.equal(result.deployedSha, sha)
  assert.match(readFileSync(plistPath, 'utf8'), new RegExp(`<key>AGENT_CORE_DEPLOYED_SHA</key><string>${sha}</string>`))
  assert.equal(statSync(plistPath).mode & 0o777, 0o600)
  assert.deepEqual(receipts.map((receipt) => receipt.status), ['INSTALLING', 'INSTALLED'])
  assert.equal(receipts[0].installedSha256, receipts[1].installedSha256)
  assert.deepEqual(durability, ['preimage-file-synced', 'preimage-renamed', 'preimage-directory-synced', 'candidate-file-synced', 'candidate-renamed', 'target-directory-synced'])
  assert.deepEqual(phases, [
    'bootout:system/ai.agent-core.runtime',
    `bootstrap:${plistPath}:system/ai.agent-core.runtime`,
    'runtime:true',
  ])
})
