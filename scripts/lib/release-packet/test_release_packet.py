"""Tests for release-packet (#567 Phase 1): one-command generate + verify.

All fixtures are synthetic temporary trees: a tiny git repo, an overlay, a
stage input and a frozen file. No real packet, agent, host, business or
incident data is used. Run: python3 scripts/lib/release-packet/test_release_packet.py
"""

import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import packet_model as pm
import release_packet as rp

TOOL_CLI = [sys.executable, str(HERE / "release_packet.py")]
OLD_TASK_ROOT = "/Users/operator/Documents/Codex/2026-01-01/task-5-old"


class Fixture:
    """Synthetic unique source + fixed config, isolated per test."""

    def __init__(self, root):
        self.root = Path(root)
        self.repo = self.root / "repo"
        self.repo.mkdir(parents=True)
        (self.repo / "app.txt").write_text("app body v1\n")
        (self.repo / "lib").mkdir()
        (self.repo / "lib" / "util.txt").write_text("util body\n")
        env = dict(os.environ)
        self._git("init", "-q")
        self._git("add", "-A")
        self._git("-c", "user.name=fixture", "-c", "user.email=fixture@example.invalid",
                  "commit", "-q", "-m", "fixture source")
        self.commit = self._git("rev-parse", "HEAD")
        (self.root / "overlays").mkdir()
        (self.root / "overlays" / "extra.txt").write_text("overlay bytes\n")
        (self.root / "stage-input").mkdir()
        (self.root / "stage-input" / "stage-tool.py").write_text("# stage tool\nprint('stage')\n")
        (self.root / "frozen").mkdir()
        (self.root / "frozen" / "frozen-bundle.bin").write_bytes(b"\x00frozen-bytes\x00")

    def _git(self, *args):
        subprocess.check_output(["git", "-C", str(self.repo)] + list(args), env=dict(os.environ))

    def config(self, **overrides):
        cfg = {
            "schema": rp.CONFIG_SCHEMA,
            "packet": {"kind": "TEST_LOCAL_RELEASE_CANDIDATE", "root": "out/packet"},
            "source": {"repo": "repo", "commit": self.commit},
            "layers": [
                {"name": "operation-source", "dir": "operation-source",
                 "build": {"type": "git-archive", "prefix": "app-src/",
                           "overlays": [{"path": "app-src/extra.txt", "from": "overlays/extra.txt"}],
                           "contentList": "app-src/SOURCE-CONTENT.sha256"}},
                {"name": "stage", "dir": "stage",
                 "build": {"type": "inline-files",
                           "files": [{"path": "stage-tool.py", "from": "stage-input/stage-tool.py"}]}},
            ],
            "artifacts": [
                {"name": "artifacts/app-src-archive.tar.gz", "type": "tar-gz",
                 "fromLayerDir": "operation-source", "rootName": "app-src"},
                {"name": "artifacts/frozen-bundle.bin", "type": "copy", "from": "frozen/frozen-bundle.bin"},
            ],
            "commandFiles": [{"path": "COMMANDS.txt", "entries": [
                {"label": "INSTALL (not executed)",
                 "command": "/usr/bin/python3 -I -B {packet_root}/stage/stage-tool.py --packet {packet_root}"}]}],
            "referenceFiles": [{"path": "COMMANDS.txt", "blocking": True}],
            "pinFiles": [{"path": "PINS.json", "bindings": [
                {"pointer": "/appArchiveSha256", "target": "artifacts/app-src-archive.tar.gz"},
                {"pointer": "/frozenSha256", "target": "artifacts/frozen-bundle.bin"},
                {"forEach": "/toolPins", "paths": ["stage/stage-tool.py"],
                 "pathKey": "path", "digestKey": "sha256", "bytesKey": "bytes"}]}],
            "externalReferenceAllowlist": ["/usr/bin/", "/bin/"],
        }
        cfg.update(overrides)
        return cfg

    def write_config(self, cfg, name="config.json"):
        # config-relative paths: the config lives at the fixture root, so all
        # relative inputs (repo/, out/, overlays/, ...) resolve beside it
        path = self.root / name
        path.write_text(json.dumps(cfg, indent=2) + "\n")
        return path

    @property
    def packet(self):
        return self.root / "out" / "packet"


