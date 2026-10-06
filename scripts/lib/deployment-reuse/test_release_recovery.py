"""Release-recovery rehearsal on the exact installed DS (TEST_MODE, zero prod effects).

Covers the rehearsal items the installed-reuse test does not:
  concurrent callers serialize on one mutation lock; an operation id is
  consumed exactly once (replay refused); a FAILED deploy (preimage mismatch)
  leaves target B intact and the next good deploy still completes; rollback
  back to B and the "business read" of the target passes afterwards.

Source of truth: /usr/local/libexec/agent-deploy-system/deployment_system.py,
sha256-pinned (PIN) via the artifacts snapshot copy — see test_installed_reuse.
"""
import fcntl
import hashlib
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import threading
import time
import unittest

from receipt import _observe

SOURCE = Path('/Users/yanfenma/workspace/artifacts/DEPLOYMENT_BACKLOG/deployment-reuse-installed-20260929-v1/installed-deployment_system.py')
PIN = '95dc02f87106ca9e131839e6d9843a65adcff6018bfbf47725e9241b4e80961d'
sha = lambda b: hashlib.sha256(b).hexdigest()

def request(sock, payload, timeout=20):
    with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as s:
        s.settimeout(timeout); s.connect(str(sock)); s.sendall(json.dumps(payload).encode() + b'\n')
        data = b''
        while b'\n' not in data:
            block = s.recv(65536)
            if not block: break
            data += block
        return json.loads(data)

