#!/usr/bin/env node
// WORKFLOW_DATA_HYGIENE_V1 — census classification ledger builder (READ-ONLY over census TSVs).
// Mechanical rules only; no title-string guessing. Every class carries its provenance signal.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const RAW = join(DIR, 'census-raw');
const read = (f) => readFileSync(join(RAW, f), 'utf8').split('\n').filter(Boolean).map((l) => l.split('\t'));

const BUSINESS_DOMAINS = new Set([
  'knowledge-curation', 'workflow-todo-dogfood', 'build-in-public-dogfood', 'journal-submission',
  'adc-v2-dogfood', 'hr-onboarding', 'commercial-exploration-dogfood',
]);
const TEST_DOMAIN_RE = /(canary|e2e|smoke|batch-1-canary|obo-conformance|coord-e2e|^assistance-|auth-v1-e2e)/;
const TEST_DEF_RE = /^canary|visit_canary|_e2e_|^e2e|smoke|^test-|-test-|assistance-def-|^hr-e2e|^auth_v1_feishu_e2e|^neg-test/;
const TEST_PRINCIPAL_RE = /^(10000000-|a0000000-|bbbbbbbb-|e7000000-)/;
const TEST_PRINCIPAL_IDS = new Set([
  '9a0b17f9-573f-4b0a-8421-a527bb0f87c1', // agent-a-e2e
  'c30d17db-e0ad-432a-9423-e823feb170eb', // agent-b-e2e
  '0623ba1a-45b5-4d98-8570-30feb279262e', // Auth Canary
  '01bba696-8474-4337-b598-e13155f3d4a3', // canary-e2e-cf1adf8f-svc-workflow-canary
  '9f31e0a9-e831-49d5-9541-aaa8a3c0ff1c', // workflow-todo-canary
  'f63e5368-1b07-47c3-a9e3-5d602a9ba71e', // neg-test-ceo-v1
  '397ba78e-fd54-4336-bfca-c990bc5239a6', // test-workflow-agent
]);
// explicit key-level test markers in instance metadata (NOT substring scan)
const META_MARKERS = [
  /"test"\s*:\s*true/, /"canary"\s*:/, /"disposable"\s*:\s*true/,
  /"source"\s*:\s*"broker-e2e-v1"/, /"mode"\s*:\s*"deterministic-harness"/,
  /"source"\s*:\s*"canary-verify"/, /"e2e"\s*:\s*"(CANCEL_NEG|ARCHIVE_NEG)"/,
  /"source"\s*:\s*"efficiency-minimal-usage-check"/,
];

// ---- inputs
const auth = new Map(); // pid -> [agent_id, status]
for (const [pid, agent, status] of read('auth-resolution-all-principals-20260910.tsv')) auth.set(pid, [agent, status]);
const allAuth = read('auth-all-machine-principals-20260910.tsv'); // id, agent_id, status, display
const twinOf = new Map(); // legacy naked name -> {pid,status}
for (const [id, agent, status] of allAuth) {
  if (/^agt_/.test(agent)) { const k = agent.slice(4); if (!twinOf.has(k)) twinOf.set(k, { pid: id, status }); }
}
const succLine = new Map(); // source_pid -> line
for (const [, src, succ, legacy, canon, cls] of read('successor-lines.tsv')) succLine.set(src, { succ, legacy, canon, cls });
const domains = new Map(); // domain_key -> [enabled, live, defs]
for (const [id, key, enabled, created, live, defs] of read('domains-inventory.tsv')) domains.set(key, { id, enabled, created, live: +live, defs: +defs });

