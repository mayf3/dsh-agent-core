#!/usr/bin/env python3
"""Read live code, pin it, build two offline app copies. Never installs/runs them."""
import difflib
import hashlib
import json
import os
from pathlib import Path
import shutil
import stat
import subprocess
from datetime import datetime, timezone

REPO = Path(__file__).resolve().parents[3]
EVIDENCE = Path(__file__).resolve().parent
LIVE = Path('/usr/local/libexec/agent-core/app')
SOURCE = '656367cdfa2d8a8c72e63ab16d1932c895396b2b'
FILES = ['packages/agent-router/src/process/event-correlation.js',
         'packages/agent-router/src/process/state-machine.js']
SCRATCH = REPO / '.build-scratch/656367cd-landing'

def sha(data):
    return hashlib.sha256(data).hexdigest()

def save(name, value):
    (EVIDENCE / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')

def manifest(root):
    rows = []
    for parent, dirs, files in os.walk(root, followlinks=False):
        for name in sorted(dirs + files):
            p = Path(parent) / name
            s = p.lstat()
            row = dict(path=p.relative_to(root).as_posix(), mode=oct(stat.S_IMODE(s.st_mode)))
            if p.is_symlink():
                row.update(kind='symlink', target=os.readlink(p))
            elif p.is_dir():
                row.update(kind='directory')
            elif p.is_file():
                data = p.read_bytes()
                row.update(kind='file', size=len(data), sha256=sha(data))
            else:
                raise RuntimeError('unexpected special file: ' + str(p))
            rows.append(row)
    return sorted(rows, key=lambda r: r['path'])

def main():
    assert not SCRATCH.exists(), 'isolated build already exists: do not overwrite evidence'
    before = manifest(LIVE)
    SCRATCH.mkdir(parents=True)
    installed, candidate = [SCRATCH / n / 'app' for n in ['installed', 'candidate']]
    shutil.copytree(LIVE, installed, symlinks=True)
    assert manifest(installed) == before
    shutil.copytree(installed, candidate, symlinks=True)
    delta = []
    for rel in FILES:
        pre = (installed / rel).read_bytes()
        post = subprocess.check_output(['git', 'show', SOURCE + ':' + rel], cwd=REPO)
        (candidate / rel).write_bytes(post)
        for prefix, data in [('preimage/app', pre), ('candidate/app', post)]:
            p = EVIDENCE / prefix / rel
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(data)
            p.chmod(stat.S_IMODE((LIVE / rel).stat().st_mode))
        patch = ''.join(difflib.unified_diff(pre.decode().splitlines(True), post.decode().splitlines(True),
                       fromfile='installed/' + rel, tofile='candidate/' + rel))
        (EVIDENCE / (Path(rel).name + '.diff')).write_text(patch)
        delta.append(dict(path=rel, beforeSHA256=sha(pre), afterSHA256=sha(post), sourceCommit=SOURCE,
                          sourceBlob=subprocess.check_output(['git', 'rev-parse', SOURCE + ':' + rel],cwd=REPO,text=True).strip()))
    expected = {r['path']: r for r in before}
    after = manifest(candidate)
    actual_delta = [r['path'] for r in after if r != expected.get(r['path'])]
    assert actual_delta == sorted(FILES), actual_delta
    assert manifest(LIVE) == before, 'production source changed during copy'
    save('installed-manifest.json', before)
    save('candidate-manifest.json', after)
    save('delta.json', delta)
    # Neither app copy is bootable by this tool. Symlink strings are preserved,
    # and must not be followed into a production Harness by a test runner.
    save('build-receipt.json', dict(observedAt=datetime.now(timezone.utc).isoformat(),
         repo=str(REPO), head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=REPO,text=True).strip(),
         source=SOURCE, live=str(LIVE), scratch=str(SCRATCH), installed=str(installed), candidate=str(candidate),
         entries=len(before), actualDelta=actual_delta, liveBeforeAfterEqual=True,
         symlinks='literal copy, not traversed; full app never booted',
         installedManifestSHA256=sha((EVIDENCE/'installed-manifest.json').read_bytes()),
         candidateManifestSHA256=sha((EVIDENCE/'candidate-manifest.json').read_bytes())))
    print(json.dumps(dict(status='PASS',scratch=str(SCRATCH),delta=delta),ensure_ascii=False,indent=2))

if __name__ == '__main__':
    main()
