"""Synthetic stdout fixtures for the fixed read-only host collector."""

import importlib.util
import pathlib
import sys
import time
import unittest
from unittest.mock import patch


HERE = pathlib.Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("hr_s256_collector", HERE / "collector.py")
collector = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(collector)
PROFILE_SPEC = importlib.util.spec_from_file_location("hr_s256_profile", HERE / "profile.py")
profile = importlib.util.module_from_spec(PROFILE_SPEC)
PROFILE_SPEC.loader.exec_module(profile)


class CensusTest(unittest.TestCase):
    def capture(self, ps, lsof, ps_code=0, lsof_code=0):
        outputs = [ps if ps_code == 0 else collector.Rejected("CENSUS_INCOMPLETE"),
                   lsof if lsof_code == 0 else collector.Rejected("CENSUS_INCOMPLETE")]
        with patch.object(collector.os, "geteuid", return_value=0), \
             patch.object(collector, "command_output", side_effect=outputs) as run:
            result = collector.collect_whole_host({123}, ["/fixture/workspace"])
        self.assertEqual(run.call_count, 2)
        self.assertEqual(run.call_args_list[0].args[0], collector.PS_COMMAND)
        self.assertEqual(run.call_args_list[1].args[0], collector.LSOF_COMMAND)
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

    def test_lsof_rejects_truncated_fields_and_fd_without_name(self):
        for raw in (b"p456\0f1\0n/fixture/other",
                    b"p456\0f1\0n/fixture/other\0p123\0f2\0"):
            with self.subTest(raw=raw), self.assertRaises(collector.Rejected):
                collector.parse_lsof(raw, ["/fixture/workspace"])

    def test_output_bound_interrupts_stream_before_process_exits(self):
        started = time.monotonic()
        with self.assertRaisesRegex(collector.Rejected, "CENSUS_OUTPUT_BOUND"):
            collector.command_output([sys.executable, "-c",
                "import os,time; os.write(1,b'x'*70000); time.sleep(4)"])
        self.assertLess(time.monotonic() - started, 3)

    def test_unlisted_same_uid_actor_can_escape_old_pid_census_but_not_inert_profile(self):
        # A complete old-PID census is not a complete Runtime-UID/source closure.
        scanned, old_present = collector.parse_ps(b"456 1 505 node\n", {123})
        self.assertEqual((scanned, old_present), (1, 0))
        with self.assertRaisesRegex(profile.Rejected, "PROFILE_NOT_BOOTSTRAPPED"):
            profile.production_entry({"action": profile.ACTION,
                                      "operation_id": profile.OPERATION_ID})


if __name__ == "__main__":
    unittest.main()
