import { execFileSync } from 'node:child_process'

export function createLaunchdAdapter({ launchctl = 'launchctl' } = {}) {
  const run = (args, timeoutMs = 10_000) => execFileSync(launchctl, args, {
    stdio: ['ignore', 'pipe', 'pipe'], timeout: Math.max(1, Math.floor(timeoutMs)), killSignal: 'SIGKILL',
  })
  return {
    bootout: (label, options = {}) => run(['bootout', label], options.timeoutMs),
    isLoaded: (label, options = {}) => {
      try { run(['print', label], options.timeoutMs); return true } catch (error) {
        if (error?.code === 'ETIMEDOUT' || error?.signal != null || !Number.isInteger(error?.status)) throw error
        const detail = `${error?.stdout ?? ''} ${error?.stderr ?? ''}`
        if (/Could not find service|Could not find specified service|service not found/i.test(detail)) return false
        throw error
      }
    },
    waitAfterBootout: (milliseconds) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds),
    maxUnloadReadbacks: 41,
  }
}

export function quiesceLaunchdServices(labels, {
  bootout, isLoaded, waitAfterBootout, maxUnloadReadbacks = 1, unloadTimeoutMs = 10_000,
}) {
  const prior = {}
  for (const label of labels) {
    const deadline = performance.now() + unloadTimeoutMs
    const remainingOptions = () => {
      const timeoutMs = Math.ceil(deadline - performance.now())
      if (timeoutMs <= 0) throw Object.assign(new Error(`launchd unload deadline exceeded: ${label}`), { code: 'ETIMEDOUT' })
      return { timeoutMs }
    }
    prior[label] = isLoaded(label, remainingOptions())
    let bootoutError
    if (prior[label]) {
      try { bootout(label, remainingOptions()) } catch (error) { bootoutError = error }
    }
    let loaded = isLoaded(label, remainingOptions())
    for (let readback = 1; loaded && readback < maxUnloadReadbacks; readback += 1) {
      const remainingMs = remainingOptions().timeoutMs
      waitAfterBootout?.(Math.min(250, remainingMs))
      loaded = isLoaded(label, remainingOptions())
    }
    if (loaded) throw bootoutError ?? new Error(`launchd service remained loaded after bootout: ${label}`)
  }
  return prior
}
