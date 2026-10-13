"""Disposable nonroot test surrogate; never a host-proof or Runtime launcher."""
import importlib.util
import json
import os
from pathlib import Path
import sys

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("synthetic_journal", HERE / "journal.py")
journal = importlib.util.module_from_spec(spec)
spec.loader.exec_module(journal)


def fixture(inputs):
    journal.TEST_MODE = True
    journal.STATE_ROOT = inputs["stateRoot"]
    if inputs.get("operationId"):
        # PRODUCT_434 minimal A adaptation: TEST_MODE-only identity override so the
        # retained producer can seal evidence under the current generic verifier
        # contract (/^op-[a-z0-9-]{1,64}$/). Without an override the sealed
        # identity stays the hardcoded historical operation id, byte-identical.
        journal.OPERATION_ID = inputs["operationId"]
        journal.DIRECTORY = inputs["operationId"]
    auth = inputs["authorization"]
    bundle = inputs["bundle"]
    journal.seal_intent(auth["startupNonce"], auth["subjectPreimageSha256"],
                        bundle["recoveryCutover"]["windowOpenedAtWallMs"] - 1)
    digest = journal.seal_launch_authorization(auth)
    bundle["recoveryCutover"]["launchAuthorizationReceiptSha256"] = digest
    directory = Path(journal.STATE_ROOT) / journal.DIRECTORY
    for name, content in inputs["receipts"].items():
        path = directory / name
        path.write_text(content)
        os.chmod(path, 0o600)
    raw = json.dumps(bundle, sort_keys=True, separators=(",", ":")).encode()
    sealed = auth["authorizedStartupAtWallMs"] + 1
    journal.seal_bundle_commitment(raw, sealed)
    journal.claim_one_launch(sealed + 1)
    print(json.dumps({"evidenceDir": str(directory), "bundle": bundle}))


if __name__ == "__main__":
    fixture(json.loads(sys.stdin.read()))
