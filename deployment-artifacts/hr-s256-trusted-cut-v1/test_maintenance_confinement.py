"""Pure fake recorder only: never import/execute assembled DS or OS adapters."""
import os
import unittest
from maintenance_test_confinement import SandboxOpen, FilesystemDenied


class ConfinementTest(unittest.TestCase):
    def fixture(self):
        calls = []
        def fake(path, flags, mode, *, dir_fd):
            calls.append((path, flags, mode, dir_fd))
            return 10 + len(calls)
        return SandboxOpen('/disposable/hr-test', ['/reviewed/input.py'], fake), calls

    def test_absolute_protected_path_never_calls_backend(self):
        guard, calls = self.fixture()
        with self.assertRaisesRegex(FilesystemDenied, 'OUTSIDE_SANDBOX'):
            guard('/private/var/db/agent-deploy-system-config', os.O_RDONLY | os.O_DIRECTORY)
        self.assertEqual(calls, [])

    def test_relative_dirfd_escape_never_calls_backend(self):
        guard, calls = self.fixture()
        fd = guard('/disposable/hr-test', os.O_RDONLY | os.O_DIRECTORY)
        before = list(calls)
        for path in ('../../private/var/db/agent-deploy-system-config', '/private/var/db/agent-deploy-system-config'):
            with self.assertRaises(FilesystemDenied):
                guard(path, os.O_RDONLY | os.O_DIRECTORY, dir_fd=fd)
            self.assertEqual(calls, before)

    def test_untracked_or_closed_dirfd_has_no_fallback(self):
        guard, calls = self.fixture()
        with self.assertRaisesRegex(FilesystemDenied, 'UNTRACKED_DIRFD'):
            guard('agent-deploy-system-config', os.O_RDONLY, dir_fd=789)
        self.assertEqual(calls, [])
        fd = guard('/disposable/hr-test', os.O_RDONLY | os.O_DIRECTORY)
        guard.forget(fd)
        with self.assertRaisesRegex(FilesystemDenied, 'UNTRACKED_DIRFD'):
            guard('protected.json', os.O_RDONLY, dir_fd=fd)
        self.assertEqual(len(calls), 1)

    def test_import_setup_and_cleanup_share_same_active_guard(self):
        guard, calls = self.fixture()
        observed = []
        # Phases are fake callbacks, not actual target imports/assembly/cleanup.
        for phase in ('import', 'setup', 'verify_proofs', 'owner_close', 'cleanup'):
            with self.assertRaises(FilesystemDenied):
                guard('/private/var/db/agent-deploy-system-config/hr-s256-one-shot-authority.json', os.O_RDONLY)
            observed.append(phase)
        self.assertEqual(observed, ['import', 'setup', 'verify_proofs', 'owner_close', 'cleanup'])
        self.assertEqual(calls, [])

    def test_explicit_read_input_not_writable_and_ancestor_not_readable(self):
        guard, calls = self.fixture()
        guard('/reviewed/input.py', os.O_RDONLY)
        self.assertTrue(calls[0][1] & os.O_NOFOLLOW)
        for path, flags in [('/reviewed/input.py', os.O_WRONLY), ('/private', os.O_RDONLY),
                            ('/reviewed/other.py', os.O_RDONLY)]:
            with self.assertRaises(FilesystemDenied): guard(path, flags)
        self.assertEqual(len(calls), 1)

    def test_zero_process_dispatch_with_fake_only_boundary(self):
        # No subprocess instance/call or original process backend is available.
        guard, calls = self.fixture()
        process_calls = []
        with self.assertRaises(FilesystemDenied):
            guard('/private/var/db/agent-deploy-system-config', os.O_RDONLY | os.O_DIRECTORY)
        self.assertEqual(calls, [])
        self.assertEqual(process_calls, [])

    def test_created_same_identity_alias_cleanup_positive_only(self):
        guard, calls = self.fixture()
        guard.created_alias('/var/folders/hr-test', '/disposable/hr-test', (3, 7), (3, 7))
        fd = guard('/var/folders/hr-test', os.O_RDONLY | os.O_DIRECTORY)
        self.assertEqual(guard.descriptors[fd], '/disposable/hr-test')
        guard('cleanup-file', os.O_WRONLY, dir_fd=fd)
        self.assertEqual(len(calls), 2)
        for path in ('/var/folders/other-test', '/private/var/db/agent-deploy-system-config'):
            with self.assertRaises(FilesystemDenied): guard(path, os.O_RDONLY | os.O_DIRECTORY)
        self.assertEqual(len(calls), 2)

    def test_alias_relative_protected_and_unknown_dirfd_denied(self):
        guard, calls = self.fixture()
        guard.created_alias('/var/folders/hr-test', '/disposable/hr-test', (3, 7), (3, 7))
        fd = guard('/var/folders/hr-test', os.O_RDONLY | os.O_DIRECTORY)
        for path, dirfd in [('../../private/var/db/agent-deploy-system-config', fd),
                            ('protected.json', 991)]:
            with self.assertRaises(FilesystemDenied): guard(path, os.O_RDONLY, dir_fd=dirfd)
        self.assertEqual(len(calls), 1)

    def test_alias_requires_creation_identity_no_broad_roots(self):
        guard, calls = self.fixture()
        for original, canonical, left, right in [('/var/folders/hr-test', '/disposable/hr-test', (3,7), (3,8)),
            ('/var', '/disposable/hr-test', (3,7), (3,7)),
            ('/var/folders/hr-test', '/other/hr-test', (3,7), (3,7))]:
            with self.assertRaises(FilesystemDenied): guard.created_alias(original, canonical, left, right)
        self.assertEqual(calls, [])