class PacketTestBase(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="release-packet-test-")
        self.addCleanup(self.tmp.cleanup)
        self.fx = Fixture(self.tmp.name)

    def build(self, cfg=None, name="config.json", rebuild=False):
        cfg = cfg or self.fx.config()
        cfg_path = self.fx.write_config(cfg, name)
        layers, top_seal_sha, entries = rp.build_packet(cfg, cfg_path.parent, self.fx.packet, rebuild=rebuild)
        return cfg, cfg_path, rp.verify_packet(cfg, cfg_path.parent, self.fx.packet)

    def verify(self, cfg, cfg_path, expect_top_seal=None):
        return rp.verify_packet(cfg, cfg_path.parent, self.fx.packet, expect_top_seal=expect_top_seal)

    def status_of(self, checks, cid):
        return next(c for c in checks if c["id"] == cid)

    def assert_blocked(self, checks, expected_check_id=None, expected_code=None):
        status, exit_code = rp.aggregate(checks)
        self.assertEqual(("BLOCKED", 1), (status, exit_code))
        if expected_check_id:
            check = self.status_of(checks, expected_check_id)
            self.assertEqual("FAIL", check["status"])
            if expected_code:
                self.assertTrue(any(f["code"] == expected_code for f in check["details"]),
                                "missing %s in %s" % (expected_code, check["details"]))
            return check
        return None

    def reforge_top(self, cfg):
        """Regenerate top manifest+seal in place — the batch-edit-to-PASS attack."""
        pm.write_manifest(self.fx.packet, exclude={pm.MANIFEST_NAME, pm.SEAL_NAME})
        pm.write_seal(self.fx.packet, kind=cfg["packet"]["kind"])


class BuildAndVerifyPass(PacketTestBase):
    def test_build_then_verify_all_pass(self):
        cfg, cfg_path, checks = self.build()
        status, exit_code = rp.aggregate(checks)
        self.assertEqual(("PASS", 0), (status, exit_code))
        self.assertEqual("PASS", self.status_of(checks, "TOP_MANIFEST")["status"])
        self.assertEqual("PASS", self.status_of(checks, "TOP_SEAL")["status"])
        self.assertEqual("PASS", self.status_of(checks, "LAYER_MANIFEST:operation-source")["status"])
        self.assertEqual("PASS", self.status_of(checks, "REFERENCES:COMMANDS.txt")["status"])
        pins = self.status_of(checks, "PINS:PINS.json")
        self.assertEqual("PASS", pins["status"])
        # receipt digests are re-checkable against actual bytes
        pins_doc = json.loads((self.fx.packet / "PINS.json").read_text())
        self.assertEqual(pm.sha256_file(self.fx.packet / "artifacts" / "app-src-archive.tar.gz"),
                         pins_doc["appArchiveSha256"])
        self.assertTrue((self.fx.packet / "artifacts" / "app-src-archive.tar.gz.sha256").is_file())
        source_list = (self.fx.packet / "operation-source" / "app-src" / "SOURCE-CONTENT.sha256").read_text()
        self.assertIn("app-src/app.txt", source_list)
        self.assertIn("app-src/extra.txt", source_list)
        self.assertNotIn("SOURCE-CONTENT.sha256", source_list)
        # deterministic rebuild at the same root reproduces the same bytes
        self.build(rebuild=True)
        self.assertEqual(pins_doc, json.loads((self.fx.packet / "PINS.json").read_text()))

    def test_overlay_lands_in_source_tree(self):
        self.build()
        self.assertEqual((self.fx.root / "overlays" / "extra.txt").read_bytes(),
                         (self.fx.packet / "operation-source" / "app-src" / "extra.txt").read_bytes())


class SingleCommandCli(PacketTestBase):
    def test_cli_build_then_verify_exit_zero(self):
        cfg_path = self.fx.write_config(self.fx.config())
        out = subprocess.run(TOOL_CLI + ["build", "--config", str(cfg_path)], capture_output=True, text=True)
        self.assertEqual(0, out.returncode, out.stderr)
        receipt = json.loads(out.stdout)
        self.assertEqual("PASS", receipt["status"])
        self.assertEqual(False, receipt["productionExecuted"])
        self.assertTrue(receipt["configSha256"])
        vout = subprocess.run(TOOL_CLI + ["verify", "--package", str(self.fx.packet), "--config", str(cfg_path)],
                              capture_output=True, text=True)
        self.assertEqual(0, vout.returncode, vout.stderr)
        self.assertEqual("PASS", json.loads(vout.stdout)["status"])
        self.assertTrue(receipt["packetRoot"].endswith("/packet"))

    def test_cli_refuses_existing_root_without_rebuild(self):
        cfg_path = self.fx.write_config(self.fx.config())
        first = subprocess.run(TOOL_CLI + ["build", "--config", str(cfg_path)], capture_output=True, text=True)
        self.assertEqual(0, first.returncode, first.stderr)
        second = subprocess.run(TOOL_CLI + ["build", "--config", str(cfg_path)], capture_output=True, text=True)
        self.assertEqual(2, second.returncode)
        self.assertIn("PACKET_ROOT_EXISTS", second.stderr)

    def test_cli_verify_missing_packet_not_run_never_pass(self):
        cfg_path = self.fx.write_config(self.fx.config())
        out = subprocess.run(TOOL_CLI + ["verify", "--package", str(self.fx.root / "no-such-packet"),
                                         "--config", str(cfg_path)], capture_output=True, text=True)
        self.assertEqual(1, out.returncode)
        receipt = json.loads(out.stdout)
        self.assertEqual("BLOCKED", receipt["status"])
        self.assertTrue(all(c["status"] == "NOT_RUN" for c in receipt["checks"] if c["id"] != "PACKET_PRESENT"))


