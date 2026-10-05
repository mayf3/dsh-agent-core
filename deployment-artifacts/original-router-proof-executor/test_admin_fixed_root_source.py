"""Fixed, disposable root package publication boundary; no installed IO."""
import hashlib
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import admin_fixed_shim_publisher as publisher


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':')).encode()


class FixedRootSourceTests(unittest.TestCase):
    def test_closed_root_seal_required_before_package_bytes(self):
        with tempfile.TemporaryDirectory(prefix='admin-fixed-source-') as directory:
            root = Path(directory) / 'fresh'
            root.mkdir(mode=0o700)
            package = root / 'qualification-package'
            package.mkdir(mode=0o700)
            files = {name: ('fixed-' + name).encode()
                     for name in publisher.ADMIN_FIXED_NAMES}
            hashes = {name: sha(raw) for name, raw in files.items()}
            hashes['deployment_system.py'] = sha(b'new-daemon')
            for name, raw in files.items():
                path = package / name
                path.write_bytes(raw)
                path.chmod(0o600)
            fresh_raw = b'fresh-root-observation'
            (root / 'FRESH.json').write_bytes(fresh_raw)
            (root / 'FRESH.json').chmod(0o600)
            seal = {'version': 1, 'installOperationId': 'fixed-once',
                    'hostId': publisher.ADMIN_FIXED_EXPECTED_HOST_ID,
                    'freshEvidenceSha256': sha(fresh_raw),
                    'expectedPublisherPackageSha256': sha(canonical(hashes)),
                    'expectedPublisherFileSha256': hashes,
                    'state': 'SEALED', 'replayAllowed': False}
            with patch.object(publisher, 'ADMIN_FIXED_PACKAGE_ROOT', package), \
                 patch.object(publisher, 'ADMIN_FIXED_INSTALL_ID', 'fixed-once'), \
                 patch.object(publisher, 'ADMIN_FIXED_HOST_ID', seal['hostId']), \
                 patch.object(publisher, 'ADMIN_FIXED_ROOT_UID', os.geteuid()), \
                 patch.object(publisher, 'require',
                     lambda ok, code: None if ok else (_ for _ in ()).throw(ValueError(code)),
                     create=True), \
                 patch.object(publisher, 'canonical', canonical, create=True):
                with self.assertRaises(Exception):
                    publisher._admin_fixed_root_package(b'new-daemon')
                (package / 'PUBLISH-SEAL.json').write_bytes(canonical(seal))
                (package / 'PUBLISH-SEAL.json').chmod(0o600)
                with self.assertRaises(Exception):
                    publisher._admin_fixed_root_package(b'new-daemon')
                review = {'version': 1, 'installOperationId': 'fixed-once',
                          'hostId': seal['hostId'],
                          'freshEvidenceSha256': sha(fresh_raw),
                          'publishSealSha256': sha(canonical(seal)),
                          'packageSha256': seal['expectedPublisherPackageSha256'],
                          'state': 'REVIEWED'}
                (package / 'OPERATION-REVIEW.json').write_bytes(canonical(review))
                (package / 'OPERATION-REVIEW.json').chmod(0o600)
                self.assertEqual(publisher._admin_fixed_root_package(b'new-daemon'),
                                 (files, seal['expectedPublisherPackageSha256']))
                (package / 'driver.py').write_bytes(b'changed')
                with self.assertRaises(Exception):
                    publisher._admin_fixed_root_package(b'new-daemon')


if __name__ == '__main__':
    unittest.main()
