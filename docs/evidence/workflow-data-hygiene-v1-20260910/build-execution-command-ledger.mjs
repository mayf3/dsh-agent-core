#!/usr/bin/env node
// WORKFLOW_DATA_HYGIENE_V1 r3 — EXECUTION_COMMAND_LEDGER builder (mechanical derivation, READ-ONLY).
// r3 (Owner REVISE_ON_NEW_EVIDENCE B1–B7 applied). Changes vs r2:
//   B1: M1 split — M1A = 8 ordinary cancels (NON_TERMINAL_CURRENT, cancel precondition met);
//       M1B = 4 NON_TERMINAL_DANGLING rows (NULL current visit => InternalConsistency('instance has no current node visit') at 6dc1027 cancel_transaction.rs:318; archive =>
//       InstanceNotTerminal; admin_recovery/admin_repair application functions have NO HTTP
//       route) => NO_MUTATION_DISPOSITION pending NARROW_ONE_TIME_AUTHORITY vs
//       EXPLICIT_PRESERVE_QUARANTINE (M1B_MUTATION_SEQUENCE = UNRESOLVED, HOLD).
//   B3: M2 split — M2A_CANONICAL = 24 subjects x 3 authoring commands (READY);
//       M2B agent_self_task_v1 = IDENTITY_BLOCKED (auth exact-resolution census: principal
//       b6b033c4-90ba-40aa-a338-304da442cab7 "龙虾合伙人" active with NO canonical Agent
//       mapping => RETURNS_NO_PROVEN_SUCCESSOR; IDENTITY_MAPPING_GUESS = FORBIDDEN)
//       => DEPENDENCY_GATED, sequence NOT started (ZERO commands).
//   B5: M6 minimality — M6-1 retained (business-domain canonical CTO repair, independently
//       justified); M6-2..9 OWNER TAKEOVER REMOVED (deployed svc cancel/archive is
//       implemented+deployed at 6dc1027 (cancel_transaction.rs:280-293 W-widening: DOMAIN_OWNER OR enabled GLOBAL_WORKFLOW_COORDINATOR); the outstanding dependency is the
//       W1/W2 widening to `DOMAIN_OWNER OR GLOBAL_WORKFLOW_COORDINATOR` is not yet deployed,
//       so M1A cancels are DEPENDENCY_GATED on that deployment; per-row removal reasons below).
// B6: every row carries mutation_class = READY | DEPENDENCY_GATED | NO_MUTATION_DISPOSITION.
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = dirname(fileURLToPath(import.meta.url))
const RAW = join(DIR, 'census-raw')
const out = []
const cmd = (mutation_class, class_reason, subject, seq, command_family, operation, endpoint, method, authority, role, preimage, admission, postimage) =>
  out.push({ subject_id: subject, sequence_no: seq, command_family, mutation_class, class_reason, operation, endpoint, method,
             authority_ref: authority, server_side_role: role, expected_preimage: preimage,
             idempotency_anchor: 'fresh Idempotency-Key per command (trusted transport seam; model-inaccessible)',
             success_receipt: 'workflow_command_receipts + security audit row (per svc contract)',
             expected_postimage: postimage, next_step_admission_condition: admission })
const disposition = (subject, command_family, class_reason, detail, mutation_class = 'NO_MUTATION_DISPOSITION') =>
  out.push({ subject_id: subject, sequence_no: 0, command_family, mutation_class, class_reason,
             operation: 'none (disposition record — no executable sequence authorized by this plan)',
             endpoint: '-', method: '-', authority_ref: '-', server_side_role: '-',
             expected_preimage: detail, idempotency_anchor: '-',
             success_receipt: '-', expected_postimage: 'row unchanged; quarantined as documented test residue until a future authority decides', next_step_admission_condition: '-' })

const GATE_WIDENING = 'DEPENDENCY_GATED: GLOBAL_WORKFLOW_COORDINATOR five-gate grant bootstrap outstanding (4/5 gates passed, Owner packet outstanding) — the W-widening itself is implemented+deployed at 6dc1027 (cancel_transaction.rs:280-293: DOMAIN_OWNER OR enabled GLOBAL_WORKFLOW_COORDINATOR)'

