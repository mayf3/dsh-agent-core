"""Private installation hook does not add an IPC action or alter DS handlers."""
import ast
import hashlib
import importlib
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch


class CandidateTest(unittest.TestCase):
    def test_exact_overlay_is_inert_and_only_adds_private_serve_hook(self):
        builder = importlib.import_module('build_admin_private_ds_candidate')
        source = b'def handle(raw):\n    return raw\n\ndef serve():\n    server.listen(8)\n    while True:\n        pass\n'
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory) / 'deployment_system.py'
            base.write_bytes(source)
            module = (Path(builder.__file__).parent / 'admin_ds_private_bootstrap.py').read_bytes()
            with patch.object(builder, 'BASE', base), \
                 patch.object(builder, 'BASE_SHA256', hashlib.sha256(source).hexdigest()), \
                 patch.object(builder, 'MODULE_SHA256', hashlib.sha256(module).hexdigest()):
                output = builder.build_bytes()
                ast.parse(output.decode())
                self.assertEqual(output.count(b'ADMIN_PRIVATE_QUALIFIER.wait_for_committed_install'), 1)
                self.assertIn(b'def observe_fixed_host():', output)
                self.assertIn(b'QUALIFIER_ACTIVE = False', output)
                self.assertIn(b'ROOT_HOST_OBSERVER = None', output)
                self.assertNotIn(b'HR_ORIGINAL_QUALIFICATION_START_V1', output)
                self.assertEqual(output.count(b'def handle(raw):\n    return raw'), 1)
                with patch.object(builder, 'BASE_SHA256', '0' * 64):
                    with self.assertRaisesRegex(ValueError, 'BASE_CHANGED'):
                        builder.build_bytes()
                with patch.object(builder, 'HOST_OBSERVER_SHA256', '0' * 64):
                    with self.assertRaisesRegex(ValueError, 'HOST_OBSERVER_CHANGED'):
                        builder.build_bytes()


if __name__ == '__main__':
    unittest.main()
