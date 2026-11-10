"""Isolated G01/SRA authority-consumption tests.

All inputs are synthetic fixtures. No authority JSON is signed, persisted, or
passed to a production operation.
"""
import copy
import os
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
saved_argv = sys.argv[:]
sys.argv = [str(HERE / 'window_helper.py'), str(HERE / '_synthetic-fixture'), 'selftest']
import window_helper_core as core
sys.argv = saved_argv

OLD_SHA = '23fb91a690b0a7182ae3ae4bc388c4e3679d4cc9'
TREE_SHA = '0' * 64
NOW = core.stamp('2026-11-10T12:00:00Z')


def fixture():
    uid = os.getuid()
    return {
        'window_id': 'G01_SYNTHETIC_WINDOW', 'writer': 'isolated-writer', 'writer_uid': uid,
        'valid_from': '2026-11-10T00:00:00Z', 'valid_until': '2026-11-11T00:00:00Z',
        'expected_old_pid': 1, 'expected_old_identity': 'SYNTHETIC', 'expected_old_sha': OLD_SHA,
        'expected_plist_sha256': '1' * 64, 'expected_harness_stamp': 'SYNTHETIC',
        'expected_bindings_sha256': TREE_SHA, 'expected_runtime_uid': uid,
        'expected_runtime_gid': 20,
        'scopes': ['source_lockfile_cleanup', 'production_mutex', 'bootout', 'full_preimage',
                   'install', 'plist_deployed_sha_only', 'bootstrap', 'verify', 'hr_observe'],
        'g01_binding': {
            'sra': {'status': 'accepted', 'revision': '9529e9a5' + '0' * 56,
                    'accepted_head': '9529e9a5' + '0' * 56,
                    'spec': 'AGENT_CORE_STANDING_RELEASE_AUTHORIZATION_V1'},
            'appointment': {'selector': 'synthetic-appointment', 'issuer': 'synthetic-issuer',
                            'principal_uuid': '123e4567-e89b-12d3-a456-426614174000',
                            'valid_until': '2026-12-07T16:00:00Z', 'revoked_at': None},
            'scope': 'STANDARD_RECOVERABLE', 'control_effective': True,
            'mandate_final_hash': '2' * 64,
            'candidate_tuple': {'window_id': 'G01_SYNTHETIC_WINDOW', 'writer': 'isolated-writer',
                                'writer_uid': uid, 'candidate_sha': OLD_SHA,
                                'candidate_tree': TREE_SHA},
        },
    }


class G01BindingIsolated(unittest.TestCase):
    def check(self, value):
        return core.validate_authority(value, writer_uid=os.getuid(), now_epoch=NOW)

    def test_01_unappointed_rejected(self):
        value = fixture(); value['g01_binding']['appointment']['selector'] = ''
        with self.assertRaisesRegex(RuntimeError, 'appointment selector/issuer missing'):
            self.check(value)

    def test_02_expired_rejected(self):
        value = fixture(); value['g01_binding']['appointment']['valid_until'] = '2026-12-06T16:00:00Z'
        with self.assertRaisesRegex(RuntimeError, 'appointment expiry mismatch'):
            self.check(value)

    def test_03_revoked_rejected(self):
        value = fixture(); value['g01_binding']['appointment']['revoked_at'] = '2026-11-09T00:00:00Z'
        with self.assertRaisesRegex(RuntimeError, 'appointment is revoked'):
            self.check(value)

    def test_04_scope_rejected(self):
        value = fixture(); value['g01_binding']['scope'] = 'PRODUCTION_UNRECOVERABLE'
        with self.assertRaisesRegex(RuntimeError, 'scope is not STANDARD_RECOVERABLE'):
            self.check(value)

    def test_05_missing_g01_gate_rejected(self):
        value = fixture(); value.pop('g01_binding')
        with self.assertRaisesRegex(RuntimeError, 'G01 binding missing'):
            self.check(value)

    def test_06_wrong_candidate_sha_rejected(self):
        value = fixture(); value['g01_binding']['candidate_tuple']['candidate_sha'] = 'f' * 64
        with self.assertRaisesRegex(RuntimeError, 'candidate tuple mismatch'):
            self.check(value)

    def test_07_wrong_executor_rejected(self):
        value = fixture(); value['writer_uid'] = os.getuid() + 1
        with self.assertRaisesRegex(RuntimeError, 'explicitly named non-root writer'):
            core.validate_authority(value, writer_uid=os.getuid(), now_epoch=NOW)

    def test_08_complete_binding_accepted(self):
        value = fixture()
        self.assertIs(self.check(value), value)


if __name__ == '__main__':
    unittest.main(verbosity=2)
