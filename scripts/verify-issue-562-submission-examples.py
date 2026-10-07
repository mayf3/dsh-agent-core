#!/usr/bin/env python3
"""Issue #562 delivery verification — 16 legal/illegal submission examples
against the CAPTURED pipe args (what the gateway actually received), plus the
graph-shape checks from the original local validate-shopping-definition.py.

The captured args file is produced by
scripts/verify-issue-562-authoring-file-entry.mjs
(sh562-pipe-gateway-captured-args.json) and is deep-equal to the local
arguments file by construction; this script independently re-proves the
business acceptance: 16 legal submissions validate, the illegal families
(approval impersonating purchase / partial purchase / missing human proof /
decision-as-purchase) stay rejected, and the DRAFT head stays WORKFLOW_CREATOR.

Usage:
  python3 scripts/verify-issue-562-submission-examples.py \
    --captured-args sh562-pipe-gateway-captured-args.json \
    --out sh562-pipe-submission-example-validation.json
"""

import argparse
import copy
import json
import uuid

from jsonschema import Draft202012Validator


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--captured-args', required=True)
    parser.add_argument('--out', required=True)
    opts = parser.parse_args()

    graph = json.load(open(opts.captured_args))
    checks = []

    def check(name: str, ok: bool, detail: str = '') -> None:
        checks.append({'check': name, 'passed': bool(ok), 'detail': detail})
        assert ok, f'{name}: {detail}'

    nodes = graph['nodes']
    transitions = graph['transitions']
    node_by_key = {n['node_key']: n for n in nodes}
    transition_by_key = {t['transition_key']: t for t in transitions}

    check('captured_graph_complete', len(nodes) == 10 and len(transitions) == 16,
          f'nodes={len(nodes)} transitions={len(transitions)}')
    check('unique_keys_and_order',
          len(node_by_key) == len(nodes) and len(transition_by_key) == len(transitions)
          and len({n['order_index'] for n in nodes}) == len(nodes))
    check('one_draft', sum(n['node_type'] == 'DRAFT' for n in nodes) == 1)
    check('three_distinct_terminal_outcomes',
          {n['node_key'] for n in nodes if n['node_type'] == 'TERMINAL'}
          == {'purchased', 'cancelled', 'deferred'})
    for n in nodes:
        if n['node_type'] == 'TERMINAL':
            check(f'terminal_{n["node_key"]}',
                  not any(t['source_node_key'] == n['node_key'] for t in transitions)
                  and 'assignee_ref_type' not in n and 'primary_advance_transition_key' not in n)
        elif n['node_type'] == 'DRAFT':
            # #562 acceptance: the DRAFT head must stay WORKFLOW_CREATOR,
            # never FIXED_PRINCIPAL.
            check('draft_workflow_creator',
                  n['assignee_ref_type'] == 'WORKFLOW_CREATOR'
                  and 'fixed_principal_id' not in n and 'assignee_input_key' not in n)
        else:
            uuid.UUID(n['fixed_principal_id'])
            primary = transition_by_key[n['primary_advance_transition_key']]
            check(f'primary_{n["node_key"]}',
                  primary['source_node_key'] == n['node_key']
                  and primary['transition_effect'] == 'ADVANCE'
                  and node_by_key[primary['target_node_key']]['order_index'] > n['order_index'])
    for t in transitions:
        src, dst = t['source_node_key'], t['target_node_key']
        check(f'refs_{t["transition_key"]}', src in node_by_key and dst in node_by_key and src != dst)
        if t['transition_effect'] == 'RETURN':
            check(f'return_{t["transition_key"]}',
                  node_by_key[dst]['node_type'] != 'TERMINAL'
                  and node_by_key[dst]['order_index'] < node_by_key[src]['order_index'])
        if t['transition_effect'] == 'TERMINATE':
            check(f'terminate_{t["transition_key"]}',
                  node_by_key[dst]['node_type'] == 'TERMINAL'
                  and node_by_key[src]['primary_advance_transition_key'] != t['transition_key'])
        Draft202012Validator.check_schema(t['submission_schema'])
    Draft202012Validator.check_schema(graph['contextSchema'])
    check('all_json_schemas_valid', True)

    seen: set[str] = set()
    todo = ['requirements']
    while todo:
        key = todo.pop()
        if key in seen:
            continue
        seen.add(key)
        todo.extend(t['target_node_key'] for t in transitions if t['source_node_key'] == key)
    check('all_nodes_reachable', seen == set(node_by_key))

    seen = set()
    key = 'requirements'
    while node_by_key[key]['node_type'] != 'TERMINAL':
        check(f'primary_acyclic_{key}', key not in seen)
        seen.add(key)
        key = transition_by_key[node_by_key[key]['primary_advance_transition_key']]['target_node_key']
    check('primary_ends_purchased', key == 'purchased')

    def sample(schema):
        if 'const' in schema:
            return schema['const']
        if 'enum' in schema:
            return schema['enum'][0]
        if schema.get('type') == 'object':
            return {k: sample(v) for k, v in schema['properties'].items()}
        if schema.get('type') == 'array':
            return [sample(schema['items'])]
        if schema.get('type') == 'boolean':
            return True
        if schema.get('type') in ('number', 'integer'):
            return max(schema.get('minimum', 0), 1)
        return 'example_reference'

    # 16 legal submissions — one per transition, sampled from its schema.
    samples = {t['transition_key']: sample(t['submission_schema']) for t in transitions}
    for t in transitions:
        Draft202012Validator(t['submission_schema']).validate(samples[t['transition_key']])
        checks.append({'check': f'legal_example_{t["transition_key"]}', 'passed': True, 'detail': ''})
    check('all_16_submission_examples_accept', len(samples) == 16, f'samples={len(samples)}')

    # Illegal families stay rejected.
    purchased = Draft202012Validator(transition_by_key['advance_purchased']['submission_schema'])
    check('decision_not_purchase', not purchased.is_valid(samples['advance_purchase_confirmation']))
    wrong = copy.deepcopy(samples['advance_purchased'])
    wrong['purchaseState'] = 'APPROVED_ONLY'
    check('approved_only_rejected', not purchased.is_valid(wrong))
    wrong = copy.deepcopy(samples['advance_purchased'])
    wrong['allRequestedItemsPurchased'] = False
    check('partial_purchase_rejected', not purchased.is_valid(wrong))
    confirmation = Draft202012Validator(transition_by_key['advance_purchase_confirmation']['submission_schema'])
    wrong = copy.deepcopy(samples['advance_purchase_confirmation'])
    del wrong['userProof']
    check('approval_without_user_proof_rejected', not confirmation.is_valid(wrong))

    result = {
        'status': 'LOCAL_PIPE_SUBMISSION_VALIDATION_PASSED',
        'serviceCreated': False,
        'serviceCanonicalValidationPerformed': False,
        'capturedArgs': opts.captured_args,
        'checkCount': len(checks),
        'nodeCount': len(nodes),
        'transitionCount': len(transitions),
        'legalExampleCount': len(samples),
        'illegalFamilyCount': 4,
        'checks': checks,
    }
    with open(opts.out, 'w') as fh:
        fh.write(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k: result[k] for k in
                      ['status', 'checkCount', 'nodeCount', 'transitionCount', 'legalExampleCount']}))


if __name__ == '__main__':
    main()
