"""Isolated G01/SRA mandate-source authority-consumption tests.

R131 finite review (comment 6766131484): the trusted source is the formal
Mandate DOCUMENT on disk; the binding dict is cross-checked against it and
never authoritative on its own. All fixtures are synthetic temp files. No
authority JSON is signed, persisted, or passed to a production operation.

Type discipline: this repository is SHA-1 git — revisions are 40-hex object
ids, byte digests are 64-hex SHA-256. The validator must reject either kind
masquerading as the other.
"""
import copy
import hashlib
import json
import os
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
# window_helper_core reads sys.argv[1..3] at import time; satisfy it with a
# synthetic fixture path before importing (isolated; never a production run).
sys.argv = [str(HERE / 'window_helper.py'), str(TMP_SYNTH := HERE / '_g01-synthetic-store'), 'selftest']
(TMP_SYNTH.parent).mkdir(exist_ok=True)
import window_helper_core as core

TMP = HERE / '_g01-mandate-fixture'
TMP.mkdir(exist_ok=True)
MANDATE = TMP / 'mandate.json'

OLD_SHA = '23fb91a690b0a7182ae3ae4bc388c4e3679d4cc9'          # 40-hex git object id
CANDIDATE_HEAD = 'b' * 40                                      # 40-hex git object id
SRA_HEAD = 'a' * 40                                            # 40-hex git object id
UUID = '123e4567-e89b-12d3-a456-426614174000'
FOREIGN_UUID = '98765432-aaaa-4bbb-8ccc-ddddeeefffff'
SYNTHETIC_REV = 'SYNTHETIC-NOT-A-GIT-REVISION'


def mandate_document(sra_head=SRA_HEAD, uuid=UUID, candidate=CANDIDATE_HEAD,
                     valid_until='2026-12-07T16:00:00Z', revoked_at=None,
                     scope='STANDARD_RECOVERABLE', control_effective=True):
    return {
        'sra': {'status': 'accepted', 'accepted_head': sra_head,
                'spec': 'AGENT_CORE_STANDING_RELEASE_AUTHORIZATION_V1'},
        'appointment': {'selector': 'synthetic-appointment', 'issuer': 'synthetic-issuer',
                        'principal_uuid': uuid, 'valid_from': '2026-11-10T00:00:00Z',
                        'valid_until': valid_until, 'revoked_at': revoked_at},
        'scope': scope, 'control_effective': control_effective,
        'candidate': {'pre_state_sha': OLD_SHA, 'candidate_head': candidate},
    }


def write_mandate(doc):
    raw = json.dumps(doc, ensure_ascii=False, indent=2).encode('utf-8')
    MANDATE.write_bytes(raw)
    return hashlib.sha256(raw).hexdigest()


def base_authority(mandate_hash, **overrides):
    uid = os.getuid()
    a = {
        'window_id': 'G01_SYNTHETIC_WINDOW', 'writer': 'isolated-writer', 'writer_uid': uid,
        'valid_from': '2026-11-10T00:00:00Z', 'valid_until': '2026-11-11T00:00:00Z',
        'expected_old_pid': 1, 'expected_old_identity': 'SYNTHETIC', 'expected_old_sha': OLD_SHA,
        'expected_plist_sha256': '1' * 64, 'expected_harness_stamp': 'SYNTHETIC',
        'expected_bindings_sha256': '0' * 64, 'expected_runtime_uid': uid,
        'expected_runtime_gid': 20,
        'scopes': ['source_lockfile_cleanup', 'production_mutex', 'bootout', 'full_preimage',
                   'install', 'plist_deployed_sha_only', 'bootstrap', 'verify', 'hr_observe'],
        'g01_binding': {
            'mandate_path': str(MANDATE), 'mandate_final_hash': mandate_hash,
            'scope': 'STANDARD_RECOVERABLE',
            'sra': {'accepted_head': SRA_HEAD},
            'appointment': {'principal_uuid': UUID, 'valid_until': '2026-12-07T16:00:00Z'},
            'candidate': {'candidate_head': CANDIDATE_HEAD},
        },
    }
    a.update(overrides)
    return a


def validated(a, now_epoch=None):
    core.validate_authority(a, now_epoch=now_epoch)
    return a


