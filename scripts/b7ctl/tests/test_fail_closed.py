import contextlib
import hashlib
import importlib.util
import io
import json
import errno
import os
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

SOURCE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SOURCE))
spec = importlib.util.spec_from_file_location('b7ctl', SOURCE / 'b7ctl.py')
b7 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(b7)
import installer_hardening as ih


def result(rc=0, out=''):
    return SimpleNamespace(returncode=rc, stdout=out, stderr='owned synthetic error')


def invoke(fn, args):
    output = io.StringIO()
    with contextlib.redirect_stdout(output):
        try:
            fn(args)
        except SystemExit as exc:
            return exc.code, output.getvalue()
    return 0, output.getvalue()


class FailClosedTests(unittest.TestCase):
    def preflight(self, observation, root_rc=0, ds_rc=0, runtime_rc=0):
        def root(argv, **unused):
            if argv[0] == 'stat':
                return result(root_rc, str(b7.JOURNAL_PIN_BYTES))
            if argv[0] == 'sh':
                return result(root_rc, b7.JOURNAL_PIN_SHA + '  -')
            return result(observation[0], observation[1])
        def sh(argv, **unused):
            if argv[0] == 'pgrep':
                return result(runtime_rc, '12345')
            return result(ds_rc, json.dumps({'ok': True, 'data': {'phase': 'NO_EXECUTION_RECORD', 'output_available': False, 'execution_enabled': True}}))
        with patch.object(b7, 'root', side_effect=root), patch.object(b7, 'sh', side_effect=sh):
            return invoke(b7.cmd_preflight, SimpleNamespace(op='OWNED_OP'))

    def test_preflight_transport_failure_cannot_prove_absence(self):
        rc, output = self.preflight((2, ''))
        self.assertNotEqual(rc, 0)
        self.assertNotIn('终检全绿', output)

    def test_preflight_only_typed_enoent_is_absent(self):
        self.assertEqual(self.preflight((0, '{"state":"ABSENT_ENOENT"}'))[0], 0)
        for observation in [(1, ''), (0, ''), (0, '{}'), (0, '{"state":"ERROR"}'),
                            (0, '{"state":"PRESENT"}'), (0, '{"state":"ABSENT_ENOENT"}\nextra'),
                            (0, '{"state":"PRESENT","state":"ABSENT_ENOENT"}')]:
            with self.subTest(observation=observation):
                self.assertNotEqual(self.preflight(observation)[0], 0)

    def test_plausible_output_from_failed_required_check_is_failure(self):
        for kwargs in [{'root_rc': 2}, {'ds_rc': 2}, {'runtime_rc': 2}]:
            with self.subTest(kwargs=kwargs):
                self.assertNotEqual(self.preflight((0, '{"state":"ABSENT_ENOENT"}'), **kwargs)[0], 0)

    def test_restore_apply_refuses_before_any_external_read_or_write(self):
        with patch.object(b7, 'root', side_effect=AssertionError('runner must not execute')):
            rc, output = invoke(b7.cmd_restore_journal, SimpleNamespace(apply=True))
        self.assertNotEqual(rc, 0)
        self.assertIn('RECOVERY_AUTHORITY_REQUIRED', output)
        self.assertNotIn('restored', output)

    def test_restore_read_only_retains_appended_tail(self):
        def root(argv, **unused):
            if argv[0] == 'stat':
                return result(out=str(b7.JOURNAL_PIN_BYTES + 10))
            if argv[0] == 'sh':
                return result(out=b7.JOURNAL_PIN_SHA + '  -')
            raise AssertionError('unexpected mutation')
        with patch.object(b7, 'root', side_effect=root):
            rc, output = invoke(b7.cmd_restore_journal, SimpleNamespace(apply=False))
        self.assertEqual(rc, 0)
        self.assertIn('APPENDED_TAIL_RETAINED', output)

    def test_typed_probe_distinguishes_owned_missing_broken_link_and_permission(self):
        def observe(path, failure=None):
            output = io.StringIO()
            with patch.object(sys, 'argv', ['owned-probe', str(path)]), contextlib.redirect_stdout(output):
                try:
                    if failure:
                        with patch.object(os, 'lstat', side_effect=failure):
                            exec(compile(b7.ABSENCE_PROBE, '<owned-stat>', 'exec'), {})
                    else:
                        exec(compile(b7.ABSENCE_PROBE, '<owned-stat>', 'exec'), {})
                except SystemExit as exc:
                    return exc.code, json.loads(output.getvalue())
        with tempfile.TemporaryDirectory() as directory:
            missing = Path(directory) / 'missing'
            link = Path(directory) / 'broken'
            link.symlink_to(missing)
            self.assertEqual(observe(missing), (0, {'state': 'ABSENT_ENOENT'}))
            self.assertEqual(observe(link), (0, {'state': 'PRESENT'}))
            self.assertEqual(observe(missing, PermissionError(errno.EACCES, 'owned')),
                             (2, {'state': 'ERROR'}))
            self.assertTrue(link.is_symlink())

    def test_restore_read_errors_short_file_and_wrong_prefix_fail(self):
        for size, digest, code in [('bad', b7.JOURNAL_PIN_SHA, 0),
                                   (str(b7.JOURNAL_PIN_BYTES - 1), b7.JOURNAL_PIN_SHA, 0),
                                   (str(b7.JOURNAL_PIN_BYTES), '0' * 64, 0),
                                   (str(b7.JOURNAL_PIN_BYTES), b7.JOURNAL_PIN_SHA, 2)]:
            def root(argv, **unused):
                return result(code, size if argv[0] == 'stat' else digest + '  -')
            with self.subTest(size=size, digest=digest, code=code), patch.object(b7, 'root', side_effect=root):
                self.assertNotEqual(invoke(b7.cmd_restore_journal, SimpleNamespace(apply=False))[0], 0)

    def receipt(self, directory, changes=None):
        data = {'kind': 'DS_B7_PACKET_REGISTRATION_V1', 'version': 1,
                'action': 'B7_PACKET_REGISTER_V1', 'state': 'REGISTERED_ONLY',
                'operation_id': 'OWNED_OP', 'registered_peer_uid': 502,
                'binding': {'manifestSha256': 'a' * 64}}
        data.update(changes or {})
        path = Path(directory) / 'receipt.json'
        path.write_text(json.dumps(data))
        return SimpleNamespace(op='OWNED_OP', manifest_sha256='a' * 64,
                               registration_receipt=str(path),
                               registration_receipt_sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
                               apply=False)

    def harden(self, args, layers=None, repaired=None):
        with patch.object(ih, 'check_access_layers', side_effect=layers or [([], [])]), \
             patch.object(ih, 'apply_repairs', return_value=repaired or []):
            return invoke(b7.cmd_harden, args)

    def test_harden_requires_exact_native_receipt_not_empty_old_glob(self):
        with tempfile.TemporaryDirectory() as directory:
            args = self.receipt(directory)
            self.assertEqual(self.harden(args)[0], 0)
            Path(args.registration_receipt).unlink()
            self.assertNotEqual(self.harden(args)[0], 0)

    def test_harden_rejects_failed_access_and_receipt_predicates(self):
        with tempfile.TemporaryDirectory() as directory:
            args = self.receipt(directory)
            self.assertNotEqual(self.harden(args, layers=[([{'check': 'owned', 'path': '/owned', 'detail': 'denied'}], [])])[0], 0)
            for changes in [{'operation_id': 'OLD_OP'}, {'registered_peer_uid': True},
                            {'binding': {'manifestSha256': 'b' * 64}}, {'state': 'FAILED'},
                            {'version': True}, {'kind': 'OTHER'}, {'action': 'OTHER'}]:
                with self.subTest(changes=changes):
                    self.assertNotEqual(self.harden(self.receipt(directory, changes))[0], 0)

    def test_harden_rejects_changed_receipt_bytes_and_duplicate_keys(self):
        with tempfile.TemporaryDirectory() as directory:
            args = self.receipt(directory)
            Path(args.registration_receipt).write_text('{}')
            self.assertNotEqual(self.harden(args)[0], 0)
            raw = '{"operation_id":"OWNED_OP","operation_id":"OLD_OP"}'
            Path(args.registration_receipt).write_text(raw)
            args.registration_receipt_sha256 = hashlib.sha256(raw.encode()).hexdigest()
            self.assertNotEqual(self.harden(args)[0], 0)

    def test_harden_apply_uses_fresh_checks_and_failed_repair_is_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            args = self.receipt(directory); args.apply = True
            failure = {'check': 'owned', 'path': '/owned', 'detail': 'repair needed'}
            self.assertNotEqual(self.harden(args, layers=[([failure], [{}]), ([failure], [])], repaired=[{'ok': True}])[0], 0)
            self.assertNotEqual(self.harden(args, layers=[([failure], [{}]), ([], [])], repaired=[{'ok': False}])[0], 0)
            self.assertEqual(self.harden(args, layers=[([failure], [{}]), ([], [])], repaired=[{'ok': True}])[0], 0)

    def test_invalid_required_receipt_cannot_start_optional_repairs(self):
        with tempfile.TemporaryDirectory() as directory:
            args = self.receipt(directory, {'operation_id': 'OTHER'}); args.apply = True
            with patch.object(ih, 'check_access_layers', return_value=([], [{}])), \
                 patch.object(ih, 'apply_repairs', side_effect=AssertionError('repair cannot precede required binding')):
                self.assertNotEqual(invoke(b7.cmd_harden, args)[0], 0)

    def test_standalone_apply_rechecks_even_without_repairs(self):
        with tempfile.TemporaryDirectory() as directory:
            args = self.receipt(directory)
            argv = ['--op', args.op, '--manifest-sha256', args.manifest_sha256,
                    '--registration-receipt', args.registration_receipt,
                    '--registration-receipt-sha256', args.registration_receipt_sha256, '--apply']
            failure = {'check': 'owned', 'path': '/owned', 'detail': 'changed after inspection'}
            with patch.object(ih, 'check_access_layers', side_effect=[([], []), ([failure], [])]), \
                 patch.object(ih, 'apply_repairs', return_value=[]), contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(ih.main(argv), 1)

    def test_harden_missing_or_malformed_required_input_is_usage_failure(self):
        for argv in [['b7ctl', 'harden'], ['b7ctl', 'harden', '--op', 'OWNED',
                     '--manifest-sha256', 'bad', '--registration-receipt', '/owned',
                     '--registration-receipt-sha256', 'a' * 64]]:
            with self.subTest(argv=argv), patch.object(sys, 'argv', argv), \
                 patch.object(b7, 'cmd_harden', side_effect=AssertionError('usage must fail before checks')), \
                 contextlib.redirect_stderr(io.StringIO()):
                with self.assertRaises(SystemExit) as raised:
                    b7.main()
                self.assertEqual(raised.exception.code, 2)


if __name__ == '__main__':
    unittest.main()
