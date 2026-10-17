import { failure, fault } from './protocol.js'
export function createConversationHandler({service} = {}) {
  return async function handle(req,url) {
    if (!url.pathname.startsWith('/v1/conversation/')) return null
    if (req.socket?.remoteAddress && !['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)) return failure(fault('NO_ACCESS',403))
    if (!service) return failure(fault('NOT_PROVISIONED',503))
    const operation = url.pathname.slice('/v1/conversation/'.length)
    if (req.method !== 'POST' || !['resolve','send','result','history','events'].includes(operation) || url.search) return failure(fault('NOT_SUPPORTED',405))
    try {
      const chunks=[]
      let size=0
      for await (const chunk of req) {
        size+=chunk.length
        if(size>1000000) throw fault('RESOURCE_LIMIT',413)
        chunks.push(chunk)
      }
      let body
      try {body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)))} catch {throw fault('INVALID_ARGUMENTS')}
      return await service.invoke(operation,body,req.headers.authorization)
    } catch(error) {return failure(error)}
  }
}