class G01MandateSource(unittest.TestCase):
    def tearDown(self):
        if MANDATE.exists():
            MANDATE.unlink()

    def test_01_complete_mandate_accepted(self):
        h = write_mandate(mandate_document())
        a = base_authority(h)
        core.validate_authority(a)
        self.assertEqual(a['g01_binding']['mandate_final_hash'], h)

    def test_02_synthetic_revision_contradicting_mandate_rejected(self):
        h = write_mandate(mandate_document())
        a = base_authority(h)
        a['g01_binding']['sra']['accepted_head'] = SYNTHETIC_REV
        with self.assertRaisesRegex(RuntimeError, 'contradicts'):
            core.validate_authority(a)

    def test_03_foreign_uuid_contradicting_mandate_rejected(self):
        h = write_mandate(mandate_document())
        a = base_authority(h)
        a['g01_binding']['appointment']['principal_uuid'] = FOREIGN_UUID
        with self.assertRaisesRegex(RuntimeError, 'contradicts'):
            core.validate_authority(a)

    def test_04_arbitrary_mandate_hash_rejected(self):
        write_mandate(mandate_document())
        a = base_authority('f' * 64)
        a['g01_binding']['mandate_final_hash'] = 'e' * 64
        with self.assertRaisesRegex(RuntimeError, 'does not match recomputed'):
            core.validate_authority(a)

    def test_05_expired_appointment_rejected_at_validation_time(self):
        doc = mandate_document(valid_until='2026-11-09T00:00:00Z')
        h = write_mandate(doc)
        a = base_authority(h)
        a['g01_binding']['appointment']['valid_until'] = '2026-11-09T00:00:00Z'
        with self.assertRaisesRegex(RuntimeError, 'expired'):
            core.validate_authority(a)

    def test_06_revoked_appointment_rejected(self):
        doc = mandate_document(revoked_at='2026-11-09T00:00:00Z')
        h = write_mandate(doc)
        a = base_authority(h)
        a['g01_binding']['appointment']['revoked_at'] = '2026-11-09T00:00:00Z'
        with self.assertRaisesRegex(RuntimeError, 'revoked'):
            core.validate_authority(a)

    def test_07_missing_mandate_file_fails_closed(self):
        a = base_authority('x' * 64)
        a['g01_binding']['mandate_path'] = str(TMP / 'nonexistent-mandate.json')
        with self.assertRaisesRegex(RuntimeError, 'unreadable'):
            core.validate_authority(a)

    def test_08_candidate_head_equal_to_pre_state_rejected(self):
        # candidate_head == pre-state pin means "no change"; rejection is a
        # REAL semantic check — both are 40-hex git object ids, so equality
        # is meaningful (not a length artifact).
        doc = mandate_document(candidate=OLD_SHA)
        h = write_mandate(doc)
        a = base_authority(h)
        a['g01_binding']['candidate']['candidate_head'] = OLD_SHA
        with self.assertRaisesRegex(RuntimeError, 'differ from the pre-state'):
            core.validate_authority(a)

    def test_09_sha256_digest_masquerading_as_candidate_head_rejected(self):
        # A 64-hex digest is not a git object id in this SHA-1 repository;
        # the candidate head must never accept digest-shaped values.
        h = write_mandate(mandate_document(candidate='b' * 64))
        a = base_authority(h)
        a['g01_binding']['candidate']['candidate_head'] = 'b' * 64
        with self.assertRaisesRegex(RuntimeError, 'git object id'):
            core.validate_authority(a)

    def test_10_mandate_scope_other_than_standard_recoverable_rejected(self):
        h = write_mandate(mandate_document(scope='FULL_ADMIN'))
        a = base_authority(h)
        with self.assertRaisesRegex(RuntimeError, 'mandate scope'):
            core.validate_authority(a)

    def test_11_mandate_control_not_effective_rejected(self):
        h = write_mandate(mandate_document(control_effective=False))
        a = base_authority(h)
        with self.assertRaisesRegex(RuntimeError, 'control is not effective'):
            core.validate_authority(a)

    def test_12_binding_scope_contradicting_mandate_rejected(self):
        h = write_mandate(mandate_document())
        a = base_authority(h)
        a['g01_binding']['scope'] = 'FULL_ADMIN'
        with self.assertRaisesRegex(RuntimeError, 'binding scope contradicts'):
            core.validate_authority(a)

    def test_13_sha256_digest_masquerading_as_sra_head_rejected(self):
        h = write_mandate(mandate_document(sra_head='a' * 64))
        a = base_authority(h)
        with self.assertRaisesRegex(RuntimeError, 'git object id'):
            core.validate_authority(a)


if __name__ == '__main__':
    # sys.argv is retargeted at import time for window_helper_core; pass an
    # explicit argv so direct invocation is not parsed as test names.
    unittest.main(verbosity=2, argv=['test_g01_binding_isolated'])