// ---- M6: only M6-1 retained (B5). M6-2..9 removed — disposition records.
cmd('DEPENDENCY_GATED', 'LIVE_COORDINATOR_CONTROL_PLANE_READY = bootstrap grant packet outstanding (4/5 gates passed per coordinator goal record)',
  'M6-1', 1, 'M6_BINDING_RECONCILE', 'workflow_domain_binding_reconcile(operation=plan)',
  'POST /internal/v1/domains/22222222-0000-0000-0000-000000000100/binding-reconcile/plan', 'POST',
  'SVC_WORKFLOW_COORDINATOR_CONTROL_PLANE_V1 (accepted)', 'GLOBAL_WORKFLOW_COORDINATOR (server-side)',
  'binding-rows-for-plan.tsv: ab05acde-524f-40b4-a904-eb8882db791b enabled=TRUE role=DOMAIN_OWNER principal=3e2439d2-fb54-44f5-afee-77aa17c40d22',
  'verification only — READ-ONLY, not a mutation command; blockers[] must be empty',
  'plan JSON: sourceBindingExists=true sourceBindingEnabled=true singleOwnerInvariantOk=true')
cmd('DEPENDENCY_GATED', 'LIVE_COORDINATOR_CONTROL_PLANE_READY = bootstrap grant packet outstanding',
  'M6-1', 2, 'M6_BINDING_RECONCILE', 'workflow_domain_binding_reconcile(operation=apply, role=DOMAIN_OWNER)',
  'POST /internal/v1/domains/22222222-0000-0000-0000-000000000100/binding-reconcile/apply', 'POST',
  'SVC_WORKFLOW_COORDINATOR_CONTROL_PLANE_V1 (accepted)', 'GLOBAL_WORKFLOW_COORDINATOR (server-side)',
  'in-tx re-assert: binding_id=ab05acde-524f-40b4-a904-eb8882db791b still enabled, role=DOMAIN_OWNER, principal=3e2439d2-fb54-44f5-afee-77aa17c40d22',
  'M6-1-1 plan admission = blockers empty',
  'outcome=applied; old binding enabled=false; exactly one enabled DOMAIN_OWNER = 4e5a4578 (agt_cto-agent); audit rationale=CANONICAL_TWIN_REPAIR')
cmd('DEPENDENCY_GATED', 'read-back of M6-1-2',
  'M6-1', 3, 'M6_READBACK', 'workflow_domain_admin(operation=get_owner)',
  'GET /internal/v1/domains/22222222-0000-0000-0000-000000000100/owner', 'GET',
  'SVC_WORKFLOW_COORDINATOR_CONTROL_PLANE_V1 (accepted)', 'GLOBAL_WORKFLOW_COORDINATOR or own enabled DOMAIN_OWNER',
  'M6-1-2 outcome=applied', 'M6-1-2 success receipt',
  'ownerPrincipalId=4e5a4578-0645-4133-bd35-b80e453dfee9 ownerEnabled=true')

// M6-2..9: OWNER TAKEOVER REMOVED (B5) — zero-mutation disposition records with per-row reasons
const m6removed = [
  ['M6-2','canary-wda-v1-1788583811','UNLOCK_ONLY: sole purpose was DOMAIN_OWNER for M1-6 cancel; M1A cancels are DEPENDENCY_GATED on the coordinator W1/W2 widening instead; post-cleanup the domain holds no governed state (disposable residue)'],
  ['M6-3','canary-wda-v1-1788583998','UNLOCK_ONLY: same as M6-2 (M1-7); domain = disposable residue post-cleanup'],
  ['M6-4','canary-wda-v1-1788584903','UNLOCK_ONLY: same as M6-2 (M1-8); domain = disposable residue post-cleanup'],
  ['M6-5','assistance-5148b565-…','UNLOCK_ONLY: dead-owner binding; sole purpose was DOMAIN_OWNER for M1-3/M1-4 cancel — coordinator W1 cancel covers it once deployed; dead-owner rows persist enabled=false-capable as DEC-CP-007 repairable input for any future authority'],
  ['M6-6','assistance-74a028b0-…','UNLOCK_ONLY: same as M6-5 (M1-5)'],
  ['M6-7','assistance-1853d6d7-…','UNLOCK_ONLY: same as M6-5 (M1-1/M1-2)'],
  ['M6-8','canary-e2e-1784457448','NO_EXECUTABLE_CLEANUP: ownerless e2e domain whose only hygiene rows are M1-9/M1-10 (NON_TERMINAL_DANGLING — no reachable mutation surface exists at any ownership level; see B1 census)'],
  ['M6-9','auth-v1-e2e-readonly','NO_EXECUTABLE_CLEANUP: ownerless e2e domain whose only hygiene rows are M1-11/M1-12 (NON_TERMINAL_DANGLING — same B1 census)'],
]
for (const [sid, dom, reason] of m6removed) {
  disposition(sid, 'M6_TAKEOVER_REMOVED', 'REMOVE_FROM_PLAN per Owner B5 minimality ruling: ' + reason,
    `census: ${dom} — takeover operation removed from plan; binding/domain rows untouched and preserved as history`)
}

