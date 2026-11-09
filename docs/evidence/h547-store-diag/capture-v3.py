#!/usr/bin/env python3
"""Single v3 attempt: exact consumer names, fresh stable vectors, no prod writes.

--check performs ONLY local allowlist/source evidence preflight. No old script
is rerun and no deployed source directory is recopied. Failure is never retried.
"""
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
PRIVATE = OUT / 'private' / 'v3'
CONTROL = '/Users/authsvc/.agent-core/control'
BASE = 'turn-recovery-v3.json'
EXACT = {BASE, BASE + '.faults.json', BASE + '.abandonment-declarations.json', BASE + '.r28-history.jsonl'}
receipt = dict(schema_version=3, status='STARTED', commands=[], passes=[])

def now():
    return dt.datetime.now(dt.timezone.utc).isoformat()

def sha(data):
    return hashlib.sha256(data).hexdigest()

def selected(name):
    return name in EXACT or re.fullmatch(re.escape(BASE) + r'\.tmp-[^/\n]+', name) is not None

def local_preflight():
    examples = {BASE: True, BASE + '.faults.json': True,
        BASE + '.abandonment-declarations.json': True, BASE + '.r28-history.jsonl': True,
        BASE + '.tmp-396-123': True, BASE + '.bak-pre-epoch-fix2-20261106': False,
        'turn-recovery-v3.pre-fleet-unblock-20261002-111745.json': False,
        BASE + '.lock': False, BASE + '.history': False, 'x' + BASE + '.tmp-1': False}
    assert all(selected(n) == wanted for n, wanted in examples.items())
    old = json.loads((OUT / 'capture-v2-receipt.json').read_text())
    sources = []
    for entry in old['source_files']:
        path = ROOT / entry['copy']
        assert path.is_file() and sha(path.read_bytes()) == entry['sha256'], entry['copy']
        sources.append(dict(copy=entry['copy'], sha256=entry['sha256']))
    required = ['packages/production-runtime/src/paths.js',
        'packages/agent-router/src/reconciliation/store.js',
        'packages/agent-router/src/reconciliation/durable-file.js', 'packages/agent-router/src/index.js']
    assert all(any(e['copy'].endswith('/' + r) for e in sources) for r in required)
    return dict(allowlist_examples=examples, reused_source_files=sources,
        whitelist_provenance=required, old_capture_scripts_rerun=False,
        production_commands=False)

def command(argv):
    started = now()
    result = subprocess.run(argv, capture_output=True)
    receipt['commands'].append(dict(argv=argv, started_at_utc=started,
        ended_at_utc=now(), rc=result.returncode, stdout_bytes=len(result.stdout),
        stdout_sha256=sha(result.stdout), stderr=result.stderr.decode(errors='replace')))
    if result.returncode:
        raise RuntimeError(f'read-only command failed: {argv!r}; rc={result.returncode}; {result.stderr.decode(errors="replace")}')
    return result.stdout

def service(argv):
    assert argv[0] in ['/bin/ls', '/usr/bin/stat', '/bin/cat']
    return command(['sudo', '-n', '-u', 'authsvc', *argv])

def membership():
    names = sorted(service(['/bin/ls', '-1', CONTROL]).decode().splitlines())
    chosen = [n for n in names if selected(n)]
    assert BASE in chosen, 'active store missing'
    return dict(selected=chosen, excluded=[n for n in names if not selected(n)])

def metadata(name):
    assert selected(name)
    raw = service(['/usr/bin/stat', '-f', '%N|%d|%i|%z|%m|%c|%u|%g|%p|%HT|%Su', f'{CONTROL}/{name}']).decode().strip()
    parts = raw.split('|')
    assert parts[9] == 'Regular File', raw
    return dict(raw=raw, bytes=int(parts[3]))

if sys.argv[1:] == ['--check']:
    print(json.dumps(local_preflight(), ensure_ascii=False, indent=2))
    raise SystemExit(0)
assert not sys.argv[1:]
try:
    receipt['started_at_utc'] = now()
    receipt['local_preflight'] = local_preflight()
    os.umask(0o077)
    assert not PRIVATE.exists() and not (OUT / 'capture-v3-receipt.json').exists(), 'single attempt already exists'
    PRIVATE.mkdir(parents=True)
    initial = membership()
    receipt['membership_before'] = initial
    vectors, stat_vectors = [], []
    for number in (1, 2):
        run = dict(number=number, started_at_utc=now(), files=[])
        receipt['passes'].append(run)
        assert membership()['selected'] == initial['selected'], 'selected membership changed'
        vector, stats = {}, {}
        for name in initial['selected']:
            before = metadata(name)
            data = service(['/bin/cat', f'{CONTROL}/{name}'])
            target = PRIVATE / f'pass-{number}' / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            after = metadata(name)
            second = service(['/bin/cat', f'{CONTROL}/{name}'])
            final = metadata(name)
            entry = dict(source=f'{CONTROL}/{name}', copy=str(target.relative_to(ROOT)), bytes=len(data),
                sha256=sha(data), second_sha256=sha(second), copy_sha256=sha(target.read_bytes()),
                stat_before=before, stat_after_copy=after, stat_after_second_read=final)
            run['files'].append(entry)
            assert before == after == final and before['bytes'] == len(data), f'stat changed: {name}'
            assert data == second and entry['copy_sha256'] == entry['sha256'], f'hash changed: {name}'
            vector[name], stats[name] = entry['sha256'], before
        assert membership()['selected'] == initial['selected'], 'selected membership changed'
        vectors.append(vector)
        stat_vectors.append(stats)
        run['ended_at_utc'] = now()
    receipt['membership_after'] = membership()
    assert receipt['membership_after']['selected'] == initial['selected'], 'selected membership changed'
    assert vectors[0] == vectors[1] and stat_vectors[0] == stat_vectors[1], 'cross-pass vectors changed'
    receipt.update(status='PASS', ended_at_utc=now(), consistency='TWO_PASS_STABLE; two reads and three stats per file per pass; selected membership stable; not atomic; not startup-loaded proof')
except Exception as error:
    receipt.update(status='STOPPED', ended_at_utc=now(), error=str(error))
    with (ROOT / 'STOPPED-547-STORE-DIAG.md').open('a') as f:
        f.write('\n\n## v3 STOPPED\n\n' + now() + '\n\n' + str(error) + '\nNo retry/recovery; see capture-v3-receipt.json.\n')
finally:
    (OUT / 'capture-v3-receipt.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({k: receipt.get(k) for k in ['status', 'started_at_utc', 'ended_at_utc', 'consistency', 'error']}, indent=2))
raise SystemExit(0 if receipt['status'] == 'PASS' else 1)
