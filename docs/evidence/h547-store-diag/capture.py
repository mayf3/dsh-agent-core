#!/usr/bin/env python3
"""One attempt: sudo is used only for ls/stat/cat; every write is local UID."""
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
PRIVATE = OUT / 'private'
CONTROL = '/Users/authsvc/.agent-core/control'
APP = Path('/usr/local/libexec/agent-core/app')
receipt = {'started_at_utc': None, 'commands': [], 'status': 'STARTED'}

def now():
    return dt.datetime.now(dt.timezone.utc).isoformat()

def sha(data):
    return hashlib.sha256(data).hexdigest()

def read_as_service(command):
    assert command[0] in ['/bin/ls', '/usr/bin/stat', '/bin/cat']
    argv = ['sudo', '-n', '-u', 'authsvc', *command]
    started = now()
    result = subprocess.run(argv, capture_output=True)
    receipt['commands'].append({'argv': argv, 'started_at_utc': started,
        'ended_at_utc': now(), 'rc': result.returncode,
        'stdout_bytes': len(result.stdout), 'stdout_sha256': sha(result.stdout)})
    if result.returncode:
        raise RuntimeError(f'read-only command failed rc={result.returncode}: {command!r}; {result.stderr.decode(errors="replace")}')
    return result.stdout

def listing():
    return sorted(name for name in read_as_service(['/bin/ls', '-1', CONTROL]).decode().splitlines()
                  if name.startswith('turn-recovery'))

def metadata(names):
    return read_as_service(['/usr/bin/stat', '-f', '%N|%d|%i|%z|%m|%c|%u|%g|%p|%HT',
                            *[f'{CONTROL}/{name}' for name in names]]).decode()

try:
    receipt['started_at_utc'] = now()
    os.umask(0o077)
    if PRIVATE.exists():
        raise RuntimeError('capture is single-attempt; private directory already exists')
    (PRIVATE / 'store').mkdir(parents=True)
    names = listing()
    if 'turn-recovery-v3.json' not in names:
        raise RuntimeError('actual store is missing')
    before = metadata(names)
    if any(line.split('|')[-1] != 'Regular File' for line in before.splitlines()):
        raise RuntimeError('unexpected symlink or nonregular store sibling')
    files = []
    for name in names:
        started = now()
        data = read_as_service(['/bin/cat', f'{CONTROL}/{name}'])
        target = PRIVATE / 'store' / name
        target.write_bytes(data)
        files.append({'source': f'{CONTROL}/{name}', 'copy': str(target.relative_to(ROOT)),
                      'started_at_utc': started, 'copied_at_utc': now(),
                      'bytes': len(data), 'sha256': sha(data)})
    middle = metadata(names)
    # Re-read the complete file vector, without parsing any store contents.
    for entry in files:
        data = read_as_service(['/bin/cat', entry['source']])
        if sha(data) != entry['sha256'] or len(data) != entry['bytes']:
            raise RuntimeError(f'source changed during copy: {entry["source"]}')
        if sha((ROOT / entry['copy']).read_bytes()) != entry['sha256']:
            raise RuntimeError(f'copy hash mismatch: {entry["copy"]}')
        entry['second_read_verified_at_utc'] = now()
    after = metadata(names)
    if before != middle or middle != after or names != listing():
        raise RuntimeError('store sibling membership or metadata changed during capture')
    receipt.update(files=files, metadata_before=before, metadata_middle=middle,
                   metadata_after=after, sibling_names=names,
                   consistency='PASS: full-vector double-read SHA256 + pre/mid/post stat + membership equality; no atomic filesystem snapshot claimed')
    # Copy only readable deployed source, never import the production entrypoint.
    source_dir = PRIVATE / 'source'
    shutil.copytree(APP / 'packages/agent-router/src/reconciliation', source_dir / 'reconciliation')
    for relative in ['packages/agent-router/src/index.js', 'packages/production-runtime/src/paths.js',
                     'packages/production-runtime/src/compose.js', 'scripts/production-runtime.mjs',
                     'pack-provenance.json', 'package.json']:
        target = source_dir / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(APP / relative, target)
    source_manifest = []
    for target in sorted(source_dir.rglob('*')):
        if not target.is_file():
            continue
        rel = target.relative_to(source_dir)
        origin = APP / ('packages/agent-router/src' if rel.parts[0] == 'reconciliation' else '') / rel
        data = target.read_bytes()
        if data != origin.read_bytes():
            raise RuntimeError(f'deployed source changed during copy: {origin}')
        source_manifest.append({'source': str(origin), 'copy': str(target.relative_to(ROOT)),
                                'bytes': len(data), 'sha256': sha(data)})
    receipt['source_files'] = source_manifest
    receipt['status'] = 'PASS'
    receipt['ended_at_utc'] = now()
    (OUT / 'capture-receipt.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'status': 'PASS', 'store_siblings': len(files), 'main_store': next(x for x in files if x['source'].endswith('/turn-recovery-v3.json')),
                      'started_at_utc': receipt['started_at_utc'], 'ended_at_utc': receipt['ended_at_utc']}, indent=2))
except Exception as error:
    receipt.update(status='STOPPED', ended_at_utc=now(), error=str(error))
    (OUT / 'capture-receipt.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n')
    (ROOT / 'STOPPED-547-STORE-DIAG.md').write_text('# STOPPED-547-STORE-DIAG\n\n' + now() + '\n\n' + str(error) + '\n\nNo recovery action is authorized or performed. No automatic retry.\n')
    raise