// ---- M1A: 8 ordinary cancels — DEPENDENCY_GATED on coordinator W1/W2 widening
const m1a = [
  ['M1-1','8507658d-b5ab-44bc-83f0-afc97b5fd56c'],['M1-2','6671fdb5-eb42-4044-b2e5-4a284c657f91'],
  ['M1-3','f5de0535-e448-4cdf-b5ab-9d94843e97cb'],['M1-4','0ce9924d-6f9f-4b30-a838-04644a06d396'],
  ['M1-5','c692ec90-6392-4ec0-bea1-749e83d340cf'],['M1-6','5fe7570a-dc15-43ae-b5c5-950692951aa3'],
  ['M1-7','5538dca9-9c19-46f9-83ef-41824c7468d8'],['M1-8','9fd262ec-8906-4cbc-8a3f-1ef2321d9715'],
]
for (const [sid, iid] of m1a) {
  cmd('DEPENDENCY_GATED', GATE_WIDENING, sid, 1, 'M1A_TEST_CANCEL', 'workflow_execute(operation=cancel_instance)',
      `POST /internal/v1/workflow-instances/${iid}/cancel`, 'POST',
      'SVC_WORKFLOW_COORDINATOR_CONTROL_PLANE_V1 (accepted W1 widening) — GLOBAL_WORKFLOW_COORDINATOR cross-domain cancel',
      'GLOBAL_WORKFLOW_COORDINATOR (server-side, once W1/W2 deployed)',
      `census row: ${iid} cancelled=false archived_at=null current_node_visit present; class=TEST_OR_FIXTURE with mechanical signals`,
      'coordinator W1/W2 cancel widening DEPLOYED in the live svc generation AND AUTH_V1_CANARY_WRITE_ENABLED=true AND G2 admission gate (§5)',
      'cancelled=true; exactly one CANCEL event; history/context/visits preserved; exits status=active surface')
}

// ---- M1B: 4 NON_TERMINAL_DANGLING — NO_MUTATION_DISPOSITION (B1 census outcome)
const m1b = [
  ['M1-9','91800cbc-6e6c-4b9d-a948-39d8fd271be4','canary-e2e-1784457448'],
  ['M1-10','8916aa79-22af-4be0-ab2c-fbb66a7ff3f2','canary-e2e-1784457448'],
  ['M1-11','e7000000-0000-4000-8000-00000000e001','auth-v1-e2e-readonly'],
  ['M1-12','e7000000-0000-4000-8000-00000000e002','auth-v1-e2e-readonly'],
]
for (const [sid, iid, dom] of m1b) {
  disposition(sid, 'M1B_DANGLING_DISPOSITION',
    'NARROW_ONE_TIME_AUTHORITY_REQUIRED (census 2026-09-11, taxonomy at 6dc1027: a NULL current visit fails cancel with InternalConsistency("instance has no current node visit") [cancel_transaction.rs:318]; archive => InstanceNotTerminal; admin_recovery/admin_repair application functions have NO HTTP route; direct DB edit FORBIDDEN). Alternative: EXPLICIT_PRESERVE_QUARANTINE. M1B_MUTATION_SEQUENCE = UNRESOLVED; M1B_PRODUCTION_MUTATION = HOLD',
    `census row: ${iid} in ${dom} — NON_TERMINAL_DANGLING, current_node_visit_id=NULL, TEST_OR_FIXTURE provenance proven (test_domain/test_creator/synthetic_instance_id signals)`)
}

// ---- M2: 24 READY canonical repairs + M2B identity-blocked (B3)
const defs = readFileSync(join(RAW, 'definition-classification.tsv'), 'utf8').split('\n').filter(Boolean).map(l => l.split('\t'))
const pubv = readFileSync(join(RAW, 'effective-published-versions.tsv'), 'utf8').split('\n').filter(Boolean).map(l => l.split('\t')) // HEADERLESS: row 0 is data, not a header
const publishedVersionId = new Map(pubv.map(r => [r[1], r[2]]))
const dh = defs[0]
const m2defs = defs.slice(1).filter(r => r[dh.indexOf('class')] === 'BUSINESS_STALE_FIXED_CONFIG')
  .map(r => [r[dh.indexOf('definition_key')], r[dh.indexOf('domain')], r[dh.indexOf('definition_id')]])
