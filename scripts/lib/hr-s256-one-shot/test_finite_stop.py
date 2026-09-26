"""Fixed stop adapter tests; fake command boundary, never launchctl/live reads."""
import importlib.util
from pathlib import Path
import unittest
import subprocess
import sys
import time
from unittest.mock import patch
from types import SimpleNamespace

HERE = Path(__file__).resolve().parent


class FiniteStopTest(unittest.TestCase):
    def load(self):
        spec = importlib.util.spec_from_file_location('finite_stop', HERE / 'finite_stop.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    def fixture(self, module, responses=None):
        module.TEST_MODE = True
        calls = []
        answers = iter(responses or [0, 113, 0, 113, 113, 113])
        module.HR_REAL_OS = SimpleNamespace(require_activation=lambda: None)
        module.HR_JOURNAL = SimpleNamespace(readback=lambda kind: ({'phase': 'INTENT'}, 'a' * 64))
        module.HR_INVENTORY = SimpleNamespace(fixed_installed_inventory=lambda: {
            'unresolvedSources': []})
        module.command = lambda route, verb, deadline: (calls.append((route, verb)) or next(answers))
        return module.FixedStop(), calls

    def test_inactive_zero_reads_and_effects(self):
        module = self.load()
        with self.assertRaisesRegex(module.Rejected, 'PROFILE_NOT_BOOTSTRAPPED'):
            module.FixedStop().stop()

    def test_partial_inventory_zero_effect(self):
        module = self.load()
        owner, calls = self.fixture(module)
        module.HR_INVENTORY.fixed_installed_inventory = lambda: {'unresolvedSources': ['LE1']}
        with self.assertRaisesRegex(module.Rejected, 'SOURCE_CLOSURE_UNKNOWN'):
            owner.stop()
        self.assertEqual(calls, [])

    def test_fixed_two_routes_no_retry_and_continuity(self):
        module = self.load()
        owner, calls = self.fixture(module)
        owner.stop()
        owner.observe()
        self.assertEqual(calls, [(route, verb) for route in module.ROUTES
                               for verb in ('bootout', 'print')] +
                         [(route, 'print') for route in module.ROUTES])
        with self.assertRaisesRegex(module.Rejected, 'STOP_NO_REPLAY'):
            owner.stop()

    def test_inhibition_loss_sticky_even_after_recovery(self):
        module = self.load()
        owner, calls = self.fixture(module, [0, 113, 0, 113, 0, 113, 113])
        owner.stop()
        with self.assertRaisesRegex(module.Rejected, 'SOURCE_RESUMED'):
            owner.observe()
        count = len(calls)
        with self.assertRaisesRegex(module.Rejected, 'STOP_UNKNOWN'):
            owner.observe()
        self.assertEqual(len(calls), count)

    def test_unknown_bootout_no_second_route_or_retry(self):
        module = self.load()
        owner, calls = self.fixture(module, [1])
        with self.assertRaisesRegex(module.Rejected, 'STOP_UNKNOWN'):
            owner.stop()
        with self.assertRaisesRegex(module.Rejected, 'STOP_NO_REPLAY'):
            owner.stop()
        self.assertEqual(len(calls), 1)

    def test_missing_intent_before_effect(self):
        module = self.load()
        owner, calls = self.fixture(module)
        module.HR_JOURNAL.readback = lambda kind: (_ for _ in ()).throw(module.Rejected('INTENT_UNKNOWN'))
        with self.assertRaisesRegex(module.Rejected, 'INTENT_UNKNOWN'):
            owner.stop()
        self.assertEqual(calls, [])

    def test_unowned_child_never_terminated(self):
        module = self.load()
        owner, calls = self.fixture(module)
        with self.assertRaisesRegex(module.Rejected, 'OWNED_CHILD_UNSUPPORTED'):
            owner.stop(child=SimpleNamespace(pid=123))
        self.assertEqual(calls, [])

    def test_wrong_route_zero_spawn(self):
        module = self.load()
        module.HR_REAL_OS = SimpleNamespace(require_activation=lambda: None)
        with patch.object(module.subprocess, 'Popen', side_effect=AssertionError('spawn')):
            with self.assertRaisesRegex(module.Rejected, 'STOP_ROUTE_UNKNOWN'):
                module.command('system/other', 'bootout', time.monotonic() + 30)

    def test_one_shared_unload_deadline_and_timeout_sticky(self):
        module = self.load()
        owner, calls = self.fixture(module)
        deadlines = []
        def result(route, verb, deadline):
            deadlines.append(deadline)
            return 0 if verb == 'bootout' else 113
        module.command = result
        owner.stop()
        self.assertEqual(len(set(deadlines)), 1)
        other, _ = self.fixture(module)
        module.command = lambda *args: (_ for _ in ()).throw(module.Rejected('STOP_DEADLINE'))
        with self.assertRaisesRegex(module.Rejected, 'STOP_DEADLINE'):
            other.stop()
        with self.assertRaisesRegex(module.Rejected, 'STOP_NO_REPLAY'):
            other.stop()
        with self.assertRaisesRegex(module.Rejected, 'STOP_UNKNOWN'):
            other.observe()

    def test_real_command_stream_cap_and_timeout_owned_cleanup(self):
        module = self.load()
        module.HR_REAL_OS = SimpleNamespace(require_activation=lambda: None)
        actual = subprocess.Popen
        for program, expected in (
                ('import os; os.write(1,b"x"*70000)', 'STOP_OUTPUT_UNKNOWN'),
                ('import time; time.sleep(2)', 'STOP_DEADLINE')):
            children = []
            def disposable(args, **options):
                child = actual([sys.executable, '-c', program], **options)
                children.append(child)
                return child
            with patch.object(module.subprocess, 'Popen', side_effect=disposable):
                with self.assertRaisesRegex(module.Rejected, expected):
                    module.command(module.ROUTES[0], 'print', time.monotonic() + 0.15)
            self.assertIsNotNone(children[0].poll())

    def test_real_command_ordinary_absence(self):
        module = self.load()
        module.HR_REAL_OS = SimpleNamespace(require_activation=lambda: None)
        actual = subprocess.Popen
        def disposable(args, **options):
            self.assertEqual(args, ['/bin/launchctl', 'print', module.ROUTES[1]])
            return actual([sys.executable, '-c', 'raise SystemExit(113)'], **options)
        with patch.object(module.subprocess, 'Popen', side_effect=disposable):
            self.assertEqual(module.command(module.ROUTES[1], 'print', time.monotonic() + 1), 113)


if __name__ == '__main__':
    unittest.main()
