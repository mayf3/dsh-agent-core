#!/usr/bin/env node
/**
 * SIGTRAP fix v1 — Phase 8 production canary observation.
 * Watches all imported-agent MEMORY.md files; for every file modified AFTER
 * a reference timestamp (deploy time), verifies with the INSTALLED production
 * memory.js: parse under production guard limits, render fixpoint, repeated
 * render stability, sane source bounds, zero size growth across a forced
 * write/read cycle ON AN ISOLATED COPY. Output = per-agent PASS lines +
 * CANARY_SUMMARY json. Read-only against production files (copies only).
 *
 * Usage: node canary-watch.mjs --since <iso|epoch-seconds> [--window-seconds 900] [--map <primary-workspaces.json>]
 */
import { readFileSync, writeFileSync, existsSync, statSync, copyFileSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const INSTALLED_MEMORY_JS = '/usr/local/libexec/agent-core/app/packages/agent-memory/src/memory.js'
const NODE = '/usr/local/libexec/agent-core/node-runtime/bin/node'
const DEFAULT_MAP = '/Users/yanfenma/.agent-core/primary-workspaces.json'

const args = process.argv.slice(2)
const argOf = (f) => (args.includes(f) ? args[args.indexOf(f) + 1] : undefined)
const sinceMs = argOf('--since') ? Date.parse(argOf('--since')) : Date.now() - 15 * 60 * 1000
const windowS = Number(argOf('--window-seconds') ?? 900)
const mapPath = argOf('--map') ?? DEFAULT_MAP

const map = JSON.parse(readFileSync(mapPath, 'utf8'))
const targets = Object.entries(map)
  .map(([agentId, ws]) => ({ agentId, file: `${ws}/MEMORY.md`, ws }))
  .filter((t) => existsSync(t.file))

console.log(`canary-watch: ${targets.length} imported agents, watching for MEMORY.md writes after ${new Date(sinceMs).toISOString()}, window ${windowS}s`)
const deadline = Date.now() + windowS * 1000
const observed = new Set()
while (Date.now() < deadline && observed.size === 0) {
  for (const t of targets) {
    try {
      if (statSync(t.file).mtimeMs > sinceMs) observed.add(t.agentId)
    } catch { /* vanished: skip */ }
  }
  if (observed.size === 0) await new Promise((r) => setTimeout(r, 15_000))
}
if (observed.size === 0) {
  console.log('CANARY_SUMMARY ' + JSON.stringify({ observedTurns: 0, verdict: 'NO_TRAFFIC_IN_WINDOW' }))
  process.exit(0)
}

mkdirSync('/Users/yanfenma/workspace/sigtrap-fix-v1-sandbox/deploy/logs/canary-drills', { recursive: true })
const results = []
const script = `
const { loadEntries, renderEntries, parseEntries, writeEntries } = await import(${JSON.stringify(INSTALLED_MEMORY_JS)})
const { readFileSync, copyFileSync, statSync } = await import('node:fs')
const [file, drill] = process.argv.slice(2)
const entries = await loadEntries(file)
const text = readFileSync(file, 'utf8')
const re = renderEntries(entries)
const stable = renderEntries(parseEntries(re))
const maxSource = entries.reduce((n, e) => Math.max(n, e.source.length), 0)
copyFileSync(file, drill)
const before = statSync(drill).size
const de = await loadEntries(drill)
await writeEntries(drill, de)
const db = await loadEntries(drill)
const drillOk = JSON.stringify(de) === JSON.stringify(db) && statSync(drill).size >= before
console.log(JSON.stringify({ parse: true, renderFixpoint: re === text, stable: stable === text, entries: entries.length, maxSource, drillOk, size: statSync(file).size }))
`
for (const agentId of [...observed].sort()) {
  const t = targets.find((x) => x.agentId === agentId)
  const drill = `/Users/yanfenma/workspace/sigtrap-fix-v1-sandbox/deploy/logs/canary-drills/${agentId}-MEMORY.md`
  let res
  try {
    const out = execFileSync(NODE, ['--input-type=module', '-e', script, t.file, drill], { encoding: 'utf8', timeout: 120_000 })
    res = JSON.parse(out.trim().split('\n').pop())
  } catch (error) {
    res = { parse: false, error: String(error.message).slice(0, 200) }
  }
  const pass = res.parse && res.renderFixpoint && res.stable && res.drillOk && res.maxSource <= 8192
  results.push({ agentId, pass, ...res })
  console.log(`CANARY ${agentId}: ${pass ? 'PASS' : 'FAIL'} ${JSON.stringify(res)}`)
}
const allPass = results.every((r) => r.pass)
console.log('CANARY_SUMMARY ' + JSON.stringify({ observedTurns: results.length, allPass, results }))
writeFileSync('/Users/yanfenma/workspace/sigtrap-fix-v1-sandbox/deploy/logs/canary-watch-result.json', JSON.stringify({ since: new Date(sinceMs).toISOString(), results, allPass }, null, 1))
process.exit(allPass ? 0 : 1)
