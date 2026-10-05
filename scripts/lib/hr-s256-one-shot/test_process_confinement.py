"""Fake recorder only: no adapter invocation, process, or host observation."""
from types import SimpleNamespace
import unittest

from process_confinement import confine_processes, ProcessDispatchDenied


class ProcessConfinementTest(unittest.TestCase):
    def test_closure_keeps_function_but_process_boundary_is_denied(self):
        real_calls = []
        def forbidden_original(*args, **kwargs):
            real_calls.append(args)
            raise AssertionError('unconfined dispatch')
        fake_os = SimpleNamespace(Popen=forbidden_original)
        def make_scoped():
            def command(argv):
                return fake_os.Popen(argv, env={'SECRET': 'must-not-record'})
            def stop():
                return command(['/bin/launchctl', 'bootout', 'gui/505/ai.agent-core.runtime'])
            return SimpleNamespace(command=command, stop=stop, subprocess=fake_os)
        scoped = make_scoped()
        scoped.command = lambda argv: 'ineffective namespace override'
        with confine_processes(scoped.subprocess) as recorder:
            with self.assertRaisesRegex(ProcessDispatchDenied, 'SYNTHETIC_PROCESS_DISPATCH_DENIED'):
                scoped.stop()
        self.assertEqual(real_calls, [])
        self.assertEqual(recorder.calls, [('/bin/launchctl', 'bootout', 'gui/505/ai.agent-core.runtime')])
        self.assertNotIn('SECRET', repr(recorder.calls))

    def test_every_command_denied_no_allowlist_or_default_fallback(self):
        real_calls = []
        fake_os = SimpleNamespace(Popen=lambda *args, **kwargs: real_calls.append(args))
        with confine_processes(fake_os) as recorder:
            for argv in (['/bin/launchctl', 'print', 'system/ai.agent-core.runtime'],
                         ['/bin/ps'], ['/usr/bin/python3'], ['arbitrary']):
                with self.assertRaises(ProcessDispatchDenied):
                    fake_os.Popen(argv)
        self.assertEqual(len(recorder.calls), 4)
        self.assertEqual(real_calls, [])

    def test_outer_boundary_covers_assembly_setup_and_teardown(self):
        real_calls = []
        fake_stdlib = SimpleNamespace(Popen=lambda *args, **kwargs: real_calls.append(args))
        def assembly():
            fake_stdlib.Popen(['/fixture/assembly-attempt'])
        def teardown():
            fake_stdlib.Popen(['/fixture/teardown-attempt'])
        with confine_processes(fake_stdlib) as recorder:
            try:
                with self.assertRaises(ProcessDispatchDenied):
                    assembly()
            finally:
                with self.assertRaises(ProcessDispatchDenied):
                    teardown()
        self.assertEqual(real_calls, [])
        self.assertEqual(recorder.calls,
            [('/fixture/assembly-attempt',), ('/fixture/teardown-attempt',)])


if __name__ == '__main__':
    unittest.main()
