/**
 * MOBILE_SESSION_HISTORY_RUNTIME_WIRING_SOURCE_FIX_V1 — isolated runtime boot
 * proof (nonproduction). Boots the composed Production Runtime from THIS
 * worktree over an isolated tmp layout and proves the composition contract
 * now carries productApi.history to the accepted product-api module:
 *
 *   V1  no history key            → listener never attempted (default OFF unchanged)
 *   V2  history enabled, host ''  → module fail-closed BEFORE any import (route absent)
 *   V3  history enabled, 127.0.0.1:0 (ephemeral loopback, NOT Tailscale)
 *                                 → full mount path taken; auth profile absent in the
 *                                   isolated env → listener mounts FAIL-CLOSED and every
 *                                   request answers 503 PRODUCT_API_AUTH_NOT_READY
 *
 * NO production activation: tmp layout, loopback/ephemeral binds only, no
 * Tailscale interface, no auth config file, no real agent process, no
 * deployment mutation. Run under the pinned Node v25.6.1 with proxy env unset.
 *
 *   env -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy \
 *       -u ALL_PROXY -u all_proxy -u NO_PROXY -u no_proxy \
 *       /usr/local/Cellar/node/25.6.1_1/bin/node boot-proof.mjs
 */

import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

if (process.version !== 'v25.6.1') {
  console.error(`FATAL: pinned Node v25.6.1 required, got ${process.version}`)
  process.exit(2)
}

const { resolveProductionLayout } = await import('../../../packages/production-runtime/src/paths.js')
const { composeProductionRuntime } = await import('../../../packages/production-runtime/src/compose.js')
const { writeAgentDefinition } = await import('../../../packages/agent-definition/src/config.js')

const silentLog = { log() {}, warn() {}, error() {} }
const record = { node: process.version, startedAt: new Date().toISOString(), variants: {} }

// Capture the product-api module's own stderr log (it writes directly to
// process.stderr) without leaking boot noise into this proof's output.
const originalStderrWrite = process.stderr.write.bind(process.stderr)
const stderrLines = []
process.stderr.write = (chunk) => { stderrLines.push(String(chunk)); return true }
const productApiLog = () => stderrLines.filter((l) => l.includes('[product-api]'))
const historyLog = () => productApiLog().filter((l) => l.includes('history listener'))
function restoreStderr() { process.stderr.write = originalStderrWrite }

/** Minimal per-agent process stub — boot proof never delivers a message. */
let pidSeq = 9000
function stubProcessFactory(opts) {
  return {
    agentId: opts.agentId,
    pid: ++pidSeq,
    spawn() {},
    async ready() { return 1 },
    async deliver() { throw new Error('boot proof must not deliver') },
    async turn() { throw new Error('boot proof must not turn') },
    async shutdown() { return { code: 0, signal: null } },
    kill() {},
  }
}

async function boot({ productApi }) {
  const root = mkdtempSync(join(tmpdir(), 'msh-wiring-boot-'))
  const layout = resolveProductionLayout(root)
  mkdirSync(join(root, 'scheduler'), { recursive: true })
  await writeAgentDefinition(layout.agentsConfig, {
    defaultAgentId: 'agt_wiring_proof',
    agents: [{ id: 'agt_wiring_proof', name: 'Wiring Proof Agent' }],
  })
  const runtime = await composeProductionRuntime({
    layout,
    productApi,
    notificationIngress: { enabled: false, port: 0 },
    processFactory: stubProcessFactory,
    log: silentLog,
  })
  await runtime.start()
  return { runtime, cleanup: () => { runtime.stop(); rmSync(root, { recursive: true, force: true }) } }
}

async function fetchLoopbackHealth(runtime) {
  const { host, port } = runtime.productApi.address()
  const res = await fetch(`http://${host}:${port}/health`)
  return { status: res.status, body: await res.json() }
}

