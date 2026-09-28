"""The admin cut is a second closed DS action, never an alias of the R2 ID."""

import ast
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import types
import unittest
from unittest.mock import patch

from build_candidate import build_current_bytes
from build_admin_candidate import build_admin_current_bytes


class AdminCandidateTest(unittest.TestCase):
    def test_distinct_fixed_action_and_namespaced_root_receipts(self):
        source = build_admin_current_bytes().decode('utf-8')
        ast.parse(source)
        self.assertIn('"HR_S256_ADMIN_EMERGENCY_CUT_V1": {"action", "operation_id"}', source)
        self.assertIn('"HR_S256_TRUSTED_QUIESCENCE_CUT_V1": {"action", "operation_id"}', source)
        self.assertIn('def hr_s256_admin_action(request):', source)
        self.assertIn('hr-s256-admin-emergency-cut-20260928-v1', source)
        self.assertIn('hr-s256-trusted-quiescence-cut-20260925-v1', source)
        self.assertIn('HR_ADMIN_PROFILE.validate_request(request)', source)
        self.assertIn('HR_ADMIN_REAL_OS.require_activation()', source)
        self.assertIn('HR_ADMIN_JOURNAL = _make_HR_ADMIN_JOURNAL()', source)
        self.assertIn('HR_ADMIN_ONE_SHOT = _make_HR_ADMIN_ONE_SHOT()', source)
        self.assertIn('HR_ADMIN_BOOTSTRAP.installation_bootstrap()  # Distinct admin package; default zero-effect.', source)
        self.assertIn("globals().get('HR_ADMIN_BOOTSTRAP')", source)
        self.assertIn('hr-s256-admin-one-shot-authority.json', source)
        self.assertIn('hr-s256-admin-source-scope.json', source)
        tree = ast.parse(source)
        for node in tree.body:
            if isinstance(node, ast.FunctionDef) and node.name.startswith('_make_HR_ADMIN_'):
                old_names = {value.value for value in ast.walk(node)
                             if isinstance(value, ast.Constant) and isinstance(value.value, str)
                             and value.value in ('HR_BOOTSTRAP', 'HR_REAL_OS', 'HR_JOURNAL', 'HR_INVENTORY')}
                self.assertFalse(old_names, f'{node.name}: {old_names}')

    def test_old_compiled_cut_is_unchanged_and_new_cut_is_default_inert(self):
        baseline = ast.parse(build_current_bytes().decode('utf-8'))
        candidate = ast.parse(build_admin_current_bytes().decode('utf-8'))
        old_names = ('_make_HR_PROFILE', '_make_HR_JOURNAL', 'hr_s256_action')
        for name in old_names:
            before = next(node for node in baseline.body
                          if isinstance(node, ast.FunctionDef) and node.name == name)
            after = next(node for node in candidate.body
                         if isinstance(node, ast.FunctionDef) and node.name == name)
            self.assertEqual(ast.dump(before), ast.dump(after), name)
        real_os = next(node for node in candidate.body if isinstance(node, ast.FunctionDef)
                       and node.name == '_make_HR_ADMIN_REAL_OS')
        scope = {'types': types}
        exec(compile(ast.Module(body=[real_os], type_ignores=[]), '<fixed-admin-real-os>', 'exec'), scope)
        module = scope['_make_HR_ADMIN_REAL_OS']()
        with patch.object(os, 'geteuid', side_effect=AssertionError('HOST_IDENTITY_READ')):
            with self.assertRaisesRegex(module.Rejected, 'PROFILE_NOT_BOOTSTRAPPED'):
                module.require_activation()

    def test_admin_request_is_exact_two_fields_and_never_old_operation_id(self):
        candidate = ast.parse(build_admin_current_bytes().decode('utf-8'))
        profile = next(node for node in candidate.body if isinstance(node, ast.FunctionDef)
                       and node.name == '_make_HR_ADMIN_PROFILE')
        scope = {'types': types}
        exec(compile(ast.Module(body=[profile], type_ignores=[]), '<fixed-admin-profile>', 'exec'), scope)
        module = scope['_make_HR_ADMIN_PROFILE']()
        valid = {'action': 'HR_S256_ADMIN_EMERGENCY_CUT_V1',
                 'operation_id': 'hr-s256-admin-emergency-cut-20260928-v1'}
        self.assertEqual(module.validate_request(valid), valid)
        for changed in ({**valid, 'operation_id': 'hr-s256-trusted-quiescence-cut-20260925-v1'},
                        {**valid, 'action': 'HR_S256_TRUSTED_QUIESCENCE_CUT_V1'},
                        {**valid, 'proof': True}):
            with self.assertRaises(module.Rejected):
                module.validate_request(changed)

    def test_admin_journal_claim_is_once_and_never_creates_old_r2_directory(self):
        candidate = ast.parse(build_admin_current_bytes().decode('utf-8'))
        journal = next(node for node in candidate.body if isinstance(node, ast.FunctionDef)
                       and node.name == '_make_HR_ADMIN_JOURNAL')
        with tempfile.TemporaryDirectory() as root:
            os.chmod(root, 0o700)
            scope = {'types': types, 'STATE_ROOT': root, 'TEST_MODE': True}
            exec(compile(ast.Module(body=[journal], type_ignores=[]), '<fixed-admin-journal>', 'exec'), scope)
            module = scope['_make_HR_ADMIN_JOURNAL']()
            self.assertEqual(module.OPERATION_ID, 'hr-s256-admin-emergency-cut-20260928-v1')
            digest = module.seal_intent('c' * 64, 'a' * 64, 1)
            self.assertRegex(digest, '^[a-f0-9]{64}$')
            self.assertEqual(module.readback('intent')[0]['operationId'], module.OPERATION_ID)
            self.assertTrue((Path(root) / module.OPERATION_ID / 'intent.json').is_file())
            self.assertFalse((Path(root) / 'hr-s256-trusted-quiescence-cut-20260925-v1').exists())
            with self.assertRaises(module.Rejected):
                module.seal_intent('c' * 64, 'a' * 64, 1)

    def test_compiled_admin_handle_is_inert_before_lock_or_protected_io(self):
        with tempfile.TemporaryDirectory() as root:
            path = Path(root) / 'deployment_system.py'
            path.write_bytes(build_admin_current_bytes())
            env = {'DS_TEST_MODE': '0', 'DS_STATE_ROOT': root,
                   'DS_INSTALL_DIR': str(Path(root) / 'install'),
                   'DS_GEN_ROOT': str(Path(root) / 'generations')}
            with patch.dict(os.environ, env), patch.object(subprocess, 'Popen',
                    side_effect=AssertionError('HOST_PROCESS_DENIED')):
                spec = importlib.util.spec_from_file_location('fixed_admin_compiled', path)
                ds = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(ds)
                with patch.object(ds, 'mutation_lock', side_effect=AssertionError('LOCK_ENTERED')):
                    request = {'action': 'HR_S256_ADMIN_EMERGENCY_CUT_V1',
                               'operation_id': 'hr-s256-admin-emergency-cut-20260928-v1'}
                    response, restart = ds.handle(json.dumps(request).encode())
                    self.assertEqual(response, {'ok': False, 'error': 'PROFILE_NOT_BOOTSTRAPPED'})
                    self.assertIsNone(restart)
                    for changed in ({**request, 'operation_id': 'hr-s256-trusted-quiescence-cut-20260925-v1'},
                                    {**request, 'pass': True}):
                        response, restart = ds.handle(json.dumps(changed).encode())
                        self.assertFalse(response['ok'])
                        self.assertIsNone(restart)
            self.assertFalse((Path(root) / 'hr-s256-admin-emergency-cut-20260928-v1').exists())


if __name__ == '__main__':
    unittest.main()
