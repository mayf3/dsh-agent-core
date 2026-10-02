/**
 * Runtime hygiene guard (Product #434): the generic runtime source tree must
 * carry NO one-off HR incident knowledge.
 *
 * The banned literals below are the fixed identities of the spent 2026-09 HR
 * incident operations (agent id, the three one-shot operation-id families,
 * the fixed old turn handle, the root projection/ack host paths) plus the
 * names of the deleted one-off deployment modules. The generic Router /
 * reconciliation / scheduler runtime must not know any of them; the exact
 * incident data lives only in historical evidence, deployment artifacts,
 * tests, and explicitly non-runtime maintenance tooling (scripts/lib,
 * scripts/scheduler-cp-disable-forensics.mjs, deployment-artifacts/, and the
 * human-run deploy runbook module exempted below).
 *
 * Sanctioned runtime exemptions (each pinned by an accepted authority):
 *  - product-api admin route files: the administrator turn-abandonment entry
 *    (AGENT_PROCESS_ADMIN_TURN_ABANDONMENT_V1) is frozen to its original
 *    subject by that accepted spec and is reached only through the
 *    authenticated scheduler-token verifier. Full de-specialization requires
 *    amending that spec, not this cleanup.
 *  - production-runtime scheduler deploy runbook: deployment-runtime-restart.js
 *    is a human-run controlled-deployment module (scheduler-cp-admission
 *    surface), not part of the launchd runtime import graph; its expected
 *    durable-store path is standing deployment configuration for the
 *    production host.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = fileURLToPath(new URL('../../../..', import.meta.url))

const BANNED_LITERALS = [
  'agt_hr-agent',
  'hr-fresh-lineage-cut-20260929-0d8235e7',
  'hr-fresh-lineage',
  'hr-s256',
  'hr-admin',
  'hr-post-coherent',
  'turn:961534a5-8c94-487d-8e55-d324a54e821a',
  '/usr/local/libexec/agent-deploy-system',
  '/private/var/db/agent-deploy-system',
  '/Users/authsvc',
]

/**
 * Spec/authority-pinned runtime exemptions: exact src file -> literals it may
 * still carry. Anything not listed here must be clean.
 */
const EXEMPT = new Map([
  ['packages/product-api/src/agent-process-admin-routes.js', ['agt_hr-agent']],
  ['packages/product-api/src/index.js', ['agt_hr-agent']],
  ['packages/production-runtime/src/scheduler/deployment-runtime-restart.js', ['/Users/authsvc']],
])

function* walkSources(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === 'deployment-artifacts') continue
      yield* walkSources(path)
    } else if (/\.(js|mjs)$/.test(entry)) {
      yield path
    }
  }
}

test('generic runtime src carries no one-off HR incident knowledge', () => {
  const violations = []
  for (const packageDir of ['packages']) {
    const base = join(REPO_ROOT, packageDir)
    for (const entry of readdirSync(base)) {
      const srcDir = join(base, entry, 'src')
      try { if (!statSync(srcDir).isDirectory()) continue } catch { continue }
      for (const path of walkSources(srcDir)) {
        const rel = path.slice(REPO_ROOT.length)
        const allowed = EXEMPT.get(rel) ?? []
        const text = readFileSync(path, 'utf8')
        for (const literal of BANNED_LITERALS) {
          if (!text.includes(literal)) continue
          if (allowed.includes(literal)) continue
          violations.push(`${rel}: ${literal}`)
        }
      }
    }
  }
  assert.deepEqual(violations, [])
})

test('launchd runtime entry carries no one-off HR incident knowledge', () => {
  const entry = readFileSync(join(REPO_ROOT, 'scripts/production-runtime.mjs'), 'utf8')
  for (const literal of BANNED_LITERALS) {
    assert.equal(entry.includes(literal), false, `launchd entry knows ${literal}`)
  }
})

