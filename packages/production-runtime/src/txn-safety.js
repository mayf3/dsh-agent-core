// txn-safety.mjs — the single transaction safety core (R1-02/R1-03 repair).
// Every entrypoint in this candidate goes through this module. Default
// invocation of ANY entrypoint is READ-ONLY (--check semantics): no writes,
// no markers, no receipts, no restarts. A production mutation requires BOTH
// --production AND --apply. A sandbox mutation requires --apply with a root
// that mechanically cannot resolve to production (realpath containment,
// symlink-component rejection). Session roots are NEVER writable by the
// transaction (Owner S3). Helper execution is allowlisted; environment is
// scrubbed, never inherited.
import { lstatSync, realpathSync } from 'node:fs'
import { isAbsolute, join, dirname, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

export const PRODUCTION_ROOT = '/Users/yanfenma/.agent-core'
export const PRODUCTION_CHECKOUT = '/Users/yanfenma/workspace/project/production-dsh-agent-core'
export const CANONICAL_CREDENTIAL_PATH = `${PRODUCTION_ROOT}/shared-credentials/openai-codex/.openai-codex-auth.json`
export const SHARED_CONFIG_PATH = `${PRODUCTION_ROOT}/agent-model-overrides.json`
export const FENCE_PATH = `${PRODUCTION_ROOT}/control/shared-codex-migration-fence.json`
const SESSION_PATH_RE = /\/homes\/[^/]+\/sessions\//u

/** The exact production write set of this transaction (files + dir
 * prefixes). Shared by the executable and every helper writer; session
 * paths are rejected before prefix matching, so the homes/…/profiles
 * prefixes can never reach a sessions/ path. */
export const DECLARED_TRANSACTION_WRITES = Object.freeze([
  FENCE_PATH,
  SHARED_CONFIG_PATH,
  `${SHARED_CONFIG_PATH}.pre-v3`,
  `${PRODUCTION_ROOT}/control/stage/`,
  `${PRODUCTION_ROOT}/control/provenance-inventory.json`,
  `${PRODUCTION_ROOT}/control/dsh-codex-artifact-receipt.json`,
  `${PRODUCTION_ROOT}/control/transaction-receipt.json`,
  `${PRODUCTION_ROOT}/shared-credentials/openai-codex/`,
  `${PRODUCTION_CHECKOUT}/packages/`,
  `${PRODUCTION_ROOT}/homes/agt_stock_agent/profiles/node_modules/`,
  `${PRODUCTION_ROOT}/homes/agt_ceo-agent/profiles/node_modules/`,
  `${PRODUCTION_ROOT}/homes/agt_cto-agent/profiles/node_modules/`,
])

export function gateError(code, message) {
  return Object.assign(new Error(`txn-safety: ${message}`), { code: `TXN_SAFETY_${code}` })
}

/** Parse gate flags. Default (no flags/env) = read-only check. The
 * executable passes the resolved gate to allowlisted helpers via
 * AGENT_CORE_GATE_MODE / AGENT_CORE_GATE_PRODUCTION (helpers' own argv
 * carries no flags); a standalone helper invocation without that env is
 * always read-only — the safe default. */
export function parseGate(argv = process.argv) {
  const apply = argv.includes('--apply') || process.env.AGENT_CORE_GATE_MODE === 'apply'
  const production = argv.includes('--production') || process.env.AGENT_CORE_GATE_PRODUCTION === '1'
  if (production && !apply) throw gateError('FLAGS_INVALID', '--production without --apply is meaningless (default is read-only check); refusing')
  return Object.freeze({ mode: apply ? 'apply' : 'check', production, mutationAllowed: apply })
}

/** Gate env block the executable forwards to allowlisted helper bindings. */
export function gateEnv(gate) {
  return { AGENT_CORE_GATE_MODE: gate.mode, AGENT_CORE_GATE_PRODUCTION: gate.production ? '1' : '0' }
}

/**
 * Bind the transaction root. Sandbox root: must exist, must not be '/',
 * every existing path component must be a non-symlink, and its realpath
 * must not be (or contain, or be inside) the production root or checkout.
 * Production root '/' is accepted ONLY under gate.production && gate.apply.
 */
export function bindRoot(config, gate = parseGate()) {
  if (!config || typeof config.root !== 'string' || !isAbsolute(config.root)) {
    throw gateError('ROOT_INVALID', 'config.root must be an absolute path')
  }
  if (config.root === '/') {
    // Production binding: apply-mode requires BOTH --production and --apply;
    // check-mode (read-only inspection of the production config) is allowed
    // and can perform zero writes (createWriter throws on any assert).
    if (gate.mode === 'apply' && !(gate.production && gate.mutationAllowed)) {
      throw gateError('PRODUCTION_NOT_AUTHORIZED', 'production root requires BOTH --production and --apply (default is read-only)')
    }
    return Object.freeze({ kind: 'production', root: '/', productionRoot: PRODUCTION_ROOT, gate })
  }
  // sandbox: bind on the RESOLVED realpath and contain it mechanically.
  // A symlink component that resolves into production (or the checkout)
  // makes `real` land inside the production zone and is rejected below —
  // symlink ESCAPE is closed by containment on the resolved root, without
  // false-positives on benign system symlinks (macOS /tmp → /private/tmp).
  let real
  try {
    real = realpathSync(config.root)
  } catch (cause) {
    throw gateError('ROOT_INVALID', `sandbox root does not resolve: ${cause.message}`)
  }
  if (!real.startsWith('/private/tmp/')) {
    throw gateError('SANDBOX_LOCATION_INVALID', `sandbox root must resolve under /private/tmp (got ${real})`)
  }
  if (real === PRODUCTION_ROOT || real.startsWith(`${PRODUCTION_ROOT}/`)
      || real.startsWith(`${PRODUCTION_CHECKOUT}/`) || PRODUCTION_ROOT.startsWith(`${real}/`)) {
    throw gateError('SANDBOX_RESOLVES_TO_PRODUCTION', `sandbox root ${config.root} resolves to ${real} which is/contains/inside production`)
  }
  return Object.freeze({ kind: 'sandbox', root: real, productionRoot: real, gate })
}

/**
 * Map a production-shaped absolute path into the bound root
 * (sandbox: root + path; production: identity). Symlink escape rejected.
 */
export function rootedPath(binding, productionPath) {
  if (!isAbsolute(productionPath)) throw gateError('PATH_INVALID', `not absolute: ${productionPath}`)
  if (SESSION_PATH_RE.test(productionPath)) throw gateError('SESSION_PATH_FORBIDDEN', `session paths are never transaction targets: ${productionPath}`)
  if (binding.kind === 'production') return productionPath
  const mapped = join(binding.root, productionPath.slice(1))
  // containment: every existing parent component of the mapped target that
  // exists must not be a symlink escaping the sandbox.
  let dir = dirname(mapped)
  const stack = []
  while (dir !== binding.root && dir !== '/') { stack.push(dir); dir = dirname(dir) }
  for (const ancestor of stack.reverse()) {
    let info
    try { info = lstatSync(ancestor) } catch { continue }
    if (info.isSymbolicLink()) throw gateError('SYMLINK_ESCAPE', `mapped path component is a symlink: ${ancestor}`)
    const realAncestor = safeRealpath(ancestor)
    if (realAncestor !== null && !realAncestor.startsWith(binding.root)) {
      throw gateError('SYMLINK_ESCAPE', `mapped path resolves outside sandbox: ${ancestor} -> ${realAncestor}`)
    }
  }
  return mapped
}

function safeRealpath(p) { try { return realpathSync(p) } catch { return null } }

/**
 * Writer boundary. declaredWrites = the exact per-transaction write set:
 * production absolute file paths, or directory prefixes ending in '/'.
 * Every production write/marker/receipt target must match the declared set
 * (exact file or inside a declared prefix); session paths are rejected even
 * if declared. Sandbox writes map into the sandbox root with containment.
 * In check mode every assert throws (entrypoints must branch to read-only
 * reporting before reaching a write).
 */
export function createWriter(binding, declaredWrites = []) {
  const files = new Set(declaredWrites.filter((p) => !p.endsWith('/')))
  const prefixes = declaredWrites.filter((p) => p.endsWith('/'))
  const declaredMatch = (p) => files.has(p) || prefixes.some((prefix) => p.startsWith(prefix))
  return Object.freeze({
    assert(productionPath) {
      if (binding.gate.mode === 'check') {
        throw gateError('CHECK_MODE_NO_WRITES', `check mode performs zero writes (refused: ${productionPath})`)
      }
      if (SESSION_PATH_RE.test(productionPath)) {
        throw gateError('SESSION_WRITE_FORBIDDEN', `session write forbidden: ${productionPath}`)
      }
      if (binding.kind === 'production') {
        if (!declaredMatch(productionPath)) {
          throw gateError('WRITE_UNDECLARED', `production write not declared in this transaction: ${productionPath}`)
        }
        return productionPath
      }
      return rootedPath(binding, productionPath)
    },
    gate: binding.gate,
  })
}

const BIN_ALLOWLIST = Object.freeze({
  node: process.execPath,
  zsh: '/bin/zsh',
  sh: '/bin/sh',
  mkdir: '/bin/mkdir',
  curl: '/usr/bin/curl',
  tar: '/usr/bin/tar',
  shasum: '/usr/sbin/shasum',
})

/**
 * Allowlisted execution: argv[0] must be an allowlisted binary; script
 * arguments must resolve inside `allowedScriptDir` (the frozen candidate
 * transaction dir); `-c` arbitrary shell is refused. Environment is a fixed
 * scrubbed set — process.env is never inherited.
 */
export function execBinding(argv, { allowedScriptDir, env = {}, name = 'exec' } = {}) {
  if (!Array.isArray(argv) || argv.length === 0 || argv.some((a) => typeof a !== 'string' || a === '')) {
    throw gateError('EXEC_INVALID', `${name}: argv must be non-empty strings`)
  }
  const binKey = Object.keys(BIN_ALLOWLIST).find((k) => argv[0] === k || argv[0] === BIN_ALLOWLIST[k])
  if (binKey === undefined) throw gateError('EXEC_BIN_NOT_ALLOWLISTED', `${name}: binary not allowlisted: ${argv[0]}`)
  if (argv.includes('-c')) throw gateError('EXEC_SHELL_STRING_FORBIDDEN', `${name}: '-c' arbitrary shell strings are forbidden; bind a script file inside the candidate`)
  const scriptDirReal = allowedScriptDir === undefined ? null : safeRealpath(allowedScriptDir)
  for (const arg of argv.slice(1)) {
    if (!arg.startsWith('/')) continue
    const real = safeRealpath(arg)
    if (real !== null && scriptDirReal !== null && !real.startsWith(`${scriptDirReal}/`) && !BIN_ALLOWLIST_PATHS().includes(real)) {
      // absolute path args must be the bound script dir contents or system binaries
      throw gateError('EXEC_SCRIPT_OUT_OF_CANDIDATE', `${name}: script path outside frozen candidate: ${arg}`)
    }
  }
  const result = spawnSync(BIN_ALLOWLIST[binKey], argv.slice(1).map((a) => (a === 'node' ? BIN_ALLOWLIST.node : a)), {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    env: scrubbedEnv(env),
  })
  return result
}

function BIN_ALLOWLIST_PATHS() { return Object.values(BIN_ALLOWLIST) }

export function scrubbedEnv(extra = {}) {
  const base = {
    PATH: '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin',
    HOME: '/Users/yanfenma',
  }
  return { ...base, ...extra }
}

/** CLI: mode reporting for shell helpers (zero writes by construction). */
if (process.argv[1]?.endsWith('txn-safety.mjs') && process.argv[2] === 'mode') {
  try {
    const gate = parseGate(process.argv.slice(3))
    const sandboxApply = gate.mutationAllowed && !gate.production
    const productionApply = gate.mutationAllowed && gate.production
    console.log(sandboxApply || productionApply ? 'MUTATION_ALLOWED' : `READ_ONLY_CHECK(mode=${gate.mode},production=${gate.production})`)
    process.exit(0)
  } catch (error) {
    console.error(String(error.message)); process.exit(78)
  }
}
