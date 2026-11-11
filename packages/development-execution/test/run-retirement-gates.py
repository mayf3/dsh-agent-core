#!/usr/bin/env python3
"""Task-scoped offline evidence capture; explicit files, clean child env, stop on mismatch."""
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[3]
HARNESS = str(Path(__file__).relative_to(ROOT))
OUT = ROOT / 'docs/evidence/1365-retire'
KEYS = ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'ALL_PROXY',
        'all_proxy', 'NO_PROXY', 'no_proxy', 'NODE_USE_ENV_PROXY']
ENV = {k: v for k, v in os.environ.items() if k not in KEYS}
NODE = shutil.which('node')
REGRESSION = 'packages/development-execution/test/development-retirement.test.js'
SOURCES = ['packages/development-execution/src/engine.js',
           'packages/production-runtime/src/development-execution-runtime.js',
           'packages/production-runtime/src/workflow/capability-runtime.js']


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def red_diagnostics(text):
    """Bind every expected failure to its own TAP diagnostic, not loose text."""
    suffix = '; retired writes refuse, history stays read-only'
    names = [f'1365 Workflow starts and polls with {case}{suffix}' for case in [
        'missing backend and history', 'corrupt backend with intact history',
        'corrupt history', 'corrupt backend and history']]
    names.append('1365 default Engine also defers damaged history and ignores damaged backend')
    blocks = re.findall(r'^not ok (\d+) - ([^\n]+)\n  ---\n(.*?)^  \.\.\.$', text, re.M | re.S)
    backend = (r'''^  error: "development-execution: malformed backend\.json \([^"\r\n]*/retire-1365-[A-Za-z0-9]+/dev-execution/backend\.json\): '''
               r'''Expected property name or '\}' in JSON at position 1 \(line 1 column 2\)"$''')
    history = "  error: 'development-execution: corrupt (unparseable) executions.jsonl line — fail loud, never self-heal'"
    checks = []
    for index, name in enumerate(names, 1):
        matching = [block for number, title, block in blocks if number == str(index) and title == name]
        diagnostic = matching[0] if len(matching) == 1 else ''
        if index == 1:
            expected = ("  error: |-\n    Expected values to be strictly equal:\n    \n    false !== true\n    \n"
                        "  code: 'ERR_ASSERTION'\n  name: 'AssertionError'\n  expected: true\n  actual: false\n  operator: 'strictEqual'")
            exact = expected in diagnostic and 'development-retirement.test.js:70:12)' in diagnostic
        else:
            exact = (history in diagnostic.splitlines() if index == 3 else bool(re.search(backend, diagnostic, re.M)))
            exact = exact and "  code: 'ERR_TEST_FAILURE'" in diagnostic.splitlines()
            origin = '#replayTerminal' if index == 3 else 'loadBackendConfig'
            exact = exact and f'    {origin} (file://' in diagnostic
            exact = exact and '    new DevelopmentExecutionEngine (file://' in diagnostic
            if index != 5:
                exact = exact and '    mountWorkflowCapabilityRuntime (file://' in diagnostic
        checks.append(dict(test=index, name=name, diagnostic_matched=bool(exact)))
    return checks, len(blocks) == 5 and all(check['diagnostic_matched'] for check in checks)


