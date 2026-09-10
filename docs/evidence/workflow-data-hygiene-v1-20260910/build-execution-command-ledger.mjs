#!/usr/bin/env node
// WORKFLOW_DATA_HYGIENE_V1 r2 — EXECUTION_COMMAND_LEDGER builder (mechanical derivation, READ-ONLY).
// Expands the 48 logical cleanup subjects into command-level production mutation sequences.
// Command names are frozen from a fresh source census (NOT guessed):
//   - svc-workflow instance cancel: POST /internal/v1/workflow-instances/{id}/cancel
//   - WDA authoring (broker manifest workflow_definition_authoring, 4 ops; per repair subject
//     only 3 are mutations): create_draft_version -> replace_draft_graph -> publish_version
//   - svc-workflow definition archive: POST /internal/v1/domains/{domainId}/definitions/{defId}/archive
//   - svc-workflow coordinator control plane (accepted SVC_WORKFLOW_COORDINATOR_CONTROL_PLANE_V1):
//     workflow_domain_binding_reconcile(apply)  [source binding exists]
//     workflow_domain_admin(set_owner)          [no source binding]
// Read-only steps (reconcile plan, read-backs) are verification, NOT mutation commands.
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = dirname(fileURLToPath(import.meta.url))
const RAW = join(DIR, 'census-raw')
const out = []
const cmd = (subject, seq, family, operation, endpoint, method, authority, role, preimage, admission, postimage) =>
  out.push({ subject_id: subject, sequence_no: seq, command_family: family, operation, endpoint, method,
             authority_ref: authority, server_side_role: role, expected_preimage: preimage,
             idempotency_anchor: 'fresh Idempotency-Key per command (trusted transport seam; model-inaccessible)',
             success_receipt: 'workflow_command_receipts + security audit row (per svc contract)',
             expected_postimage: postimage, next_step_admission_condition: admission })

// ---- M6 (run FIRST): 7 reconcile-applies + 2 set_owner
const m6 = [
  ['M6-1','adc-v2-dogfood','22222222-0000-0000-0000-000000000100','ab05acde-524f-40b4-a904-eb8882db791b','3e2439d2-fb54-44f5-afee-77aa17c40d22','4e5a4578-0645-4133-bd35-b80e453dfee9','agt_cto-agent','CANONICAL_TWIN_REPAIR'],
  ['M6-2','canary-wda-v1-1788583811','ac4d950e-0000-0000-0000-000000000000','1f4a85a6-8010-445c-a30c-5ff01c4579be','bc970ced-710f-4479-9ff0-e295a1c59424','dc702687-6515-4a2a-91ae-e572a9bbd766','agt_hr-agent','CANONICAL_TWIN_REPAIR'],
  ['M6-3','canary-wda-v1-1788583998','5464e4e1-0000-0000-0000-000000000000','0110a71a-cf1d-45e5-aa03-539098eff4bf','bc970ced-710f-4479-9ff0-e295a1c59424','dc702687-6515-4a2a-91ae-e572a9bbd766','agt_hr-agent','CANONICAL_TWIN_REPAIR'],
  ['M6-4','canary-wda-v1-1788584903','6af3320d-0000-0000-0000-000000000000','942b2680-82d1-4033-ad07-39f694bbb002','bc970ced-710f-4479-9ff0-e295a1c59424','dc702687-6515-4a2a-91ae-e572a9bbd766','agt_hr-agent','CANONICAL_TWIN_REPAIR'],
  ['M6-5','assistance-5148b565-…','a002d794-0000-0000-0000-000000000000','91fa0c02-d2da-4735-bb1e-c76a109bc20c','7e016259 (NOT_FOUND in auth; FK-present in svc)','dc702687-6515-4a2a-91ae-e572a9bbd766','agt_hr-agent','OPERATIONAL_OWNER_TEST_DOMAIN'],
  ['M6-6','assistance-74a028b0-…','3270e4fb-0000-0000-0000-000000000000','bf509296-a419-4565-b551-2f623c7be189','f7226497 (NOT_FOUND)','dc702687-6515-4a2a-91ae-e572a9bbd766','agt_hr-agent','OPERATIONAL_OWNER_TEST_DOMAIN'],
  ['M6-7','assistance-1853d6d7-…','350fd0d0-0000-0000-0000-000000000000','7b59a044-3528-49a5-b584-2fb3f9af2cb7','9d63fca9 (NOT_FOUND)','dc702687-6515-4a2a-91ae-e572a9bbd766','agt_hr-agent','OPERATIONAL_OWNER_TEST_DOMAIN'],
]
for (const [sid, dom, domId, binding, fromP, toP, toAgent, kind] of m6) {
  cmd(sid, 1, 'M6_BINDING_RECONCILE', 'workflow_domain_binding_reconcile(operation=plan)',
      `POST /internal/v1/domains/${domId}/binding-reconcile/plan`, 'POST',
      'SVC_WORKFLOW_COORDINATOR_CONTROL_PLANE_V1 (accepted)', 'GLOBAL_WORKFLOW_COORDINATOR (server-side)',
      `binding-rows-for-plan.tsv: ${binding} enabled=TRUE role=DOMAIN_OWNER principal=${fromP}`,
      'verification only — READ-ONLY, not a mutation command; blockers[] must be empty',
      'plan JSON: sourceBindingExists=true sourceBindingEnabled=true singleOwnerInvariantOk=true')
  cmd(sid, 2, 'M6_BINDING_RECONCILE', 'workflow_domain_binding_reconcile(operation=apply, role=DOMAIN_OWNER)',
      `POST /internal/v1/domains/${domId}/binding-reconcile/apply`, 'POST',
      'SVC_WORKFLOW_COORDINATOR_CONTROL_PLANE_V1 (accepted)', 'GLOBAL_WORKFLOW_COORDINATOR (server-side)',
      `in-tx re-assert: binding_id=${binding} still enabled, role=DOMAIN_OWNER, principal=${fromP}`,
      `${sid}-1 plan admission = blockers empty`,
      `outcome=applied; old binding enabled=false; exactly one enabled DOMAIN_OWNER = ${toP} (${toAgent}); audit action=binding_reconciled authorityBasis=GLOBAL_WORKFLOW_COORDINATOR rationale=${kind}`)
  cmd(sid, 3, 'M6_READBACK', 'workflow_domain_admin(operation=get_owner)',
      `GET /internal/v1/domains/${domId}/owner`, 'GET',
      'SVC_WORKFLOW_COORDINATOR_CONTROL_PLANE_V1 (accepted)', 'GLOBAL_WORKFLOW_COORDINATOR or own enabled DOMAIN_OWNER',
      `${sid}-2 outcome=applied`,
      `${sid}-2 success receipt`,
      `ownerPrincipalId=${toP} ownerEnabled=true`, )
}

