/** Exact application stage: preserve live source, overlay only frozen ARM entry bytes. */
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { dirname, isAbsolute, join, resolve, sep } from 'node:path'
import { composeHrPostCoherentSource, POST_COHERENT_HR_INPUT_PATHS, POST_COHERENT_HR_LEAF_PATHS } from './hr-post-coherent-overlay.mjs'
export { composeHrPostCoherentSource, POST_COHERENT_HR_INPUT_PATHS, POST_COHERENT_HR_LEAF_PATHS }

export const ARM_SOURCE_DELTA = Object.freeze([
  'scripts/production-runtime.mjs',
  'packages/production-runtime/src/native-arm64/admission.js',
])
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex')
const inside = (root, path) => path === root || path.startsWith(root + sep)
const git = (root, ...args) => execFileSync('/usr/bin/git', ['-C', root, ...args], { encoding: 'utf8' })
const sourcePath = path => path === 'package.json' || /^(packages|scripts|bundle[^/]*|profile[^/]*)\//.test(path)

/** Candidate must already be frozen. Deployment additionally requires merge ancestry. */
export function stageApplication({ liveRoot, candidateRoot, candidateSHA, stageRoot }) {
  const live = realpathSync(liveRoot)
  const candidate = realpathSync(candidateRoot)
  const stage = resolve(stageRoot)
  if (!/^[0-9a-f]{40}$/.test(candidateSHA)) throw new Error('CANDIDATE_SHA_REQUIRED')
  if (git(candidate, 'rev-parse', candidateSHA + '^{commit}').trim() !== candidateSHA) throw new Error('CANDIDATE_NOT_RESOLVABLE')
  if (existsSync(stage) || inside(live, stage) || inside(candidate, stage)) throw new Error('ISOLATED_NEW_STAGE_REQUIRED')
  const existingParent = realpathSync(dirname(stage))
  if (inside(live, existingParent) || inside(candidate, existingParent)) throw new Error('STAGE_PARENT_ESCAPES_ISOLATION')
  const paths = [...new Set(git(live, 'ls-files', '-co', '--exclude-standard', '-z').split('\0').filter(sourcePath))].sort()
  const files = []
  const sourceHead = git(live, 'rev-parse', 'HEAD').trim()
  const sourceStatus = git(live, 'status', '--porcelain')
  // Inspect before the first write; never follow a source link into business data.
  for (const path of paths) {
    if (isAbsolute(path) || path.split('/').includes('..')) throw new Error('INVALID_SOURCE_PATH')
    const input = join(live, path)
    if (!existsSync(input)) throw new Error('SOURCE_DISAPPEARED')
    if (!lstatSync(input).isFile() || !inside(live, realpathSync(input))) throw new Error('SOURCE_LINK_OR_SPECIAL_FILE')
    const digest = hash(input)
    files.push({ path, preimageHash: digest, postimageExpectedHash: digest,
      source: 'PRESERVED_LIVE_BYTES', candidateSourceSHA: null,
      whyRequired: 'Existing effective application source, unchanged' })
  }
  mkdirSync(stage)
  for (const file of files) {
    const output = join(stage, file.path)
    mkdirSync(dirname(output), { recursive: true })
    copyFileSync(join(live, file.path), output)
    if (hash(output) !== file.preimageHash) throw new Error('SOURCE_CHANGED_DURING_COPY')
  }
  for (const path of ARM_SOURCE_DELTA) {
    // Read the commit, never an uncommitted working-tree postimage.
    const bytes = execFileSync('/usr/bin/git', ['-C', candidate, 'show', candidateSHA + ':' + path])
    const prior = files.find(file => file.path === path)
    const record = { path, preimageHash: prior?.preimageHash ?? null,
      postimageExpectedHash: createHash('sha256').update(bytes).digest('hex'),
      source: 'ARM_MIGRATION_DELTA', candidateSourceSHA: candidateSHA,
      whyRequired: 'Reject incorrect production architecture before importing application code' }
    if (prior) files.splice(files.indexOf(prior), 1)
    files.push(record)
    mkdirSync(dirname(join(stage, path)), { recursive: true })
    writeFileSync(join(stage, path), bytes)
  }
  if (git(live, 'rev-parse', 'HEAD').trim() !== sourceHead || git(live, 'status', '--porcelain') !== sourceStatus) throw new Error('LIVE_SOURCE_MOVED')
  for (const file of files) {
    if (file.preimageHash !== null && hash(join(live, file.path)) !== file.preimageHash) throw new Error('LIVE_SOURCE_MOVED')
  }
  return { sourceHead, sourceStatus, candidateSHA, stageRoot: stage, files,
    productionApply: 'HOLD', mergedAncestryVerified: false }
}

