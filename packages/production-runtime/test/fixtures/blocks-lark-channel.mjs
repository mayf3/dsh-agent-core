/**
 * Loader hook for feishu-missing-impl-startup.test.js: simulates the
 * optional Feishu adapter's SDK implementation being ABSENT (unresolvable)
 * without touching node_modules. Every other specifier resolves normally.
 */
export async function resolve(specifier, context, nextResolve) {
  if (specifier === '@larksuite/channel') {
    throw new Error(`[test fixture] simulated missing optional adapter implementation: cannot resolve '${specifier}'`)
  }
  return nextResolve(specifier, context)
}
