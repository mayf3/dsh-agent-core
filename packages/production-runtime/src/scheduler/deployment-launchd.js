import { execFileSync } from 'node:child_process'

export function createLaunchdAdapter() {
  return {
    bootout: (label) => execFileSync('launchctl', ['bootout', label], { stdio: ['ignore', 'pipe', 'pipe'] }),
    isLoaded: (label) => {
      try { execFileSync('launchctl', ['print', label], { stdio: ['ignore', 'pipe', 'pipe'] }); return true } catch (error) {
        const detail = `${error?.stdout ?? ''} ${error?.stderr ?? ''}`
        if (/Could not find service|Could not find specified service|service not found/i.test(detail)) return false
        throw error
      }
    },
  }
}

export function quiesceLaunchdServices(labels, { bootout, isLoaded }) {
  const prior = {}
  for (const label of labels) {
    prior[label] = isLoaded(label)
    if (prior[label]) {
      try { bootout(label) } catch (error) {
        if (isLoaded(label)) throw error
      }
    }
    if (isLoaded(label)) throw new Error(`launchd service remained loaded after bootout: ${label}`)
  }
  return prior
}
