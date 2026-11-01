// Synthetic qualification records exercise the reader mechanism only. They are
// never compatibility evidence or a production-admissible release receipt.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const FIXTURE_GENERATION = 'gen-032-20261031-123906'
export const FIXTURE_HARNESS = Object.freeze({ version: 'synthetic-harness-fixture', commit: '1'.repeat(40), closureSha256: '2'.repeat(64) })
export const PROOF_CATEGORIES = ['R1', 'R2', 'R3', 'currentDocument', 'pendingIntent', 'ownerRecovery', 'harnessClosure', 'coreWiring']
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
export const writeJson = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 })
export const RELEASE_FIXTURE_ROOT = process.env.D14_RELEASE_FIXTURE_ROOT ?? '/tmp/025-r3-staging'
export const RELEASE_FIXTURE_AVAILABLE = ['release.tgz', 'codex-deps-scopes.tgz']
  .every(name => existsSync(join(RELEASE_FIXTURE_ROOT, name)))

export function createFleetGenerationFixture(deploymentRoot) {
  if (!RELEASE_FIXTURE_AVAILABLE) throw Error('NOT_EXECUTED: exact released D14 archive/dependency fixture unavailable; set D14_RELEASE_FIXTURE_ROOT')
  const owned = deploymentRoot === undefined
  deploymentRoot ??= realpathSync(mkdtempSync(join(tmpdir(), 'fleet-generation-fixture-')))
  const control = join(deploymentRoot, 'control', 'codex-plugin-runtime')
  const generationRoot = join(control, FIXTURE_GENERATION)
  const pluginRoot = join(generationRoot, 'node_modules', 'dsh-codex')
  const descriptorPath = join(generationRoot, 'descriptor.json')
  const receiptPath = join(control, 'accepted-releases', `${FIXTURE_GENERATION}.json`)
  const logsRoot = join(control, 'accepted-releases', FIXTURE_GENERATION)
  mkdirSync(join(generationRoot, 'node_modules'), { recursive: true })
  mkdirSync(logsRoot, { recursive: true, mode: 0o700 })
  cpSync(join(RELEASE_FIXTURE_ROOT, 'release.tgz'), join(generationRoot, 'release.tgz'))
  cpSync(join(RELEASE_FIXTURE_ROOT, 'codex-deps-scopes.tgz'), join(generationRoot, 'codex-deps-scopes.tgz'))
  const unpack = spawnSync('/usr/bin/tar', ['-xzf', join(generationRoot, 'release.tgz'), '-C', join(generationRoot, 'node_modules')])
  if (unpack.status !== 0) throw Error('exact released candidate fixture extraction failed')
  renameSync(join(generationRoot, 'node_modules', 'package'), pluginRoot)
  symlinkSync(join(FIXTURE_GENERATION, 'node_modules'), join(control, 'current'))
  const home = join(deploymentRoot, 'homes', 'synthetic-agent')
  mkdirSync(join(home, 'profiles', 'node_modules'), { recursive: true })
  symlinkSync(join(control, 'current', 'dsh-codex'), join(home, 'profiles', 'node_modules', 'dsh-codex'))
  const descriptor = {
    schemaVersion: 1, generationId: FIXTURE_GENERATION, plugin: 'dsh-codex', pluginVersion: '0.3.2',
    sourceRepository: 'mayf3/dsh-codex', sourceRef: 'refs/heads/main',
    sourceCommit: '7cfa139e111956a7193622afc734126b52d7bf07', sourceTree: '5f144d38a10eb40ce5cf33c597a72a81bd21e537',
    artifactSha256: '8755ae67673ddc08ba7511a8b11582151763972cb5c00e733f4e94f87717daf2',
    packageJsonSha256: 'f9a6ea3e647901ea1f6b218bc27aa2e3cd9ff9a9579b9036489a12354363f5bc',
    dependencyTreeDigest: '119f74e67b61a1ecace6219ebcf7f2df8874ce71d27cc2170d8e91667d1990b0',
    dependencyFileCount: 14224,
    dependencyArchiveSha256: 'c994dff1b4ec771cb955ccb109a1100a9be4c71835308eac9c5b70d25c2e1abc',
    frozenLockSha256: '6dd2d6f923b3ceb2714223c62f7c76ebf50861c4ad06dfeb5d616090db5034b6',
    protectionSpecSha256: '26e9d3c645f24eec02d6035f744a5083a2cdb94f2a1db1f917d7b5796afe1df5',
    authority: { repository: 'mayf3/dsh-agent-core', mergeCommit: '26178b4f459cdc2737724f6614b5e2bc9bdc77b0', acceptedHead: '1f528c6189822b6b66b78ac06639c05553498acd' },
    harness: { ...FIXTURE_HARNESS }, coreSourceCommit: '3'.repeat(40),
  }
  function qualify(nextDescriptor = descriptor, receiptDelta = {}) {
    writeJson(descriptorPath, nextDescriptor)
    const proofs = Object.fromEntries(PROOF_CATEGORIES.map(category => {
      const log = `${category}.log`
      const bytes = `SYNTHETIC MECHANISM FIXTURE ONLY: ${category}; not actual compatibility proof\n`
      writeFileSync(join(logsRoot, log), bytes, { mode: 0o600 })
      return [category, { result: 'PASS', log, sha256: sha256(bytes) }]
    }))
    const receipt = {
      schemaVersion: 1, generationId: FIXTURE_GENERATION,
      descriptorSha256: sha256(readFileSync(descriptorPath)), sourceCommit: nextDescriptor.sourceCommit,
      artifactSha256: nextDescriptor.artifactSha256, coreSourceCommit: nextDescriptor.coreSourceCommit,
      harness: { ...nextDescriptor.harness }, authorId: 'synthetic-fixture-author',
      reviewer: { id: 'synthetic-independent-reviewer', independent: true },
      reviewedAt: '2026-11-01T00:00:00.000Z', result: 'PASS',
      environment: 'ISOLATED_SYNTHETIC_MECHANISM_FIXTURE_NOT_PRODUCTION_EVIDENCE', proofs,
      ...receiptDelta,
    }
    writeJson(receiptPath, receipt)
    return receipt
  }
  qualify()
  return { deploymentRoot, control, generationRoot, pluginRoot, descriptorPath, receiptPath, logsRoot, home,
    descriptor, qualify, cleanup: () => { if (owned) rmSync(deploymentRoot, { recursive: true, force: true }) } }
}
