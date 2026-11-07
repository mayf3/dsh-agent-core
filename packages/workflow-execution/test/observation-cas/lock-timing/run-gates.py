#!/usr/bin/env python3
"""Explicit-file isolated gates; an unexpected result writes the stop receipt."""
import datetime
import hashlib
import io
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile

ROOT = Path(__file__).resolve().parents[5]
HERE = Path(__file__).resolve().parent
OUT = ROOT / 'docs/evidence/1366-locktiming'
BASE = 'b6ddc2a67ba041b8b13ed33d331104cf809d4985'
KEYS = 'HTTP_PROXY HTTPS_PROXY http_proxy https_proxy ALL_PROXY all_proxy NO_PROXY no_proxy NODE_USE_ENV_PROXY'.split()
ENV = {k: v for k, v in os.environ.items() if k not in KEYS}
ENV.pop('WEC4_EXPECT_RED', None)
NODE = '/opt/homebrew/bin/node'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def run(gate):
    OUT.mkdir(parents=True, exist_ok=True)
    temporary = None
    cwd = ROOT
    args = ['--test', '--test-reporter=tap']
    expected_rc, expected_fail = 0, 0
    node = NODE
    if gate == 'RED-final-fixtures':
        # Same final hard-gate assertions, product files from the exact base.
        temporary = Path(tempfile.mkdtemp(prefix='wec4-red-base-'))
        archive = subprocess.check_output(['git', 'archive', BASE, 'package.json',
            'packages/workflow-execution/package.json', 'packages/workflow-execution/src',
            'packages/scheduler/src/store/lock.js'], cwd=ROOT)
        with tarfile.open(fileobj=io.BytesIO(archive)) as tar:
            tar.extractall(temporary, filter='data')
        target = temporary / HERE.relative_to(ROOT)
        shutil.copytree(HERE, target)
        cwd = temporary
        args += ['--test-name-pattern=real two writers: B progresses during A',
            str((HERE / 'process-writers.test.js').relative_to(ROOT))]
        expected_rc, expected_fail = 1, 2
    elif gate == 'GREEN':
        args += sorted(str(p.relative_to(ROOT)) for p in HERE.glob('*.test.js'))
    elif gate == 'workflow-existing':
        args += sorted(str(p.relative_to(ROOT)) for p in
            (ROOT / 'packages/workflow-execution/test').rglob('*.test.js')
            if HERE not in p.parents and p.name != 'stale-quiescence.test.js')
    elif gate in ('integration', 'broker'):
        prior = json.loads((ROOT / f'docs/evidence/1367-readsep/r7/{gate}.json').read_text())
        args += [a for a in prior['command'] if a.endswith('.test.js')]
        node = '/usr/local/bin/node'
    else:
        raise SystemExit('unknown gate')
    cmd = [node, *args]
    sources = sorted((cwd / 'packages/workflow-execution/src').rglob('*.js'))
    tests = sorted((cwd / HERE.relative_to(ROOT)).glob('*.js'))
    inputs = {str(p.relative_to(cwd)): sha(p) for p in sources + tests}
    inputs.update({p: sha(cwd / p) for p in args if p.endswith('.test.js')})
    runtime = subprocess.check_output([node, '-e',
        'process.stdout.write(JSON.stringify({version:process.version,execPath:process.execPath,'
        'arch:process.arch,proxyKeysPresent:Object.keys(process.env).filter(k=>'
        '/^(http_proxy|https_proxy|all_proxy|no_proxy|node_use_env_proxy)$/i.test(k))}))'],
        env=ENV, text=True)
    started = now()
    with (OUT / f'{gate}.txt').open('wb') as raw:
        result = subprocess.run(cmd, cwd=cwd, env=ENV, stdout=raw, stderr=subprocess.STDOUT)
    raw = (OUT / f'{gate}.txt').read_text()
    counts = {k: int(m.group(1)) if (m := re.search(rf'^# {k} (\d+)$', raw, re.M)) else None
        for k in ['tests', 'pass', 'fail', 'skipped']}
    record = dict(gate=gate, cwd=str(cwd), integration_base=BASE,
        candidate_head=subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
        command=cmd, unset_keys=KEYS, environment_scope='test children only',
        node_runtime=json.loads(runtime), expected_rc=expected_rc, actual_rc=result.returncode,
        expected_fail=expected_fail, counts=counts, started_at=started, completed_at=now(),
        raw_sha256=sha(OUT / f'{gate}.txt'), input_sha256=inputs,
        excluded=['packages/workflow-execution/test/stale-quiescence.test.js'] if gate == 'workflow-existing' else [])
    (OUT / f'{gate}.json').write_text(json.dumps(record, indent=2) + '\n')
    if temporary:
        shutil.rmtree(temporary)
    print(json.dumps({k: record[k] for k in ['gate', 'candidate_head', 'node_runtime',
        'actual_rc', 'expected_rc', 'counts', 'raw_sha256']}, indent=2))
    if result.returncode != expected_rc or counts['fail'] != expected_fail or counts['skipped'] != 0:
        (ROOT / 'STOPPED-1366-IMPL.md').write_text(
            f'# STOPPED-1366-IMPL\n\nUnexpected required-gate result: {gate}. '
            f'Actual rc={result.returncode}; expected rc={expected_rc}; counts={counts}.\n\n'
            f'Source/test writes and PR delivery stopped. Raw: docs/evidence/1366-locktiming/{gate}.txt; '
            f'metadata: {gate}.json. No production writes. Owner task failure-stop applies.\n')
        raise SystemExit(1)


if __name__ == '__main__':
    run(sys.argv[1])
