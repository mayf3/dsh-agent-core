"""Disposable filesystem tests for the fixed first-effect root journal reader."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest import mock


HERE = Path(__file__).resolve().parent
OP_DIR = 'hr-shim-shim-hr-admin-fresh-20260928-v1'
OLD = '5661fbd0c7fde5139b10cb1adf9546a1ce507e413d89177b821ddd683146d7f8'
NEW = '53b149bf6e4ca9b99d1946955af4093547ed3a41b6d8d8f5afb8fd4a640b5f80'
HOST = 'FF99ABD5-79A0-5EE0-9E0B-B62671271560'
META = {'uid': 0, 'gid': 0, 'mode': 365, 'flags': 0,
        'acl': 'absent', 'xattrs': []}


def reader_module():
    path = HERE / 'reader.py'
    if not path.is_file():
        raise AssertionError('fixed root journal reader is not implemented')
    spec = importlib.util.spec_from_file_location('hr_first_effect_reader_test', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def intent():
    return {'operationId': 'shim-hr-admin-fresh-20260928-v1',
            'state': 'UNKNOWN', 'hostId': HOST, 'oldSha256': OLD,
            'newSha256': NEW, 'oldMetadata': META, 'oldDsPid': 41199}


def committed():
    return dict(intent(), state='COMMITTED', oldPid=41153, newPid=41237,
                lockNames={'ds': [1, 2], 'shim': [3, 4]})


def encoded(row):
    return json.dumps(row, sort_keys=True, separators=(',', ':')).encode() + b'\n'


class RootJournalTests(unittest.TestCase):
    def setUp(self):
        self.reader = reader_module()
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.parent = Path(self.temp.name)
        self.parent.chmod(0o700)
        self.operation = self.parent / OP_DIR
        self.uid = os.geteuid()

    def observe(self):
        fd = os.open(self.parent, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        try:
            return self.reader._hr_status_from_parent(fd, self.uid)
        finally:
            os.close(fd)

    def make_operation(self):
        self.operation.mkdir(mode=0o700)

    def write_record(self, name, row):
        raw = encoded(row)
        fd = os.open(self.operation / name,
                     os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
                     0o600)
        try:
            os.write(fd, raw)
        finally:
            os.close(fd)
        return raw

    def test_absent_operation_directory_has_no_durable_intent_observed(self):
        before = sorted(p.name for p in self.parent.iterdir())
        self.assertEqual(self.observe(), {'ok': True,
            'status': 'NO_DURABLE_INTENT_OBSERVED', 'recordSha256': None})
        self.assertEqual(sorted(p.name for p in self.parent.iterdir()), before)

    def test_empty_consumed_directory_is_unknown(self):
        self.make_operation()
        self.assertEqual(self.observe(), {'ok': True, 'status': 'UNKNOWN',
                                          'recordSha256': None})

    def test_rollback_without_intent_is_unknown(self):
        self.make_operation()
        (self.operation / 'rollback.py').write_bytes(b'old')
        self.assertEqual(self.observe()['status'], 'UNKNOWN')

    def test_exact_intent_returns_only_status_and_its_record_digest(self):
        self.make_operation()
        raw = self.write_record('intent.json', intent())
        result = self.observe()
        self.assertEqual(result, {'ok': True, 'status': 'INTENT_PRESENT_UNKNOWN',
                                  'recordSha256': hashlib.sha256(raw).hexdigest()})
        self.assertNotIn(HOST, json.dumps(result))
        self.assertEqual(sorted(p.name for p in self.operation.iterdir()),
                         ['intent.json'])

    def test_exact_pair_returns_commit_digest_without_record_contents(self):
        self.make_operation()
        self.write_record('intent.json', intent())
        raw = self.write_record('committed.json', committed())
        self.assertEqual(self.observe(), {'ok': True,
            'status': 'COMMITTED_RECEIPT_PRESENT',
            'recordSha256': hashlib.sha256(raw).hexdigest()})

    def test_unsupported_transaction_record_never_reports_commit(self):
        self.make_operation()
        self.write_record('intent.json', intent())
        self.write_record('committed.json', committed())
        (self.operation / 'aborted.json').write_bytes(b'{}\n')
        (self.operation / 'aborted.json').chmod(0o600)
        self.assertEqual(self.observe(), {'ok': True, 'status': 'UNKNOWN',
                                          'recordSha256': None})

    def test_unsupported_transaction_record_never_reports_intent_digest(self):
        self.make_operation()
        self.write_record('intent.json', intent())
        (self.operation / 'failed.json').write_bytes(b'{}\n')
        (self.operation / 'failed.json').chmod(0o600)
        self.assertEqual(self.observe(), {'ok': True, 'status': 'UNKNOWN',
                                          'recordSha256': None})

    def test_launched_writer_auxiliary_files_have_bounded_metadata_only(self):
        self.make_operation()
        self.write_record('intent.json', intent())
        raw = self.write_record('committed.json', committed())
        old_shim = self.parent / 'old-shim'
        old_shim.write_bytes(b'old shim')
        old_shim.chmod(0o555)
        (self.operation / 'rollback.py').hardlink_to(old_shim)
        (self.operation / 'candidate.py').write_bytes(b'new shim')
        (self.operation / 'candidate.py').chmod(0o400)
        self.assertEqual(self.observe(), {'ok': True,
            'status': 'COMMITTED_RECEIPT_PRESENT',
            'recordSha256': hashlib.sha256(raw).hexdigest()})
        (self.operation / 'candidate.py').unlink()
        (self.operation / 'candidate.py').symlink_to('rollback.py')
        self.assertEqual(self.observe(), {'ok': True, 'status': 'UNKNOWN',
                                          'recordSha256': None})

    def test_reader_opens_only_readonly_descriptors(self):
        self.make_operation()
        self.write_record('intent.json', intent())
        real_open = os.open
        with mock.patch.object(self.reader._hr_os, 'open', wraps=real_open) as opened:
            self.assertEqual(self.observe()['status'], 'INTENT_PRESENT_UNKNOWN')
        self.assertGreaterEqual(opened.call_count, 2)
        for call in opened.call_args_list:
            flags = call.args[1]
            self.assertEqual(flags & os.O_ACCMODE, os.O_RDONLY)
            self.assertFalse(flags & (os.O_CREAT | os.O_TRUNC | os.O_APPEND))

    def test_intent_missing_extra_or_wrong_fixed_fields_is_unknown(self):
        variants = [dict(intent(), hostId='other'),
                    dict(intent(), oldDsPid=True),
                    dict(intent(), oldMetadata=dict(META, mode=0o700)),
                    dict(intent(), unexpected='x')]
        missing = intent()
        del missing['hostId']
        variants.append(missing)
        for row in variants:
            with self.subTest(row=row):
                self.make_operation()
                self.write_record('intent.json', row)
                self.assertEqual(self.observe()['status'], 'UNKNOWN')
                for child in self.operation.iterdir():
                    child.unlink()
                self.operation.rmdir()

    def test_commit_wrong_schema_or_pair_is_unknown(self):
        variants = [dict(committed(), newPid=True),
                    dict(committed(), oldDsPid=99),
                    dict(committed(), lockNames={'ds': [1, 2]}),
                    dict(committed(), lockNames={'ds': [1, 2], 'shim': [3, False]}),
                    dict(committed(), extra='x')]
        missing = committed()
        del missing['oldPid']
        variants.append(missing)
        for row in variants:
            with self.subTest(row=row):
                self.make_operation()
                self.write_record('intent.json', intent())
                self.write_record('committed.json', row)
                self.assertEqual(self.observe()['status'], 'UNKNOWN')
                for child in self.operation.iterdir():
                    child.unlink()
                self.operation.rmdir()

    def test_commit_without_intent_is_unknown(self):
        self.make_operation()
        self.write_record('committed.json', committed())
        self.assertEqual(self.observe()['status'], 'UNKNOWN')

    def test_malformed_duplicate_and_oversized_records_are_unknown(self):
        for raw in (b'{', b'{}', b'{"operationId":1,"operationId":2}',
                    b'{' + b' ' * 4096 + b'}'):
            with self.subTest(raw=raw[:30]):
                self.make_operation()
                (self.operation / 'intent.json').write_bytes(raw)
                (self.operation / 'intent.json').chmod(0o600)
                self.assertEqual(self.observe(), {'ok': True,
                    'status': 'UNKNOWN', 'recordSha256': None})
                (self.operation / 'intent.json').unlink()
                self.operation.rmdir()

    def test_symlinked_record_and_parent_mode_fail_closed(self):
        self.make_operation()
        (self.operation / 'intent.json').symlink_to(self.parent / 'target')
        self.assertEqual(self.observe()['status'], 'UNKNOWN')
        (self.operation / 'intent.json').unlink()
        self.write_record('intent.json', intent())
        self.parent.chmod(0o755)
        self.assertEqual(self.observe(), {'ok': True, 'status': 'UNKNOWN',
                                          'recordSha256': None})

    def test_record_read_error_is_unknown(self):
        self.make_operation()
        self.write_record('intent.json', intent())
        real_open = os.open

        def reject_intent(path, *args, **kwargs):
            if path == 'intent.json':
                raise PermissionError('fixture read refused')
            return real_open(path, *args, **kwargs)

        with mock.patch.object(self.reader._hr_os, 'open', side_effect=reject_intent):
            self.assertEqual(self.observe(), {'ok': True, 'status': 'UNKNOWN',
                                              'recordSha256': None})

    def test_directory_and_file_symlink_hardlink_mode_and_owner_fail_closed(self):
        self.operation.symlink_to(self.parent, target_is_directory=True)
        self.assertEqual(self.observe()['status'], 'UNKNOWN')
        self.operation.unlink()
        self.make_operation()
        self.write_record('intent.json', intent())
        (self.operation / 'second-link').hardlink_to(self.operation / 'intent.json')
        self.assertEqual(self.observe()['status'], 'UNKNOWN')
        (self.operation / 'second-link').unlink()
        (self.operation / 'intent.json').chmod(0o644)
        self.assertEqual(self.observe()['status'], 'UNKNOWN')
        (self.operation / 'intent.json').chmod(0o600)
        fd = os.open(self.parent, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        try:
            self.assertEqual(self.reader._hr_status_from_parent(fd, self.uid + 1)
                             ['status'], 'UNKNOWN')
        finally:
            os.close(fd)

    def test_named_file_replacement_during_read_is_unknown(self):
        self.make_operation()
        self.write_record('intent.json', intent())
        replacement = self.parent / 'replacement'
        replacement.write_bytes(encoded(intent()))
        replacement.chmod(0o600)
        real_read = os.read
        switched = False

        def swap_after_read(fd, amount):
            nonlocal switched
            data = real_read(fd, amount)
            if data and not switched:
                os.replace(replacement, self.operation / 'intent.json')
                switched = True
            return data

        with mock.patch.object(self.reader._hr_os, 'read', side_effect=swap_after_read):
            self.assertEqual(self.observe()['status'], 'UNKNOWN')
        self.assertTrue(switched)


if __name__ == '__main__':
    unittest.main()
