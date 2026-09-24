/**
 * Capability manifest aggregation for the broker plugin (CODE_STRUCTURE_GUARDRAILS_V1
 * split_followup for packages/broker/src/index.js: the plugin entry imports
 * ONE manifest surface instead of one line per capability family, keeping the
 * entry file's import count under the barrel limit).
 *
 * Pure re-export hub of PURE-DATA manifests — zero implementation lives here.
 * New capability families append exactly one line here plus the
 * DEFAULT_MANIFESTS entry in ../index.js.
 */

export { manifests as forumManifests, normalManifests as forumNormalManifests } from './forum.js'
export { moderatorManifests as forumModeratorManifests } from './forum-moderation.js'
export { manifests as workflowManifests } from './workflow.js'
export { manifests as okrManifests } from './okr.js'
export { agentDefinitionManifests } from './agent-definition.js'
export { schedulerManifests } from './scheduler.js'
export { selfOpsManifests } from './self-ops.js'
export { developmentExecuteManifest } from './development-execute.js'
export { manifests as agentSessionMessagingManifests } from './agent-session-messaging.js'
export { manifests as agentPrincipalResolutionManifests } from './agent-principal-resolution.js'
export { manifests as agentPrincipalReverseResolutionManifests } from './agent-principal-reverse-resolution.js'
export { manifests as agentDirectoryManifests } from './agent-directory.js'
export { manifests as workflowHumanPrincipalProjectionManifests } from './workflow-human-principal-projection.js'
export { manifests as executionHistoryManifests } from './execution-history.js'
export { lifeWorkbenchManifests } from './life-workbench.mjs'
