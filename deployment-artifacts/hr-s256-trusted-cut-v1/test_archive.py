"""Synthetic fixed-s256 census archive and consumer file-layout checks."""

import hashlib
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch


HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("hr_s256_archive", HERE / "archive.py")
archive = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(archive)
COLLECTOR_SPEC = importlib.util.spec_from_file_location("hr_s256_collector", HERE / "collector.py")
collector = importlib.util.module_from_spec(COLLECTOR_SPEC)
COLLECTOR_SPEC.loader.exec_module(collector)


def normalized(tool, count_key, count):
    return (json.dumps({"tool": tool, count_key: count,
                       "oldTreeProcessCount" if tool == "ps" else "openHolderCount": 0,
                       "rawSha256": "a" * 64}, separators=(",", ":")) + "\n").encode()


def census():
    return {"runtimeTreeProcessCount": 0, "openHolderCount": 0,
            "psOutput": normalized("ps", "scannedProcessCount", 2),
            "lsofOutput": normalized("lsof", "scannedFileCount", 1),
            "psAtWallMs": 101, "lsofAtWallMs": 102}


class ArchiveTest(unittest.TestCase):
    def test_collector_output_feeds_fixed_archive_without_raw_payload(self):
        with tempfile.TemporaryDirectory() as root:
            os.chmod(root, 0o755)
            archive.TEST_MODE = True
            archive.STATE_ROOT = root
            with patch.object(collector.os, "geteuid", return_value=0), \
                 patch.object(collector, "command_output", side_effect=[
                     b"456 1 505 node\n", b"p456\0f1\0n/fixture/other\0"]), \
                 patch.object(collector.time, "time_ns", side_effect=[101_000_000, 102_000_000]):
                observed = collector.collect_whole_host({123}, ["/fixture/workspace"])
            result = archive.seal_census("fixture-host", observed, ["/fixture/workspace"], 100)
            self.assertEqual(result["hostCensus"]["executedAtWallMs"], 101)
            self.assertEqual(result["holderCheck"]["executedAtWallMs"], 102)
            output = (Path(root) / archive.DIRECTORY / "census-ps.txt").read_bytes()
            self.assertNotIn(b"node", output)
            self.assertNotIn(b"/fixture/other", output)

    def test_fixed_files_are_exclusive_readable_bounded_and_digest_bound(self):
        with tempfile.TemporaryDirectory() as root:
            os.chmod(root, 0o755)
            archive.TEST_MODE = True
            archive.STATE_ROOT = root
            result = archive.seal_census("fixture-host", census(),
                                         ["/fixture/workspace"], 100)
            evidence = Path(root) / archive.DIRECTORY
            self.assertEqual(evidence.stat().st_mode & 0o777, 0o755)
            self.assertEqual(result["hostCensus"]["archiveRef"], "census-archive.json")
            self.assertEqual(result["holderCheck"]["paths"], ["/fixture/workspace"])
            for name in ("census-ps.txt", "census-lsof.txt", "census-archive.json"):
                self.assertEqual((evidence / name).stat().st_mode & 0o777, 0o644)
            self.assertEqual(result["hostCensus"]["outputsSha256"], [
                hashlib.sha256((evidence / name).read_bytes()).hexdigest()
                for name in ("census-ps.txt", "census-lsof.txt")])
            self.assertEqual(result["archiveSha256"],
                             hashlib.sha256((evidence / "census-archive.json").read_bytes()).hexdigest())
            self.assertEqual(archive.readback()["archiveSha256"], result["archiveSha256"])
            with self.assertRaises(archive.Rejected):
                archive.seal_census("fixture-host", census(), ["/fixture/workspace"], 100)
            (evidence / "census-ps.txt").write_bytes(b"{}\n")
            with self.assertRaises(archive.Rejected):
                archive.readback()

    def test_unknown_or_secret_payload_and_bad_time_are_zero_write(self):
        duplicate = (b'{"tool":"ps","scannedProcessCount":2,"oldTreeProcessCount":0,'
                     b'"rawSha256":"privatePayload=sensitive-fixture",'
                     b'"rawSha256":"' + b'a' * 64 + b'"}\n')
        for changed_census, paths, quiesced in (
                ({**census(), "privatePayload": "sensitive-fixture"}, ["/fixture/workspace"], 100),
                ({**census(), "psOutput": duplicate}, ["/fixture/workspace"], 100),
                ({**census(), "lsofOutput": b"{}\n"}, ["/fixture/workspace"], 100),
                ({**census(), "runtimeTreeProcessCount": 1}, ["/fixture/workspace"], 100),
                (census(), [], 100),
                (census(), ["/fixture/workspace"], 103)):
            with self.subTest(changed=changed_census), tempfile.TemporaryDirectory() as root:
                os.chmod(root, 0o755)
                archive.TEST_MODE = True
                archive.STATE_ROOT = root
                with self.assertRaises(archive.Rejected):
                    archive.seal_census("fixture-host", changed_census, paths, quiesced)
                self.assertFalse((Path(root) / archive.DIRECTORY).exists())
