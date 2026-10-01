#!/usr/bin/env node
// trusted-cp-fleet-config-v2v3-migration.mjs — FLEET_CONFIG_V2V3_MIGRATION_V1 (STAGE 1M)
//
// The separately frozen, exact v2→v3 fleet-config migration operation for the
// authsvc deployment root (agent-control#195 Defect C, Product #414). The
// deployed preimage (ACTIVATION_V1 authsvc amendment b08db324 §3: fleet config
// v2 / overrides==92) cannot boot a fresh generation packed from main: the
// runtime loader has required version:3 since f222b59f (2026-08-31), fail-loud
// "older files are not converted", and its sole config-visible delta is the
// REQUIRED per-route `credentialFile` on openai-codex subscription routes —
// the deploymentRoot-canonical shared store the amendment's own A2 names as
// the end state. This operation performs exactly that delta and nothing else:
//
//   version 2 → 3
//   routeCatalog.<ref>: + credentialFile = <deploymentRoot>/shared-credentials/
//                       openai-codex/.openai-codex-auth.json   (openai-codex
//                       subscription routes only — the accepted
//                       switchFleetConfig selector in
//                       shared-codex-migration-executable.js)
//   overrides: UNTOUCHED (count, keys, chains, order all preserved)
//   mode/owner of the config file: preserved (chown applied when running as
//   root; the executor always does in production)
//
// Fail-closed everywhere: the input must be the exact deployed v2 shape (any
// unexpected route key, wrong base version, duplicate JSON key, or missing
// openai-codex route refuses with ZERO mutation); the candidate bytes are
// validated by the REAL v3 loader (the same module bytes the restarted
// generation runs) BEFORE the atomic rename, so a failed validation leaves
// the production file untouched. --execute writes a preimage backup
// `<config>.pre-v3-<UTC-timestamp>` (content-exact, mode/owner preserved)
// BEFORE the swap and prints its path — that backup is RESTORE-R3's restore
// source (the §6 app-tree rollback does NOT cover this file, and the OLD
// generation's v2 loader cannot read a v3 config: after any post-migration
// rollback the config must be restored from the backup before the old
// generation is restarted).
//
// Atomicity contract (packet §5 STAGE 1M): the executor runs migrate →
// G2.7 re-verify → kickstart as ONE step, because compose.js re-reads the
// config at every process boundary — a v3 file under the still-running v2
// loader is the same FATAL class, so the write→restart window must stay
// sub-second and machine-enforced. This tool never restarts anything.
//
// Usage (default is DRY-RUN — prints the exact semantic delta, validates the
// candidate against the real loader from a temp dir, mutates nothing):
//   node scripts/lib/trusted-cp-fleet-config-v2v3-migration.mjs \
//     --config <fleet config json> --registry <agents.json> \
//     --deployment-root <ROOT> --model-overrides-module <path> [--json]
//   ... same + --execute     # backup + atomic swap of the validated candidate
//
// Exit: 0 = dry-run validated / execute committed; 2 = refused or failed
// (zero production mutation in every refusal path).

import {
  chownSync, closeSync, existsSync, fsyncSync, mkdtempSync, openSync, readFileSync,
  renameSync, rmSync, statSync, writeFileSync,
} from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// The deployed v2 base's route key universe (65f0b75d-era loader, the runtime
// the authsvc deployment runs today). Anything outside it — including v3-only
// keys like reasoningEffort — is not the preimage this operation was frozen
// for and refuses.
const V2_ROUTE_ALLOWED_KEYS = Object.freeze([
  'credentialReadiness', 'model', 'provider', 'routeKind', 'plugin', 'pluginVersion', 'providerEnv',
])

function migrationError(code, message) {
  return Object.assign(new Error(`fleet-config-v2v3-migration: ${message}`), { code })
}

function usage() {
  process.stderr.write([
    'usage: node trusted-cp-fleet-config-v2v3-migration.mjs --config <json> --registry <agents.json> \\',
    '     --deployment-root <ROOT> --model-overrides-module <path> [--execute] [--json]',
  ].join('\n') + '\n')
}

export function parseArgs(argv) {
  const args = {
    config: undefined,
    registry: undefined,
    deploymentRoot: undefined,
    modelOverridesModule: undefined,
    execute: false,
    json: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--config') args.config = argv[++i]
    else if (a === '--registry') args.registry = argv[++i]
    else if (a === '--deployment-root') args.deploymentRoot = argv[++i]
    else if (a === '--model-overrides-module') args.modelOverridesModule = argv[++i]
    else if (a === '--execute') args.execute = true
    else if (a === '--json') args.json = true
    else { usage(); process.exit(2) }
  }
  if (!args.config || !args.registry || !args.deploymentRoot || !args.modelOverridesModule) {
    usage(); process.exit(2)
  }
  for (const [name, value] of Object.entries({
    '--config': args.config, '--registry': args.registry,
    '--deployment-root': args.deploymentRoot, '--model-overrides-module': args.modelOverridesModule,
  })) {
    if (!isAbsolute(value)) {
      process.stderr.write(`${name} must be an absolute path (got ${value})\n`)
      process.exit(2)
    }
  }
  return args
}

