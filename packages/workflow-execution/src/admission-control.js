import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const OPEN = Object.freeze({ paused: false, reason: null, updatedAtMs: null })

export class AdmissionPauseControl {
  constructor({ file, now = () => Date.now() }) {
    if (typeof file !== 'string' || file === '') throw new TypeError('admission-control: file is required')
    this.file = file
    this.now = now
    this.state = this.#load()
  }

  #load() {
    try {
      const value = JSON.parse(readFileSync(this.file, 'utf8'))
      if (value?.paused === true) return { paused: true, reason: value.reason ?? 'operator_pause', updatedAtMs: value.updatedAtMs ?? null }
    } catch { /* absent/invalid control starts open; caller can fail closed at composition boundary */ }
    return { ...OPEN }
  }

  #persist(next) {
    mkdirSync(dirname(this.file), { recursive: true })
    const temp = `${this.file}.tmp-${process.pid}`
    writeFileSync(temp, `${JSON.stringify(next)}\n`, 'utf8')
    renameSync(temp, this.file)
    this.state = next
    return this.status()
  }

  status() { return { ...this.state } }
  isPaused() { return this.state.paused === true }
  pause(reason = 'operator_pause') {
    if (typeof reason !== 'string' || reason === '') throw new TypeError('admission-control: pause reason is required')
    return this.#persist({ paused: true, reason, updatedAtMs: this.now() })
  }
  resume() { return this.#persist({ paused: false, reason: null, updatedAtMs: this.now() }) }
}
