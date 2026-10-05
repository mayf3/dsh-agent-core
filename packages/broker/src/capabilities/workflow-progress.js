const textItem = {
  type: 'string',
  minLength: 1,
}

const list = (description, maxItems = 8) => ({
  type: 'array',
  description,
  items: textItem,
  maxItems,
})

const errorCodes = [
  'invalid_arguments',
  'missing_workflow_context',
  'stale_attempt',
  'reporter_mismatch',
  'session_mismatch',
  'checkpoint_unavailable',
  'credential_unavailable',
  'unsupported_operation',
  'internal_error',
]

export const workflowProgressManifest = {
  id: 'workflow_progress',
  toolName: 'workflow_progress',
  selector: 'operation',
  name: 'Workflow Progress',
  description:
    'Record or read a thin execution-resume checkpoint for the CURRENT trusted Workflow attempt. '
    + 'This metadata never completes a Workflow, never triggers a transition/wake, and never counts as business progress.',
  local: true,
  errors: errorCodes.map((code) => ({ code, description: code.replaceAll('_', ' ') })),
  operations: [
    {
      name: 'checkpoint',
      description:
        'Replace the latest thin resume checkpoint for this exact Workflow attempt. '
        + 'Workflow/node/attempt/agent/session identity comes only from trusted runtime context.',
      arguments: {
        additionalProperties: false,
        structuralDiagnostics: true,
        properties: {
          accomplished: list('Small list of facts already accomplished in this attempt.'),
          current: list('Small list of work currently in progress.'),
          next: list('Small list of concrete next actions.'),
          blocker: {
            type: 'string',
            minLength: 1,
            description: 'Optional concise blocker description. This does NOT change Workflow status.',
          },
          artifacts: list('Opaque artifact references only; do not copy artifact contents here.', 12),
        },
        required: [],
      },
      result: { type: 'json' },
      errors: errorCodes,
    },
    {
      name: 'read_current',
      description:
        'Read the latest checkpoint for this exact trusted Workflow attempt. No transcript is returned.',
      arguments: {
        additionalProperties: false,
        structuralDiagnostics: true,
        properties: {},
        required: [],
      },
      result: { type: 'json' },
      errors: errorCodes,
    },
  ],
}

export const workflowProgressManifests = [workflowProgressManifest]
