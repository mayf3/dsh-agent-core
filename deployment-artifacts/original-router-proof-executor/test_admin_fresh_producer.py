"""Disposable original-root fresh-input producer boundaries."""
import hashlib
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from contextlib import ExitStack
from types import SimpleNamespace

import admin_fresh_producer as producer
import admin_final_binding as binder


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


class FakeDS:
    def __init__(self, app_sha, capture='capture-fixed', admitted=True):
        self.app_sha = app_sha
        self.capture = capture
        self.admitted = admitted
        self.reads = 0
        self.lock_fd = None

    def mutation_lock(self):
        return os.dup(self.lock_fd)

    def load_registry(self):
        return {'fixed': True}, 'a' * 64

    def unit_from_registry(self, registry, name):
        assert name == 'scheduler-whole-main'
        return {'kind': 'tree', 'target': str(producer.APP),
                'preserve': ['node_modules'], 'uid': 505, 'gid': 601}

    def dir_tree_state(self, path, allowed_root, excluded):
        self.reads += 1
        assert path == str(producer.APP) and allowed_root == path
        assert excluded == ['node_modules']
        return [], self.app_sha, 100

    def _verified_admitted_capture(self, capture, generation, target):
        assert capture == self.capture and generation == 'a' * 64
        if not self.admitted: raise RuntimeError('not admitted')
        return '/disposable-generation', {'tree_sha256': self.app_sha}

    def read_verified(self, path):
        assert path == '/disposable-generation/rollback-pointer.json'
        return json.dumps({'operation_id': 'admission-fixed'}).encode(), 'c' * 64

    def read_receipt(self, operation):
        return {'state': 'ADMITTED', 'operation_id': operation,
                'capture_operation_id': self.capture, 'unit': 'scheduler-whole-main'}


