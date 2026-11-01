// The child binds package resolution to the immutable generation selected by
// admission. Later current/home relinking cannot redirect a lazy plugin import.
import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { verifyFleetGenerationDispatch } from './fleet-generation.js'
import { readHarnessIdentity } from './index.js'

const snapshot = JSON.parse(process.env.DSH_CODEX_FLEET_SNAPSHOT ?? 'null')
if (!snapshot) throw new Error('fleet import hook requires an admitted generation')
verifyFleetGenerationDispatch(snapshot, { home: process.env.DSH_HOME, harnessIdentity: readHarnessIdentity() })
delete process.env.DSH_CODEX_FLEET_SNAPSHOT
const exports = JSON.parse(readFileSync(resolve(snapshot.pluginRoot, 'package.json'), 'utf8')).exports
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier !== 'dsh-codex' && !specifier.startsWith('dsh-codex/')) return nextResolve(specifier, context)
    const key = specifier === 'dsh-codex' ? '.' : `.${specifier.slice('dsh-codex'.length)}`
    const entry = exports?.[key]
    const target = typeof entry === 'string' ? entry : entry?.default
    if (typeof target !== 'string') throw new Error('fleet plugin export is not declared')
    const path = resolve(snapshot.pluginRoot, target)
    if (!path.startsWith(`${snapshot.pluginRoot}${sep}`)) throw new Error('fleet plugin export escapes generation')
    return nextResolve(pathToFileURL(path).href, context)
  },
})
