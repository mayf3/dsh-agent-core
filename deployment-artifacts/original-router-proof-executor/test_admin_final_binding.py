"""Disposable final-binding mechanics; no host receipt is manufactured here."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest.mock import patch

import admin_final_binding as binder


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


class FinalBindingTests(unittest.TestCase):
    def test_fixed_root_publishes_one_seal_after_exact_bind(self):
        with tempfile.TemporaryDirectory(prefix='admin-fixed-bind-') as directory:
            files, _, fresh = self._fixture(directory)
            output = files / 'qualification-package'
            with patch.object(binder, 'FRESH_DIRECTORY', files), \
                 patch.object(binder, 'FIXED_ROOT_OUTPUT', output), \
                 patch.object(binder, 'BOUND_FRESH_SHA256', digest(fresh)), \
                 patch.object(binder, 'ROOT_UID', os.geteuid()):
                seal = binder.bind_fixed_root()
                self.assertEqual(seal['state'], 'SEALED')
                self.assertEqual(seal['freshEvidenceSha256'], digest(fresh))
                self.assertEqual(seal['expectedPublisherFileSha256']['deployment_system.py'],
                    digest((output / 'deployment_system.py').read_bytes()))
                self.assertEqual(binder.canonical(seal),
                                 (output / 'PUBLISH-SEAL.json').read_bytes())
                with self.assertRaisesRegex(binder.BindingRejected,
                                            'ADMIN_BINDING_NO_REPLAY'):
                    binder.bind_fixed_root()

    def test_default_inert_before_fresh_read(self):
        with patch.object(binder, '_read_root', side_effect=AssertionError('read')):
            with self.assertRaisesRegex(binder.BindingRejected, 'ADMIN_BINDING_UNBOUND'):
                binder.bind(Path('/unused'))

    def _fixture(self, directory):
        root = Path(directory)
        files = root / 'fresh'
        files.mkdir(mode=0o700)
        current = {
            'deployment_system.py': (digest(b'old-daemon'), len(b'old-daemon')),
            'ds_client.py': (digest(b'old-client'), len(b'old-client')),
            'plist': (digest(b'old-plist'), len(b'old-plist')),
            'deployment-registry.json': (digest(b'old-config'), len(b'old-config')),
        }
        new = {'deployment_system.py': b'new-daemon', 'node-runtime': b'new-node',
               'python-runtime': b'new-python', 'ds_client.py': b'new-client',
               'plist': b'new-plist', 'deployment-registry.json': b'new-config',
               'deploy_shim.py': b'new-shim'}
        for name, raw in new.items():
            (files / name).write_bytes(raw)
            (files / name).chmod(0o600)
        inputs = {'version': 1, 'qualificationOperationId': binder.QUALIFICATION_ID,
                  'cutOperationId': binder.CUT_OPERATION_ID,
                  'installOperationId': binder.INSTALL_OPERATION_ID,
                  'hostId': binder.HOST_ID,
                  'finalTreeSha256': binder.FINAL_TREE_SHA,
                  'currentAppTreeSha256': digest(b'current-app'),
                  'preimageTreeSha256': digest(b'current-app'),
                  'rollbackOperationId': 'disposable-rollback',
                  'oldDsArtifacts': {name: {'sha256': sha, 'size': size}
                                     for name, (sha, size) in current.items()},
                  'newRuntime': {name: {'sha256': digest(raw), 'size': len(raw)}
                                 for name, raw in new.items()
                                 if name in binder.NEW_RUNTIME_NAMES},
                  'newDsArtifacts': {name: {'sha256': digest(new[name]), 'size': len(new[name])}
                                     for name in binder.OLD_DS_NAMES},
                  'reviewedShim': {'deploy_shim.py':
                                   {'sha256': digest(new['deploy_shim.py']),
                                    'size': len(new['deploy_shim.py'])}}}
        raw = binder.canonical(inputs) + b'\n'
        (files / 'FRESH.json').write_bytes(raw)
        (files / 'FRESH.json').chmod(0o600)
        return files, inputs, raw

    def test_exact_binding_produces_closed_package_and_operation(self):
        with tempfile.TemporaryDirectory(prefix='admin-binding-') as directory:
            files, _, raw = self._fixture(directory)
            output = Path(directory) / 'out'
            with patch.object(binder, 'FRESH_DIRECTORY', files), \
                 patch.object(binder, 'BOUND_FRESH_SHA256', digest(raw)), \
                 patch.object(binder, 'ROOT_UID', os.geteuid()):
                result = binder.bind(output)
            self.assertTrue((output / 'PACKAGE.json').exists())
            self.assertEqual(result['packageManifestSha256'],
                             digest((output / 'PACKAGE.json').read_bytes()))
            self.assertEqual(result['expectedPublisherPackageSha256'],
                             digest(binder.canonical(result['expectedPublisherFileSha256'])))
            self.assertFalse(result['productionAuthorized'])
            self.assertEqual(result['installOperationId'], binder.INSTALL_OPERATION_ID)
            self.assertEqual(result['cutOperationId'], binder.CUT_OPERATION_ID)
            self.assertEqual(set(result['rollbackArtifacts']), set(binder.OLD_DS_NAMES))
            self.assertEqual(result['newDsArtifacts']['deployment_system.py'],
                             result['newRuntime']['deployment_system.py'])
            self.assertEqual(binder.TREE_SHA(output / 'tree'), binder.FINAL_TREE_SHA)
            self.assertNotIn('ownerSha256', (output / 'PACKAGE.json').read_text().lower())
            with patch.object(binder.package, 'PACKAGE_ROOT', output), \
                 patch.object(binder.package, 'REVIEWED_PACKAGE_SHA256',
                                   result['packageManifestSha256']):
                self.assertEqual(binder.package.compile_fixed_admin_qualification(),
                                 (output / 'admin_launcher.py').read_bytes())
                self.assertEqual(binder.package.compile_fixed_admin_carrier(),
                                 (output / 'admin_root_carrier.py').read_bytes())

    def test_wrong_fresh_digest_rejects_without_package(self):
        with tempfile.TemporaryDirectory(prefix='admin-binding-') as directory:
            files, _, _ = self._fixture(directory)
            output = Path(directory) / 'out'
            with patch.object(binder, 'FRESH_DIRECTORY', files), \
                 patch.object(binder, 'BOUND_FRESH_SHA256', '0' * 64), \
                 patch.object(binder, 'ROOT_UID', os.geteuid()):
                with self.assertRaisesRegex(binder.BindingRejected, 'ADMIN_BINDING_FRESH_CHANGED'):
                    binder.bind(output)
            self.assertFalse(output.exists())

    def test_wrong_preimage_or_host_rejects_before_output(self):
        for change in ('hostId', 'preimageTreeSha256'):
            with self.subTest(change=change), tempfile.TemporaryDirectory(prefix='admin-binding-') as directory:
                files, inputs, _ = self._fixture(directory)
                inputs[change] = ('wrong-host' if change == 'hostId' else 'f' * 64)
                raw = binder.canonical(inputs) + b'\n'
                (files / 'FRESH.json').write_bytes(raw)
                output = Path(directory) / 'out'
                with patch.object(binder, 'FRESH_DIRECTORY', files), \
                     patch.object(binder, 'BOUND_FRESH_SHA256', digest(raw)), \
                     patch.object(binder, 'ROOT_UID', os.geteuid()):
                    with self.assertRaisesRegex(binder.BindingRejected, 'ADMIN_BINDING_IDENTITY'):
                        binder.bind(output)
                self.assertFalse(output.exists())

    def test_after_copy_tree_drift_emits_no_package(self):
        original = shutil.copytree
        with tempfile.TemporaryDirectory(prefix='admin-binding-') as directory:
            files, _, raw = self._fixture(directory)
            output = Path(directory) / 'out'

            def drift(source, destination, *args, **kwargs):
                result = original(source, destination, *args, **kwargs)
                if Path(destination) == output / 'tree':
                    validator = output / 'tree' / binder.package.VALIDATOR
                    validator.write_bytes(validator.read_bytes() + b'\n// drift\n')
                return result

            with patch.object(binder, 'FRESH_DIRECTORY', files), \
                 patch.object(binder, 'BOUND_FRESH_SHA256', digest(raw)), \
                 patch.object(binder, 'ROOT_UID', os.geteuid()), \
                 patch.object(binder.shutil, 'copytree', side_effect=drift):
                with self.assertRaisesRegex(binder.BindingRejected,
                                            'ADMIN_BINDING_OUTPUT_CHANGED'):
                    binder.bind(output)
            self.assertFalse((output / 'PACKAGE.json').exists())
            self.assertFalse((output / 'OPERATION.json').exists())

    def test_unreviewed_fixed_source_rejects_before_output(self):
        original = binder.package._read
        with tempfile.TemporaryDirectory(prefix='admin-binding-') as directory:
            files, _, raw = self._fixture(directory)
            output = Path(directory) / 'out'

            def changed(root, name, limit):
                if root == binder.CANDIDATE_DIRECTORY / 'package-inputs' and name == 'driver.py':
                    return b'unreviewed-driver'
                return original(root, name, limit)

            with patch.object(binder, 'FRESH_DIRECTORY', files), \
                 patch.object(binder, 'BOUND_FRESH_SHA256', digest(raw)), \
                 patch.object(binder, 'ROOT_UID', os.geteuid()), \
                 patch.object(binder.package, '_read', side_effect=changed):
                with self.assertRaisesRegex(binder.BindingRejected,
                                            'ADMIN_BINDING_SOURCE_CHANGED'):
                    binder.bind(output)
            self.assertFalse(output.exists())

    def test_missing_old_ds_preimage_or_cto_field_rejects(self):
        for change in ('missing-client', 'cto-field'):
            with self.subTest(change=change), tempfile.TemporaryDirectory(prefix='admin-binding-') as directory:
                files, inputs, _ = self._fixture(directory)
                if change == 'missing-client':
                    del inputs['oldDsArtifacts']['ds_client.py']
                else:
                    inputs['ownerSha256'] = digest(b'old-cto')
                raw = binder.canonical(inputs) + b'\n'
                (files / 'FRESH.json').write_bytes(raw)
                output = Path(directory) / 'out'
                with patch.object(binder, 'FRESH_DIRECTORY', files), \
                     patch.object(binder, 'BOUND_FRESH_SHA256', digest(raw)), \
                     patch.object(binder, 'ROOT_UID', os.geteuid()):
                    with self.assertRaisesRegex(binder.BindingRejected,
                                                'ADMIN_BINDING_(ARTIFACTS|IDENTITY)'):
                        binder.bind(output)
                self.assertFalse(output.exists())

    def test_changed_reviewed_shim_or_daemon_rejects_before_output(self):
        for name in ('deploy_shim.py', 'deployment_system.py'):
            with self.subTest(name=name), tempfile.TemporaryDirectory(prefix='admin-binding-') as directory:
                files, _, raw = self._fixture(directory)
                (files / name).write_bytes(b'unreviewed-change')
                output = Path(directory) / 'out'
                with patch.object(binder, 'FRESH_DIRECTORY', files), \
                     patch.object(binder, 'BOUND_FRESH_SHA256', digest(raw)), \
                     patch.object(binder, 'ROOT_UID', os.geteuid()):
                    with self.assertRaisesRegex(binder.BindingRejected,
                                                'ADMIN_BINDING_(INSTALL|RUNTIME)_CHANGED'):
                        binder.bind(output)
                self.assertFalse(output.exists())


if __name__ == '__main__':
    unittest.main()
