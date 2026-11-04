import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { verifyArtifactBinding } from '../src/r38-artifact-binding.js'

const root = process.cwd()

test('R38 artifact binding verifies tarball digest, embedded commit, and content identity', () => {
  const dir = mkdtempSync(join(tmpdir(), 'r38-binding-'))
  try {
    const tarball = join(dir, 'candidate.tgz')
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
    execFileSync(process.execPath, ['scripts/create-r38-artifact.mjs', tarball, commit, 'packages/agent-router/src/r38-artifact-binding.js', 'packages/agent-router/src/r28-recovery-state-machine.js'], { cwd: root, stdio: 'pipe' })
    const result = verifyArtifactBinding({ tarball, manifestFile: `${tarball}.manifest.json`, workspaceRoot: root })
    assert.equal(result.commit, commit)
    assert.equal(result.tarballSha256.length, 64)
    assert.deepEqual(result.files.sort(), ['packages/agent-router/src/r28-recovery-state-machine.js', 'packages/agent-router/src/r38-artifact-binding.js'].sort())
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
