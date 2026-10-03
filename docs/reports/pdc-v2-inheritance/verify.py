#!/usr/bin/env python3
"""Offline proposed-Spec proof only. No product imports, host IO or authority grant."""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import re
import subprocess


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def require(value, reason):
    if not value:
        raise ValueError(reason)


def compare(v1, v2, allow):
    require(digest(v1) == allow['acceptedV1Sha256'], 'V1_PIN')
    heading = allow['onlyNewNormativeSection']['heading']
    require(v2.count(heading) == 1, 'NEW_SECTION_COUNT')
    inherited, suffix = v2.split(heading)
    require(digest(heading + suffix) == allow['onlyNewNormativeSection']['sha256'], 'NEW_SECTION_PIN')
    lines = v1.splitlines(keepends=True)
    pieces, cursor, spans, position = [], 0, [], 0
    for edit in allow['edits']:
        start, end = edit['v1StartLine'] - 1, edit['v1EndExclusiveLine'] - 1
        require(cursor <= start <= end <= len(lines), 'EDIT_RANGE')
        require(''.join(lines[start:end]) == edit['before'], 'BEFORE_SPAN')
        unchanged = ''.join(lines[cursor:start])
        pieces.extend((unchanged, edit['after']))
        position += len(unchanged)
        spans.append((position, position + len(edit['after']), edit))
        position += len(edit['after'])
        cursor = end
    pieces.append(''.join(lines[cursor:]))
    require(''.join(pieces) == inherited, 'UNLISTED_INHERITED_CHANGE')
    restored = inherited
    for start, end, edit in reversed(spans):
        require(restored[start:end] == edit['after'], 'AFTER_SPAN')
        restored = restored[:start] + edit['before'] + restored[end:]
    require(restored == v1, 'REVERSE_RECONSTRUCTION')
    # Enumerate every Decision/Contract, not merely the changed list.
    def blocks(text):
        found = list(re.finditer(r'(?m)^(?:- (DEC-DCP-\d{3}):|### (CTR-DCP-\d{3})\b|## )', text))
        result = {}
        for i, match in enumerate(found):
            name = match.group(1) or match.group(2)
            if name:
                require(name not in result, 'DUPLICATE_NORMATIVE_ID')
                result[name] = text[match.start():found[i + 1].start() if i + 1 < len(found) else len(text)]
        return result
    old, new, reverse = blocks(v1), blocks(inherited), blocks(restored)
    require(set(old) == set(new) == set(reverse), 'NORMATIVE_ID_SET')
    require(sum(k.startswith('DEC') for k in old) == 5, 'DECISION_COUNT')
    require(sum(k.startswith('CTR') for k in old) == 20, 'CONTRACT_COUNT')
    rows = []
    for key, value in old.items():
        edits = [e['id'] for e in allow['edits'] if e['surface'] == key]
        require(value == new[key] or edits, 'UNLISTED_NORMATIVE_DELTA:' + key)
        rows.append({'id': key, 'v1Sha256': digest(value), 'v2Sha256': digest(new[key]),
                     'comparison': 'BYTE_IDENTICAL' if value == new[key] else 'EXACT_ALLOWLIST_ONLY',
                     'allowedEdits': edits, 'reverseMatchesV1': reverse[key] == value})
    return rows


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[3]
    v1_path = root / 'docs/specs/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1.md'
    v2_path = root / 'docs/specs/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V2.md'
    allow_path = Path(__file__).with_name('allowed-delta.json')
    v1, v2, allow = v1_path.read_text(), v2_path.read_text(), json.loads(allow_path.read_text())
    rows = compare(v1, v2, allow)
    negatives = []
    bad_allow = copy.deepcopy(allow)
    bad_allow['edits'][0]['before'] += 'unreviewed'
    cases = [
        ('unlisted decision', v1, v2.replace('deploy immutable artifacts', 'deploy mutable artifacts', 1), allow),
        ('unlisted contract', v1, v2.replace('### CTR-DCP-004', '### CTR-DCP-099', 1), allow),
        ('unlisted noncontract paragraph', v1, v2.replace('not a distributed lock', 'a distributed lock', 1), allow),
        ('changed source authority', v1 + '\n', v2, allow),
        ('wrong before span', v1, v2, bad_allow),
        ('unreviewed added section', v1, v2 + '\nnew obligation\n', allow),
    ]
    for name, a, b, c in cases:
        try:
            compare(a, b, c)
        except ValueError as exc:
            negatives.append({'case': name, 'result': 'REJECTED', 'reason': str(exc)})
        else:
            raise ValueError('NEGATIVE_ACCEPTED:' + name)
    git = lambda *args: subprocess.check_output(['git', '-C', str(root), *args], text=True).strip()
    result = {'schema': 'PDC_V1_V2_INHERITANCE_PROOF_V1', 'verdict': 'PASS',
              'head': git('rev-parse', 'HEAD'), 'tree': git('rev-parse', 'HEAD^{tree}'),
              'clean': not git('status', '--porcelain'), 'v1Sha256': digest(v1), 'v2Sha256': digest(v2),
              'allowlistSha256': digest(allow_path.read_text()), 'checkerSha256': digest(Path(__file__).read_text()),
              'allInheritedBytesReconstructed': True, 'normativeRows': rows, 'negativeTests': negatives,
              'allowedSpans': len(allow['edits']), 'semanticAcceptance': False, 'productionEvidence': False}
    Path(args.output).write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({'verdict': result['verdict'], 'normativeRows': len(rows), 'negativeTests': len(negatives), 'head': result['head'], 'clean': result['clean']}))


if __name__ == '__main__':
    main()
