"""Review-fix regression tests for release-packet (PR #495 review: 6 P1 + 1 P2).

Each test isolates exactly one reported defect; fixtures stay synthetic and
the CLI paths that need them are exercised only where the defect itself lives
on the CLI boundary. Run: python3 test_release_packet_review_fixes.py
"""

import json
import subprocess
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import packet_model as pm
import release_packet as rp
import test_release_packet as base

TOOL_CLI = [sys.executable, str(HERE / "release_packet.py")]


class GitOidAccepted(base.PacketTestBase):
    """P1: the repo uses 40-char SHA-1 object ids; load_config demanded 64."""

    def test_cli_builds_packet_pinned_by_40_char_oid(self):
        self.assertEqual(40, len(self.fx.commit), "fixture git must default to SHA-1 oids")
        cfg_path = self.fx.write_config(self.fx.config())
        out = subprocess.run(TOOL_CLI + ["build", "--config", str(cfg_path)],
                             capture_output=True, text=True)
        self.assertEqual(0, out.returncode, out.stderr)
        self.assertEqual("PASS", json.loads(out.stdout)["status"])
        tree = subprocess.check_output(
            ["git", "-C", str(self.fx.repo), "rev-parse", "HEAD^{tree}"]).decode().strip()
        cfg = self.fx.config()
        cfg["source"]["tree"] = tree
        cfg_path = self.fx.write_config(cfg)
        out = subprocess.run(TOOL_CLI + ["build", "--config", str(cfg_path), "--rebuild-existing"],
                             capture_output=True, text=True)
        self.assertEqual(0, out.returncode, out.stderr)

    def test_non_hex_oid_still_refused(self):
        cfg = self.fx.config()
        cfg["source"]["commit"] = "z" * 40
        cfg_path = self.fx.write_config(cfg)
        out = subprocess.run(TOOL_CLI + ["build", "--config", str(cfg_path)],
                             capture_output=True, text=True)
        self.assertEqual(2, out.returncode)
        self.assertIn("CONFIG_SOURCE_COMMIT_MALFORMED", out.stderr)


class RebuildFailurePreservesPacket(base.PacketTestBase):
    """P1: --rebuild-existing must not delete the old packet before success."""

    def test_failed_rebuild_leaves_previous_packet_intact(self):
        cfg, cfg_path, _ = self.build()
        anchor = pm.sha256_file(self.fx.packet / pm.SEAL_NAME)
        before = {
            "commands": (self.fx.packet / "COMMANDS.txt").read_bytes(),
            "layer_util": (self.fx.packet / "operation-source" / "app-src" / "lib" / "util.txt").read_bytes(),
            "top_manifest": (self.fx.packet / pm.MANIFEST_NAME).read_bytes(),
        }
        (self.fx.repo / "app.txt").write_text("uncommitted drift breaks the rebuild\n")
        with self.assertRaises(rp.ConfigError):
            rp.build_packet(cfg, cfg_path.parent, self.fx.packet, rebuild=True)
        self.assertEqual(before["commands"], (self.fx.packet / "COMMANDS.txt").read_bytes())
        self.assertEqual(before["layer_util"],
                         (self.fx.packet / "operation-source" / "app-src" / "lib" / "util.txt").read_bytes())
        self.assertEqual(before["top_manifest"], (self.fx.packet / pm.MANIFEST_NAME).read_bytes())
        checks = self.verify(cfg, cfg_path, expect_top_seal=anchor)
        self.assertEqual(("PASS", 0), rp.aggregate(checks))
        siblings = [p.name for p in self.fx.packet.parent.iterdir() if p.name != "packet"]
        self.assertEqual([], [n for n in siblings if "rebuild" in n or "replaced" in n],
                         "rebuild staging litter left behind: %s" % siblings)

    def test_successful_rebuild_still_repairs_and_binds_final_root(self):
        cfg, cfg_path, _ = self.build()
        (self.fx.packet / "operation-source" / "app-src" / "lib" / "util.txt").write_text("tampered\n")
        rp.build_packet(cfg, cfg_path.parent, self.fx.packet, rebuild=True)
        status, exit_code = rp.aggregate(self.verify(cfg, cfg_path))
        self.assertEqual(("PASS", 0), (status, exit_code))
        commands = (self.fx.packet / "COMMANDS.txt").read_text()
        self.assertNotIn(".packet.rebuild-", commands)
        self.assertIn(str(self.fx.packet.resolve()), commands)


