/**
 * Sanitized svc-workflow admission error family (CTR-CIR-003), shared by the
 * two Workflow write capabilities whose paths can reach admission
 * (workflow_definition_authoring, workflow_execute). Declaring these codes in
 * the manifests keeps the mapping layer from degrading them to the generic
 * http_4xx/http_5xx fallback (AGENT_CORE_WORKFLOW_ADMISSION_ERROR_PRESERVATION_V1).
 *
 * Transcribed verbatim from svc-workflow @ bfc28c15320acab8cf7d7a36128cd5c9db9a1b1a
 * src/auth/admission.rs sanitized_code()/sanitized_status(): a principal that
 * fails admission is a 422 business rejection; directory configuration/
 * transport failures and the commit-outcome-uncertain case surface as 503
 * (fail closed — commit_outcome_unknown is never a retry signal).
 */
export const admissionErrors = [
  { code: 'admission_configuration', description: 'Admission directory is misconfigured; assignment admission could not run (HTTP 503).' },
  { code: 'admission_timeout', description: 'Admission check timed out before reaching a decision (HTTP 422).' },
  { code: 'admission_commit_outcome_unknown', description: 'Commit exceeded the remaining admission-through-commit budget; server-side outcome is uncertain — do not blindly retry (HTTP 503).' },
  { code: 'admission_unavailable', description: 'Admission directory is unavailable; assignment admission could not run (HTTP 503).' },
  { code: 'admission_denied', description: 'Assignment admission denied for this caller (HTTP 422).' },
  { code: 'admission_rejected', description: 'Principal rejected by admission (HTTP 422).' },
  { code: 'admission_malformed_response', description: 'Admission directory returned a malformed response (HTTP 503).' },
]