export const HR_GATED_ENTRY = 'packages/production-runtime/src/native-arm64/hr-s256-r2-gated-runtime.mjs'
const HR_CHILD_PROOF = 'packages/production-runtime/src/native-arm64/hr-s256-r2-child-proof.py'
const HR_RETIRED_ENTRY = 'scripts/production-runtime.mjs'
const HR_APP = '/usr/local/libexec/agent-core/app/'
export const HR_RETIRED_BYTES = '#!/usr/bin/env node\nthrow new Error("HR_UNGATED_ENTRY_RETIRED");\n'

/** Apply only this join to the fresh stage; never overwrite a newer Router. */
export function patchHrRouterJoin(path, bytes) {
  let source = bytes.toString('utf8')
  const replaceOnce = (before, after) => {
    if (source.split(before).length !== 2) throw new Error('HR_ROUTER_BASE_UNKNOWN')
    source = source.replace(before, after)
  }
  if (path === 'packages/agent-router/src/index.js') {
    const imported = "import { provisionAgentHome } from '../../agent-provisioning/src/index.js'"
    replaceOnce(imported, imported + "\nimport { getFixedStartupContext, signalFixedStartupConsumptionFinished, publishFixedRuntimeAdmission } from '../../production-runtime/src/native-arm64/hr-s256-r2-startup-context.mjs'")
    const branch = "  if (typeof cfg.restartQuiescenceEvidenceDir === 'string' && cfg.restartQuiescenceEvidenceDir !== '') {"
    replaceOnce(branch, "  const fixedStartup = getFixedStartupContext()\n  if (fixedStartup !== undefined) {\n    reconciliationStore.consumeStartupQuiescence(fixedStartup)\n    signalFixedStartupConsumptionFinished()\n  } else if (typeof cfg.restartQuiescenceEvidenceDir === 'string' && cfg.restartQuiescenceEvidenceDir !== '') {")
    replaceOnce("  ctx.provide('agentRouter', service)\n", "  ctx.provide('agentRouter', service)\n  publishFixedRuntimeAdmission(service)\n")
  } else if (path === 'packages/agent-router/src/reconciliation/startup-recovery.js') {
    replaceOnce('files = readdirSync(evidenceDir).filter', 'files = (io?.readdir ?? readdirSync)(evidenceDir).filter')
  } else throw new Error('HR_ROUTER_BASE_UNKNOWN')
  return Buffer.from(source)
}

