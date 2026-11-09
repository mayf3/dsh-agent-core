#!/usr/bin/env python3
"""Run expected RED, GREEN, and regressions, stopping on any unexpected failure."""
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys

HERE = Path(__file__).resolve().parent
NODE = os.environ.get('LANDING_NODE', '/usr/local/libexec/agent-core/node-runtime/bin/node')
spec = importlib.util.spec_from_file_location('landing_build', HERE / 'build.py')
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)
receipt = json.loads((HERE / 'build-receipt.json').read_text())
assert build.manifest(build.LIVE) == json.loads((HERE/'installed-manifest.json').read_text()), 'live drift before tests'
results = []
for mode in ['red', 'green', 'regression']:
    command = [NODE, '--test', '--test-reporter=tap', str(HERE / 'owner-cases.test.mjs')]
    p = subprocess.run(command, env={**os.environ, 'LANDING_TEST_MODE': mode}, capture_output=True, text=True)
    raw = p.stdout + p.stderr
    (HERE / (mode + '.log')).write_text(raw)
    if mode == 'red':
        ok = p.returncode == 1 and '# fail 1' in raw and "OWNER_RED_ACTUAL" in raw and 'late_completed' in raw and 'exact_turn_end_success' in raw and 'ERR_ASSERTION' in raw
    else:
        ok = p.returncode == 0 and '# fail 0' in raw
    results.append(dict(mode=mode, command=command, returncode=p.returncode, expectedReturncode=1 if mode=='red' else 0,
                        gatePassed=ok, logSHA256=hashlib.sha256(raw.encode()).hexdigest()))
    print(json.dumps(results[-1]), flush=True)
    if not ok:
        (HERE/'test-receipt.json').write_text(json.dumps(dict(status='FAIL', results=results),indent=2)+'\n')
        sys.exit(1)
assert build.manifest(build.LIVE) == json.loads((HERE/'installed-manifest.json').read_text()), 'live drift after tests'
assert build.manifest(Path(receipt['candidate'])) == json.loads((HERE/'candidate-manifest.json').read_text()), 'candidate drift'
(HERE/'test-receipt.json').write_text(json.dumps(dict(status='PASS', observedAt=datetime.now(timezone.utc).isoformat(),
    head=receipt['head'], source=receipt['source'], nodeBinary=NODE,
    nodeVersion=subprocess.check_output([NODE,'--version'],text=True).strip(),
    nodeSHA256=hashlib.sha256(Path(NODE).read_bytes()).hexdigest(),
    fixture='in-memory synthetic store, execution, waiter; exact candidate functions; no real store constructor, child, network, or full-app boot',
    liveBeforeAfterEqual=True, candidateUnchanged=True, results=results),indent=2)+'\n')
