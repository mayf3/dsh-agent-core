"""Nonroot source-bound inert package assembly; no production/activation effects."""
import datetime
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile

assert os.geteuid() != 0, 'PREPARATION_REFUSES_ROOT'
root = Path.cwd()
plan = root / '.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN'
out = plan / 'final-repair-evidence'
frozen = json.loads((out / '26-frozen-source.json').read_text())
head = frozen['head']
assert subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip() == head
for path, expected in frozen['source_files'].items():
    assert hashlib.sha256(Path(path).read_bytes()).hexdigest() == expected
checks = json.loads((out / '32-final-gates.json').read_text())
assert len(checks) == 5 and all(c['exit'] == 0 and c['source'] == head for c in checks)
previous = json.loads((plan / 'task-4-evidence/repair-artifacts.json').read_text())
recipe = json.loads((plan / 'task-4-evidence/repair-recipe.json').read_text())
paths = list(frozen['source_files'])
paths += [p for p in recipe['source_files'] if not p.startswith('packages/deployment-control-plane/')]
recipe['source_revision'] = head
recipe['source_files'] = {p: hashlib.sha256(Path(p).read_bytes()).hexdigest() for p in paths}
recipe['platform_tools'] = {p: hashlib.sha256(Path(p).read_bytes()).hexdigest() for p in recipe['platform_tools']}
prior_manifest = json.loads((plan / 'task-4-evidence/repair-manifest.json').read_text())
prior_runtime = {p['destination']: p['sha256'] for p in prior_manifest['payloads'] if p['destination'] in recipe['runtime']}
assert len(prior_runtime) == len(recipe['runtime']) == 22
for destination, path in recipe['runtime'].items():
    assert hashlib.sha256(Path(path).read_bytes()).hexdigest() == prior_runtime[destination]
physical = subprocess.check_output(['/usr/bin/getconf', 'DARWIN_USER_TEMP_DIR'], text=True).strip()
kernel = Path(physical).resolve(strict=True)
assert kernel.stat().st_uid == os.geteuid() and kernel.stat().st_mode & 0o777 == 0o700
package = Path(tempfile.mkdtemp(prefix='agent-deployd-final-repair-', dir=kernel))
assert package.parent == kernel and package.stat().st_mode & 0o777 == 0o700
recipe_path = out / '38-final-recipe.json'
recipe_path.write_text(json.dumps(recipe, indent=2) + '\n')
cli = root / 'packages/deployment-control-plane/target/release/agent-deploy-prepare'

def run(args, name):
    started = datetime.datetime.now(datetime.timezone.utc).isoformat()
    result = subprocess.run([str(cli), *map(str, args)], capture_output=True, text=True, timeout=60)
    (out / name).write_text('SOURCE=' + head + '\nSTART=' + started + '\nCOMMAND=' + repr(result.args) + '\n' + result.stdout + result.stderr + '\nEXIT=' + str(result.returncode) + '\n')
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)

result = run(['prepare', recipe_path, package], '39-package-prepare.log')
verified = run(['verify', package, result['manifest_digest'], result['source_digest'], root], '40-package-verify.log')
assert verified['integrity_verified'] and not verified['bootstrap_ready'] and not verified['activation_allowed']
assert len(verified['blockers']) == 7 and 'EXACT_OWNER_BOOTSTRAP_RECEIPT' not in verified['blockers']
manifest = json.loads((package / 'manifest.json').read_text())
assert not manifest['profile']['enabled'] and manifest['transition_sudoers'] == ''
assert all(i['public_key'] is None and i['custody_receipt'] is None for i in manifest['issuers'])
for item in manifest['payloads']:
    assert hashlib.sha256((package / item['blob']).read_bytes()).hexdigest() == item['sha256']
for name in ['manifest.json', 'ai.agent-deployd.plist']:
    (out / ('final-' + name)).write_bytes((package / name).read_bytes())
result.update({'source_commit': head, 'binary_build_source': head, 'source_file_count': len(paths), 'package_path': str(package), 'generated_at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'controller_sha256': hashlib.sha256(Path(recipe['controller']).read_bytes()).hexdigest(), 'prepare_cli_sha256': hashlib.sha256(cli.read_bytes()).hexdigest(), 'runtime_closure_reused_exactly': prior_runtime, 'historical_package_preserved': previous['package_path'], 'historical_manifest_preserved': previous['manifest_digest'], 'source_map_sha256': hashlib.sha256(json.dumps(recipe['source_files'], sort_keys=True, separators=(',', ':')).encode()).hexdigest(), 'payload_count': len(manifest['payloads']), 'verification': verified, 'limitations': ['Fresh controller and CLI release built at exact source commit; Node candidate bytes reused and independently rehashed.', 'No production issuer, custody, accepted release selection or privileged proof supplied.', 'RP08 remains future operation authorization, not offline readiness prerequisite.']})
(out / '41-final-package.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({k: v for k, v in result.items() if k != 'runtime_closure_reused_exactly'}, indent=2))
