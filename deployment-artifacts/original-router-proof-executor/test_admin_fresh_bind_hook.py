"""Disposable fixed bundle snapshot; no installed root paths or process calls."""
import base64
import fcntl
import hashlib
import json
import os
from pathlib import Path
import tempfile
import types
import unittest
from unittest.mock import patch
import zlib

import admin_fresh_bind_hook as binding
import admin_final_binding as final_binding
import admin_package
import admin_fixed_shim_publisher as publisher
import compile_admin_fixed_shim as compiler


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


class RootOS:
    def __getattr__(self, name):
        return getattr(os, name)

    def _as_root(self, st):
        return types.SimpleNamespace(**{name: getattr(st, name) for name in
            ('st_dev', 'st_ino', 'st_mode', 'st_nlink', 'st_size',
             'st_mtime_ns', 'st_ctime_ns')}, st_uid=0, st_gid=0)

    def fstat(self, fd):
        return self._as_root(os.fstat(fd))

    def stat(self, *args, **kwargs):
        return self._as_root(os.stat(*args, **kwargs))


class FixedFreshBundleTest(unittest.TestCase):
    def test_changed_current_app_rejects_before_any_source_snapshot(self):
        class DS:
            def mutation_lock(self):
                return os.open(os.devnull, os.O_RDONLY)
            def dir_tree_state(self, *args):
                return [], '0' * 64, 1
        with tempfile.TemporaryDirectory(prefix='admin-changed-app-') as directory:
            root = Path(directory); root.chmod(0o700)
            owner = types.SimpleNamespace(_load_backend=lambda: DS(),
                _observe_host=lambda: 'fixed-host', HOST_ID='fixed-host',
                APP=root / 'app', FRESH_DIRECTORY=root)
            with self.assertRaisesRegex(ValueError, 'ADMIN_BUNDLE_APP_CHANGED'):
                binding.admin_bind_fresh({'currentAppTreeSha256': 'a' * 64},
                                         owner, lambda digest: digest)
            self.assertEqual(list(root.iterdir()), [])

    def test_actual_private_fresh_to_inert_package_without_review_or_launch(self):
        from test_admin_final_binding import FinalBindingTests
        pins = {'candidateSha256': final_binding.CANDIDATE_SHA256,
                'binderSourceSha256': sha(Path(final_binding.__file__).read_bytes())}
        bundle, files = compiler._bundle(pins)
        with tempfile.TemporaryDirectory(prefix='admin-fresh-bind-') as directory:
            fresh, value, _ = FinalBindingTests()._fixture(directory)
            fresh.joinpath('FRESH.json').write_bytes(final_binding.canonical(value))
            old_root = Path(directory) / 'old'; old_root.mkdir()
            old = {}
            old_raw = {'deployment_system.py': b'old-daemon',
                       'ds_client.py': b'old-client', 'plist': b'old-plist',
                       'deployment-registry.json': b'old-config'}
            for name, raw in old_raw.items():
                old[name] = old_root / name
                old[name].write_bytes(raw)
            lock_path = Path(directory) / 'mutation.lock'
            lock_path.touch()
            held_fds = []
            class DS:
                def mutation_lock(self):
                    fd = os.open(lock_path, os.O_RDWR)
                    fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
                    held_fds.append(fd)
                    return fd
                def dir_tree_state(self, *args):
                    return [], value['currentAppTreeSha256'], 1
                def load_registry(self):
                    return {}, 'a' * 64
                def unit_from_registry(self, registry, name):
                    return {'kind': 'tree', 'target': str(owner.APP),
                            'preserve': ['node_modules'], 'uid': 505, 'gid': 601}
                def _verified_admitted_capture(self, capture, generation, target):
                    return directory, {'tree_sha256': value['currentAppTreeSha256']}
                def read_verified(self, path):
                    return json.dumps({'operation_id': value['rollbackOperationId']}).encode(), 'b' * 64
                def read_receipt(self, operation):
                    return {'state': 'ADMITTED', 'unit': 'scheduler-whole-main',
                            'capture_operation_id': owner.CAPTURE_ID}
            new_names = frozenset(('deployment_system.py', 'ds_client.py',
                'plist', 'deployment-registry.json', 'deploy_shim.py',
                'node-runtime', 'python-runtime'))
            owner = types.SimpleNamespace(
                _load_backend=lambda: DS(),
                _observe_host=lambda: value['hostId'],
                _read_owned=lambda path: Path(path).read_bytes(),
                _read_staged=lambda name: (fresh / name).read_bytes(),
                _artifact=lambda raw: {'sha256': sha(raw), 'size': len(raw)},
                _sha=sha,
                _canonical=final_binding.canonical,
                HOST_ID=value['hostId'], ROOT_UID=os.geteuid(),
                APP=Path(directory) / 'app', FRESH_DIRECTORY=fresh,
                CAPTURE_ID='capture-fixed',
                ADMISSION_ID=value['rollbackOperationId'],
                OLD_PATHS=old,
                NEW_NAMES=new_names,
                NEW_PATHS={name: fresh / name for name in new_names},
                REVIEWED_OLD_SHA256={name: row['sha256'] for name, row in
                                     value['oldDsArtifacts'].items()},
                REVIEWED_NEW_SHA256={name: sha((fresh / name).read_bytes())
                                     for name in new_names})
            def finish(digest):
                reader, writer = os.pipe()
                child = os.fork()
                if child == 0:
                    os.close(reader)
                    os.close(held_fds[-1])
                    contender = os.open(lock_path, os.O_RDWR)
                    try:
                        try:
                            fcntl.flock(contender, fcntl.LOCK_EX | fcntl.LOCK_NB)
                            os.write(writer, b'unsafe')
                        except BlockingIOError:
                            os.write(writer, b'held')
                    finally:
                        os.close(contender)
                        os._exit(0)
                os.close(writer)
                observed = os.read(reader, 16)
                os.close(reader)
                os.waitpid(child, 0)
                self.assertEqual(observed, b'held')
                return digest
            with patch.object(binding, 'os', RootOS()), \
                 patch.object(binding, 'ADMIN_FRESH_BUNDLE', bundle), \
                 patch.object(binding, 'ADMIN_FRESH_BUNDLE_SHA256', sha(bundle)), \
                 patch.object(binding, 'ADMIN_FRESH_BUNDLE_FILES', files), \
                 patch.object(binding, 'ADMIN_FRESH_CANDIDATE_SHA256',
                              pins['candidateSha256']), \
                 patch.object(binding, 'ADMIN_FRESH_BINDER_SHA256',
                              pins['binderSourceSha256']), \
                 patch.object(binding, 'ADMIN_FIXED_NAMES', publisher.ADMIN_FIXED_NAMES,
                              create=True):
                observed = binding.admin_bind_fresh(value, owner, finish)
            self.assertEqual(observed, sha(final_binding.canonical(value)))
            self.assertTrue((fresh / 'qualification-package/PUBLISH-SEAL.json').exists())
            self.assertFalse((fresh / 'qualification-package/OPERATION-REVIEW.json').exists())
            with self.assertRaises(FileExistsError):
                with patch.object(binding, 'os', RootOS()), \
                     patch.object(binding, 'ADMIN_FRESH_BUNDLE', bundle), \
                     patch.object(binding, 'ADMIN_FRESH_BUNDLE_SHA256', sha(bundle)), \
                     patch.object(binding, 'ADMIN_FRESH_BUNDLE_FILES', files), \
                     patch.object(binding, 'ADMIN_FRESH_CANDIDATE_SHA256',
                                  pins['candidateSha256']), \
                     patch.object(binding, 'ADMIN_FRESH_BINDER_SHA256',
                                  pins['binderSourceSha256']), \
                     patch.object(binding, 'ADMIN_FIXED_NAMES', publisher.ADMIN_FIXED_NAMES,
                                  create=True):
                    binding.admin_bind_fresh(value, owner, lambda digest: digest)

    def test_actual_pinned_candidate_bundle_snapshots_exact_final_tree(self):
        pins = {'candidateSha256': final_binding.CANDIDATE_SHA256,
                'binderSourceSha256': sha(Path(final_binding.__file__).read_bytes())}
        bundle, files = compiler._bundle(pins)
        self.assertIn('admin_final_binding.py', files)
        self.assertIn('tree/packages/agent-router/src/reconciliation/quiescence-bundle.js',
                      files)
        with tempfile.TemporaryDirectory(prefix='admin-actual-bundle-') as directory:
            root = Path(directory); root.chmod(0o700)
            with patch.object(binding, 'os', RootOS()), \
                 patch.object(binding, 'ADMIN_FRESH_BUNDLE', bundle), \
                 patch.object(binding, 'ADMIN_FRESH_BUNDLE_SHA256', sha(bundle)), \
                 patch.object(binding, 'ADMIN_FRESH_BUNDLE_FILES', files):
                snapshot, observed = binding._admin_bundle_snapshot(root)
            self.assertEqual(set(observed), set(files))
            self.assertEqual(admin_package._tree_sha256(snapshot / 'tree'),
                             final_binding.FINAL_TREE_SHA)

    def test_one_root_snapshot_and_no_replay(self):
        files = {'CANDIDATE.json': b'{"executable":false}',
                 'tree/packages/agent-router/index.js': b'exact-tree',
                 'package-inputs/entry-manifest.json': b'{}'}
        encoded = {key: base64.b64encode(value).decode()
                   for key, value in files.items()}
        bundle = zlib.compress(json.dumps(encoded, sort_keys=True,
                                          separators=(',', ':')).encode())
        with tempfile.TemporaryDirectory(prefix='admin-bundle-') as directory:
            root = Path(directory); root.chmod(0o700)
            with patch.object(binding, 'os', RootOS()), \
                 patch.object(binding, 'ADMIN_FRESH_BUNDLE', bundle), \
                 patch.object(binding, 'ADMIN_FRESH_BUNDLE_SHA256', sha(bundle)), \
                 patch.object(binding, 'ADMIN_FRESH_BUNDLE_FILES',
                              {key: sha(value) for key, value in files.items()}):
                snapshot, observed = binding._admin_bundle_snapshot(root)
                self.assertEqual(observed, files)
                self.assertEqual((snapshot / 'tree/packages/agent-router/index.js').read_bytes(),
                                 b'exact-tree')
                with self.assertRaises(FileExistsError):
                    binding._admin_bundle_snapshot(root)

    def test_changed_bundle_or_escape_refuses_before_snapshot(self):
        for name in ('../escape', 'tree/../escape', 'safe'):
            files = {name: b'exact'}
            encoded = {key: base64.b64encode(value).decode() for key, value in files.items()}
            bundle = zlib.compress(json.dumps(encoded).encode())
            with tempfile.TemporaryDirectory(prefix='admin-bundle-') as directory:
                root = Path(directory); root.chmod(0o700)
                pin = {'safe': '0' * 64}.get(name, sha(b'exact'))
                with patch.object(binding, 'os', RootOS()), \
                     patch.object(binding, 'ADMIN_FRESH_BUNDLE', bundle), \
                     patch.object(binding, 'ADMIN_FRESH_BUNDLE_SHA256', sha(bundle)), \
                     patch.object(binding, 'ADMIN_FRESH_BUNDLE_FILES', {name: pin}), \
                     self.assertRaises(ValueError):
                    binding._admin_bundle_snapshot(root)
                self.assertEqual(list(root.iterdir()), [])


if __name__ == '__main__':
    unittest.main()
