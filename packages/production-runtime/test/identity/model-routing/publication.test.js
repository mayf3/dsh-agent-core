import assert from 'node:assert/strict'
import { test } from 'node:test'
import { A, entry, config, setup } from './support.js'

test('ACC-RCG-001: validated captured bytes, not a post-validation rewrite, are atomically activated', t => {
  const f = setup(t)
  let mutate = false
  const newer = config()
  newer.overrides[A] = entry('r2')
  const runtime = f.create({ beforeActivate: () => {
    if (mutate) {
      mutate = false
      f.write(newer)
    }
  } })
  const next = config()
  next.overrides[A] = entry('r1')
  f.write(next)
  mutate = true
  const publication = runtime.publish()
  assert.equal(publication.decision, 'activated')
  assert.equal(runtime.activeGeneration.overrides[A].primary, 'r1')
  const capturedId = runtime.activeGeneration.generationId
  const afterRewrite = runtime.resolveChain(A)
  assert.notEqual(afterRewrite.generationId, capturedId)
  assert.equal(afterRewrite.routes[0].routeRef, 'r2')
})

test('ACC-RCG-001: activation fault cannot expose half a generation or authorize old consumption', t => {
  const f = setup(t)
  let fault = false
  const runtime = f.create({ beforeActivate: () => {
    if (fault) throw new Error('fixture-activation-fault')
  } })
  const before = runtime.resolveChain(A)
  const next = config()
  next.overrides[A] = entry('r1')
  f.write(next)
  fault = true
  const outcome = runtime.publish()
  assert.equal(outcome.decision, 'rejected')
  assert.equal(runtime.activeGeneration.generationId, before.generationId)
  assert.equal(runtime.activeGeneration.overrides[A].primary, 'r0')
  assert.throws(() => runtime.resolveChain(A), error => error.configGeneration?.decision === 'refuse')
})

test('ACC-RCG-001: an older publication cannot overwrite a confirmed reentrant newer publication', t => {
  const f = setup(t)
  let reenter = false
  let innerId
  let runtime
  runtime = f.create({ beforeActivate: () => {
    if (!reenter) return
    reenter = false
    const newest = config()
    newest.overrides[A] = entry('r2')
    f.write(newest)
    const inner = runtime.publish()
    assert.equal(inner.decision, 'activated')
    innerId = inner.activeGenerationId
  } })
  const older = config()
  older.overrides[A] = entry('r1')
  f.write(older)
  reenter = true
  runtime.publish()
  assert.ok(innerId)
  assert.equal(runtime.activeGeneration.generationId, innerId)
  assert.equal(runtime.activeGeneration.overrides[A].primary, 'r2')
  assert.equal(runtime.resolveChain(A).generationId, innerId)
})

test('ACC-RCG-005: closing during activation ends the lifecycle and cannot reactivate it', t => {
  const f = setup(t)
  let closeAtCommit = false
  let runtime
  runtime = f.create({ beforeActivate: () => {
    if (closeAtCommit) runtime.close()
  } })
  const next = config()
  next.overrides[A] = entry('r1')
  f.write(next)
  closeAtCommit = true
  runtime.publish()
  assert.throws(() => runtime.resolveChain(A), error => error.configGeneration?.decision === 'refuse')
})