/** Fixed one-shot candidate only. Never reads/writes an installed plist. */
export function stageHrOneShotApplication({ guiPlist, systemPlist, ...options }) {
  const oldTarget = HR_APP + HR_RETIRED_ENTRY
  const newTarget = HR_APP + HR_GATED_ENTRY
  const routes = {}
  for (const [name, raw] of [['gui', guiPlist], ['system', systemPlist]]) {
    if (typeof raw !== 'string' || Buffer.byteLength(raw) > 65536 ||
        (raw.match(/<key>ProgramArguments<\/key>/g) ?? []).length !== 1 ||
        (raw.match(/<key>Label<\/key>\s*<string>ai\.agent-core\.runtime<\/string>/g) ?? []).length !== 1) {
      throw new Error('HR_ROUTE_TARGET_UNKNOWN')
    }
    const args = raw.match(/<key>ProgramArguments<\/key>\s*<array>([\s\S]*?)<\/array>/)?.[1]
    const strings = [...(args ?? '').matchAll(/<string>([^<]*)<\/string>/g)].map(m => m[1])
    if (strings.length < 2 || strings[1] !== oldTarget ||
        raw.split(oldTarget).length !== 2 || raw.includes(newTarget) ||
        args.replace(/<string>[^<]*<\/string>/g, '').trim()) {
      throw new Error('HR_ROUTE_TARGET_UNKNOWN')
    }
    // Byte-identical remainder: UID, root, environment and supervision survive.
    routes[name] = raw.replace(oldTarget, newTarget)
  }
  const frozen = [HR_GATED_ENTRY, HR_CHILD_PROOF, 'packages/production-runtime/src/native-arm64/hr-s256-r2-startup-context.mjs'].map(path => ({ path,
    bytes: execFileSync('/usr/bin/git', ['-C', options.candidateRoot, 'show', options.candidateSHA + ':' + path]) }))
  const router = 'packages/agent-router/src/index.js'
  const current = readFileSync(join(options.liveRoot, router)).toString()
  let joins
  if (!current.includes('cfg.restartQuiescenceEvidenceDir')) {
    const base = Object.fromEntries(POST_COHERENT_HR_INPUT_PATHS.map(path => [path, readFileSync(join(options.liveRoot, path))]))
    const paths = ['packages/agent-router/src/reconciliation/startup-recovery.js', ...POST_COHERENT_HR_LEAF_PATHS]
    const accepted = Object.fromEntries(paths.map(path => [path, execFileSync('/usr/bin/git',
      ['-C', options.candidateRoot, 'show', options.candidateSHA + ':' + path])]))
    joins = Object.entries(composeHrPostCoherentSource(base, accepted)).map(([path, bytes]) => ({ path, bytes }))
  } else {
    joins = ['packages/agent-router/src/index.js', 'packages/agent-router/src/reconciliation/startup-recovery.js'].map(path => ({ path,
      bytes: patchHrRouterJoin(path, readFileSync(join(options.liveRoot, path))) }))
  }
  const result = stageApplication(options)
  const replacements = [...frozen, ...joins, { path: HR_RETIRED_ENTRY, bytes: Buffer.from(HR_RETIRED_BYTES) }]
  for (const { path, bytes } of replacements) {
    const prior = result.files.find(file => file.path === path)
    const record = { path, preimageHash: prior?.preimageHash ?? null,
      postimageExpectedHash: createHash('sha256').update(bytes).digest('hex'),
      source: 'HR_ONE_SHOT_ENTRY_DELTA', candidateSourceSHA: options.candidateSHA,
      whyRequired: path === HR_RETIRED_ENTRY ? 'Retire ungated entry before Router import' : 'Fixed root-custody gated entry' }
    if (prior) result.files.splice(result.files.indexOf(prior), 1)
    result.files.push(record)
    mkdirSync(dirname(join(result.stageRoot, path)), { recursive: true })
    writeFileSync(join(result.stageRoot, path), bytes)
  }
  const entryManifest = { version: 1,
    operationId: 'hr-s256-trusted-quiescence-cut-20260925-v1',
    entries: [{ path: HR_GATED_ENTRY, sha256: hash(join(result.stageRoot, HR_GATED_ENTRY)),
      helperSha256: hash(join(result.stageRoot, HR_CHILD_PROOF)) }],
    retiredEntry: { path: HR_RETIRED_ENTRY, sha256: hash(join(result.stageRoot, HR_RETIRED_ENTRY)) },
    routes: [{ id: 'gui/505/ai.agent-core.runtime', target: HR_APP + HR_GATED_ENTRY },
      { id: 'system/ai.agent-core.runtime', target: HR_APP + HR_GATED_ENTRY }] }
  return { ...result, routes, entryManifest, sourceClosureProven: false }
}
