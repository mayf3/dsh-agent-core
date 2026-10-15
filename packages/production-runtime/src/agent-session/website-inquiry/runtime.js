/** No config => no SQLite import/open, filesystem, credentials or network. */
export async function mountWebsiteInquiryRuntime({ ctx, config, router, definition, workspaceBootstrap }) {
  if (config?.enabled !== true) return null
  if (!config.storeFile || !config.cursorKey || !config.jwksUrl || !Array.isArray(config.registry)) return null
  const [{ InquiryStore }, { createInquiryService }, { createInquiryAuthenticator }, { createWebsiteInquiryHandler }, { createWebsiteNative }] = await Promise.all([
    import('../../../../product-api/src/website-inquiry/store.js'),
    import('../../../../product-api/src/website-inquiry/service.js'),
    import('../../../../product-api/src/website-inquiry/auth.js'),
    import('../../../../product-api/src/website-inquiry/http.js'),
    import('./native.js'),
  ])
  const store = new InquiryStore(config.storeFile)
  const native = createWebsiteNative({ router, workspaceBootstrap })
  const service = createInquiryService({ enabled: true, registry: () => config.registry, store, router, definition,
    native, cursorKey: config.cursorKey })
  const auth = createInquiryAuthenticator({ jwksUrl: config.jwksUrl })
  const handler = createWebsiteInquiryHandler({ enabled: true, auth, service })
  ctx.provide('websiteInquiryHandler', handler)
  ctx.on?.('dispose', () => { native.dispose(); store.close() })
  return { service, handler }
}
