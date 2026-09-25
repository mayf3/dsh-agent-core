"""The exact frozen DS base gains only one fixed, still-inert action."""

import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch


HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("hr_s256_builder", HERE / "build_candidate.py")
builder = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(builder)


class DSCandidateTest(unittest.TestCase):
    def test_exact_base_is_pinned_and_existing_peer_gate_remains(self):
        source = builder.build_bytes()
        self.assertIn(b"if peer not in (0, AUTHORIZED_OWNER_UID):", source)
        self.assertIn(b"lock_fd = mutation_lock()", source)
        self.assertIn(b"HR_S256_TRUSTED_QUIESCENCE_CUT_V1", source)
        self.assertNotIn(b"PROFILE_NOT_BOOTSTRAPPED\n", source)

    def test_fixed_action_is_inert_and_unknown_fields_reject(self):
        source = builder.build_bytes()
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "deployment_system.py"
            path.write_bytes(source)
            env = {"DS_TEST_MODE": "1", "DS_STATE_ROOT": temp,
                   "DS_INSTALL_DIR": str(Path(temp) / "install"),
                   "DS_GEN_ROOT": str(Path(temp) / "generations")}
            with patch.dict(os.environ, env):
                spec = importlib.util.spec_from_file_location("hr_s256_ds_candidate", path)
                ds = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(ds)
            request = {"action": ds.HR_PROFILE.ACTION,
                       "operation_id": ds.HR_PROFILE.OPERATION_ID}
            response, restart = ds.handle(json.dumps(request).encode())
            self.assertEqual(response, {"ok": False, "error": "PROFILE_NOT_BOOTSTRAPPED"})
            self.assertIsNone(restart)
            for changed in ({**request, "path": "/tmp/arbitrary"},
                            {**request, "pass": True},
                            {**request, "operation_id": "other"}):
                response, restart = ds.handle(json.dumps(changed).encode())
                self.assertFalse(response["ok"])
                self.assertIsNone(restart)
            self.assertFalse((Path(temp) / "receipts").exists())


if __name__ == "__main__":
    unittest.main()
