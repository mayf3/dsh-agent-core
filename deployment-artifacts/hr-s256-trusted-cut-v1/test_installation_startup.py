"""Private installation event composition, disposable only; no process dispatch."""
import unittest
import test_maintenance as maintenance_tests


class InstallationStartupTest(unittest.TestCase):
    fixture = maintenance_tests.MaintenanceTest.fixture
    def test_private_fixed_installation_event_is_inert_before_any_io(self):
        with self.fixture() as (ds, io, payload, app, routes, calls):
            cells = dict(zip(ds.HR_MAINTENANCE._payload.__code__.co_freevars,
                             ds.HR_MAINTENANCE._payload.__closure__))
            cell = cells['TRUSTED_INSTALLATION']
            original = cell.cell_contents
            try:
                cell.cell_contents = None
                self.assertIsNone(ds.HR_ONE_SHOT.run_installation(None))
                self.assertFalse(ds.HR_MAINTENANCE._state['attempted'])
                self.assertEqual(calls, [])
            finally:
                cell.cell_contents = original

    def assembled_event(self, loss=None):
        import os
        import threading
        from types import SimpleNamespace
        from unittest.mock import patch
        from contextlib import ExitStack
        with self.fixture() as (ds, io, payload, app, routes, calls), ExitStack() as stack:
            from fixture_io import SyntheticFixedIO
            os.chmod(app.parent, 0o755)  # Existing archive contract requires traversal on disposable evidence root.
            synthetic = SyntheticFixedIO(str(app.parent), ds)
            synthetic.at = ds.HR_STOP_RECEIPT.readback()[0]['atWallMs']
            io._intent, io._nonce = io._owner.intent_digest, 'n' * 32
            io._runtime_admission = {'syntheticOnly': True}
            owner, window = io._owner, io._window
            def protected(path):
                self.assertTrue(str(path).startswith(str(ds.STATE_ROOT) + '/'))
                descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
                try: return os.pread(descriptor, 65537, 0)
                finally: os.close(descriptor)
            stack.enter_context(patch.object(ds.HR_REAL_OS, 'protected_bytes', side_effect=protected))
            io._seal_cut('exclusive-window', {'operationId': ds.HR_PROFILE.OPERATION_ID,
                'hostId': 'fixture-host', 'startupNonce': io._nonce,
                'windowLockPath': str(app.parent / ds.HR_JOURNAL.DIRECTORY / 'window.lock'),
                'windowOpenedAtWallMs': owner.opened_at})
            io._seal_cut('launch-sources-inhibited', {'operationId': ds.HR_PROFILE.OPERATION_ID,
                'hostId': 'fixture-host', 'startupNonce': io._nonce,
                'atWallMs': synthetic.wall_ms(), 'complete': True})
            stack.enter_context(patch.object(ds.HR_MAINTENANCE, 'TRUSTED_INSTALLATION', payload))
            stack.enter_context(patch.object(ds.HR_PROJECTION, 'fixed_subject_projection', return_value=synthetic.projection))
            stack.enter_context(patch.object(ds.HR_COLLECTOR, 'collect_whole_host', side_effect=synthetic.collect))
            stack.enter_context(patch.object(io, 'preflight', side_effect=synthetic.preflight))
            stack.enter_context(patch.object(io, 'wall_ms', side_effect=synthetic.wall_ms))
            stack.enter_context(patch.object(io, 'observed_entry_closure', side_effect=synthetic.observed_entry_closure))
            def quiesce():
                owner.check(); io._stop.observe()
                return synthetic.quiesce_fixed_tree()
            stack.enter_context(patch.object(io, 'quiesce_fixed_tree', side_effect=quiesce))
            def custody(lock, fd, child):
                io._active()  # Preserve the actual FixedIO observation precondition in the OS double.
                owner.check(); io._stop.observe()
                self.assertEqual((lock, fd), (owner.canonical, window))
                result = synthetic.observe_custody(lock, fd, child)
                result['launchSourcesInhibitedReceiptSha256'] = io._receipts['launch-sources-inhibited']
                return result
            stack.enter_context(patch.object(io, 'observe_custody', side_effect=custody))
            def bundle(*args):
                value = __import__('json').loads(synthetic.final_bundle_bytes(*args))
                value['recoveryCutover']['launchSourcesInhibitedReceiptSha256'] = io._receipts['launch-sources-inhibited']
                stopped, digest = ds.HR_STOP_RECEIPT.readback()
                value['controlledStop'] = {'method': stopped['method'], 'receiptSha256': digest,
                                          'atWallMs': stopped['atWallMs']}
                value['custody']['evidenceDir'] = str(app.parent / ds.HR_JOURNAL.DIRECTORY)
                return synthetic.commitment_fixtures.bytes_of(value)
            stack.enter_context(patch.object(io, 'final_bundle_bytes', side_effect=bundle))
            threads, errors = [], []
            child = SimpleNamespace(pid=12345, poll=lambda: None)
            def launch(challenge, fd, receipt):
                # Local thread and dup descriptors only; NEVER SyntheticFixedIO.launch_fixed/Popen.
                synthetic.effects.append('launch')
                challenge_copy, fd_copy = os.dup(challenge), os.dup(fd)
                def peer():
                    try:
                        import warnings
                        with warnings.catch_warnings():
                            warnings.simplefilter('ignore', ResourceWarning)
                            ds.HR_HANDOFF.child_prove(challenge_copy, fd_copy, receipt)
                    except BaseException as exc: errors.append(exc)
                    finally:
                        # child_prove's local socket owns/closes challenge_copy at return.
                        try: os.close(fd_copy)
                        except BaseException as exc: errors.append(exc)
                thread = threading.Thread(target=peer); threads.append(thread); thread.start()
                io._child, io._child_identity, io._launched = child, {'pid': child.pid, 'identitySha256': '1' * 64}, True
                return child
            stack.enter_context(patch.object(io, 'launch_fixed', side_effect=launch))
            stack.enter_context(patch.object(io, 'attach_authenticated_handoff'))
            stack.enter_context(patch.object(io, 'startup_observation', return_value={
                'launchAuthorizationReceiptSha256': 'unused', 'consumingBinarySha256': 'b' * 64,
                'challengeReceiptSha256': '4' * 64}))
            def startup(observed, receipt):
                return {'launchAuthorizationReceiptSha256': receipt, 'consumingBinarySha256': 'b' * 64,
                        'challengeReceiptSha256': '4' * 64}
            io.startup_observation.side_effect = startup
            stack.enter_context(patch.object(io, 'exact_consumption_readback', side_effect=synthetic.exact_consumption_readback))
            stack.enter_context(patch.object(io, 'verified_disposition', side_effect=synthetic.verified_disposition))
            stack.enter_context(patch.object(io, 'release_verified', side_effect=synthetic.release_verified))
            if loss is not None:
                original_handoff = ds.HR_MAINTENANCE.handoff_waiting
                def fail_after_readback(value):
                    original_handoff(value)
                    if loss == 'unknown': value._unknown = True
                    if loss == 'inhibition': value._stop._unknown = True
                    if loss == 'deadline':
                        from types import SimpleNamespace
                        cells = dict(zip(ds.HR_ONE_SHOT._run_fixed.__code__.co_freevars,
                                         ds.HR_ONE_SHOT._run_fixed.__closure__))
                        clock = cells['time']; previous = clock.cell_contents
                        clock.cell_contents = SimpleNamespace(monotonic=lambda: io._operation_deadline + 1)
                        stack.callback(setattr, clock, 'cell_contents', previous)
                stack.enter_context(patch.object(ds.HR_MAINTENANCE, 'handoff_waiting', side_effect=fail_after_readback))
            result = ds.HR_ONE_SHOT.run_installation(io)
            for thread in threads: thread.join(timeout=1); self.assertFalse(thread.is_alive())
            self.assertEqual(errors, [])
            if loss is not None:
                self.assertFalse(result['ok'], result)
                self.assertEqual(result['disposition'], 'UNKNOWN')
                self.assertEqual(synthetic.effects.count('launch'), 0)
                self.assertIsNone(io._child)
                self.assertIs(io._owner, owner)
                self.assertFalse(owner.closed)
                self.assertTrue(io._unknown)
                repeat = ds.HR_ONE_SHOT.run_installation(io)
                self.assertFalse(repeat['ok'])
                self.assertEqual(synthetic.effects.count('launch'), 0)
                ds.HR_ONE_SHOT._custody.pop('fixed-DS-owner', None)
                return
            self.assertTrue(result['ok'], result)
            self.assertEqual(ds.HR_LIFECYCLE.snapshot()['disposition'], 'CLOSED')
            self.assertEqual(synthetic.effects.count('launch'), 1)
            self.assertTrue(owner.closed)
            repeat = ds.HR_ONE_SHOT.run_installation(io)
            self.assertFalse(repeat['ok'])
            self.assertEqual(synthetic.effects.count('launch'), 1)
            self.assertTrue(all(verb == 'print' for _, verb in calls))

    def test_descriptorless_or_foreign_installation_event_rejects_before_promotion(self):
        from unittest.mock import patch
        with self.fixture() as (ds, io, payload, app, routes, calls):
            with patch.object(ds.HR_MAINTENANCE, 'TRUSTED_INSTALLATION', payload):
                for foreign in (None, object()):
                    with self.assertRaisesRegex(Exception, 'PRIVATE_INSTALLATION_OWNER_REQUIRED'):
                        ds.HR_ONE_SHOT.run_installation(foreign)
                self.assertFalse(ds.HR_MAINTENANCE._state['attempted'])
                self.assertEqual(calls, [])

    def test_existing_custody_unknown_stale_intent_or_missing_nonce_never_promotes_or_launches(self):
        from unittest.mock import patch
        for variant in ('deadline', 'unknown', 'stale-intent', 'nonce', 'released-window', 'inhibition'):
            with self.subTest(variant=variant), self.fixture() as (ds, io, payload, app, routes, calls):
                io._intent, io._nonce = io._owner.intent_digest, 'n' * 32
                owner, descriptors = io._owner, (io._owner.canonical, io._owner.canonical_dup,
                                                io._owner.window, io._owner.window_dup)
                if variant == 'deadline': io._operation_deadline = 0
                if variant == 'unknown': io._unknown = True
                if variant == 'stale-intent': io._intent = '0' * 64
                if variant == 'nonce': io._nonce = None
                if variant == 'released-window':
                    import fcntl
                    fcntl.flock(io._window, fcntl.LOCK_UN)  # Disposable owned FD only.
                if variant == 'inhibition': io._stop._unknown = True
                with patch.object(ds.HR_MAINTENANCE, 'TRUSTED_INSTALLATION', payload):
                    result = ds.HR_ONE_SHOT.run_installation(io)
                    self.assertFalse(result['ok'], result)
                    self.assertEqual(result['disposition'], 'UNKNOWN')
                    self.assertIsNone(io._child)
                    self.assertIs(io._owner, owner)
                    self.assertFalse(owner.closed)
                    self.assertEqual((owner.canonical, owner.canonical_dup, owner.window, owner.window_dup), descriptors)
                    self.assertEqual((app / 'scripts/production-runtime.mjs').read_bytes(), b'old-runtime')
                    self.assertFalse((app / 'packages/gated.mjs').exists())
                    retry = ds.HR_ONE_SHOT.run_installation(io)
                    self.assertFalse(retry['ok'])
                    self.assertIsNone(io._child)
                ds.HR_ONE_SHOT._custody.pop('fixed-DS-owner', None)  # Fixture cleanup retains originals for owner teardown.

    def test_owned_installation_reaches_existing_authenticated_one_launch_terminal(self):
        self.assembled_event()

    def test_post_installation_handoff_unknown_cannot_launch(self):
        self.assembled_event('unknown')

    def test_post_installation_handoff_inhibition_loss_cannot_launch(self):
        self.assembled_event('inhibition')

    def test_original_operation_deadline_after_handoff_cannot_launch(self):
        self.assembled_event('deadline')