try {
  // ── V1: no history key — default OFF unchanged ──────────────────────────
  {
    stderrLines.length = 0
    const { runtime, cleanup } = await boot({ productApi: { enabled: true, host: '127.0.0.1', port: 0 } })
    try {
      const health = await fetchLoopbackHealth(runtime)
      const address = runtime.productApi.address()
      record.variants.V1_no_history_key = {
        historyListenerAttempted: historyLog().length > 0,
        historyLog: historyLog(),
        loopbackHealth: health.status,
        loopbackAddress: address,
      }
      assert.equal(historyLog().length, 0, 'V1: no history mount attempt without a history key')
      assert.equal(health.status, 200, 'V1: loopback product api healthy')
    } finally { cleanup() }
  }

  // ── V2: history enabled with empty bind host — fail-closed BEFORE import ─
  {
    stderrLines.length = 0
    const { runtime, cleanup } = await boot({
      productApi: { enabled: true, host: '127.0.0.1', port: 0, history: { enabled: true, host: '' } },
    })
    try {
      const health = await fetchLoopbackHealth(runtime)
      record.variants.V2_empty_bind_host = {
        historyLog: historyLog(),
        loopbackHealth: health.status,
        failClosedBeforeImport: historyLog().some((l) => l.includes('no Tailscale bind host configured')),
      }
      assert.ok(
        historyLog().some((l) => l.includes('history listener enabled but no Tailscale bind host configured; history route stays absent')),
        'V2: the history config crossed the composition boundary (module applied its own fail-closed rule)',
      )
      assert.equal(health.status, 200, 'V2: loopback product api untouched')
    } finally { cleanup() }
  }

  // ── V3: full mount path over an isolated fixed LOOPBACK port — config
  //      reachable E2E, auth fail-closed (isolated env has NO auth config →
  //      503). The module's own log prints the CONFIGURED port, so the proof
  //      uses a concrete uncommon port instead of 0 to fetch the route. ────
  {
    stderrLines.length = 0
    const PROOF_PORT = 47878
    const { runtime, cleanup } = await boot({
      productApi: { enabled: true, host: '127.0.0.1', port: 0, history: { enabled: true, host: '127.0.0.1', port: PROOF_PORT } },
    })
    try {
      // The module mounts the listener asynchronously (dynamic imports).
      let mounted = false
      const deadline = Date.now() + 10_000
      while (Date.now() < deadline) {
        if (historyLog().some((l) => l.includes(`history listener listening on http://127.0.0.1:${PROOF_PORT}`))) {
          mounted = true
          break
        }
        await new Promise((r) => setTimeout(r, 100))
      }
      assert.ok(mounted, `V3: history listener mounted through the composition config (loopback:${PROOF_PORT})`)

      // Fail-closed admission: no auth config in the isolated env → 503.
      const res = await fetch(`http://127.0.0.1:${PROOF_PORT}/v1/agents/agt_wiring_proof/sessions/main/messages`)
      const body = await res.json()

      // The main loopback surface never serves the history route (CTR-PA-009).
      const { host, port } = runtime.productApi.address()
      const loopbackHistoryProbe = await fetch(`http://${host}:${port}/v1/agents/agt_wiring_proof/sessions/main/messages`)
      const loopbackProbeBody = await loopbackHistoryProbe.json()

      record.variants.V3_loopback_full_mount = {
        historyListenerAddress: `http://127.0.0.1:${PROOF_PORT}`,
        historyLog: historyLog(),
        historyRouteStatus: res.status,
        historyRouteBody: body,
        loopbackSurfaceHistoryStatus: loopbackHistoryProbe.status,
        loopbackSurfaceHistoryBody: loopbackProbeBody,
        loopbackHealth: (await fetchLoopbackHealth(runtime)).status,
        productionActivation: 'NONE — tmp layout, ephemeral loopback binds only, no Tailscale interface, no auth config, no real agent process',
      }
      assert.equal(res.status, 503, 'V3: listener mounted but auth profile absent → fail-closed 503')
      assert.equal(body?.error?.code, 'PRODUCT_API_AUTH_NOT_READY', 'V3: exact fail-closed error code')
      assert.equal(loopbackHistoryProbe.status, 404, 'V3: loopback server keeps the history route ABSENT')
      assert.equal(loopbackProbeBody?.error?.code, 'NOT_FOUND', 'V3: loopback absence uses the frozen envelope')
    } finally { cleanup() }
  }

  record.result = 'PASS'
} catch (error) {
  record.result = 'FAIL'
  record.error = { message: error?.message, stack: error?.stack?.split('\n').slice(0, 6) }
} finally {
  restoreStderr()
  record.finishedAt = new Date().toISOString()
  process.stdout.write(JSON.stringify(record, null, 2) + '\n')
  process.exit(record.result === 'PASS' ? 0 : 1)
}
