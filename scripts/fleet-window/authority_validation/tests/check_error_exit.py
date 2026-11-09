#!/usr/bin/env python3
"""Snapshot candidate source; exercise its original ERR/STOP path without --execute."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

WORK = Path(tempfile.mkdtemp(prefix='fwav-errors-'))
DEFAULT_SOURCE = Path(__file__).resolve().parents[2]
DEFAULT_FIXTURE = Path(__file__).resolve().parent
source = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else DEFAULT_SOURCE
fixtures = Path(sys.argv[2]).resolve() if len(sys.argv) > 2 else DEFAULT_FIXTURE
out = Path(tempfile.mkdtemp(prefix='error-evidence-', dir=WORK))
candidate = out / 'candidate'
candidate.mkdir()
inputs = {}
for name in ('window-executor-v5.sh', 'window_helper_core.py', 'window_helper.py',
             'window_preimage_xattr.py', 'window_close.py', 'authority_validation/__init__.py',
             'authority_validation/checks.py', 'authority_validation/policy.py', 'authority_validation/reader.py'):
    data = (source / name).read_bytes()
    target = candidate / name
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    inputs[name] = {'source': str(source / name), 'sha256': hashlib.sha256(data).hexdigest()}
fixture_dir = out / 'fixtures'
fixture_dir.mkdir()
for name in ('fw_fixture.py', 'boundary_harness.py'):
    data = (fixtures / name).read_bytes()
    (fixture_dir / name).write_bytes(data)
    inputs['fixture/' + name] = {'source': str(fixtures / name), 'sha256': hashlib.sha256(data).hexdigest()}
(out / 'input-hashes.json').write_text(json.dumps(inputs, indent=2) + '\n')

driver = out / 'refusal-driver.py'
driver.write_text('''import sys
from pathlib import Path
source, fixture_dir, category, trace = sys.argv[1:]
sys.path.insert(0, source)
# Bind the real candidate modules before loading the external observation fixture.
import authority_validation.checks
import authority_validation.policy
import authority_validation.reader
sys.path.insert(0, fixture_dir)
import fw_fixture
fw_fixture.HERE = Path(source)
import boundary_harness
boundary_harness.HERE = Path(source)
boundary_harness.refusal_driver(category, trace)
''')

shell = out / 'trap-harness.sh'
shell.write_text('''#!/bin/bash
source "$CANDIDATE/window-executor-v5.sh"
RD=$CASE_RECEIPTS
STAGE=stage_05_old_exit
INSTALL_STATE=$CASE_INSTALL_STATE
STOP_STATE=$CASE_STOP_STATE
sudo() {
  printf '%s\\n' 'FORBIDDEN sudo called' >> "$SUDO_TRACE"
  return 99
}
helper() {
  local privilege=$1
  shift
  case "$1" in
    fixture-refusal)
      "$PYTHON" -B "$DRIVER" "$CANDIDATE" "$FIXTURES" "$CATEGORY" "$TRACE" ;;
    phase)
      if [ "$DIAGNOSTIC_FAIL" = 1 ]; then
        printf '%s\\n' 'fixture diagnostic write failed rc=73' >&2
        return 73
      fi
      "$PYTHON" -B "$CANDIDATE/window_helper.py" "$RD" "$@" ;;
    stop-state|rollback-summary)
      "$PYTHON" -B "$CANDIDATE/window_helper.py" "$RD" "$@" ;;
    *) printf '%s\\n' 'unexpected helper operation' >&2; return 98 ;;
  esac
}
trap 'stop_on_error "$?" "$LINENO"' ERR
trap 'stop_on_error 130 "$LINENO"' INT
trap 'stop_on_error 143 "$LINENO"' TERM
helper root fixture-refusal
sudo /bin/launchctl bootout system /FORBIDDEN
''')

categories = {'unappointed': '未任命', 'scope': '越界', 'expired': '过期',
              'revoked': '撤销', 'drift': '候选漂移', 'gate': '缺门'}
results = []
for diagnostic_fail in (False, True):
    for category, label in categories.items():
        case = out / (category + ('-diagnostic-failure' if diagnostic_fail else '-phase-success'))
        case.mkdir()
        rd = case / 'receipts'
        rd.mkdir()
        if diagnostic_fail:
            (rd / 'old-exit.json').write_text('{}\n')
        env = dict(os.environ, PYTHONDONTWRITEBYTECODE='1', PYTHON=str(Path(sys.executable).resolve()),
                   DRIVER=str(driver), CANDIDATE=str(candidate), FIXTURES=str(fixture_dir), CATEGORY=category,
                   TRACE=str(case / 'effect-trace.json'), CASE_RECEIPTS=str(rd),
                   CASE_INSTALL_STATE='started' if diagnostic_fail else 'not_started',
                   CASE_STOP_STATE='proved' if diagnostic_fail else 'not_attempted',
                   DIAGNOSTIC_FAIL='1' if diagnostic_fail else '0', SUDO_TRACE=str(case / 'sudo-trace.txt'))
        process = subprocess.run(['/bin/bash', str(shell)], env=env, capture_output=True, text=True, timeout=30)
        (case / 'stdout.txt').write_text(process.stdout)
        (case / 'stderr.txt').write_text(process.stderr)
        trace = json.loads((case / 'effect-trace.json').read_text())
        assert process.returncode not in (0, 10), (category, process.returncode)
        assert 'RuntimeError: ' + label + ':' in process.stderr, (category, process.stderr)
        state = 'started stop_state=proved' if diagnostic_fail else 'not_started stop_state=not_attempted'
        assert 'STOP stage=stage_05_old_exit install_state=' + state in process.stdout, process.stdout
        assert 'Evidence: ' + str(rd) in process.stdout, process.stdout
        assert trace['effectCalls'] == 0 and trace['readerCalls'] > 0, trace
        assert not (case / 'sudo-trace.txt').exists(), 'external sudo was invoked'
        phase = rd / 'stage_05_old_exit.json'
        if diagnostic_fail:
            assert 'fixture diagnostic write failed rc=73' in process.stderr
            assert not phase.exists()
            assert process.returncode != 73, 'diagnostic failure overrode original refusal'
        else:
            event = json.loads(phase.read_text())
            assert event['status'] == 'FAIL' and event['stage'] == 'stage_05_old_exit', event
        result = {'category': category, 'refusal': label, 'rawRC': process.returncode,
                  'phase': 'WRITE_FAILED_RC73' if diagnostic_fail else 'FAIL',
                  'installState': env['CASE_INSTALL_STATE'], 'stopState': env['CASE_STOP_STATE'],
                  'effectCalls': trace['effectCalls'], 'sudoCalls': 0, 'readerCalls': trace['readerCalls'],
                  'stdout': str(case / 'stdout.txt'), 'stderr': str(case / 'stderr.txt')}
        results.append(result)
        print(json.dumps(result, ensure_ascii=False))
(out / 'results.json').write_text(json.dumps({'sourceHashes': inputs, 'cases': results,
    'limitations': ['isolated mechanism evidence only', 'fixture external observation provider',
                    'no installed/loaded/profile/effectiveness/production qualification']}, ensure_ascii=False, indent=2) + '\n')
print('OUTPUT=' + str(out))
print('PASS cases=12 assertion_groups=96 productionCalls=0')
