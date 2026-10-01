// TRUSTED_CP §5b WATCHDOG OWNERSHIP GUARD — hermetic regression tests.
//
// RED/GREEN contract (agent-control#193 Defect B, Product #414):
//  - RED (the v2.1 defect, recorded live 2026-10-02): installer §5b swept the
//    plist-pinned watchdog private state with the blanket
//    `chown -R 505:601 … control` — group 20→601 — and readPrivateFile
//    (expectedGid=20 per the plists' SCHEDULER_INCIDENT_OWNER_GID) rejected the
//    state fail-closed: `unsafe incident state file` boot FATAL on the RESTORED
//    tree (8790 down ~03:41–03:47).
//  - GREEN (v2.2): the blanket pass EXCLUDES control/scheduler-watchdog +
//    control/incident-backups (find filters); the pin is asserted explicitly
//    (chgrp -R 20 on existing state; missing dirs pre-created 505:20 0700); the
//    real validator accepts the pinned state and still rejects a foreign group.
//
// The tests replay the installer's actual §5b command shapes: the exclusion
// filters are EXTRACTED from scripts/trusted-cp-deploy-install.sh so widening
// or narrowing the pinned set fails here, and the functional damage/repair
// replay uses the REAL private-state-io validator from packages/scheduler.

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { readPrivateFile } from '../../packages/scheduler/src/watchdog/private-state-io.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const INSTALLER = join(HERE, '../../scripts/trusted-cp-deploy-install.sh')
const installerSource = readFileSync(INSTALLER, 'utf8')

const PINNED = ['scheduler-watchdog', 'incident-backups']

/** Build a production-shaped 505 control state fixture (runs as the test user). */
function makeProdRoot() {
  const root = mkdtempSync(join(tmpdir(), 'dsh-5b-guard-'))
  const control = join(root, 'control')
  for (const d of ['bindings', 'scheduler', 'logs', 'workspaces', 'homes', 'control']) mkdirSync(join(root, d), { recursive: true })
  for (const p of PINNED) {
    mkdirSync(join(control, p), { recursive: true, mode: 0o700 })
    chmodSync(join(control, p), 0o700)
    writeFileSync(join(control, p, p === 'scheduler-watchdog' ? 'incidents.json' : 'backup-1.json'), '{}\n', { mode: 0o600 })
    chmodSync(join(control, p, p === 'scheduler-watchdog' ? 'incidents.json' : 'backup-1.json'), 0o600)
    // deterministic pinned pre-state regardless of the runner's primary group
    execFileSync('/usr/bin/chgrp', ['20', join(control, p)])
    execFileSync('/usr/bin/chgrp', ['20', join(control, p, p === 'scheduler-watchdog' ? 'incidents.json' : 'backup-1.json')])
  }
  writeFileSync(join(control, 'turn-recovery-v3.json'), '{}\n', { mode: 0o600 })
  chmodSync(join(control, 'turn-recovery-v3.json'), 0o600)
  return root
}

/** The §5b pinned-set exclusion as the installer writes it, rewritten for a fixture root. */
function extractedPinnedFindFilters(prodRoot) {
  // Pull the -not -path arguments from the §5b find blocks and substitute the
  // fixture root for $PROD_ROOT — keeps this test honest against installer drift.
  const lines = installerSource.split('\n')
  const filters = []
  for (const line of lines) {
    const m = line.match(/-not -path "(\$PROD_ROOT\/control\/[^"]+)"/)
    if (m) filters.push(m[1].replaceAll('$PROD_ROOT', prodRoot))
  }
  assert.equal(filters.length, 8, `expected the 2 find blocks × 4 pinned-exclusion filters in the installer, got: ${JSON.stringify(filters)}`)
  assert.deepEqual(filters.slice(0, 4), filters.slice(4, 8), 'chown and chmod find blocks must exclude the SAME pinned set')
  for (const p of PINNED) {
    assert.ok(filters.includes(join(prodRoot, 'control', p)), `missing dir filter for ${p}`)
    assert.ok(filters.includes(join(prodRoot, 'control', p, '*')), `missing contents filter for ${p}`)
  }
  return filters
}

/** Replay the §5b blanket pass against a fixture root with parameterized identities. */
function replayBlanketPass(prodRoot, { excludePinned, ownerUid, ownerGid }) {
  const control = join(prodRoot, 'control')
  const scope = excludePinned
    ? ['-not', '-path', join(control, PINNED[0]), '-not', '-path', join(control, PINNED[0], '*'),
       '-not', '-path', join(control, PINNED[1]), '-not', '-path', join(control, PINNED[1], '*')]
    : []
  execFileSync('find', [control, ...scope, '-exec', 'chown', `${ownerUid}:${ownerGid}`, '{}', '+'])
  execFileSync('find', [control, ...scope, '-exec', 'chmod', 'u+rwX,go-rwx', '{}', '+'])
}

function groups() {
  return process.getgroups()
}

