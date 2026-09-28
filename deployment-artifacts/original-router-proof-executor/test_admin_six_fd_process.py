"""Isolated six-FD carrier/launcher/driver composition with disposable OS effects.

Actual compiled entry code, socket challenge, SCM_RIGHTS and OFDs run in
separate processes. Root metadata, fixed protected paths, and the final DS
effect are synthetic boundaries; this is never a host qualification proof.
"""
import builtins
import fcntl
import hashlib
import json
import os
from pathlib import Path
import signal
import socket
import stat
import subprocess
import sys
import tempfile
import time
import types
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent))  # Own test modules under -I.
import admin_package
import test_admin_package as package_fixture


class RootMetadataBoundary:
    def __getattr__(self, name): return getattr(os, name)
    @staticmethod
    def _root(meta):
        return types.SimpleNamespace(**{name: getattr(meta, name) for name in
            ('st_mode', 'st_uid', 'st_gid', 'st_nlink', 'st_dev', 'st_ino',
             'st_size', 'st_mtime_ns', 'st_ctime_ns')}, st_test=0)
    def stat(self, *args, **kwargs):
        value = self._root(os.stat(*args, **kwargs));value.st_uid = 0;return value
    def fstat(self, fd):
        value = self._root(os.fstat(fd));value.st_uid = 0;return value
    def geteuid(self): return 0


def _child(package, fd_arg, marker):
    """Run the exact compiled launcher source behind a non-root metadata shim."""
    entry = package / 'admin_launcher.py'
    raw = entry.read_bytes()
    module = types.ModuleType('_disposable_compiled_launcher')
    module.__file__ = str(entry)
    exec(compile(raw, str(entry), 'exec'), module.__dict__)
    module.os = RootMetadataBoundary()
    original_lstat = Path.lstat
    original_exec = builtins.exec
    uid = os.getuid()

    def root_lstat(self, *args, **kwargs):
        value = RootMetadataBoundary._root(original_lstat(self, *args, **kwargs))
        if str(self).startswith(str(package)): value.st_uid = 0
        return value

    def confined_exec(code, globals=None, locals=None):
        value = original_exec(code, globals, locals)
        name = getattr(code, 'co_filename', '')
        if name == str(package / 'driver.py'):
            globals['os'] = RootMetadataBoundary()
            globals['_namespace_directory'] = lambda fixed: os.open(
                package.parent if fixed.endswith('original-router-qualification-20260927-v1')
                else package, os.O_RDONLY | os.O_DIRECTORY)
        elif name == 'hr-s256-r2-child-proof.py':
            prove = globals['prove']
            globals['prove'] = lambda challenge, window, receipt: prove(
                challenge, window, receipt, trusted_uid=uid)
        elif name == 'original-admin-procedure.py':
            def disposable_effect(owner):
                owner._effect_started = True
                fd = os.open(package.parent / 'canonical.lock', os.O_RDWR | os.O_CREAT, 0o600)
                fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
                owner._canonical_fd = fd
                phase = subprocess.Popen([sys.executable, '-I', '-S', '-c',
                    'import time;time.sleep(15)'], stdin=subprocess.DEVNULL,
                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                    close_fds=True)
                owner._child = phase;owner._owned_children = [phase]
                marker.write_text(json.dumps({'launcherPid': os.getpid(),
                    'phasePid': phase.pid}))
                raise TimeoutError('ORIGINAL_PROCEDURE_DEADLINE')
            globals['_run_admin_owned'] = disposable_effect
        return value

    sys.argv = [str(entry), '--original-qualification-fds', fd_arg]
    with patch.object(Path, 'lstat', root_lstat), \
         patch.object(builtins, 'exec', confined_exec):
        module.run()


