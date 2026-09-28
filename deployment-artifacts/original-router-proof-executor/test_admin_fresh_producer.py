"""Disposable original-root fresh-input producer boundaries."""
import hashlib
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from contextlib import ExitStack

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
    def _case(self, mutation=None):
        with tempfile.TemporaryDirectory(prefix='admin-fresh-') as directory:
            root = Path(directory)
            app = root / 'app'; app.mkdir()
            old = root / 'old'; old.mkdir()
            new = root / 'new'; new.mkdir()
            out = root / 'fresh'
            lock = root / 'mutation.lock'; lock.write_bytes(b'')
            old_bytes = {name: ('old-' + name).encode() for name in producer.OLD_PATHS}
            new_bytes = {name: ('new-' + name).encode() for name in producer.NEW_NAMES}
            for name, raw in old_bytes.items(): (old / name).write_bytes(raw)
            for name, raw in new_bytes.items(): (new / name).write_bytes(raw)
            ds = FakeDS(sha(b'current-app'))
            ds.lock_fd = os.open(lock, os.O_RDONLY)
            try:
                with ExitStack() as stack:
                    for key, value in {
                        'ACTIVE': True, 'CAPTURE_ID': ds.capture,
                        'ADMISSION_ID': 'admission-fixed',
                        'REVIEWED_DS_SHA256': sha(old_bytes['deployment_system.py']),
                        'REVIEWED_NEW_SHA256': {name: sha(raw) for name, raw in new_bytes.items()},
                        'APP': app, 'OLD_PATHS': {name: old / name for name in old_bytes},
                        'NEW_PATHS': {name: new / name for name in new_bytes},
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
        with tempfile.TemporaryDirectory(prefix='admin-fresh-') as directory:
            root = Path(directory)
            app = root / 'app';app.mkdir()
            old = root / 'old';old.mkdir()
            new = root / 'new';new.mkdir()
            out = root / 'fresh'
            lock = root / 'mutation.lock';lock.write_bytes(b'')
            old_bytes = {name: ('old-'+name).encode() for name in producer.OLD_PATHS}
            new_bytes = {name: ('new-'+name).encode() for name in producer.NEW_NAMES}
            for name, raw in old_bytes.items(): (old/name).write_bytes(raw)
            for name, raw in new_bytes.items(): (new/name).write_bytes(raw)
            ds = FakeDS(sha(b'current-app'))
            ds.lock_fd = os.open(lock, os.O_RDONLY)
            try:
                with patch.object(producer, 'ACTIVE', True), \
                     patch.object(producer, 'CAPTURE_ID', ds.capture), \
                     patch.object(producer, 'ADMISSION_ID', 'admission-fixed'), \
                     patch.object(producer, 'REVIEWED_DS_SHA256', sha(old_bytes['deployment_system.py'])), \
                     patch.object(producer, 'REVIEWED_NEW_SHA256',
                                  {name:sha(raw) for name,raw in new_bytes.items()}), \
                     patch.object(producer, 'APP', app), \
                     patch.object(producer, 'OLD_PATHS', {name:old/name for name in old_bytes}), \
                     patch.object(producer, 'NEW_PATHS', {name:new/name for name in new_bytes}), \
                     patch.object(producer, 'FRESH_DIRECTORY', out), \
                     patch.object(producer, 'ROOT_UID', os.geteuid()), \
                     patch.object(producer, '_load_backend', return_value=ds), \
                     patch.object(producer, '_observe_host', return_value=producer.HOST_ID):
                    result=producer.produce()
                    self.assertEqual(result['preimageTreeSha256'],ds.app_sha)
                    self.assertEqual(result['rollbackOperationId'],'admission-fixed')
                    self.assertEqual(set(result['oldDsArtifacts']),set(old_bytes))
                    self.assertEqual(set(result['newDsArtifacts']),set(producer.OLD_PATHS))
                    self.assertGreaterEqual(ds.reads,2)
                    self.assertEqual(json.loads((out/'FRESH.json').read_bytes()),result)
                    self.assertEqual(binder._checked_inputs((out/'FRESH.json').read_bytes()), result)
                    with self.assertRaisesRegex(producer.FreshRejected,'ADMIN_FRESH_NO_REPLAY'):
                        producer.produce()
            finally:os.close(ds.lock_fd)

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
            (root / 'new' / 'ds_client.py').write_bytes(b'drifted')
        for ds, root, out in self._case(mutate):
            with self.assertRaisesRegex(producer.FreshRejected, 'ADMIN_FRESH_NEW_CHANGED'):
                producer.produce()
            self.assertFalse(out.exists())

    def test_symlinked_old_artifact_zero_output(self):
        def mutate(ds, root, stack):
            path = root / 'old' / 'ds_client.py'
            path.unlink()
            path.symlink_to(root / 'new' / 'ds_client.py')
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
