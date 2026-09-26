"""Original V7 producer tests: disposable inputs, outer process deny, pure commands."""
from contextlib import contextmanager
import unittest
import os
import json
import stat
from types import SimpleNamespace
from unittest.mock import patch

import test_owned_stop as owned_fixture


class StopProducerTest(unittest.TestCase):
    @contextmanager
    def controller(self):
        with owned_fixture.OwnedStopTest().fixture() as (ds, owner, lock, window, path):
            stopper = owner.fixed_stop()
            calls = []
            def synthetic(route, verb, deadline):
                calls.append((route, verb, deadline))
                return 0 if verb == 'bootout' else 113
            method = type(stopper).stop
            cell = dict(zip(method.__code__.co_freevars, method.__closure__))['command']
            original = cell.cell_contents
            try:
                cell.cell_contents = synthetic
                with patch.object(ds.HR_REAL_OS, 'require_activation', return_value={'hostId': 'fixture-host'}), patch.object(
                        ds.HR_REAL_OS, 'deployed_prerequisites', return_value={}), patch.object(
                        ds.HR_INVENTORY, 'fixed_installed_inventory', return_value={'unresolvedSources': []}):
                    yield ds, owner, stopper, path, calls
            finally:
                cell.cell_contents = original

    @contextmanager
    def stopped(self):
        with self.controller() as (ds, owner, stopper, path, calls):
            result = stopper.stop()
            yield ds, owner, stopper, path, result, calls

    def test_owned_completion_produces_original_four_fields_only(self):
        with self.stopped() as (ds, owner, stopper, path, result, calls):
            self.assertTrue((path.parent / 'controlled-stop.json').exists())
            record, digest = ds.HR_STOP_RECEIPT.readback()
            self.assertEqual(set(record), {'operationId', 'hostId', 'method', 'atWallMs'})
            self.assertEqual(record['hostId'], 'fixture-host')
            self.assertEqual(result, {'method': record['method'], 'receiptSha256': digest,
                                      'atWallMs': record['atWallMs']})
            self.assertEqual(len(calls), 4)

    def test_duplicate_and_sibling_stop_cannot_replay_or_reseal(self):
        with self.stopped() as (ds, owner, stopper, path, _, calls):
            before = (path.parent / 'controlled-stop.json').read_bytes()
            with self.assertRaisesRegex(Exception, 'STOP_NO_REPLAY'):
                stopper.stop()
            with self.assertRaisesRegex(Exception, 'STOP_COMPLETION_UNKNOWN'):
                ds.HR_STOP_RECEIPT.seal_completed(stopper)
            with self.assertRaisesRegex(Exception, 'STOP_RECEIPT_EXISTS|OWNED_STOP_NO_REPLAY'):
                owner.fixed_stop().stop()
            self.assertEqual(len(calls), 4)
            self.assertEqual((path.parent / 'controlled-stop.json').read_bytes(), before)

    def test_preexisting_receipt_prevents_any_stop_effect(self):
        with self.controller() as (ds, owner, stopper, path, calls):
            target = path.parent / 'controlled-stop.json'
            target.write_bytes(b'prior-unknown')
            with self.assertRaisesRegex(Exception, 'STOP_RECEIPT_EXISTS'):
                stopper.stop()
            self.assertEqual(calls, [])
            self.assertEqual(target.read_bytes(), b'prior-unknown')

    def test_failed_or_unknown_stop_never_writes_receipt(self):
        with self.controller() as (ds, owner, stopper, path, calls):
            method = type(stopper).stop
            cell = dict(zip(method.__code__.co_freevars, method.__closure__))['command']
            cell.cell_contents = lambda *args: 1
            with self.assertRaisesRegex(Exception, 'STOP_UNKNOWN'):
                stopper.stop()
            self.assertFalse((path.parent / 'controlled-stop.json').exists())
            with self.assertRaisesRegex(Exception, 'STOP_COMPLETION_UNKNOWN'):
                ds.HR_STOP_RECEIPT.seal_completed(stopper)
            with self.assertRaisesRegex(Exception, 'OWNED_STOP_NO_REPLAY'):
                owner.fixed_stop().stop()

    def test_observed_window_loss_no_receipt_or_recovered_positive(self):
        import fcntl
        with self.controller() as (ds, owner, stopper, path, calls):
            method = type(stopper).stop
            cell = dict(zip(method.__code__.co_freevars, method.__closure__))['command']
            def lost(*args):
                fcntl.flock(owner.window, fcntl.LOCK_UN)
                return 0 if args[1] == 'bootout' else 113
            cell.cell_contents = lost
            with self.assertRaisesRegex(Exception, 'OWNED_LOCK_RELEASED'):
                stopper.stop()
            fcntl.flock(owner.window, fcntl.LOCK_EX | fcntl.LOCK_NB)
            self.assertFalse((path.parent / 'controlled-stop.json').exists())
            with self.assertRaisesRegex(Exception, 'OWNED_CUSTODY_UNKNOWN'):
                owner.fixed_stop()

    def test_raced_existing_file_is_preserved_and_claim_consumed(self):
        with self.controller() as (ds, owner, stopper, path, calls):
            target = path.parent / 'controlled-stop.json'
            original_open = os.open
            def race(name, flags, *args, **kwargs):
                if name == 'controlled-stop.json' and flags & os.O_CREAT:
                    target.write_bytes(b'raced-unknown')
                return original_open(name, flags, *args, **kwargs)
            with patch.object(ds.HR_STOP_RECEIPT.os, 'open', side_effect=race):
                with self.assertRaisesRegex(Exception, 'STOP_RECEIPT_CREATE_UNKNOWN'):
                    stopper.stop()
            self.assertEqual(target.read_bytes(), b'raced-unknown')
            with self.assertRaisesRegex(Exception, 'STOP_COMPLETION_UNKNOWN'):
                ds.HR_STOP_RECEIPT.seal_completed(stopper)
            self.assertEqual(len(calls), 4)

    def test_partial_write_unknown_is_retained_never_retried(self):
        with self.controller() as (ds, owner, stopper, path, calls):
            target = path.parent / 'controlled-stop.json'
            original_write = os.write
            def fail(fd, view):
                original_write(fd, view[:5])
                raise OSError('synthetic interrupted write')
            with patch.object(ds.HR_STOP_RECEIPT.os, 'write', side_effect=fail):
                with self.assertRaisesRegex(Exception, 'STOP_RECEIPT_CREATE_UNKNOWN'):
                    stopper.stop()
            before = target.read_bytes()
            self.assertTrue(before)
            with self.assertRaisesRegex(Exception, 'STOP_NO_REPLAY'):
                stopper.stop()
            with self.assertRaisesRegex(Exception, 'STOP_COMPLETION_UNKNOWN'):
                ds.HR_STOP_RECEIPT.seal_completed(stopper)
            with self.assertRaisesRegex(Exception, 'STOP_RECEIPT_UNKNOWN'):
                ds.HR_STOP_RECEIPT.readback()
            self.assertEqual(target.read_bytes(), before)

    def test_preflight_unknown_and_invalid_completion_time_never_produce(self):
        with self.controller() as (ds, owner, stopper, path, calls):
            with patch.object(ds.HR_REAL_OS, 'deployed_prerequisites', side_effect=RuntimeError('unknown')):
                with self.assertRaisesRegex(RuntimeError, 'unknown'):
                    stopper.stop()
            self.assertEqual(calls, [])
            with self.assertRaisesRegex(Exception, 'STOP_NO_REPLAY'):
                stopper.stop()
            with self.assertRaisesRegex(Exception, 'OWNED_STOP_NO_REPLAY'):
                owner.fixed_stop().stop()
        with self.controller() as (ds, owner, stopper, path, calls):
            with patch.object(ds.HR_FINITE_STOP.time, 'time', return_value=0.097):
                with self.assertRaisesRegex(Exception, 'STOP_COMPLETION_TIME_UNKNOWN'):
                    stopper.stop()
            self.assertFalse((path.parent / 'controlled-stop.json').exists())
            with self.assertRaisesRegex(Exception, 'STOP_NO_REPLAY'):
                stopper.stop()

    def test_no_caller_pass_or_uncompleted_object_can_seal(self):
        with self.controller() as (ds, owner, stopper, path, calls):
            for candidate in (stopper, SimpleNamespace(complete=True, hostId='fixture-host')):
                with self.assertRaisesRegex(Exception, 'STOP_COMPLETION_UNKNOWN'):
                    ds.HR_STOP_RECEIPT.seal_completed(candidate)
            self.assertEqual(calls, [])
            self.assertFalse((path.parent / 'controlled-stop.json').exists())

    def test_loss_after_fsync_preserves_actual_receipt_unknown_no_ack(self):
        import fcntl
        with self.controller() as (ds, owner, stopper, path, calls):
            original = os.fsync
            def lose(fd):
                original(fd)
                fcntl.flock(owner.window, fcntl.LOCK_UN)
            with patch.object(ds.HR_STOP_RECEIPT.os, 'fsync', side_effect=lose):
                with self.assertRaisesRegex(Exception, 'OWNED_LOCK_RELEASED'):
                    stopper.stop()
            target = path.parent / 'controlled-stop.json'
            before = target.read_bytes()
            self.assertTrue(before)
            fcntl.flock(owner.window, fcntl.LOCK_EX | fcntl.LOCK_NB)
            with self.assertRaisesRegex(Exception, 'OWNED_CUSTODY_UNKNOWN'):
                owner.fixed_stop()
            self.assertEqual(target.read_bytes(), before)
            self.assertEqual(len(calls), 4)

    def test_readback_tamper_unknown_and_cannot_retry_receipt(self):
        with self.controller() as (ds, owner, stopper, path, calls):
            target = path.parent / 'controlled-stop.json'
            original = os.fsync
            def tamper(fd):
                original(fd)
                if stat.S_ISDIR(os.fstat(fd).st_mode):
                    record = json.loads(target.read_text())
                    record['hostId'] = 'tampered-host'
                    target.write_bytes(ds.HR_JOURNAL.canonical(record))
            with patch.object(ds.HR_STOP_RECEIPT.os, 'fsync', side_effect=tamper):
                with self.assertRaisesRegex(Exception, 'STOP_RECEIPT_READBACK_UNKNOWN'):
                    stopper.stop()
            before = target.read_bytes()
            with self.assertRaisesRegex(Exception, 'STOP_COMPLETION_UNKNOWN'):
                ds.HR_STOP_RECEIPT.seal_completed(stopper)
            self.assertEqual(target.read_bytes(), before)

    def test_receipt_byte_cap_rejects_before_write(self):
        with self.controller() as (ds, owner, stopper, path, calls):
            with patch.object(ds.HR_REAL_OS, 'require_activation', return_value={'hostId': '\U0001f600' * 128}):
                with self.assertRaisesRegex(Exception, 'STOP_RECEIPT_BOUND'):
                    stopper.stop()
            self.assertFalse((path.parent / 'controlled-stop.json').exists())

    def test_actual_bundle_join_binds_produced_receipt(self):
        with self.stopped() as (ds, owner, stopper, path, result, calls):
            bundle = {'controlledStop': result,
                'custody': {'evidenceDir': str(path.parent)},
                'recoveryCutover': {'hostId': 'fixture-host', 'windowOpenedAtWallMs': owner.opened_at,
                    'oldTreeQuiescedAtWallMs': result['atWallMs'] + 1}}
            ds.HR_STOP_RECEIPT.validate(bundle)
            bundle['controlledStop'] = {**result, 'receiptSha256': '0' * 64}
            with self.assertRaisesRegex(Exception, 'STOP_RECEIPT_BINDING'):
                ds.HR_STOP_RECEIPT.validate(bundle)


if __name__ == '__main__':
    unittest.main()
