// Isolated real process writer. Only the remote service seam is controlled.
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { makeEngine, due, events } from './fixture.js'

if (process.send) {
  const [dir, name, key, pausedKind] = process.argv.slice(2)
  const trace = []
  let held = false
  const lockPath = join(dir, 'attempts.lock')
  const owner = () => {
    try { return JSON.parse(readFileSync(lockPath, 'utf8')) } catch { return null }
  }
  const record = event => trace.push({ ...event, pid: process.pid, held, lockOwner: owner() })
  const fixture = makeEngine(dir, { key, trace: record,
    pause: async (kind, context) => {
      if (kind !== pausedKind) return
      record({ kind: 'collection-barrier', interval: kind, at: Date.now(), context })
      process.send({ stage: 'paused', name, kind, pid: process.pid, trace: [...trace] })
      await new Promise(resolve => {
        const receive = message => {
          if (message.stage === 'release') { process.off('message', receive); resolve() }
        }
        process.on('message', receive)
      })
      record({ kind: 'collection-released', interval: kind, at: Date.now() })
    },
  })
  const originalAcquire = fixture.ledger.lock.acquire.bind(fixture.ledger.lock)
  const originalRelease = fixture.ledger.lock.release.bind(fixture.ledger.lock)
  const originalLoad = fixture.ledger.load.bind(fixture.ledger)
  let acquisitionCount = 0
  fixture.ledger.lock.acquire = async () => {
    acquisitionCount += 1
    const startedAt = Date.now()
    if (acquisitionCount === 2) process.send({ stage: 'reacquire-start', name, pid: process.pid, startedAt })
    const token = await originalAcquire()
    held = true
    record({ kind: 'lock-acquired', token, startedAt, endedAt: Date.now() })
    return token
  }
  fixture.ledger.lock.release = async token => {
    record({ kind: 'lock-release', token, at: Date.now() })
    await originalRelease(token)
    held = false
  }
  fixture.ledger.load = options => {
    const result = originalLoad(options)
    record({ kind: 'replay', at: Date.now(), bytes: existsSync(fixture.ledger.eventsFile)
      ? statSync(fixture.ledger.eventsFile).size : 0, projection: fixture.ledger.snapshot() })
    return result
  }
  process.send({ stage: 'ready', name, pid: process.pid })
  process.once('message', async message => {
    if (message.stage !== 'start') return
    process.send({ stage: 'started', name, pid: process.pid, at: Date.now() })
    try {
      const result = await fixture.engine.admitDueIntent(due(key))
      process.send({ stage: 'completed', name, pid: process.pid, result, trace,
        calls: fixture.calls, events: events(dir), completedAt: Date.now() }, () => process.disconnect())
    } catch (error) {
      process.send({ stage: 'failed', name, error: String(error.stack), trace }, () => {
        process.exitCode = 1
        process.disconnect()
      })
    }
  })
}
