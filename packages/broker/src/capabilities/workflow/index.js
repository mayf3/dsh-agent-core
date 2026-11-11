import { workflowMyTasksManifest, workflowInstanceDetailManifest, workflowSubmissionHistoryManifest, workflowMyDomainsManifest, workflowDomainInstancesManifest, workflowGlobalInstancesManifest } from './reads.js'
export { workflowMyTasksManifest, workflowInstanceDetailManifest, workflowSubmissionHistoryManifest, workflowMyDomainsManifest, workflowDomainInstancesManifest, workflowGlobalInstancesManifest }
import { workflowDispatchIntentsManifest, workflowWakeDispatchIntentManifest, workflowExecutionEscalationManifest } from './dispatch.js'
export { workflowDispatchIntentsManifest, workflowWakeDispatchIntentManifest, workflowExecutionEscalationManifest }
import { workflowDomainAdminManifest, workflowDomainMembersManifest, workflowDomainBindingReconcileManifest } from './domains.js'
export { workflowDomainAdminManifest, workflowDomainMembersManifest, workflowDomainBindingReconcileManifest }
import { workflowDefinitionAuthoringManifest } from './definition-authoring.js'
import { workflowExecuteManifest } from './execute.js'
import { workflowOwnerObligationManifest } from './owner-obligation.js'
export const manifests = [
  workflowOwnerObligationManifest,
  workflowMyTasksManifest,
  workflowInstanceDetailManifest,
  workflowSubmissionHistoryManifest,
  workflowMyDomainsManifest,
  workflowDomainInstancesManifest,
  workflowGlobalInstancesManifest,
  workflowExecuteManifest,
  workflowDomainAdminManifest,
  workflowDomainMembersManifest,
  workflowDomainBindingReconcileManifest,
  workflowDefinitionAuthoringManifest,
  workflowDispatchIntentsManifest,
  workflowWakeDispatchIntentManifest,
  workflowExecutionEscalationManifest,
]
