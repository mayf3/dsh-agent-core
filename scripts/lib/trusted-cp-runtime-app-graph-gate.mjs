#!/usr/bin/env node
// trusted-cp-runtime-app-graph-gate.mjs — RUNTIME_APP_GRAPH_GATE_V1
//
// Whole-app-graph import probe of an assembled trusted-cp app closure. It
// imports the production runtime's EXACT boot graph under the candidate's own
// node-runtime, in a THROWAWAY home — it never starts services, binds ports,
// touches production state, or reads credentials.
//
// Failure class it exists to catch (agent-control#193, Product #414 Defect A,
// 2026-10-02): the fresh pack resolved @larksuite/channel → its nested
// https-proxy-agent → proxy-agent-negotiate, which NO pack input carried
// (MAIN_REPO/node_modules never had it; the old live tree's top-level copy
// predated the pack). The production runtime FATAL'd at first boot —
//   ERR_MODULE_NOT_FOUND: Cannot find package 'proxy-agent-negotiate'
//     imported from .../app/node_modules/@larksuite/channel/node_modules/https-proxy-agent/dist/index.js
// — while FRESH_CHILD_BOOT_CANARY_V1 passed, because a fresh agent CHILD boots
// the harness plugin tree and never imports the runtime app surface. This gate
// closes that coverage gap: entry.js statically pulls compose.js, which
// statically pulls feishu-connector (→ @larksuite/channel), broker, scheduler,
// product-api, agent-router, agent-provisioning, … — the whole graph the
// runtime must resolve before it can bind anything.
//
// Usage:
//   node scripts/lib/trusted-cp-runtime-app-graph-gate.mjs \
//     --app-dir <CANDIDATE_APP_DIR> [--node <NODE_BIN>] [--entry <ENTRY_JS>] \
//     [--timeout-ms 60000] [--json] [--keep-home]
// --app-dir is the app closure (bridges + node_modules populated), i.e. what
// installer §3 stages and what ships at /usr/local/libexec/agent-core/app.
// --node defaults to the invoking node; the installer/executor pass the
// candidate's own node-runtime so the graph is resolved by the binary that
// will execute it.
//
// Exit: 0 = the full boot graph imported cleanly; 2 = failure (module
// resolution/import error, or the import never settled before the timeout).
// Every "Cannot find package 'X'" line is classified and printed verbatim.

import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const MARKER = 'RUNTIME_APP_GRAPH_IMPORT_OK'
const MISSING_RE = /Cannot find package '([^']+)' imported from ([^\s]+)/g

function parseArgs(argv) {
  const args = {
    appDir: undefined,
    node: process.execPath,
    entry: undefined,
    timeoutMs: 60000,
    json: false,
    keepHome: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--app-dir') args.appDir = argv[++i]
    else if (a === '--node') args.node = argv[++i]
    else if (a === '--entry') args.entry = argv[++i]
    else if (a === '--timeout-ms') args.timeoutMs = Number(argv[++i])
    else if (a === '--json') args.json = true
    else if (a === '--keep-home') args.keepHome = true
    else {
      console.error(`unknown argument: ${a}`)
      process.exit(2)
    }
  }
  if (!args.appDir) {
    console.error('usage: node trusted-cp-runtime-app-graph-gate.mjs --app-dir <CANDIDATE_APP_DIR> [options]')
    process.exit(2)
  }
  args.appDir = resolve(args.appDir)
  args.node = resolve(args.node)
  args.entry = resolve(args.entry ?? join(args.appDir, 'packages/production-runtime/src/entry.js'))
  return args
}

export async function runGate(args, { spawnImpl = spawn, homeFactory = () => mkdtempSync(join(tmpdir(), 'dsh-app-graph-gate-')), delay = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  const entry = resolve(args.entry ?? join(args.appDir, 'packages/production-runtime/src/entry.js'))
  const result = {
    gate: 'RUNTIME_APP_GRAPH_GATE_V1',
    appDir: args.appDir,
    node: args.node,
    entry,
    home: undefined,
    ok: false,
    importSettled: false,
    timedOut: false,
    missingPackages: [],
    tail: [],
  }
  if (!existsSync(entry)) {
    result.tail = [`entry module missing: ${entry}`]
    return result
  }

  // The driver imports the entry graph and nothing else. process.exit after
  // the marker kills any import-time handle a transitive module left behind.
  const home = homeFactory()
  result.home = home
  const driver = join(home, 'runtime-app-graph-driver.mjs')
  writeFileSync(driver, `
import { pathToFileURL } from 'node:url'
// process.argv = [node, thisDriver, ENTRY] — import the entry, never this file.
try {
  await import(pathToFileURL(process.argv[2]).href)
  console.log(${JSON.stringify(MARKER)})
  process.exit(0)
} catch (error) {
  console.error(error?.stack ?? String(error))
  process.exit(2)
}
`)

  const child = spawnImpl(args.node, [driver, entry], {
    // Throwaway coordinates only: nothing in the graph we execute may reach
    // real user/production state. No --root, no credentials, no profile.
    cwd: home,
    env: {
      PATH: '/usr/bin:/bin:/usr/sbin:/sbin',
      HOME: home,
      DSH_HOME: join(home, '.dsh'),
      TMPDIR: home,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let buffered = ''
  child.stdout.on('data', (d) => { buffered += d })
  child.stderr.on('data', (d) => { buffered += d })
  let closed = false
  let spawnError = undefined
  const closedPromise = new Promise((r) => child.on('close', r))
  child.on('error', (e) => { spawnError = e; closed = true })
  child.on('close', () => { closed = true })

  const deadline = Date.now() + args.timeoutMs
  while (Date.now() < deadline && !closed) {
    await delay(100)
  }
  if (!closed) {
    result.timedOut = true
    child.kill('SIGKILL')
    await closedPromise
  }
  for (const match of buffered.matchAll(MISSING_RE)) {
    const [, spec, origin] = match
    if (!result.missingPackages.some((m) => m.spec === spec && m.origin === origin)) {
      result.missingPackages.push({ spec, origin })
    }
  }
  result.importSettled = !result.timedOut && !spawnError && buffered.includes(MARKER)
  result.ok = result.importSettled && result.missingPackages.length === 0
  result.tail = buffered.split('\n').filter(Boolean).slice(-40)
  if (spawnError) result.spawnError = String(spawnError.message ?? spawnError)
  if (!args.keepHome) rmSync(home, { recursive: true, force: true })
  return result
}

// ---- CLI (only when executed directly, not when imported by tests) --------
const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href
if (isMain) {
  const args = parseArgs(process.argv.slice(2))
  const result = await runGate(args)
  if (args.json) {
    console.log(JSON.stringify(result, null, 2))
  } else {
    for (const m of result.missingPackages) {
      console.log(`MISSING ${m.spec} imported from ${m.origin}`)
    }
    console.log(`importSettled=${result.importSettled} timedOut=${result.timedOut} tailLines=${result.tail.length}`)
    console.log(result.ok ? 'RUNTIME_APP_GRAPH_GATE PASS' : 'RUNTIME_APP_GRAPH_GATE FAIL')
  }
  process.exit(result.ok ? 0 : 2)
}