class SixFdActualProcessTest(unittest.TestCase):
    def test_timeout_retains_same_child_o_fd_and_unknown_receipt(self):
        with tempfile.TemporaryDirectory(prefix='admin-six-fd-') as root:
            root = Path(root);package = root / 'package';package.mkdir()
            digest = package_fixture.FixedAdminPackageTest().disposable_package(admin_package, package)
            with patch.object(admin_package, 'PACKAGE_ROOT', package), \
                 patch.object(admin_package, 'REVIEWED_PACKAGE_SHA256', digest):
                launcher = admin_package.compile_fixed_admin_qualification()
                carrier_raw = admin_package.compile_fixed_admin_carrier()
            (package / 'admin_launcher.py').write_bytes(launcher)
            (package / 'admin_root_carrier.py').write_bytes(carrier_raw)
            marker = root / 'post-effect.json'
            ready_r, ready_w = os.pipe()
            carrier_pid = os.fork()
            if carrier_pid == 0:
                os.close(ready_r)
                launched = None
                try:
                    carrier = types.ModuleType('_disposable_compiled_carrier')
                    carrier.__file__ = str(package / 'admin_root_carrier.py')
                    exec(compile(carrier_raw, carrier.__file__, 'exec'), carrier.__dict__)
                    carrier.PACKAGE_DIRECTORY = package
                    carrier.WINDOW_DIRECTORY = root
                    carrier.PROOF_DIRECTORY = root / 'proof'
                    carrier.os = RootMetadataBoundary()
                    carrier._directory = lambda path: (os.open(
                        package if path == package else root, os.O_RDONLY | os.O_DIRECTORY), [])
                    file_read = carrier._file
                    carrier._file = lambda directory, name, sha, limit: (
                        os.open(package / 'python-runtime', os.O_RDONLY | os.O_NOFOLLOW)
                        if name == 'python3' else file_read(directory, name, sha, limit))
                    retain = carrier._retain_unknown
                    def observed_retain(directory, window, process, reason):
                        (root / 'carrier-unknown.txt').write_text(reason)
                        return retain(directory, window, process, reason)
                    carrier._retain_unknown = observed_retain
                    actual_popen = subprocess.Popen
                    def fixed_child(argv, **kwargs):
                        nonlocal launched
                        self.assertEqual(len(kwargs['pass_fds']), 6)
                        fd_arg = argv[-1]
                        with open(root / 'launcher.err', 'wb') as diagnostic:
                            launched = actual_popen([sys.executable, '-I', '-S', '-B',
                                str(Path(__file__)), '--disposable-child', str(package),
                                fd_arg, str(marker)], pass_fds=kwargs['pass_fds'],
                                close_fds=True, stdin=subprocess.DEVNULL,
                                stdout=subprocess.DEVNULL, stderr=diagnostic)
                        class WaitBoundary:
                            def wait(self, timeout):
                                limit = time.monotonic() + 2
                                while not marker.exists() and time.monotonic() < limit:
                                    time.sleep(.005)
                                if not marker.exists(): raise AssertionError('CHILD_EFFECT_NOT_REACHED')
                                raise subprocess.TimeoutExpired(argv, timeout)
                            def poll(self): return launched.poll()
                        return WaitBoundary()
                    original_lstat = Path.lstat
                    def root_lstat(self, *args, **kwargs):
                        value = RootMetadataBoundary._root(original_lstat(self, *args, **kwargs))
                        if str(self).startswith(str(package)): value.st_uid = 0
                        return value
                    os.write(ready_w, b'STARTED\n')
                    with patch.object(Path, 'lstat', root_lstat), \
                         patch.object(subprocess, 'Popen', fixed_child), \
                         patch.object(carrier.sys, 'argv', [str(package / 'admin_root_carrier.py')]):
                        carrier.run()
                except BaseException as exc:
                    os.write(ready_w, ('ERROR:' + repr(exc)).encode() + b'\n')
                finally:
                    os._exit(2)
            os.close(ready_w)
            launcher_pid = phase_pid = None
            try:
                import select
                readable, _, _ = select.select([ready_r], [], [], 3)
                self.assertTrue(readable)
                self.assertEqual(os.read(ready_r, 128), b'STARTED\n')
                limit = time.monotonic() + 3
                while (not marker.exists() or not (root / 'qualification-unknown.json').exists()) \
                        and time.monotonic() < limit:
                    time.sleep(.005)
                detail = (root / 'launcher.err').read_text() if (root / 'launcher.err').exists() else ''
                if (root / 'carrier-unknown.txt').exists():
                    detail += ' carrier=' + (root / 'carrier-unknown.txt').read_text()
                self.assertTrue(marker.exists(), 'compiled child did not reach effect: ' + detail)
                identity = json.loads(marker.read_bytes())
                launcher_pid, phase_pid = identity['launcherPid'], identity['phasePid']
                receipt = json.loads((root / 'qualification-unknown.json').read_bytes())
                self.assertEqual((receipt['qualificationOperationId'], receipt['disposition']),
                    ('original-router-qualification-20260927-v1', 'UNKNOWN'))
                os.close(ready_r); ready_r = None  # Root caller disconnects.
                for pid in (carrier_pid, launcher_pid, phase_pid): os.kill(pid, 0)
                for name in ('window.lock', 'canonical.lock'):
                    probe = os.open(root / name, os.O_RDWR)
                    try:
                        with self.assertRaises(BlockingIOError):
                            fcntl.flock(probe, fcntl.LOCK_EX | fcntl.LOCK_NB)
                    finally: os.close(probe)
                with self.assertRaises(FileExistsError):
                    os.open(root / 'window.lock', os.O_CREAT | os.O_EXCL | os.O_RDWR, 0o600)
            finally:
                if ready_r is not None: os.close(ready_r)
                for pid in (phase_pid, launcher_pid, carrier_pid):
                    if pid is not None:
                        try: os.kill(pid, signal.SIGKILL)
                        except ProcessLookupError: pass
                os.waitpid(carrier_pid, 0)


if __name__ == '__main__':
    if len(sys.argv) == 5 and sys.argv[1] == '--disposable-child':
        _child(Path(sys.argv[2]), sys.argv[3], Path(sys.argv[4]))
    else:
        unittest.main()