// M6-8/M6-9: no source binding -> set_owner
for (const [sid, dom, domId] of [['M6-8','canary-e2e-1784457448','ed99dcba-0000-0000-0000-000000000000'],['M6-9','auth-v1-e2e-readonly','e2000000-0000-0000-0000-000000000000']]) {
  cmd(sid, 1, 'M6_SET_OWNER', 'workflow_domain_admin(operation=set_owner)',
      `PUT /internal/v1/domains/${domId}/owner`, 'PUT',
      'SVC_WORKFLOW_COORDINATOR_CONTROL_PLANE_V1 (accepted)', 'GLOBAL_WORKFLOW_COORDINATOR (server-side)',
      `no DOMAIN_OWNER binding row exists for ${dom} (census) — reconcile preimage impossible, set_owner is the narrow establishing path`,
      `${sid} test-domain provenance + cleanup-only rationale (CLEANUP_PLAN §M6 rationale table)`,
      `exactly one enabled DOMAIN_OWNER = dc702687 (agt_hr-agent), operational owner for cleanup`)
  cmd(sid, 2, 'M6_READBACK', 'workflow_domain_admin(operation=get_owner)',
      `GET /internal/v1/domains/${domId}/owner`, 'GET',
      'SVC_WORKFLOW_COORDINATOR_CONTROL_PLANE_V1 (accepted)', 'GLOBAL_WORKFLOW_COORDINATOR or own enabled DOMAIN_OWNER',
      `${sid}-1 success receipt`,
      `${sid}-1 success receipt`,
      `ownerPrincipalId=dc702687-6515-4a2a-91ae-e572a9bbd766 ownerEnabled=true`)
}

// ---- M1: 12 cancels (1 command each)
const m1 = [
  ['M1-1','8507658d-b5ab-44bc-83f0-afc97b5fd56c'],['M1-2','6671fdb5-eb42-4044-b2e5-4a284c657f91'],
  ['M1-3','f5de0535-e448-4cdf-b5ab-9d94843e97cb'],['M1-4','0ce9924d-6f9f-4b30-a838-04644a06d396'],
  ['M1-5','c692ec90-6392-4ec0-bea1-749e83d340cf'],['M1-6','5fe7570a-dc15-43ae-b5c5-950692951aa3'],
  ['M1-7','5538dca9-9c19-46f9-83ef-41824c7468d8'],['M1-8','9fd262ec-8906-4cbc-8a3f-1ef2321d9715'],
  ['M1-9','91800cbc-6e6c-4b9d-a948-39d8fd271be4'],['M1-10','8916aa79-22af-4be0-ab2c-fbb66a7ff3f2'],
  ['M1-11','e7000000-0000-4000-8000-00000000e001'],['M1-12','e7000000-0000-4000-8000-00000000e002'],
]
for (const [sid, iid] of m1) {
  cmd(sid, 1, 'M1_TEST_CANCEL', 'workflow_execute(operation=cancel_instance)',
      `POST /internal/v1/workflow-instances/${iid}/cancel`, 'POST',
      'DOMAIN_OWNER(domain) post-M6 [or GLOBAL_WORKFLOW_COORDINATOR — same accepted widening]',
      'DOMAIN_OWNER OR GLOBAL_WORKFLOW_COORDINATOR (server-side)',
      `census row: ${iid} cancelled=false archived_at=null; class=TEST_OR_FIXTURE with mechanical signals`,
      '§M6 completed for the subject domain AND AUTH_V1_CANARY_WRITE_ENABLED=true AND G2 admission gate (§5)',
      'cancelled=true; exactly one CANCEL event; history/context/visits preserved; exits status=active surface')
}

