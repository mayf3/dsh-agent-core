"""Synthetic stdout fixtures for the fixed read-only host collector."""

import importlib.util
import pathlib
import subprocess
import unittest
from unittest.mock import patch


HERE = pathlib.Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("hr_s256_collector", HERE / "collector.py")
collector = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(collector)


class CensusTest(unittest.TestCase):
    def capture(self, ps, lsof, ps_code=0, lsof_code=0):
        outputs = [subprocess.CompletedProcess([], ps_code, ps, b""),
                   subprocess.CompletedProcess([], lsof_code, lsof, b"")]
        with patch.object(collector.os, "geteuid", return_value=0), \
             patch.object(collector.subprocess, "run", side_effect=outputs) as run:
            result = collector.collect_whole_host({123}, ["/fixture/workspace"])
        self.assertEqual(run.call_count, 2)
        self.assertEqual(run.call_args_list[0].args[0], collector.PS_COMMAND)
        self.assertEqual(run.call_args_list[1].args[0], collector.LSOF_COMMAND)
        self.assertEqual(run.call_args_list[0].kwargs["timeout"], 10)
        self.assertEqual(run.call_args_list[0].kwargs["env"], {"PATH": "/usr/bin:/bin"})
        return result

    def test_whole_host_zero_is_normalized_without_raw_command_or_path_payload(self):
        ps = b"1 0 0 launchd\n456 1 505 node\n"
        lsof = b"p456\0f1\0n/fixture/other\0"
        result = self.capture(ps, lsof)
        self.assertEqual(result["runtimeTreeProcessCount"], 0)
        self.assertEqual(result["openHolderCount"], 0)
        self.assertNotIn(b"node", result["psOutput"])
        self.assertNotIn(b"/fixture/other", result["lsofOutput"])

    def test_old_pid_or_holder_is_rejected(self):
        with self.assertRaisesRegex(collector.Rejected, "OLD_TREE_PRESENT"):
            self.capture(b"123 1 505 node\n", b"p123\0f1\0n/fixture/other\0")
        with self.assertRaisesRegex(collector.Rejected, "HOLDER_PRESENT"):
            self.capture(b"456 1 505 node\n", b"p456\0f1\0n/fixture/workspace/file\0")

    def test_incomplete_or_ambiguous_commands_fail_closed(self):
        for ps, lsof, pcode, lcode in (
            (b"", b"p456\0f1\0n/fixture/other\0", 0, 0),
            (b"malformed\n", b"p456\0f1\0n/fixture/other\0", 0, 0),
            (b"456 1 505 node\n", b"garbage", 0, 0),
            (b"456 1 505 node\n", b"p456\0f1\0n/fixture/other\0", 1, 0),
            (b"456 1 505 node\n", b"p456\0f1\0n/fixture/other\0", 0, 1),
            (b"456 1 505 node\n", b"x" * 65537, 0, 0),
        ):
            with self.subTest(ps=ps[:20], lsof=lsof[:20]), self.assertRaises(collector.Rejected):
                self.capture(ps, lsof, pcode, lcode)

    def test_requires_root_and_known_closed_old_pid_set(self):
        with patch.object(collector.os, "geteuid", return_value=501), \
             self.assertRaisesRegex(collector.Rejected, "ROOT_REQUIRED"):
            collector.collect_whole_host({123}, ["/fixture/workspace"])
        with patch.object(collector.os, "geteuid", return_value=0), \
             self.assertRaisesRegex(collector.Rejected, "OLD_TREE_IDENTITY_UNKNOWN"):
            collector.collect_whole_host(set(), ["/fixture/workspace"])


if __name__ == "__main__":
    unittest.main()
