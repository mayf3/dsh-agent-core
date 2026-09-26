"""Private actual handler capability tests using disposable DS root only."""
from contextlib import contextmanager
import fcntl
import json
import os
from pathlib import Path
import tempfile
import subprocess
import unittest
from unittest.mock import patch

from process_confinement import confine_processes, ProcessDispatchDenied


class OwnedStopTest(unittest.TestCase):
    @contextmanager
    def fixture(self):
        with confine_processes(subprocess) as recorder:
            self.process_recorder = recorder
            import test_orchestration as assembled_fixture
            with tempfile.TemporaryDirectory() as root:
                ds = assembled_fixture.FixedAssembledActionTest().assembled(root)
                ds.HR_JOURNAL.seal_intent('n' * 32, 'a' * 64, 97)
                lock = ds.mutation_lock()
                path = Path(root) / ds.HR_PROFILE.OPERATION_ID / 'window.lock'
                window = os.open(path, os.O_RDWR | os.O_CREAT | os.O_EXCL, 0o600)
                fcntl.flock(window, fcntl.LOCK_EX | fcntl.LOCK_NB)
                owner = None
                try:
                    owner = ds.HR_OWNED_STOP.capture_from_handler(lock, window)
                    yield ds, owner, lock, window, path
                finally:
                    if owner is not None:
                        owner.close()
                    os.close(window)
                    os.close(lock)

    def test_duplicate_capability_same_ofd_and_close_never_unlocks_original(self):
        with self.fixture() as (ds, owner, lock, window, path):
            self.assertTrue(ds.HR_HANDOFF.same_open_file_description(
                owner.window_dup, window, owner.window_identity))
            owner.close()
            with self.assertRaisesRegex(Exception, 'OWNED_CUSTODY_UNKNOWN'):
                owner.check()
            probe = os.open(path, os.O_RDWR)
            try:
                with self.assertRaises(BlockingIOError):
                    fcntl.flock(probe, fcntl.LOCK_EX | fcntl.LOCK_NB)
            finally:
                os.close(probe)

    def test_observed_released_window_remains_unknown_after_relock(self):
        with self.fixture() as (_, owner, _, window, _):
            fcntl.flock(window, fcntl.LOCK_UN)
            with self.assertRaisesRegex(Exception, 'OWNED_LOCK_RELEASED'):
                owner.check()
            fcntl.flock(window, fcntl.LOCK_EX | fcntl.LOCK_NB)
            with self.assertRaisesRegex(Exception, 'OWNED_CUSTODY_UNKNOWN'):
                owner.check()

    def test_wrong_reused_fd_same_inode_is_not_same_ofd(self):
        with self.fixture() as (_, owner, _, window, path):
            replacement = os.open(path, os.O_RDWR)
            try:
                os.dup2(replacement, window)
            finally:
                os.close(replacement)
            with self.assertRaisesRegex(Exception, 'OWNED_FD_CHANGED'):
                owner.check()

    def test_lost_fd_sticky_even_if_restored_from_retained_dup(self):
        with self.fixture() as (_, owner, _, window, _):
            os.close(window)
            try:
                with self.assertRaises(OSError):
                    owner.check()
            finally:
                os.dup2(owner.window_dup, window)
            with self.assertRaisesRegex(Exception, 'OWNED_CUSTODY_UNKNOWN'):
                owner.check()

    def test_replaced_fixed_path_is_not_retained_descriptor_identity(self):
        with self.fixture() as (_, owner, _, _, path):
            path.unlink()
            path.write_bytes(b'other')
            with self.assertRaisesRegex(Exception, 'OWNED_PATH_CHANGED'):
                owner.check()

    def test_stale_intent_rejected_before_stop(self):
        with self.fixture() as (ds, owner, _, _, path):
            intent = path.parent / 'intent.json'
            record = json.loads(intent.read_text())
            record['atWallMs'] += 1
            intent.write_bytes(ds.HR_JOURNAL.canonical(record))
            with self.assertRaisesRegex(Exception, 'OWNED_INTENT_CHANGED'):
                owner.fixed_stop()

    def test_real_unbootstrapped_guard_zero_path_intent_or_fd_reads(self):
        with self.fixture() as (ds, _, lock, window, _):
            ds.TEST_MODE = False
            with patch.object(ds.HR_JOURNAL, 'readback', side_effect=AssertionError('read')):
                with self.assertRaisesRegex(Exception, 'PROFILE_NOT_BOOTSTRAPPED'):
                    ds.HR_OWNED_STOP.capture_from_handler(lock, window)

    def test_owned_real_stop_guard_and_partial_inventory_zero_command(self):
        with self.fixture() as (ds, owner, _, _, _):
            stopper = owner.fixed_stop()
            with patch.object(ds.HR_FINITE_STOP, 'command', side_effect=AssertionError('effect')):
                with self.assertRaisesRegex(Exception, 'PROFILE_NOT_BOOTSTRAPPED'):
                    stopper.stop()
                with patch.object(ds.HR_REAL_OS, 'require_activation', return_value=None), patch.object(
                        ds.HR_INVENTORY, 'fixed_installed_inventory', return_value={'unresolvedSources': ['LE1']}):
                    with self.assertRaisesRegex(Exception, 'SOURCE_CLOSURE_UNKNOWN'):
                        stopper.stop()

    def test_owned_stop_unmocked_dispatch_denied_then_no_replay(self):
        # Do not run this adapter test until root/reviewer approves confinement.
        # No namespace command patch can bypass the mandatory Popen boundary.
        with self.fixture() as (ds, owner, _, _, _):
            stopper = owner.fixed_stop()
            with patch.object(ds.HR_REAL_OS, 'require_activation', return_value=None), patch.object(
                    ds.HR_INVENTORY, 'fixed_installed_inventory', return_value={'unresolvedSources': []}):
                with self.assertRaises(ProcessDispatchDenied):
                    stopper.stop()
                self.assertEqual(self.process_recorder.calls,
                    [('/bin/launchctl', 'bootout', 'gui/505/ai.agent-core.runtime')])
                with self.assertRaisesRegex(Exception, 'STOP_NO_REPLAY'):
                    stopper.stop()


if __name__ == '__main__':
    unittest.main()