class StalePathFaults(PacketTestBase):
    def test_commands_pointing_at_old_task_path_detected(self):
        cfg, cfg_path, _ = self.build()
        commands = self.fx.packet / "COMMANDS.txt"
        commands.write_text(commands.read_text().replace(str(self.fx.packet.resolve()), OLD_TASK_ROOT))
        checks = self.verify(cfg, cfg_path)
        check = self.assert_blocked(checks, "REFERENCES:COMMANDS.txt", "STALE_PATH_REFERENCE")
        stale = [f for f in check["details"] if f["code"] == "STALE_PATH_REFERENCE"]
        self.assertTrue(all(f["path"].startswith(OLD_TASK_ROOT) for f in stale), stale)

    def test_broken_in_packet_reference_detected(self):
        cfg, cfg_path, _ = self.build()
        (self.fx.packet / "stage" / "stage-tool.py").unlink()
        self.reforge_top(cfg)  # fresh top must not hide the broken reference
        checks = self.verify(cfg, cfg_path)
        self.assert_blocked(checks, "REFERENCES:COMMANDS.txt", "BROKEN_REFERENCE")

    def test_allowlisted_external_reference_does_not_block(self):
        cfg = self.fx.config(externalReferenceAllowlist=["/usr/bin/", "/bin/", OLD_TASK_ROOT + "/"])
        cfg["commandFiles"] = [{"path": "COMMANDS.txt", "entries": [
            {"label": "REFERENCE ONLY (not executed)",
             "command": "/usr/bin/cat {packet_root}/COMMANDS.txt " + OLD_TASK_ROOT + "/notes.txt"}]}]
        cfg_path = self.fx.write_config(cfg)
        rp.build_packet(cfg, cfg_path.parent, self.fx.packet)
        checks = rp.verify_packet(cfg, cfg_path.parent, self.fx.packet)
        status, exit_code = rp.aggregate(checks)
        self.assertEqual(("PASS", 0), (status, exit_code))
        recorded = self.status_of(checks, "REFERENCES:COMMANDS.txt")["details"]
        self.assertTrue(any(f["code"] == "EXTERNAL_REFERENCE" for f in recorded), recorded)


class StaleDigestFaults(PacketTestBase):
    def test_inner_stale_digest_not_masked_by_fresh_top_seal(self):
        cfg, cfg_path, _ = self.build()
        target = self.fx.packet / "operation-source" / "app-src" / "lib" / "util.txt"
        target.write_text("tampered body\n")  # stale inner bytes
        self.reforge_top(cfg)  # attacker refreshes the top-level PASS
        checks = self.verify(cfg, cfg_path)
        self.assertEqual("PASS", self.status_of(checks, "TOP_MANIFEST")["status"])
        self.assertEqual("PASS", self.status_of(checks, "TOP_SEAL")["status"])
        check = self.assert_blocked(checks, "LAYER_MANIFEST:operation-source", "DIGEST_MISMATCH")
        self.assertEqual("app-src/lib/util.txt",
                         next(f for f in check["details"] if f["code"] == "DIGEST_MISMATCH")["path"])

    def test_pin_digest_mismatch_detected(self):
        cfg, cfg_path, _ = self.build()
        (self.fx.packet / "artifacts" / "frozen-bundle.bin").write_bytes(b"\x00drifted-bytes\x00")
        self.reforge_top(cfg)
        checks = self.verify(cfg, cfg_path)
        self.assert_blocked(checks, "PINS:PINS.json", "PIN_DIGEST_MISMATCH")

    def test_unlisted_added_file_detected(self):
        cfg, cfg_path, _ = self.build()
        (self.fx.packet / "operation-source" / "app-src" / "smuggled.txt").write_text("extra\n")
        self.reforge_top(cfg)
        checks = self.verify(cfg, cfg_path)
        self.assert_blocked(checks, "LAYER_MANIFEST:operation-source", "UNLISTED_FILE")