def capture(gate):
    if gate in ('RED', 'GREEN'):
        files = [REGRESSION]
    elif gate == 'existing':
        files = sorted(str(p.relative_to(ROOT)) for p in
                       (ROOT / 'packages/development-execution/test').rglob('*.test.js'))
        files += ['packages/production-runtime/test/compose.test.js',
                  'packages/production-runtime/test/compose-deployment-root.test.js',
                  'packages/production-runtime/test/workflow-execution-shutdown.test.js',
                  'packages/workflow-execution/test/observation-cas/diagnostic-read.test.js',
                  'packages/workflow-execution/test/observation-cas/diagnostic-missing-trace.test.js']
    elif gate == 'targeted':
        files = ['packages/production-runtime/test/workflow-progress-runtime.test.js',
                 'packages/production-runtime/test/workflow-progress-gateway.test.js',
                 'packages/workflow-execution/test/runtime-wiring.test.js',
                 'packages/workflow-execution/test/recovery.test.js']
    else:
        raise ValueError('unknown gate')
    command = [NODE, '--test', '--test-reporter=tap', *files]
    started = datetime.datetime.now(datetime.timezone.utc).isoformat()
    probe = subprocess.run([NODE, '-e', 'process.stdout.write(JSON.stringify({version:process.version,execPath:process.execPath,arch:process.arch,proxyKeysPresent:Object.keys(process.env).filter(k=>/^(http_proxy|https_proxy|all_proxy|no_proxy|node_use_env_proxy)$/i.test(k))}))'],
                           cwd=ROOT, env=ENV, capture_output=True, text=True, check=True)
    runtime = json.loads(probe.stdout)
    if runtime['version'] != 'v25.6.1' or runtime['proxyKeysPresent']:
        raise RuntimeError('wrong runtime or proxy environment')
    version = subprocess.run([NODE, '--version'], cwd=ROOT, env=ENV,
                             capture_output=True, text=True, check=True)
    if version.stdout != 'v25.6.1\n':
        raise RuntimeError('unexpected node --version output')
    OUT.mkdir(parents=True, exist_ok=True)
    raw = OUT / f'R3-{gate}.tap'
    if raw.exists() or (OUT / f'R3-{gate}.json').exists():
        raise RuntimeError('R3 evidence already exists; never overwrite a prior attempt')
    with raw.open('wb') as stream:
        result = subprocess.run(command, cwd=ROOT, env=ENV, stdout=stream, stderr=subprocess.STDOUT)
    text = raw.read_text()
    counts = {key: int(match.group(1)) if (match := re.search(rf'^# {key} (\d+)$', text, re.M)) else None
              for key in ['tests', 'pass', 'fail', 'cancelled', 'skipped']}
    expected_rc = 1 if gate == 'RED' else 0
    expected_fail = 5 if gate == 'RED' else 0
    valid = (result.returncode == expected_rc and counts['fail'] == expected_fail
             and counts['cancelled'] == 0 and counts['skipped'] == 0
             and (gate in ('existing', 'targeted') and counts['tests'] > 0 or counts['tests'] == 5)
             and counts['pass'] == counts['tests'] - expected_fail)
    checks = []
    if gate == 'RED':
        checks, diagnostics_valid = red_diagnostics(text)
        valid = valid and diagnostics_valid
    record = dict(gate=gate, cwd=str(ROOT), command=command, runtime=runtime,
                  invocation=[sys.executable, HARNESS, gate], path=ENV.get('PATH'),
                  node_version_command=[NODE, '--version'], node_version_rc=version.returncode,
                  node_version_stdout=version.stdout, node_binary_sha256=sha(Path(runtime['execPath'])),
                  started_utc=started, ended_utc=datetime.datetime.now(datetime.timezone.utc).isoformat(),
                  child_unset_keys=KEYS, parent_env_unchanged=True,
                  git_head=subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
                  expected_rc=expected_rc, actual_rc=result.returncode, expected_fail=expected_fail,
                  counts=counts, diagnostic_checks=checks, capture_valid=bool(valid), capture_rc=0 if valid else 1, raw_sha256=sha(raw),
                  file_sha256={p: sha(ROOT / p) for p in [*SOURCES, *files, HARNESS]})
    (OUT / f'R3-{gate}.json').write_text(json.dumps(record, indent=2) + '\n')
    print(json.dumps(record, indent=2))
    if not valid:
        with (ROOT / 'STOPPED-1365-RETIRE.md').open('a') as stopped:
            stopped.write(f'\n## R3 STOP\n\nGate {gate} failed its declared expectation. '
            f'Actual rc={result.returncode}; counts={counts}.\n\n'
            f'Raw: docs/evidence/1365-retire/R3-{gate}.tap\n'
            'No further repair, commit, push or PR is authorized under failure-stop.\n')
        raise SystemExit(1)


capture(sys.argv[1])