class ReleaseRecovery(unittest.TestCase):
    def test_concurrency_replay_failure_rollback(self):
        self.assertEqual(sha(SOURCE.read_bytes()), PIN)
        with tempfile.TemporaryDirectory(prefix='ds-recovery-', dir='/tmp') as folder:
            root = Path(folder); state = root / 'state'; config = root / 'config'; target = root / 'workflow.js'; sock = root / 'ds.sock'
            state.mkdir(); config.mkdir(); target.write_bytes(b'A\n')
            (config / 'authorized-owner-uid').write_text(str(os.getuid()))
            registry = {'version': 1, 'units': {'workflow': {'kind': 'file', 'target': str(target), 'uid': os.getuid(), 'gid': os.getgid(), 'mode': '0644', 'restart': 'agent-core-runtime'}}}
            reg = config / 'deployment-registry.json'; reg.write_text(json.dumps(registry, sort_keys=True, separators=(',', ':')))
            env = {'PATH': '/usr/bin:/bin', 'DS_TEST_MODE': '1', 'DS_FAKE_HEALTH': '1', 'DS_OWNER_UID': str(os.getuid()), 'DS_STATE_ROOT': str(state), 'DS_SOCK': str(sock), 'DS_CONFIG_DIR': str(config), 'DS_REGISTRY': str(reg), 'DS_GEN_ROOT': str(root / 'generations'), 'DS_INSTALL_DIR': str(root / 'install')}
            log = (root / 'daemon.log').open('wb')
            daemon = subprocess.Popen([sys.executable, str(SOURCE)], env=env, stdout=log, stderr=log)
            try:
                deadline = time.monotonic() + 15
                while not sock.exists() and time.monotonic() < deadline:
                    self.assertIsNone(daemon.poll()); time.sleep(.02)
                self.assertTrue(sock.exists())
                def observe(op): return _observe(state / 'receipts', op, 'workflow', os.getuid(), fixture=True)
                def terminal(op):
                    end = time.monotonic() + 15
                    while time.monotonic() < end:
                        value = observe(op)
                        if value['observation'] == 'MATCH': return value
                        time.sleep(.02)
                    self.fail('receipt not reconciled: ' + str(value))
                def deploy_payload(op, contents, bad_preimage=False):
                    inbox = state / 'inbox' / op; inbox.mkdir(parents=True, exist_ok=True); (inbox / 'artifact').write_bytes(contents)
                    return {'action': 'DEPLOY', 'operation_id': op, 'unit': 'workflow',
                            'expected_preimage_sha256': ('0' * 64 if bad_preimage else sha(target.read_bytes())),
                            'artifact_sha256': sha(contents), 'expected_tree_sha256': 'a' * 64, 'artifact_tree_sha256': 'b' * 64}

                # B baseline
                self.assertTrue(request(sock, deploy_payload('r-version-b', b'B\n'))['ok'])
                self.assertEqual(terminal('r-version-b')['state'], 'COMPLETE')
                self.assertEqual(target.read_bytes(), b'B\n')

                # two concurrent callers racing one mutation lock: BOTH submitted the
                # same preimage (B), so the second one to reach the lock MUST fail
                # closed on PREIMAGE_MISMATCH (its assumed preimage no longer lives),
                # leaving exactly one effective mutation and an intact target.
                results = {}
                def caller(op, content): results[op] = request(sock, deploy_payload(op, content))
                t1 = threading.Thread(target=caller, args=('r-concurrent-c1', b'C1\n'))
                t2 = threading.Thread(target=caller, args=('r-concurrent-c2', b'C2\n'))
                t1.start(); t2.start(); t1.join(30); t2.join(30)
                self.assertTrue(all('ok' in r for r in results.values()), results)
                c1 = terminal('r-concurrent-c1'); c2 = terminal('r-concurrent-c2')
                states = {c1['state'], c2['state']}
                self.assertEqual(states, {'COMPLETE', 'FAILED'},
                                 f'expected exactly one effective mutation, got {states}')
                winner = c1 if c1['state'] == 'COMPLETE' else c2
                self.assertIn(target.read_bytes(), (b'C1\n', b'C2\n'))
                self.assertEqual(target.read_bytes(), b'C1\n' if winner['operation_id'] == 'r-concurrent-c1' else b'C2\n',
                                 'target must equal the one COMPLETE caller\'s artifact, never an interleaved byte state')
                # the FAILED one is honestly reconciled as FAILED (never silently COMPLETE)
                loser = c2 if winner is c1 else c1
                self.assertEqual(loser['state'], 'FAILED')

                # replay of a consumed operation id must not take a new artifact
                replay_payload = deploy_payload('r-version-b', b'EVIL\n')  # id already consumed
                replay = request(sock, replay_payload)
                self.assertFalse(replay.get('ok', True), 'consumed operation id must not be re-consumed')
                self.assertNotEqual(target.read_bytes(), b'EVIL\n')

                # failure path: bad preimage fails the operation, target untouched
                bad = request(sock, deploy_payload('r-fail-1', b'BROKEN\n', bad_preimage=True))
                self.assertFalse(bad.get('ok', True), 'preimage mismatch must fail closed')
                self.assertNotEqual(target.read_bytes(), b'BROKEN\n')
                failed_receipt = observe('r-fail-1')
                self.assertIn(failed_receipt['observation'], ('MATCH', 'UNKNOWN'))  # reconciled or honestly unknown
                if failed_receipt['observation'] == 'MATCH':
                    self.assertEqual(failed_receipt['state'], 'FAILED')

                # business continues after the failure: a good deploy completes
                self.assertTrue(request(sock, deploy_payload('r-version-d', b'D\n'))['ok'])
                self.assertEqual(terminal('r-version-d')['state'], 'COMPLETE')
                self.assertEqual(target.read_bytes(), b'D\n')

                # rollback semantics: generation:X restores X's recorded PREIMAGE
                # (undo X). Walk the chain back D -> C1 -> B, then the business
                # readback of the rolled-back target must pass.
                result = request(sock, {'action': 'ROLLBACK', 'operation_id': 'r-rollback-undo-d', 'unit': 'workflow', 'generation': 'r-version-d'})
                self.assertTrue(result['ok'])
                self.assertEqual(terminal('r-rollback-undo-d')['state'], 'COMPLETE')
                result = request(sock, {'action': 'ROLLBACK', 'operation_id': 'r-rollback-to-b', 'unit': 'workflow', 'generation': 'r-concurrent-c1'})
                self.assertTrue(result['ok'])
                self.assertEqual(terminal('r-rollback-to-b')['state'], 'COMPLETE')
                self.assertEqual(target.read_bytes(), b'B\n')  # the business readback of the rolled-back service
                self.assertIsNone(daemon.poll())
                print(json.dumps({'installedSha256': PIN, 'concurrentCallers': sorted(results), 'replayRefused': True,
                                  'failurePath': 'FAILED-closed-target-intact', 'postFailureDeploy': 'r-version-d COMPLETE',
                                  'rollback': 'undo-d then undo-c1 -> B COMPLETE', 'productionEffects': 0}, sort_keys=True))
            finally:
                daemon.terminate()
                try: daemon.wait(timeout=5)
                except subprocess.TimeoutExpired: daemon.kill(); daemon.wait()
                log.close()

if __name__ == '__main__':
    unittest.main()
