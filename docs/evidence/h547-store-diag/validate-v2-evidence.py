#!/usr/bin/env python3
"""Verify preserved LOCAL evidence only; never read production or import runtime."""
import datetime as dt
import hashlib
import json
from pathlib import Path

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
raw = (OUT / 'capture-v2-receipt.json').read_bytes()
receipt = json.loads(raw)
sha = lambda data: hashlib.sha256(data).hexdigest()
expected = {'turn-recovery-v3.json', 'turn-recovery-v3.json.faults.json',
            'turn-recovery-v3.json.abandonment-declarations.json'}
selected = set(receipt['membership_before']['selected'])
vectors, stats = [], []
copies = 0
for capture_pass in receipt['passes']:
    vector, stat_vector = {}, {}
    for entry in capture_pass['files']:
        path = (ROOT / entry['copy']).resolve()
        assert path.is_relative_to((OUT / 'private/v2').resolve())
        data = path.read_bytes()
        assert len(data) == entry['bytes']
        assert sha(data) == entry['sha256'] == entry['second_sha256'] == entry['copy_sha256']
        assert entry['stat_before'] == entry['stat_after_copy'] == entry['stat_after_second_read']
        name = path.name
        vector[name], stat_vector[name] = sha(data), entry['stat_before']
        copies += 1
    assert set(vector) == selected
    vectors.append(vector)
    stats.append(stat_vector)
assert len(vectors) == 3 and vectors[0] == vectors[1] == vectors[2]
assert stats[0] == stats[1] == stats[2]
for source in receipt['source_files']:
    path = (ROOT / source['copy']).resolve()
    assert path.is_relative_to((OUT / 'private/v2/source').resolve())
    assert sha(path.read_bytes()) == source['sha256']
assert all(c['rc'] == 0 for c in receipt['commands'])
sudo = [c for c in receipt['commands'] if c['argv'][0] == 'sudo']
assert all(c['argv'][:4] == ['sudo', '-n', '-u', 'authsvc'] and
           c['argv'][4] in ['/bin/ls', '/usr/bin/stat', '/bin/cat'] for c in sudo)
assert not any('.bak' in arg for c in sudo for arg in c['argv'])
assert receipt['process_before'] == receipt['process_after']
extra = sorted(selected - expected)
assert extra == ['turn-recovery-v3.pre-fleet-unblock-20261002-111745.json']
assert not expected - selected
assert 'lock' in extra[0] and 'unblock' in extra[0]
print(json.dumps(dict(validated_at_utc=dt.datetime.now(dt.timezone.utc).isoformat(),
    method='Local preserved bytes and receipt recheck only; no production reads or source imports',
    capture_receipt_sha256=sha(raw), capture_script_sha256=sha((OUT / 'capture-v2.py').read_bytes()),
    validation_script_sha256=sha(Path(__file__).read_bytes()),
    collector_machine_status=receipt['status'], content_consistency='THREE_PASS_STABLE',
    local_copies_verified=copies, local_source_files_verified=len(receipt['source_files']),
    command_count=len(receipt['commands']), sudo_readonly_command_count=len(sudo),
    capture_scope='FAIL', extra_files=extra, missing_required_files=[], overall='STOPPED',
    offline_same_predicate_reproduction='NOT_RUN', actual_failed_predicate='UNKNOWN',
    root_cause='UNKNOWN', done_when='NOT_MET'), ensure_ascii=False, indent=2))
