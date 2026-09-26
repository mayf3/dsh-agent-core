"""Fixed IO connection tests; all production/process boundaries denied."""
from contextlib import contextmanager
import os
import json
import tempfile
import subprocess
import unittest
from unittest.mock import patch

from process_confinement import confine_processes


def assembled_fixture_root():
    from pathlib import Path
    return str(Path(__file__).resolve().parents[3])


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

    def test_original_startup_deadline_bounds_readback_even_after_notice(self):
        import time
        from types import SimpleNamespace
        for crossing in (False, True):
            with self.subTest(crossing=crossing), self.assembled() as (ds, root, recorder):
                with patch.object(ds.HR_REAL_OS, 'require_activation', return_value={'hostId': 'fixture-host'}):
                    io = ds.HR_ONE_SHOT.fixed_io()
                    child = SimpleNamespace(poll=lambda: None)
                    io._child = child
                    io._child_identity = {'pid': 789, 'identitySha256': 'b' * 64}
                    io._owner = SimpleNamespace(check=lambda: None)
                    io._startup_deadline = 10
                    io._startup_done.set()
                    expected = {'settlement': 'observed-disposable', 'storeReadbackReceiptSha256': 'a' * 64}
                    with patch.object(time, 'monotonic', side_effect=[9, 11] if crossing else [11]):
                        with patch.object(ds.HR_REAL_OS, 'fixed_settlement_readback', return_value=expected) as readback:
                            with self.assertRaisesRegex(Exception, 'CONSUMPTION_STARTUP_UNAVAILABLE'):
                                io.exact_consumption_readback(child)
                            self.assertEqual(readback.call_count, 1 if crossing else 0)
                    self.assertTrue(io._unknown)
                    self.assertIs(io._child, child)
                    self.assertEqual(io._child_identity['pid'], 789)
                    with patch.object(ds.HR_REAL_OS, 'fixed_settlement_readback') as retry:
                        with self.assertRaisesRegex(Exception, 'FIXED_IO_UNKNOWN'):
                            io.exact_consumption_readback(child)
                        retry.assert_not_called()

    def test_actual_factory_has_fixed_window_and_stop_connection(self):
        with self.assembled() as (ds, root, recorder):
            with patch.object(ds.HR_REAL_OS, 'require_activation', return_value={'hostId': 'fixture-host'}):
                io = ds.HR_ONE_SHOT.fixed_io()
                self.assertTrue(callable(io.open_fixed_window))
                self.assertTrue(callable(io.quiesce_fixed_tree))

    def test_authenticated_readonly_authorization_projects_actual_journal(self):
        with self.assembled() as (ds, root, recorder):
            import importlib.util
            from fixture_io import load
            auth = load('test_commitment').authorization()
            ds.HR_JOURNAL.seal_intent(auth['startupNonce'], auth['subjectPreimageSha256'], 97)
            digest = ds.HR_JOURNAL.seal_launch_authorization(auth)
            path = os.path.join(root, ds.HR_PROFILE.OPERATION_ID, 'launch-authorization.json')
            spec = importlib.util.spec_from_file_location('startup_proof_fixture',
                os.path.join(assembled_fixture_root(), 'packages/production-runtime/src/native-arm64/hr-s256-r2-child-proof.py'))
            helper = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(helper)
            fd = os.open(path, os.O_RDONLY)
            try:
                startup = helper.authorization_projection(fd, digest,
                    {'nonce': auth['startupNonce']}, trusted_uid=os.getuid())
                self.assertEqual(startup, {'hostId': auth['hostId'],
                    'startupNonce': auth['startupNonce'], 'consumingBinarySha256': auth['consumingBinarySha256'],
                    'recoveryPlanStopsRuntime': True})
            finally:
                os.close(fd)

    def test_actual_adapter_supplies_remaining_fixed_terminal_methods(self):
        with self.assembled() as (ds, root, recorder):
            with patch.object(ds.HR_REAL_OS, 'require_activation', return_value={'hostId': 'fixture-host'}):
                io = ds.HR_ONE_SHOT.fixed_io()
                for name in ('observe_custody', 'observed_entry_closure', 'final_bundle_bytes',
                             'launch_fixed', 'startup_observation', 'exact_consumption_readback',
                             'verified_disposition', 'release_verified'):
                    self.assertTrue(callable(getattr(io, name)), name)

    def test_actual_membership_rejects_unrelated_uid_resident_without_dispatch(self):
        with self.assembled() as (ds, root, recorder):
            calls = []
            def observed(command):
                calls.append(command)
                if command == ['/bin/launchctl', 'print', 'system/ai.agent-core.runtime']:
                    return b'\tpid = 123\n'
                self.assertEqual(command, ds.HR_COLLECTOR.PS_COMMAND)
                return b'123 1 505 /fixture/runtime\n124 123 505 /fixture/child\n456 1 505 /fixture/manual\n'
            method = ds.HR_REAL_OS.old_runtime_membership
            cell = dict(zip(method.__code__.co_freevars, method.__closure__))['require_activation']
            prior = cell.cell_contents
            cell.cell_contents = lambda: {'hostId': 'fixture-host'}
            try:
                with patch.object(ds.HR_COLLECTOR, 'command_output', side_effect=observed):
                    with self.assertRaisesRegex(Exception, 'UNOWNED_RUNTIME_UID_RESIDENT'):
                        method()
            finally:
                cell.cell_contents = prior
            self.assertEqual(len(calls), 2)
            self.assertEqual(recorder.calls, [])

    def test_preflight_connects_exact_observed_membership_and_fixed_inventory(self):
        with self.assembled() as (ds, root, recorder):
            from fixture_io import SyntheticFixedIO
            projection = SyntheticFixedIO(root, ds).projection
            inventory = {'subjectPreimageSha256': projection['subjectPreimageSha256'],
                'unresolvedSources': [], 'holderPaths': ['/fixture/workspace']}
            package = {'hostId': 'fixture-host', 'consumingBinarySha256': 'b' * 64}
            with patch.object(ds.HR_REAL_OS, 'require_activation', return_value=package), patch.object(
                    ds.HR_REAL_OS, 'deployed_prerequisites', return_value={}), patch.object(
                    ds.HR_INVENTORY, 'fixed_installed_inventory', return_value=inventory), patch.object(
                    ds.HR_REAL_OS, 'old_runtime_membership', return_value={123, 124}):
                io = ds.HR_ONE_SHOT.fixed_io()
                self.assertEqual(io.preflight(projection), {'hostId': 'fixture-host',
                    'binarySha256': 'b' * 64, 'oldPids': {123, 124},
                    'holderPaths': ['/fixture/workspace']})
                self.assertFalse(os.path.exists(os.path.join(root, ds.HR_PROFILE.OPERATION_ID)))

    def test_authorization_projection_rejects_other_subject_and_writable_capability(self):
        with self.assembled() as (ds, root, recorder):
            import importlib.util
            import hashlib
            from fixture_io import load
            auth = load('test_commitment').authorization()
            spec = importlib.util.spec_from_file_location('startup_proof_negative',
                os.path.join(assembled_fixture_root(), 'packages/production-runtime/src/native-arm64/hr-s256-r2-child-proof.py'))
            helper = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(helper)
            auth['subject']['agentId'] = 'other-agent'
            receipt = {'version': 1, 'operationId': ds.HR_PROFILE.OPERATION_ID,
                'phase': 'LAUNCH_AUTHORIZED', 'intentSha256': 'a' * 64, 'authorization': auth}
            raw = json.dumps(receipt, sort_keys=True, separators=(',', ':')).encode()
            path = os.path.join(root, 'wrong-subject.json')
            with open(path, 'wb') as output:
                output.write(raw)
            os.chmod(path, 0o600)
            for flags, reason in ((os.O_RDONLY, 'AUTHORIZATION_SUBJECT_INVALID'),
                                  (os.O_RDWR, 'AUTHORIZATION_FD_CUSTODY')):
                descriptor = os.open(path, flags)
                try:
                    with self.assertRaisesRegex(helper.Rejected, reason):
                        helper.authorization_projection(descriptor, hashlib.sha256(raw).hexdigest(),
                            {'nonce': auth['startupNonce']}, trusted_uid=os.getuid())
                finally:
                    os.close(descriptor)

    def test_activation_rejects_before_inventory_or_window_io(self):
        with self.assembled() as (ds, root, recorder):
            with patch.object(ds.HR_INVENTORY, 'fixed_installed_inventory') as inventory:
                with self.assertRaisesRegex(Exception, 'PROFILE_NOT_BOOTSTRAPPED'):
                    ds.HR_ONE_SHOT.fixed_io()
                inventory.assert_not_called()
                self.assertFalse(os.path.exists(os.path.join(root, ds.HR_PROFILE.OPERATION_ID)))

    def test_actual_uninstalled_action_rejects_before_canonical_os_boundary(self):
        with self.assembled() as (ds, root, recorder):
            request = {'action': ds.HR_PROFILE.ACTION, 'operation_id': ds.HR_PROFILE.OPERATION_ID}
            with patch.object(ds, 'TEST_MODE', False), patch.object(ds, 'mutation_lock',
                    side_effect=AssertionError('CANONICAL_OS_BEFORE_ACTIVATION')) as lock:
                with self.assertRaisesRegex(Exception, 'PROFILE_NOT_BOOTSTRAPPED'):
                    ds.hr_s256_action(request)
                lock.assert_not_called()

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
            def disposable_receipt(path):
                self.assertEqual(os.path.commonpath([str(path), root]), root)
                with open(path, 'rb') as source:
                    return source.read(65537)
            try:
                with patch.object(ds.HR_REAL_OS, 'require_activation', return_value={'hostId': 'fixture-host'}), patch.object(
                        ds.HR_REAL_OS, 'deployed_prerequisites', return_value={}), patch.object(
                        ds.HR_INVENTORY, 'fixed_installed_inventory', return_value={'unresolvedSources': []}), patch.object(
                        ds.HR_PROJECTION, 'fixed_subject_projection', return_value=projection), patch.object(
                        ds.HR_FIXED_IO.FixedIO, 'preflight', return_value={}), patch.object(
                        ds.HR_REAL_OS, 'protected_bytes', side_effect=disposable_receipt), patch.object(
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

    def test_actual_handler_terminal_path_with_disposable_os_boundaries(self):
        from contextlib import ExitStack
        import hashlib
        import importlib.util
        import threading
        import time
        from types import SimpleNamespace
        for variant in ('closed', 'source_lost', 'window_lost', 'readback_wrong'):
            with self.subTest(variant=variant), self.assembled() as (ds, root, recorder), ExitStack() as stack:
                os.chmod(root, 0o755)
                from fixture_io import SyntheticFixedIO
                seed = SyntheticFixedIO(root, ds)
                projection = {**seed.projection,
                    'runtimeEpoch': '961534a5-8c94-487d-8e55-d324a54e821a'}
                manifest, source_ids = seed.observed_entry_closure()
                scope = {'entryManifest': manifest, 'sources': ['fixed-DS-owner', *source_ids]}
                sources = {'explicit-disposable-control-source': 'f' * 64}
                inventory = {'subjectPreimageSha256': projection['subjectPreimageSha256'],
                    'unresolvedSources': [], 'holderPaths': ['/fixture/workspace'], 'sources': sources}
                package = {'operationId': ds.HR_PROFILE.OPERATION_ID, 'hostId': 'fixture-host',
                    'consumingBinarySha256': 'b' * 64, 'floorProvenReceiptSha256': 'c' * 64,
                    'validatorInstalledReceiptSha256': 'd' * 64,
                    'rollbackCaptureOperationId': 'disposable-admitted-capture', 'expectedRegistrySha256': 'e' * 64}
                state = {'stopped': False, 'launched': False, 'clock': 97, 'commands': [], 'children': []}
                deployment = os.path.join(root, 'deployment')
                os.mkdir(deployment, 0o700)
                proofs = {'floor-proven.json': {'status': 'ROUTER_RESTART_SAFETY=PROVEN',
                    'floorCommit': '2097e4f9', 'deployedBinarySha256': 'b' * 64, 'provedAtWallMs': 1000},
                    'validator-installed.json': {'evidenceKind': 'restart_quiescence_proven',
                    'deployedBinarySha256': 'b' * 64, 'installedAtWallMs': 2000}}
                for name, value in proofs.items():
                    raw = json.dumps(value).encode()
                    with open(os.path.join(deployment, name), 'wb') as file:
                        file.write(raw)
                    key = 'floorProvenReceiptSha256' if name.startswith('floor-') else 'validatorInstalledReceiptSha256'
                    package[key] = hashlib.sha256(raw).hexdigest()
                store = os.path.join(root, 'validator-double.json')
                with open(store, 'w') as file:
                    file.write('{"pending":true}')
                def clock():
                    state['clock'] += 1
                    return state['clock'] / 1000
                def private_bytes(path, *args, **kwargs):
                    self.assertEqual(os.path.commonpath([str(path), root]), root)
                    with open(path, 'rb') as file:
                        return file.read(65537)
                def observed_command(argv):
                    state['commands'].append(tuple(argv))
                    if argv == ['/bin/launchctl', 'print', 'system/ai.agent-core.runtime']:
                        return b'\tpid = 123\n'
                    if argv == ds.HR_COLLECTOR.LSOF_COMMAND:
                        return b'p456\0f1\0n/fixture/other\0'
                    self.assertEqual(argv, ds.HR_COLLECTOR.PS_COMMAND)
                    if state['launched']:
                        return b'456 1 0 /fixture/root\n789 456 505 /fixture/owned-runtime\n'
                    return (b'456 1 0 /fixture/root\n' if state['stopped'] else
                            b'123 1 505 /fixture/runtime\n124 123 505 /fixture/old-child\n')
                def stop_command(route, verb, deadline):
                    self.assertIn(route, ds.HR_FINITE_STOP.ROUTES)
                    self.assertIn(verb, ('bootout', 'print'))
                    state['commands'].append((route, verb))
                    if verb == 'bootout':
                        state['stopped'] = True
                        return 0
                    return 113
                def cell_replace(method, name, replacement):
                    cell = dict(zip(method.__code__.co_freevars, method.__closure__))[name]
                    previous = cell.cell_contents
                    cell.cell_contents = replacement
                    stack.callback(setattr, cell, 'cell_contents', previous)
                cell_replace(ds.HR_REAL_OS.old_runtime_membership, 'require_activation', lambda: package)
                cell_replace(ds.HR_REAL_OS.fixed_settlement_readback, 'protected_bytes', private_bytes)
                cell_replace(ds.HR_REAL_OS.installed_settlement_projection, 'bounded_validator_output',
                             lambda script, fd: os.pread(fd, os.fstat(fd).st_size, 0))
                cell_replace(ds.HR_FINITE_STOP.FixedStop.stop, 'command', stop_command)
                cell_replace(ds.HR_COLLECTOR.collect_whole_host, 'command_output', observed_command)
                cell_replace(ds.HR_COLLECTOR.collect_whole_host, 'os',
                             SimpleNamespace(geteuid=lambda: 0, path=os.path))
                def current_sources():
                    return {'changed': '0' * 64} if variant == 'source_lost' and state['stopped'] else sources
                for target, name, replacement in (
                    (ds.HR_REAL_OS, 'require_activation', lambda: package),
                    (ds.HR_REAL_OS, 'deployed_prerequisites', lambda *args: {}),
                    (ds.HR_REAL_OS, 'qualified_source_scope', lambda: scope),
                    (ds.HR_REAL_OS, 'protected_bytes', private_bytes),
                    (ds.HR_INVENTORY, 'fixed_installed_inventory', lambda: inventory),
                    (ds.HR_INVENTORY, 'fixed_source_identities', current_sources),
                    (ds.HR_PROJECTION, 'fixed_subject_projection', lambda: projection),
                    (ds.HR_COLLECTOR, 'command_output', observed_command),
                    (ds.HR_PROJECTION, 'pinned_validator_sources', lambda: {'fixture-validator': 'b' * 64}),
                    (ds.HR_PROJECTION, 'opened_fixed_store', lambda: (os.open(store, os.O_RDONLY), os.stat(store))),
                    (ds.HR_PROJECTION, 'digest_fd', lambda fd, size: hashlib.sha256(os.pread(fd, size, 0)).hexdigest())):
                    stack.enter_context(patch.object(target, name, side_effect=replacement))
                stack.enter_context(patch.object(ds.HR_REAL_OS, 'DEPLOYMENT_DIR', ds.HR_REAL_OS.Path(deployment)))
                stack.enter_context(patch.object(time, 'time', side_effect=clock))
                stack.enter_context(patch.object(time, 'time_ns', side_effect=lambda: int(clock() * 1_000_000_000)))
                owned = []
                def factory():
                    io = ds.HR_FIXED_IO.FixedIO()
                    owned.append(io)
                    return io
                stack.enter_context(patch.object(ds.HR_ONE_SHOT, 'fixed_io', side_effect=factory))
                original_collect = ds.HR_COLLECTOR.collect_whole_host
                def census(*args):
                    value = original_collect(*args)
                    if variant == 'window_lost':
                        import fcntl
                        fcntl.flock(owned[0]._window, fcntl.LOCK_UN)
                    return value
                stack.enter_context(patch.object(ds.HR_COLLECTOR, 'collect_whole_host', side_effect=census))
                def spawn(io, argv, descriptors):
                    self.assertEqual(argv[:2], [ds.HR_REAL_OS.NODE, str(ds.HR_REAL_OS.APP_ROOT /
                        'packages/production-runtime/src/native-arm64/hr-s256-r2-gated-runtime.mjs')])
                    table = json.loads(argv[argv.index('--hr-r2-receipt-fds') + 1])
                    inherited = {descriptor: os.dup(descriptor) for descriptor in descriptors}
                    auth_fd = inherited[table[3]]
                    channel = inherited[int(argv[argv.index('--hr-r2-challenge-fd') + 1])]
                    window = inherited[int(argv[argv.index('--hr-r2-window-fd') + 1])]
                    receipt = argv[argv.index('--hr-r2-receipt-sha256') + 1]
                    self.assertEqual(len(set(descriptors)), len(descriptors))
                    child = SimpleNamespace(pid=789, poll=lambda: None, error=None, inherited=inherited)
                    state['children'].append(child)
                    state['launched'] = True
                    def startup():
                        try:
                            spec = importlib.util.spec_from_file_location('owned_child_fixture', os.path.join(
                                assembled_fixture_root(), 'packages/production-runtime/src/native-arm64/hr-s256-r2-child-proof.py'))
                            helper = importlib.util.module_from_spec(spec)
                            spec.loader.exec_module(helper)
                            approved = helper.prove(os.dup(channel), window, receipt, trusted_uid=os.getuid())
                            metadata = helper.authorization_projection(auth_fd, receipt, approved, trusted_uid=os.getuid())
                            subject = json.loads(os.pread(auth_fd, 65536, 0))['authorization']['subject']
                            settlement = {'reconciliationHandle': ds.HR_PROFILE.HANDLE, 'queryState': 'settled',
                                'fenceState': 'active' if variant == 'readback_wrong' else 'cleared',
                                'initialOutcome': 'outcome_unknown', 'terminationEvidence': 'restart_quiescence_proven'}
                            with open(store, 'w') as file:
                                json.dump({'subject': subject, 'settlement': settlement}, file)
                            notice = {'operationId': ds.HR_PROFILE.OPERATION_ID, 'hostId': metadata['hostId'],
                                'startupNonce': metadata['startupNonce'], 'challenge': 'startup-consumption-finished'}
                            os.write(channel, json.dumps(notice).encode() + b'\n')
                        except BaseException as error:
                            child.error = error
                    child.thread = threading.Thread(target=startup)
                    child.thread.start()
                    return child
                stack.enter_context(patch.object(ds.HR_FIXED_IO.FixedIO, '_spawn_child', new=spawn))
                request = {'action': ds.HR_PROFILE.ACTION, 'operation_id': ds.HR_PROFILE.OPERATION_ID}
                result = ds.handle(json.dumps(request).encode())[0]
                for child in state['children']:
                    child.thread.join(timeout=1)
                    self.assertFalse(child.thread.is_alive())
                    self.assertIsNone(child.error)
                    for descriptor in child.inherited.values():
                        os.close(descriptor)
                if variant == 'closed':
                    self.assertTrue(result['ok'], result)
                    self.assertEqual(result['disposition'], 'CLOSED')
                    self.assertEqual(ds.HR_LIFECYCLE.snapshot()['disposition'], 'CLOSED')
                    self.assertIsNone(owned[0]._window)
                else:
                    self.assertFalse(result['ok'], result)
                    self.assertEqual(result['disposition'], 'UNKNOWN')
                    self.assertIn('fixed-DS-owner', ds.HR_ONE_SHOT._custody)
                    if variant == 'readback_wrong':
                        unknown, _ = ds.HR_LIFECYCLE.readback('phase-unknown')
                        self.assertEqual(unknown['observation']['ownership']['ownedChild'], owned[0]._child_identity)
                self.assertEqual(len(state['children']), 1 if variant in ('closed', 'readback_wrong') else 0)
                self.assertEqual(recorder.calls, [])


if __name__ == '__main__':
    unittest.main()