class ArchiveNameFaults(PacketTestBase):
    def test_misconfigured_archive_name_fails_before_release(self):
        cfg = self.fx.config()
        cfg["pinFiles"][0]["bindings"][0]["target"] = "artifacts/app-archive-old-name.tar.gz"
        cfg_path = self.fx.write_config(cfg)
        rp.build_packet(cfg, cfg_path.parent, self.fx.packet)
        checks = rp.verify_packet(cfg, cfg_path.parent, self.fx.packet)
        check = self.assert_blocked(checks, "PINS:PINS.json", "PIN_TARGET_MISSING")
        self.assertEqual("artifacts/app-archive-old-name.tar.gz",
                         next(f for f in check["details"] if f["code"] == "PIN_TARGET_MISSING")["target"])

    def test_archive_renamed_after_build_detected(self):
        cfg, cfg_path, _ = self.build()
        artifacts = self.fx.packet / "artifacts"
        (artifacts / "app-src-archive.tar.gz").rename(artifacts / "app-src-archive-renamed.tar.gz")
        (artifacts / "app-src-archive.tar.gz.sha256").rename(artifacts / "app-src-archive-renamed.tar.gz.sha256")
        checks = self.verify(cfg, cfg_path)  # no reforge: released manifest still names the old archive
        self.assert_blocked(checks, "TOP_MANIFEST", "MANIFEST_FILE_MISSING")
        self.assert_blocked(checks, "PINS:PINS.json", "PIN_TARGET_MISSING")


class DegradedNotBlocked(PacketTestBase):
    def test_non_blocking_failure_degrades_without_global_block(self):
        cfg = self.fx.config()
        cfg["layers"].append({"name": "docs", "dir": "docs",
                              "build": {"type": "inline-files",
                                        "files": [{"path": "HANDOFF.md", "from": "overlays/extra.txt"}]}})
        cfg["referenceFiles"].append({"path": "docs/HANDOFF.md", "blocking": False})
        cfg["commandFiles"].append({"path": "docs/HANDOFF.md", "entries": [
            {"label": "SEE ALSO", "command": "/usr/bin/cat " + OLD_TASK_ROOT + "/HANDOFF.md"}]})
        cfg["baseline"] = {"process": "manual assembly", "stepsMeasured": 14, "elapsedMeasured": "38m"}
        cfg_path = self.fx.write_config(cfg)
        rp.build_packet(cfg, cfg_path.parent, self.fx.packet)
        checks = rp.verify_packet(cfg, cfg_path.parent, self.fx.packet)
        status, exit_code = rp.aggregate(checks)
        self.assertEqual(("DEGRADED", 0), (status, exit_code))
        degraded = self.status_of(checks, "REFERENCES:docs/HANDOFF.md")
        self.assertEqual("FAIL", degraded["status"])
        self.assertFalse(degraded["blocking"])
        self.assertEqual("PASS", self.status_of(checks, "REFERENCES:COMMANDS.txt")["status"])
        self.assertEqual("PASS", self.status_of(checks, "TOP_MANIFEST")["status"])
        self.assertEqual("PASS", self.status_of(checks, "BASELINE_RECORDED")["status"])

    def test_declared_baseline_without_measurement_is_unknown(self):
        cfg = self.fx.config(baseline={"process": "manual assembly", "stepsMeasured": None,
                                       "elapsedMeasured": None})
        cfg_path = self.fx.write_config(cfg)
        rp.build_packet(cfg, cfg_path.parent, self.fx.packet)
        checks = rp.verify_packet(cfg, cfg_path.parent, self.fx.packet)
        status, exit_code = rp.aggregate(checks)
        self.assertEqual(("DEGRADED", 0), (status, exit_code))
        check = self.status_of(checks, "BASELINE_RECORDED")
        self.assertEqual(("UNKNOWN", False), (check["status"], check["blocking"]))

    def test_no_baseline_declaration_stays_pass(self):
        cfg, cfg_path, checks = self.build()
        status, exit_code = rp.aggregate(checks)
        self.assertEqual(("PASS", 0), (status, exit_code))
        self.assertFalse(any(c["id"] == "BASELINE_RECORDED" for c in checks))


