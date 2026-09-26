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

    def assembled_event(self, loss=None, from_serve=False):
        import os
        import threading
        from types import SimpleNamespace
        from unittest.mock import patch
        from contextlib import ExitStack
        with self.fixture(owned=not from_serve) as (ds, io, payload, app, routes, calls), ExitStack() as stack:
            from fixture_io import SyntheticFixedIO
            os.chmod(app.parent, 0o755)  # Existing archive contract requires traversal on disposable evidence root.
            synthetic = SyntheticFixedIO(str(app.parent), ds)
            synthetic.at = 97 if from_serve else ds.HR_STOP_RECEIPT.readback()[0]['atWallMs']
            if not from_serve:
                io._intent, io._nonce = io._owner.intent_digest, 'n' * 32
            io._runtime_admission = {'syntheticOnly': True}
            owner, window = io._owner, io._window
            def protected(path):
                self.assertTrue(str(path).startswith(str(ds.STATE_ROOT) + '/'))
                descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
                try: return os.pread(descriptor, 65537, 0)
                finally: os.close(descriptor)
            stack.enter_context(patch.object(ds.HR_REAL_OS, 'protected_bytes', side_effect=protected))
            if not from_serve:
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
            route_cells = dict(zip(ds.HR_INVENTORY.route.__code__.co_freevars, ds.HR_INVENTORY.route.__closure__))
            old_app = route_cells['APP'].cell_contents
            route_cells['APP'].cell_contents = app
            stack.callback(setattr, route_cells['APP'], 'cell_contents', old_app)
            def preflight(projection):
                if from_serve:
                    for raw in payload['routes'].values(): ds.HR_INVENTORY.route(raw)
                return synthetic.preflight(projection)
            stack.enter_context(patch.object(io, 'preflight', side_effect=preflight))
            stack.enter_context(patch.object(io, 'wall_ms', side_effect=synthetic.wall_ms))
            stack.enter_context(patch.object(io, 'observed_entry_closure', side_effect=synthetic.observed_entry_closure))
            def quiesce():
                io._owner.check(); io._stop.observe()
                synthetic.at = max(synthetic.at, ds.HR_STOP_RECEIPT.readback()[0]['atWallMs'])
                return synthetic.quiesce_fixed_tree()
            stack.enter_context(patch.object(io, 'quiesce_fixed_tree', side_effect=quiesce))
            def custody(lock, fd, child):
                io._active()  # Preserve the actual FixedIO observation precondition in the OS double.
                io._owner.check(); io._stop.observe()
                self.assertEqual((lock, fd), (io._owner.canonical, io._window))
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
            if from_serve:
                ds.HR_BOOTSTRAP._state['attempted'] = False  # Fresh readonly daemon reattachment.
                manifest, sources = synthetic.observed_entry_closure()
                stack.enter_context(patch.object(ds.HR_REAL_OS, 'qualified_source_scope',
                    return_value={'entryManifest': manifest, 'sources': ['fixed-DS-owner'] + sources}))
                stack.enter_context(patch.object(ds.HR_REAL_OS, 'old_runtime_membership', return_value={123}))
                stack.enter_context(patch.object(ds.HR_ONE_SHOT, 'fixed_io', return_value=io))
                stack.enter_context(patch.object(ds.HR_BOOTSTRAP, 'INSTALLATION_EVENT_OPERATION', ds.HR_PROFILE.OPERATION_ID))
                stack.enter_context(patch.object(ds, 'AUTHORIZED_OWNER_UID', 505))
                stack.enter_context(patch.object(ds, 'SOCK_PATH', str(app.parent / 'fixture.sock')))
                selected = []
                if loss == 'crashintent':
                    original_seal = ds.HR_JOURNAL.seal_intent
                    def crash_after_intent(*args):
                        original_seal(*args)
                        raise OSError('disposable-after-intent-fsync')
                    stack.enter_context(patch.object(ds.HR_JOURNAL, 'seal_intent', side_effect=crash_after_intent))
                original_event = ds.HR_ONE_SHOT.run_installation_event
                def event(fd):
                    with patch.object(os, 'geteuid', return_value=os.getuid()):
                        selected.append(original_event(fd))
                    return selected[-1]
                stack.enter_context(patch.object(ds.HR_ONE_SHOT, 'run_installation_event', side_effect=event))
                original_socket = ds.socket.socket
                class NoListener:
                    def bind(self, path): raise RuntimeError('DISPOSABLE_LISTENER_STOP')
                def private_socket(*args, **kwargs):
                    if kwargs.get('fileno') is not None or len(args) >= 4 and isinstance(args[3], int):
                        # Only wraps an already-created local socketpair FD; no bind/connect/network.
                        return original_socket(*args, **kwargs)
                    return NoListener()
                stack.enter_context(patch.object(ds.socket, 'socket', side_effect=private_socket))
                if loss == 'badbase': (app / 'packages/keep.js').write_bytes(b'changed-baseline')
                with patch.object(os, 'geteuid', return_value=0):
                    with self.assertRaisesRegex(Exception, 'DISPOSABLE_LISTENER_STOP'):
                        ds.serve()
                self.assertEqual(len(selected), 1)
                result = selected[0]
                owner, window = io._owner, io._window
                def cleanup_event():
                    retained = ds.HR_ONE_SHOT._custody.pop('fixed-DS-owner', None)
                    if owner is not None and not owner.closed: owner.close()
                    if window is not None: os.close(window)
                    if retained is not None: os.close(retained['canonicalFd'])
                stack.callback(cleanup_event)
            else:
                result = ds.HR_ONE_SHOT.run_installation(io)
            for thread in threads: thread.join(timeout=1); self.assertFalse(thread.is_alive())
            self.assertEqual(errors, [])
            if loss == 'crashintent':
                import fcntl
                self.assertFalse(result['ok'])
                self.assertEqual(result['disposition'], 'UNKNOWN')
                retained = ds.HR_ONE_SHOT._custody['fixed-DS-owner']
                self.assertIs(retained['io'], io)
                self.assertIsNone(retained['stopOwner'])
                self.assertTrue(io._unknown)
                contender = os.open(app.parent / 'mutation.lock', os.O_RDWR)
                try:
                    with self.assertRaises(BlockingIOError): fcntl.flock(contender, fcntl.LOCK_EX | fcntl.LOCK_NB)
                finally: os.close(contender)
                self.assertEqual(calls, [])
                self.assertEqual((app / 'scripts/production-runtime.mjs').read_bytes(), b'old-runtime')
                return
            if loss == 'badbase':
                self.assertFalse(result['ok'], result)
                self.assertEqual(result['disposition'], 'PRECHECK_REJECTED')
                self.assertIsNone(io._owner)
                self.assertIsNone(io._window)
                self.assertEqual(calls, [])
                self.assertEqual((app / 'scripts/production-runtime.mjs').read_bytes(), b'old-runtime')
                self.assertFalse((app.parent / ds.HR_JOURNAL.DIRECTORY / 'intent.json').exists())
                return
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
                if not from_serve: ds.HR_ONE_SHOT._custody.pop('fixed-DS-owner', None)
                return
            self.assertTrue(result['ok'], result)
            self.assertEqual(ds.HR_LIFECYCLE.snapshot()['disposition'], 'CLOSED')
            self.assertEqual(synthetic.effects.count('launch'), 1)
            self.assertTrue(owner.closed)
            with self.assertRaisesRegex(Exception, 'PRIVATE_INSTALLATION_NO_REPLAY'):
                ds.HR_ONE_SHOT.run_installation(io)
            self.assertNotIn('fixed-DS-owner', ds.HR_ONE_SHOT._custody)
            self.assertEqual(synthetic.effects.count('launch'), 1)
            self.assertTrue(all(verb in ('bootout', 'print') for _, verb in calls))
            self.assertEqual(sum(verb == 'bootout' for _, verb in calls), 2 if from_serve else 0)

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

    def test_actual_serve_initialization_selects_fixed_private_event_under_same_lock(self):
        import os
        from unittest.mock import patch
        with self.fixture(owned=False) as (ds, io, payload, app, routes, calls):
            ds.HR_BOOTSTRAP._state['attempted'] = False  # Fresh daemon's readonly committed reattachment.
            selected = []
            def event(fd):
                meta = os.fstat(fd)
                selected.append((meta.st_dev, meta.st_ino))
                return {'ok': False, 'disposition': 'UNKNOWN'}
            with patch.object(os, 'geteuid', return_value=0), patch.object(ds, 'AUTHORIZED_OWNER_UID', 505), patch.object(ds, 'SOCK_PATH', str(app.parent / 'fixture.sock')), patch.object(
                    ds.HR_BOOTSTRAP, 'INSTALLATION_EVENT_OPERATION', ds.HR_PROFILE.OPERATION_ID, create=True), patch.object(
                    ds.HR_ONE_SHOT, 'run_installation_event', side_effect=event, create=True), patch.object(
                    ds.socket, 'socket', side_effect=RuntimeError('DISPOSABLE_LISTENER_STOP')):
                with self.assertRaisesRegex(Exception, 'DISPOSABLE_LISTENER_STOP'):
                    ds.serve()
            self.assertEqual(len(selected), 1, 'actual serve/bootstrap did not select private installation event')
            self.assertEqual(calls, [])

    def test_actual_serve_bootstrap_owned_promoter_challenge_terminal_join(self):
        self.assembled_event(from_serve=True)

    def test_actual_serve_bootstrap_post_handoff_unknown_retains_owned_lock(self):
        self.assembled_event('unknown', from_serve=True)

    def test_actual_serve_bootstrap_changed_preimage_is_zero_installation_effect(self):
        self.assembled_event('badbase', from_serve=True)

    def test_fixed_event_selector_none_or_wrong_cannot_dispatch(self):
        import os
        from unittest.mock import patch
        for selector in (None, 'foreign'):
            with self.subTest(selector=selector), self.fixture(owned=False) as (ds, io, payload, app, routes, calls):
                ds.HR_BOOTSTRAP._state['attempted'] = False
                with patch.object(os, 'geteuid', return_value=0), patch.object(ds, 'AUTHORIZED_OWNER_UID', 505), patch.object(
                        ds, 'SOCK_PATH', str(app.parent / 'fixture.sock')), patch.object(
                        ds.HR_BOOTSTRAP, 'INSTALLATION_EVENT_OPERATION', selector), patch.object(
                        ds.HR_ONE_SHOT, 'run_installation_event', side_effect=AssertionError('EVENT_MUST_NOT_DISPATCH')), patch.object(
                        ds.socket, 'socket', side_effect=RuntimeError('DISPOSABLE_LISTENER_STOP')):
                    reason = 'DISPOSABLE_LISTENER_STOP' if selector is None else 'INSTALLATION_EVENT_UNKNOWN'
                    with self.assertRaisesRegex(Exception, reason): ds.serve()
                self.assertEqual(calls, [])
                self.assertEqual((app / 'scripts/production-runtime.mjs').read_bytes(), b'old-runtime')

    def test_promoted_inventory_route_exact_representations_and_unknown_flags(self):
        from unittest.mock import patch
        with self.fixture(owned=False) as (ds, io, payload, app, routes, calls):
            cells = dict(zip(ds.HR_INVENTORY.route.__code__.co_freevars, ds.HR_INVENTORY.route.__closure__))
            previous = cells['APP'].cell_contents
            cells['APP'].cell_contents = app
            try:
                raw = next(iter(payload['routes'].values()))
                ds.HR_INVENTORY.route(raw)
                rooted = raw.replace(b'</array>', ('<string>--root</string><string>' + str(cells['ROOT'].cell_contents) + '</string></array>').encode())
                ds.HR_INVENTORY.route(rooted)
                for changed in (raw.replace(b'hr-s256-r2-gated-runtime', b'ungated'),
                    raw.replace(b'</array>', b'<string>--foreign</string></array>'),
                    rooted.replace(str(cells['ROOT'].cell_contents).encode(), b'/foreign/root')):
                    with self.assertRaisesRegex(Exception, 'INVENTORY_ROUTE_UNKNOWN'): ds.HR_INVENTORY.route(changed)
            finally: cells['APP'].cell_contents = previous

    def test_actual_serve_prefix_intent_write_then_failure_retains_exact_canonical_fd(self):
        self.assembled_event('crashintent', from_serve=True)
