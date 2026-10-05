/**
 * Broker capability: `development_execute`
 * (AGENT_CORE_DEVELOPMENT_EXECUTION_AUTHORITY_CONVERGENCE_V1, superseding
 * AGENT_CORE_DEVELOPMENT_EXECUTION_SURFACE_V1 CTR-DES-001).
 *
 * ONE shared, agent-agnostic local tool with five operations (self_ops
 * precedent): start / status / continue / cancel / result. Since the
 * authority convergence, this is a READ-ONLY compatibility surface: the Core
 * development writer is retired — start/continue/cancel refuse with
 * `writer_authority_retired` and agent-control is the sole development
 * writer. The backend (Codex) is invisible here — no CLI names, no argv, no
 * credential paths. Arguments are structurally closed
 * (additionalProperties:false): binaryPath / credentialPath / env / shell are
 * unrepresentable. Execution state lives in the development-execution ledger;
 * the handler map is provided by the control-plane composition
 * (developmentExecutionAccess).
 */

const executionIdArg = { type: 'string', description: 'System execution id returned by start.' }

export const developmentExecuteManifest = {
  id: 'development_execute',
  toolName: 'development_execute',
  local: { resource: 'development-execution' },
  requiredScopes: ['development.execute'],
  name: 'Development Execute',
  description:
    'AGENT_CORE_DEVELOPMENT_EXECUTION_AUTHORITY_CONVERGENCE_V1: the Core development writer authority is RETIRED — '
    + 'agent-control is the sole development writer (command admission, worktree/session identity, execution, receipts). '
    + 'start/continue/cancel refuse with writer_authority_retired; status/result keep serving recorded execution '
    + 'history read-only. The backend executor is system-selected; you never name or invoke it.',
  errors: [
    { code: 'invalid_arguments', description: 'Args failed structural validation.' },
    { code: 'writer_authority_retired', description: 'The Core development writer authority is retired; agent-control is the sole development writer. status/result remain readable.' },
    { code: 'repo_not_authorized', description: 'The requested repo is not on the development-execution allowlist.' },
    { code: 'base_sha_unknown', description: 'The requested baseSha does not exist in the authorized repo.' },
    { code: 'capacity_exhausted', description: 'The repo already has the maximum number of active development executions (maxWorktrees).' },
    { code: 'branch_not_permitted', description: 'The requested branch violates the repo allowlist prefixes.' },
    { code: 'config_missing', description: 'Development execution authority/backend is not configured on this deployment.' },
    { code: 'backend_unavailable', description: 'The pinned backend binary could not be verified.' },
    { code: 'backend_version_refused', description: 'The pinned backend binary version is below the required minimum.' },
    { code: 'execution_not_found', description: 'No execution with the given id.' },
    { code: 'execution_terminal', description: 'The execution is already terminal; status/result remain readable.' },
    { code: 'not_continuable', description: 'The execution is not in a continuable state.' },
    { code: 'access_denied', description: 'The caller lacks the development.execute grant.' },
  ],
  operations: [
    {
      name: 'start',
      description: 'RETIRED: refuses with writer_authority_retired — agent-control is the sole development writer.',
      arguments: {
        additionalProperties: false,
        properties: {
          repo: { type: 'string', description: 'ALLOWED repo name from the development-execution authority (not a path you choose).' },
          baseSha: { type: 'string', description: 'Exact base commit SHA to branch the worktree from.' },
          task: { type: 'string', description: 'Development task for the executor.' },
          branch: { type: 'string', description: 'Optional branch name (must satisfy repo branch prefixes).' },
          constraints: { type: 'string', description: 'Optional constraints appended to the task brief.' },
          dedupe_key: { type: 'string', description: 'Optional caller-scoped idempotency key: the same key returns the SAME execution instead of starting a second one.' },
        },
        required: ['repo', 'baseSha', 'task'],
      },
      result: { type: 'json' },
    },
    {
      name: 'status',
      description: 'Read the system-owned execution state (survives restarts).',
      arguments: {
        additionalProperties: false,
        properties: { executionId: executionIdArg },
        required: ['executionId'],
      },
      result: { type: 'json' },
    },
    {
      name: 'continue',
      description: 'RETIRED: refuses with writer_authority_retired; recorded execution history stays readable via status/result.',
      arguments: {
        additionalProperties: false,
        properties: {
          executionId: executionIdArg,
          instruction: { type: 'string', description: 'Follow-up instruction for the executor.' },
        },
        required: ['executionId', 'instruction'],
      },
      result: { type: 'json' },
    },
    {
      name: 'cancel',
      description: 'RETIRED: refuses with writer_authority_retired; process ownership belongs to the writer authority (agent-control).',
      arguments: {
        additionalProperties: false,
        properties: { executionId: executionIdArg },
        required: ['executionId'],
      },
      result: { type: 'json' },
    },
    {
      name: 'result',
      description: 'Terminal receipt (candidateSha, changedFiles, failureClass) — terminal:false while still running.',
      arguments: {
        additionalProperties: false,
        properties: { executionId: executionIdArg },
        required: ['executionId'],
      },
      result: { type: 'json' },
    },
  ],
}
