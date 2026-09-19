import importlib
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

r = importlib.import_module("sudoers_retirement_prerequisite")


class RetirementTests(unittest.TestCase):
    def setUp(self):
        # The production preimage requires no xattrs. APFS automatically adds
        # com.apple.provenance to files created by this test process.
        self.no_fixture_xattrs = patch.object(r, "_xattrs", return_value=[])
        self.no_fixture_xattrs.start()

    def fixture(self):
        temp = tempfile.TemporaryDirectory()
        root = Path(temp.name)
        active_path = root / "sudoers.d"; state_path = root / "state"
        active_path.mkdir(mode=0o700); state_path.mkdir(mode=0o700)
        for name in r.NAMES:
            path = active_path / name
            path.write_bytes(b"fixed legacy rule\n"); path.chmod(0o600)
        active = os.open(active_path, os.O_RDONLY | os.O_DIRECTORY)
        state = os.open(state_path, os.O_RDONLY | os.O_DIRECTORY)
        expected = r._expected_fixture(active, os.getuid())
        return temp, active_path, state_path, active, state, expected

    def tear(self):
        self.no_fixture_xattrs.stop()

    def test_exact_entries_move_and_complete(self):
        temp, active_path, state_path, active, state, expected = self.fixture()
        try:
            result = r.retire_at(active, state, expected, os.getuid(), lambda *_: None)
            self.assertEqual(result["state"], "RETIREMENT_COMPLETE")
            for index, name in enumerate(r.NAMES):
                self.assertFalse((active_path / name).exists())
                self.assertEqual((state_path / r.JOURNAL / r.ARCHIVE / name).stat().st_ino,
                                 expected[index]["inode"])
        finally:
            os.close(active); os.close(state); temp.cleanup()

    def test_wrong_digest_fails_before_move(self):
        temp, active_path, _, active, state, expected = self.fixture()
        bad = [dict(v) for v in expected]; bad[0]["sha256"] = "0" * 64
        try:
            with self.assertRaisesRegex(RuntimeError, "SUDOERS_RETIREMENT_PREIMAGE"):
                r.retire_at(active, state, tuple(bad), os.getuid(), lambda *_: None)
            self.assertTrue(all((active_path / name).exists() for name in r.NAMES))
        finally:
            os.close(active); os.close(state); temp.cleanup()

    def test_crash_after_first_rename_reconciles_same_inode(self):
        temp, active_path, state_path, active, state, expected = self.fixture()
        try:
            area = r._mkdir(state, r.JOURNAL, os.getuid()); archive = r._mkdir(area, r.ARCHIVE, os.getuid())
            os.rename(r.NAMES[0], r.NAMES[0], src_dir_fd=active, dst_dir_fd=archive)
            inode = (state_path / r.JOURNAL / r.ARCHIVE / r.NAMES[0]).stat().st_ino
            os.close(archive); os.close(area)
            r.retire_at(active, state, expected, os.getuid(), lambda *_: None)
            self.assertEqual((state_path / r.JOURNAL / r.ARCHIVE / r.NAMES[0]).stat().st_ino, inode)
            self.assertFalse((active_path / r.NAMES[1]).exists())
        finally:
            os.close(active); os.close(state); temp.cleanup()

    def test_policy_unknown_retains_archive_and_resume_does_not_move_again(self):
        temp, _, state_path, active, state, expected = self.fixture()
        try:
            with self.assertRaisesRegex(RuntimeError, "VISUDO_UNKNOWN"):
                r.retire_at(active, state, expected, os.getuid(),
                            lambda *_: (_ for _ in ()).throw(RuntimeError("VISUDO_UNKNOWN")))
            before = [(state_path / r.JOURNAL / r.ARCHIVE / n).stat().st_ino for n in r.NAMES]
            r.retire_at(active, state, expected, os.getuid(), lambda *_: None)
            after = [(state_path / r.JOURNAL / r.ARCHIVE / n).stat().st_ino for n in r.NAMES]
            self.assertEqual(before, after)
        finally:
            os.close(active); os.close(state); temp.cleanup()

    def test_active_and_archive_duplicate_is_unknown(self):
        temp, _, state_path, active, state, expected = self.fixture()
        try:
            area = r._mkdir(state, r.JOURNAL, os.getuid()); archive = r._mkdir(area, r.ARCHIVE, os.getuid())
            (state_path / r.JOURNAL / r.ARCHIVE / r.NAMES[0]).write_bytes(b"fixed legacy rule\n")
            (state_path / r.JOURNAL / r.ARCHIVE / r.NAMES[0]).chmod(0o600)
            os.close(archive); os.close(area)
            with self.assertRaisesRegex(RuntimeError, "SUDOERS_RETIREMENT_LOCATION_UNKNOWN"):
                r.retire_at(active, state, expected, os.getuid(), lambda *_: None)
        finally:
            os.close(active); os.close(state); temp.cleanup()

    def test_security_xattrs_accepts_only_exact_policy_and_provenance(self):
        with patch.object(r, "_xattrs", return_value=["com.apple.provenance"]), \
             patch.object(r, "_xattr_value", return_value=r.PROVENANCE):
            r._security_xattrs(99, "provenance")
            r._security_xattrs(99, "created")
            with self.assertRaisesRegex(RuntimeError, "SECURITY_XATTR"):
                r._security_xattrs(99, "none")
        with patch.object(r, "_xattrs", return_value=[]):
            r._security_xattrs(99, "none")
            r._security_xattrs(99, "created")
            with self.assertRaisesRegex(RuntimeError, "SECURITY_XATTR"):
                r._security_xattrs(99, "provenance")
        for names, value in [([], b""), (["com.apple.provenance"], b"\x01\x03"),
                             (["com.apple.quarantine"],
                              r.PROVENANCE)]:
            with patch.object(r, "_xattrs", return_value=names), \
                 patch.object(r, "_xattr_value", return_value=value), \
                 self.assertRaisesRegex(RuntimeError, "SECURITY_XATTR"):
                r._security_xattrs(99, "provenance")


if __name__ == "__main__": unittest.main()
