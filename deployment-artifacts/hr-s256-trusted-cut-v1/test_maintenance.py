"""Disposable fixed installation fixtures; every process boundary denied."""
from pathlib import Path
import subprocess
import sys
import unittest
import os
import hashlib
import json
import fcntl
from contextlib import contextmanager, ExitStack
from unittest.mock import patch
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts/lib/hr-s256-one-shot'))
from process_confinement import confine_processes
from maintenance_test_confinement import confined_filesystem

class MaintenanceTest(unittest.TestCase):
    def test_actual_current_daemon_private_promoter_inert_before_io(self):
        with confine_processes(subprocess) as recorder, confined_filesystem() as filesystem:
            import test_bootstrap
            with test_bootstrap.BootstrapTest().fixture(current=True) as (ds, _, _, _):
                self.assertTrue(hasattr(ds, 'HR_MAINTENANCE'), 'private fixed maintenance promoter missing')
                self.assertIsNone(ds.HR_MAINTENANCE.promote_waiting(None))
                self.assertIsNone(ds.HR_BOOTSTRAP.activation_pins())
            self.assertEqual(recorder.calls, [])

    @contextmanager
    def fixture(self, owned=True):
        with confine_processes(subprocess) as recorder, confined_filesystem() as filesystem:
            import test_bootstrap
            with test_bootstrap.BootstrapTest().fixture(current=True) as (ds, inputs, targets, root), ExitStack() as stack:
                ds.HR_BOOTSTRAP.installation_bootstrap()
                # Namespace readers in the new helper must use the same disposable mapping.
                stack.enter_context(patch.object(ds.HR_BOOTSTRAP, 'TARGETS', targets))
                stack.enter_context(patch.object(ds.HR_BOOTSTRAP, '_parent',
                    side_effect=lambda path: os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)))
                stack.enter_context(patch.object(os, 'geteuid', return_value=os.getuid()))
                if owned:
                    ds.HR_JOURNAL.seal_intent('n' * 32, 'a' * 64, 97)
                    lock = ds.mutation_lock()
                    ds.HR_OWNED_STOP.enter_handler(lock)
                    window = os.open(Path(root) / ds.HR_PROFILE.OPERATION_ID / 'window.lock',
                                     os.O_RDWR | os.O_CREAT | os.O_EXCL, 0o600)
                    fcntl.flock(window, fcntl.LOCK_EX | fcntl.LOCK_NB)
                    owner = ds.HR_OWNED_STOP.capture_from_handler(lock, window, 98)
                    stack.callback(owner.close)
                    stack.callback(ds.HR_OWNED_STOP.leave_handler)
                    stack.callback(os.close, window)
                    stack.callback(os.close, lock)
                stack.enter_context(patch.object(ds.HR_REAL_OS, 'require_activation', return_value={'hostId': 'fixture-host'}))
                stack.enter_context(patch.object(ds.HR_REAL_OS, 'deployed_prerequisites', return_value={}))
                stack.enter_context(patch.object(ds.HR_INVENTORY, 'fixed_installed_inventory', return_value={'unresolvedSources': []}))
                cell = dict(zip(ds.HR_FINITE_STOP.FixedStop.stop.__code__.co_freevars, ds.HR_FINITE_STOP.FixedStop.stop.__closure__))['command']
                old = cell.cell_contents; calls = []
                def command(route, verb, deadline):
                    calls.append((route, verb))
                    return 0 if verb == 'bootout' else 113
                cell.cell_contents = command
                stack.callback(setattr, cell, 'cell_contents', old)
                if owned:
                    stop = owner.fixed_stop()
                    stop.stop()
                io = ds.HR_ONE_SHOT.fixed_io()
                if owned:
                    io._owner, io._stop, io._window = owner, stop, window
                app = Path(root).resolve() / 'app'; app.mkdir(mode=0o700)
                (app / 'scripts').mkdir(); (app / 'scripts/production-runtime.mjs').write_bytes(b'old-runtime')
                (app / 'packages').mkdir(); (app / 'packages/keep.js').write_bytes(b'coherent-preserved')
                (app / 'node_modules').mkdir(); (app / 'node_modules/preserved').write_bytes(b'deps-preserved')
                routes = {r: Path(root).resolve() / ('gui.plist' if r.startswith('gui') else 'system.plist') for r in ds.HR_MAINTENANCE.ROUTES}
                def plist(target):
                    return ('<plist><dict><key>Label</key><string>ai.agent-core.runtime</string>'
                        '<key>ProgramArguments</key><array><string>/usr/local/libexec/agent-core/node-runtime/bin/node</string>'
                        '<string>' + target + '</string></array><key>KeepAlive</key><true/></dict></plist>').encode()
                for path in routes.values(): path.write_bytes(plist(str(app / 'scripts/production-runtime.mjs')))
                # Disposable compiled coordinates only, never a public request or host proof.
                functions = [ds.HR_MAINTENANCE.promote_waiting, ds.HR_MAINTENANCE._payload,
                    ds.HR_MAINTENANCE._tree_manifest, ds.HR_MAINTENANCE._read, ds.HR_MAINTENANCE._directory,
                    ds.HR_MAINTENANCE._replace, ds.HR_MAINTENANCE._route]
                def bind(name, value):
                    cell = next(dict(zip(fn.__code__.co_freevars, fn.__closure__))[name]
                        for fn in functions if name in fn.__code__.co_freevars)
                    before = cell.cell_contents; cell.cell_contents = value
                    stack.callback(setattr, cell, 'cell_contents', before)
                bind('APP', app); bind('ROUTES', routes); bind('CUSTODY_UID', os.getuid())
                directory_cell = dict(zip(ds.HR_MAINTENANCE._tree_manifest.__code__.co_freevars, ds.HR_MAINTENANCE._tree_manifest.__closure__))['_directory']
                original_directory = directory_cell.cell_contents
                def directory(path):
                    path = Path(path)
                    if str(path).startswith(root + '/'):
                        path = Path(root).resolve() / path.relative_to(root)
                    return original_directory(path)
                directory_cell.cell_contents = directory
                stack.callback(setattr, directory_cell, 'cell_contents', original_directory)
                # OS boundary: outside disposable root has synthetic root custody; inside retains actual metadata.
                original_fstat = os.fstat
                def fstat(fd):
                    value = original_fstat(fd)
                    if value.st_uid != os.getuid():
                        fields = list(value); fields[4] = os.getuid(); fields[0] &= ~0o022
                        return os.stat_result(fields)
                    return value
                stack.enter_context(patch.object(os, 'fstat', side_effect=fstat))
                base = ds.HR_MAINTENANCE._tree()
                files = {'scripts/production-runtime.mjs': b'#!/usr/bin/env node\nthrow new Error("HR_UNGATED_ENTRY_RETIRED");\n',
                    'packages/gated.mjs': b'disposable-gated-entry'}
                before = (app / 'scripts/production-runtime.mjs').read_bytes()
                for rel, raw in files.items(): (app / rel).write_bytes(raw)
                post = ds.HR_MAINTENANCE._tree()
                (app / 'scripts/production-runtime.mjs').write_bytes(before); (app / 'packages/gated.mjs').unlink()
                bind('APP_SHA', post)
                payload = {'appSourceSha256': post, 'baseSourceSha256': base,
                    'daemonBaseSha256': ds.HR_MAINTENANCE.DAEMON_BASE,
                    'clientSha256': ds.HR_MAINTENANCE.CLIENT_SHA, 'files': files,
                    'routes': {r: plist(str(app / 'packages/production-runtime/src/native-arm64/hr-s256-r2-gated-runtime.mjs')) for r in routes},
                    'baseRoutes': {r: hashlib.sha256(path.read_bytes()).hexdigest() for r,path in routes.items()}}
                bind('TRUSTED_INSTALLATION', payload)
                calls.clear()
                yield ds, io, payload, app, routes, calls
            self.assertEqual(recorder.calls, [])

    def test_R1_R2_R7_owned_promotion_waiting_no_ordinary_start_and_one_handoff(self):
        with self.fixture() as (ds, io, p, app, routes, calls):
            result = ds.HR_MAINTENANCE.promote_waiting(io)
            self.assertEqual(result['state'], 'INSTALLED_WAITING')
            self.assertEqual(ds.HR_MAINTENANCE._tree(), p['appSourceSha256'])
            self.assertEqual((app / 'node_modules/preserved').read_bytes(), b'deps-preserved')
            self.assertEqual((app / 'packages/keep.js').read_bytes(), b'coherent-preserved')
            self.assertTrue(all(v == 'print' for _,v in calls))
            ds.HR_MAINTENANCE.handoff_waiting(io)
            with self.assertRaisesRegex(Exception, 'MAINTENANCE_UNKNOWN_NO_REPLAY'):
                ds.HR_MAINTENANCE.handoff_waiting(io)
            with self.assertRaisesRegex(Exception, 'MAINTENANCE_NO_REPLAY'):
                ds.HR_MAINTENANCE.promote_waiting(io)

    def test_R1_typed_daemon_is_not_app_and_bad_base_zero_promotion(self):
        for field in ('appSourceSha256', 'baseSourceSha256', 'clientSha256', 'daemonBaseSha256'):
            with self.subTest(field=field), self.fixture() as (ds, io, p, app, routes, _):
                p[field] = ds.HR_MAINTENANCE.DAEMON_BASE if field == 'appSourceSha256' else 'c' * 64
                with self.assertRaisesRegex(Exception, 'MAINTENANCE_TYPED_IDENTITY|MAINTENANCE_BASE_CHANGED'):
                    ds.HR_MAINTENANCE.promote_waiting(io)
                self.assertEqual((app / 'scripts/production-runtime.mjs').read_bytes(), b'old-runtime')
                self.assertFalse((app / 'packages/gated.mjs').exists())

    def test_R2_wrong_routes_topology_and_entry_reject_zero_write(self):
        for kind in ('extra', 'missing', 'topology', 'ungated'):
            with self.subTest(kind=kind), self.fixture() as (ds, io, p, app, _, _):
                route = next(iter(p['routes']))
                if kind == 'extra': p['routes']['foreign'] = b'x'
                if kind == 'missing': p['routes'].pop(route)
                if kind == 'topology': p['routes'][route] = p['routes'][route].replace(b'<true/>', b'<false/>')
                if kind == 'ungated': p['routes'][route] = p['routes'][route].replace(b'hr-s256-r2-gated-runtime.mjs', b'ungated.mjs')
                with self.assertRaisesRegex(Exception, 'MAINTENANCE_ROUTE_SET|MAINTENANCE_TOPOLOGY_CHANGED|MAINTENANCE_GATED_ENTRY'):
                    ds.HR_MAINTENANCE.promote_waiting(io)
                self.assertEqual((app / 'scripts/production-runtime.mjs').read_bytes(), b'old-runtime')

    def test_R4_lost_private_window_and_unknown_source_do_not_promote(self):
        for loss in ('window', 'source', 'wrongowner'):
            with self.subTest(loss=loss), self.fixture() as (ds, io, _, app, _, _):
                if loss == 'window': fcntl.flock(io._window, fcntl.LOCK_UN)
                if loss == 'source': io._stop._unknown = True
                if loss == 'wrongowner': io._owner = object()
                with self.assertRaisesRegex(Exception, 'OWNED_LOCK_RELEASED|STOP_UNKNOWN|MAINTENANCE_PRIVATE_OWNER'):
                    ds.HR_MAINTENANCE.promote_waiting(io)
                self.assertEqual((app / 'scripts/production-runtime.mjs').read_bytes(), b'old-runtime')
                self.assertTrue(io._unknown)

    def test_R3_crash_after_reserved_unknown_never_replays(self):
        with self.fixture() as (ds, io, _, app, _, _):
            fn = ds.HR_MAINTENANCE.promote_waiting
            cell = dict(zip(fn.__code__.co_freevars, fn.__closure__))['_replace']
            original = cell.cell_contents
            cell.cell_contents = lambda *args: (_ for _ in ()).throw(OSError('disposable crash'))
            try:
                with self.assertRaises(OSError): ds.HR_MAINTENANCE.promote_waiting(io)
            finally: cell.cell_contents = original
            receipt = Path(ds.STATE_ROOT) / 'receipts' / (ds.HR_MAINTENANCE.ID + '.maintenance.json')
            self.assertEqual(json.loads(receipt.read_bytes())['state'], 'UNKNOWN')
            self.assertEqual((app / 'scripts/production-runtime.mjs').read_bytes(), b'old-runtime')
            with self.assertRaisesRegex(Exception, 'MAINTENANCE_NO_REPLAY'): ds.HR_MAINTENANCE.promote_waiting(io)

    def test_R6_app_route_and_each_publisher_tamper_refuses_handoff(self):
        for target in ('app', 'route', *range(4)):
            with self.subTest(target=target), self.fixture() as (ds, io, _, app, routes, _):
                ds.HR_MAINTENANCE.promote_waiting(io)
                path = (app / 'packages/keep.js') if target == 'app' else next(iter(routes.values())) if target == 'route' else list(ds.HR_BOOTSTRAP.TARGETS.values())[target]
                path.write_bytes(path.read_bytes() + b' ')
                with self.assertRaisesRegex(Exception, 'MAINTENANCE_APP_CHANGED|MAINTENANCE_ROUTE_CHANGED|MAINTENANCE_PROOF_CHANGED'):
                    ds.HR_MAINTENANCE.handoff_waiting(io)
                self.assertTrue(io._unknown)
                with self.assertRaisesRegex(Exception, 'MAINTENANCE_UNKNOWN_NO_REPLAY'):
                    ds.HR_MAINTENANCE.handoff_waiting(io)

    def test_R3_zero_write_keeps_reserved_unknown_and_original_bytes(self):
        with self.fixture() as (ds, io, _, app, _, _):
            original_write = os.write
            def zero(fd, raw):
                if bytes(raw).startswith(b'#!/usr/bin/env node'): return 0
                return original_write(fd, raw)
            with patch.object(os, 'write', side_effect=zero):
                with self.assertRaisesRegex(Exception, 'MAINTENANCE_WRITE_UNKNOWN'):
                    ds.HR_MAINTENANCE.promote_waiting(io)
            receipt = Path(ds.STATE_ROOT) / 'receipts' / (ds.HR_MAINTENANCE.ID + '.maintenance.json')
            self.assertEqual(json.loads(receipt.read_bytes())['state'], 'UNKNOWN')
            self.assertEqual((app / 'scripts/production-runtime.mjs').read_bytes(), b'old-runtime')
            self.assertTrue(io._unknown)

    def test_R4_writable_file_symlink_and_parent_reject(self):
        for bad in ('mode', 'symlink', 'parent'):
            with self.subTest(bad=bad), self.fixture() as (ds, io, _, app, _, _):
                path = app / 'scripts/production-runtime.mjs'
                if bad == 'mode': path.chmod(0o664)
                if bad == 'symlink':
                    path.unlink(); path.symlink_to(app / 'packages/keep.js')
                if bad == 'parent': (app / 'scripts').chmod(0o777)
                with self.assertRaisesRegex(Exception, 'MAINTENANCE_OUTPUT_CUSTODY|MAINTENANCE_PARENT_CUSTODY|Too many levels|loop'):
                    ds.HR_MAINTENANCE.promote_waiting(io)
                self.assertFalse((app / 'packages/gated.mjs').exists())

    def test_R4_loss_after_first_file_keeps_partial_unknown_no_route_write(self):
        with self.fixture() as (ds, io, p, app, routes, _):
            cell = dict(zip(ds.HR_MAINTENANCE.promote_waiting.__code__.co_freevars,
                ds.HR_MAINTENANCE.promote_waiting.__closure__))['_replace']
            original = cell.cell_contents
            before = {r: path.read_bytes() for r,path in routes.items()}
            def lose(parent, name, raw, mode):
                original(parent, name, raw, mode)
                fcntl.flock(io._window, fcntl.LOCK_UN)
            cell.cell_contents = lose
            try:
                with self.assertRaisesRegex(Exception, 'OWNED_LOCK_RELEASED'):
                    ds.HR_MAINTENANCE.promote_waiting(io)
            finally: cell.cell_contents = original
            self.assertEqual((app / 'scripts/production-runtime.mjs').read_bytes(), p['files']['scripts/production-runtime.mjs'])
            self.assertEqual({r: path.read_bytes() for r,path in routes.items()}, before)
            receipt = Path(ds.STATE_ROOT) / 'receipts' / (ds.HR_MAINTENANCE.ID + '.maintenance.json')
            self.assertEqual(json.loads(receipt.read_bytes())['state'], 'UNKNOWN')
            self.assertTrue(io._unknown)

    def test_R5_bool_foreign_unknown_receipt_never_authorizes_or_rewrites(self):
        for corrupt in ('bool', 'foreign', 'unknown'):
            with self.subTest(corrupt=corrupt), self.fixture() as (ds, io, _, app, _, _):
                result = ds.HR_MAINTENANCE.promote_waiting(io)
                receipt = Path(ds.STATE_ROOT) / 'receipts' / (ds.HR_MAINTENANCE.ID + '.maintenance.json')
                if corrupt == 'bool': result['version'] = True
                if corrupt == 'foreign': result['operation_id'] = 'foreign'
                if corrupt == 'unknown': result['state'] = 'UNKNOWN'
                receipt.write_bytes(ds.canonical(result)); before = receipt.read_bytes()
                ds.HR_MAINTENANCE._state['attempted'] = False  # Synthetic fresh daemon-private state.
                with self.assertRaisesRegex(Exception, 'MAINTENANCE_UNKNOWN_NO_REPLAY'):
                    ds.HR_MAINTENANCE.promote_waiting(io)
                self.assertEqual(receipt.read_bytes(), before)
                self.assertTrue(io._unknown)

    def test_R5_valid_reattachment_readonly_never_promotes_again(self):
        with self.fixture() as (ds, io, _, app, _, _):
            expected = ds.HR_MAINTENANCE.promote_waiting(io)
            ds.HR_MAINTENANCE._state['attempted'] = False
            cell = dict(zip(ds.HR_MAINTENANCE.promote_waiting.__code__.co_freevars,
                ds.HR_MAINTENANCE.promote_waiting.__closure__))['_replace']
            original = cell.cell_contents
            cell.cell_contents = lambda *args: self.fail('readonly reattachment attempted promotion')
            try: self.assertEqual(ds.HR_MAINTENANCE.promote_waiting(io), expected)
            finally: cell.cell_contents = original

    def test_R1_changed_payload_rejected_before_any_promotion(self):
        with self.fixture() as (ds, io, p, app, routes, _):
            p['files']['packages/gated.mjs'] += b' changed'
            before = {r: path.read_bytes() for r,path in routes.items()}
            with self.assertRaisesRegex(Exception, 'MAINTENANCE_CANDIDATE_CHANGED'):
                ds.HR_MAINTENANCE.promote_waiting(io)
            self.assertEqual((app / 'scripts/production-runtime.mjs').read_bytes(), b'old-runtime')
            self.assertEqual({r: path.read_bytes() for r,path in routes.items()}, before)

    def test_R6_waiting_receipt_tamper_cannot_handoff(self):
        with self.fixture() as (ds, io, _, _, _, _):
            ds.HR_MAINTENANCE.promote_waiting(io)
            path = Path(ds.STATE_ROOT) / 'receipts' / (ds.HR_MAINTENANCE.ID + '.maintenance.json')
            value = json.loads(path.read_bytes()); value['version'] = True
            path.write_bytes(ds.canonical(value))
            with self.assertRaisesRegex(Exception, 'MAINTENANCE_RECEIPT_CHANGED'):
                ds.HR_MAINTENANCE.handoff_waiting(io)
            self.assertTrue(io._unknown)

    def post_readback_loss(self, loss):
        from types import SimpleNamespace
        with self.fixture() as (ds, io, _, _, _, _):
            ds.HR_MAINTENANCE.promote_waiting(io)
            owner = io._owner
            descriptors = (owner.canonical, owner.window, owner.canonical_dup, owner.window_dup)
            cells = dict(zip(ds.HR_MAINTENANCE.handoff_waiting.__code__.co_freevars,
                ds.HR_MAINTENANCE.handoff_waiting.__closure__))
            clock = [100.0]
            original_time = cells['time'].cell_contents
            original_verify = cells['_verify'].cell_contents
            cells['time'].cell_contents = SimpleNamespace(monotonic=lambda: clock[0])
            def verified_then_loss(payload):
                original_verify(payload)
                if loss == 'deadline': clock[0] = 111.0
                else: io._stop._unknown = True
            cells['_verify'].cell_contents = verified_then_loss
            try:
                reason = 'MAINTENANCE_DEADLINE' if loss == 'deadline' else 'STOP_UNKNOWN'
                with self.assertRaisesRegex(Exception, reason):
                    ds.HR_MAINTENANCE.handoff_waiting(io)
                self.assertTrue(io._unknown)
                self.assertFalse(ds.HR_MAINTENANCE._state['waiting'])
                self.assertIs(io._owner, owner)
                self.assertFalse(owner.closed)
                self.assertEqual(descriptors, (owner.canonical, owner.window,
                    owner.canonical_dup, owner.window_dup))
                with self.assertRaisesRegex(Exception, 'MAINTENANCE_UNKNOWN_NO_REPLAY'):
                    ds.HR_MAINTENANCE.handoff_waiting(io)
            finally:
                cells['_verify'].cell_contents = original_verify
                cells['time'].cell_contents = original_time

    def test_handoff_deadline_lost_after_verified_readback_sticky_unknown(self):
        self.post_readback_loss('deadline')

    def test_handoff_inhibition_lost_after_verified_readback_sticky_unknown(self):
        self.post_readback_loss('inhibition')
