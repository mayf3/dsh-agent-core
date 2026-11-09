"""Offline R3 gates; writes only a unique child of the authorized fixture root."""
import ast
import contextlib
import datetime as dt
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

BASE = 'c4152e9a45e2f1798807492c73516d924dcaf855'
C7_BASE = '97fa15a138e4aafe7d566fc3c3d387c3594e87ba'
HERE = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(HERE))
ROOT = Path(os.environ.get('FWAV_XATTR_TEST_ROOT', tempfile.mkdtemp(prefix='fwav-xattrs-'))).resolve()
if not ROOT.is_relative_to(Path(tempfile.gettempdir()).resolve()):
    raise RuntimeError('xattr tests require a disposable temporary fixture root')
# The core retains the original invocation context initialization; import only
# definitions, never the operation dispatcher or any production stage.
saved_argv = sys.argv[:]
sys.argv = [str(HERE / 'window_helper.py'), str(ROOT), 'selftest']
import window_helper_core as core
import window_preimage_xattr as xattrs
sys.argv = saved_argv
# These retained xattr tests inspect copying semantics, not authorization.
xattrs.effect_guard = lambda *args, **kwargs: None


def cli(*args):
    return subprocess.run(['/usr/bin/xattr', *map(str, args)], check=True,
                          stdout=subprocess.PIPE, stderr=subprocess.PIPE)


def old_source():
    return subprocess.check_output(['git', 'show', BASE + ':scripts/fleet-window/window-executor-v5.sh'],
                                   cwd=Path.cwd()).decode()


def task_base_source(name):
    return subprocess.check_output(['git', 'show', '417cc8ee6e7ef9a5e840e900a11c30fe58d648da:scripts/fleet-window/' + name],
                                   cwd=Path.cwd()).decode()


def c7_source(name):
    return subprocess.check_output(['git', 'show', C7_BASE + ':scripts/fleet-window/' + name],
                                   cwd=Path.cwd()).decode()


