"""Disposable-only private installation seal/launch tests."""
import hashlib
import fcntl
import importlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import threading
import types
import unittest
from unittest.mock import patch


class BootstrapTest(unittest.TestCase):
    HOST = 'FF99ABD5-79A0-5EE0-9E0B-B62671271560'

    def _fixture(self, bootstrap, root):
        package = root / 'package'; package.mkdir()
        state = root / 'receipts'; state.mkdir()
        files = {name: ('fixed-' + name).encode() for name in bootstrap.FIXED_FILES}
        hashes = {name: hashlib.sha256(raw).hexdigest() for name, raw in files.items()}
        seal = {'version': 1, 'operationId': bootstrap.OPERATION_ID,
            'installOperationId': bootstrap.SHIM_OPERATION_ID,
            'hostId': self.HOST, 'fileSha256': hashes,
            'packageSha256': hashlib.sha256(json.dumps(hashes, sort_keys=True,
                separators=(',', ':')).encode()).hexdigest(),
            'pythonSha256': 'a' * 64, 'state': 'INSTALLED_WAITING',
            'replayAllowed': False}
        for name, raw in files.items():
            (package / name).write_bytes(raw)
            (package / name).chmod(0o600)
        (package / bootstrap.SEAL_NAME).write_bytes(json.dumps(seal).encode())
        (package / bootstrap.SEAL_NAME).chmod(0o600)
        receipt = root / 'shim-receipt.json'
        receipt.write_bytes(json.dumps({'operation_id': bootstrap.SHIM_OPERATION_ID,
            'action': 'INSTALL_DEPLOYMENT_SYSTEM', 'state': 'COMMITTED',
            'qualificationPackageSha256': seal['packageSha256'],
            'artifacts': {'deployment_system.py': hashes['deployment_system.py']},
            'ds_status': {'pid': os.getpid()},
            'started': bootstrap.START_TIME - 1,
            'committedAt': bootstrap.START_TIME}).encode())
        receipt.chmod(0o644)
        return package, state, seal, receipt

    def test_default_inert_and_owned_seal_launches_once(self):
        bootstrap = importlib.import_module('admin_ds_private_bootstrap')
        with patch.object(os, 'open', side_effect=AssertionError('PROTECTED_IO')), \
             patch.object(subprocess, 'Popen', side_effect=AssertionError('PROCESS')):
            self.assertIsNone(bootstrap.installation_bootstrap())
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            package, state, seal, receipt = self._fixture(bootstrap, root)
            daemon = root / 'installed-deployment_system.py'
            daemon.write_bytes((package / 'deployment_system.py').read_bytes())
            daemon.chmod(0o555)
            calls = []
            def fake_lock():
                fd = os.open(state / 'mutation.lock', os.O_RDWR | os.O_CREAT, 0o600)
                calls.append('lock')
                return fd
            def fake_popen(argv, **kwargs):
                calls.append('launch')
                self.assertEqual(argv[1:4], ['-I', '-S', '-B'])
                self.assertEqual(argv[4], str(package / 'admin_root_carrier.py'))
                return types.SimpleNamespace(pid=771, poll=lambda: None)
            class RootOS:
                def __getattr__(self, name): return getattr(os, name)
                def geteuid(self): return 0
                def fchown(self, *_): return None
                def _root(self, meta):
                    return types.SimpleNamespace(**{name: getattr(meta, name) for name in
                        ('st_mode', 'st_gid', 'st_nlink', 'st_dev', 'st_ino', 'st_size',
                         'st_mtime_ns', 'st_ctime_ns')}, st_uid=0)
                def fstat(self, fd): return self._root(os.fstat(fd))
                def stat(self, *args, **kwargs): return self._root(os.stat(*args, **kwargs))
            with patch.object(bootstrap, 'QUALIFIER_ACTIVE', True), \
                 patch.object(bootstrap, 'ROOT_HOST_OBSERVER', return_value=self.HOST), \
                 patch.object(bootstrap, 'PACKAGE_DIRECTORY', package), \
                 patch.object(bootstrap, 'STATE_DIRECTORY', state), \
                 patch.object(bootstrap, 'SHIM_RECEIPT', receipt), \
                 patch.object(bootstrap, 'DAEMON', daemon), \
                 patch.object(bootstrap, '_root_metadata', return_value=None), \
                 patch.object(bootstrap, '_python_identity', return_value='a' * 64), \
                 patch.object(bootstrap, 'os', RootOS()), \
                 patch.object(bootstrap, '_parent', side_effect=lambda path:
                    os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)), \
                 patch.object(bootstrap, 'mutation_lock', side_effect=fake_lock,
                              create=True), \
                 patch.object(subprocess, 'Popen', side_effect=fake_popen), \
                 patch.object(bootstrap, '_state', {'attempted': False, 'child': None}):
                committed = json.loads(receipt.read_bytes())
                receipt.write_bytes(json.dumps(dict(committed, state='FAILED')).encode())
                with self.assertRaisesRegex(bootstrap.BootstrapRejected, 'SHIM_COMMIT_UNKNOWN'):
                    bootstrap._committed_install(seal)
                with self.assertRaisesRegex(bootstrap.BootstrapRejected, 'SHIM_COMMIT_UNKNOWN'):
                    bootstrap.installation_bootstrap()
                self.assertFalse(bootstrap._state['attempted'])
                receipt.write_bytes(json.dumps(dict(committed,
                    qualificationPackageSha256='0' * 64)).encode())
                with self.assertRaisesRegex(bootstrap.BootstrapRejected, 'SHIM_COMMIT_UNKNOWN'):
                    bootstrap._committed_install(seal)
                receipt.write_bytes(json.dumps(dict(committed,
                    ds_status={'pid': 123})).encode())
                with self.assertRaisesRegex(bootstrap.BootstrapRejected, 'SHIM_COMMIT_UNKNOWN'):
                    bootstrap._committed_install(seal)
                with patch.object(bootstrap, 'START_TIME', committed['committedAt'] + 1):
                    receipt.write_bytes(json.dumps(committed).encode())
                    with self.assertRaisesRegex(bootstrap.BootstrapRejected,
                                                'SHIM_COMMIT_UNKNOWN'):
                        bootstrap._committed_install(seal)
                receipt.write_bytes(json.dumps(committed).encode())
                self.assertNotIn('launch', calls)
                calls.clear()
                self.assertEqual(bootstrap.installation_bootstrap()['state'], 'STARTED')
                self.assertEqual(calls, ['lock', 'launch'])
                self.assertEqual(json.loads((state / bootstrap.CLAIM_NAME).read_bytes())['state'],
                                 'UNKNOWN')
                with self.assertRaisesRegex(bootstrap.BootstrapRejected, 'NO_REPLAY'):
                    bootstrap.installation_bootstrap()
                with patch.object(bootstrap, '_state', {'attempted': False, 'child': None}), \
                     patch.object(subprocess, 'Popen', side_effect=AssertionError('REPLAY')):
                    with self.assertRaisesRegex(bootstrap.BootstrapRejected, 'NO_REPLAY'):
                        bootstrap.installation_bootstrap()

    def test_unknown_intent_waits_for_committed_receipt_without_consuming_attempt(self):
        bootstrap = importlib.import_module('admin_ds_private_bootstrap')
        unknown = json.dumps({'operation_id': bootstrap.SHIM_OPERATION_ID,
            'action': 'INSTALL_DEPLOYMENT_SYSTEM', 'state': 'UNKNOWN',
            'replayAllowed': False}).encode()
        committed = json.dumps({'operation_id': bootstrap.SHIM_OPERATION_ID,
            'action': 'INSTALL_DEPLOYMENT_SYSTEM', 'state': 'COMMITTED'}).encode()
        seen = []
        responses = iter([unknown, unknown, committed])
        with patch.object(bootstrap, 'QUALIFIER_ACTIVE', True), \
             patch.object(bootstrap, '_read_sealed', side_effect=lambda *_a, **_k:
                          next(responses)), \
             patch.object(bootstrap, 'installation_bootstrap', side_effect=lambda:
                          seen.append('launch') or {'state': 'STARTED'}), \
             patch.object(bootstrap.time, 'monotonic', side_effect=range(10)), \
             patch.object(bootstrap.time, 'sleep', side_effect=lambda _n: seen.append('wait')):
            self.assertEqual(bootstrap.wait_for_committed_install()['state'], 'STARTED')
        self.assertEqual(seen, ['wait', 'wait', 'launch'])

        with patch.object(bootstrap, 'QUALIFIER_ACTIVE', True), \
             patch.object(bootstrap, '_read_sealed', return_value=unknown), \
             patch.object(bootstrap, 'installation_bootstrap', side_effect=AssertionError('launch')), \
             patch.object(bootstrap.time, 'monotonic', side_effect=range(0, 500, 60)), \
             patch.object(bootstrap.time, 'sleep', return_value=None):
            with self.assertRaisesRegex(bootstrap.BootstrapRejected, 'TIMEOUT'):
                bootstrap.wait_for_committed_install()

        with patch.object(bootstrap, 'QUALIFIER_ACTIVE', True), \
             patch.object(bootstrap, '_read_sealed', return_value=committed), \
             patch.object(bootstrap, 'installation_bootstrap', side_effect=
                          bootstrap.BootstrapRejected('ADMIN_INSTALL_LOCK_BUSY')), \
             patch.object(bootstrap.time, 'monotonic', side_effect=range(0, 500, 60)), \
             patch.object(bootstrap.time, 'sleep', return_value=None):
            with self.assertRaisesRegex(bootstrap.BootstrapRejected, 'TIMEOUT'):
                bootstrap.wait_for_committed_install()

        wrong = json.dumps({'operation_id': 'wrong',
            'action': 'INSTALL_DEPLOYMENT_SYSTEM', 'state': 'COMMITTED'}).encode()
        with patch.object(bootstrap, 'QUALIFIER_ACTIVE', True), \
             patch.object(bootstrap, '_read_sealed', return_value=wrong), \
             patch.object(bootstrap, 'installation_bootstrap', side_effect=AssertionError('launch')):
            with self.assertRaisesRegex(bootstrap.BootstrapRejected, 'COMMIT_UNKNOWN'):
                bootstrap.wait_for_committed_install()

    def test_real_two_process_canonical_flock_handoff_rechecks_daemon(self):
        bootstrap = importlib.import_module('admin_ds_private_bootstrap')
        class Failure(Exception):
            pass

        class RootOS:
            def __getattr__(self, name): return getattr(os, name)
            def geteuid(self): return 0
            def fchown(self, *_): return None
            def _root(self, meta):
                return types.SimpleNamespace(**{name: getattr(meta, name) for name in
                    ('st_mode', 'st_gid', 'st_nlink', 'st_dev', 'st_ino', 'st_size',
                     'st_mtime_ns', 'st_ctime_ns')}, st_uid=0)
            def fstat(self, fd): return self._root(os.fstat(fd))
            def stat(self, *args, **kwargs): return self._root(os.stat(*args, **kwargs))

        for changed in (False, True):
            with self.subTest(changed=changed), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                package, state, seal, receipt = self._fixture(bootstrap, root)
                daemon = root / 'installed-deployment_system.py'
                daemon.write_bytes((package / 'deployment_system.py').read_bytes())
                daemon.chmod(0o555)
                lock_path = state / 'mutation.lock'
                ready_read, ready_write = os.pipe()
                release_read, release_write = os.pipe()
                child_pid = os.fork()
                if child_pid == 0:
                    try:
                        os.close(ready_read); os.close(release_write)
                        fd = os.open(lock_path, os.O_RDWR | os.O_CREAT, 0o600)
                        fcntl.flock(fd, fcntl.LOCK_EX)
                        os.write(ready_write, b'R')
                        os.read(release_read, 1)
                        if changed:
                            daemon.chmod(0o600)
                            daemon.write_bytes(b'changed-daemon')
                            daemon.chmod(0o555)
                        fcntl.flock(fd, fcntl.LOCK_UN)
                        os.close(fd)
                        os._exit(0)
                    except BaseException:
                        os._exit(1)
                os.close(ready_write); os.close(release_read)
                launched = []
                timer = None
                try:
                    self.assertEqual(os.read(ready_read, 1), b'R')
                    def real_lock():
                        fd = os.open(lock_path, os.O_RDWR | os.O_CREAT, 0o600)
                        try:
                            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
                        except BlockingIOError as exc:
                            os.close(fd)
                            raise Failure('MUTATION_ALREADY_RUNNING') from exc
                        return fd
                    timer = threading.Timer(0.2, lambda: os.write(release_write, b'X'))
                    timer.start()
                    with patch.object(bootstrap, 'QUALIFIER_ACTIVE', True), \
                         patch.object(bootstrap, 'ROOT_HOST_OBSERVER', return_value=self.HOST), \
                         patch.object(bootstrap, 'PACKAGE_DIRECTORY', package), \
                         patch.object(bootstrap, 'STATE_DIRECTORY', state), \
                         patch.object(bootstrap, 'SHIM_RECEIPT', receipt), \
                         patch.object(bootstrap, 'DAEMON', daemon), \
                         patch.object(bootstrap, '_root_metadata', return_value=None), \
                         patch.object(bootstrap, '_python_identity', return_value='a' * 64), \
                         patch.object(bootstrap, 'os', RootOS()), \
                         patch.object(bootstrap, '_parent', side_effect=lambda path:
                            os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)), \
                         patch.object(bootstrap, 'mutation_lock', side_effect=real_lock,
                                      create=True), \
                         patch.object(bootstrap, 'Failure', Failure, create=True), \
                         patch.object(subprocess, 'Popen', side_effect=lambda *_a, **_k:
                            launched.append('once') or types.SimpleNamespace(poll=lambda: None)), \
                         patch.object(bootstrap, '_state', {'attempted': False, 'child': None}):
                        if changed:
                            with self.assertRaisesRegex(bootstrap.BootstrapRejected,
                                                        'DAEMON_CHANGED'):
                                bootstrap.wait_for_committed_install()
                            self.assertEqual(launched, [])
                            self.assertFalse((state / bootstrap.CLAIM_NAME).exists())
                        else:
                            self.assertEqual(bootstrap.wait_for_committed_install()['state'],
                                             'STARTED')
                            self.assertEqual(launched, ['once'])
                            self.assertTrue((state / bootstrap.CLAIM_NAME).exists())
                finally:
                    if timer is not None: timer.join(timeout=1)
                    try: os.write(release_write, b'X')
                    except BrokenPipeError: pass
                    os.close(ready_read); os.close(release_write)
                    _, status = os.waitpid(child_pid, 0)
                    self.assertEqual(os.waitstatus_to_exitcode(status), 0)

    def test_closed_seal_rejects_unknown_and_ambiguous(self):
        bootstrap = importlib.import_module('admin_ds_private_bootstrap')
        with tempfile.TemporaryDirectory() as directory:
            _, _, seal, _ = self._fixture(bootstrap, Path(directory))
            self.assertEqual(bootstrap._binding(seal), seal)
            variants = [dict(seal, hostId=None), dict(seal, version=True),
                        dict(seal, operationId='wrong'),
                        dict(seal, installOperationId='wrong'),
                        dict(seal, packageSha256='0' * 64),
                        dict(seal, replayAllowed=True), dict(seal, state='UNKNOWN'),
                        dict(seal, callerPath='/tmp/forbidden')]
            for candidate in variants:
                with self.subTest(candidate=candidate), \
                     self.assertRaises(bootstrap.BootstrapRejected):
                    bootstrap._binding(candidate)


if __name__ == '__main__':
    unittest.main()
