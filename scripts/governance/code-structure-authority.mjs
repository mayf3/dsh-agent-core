import { createHash } from 'node:crypto';

export const V2 = 'CODE_STRUCTURE_GUARDRAILS_V2';
export const V3 = 'CODE_STRUCTURE_GUARDRAILS_V3';
export const TE = 'CODE_STRUCTURE_GUARDRAILS_V3_TRANSITION_EXCEPTION_V1';
export const authorityPaths = {
  v2: `.agents/local/${V2}.md`,
  v3: `.agents/local/${V3}.md`,
  te: `docs/specs/${TE}.md`,
  contract: 'docs/specs/CODE_STRUCTURE_VERIFIER_CONFORMANCE_V1.md',
};
const carriedHashes = {
  V2_POLICY: '34a8d8d8fe23c12f82a8ab302faca2d0df668084abd8ac8b110d3ab878cc65e7',
  TE_CONTRACTS: '6a57bd485b76eabe0c3656fb85c6ce09968dcd12e09064036475545beb8e8b87',
};

// Deliberately bounded to the native authorities' plain scalars and lists.
// Unsupported YAML, duplicate fields and missing values are unknown, not truthy.
function front(raw, stop) {
  const header = raw?.match(/^---\n([\s\S]*?)\n---(?:\n|$)/)?.[1];
  if (!header) stop('authority missing real YAML frontmatter');
  const fields = new Map();
  let list = null;
  for (const line of header.split('\n')) {
    if (line.startsWith('  - ') && list) {
      fields.get(list).push(line.slice(4));
      continue;
    }
    const item = line.match(/^([a-z_]+):(?: (.+))?$/);
    if (!item || fields.has(item[1])) stop('malformed or duplicate authority metadata');
    const [, key, value] = item;
    list = value === undefined ? key : null;
    fields.set(key, list ? [] : value === '[]' ? [] : value);
  }
  return fields;
}

function native(raw, stop) {
  const header = raw?.match(/^# [^\n]+\n\n```text\n([\s\S]*?)\n```/)?.[1];
  if (!header) stop('V2 authority missing native fenced metadata');
  const fields = new Map();
  for (const line of header.split('\n')) {
    const item = line.match(/^([A-Z_]+) = (.+)$/);
    if (!item || fields.has(item[1])) stop('malformed or duplicate V2 native metadata');
    fields.set(item[1], item[2]);
  }
  return fields;
}

function carried(raw, kind, stop) {
  const start = `<!-- BEGIN CARRIED_${kind} -->\n`, end = `<!-- END CARRIED_${kind} -->`;
  if (raw.split(start).length !== 2 || raw.split(end).length !== 2)
    stop(`missing or duplicate V3 carried block: ${kind}`);
  const block = raw.split(start)[1].split(end)[0];
  if (createHash('sha256').update(block).digest('hex') !== carriedHashes[kind])
    stop(`V3 carried policy drift: ${kind}`);
}

export function structureAuthorityAt(ref, readAt, stop) {
  const read = (key) => readAt(ref, authorityPaths[key]);
  const rule = read('v2'), old = native(rule, stop);
  if (old.get('RULE_ID') !== V2) stop('V2 authority identity invalid');
  const successor = read('v3'), current = successor === null ? null : front(successor, stop);
  const supplement = read('te'), te = supplement === null ? null : front(supplement, stop);
  const contract = front(read('contract'), stop);
  if (contract.get('spec_id') !== 'CODE_STRUCTURE_VERIFIER_CONFORMANCE_V1'
      || contract.get('status') !== 'accepted'
      || contract.get('authority_level') !== 'governing_spec'
      || contract.get('implementation_authority') !== 'contracts')
    stop('accepted verifier conformance Spec missing at comparison coordinate');
  if (current && !['accepted', 'proposed'].includes(current.get('status')))
    stop('unknown V3 authority lifecycle');
  if (old.get('LIFECYCLE') === 'ACCEPTED' && current?.get('status') !== 'accepted') {
    if (old.has('SUPERSEDED_BY')) stop('accepted V2 has a successor backlink');
    if (te && (te.get('spec_id') !== TE || !['accepted', 'proposed'].includes(te.get('status'))))
      stop('unknown transition authority identity or lifecycle');
    return { id: V2, path: authorityPaths.v2, policy: rule,
      transitionPath: te?.get('status') === 'accepted' ? authorityPaths.te : null };
  }
  if (!current || current.get('status') !== 'accepted') stop('V3 or V2 authority not accepted');
  const expected = {
    spec_id: V3, spec_kind: 'invariant', authority_level: 'repository_local_rule',
    implementation_authority: 'none', production_apply_authority: 'none',
    superseded_by: 'null', accepted_by: 'mayf3', accepted_date: '2026-11-07',
    accepted_reviewed_semantic_head: '7f36750bf08d308cd7f648153e24c0b0e528e4c6',
    acceptance_authority: 'https://github.com/mayf3/dsh-agent-core/pull/642#issuecomment-6701500077',
    acceptance_ruling_id: 'owner-20261107-642-643-1377',
  };
  for (const [key, value] of Object.entries(expected))
    if (current.get(key) !== value) stop(`invalid V3 accepted authority metadata: ${key}`);
  if (JSON.stringify(current.get('supersedes')) !== JSON.stringify([V2, TE]))
    stop('V3 reciprocal predecessor set invalid');
  if (old.get('LIFECYCLE') !== 'SUPERSEDED' || old.get('SUPERSEDED_BY') !== V3
      || !old.get('SUPERSEDES')?.startsWith('CODE_STRUCTURE_GUARDRAILS_V1 '))
    stop('V2 retirement or reciprocal backlink invalid');
  if (!te || te.get('spec_id') !== TE || te.get('status') !== 'superseded'
      || te.get('superseded_by') !== V3 || JSON.stringify(te.get('supersedes')) !== '[]')
    stop('TE retirement or reciprocal backlink invalid');
  const history = readAt(ref, '.agents/local/CODE_STRUCTURE_GUARDRAILS_V1.md');
  if (!history?.includes('\nSUPERSEDED_BY = CODE_STRUCTURE_GUARDRAILS_V2\n'))
    stop('V1 to V2 historical backlink missing');
  for (const kind of Object.keys(carriedHashes)) carried(successor, kind, stop);
  return { id: V3, path: authorityPaths.v3, policy: successor, transitionPath: authorityPaths.v3 };
}

export function compareAuthorities(base, head, readAt, stop) {
  const before = structureAuthorityAt(base, readAt, stop), after = structureAuthorityAt(head, readAt, stop);
  if (before.id !== after.id) stop('candidate cannot activate or replace comparison-base authority');
  if (before.id === V3) {
    for (const key of ['v2', 'v3', 'te'])
      if (readAt(base, authorityPaths[key]) !== readAt(head, authorityPaths[key]))
        stop(`active V3 authority chain changed between base and head: ${key}`);
  }
  return { before, after };
}
