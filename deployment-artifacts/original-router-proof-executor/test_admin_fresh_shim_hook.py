"""No host dispatch: exact self-update lifecycle invokes one root producer."""
import hashlib
import fcntl
from contextlib import ExitStack
import json
import os
from pathlib import Path
import re
import tempfile
import threading
import types
import unittest
from unittest.mock import patch

import admin_fresh_shim_hook as hook


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':')).encode()


class FreshShimHookTests(unittest.TestCase):
    def test_two_process_canonical_lock_contention_is_sticky_unknown(self):
        """The reviewed producer's nonblocking flock cannot deadlock the hook."""
        self.assertIn('lock = ds.mutation_lock()',
                      (Path(__file__).parent / 'admin_fresh_producer.py').read_text())
        with tempfile.TemporaryDirectory(prefix='admin-fresh-flock-') as directory:
            root = Path(directory)
            receipts = root / 'receipts'; receipts.mkdir(mode=0o755)
            installed = root / 'installed'; installed.mkdir()
            shim = installed / 'deploy_shim.py'; shim.write_bytes(b'exact-shim')
            update_id = 'shim-hr-admin-fresh-20260928-v1'
            update = {'operation_id': update_id, 'action': 'SERVICE_UPDATE',
                      'state': 'COMMITTED', 'generation': update_id,
                      'restart': 'self', 'artifacts':
                      {'deploy_shim.py': hashlib.sha256(b'exact-shim').hexdigest()}}
            (receipts / (update_id + '.json')).write_bytes(canonical(update))
            lock_path = root / 'canonical.lock'
            lock_path.touch()
            ready_r, ready_w = os.pipe()
            release_r, release_w = os.pipe()
            child = os.fork()
            if child == 0:
                os.close(ready_r); os.close(release_w)
                with lock_path.open('rb') as lock_file:
                    fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)
                    os.write(ready_w, b'held')
                    os.read(release_r, 1)
                os._exit(0)
            os.close(ready_w); os.close(release_r)
            self.assertEqual(os.read(ready_r, 4), b'held')
            os.close(ready_r)
            marker = receipts / (hook.ADMIN_FRESH_OPERATION_ID + '.json')
            result = []
            def produce():
                with lock_path.open('rb') as lock_file:
                    fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
                    result.append('canonical-acquired')
                return {'exact': 'observed'}
            def write_receipt(operation, value):
                marker.write_bytes(canonical(value))
            pins = {name: 'b' * 64 for name in
                    ('deployment_system.py', 'ds_client.py', 'plist',
                     'deployment-registry.json', 'node-runtime', 'python-runtime')}
            staged = {name: 1 for name in
                      ('deployment_system.py', 'ds_client.py', 'plist',
                       'deployment-registry.json')}
            try:
                patches = {'ADMIN_FRESH_HOOK_ACTIVE': True,
                           'ADMIN_FRESH_ROOT_UID': os.geteuid(),
                           'ADMIN_FRESH_SELF_UPDATE_ID': update_id,
                           'ADMIN_FRESH_CAPTURE_ID': 'capture-once',
                           'ADMIN_FRESH_ADMISSION_ID': 'admission-once',
                           'ADMIN_FRESH_OLD_DS_SHA256': 'a' * 64,
                           'ADMIN_FRESH_OLD_SHA256': {name: 'a' * 64 for name in staged},
                           'ADMIN_FRESH_NEW_SHA256': pins,
                           'ADMIN_FRESH_STAGED_SIZE': staged,
                           'ADMIN_FRESH_OWNER_UID': 502,
                           'AUTHORIZED_OWNER_UID': 502, 'TEST_MODE': False,
                           'SERVICE_INSTALL_DIR': str(installed),
                           'ADMIN_FRESH_FACTORY': lambda binding:
                                types.SimpleNamespace(produce=produce),
                           'ADMIN_FRESH_BINDER': lambda value, owner, finish:
                                finish(hashlib.sha256(canonical(value)).hexdigest()),
                           'receipt_path': lambda op: str(receipts / (op + '.json')),
                           'service_current': lambda: {'generation': update_id},
                           'OP_ID': re.compile(r'[a-z0-9-]+'),
                           'canonical': canonical, 'write_receipt': write_receipt,
                           'require': lambda ok, code: None if ok else
                                (_ for _ in ()).throw(ValueError(code))}
                with ExitStack() as stack:
                    for name, value in patches.items():
                        stack.enter_context(patch.object(hook, name, value, create=True))
                    failures = []
                    def invoke():
                        try:
                            hook.run_admin_fresh_hook()
                        except BlockingIOError as exc:
                            failures.append(exc)
                    worker = threading.Thread(target=invoke)
                    worker.start()
                    worker.join(2)
                    self.assertFalse(worker.is_alive())
                    self.assertTrue(marker.exists())
                    self.assertEqual(json.loads(marker.read_bytes())['state'], 'UNKNOWN')
                    self.assertEqual(result, [])
                    self.assertEqual(len(failures), 1)
                    os.write(release_w, b'x')
                    with self.assertRaises(FileExistsError):
                        hook.run_admin_fresh_hook()
                    self.assertEqual(result, [])
            finally:
                os.close(release_w)
                os.waitpid(child, 0)

    def test_inert_and_exact_self_update_before_one_durable_intent(self):
        self.assertIsNone(hook.run_admin_fresh_hook())
        with tempfile.TemporaryDirectory(prefix='admin-fresh-hook-') as directory:
            root = Path(directory)
            receipts = root / 'receipts'; receipts.mkdir(mode=0o755)
            installed = root / 'installed'; installed.mkdir()
            shim = installed / 'deploy_shim.py'; shim.write_bytes(b'exact-shim')
            update_id = 'shim-hr-admin-fresh-20260928-v1'
            update = {'operation_id': update_id, 'action': 'SERVICE_UPDATE',
                      'state': 'COMMITTED', 'generation': update_id,
                      'restart': 'self', 'artifacts':
                      {'deploy_shim.py': hashlib.sha256(b'exact-shim').hexdigest()}}
            update_path = receipts / (update_id + '.json')
            update_path.write_bytes(canonical(update))
            calls = []
            fail_after_intent = [False]
            marker = receipts / (hook.ADMIN_FRESH_OPERATION_ID + '.json')
            def produce():
                self.assertEqual(json.loads(marker.read_bytes())['state'], 'UNKNOWN')
                calls.append('produce')
                if fail_after_intent[0]:
                    raise RuntimeError('synthetic post-intent failure')
                return {'exact': 'observed'}
            def write_receipt(operation, value):
                self.assertEqual(operation, hook.ADMIN_FRESH_OPERATION_ID)
                marker.write_bytes(canonical(value))
            pins = {name: 'b' * 64 for name in
                    ('deployment_system.py', 'ds_client.py', 'plist',
                     'deployment-registry.json', 'node-runtime', 'python-runtime')}
            staged = {name: 1 for name in
                      ('deployment_system.py', 'ds_client.py', 'plist',
                       'deployment-registry.json')}
            patches = {'ADMIN_FRESH_HOOK_ACTIVE': True,
                       'ADMIN_FRESH_ROOT_UID': os.geteuid(),
                       'ADMIN_FRESH_SELF_UPDATE_ID': update_id,
                       'ADMIN_FRESH_CAPTURE_ID': 'capture-once',
                       'ADMIN_FRESH_ADMISSION_ID': 'admission-once',
                       'ADMIN_FRESH_OLD_DS_SHA256': 'a' * 64,
                       'ADMIN_FRESH_OLD_SHA256': {name: 'a' * 64 for name in staged},
                       'ADMIN_FRESH_NEW_SHA256': pins,
                       'ADMIN_FRESH_STAGED_SIZE': staged,
                       'ADMIN_FRESH_OWNER_UID': 502,
                       'AUTHORIZED_OWNER_UID': 502, 'TEST_MODE': False,
                       'SERVICE_INSTALL_DIR': str(installed),
                       'ADMIN_FRESH_FACTORY': lambda binding:
                            types.SimpleNamespace(produce=produce),
                       'ADMIN_FRESH_BINDER': lambda value, owner, finish:
                            finish(hashlib.sha256(canonical(value)).hexdigest()),
                       'receipt_path': lambda op: str(receipts / (op + '.json')),
                       'service_current': lambda: {'generation': update_id},
                       'OP_ID': re.compile(r'[a-z0-9-]+'),
                       'canonical': canonical, 'write_receipt': write_receipt,
                       'require': lambda ok, code: None if ok else
                            (_ for _ in ()).throw(ValueError(code))}
            with ExitStack() as stack:
                for name, value in patches.items():
                    stack.enter_context(patch.object(hook, name, value, create=True))
                result = hook.run_admin_fresh_hook()
                self.assertEqual(result['state'], 'COMMITTED')
                self.assertEqual(calls, ['produce'])
                with self.assertRaises(FileExistsError):
                    hook.run_admin_fresh_hook()
                self.assertEqual(calls, ['produce'])
                marker.unlink()
                update['artifacts']['deploy_shim.py'] = '0' * 64
                update_path.write_bytes(canonical(update))
                with self.assertRaisesRegex(ValueError,
                                            'ADMIN_FRESH_HOOK_SELF_UPDATE_UNKNOWN'):
                    hook.run_admin_fresh_hook()
                self.assertFalse(marker.exists())
                update['artifacts']['deploy_shim.py'] = hashlib.sha256(
                    b'exact-shim').hexdigest()
                update_path.write_bytes(canonical(update))
                fail_after_intent[0] = True
                with self.assertRaisesRegex(RuntimeError, 'post-intent'):
                    hook.run_admin_fresh_hook()
                self.assertEqual(json.loads(marker.read_bytes())['state'], 'UNKNOWN')
                with self.assertRaises(FileExistsError):
                    hook.run_admin_fresh_hook()


if __name__ == '__main__':
    unittest.main()
