import { loadWebsiteInquiryConfig } from './startup-config.js'
import { createWebsiteInquiryHandler } from '../../../../product-api/src/website-inquiry/http.js'
/** No config => no SQLite import/open, filesystem, credentials or network. */
export async function mountWebsiteInquiryRuntime({ ctx, config, router, definition, workspaceBootstrap }) {
  if (config?.enabled !== true) return null
  const selected = Object.hasOwn(config, 'configFile') ? loadWebsiteInquiryConfig(config.configFile) : config
  const disabled = () => {
    const handler = createWebsiteInquiryHandler({})
    ctx.provide('websiteInquiryHandler', handler)
    return { service: null, handler }
  }
  if (!selected?.storeFile || !selected.cursorKey || !selected.jwksUrl || !Array.isArray(selected.registry)) return disabled()
  config = selected
  let store, native
  try {
    const [{ InquiryStore }, { createInquiryService }, { createInquiryAuthenticator }, { createWebsiteNative }] = await Promise.all([
      import('../../../../product-api/src/website-inquiry/store.js'),
      import('../../../../product-api/src/website-inquiry/service.js'),
      import('../../../../product-api/src/website-inquiry/auth.js'),
      import('./native.js'),
    ])
    store = new InquiryStore(config.storeFile)
    native = createWebsiteNative({ router, workspaceBootstrap })
    const service = createInquiryService({ enabled: true, registry: config.registryProvider ?? (() => config.registry), store, router, definition,
      native, cursorKey: config.cursorKey })
    const auth = createInquiryAuthenticator({ jwksUrl: config.jwksUrl })
    const handler = createWebsiteInquiryHandler({ enabled: true, auth, service })
    ctx.provide('websiteInquiryHandler', handler)
    ctx.on?.('dispose', () => { native.dispose(); store.close() })
    return { service, handler }
  } catch {
    try { native?.dispose(); store?.close() } catch {}
    return disabled()
  }
}