class RepairByRebuild(PacketTestBase):
    def test_same_command_rebuild_from_source_repairs_faults(self):
        cfg, cfg_path, _ = self.build()
        (self.fx.packet / "operation-source" / "app-src" / "lib" / "util.txt").write_text("tampered\n")
        commands = self.fx.packet / "COMMANDS.txt"
        commands.write_text(commands.read_text().replace(str(self.fx.packet.resolve()), OLD_TASK_ROOT))
        self.assert_blocked(self.verify(cfg, cfg_path))
        rp.build_packet(cfg, cfg_path.parent, self.fx.packet, rebuild=True)  # same command, same source+config
        status, exit_code = rp.aggregate(self.verify(cfg, cfg_path))
        self.assertEqual(("PASS", 0), (status, exit_code))
        self.assertNotIn(OLD_TASK_ROOT, (self.fx.packet / "COMMANDS.txt").read_text())
        self.assertEqual("util body\n",
                         (self.fx.packet / "operation-source" / "app-src" / "lib" / "util.txt").read_text())


class TopSealAnchor(PacketTestBase):
    def test_anchor_rejects_fully_reforged_packet(self):
        cfg, cfg_path, _ = self.build()
        receipt_seal = pm.read_seal(self.fx.packet)["manifestSha256"]
        (self.fx.packet / "operation-source" / "app-src" / "app.txt").write_text("reforged body\n")
        # full self-consistent reforge: layer pair + top pair regenerated over tampered bytes
        pm.write_manifest(self.fx.packet / "operation-source", exclude={pm.MANIFEST_NAME, pm.SEAL_NAME})
        pm.write_seal(self.fx.packet / "operation-source", kind="operation-source")
        self.reforge_top(cfg)
        plain = self.verify(cfg, cfg_path)
        self.assertEqual("PASS", rp.aggregate(plain)[0])  # self-consistent forgeries verify clean
        checks = self.verify(cfg, cfg_path, expect_top_seal=receipt_seal)
        self.assert_blocked(checks, "EXPECTED_TOP_SEAL", "TOP_SEAL_ANCHOR_MISMATCH")
        checks = self.verify(cfg, cfg_path, expect_top_seal=pm.read_seal(self.fx.packet)["manifestSha256"])
        self.assertEqual("PASS", rp.aggregate(checks)[0])  # untouched packet passes with the fresh anchor


class ConfigSafety(PacketTestBase):
    def test_packet_root_inside_source_refused(self):
        cfg = self.fx.config()
        cfg["packet"]["root"] = "repo/out"
        cfg_path = self.fx.write_config(cfg)
        with self.assertRaises(rp.ConfigError):
            rp.build_packet(cfg, cfg_path.parent, cfg_path.parent / "repo" / "out")

    def test_dirty_source_refused(self):
        (self.fx.repo / "app.txt").write_text("uncommitted drift\n")
        cfg = self.fx.config()
        cfg_path = self.fx.write_config(cfg)
        with self.assertRaises(rp.ConfigError):
            rp.build_packet(cfg, cfg_path.parent, self.fx.packet)

    def test_source_commit_drift_refused(self):
        cfg = self.fx.config()
        cfg["source"]["commit"] = "0" * 64
        cfg_path = self.fx.write_config(cfg)
        with self.assertRaises(rp.ConfigError):
            rp.build_packet(cfg, cfg_path.parent, self.fx.packet)

    def test_frozen_artifact_drift_refused(self):
        cfg = self.fx.config()
        cfg["artifacts"][1]["expectSha256"] = "1" * 64
        cfg_path = self.fx.write_config(cfg)
        with self.assertRaises(rp.ConfigError):
            rp.build_packet(cfg, cfg_path.parent, self.fx.packet)

    def test_generic_config_rebuilds_without_code_changes(self):
        cfg = self.fx.config()
        cfg["packet"] = {"kind": "OTHER_BUSINESS_RELEASE_CANDIDATE", "root": "out/other-packet"}
        cfg["layers"] = [{"name": "stage", "dir": "stage",
                          "build": {"type": "copy-tree", "from": "stage-input"}}]
        cfg["artifacts"] = [{"name": "artifacts/stage.tar.gz", "type": "tar-gz", "fromLayerDir": "stage"}]
        cfg["pinFiles"] = [{"path": "PINS.json", "bindings": [
            {"forEach": "/toolPins", "paths": ["stage/stage-tool.py"], "pathKey": "path", "digestKey": "sha256"}]}]
        cfg_path = self.fx.write_config(cfg, "other.json")
        rp.build_packet(cfg, cfg_path.parent, self.fx.root / "out" / "other-packet")
        checks = rp.verify_packet(cfg, cfg_path.parent, self.fx.root / "out" / "other-packet")
        self.assertEqual(("PASS", 0), rp.aggregate(checks))


if __name__ == "__main__":
    unittest.main()
