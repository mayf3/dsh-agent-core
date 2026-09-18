"""Ordinary-user, offline relocation proof; never executes or edits production paths."""
import hashlib
import json
import os
from pathlib import Path
import io
import tarfile
import subprocess
import tempfile

REPO = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
HIST = REPO / '.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-evidence'
PREFIX = '/usr/local/libexec/agent-core/node-runtime/'
CANDIDATE = Path('/Users/yanfenma/workspace/artifacts/production-deployment-control-plane-v1/reviewed-node-8ab5904')
assert os.geteuid() != 0

def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

def run(args, **kwargs):
    return subprocess.run(args, check=True, text=True, capture_output=True, timeout=60, **kwargs).stdout

def commands(p):
    lines = run(['/usr/bin/otool', '-l', str(p)]).splitlines()
    result = []
    for i, line in enumerate(lines):
        if line.strip() in ('cmd LC_LOAD_DYLIB', 'cmd LC_LOAD_WEAK_DYLIB', 'cmd LC_REEXPORT_DYLIB', 'cmd LC_LOAD_UPWARD_DYLIB', 'cmd LC_LAZY_LOAD_DYLIB', 'cmd LC_ID_DYLIB'):
            result.append((line.strip()[4:], lines[i+2].strip().removeprefix('name ').split(' (')[0]))
        assert line.strip() != 'cmd LC_RPATH', (p, 'unexpected rpath')
    return result

closure = REPO / 'deployment-artifacts/control-plane-genesis-v1/build-closure.json'
rows = json.loads(closure.read_text())['future_runtime_candidate']['node_payloads']
historical = {r['destination']: r for r in json.loads((HIST/'native-closure-manifest.json').read_text())['records']}
assert len(rows) == len(historical) == 22
root = Path(tempfile.mkdtemp(prefix='dcp-node-proof-')).resolve()
root.chmod(0o700)
# Private sibling tree includes an empty HOME. No production executable is invoked.
private = root/'runtime'
home = root/'home'
home.mkdir(mode=0o700)
records = []
for row in rows:
    original = CANDIDATE/row['blob']
    old = historical[row['destination']]
    source = Path(old['source'])
    assert sha(original) == row['sha256'] == old['output_sha256']
    assert original.stat().st_size == row['size']
    assert sha(source) == old['input_sha256'], ('historical source drift', str(source))
    assert run(['/usr/bin/lipo', '-archs', str(original)]).strip() == 'x86_64'
    run(['/usr/bin/codesign', '--verify', '--strict', str(original)])
    before = run(['/usr/bin/otool', '-L', str(original)]).splitlines()[1:]
    target = private/row['destination'].removeprefix(PREFIX)
    target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    target.write_bytes(original.read_bytes())
    target.chmod(0o700)
    argv = ['/usr/bin/install_name_tool']
    for kind, value in commands(original):
        if value.startswith(PREFIX):
            replacement = str(private)+'/'+value.removeprefix(PREFIX)
            argv += ['-id', replacement] if kind == 'LC_ID_DYLIB' else ['-change', value, replacement]
        else:
            assert value.startswith(('/usr/lib/', '/System/Library/Frameworks/')), value
    if len(argv) > 1:
        run(argv+[str(target)])
    run(['/usr/bin/codesign', '--force', '--sign', '-', str(target)])
    run(['/usr/bin/codesign', '--verify', '--strict', str(target)])
    after = run(['/usr/bin/otool', '-L', str(target)]).splitlines()[1:]
    assert [s.replace(str(private)+'/', PREFIX) for s in after] == before
    for _, value in commands(target):
        assert value.startswith((str(private)+'/', '/usr/lib/', '/System/Library/Frameworks/'))
    records.append({**row, 'source': str(source), 'input_sha256': sha(source), 'private_path': str(target), 'private_sha256': sha(target), 'load_versions': before})
