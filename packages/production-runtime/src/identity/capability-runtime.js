import { loadCredentialFor } from '../../../broker/src/credential-store.js'
import { requestAccessToken } from '../../../broker/src/transport.js'
// Identity capability providers via the package's TRACKED PUBLIC ENTRY (DSH_AGENT_CORE_MODULARITY_PHASE_A_V1 closure amendment): a tracked relative path closes under plain source resolution in every checkout — no untracked node_modules bridge, no manual link step. package.json exports["."] exposes the same file.
import { createAgentDirectoryAccess, createAgentPrincipalResolutionAccess, createAgentPrincipalReverseResolutionAccess } from '../../../agent-identity-capabilities/index.js'
import { createWorkflowHumanPrincipalProjectionAccess } from './workflow-human-principal-projection.js'
import { provideOwnerAssistanceResumeEvidenceAccess } from '../workflow/owner-assistance-resume-evidence.js'

/** Mount the existing trusted identity providers without changing their contracts. */
export function mountIdentityCapabilityRuntime({ ctx, definition, brokerCredentialsFile, brokerAuthServiceOrigin, workflowServiceOrigin }) {
  // AGENT_CORE_EXACT_PRINCIPAL_AGENT_RESOLUTION_V1 (accepted): the trusted
  // LOCAL provider for the read-only agent_resolve_principal. Auth is the
  // identity authority (exact UUID read; audience `agent-principal-resolution`
  // × `auth.agent.resolve`); the local Agent Definition registry then proves
  // exact deliverability. The token is acquired by the runtime for the
  // ACTUAL caller through the same trusted credential seam as the gateway
  // grant check and never reaches the model; the Auth origin is the fixed
  // deployment configuration, never a tool argument.
  ctx.provide('agentPrincipalResolutionAccess', createAgentPrincipalResolutionAccess({
    definition,
    authServiceOrigin: brokerAuthServiceOrigin,
    acquireCallerToken: async ({ agentId }) => {
      const credential = loadCredentialFor(brokerCredentialsFile, agentId)
      if (credential === undefined) {
        throw Object.assign(new Error('no credential bound'), { code: 'credential_unavailable' })
      }
      try {
        return await requestAccessToken({
          credential,
          authServiceOrigin: brokerAuthServiceOrigin,
          resource: 'agent-principal-resolution',
          scope: 'auth.agent.resolve',
        })
      } catch (error) {
        throw Object.assign(error instanceof Error ? error : new Error(String(error)), {
          code: error?.errorCode ?? 'transport_failure',
        })
      }
    },
  }))

  // AGENT_CORE_AGENT_PRINCIPAL_REVERSE_RESOLUTION_V1 (accepted): the trusted
  // LOCAL provider for the read-only agent_resolve_principal_by_agent. Auth is
  // the identity authority (exact agentId -> stored Agent Principal UUID via
  // the identity-directory reverse route; audience `identity-directory` x
  // `auth.directory.read` — the baseline internal directory entitlement, no
  // new scope/audience); the local Agent Definition registry then proves exact
  // deliverability. Same trusted seam as the forward sibling: the token is
  // acquired for the ACTUAL caller and never reaches the model, and the Auth
  // origin is the fixed deployment configuration, never a tool argument. No
  // canonical-lifecycle semantics are claimed or returned.
  ctx.provide('agentPrincipalReverseResolutionAccess', createAgentPrincipalReverseResolutionAccess({
    definition,
    authServiceOrigin: brokerAuthServiceOrigin,
    acquireCallerToken: async ({ agentId }) => {
      const credential = loadCredentialFor(brokerCredentialsFile, agentId)
      if (credential === undefined) {
        throw Object.assign(new Error('no credential bound'), { code: 'credential_unavailable' })
      }
      try {
        return await requestAccessToken({
          credential,
          authServiceOrigin: brokerAuthServiceOrigin,
          resource: 'identity-directory',
          scope: 'auth.directory.read',
        })
      } catch (error) {
        throw Object.assign(error instanceof Error ? error : new Error(String(error)), {
          code: error?.errorCode ?? 'transport_failure',
        })
      }
    },
  }))

  // AGENT_CORE_AGENT_DIRECTORY_TOOL_V1 (accepted): the trusted LOCAL provider
  // for the read-only agent_directory (resolve/list). It reads ONLY the Agent
  // Definition snapshot — the single canonical source of Agent existence/
  // identity/enabled truth — so no second registry, cache or mapping exists;
  // visibility is the accepted agent.definition.read no-scope baseline (no
  // new auth audience/scope/grant, no boundary expansion), and a disabled
  // Agent resolves explicitly with enabled:false (CTR-IAD-003 semantics).
  ctx.provide('agentDirectoryAccess', createAgentDirectoryAccess({ definition }))

  ctx.provide('workflowHumanPrincipalProjectionAccess', createWorkflowHumanPrincipalProjectionAccess({
    workflowOrigin: workflowServiceOrigin,
    acquireCallerToken: async ({ agentId }) => {
      const credential = loadCredentialFor(brokerCredentialsFile, agentId)
      if (credential === undefined) throw Object.assign(new Error('no credential bound'), { code: 'credential_unavailable' })
      try {
        return await requestAccessToken({
          credential,
          authServiceOrigin: brokerAuthServiceOrigin,
          resource: 'svc-workflow',
          scope: 'workflow.admin',
        })
      } catch (error) {
        throw Object.assign(error instanceof Error ? error : new Error(String(error)),
          { code: error?.errorCode ?? 'transport_failure' })
      }
    },
  }))

  provideOwnerAssistanceResumeEvidenceAccess({ ctx, workflowOrigin: workflowServiceOrigin, brokerCredentialsFile, brokerAuthServiceOrigin })
}
