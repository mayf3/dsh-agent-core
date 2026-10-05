"""The admin receipt must survive the actual inherited-FD projection."""

import hashlib
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest


SOURCE = Path(__file__).resolve().parents[1] / '..' / 'packages/production-runtime/src/native-arm64/hr-s256-r2-child-proof.py'
SPEC = importlib.util.spec_from_file_location('fixed_hr_child_proof', SOURCE.resolve())
PROOF = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PROOF)
ADMIN = 'hr-s256-admin-emergency-cut-20260928-v1'
OLD = 'hr-s256-trusted-quiescence-cut-20260925-v1'
HANDLE = 'turn:961534a5-8c94-487d-8e55-d324a54e821a:a2:g1:s256'


def receipt(operation):
    subject = {'reconciliationHandle': HANDLE, 'turnExecutionId': HANDLE,
               'runtimeEpoch': 'fixture-epoch', 'agentId': 'agt_hr-agent', 'processGeneration': 1}
    authorization = {'operationId': operation, 'hostId': 'fixture-host', 'startupNonce': 'c' * 64,
                     'subject': subject, 'subjectPreimageSha256': 'a' * 64,
                     'consumingBinarySha256': 'b' * 64, 'archiveSha256': 'd' * 64,
                     'outputsSha256': 'e' * 64, 'holderCheck': {}, 'authorizedStartupAtWallMs': 1}
    return json.dumps({'version': 1, 'operationId': operation, 'phase': 'LAUNCH_AUTHORIZED',
                       'intentSha256': 'f' * 64, 'authorization': authorization},
                      sort_keys=True, separators=(',', ':')).encode()


class AdminInheritedAuthorizationTest(unittest.TestCase):
    def test_admin_receipt_is_distinct_from_old_r2_receipt(self):
        with tempfile.TemporaryDirectory() as root:
            path = Path(root) / 'launch-authorization.json'
            path.write_bytes(receipt(ADMIN))
            os.chmod(path, 0o600)
            fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
            try:
                digest = hashlib.sha256(path.read_bytes()).hexdigest()
                result = PROOF.authorization_projection(fd, digest, {'nonce': 'c' * 64},
                    trusted_uid=os.geteuid(), expected_operation_id=ADMIN)
                self.assertEqual(result['consumingBinarySha256'], 'b' * 64)
                with self.assertRaises(PROOF.Rejected):
                    PROOF.authorization_projection(fd, digest, {'nonce': 'c' * 64},
                        trusted_uid=os.geteuid())
                path.write_bytes(receipt(OLD))
                with self.assertRaises(PROOF.Rejected):
                    PROOF.authorization_projection(fd, hashlib.sha256(path.read_bytes()).hexdigest(),
                        {'nonce': 'c' * 64}, trusted_uid=os.geteuid(), expected_operation_id=ADMIN)
            finally:
                os.close(fd)


if __name__ == '__main__':
    unittest.main()