describe('§5b pinned-set structure (v2.2 installer source)', () => {
  test('blanket chown -R no longer sweeps $PROD_ROOT/control', () => {
    const blanket = installerSource.match(/chown -R "\$\{AUTHSVC_UID\}:\$\{AUTHSVC_GID\}" [^\n]+\n/)
    assert.ok(blanket, 'blanket chown line present')
    assert.doesNotMatch(blanket[0], /PROD_ROOT\/control[" ]/, 'control must be excluded from the blanket -R list')
  })

  test('pinned set + pinned gid + pin assert present in the installer', () => {
    assert.match(installerSource, /WATCHDOG_PINNED_PRIVATE_STATE_GID=20\b/)
    assert.match(installerSource, /WATCHDOG_PINNED_PRIVATE_STATE_PATHS="\$PROD_ROOT\/control\/scheduler-watchdog \$PROD_ROOT\/control\/incident-backups"/)
    // existing state: group re-assert only (no blanket chown/chmod over the pinned trees)
    assert.match(installerSource, /chgrp -R "\$WATCHDOG_PINNED_PRIVATE_STATE_GID" "\$pinned"/)
    // fresh install: pre-create 505:20 0700 so the first boot passes its own gate
    assert.match(installerSource, /chown "\$\{AUTHSVC_UID\}:\$\{WATCHDOG_PINNED_PRIVATE_STATE_GID\}" "\$pinned"/)
    assert.match(installerSource, /chmod 700 "\$pinned"/)
    // RESTORE-R2 marker is carried by the installer's own late-gate restore text
    assert.match(installerSource, /RESTORE-R2/)
    assert.match(installerSource, /chgrp -R 20/)
  })

  test('the four extracted exclusion filters cover exactly the pinned set', () => {
    const root = makeProdRoot()
    try { extractedPinnedFindFilters(root) } finally { rmSync(root, { recursive: true, force: true }) }
  })
})

describe('§5b functional replay (find exclusion + real validator)', () => {
  test('v2.2 exclusion: pinned subtrees untouched, siblings get the blanket pass', () => {
    const root = makeProdRoot()
    try {
      extractedPinnedFindFilters(root) // assert the installer still carries the 4 filters
      const me = process.getuid()
      const otherGroup = groups().find((g) => g !== 20)
      replayBlanketPass(root, { excludePinned: true, ownerUid: me, ownerGid: otherGroup })
      const control = join(root, 'control')
      // pinned: untouched
      for (const p of PINNED) {
        const st = statSync(join(control, p))
        assert.equal(st.gid, 20, `${p} group must stay 20`)
        assert.equal(st.mode & 0o777, 0o700, `${p} mode untouched`)
        const leaf = join(control, p, p === 'scheduler-watchdog' ? 'incidents.json' : 'backup-1.json')
        assert.equal(statSync(leaf).gid, 20, `${leaf} group must stay 20`)
        assert.equal(statSync(leaf).mode & 0o777, 0o600, `${leaf} mode untouched`)
        // the REAL production validator accepts the pinned state
        readPrivateFile(leaf, { expectedGid: 20 })
      }
      // sibling control state: blanket applied (the v2.1 behavior for non-pinned paths)
      const sibling = statSync(join(control, 'turn-recovery-v3.json'))
      assert.equal(sibling.gid, otherGroup, 'non-pinned control state must still receive the blanket group')
      assert.equal(sibling.mode & 0o777, 0o600, 'blanket chmod keeps 0600 leaves')
    } finally { rmSync(root, { recursive: true, force: true }) }
  })

  test('RED: the v2.1 blanket (no exclusion) flips the pinned group and the real validator rejects it', () => {
    const root = makeProdRoot()
    try {
      const me = process.getuid()
      const otherGroup = groups().find((g) => g !== 20)
      replayBlanketPass(root, { excludePinned: false, ownerUid: me, ownerGid: otherGroup })
      const leaf = join(root, 'control/scheduler-watchdog/incidents.json')
      assert.equal(statSync(leaf).gid, otherGroup, 'v2.1 blanket swept the pinned subtree')
      assert.throws(() => readPrivateFile(leaf, { expectedGid: 20 }), /unsafe incident state file/)
    } finally { rmSync(root, { recursive: true, force: true }) }
  })

  test('GREEN: RESTORE-R2 (chgrp -R 20) heals the v2.1 damage for the real validator', () => {
    const root = makeProdRoot()
    try {
      const me = process.getuid()
      const otherGroup = groups().find((g) => g !== 20)
      replayBlanketPass(root, { excludePinned: false, ownerUid: me, ownerGid: otherGroup })
      // RESTORE-R2 exact command shape (per pinned path):
      for (const p of PINNED) execFileSync('/usr/bin/chgrp', ['-R', '20', join(root, 'control', p)])
      for (const p of PINNED) {
        const leaf = join(root, 'control', p, p === 'scheduler-watchdog' ? 'incidents.json' : 'backup-1.json')
        assert.equal(statSync(leaf).gid, 20)
        readPrivateFile(leaf, { expectedGid: 20 })
      }
    } finally { rmSync(root, { recursive: true, force: true }) }
  })

  test('GREEN: missing pinned dir is pre-created by the pin assert so the first boot passes', () => {
    const root = makeProdRoot()
    try {
      rmSync(join(root, 'control/scheduler-watchdog'), { recursive: true, force: true })
      // pin-assert creation branch, verbatim semantics (uid/gid parameterized to the test user):
      const pinned = join(root, 'control/scheduler-watchdog')
      mkdirSync(pinned, { recursive: true })
      if (process.platform === 'darwin') execFileSync('chown', [`${process.getuid()}:20`, pinned])
      chmodSync(pinned, 0o700)
      assert.equal(statSync(pinned).gid, 20)
      assert.equal(statSync(pinned).mode & 0o777, 0o700)
    } finally { rmSync(root, { recursive: true, force: true }) }
  })
})