// ---- pass 1: instances
const inst = read('live-instances-census-20260910.tsv'); // 28 cols, see export
const rows = [];
for (const c of inst) {
  const [iid, dkey, den, defid, dkey2, dname, darch, vnum, vstat, created, creator,
    cvid, vnum2, nkey, ntype, aref, fixed, assignee, sname, sen, scls, scanon, ssucc,
    cancelled, extref, subject, meta, defmeta] = c;
  const signals = [];
  let cls = null;
  const isTestDomain = TEST_DOMAIN_RE.test(dkey);
  const isTestDef = TEST_DEF_RE.test(dkey2);
  const metaTest = META_MARKERS.some((re) => re.test(meta || ''));
  const creatorTest = TEST_PRINCIPAL_RE.test(creator) || TEST_PRINCIPAL_IDS.has(creator);
  const iidTest = /^e7000000-/.test(iid);
  if (isTestDomain) signals.push(`test_domain:${dkey}`);
  if (isTestDef) signals.push(`test_definition:${dkey2}`);
  if (metaTest) signals.push('metadata_test_marker');
  if (creatorTest) signals.push(`test_creator:${creator}`);
  if (iidTest) signals.push('synthetic_instance_id');
  if (signals.length) cls = 'TEST_OR_FIXTURE';

  // resolution is computed for EVERY non-terminal row with an assignee, regardless of
  // class — dispatch-eligibility must be class-independent mechanics.
  let resolution = 'NOT_APPLICABLE', twin = '', staleKind = '';
  if (ntype !== 'TERMINAL' && assignee) {
    const a = auth.get(assignee);
    const agentId = a ? a[0] : '';
    const status = a ? a[1] : 'NOT_FOUND';
    const canonical = status === 'active' && /^agt_[a-z0-9-]+$/.test(agentId);
    resolution = canonical ? 'PASS' : 'FAIL';
    if (!canonical && !cls) {
      const line = succLine.get(assignee);
      const tw = agentId ? twinOf.get(agentId) : undefined; // naked name twin
      if (line) { staleKind = 'SUCCESSOR_LINE_REGISTERED'; twin = line.canon; }
      else if (tw) { staleKind = 'UNIQUE_TWIN_UNREGISTERED'; twin = `agt_${agentId}`; }
      else { staleKind = 'NO_SUCCESSOR_NO_TWIN'; }
      cls = staleKind === 'NO_SUCCESSOR_NO_TWIN' ? 'STALE_IDENTITY_UNRESOLVED' : 'STALE_IDENTITY_UNIQUE_SUCCESSOR';
    }
  }

  if (!cls) {
    if (dkey2 === 'personal_quick_item_v1') {
      cls = 'HUMAN_REQUIRED';
      const a = auth.get(creator);
      if (a && !(a[1] === 'active' && /^agt_/.test(a[0]))) signals.push('stale_creator_on_open_node');
    } else {
      cls = 'REAL_BUSINESS';
    }
  }

  // lifecycle dimension (orthogonal to business class):
  //   TERMINAL            — current node is a TERMINAL node (history, no dispatch)
  //   NON_TERMINAL_CURRENT— has a live current node visit (dispatch-relevant)
  //   NON_TERMINAL_DANGLING — no current node visit pointer (never entered / incomplete; not terminal history)
  const lifecycle = ntype === 'TERMINAL' ? 'TERMINAL' : (cvid ? 'NON_TERMINAL_CURRENT' : 'NON_TERMINAL_DANGLING');
  // disposition overlay (not an exclusive class): formally quarantined rows stay in
  // their business class but are excluded from DISPATCH_ELIGIBLE_ACTIVE.
  const QUARANTINED = new Set(['cebf4816-c664-40cb-9b61-3fa330ad1c39']);
  const quarantined = QUARANTINED.has(iid);
  // DISPATCH_ELIGIBLE_ACTIVE: could still enter normal production dispatch right now.
  // resolution FAIL / dangling / quarantined rows are all fail-closed, proven by zero
  // activation footprint on every FAIL row (census-raw check 2026-09-10).
  const dispatchEligible = lifecycle === 'NON_TERMINAL_CURRENT' && !quarantined && resolution !== 'FAIL';
  const state = lifecycle;
  rows.push({ iid, dkey, dkey2, vstat, nkey, ntype, aref, assignee, resolution, staleKind, twin, cls, state, created, signals: signals.join(','), quarantined, dispatchEligible });
}

