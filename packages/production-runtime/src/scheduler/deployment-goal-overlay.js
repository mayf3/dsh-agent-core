import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** Apply only the goal delta (base -> target) on top of the exact deployed file. */
export function mergeGoalDeltaIntoLive({ base, live, target }) {
  if (live === base) return target
  if (live === target) return target
  const work = mkdtempSync(join(tmpdir(), 'scheduler-goal-overlay-'))
  const livePath = join(work, 'live')
  const basePath = join(work, 'base')
  const targetPath = join(work, 'target')
  try {
    writeFileSync(livePath, live)
    writeFileSync(basePath, base)
    writeFileSync(targetPath, target)
    return execFileSync('git', ['merge-file', '-p', livePath, basePath, targetPath], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 32 * 1024 * 1024,
    })
  } catch {
    throw new Error('goal delta conflicts with live predecessor')
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}