/** Duplicate-JSON-key scan over the RAW input text — same technique as the
 *  loader's own assertNoDuplicateJsonKeys (JSON.parse keeps the LAST
 *  duplicate, so a textual scan is the only sound input check). */
export function assertNoDuplicateJsonKeys(source) {
  let index = 0
  const whitespace = () => {
    while (/\s/u.test(source[index] ?? '')) index += 1
  }
  const string = () => {
    const start = index
    index += 1
    while (index < source.length) {
      if (source[index] === '\\') index += 2
      else if (source[index] === '"') {
        index += 1
        return JSON.parse(source.slice(start, index))
      } else index += 1
    }
    throw migrationError('FLEET_CONFIG_MALFORMED', 'unterminated JSON string')
  }
  const value = () => {
    whitespace()
    if (source[index] === '"') { string(); return }
    if (source[index] === '{') {
      index += 1
      whitespace()
      const keys = new Set()
      if (source[index] === '}') { index += 1; return }
      for (;;) {
        whitespace()
        const key = string()
        if (keys.has(key)) throw migrationError('FLEET_CONFIG_DUPLICATE_KEY', `duplicate JSON key ${JSON.stringify(key)}`)
        keys.add(key)
        whitespace()
        if (source[index] !== ':') throw migrationError('FLEET_CONFIG_MALFORMED', 'expected ":" after object key')
        index += 1
        value()
        whitespace()
        if (source[index] === ',') { index += 1; continue }
        if (source[index] === '}') { index += 1; return }
        throw migrationError('FLEET_CONFIG_MALFORMED', 'expected "," or "}" in object')
      }
    }
    if (source[index] === '[') {
      index += 1
      whitespace()
      if (source[index] === ']') { index += 1; return }
      for (;;) {
        value()
        whitespace()
        if (source[index] === ',') { index += 1; whitespace(); continue }
        if (source[index] === ']') { index += 1; return }
        throw migrationError('FLEET_CONFIG_MALFORMED', 'expected "," or "]" in array')
      }
    }
    const literal = source.slice(index)
    for (const token of ['null', 'true', 'false']) {
      if (literal.startsWith(token)) { index += token.length; return }
    }
    if (literal === '' || /^[-+0-9.eE]/u.test(literal[0]) === false) {
      throw migrationError('FLEET_CONFIG_MALFORMED', `unexpected character ${JSON.stringify(source[index] ?? '')}`)
    }
    const match = /^-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?/u.exec(literal)
    if (match === null) throw migrationError('FLEET_CONFIG_MALFORMED', 'invalid JSON literal')
    index += match[0].length
  }
  value()
  whitespace()
  if (index !== source.length) throw migrationError('FLEET_CONFIG_MALFORMED', 'trailing characters after JSON document')
}

function exactKeys(object, keys) {
  return object !== null && typeof object === 'object' && !Array.isArray(object)
    && Object.keys(object).length === keys.length
    && keys.every((key) => Object.hasOwn(object, key))
}

function fsyncDir(dir) {
  try {
    const fd = openSync(dir, 'r')
    try { fsyncSync(fd) } finally { closeSync(fd) }
  } catch { /* best-effort directory fsync */ }
}

function isRoot() {
  return typeof process.getuid === 'function' && process.getuid() === 0
}

/** Write `content` with an exact mode; ownership preserved when root. */
function writeWithMode(file, content, mode, stat) {
  const fd = openSync(file, 'w', mode)
  try {
    writeFileSync(fd, content)
    fsyncSync(fd)
    if (isRoot() && stat) chownSync(file, stat.uid, stat.gid)
  } finally { closeSync(fd) }
}

/** Content-exact copy preserving mode (and owner when root). */
function copyPreserving(src, dest, stat) {
  const fd = openSync(dest, 'w', stat.mode & 0o7777)
  try {
    writeFileSync(fd, readFileSync(src))
    fsyncSync(fd)
    if (isRoot()) chownSync(dest, stat.uid, stat.gid)
  } finally { closeSync(fd) }
}

