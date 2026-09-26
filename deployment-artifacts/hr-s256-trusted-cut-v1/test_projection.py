"""Read-only protected-store projection through the generated DS candidate."""

import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import patch


HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
SPEC = importlib.util.spec_from_file_location("hr_s256_builder_projection", HERE / "build_candidate.py")
builder = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(builder)


CREATE_STORE = """
import { TurnReconciliationStore } from './packages/agent-router/src/reconciliation-store.js';
const file=process.argv[1];
const old=new TurnReconciliationStore({persistenceFile:file,runtimeEpoch:'961534a5-8c94-487d-8e55-d324a54e821a'});
old.mintTurnExecution({agentId:'agt_dummy',processGeneration:1,sessionId:'main'});
let h;
for(let i=0;i<256;i++)h=old.mintTurnExecution({agentId:'agt_hr-agent',processGeneration:1,sessionId:'main'});
old.markAdmitted(h,{eventWatermarkSeq:0,promptRequestId:'private-prompt',deadlineAtWallMs:Date.now()+1000});
old.markPromptWriteAttempted(h);
new TurnReconciliationStore({persistenceFile:file,runtimeEpoch:'new-epoch'});
"""


class ProtectedProjectionTest(unittest.TestCase):
    def test_exact_subject_validated_from_nofollow_fd_and_no_private_output(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp).resolve()
            store = root / "turn-recovery-v3.json"
            subprocess.run([shutil.which("node"), "--input-type=module", "-e",
                            CREATE_STORE, str(store)], cwd=REPO, check=True,
                           capture_output=True, timeout=20)
            ds_path = root / "deployment_system.py"
            ds_path.write_bytes(builder.build_bytes())
            env = {"DS_TEST_MODE": "1", "DS_STATE_ROOT": tmp,
                   "DS_INSTALL_DIR": str(root / "install"),
                   "DS_GEN_ROOT": str(root / "generations"),
                   "DS_ROUTER_STORE_FILE": str(store),
                   "DS_ROUTER_NODE_BIN": shutil.which("node"),
                   "DS_HR_SOURCE_ROOT": str(REPO)}
            with patch.dict(os.environ, env):
                spec = importlib.util.spec_from_file_location("hr_s256_ds_projection", ds_path)
                ds = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(ds)
                result = ds.HR_PROJECTION.fixed_subject_projection()
                self.assertEqual(result["reconciliationHandle"], ds.HR_PROFILE.HANDLE)
                self.assertEqual(result["agentId"], ds.HR_PROFILE.AGENT_ID)
                self.assertNotIn("private-prompt", json.dumps(result))
                self.assertRegex(result["subjectPreimageSha256"], r"^[a-f0-9]{64}$")
                store.write_text("{}\n")
                with self.assertRaises(ds.HR_PROJECTION.Rejected):
                    ds.HR_PROJECTION.fixed_subject_projection()


if __name__ == "__main__":
    unittest.main()
