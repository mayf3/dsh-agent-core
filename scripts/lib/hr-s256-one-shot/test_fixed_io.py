"""Fixed IO connection tests; all production/process boundaries denied."""
from contextlib import contextmanager
import os
import json
import tempfile
import subprocess
import unittest
from unittest.mock import patch

from process_confinement import confine_processes


class FixedIOTest(unittest.TestCase):
    @contextmanager
    def assembled(self):
        with confine_processes(subprocess) as recorder:
            import test_orchestration as assembled_fixture
            with tempfile.TemporaryDirectory() as root:
                ds = assembled_fixture.FixedAssembledActionTest().assembled(root)
                try:
                    yield ds, root, recorder
                finally:
                    held = ds.HR_ONE_SHOT._custody.pop('fixed-DS-owner', None)
                    if held is not None:
                        if held.get('stopOwner') is not None:
                            held['stopOwner'].close()
                        io = held['io']
                        if hasattr(io, '_window') and io._window is not None:
                            os.close(io._window)
                        os.close(held['canonicalFd'])
            self.assertEqual(recorder.calls, [])

    def test_actual_factory_has_fixed_window_and_stop_connection(self):
        with self.assembled() as (ds, root, recorder):
            with patch.object(ds.HR_REAL_OS, 'require_activation', return_value={'hostId': 'fixture-host'}):
                io = ds.HR_ONE_SHOT.fixed_io()
                self.assertTrue(callable(io.open_fixed_window))
                self.assertTrue(callable(io.quiesce_fixed_tree))

    def test_activation_rejects_before_inventory_or_window_io(self):
        with self.assembled() as (ds, root, recorder):
            with patch.object(ds.HR_INVENTORY, 'fixed_installed_inventory') as inventory:
                with self.assertRaisesRegex(Exception, 'PROFILE_NOT_BOOTSTRAPPED'):
                    ds.HR_ONE_SHOT.fixed_io()
                inventory.assert_not_called()
                self.assertFalse(os.path.exists(os.path.join(root, ds.HR_PROFILE.OPERATION_ID)))

    def test_installed_unresolved_scope_rejects_before_intent(self):
        with self.assembled() as (ds, root, recorder):
            from fixture_io import SyntheticFixedIO
            projection = SyntheticFixedIO(root, ds).projection
            with patch.object(ds.HR_REAL_OS, 'require_activation', return_value={'hostId': 'fixture-host'}), patch.object(
                    ds.HR_REAL_OS, 'deployed_prerequisites', return_value={}), patch.object(
                    ds.HR_INVENTORY, 'fixed_installed_inventory', return_value={
                        'subjectPreimageSha256': projection['subjectPreimageSha256'],
                        'unresolvedSources': ['LE1_INSTALLED_ENTRY_AND_RESUMPTION_CLOSURE']}):
                io = ds.HR_ONE_SHOT.fixed_io()
                with self.assertRaisesRegex(Exception, 'SOURCE_CLOSURE_UNKNOWN'):
                    io.preflight(projection)
                self.assertFalse(os.path.exists(os.path.join(root, ds.HR_PROFILE.OPERATION_ID)))

    def test_actual_handler_connects_private_stop_then_retains_unknown(self):
        with self.assembled() as (ds, root, recorder):
            from fixture_io import SyntheticFixedIO
            projection = SyntheticFixedIO(root, ds).projection
            method = ds.HR_FINITE_STOP.FixedStop.stop
            cell = dict(zip(method.__code__.co_freevars, method.__closure__))['command']
            original = cell.cell_contents
            calls = []
            def command(route, verb, deadline):
                calls.append((route, verb))
                return 0 if verb == 'bootout' else 113
            cell.cell_contents = command
            times = iter((97, 98))
            try:
                with patch.object(ds.HR_REAL_OS, 'require_activation', return_value={'hostId': 'fixture-host'}), patch.object(
                        ds.HR_REAL_OS, 'deployed_prerequisites', return_value={}), patch.object(
                        ds.HR_INVENTORY, 'fixed_installed_inventory', return_value={'unresolvedSources': []}), patch.object(
                        ds.HR_PROJECTION, 'fixed_subject_projection', return_value=projection), patch.object(
                        ds.HR_FIXED_IO.FixedIO, 'preflight', return_value={}), patch.object(
                        ds.HR_FIXED_IO.FixedIO, 'wall_ms', side_effect=lambda: next(times)):
                    request = {'action': ds.HR_PROFILE.ACTION, 'operation_id': ds.HR_PROFILE.OPERATION_ID}
                    result = ds.handle(json.dumps(request).encode())[0]
                    self.assertEqual(result['error'], 'OLD_TREE_QUIESCENCE_NOT_CONNECTED')
                    self.assertEqual(result['disposition'], 'UNKNOWN')
                    held = ds.HR_ONE_SHOT._custody['fixed-DS-owner']
                    held['stopOwner'].check()
                    record, digest = ds.HR_STOP_RECEIPT.readback()
                    self.assertEqual(set(record), {'operationId', 'hostId', 'method', 'atWallMs'})
                    self.assertEqual(len(calls), 4)
                    with self.assertRaisesRegex(Exception, 'FIXED_IO_UNKNOWN'):
                        held['io'].inhibit_fixed_sources()
                    self.assertFalse(os.path.exists(os.path.join(root, ds.HR_PROFILE.OPERATION_ID, 'phase-launch-attempt.json')))
            finally:
                cell.cell_contents = original

    def test_window_replay_and_stale_intent_fail_closed(self):
        with self.assembled() as (ds, root, recorder):
            with patch.object(ds.HR_REAL_OS, 'require_activation', return_value={'hostId': 'fixture-host'}):
                io = ds.HR_ONE_SHOT.fixed_io()
                ds.HR_JOURNAL.seal_intent('a' * 64, 'b' * 64, 97)
                with patch.object(io, 'wall_ms', return_value=98):
                    fd, at = io.open_fixed_window()
                    try:
                        with self.assertRaisesRegex(Exception, 'WINDOW_NO_REPLAY'):
                            io.open_fixed_window()
                        self.assertEqual(at, 98)
                    finally:
                        os.close(fd)

    def test_window_before_intent_time_creates_no_window(self):
        with self.assembled() as (ds, root, recorder):
            with patch.object(ds.HR_REAL_OS, 'require_activation', return_value={'hostId': 'fixture-host'}):
                io = ds.HR_ONE_SHOT.fixed_io()
                ds.HR_JOURNAL.seal_intent('a' * 64, 'b' * 64, 97)
                with patch.object(io, 'wall_ms', return_value=97):
                    with self.assertRaisesRegex(Exception, 'WINDOW_TIME_UNKNOWN'):
                        io.open_fixed_window()
                self.assertIsNone(io._window)

    def test_wrong_private_owner_never_dispatches(self):
        with self.assembled() as (ds, root, recorder):
            with patch.object(ds.HR_REAL_OS, 'require_activation', return_value={'hostId': 'fixture-host'}):
                io = ds.HR_ONE_SHOT.fixed_io()
                with self.assertRaisesRegex(Exception, 'PRIVATE_OWNER_REQUIRED'):
                    io.attach_owned_stop(object())
                with self.assertRaisesRegex(Exception, 'PRIVATE_STOP_NO_REPLAY'):
                    io.inhibit_fixed_sources()


if __name__ == '__main__':
    unittest.main()
