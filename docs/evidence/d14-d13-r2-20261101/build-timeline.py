"""Derive a denial timeline from the independently reviewable projection."""
import json
from pathlib import Path

root = Path(__file__).parent
p = json.loads((root / 'hr-main-projection.json').read_text())
seen = set()
rows = []
for d in p['denials']:
    if d['callId'] in seen:
        continue
    seen.add(d['callId'])
    start = p['turns'][str(d['turn'])]['turn/start']
    end = p['turns'][str(d['turn'])]['turn/end']
    rows.append({
        'turn': d['turn'], 'callId': d['callId'],
        'toolName': d['matchedCall']['name'], 'callLine': d['matchedCall']['line'],
        'startLine': start['line'], 'startTime': start['iso'],
        'denialLine': d['line'], 'denialTime': d['iso'],
        'sinceStartMs': d['time'] - start['time'],
        'endLine': end['line'], 'endTime': end['iso'],
        'durationMs': end['time'] - start['time'],
        'endReason': end.get('reasonMetadata'), 'parsedError': d['parsedError'],
    })
out = {
    'source': p['source'], 'sourceSha256': p['sha256'],
    'countDirectDeniedResults': len(p['denials']),
    'countUniqueDirectDeniedCalls': len(rows),
    'countExcludedSignatureSearchHits': len(p['excludedSignatureSearchHits']),
    'rows': rows,
}
(root / 'denial-timeline.json').write_text(json.dumps(out, indent=2) + '\n')
