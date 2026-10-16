#!/usr/bin/env python3
"""Read production files; write an offline, PRIVATE preimage. Never installs/restores.

This is not DS CAPTURE/ADMIT and does not make a rollback generation eligible.
No runtime root, credential/config directory, Binding or turn ledger is copied.
"""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import plistlib
import stat
import subprocess

APP = Path('/usr/local/libexec/agent-core/app')
PLIST = Path('/Library/LaunchDaemons/ai.agent-core.runtime.plist')

def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as file:
        for block in iter(lambda: file.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()

def object_metadata(path, extended=True):
    info = path.lstat()
    row = {'uid': info.st_uid, 'gid': info.st_gid, 'mode': stat.S_IMODE(info.st_mode),
           'type': stat.S_IFMT(info.st_mode), 'flags': getattr(info, 'st_flags', 0),
           'mtime_ns': info.st_mtime_ns, 'size': info.st_size}
    if stat.S_ISLNK(info.st_mode):
        row['link'] = os.readlink(path)
    elif stat.S_ISREG(info.st_mode):
        row['sha256'] = digest(path)
    elif not stat.S_ISDIR(info.st_mode):
        raise RuntimeError('Unsupported preimage object: ' + str(path))
    if extended:
        # Values stay inside the PRIVATE artifact; only the artifact hash is public.
        names = subprocess.check_output(['/usr/bin/xattr', '-s', str(path)]).decode().splitlines()
        row['xattrs_hex'] = {name: subprocess.check_output(
            ['/usr/bin/xattr', '-s', '-px', name, str(path)]).decode().strip() for name in sorted(names)}
        row['acl_listing_b64'] = base64.b64encode(subprocess.check_output(
            ['/bin/ls', '-lde', str(path)])).decode()
    return row

def tree_metadata(root, extended=True):
    rows = {'.': object_metadata(root, extended)}
    for base, dirs, files in os.walk(root, followlinks=False):
        for name in sorted(dirs + files):
            path = Path(base) / name
            rows[str(path.relative_to(root))] = object_metadata(path, extended)
    return rows

def stable_key(row):
    return {key: value for key, value in row.items() if key != 'acl_listing_b64'}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--describe', action='store_true')
    parser.add_argument('--supervision-only', action='store_true', help='Capture exact system plist and an actual wrapper only')
    args = parser.parse_args()
    spec = {'app': str(APP), 'plist': str(PLIST), 'production_write': False,
            'runtime_data_copied': False, 'rollback_eligible': False}
    if args.describe:
        print(json.dumps(spec, indent=2))
        return
    if args.output is None:
        parser.error('--output is required')
    # Canonicalize the platform's /tmp -> /private/tmp alias before checking.
    dest = args.output.expanduser().resolve(strict=False)
    forbidden = ('/usr/local/libexec', '/private/var/db', '/Library', '/Users/authsvc', '/Users/yanfenma/.agent-core')
    if any(str(dest) == p or str(dest).startswith(p + '/') for p in forbidden):
        raise SystemExit('Refusing a production output path')
    if any(p.is_symlink() for p in [dest, *dest.parents] if p.exists()):
        raise SystemExit('Refusing a symlink output ancestor')
    os.umask(0o077)
    dest.mkdir(mode=0o700, parents=True, exist_ok=False)
    before = {} if args.supervision_only else tree_metadata(APP)
    plist_before = object_metadata(PLIST)
    raw_plist = PLIST.read_bytes()
    parsed = plistlib.loads(raw_plist)
    argv = parsed.get('ProgramArguments', [])
    if not argv or argv[0] != '/usr/local/libexec/agent-core/node-runtime/bin/node':
        raise RuntimeError('SYSTEM_PLIST_DRIFT; inspect original unit, do not guess a wrapper')
    # The true system job executes Node directly. The old GUI wrapper is out of scope.
    spec['wrapper'] = {'present': False, 'reason': 'system job invokes Node directly'}
    if not args.supervision_only:
        subprocess.run(['/usr/bin/ditto', '--rsrc', '--extattr', '--acl', str(APP), str(dest / 'app')], check=True)
    subprocess.run(['/usr/bin/ditto', '--rsrc', '--extattr', '--acl', str(PLIST), str(dest / 'runtime.plist')], check=True)
    if PLIST.read_bytes() != raw_plist or stable_key(object_metadata(PLIST)) != stable_key(plist_before):
        raise RuntimeError('PLIST_CHANGED_DURING_CAPTURE; capture is not valid')
    after = {} if args.supervision_only else tree_metadata(APP)
    if {p: stable_key(v) for p, v in before.items()} != {p: stable_key(v) for p, v in after.items()}:
        raise RuntimeError('APP_CHANGED_DURING_CAPTURE; capture is not valid')
    if not args.supervision_only:
        copied = tree_metadata(dest / 'app', extended=False)
        for relative, item in before.items():
            for key in ('sha256', 'link', 'type', 'mode'):
                if item.get(key) != copied.get(relative, {}).get(key):
                    raise RuntimeError('PREIMAGE_COPY_MISMATCH: ' + relative)
    if digest(dest / 'runtime.plist') != plist_before['sha256']:
        raise RuntimeError('PLIST_COPY_MISMATCH')
    spec.update({'app_metadata': before, 'plist_metadata': plist_before,
                 'copy_ownership_note': 'original uid/gid are recorded; unprivileged offline copy may have different ownership',
                 'restore_note': 'restore only through the original approved DS/B7 generation path; never overwrite business data'})
    (dest / 'private-preimage.json').write_text(json.dumps(spec, indent=2) + '\n')
    print(str(dest))

if __name__ == '__main__':
    main()