class SymlinkedDirectoryRefused(base.PacketTestBase):
    """P1: a symlinked directory added after sealing was invisible to manifests."""

    def test_symlink_dir_after_seal_blocks_verification(self):
        cfg, cfg_path, _ = self.build()
        external = self.fx.root / "external-content"
        external.mkdir()
        (external / "leak.txt").write_text("unpinned external bytes\n")
        (self.fx.packet / "linkdir").symlink_to(external)
        checks = self.verify(cfg, cfg_path)  # no reforge: sealed manifest cannot list it
        self.assert_blocked(checks, "TOP_MANIFEST", "SYMLINK_IN_PACKET")

    def test_symlink_dir_inside_layer_blocks_layer_manifest(self):
        cfg, cfg_path, _ = self.build()
        external = self.fx.root / "external-content"
        external.mkdir()
        (self.fx.packet / "operation-source" / "linkdir").symlink_to(external)
        checks = self.verify(cfg, cfg_path)
        self.assert_blocked(checks, "LAYER_MANIFEST:operation-source", "SYMLINK_IN_PACKET")


class TopSealAnchorMatchesReceipt(base.PacketTestBase):
    """P1: --expect-top-seal must compare the emitted topSealSha256 (SEAL.json bytes)."""

    def test_receipt_anchor_verifies_untouched_packet(self):
        cfg, cfg_path, _ = self.build()
        anchor = pm.sha256_file(self.fx.packet / pm.SEAL_NAME)  # exactly what the receipt emits
        checks = self.verify(cfg, cfg_path, expect_top_seal=anchor)
        self.assertEqual(("PASS", 0), rp.aggregate(checks))

    def test_receipt_anchor_rejects_reforged_packet(self):
        cfg, cfg_path, _ = self.build()
        anchor = pm.sha256_file(self.fx.packet / pm.SEAL_NAME)
        (self.fx.packet / "operation-source" / "app-src" / "app.txt").write_text("reforged\n")
        pm.write_manifest(self.fx.packet / "operation-source", exclude={pm.MANIFEST_NAME, pm.SEAL_NAME})
        pm.write_seal(self.fx.packet / "operation-source", kind="operation-source")
        self.reforge_top(cfg)
        checks = self.verify(cfg, cfg_path, expect_top_seal=anchor)
        self.assert_blocked(checks, "EXPECTED_TOP_SEAL", "TOP_SEAL_ANCHOR_MISMATCH")


class PinTargetContainment(base.PacketTestBase):
    """P1: pin target joined without check_rel escaped the packet and still PASSed."""

    def test_escape_target_refused_at_build(self):
        secret = self.fx.root / "outside-secret.txt"
        secret.write_text("bytes that must never be pinned from outside\n")
        cfg = self.fx.config()
        cfg["pinFiles"][0]["bindings"].append(
            {"pointer": "/escaped", "target": "../../outside-secret.txt"})
        cfg_path = self.fx.write_config(cfg)
        with self.assertRaises(pm.PacketError):
            rp.build_packet(cfg, cfg_path.parent, self.fx.packet)
        self.assertFalse(self.fx.packet.exists(), "refused build must leave no packet")

    def test_absolute_escape_target_refused_at_build(self):
        secret = self.fx.root / "outside-secret.txt"
        secret.write_text("external bytes\n")
        cfg = self.fx.config()
        cfg["pinFiles"][0]["bindings"].append({"pointer": "/escaped", "target": str(secret)})
        cfg_path = self.fx.write_config(cfg)
        with self.assertRaises(pm.PacketError):
            rp.build_packet(cfg, cfg_path.parent, self.fx.packet)
        self.assertFalse(self.fx.packet.exists())

    def test_escape_target_at_verify_is_structured_not_crash(self):
        cfg, cfg_path, _ = self.build()
        secret = self.fx.root / "outside-secret.txt"
        secret.write_text("external bytes\n")
        bad = self.fx.config()
        bad["pinFiles"][0]["bindings"].append({"pointer": "/escaped", "target": str(secret)})
        bad_path = self.fx.write_config(bad, "bad-pins.json")
        checks = rp.verify_packet(bad, bad_path.parent, self.fx.packet)
        self.assert_blocked(checks, "PINS:PINS.json", "PIN_DOC_ERROR")


