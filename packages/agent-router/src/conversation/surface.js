import {readConversationSource,acknowledgeConversationSource} from './source.js'
function reject(code){return Object.assign(new Error(code),{code,status:'not_admitted',proven:'zero_byte'})}
export function createProductSurfaceConversation({sourceDirectory,bindingResolution,definition,reconciliationStore,routeChain,workspaceBootstrap}){
  return {
    async sendProductSurface({requestId,bindingId,agentId,message}){
      if(!sourceDirectory)throw reject('CONVERSATION_SOURCE_NOT_CONFIGURED')
      const binding=bindingResolution.getBinding(bindingId),agent=definition.getAgent(agentId)
      if(!binding||binding.activeAgentId!==agentId||binding.activeSessionId!=='main'||agent?.id!==agentId||agent.disabled)throw reject('CONVERSATION_BINDING_INVALID')
      reconciliationStore.assertBusinessAdmissionReady?.()
      const fence=reconciliationStore.admissionBlockerForAgent?.(agentId)??reconciliationStore.activeFenceForAgent?.(agentId)
      if(fence)throw reject('AGENT_PROCESS_TURN_FENCED')
      reconciliationStore.assertMintCapacity(agentId)
      const {workspaceId,workspacePath}=bindingResolution.resolveEffectiveWorkspace(binding)
      if(workspaceId!==null)await workspaceBootstrap.ensureWorkspace(workspaceId)
      // Binding movement during asynchronous bootstrap is never silently adopted.
      const current=bindingResolution.getBinding(bindingId)
      if(JSON.stringify(current)!==JSON.stringify(binding))throw reject('CONVERSATION_BINDING_CHANGED')
      const receipt=await routeChain.admitWithRouteChain(agentId,{sessionId:'main',message,opts:{
        cwd:workspacePath,bindingContext:bindingId,productSurface:true,callerCorrelation:{requestId},conversationSource:{requestId},
      }})
      return {...receipt,acceptedAt:Date.now()}
    },
    readConversationSource:({requestId,agentId})=>readConversationSource({directory:sourceDirectory,requestId,agentId}),
    acknowledgeConversationSource:({requestId,agentId,expiresAt})=>acknowledgeConversationSource({directory:sourceDirectory,requestId,agentId,expiresAt}),
  }
}