class FreshProducerTests(unittest.TestCase):
    def _staged_metadata(self, stack, owned_paths, owner_uid, root_gid_paths=()):
        """Model distinct root and authorized-owner metadata without chown."""
        real_stat, real_fstat = os.stat, os.fstat
        identities = {(real_stat(path).st_dev, real_stat(path).st_ino)
                      for path in owned_paths}
        root_gid = {(real_stat(path).st_dev, real_stat(path).st_ino)
                    for path in root_gid_paths}
        def converted(value):
            key = (value.st_dev, value.st_ino)
            if key not in identities and key not in root_gid:
                return value
            fields = ('st_dev', 'st_ino', 'st_mode', 'st_uid', 'st_gid',
                      'st_nlink', 'st_size', 'st_mtime_ns', 'st_ctime_ns')
            row = {name: getattr(value, name) for name in fields}
            if key in identities:
                row['st_uid'] = owner_uid
            if key in root_gid:
                row['st_gid'] = 0
            return SimpleNamespace(**row)
        stack.enter_context(patch.object(os, 'stat',
            side_effect=lambda *args, **kw: converted(real_stat(*args, **kw))))
        stack.enter_context(patch.object(os, 'fstat',
            side_effect=lambda *args, **kw: converted(real_fstat(*args, **kw))))

    def test_fixed_staged_owner_distinct_from_root(self):
        with tempfile.TemporaryDirectory(prefix='admin-stage-') as directory:
            root = Path(directory)
            state = root / 'state'; state.mkdir(); state.chmod(0o770)
            inbox = state / 'inbox'; inbox.mkdir(mode=0o700)
            operation = inbox / producer.INSTALL_OPERATION_ID
            operation.mkdir(mode=0o700)
            staged = operation / 'deployment_system.py'
            raw = b'exact-staged-daemon'
            staged.write_bytes(raw)
            staged.chmod(0o600)
            owner = os.geteuid() + 1
            with ExitStack() as stack:
                self._staged_metadata(stack, (inbox, operation, staged), owner,
                                      (state,))
                stack.enter_context(patch.object(producer, 'ROOT_UID', os.geteuid()))
                stack.enter_context(patch.object(producer, 'SHIM_INBOX', operation))
                stack.enter_context(patch.object(producer, 'SHIM_STATE_ROOT', state))
                stack.enter_context(patch.object(producer, 'SHIM_INBOX_OWNER_UID', owner))
                stack.enter_context(patch.object(producer, 'REVIEWED_NEW_SHA256',
                    {'deployment_system.py': sha(raw)}))
                stack.enter_context(patch.object(producer, 'REVIEWED_STAGED_SIZE',
                    {'deployment_system.py': len(raw)}))
                self.assertEqual(producer._read_staged('deployment_system.py'), raw)
                with patch.object(producer, 'REVIEWED_STAGED_SIZE',
                                  {'deployment_system.py': len(raw) + 1}):
                    with self.assertRaisesRegex(producer.FreshRejected,
                                                'ADMIN_FRESH_STAGE_CUSTODY'):
                        producer._read_staged('deployment_system.py')
                with patch.object(producer, 'SHIM_INBOX_OWNER_UID', owner + 1):
                    with self.assertRaisesRegex(producer.FreshRejected,
                                                'ADMIN_FRESH_STAGE_CUSTODY'):
                        producer._read_staged('deployment_system.py')
            with ExitStack() as stack:
                self._staged_metadata(stack, (inbox, operation), owner, (state,))
                for key, value in {
                    'ROOT_UID': os.geteuid(), 'SHIM_INBOX': operation,
                    'SHIM_STATE_ROOT': state, 'SHIM_INBOX_OWNER_UID': owner,
                    'REVIEWED_NEW_SHA256': {'deployment_system.py': sha(raw)},
                    'REVIEWED_STAGED_SIZE': {'deployment_system.py': len(raw)},
                }.items():
                    stack.enter_context(patch.object(producer, key, value))
                with self.assertRaisesRegex(producer.FreshRejected,
                                            'ADMIN_FRESH_STAGE_CUSTODY'):
                    producer._read_staged('deployment_system.py')

    def test_staged_operation_alias_rejected(self):
        with tempfile.TemporaryDirectory(prefix='admin-stage-') as directory:
            root = Path(directory)
            state = root / 'state'; state.mkdir(); state.chmod(0o770)
            inbox = state / 'inbox'; inbox.mkdir(mode=0o700)
            real = root / 'elsewhere'; real.mkdir()
            (inbox / producer.INSTALL_OPERATION_ID).symlink_to(real,
                target_is_directory=True)
            owner = os.geteuid() + 1
            with ExitStack() as stack:
                self._staged_metadata(stack, (inbox,), owner, (state,))
                for key, value in {
                    'ROOT_UID': os.geteuid(), 'SHIM_STATE_ROOT': state,
                    'SHIM_INBOX': inbox / producer.INSTALL_OPERATION_ID,
                    'SHIM_INBOX_OWNER_UID': owner,
                    'REVIEWED_NEW_SHA256': {'deployment_system.py': sha(b'valid')},
                    'REVIEWED_STAGED_SIZE': {'deployment_system.py': 5},
                }.items():
                    stack.enter_context(patch.object(producer, key, value))
                with self.assertRaises(OSError):
                    producer._read_staged('deployment_system.py')

    def test_fixed_python_hardlink_only_and_identity(self):
        with tempfile.TemporaryDirectory(prefix='admin-python-') as directory:
            root = Path(directory)
            python = root / 'python3'; python.write_bytes(b'exact-python')
            python.chmod(0o755)
            os.link(python, root / 'same-inode')
            with patch.object(producer, 'ROOT_UID', os.geteuid()), \
                 patch.object(producer, 'PYTHON_PATH', python), \
                 patch.object(producer, 'REVIEWED_NEW_SHA256',
                              {'python-runtime': sha(b'exact-python')}):
                self.assertEqual(producer._read_owned(python), b'exact-python')
                with self.assertRaisesRegex(producer.FreshRejected,
                                            'ADMIN_FRESH_CUSTODY'):
                    producer._read_owned(root / 'same-inode')
                python.write_bytes(b'wrong-bytes')
                with self.assertRaisesRegex(producer.FreshRejected,
                                            'ADMIN_FRESH_PYTHON_CHANGED'):
                    producer._read_owned(python)
                python.write_bytes(b'exact-python')
                original = os.pread
                def renamed(fd, count, offset):
                    raw = original(fd, count, offset)
                    python.rename(root / 'displaced')
                    python.write_bytes(b'exact-python')
                    return raw
                with patch.object(os, 'pread', side_effect=renamed):
                    with self.assertRaisesRegex(producer.FreshRejected,
                                                'ADMIN_FRESH_CHANGED'):
                        producer._read_owned(python)

    def _case(self, mutation=None):
        with tempfile.TemporaryDirectory(prefix='admin-fresh-') as directory:
            root = Path(directory)
            app = root / 'app'; app.mkdir()
            old = root / 'old'; old.mkdir()
            state = root / 'state'; state.mkdir(); state.chmod(0o770)
            inbox = state / 'inbox'; inbox.mkdir(mode=0o700)
            staged = inbox / producer.INSTALL_OPERATION_ID
            staged.mkdir(mode=0o700)
            other = root / 'other'; other.mkdir()
            out = root / 'fresh'
            lock = root / 'mutation.lock'; lock.write_bytes(b'')
            old_bytes = {name: ('old-' + name).encode() for name in producer.OLD_PATHS}
            new_bytes = {name: ('new-' + name).encode() for name in producer.NEW_NAMES}
            for name, raw in old_bytes.items(): (old / name).write_bytes(raw)
            new_paths = {name: (staged if name in producer.OLD_PATHS else other) / name
                         for name in new_bytes}
            for name, raw in new_bytes.items(): new_paths[name].write_bytes(raw)
            owner = os.geteuid() + 1
            ds = FakeDS(sha(b'current-app'))
            ds.lock_fd = os.open(lock, os.O_RDONLY)
            try:
                with ExitStack() as stack:
                    self._staged_metadata(stack,
                        (inbox, staged, *(staged / name for name in producer.OLD_PATHS)),
                        owner, (state,))
                    for key, value in {
                        'ACTIVE': True, 'CAPTURE_ID': ds.capture,
                        'ADMISSION_ID': 'admission-fixed',
                        'REVIEWED_DS_SHA256': sha(old_bytes['deployment_system.py']),
                        'REVIEWED_NEW_SHA256': {name: sha(raw) for name, raw in new_bytes.items()},
                        'APP': app, 'OLD_PATHS': {name: old / name for name in old_bytes},
                        'NEW_PATHS': new_paths,
                        'SHIM_STATE_ROOT': state, 'SHIM_INBOX': staged,
                        'SHIM_INBOX_OWNER_UID': owner,
                        'REVIEWED_STAGED_SIZE': {name: len(new_bytes[name])
                                                 for name in producer.OLD_PATHS},
                        'PYTHON_PATH': other / 'python-runtime',
                        'NODE_PATH': other / 'node-runtime',
                        'SHIM_SCRIPT_PATH': other / 'deploy_shim.py',
                        'FRESH_DIRECTORY': out,
                        'ROOT_UID': os.geteuid(),
                    }.items():
                        stack.enter_context(patch.object(producer, key, value))
                    stack.enter_context(patch.object(producer, '_load_backend', return_value=ds))
                    stack.enter_context(patch.object(producer, '_observe_host',
                                                    return_value=producer.HOST_ID))
                    if mutation:
                        mutation(ds, root, stack)
                    yield ds, root, out
            finally:
                os.close(ds.lock_fd)

    def test_default_inert_before_backend_or_host_io(self):
        with patch.object(producer, '_load_backend', side_effect=AssertionError('backend')):
            with self.assertRaisesRegex(producer.FreshRejected, 'ADMIN_FRESH_UNBOUND'):
                producer.produce()

    def test_disposable_fixed_root_produces_closed_fresh_once(self):
        for ds, root, out in self._case():
            result = producer.produce()
            self.assertEqual(result['preimageTreeSha256'], ds.app_sha)
            self.assertEqual(result['rollbackOperationId'], 'admission-fixed')
            self.assertEqual(set(result['oldDsArtifacts']), set(producer.OLD_PATHS))
            self.assertEqual(set(result['newDsArtifacts']), set(producer.OLD_PATHS))
            self.assertGreaterEqual(ds.reads, 2)
            self.assertEqual(json.loads((out / 'FRESH.json').read_bytes()), result)
            self.assertEqual(binder._checked_inputs((out / 'FRESH.json').read_bytes()), result)
            with self.assertRaisesRegex(producer.FreshRejected, 'ADMIN_FRESH_NO_REPLAY'):
                producer.produce()

    def test_conflicting_current_app_zero_output(self):
        def mutate(ds, root, stack):
            original = ds.dir_tree_state
            def changed(path, allowed_root, excluded):
                rows, digest, size = original(path, allowed_root, excluded)
                return rows, digest if ds.reads == 1 else 'f' * 64, size
            stack.enter_context(patch.object(ds, 'dir_tree_state', side_effect=changed))
        for ds, root, out in self._case(mutate):
            with self.assertRaisesRegex(producer.FreshRejected, 'ADMIN_FRESH_APP_CHANGED'):
                producer.produce()
            self.assertFalse(out.exists())

    def test_unqualified_rollback_zero_output(self):
        for ds, root, out in self._case(lambda ds, root, stack:
                setattr(ds, 'admitted', False)):
            with self.assertRaises(RuntimeError):
                producer.produce()
            self.assertFalse(out.exists())

    def test_wrong_new_digest_zero_output(self):
        def mutate(ds, root, stack):
            path = producer.NEW_PATHS['ds_client.py']
            path.write_bytes(b'X' * path.stat().st_size)
        for ds, root, out in self._case(mutate):
            with self.assertRaisesRegex(producer.FreshRejected, 'ADMIN_FRESH_STAGE_CHANGED'):
                producer.produce()
            self.assertFalse(out.exists())

    def test_owner_writable_fresh_parent_rejects_before_marker(self):
        def mutate(ds, root, stack):
            root.chmod(0o770)
        for ds, root, out in self._case(mutate):
            with self.assertRaisesRegex(producer.FreshRejected,
                                        'ADMIN_FRESH_PARENT_CUSTODY'):
                producer.produce()
            self.assertFalse(out.exists())

    def test_binder_rejects_parent_changed_after_publication(self):
        for ds, root, out in self._case():
            producer.produce()
            with patch.object(binder, 'ROOT_UID', os.geteuid()), \
                 patch.object(binder, 'FRESH_DIRECTORY', out):
                self.assertEqual(json.loads(binder._read_root('FRESH.json', 8192)),
                                 json.loads((out / 'FRESH.json').read_bytes()))
                root.chmod(0o770)
                with self.assertRaisesRegex(binder.BindingRejected,
                                            'ADMIN_BINDING_PARENT_CUSTODY'):
                    binder._read_root('FRESH.json', 8192)

    def test_symlinked_old_artifact_zero_output(self):
        def mutate(ds, root, stack):
            path = root / 'old' / 'ds_client.py'
            path.unlink()
            path.symlink_to(producer.NEW_PATHS['ds_client.py'])
        for ds, root, out in self._case(mutate):
            with self.assertRaises(OSError):
                producer.produce()
            self.assertFalse(out.exists())

    def test_partial_write_is_sticky_no_replay(self):
        def mutate(ds, root, stack):
            stack.enter_context(patch.object(producer, '_write_exact',
                                              side_effect=OSError('disk-full')))
        for ds, root, out in self._case(mutate):
            with self.assertRaisesRegex(OSError, 'disk-full'):
                producer.produce()
            self.assertTrue(out.is_dir())
            self.assertFalse((out / 'FRESH.json').exists())
            with self.assertRaisesRegex(producer.FreshRejected, 'ADMIN_FRESH_NO_REPLAY'):
                producer.produce()


if __name__ == '__main__':unittest.main()