class MissingManifestStructured(base.PacketTestBase):
    """P2: a missing MANIFEST.sha256 must yield a structured finding, not a traceback."""

    def test_missing_top_manifest_reports_finding_not_traceback(self):
        cfg, cfg_path, _ = self.build()
        (self.fx.packet / pm.MANIFEST_NAME).unlink()
        try:
            checks = rp.verify_packet(cfg, cfg_path.parent, self.fx.packet)
        except FileNotFoundError as exc:
            self.fail("verifier aborted with %r instead of a structured finding" % exc)
        self.assert_blocked(checks, "TOP_MANIFEST", "MANIFEST_ABSENT")

    def test_missing_layer_manifest_reports_finding(self):
        cfg, cfg_path, _ = self.build()
        (self.fx.packet / "stage" / pm.MANIFEST_NAME).unlink()
        checks = rp.verify_packet(cfg, cfg_path.parent, self.fx.packet)
        self.assert_blocked(checks, "LAYER_MANIFEST:stage", "MANIFEST_ABSENT")
        status, exit_code = rp.aggregate(checks)
        self.assertEqual(("BLOCKED", 1), (status, exit_code))

    def test_cli_missing_manifest_emits_receipt(self):
        cfg_path = self.fx.write_config(self.fx.config())
        first = subprocess.run(TOOL_CLI + ["build", "--config", str(cfg_path)],
                               capture_output=True, text=True)
        self.assertEqual(0, first.returncode, first.stderr)
        (self.fx.packet / pm.MANIFEST_NAME).unlink()
        out = subprocess.run(TOOL_CLI + ["verify", "--package", str(self.fx.packet),
                                         "--config", str(cfg_path)],
                             capture_output=True, text=True)
        self.assertEqual(1, out.returncode)
        self.assertNotIn("Traceback", out.stderr, out.stderr)
        receipt = json.loads(out.stdout)
        self.assertEqual("BLOCKED", receipt["status"])
        top = next(c for c in receipt["checks"] if c["id"] == "TOP_MANIFEST")
        self.assertEqual("MANIFEST_ABSENT", top["details"][0]["code"])


class SecondBusinessCliReuse(base.PacketTestBase):
    """Acceptance: a second, differently structured business config runs unchanged."""

    def test_second_business_end_to_end_cli(self):
        cfg = self.fx.config()
        cfg["packet"] = {"kind": "OTHER_BUSINESS_RELEASE_CANDIDATE", "root": "out/second-business"}
        cfg["layers"] = [
            {"name": "copied-stage", "dir": "copied-stage",
             "build": {"type": "copy-tree", "from": "stage-input"}},
            {"name": "docs", "dir": "docs",
             "build": {"type": "inline-files",
                       "files": [{"path": "NOTICE.txt", "from": "overlays/extra.txt"}]}},
        ]
        cfg["artifacts"] = [{"name": "bundles/copied-stage.tar.gz", "type": "tar-gz",
                             "fromLayerDir": "copied-stage", "rootName": "stage"}]
        cfg["commandFiles"] = [{"path": "RUN.md", "entries": [
            {"label": "INSPECT (not executed)",
             "command": "/usr/bin/python3 -I -B {packet_root}/copied-stage/stage-tool.py"}]}]
        cfg["referenceFiles"] = [{"path": "RUN.md", "blocking": True}]
        cfg["pinFiles"] = [{"path": "PINS.json", "bindings": [
            {"pointer": "/bundleSha256", "target": "bundles/copied-stage.tar.gz"},
            {"forEach": "/stagePins", "paths": ["copied-stage/stage-tool.py"],
             "pathKey": "path", "digestKey": "sha256", "bytesKey": "bytes"}]}]
        cfg["externalReferenceAllowlist"] = ["/usr/bin/"]
        cfg_path = self.fx.write_config(cfg, "second-business.json")
        out = subprocess.run(TOOL_CLI + ["build", "--config", str(cfg_path)],
                             capture_output=True, text=True)
        self.assertEqual(0, out.returncode, out.stderr)
        receipt = json.loads(out.stdout)
        self.assertEqual("PASS", receipt["status"])
        pins = json.loads((self.fx.root / "out" / "second-business" / "PINS.json").read_text())
        self.assertEqual(pins["bundleSha256"],
                         pm.sha256_file(self.fx.root / "out" / "second-business" / "bundles" / "copied-stage.tar.gz"))
        self.assertEqual(str((self.fx.root / "out" / "second-business" / "copied-stage" / "stage-tool.py").resolve()),
                         pins["stagePins"]["copied-stage/stage-tool.py"]["path"])
        vout = subprocess.run(TOOL_CLI + ["verify", "--package", str(self.fx.root / "out" / "second-business"),
                                          "--config", str(cfg_path),
                                          "--expect-top-seal", receipt["topSealSha256"]],
                              capture_output=True, text=True)
        self.assertEqual(0, vout.returncode, vout.stderr)
        self.assertEqual("PASS", json.loads(vout.stdout)["status"])


if __name__ == "__main__":
    unittest.main()
