"""Fixed same-daemon installation publisher; no live process or protected IO."""
from pathlib import Path
import subprocess
import os
import json
import hashlib
from contextlib import contextmanager, ExitStack
from unittest.mock import patch
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts/lib/hr-s256-one-shot'))
from process_confinement import confine_processes


class BootstrapTest(unittest.TestCase):
    def test_actual_assembled_daemon_has_inert_installation_time_publisher(self):
        with confine_processes(subprocess) as recorder:
            import test_orchestration
            with tempfile.TemporaryDirectory() as root:
                ds = test_orchestration.FixedAssembledActionTest().assembled(root)
                self.assertTrue(hasattr(ds, 'HR_BOOTSTRAP'), 'fixed installation-time publisher missing')
                self.assertIsNone(ds.HR_BOOTSTRAP.installation_bootstrap())
                self.assertIsNone(ds.HR_REAL_OS.BOOTSTRAP_PACKAGE_SHA256)
                self.assertFalse((Path(root) / 'receipts').exists())
            self.assertEqual(recorder.calls, [])

    def test_standalone_reader_default_guard_remains_zero_read(self):
        import importlib.util
        with confine_processes(subprocess) as recorder:
            spec = importlib.util.spec_from_file_location('inert_fixed_reader',
                ROOT / 'scripts/lib/hr-s256-one-shot/fixed_os.py')
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            with patch.object(module, 'protected_json', side_effect=AssertionError('protected read')):
                with self.assertRaisesRegex(Exception, 'PROFILE_NOT_BOOTSTRAPPED'):
                    module.require_activation()
            self.assertEqual(recorder.calls, [])

    @contextmanager
    def fixture(self, current=False):
        with confine_processes(subprocess) as recorder:
            import test_orchestration
            import importlib.util
            with tempfile.TemporaryDirectory() as root, ExitStack() as stack:
                ds = test_orchestration.FixedAssembledActionTest().assembled(root)
                if current:
                    spec = importlib.util.spec_from_file_location('current_builder_bool_probe', ROOT /
                        'deployment-artifacts/hr-s256-trusted-cut-v1/build_candidate.py')
                    builder = importlib.util.module_from_spec(spec)
                    spec.loader.exec_module(builder)
                    path = Path(root) / 'current-deployment-system.py'
                    path.write_bytes(builder.build_current_bytes())
                    with patch.dict(os.environ, {'DS_TEST_MODE': '1', 'DS_STATE_ROOT': root,
                            'DS_CONFIG_DIR': root + '/config', 'DS_INSTALL_DIR': root + '/install',
                            'DS_GEN_ROOT': root + '/gens'}):
                        spec = importlib.util.spec_from_file_location('current_bool_probe', path)
                        ds = importlib.util.module_from_spec(spec)
                        spec.loader.exec_module(ds)
                # Entry manifest remains the exact profile contract, not caller PASS.
                gated = 'packages/production-runtime/src/native-arm64/hr-s256-r2-gated-runtime.mjs'
                manifest = {'version': 1, 'operationId': ds.HR_PROFILE.OPERATION_ID,
                    'entries': [{'path': gated, 'sha256': ds.HR_GATED_ENTRY_SHA256,
                                 'helperSha256': ds.HR_CHILD_PROOF_SHA256}],
                    'retiredEntry': {'path': 'scripts/production-runtime.mjs',
                        'sha256': hashlib.sha256(b'#!/usr/bin/env node\nthrow new Error("HR_UNGATED_ENTRY_RETIRED");\n').hexdigest()},
                    'routes': [{'id': r, 'target': '/usr/local/libexec/agent-core/app/' + gated}
                        for r in ('gui/505/ai.agent-core.runtime', 'system/ai.agent-core.runtime')]}
                floor = {'status': 'ROUTER_RESTART_SAFETY=PROVEN', 'floorCommit': '2097e4f9',
                    'deployedBinarySha256': 'a' * 64, 'provedAtWallMs': 10}
                validator = {'evidenceKind': 'restart_quiescence_proven',
                    'deployedBinarySha256': 'a' * 64, 'installedAtWallMs': 11}
                raw = lambda value: ds.canonical(value)
                sha = lambda value: hashlib.sha256(value).hexdigest()
                authority = {'operationId': ds.HR_PROFILE.OPERATION_ID, 'hostId': 'fixture-host',
                    'consumingBinarySha256': 'a' * 64, 'floorProvenReceiptSha256': sha(raw(floor)),
                    'validatorInstalledReceiptSha256': sha(raw(validator)),
                    'rollbackCaptureOperationId': 'op-fixture-admitted', 'expectedRegistrySha256': 'b' * 64}
                scope = {'version': 1, 'operationId': ds.HR_PROFILE.OPERATION_ID, 'hostId': 'fixture-host',
                    'entryManifest': manifest, 'sources': ['fixed-DS-owner',
                        'gui/505/ai.agent-core.runtime', 'system/ai.agent-core.runtime', gated]}
                inputs = dict(zip(ds.HR_BOOTSTRAP.TARGETS, map(raw, (authority, scope, floor, validator))))
                digest = sha(raw({name: sha(value) for name, value in inputs.items()}))
                paths = {name: Path(root) / 'published' / name for name in inputs}
                Path(root, 'published').mkdir(mode=0o700)
                Path(root, 'receipts').mkdir(mode=0o700)
                # Private closure cells mirror future compiled package, never IPC data.
                method = ds.HR_BOOTSTRAP.installation_bootstrap
                cells = dict(zip(method.__code__.co_freevars, method.__closure__))
                for name, value in [('TRUSTED_ARTIFACTS', inputs), ('INSTALLATION_PACKAGE_SHA256', digest),
                        ('TARGETS', paths), ('CUSTODY_UID', os.getuid())]:
                    # Other helpers share the SAME enclosing maker cell.
                    found = cells.get(name)
                    if found is None:
                        for fn in (ds.HR_BOOTSTRAP._validated_inputs, ds.HR_BOOTSTRAP._read_at, ds.HR_BOOTSTRAP._publish):
                            found = dict(zip(fn.__code__.co_freevars, fn.__closure__)).get(name)
                            if found is not None: break
                    self.assertIsNotNone(found, name)
                    old = found.cell_contents
                    found.cell_contents = value
                    stack.callback(setattr, found, 'cell_contents', old)
                # Disposable owned parents; no actual protected path/OS process.
                parentcell = cells['_parent']; oldparent = parentcell.cell_contents
                parentcell.cell_contents = lambda path: os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
                stack.callback(setattr, parentcell, 'cell_contents', oldparent)
                stack.enter_context(patch.object(os, 'geteuid', return_value=0))
                stack.enter_context(patch.object(os, 'fchown', return_value=None))
                yield ds, inputs, paths, root
            self.assertEqual(recorder.calls, [])

    def test_fixed_publication_fsync_readback_activation_and_duplicate_no_replay(self):
        with self.fixture() as (ds, inputs, paths, root):
            self.assertIsNone(ds.HR_BOOTSTRAP.activation_pins())
            result = ds.HR_BOOTSTRAP.installation_bootstrap()
            for name, path in paths.items():
                self.assertEqual(path.read_bytes(), inputs[name])
                self.assertEqual(path.stat().st_mode & 0o777, 0o600)
            self.assertEqual(result['authority'], hashlib.sha256(inputs['hr-s256-one-shot-authority.json']).hexdigest())
            receipt = json.loads(Path(root, 'receipts', ds.HR_BOOTSTRAP.INSTALLATION_ID + '.json').read_text())
            self.assertEqual(receipt['state'], 'COMMITTED')
            with self.assertRaisesRegex(Exception, 'INSTALLATION_NO_REPLAY'):
                ds.HR_BOOTSTRAP.installation_bootstrap()

    def test_missing_wrong_floor_or_unqualified_source_rejects_before_any_publication(self):
        for kind in ('digest', 'floor', 'validator', 'scope', 'private'):
            with self.subTest(kind=kind), self.fixture() as (ds, inputs, paths, root):
                key = {'floor': 'floor-proven.json', 'validator': 'validator-installed.json',
                    'scope': 'hr-s256-source-scope.json', 'private': 'hr-s256-one-shot-authority.json'}.get(kind)
                if key:
                    value = json.loads(inputs[key])
                    if kind == 'floor': value['status'] = 'UNKNOWN'
                    if kind == 'validator': value['deployedBinarySha256'] = 'c' * 64
                    if kind == 'scope': value['sources'].append('hidden-writer')
                    if kind == 'private': value['privatePayload'] = 'sensitive-fixture'
                    inputs[key] = ds.canonical(value)
                else: inputs['floor-proven.json'] += b' '
                expected = 'INSTALLATION_PACKAGE_DIGEST'
                if kind != 'digest':
                    if kind in ('floor', 'validator'):
                        authority = json.loads(inputs['hr-s256-one-shot-authority.json'])
                        receiptkey = 'floorProvenReceiptSha256' if kind == 'floor' else 'validatorInstalledReceiptSha256'
                        authority[receiptkey] = hashlib.sha256(inputs[key]).hexdigest()
                        inputs['hr-s256-one-shot-authority.json'] = ds.canonical(authority)
                    method = ds.HR_BOOTSTRAP._validated_inputs
                    pin = dict(zip(method.__code__.co_freevars, method.__closure__))['INSTALLATION_PACKAGE_SHA256']
                    pin.cell_contents = hashlib.sha256(ds.canonical({name: hashlib.sha256(value).hexdigest()
                        for name, value in inputs.items()})).hexdigest()
                    expected = {'floor': 'INSTALLATION_PROOF_UNKNOWN', 'validator': 'INSTALLATION_PROOF_UNKNOWN',
                        'scope': 'INSTALLATION_SCOPE_UNKNOWN', 'private': 'INSTALLATION_AUTHORITY_UNKNOWN'}[kind]
                with self.assertRaisesRegex(Exception, expected):
                    ds.HR_BOOTSTRAP.installation_bootstrap()
                self.assertTrue(all(not path.exists() for path in paths.values()))
                self.assertEqual(list(Path(root, 'receipts').iterdir()), [])
                self.assertIsNone(ds.HR_BOOTSTRAP.activation_pins())

    def test_post_effect_crash_preserves_unknown_and_cannot_resume_or_activate(self):
        with self.fixture() as (ds, inputs, paths, root):
            method = ds.HR_BOOTSTRAP.installation_bootstrap
            cell = dict(zip(method.__code__.co_freevars, method.__closure__))['_publish']
            original = cell.cell_contents
            calls = []
            def crash(parent, name, raw):
                calls.append(name)
                original(parent, name, raw)
                if name == 'floor-proven.json': raise OSError('disposable crash after fsync')
            cell.cell_contents = crash
            try:
                with self.assertRaises(OSError): ds.HR_BOOTSTRAP.installation_bootstrap()
            finally: cell.cell_contents = original
            self.assertTrue(paths['floor-proven.json'].exists())
            self.assertFalse(paths['hr-s256-one-shot-authority.json'].exists())
            receipt = json.loads(Path(root, 'receipts', ds.HR_BOOTSTRAP.INSTALLATION_ID + '.json').read_text())
            self.assertEqual(receipt['state'], 'UNKNOWN')
            self.assertIsNone(ds.HR_BOOTSTRAP.activation_pins())
            # A later daemon cannot replay persisted UNKNOWN either.
            state = dict(zip(method.__code__.co_freevars, method.__closure__))['_state'].cell_contents
            state['attempted'] = False
            with self.assertRaisesRegex(Exception, 'INSTALLATION_UNKNOWN_NO_REPLAY'):
                ds.HR_BOOTSTRAP.installation_bootstrap()
            self.assertEqual(calls, [ds.HR_BOOTSTRAP.INSTALLATION_ID + '.json', 'floor-proven.json'])

    def test_fixed_destination_symlink_or_existing_bytes_never_overwritten(self):
        for symlink in (False, True):
            with self.subTest(symlink=symlink), self.fixture() as (ds, inputs, paths, root):
                target = paths['floor-proven.json']
                if symlink:
                    other = Path(root) / 'unrelated.txt'
                    other.write_bytes(b'preserve')
                    target.symlink_to(other)
                    link_identity = target.lstat()
                else:
                    target.write_bytes(b'preserve')
                with self.assertRaisesRegex(Exception, 'INSTALLATION_DESTINATION_EXISTS'):
                    ds.HR_BOOTSTRAP.installation_bootstrap()
                if symlink:
                    self.assertEqual(other.read_bytes(), b'preserve')  # Known disposable referent, never follow target.
                    self.assertEqual(target.lstat(), link_identity)
                    self.assertEqual(os.readlink(target), str(other))
                else:
                    self.assertEqual(target.read_bytes(), b'preserve')
                self.assertIsNone(ds.HR_BOOTSTRAP.activation_pins())
                receipt = json.loads(Path(root, 'receipts', ds.HR_BOOTSTRAP.INSTALLATION_ID + '.json').read_text())
                self.assertEqual(receipt['state'], 'UNKNOWN')

    def test_post_write_drift_fsync_failure_or_receipt_unknown_cannot_activate(self):
        for kind in ('drift', 'fsync', 'receipt'):
            with self.subTest(kind=kind), self.fixture() as (ds, inputs, paths, root):
                method = ds.HR_BOOTSTRAP.installation_bootstrap
                if kind == 'fsync':
                    with patch.object(os, 'fsync', side_effect=OSError('disposable fsync failure')):
                        with self.assertRaises(OSError): ds.HR_BOOTSTRAP.installation_bootstrap()
                elif kind == 'drift':
                    cell = dict(zip(method.__code__.co_freevars, method.__closure__))['_publish']
                    original = cell.cell_contents
                    def drift(parent, name, raw):
                        original(parent, name, raw)
                        if name == 'floor-proven.json': paths[name].write_bytes(b'changed-after-fsync')
                    cell.cell_contents = drift
                    try:
                        with self.assertRaisesRegex(Exception, 'INSTALLATION_OUTPUT_CHANGED'):
                            ds.HR_BOOTSTRAP.installation_bootstrap()
                    finally: cell.cell_contents = original
                else:
                    path = Path(root, 'receipts', ds.HR_BOOTSTRAP.INSTALLATION_ID + '.json')
                    path.write_bytes(ds.canonical({'state': 'UNKNOWN'}))
                    path.chmod(0o600)
                    with self.assertRaisesRegex(Exception, 'INSTALLATION_UNKNOWN_NO_REPLAY'):
                        ds.HR_BOOTSTRAP.installation_bootstrap()
                self.assertIsNone(ds.HR_BOOTSTRAP.activation_pins())
                with self.assertRaisesRegex(Exception, 'INSTALLATION_NO_REPLAY'):
                    ds.HR_BOOTSTRAP.installation_bootstrap()

    def test_committed_restart_reattachment_is_readonly_and_detects_drift(self):
        with self.fixture() as (ds, inputs, paths, root):
            first = ds.HR_BOOTSTRAP.installation_bootstrap()
            method = ds.HR_BOOTSTRAP.installation_bootstrap
            cells = dict(zip(method.__code__.co_freevars, method.__closure__))
            state = cells['_state'].cell_contents
            state.update(attempted=False, pins=None)
            original = cells['_publish'].cell_contents
            cells['_publish'].cell_contents = lambda *args: self.fail('no re-publication on restart')
            try:
                self.assertEqual(ds.HR_BOOTSTRAP.installation_bootstrap(), first)
                state.update(attempted=False, pins=None)
                paths['validator-installed.json'].write_bytes(b'changed')
                with self.assertRaisesRegex(Exception, 'INSTALLATION_OUTPUT_CHANGED'):
                    ds.HR_BOOTSTRAP.installation_bootstrap()
                self.assertIsNone(ds.HR_BOOTSTRAP.activation_pins())
            finally: cells['_publish'].cell_contents = original

    def test_creation_race_cannot_overwrite_and_trusted_input_snapshot_is_immutable(self):
        for kind in ('destination_race', 'input_race'):
            with self.subTest(kind=kind), self.fixture() as (ds, inputs, paths, root):
                method = ds.HR_BOOTSTRAP.installation_bootstrap
                cell = dict(zip(method.__code__.co_freevars, method.__closure__))['_publish']
                original = cell.cell_contents
                before = dict(inputs)
                def race(parent, name, raw):
                    if name == 'floor-proven.json':
                        if kind == 'destination_race': paths[name].write_bytes(b'other-writer')
                        else: inputs[name] = b'not-trusted-new-bytes'
                    original(parent, name, raw)
                cell.cell_contents = race
                try:
                    if kind == 'destination_race':
                        with self.assertRaises(FileExistsError): ds.HR_BOOTSTRAP.installation_bootstrap()
                        self.assertEqual(paths['floor-proven.json'].read_bytes(), b'other-writer')
                        self.assertIsNone(ds.HR_BOOTSTRAP.activation_pins())
                    else:
                        ds.HR_BOOTSTRAP.installation_bootstrap()
                        self.assertEqual(paths['floor-proven.json'].read_bytes(), before['floor-proven.json'])
                finally: cell.cell_contents = original

    def test_activation_reader_accepts_only_complete_published_digest_bound_outputs(self):
        with self.fixture() as (ds, inputs, paths, root):
            with self.assertRaisesRegex(Exception, 'PROFILE_NOT_BOOTSTRAPPED'):
                ds.HR_REAL_OS.require_activation()
            ds.HR_BOOTSTRAP.installation_bootstrap()
            reader = ds.HR_REAL_OS.require_activation
            cell = dict(zip(reader.__code__.co_freevars, reader.__closure__))['protected_json']
            original = cell.cell_contents
            seen = []
            def disposable_protected_json(path, expected, uid=0):
                name = path.name
                self.assertIn(name, paths)
                seen.append(name)
                raw = paths[name].read_bytes()
                ds.HR_PROFILE.require(hashlib.sha256(raw).hexdigest() == expected, 'PROTECTED_INPUT_DIGEST')
                return json.loads(raw)
            cell.cell_contents = disposable_protected_json
            try:
                authority = ds.HR_REAL_OS.require_activation()
                self.assertEqual(authority, json.loads(inputs['hr-s256-one-shot-authority.json']))
                self.assertEqual(ds.HR_REAL_OS.qualified_source_scope(),
                    json.loads(inputs['hr-s256-source-scope.json']))
                paths['hr-s256-one-shot-authority.json'].write_bytes(b'changed')
                with self.assertRaisesRegex(Exception, 'PROTECTED_INPUT_DIGEST'):
                    ds.HR_REAL_OS.require_activation()
                self.assertNotIn('floor-proven.json', seen)  # No producer or live preflight executed here.
            finally: cell.cell_contents = original

    def test_current_daemon_bool_version_receipt_never_reactivates_on_reattachment(self):
        with self.fixture(current=True) as (ds, inputs, paths, root):
            self.assertEqual(ds.VERSION, 1)
            ds.HR_BOOTSTRAP.installation_bootstrap()
            path = Path(root, 'receipts', ds.HR_BOOTSTRAP.INSTALLATION_ID + '.json')
            record = json.loads(path.read_text())
            record['version'] = True
            path.write_bytes(ds.canonical(record))
            method = ds.HR_BOOTSTRAP.installation_bootstrap
            cells = dict(zip(method.__code__.co_freevars, method.__closure__))
            cells['_state'].cell_contents.update(attempted=False, pins=None)
            original = cells['_publish'].cell_contents
            cells['_publish'].cell_contents = lambda *args: self.fail('no publication during read-only reattachment')
            try:
                with self.assertRaisesRegex(Exception, 'INSTALLATION_UNKNOWN_NO_REPLAY'):
                    ds.HR_BOOTSTRAP.installation_bootstrap()
                self.assertIsNone(ds.HR_BOOTSTRAP.activation_pins())
                self.assertEqual(json.loads(path.read_text())['version'], True)
                for name, file in paths.items(): self.assertEqual(file.read_bytes(), inputs[name])
            finally: cells['_publish'].cell_contents = original

    def test_current_ds_composition_preserves_v5_e7_and_update_function_bytes(self):
        import ast
        with confine_processes(subprocess) as recorder:
            import test_orchestration
            spec = __import__('importlib.util', fromlist=['']).spec_from_file_location('fixed_builder_current',
                ROOT / 'deployment-artifacts/hr-s256-trusted-cut-v1/build_candidate.py')
            builder = __import__('importlib.util', fromlist=['']).module_from_spec(spec)
            spec.loader.exec_module(builder)
            raw = builder.build_current_bytes().decode()
            base = Path('/Users/yanfenma/workspace/artifacts/DEPLOYMENT_BACKLOG/coherent-v5-ds-update-prep-20260926-v1/artdir/deployment_system.py').read_text()
            def definitions(source):
                return {node.name: ast.get_source_segment(source, node) for node in ast.parse(source).body
                    if isinstance(node, ast.FunctionDef)}
            before, after = definitions(base), definitions(raw)
            for name in before:
                if name not in ('handle', 'serve'): self.assertEqual(after[name], before[name], name)
            self.assertIn('HR_BOOTSTRAP.installation_bootstrap()', after['serve'])
            self.assertEqual(after['serve'].replace('    HR_BOOTSTRAP.installation_bootstrap()  # Fixed install-time only; default zero-effect.\n', ''), before['serve'])
            normalized = raw
            start = normalized.index('import types\n\nHR_PROJECTOR_SOURCE')
            end = normalized.index('def handle(raw):\n', start)
            normalized = normalized[:start] + normalized[end:]
            normalized = normalized.replace('            "HR_S256_TRUSTED_QUIESCENCE_CUT_V1": {"action", "operation_id"},\n', '')
            normalized = normalized.replace('        if action == HR_PROFILE.ACTION:\n            return hr_s256_action(request), None\n', '')
            normalized = normalized.replace('    HR_BOOTSTRAP.installation_bootstrap()  # Fixed install-time only; default zero-effect.\n', '')
            self.assertEqual(normalized, base)  # All other current daemon/E7/constants bytes preserved.
            self.assertEqual(recorder.calls, [])


if __name__ == '__main__':
    unittest.main()