class SyntheticTree(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if ROOT.is_symlink() or ROOT.resolve() != ROOT or not ROOT.is_dir():
            raise RuntimeError('fixture root is not the authorized physical isolation directory')
        cls.run_root = Path(tempfile.mkdtemp(prefix='r3-', dir=ROOT))
        print('ISOLATION_ROOT=' + str(cls.run_root), flush=True)

    def setUp(self):
        self.guard_calls = []
        xattrs.effect_guard = lambda *args, **kwargs: self.guard_calls.append((args, kwargs))
        self.case = Path(tempfile.mkdtemp(prefix=self._testMethodName + '-', dir=self.run_root))
        self.source = self.case / 'source'
        self.target = self.case / 'target'
        self.source.mkdir(mode=0o700)
        for name in ('valued', 'empty', 'multiple', 'none'):
            (self.source / name).write_bytes(b'synthetic ' + name.encode())
        (self.source / 'dangling').symlink_to('missing-only-in-this-fixture')
        cli('-crs', self.source)
        cli('-w', 'com.r3.value', 'hello', self.source / 'valued')
        cli('-w', 'com.r3.empty', '', self.source / 'empty')
        cli('-w', 'com.r3.first', 'one', self.source / 'multiple')
        cli('-w', 'com.r3.second', '', self.source / 'multiple')
        cli('-wx', 'com.r3.binary', '00FF0A0D3A20' + 'AB' * 64, self.source / 'multiple')

    def copy(self):
        self.before = xattrs.inventory(self.source)
        core.run(['/usr/bin/ditto', '--rsrc', '--extattr', '--acl', self.source, self.target])

    def reconcile(self):
        return xattrs.reconcile_xattrs(self.source, self.target, self.before[xattrs.XATTRS_KEY])

    def expect_rejection(self, text):
        before = xattrs.inventory(self.target)
        with self.assertRaisesRegex(RuntimeError, text):
            self.reconcile()
        self.assertEqual(xattrs.inventory(self.target), before, 'rejected reconciliation wrote target')

    def test_five_fixture_classes(self):
        self.copy()
        omitted = xattrs.xattr_values(self.target)
        repairs = self.reconcile()
        self.assertEqual(xattrs.inventory(self.target), self.before)
        self.assertEqual(xattrs.inventory(self.source), self.before)
        actual = xattrs.xattr_values(self.target)
        self.assertEqual(actual['valued']['com.r3.value'], b'hello')
        self.assertEqual(actual['empty']['com.r3.empty'], b'')
        self.assertEqual(actual['multiple']['com.r3.second'], b'')
        self.assertEqual(actual['multiple']['com.r3.binary'], bytes.fromhex('00FF0A0D3A20' + 'AB' * 64))
        # BRIEF-XATTRFIX-R4.md, regulatory ruling: none means source/target
        # consistency, not emptiness; macOS reapplies com.apple.provenance.
        # inventory stores root-level per-path digests; xattr_values retains
        # the raw bytes needed to prove both collectors saw the OS attribute.
        source_none = xattrs.xattr_values(self.source).get('none', {})
        target_none = actual.get('none', {})
        provenance = 'com.apple.provenance'
        self.assertIn(provenance, source_none)
        self.assertIn(provenance, target_none)
        self.assertEqual(source_none, target_none)
        self.assertEqual(source_none[provenance], target_none[provenance])
        self.assertEqual(self.before[xattrs.XATTRS_KEY]['none'],
                         xattrs.inventory(self.target)[xattrs.XATTRS_KEY]['none'])
        self.assertTrue((self.target / 'dangling').is_symlink())
        self.assertEqual(os.readlink(self.target / 'dangling'), 'missing-only-in-this-fixture')
        self.assertEqual(bytes.fromhex(cli('-spx', 'com.r3.value', self.target / 'valued').stdout.decode()), b'hello')
        missing = [(k, n) for k, attrs in xattrs.xattr_values(self.source).items()
                   for n, value in attrs.items() if value == b'' and n not in omitted.get(k, {})]
        self.assertEqual(sorted(repairs), sorted(missing))
        for name in ('valued', 'empty', 'multiple', 'none', 'dangling'):
            print('FIXTURE ' + name + ': PASS (inventory + ditto + reconcile + full equality)', flush=True)
        print('DITTO_EMPTY_OMISSIONS=' + json.dumps(missing) + ' REAPPLIED=' + str(len(repairs)), flush=True)

    def test_forced_empty_omission(self):
        self.copy()
        for rel, name in [('empty', 'com.r3.empty'), ('multiple', 'com.r3.second')]:
            if name in xattrs.xattr_values(self.target).get(rel, {}):
                cli('-sd', name, self.target / rel)
        repairs = self.reconcile()
        self.assertEqual(sorted(repairs), [('empty', 'com.r3.empty'), ('multiple', 'com.r3.second')])
        self.assertEqual(len(self.guard_calls), len(repairs))
        self.assertTrue(all(args[0] == 'xattr.write' for args, kwargs in self.guard_calls))
        self.assertEqual(xattrs.inventory(self.target), self.before)

    def test_nonempty_missing_stops_before_empty_repair(self):
        self.copy()
        cli('-sd', 'com.r3.value', self.target / 'valued')
        self.expect_rejection('nonempty/unexpected')

    def test_nonempty_changed_stops(self):
        self.copy()
        cli('-w', 'com.r3.value', 'changed', self.target / 'valued')
        self.expect_rejection('nonempty/unexpected')

    def test_unexpected_attribute_stops(self):
        self.copy()
        cli('-w', 'com.r3.unexpected', '', self.target / 'none')
        self.expect_rejection('nonempty/unexpected')

    def test_source_drift_stops(self):
        self.copy()
        cli('-w', 'com.r3.new', 'changed', self.source / 'valued')
        self.expect_rejection('source xattrs drifted')

    def test_nofollow_absolute_and_dangling(self):
        outside = self.case / 'outside-source'
        outside.write_bytes(b'synthetic outside tree')
        cli('-w', 'com.r3.outside', 'do-not-read-through-link', outside)
        (self.source / 'absolute').symlink_to(str(outside))
        self.copy()
        self.reconcile()
        self.assertEqual(xattrs.inventory(self.target), self.before)
        self.assertNotIn('com.r3.outside', xattrs.xattr_values(self.source).get('absolute', {}))
        self.assertEqual(bytes.fromhex(cli('-px', 'com.r3.outside', outside).stdout.decode()),
                         b'do-not-read-through-link')

    def test_reserved_and_ambiguous_paths_rejected(self):
        for name in (xattrs.XATTRS_KEY, 'line\nbreak', 'colon: path'):
            p = self.source / name
            p.write_bytes(b'synthetic')
            with self.assertRaisesRegex(RuntimeError, 'reserved|ambiguous'):
                xattrs.inventory(self.source)
            p.unlink()

    def test_single_process_batch_and_flags_only(self):
        calls = []
        real = xattrs.run
        def counted(argv, **kwargs):
            calls.append(argv)
            return real(argv, **kwargs)
        with mock.patch.object(xattrs, 'run', counted):
            result = xattrs.inventory(self.source)
        self.assertEqual(len(calls), 1)
        self.assertEqual(calls[0][:2], ['/usr/bin/xattr', '-lrsx'])
        self.assertTrue(all('xattrs' not in v for k, v in result.items() if k != xattrs.XATTRS_KEY))

    def test_cli_errors_fail_closed(self):
        failure = subprocess.CompletedProcess([], 1, b'', b'exact synthetic path error')
        with mock.patch.object(core.sp, 'run', return_value=failure):
            with self.assertRaisesRegex(RuntimeError, 'rc=1.*exact synthetic path error'):
                xattrs.inventory(self.source)
        diagnostic = subprocess.CompletedProcess([], 0, b'', b'synthetic warning')
        with mock.patch.object(core.sp, 'run', return_value=diagnostic):
            with self.assertRaisesRegex(RuntimeError, 'xattr diagnostic'):
                xattrs.inventory(self.source)


class Consumers(SyntheticTree):
    # Reuse fixture helpers, without inheriting the synthetic test methods.
    def context(self):
        rd = self.case / 'receipts'
        rd.mkdir()
        ns = dict(vars(core), effect_guard=lambda *args, **kwargs: None, inventory=xattrs.inventory, XATTRS_KEY=xattrs.XATTRS_KEY,
                  reconcile_xattrs=xattrs.reconcile_xattrs, rd=rd)
        ns['authority'] = lambda: {'expected_runtime_uid': os.getuid(), 'expected_runtime_gid': os.getgid()}
        ns['service_absent'] = lambda: None
        ns['private_inputs'] = lambda tag: []
        def save(name, value):
            (rd / name).write_text(json.dumps(value))
        ns['save'] = save
        self.ns = ns
        return ns

    def operate(self, name):
        node = next(n for n in ast.parse((HERE / 'window_helper.py').read_text()).body if isinstance(n, ast.If))
        while ast.literal_eval(node.test.comparators[0]) != name:
            node = node.orelse[0]
        # Only the selected branch is compiled; no dispatcher/production entry.
        exec(compile(ast.Module(body=node.body, type_ignores=[]), '<isolated ' + name + '>', 'exec'), self.ns)

    def test_consumer_prerequisites(self):
        ns = self.context()
        prep = self.case / 'prep'; ns['prep'] = prep
        for name in ('scratch/app', 'scratch/harness', 'scratch/node-runtime', 'r2', 'r3/attempt-02'):
            (prep / name).mkdir(parents=True, exist_ok=True)
        (prep / 'scratch/app/file').write_bytes(b'synthetic')
        (prep / 'scratch/app/link').symlink_to('file')
        c = {'ok': True, 'wrapperRc': 0, 'result': {'ready': True, 'pluginTreeFailed': False, 'missingPackages': []},
             'noFatal': True, 'childTerminated': True, 'candidate': str(prep / 'scratch')}
        b = {'ok': True, 'wrapperRc': 0, 'checks': {str(i): True for i in range(16)},
             'close': {'code': 0, 'signal': None}, 'candidate': c['candidate'], 'rawHashes': {}}
        for rel, value in [('r2/canary-receipt.json', c), ('r3/attempt-02/runtime-boot-receipt.json', b),
                           ('r2/symlink-inventory.json', [{'path': 'scratch/app/link', 'target': 'file'}])]:
            (prep / rel).write_text(json.dumps(value))
        records = {prefix + '/' + k: v['sha256'] for prefix in ('scratch', 'r2')
                   for k, v in xattrs.inventory(prep / prefix, False).items()
                   if k != xattrs.XATTRS_KEY and v['kind'] == 'file'}
        ns['manifest'] = lambda *args: {'records': records}
        self.operate('prerequisites')
        self.assertTrue((ns['rd'] / 'dual-prerequisites.json').is_file())

    def test_consumer_preserve_config_missing_attributed_file(self):
        ns = self.context()
        pre = ns['rd'] / 'preimage-full/config'; pre.mkdir(parents=True)
        live = self.case / 'live'; live.mkdir(); ns['live'] = live
        for name in ('agents.json', 'agent-credentials.json', 'extra.json'):
            (pre / name).write_bytes(b'synthetic ' + name.encode())
        cli('-w', 'com.r3.carried', 'value', pre / 'extra.json')
        core.run(['/usr/bin/ditto', '--rsrc', '--extattr', '--acl', pre, live / 'config'])
        (live / 'config/extra.json').unlink()
        def internal_guard(*args, **kwargs):
            if kwargs.get('internal'):
                raise RuntimeError('internal per-write control UNKNOWN')
        ns['effect_guard'] = internal_guard
        with self.assertRaisesRegex(RuntimeError, 'internal per-write control UNKNOWN'):
            self.operate('preserve-config')
        self.assertFalse((live / 'config/extra.json').exists())
        self.assertFalse((ns['rd'] / 'config-carryforward.json').exists())
        cli('-w', 'com.r3.bad', 'changed', live / 'config/agents.json')
        with self.assertRaisesRegex(RuntimeError, 'changed existing xattrs'):
            self.operate('preserve-config')

    def test_consumer_final_binding_full_attribute_map(self):
        ns = self.context()
        live = self.case / 'live'; live.mkdir(); ns['live'] = live
        for part in ('app', 'harness', 'node-runtime', 'config'):
            (live / part).mkdir(mode=0o700)
        provenance = {'source_head_sha': core.sha, 'source_tree_sha': core.tree, 'source_clean': 'yes',
                      'generation_label_sha': core.sha, 'main_repo_realpath': str(core.source)}
        (live / 'app/pack-provenance.json').write_text(json.dumps(provenance))
        pre = ns['rd'] / 'preimage-full/config'; pre.parent.mkdir()
        core.run(['/usr/bin/ditto', '--rsrc', '--extattr', '--acl', live / 'config', pre])
        accepted = {part: xattrs.inventory(live / part) for part in ('app', 'harness', 'node-runtime')}
        for rows in accepted.values():
            for key, row in rows.items():
                if key != xattrs.XATTRS_KEY:
                    row['uid'] += 1000; row['gid'] += 1000
        ns['save']('accepted-closure.json', accepted)
        ns['save']('accepted-closure-acl.json', {part: json.loads(core.acl_listing(live / part)) for part in accepted})
        self.operate('final-binding')
        self.assertTrue((ns['rd'] / 'final-binding.json').is_file())
        # A reserved map with uid/gid-looking paths must be compared as a map.
        accepted['app'][xattrs.XATTRS_KEY]['uid'] = 'synthetic-digest'
        ns['save']('accepted-closure.json', accepted)
        with self.assertRaisesRegex(RuntimeError, 'final closure differs'):
            self.operate('final-binding')


# Keep only consumer-specific methods on the consumer test class.
for inherited in list(vars(SyntheticTree)):
    if inherited.startswith('test_'):
        setattr(Consumers, inherited, None)


class Selftest(unittest.TestCase):
    def test_parser_fail_closed(self):
        paths = {'/synthetic/root': '.'}
        for data in (b'garbage\n', b'/elsewhere: com.r3.a:\n00000000\n',
                     b'/synthetic/root: com.r3.a:\n',
                     b'/synthetic/root: com.r3.a:\n00000001\n',
                     b'/synthetic/root: com.r3.a:\n00000000\n00000000\n',
                     b'/synthetic/root: com.r3.a:\n00000000\n/synthetic/root: com.r3.a:\n00000000\n'):
            with self.assertRaises(RuntimeError):
                xattrs.parse_xattrs(data, paths)

    def test_stage_and_dispatch_identity(self):
        original = task_base_source('window-executor-v5.sh')
        current = (HERE / 'window-executor-v5.sh').read_text()
        self.assertEqual(current.split('rollback_recipe() {', 1)[1].split('stop_on_error() {', 1)[0],
                         original.split('rollback_recipe() {', 1)[1].split('stop_on_error() {', 1)[0])
        for marker in ('trap \'stop_on_error', 'stage_13_close() { helper root close; helper root release; }',
                       'if [[ "${BASH_SOURCE[0]}" = "$0" ]]; then main "$@"; fi'):
            self.assertIn(marker, current)
        old_ast = ast.parse(task_base_source('window_helper.py'))
        old_core = ast.parse(task_base_source('window_helper_core.py'))
        core_ast = ast.parse((HERE / 'window_helper_core.py').read_text())
        old_defs = {n.name: ast.dump(n) for n in old_core.body if isinstance(n, ast.FunctionDef)}
        current_defs = {n.name: ast.dump(n) for n in core_ast.body if isinstance(n, ast.FunctionDef)}
        changed = {'read', 'authority', 'validate_authority'}
        for name in set(old_defs) & set(current_defs) - changed - {'extended', 'inventory'}:
            self.assertEqual(current_defs[name], old_defs[name], name)
        self.assertTrue({'validate_authority', 'authority_observation', 'effect_guard', 'mutex_owned'} <= set(current_defs))
        def branches(tree):
            node = next(n for n in tree.body if isinstance(n, ast.If))
            result = {}
            while isinstance(node, ast.If):
                result[ast.literal_eval(node.test.comparators[0])] = ast.dump(ast.Module(body=node.body, type_ignores=[]))
                node = node.orelse[0]
            return result
        before = branches(old_ast)
        after = branches(ast.parse((HERE / 'window_helper.py').read_text()))
        delta = {'authority', 'mutex', 'mutex-check', 'clean', 'preimage', 'preserve-config',
                 'plist-update', 'close', 'release', 'install-start', 'exit-check'}
        for name in before.keys() - delta - {'quiet', 'prerequisites', 'final-binding'}:
            self.assertEqual(before[name], after[name], name)
        self.assertTrue({'bootout', 'bootstrap', 'stage-bundle', 'installer-boundary', 'settlement-start'} <= set(after))
        self.assertEqual((HERE / 'window_close.py').read_text(), c7_source('window_close.py'))
        for retired in ('window_executor_state.py', 'window_executor_helper.py'):
            self.assertFalse((HERE / retired).exists(), retired)
        print('RETAINED_IDENTITY: task-base unaffected core/dispatcher + rollback recipe + C7 close; FWAV boundary delta separately tested', flush=True)

    def test_dry_run_and_help_identity(self):
        original = task_base_source('window-executor-v5.sh').encode()
        for argv in ([], ['--dry-run'], ['--help'], ['invalid'], ['--dry-run', 'extra']):
            expected = original
            before = subprocess.run(['/bin/bash', '/dev/stdin', *argv], input=expected, capture_output=True)
            after = subprocess.run(['/bin/bash', str(HERE / 'window-executor-v5.sh'), *argv], capture_output=True)
            self.assertEqual(after.returncode, before.returncode, argv)
            if argv in ([], ['--dry-run']):
                self.assertEqual((after.stdout, after.stderr), (before.stdout, before.stderr), argv)
            else:
                output = after.stdout + after.stderr
                self.assertIn(b'sraRef', output)
                self.assertIn(b'appointmentRef', output)
                self.assertIn(b'UNKNOWN', output)
        print('DRY_RUN_DIFF=EMPTY; help/invalid rc retained with explicit FWAV proof requirements', flush=True)

    def test_split_limits_and_syntax(self):
        for name in ('window-executor-v5.sh', 'window_helper.py', 'window_helper_core.py',
                     'window_preimage_xattr.py', 'window_close.py', 'window-selftest.py', 'authority_validation/tests/test_xattrfix_r3.py'):
            data = (HERE / name).read_text()
            self.assertLessEqual(len(data.splitlines()), 500, name)
            if name.endswith('.py'):
                compile(data, str(HERE / name), 'exec')
        subprocess.run(['/bin/bash', '-n', HERE / 'window-executor-v5.sh'], check=True)


class C7Close(unittest.TestCase):
    def test_focused_and_migrated_close_release(self):
        if ROOT.is_symlink() or ROOT.resolve() != ROOT or not ROOT.is_dir():
            raise RuntimeError('fixture root is not the authorized physical isolation directory')
        out = Path(tempfile.mkdtemp(prefix='merge-c7-', dir=ROOT))
        print('C7_ISOLATION_ROOT=' + str(out), flush=True)
        source = (HERE / 'window-selftest.py').read_text()
        tree = ast.parse(source)
        names = {'require', 'sha', 'save', 'rejected', 'pure_functions', 'close_checks'}
        selected = [n for n in ast.walk(tree) if isinstance(n, ast.FunctionDef) and n.name in names]
        self.assertEqual({n.name for n in selected}, names)
        namespace = dict(Path=Path, dt=dt, hashlib=hashlib, json=json, importlib=importlib, ast=ast,
                         math=core.math, os=os, re=core.re, stat=core.stat, sys=sys, time=core.time,
                         executor=HERE / 'window-executor-v5.sh', out=out)
        exec(compile(ast.Module(body=selected, type_ignores=[]), '<isolated C7 focused>', 'exec'), namespace)
        validators, binding = namespace['pure_functions'](HERE / 'window-executor-v5.sh')
        self.assertEqual(binding['path'], str(HERE / 'window_helper_core.py'))
        self.assertFalse(validators['quiet_ready'](179.999, True, True))
        self.assertTrue(validators['quiet_ready'](180, True, True))
        self.assertFalse(validators['quiet_ready'](float('inf'), True, True))
        subprocess.run([sys.executable, '-B', HERE / 'window_helper.py', out,
                        'phase', 'migrated_selftest_phase', 'PASS', 'ISOLATED_ONLY'], check=True)
        self.assertEqual(json.loads((out / 'migrated_selftest_phase.json').read_text())['status'], 'PASS')
        namespace['close_checks']()
        import window_close as close
        focused = json.loads((out / 'c7-focused.json').read_text())
        plan = focused['retention_plan']
        moment = dt.datetime.now(dt.timezone.utc)
        authority = dict(window_id='C7_FIXTURE', valid_from=(moment-dt.timedelta(days=1)).isoformat(),
                         valid_until=(moment+dt.timedelta(days=1)).isoformat(), c7=dict(
            before_path=str(out / 'names-before.json'), before_sha256=core.digest(out / 'names-before.json'),
            after_path=str(out / 'names-after.json'), naming_scope='synthetic-names', renames={'old': 'new'},
            generations_newest_first=plan['newest_first'], protected_generations=plan['protected'],
            protection_basis='Synthetic migrated dispatcher fixture'))
        rd = out / 'dispatcher-receipts'
        rd.mkdir()
        def save(name, value):
            (rd / name).write_text(json.dumps(value))
        save('c7-names-before.json', close.capture_before(authority))
        after = json.loads((out / 'names-after.json').read_text())
        after['captured_at'] = dt.datetime.now(dt.timezone.utc).isoformat()
        (out / 'names-after.json').write_text(json.dumps(after))
        self.ns = dict(vars(core), authority=lambda: authority, effect_guard=lambda *args, **kwargs: None, rd=rd,
                       live=out / 'retention-fixture', close_window=close.close_window,
                       save=save, raw=lambda name, data: (rd / name).write_bytes(data))
        save('stage_11_production_verify.json', dict(status='FAIL', at=moment.isoformat()))
        with self.assertRaisesRegex(RuntimeError, 'production verification did not PASS'):
            Consumers.operate(self, 'close')
        self.assertFalse((rd / 'c7-close.json').exists())
        save('stage_11_production_verify.json', dict(status='PASS', at=moment.isoformat()))
        Consumers.operate(self, 'close')
        candidates = json.loads((rd / 'c7-delete-candidates.json').read_text())
        self.assertEqual([row['name'] for row in candidates], ['.ds-old-oldest'])
        self.assertEqual((rd / 'c7-delete-candidates.nul').read_bytes(),
                         b''.join(os.fsencode(row['path']) + b'\0' for row in candidates))
        self.assertTrue(all(Path(row['path']).is_dir() for row in candidates))
        lock = out / 'owned-mutex'
        lock.mkdir()
        (lock / 'holder').write_text('synthetic owned holder')
        self.ns['lock'] = lock
        save('mutex.json', dict(sha256=core.digest(lock / 'holder')))
        save('stage_12_hr_watch.json', dict(status='PASS', at=moment.isoformat()))
        Consumers.operate(self, 'release')
        completion = json.loads((rd / 'completion.json').read_text())
        self.assertEqual(completion['c7ReceiptSha256'], core.digest(rd / 'c7-close.json'))
        self.assertEqual(completion['retentionDeletion'], 'NOT_EXECUTED_LIST_ONLY')
        self.assertFalse(lock.exists())
        print('C7_FOCUSED_AND_DISPATCH: R6/R7 original cases + stage11 refusal + JSON/NUL + owned release receipt PASS; deletion NOT_EXECUTED', flush=True)


if __name__ == '__main__':
    unittest.main(verbosity=2)