export async function runMigration(args) {
  const result = {
    operation: 'FLEET_CONFIG_V2V3_MIGRATION_V1',
    mode: args.execute ? 'execute' : 'dry-run',
    config: args.config,
    registry: args.registry,
    deploymentRoot: args.deploymentRoot,
    modelOverridesModule: resolve(args.modelOverridesModule),
    ok: false,
    preSha256: undefined,
    postSha256: undefined,
    backupPath: undefined,
    routesTouched: [],
    overridesBefore: 0,
    overridesAfter: 0,
    validatedUnder: undefined,
    error: undefined,
    errorCode: undefined,
  }
  let candidatePath
  let validationHome
  try {
    if (!existsSync(args.config)) throw migrationError('FLEET_CONFIG_MISSING', `fleet config not found: ${args.config}`)
    if (!existsSync(args.modelOverridesModule)) throw migrationError('LOADER_MODULE_MISSING', `loader module missing: ${args.modelOverridesModule}`)
    const loader = await import(pathToFileURL(result.modelOverridesModule).href)
    if (typeof loader.loadAgentModelOverrides !== 'function') throw migrationError('LOADER_MODULE_INVALID', `loadAgentModelOverrides not exported from ${args.modelOverridesModule}`)
    const canonicalModule = join(dirname(args.modelOverridesModule), '../../agent-provisioning/src/shared-codex.js')
    if (!existsSync(canonicalModule)) throw migrationError('CANONICAL_MODULE_MISSING', `shared-codex canonical module missing: ${canonicalModule}`)
    const provisioning = await import(pathToFileURL(canonicalModule).href)
    if (typeof provisioning.canonicalOpenAICodexCredentialFileFor !== 'function') throw migrationError('CANONICAL_MODULE_INVALID', 'canonicalOpenAICodexCredentialFileFor not exported')
    const canonicalFile = provisioning.canonicalOpenAICodexCredentialFileFor(args.deploymentRoot)
    const definitionModule = join(dirname(args.modelOverridesModule), '../../agent-definition/src/definition.js')
    const definitionMod = await import(pathToFileURL(definitionModule).href)
    const registeredAgentIds = Object.freeze(
      definitionMod.parseDefinition(readFileSync(args.registry, 'utf8'), { source: args.registry }).agents.map((agent) => agent.id),
    )

    const source = readFileSync(args.config, 'utf8')
    const stat = statSync(args.config)
    if (!stat.isFile()) throw migrationError('FLEET_CONFIG_NOT_A_FILE', `not a regular file: ${args.config}`)
    result.preSha256 = createHash('sha256').update(source).digest('hex')
    assertNoDuplicateJsonKeys(source)
    const parsed = JSON.parse(source)

    // ---- exact deployed v2 base shape (fail-closed, nothing improvised) ----
    if (!exactKeys(parsed, ['overrides', 'routeCatalog', 'version'])) {
      throw migrationError('FLEET_CONFIG_BASE_SHAPE_INVALID', 'top-level keys must be exactly overrides/routeCatalog/version')
    }
    if (parsed.version !== 2) {
      throw migrationError('FLEET_CONFIG_BASE_VERSION_INVALID', `base version must be exactly 2 (got ${JSON.stringify(parsed.version)}); already-migrated configs must NOT be re-run through this operation`)
    }
    if (parsed.routeCatalog === null || typeof parsed.routeCatalog !== 'object' || Array.isArray(parsed.routeCatalog)
      || parsed.overrides === null || typeof parsed.overrides !== 'object' || Array.isArray(parsed.overrides)) {
      throw migrationError('FLEET_CONFIG_BASE_SHAPE_INVALID', 'routeCatalog and overrides must be plain objects')
    }
    result.overridesBefore = Object.keys(parsed.overrides).length
    if (result.overridesBefore === 0) throw migrationError('FLEET_CONFIG_EMPTY_OVERRIDES', 'overrides is empty — not the deployed fleet-config preimage shape')
    for (const [ref, route] of Object.entries(parsed.routeCatalog)) {
      if (route === null || typeof route !== 'object' || Array.isArray(route)) {
        throw migrationError('FLEET_CONFIG_BASE_SHAPE_INVALID', `routeCatalog.${ref} must be a plain object`)
      }
      for (const key of Object.keys(route)) {
        if (!V2_ROUTE_ALLOWED_KEYS.includes(key)) {
          throw migrationError('FLEET_CONFIG_UNEXPECTED_ROUTE_KEY', `routeCatalog.${ref} carries key ${JSON.stringify(key)} which the deployed v2 base never allowed — refusing (drift, not a migration input)`)
        }
      }
    }

    // ---- the exact v2→v3 delta: version + canonical credentialFile ----
    const candidate = JSON.parse(source)
    candidate.version = 3
    let codexRoutes = 0
    for (const [ref, route] of Object.entries(candidate.routeCatalog)) {
      if (route?.provider !== 'openai-codex' || route?.routeKind !== 'subscription') continue
      codexRoutes++
      if (Object.hasOwn(route, 'credentialFile')) {
        if (route.credentialFile !== canonicalFile) {
          throw migrationError('FLEET_CONFIG_CREDENTIAL_FILE_CONFLICT', `routeCatalog.${ref}.credentialFile already present with a non-canonical value`)
        }
        continue
      }
      route.credentialFile = canonicalFile
      result.routesTouched.push(ref)
    }
    if (codexRoutes === 0) {
      throw migrationError('FLEET_CONFIG_NO_CODEX_ROUTE', 'no openai-codex subscription route in routeCatalog — not the expected shared-Codex deployment shape; refusing')
    }
    result.overridesAfter = Object.keys(candidate.overrides).length
    if (result.overridesAfter !== result.overridesBefore) {
      throw migrationError('FLEET_CONFIG_OVERRIDES_DRIFT', 'internal: overrides cardinality changed during transform')
    }
    const serialized = `${JSON.stringify(candidate, null, 2)}\n`
    result.postSha256 = createHash('sha256').update(serialized).digest('hex')

    // ---- validate the EXACT candidate bytes under the REAL v3 loader ----
    // execute: candidate staged in the config's own directory so the final
    // adoption is a same-filesystem atomic rename; dry-run: throwaway temp dir.
    validationHome = args.execute ? dirname(args.config) : mkdtempSync(join(tmpdir(), 'dsh-fleet-config-v2v3-'))
    candidatePath = args.execute
      ? join(validationHome, `.agent-model-overrides.json.v3-candidate-${process.pid}-${Date.now()}`)
      : join(validationHome, 'agent-model-overrides.json')
    try {
      writeWithMode(candidatePath, serialized, stat.mode & 0o7777, stat)
      const loaded = loader.loadAgentModelOverrides(candidatePath, registeredAgentIds, { deploymentRoot: args.deploymentRoot })
      result.validatedUnder = result.modelOverridesModule
      const validatedCount = Object.keys(loaded.overrides).length
      if (validatedCount !== result.overridesBefore) {
        throw migrationError('FLEET_CONFIG_POSTVALIDATE_DRIFT', `post-validate override count ${validatedCount} != preimage ${result.overridesBefore}`)
      }
      if (!args.execute) {
        result.ok = true
        return result
      }
      // ---- execute: backup, then atomic swap of the VALIDATED bytes ----
      const stamp = `${new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '')}Z`
      const backupPath = `${args.config}.pre-v3-${stamp}`
      copyPreserving(args.config, backupPath, stat)
      if (createHash('sha256').update(readFileSync(backupPath)).digest('hex') !== result.preSha256) {
        throw migrationError('FLEET_CONFIG_BACKUP_MISMATCH', 'backup content differs from preimage — refusing to swap')
      }
      result.backupPath = backupPath
      renameSync(candidatePath, args.config)
      fsyncDir(dirname(args.config))
      // Post-swap readback: the REAL config file must now load clean.
      const reloaded = loader.loadAgentModelOverrides(args.config, registeredAgentIds, { deploymentRoot: args.deploymentRoot })
      if (Object.keys(reloaded.overrides).length !== result.overridesBefore) {
        throw migrationError('FLEET_CONFIG_POSTSWAP_DRIFT', 'post-swap readback override count drift')
      }
      result.ok = true
      return result
    } finally {
      if (args.execute && !result.ok && existsSync(candidatePath)) rmSync(candidatePath, { force: true })
      if (!args.execute && validationHome) rmSync(validationHome, { recursive: true, force: true })
    }
  } catch (cause) {
    result.error = cause?.message ?? String(cause)
    result.errorCode = cause?.code
    return result
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const result = await runMigration(args)
  if (args.json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  else {
    process.stdout.write(`FLEET_CONFIG_V2V3_MIGRATION_V1 mode=${result.mode} config=${result.config}\n`)
    if (result.ok) {
      process.stdout.write(`  DELTA version 2 -> 3; routes +credentialFile: ${result.routesTouched.join(', ') || 'NONE'}; overrides preserved ${result.overridesBefore}/${result.overridesAfter}\n`)
      process.stdout.write(`  preSha256=${result.preSha256}\n  postSha256=${result.postSha256}\n`)
      process.stdout.write(`  validatedUnder=${result.validatedUnder}\n`)
      if (result.backupPath) process.stdout.write(`  BACKUP=${result.backupPath} (RESTORE-R3 source — restore this before restarting the OLD generation after any rollback)\n`)
      process.stdout.write(`  RESULT=${result.mode === 'execute' ? 'COMMITTED' : 'DRY_RUN_VALIDATED'}\n`)
    } else {
      process.stdout.write(`  REFUSED code=${result.errorCode ?? 'NONE'}\n  ${result.error}\n`)
    }
  }
  process.exit(result.ok ? 0 : 2)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main()
}
