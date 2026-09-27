/** Test-only exact-byte loader. No filesystem or process fallback. */
import { SourceTextModule, SyntheticModule } from 'node:vm'

export async function memoryModule(source, originalURL, cachedBuiltins) {
  const module = new SourceTextModule(source, {
    identifier: originalURL,
    initializeImportMeta(meta) { meta.url = originalURL },
    importModuleDynamically() { throw new Error('MEMORY_DYNAMIC_IMPORT_DENIED') },
  })
  await module.link(async specifier => {
    if (!specifier.startsWith('node:') || !cachedBuiltins.has(specifier)) {
      throw new Error('MEMORY_IMPORT_DENIED')
    }
    const cached = cachedBuiltins.get(specifier)
    const names = Object.keys(cached)
    return new SyntheticModule(names, function () {
      for (const name of names) this.setExport(name, cached[name])
    }, { identifier: specifier })
  })
  await module.evaluate()
  return module.namespace
}
