"""Disposable checks of the fixed reviewed offline source composition."""
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import build_admin_offline_stage as stage
from admin_package import _tree_sha256


class OfflineStageTests(unittest.TestCase):
    def test_exact_stage_preserves_ordinary_agent_and_is_inert(self):
        with tempfile.TemporaryDirectory(prefix='admin-offline-') as directory:
            output = Path(directory) / 'candidate'
            pins = stage.assemble(output)
            self.assertFalse(pins['executable'])
            self.assertEqual(_tree_sha256(output / 'tree'), pins['finalTreeSha256'])
            self.assertNotEqual(pins['finalTreeSha256'], stage.ADMIN_STAGE_SHA)
            self.assertEqual(json.loads((output / 'CANDIDATE.json').read_bytes()), pins)
            self.assertFalse((output / 'PACKAGE.json').exists())
            self.assertIn('currentLivePreimageTreeSha256', pins['unbound'])
            self.assertIn('productionAuthority', pins['unbound'])
            for name in stage.PRESERVED:
                raw = (output / 'tree' / name).read_bytes()
                self.assertEqual(hashlib.sha256(raw).hexdigest(),
                                 pins['preservedOrdinaryPaths'][name])
                self.assertEqual(raw, (stage.RESTORED / name).read_bytes())
            self.assertEqual(hashlib.sha256((output / 'package-inputs' /
                'entry-manifest.json').read_bytes()).hexdigest(),
                pins['entryManifestSha256'])

    def test_wrong_reviewed_host_join_rejects_before_output(self):
        name, pins = next(iter(stage.HOST_JOIN.items()))
        with tempfile.TemporaryDirectory(prefix='admin-offline-') as directory:
            output = Path(directory) / 'candidate'
            with patch.dict(stage.HOST_JOIN, {name: ('0' * 64, pins[1])}):
                with self.assertRaisesRegex(stage.OfflineStageRejected,
                                            'ADMIN_HOST_PREIMAGE_CHANGED'):
                    stage.assemble(output)
            self.assertFalse(output.exists())

    def test_wrong_restored_digest_rejects_before_output(self):
        with tempfile.TemporaryDirectory(prefix='admin-offline-') as directory:
            output = Path(directory) / 'candidate'
            with patch.object(stage, 'RESTORED_SHA', '0' * 64):
                with self.assertRaisesRegex(stage.OfflineStageRejected,
                                            'ADMIN_RESTORED_CHANGED'):
                    stage.assemble(output)
            self.assertFalse(output.exists())


if __name__ == '__main__':
    unittest.main()
