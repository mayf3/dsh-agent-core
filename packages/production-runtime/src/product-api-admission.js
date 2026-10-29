import { createWorkflowAdmissionHandler } from '../../product-api/src/workflow-admission.js'

// PRODUCT #525 P1: the directory admission route mounts ONLY with its JWKS
// verifier configured — a missing AGENT_DIRECTORY_AUTH_JWKS_URL fails
// composition loud (never a silently permanently-401 directory route; the
// 2026-10-17 outage shape). Extracted from compose.js (registry MUST_NOT_GROW):
// constructed just when the product API is actually enabled; disabled
// compositions stay unaffected.
//
// ORDERING CONTRACT: composition calls this BEFORE the Feishu channel mount
// and every other resource-acquiring mount. Composition has no failure
// cleanup — a rejection carries no runtime handle to stop() — so the JWKS
// seam must fail before a live channel connection can be stranded. Guarded by
// the log-order pin in compose-admission-guard.test.js.
export function mountProductApiAdmission({ definition, productApiCfg = {}, log = {} }) {
  const enabled = productApiCfg.enabled ?? process.env.PRODUCT_API_ENABLED !== '0'
  return {
    enabled,
    ...(enabled ? {
      workflowAdmission: createWorkflowAdmissionHandler({
        definition,
        jwksUrl: process.env.AGENT_DIRECTORY_AUTH_JWKS_URL,
        log,
      }),
    } : {}),
  }
}
