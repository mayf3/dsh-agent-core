"""Fixed admin qualification package compiler; disposable inputs only."""
import importlib
import importlib.util
import array
import hashlib
import json
import os
import shutil
import socket
import stat
import subprocess
import tempfile
import threading
import types
import unittest
from pathlib import Path
from unittest.mock import patch


class FixedAdminPackageTest(unittest.TestCase):
    def disposable_package(self, builder, package):
        here = Path(__file__).parent
        source_names = {
            'entrySha256': ('driver.py', here / 'driver.py'),
            'procedureSha256': ('procedure.py', here / 'procedure.py'),
            'adminProcedureSha256': ('admin_procedure.py', here / 'admin_procedure.py'),
            'deploymentDriverSha256': ('deployment.py', here / 'deployment.py'),
            'adminObserverSha256': ('admin_observation.mjs', here / 'admin_observation.mjs'),
            'handoffSha256': ('handoff.py', here / 'handoff.py'),
            'helperSha256': ('child-proof.py', here.parents[1] / 'packages/production-runtime/src/native-arm64/hr-s256-r2-child-proof.py'),
        }
        pins = {'version': 1, 'qualificationOperationId': builder.QUALIFICATION_ID,
                'cutOperationId': builder.CUT_OPERATION_ID, 'hostId': builder.HOST_ID,
                'preimageTreeSha256': 'f' * 64, 'rollbackOperationId': 'fixed-disposable-rollback'}
        for field, (name, source) in source_names.items():
            shutil.copyfile(source, package / name)
            pins[field] = hashlib.sha256((package / name).read_bytes()).hexdigest()
        for field, name in (('nodeSha256', 'node-runtime'),
                            ('daemonSha256', 'deployment_system.py'),
                            ('pythonSha256', 'python-runtime')):
            (package / name).write_bytes(('disposable-' + name).encode())
            pins[field] = hashlib.sha256((package / name).read_bytes()).hexdigest()
        validator = package / 'tree' / builder.VALIDATOR
        validator.parent.mkdir(parents=True, exist_ok=True)
        validator.write_bytes(b'disposable-fixed-validator')
        pins['validatorSha256'] = hashlib.sha256(validator.read_bytes()).hexdigest()
        pins['finalTreeSha256'] = builder._tree_sha256(package / 'tree')
        entry = {'entrySha256': pins['entrySha256'],
                 'consumingBinarySha256': pins['finalTreeSha256'],
                 'validatorSha256': pins['validatorSha256'],
                 'helperSha256': pins['helperSha256'],
                 'procedureSha256': pins['adminProcedureSha256']}
        (package / 'entry-manifest.json').write_bytes(json.dumps(entry, sort_keys=True,
                                                        separators=(',', ':')).encode())
        pins['entryManifestSha256'] = hashlib.sha256((package / 'entry-manifest.json').read_bytes()).hexdigest()
        (package / 'PACKAGE.json').write_bytes(json.dumps(pins, sort_keys=True,
                                             separators=(',', ':')).encode())
        return hashlib.sha256((package / 'PACKAGE.json').read_bytes()).hexdigest()

    def test_unbound_package_rejects_before_any_filesystem_or_process_access(self):
        builder = importlib.import_module('admin_package')
        with patch.object(os, 'open', side_effect=AssertionError('HOST_FS_DENIED')), \
             patch.object(subprocess, 'Popen', side_effect=AssertionError('HOST_PROCESS_DENIED')):
            with self.assertRaisesRegex(builder.PackageRejected, 'ADMIN_PACKAGE_UNBOUND'):
                builder.compile_fixed_admin_qualification()

    def test_compiler_requires_exact_reviewed_closed_package_and_no_self_digest_cycle(self):
        builder = importlib.import_module('admin_package')
        with tempfile.TemporaryDirectory() as directory:
            package = Path(directory)
            # Package files are assembled only inside this disposable root.
            digest = self.disposable_package(builder, package)
            with patch.object(builder, 'PACKAGE_ROOT', package), \
                 patch.object(builder, 'REVIEWED_PACKAGE_SHA256', digest), \
                 patch.object(subprocess, 'Popen', side_effect=AssertionError('HOST_PROCESS_DENIED')):
                launcher = builder.compile_fixed_admin_qualification()
                carrier = builder.compile_fixed_admin_carrier()
                self.assertIn(b'module.QUALIFIED_ADMIN_PROCEDURE_SHA = module.ADMIN_PROCEDURE_SHA', launcher)
                self.assertIn(b'module.QUALIFIED_OWNER_SHA = None', launcher)
                self.assertIn(b'QUALIFIED_EXECUTING_ENTRY_FD', launcher)
                self.assertNotIn(b'908941f28a851d4a323be1870b6e8e9a6c29da841b7706817f0d9189557987cb', launcher)
                self.assertNotIn(b'QUALIFIED_ORIGINAL_ENTRY = None', launcher)
                self.assertIn(hashlib.sha256(launcher).hexdigest().encode(), carrier)
                self.assertIn(b'socket.socketpair()', carrier)
                self.assertIn(b'pass_fds=child_fds', carrier)
                self.assertIn(b"'/usr/bin/python3', '-I', '-S', '-B'", carrier)
                self.assertNotIn(b'LAUNCHER_SHA = None', carrier)
                self.assertIn(b"'qualificationOperationId': 'original-router-qualification-20260927-v1'", carrier)
                self.assertIn(b"'cutOperationId': 'hr-s256-admin-emergency-cut-20260928-v1'", carrier)
                module = types.ModuleType('disposable_compiled_admin_launcher')
                module.__file__ = str(package / 'admin_launcher.py')
                exec(compile(launcher, module.__file__, 'exec'), module.__dict__)
                with patch.object(os, 'stat', side_effect=AssertionError('HOST_STAT_DENIED')):
                    with self.assertRaisesRegex(module.QualificationRejected, 'ADMIN_LAUNCH_INVOCATION'):
                        module.run(['--unknown', '3,4,5,6,7,8'])
                carrier_module = types.ModuleType('disposable_compiled_admin_carrier')
                carrier_module.__file__ = str(package / 'admin_root_carrier.py')
                exec(compile(carrier, carrier_module.__file__, 'exec'), carrier_module.__dict__)
                with patch.object(carrier_module.sys, 'argv', ['admin_root_carrier.py', '--caller-path']), \
                     patch.object(os, 'geteuid', side_effect=AssertionError('HOST_UID_DENIED')):
                    with self.assertRaisesRegex(carrier_module.CarrierRejected,
                                                'ADMIN_CARRIER_INVOCATION'):
                        carrier_module.run()
                with patch.object(carrier_module.sys, 'argv', ['admin_root_carrier.py']), \
                     patch.object(os, 'geteuid', side_effect=AssertionError('HOST_UID_DENIED')), \
                     patch.object(subprocess, 'Popen',
                                  side_effect=AssertionError('HOST_PROCESS_DENIED')):
                    with self.assertRaisesRegex(AssertionError,
                                                'HOST_UID_DENIED'):
                        carrier_module.run()
                (package / 'PACKAGE.json').write_bytes((package / 'PACKAGE.json').read_bytes() + b' ')
                with self.assertRaisesRegex(builder.PackageRejected, 'ADMIN_PACKAGE_DIGEST_CHANGED'):
                    builder.compile_fixed_admin_qualification()

    def test_missing_pin_wrong_source_and_changed_tree_fail_closed(self):
        builder = importlib.import_module('admin_package')
        with tempfile.TemporaryDirectory() as directory:
            package = Path(directory)
            digest = self.disposable_package(builder, package)
            with patch.object(builder, 'PACKAGE_ROOT', package), \
                 patch.object(builder, 'REVIEWED_PACKAGE_SHA256', digest):
                (package / 'driver.py').write_bytes(b'changed original entry')
                with self.assertRaisesRegex(builder.PackageRejected, 'ADMIN_PACKAGE_SOURCE_CHANGED'):
                    builder.compile_fixed_admin_qualification()
            digest = self.disposable_package(builder, package)
            with patch.object(builder, 'PACKAGE_ROOT', package), \
                 patch.object(builder, 'REVIEWED_PACKAGE_SHA256', digest):
                (package / 'tree' / builder.VALIDATOR).write_bytes(b'changed validator')
                with self.assertRaisesRegex(builder.PackageRejected, 'ADMIN_PACKAGE_VALIDATOR_CHANGED'):
                    builder.compile_fixed_admin_qualification()
            digest = self.disposable_package(builder, package)
            raw = json.loads((package / 'PACKAGE.json').read_bytes())
            del raw['preimageTreeSha256']
            (package / 'PACKAGE.json').write_bytes(json.dumps(raw).encode())
            digest = hashlib.sha256((package / 'PACKAGE.json').read_bytes()).hexdigest()
            with patch.object(builder, 'PACKAGE_ROOT', package), \
                 patch.object(builder, 'REVIEWED_PACKAGE_SHA256', digest):
                with self.assertRaisesRegex(builder.PackageRejected, 'ADMIN_PACKAGE_BINDING_INVALID'):
                    builder.compile_fixed_admin_qualification()

    def test_resealed_stale_executor_and_changed_compiler_templates_reject(self):
        builder = importlib.import_module('admin_package')
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            package = root / 'package'
            package.mkdir()
            self.disposable_package(builder, package)
            # A newly reviewed package digest alone must not authorize an old
            # executor byte set against this exact fixed compiler source.
            (package / 'driver.py').write_bytes(b'stale-but-resealed-driver')
            pins = json.loads((package / 'PACKAGE.json').read_bytes())
            pins['entrySha256'] = hashlib.sha256((package / 'driver.py').read_bytes()).hexdigest()
            entry = json.loads((package / 'entry-manifest.json').read_bytes())
            entry['entrySha256'] = pins['entrySha256']
            (package / 'entry-manifest.json').write_bytes(json.dumps(entry, sort_keys=True,
                separators=(',', ':')).encode())
            pins['entryManifestSha256'] = hashlib.sha256((package / 'entry-manifest.json').read_bytes()).hexdigest()
            (package / 'PACKAGE.json').write_bytes(json.dumps(pins, sort_keys=True,
                separators=(',', ':')).encode())
            digest = hashlib.sha256((package / 'PACKAGE.json').read_bytes()).hexdigest()
            with patch.object(builder, 'PACKAGE_ROOT', package), \
                 patch.object(builder, 'REVIEWED_PACKAGE_SHA256', digest), \
                 patch.object(subprocess, 'Popen', side_effect=AssertionError('HOST_PROCESS_DENIED')):
                with self.assertRaisesRegex(builder.PackageRejected, 'ADMIN_PACKAGE_SOURCE_VERSION'):
                    builder.compile_fixed_admin_qualification()

            digest = self.disposable_package(builder, package)
            (package / 'deployment.py').write_bytes(b'stale-but-resealed-deployment')
            pins = json.loads((package / 'PACKAGE.json').read_bytes())
            pins['deploymentDriverSha256'] = hashlib.sha256((package / 'deployment.py').read_bytes()).hexdigest()
            (package / 'PACKAGE.json').write_bytes(json.dumps(pins, sort_keys=True,
                separators=(',', ':')).encode())
            digest = hashlib.sha256((package / 'PACKAGE.json').read_bytes()).hexdigest()
            with patch.object(builder, 'PACKAGE_ROOT', package), \
                 patch.object(builder, 'REVIEWED_PACKAGE_SHA256', digest), \
                 patch.object(subprocess, 'Popen', side_effect=AssertionError('HOST_PROCESS_DENIED')):
                with self.assertRaisesRegex(builder.PackageRejected, 'ADMIN_PACKAGE_SOURCE_VERSION'):
                    builder.compile_fixed_admin_qualification()

            digest = self.disposable_package(builder, package)
            copied = root / 'compiler'
            copied.mkdir()
            for name in ('admin_launcher_template.py', 'admin_root_carrier_template.py'):
                shutil.copyfile(Path(__file__).with_name(name), copied / name)
            (copied / 'admin_launcher_template.py').write_bytes(
                (copied / 'admin_launcher_template.py').read_bytes() + b'\n# changed')
            with patch.object(builder, '__file__', str(copied / 'admin_package.py')), \
                 patch.object(builder, 'PACKAGE_ROOT', package), \
                 patch.object(builder, 'REVIEWED_PACKAGE_SHA256', digest), \
                 patch.object(subprocess, 'Popen', side_effect=AssertionError('HOST_PROCESS_DENIED')):
                with self.assertRaisesRegex(builder.PackageRejected, 'ADMIN_COMPILER_TEMPLATE_CHANGED'):
                    builder.compile_fixed_admin_qualification()

            shutil.copyfile(Path(__file__).with_name('admin_launcher_template.py'),
                            copied / 'admin_launcher_template.py')
            (copied / 'admin_root_carrier_template.py').write_bytes(
                (copied / 'admin_root_carrier_template.py').read_bytes() + b'\n# changed')
            with patch.object(builder, '__file__', str(copied / 'admin_package.py')), \
                 patch.object(builder, 'PACKAGE_ROOT', package), \
                 patch.object(builder, 'REVIEWED_PACKAGE_SHA256', digest):
                with self.assertRaisesRegex(builder.PackageRejected, 'ADMIN_COMPILER_TEMPLATE_CHANGED'):
                    builder.compile_fixed_admin_carrier()

    def test_private_deployment_uses_the_same_finite_reviewed_daemon_limit(self):
        source = Path(__file__).with_name('deployment.py').read_text()
        self.assertIn('_descriptor_bytes(owner._daemon_fd,DAEMON_SHA,128 * (1 << 20))', source)
        self.assertNotIn('_descriptor_bytes(owner._daemon_fd,DAEMON_SHA,1 << 20)', source)

    def test_duplicate_manifest_and_symlinked_source_cannot_compile(self):
        builder = importlib.import_module('admin_package')
        with tempfile.TemporaryDirectory() as directory:
            package = Path(directory)
            digest = self.disposable_package(builder, package)
            entry = (package / 'entry-manifest.json').read_bytes()
            duplicate = entry[:-1] + b',"entrySha256":"' + b'0' * 64 + b'"}'
            (package / 'entry-manifest.json').write_bytes(duplicate)
            pins = json.loads((package / 'PACKAGE.json').read_bytes())
            pins['entryManifestSha256'] = hashlib.sha256(duplicate).hexdigest()
            (package / 'PACKAGE.json').write_bytes(json.dumps(pins, sort_keys=True,
                separators=(',', ':')).encode())
            digest = hashlib.sha256((package / 'PACKAGE.json').read_bytes()).hexdigest()
            with patch.object(builder, 'PACKAGE_ROOT', package), \
                 patch.object(builder, 'REVIEWED_PACKAGE_SHA256', digest):
                with self.assertRaisesRegex(builder.PackageRejected,
                                            'ADMIN_PACKAGE_DUPLICATE_FIELD'):
                    builder.compile_fixed_admin_qualification()
            digest = self.disposable_package(builder, package)
            source = package / 'driver.py'
            source.unlink()
            source.symlink_to(Path(__file__).with_name('driver.py'))
            with patch.object(builder, 'PACKAGE_ROOT', package), \
                 patch.object(builder, 'REVIEWED_PACKAGE_SHA256', digest):
                with self.assertRaisesRegex(builder.PackageRejected,
                                            'ADMIN_PACKAGE_FILE_INVALID'):
                    builder.compile_fixed_admin_qualification()

    def test_private_carrier_requires_binding_before_host_io(self):
        carrier = importlib.import_module('admin_root_carrier_template')
        with patch.object(os, 'geteuid', side_effect=AssertionError('HOST_UID_DENIED')), \
             patch.object(subprocess, 'Popen', side_effect=AssertionError('HOST_PROCESS_DENIED')):
            with self.assertRaisesRegex(carrier.CarrierRejected, 'ADMIN_CARRIER_UNBOUND'):
                carrier.run()

    def test_private_challenge_requires_the_held_open_file_description(self):
        carrier = importlib.import_module('admin_root_carrier_template')
        helper = Path(__file__).parents[2] / 'packages/production-runtime/src/native-arm64/hr-s256-r2-child-proof.py'
        spec = importlib.util.spec_from_file_location('_disposable_admin_child_proof', helper)
        proof = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(proof)
        with tempfile.TemporaryDirectory() as directory, \
             patch.object(subprocess, 'Popen', side_effect=AssertionError('HOST_PROCESS_DENIED')):
            path = Path(directory) / 'window.lock'
            window = os.open(path, os.O_RDWR | os.O_CREAT | os.O_EXCL, 0o600)
            try:
                root, child = socket.socketpair()
                child_fd = child.detach()
                result = []
                worker = threading.Thread(target=lambda: result.append(
                    proof.prove(child_fd, window, 'a' * 64, trusted_uid=os.getuid())))
                worker.start()
                carrier._challenge(root, window, 'a' * 64, trusted_uid=os.getuid())
                worker.join(timeout=2)
                self.assertFalse(worker.is_alive())
                self.assertEqual(len(result), 1)
                root.close()

                other = os.open(path, os.O_RDWR | os.O_NOFOLLOW)
                root, child = socket.socketpair()
                def wrong_ofd():
                    raw = bytearray()
                    while not raw.endswith(b'\n'):
                        raw.extend(child.recv(1))
                    frame = json.loads(raw)
                    response = carrier._digest([frame['nonce'], frame['challenge'],
                        frame['receiptSha256'], frame['windowIdentity']])
                    child.sendmsg([response], [(socket.SOL_SOCKET, socket.SCM_RIGHTS,
                        array.array('i', [other]))])
                worker = threading.Thread(target=wrong_ofd)
                worker.start()
                with self.assertRaisesRegex(carrier.CarrierRejected, 'ADMIN_CARRIER_WINDOW_OFD'):
                    carrier._challenge(root, window, 'a' * 64, trusted_uid=os.getuid())
                worker.join(timeout=2)
                self.assertFalse(worker.is_alive())
                root.close(); child.close(); os.close(other)
            finally:
                os.close(window)

    def test_fixed_carrier_namespace_denies_wrong_parent_custody_and_path(self):
        carrier = importlib.import_module('admin_root_carrier_template')
        with patch.object(os, 'open', side_effect=AssertionError('HOST_OPEN_DENIED')):
            with self.assertRaisesRegex(carrier.CarrierRejected, 'ADMIN_CARRIER_NAMESPACE'):
                carrier._directory(Path('/tmp/caller-selected'))
        target = carrier.WINDOW_DIRECTORY
        def probe(parent_gid, parent_mode):
            names = {'/': 10}
            fd_paths = {10: '/'}
            closed = []
            def metadata(path):
                return types.SimpleNamespace(st_dev=1, st_ino=len(path),
                    st_mode=stat.S_IFDIR | (parent_mode if path ==
                        '/private/var/db/agent-deploy-system' else 0o755),
                    st_uid=0, st_gid=parent_gid if path ==
                        '/private/var/db/agent-deploy-system' else 0,
                    st_nlink=2, st_mtime_ns=1, st_ctime_ns=1)
            def fake_open(name, flags, *, dir_fd=None):
                path = '/' if dir_fd is None else fd_paths[dir_fd].rstrip('/') + '/' + name
                value = len(fd_paths) + 10
                fd_paths[value] = path
                return value
            def fake_stat(name, *, dir_fd=None, follow_symlinks=True):
                path = fd_paths[dir_fd].rstrip('/') + '/' + name
                return metadata(path)
            with patch.object(os, 'open', side_effect=fake_open), \
                 patch.object(os, 'stat', side_effect=fake_stat), \
                 patch.object(os, 'fstat', side_effect=lambda fd: metadata(fd_paths[fd])), \
                 patch.object(os, 'close', side_effect=closed.append):
                with self.assertRaisesRegex(carrier.CarrierRejected,
                                            'ADMIN_CARRIER_DS_PARENT'):
                    carrier._directory(target)
            self.assertTrue(closed)
        probe(0, 0o770)
        probe(80, 0o775)

    def test_carrier_proof_readback_is_closed_without_host_forwarding(self):
        carrier = importlib.import_module('admin_root_carrier_template')
        final = 'a' * 64
        valid = {'status': 'ROUTER_RESTART_SAFETY=PROVEN',
                 'floorCommit': '2097e4f9', 'deployedBinarySha256': final,
                 'provedAtWallMs': 123}
        raw = json.dumps(valid, sort_keys=True, separators=(',', ':')).encode()
        def check(payload):
            meta = types.SimpleNamespace(st_dev=1, st_ino=2,
                st_mode=stat.S_IFREG | 0o600, st_uid=0, st_gid=0, st_nlink=1,
                st_size=len(payload), st_mtime_ns=1, st_ctime_ns=1)
            with patch.object(os, 'stat', return_value=meta), \
                 patch.object(os, 'open', return_value=31), \
                 patch.object(os, 'fstat', return_value=meta), \
                 patch.object(os, 'pread', return_value=payload), \
                 patch.object(os, 'close', return_value=None), \
                 patch.object(subprocess, 'Popen',
                              side_effect=AssertionError('HOST_PROCESS_DENIED')):
                return carrier._proof(30, 'floor-proven.json', final)
        self.assertEqual(check(raw), valid)
        with self.assertRaisesRegex(carrier.CarrierRejected, 'ADMIN_CARRIER_PROOF_DUPLICATE'):
            check(raw[:-1] + b',"status":"ROUTER_RESTART_SAFETY=PROVEN"}')
        with self.assertRaisesRegex(carrier.CarrierRejected, 'ADMIN_CARRIER_PROOF_INVALID'):
            check(raw.replace(final.encode(), b'b' * 64))

    def test_prior_root_proof_is_decided_before_any_new_window_or_child(self):
        carrier = importlib.import_module('admin_root_carrier_template')
        final = 'a' * 64
        with tempfile.TemporaryDirectory() as directory, \
             patch.object(subprocess, 'Popen', side_effect=AssertionError('HOST_PROCESS_DENIED')):
            root = Path(directory)
            proof = root / 'proof'; proof.mkdir()
            window = root / 'window'; window.mkdir()
            proof_fd = os.open(proof, os.O_RDONLY | os.O_DIRECTORY)
            window_fd = os.open(window, os.O_RDONLY | os.O_DIRECTORY)
            real_stat, real_fstat = os.stat, os.fstat
            def root_meta(meta):
                return types.SimpleNamespace(**{name: getattr(meta, name) for name in
                    ('st_dev', 'st_ino', 'st_mode', 'st_gid', 'st_nlink', 'st_size',
                     'st_mtime_ns', 'st_ctime_ns')}, st_uid=0)
            try:
                with patch.object(os, 'stat', side_effect=lambda *a, **kw:
                         root_meta(real_stat(*a, **kw))), \
                     patch.object(os, 'fstat', side_effect=lambda fd:
                         root_meta(real_fstat(fd))), \
                     patch.object(carrier, 'PINS', {'qualificationOperationId':
                         'original-router-qualification-20260927-v1'}):
                    self.assertIsNone(carrier._prior_qualification(window_fd, proof_fd, final))
                    floor = {'status': 'ROUTER_RESTART_SAFETY=PROVEN',
                        'floorCommit': '2097e4f9', 'deployedBinarySha256': final,
                        'provedAtWallMs': 120}
                    validator = {'evidenceKind': 'restart_quiescence_proven',
                        'deployedBinarySha256': final, 'installedAtWallMs': 110}
                    encode = lambda value: json.dumps(value, sort_keys=True,
                        separators=(',', ':')).encode()
                    (proof / 'floor-proven.json').write_bytes(encode(floor))
                    os.chmod(proof / 'floor-proven.json', 0o600)
                    with self.assertRaisesRegex(carrier.CarrierRejected, 'ADMIN_CARRIER_PRIOR_INCOMPLETE'):
                        carrier._prior_qualification(window_fd, proof_fd, final)
                    (proof / 'validator-installed.json').write_bytes(encode(validator))
                    os.chmod(proof / 'validator-installed.json', 0o600)
                    with self.assertRaisesRegex(carrier.CarrierRejected, 'ADMIN_CARRIER_PRIOR_INCOMPLETE'):
                        carrier._prior_qualification(window_fd, proof_fd, final)
                    result = {'schema': 'HR_ORIGINAL_CARRIER_JOB_V1',
                        'operationId': 'original-router-qualification-20260927-v1',
                        'state': 'QUALIFICATION_COMPLETE', 'workerPid': 123,
                        'replayAllowed': False, 'qualificationComplete': True,
                        'proofSha256': [hashlib.sha256(encode(floor)).hexdigest(),
                                        hashlib.sha256(encode(validator)).hexdigest()]}
                    (window / '.carrier-result.json').write_bytes(encode(result))
                    os.chmod(window / '.carrier-result.json', 0o600)
                    self.assertEqual(carrier._prior_qualification(window_fd, proof_fd, final),
                                     (floor, validator))
                    (window / '.carrier-result.json').write_bytes(encode({**result,
                        'proofSha256': ['0' * 64, result['proofSha256'][1]]}))
                    with self.assertRaises(carrier.CarrierRejected):
                        carrier._prior_qualification(window_fd, proof_fd, final)
                    (window / '.carrier-result.json').write_bytes(encode(result))
                    with self.assertRaises(carrier.CarrierRejected):
                        carrier._prior_qualification(window_fd, proof_fd, 'b' * 64)
            finally:
                os.close(proof_fd); os.close(window_fd)

    def test_carrier_reuses_completed_root_chain_without_opening_window_or_child(self):
        carrier = importlib.import_module('admin_root_carrier_template')
        with tempfile.TemporaryDirectory() as directory:
            package = Path(directory)
            (package / 'admin_root_carrier.py').write_bytes(b'disposable-carrier')
            scratch = package / 'fixed-input'; scratch.write_bytes(b'x')
            floor, validator = {'status': 'ROUTER_RESTART_SAFETY=PROVEN'}, \
                               {'evidenceKind': 'restart_quiescence_proven'}
            original_stat, original_lstat = os.stat, Path.lstat
            def as_root(meta):
                value = types.SimpleNamespace(**{name: getattr(meta, name) for name in
                    ('st_dev', 'st_ino', 'st_mode', 'st_gid', 'st_nlink', 'st_size',
                     'st_mtime_ns', 'st_ctime_ns')}, st_uid=0)
                return value
            with patch.object(carrier, 'PINS', {'qualificationOperationId':
                    'original-router-qualification-20260927-v1',
                    'cutOperationId': 'hr-s256-admin-emergency-cut-20260928-v1',
                    'hostId': '961534a5-8c94-487d-8e55-d324a54e821a', **{key: 'a' * 64 for key in
                    ('entryManifestSha256', 'entrySha256', 'helperSha256',
                     'daemonSha256', 'pythonSha256', 'finalTreeSha256')}}), \
                 patch.object(carrier, 'LAUNCHER_SHA', 'b' * 64), \
                 patch.object(carrier, '__file__', str(package / 'admin_root_carrier.py')), \
                 patch.object(carrier.sys, 'argv', ['admin_root_carrier.py']), \
                 patch.object(carrier, 'PACKAGE_DIRECTORY', package), \
                 patch.object(carrier, '_directory', side_effect=lambda path:
                    (os.open(package, os.O_RDONLY | os.O_DIRECTORY), [])), \
                 patch.object(carrier, '_file', side_effect=lambda *args:
                    os.open(scratch, os.O_RDONLY)), \
                 patch.object(carrier, '_prior_qualification', return_value=(floor, validator)) as prior, \
                 patch.object(carrier, '_window', side_effect=AssertionError('WINDOW_STARTED')), \
                 patch.object(carrier.socket, 'socketpair', side_effect=AssertionError('SOCKET_STARTED')), \
                 patch.object(subprocess, 'Popen', side_effect=AssertionError('PROCESS_STARTED')), \
                 patch.object(os, 'geteuid', return_value=0), \
                 patch.object(os, 'stat', side_effect=lambda *a, **kw:
                    as_root(original_stat(*a, **kw))), \
                 patch.object(Path, 'lstat', new=lambda self, *a, **kw:
                    as_root(original_lstat(self, *a, **kw))):
                self.assertEqual(carrier.run(), (floor, validator))
                prior.assert_called_once()


if __name__ == '__main__':
    unittest.main()
