#!/usr/bin/env python3
"""Owned reconstruction and optional original actual-module protocol harness.
Requires explicitly supplied pinned public preimages, never an installed service.
No service main, root, auth/provider, network or production action is invoked.
"""
import argparse
import hashlib
import json
import shutil
import subprocess
import tempfile
from pathlib import Path
import build


def verify(baselines, protocol_tests=False):
    package = build.PACKAGE
    with tempfile.TemporaryDirectory(prefix='b7-e32-source-package-') as tmp:
        root = Path(tmp)
        # A wrong input refuses before any output path is created.
        bad = root / 'wrong-preimages'
        bad.mkdir()
        (bad / 'deployment_system.py').write_bytes(b'not a pinned public server')
        refused = False
        try:
            build.build(bad, root / 'must-not-exist')
        except ValueError:
            refused = True
        assert refused and not (root / 'must-not-exist').exists()
        candidate = root / 'candidate'
        receipt = build.build(baselines, candidate)
        # Existing outputs are never overwritten, even with matching inputs.
        try:
            build.build(baselines, candidate)
        except ValueError:
            pass
        else:
            raise AssertionError('existing output accepted')
        for name, pin in receipt['outputs'].items():
            assert build.sha((candidate / name).read_bytes()) == pin['sha256']
        runs = []
        if protocol_tests:
            baseline = root / 'baseline'
            baseline.mkdir()
            for name in receipt['inputs']:
                # APFS independent-inode clone, only owned public code fixtures.
                subprocess.run(['/bin/cp', '-c', str(baselines / name), str(baseline / name)],
                               capture_output=True, check=True, timeout=20)
            for source in (package / 'tests/support').glob('*.py.fixture'):
                shutil.copyfile(source, baseline / source.name[:-len('.fixture')])
            (root / 'tests').mkdir()
            for source in (package / 'tests/harness').glob('*.py.fixture'):
                shutil.copyfile(source, root / 'tests' / source.name[:-len('.fixture')])
            (root / 'results').mkdir()
            # Materialize only the original nine fixed consumed-snapshot code bytes.
            (root / 'snapshot').mkdir()
            for source in (package / 'tests/snapshot').glob('*.fixture'):
                shutil.copyfile(source, root / 'snapshot' / source.name[:-len('.fixture')])
            commands = [('test_cold_uncertain.py', []),
                        ('test_e32.py', ['candidate',
                         'FixedClosure.test_completed_history_retains_mutable_successor_scene',
                         'FixedClosure.test_repeats_and_cold_actual_installation_status_never_syncs'])]
            for name, args in commands:
                out = subprocess.run(['/usr/bin/python3', '-B', str(root / 'tests' / name), *args],
                                     capture_output=True, timeout=120)
                runs.append({'test': name, 'returncode': out.returncode,
                             'output_sha256': hashlib.sha256(out.stdout + out.stderr).hexdigest()})
                if out.returncode:
                    raise AssertionError('owned protocol test failed: ' + name)
        return {'reconstruction': receipt, 'wrong_preimage_refused': True,
                'existing_output_refused': True, 'protocol_runs': runs,
                'protocol_methods': 3 if protocol_tests else 'NOT_RUN_UNCHANGED_REVIEW_REUSED',
                'scope': 'SOURCE_ONLY; no install/load/actual disposal/business claim'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--baselines', type=Path, required=True)
    parser.add_argument('--protocol-tests', action='store_true')
    parser.add_argument('--receipt', type=Path,
                        help='Optional new owned receipt path, outside immutable package')
    args = parser.parse_args()
    result = verify(args.baselines, args.protocol_tests)
    text = json.dumps(result, indent=2) + '\n'
    if args.receipt:
        with args.receipt.open('x') as target:
            target.write(text)
    print(text)
