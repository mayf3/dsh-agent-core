"""Disposable check of the exact-DS-only shim capacity seam."""
import ast
import hashlib
import importlib
import json
import os
from pathlib import Path
import tempfile
import types
import unittest
from unittest.mock import patch


class FixedLargeShimTest(unittest.TestCase):
    def test_internal_fresh_hook_is_inert_and_factory_has_no_new_socket_action(self):
        builder = importlib.import_module('build_admin_fixed_large_shim')
        source = builder.build_bytes().decode()
        self.assertIn('ADMIN_FRESH_HOOK_ACTIVE = False', source)
        self.assertIn('target=run_admin_fresh_hook', source)
        self.assertNotIn('"HR_ADMIN_FRESH_PREPARE_V1":', source)
        tree = ast.parse(source)
        factory = next(n for n in tree.body if isinstance(n, ast.FunctionDef)
                       and n.name == '_make_admin_fresh')
        scope = {'types': types}
        exec(compile(ast.Module(body=[factory], type_ignores=[]),
                     '<embedded-fresh>', 'exec'), scope)
        binding = {'captureId': 'capture-once',
                   'admissionId': 'admission-once',
                   'reviewedDsSha256': 'a' * 64,
                   'reviewedOldSha256': {'deployment_system.py': 'a' * 64},
                   'reviewedNewSha256': {'deploy_shim.py': 'b' * 64},
                   'shimInboxOwnerUid': 502,
                   'reviewedStagedSize': {'deployment_system.py': 20}}
        owner = scope['_make_admin_fresh'](binding)
        self.assertTrue(owner.ACTIVE)
        self.assertEqual(owner.CAPTURE_ID, 'capture-once')
        self.assertEqual(owner.REVIEWED_NEW_SHA256['deploy_shim.py'], 'b' * 64)
        self.assertTrue(callable(owner.produce))

    def test_large_ds_requires_exact_operation_new_and_rollback_pins(self):
        builder = importlib.import_module('build_admin_fixed_large_shim')
        source = builder.build_bytes().decode()
        with patch.object(builder, 'PUBLISHER_SHA256', '0' * 64):
            with self.assertRaisesRegex(ValueError, 'PUBLISHER_CHANGED'):
                builder.build_bytes()
        self.assertEqual(source.count('DS_FIXED_LARGE_INSTALL_OPERATION_ID = None'), 1)
        self.assertIn('DS_FIXED_LARGE_ROLLBACK_SHA256 = None', source)
        self.assertIn('DS_FIXED_LARGE_INSTALL_SHA256 = None', source)
        self.assertIn('exact_large=large_install', source)
        self.assertIn('exact_large=large_rollback', source)
        tree = ast.parse(source)
        node = next(n for n in tree.body if isinstance(n, ast.FunctionDef)
                    and n.name == 'read_verified')
        module = types.ModuleType('fixed_read')
        module.__dict__.update({'os': __import__('os'), 'stat': __import__('stat'),
            'hashlib': hashlib, 'ARTIFACT_MAX': 4,
            'require': lambda ok, why: None if ok else (_ for _ in ()).throw(ValueError(why))})
        exec(compile(ast.Module(body=[node], type_ignores=[]), '<fixed-read>', 'exec'),
             module.__dict__)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'deployment_system.py'
            raw = b'exact-large-fixed-daemon'
            path.write_bytes(raw)
            digest = hashlib.sha256(raw).hexdigest()
            with self.assertRaisesRegex(ValueError, 'ARTIFACT_TOO_LARGE'):
                module.read_verified(str(path))
            self.assertEqual(module.read_verified(str(path),
                exact_large=(digest, len(raw))), (raw, digest))
            for wrong in ((digest, len(raw) - 1), ('0' * 64, len(raw))):
                with self.subTest(wrong=wrong), self.assertRaises(ValueError):
                    module.read_verified(str(path), exact_large=wrong)

    def test_only_fixed_install_operation_can_request_exact_large_read(self):
        builder = importlib.import_module('build_admin_fixed_large_shim')
        tree = ast.parse(builder.build_bytes().decode())
        node = next(n for n in tree.body if isinstance(n, ast.FunctionDef)
                    and n.name == 'install_deployment_system')
        class StopAtRead(Exception):
            pass
        class Failure(Exception):
            pass
        calls = []
        def read_verified(path, exact_large=None):
            calls.append(exact_large)
            raise StopAtRead
        with tempfile.TemporaryDirectory() as directory:
            module = types.ModuleType('fixed_install')
            module.__dict__.update({'os': __import__('os'), 'time': __import__('time'),
                'STATE_ROOT': directory, 'DS_ARTIFACTS': ('deployment_system.py',),
                'DS_PLIST_PATH': directory,
                'fixed_ds_mutation_lock': lambda: os.open(
                    str(Path(directory) / 'mutation.lock'), os.O_RDWR | os.O_CREAT, 0o600),
                'fcntl': __import__('fcntl'),
                'DS_FIXED_LARGE_INSTALL_OPERATION_ID': 'fixed-once',
                'DS_FIXED_LARGE_INSTALL_SHA256': 'a' * 64,
                'DS_FIXED_LARGE_INSTALL_SIZE': 110215852,
                'DS_FIXED_LARGE_ROLLBACK_SHA256': 'b' * 64,
                'DS_FIXED_LARGE_ROLLBACK_SIZE': 110215851,
                'ADMIN_FIXED_INSTALL_ID': 'fixed-once',
                'admin_fixed_compiled': lambda: True,
                'OP_ID': __import__('re').compile(r'^[a-z0-9-]+$'),
                'Failure': Failure, 'read_verified': read_verified,
                'receipt_path': lambda _: directory + '/receipt',
                'atomic_write': lambda *_: None,
                'canonical': lambda value: __import__('json').dumps(value).encode(),
                'VERSION': 2,
                'require': lambda ok, why: None if ok else (_ for _ in ()).throw(Failure(why))})
            exec(compile(ast.Module(body=[node], type_ignores=[]), '<fixed-install>',
                         'exec'), module.__dict__)
            with self.assertRaises(StopAtRead):
                module.install_deployment_system({'operation_id': 'fixed-once',
                    'artifacts': {'deployment_system.py': 'a' * 64}})
            self.assertEqual(calls, [(('a' * 64), 110215852)])
            calls.clear()
            with self.assertRaises(StopAtRead):
                module.install_deployment_system({'operation_id': 'other',
                    'artifacts': {'deployment_system.py': 'a' * 64}})
            self.assertEqual(calls, [None])
            calls.clear()
            result = module.install_deployment_system({'operation_id': 'fixed-once',
                'artifacts': {'deployment_system.py': '0' * 64}})
            self.assertFalse(result['ok'])
            self.assertEqual(calls, [])

    def test_fixed_publisher_seals_only_compiled_package_after_status_join(self):
        builder = importlib.import_module('build_admin_fixed_large_shim')
        source = builder.build_bytes().decode()
        self.assertLess(source.index('status = _ds_wait_socket_and_status()'),
                        source.index('qualification_package_sha = publish_admin_fixed_package('))
        self.assertLess(source.index('qualification_package_sha = publish_admin_fixed_package('),
                        source.index('record["qualificationPackageSha256"]'))
        self.assertLess(source.index('record["qualificationPackageSha256"]'),
                        source.index('atomic_write(receipt_path(operation_id), canonical(record))'))
        publisher = importlib.import_module('admin_fixed_shim_publisher')
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); root.chmod(0o770)
            names = publisher.ADMIN_FIXED_NAMES
            small = {name: ('fixed-' + name).encode() for name in names}
            daemon = b'exact-reviewed-daemon'
            hashes = {name: hashlib.sha256(raw).hexdigest()
                      for name, raw in dict(small, **{'deployment_system.py': daemon}).items()}
            package_sha = hashlib.sha256(json.dumps(hashes, sort_keys=True,
                separators=(',', ':')).encode()).hexdigest()
            install_id = 'ds-hr-admin-private-install-20260928-v1'
            class RootOS:
                def __getattr__(self, name): return getattr(os, name)
                def geteuid(self): return 0
                def fchown(self, *_): return None
                def _root(self, meta):
                    return types.SimpleNamespace(**{name: getattr(meta, name) for name in
                        ('st_mode', 'st_nlink', 'st_dev', 'st_ino', 'st_size',
                         'st_mtime_ns', 'st_ctime_ns')}, st_uid=0, st_gid=80)
                def fstat(self, fd): return self._root(os.fstat(fd))
                def stat(self, *args, **kwargs): return self._root(os.stat(*args, **kwargs))
            with patch.object(publisher, 'DS_STATE_DIR', str(root), create=True), \
                 patch.object(publisher, 'ADMIN_FIXED_INSTALL_ID', install_id), \
                 patch.object(publisher, 'ADMIN_FIXED_HOST_ID',
                              'FF99ABD5-79A0-5EE0-9E0B-B62671271560'), \
                 patch.object(publisher, 'ADMIN_FIXED_PYTHON_SHA256', 'a' * 64), \
                 patch.object(publisher, '_admin_fixed_root_package',
                              return_value=(small, package_sha)), \
                 patch.object(publisher, 'ADMIN_FIXED_ROOT_HOST_OBSERVER',
                              lambda: 'FF99ABD5-79A0-5EE0-9E0B-B62671271560'), \
                 patch.object(publisher, 'os', RootOS()), \
                 patch.object(publisher, 'canonical', lambda obj:
                    json.dumps(obj, sort_keys=True, separators=(',', ':')).encode(),
                    create=True), \
                 patch.object(publisher, 'require', lambda ok, why:
                    None if ok else (_ for _ in ()).throw(ValueError(why)), create=True):
                self.assertIsNone(publisher.publish_admin_fixed_package(
                    'ordinary-other', {'deployment_system.py': hashes['deployment_system.py']},
                    {'deployment_system.py': daemon}))
                self.assertEqual(list(root.iterdir()), [])
                self.assertEqual(publisher.publish_admin_fixed_package(install_id,
                    {'deployment_system.py': hashes['deployment_system.py']},
                    {'deployment_system.py': daemon}), package_sha)
                seal = json.loads((root / publisher.ADMIN_FIXED_QUALIFICATION_ID /
                                   'package' / 'INSTALL-SEAL.json').read_bytes())
                self.assertEqual(seal['fileSha256']['deployment_system.py'],
                                 hashes['deployment_system.py'])
                bootstrap = importlib.import_module('admin_ds_private_bootstrap')
                receipt = {'operation_id': install_id,
                    'action': 'INSTALL_DEPLOYMENT_SYSTEM', 'state': 'COMMITTED',
                    'qualificationPackageSha256': package_sha,
                    'artifacts': {'deployment_system.py': hashes['deployment_system.py']},
                    'ds_status': {'pid': os.getpid()},
                    'started': bootstrap.START_TIME - 1,
                    'committedAt': bootstrap.START_TIME}
                self.assertEqual(bootstrap._binding(seal), seal)
                with patch.object(bootstrap, '_read_sealed', return_value=
                                  json.dumps(receipt).encode()):
                    bootstrap._committed_install(seal)
                    with self.assertRaises(bootstrap.BootstrapRejected):
                        bootstrap._committed_install(dict(seal,
                            packageSha256='0' * 64))
                with self.assertRaises(FileExistsError):
                    publisher.publish_admin_fixed_package(install_id,
                        {'deployment_system.py': hashes['deployment_system.py']},
                        {'deployment_system.py': daemon})

    def test_post_status_publisher_oserror_retains_durable_unknown_and_no_replay(self):
        builder = importlib.import_module('build_admin_fixed_large_shim')
        tree = ast.parse(builder.build_bytes().decode())
        node = next(n for n in tree.body if isinstance(n, ast.FunctionDef)
                    and n.name == 'install_deployment_system')
        class Failure(Exception):
            pass
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            receipt = root / 'receipt.json'
            plist = root / 'daemon.plist'
            files = {'deployment_system.py': b'daemon', 'ds_client.py': b'client',
                'deployment-registry.json': b'{}',
                'plist': b'ai.agent-deploy-system ' + str(root / 'deployment_system.py').encode()}
            hashes = {name: hashlib.sha256(raw).hexdigest() for name, raw in files.items()}
            effects = []
            def read_verified(path, exact_large=None):
                name = Path(path).name
                if name == 'daemon.plist': name = 'plist'
                return files[name], hashes[name]
            def atomic_write(path, raw, *args):
                if path == str(receipt):
                    receipt.write_bytes(raw)
                else:
                    effects.append(('write', path))
            fake_os = types.SimpleNamespace(**{name: getattr(os, name) for name in
                ('path', 'makedirs', 'close')})
            fake_os.path = types.SimpleNamespace(**{name: getattr(os.path, name)
                for name in ('join', 'exists')})
            fake_os.path.exists = lambda path: (receipt.exists() if path == str(receipt)
                else path == str(plist))
            module = types.ModuleType('fixed_install_failure')
            module.__dict__.update({'os': fake_os, 'time': __import__('time'),
                'STATE_ROOT': str(root), 'DS_ARTIFACTS': tuple(files),
                'DS_FIXED_LARGE_INSTALL_OPERATION_ID': 'fixed-once',
                'DS_FIXED_LARGE_INSTALL_SHA256': hashes['deployment_system.py'],
                'DS_FIXED_LARGE_INSTALL_SIZE': 110215852,
                'DS_FIXED_LARGE_ROLLBACK_SHA256': hashes['deployment_system.py'],
                'DS_FIXED_LARGE_ROLLBACK_SIZE': len(files['deployment_system.py']),
                'DS_FIXED_ROLLBACK_ARTIFACTS': {name: (digest, len(files[name]))
                    for name, digest in hashes.items()},
                'ADMIN_FIXED_INSTALL_ID': 'fixed-once',
                'admin_fixed_compiled': lambda: True,
                'fixed_ds_mutation_lock': lambda: os.open(
                    str(root / 'mutation.lock'), os.O_RDWR | os.O_CREAT, 0o600),
                'fcntl': __import__('fcntl'),
                'OP_ID': __import__('re').compile(r'^[a-z0-9-]+$'),
                'Failure': Failure, 'read_verified': read_verified,
                'receipt_path': lambda _: str(receipt),
                'atomic_write': atomic_write,
                'canonical': lambda value: json.dumps(value, sort_keys=True).encode(),
                'VERSION': 2, 'DS_LABEL': 'ai.agent-deploy-system',
                'DS_INSTALL_DIR': str(root), 'DS_PLIST_PATH': str(plist),
                'DS_CONFIG_DIR': str(root), 'DS_CONFIG_DIR_UNUSED': str(root),
                'AUTHORIZED_OWNER_UID': 502, 'TEST_MODE': False,
                '_ds_ensure_dirs': lambda _: None,
                '_ds_wait_socket_and_status': lambda: {'pid': 771, 'units': []},
                'validate_admin_fixed_package': lambda *_: object(),
                'publish_admin_fixed_package': lambda *_: (_ for _ in ()).throw(
                    OSError('synthetic-post-status-loss')),
                'subprocess': types.SimpleNamespace(run=lambda *_args, **_kwargs:
                    types.SimpleNamespace(returncode=0, stderr='')),
                'require': lambda ok, why: None if ok else (_ for _ in ()).throw(Failure(why))})
            exec(compile(ast.Module(body=[node], type_ignores=[]), '<fixed-install>',
                         'exec'), module.__dict__)
            fake_os.path.exists = lambda path: receipt.exists() if path == str(receipt) else False
            first_install = module.install_deployment_system({'operation_id': 'fixed-once',
                'artifacts': hashes})
            self.assertIn('ADMIN_FIXED_CURRENT_DS_MISSING', first_install['error'])
            self.assertEqual(effects, [])
            receipt.unlink()
            fake_os.path.exists = lambda path: (receipt.exists() if path == str(receipt)
                else path == str(plist))
            pins = module.DS_FIXED_ROLLBACK_ARTIFACTS
            for name in files:
                module.DS_FIXED_ROLLBACK_ARTIFACTS = dict(pins,
                    **{name: ('0' * 64, len(files[name]))})
                changed = module.install_deployment_system({'operation_id': 'fixed-once',
                    'artifacts': hashes})
                self.assertIn('ADMIN_FIXED_ROLLBACK_', changed['error'])
                self.assertEqual(effects, [])
                receipt.unlink()
            module.DS_FIXED_ROLLBACK_ARTIFACTS = pins
            result = module.install_deployment_system({'operation_id': 'fixed-once',
                'artifacts': hashes})
            self.assertEqual(result['state'], 'UNKNOWN')
            self.assertEqual(json.loads(receipt.read_bytes())['state'], 'UNKNOWN')
            self.assertTrue(effects)
            with self.assertRaises(Failure):
                module.install_deployment_system({'operation_id': 'fixed-once',
                    'artifacts': hashes})


if __name__ == '__main__':
    unittest.main()