# Closure resolves every non-system edge inside this exact private tree.
paths = {r['private_path'] for r in records}
for record in records:
    for kind, value in commands(Path(record['private_path'])):
        if value.startswith(str(private)+'/'):
            assert value in paths
node = private/'bin/node'
env = {'HOME': str(home), 'PATH': '/usr/bin:/bin', 'TMPDIR': str(root), 'LC_ALL': 'C'}
probe = OUT/'probe.mjs'
result = run([str(node), str(probe), str(REPO)], env=env, cwd=root)
tests = ['packages/scheduler/test/occurrence-model.test.js', 'packages/broker/test/capabilities/manifest-inventory.test.js']
test_log = run([str(node), '--test', *[str(REPO/p) for p in tests]], env=env, cwd=root)
(OUT/'current-tests.log').write_text(test_log)
frozen_sha = 'c9ffe1d1637db2997689d8b2ef7def4fc1086b17'
archive = subprocess.run(['/usr/bin/git', '-C', str(REPO), 'archive', frozen_sha, 'packages/broker', 'packages/scheduler'], check=True, capture_output=True, timeout=60).stdout
frozen = root/'frozen-source'
frozen.mkdir(mode=0o700)
with tarfile.open(fileobj=io.BytesIO(archive)) as tar:
    tar.extractall(frozen, filter='data')
frozen_probe = run([str(node), str(probe), str(frozen)], env=env, cwd=root)
frozen_tests = run([str(node), '--test', *[str(frozen/p) for p in tests]], env=env, cwd=root)
(OUT/'frozen-tests.log').write_text(frozen_tests)
canonical = root/'canonical-source'
canonical.mkdir(mode=0o700)
canonical_refs = {'packages/scheduler': 'd602b592fad345fb1c9adebe2bc6611a6f5cfdc2', 'packages/broker': '59472b631129d1ea3ca1202cbcbbc0799b083114'}
canonical_archives = {}
for package, ref in canonical_refs.items():
    data = subprocess.run(['/usr/bin/git', '-C', str(REPO), 'archive', ref, package], check=True, capture_output=True, timeout=60).stdout
    canonical_archives[package] = hashlib.sha256(data).hexdigest()
    with tarfile.open(fileobj=io.BytesIO(data)) as tar:
        tar.extractall(canonical, filter='data')
canonical_probe = run([str(node), str(probe), str(canonical)], env=env, cwd=root)
canonical_tests = run([str(node), '--test', *[str(canonical/p) for p in tests]], env=env, cwd=root)
(OUT/'canonical-tests.log').write_text(canonical_tests)
for row in rows:
    assert sha(CANDIDATE/row['blob']) == row['sha256'], 'original changed'
report = {'source_head': run(['/usr/bin/git', '-C', str(REPO), 'rev-parse', 'HEAD']).strip(), 'private_root': str(root), 'candidate': str(CANDIDATE), 'original_recipe_sha256': sha(HIST/'prepare-native-closure.py'), 'original_map_sha256': sha(HIST/'native-closure-manifest.json'), 'build_closure_sha256': sha(closure), 'validation_script_sha256': sha(Path(__file__)), 'probe_sha256': sha(probe), 'records': records, 'probe': json.loads(result), 'test_files': tests, 'frozen_source_sha': frozen_sha, 'frozen_archive_sha256': hashlib.sha256(archive).hexdigest(), 'frozen_probe': json.loads(frozen_probe), 'current_tests_sha256': sha(OUT/'current-tests.log'), 'frozen_tests_sha256': sha(OUT/'frozen-tests.log'), 'canonical_source_refs': canonical_refs, 'canonical_archive_sha256': canonical_archives, 'canonical_probe': json.loads(canonical_probe), 'canonical_tests_sha256': sha(OUT/'canonical-tests.log'), 'production_paths_executed': False, 'trusted_build_attestation': False}
(OUT/'observation.json').write_text(json.dumps(report, indent=2)+'\n')
print(json.dumps({'files': len(records), 'private_root': str(root), 'probe': report['probe']}))
