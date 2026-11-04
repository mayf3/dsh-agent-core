import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const fixture = join(process.cwd(), 'packages/agent-router/test/r37-supervisor-fixture.mjs')

function waitForReady(child) {
  return new Promise((resolve, reject) => {
    let output = ''
    child.stdout.on('data', chunk => {
      output += chunk
      if (output.includes('READY')) resolve()
    })
    child.once('error', reject)
    child.once('exit', code => { if (code !== null && !output.includes('READY')) reject(new Error(`supervisor exited ${code}`)) })
  })
}

function readSnapshot(child) {
  return new Promise((resolve, reject) => {
    let output = ''
    child.stdout.on('data', chunk => { output += chunk })
    child.once('error', reject)
    child.once('exit', code => {
      if (code !== 0) return reject(new Error(`reader exited ${code}`))
      try { resolve(JSON.parse(output.trim())) } catch (error) { reject(error) }
    })
  })
}

test('R37 cross-process supervisor restart restores fault state', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'r37-cross-process-')); const file = join(dir, 'turns.json')
  let supervisor
  try {
    supervisor = spawn(process.execPath, [fixture, 'inject', file], { stdio: ['ignore', 'pipe', 'pipe'] })
    await waitForReady(supervisor)
    supervisor.kill('SIGKILL')
    await new Promise(resolve => supervisor.once('exit', resolve))
    const restarted = spawn(process.execPath, [fixture, 'read', file], { stdio: ['ignore', 'pipe', 'pipe'] })
    const faults = await readSnapshot(restarted)
    assert.deepEqual(faults, [{ key: 'agt_fixture:23', agentId: 'agt_fixture', generation: 23, firstSeenAt: '2026-11-04T00:00:00.000Z', attempts: 2, nextActionAt: '2026-11-04T00:05:00.000Z', status: 'OPEN' }])
  } finally {
    if (supervisor && supervisor.exitCode === null) supervisor.kill('SIGKILL')
    rmSync(dir, { recursive: true, force: true })
  }
})
