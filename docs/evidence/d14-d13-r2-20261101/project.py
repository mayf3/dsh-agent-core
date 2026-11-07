"""Project metadata only; raw substring matches are not execution denials.

A direct denial requires a preceding tool/call named agent_session_send,
the exact same source/tool-result callId, and the tool result's own rendered
error suffix. Quoted grep/read/forum/scheduler text is recorded separately.
"""
import collections
import datetime
import hashlib
import json
import sys

SOURCE = '/Users/authsvc/.agent-core/homes/agt_hr-agent/sessions/--Users-yanfenma-.openclaw-groups-workspace-oc_a5e904510bbf4b983d6cd97b9f7bbb74--/main/session.jsonl'
MARKER = 'trusted source turn proof missing or stale'
SUFFIX = ' failed: internal_error: ' + MARKER


def own_denial(message, call_id):
    """Parse only this tool result's content, never quoted nested JSON."""
    if message.get('source', {}).get('kind') != 'tool':
        return False
    for block in message.get('content', []):
        if block.get('type') != 'tool-result' or block.get('toolCallId') != call_id:
            continue
        for content in block.get('content', []):
            text = content.get('text')
            if content.get('type') == 'text' and isinstance(text, str):
                if text.startswith('agent_session_send: send(') and text.endswith(SUFFIX):
                    return True
    return False


counts = collections.Counter()
events = []
denials = []
search_hits = []
calls = {}
turns = {}
digest = hashlib.sha256()
last_time = None
line_no = 0
for line_no, raw in enumerate(sys.stdin.buffer, 1):
    digest.update(raw)
    try:
        event = json.loads(raw)
    except Exception:
        continue
    typ = event.get('type')
    counts[typ] += 1
    data = event.get('data', {})
    turn = data.get('turn')
    stamp = event.get('time')
    last_time = stamp or last_time
    rec = {
        'line': line_no, 'seq': event.get('seq'), 'time': stamp,
        'iso': datetime.datetime.fromtimestamp(stamp / 1000, datetime.timezone.utc).isoformat() if isinstance(stamp, (int, float)) else None,
        'type': typ, 'turn': turn, 'step': data.get('step'),
    }
    if typ == 'tool/call':
        calls[data.get('callId')] = {**rec, 'callId': data.get('callId'), 'name': data.get('name')}
    if typ == 'tool/result' and b'trusted source turn proof' in raw:
        message = data.get('message', {})
        call_id = message.get('source', {}).get('callId')
        call = calls.get(call_id)
        same_turn = call is not None and call.get('turn') == turn
        result_is_denial = own_denial(message, call_id)
        direct = same_turn and call.get('name') == 'agent_session_send' and result_is_denial
        matched = {**rec, 'callId': call_id, 'matchedCall': call,
                   'resultOwnExactDenial': result_is_denial,
                   'classification': 'direct_session_send_denial' if direct else 'excluded_reference_or_search_result'}
        search_hits.append(matched)
        if direct:
            denials.append({**matched, 'parsedError': {'code': 'internal_error', 'detail': MARKER},
                           'errorEncoding': 'tool-result rendered text exact prefix and suffix'})
    if typ in ('turn/start', 'turn/end'):
        turns.setdefault(turn, {})[typ] = rec
    if any(s in str(typ).lower() for s in ('maintenance', 'turn/', 'session/', 'status', 'error', 'process', 'spawn', 'compaction', 'inbox')) or typ == 'user/message':
        rec['dataKeys'] = list(data)
        rec['metadata'] = {k: v for k, v in data.items() if k in ('status', 'reason', 'turn', 'step', 'state', 'kind', 'sessionId', 'messageId', 'durationMs', 'duration', 'elapsedMs', 'startedAt', 'endedAt') and isinstance(v, (str, int, float, bool, type(None)))}
        if isinstance(data.get('reason'), dict):
            rec['reasonKeys'] = list(data['reason'])
            rec['reasonMetadata'] = {k: v for k, v in data['reason'].items() if k in ('type', 'kind', 'code', 'status') and isinstance(v, (str, int, float, bool, type(None)))}
        if typ == 'user/message':
            rec['messageMetadata'] = {k: v for k, v in data.items() if k in ('id', 'role')}
            rec['sourceMetadata'] = {k: v for k, v in data.get('source', {}).items() if k in ('kind', 'id', 'messageId', 'requestId', 'ingressMessageId') and isinstance(v, (str, int, float, bool, type(None)))}
        rec['surfaceOp'] = event.get('surfaceOp')
        rec['sourceEventSeqsCount'] = len(event.get('sourceEventSeqs', []))
        events.append(rec)

out = {
    'source': SOURCE, 'sha256': digest.hexdigest(), 'lineCount': line_no,
    'lastTime': last_time, 'counts': dict(counts),
    'classificationRule': 'preceding same-turn tool/call name=agent_session_send + exact source/tool-result callId + own rendered error exact prefix/suffix',
    'denials': denials, 'signatureSearchHits': search_hits,
    'excludedSignatureSearchHits': [x for x in search_hits if x['classification'] != 'direct_session_send_denial'],
    'sessionSendCalls': [x for x in calls.values() if x['name'] == 'agent_session_send'],
    'turns': turns, 'events': events,
}
json.dump(out, sys.stdout, ensure_ascii=False, indent=2)
sys.stdout.write('\n')
