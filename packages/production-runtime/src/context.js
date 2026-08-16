/**
 * @agent-core/production-runtime/src/context.js — the minimal plugin host
 * context.
 *
 * The Production Runtime is ONE plain Node process (not a DSH profile), so
 * it needs the smallest substrate the EXISTING plugins consume:
 * `get/provide` (service lookup/registration, Cordis VALUE semantics) and
 * `effect(fn)` (register a disposer; `disposeAll()` runs them on graceful
 * shutdown — the Router's disposer shuts down every owned agent process).
 *
 * This is deliberately NOT a framework: no plugin loader, no lifecycle
 * states, no config validation, no dependency injection engine. It replaces
 * the historical `fakeCtx` of the demo resident with a named, documented,
 * production-honest object.
 */

/**
 * @returns {{get:(name:string)=>any, provide:(name:string, value:any)=>void,
 *   effect:(fn:()=>any)=>void, disposeAll:()=>Promise<void>,
 *   servicesProvided:()=>string[]}} the plugin host context.
 */
export function createPluginContext() {
  const services = new Map()
  const disposers = []
  return {
    get: (name) => services.get(name),
    provide: (name, value) => { services.set(name, value) },
    effect: (fn) => {
      const dispose = fn()
      if (typeof dispose === 'function') disposers.push(dispose)
    },
    async disposeAll() {
      for (const dispose of disposers.splice(0)) {
        try { await dispose() } catch { /* best effort; shutdown continues */ }
      }
    },
    servicesProvided: () => [...services.keys()],
  }
}
