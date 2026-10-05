"""Exact offline compilation only; no shim or producer is executed."""
import ast
import hashlib
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import build_admin_fixed_large_shim as builder
import compile_admin_fixed_shim as compiler


def row(char, size):
    return {'sha256': char * 64, 'size': size}


def valid():
    return {'hostId': compiler.HOST_ID,
            'selfUpdateOperationId': compiler.SELF_UPDATE_ID,
            'installOperationId': compiler.INSTALL_ID,
            'captureOperationId': 'capture-fixed-once',
            'admissionOperationId': 'admission-fixed-once',
            'oldDsArtifacts': {name: row('a', 110215851 if name ==
                'deployment_system.py' else 100) for name in compiler.OLD_NAMES},
            'newDsArtifacts': {name: row('b', 110215852 if name ==
                'deployment_system.py' else 101) for name in compiler.OLD_NAMES},
            'newNode': row('c', 102), 'newPython': row('d', 103),
            'ownerUid': 502,
            'sourceSha256': hashlib.sha256(builder.build_bytes()).hexdigest(),
            'candidateSha256': 'f' * 64, 'binderSourceSha256': 'e' * 64}


class CompileFixedShimTest(unittest.TestCase):
    def test_default_inert_and_closed_exact_binding(self):
        with self.assertRaisesRegex(ValueError, 'UNBOUND'):
            compiler.compile_bytes()
        pins = valid()
        with patch.object(compiler, 'REVIEWED_BINDING', pins), \
             patch.object(compiler, '_bundle', return_value=(b'exact-bundle',
                          {'CANDIDATE.json': 'a' * 64})):
            compiled = compiler.compile_bytes()
            source = compiled.decode()
        self.assertGreater(len(compiled), 65536)
        import admin_fresh_shim_hook as hook
        with tempfile.TemporaryDirectory(prefix='admin-compiled-read-') as directory:
            path = Path(directory) / 'deploy_shim.py'
            path.write_bytes(compiled)
            with patch.object(hook, 'ADMIN_FRESH_ROOT_UID', os.geteuid()), \
                 patch.object(hook, 'require', lambda ok, code: None if ok else
                              (_ for _ in ()).throw(ValueError(code)), create=True):
                readback, digest = hook._admin_fresh_shim_read(
                    str(path), hashlib.sha256(compiled).hexdigest())
            self.assertEqual(readback, compiled)
            self.assertEqual(digest, hashlib.sha256(compiled).hexdigest())
        ast.parse(source)
        self.assertIn('ADMIN_FRESH_HOOK_ACTIVE = True', source)
        self.assertIn('ADMIN_FRESH_FACTORY = _make_admin_fresh', source)
        self.assertIn("ADMIN_FRESH_CAPTURE_ID = 'capture-fixed-once'", source)
        self.assertIn("ADMIN_FIXED_INSTALL_ID = 'ds-hr-admin-private-install-20260928-v1'", source)
        self.assertIn('ADMIN_FIXED_ROOT_HOST_OBSERVER = observe_fixed_host', source)
        self.assertIn("ADMIN_FRESH_BUNDLE = b'exact-bundle'", source)
        self.assertNotIn('HR_ADMIN_FRESH_PREPARE_V1', source)
        self.assertEqual(source.count('ADMIN_FRESH_HOOK_ACTIVE = True'), 1)

    def test_wrong_or_missing_pins_never_compile(self):
        for field, bad in (('hostId', '0' * 36), ('ownerUid', 0),
                           ('sourceSha256', '0' * 64), ('captureOperationId', ''),
                           ('oldDsArtifacts', {}), ('newPython', row('z', 4))):
            with self.subTest(field=field):
                pins = valid(); pins[field] = bad
                with patch.object(compiler, 'REVIEWED_BINDING', pins), \
                     patch.object(compiler, '_bundle', return_value=(b'x', {})), \
                     self.assertRaises(ValueError):
                    compiler.compile_bytes()
        pins = valid(); pins['unexpectedCallerPath'] = '/tmp/unsafe'
        with patch.object(compiler, 'REVIEWED_BINDING', pins), \
             patch.object(compiler, '_bundle', return_value=(b'x', {})), \
             self.assertRaisesRegex(ValueError, 'UNBOUND'):
            compiler.compile_bytes()

    def test_transient_tree_read_change_never_enters_bundle(self):
        import admin_final_binding as binder
        import admin_package as package
        candidate = binder.CANDIDATE_DIRECTORY
        original = package._read
        changed = []
        leaf = 'packages/agent-router/src/reconciliation/quiescence-bundle.js'

        def transient(root, name, limit):
            raw = original(root, name, limit)
            if (Path(root) == candidate / 'tree' and name == leaf or
                    Path(root) == candidate and name == 'tree/' + leaf):
                changed.append(name)
                if len(changed) == 2:
                    return raw + b'\n// transient changed byte\n'
            return raw

        pins = {'candidateSha256': binder.CANDIDATE_SHA256,
                'binderSourceSha256': hashlib.sha256(
                    Path(binder.__file__).read_bytes()).hexdigest()}
        with patch.object(package, '_read', side_effect=transient):
            with self.assertRaisesRegex(ValueError, 'ADMIN_SHIM_CAPTURE_CHANGED'):
                compiler._bundle(pins)
        self.assertEqual(changed, [leaf, 'tree/' + leaf])


if __name__ == '__main__':
    unittest.main()
