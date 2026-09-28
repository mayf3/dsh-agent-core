"""Disposable process/OFD regression for the fixed original custodian.

The local root-UID metadata boundary is synthetic. No protected namespace,
installed carrier, DS action, or actual qualification procedure is invoked.
"""
import fcntl
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

import admin_root_carrier_template as carrier
import driver


class RootMetadataBoundary:
    """Only the disposable files receive root-shaped metadata in this test."""
    def __getattr__(self, name):
        return getattr(os, name)

    @staticmethod
    def _shape(meta):
        return types.SimpleNamespace(**{name: getattr(meta, name) for name in
            ('st_mode', 'st_uid', 'st_gid', 'st_nlink', 'st_dev', 'st_ino',
             'st_size', 'st_mtime_ns', 'st_ctime_ns')})

    def stat(self, *args, **kwargs):
        shaped = self._shape(os.stat(*args, **kwargs))
        shaped.st_uid = 0
        return shaped

    def fstat(self, fd):
        shaped = self._shape(os.fstat(fd))
        shaped.st_uid = 0
        return shaped


class ActualFdCustodyTest(unittest.TestCase):
    def test_carrier_timeout_and_disconnect_keep_same_owned_objects(self):
        for reason in ('ADMIN_CARRIER_DEADLINE', 'ADMIN_CARRIER_DISCONNECTED'):
            window = object(); process = object(); observed = []
            def record(directory, held, actual_reason):
                observed.append(('journal', directory, held, actual_reason))
            def park(held, child):
                observed.append(('park', held, child))
                raise RuntimeError('TEST_PASSIVE_CUSTODY')
            with patch.object(carrier, '_record_unknown', side_effect=record), \
                 patch.object(carrier, '_park_unknown', side_effect=park):
                with self.assertRaisesRegex(RuntimeError, 'TEST_PASSIVE_CUSTODY'):
                    carrier._retain_unknown(5, window, process, reason)
            self.assertEqual(observed, [('journal', 5, window, reason),
                                        ('park', window, process)])

    def test_carrier_unknown_journal_exact_disposable_readback(self):
        with tempfile.TemporaryDirectory(prefix='admin-carrier-journal-') as root:
            directory = Path(root)
            window = os.open(directory / 'window.lock', os.O_RDWR | os.O_CREAT |
                             os.O_EXCL, 0o600)
            parent = os.open(root, os.O_RDONLY | os.O_DIRECTORY)
            previous_os, previous_pins = carrier.os, carrier.PINS
            carrier.os = RootMetadataBoundary()
            carrier.PINS = {'qualificationOperationId': driver.ID}
            try:
                digest = carrier._record_unknown(parent, window,
                                                 'ADMIN_CARRIER_DEADLINE')
                raw = (directory / 'qualification-unknown.json').read_bytes()
                self.assertEqual(hashlib.sha256(raw).hexdigest(), digest)
                self.assertEqual(json.loads(raw), {'version': 1,
                    'qualificationOperationId': driver.ID,
                    'disposition': 'UNKNOWN', 'reason': 'ADMIN_CARRIER_DEADLINE'})
                with self.assertRaises(FileExistsError):
                    carrier._record_unknown(parent, window,
                                            'ADMIN_CARRIER_DISCONNECTED')
            finally:
                carrier.os, carrier.PINS = previous_os, previous_pins
                os.close(parent); os.close(window)

    def test_disconnected_parent_leaves_original_owner_and_phase_child(self):
        with tempfile.TemporaryDirectory(prefix='admin-qualification-custody-') as root:
            directory = Path(root)
            window = os.open(directory / 'window.lock', os.O_RDWR | os.O_CREAT |
                             os.O_EXCL, 0o600)
            canonical = os.open(directory / 'mutation.lock', os.O_RDWR | os.O_CREAT |
                                os.O_EXCL, 0o600)
            fcntl.flock(window, fcntl.LOCK_EX | fcntl.LOCK_NB)
            fcntl.flock(canonical, fcntl.LOCK_EX | fcntl.LOCK_NB)
            read_fd, write_fd = os.pipe()
            pid = os.fork()
            if pid == 0:
                os.close(read_fd)
                phase = None
                try:
                    phase = subprocess.Popen([sys.executable, '-I', '-S', '-c',
                        'import time; time.sleep(10)'], stdin=subprocess.DEVNULL,
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                        close_fds=True)
                    owner = object.__new__(driver.FixedOriginalDriver)
                    owner._effect_started = True
                    owner._unknown = False
                    owner._window_fd = window
                    owner._canonical_fd = canonical
                    owner._child = phase
                    owner._owned_children = [phase]
                    owner._stopped_children = set()
                    original_namespace = driver._namespace_directory
                    original_os = driver.os
                    original_record = owner._record_unknown
                    driver._namespace_directory = lambda fixed: os.open(root, os.O_RDONLY |
                                                                       os.O_DIRECTORY)
                    driver.os = RootMetadataBoundary()
                    def record(reason):
                        digest = original_record(reason)
                        os.write(write_fd, json.dumps({'digest': digest,
                            'phasePid': phase.pid, 'ownerPid': os.getpid(),
                            'windowFd': owner._window_fd,
                            'canonicalFd': owner._canonical_fd}).encode() + b'\n')
                        return digest
                    owner._record_unknown = record
                    owner._retain_unknown('ORIGINAL_PROCEDURE_DEADLINE')
                except BaseException as exc:
                    os.write(write_fd, ('ERROR:' + repr(exc)).encode() + b'\n')
                finally:
                    if phase is not None: phase.terminate()
                    os._exit(2)
            os.close(write_fd)
            os.close(window)
            os.close(canonical)
            phase_pid = None
            try:
                import select
                readable, _, _ = select.select([read_fd], [], [], 3)
                self.assertTrue(readable, 'custodian did not journal within 3s')
                line = os.read(read_fd, 2048).split(b'\n', 1)[0]
                self.assertFalse(line.startswith(b'ERROR:'), line.decode())
                value = json.loads(line)
                phase_pid = value['phasePid']
                os.close(read_fd); read_fd = None  # Parent channel disconnects.
                receipt = (directory / 'qualification-unknown.json').read_bytes()
                self.assertEqual(hashlib.sha256(receipt).hexdigest(), value['digest'])
                self.assertEqual(json.loads(receipt), {'version': 1,
                    'qualificationOperationId': driver.ID,
                    'disposition': 'UNKNOWN',
                    'reason': 'ORIGINAL_PROCEDURE_DEADLINE'})
                os.kill(pid, 0)
                os.kill(phase_pid, 0)
                for name in ('window.lock', 'mutation.lock'):
                    probe = os.open(directory / name, os.O_RDWR)
                    try:
                        with self.assertRaises(BlockingIOError):
                            fcntl.flock(probe, fcntl.LOCK_EX | fcntl.LOCK_NB)
                    finally:
                        os.close(probe)
                with self.assertRaises(FileExistsError):
                    os.open(directory / 'window.lock', os.O_RDWR | os.O_CREAT |
                            os.O_EXCL, 0o600)
                with self.assertRaises(FileExistsError):
                    os.open(directory / 'qualification-unknown.json', os.O_RDWR |
                            os.O_CREAT | os.O_EXCL, 0o600)
            finally:
                if read_fd is not None: os.close(read_fd)
                try: os.kill(pid, signal.SIGKILL)
                except ProcessLookupError: pass
                os.waitpid(pid, 0)
                if phase_pid is not None:
                    try: os.kill(phase_pid, signal.SIGKILL)
                    except ProcessLookupError: pass


if __name__ == '__main__':
    unittest.main()
