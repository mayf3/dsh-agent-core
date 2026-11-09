"""#629 bounded selftest: actual quiet/census AST with memory-only dependencies.

No helper/runner entrypoint, production path, child process or disk write is used.
"""
import ast
from copy import deepcopy
import hashlib
import json
import math
from pathlib import Path
from types import SimpleNamespace
import unittest


HERE = Path(__file__).resolve().parent


def quiet_body(source):
    tree = ast.parse(source)
    node = next(n for n in tree.body if isinstance(n, ast.If))
    while isinstance(node, ast.If):
        if ast.literal_eval(node.test.comparators[0]) == 'quiet':
            return ast.Module(body=node.body, type_ignores=[])
        node = node.orelse[0]
    raise AssertionError('quiet branch unavailable')


QUIET = compile(quiet_body((HERE / 'window_helper.py').read_text()), '<actual quiet>', 'exec')
CORE = ast.parse((HERE / 'window_helper_core.py').read_text())
FUNCTIONS = ast.Module(body=[n for n in CORE.body if isinstance(n, ast.FunctionDef)
                            and n.name in {'quiet_ready', 'census'}], type_ignores=[])
assert {n.name for n in FUNCTIONS.body} == {'quiet_ready', 'census'}


class QuietObservation(unittest.TestCase):
    def setUp(self):
        self.rd = Path('/synthetic/receipts')
        self.prod = Path('/synthetic/production')
        self.log = Path('/synthetic/runtime.stderr')
        self.paths = [self.prod / 'control/turn-recovery-v3.json', self.prod / 'scheduler/jobs.json']
        self.documents = {
            self.rd / 'old-process.json': {'pid': 123, 'identity': 'exact-old-identity'},
            self.rd / 'plist-preimage.json': {'document': {'StandardErrorPath': str(self.log)}},
            self.paths[0]: {'historicalOutcome': 'UNKNOWN', 'fence': True},
            self.paths[1]: {'occurrences': []},
        }
        self.original = deepcopy(self.documents)
        self.census = dict(epoch='fixture-epoch', inflightTurns=[], unresolvedLostTurns=[], inflightOccurrences=[])
        self.receipts = {}
        self.commands = []
        self.age = 180
        self.log_changed = False
        self.drift_log = False
        self.drift_store = False
        self.unreadable = None
        self.raw_stdout = None
        self.run_error = None
        self.identity = 'exact-old-identity'

        def require(ok, message):
            if not ok:
                raise RuntimeError(message)

        def regular(path):
            require(path in [self.log, *self.paths] and path != self.unreadable, 'unreadable fixture')

        def meta(path):
            if path == self.log:
                return dict(mtime_ns=int((1000 - self.age) * 1e9), size=2 if self.log_changed else 1)
            require(path in self.paths, 'unexpected metadata read')
            return dict(mtime_ns=1, size=len(json.dumps(self.documents[path])))

        def digest(path):
            return hashlib.sha256(json.dumps(self.documents[path], sort_keys=True).encode()).hexdigest()

        def run(argv, env):
            # The actual census reader is replaced at its process boundary.
            self.assertEqual(argv[:3], [Path('/synthetic/prep/scratch/node-runtime/bin/node'), '--input-type=module', '-e'])
            self.assertIn('readRestartDrainCensus', argv[3])
            self.assertEqual(argv[4:], self.paths)
            self.assertEqual(env, {'PATH': '/usr/bin:/bin', 'HOME': '/var/empty'})
            self.commands.append(argv)
            if self.run_error:
                raise RuntimeError(self.run_error)
            if self.drift_log:
                self.log_changed = True
            if self.drift_store:
                self.documents[self.paths[0]]['externalWriter'] = True
            stdout = json.dumps(self.census).encode() if self.raw_stdout is None else self.raw_stdout
            return SimpleNamespace(stdout=stdout, stderr=b'')

        def record(name, value):
            self.receipts[name] = deepcopy(value)

        # No open, import, subprocess, sudo or filesystem writer is available.
        self.ns = dict(__builtins__={'str': str, 'isinstance': isinstance, 'list': list, 'all': all},
                       P=Path, rd=self.rd, prod=self.prod, prep=Path('/synthetic/prep'),
                       math=math, json=json, require=require, regular=regular, meta=meta, digest=digest,
                       read=lambda path: deepcopy(self.documents[path]), run=run, save=record, raw=record,
                       now=lambda: '2026-11-09T00:00:00+00:00', authority=lambda: {'fixture': True},
                       identity=lambda pid: self.identity, time=SimpleNamespace(time=lambda: 1000),
                       sys=SimpleNamespace(exit=lambda rc: (_ for _ in ()).throw(SystemExit(rc))))
        exec(compile(FUNCTIONS, '<actual census and quiet_ready>', 'exec'), self.ns)

    def observe(self):
        exec(QUIET, self.ns)

    def assert_unchanged(self):
        self.assertEqual(self.documents, self.original)
        self.assertTrue(self.documents[self.paths[0]]['fence'])
        self.assertEqual(self.documents[self.paths[0]]['historicalOutcome'], 'UNKNOWN')

    def test_quiet_pass_records_observations_without_settlement(self):
        self.observe()
        self.assertEqual(set(self.receipts), {'quiet-last.json', 'quiet-census.stdout', 'quiet-census.stderr',
                                             'quiet-census.json', 'quiet-pass.json'})
        self.assertTrue(self.receipts['quiet-census.json']['readOnly'])
        self.assertEqual(self.receipts['quiet-pass.json']['ageSeconds'], 180)
        self.assertEqual(len(self.commands), 1)
        self.assert_unchanged()

    def test_below_quiet_threshold_only_records_last_observation(self):
        self.age = 179.999
        with self.assertRaises(SystemExit) as raised:
            self.observe()
        self.assertEqual(raised.exception.code, 10)
        self.assertEqual(set(self.receipts), {'quiet-last.json'})
        self.assertEqual(self.commands, [])
        self.assert_unchanged()

    def test_each_nonempty_list_still_refuses_without_settlement(self):
        for key in ('inflightTurns', 'unresolvedLostTurns', 'inflightOccurrences'):
            with self.subTest(key=key):
                self.setUp()
                self.census[key] = [{'identity': 'unproven'}]
                with self.assertRaisesRegex(RuntimeError, 'unresolved/inflight execution'):
                    self.observe()
                self.assertNotIn('quiet-pass.json', self.receipts)
                self.assert_unchanged()

    def test_unreadable_store_refuses(self):
        self.unreadable = self.paths[0]
        with self.assertRaisesRegex(RuntimeError, 'unreadable fixture'):
            self.observe()
        self.assertEqual(self.commands, [])
        self.assertNotIn('quiet-pass.json', self.receipts)
        self.assert_unchanged()

    def test_reader_failure_and_malformed_census_refuse(self):
        for error, stdout, expected in [('reader unavailable', None, RuntimeError),
                                        (None, b'not JSON', json.JSONDecodeError)]:
            with self.subTest(error=error):
                self.setUp()
                self.run_error, self.raw_stdout = error, stdout
                with self.assertRaises(expected):
                    self.observe()
                self.assertNotIn('quiet-pass.json', self.receipts)
                self.assert_unchanged()

    def test_missing_epoch_refuses(self):
        self.census.pop('epoch')
        with self.assertRaisesRegex(RuntimeError, 'recovery epoch unavailable'):
            self.observe()
        self.assertNotIn('quiet-pass.json', self.receipts)
        self.assert_unchanged()

    def test_log_drift_during_census_refuses(self):
        self.drift_log = True
        with self.assertRaisesRegex(RuntimeError, 'log changed during census'):
            self.observe()
        self.assertNotIn('quiet-pass.json', self.receipts)
        self.assert_unchanged()

    def test_store_drift_during_census_refuses(self):
        self.drift_store = True
        with self.assertRaisesRegex(RuntimeError, 'census store changed during read'):
            self.observe()
        self.assertNotIn('quiet-pass.json', self.receipts)
        expected = deepcopy(self.original)
        expected[self.paths[0]]['externalWriter'] = True
        self.assertEqual(self.documents, expected)

    def test_old_identity_drift_refuses_before_census(self):
        self.identity = 'different-old-identity'
        with self.assertRaisesRegex(RuntimeError, 'old process identity changed'):
            self.observe()
        self.assertEqual(self.commands, [])
        self.assertEqual(self.receipts, {})
        self.assert_unchanged()


if __name__ == '__main__':
    unittest.main(verbosity=2)