for (const [dkey, dom, defid] of m2defs) {
  const sid = `M2::${dkey}`
  const cls = dkey === 'agent_self_task_v1' ? 'DEPENDENCY_GATED' : 'READY'
  const reason = dkey === 'agent_self_task_v1'
    ? 'M2B IDENTITY_BLOCKED: auth exact-resolution census returns NO canonical Agent mapping for fixed-principal b6b033c4-90ba-40aa-a338-304da442cab7 (龙虾合伙人, active) => RETURNS_NO_PROVEN_SUCCESSOR; IDENTITY_MAPPING_GUESS = FORBIDDEN; M2B_SEQUENCE_START = HOLD before command 1 (deferred to the normal provisioning authority that may later establish this principal\'s Agent identity)'
    : 'READY'
  if (cls === 'DEPENDENCY_GATED') {
    disposition(sid, 'M2B_IDENTITY_BLOCKED', reason,
    `census: ${dkey} in ${dom} (${defid}) — effective PUBLISHED version carries stale fixed-principal partner nodes referencing b6b033c4; graph/postimage regeneration is mechanically impossible without a proven identity and remains a separate future authority decision`,
    'DEPENDENCY_GATED')
    continue
  }
  cmd(cls, reason, sid, 1, 'M2_DEFINITION_REPAIR', 'workflow_definition_authoring(operation=create_draft_version)',
      `POST /internal/v1/domains/${dom}/definitions/${defid}/versions`, 'POST',
      'DOMAIN_OWNER(domain) — svc definition governance (WDA authoring surface)', 'DOMAIN_OWNER (server-side)',
      `effective-published-versions.tsv: ${dom}/${dkey} PUBLISHED version ${publishedVersionId.get(defid) || '<id per census>'} carries the stale fixed-principal config (classification ledger r2; substitution set = mechanical twin map, per-node values frozen in the draft request body)`,
      'G2 admission gate (§5)',
      `DRAFT created for ${dom}/${dkey} def ${defid}; semantic model preserved per source PUBLISHED graph ${publishedVersionId.get(defid) || ''}`)
  cmd(cls, reason, sid, 2, 'M2_DEFINITION_REPAIR', 'workflow_definition_authoring(operation=replace_draft_graph)',
      `PUT /internal/v1/domains/${dom}/definitions/${defid}/draft`, 'PUT',
      'DOMAIN_OWNER(domain) — svc definition governance', 'DOMAIN_OWNER (server-side)',
      `${sid}-1 draft exists; graph nodes/submissions mirror the PUBLISHED graph with legacy principals substituted by mechanical twin map`,
      `${sid}-1 success receipt`,
      'draft graph validated by svc canonical validator (publish separately)')
  cmd(cls, reason, sid, 3, 'M2_DEFINITION_REPAIR', 'workflow_definition_authoring(operation=publish_version)',
      `POST /internal/v1/domains/${dom}/definitions/${defid}/publish`, 'POST',
      'DOMAIN_OWNER(domain) — svc definition governance', 'DOMAIN_OWNER (server-side)',
      `${sid}-2 validated draft`,
      `${sid}-2 success receipt`,
      `new version PUBLISHED for ${dom}/${dkey} def ${defid} (version id per publish receipt; supersedes and retires PUBLISHED ${publishedVersionId.get(defid) || ''} from future materialization; historical versions immutable)`)
}

// ---- M2A: 2 definition archives
cmd('READY', 'dc702687 is DOMAIN_OWNER(hr-onboarding); no dependency', 'M2A-1', 1, 'M2A_TEST_DEF_ARCHIVE',
    'svc definition archive (governance metadata action)',
    'POST /internal/v1/domains/{domainId}/definitions/{defId}/archive', 'POST',
    'DOMAIN_OWNER(hr-onboarding) = dc702687', 'DOMAIN_OWNER (server-side)',
    'visit_canary_648a6b90-… PUBLISHED in hr-onboarding (census)',
    'AUTH_V1_CANARY_WRITE_ENABLED=true AND G2 admission gate (§5)',
    'definition archived (governance metadata; no history loss)')
