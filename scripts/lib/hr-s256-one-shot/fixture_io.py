"""Test-only finite host double. Not an installed root adapter or evidence source."""

import importlib.util
import os
from pathlib import Path
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[3]
HELPERS = ROOT / "deployment-artifacts/hr-s256-trusted-cut-v1"


def load(name):
    spec = importlib.util.spec_from_file_location("fixture_" + name, HELPERS / (name + ".py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class SyntheticFixedIO:
    def __init__(self, root, ds):
        self.root, self.ds = Path(root), ds
        self.at = 97
        self.effects = []
        self.sources = {"synthetic-fixed-Runtime-source"}
        self.residual_actor = False
        self.window_lost_at = None
        self.boundaries = 0
        self.child = None
        self.window = None
        self.authorization = None
        self.projection = {"reconciliationHandle": ds.HR_PROFILE.HANDLE,
            "turnExecutionId": ds.HR_PROFILE.HANDLE, "runtimeEpoch": "old-epoch",
            "agentId": "agt_hr-agent", "processGeneration": 1,
            "subject_preimage_sha256": "a" * 64}
        self.collector = load("collector")
        self.collector.command_output = self.command_output
        self.collector.os = type("SyntheticOS", (), {"geteuid": staticmethod(lambda: 0),
            "path": os.path})
        self.commitment_fixtures = load("test_commitment")

    def wall_ms(self):
        self.at += 1
        return self.at

    def preflight(self, subject):
        if self.residual_actor or self.sources != {"synthetic-fixed-Runtime-source"}:
            raise self.ds.HR_PROFILE.Rejected("SOURCE_CLOSURE_UNKNOWN")
        if subject != self.projection:
            raise self.ds.HR_PROFILE.Rejected("SUBJECT_UNKNOWN")
        return {"hostId": "fixture-host", "binarySha256": "b" * 64,
                "oldPids": {123}, "holderPaths": ["/fixture/workspace"]}

    def observed_entry_closure(self):
        # Synthetic scope only. Never an installed manifest/continuous host proof.
        gated = "packages/production-runtime/src/native-arm64/hr-s256-r2-gated-runtime.mjs"
        manifest = {"version": 1, "operationId": self.ds.HR_PROFILE.OPERATION_ID,
            "entries": [{"path": gated, "sha256": self.ds.HR_GATED_ENTRY_SHA256,
                         "helperSha256": self.ds.HR_CHILD_PROOF_SHA256}],
            "retiredEntry": {"path": "scripts/production-runtime.mjs",
                "sha256": self.ds.HR_PROFILE.sha_bytes(b'#!/usr/bin/env node\nthrow new Error("HR_UNGATED_ENTRY_RETIRED");\n')},
            "routes": [{"id": "gui/505/ai.agent-core.runtime", "target": "/usr/local/libexec/agent-core/app/" + gated},
                       {"id": "system/ai.agent-core.runtime", "target": "/usr/local/libexec/agent-core/app/" + gated}]}
        return manifest, ["gui/505/ai.agent-core.runtime", "system/ai.agent-core.runtime", gated]

    def open_fixed_window(self):
        self.effects.append("window")
        self.window = os.open(self.root / "fixture-window.lock",
                              os.O_RDWR | os.O_CREAT | os.O_EXCL, 0o600)
        return self.window, self.wall_ms()

    def inhibit_fixed_sources(self):
        self.effects.append("inhibit")
        return self.wall_ms()

    def quiesce_fixed_tree(self):
        self.effects.append("quiesce")
        return self.wall_ms()

    def command_output(self, command):
        if command == self.collector.PS_COMMAND:
            return b"456 1 0 /fixture/safe\n"
        if command == self.collector.LSOF_COMMAND:
            return b"p456\0f1\0n/fixture/other\0"
        raise AssertionError("arbitrary command requested")

    def collect(self, old_pids, paths):
        census = self.collector.collect_whole_host(old_pids, paths)
        census["psAtWallMs"] = self.wall_ms()
        census["lsofAtWallMs"] = self.wall_ms()
        return census

    def observe_custody(self, lock_fd, window, child):
        self.boundaries += 1
        meta, win = os.fstat(lock_fd), os.fstat(window)
        return {"ownedChild": None if child is None else {
                    "pid": child.pid, "identitySha256": "1" * 64},
            "windowIdentity": [win.st_dev, win.st_ino],
            "canonicalLockIdentity": [meta.st_dev, meta.st_ino],
            "canonicalLockOwnershipReceiptSha256": "2" * 64,
            "launchSourcesInhibitedReceiptSha256": "f" * 64,
            "windowHeld": self.boundaries != self.window_lost_at,
            "canonicalLockHeld": True, "sourcesInhibited": True}

    def final_bundle_bytes(self, auth, digest, archive, opened, quiesced):
        self.authorization = auth
        bundle = self.commitment_fixtures.final_bundle(auth, digest)
        bundle["recoveryCutover"]["windowOpenedAtWallMs"] = opened
        bundle["recoveryCutover"]["oldTreeQuiescedAtWallMs"] = quiesced
        bundle["recoveryCutover"]["authorizedStartupAtWallMs"] = auth["authorizedStartupAtWallMs"]
        bundle["hostCensus"] = archive["hostCensus"]
        return self.commitment_fixtures.bytes_of(bundle)

    def launch_fixed(self, challenge_fd, window_fd, receipt):
        self.effects.append("launch")
        code = ("import importlib.util,sys; "
            "s=importlib.util.spec_from_file_location('h',sys.argv[1]); "
            "m=importlib.util.module_from_spec(s);s.loader.exec_module(m);"
            "m.child_prove(int(sys.argv[2]),int(sys.argv[3]),sys.argv[4])")
        self.child = subprocess.Popen([sys.executable, "-c", code,
            str(HELPERS / "handoff.py"), str(challenge_fd), str(window_fd), receipt],
            pass_fds=(challenge_fd, window_fd), stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return self.child

    def startup_observation(self, child, receipt):
        if child.wait(timeout=2) != 0:
            raise self.ds.HR_PROFILE.Rejected("STARTUP_UNAVAILABLE")
        return {"launchAuthorizationReceiptSha256": receipt,
                "consumingBinarySha256": "b" * 64, "challengeReceiptSha256": "4" * 64}

    def exact_consumption_readback(self, child):
        self.effects.append("synthetic-readback")
        return {"validatedStoreSha256": "5" * 64, "validatorBinarySha256": "b" * 64,
                "storeReadbackReceiptSha256": "6" * 64,
                "settlement": {"reconciliationHandle": self.ds.HR_PROFILE.HANDLE,
                    "queryState": "settled", "fenceState": "cleared",
                    "initialOutcome": "outcome_unknown",
                    "terminationEvidence": "restart_quiescence_proven"}}

    def verified_disposition(self, child):
        return {"ownedChildDispositionReceiptSha256": "7" * 64,
            "launchSourceDispositionReceiptSha256": "8" * 64,
            "windowReleaseReceiptSha256": "9" * 64,
            "canonicalLockDispositionReceiptSha256": "0" * 64,
            "businessOutcome": "outcome_unknown"}

    def release_verified(self, window, lock):
        self.effects.append("release")

    def retain_unknown(self, window, child):
        self.effects.append("retain-unknown")

    def cleanup(self):
        if self.child is not None:
            if self.child.poll() is None:
                self.child.kill()
            self.child.wait(timeout=2)
        if self.window is not None:
            os.close(self.window)