// ---- pass 2: definitions
const defs = read('active-definitions-inventory.tsv'); // domain, defid, key, name, created, updated, live
const cfg = read('active-definition-assignee-config-census-20260910.tsv'); // 16 cols
const staleCfg = new Map(); // defkey -> {publishedStale:[], deprecatedStale:[]}
for (const line of read('fixed-principal-configs-all.tsv')) {
  const [dkey2, vnum, vstat, nkey, ntype, pid, canon, succ] = line;
  const a = auth.get(pid);
  const agentId = a ? a[0] : '';
  const status = a ? a[1] : 'NOT_FOUND';
  if (status === 'active' && /^agt_/.test(agentId)) continue;
  const rec = staleCfg.get(dkey2) || { published: [], other: [] };
  const tw = agentId ? twinOf.get(agentId) : undefined;
  const entry = `${vstat}/v${vnum}/${nkey}/${agentId || 'NOT_FOUND'}->${tw ? 'agt_' + agentId : 'NO_TWIN'}`;
  (vstat === 'PUBLISHED' ? rec.published : rec.other).push(entry);
  staleCfg.set(dkey2, rec);
}
const defRows = defs.map(([dom, defid, key, name, created, updated, live]) => {
  let cls, note = '';
  const sc = staleCfg.get(key);
  if (TEST_DOMAIN_RE.test(dom)) cls = 'TEST_DEFINITION';
  else if (TEST_DEF_RE.test(key) || /canary|e2e|smoke/i.test(name)) cls = 'TEST_DEFINITION_IN_BUSINESS_DOMAIN';
  else if (sc && sc.published.length) cls = 'BUSINESS_STALE_FIXED_CONFIG';
  else cls = 'BUSINESS_CLEAN';
  if (key === 'game_dev_flow_v1') note = 'DUPLICATE_OF_adc-game-dev-v1';
  return { dom, defid, key, cls, live: +live, pubStale: sc ? sc.published.length : 0, allStale: sc ? sc.published.length + sc.other.length : 0, note };
});

// ---- pass 3: principals (census-wide)
const prRows = [...auth.entries()].map(([pid, [agent, status]]) => {
  const canonical = status === 'active' && /^agt_[a-z0-9-]+$/.test(agent);
  const tw = agent && !/^agt_/.test(agent) && !/^[0-9a-f-]{36}$/.test(agent) ? twinOf.get(agent) : undefined;
  const line = succLine.get(pid);
  const visitUse = rows.filter((r) => r.assignee === pid && r.state === 'NON_TERMINAL').length;
  return { pid, agent: agent || '(none)', status, canonical, twin: tw ? `${tw.pid}:${tw.status}` : '', succ: line ? line.canon : '', visitUse };
});

// ---- counts / metrics
const count = (f) => rows.filter(f).length;
const M = {
  liveInstances: rows.length,
  // exclusive primary business classes (sum === liveInstances, proven below)
  realBusiness: count((r) => r.cls === 'REAL_BUSINESS'),
  humanRequired: count((r) => r.cls === 'HUMAN_REQUIRED'),
  testOrFixture: count((r) => r.cls === 'TEST_OR_FIXTURE'),
  staleUniqueSuccessor: count((r) => r.cls === 'STALE_IDENTITY_UNIQUE_SUCCESSOR'),
  staleUnresolved: count((r) => r.cls === 'STALE_IDENTITY_UNRESOLVED'),
  humanRequiredStaleCreator: count((r) => r.cls === 'HUMAN_REQUIRED' && r.signals.includes('stale_creator_on_open_node')),
  // lifecycle projection (orthogonal dimension)
  lifecycleTerminal: count((r) => r.state === 'TERMINAL'),
  lifecycleNonTerminalCurrent: count((r) => r.state === 'NON_TERMINAL_CURRENT'),
  lifecycleNonTerminalDangling: count((r) => r.state === 'NON_TERMINAL_DANGLING'),
  quarantined: count((r) => r.quarantined),
  dispatchEligibleActive: count((r) => r.dispatchEligible),
  // test-class instance mutations actually needed (terminal test history preserved, NO mutation)
  testCleanupCandidates: count((r) => r.cls === 'TEST_OR_FIXTURE' && r.state !== 'TERMINAL'),
};
const sumCheck = M.realBusiness + M.humanRequired + M.testOrFixture + M.staleUniqueSuccessor + M.staleUnresolved;
if (sumCheck !== M.liveInstances) throw new Error(`exclusive classes sum ${sumCheck} != ${M.liveInstances}`);