cmd('DEPENDENCY_GATED', 'requires M6-1 (DOMAIN_OWNER(adc-v2-dogfood) = 4e5a4578 after canonical twin repair)', 'M2A-2', 1, 'M2A_TEST_DEF_ARCHIVE',
    'svc definition archive (governance metadata action)',
    'POST /internal/v1/domains/{domainId}/definitions/{defId}/archive', 'POST',
    'DOMAIN_OWNER(adc-v2-dogfood) = 4e5a4578 after M6-1', 'DOMAIN_OWNER (server-side)',
    'test-workflow-v1 DEPRECATED in adc-v2-dogfood (census)',
    'M6-1 success receipt',
    'definition archived')

writeFileSync(join(DIR, 'execution-command-ledger.tsv'),
  ['subject_id','sequence_no','command_family','mutation_class','class_reason','operation','endpoint','method','authority_ref','server_side_role','expected_preimage','idempotency_anchor','success_receipt','expected_postimage','next_step_admission_condition']
    .join('\t') + '\n' +
  out.map(r => [r.subject_id,r.sequence_no,r.command_family,r.mutation_class,r.class_reason,r.operation,r.endpoint,r.method,r.authority_ref,r.server_side_role,r.expected_preimage,r.idempotency_anchor,r.success_receipt,r.expected_postimage,r.next_step_admission_condition].map(v=>String(v).replace(/\t/g,' ')).join('\t')).join('\n') + '\n')

const READBACK = (r) => r.command_family.endsWith('_READBACK') || r.operation.includes('(operation=plan)')
const mutationCommands = out.filter(r => r.mutation_class !== 'NO_MUTATION_DISPOSITION' && !READBACK(r) && !r.operation.startsWith('none (disposition record'))
const ready = mutationCommands.filter(r => r.mutation_class === 'READY')
const gated = mutationCommands.filter(r => r.mutation_class === 'DEPENDENCY_GATED')
const noMut = out.filter(r => r.mutation_class === 'NO_MUTATION_DISPOSITION')
const subjectClass = {}
for (const r of out) {
  if (subjectClass[r.subject_id] === undefined) subjectClass[r.subject_id] = r.mutation_class
  else if (subjectClass[r.subject_id] !== r.mutation_class) throw new Error(`subject ${r.subject_id} has conflicting mutation classes: ${subjectClass[r.subject_id]} vs ${r.mutation_class}`)
}
const subjectClasses = {}
for (const cls of Object.values(subjectClass)) subjectClasses[cls] = (subjectClasses[cls] || 0) + 1
const m1aIds = new Set(m1a.map(([sid]) => sid))
const unresolvedSubjects = Object.keys(subjectClass).filter(sid => (/^M1-/.test(sid) && !m1aIds.has(sid)) || sid === 'M2::agent_self_task_v1')
const summary = {
  totalRows: out.length,
  mutationCommands: mutationCommands.length,
  byFamily: Object.fromEntries(Object.entries(mutationCommands.reduce((a, r) => (a[r.command_family] = (a[r.command_family]||0)+1, a), {})).sort()),
  CLEANUP_TARGET_SUBJECTS: 48,
  DISPOSITION_ONLY_SUBJECTS: 6,
  TOTAL_TRACKED_HYGIENE_SUBJECTS: 54,
  READY_MUTATION_SUBJECTS: subjectClasses.READY || 0,
  DEPENDENCY_GATED_SUBJECTS: subjectClasses.DEPENDENCY_GATED || 0,
  NO_MUTATION_SUBJECTS: subjectClasses.NO_MUTATION_DISPOSITION || 0,
  TOTAL_READY_MUTATION_COMMANDS: ready.length,
  TOTAL_GATED_MUTATION_COMMANDS: gated.length,
  UNRESOLVED_SUBJECTS: unresolvedSubjects,
  FINAL_TOTAL_MUTATION_COMMANDS: unresolvedSubjects.length === 0 ? ready.length + gated.length : `UNRESOLVED (${unresolvedSubjects.length} subjects pending exact legal sequence: ${unresolvedSubjects.join(', ')})`,
  note: 'read-only rows (M6_READBACK, reconcile plan) are verification steps, NOT production mutations; NO_MUTATION_DISPOSITION rows are disposition records with zero commands'
}
writeFileSync(join(DIR, 'execution-command-summary.json'), JSON.stringify(summary, null, 2) + '\n')
console.log(JSON.stringify(summary, null, 2))
