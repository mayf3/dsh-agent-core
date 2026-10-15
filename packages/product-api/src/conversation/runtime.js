import { join } from 'node:path'
import { createConversationService } from './service.js'
import { createConversationHandler } from './http.js'
import { loadConversationConfig } from './auth.js'
export function mountConversationRuntime(ctx,{layout,router,definition,config={}}) {
  if (config.enabled !== true) return null
  const service = createConversationService({router,definition,
    storeFile:join(layout.controlDir,'native-conversation','requests.json'),
    configProvider:() => loadConversationConfig(config.authConfigFile),
  })
  ctx.provide('nativeConversation',service)
  ctx.effect(() => () => service.close())
  return service
}
export {createConversationHandler}
