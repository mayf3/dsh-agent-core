import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { resolveCanonicalTarget } from '../../../session-history/src/locator.js'
import { readBoundMainMetadata } from '../../src/agent-session/website-inquiry/main-metadata.js'

test('canonical main getter parses header only, rejects corrupt header and symlink escape', () => {
  const root = mkdtempSync(join(tmpdir(), 'whi-main-'))
  const workspace = join(root, 'workspace')
  const target = resolveCanonicalTarget({ agentHome: root, workspaceDir: workspace })
  const bootstrap = { resolveDshHome: () => root, resolveWorkspace: () => workspace }
  try {
    assert.deepEqual(readBoundMainMetadata(bootstrap, 'agt_pilot'), { state: 'absent', generation: null })
    mkdirSync(dirname(target.artifactPath), { recursive: true })
    const header = { type: 'session', version: 0, id: 'main', createdAt: 1, delegationDepth: 0, cwd: workspace }
    writeFileSync(target.artifactPath, JSON.stringify(header) + '\n' + 'PRIVATE_INVALID_TRANSCRIPT'.repeat(400000))
    const result = readBoundMainMetadata(bootstrap, 'agt_pilot')
    assert.equal(result.state, 'exists')
    assert.match(result.generation, /^[a-f0-9]{64}$/)
    writeFileSync(target.artifactPath, JSON.stringify({ ...header, id: 'other' }) + '\n')
    assert.equal(readBoundMainMetadata(bootstrap, 'agt_pilot').state, 'unavailable')
    rmSync(target.artifactPath)
    symlinkSync('/etc/hosts', target.artifactPath)
    assert.equal(readBoundMainMetadata(bootstrap, 'agt_pilot').state, 'unavailable')
  } finally { rmSync(root, { recursive: true, force: true }) }
})
