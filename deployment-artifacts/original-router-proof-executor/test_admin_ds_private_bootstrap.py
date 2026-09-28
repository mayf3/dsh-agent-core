"""Disposable-only private installation seal/launch tests."""
import hashlib
import importlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
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