// ---- M2: 25 defs x 3 authoring commands
const defs = readFileSync(join(RAW, 'definition-classification.tsv'), 'utf8').split('\n').filter(Boolean).map(l => l.split('\t'))
const dh = defs[0]
const m2defs = defs.slice(1).filter(r => r[dh.indexOf('class')] === 'BUSINESS_STALE_FIXED_CONFIG')
  .map(r => [r[dh.indexOf('definition_key')], r[dh.indexOf('domain')], r[dh.indexOf('definition_id')]])
for (const [dkey, dom, defid] of m2defs) {
  const sid = `M2::${dkey}`
  cmd(sid, 1, 'M2_DEFINITION_REPAIR', 'workflow_definition_authoring(operation=create_draft_version)',
      `POST /internal/v1/domains/{domainId}/definitions/${defid}/versions`, 'POST',
      'DOMAIN_OWNER(domain) — svc definition governance (WDA authoring surface)', 'DOMAIN_OWNER (server-side)',
      `effective-published-versions.tsv: current PUBLISHED version carries stale fixed-principal config (ledger r2)`,
      '§M6 completed for the domain; G2 admission gate (§5)',
      'new DRAFT version exists (semantic model preserved per source definition)')
  cmd(sid, 2, 'M2_DEFINITION_REPAIR', 'workflow_definition_authoring(operation=replace_draft_graph)',
      `PUT /internal/v1/domains/{domainId}/definitions/${defid}/draft`, 'PUT',
      'DOMAIN_OWNER(domain) — svc definition governance', 'DOMAIN_OWNER (server-side)',
      `${sid}-1 draft exists; graph nodes/submissions mirror the PUBLISHED graph with legacy principals substituted by mechanical twin map`,
      `${sid}-1 success receipt`,
      'draft graph validated by svc canonical validator (publish separately)')
  cmd(sid, 3, 'M2_DEFINITION_REPAIR', 'workflow_definition_authoring(operation=publish_version)',
      `POST /internal/v1/domains/{domainId}/definitions/${defid}/publish`, 'POST',
      'DOMAIN_OWNER(domain) — svc definition governance', 'DOMAIN_OWNER (server-side)',
      `${sid}-2 validated draft`,
      `${sid}-2 success receipt`,
      'new version PUBLISHED (retires stale PUBLISHED from future materialization; historical versions immutable)')
}

// ---- M2A: 2 definition archives (1 command each)
cmd('M2A-1', 1, 'M2A_TEST_DEF_ARCHIVE', 'svc definition archive (governance metadata action)',
    'POST /internal/v1/domains/{domainId}/definitions/{defId}/archive', 'POST',
    'DOMAIN_OWNER(hr-onboarding) = dc702687', 'DOMAIN_OWNER (server-side)',
    'visit_canary_648a6b90-… PUBLISHED in hr-onboarding (census)',
    'M1 cleanup of that domain complete (or independent — no hard dependency)',
    'definition archived (governance metadata; no history loss)')
cmd('M2A-2', 1, 'M2A_TEST_DEF_ARCHIVE', 'svc definition archive (governance metadata action)',
    'POST /internal/v1/domains/{domainId}/definitions/{defId}/archive', 'POST',
    'DOMAIN_OWNER(adc-v2-dogfood) = 4e5a4578 after M6-1', 'DOMAIN_OWNER (server-side)',
    'test-workflow-v1 DEPRECATED in adc-v2-dogfood (census)',
    'M6-1 success receipt',
    'definition archived')

writeFileSync(join(DIR, 'execution-command-ledger.tsv'),
  ['subject_id','sequence_no','command_family','operation','endpoint','method','authority_ref','server_side_role','expected_preimage','idempotency_anchor','success_receipt','expected_postimage','next_step_admission_condition']
    .join('\t') + '\n' +
  out.map(r => [r.subject_id,r.sequence_no,r.command_family,r.operation,r.endpoint,r.method,r.authority_ref,r.server_side_role,r.expected_preimage,r.idempotency_anchor,r.success_receipt,r.expected_postimage,r.next_step_admission_condition].map(v=>String(v).replace(/\t/g,' ')).join('\t')).join('\n') + '\n')

const mutationCommands = out.filter(r => !r.command_family.endsWith('_READBACK') && !r.operation.includes('(operation=plan)'))
const byFamily = {}
for (const r of mutationCommands) byFamily[r.command_family] = (byFamily[r.command_family]||0)+1
const summary = { totalRows: out.length, mutationCommands: mutationCommands.length, byFamily,
  note: 'read-only rows (M6_READBACK, reconcile plan) are verification steps, NOT production mutations' }
writeFileSync(join(DIR, 'execution-command-summary.json'), JSON.stringify(summary, null, 2) + '\n')
console.log(JSON.stringify(summary, null, 2))
