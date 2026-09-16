import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chmodSync, chownSync, mkdirSync, writeFileSync } from 'node:fs'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// B5 closure: the finalize readback gate executes against a REAL gid-split
// fixture tree — the production contract is authsvcGid (authsvc primary
// group, 601 on the host) for the store, runtimeReaderGid (staff=20) for
// incident state, and root control ownership {0,0} for control receipts.
// This test uses the runner's own distinct supplementary groups so the split
// is exercised unprivileged; the reader under test is the exact code path
// production finalize uses (readPrivateFile contracts included).
import { createOwnershipReadbacks, resolveIncidentOwnership } from '../../../../scripts/lib/scheduler-postdeploy-finalize.mjs'

test('postdeploy finalize readback gate survives the authsvc/runtime-reader gid split', async (t) => {
  const authsvcGid = process.getgid()
  const other = process.getgroups().filter((gid) => gid !== authsvcGid)
  if (other.length < 2) { t.skip('needs two supplementary groups to build the gid split'); return }
  const [readerGid, controlGid] = other
  assert.notEqual(readerGid, authsvcGid)
  assert.notEqual(controlGid, authsvcGid)

  const root = await mkdtemp(join(tmpdir(), 'postdeploy-ownership-'))
  chmodSync(root, 0o700)
  const me = process.getuid()
  const storePath = join(root, 'store', 'jobs.json')
  mkdirSync(join(root, 'store'))
  writeFileSync(storePath, JSON.stringify({ version: 3, jobs: [], occurrences: [], fences: {} }), { mode: 0o600 })
  chownSync(storePath, me, authsvcGid)

  // incident state lives in the prepared state directory whose OWNERSHIP is
  // the runtime-reader gid (NOT the authsvc primary group) — the exact split
  // that deterministically failed the pre-B5 finalize.
  const stateDir = join(root, 'control', 'scheduler-watchdog')
  mkdirSync(stateDir, { recursive: true })
  chmodSync(stateDir, 0o700)
  chownSync(stateDir, me, readerGid)
  const incidentsPath = join(stateDir, 'incidents.json')
  writeFileSync(incidentsPath, JSON.stringify({ version: 1, revision: 1, incidents: {}, outbox: {} }), { mode: 0o600 })
  chownSync(incidentsPath, me, readerGid)

  const artifactsDir = join(root, 'artifacts')
  mkdirSync(join(artifactsDir, 'rollback'), { recursive: true })
  const routingReceiptPath = join(artifactsDir, 'rollback', 'routing-install-receipt.json')
  writeFileSync(routingReceiptPath, JSON.stringify({ status: 'INSTALLED' }), { mode: 0o600 })
  chownSync(routingReceiptPath, me, controlGid)

  // ownership resolution is the state directory itself (canonical source —
  // the same stat the controller uses for __INCIDENT_OWNER_GID__), and the
  // split is real: incident gid != authsvc primary gid.
  const ownership = resolveIncidentOwnership(incidentsPath, { authsvcUid: me, authsvcGid })
  assert.deepEqual(ownership, { expectedUid: me, expectedGid: readerGid })
  assert.notEqual(ownership.expectedGid, authsvcGid)

  const readbacks = createOwnershipReadbacks({
    artifactsDir, storePath, incidentsPath, authsvcUid: me, authsvcGid,
    controlOwnership: { expectedUid: me, expectedGid: controlGid },
  })
  // happy path: all three evidence sources read cleanly through their
  // canonical contracts (0600 + exact uid/gid enforced by readPrivateFile).
  const store = readbacks.readStoreSnapshot()
  assert.equal(store.store.version, 3)
  const incident = readbacks.readIncidentSnapshot()
  assert.equal(incident.state.revision, 1)
  const routingReceipt = readbacks.readRoutingReceipt()
  assert.equal(routingReceipt.status, 'INSTALLED')

  // wrong-gid incident state (the pre-B5 contract: authsvc primary group)
  // must fail closed at the readback gate — modeled by injecting the legacy
  // expectation explicitly, exactly what the old finalize hardcoded.
  const legacy = createOwnershipReadbacks({
    artifactsDir, storePath, incidentsPath, authsvcUid: me, authsvcGid,
    controlOwnership: { expectedUid: me, expectedGid: controlGid },
    incidentOwnership: { expectedUid: me, expectedGid: authsvcGid },
  })
  assert.throws(() => legacy.readIncidentSnapshot(), /unsafe incident state file/)
})

test('routing receipt readback fails closed on a wrong control gid', async (t) => {
  const authsvcGid = process.getgid()
  const other = process.getgroups().filter((gid) => gid !== authsvcGid)
  if (other.length < 1) { t.skip('needs a supplementary group for the wrong-gid case'); return }
  const wrongGid = other[0]
  const root = await mkdtemp(join(tmpdir(), 'postdeploy-receipt-'))
  chmodSync(root, 0o700)
  const artifactsDir = join(root, 'artifacts')
  mkdirSync(join(artifactsDir, 'rollback'), { recursive: true })
  const routingReceiptPath = join(artifactsDir, 'rollback', 'routing-install-receipt.json')
  writeFileSync(routingReceiptPath, JSON.stringify({ status: 'INSTALLED' }), { mode: 0o600 })
  chownSync(routingReceiptPath, process.getuid(), wrongGid)
  const readbacks = createOwnershipReadbacks({
    artifactsDir, storePath: join(root, 'jobs.json'), incidentsPath: join(root, 'incidents.json'),
    authsvcUid: process.getuid(), authsvcGid,
    incidentOwnership: { expectedUid: process.getuid(), expectedGid: authsvcGid },
    controlOwnership: { expectedUid: process.getuid(), expectedGid: wrongGid },
  })
  assert.equal(readbacks.readRoutingReceipt().status, 'INSTALLED')
  const hostile = createOwnershipReadbacks({
    artifactsDir, storePath: join(root, 'jobs.json'), incidentsPath: join(root, 'incidents.json'),
    authsvcUid: process.getuid(), authsvcGid,
    incidentOwnership: { expectedUid: process.getuid(), expectedGid: authsvcGid },
    controlOwnership: { expectedUid: process.getuid(), expectedGid: authsvcGid === wrongGid ? (process.getgroups()[0] ?? wrongGid) : authsvcGid },
  })
  assert.throws(() => hostile.readRoutingReceipt(), /unsafe incident state file/)
})
