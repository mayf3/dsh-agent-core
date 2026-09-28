"""No ioreg or protected-host execution: parser and denial only."""
import importlib
import unittest
from unittest.mock import patch


class HostIdentityTest(unittest.TestCase):
    def _observe(self, chunks, *, result=0, no_event=False):
        host = importlib.import_module('admin_host_identity')
        events = []

        class Output:
            def fileno(self):
                return 77

            def close(self):
                events.append('close-output')

        class Child:
            stdout = Output()

            def wait(self, timeout=None):
                events.append('wait')
                return result

            def poll(self):
                return 0

        class Selector:
            def register(self, fileobj, event):
                events.append('register')

            def select(self, timeout):
                events.append('select')
                return [] if no_event else [(object(), 1)]

            def close(self):
                events.append('close-selector')

        remaining = iter(chunks)
        with patch.object(host.os, 'geteuid', return_value=0), \
             patch.object(host.subprocess, 'Popen', return_value=Child()) as spawn, \
             patch.object(host.selectors, 'DefaultSelector', return_value=Selector()), \
             patch.object(host.os, 'read', side_effect=lambda fd, size: next(remaining)) as read:
            try:
                return host.observe_fixed_host()
            finally:
                self.assertEqual(spawn.call_args.args[0], host.HOST_COMMAND)
                self.assertIn('close-selector', events)
                self.assertIn('close-output', events)
                if no_event:
                    read.assert_not_called()

    def test_one_exact_root_observation_line(self):
        host = importlib.import_module('admin_host_identity')
        value = host.EXPECTED_HOST_ID
        self.assertEqual(host.parse_fixed_host(
            ('+-o Device\n|   "IOPlatformUUID" = "' + value + '"\n').encode()), value)
        invalid = [b'', b'\x00', b'x' * 4097,
            ('"IOPlatformUUID" = "' + value.lower() + '"').encode(),
            ('"IOPlatformUUID" = "' + value + '" junk').encode(),
            ('"IOPlatformUUID" = "' + value + '"\n'
             '"IOPlatformUUID" = "' + value + '"').encode(),
            b'"IOPlatformUUID" = "961534a5-8c94-487d-8e55-d324a54e821a"']
        for raw in invalid:
            with self.subTest(raw=raw[:32]), self.assertRaises(host.HostIdentityUnknown):
                host.parse_fixed_host(raw)

    def test_nonroot_and_spawn_failure_are_unknown_without_fallback(self):
        host = importlib.import_module('admin_host_identity')
        with patch.object(host.os, 'geteuid', return_value=502), \
             patch.object(host.subprocess, 'Popen', side_effect=AssertionError('spawn')):
            with self.assertRaisesRegex(host.HostIdentityUnknown, 'ROOT_REQUIRED'):
                host.observe_fixed_host()
        with patch.object(host.os, 'geteuid', return_value=0), \
             patch.object(host.subprocess, 'Popen', side_effect=OSError('synthetic')) as called:
            with self.assertRaisesRegex(host.HostIdentityUnknown, 'OBSERVATION_UNKNOWN'):
                host.observe_fixed_host()
            self.assertEqual(called.call_args.args[0], host.HOST_COMMAND)

    def test_observer_execution_bounds_fail_closed(self):
        host = importlib.import_module('admin_host_identity')
        valid = ('"IOPlatformUUID" = "' + host.EXPECTED_HOST_ID + '"\n').encode()
        self.assertEqual(self._observe([valid, b'']), host.EXPECTED_HOST_ID)
        for chunks, result, no_event, error in [
            ([valid], 0, True, 'TIMEOUT'),
            ([valid, b''], 4, False, 'COMMAND_FAILED'),
            ([b'x' * 4096, b'x'], 0, False, 'TOO_LARGE'),
            ([b'\xff', b''], 0, False, 'OUTPUT_INVALID'),
        ]:
            with self.subTest(error=error), self.assertRaisesRegex(host.HostIdentityUnknown, error):
                self._observe(chunks, result=result, no_event=no_event)


if __name__ == '__main__':
    unittest.main()