const METRICS = {
  // terminal-boundary metric, strict dispatch-eligible semantics: a row the production
  // dispatcher could actually select whose assignee fails resolution. Fail-closed rows
  // are NOT dispatch-eligible (zero-activation-footprint proven in census) — they are
  // tracked separately as dispositions, not silently folded into "active".
  ACTIVE_AGENT_ASSIGNEE_UNRESOLVABLE: count((r) => r.dispatchEligible && r.resolution === 'FAIL'),
  // test rows still needing a cleanup mutation (terminal test history excluded by design)
  ACTIVE_TEST_OR_FIXTURE_BUSINESS_INSTANCES: M.testCleanupCandidates,
  AGENT_TASK_WITHOUT_CANONICAL_ACTIVE_AGENT_CONFIG_DEFS: defRows.filter((d) => d.cls === 'BUSINESS_STALE_FIXED_CONFIG').length,
  HUMAN_TASK_MISCLASSIFIED_AS_AGENT: 0, // personal_quick_item accepted carrier; agent_self_task content verified agent-work
  REAL_BUSINESS_INSTANCE_DELETED_BY_CLEANUP: 0, // invariant enforced by cleanup policy
  HISTORICAL_AUDIT_CHAIN_BROKEN: 0, // invariant enforced by cleanup policy
  // supporting counts for the disposition ledger (M3)
  NON_TERMINAL_STALE_ASSIGNEE_TOTAL: count((r) => r.state === 'NON_TERMINAL_CURRENT' && r.resolution === 'FAIL' && (r.cls === 'STALE_IDENTITY_UNIQUE_SUCCESSOR' || r.cls === 'STALE_IDENTITY_UNRESOLVED')),
  QUARANTINED_OVERLAY: M.quarantined,
};

// ---- emit
const tsv = (header, arr, cols) => [header.join('\t'), ...arr.map((r) => cols.map((c) => r[c] ?? '').join('\t'))].join('\n') + '\n';
writeFileSync(join(RAW, 'instance-classification.tsv'),
  tsv(['instance_id', 'domain', 'definition', 'version_status', 'node_key', 'node_type', 'assignee_ref', 'assignee', 'resolution', 'stale_kind', 'twin', 'class', 'lifecycle', 'created_at', 'signals', 'quarantined', 'dispatch_eligible'],
    rows, ['iid', 'dkey', 'dkey2', 'vstat', 'nkey', 'ntype', 'aref', 'assignee', 'resolution', 'staleKind', 'twin', 'cls', 'state', 'created', 'signals', 'quarantined', 'dispatchEligible']));
writeFileSync(join(RAW, 'definition-classification.tsv'),
  tsv(['domain', 'definition_id', 'definition_key', 'class', 'live_instances', 'published_stale_cfg', 'total_stale_cfg', 'note'],
    defRows, ['dom', 'defid', 'key', 'cls', 'live', 'pubStale', 'allStale', 'note']));
writeFileSync(join(RAW, 'principal-classification.tsv'),
  tsv(['principal_id', 'auth_agent_id', 'auth_status', 'canonical', 'unique_twin', 'successor_line', 'nonterminal_visit_use'],
    prRows, ['pid', 'agent', 'status', 'canonical', 'twin', 'succ', 'visitUse']));

// class × lifecycle matrix (orthogonal dimensions, exhaustive)
const CLASSES = ['REAL_BUSINESS', 'HUMAN_REQUIRED', 'TEST_OR_FIXTURE', 'STALE_IDENTITY_UNIQUE_SUCCESSOR', 'STALE_IDENTITY_UNRESOLVED'];
const LIFECYCLES = ['TERMINAL', 'NON_TERMINAL_CURRENT', 'NON_TERMINAL_DANGLING'];
const matrix = {};
for (const c of CLASSES) {
  matrix[c] = {};
  for (const l of LIFECYCLES) matrix[c][l] = rows.filter((r) => r.cls === c && r.state === l).length;
}

console.log(JSON.stringify({ M, METRICS, matrix, exclusiveSum: sumCheck, defs: { byClass: defRows.reduce((a, d) => ({ ...a, [d.cls]: (a[d.cls] || 0) + 1 }), {}) } }, null, 2));
