"""Generate a replacement inert source binding; preserve the historical package/logs."""
import datetime
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile

assert os.geteuid() != 0, 'FIXTURE_REFUSES_ROOT'
root = Path.cwd()
evidence = root / '.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-evidence'
previous = json.loads((evidence / 'final-artifacts.json').read_text())
receipt = json.loads((evidence / '69-repair-binary-source-equivalence.json').read_text())
head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip()
assert head == receipt['source_commit']
for path, record in receipt['binaries'].items():
    assert hashlib.sha256(Path(path).read_bytes()).hexdigest() == record['sha256']
recipe = json.loads((evidence / 'final-recipe.json').read_text())
paths = subprocess.check_output(['git', 'ls-files', 'packages/deployment-control-plane'], text=True).splitlines()
paths += [p for p in recipe['source_files'] if not p.startswith('packages/deployment-control-plane/')]
recipe['source_revision'] = head
recipe['source_files'] = {p: hashlib.sha256(Path(p).read_bytes()).hexdigest() for p in paths}
recipe_path = evidence / 'repair-recipe.json'
recipe_path.write_text(json.dumps(recipe, indent=2) + '\n')
# Read the same Darwin kernel selector as FixtureRoots, independently of TMPDIR.
physical = subprocess.check_output(['/usr/bin/getconf', 'DARWIN_USER_TEMP_DIR'], text=True).strip()
kernel = Path(physical).resolve(strict=True)
out = Path(tempfile.mkdtemp(prefix='agent-deployd-task4-repair-', dir=kernel))
assert out.parent == kernel and (out.stat().st_mode & 0o777) == 0o700
cli = root / 'packages/deployment-control-plane/target/release/agent-deploy-prepare'

def run(args, log):
    result = subprocess.run([str(cli), *map(str, args)], capture_output=True, text=True, timeout=60)
    (evidence / log).write_text('SOURCE=' + head + '\nCOMMAND=' + repr(result.args) + '\n' + result.stdout + result.stderr + '\nEXIT=' + str(result.returncode) + '\n')
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)

result = run(['prepare', recipe_path, out], '70-repair-package-prepare.log')
verified = run(['verify', out, result['manifest_digest'], result['source_digest'], root], '71-repair-package-verify.log')
assert result['verdict']['integrity_verified'] and not result['verdict']['bootstrap_ready']
manifest = json.loads((out / 'manifest.json').read_text())
for item in manifest['payloads']:
    path = out / item['blob']
    assert path.stat().st_size == item['size']
    assert hashlib.sha256(path.read_bytes()).hexdigest() == item['sha256']
for name in ['manifest.json', 'ai.agent-deployd.plist']:
    (evidence / ('repair-' + name)).write_bytes((out / name).read_bytes())
result.update({'source_commit': head, 'package_path': str(out), 'generated_at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'source_file_count': len(paths), 'historical_package': previous['package_path'], 'historical_manifest': previous['manifest_digest'], 'controller_sha256': previous['controller_sha256'], 'prepare_cli_sha256': previous['prepare_cli_sha256'], 'closure_manifest_sha256': previous['closure_manifest_sha256'], 'native_candidate_path': previous['native_candidate_path'], 'payload_count': len(manifest['payloads']), 'binary_build_source': previous['source_commit'], 'binary_reuse_evidence': '69-repair-binary-source-equivalence.json', 'inventory': sorted(p.name for p in out.iterdir())})
(evidence / 'repair-artifacts.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
