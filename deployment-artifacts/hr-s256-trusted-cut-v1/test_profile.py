"""Non-root, synthetic checks for the fixed s256 DS profile candidate."""

import importlib.util
import pathlib
import unittest


HERE = pathlib.Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("hr_s256_profile", HERE / "profile.py")
profile = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(profile)


class FixedProfileTest(unittest.TestCase):
    def test_only_exact_action_and_operation_id_are_admitted(self):
        request = {"action": profile.ACTION, "operation_id": profile.OPERATION_ID}
        self.assertEqual(profile.validate_request(request), request)
        for altered in (
            {**request, "operation_id": "other"},
            {**request, "subject": profile.HANDLE},
            {**request, "path": "/tmp/arbitrary"},
            {**request, "pass": True},
            {"action": "STATUS", "operation_id": profile.OPERATION_ID},
        ):
            with self.subTest(altered=altered), self.assertRaises(profile.Rejected):
                profile.validate_request(altered)

    def test_offline_preflight_shape_rejects_missing_forward_proofs(self):
        record = self.record()
        proofs = self.proofs()
        self.assertEqual(profile.validate_subject(record, proofs)["subject_preimage_sha256"],
                         profile.sha_json(record))
        for changed_record in (
            {**record, "handle": "other"},
            {**record, "agentId": "other"},
            {**record, "state": "settled"},
            {**record, "fenceState": "cleared"},
            {**record, "terminationEvidence": "child_real_exit"},
        ):
            with self.subTest(changed_record=changed_record), self.assertRaises(profile.Rejected):
                profile.validate_subject(changed_record, proofs)
        for changed_proofs in (
            {**proofs, "floor": {**proofs["floor"], "status": "UNKNOWN"}},
            {**proofs, "validator": {**proofs["validator"], "installedAtWallMs": 51}},
            {**proofs, "rollback_floor_sha256": None},
        ):
            with self.subTest(changed_proofs=changed_proofs), self.assertRaises(profile.Rejected):
                profile.validate_subject(record, changed_proofs)

    def test_closed_census_rejects_truncation_nonzero_and_unknown_paths(self):
        ps = b"PID PPID UID COMM\n"
        lsof = b"p0\n"
        census = profile.validate_census(ps, lsof, 0, 0, ["/fixture/workspace"], True)
        self.assertEqual(census["runtimeTreeProcessCount"], 0)
        for args in (
            (ps, lsof, 1, 0, ["/fixture/workspace"], True),
            (ps, lsof, 0, 1, ["/fixture/workspace"], True),
            (ps, lsof, 0, 0, [], True),
            (ps, lsof, 0, 0, ["/fixture/workspace"], False),
            (ps, b"x" * 65537, 0, 0, ["/fixture/workspace"], True),
        ):
            with self.subTest(args=args[:4]), self.assertRaises(profile.Rejected):
                profile.validate_census(*args)

    def test_authorization_binds_full_subject_and_exact_census(self):
        subject = profile.validate_subject(self.record(), self.proofs())
        census = profile.validate_census(b"ps\n", b"lsof\n", 0, 0,
                                         ["/fixture/workspace"], True)
        cut = self.cut(subject, census)
        proof = profile.build_authorization(cut)
        self.assertEqual(proof["subjectPreimageSha256"], subject["subject_preimage_sha256"])
        self.assertEqual(proof["operationId"], profile.OPERATION_ID)
        self.assertEqual(proof["holderCheck"], cut["holderCheck"])
        for key, value in (
            ("launchSourcesInhibitedAtWallMs", 60),
            ("oldTreeQuiescedAtWallMs", 49),
            ("authorizedStartupAtWallMs", 54),
        ):
            with self.subTest(key=key), self.assertRaises(profile.Rejected):
                profile.build_authorization({**cut, key: value})
        with self.assertRaises(profile.Rejected):
            profile.build_authorization({**cut, "sourceClosureComplete": False})
        with self.assertRaises(profile.Rejected):
            profile.build_authorization({**cut, "windowHeld": False})

    def test_closed_entry_manifest_requires_both_routes_manual_entry_and_exact_byte_pins(self):
        gated = "packages/production-runtime/src/native-arm64/hr-s256-r2-gated-runtime.mjs"
        profile.HR_GATED_ENTRY_SHA256 = "a" * 64
        profile.HR_CHILD_PROOF_SHA256 = "b" * 64
        manifest = {"version": 1, "operationId": profile.OPERATION_ID,
            "entries": [{"path": gated, "sha256": "a" * 64, "helperSha256": "b" * 64}],
            "retiredEntry": {"path": "scripts/production-runtime.mjs",
                "sha256": profile.sha_bytes(b'#!/usr/bin/env node\nthrow new Error("HR_UNGATED_ENTRY_RETIRED");\n')},
            "routes": [{"id": "gui/505/ai.agent-core.runtime", "target": "/usr/local/libexec/agent-core/app/" + gated},
                       {"id": "system/ai.agent-core.runtime", "target": "/usr/local/libexec/agent-core/app/" + gated}]}
        sources = ["gui/505/ai.agent-core.runtime", "system/ai.agent-core.runtime", gated]
        self.assertTrue(profile.validate_entry_closure(manifest, sources))
        for bad_sources in (sources[:-1], sources[1:], sources + ["unknown-source"]):
            with self.assertRaisesRegex(profile.Rejected, "LAUNCH_WINDOW_OR_SOURCE_UNKNOWN"):
                profile.validate_entry_closure(manifest, bad_sources)
        altered = {**manifest, "entries": [{**manifest["entries"][0], "sha256": "c" * 64}]}
        with self.assertRaisesRegex(profile.Rejected, "LAUNCH_WINDOW_OR_SOURCE_UNKNOWN"):
            profile.validate_entry_closure(altered, sources)

    def test_candidate_is_inert_without_a_reviewed_ds_integration(self):
        with self.assertRaises(profile.Rejected) as error:
            profile.production_entry({"action": profile.ACTION,
                                      "operation_id": profile.OPERATION_ID})
        self.assertEqual(str(error.exception), "PROFILE_NOT_BOOTSTRAPPED")

    @staticmethod
    def record():
        return {"handle": profile.HANDLE, "reconciliationHandle": profile.HANDLE,
                "turnExecutionId": profile.HANDLE, "runtimeEpoch": "old-epoch",
                "agentId": profile.AGENT_ID, "processGeneration": 1,
                "createdAtWallMs": 10, "updatedAt": 20, "state": "blocked",
                "queryState": "pending", "initialOutcome": "outcome_unknown",
                "recoveryState": "blocked",
                "failureReason": "runtime_restart_ownership_unavailable",
                "terminationEvidence": None, "exitObservedAt": None,
                "fenceState": "active"}

    @staticmethod
    def proofs():
        binary = "a" * 64
        return {"floor": {"status": "ROUTER_RESTART_SAFETY=PROVEN",
                          "deployedBinarySha256": binary, "provedAtWallMs": 30},
                "validator": {"evidenceKind": "restart_quiescence_proven",
                              "deployedBinarySha256": binary, "installedAtWallMs": 31},
                "rollback_floor_sha256": binary, "window_opened_at_wall_ms": 50}

    @staticmethod
    def cut(subject, census):
        return {"operationId": profile.OPERATION_ID, "hostId": "fixture-host",
                "startupNonce": "nonce-fixture-1", "subject": subject,
                "consumingBinarySha256": "a" * 64,
                "archiveSha256": "b" * 64,
                "windowOpenedAtWallMs": 50,
                "launchSourcesInhibitedAtWallMs": 51,
                "oldTreeQuiescedAtWallMs": 52,
                "hostCensus": {**census, "executedAtWallMs": 53},
                "holderCheck": {"operationId": profile.OPERATION_ID,
                                "executedAtWallMs": 54, "method": "lsof",
                                "paths": ["/fixture/workspace"], "openHolderCount": 0},
                "authorizedStartupAtWallMs": 55,
                "sourceClosureComplete": True, "windowHeld": True}


if __name__ == "__main__":
    unittest.main()
