#!/usr/bin/env python3
"""Single authorized v2 attempt. Service identity runs only ls/stat/cat.

Three full passes, two reads per file per pass; no retry or atomic snapshot claim.
All output writes belong to the invoking local user, inside this worktree.
"""
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import subprocess

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
PRIVATE = OUT / 'private' / 'v2'
CONTROL = '/Users/authsvc/.agent-core/control'
BASE = 'turn-recovery-v3.json'
APP = Path('/usr/local/libexec/agent-core/app')
receipt = {'schema_version': 2, 'status': 'STARTED', 'commands': [], 'passes': []}

def now():
    return dt.datetime.now(dt.timezone.utc).isoformat()

def sha(data):
    return hashlib.sha256(data).hexdigest()

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

def metadata(name):
    raw = service(['/usr/bin/stat', '-f', '%N|%d|%i|%z|%m|%c|%u|%g|%p|%HT|%Su', f'{CONTROL}/{name}']).decode().strip()
    parts = raw.split('|')
    return dict(raw=raw, bytes=int(parts[3]), uid=int(parts[6]), gid=int(parts[7]),
                mode=parts[8], type=parts[9], owner=parts[10])

def membership():
    names = sorted(service(['/bin/ls', '-1', CONTROL]).decode().splitlines())
    selected, excluded = [], []
    for name in names:
        assert '/' not in name and '\n' not in name
        required = name in [BASE, BASE + '.faults.json', BASE + '.abandonment-declarations.json']
        auxiliary = '.tmp-' in name or 'lock' in name.lower() or 'history' in name.lower()
        if '.bak' in name or not (required or auxiliary):
            excluded.append(dict(name=name, reason='historical_backup' if '.bak' in name else 'outside_v2_consumption_set'))
            continue
        meta = metadata(name)
        if meta['type'] != 'Regular File':
            raise RuntimeError(f'nonregular candidate: {name}')
        # Optional auxiliary files may be excluded when not authsvc-readable.
        # Required files never get skipped on a permission failure.
        mode = int(meta['mode'], 8)
        readable = meta['owner'] == 'authsvc' and mode & 0o400 or mode & 0o044
        if not required and not readable:
            excluded.append(dict(name=name, reason='optional_auxiliary_not_authsvc_readable', metadata=meta))
        else:
            selected.append(name)
    if BASE not in selected:
        raise RuntimeError('required active store missing')
    return dict(selected=selected, excluded=excluded)

def capture_sources():
    relatives = sorted(str(p.relative_to(APP)) for p in (APP / 'packages/agent-router/src/reconciliation').glob('*.js'))
    relatives += ['packages/agent-router/src/index.js', 'packages/production-runtime/src/paths.js',
                  'packages/production-runtime/src/compose.js', 'scripts/production-runtime.mjs',
                  'pack-provenance.json', 'package.json']
    entries = []
    for rel in relatives:
        src = APP / rel
        data = src.read_bytes()
        target = PRIVATE / 'source' / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        if src.read_bytes() != data:
            raise RuntimeError(f'source changed: {src}')
        entries.append(dict(source=str(src), copy=str(target.relative_to(ROOT)), bytes=len(data), sha256=sha(data)))
    return entries

try:
    receipt['started_at_utc'] = now()
    os.umask(0o077)
    if PRIVATE.exists() or (OUT / 'capture-v2-receipt.json').exists():
        raise RuntimeError('v2 single attempt already exists; no retry')
    PRIVATE.mkdir(parents=True)
    receipt['process_before'] = command(['/bin/ps', '-p', '396', '-o', 'pid=,user=,lstart=,command=']).decode()
    receipt['source_files'] = capture_sources()
    initial = membership()
    receipt['membership_before'] = initial
    vectors = []
    stat_vectors = []
    for pass_number in range(1, 4):
        record = dict(pass_number=pass_number, started_at_utc=now(), files=[])
        receipt['passes'].append(record)
        if membership() != initial:
            raise RuntimeError('membership changed before pass')
        vector, stats = {}, {}
        for name in initial['selected']:
            before = metadata(name)
            data = service(['/bin/cat', f'{CONTROL}/{name}'])
            target = PRIVATE / f'pass-{pass_number}' / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            after = metadata(name)
            second = service(['/bin/cat', f'{CONTROL}/{name}'])
            final = metadata(name)
            entry = dict(source=f'{CONTROL}/{name}', copy=str(target.relative_to(ROOT)),
                copied_at_utc=now(), bytes=len(data), sha256=sha(data),
                second_sha256=sha(second), copy_sha256=sha(target.read_bytes()),
                stat_before=before, stat_after_copy=after, stat_after_second_read=final)
            record['files'].append(entry)
            if before != after or after != final or before['bytes'] != len(data) or data != second or entry['copy_sha256'] != entry['sha256']:
                raise RuntimeError(f'file consistency mismatch: {name}')
            vector[name], stats[name] = entry['sha256'], before
        if membership() != initial:
            raise RuntimeError('membership changed after pass')
        vectors.append(vector)
        stat_vectors.append(stats)
        record['ended_at_utc'] = now()
    if not (vectors[0] == vectors[1] == vectors[2] and stat_vectors[0] == stat_vectors[1] == stat_vectors[2]):
        raise RuntimeError('three-pass content or stat vectors differ')
    for entry in receipt['source_files']:
        if sha(Path(entry['source']).read_bytes()) != entry['sha256']:
            raise RuntimeError(f'source changed after store capture: {entry["source"]}')
    receipt['process_after'] = command(['/bin/ps', '-p', '396', '-o', 'pid=,user=,lstart=,command=']).decode()
    if receipt['process_before'] != receipt['process_after']:
        raise RuntimeError('target PID identity changed during capture')
    receipt.update(status='PASS', ended_at_utc=now(),
        consistency='THREE_PASS_STABLE: per-file pre/copy/post-stat + second source read + final stat; all SHA/stat/membership vectors equal; no atomic filesystem snapshot claimed')
except Exception as error:
    receipt.update(status='STOPPED', ended_at_utc=now(), error=str(error))
    with (ROOT / 'STOPPED-547-STORE-DIAG.md').open('a') as f:
        f.write('\n\n## v2 STOPPED\n\n' + now() + '\n\n' + str(error) + '\nNo recovery or automatic retry. See capture-v2-receipt.json.\n')
finally:
    (OUT / 'capture-v2-receipt.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n')

print(json.dumps({k: receipt.get(k) for k in ['status', 'started_at_utc', 'ended_at_utc', 'consistency', 'error']}, indent=2))
raise SystemExit(0 if receipt['status'] == 'PASS' else 1)
