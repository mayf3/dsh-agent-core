"""Check false-positive rejection using metadata-only synthetic events."""
import json
from pathlib import Path
import subprocess
import sys

root = Path(__file__).parent
marker = 'trusted source turn proof missing or stale'
direct_text = 'agent_session_send: send(agt_fixture, harmless fixture, 0) failed: internal_error: ' + marker
events = []


def add_case(call_id, name='agent_session_send', block_id=None, text=direct_text, result_turn=7):
    events.append({'type': 'tool/call', 'seq': len(events), 'time': 1000,
                   'data': {'turn': 7, 'step': 1, 'callId': call_id, 'name': name}})
    events.append({'type': 'tool/result', 'seq': len(events), 'time': 1001,
                   'data': {'turn': result_turn, 'step': 1, 'message': {
                       'source': {'kind': 'tool', 'callId': call_id},
                       'content': [{'type': 'tool-result', 'toolCallId': block_id or call_id,
                                    'content': [{'type': 'text', 'text': text}]}]}}})


add_case('actual')
add_case('wrong-tool', name='grep')
add_case('wrong-block-id', block_id='different')
add_case('quoted', text='historical quote: ' + direct_text)
add_case('wrong-turn', result_turn=8)
add_case('signature-only', text=marker)
run = subprocess.run([sys.executable, str(root / 'project.py')],
                     input=''.join(json.dumps(x) + '\n' for x in events),
                     text=True, capture_output=True, check=True)
fixture = json.loads(run.stdout)
assert [x['callId'] for x in fixture['denials']] == ['actual']
assert len(fixture['excludedSignatureSearchHits']) == 5

real = json.loads((root / 'hr-main-projection.json').read_text())
assert [(x['matchedCall']['line'], x['line'], x['turn'], x['matchedCall']['name'])
        for x in real['denials']] == [(777, 778, 7, 'agent_session_send'),
                                     (779, 780, 7, 'agent_session_send')]
assert len(real['excludedSignatureSearchHits']) == 15
timeline = json.loads((root / 'denial-timeline.json').read_text())
assert [x['sinceStartMs'] for x in timeline['rows']] == [16121, 16170]
assert [x['durationMs'] for x in timeline['rows']] == [22034, 22034]
out = {
    'fixture': 'PASS', 'fixtureCases': 6, 'fixtureTrueDenials': 1,
    'fixtureExcludedFalsePositives': 5, 'realProjection': 'PASS',
    'sourceSha256': real['sha256'], 'realDirectDenials': 2,
    'realExcludedSignatureSearchHits': 15,
}
(root / 'projector-verification.json').write_text(json.dumps(out, indent=2) + '\n')
print(json.dumps(out))
