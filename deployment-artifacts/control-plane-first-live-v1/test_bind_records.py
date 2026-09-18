"""Bounded public-byte preparation tests; no fake protected receipt is installed."""
import copy
import hashlib
import json
import unittest

import bind_records as binding


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def grant():
    return {
        "version": 1,
        "owner": "mayf3",
        "scope": "EXACT_REVIEWER_LOGIN_RECONCILIATION_ONLY",
        "manifest_digest": "829054c0a16c9b5784bc9c124b6310bf17f055c3c9f31b46046f06a931331f47",
        "helper_digest": "185ea8351830776cdd29fcc2ba795836a938d361e66763bc944545b83833e1e6",
        "issued_at": 1789719600,
        "expires_at": 1789723200,
    }


def receipt(raw):
    # Independent schema copied from the reviewed native successful output.
    return canonical({
        "version": 1,
        "manifest_digest": grant()["manifest_digest"],
        "grant_digest": sha(raw),
        "original_intent_digest": "3ca4b44d4d3e418ea78df8ad6c0a04b7a650e0006c807ffd9f96441b0d10abc6",
        "state": "SEPARATE_LOGIN_COMMAND_COMPLETED_SAFE_LOCAL_AUTH_METADATA",
        "original_provider_outcome": "UNKNOWN_RETAINED",
        "independent_review_pass": False,
        "activation_allowed": False,
    })


class BindRecords(unittest.TestCase):
    def setUp(self):
        self.grant = canonical(grant())
        self.observed = receipt(self.grant)
        self.template = {
            "version": 1,
            "operation_id": "private-test-only",
            "previous": {"service_sha256": "a" * 64},
            "configuration": {"callers": [{"uid": 502, "gid": 20}]},
        }
        self.raw = canonical(self.template)

    def bind(self, raw=None, observed=None, grant_raw=None, digest=None):
        raw = self.raw if raw is None else raw
        return binding.bind_packet(
            raw, sha(raw) if digest is None else digest,
            self.observed if observed is None else observed,
            self.grant if grant_raw is None else grant_raw,
        )

    def test_fixed_login_grant_has_exact_schema_and_one_hour(self):
        self.assertEqual(binding.login_grant(grant()["issued_at"]), self.grant)

    def test_expected_postimage_keeps_original_unknown_and_false_proof_flags(self):
        self.assertEqual(binding.expected_login_receipt(self.grant), self.observed)

    def test_noncanonical_raw_grant_hash_is_not_semantic_hash(self):
        raw = json.dumps(grant(), indent=2).encode() + b"\n"
        self.assertNotEqual(sha(raw), sha(self.grant))
        self.assertEqual(binding.expected_login_receipt(raw), receipt(raw))
        with self.assertRaises(ValueError):
            self.bind(grant_raw=raw)

    def test_only_observed_login_hash_is_added_to_template(self):
        expected = copy.deepcopy(self.template)
        expected["previous"]["login_receipt_sha256"] = sha(self.observed)
        self.assertEqual(self.bind(), canonical(expected))
        self.assertEqual(self.raw, canonical(self.template))

    def test_missing_or_mutated_actual_receipt_is_rejected(self):
        cases = [b"", b"{}"]
        actual = json.loads(self.observed)
        for key, changed in [("activation_allowed", True), ("independent_review_pass", True),
                             ("original_provider_outcome", "PASS"), ("grant_digest", "f" * 64)]:
            value = dict(actual)
            value[key] = changed
            cases.append(canonical(value))
        for case in cases:
            with self.subTest(case=case), self.assertRaises(ValueError):
                self.bind(observed=case)

    def test_no_overwrite_of_prefilled_receipt_field(self):
        value = copy.deepcopy(self.template)
        value["previous"]["login_receipt_sha256"] = sha(self.observed)
        with self.assertRaises(ValueError):
            self.bind(raw=canonical(value))

    def test_template_digest_drift_is_rejected(self):
        with self.assertRaises(ValueError):
            self.bind(digest="f" * 64)

    def test_unknown_grant_fields_scope_identity_and_duration_rejected(self):
        for key, value in [("unexpected", "value"), ("owner", "agent"), ("scope", "ANYTHING"),
                           ("helper_digest", "b" * 64), ("manifest_digest", "c" * 64),
                           ("expires_at", grant()["expires_at"] + 1), ("issued_at", True)]:
            item = grant()
            item[key] = value
            with self.subTest(key=key), self.assertRaises(ValueError):
                binding.expected_login_receipt(canonical(item))

    def test_duplicate_json_keys_and_noninteger_timestamps_rejected(self):
        with self.assertRaises(ValueError):
            binding.expected_login_receipt(self.grant[:-1] + b',"owner":"mayf3"}')
        for instant in [True, -1, 1.5, "123", 2**64 - 1]:
            with self.subTest(instant=instant), self.assertRaises(ValueError):
                binding.login_grant(instant)
        with self.assertRaises(ValueError):
            self.bind(raw=b'{"previous":{},"previous":{}}')


if __name__ == "__main__":
    unittest.main()
