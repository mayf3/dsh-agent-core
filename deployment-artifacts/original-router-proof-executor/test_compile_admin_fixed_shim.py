"""Exact offline compilation only; no shim or producer is executed."""
import ast
import hashlib
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
            source = compiler.compile_bytes().decode()
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


if __name__ == '__main__':
    unittest.main()
