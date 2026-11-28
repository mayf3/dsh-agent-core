// Consumer-owned assumption checks for the isolated Core Recovery pilot.
import { fork } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { createServer } from 'node:http'
import { registerHooks } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'

const sha = data => createHash('sha256').update(data).digest('hex')
const profile = JSON.parse(await readFile(new URL('./recovery-assumption-probes.json', import.meta.url)))
const childEntry = fileURLToPath(import.meta.url)
const messageId = 'isolated-recovery-probe-message'
const requestId = 'isolated-recovery-probe-original'

function print(value) { process.stdout.write(`${JSON.stringify(value)}\n`) }
function verdict(result, evidence = { observation_available: false }) {
  print({ result, evidence })
  process.exitCode = { PASS: 0, FAIL: 1, UNKNOWN: 2 }[result]
}

async function scratch(action) {
  const directory = await mkdtemp(join(tmpdir(), 'core-recovery-assumption-'))
  try { return await action(directory) }
  finally { await rm(directory, { recursive: true, force: true }) }
}

function observeChild(args, interrupt = false) {
  return new Promise((resolve, reject) => {
    const child = fork(childEntry, args, { execArgv: [], env: {}, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] })
    let message, timedOut = false
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL') }, 8000)
    child.once('message', observed => {
      message = observed
      if (interrupt) child.kill('SIGKILL')
    })
    child.once('error', error => { clearTimeout(timer); reject(error) })
    child.once('exit', (code, signal) => {
      clearTimeout(timer)
      resolve({ code, signal, message, timedOut, pid: child.pid })
    })
  })
}

async function ledgerChild(mode, directory) {
  const { ExecutionLedger } = await import('../src/ledger.js')
  const { intent, VISIT } = await import('../test/observation-cas/fixture.js')
  const ledger = new ExecutionLedger({ dir: directory })
  async function snapshot() {
    const attempt = ledger.get(VISIT)
    const { attemptId, generation, phase, nodeVisitId, dispatchIntentId, workflowInstanceId } = attempt ?? {}
    return {
      identity: { attemptId, generation, nodeVisitId, dispatchIntentId, workflowInstanceId }, phase,
      ledger_sha256: sha(await readFile(join(directory, 'attempts.jsonl'))),
      pid: process.pid,
    }
  }
  if (mode === 'reader') {
    await ledger.snapshotFresh()
    process.send(await snapshot(), () => process.disconnect())
    return
  }
  // Keep the writer in the real admission callback after WAL append/fsync.
  // The driver kills this child before delivering any external request.
  process.on('message', () => {})
  await ledger.beginAttemptIfAbsent(intent(), async (_attempt, { recordDeliveryStarted }) => {
    await recordDeliveryStarted()
    process.send(await snapshot())
    await new Promise(() => {})
  })
}

async function ledgerProbe() {
  return scratch(async directory => {
    const written = await observeChild(['ledger-child', 'writer', directory], true)
    if (written.timedOut || !written.message || written.signal !== 'SIGKILL') return verdict('UNKNOWN')
    const restarted = await observeChild(['ledger-child', 'reader', directory])
    if (restarted.timedOut || !restarted.message || restarted.code !== 0) return verdict('UNKNOWN')
    const before = written.message, after = restarted.message
    const identity = before.identity
    const sameAttempt = Object.keys(identity).length === 5 && Object.values(identity).every(Boolean)
      && JSON.stringify(identity) === JSON.stringify(after.identity)
    const evidence = {
      same_attempt: sameAttempt, writer_sigkill_observed: before.pid === written.pid,
      separate_reader: after.pid === restarted.pid && after.pid !== process.pid,
      delivery_fence_replayed: before.phase === 'delivery_started' && after.phase === before.phase,
      identical_native_bytes: before.ledger_sha256 === after.ledger_sha256,
      native_ledger_sha256: after.ledger_sha256,
    }
    const passed = sameAttempt && evidence.writer_sigkill_observed && evidence.separate_reader && evidence.delivery_fence_replayed
      && evidence.identical_native_bytes
    verdict(passed ? 'PASS' : 'FAIL', evidence)
  })
}

async function runtimeChild() {
  const sources = profile.loaded_sources.map(({ path }) => new URL(`../../../${path}`, import.meta.url).href)
  const digests = new Map()
  const hook = registerHooks({
    load(url, context, nextLoad) {
      const result = nextLoad(url, context)
      if (sources.includes(url) && result.source !== null && result.source !== undefined) {
        const bytes = typeof result.source === 'string' ? result.source : Buffer.from(result.source)
        digests.set(url, sha(bytes))
      }
      return result
    },
  })
  let exports
  try {
    exports = await Promise.all(sources.map(async (url, index) => {
      const module = await import(url)
      return typeof module[profile.loaded_sources[index].export] === 'function'
    }))
  } finally { hook.deregister() }
  process.send({ sources: sources.map(url => digests.get(url)), exports, runtime: process.versions.node,
    node_path_sha256: sha(await readFile(process.execPath)), pid: process.pid },
  () => process.disconnect())
}

