import { execFileSync } from 'node:child_process'

export function createLaunchdAdapter({ launchctl = 'launchctl', runCommand = execFileSync } = {}) {
  const execute = (file, args, timeoutMs = 10_000) => runCommand(file, args, {
    stdio: ['ignore', 'pipe', 'pipe'], timeout: Math.max(1, Math.floor(timeoutMs)), killSignal: 'SIGKILL',
    encoding: 'utf8',
    ...(file === '/bin/ps' ? { env: { ...process.env, LC_ALL: 'C', LANG: 'C' } } : {}),
  })
  const run = (args, timeoutMs) => execute(launchctl, args, timeoutMs)
  const unavailable = () => Object.assign(new Error('exact launchd process instance is unavailable or changed'), { code: 'RESTART_EXIT_PROOF_UNAVAILABLE' })
  const readProcessInstance = (pid, options = {}) => {
    if (!Number.isSafeInteger(pid) || pid <= 0) throw unavailable()
    let text
    try {
      text = execute('/bin/ps', ['-p', String(pid), '-o', 'pid=', '-o', 'uid=', '-o', 'gid=', '-o', 'lstart=', '-o', 'comm='], options.timeoutMs).trim()
    } catch (error) {
      if (error.status === 1 && error.signal == null && error.code !== 'ETIMEDOUT'
          && !String(error.stdout ?? '').trim() && !String(error.stderr ?? '').trim()) return null
      throw error
    }
    const match = /^(\d+)\s+(\d+)\s+(\d+)\s+(.+?\d{4})\s+(\/.*)$/.exec(text)
    if (!match || Number(match[1]) !== pid || !Number.isFinite(Date.parse(match[4]))) throw unavailable()
    return { pid, uid: Number(match[2]), gid: Number(match[3]), started: match[4].trim(), program: match[5] }
  }
  const readRuntimeInstance = (label, options = {}) => {
    const snapshot = () => {
      const matches = [...run(['print', label], options.timeoutMs).matchAll(/^\s*pid\s*=\s*(\d+)\s*$/gm)]
      if (matches.length !== 1) throw unavailable()
      const instance = readProcessInstance(Number(matches[0][1]), options)
      if (instance === null) throw unavailable()
      return instance
    }
    const first = snapshot(), second = snapshot()
    if (JSON.stringify(first) !== JSON.stringify(second)) throw unavailable()
    return first
  }
  return {
    readRuntimeInstance,
    readProcessInstance,
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
