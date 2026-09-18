"""Offline packet binding cannot anticipate future login/custody success."""
import copy
import hashlib
import json
import unittest
import bind_records as binding


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


class BindRecords(unittest.TestCase):
    def setUp(self):
        self.template = {
            "version": 1, "operation_id": "first-live-dsh-20260918-01",
            "previous": {"service_sha256": "a" * 64},
            "configuration": {"callers": [{"uid": 502, "gid": 20}]},
            "issuer_bindings": [{"public_key": None, "custody_receipt": None} for _ in range(6)],
            "lifecycle": {"tool_sha256": {"/bin/ps": "c" * 64}},
        }
        self.raw = canonical(self.template)
        self.line = b"1" * 64 + b"  /usr/bin/sudo\n"

    def bind(self, raw=None, digest=None, line=None):
        raw = self.raw if raw is None else raw
        return binding.bind_packet(raw, sha(raw) if digest is None else digest,
                                   self.line if line is None else line)

    def test_prepare_before_login_only_adds_observed_platform_digest(self):
        expected = copy.deepcopy(self.template)
        expected["lifecycle"]["tool_sha256"]["/usr/bin/sudo"] = "1" * 64
        self.assertEqual(self.bind(), canonical(expected))
        self.assertEqual(self.raw, canonical(self.template))
        self.assertNotIn("login_receipt_sha256", json.loads(self.bind())["previous"])
        self.assertIsNone(json.loads(self.bind())["issuer_bindings"][0]["public_key"])

    def test_future_login_or_custody_claims_are_rejected(self):
        for key in ["login_receipt_sha256", "custody_receipt_sha256"]:
            value = copy.deepcopy(self.template)
            value["previous"][key] = "b" * 64
            with self.subTest(key=key), self.assertRaises(ValueError):
                self.bind(canonical(value))
        for key in ["public_key", "custody_receipt"]:
            value = copy.deepcopy(self.template)
            value["issuer_bindings"][0][key] = "b" * 64
            with self.subTest(key=key), self.assertRaises(ValueError):
                self.bind(canonical(value))

    def test_sudo_digest_requires_exact_single_observed_path_line(self):
        for line in [b"", self.line + self.line, self.line.replace(b"sudo", b"sh"),
                     self.line.rstrip(), self.line.replace(b"  ", b" "),
                     b"G" * 64 + self.line[64:], b"sudo: a password is required\n"]:
            with self.subTest(line=line), self.assertRaises(ValueError):
                self.bind(line=line)

    def test_prefilled_sudo_or_missing_tool_map_is_rejected(self):
        for tools in [{"/usr/bin/sudo": "1" * 64}, None, []]:
            value = copy.deepcopy(self.template)
            value["lifecycle"]["tool_sha256"] = tools
            with self.assertRaises(ValueError):
                self.bind(canonical(value))

    def test_template_digest_drift_and_duplicate_fields_are_rejected(self):
        with self.assertRaises(ValueError):
            self.bind(digest="f" * 64)
        with self.assertRaises(ValueError):
            self.bind(raw=b'{"previous":{},"previous":{}}')
        with self.assertRaises(ValueError):
            self.bind(raw=b'{"previous":{},"number":NaN}')

    def test_missing_future_binding_slots_and_bad_shapes_are_rejected(self):
        for value in [None, [], [{}], [{"public_key": None}]]:
            template = copy.deepcopy(self.template)
            template["issuer_bindings"] = value
            with self.assertRaises(ValueError):
                self.bind(canonical(template))
        template = copy.deepcopy(self.template)
        template["previous"] = []
        with self.assertRaises(ValueError):
            self.bind(canonical(template))


if __name__ == "__main__":
    unittest.main()
