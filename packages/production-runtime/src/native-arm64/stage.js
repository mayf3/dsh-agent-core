/** Exact application stage: preserve live source, overlay only frozen ARM entry bytes. */
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { dirname, isAbsolute, join, resolve, sep } from 'node:path'

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