async function runtimeProbe() {
  const child = await observeChild(['runtime-child'])
  if (child.timedOut || !child.message || child.code !== 0) return verdict('UNKNOWN')
  const observed = child.message
  if (observed.sources.some(digest => !digest)) return verdict('UNKNOWN')
  const sourceMatch = observed.sources.every((digest, index) => digest === profile.loaded_sources[index].sha256)
  const evidence = {
    loaded_sources_sha256: sha(JSON.stringify(observed.sources)), loaded_source_count: observed.sources.length,
    node_executable_path_sha256: observed.node_path_sha256, node_version_sha256: sha(observed.runtime),
    exact_loaded_sources: sourceMatch && observed.exports.every(Boolean),
    exact_node_version: observed.runtime === profile.node_version,
    separate_process: observed.pid === child.pid && observed.pid !== process.pid,
  }
  verdict(evidence.exact_loaded_sources && evidence.exact_node_version && evidence.separate_process ? 'PASS' : 'FAIL', evidence)
}

async function routerFixture() {
  await scratch(async directory => {
    const { TurnReconciliationStore } = await import('../../agent-router/src/reconciliation/store.js')
    const persistenceFile = join(directory, 'router-reconciliation.json')
    const writer = new TurnReconciliationStore({ runtimeEpoch: 'assumption-writer', persistenceFile })
    const handle = writer.mintTurnExecution({ agentId: 'agt_target-agent', processGeneration: 1,
      sessionId: 'main', callerCorrelation: { requestId } })
    writer.markAdmitted(handle, { eventWatermarkSeq: 0, promptRequestId: 'isolated-original-prompt',
      deadlineAtWallMs: Date.now() + 60000 })
    writer.markPromptWriteAttempted(handle)
    writer.markPromptReceipt(handle, { messageId })
    const reader = new TurnReconciliationStore({ runtimeEpoch: 'assumption-reader', persistenceFile })
    let available = true
    const server = createServer((request, response) => {
      if (request.method !== 'GET' || request.url !== `/recovery-correlation/${requestId}`) {
        response.writeHead(404).end()
      } else if (!available) {
        response.writeHead(503).end()
      } else {
        response.writeHead(200, { 'Content-Type': 'application/json' })
        response.end(JSON.stringify(reader.resolveCallerCorrelation({ requestId })))
      }
    })
    await new Promise((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', resolve)
    })
    const commands = createInterface({ input: process.stdin, crlfDelay: Infinity })
    try {
      print({ port: server.address().port })
      for await (const command of commands) {
        if (command === 'stop') break
        if (command === 'unavailable' || command === 'ready') {
          available = command === 'ready'
          print({ available })
        }
      }
    } finally {
      commands.close()
      process.stdin.pause()
      await new Promise(resolve => {
        server.close(resolve)
        server.closeAllConnections()
      })
    }
  })
}

async function routerProbe(port) {
  if (!/^\d+$/.test(port ?? '') || Number(port) < 1 || Number(port) > 65535) return verdict('UNKNOWN')
  const response = await fetch(`http://127.0.0.1:${port}/recovery-correlation/${requestId}`, {
    redirect: 'error', signal: AbortSignal.timeout(2000),
  })
  if (response.status === 503) return verdict('FAIL', { http_status: 503, receipt_observed: false })
  if (!response.ok) return verdict('UNKNOWN', { http_status: response.status })
  const payload = await response.text()
  const receipt = JSON.parse(payload)
  if (typeof receipt?.state !== 'string') return verdict('UNKNOWN', { http_status: response.status })
  const sameRequest = receipt.state === 'recovering' && receipt.snapshot?.callerCorrelation?.requestId === requestId
    && receipt.snapshot?.messageId === messageId && typeof receipt.handle === 'string'
    && receipt.handle === receipt.snapshot?.handle && receipt.snapshot?.fenceState === 'active'
  verdict(sameRequest ? 'PASS' : 'FAIL', {
    same_request_receipt: sameRequest, http_status: response.status, receipt_sha256: sha(payload),
  })
}

const [probe, ...args] = process.argv.slice(2)
try {
  if (process.connected && probe === 'ledger-child') await ledgerChild(...args)
  else if (process.connected && probe === 'runtime-child') await runtimeChild()
  else if (probe === 'ledger' && args.length === 0) await ledgerProbe()
  else if (probe === 'runtime' && args.length === 0) await runtimeProbe()
  else if (probe === 'router' && args.length === 1) await routerProbe(args[0])
  else if (probe === 'router-fixture' && args.length === 0) await routerFixture()
  else verdict('UNKNOWN')
} catch {
  // Unavailable, unreadable or malformed observations grant no coverage.
  if (process.connected) { process.exitCode = 2; process.disconnect() }
  else if (probe === 'router-fixture') process.exitCode = 2
  else verdict('UNKNOWN')
}
