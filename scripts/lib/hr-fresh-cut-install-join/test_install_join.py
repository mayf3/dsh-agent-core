"""Offline behavior tests for the exact installed-shim DS update seam."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import types
import unittest


HERE = Path(__file__).resolve().parent
BASE = Path('/usr/local/libexec/agent-deploy-shim/deploy_shim.py')
NAMES = ('deployment_system.py', 'ds_client.py', 'deployment-registry.json', 'plist')
OPERATION = 'hr-fresh-cut-ds-install-test-001'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def candidate_source():
    raw = BASE.read_bytes()
    builder = HERE / 'assemble.py'
    if not builder.exists():
        return raw
    spec = importlib.util.spec_from_file_location('hr_install_assemble', builder)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.assemble_shim(raw)


class InstallJoinTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='hr-ds-install-')
        self.addCleanup(self.tmp.cleanup)
        root = Path(self.tmp.name)
        paths = {
            'SHIM_TEST_MODE': '1',
            'SHIM_STATE_ROOT': str(root / 'shim-state'),
            'SHIM_DS_INSTALL_DIR': str(root / 'ds-install'),
            'SHIM_DS_CONFIG_DIR': str(root / 'ds-config'),
            'SHIM_DS_STATE': str(root / 'ds-state'),
            'SHIM_DS_GEN_ROOT': str(root / 'ds-gen'),
            'SHIM_DS_PLIST': str(root / 'ds.plist'),
            'SHIM_DS_SOCK': str(root / 'ds.sock'),
            'SHIM_SERVICE_DIR': str(root / 'shim-install'),
            'SHIM_SERVICE_PLIST': str(root / 'shim.plist'),
            'SHIM_SOCK': str(root / 'shim.sock'),
            'SHIM_OWNER_UID': '502',
        }
        prior = {key: os.environ.get(key) for key in paths}
        os.environ.update(paths)
        self.addCleanup(lambda: [os.environ.pop(key, None) if value is None
                                 else os.environ.__setitem__(key, value)
                                 for key, value in prior.items()])
        self.mod = types.ModuleType('offline_shim')
        exec(compile(candidate_source(), '<offline-shim-candidate>', 'exec'),
             self.mod.__dict__)
        self.mod._ds_start_and_status = lambda: {'ok': True, 'pid': 123, 'units': []}
        self.root = root
        self.targets = {
            'deployment_system.py': root / 'ds-install' / 'deployment_system.py',
            'ds_client.py': root / 'ds-install' / 'ds_client.py',
            'deployment-registry.json': root / 'ds-config' / 'deployment-registry.json',
            'plist': root / 'ds.plist',
        }
        self.old = {name: ('old-' + name).encode() for name in NAMES}
        self.new = {name: ('new-' + name).encode() for name in NAMES}
        self.new['plist'] = (self.mod.DS_LABEL + ' ' +
                             str(root / 'ds-install' / 'deployment_system.py')).encode()
        for name, path in self.targets.items():
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(self.old[name])
            path.chmod(0o600 if name == 'deployment-registry.json' else
                       0o644 if name == 'plist' else 0o555)
        inbox = root / 'shim-state' / 'inbox' / OPERATION
        inbox.mkdir(parents=True)
        (root / 'shim-state' / 'receipts').mkdir(parents=True)
        (root / 'ds-state').mkdir()
        (root / 'ds-state' / 'mutation.lock').touch(mode=0o644)
        for name in NAMES:
            (inbox / name).write_bytes(self.new[name])

    def packet(self):
        return {
            'action': 'INSTALL_DEPLOYMENT_SYSTEM', 'operation_id': OPERATION,
            'artifacts': {name: sha(self.new[name]) for name in NAMES},
            'expected_preimage_sha256': {name: sha(self.old[name]) for name in NAMES},
            'ds_script_preimage_size': len(self.old['deployment_system.py']),
            'ds_script_candidate_size': len(self.new['deployment_system.py']),
        }

    def call(self, packet):
        return self.mod.handle(json.dumps(packet).encode())[0]

    def test_four_piece_preimage_conflict_has_no_install_effect(self):
        packet = self.packet()
        packet['expected_preimage_sha256']['ds_client.py'] = '0' * 64
        result = self.call(packet)
        self.assertFalse(result['ok'])
        self.assertIn('PREIMAGE', json.dumps(result))
        for name, path in self.targets.items():
            self.assertEqual(path.read_bytes(), self.old[name])

    def test_existing_ds_mutation_lock_blocks_before_intent_or_effect(self):
        lock = self.root / 'ds-state' / 'mutation.lock'
        script = ('import fcntl,os,sys,time; '
                  'fd=os.open(sys.argv[1],os.O_RDWR|os.O_CREAT,0o644); '
                  'fcntl.flock(fd,fcntl.LOCK_EX); print("held",flush=True); '
                  'time.sleep(10)')
        holder = subprocess.Popen([sys.executable, '-c', script, str(lock)],
                                  stdout=subprocess.PIPE, text=True)
        try:
            self.assertEqual(holder.stdout.readline().strip(), 'held')
            result = self.call(self.packet())
            self.assertFalse(result['ok'])
            self.assertIn('MUTATION_ALREADY_RUNNING', json.dumps(result))
            self.assertFalse(Path(self.mod._ds_intent_path(OPERATION)).exists())
            for name, path in self.targets.items():
                self.assertEqual(path.read_bytes(), self.old[name])
        finally:
            holder.terminate()
            holder.wait(timeout=5)
            holder.stdout.close()

    def test_commit_and_exact_operation_status(self):
        result = self.call(self.packet())
        self.assertTrue(result['ok'], result)
        self.assertEqual(result['state'], 'COMMITTED')
        for name, path in self.targets.items():
            self.assertEqual(path.read_bytes(), self.new[name])
        later = self.root / 'shim-state' / 'receipts' / 'zz-unrelated.json'
        later.write_text(json.dumps({'action': 'SERVICE_UPDATE', 'state': 'COMMITTED'}))
        status = self.call({'action': 'INSTALL_DEPLOYMENT_SYSTEM_STATUS',
                            'operation_id': OPERATION})
        self.assertEqual(status['state'], 'COMMITTED')
        self.assertEqual(status['operation_id'], OPERATION)
        self.assertEqual(status['ds_status_pid'], 123)
        self.assertEqual(status['artifacts'], self.packet()['artifacts'])
        self.assertFalse(self.call(self.packet())['ok'])

    def test_status_rejects_terminal_mismatched_to_durable_intent(self):
        self.assertTrue(self.call(self.packet())['ok'])
        receipt = Path(self.mod._ds_terminal_path(OPERATION))
        terminal = json.loads(receipt.read_text())
        terminal['artifacts']['ds_client.py'] = '0' * 64
        receipt.write_bytes(self.mod.canonical(terminal))
        status = self.call({'action': 'INSTALL_DEPLOYMENT_SYSTEM_STATUS',
                            'operation_id': OPERATION})
        self.assertEqual(status['state'], 'UNKNOWN')
        self.assertFalse(status['replayAllowed'])

    def test_fixed_install_records_are_outside_admin_writable_shim_state(self):
        self.assertTrue(self.call(self.packet())['ok'])
        state = (self.root / 'shim-state').resolve()
        intent = Path(self.mod._ds_intent_path(OPERATION)).resolve()
        self.assertNotEqual(os.path.commonpath((state, intent)), str(state))
        self.assertFalse((state / 'service-rollback' /
                          ('ds-' + OPERATION)).exists())
        status = self.call({'action': 'INSTALL_DEPLOYMENT_SYSTEM_STATUS',
                            'operation_id': OPERATION})
        self.assertEqual(status['state'], 'COMMITTED')

    def test_first_private_root_parent_fsync_failure_prevents_install(self):
        original = self.mod._ds_fsync_dir
        def refuse(directory):
            if directory == str(self.root):
                raise OSError('simulated fixed-root parent fsync failure')
            return original(directory)
        self.mod._ds_fsync_dir = refuse
        result = self.call(self.packet())
        self.assertFalse(result['ok'])
        for name, path in self.targets.items():
            self.assertEqual(path.read_bytes(), self.old[name])

    def test_first_intent_directory_parent_fsync_failure_prevents_install(self):
        original = self.mod._ds_fsync_dir
        private_root = str(self.root / 'fixed-ds-install-records')
        def refuse(directory):
            if directory == private_root:
                raise OSError('simulated intent parent fsync failure')
            return original(directory)
        self.mod._ds_fsync_dir = refuse
        result = self.call(self.packet())
        self.assertFalse(result['ok'])
        for name, path in self.targets.items():
            self.assertEqual(path.read_bytes(), self.old[name])

    def test_ambiguous_commit_receipt_never_rolls_back_committed_bytes(self):
        original = self.mod._ds_terminal
        def replace_then_raise(operation_id, value):
            original(operation_id, value)
            if value['state'] == 'COMMITTED':
                raise OSError('test directory fsync ambiguity')
        self.mod._ds_terminal = replace_then_raise
        result = self.call(self.packet())
        self.assertFalse(result['ok'])
        self.assertEqual(result['state'], 'UNKNOWN')
        for name, path in self.targets.items():
            self.assertEqual(path.read_bytes(), self.new[name])
        status = self.call({'action': 'INSTALL_DEPLOYMENT_SYSTEM_STATUS',
                            'operation_id': OPERATION})
        self.assertEqual(status['state'], 'COMMITTED')

    def test_failure_after_swap_restores_all_four_and_service(self):
        calls = []
        def restart():
            calls.append('restart')
            if len(calls) == 1:
                raise self.mod.Failure('TEST_POST_SWAP_FAILURE')
            return {'ok': True, 'pid': 124, 'units': []}
        self.mod._ds_start_and_status = restart
        result = self.call(self.packet())
        self.assertFalse(result['ok'])
        self.assertIn('rollback', result)
        self.assertEqual(result['rollback'], 'RESTORED')
        self.assertEqual(len(calls), 2)
        for name, path in self.targets.items():
            self.assertEqual(path.read_bytes(), self.old[name])
        status = self.call({'action': 'INSTALL_DEPLOYMENT_SYSTEM_STATUS',
                            'operation_id': OPERATION})
        self.assertEqual(status['state'], 'FAILED')
        self.assertEqual(status['rollback'], 'RESTORED')

    def test_mid_swap_failure_restores_each_original(self):
        original = self.mod._ds_install_file
        tripped = []
        def fail_once(source, target, *args):
            value = original(source, target, *args)
            if target == str(self.targets['deployment_system.py']) and not tripped:
                tripped.append(True)
                raise self.mod.Failure('TEST_MID_SWAP_FAILURE')
            return value
        self.mod._ds_install_file = fail_once
        result = self.call(self.packet())
        self.assertEqual(result['rollback'], 'RESTORED')
        for name, path in self.targets.items():
            self.assertEqual(path.read_bytes(), self.old[name])

    def test_failed_rollback_is_unknown_not_failed_or_committed(self):
        self.mod._ds_start_and_status = lambda: (_ for _ in ()).throw(
            self.mod.Failure('TEST_RESTART_UNAVAILABLE'))
        result = self.call(self.packet())
        self.assertFalse(result['ok'])
        self.assertEqual(result['state'], 'UNKNOWN')
        self.assertEqual(result['rollback'], 'UNKNOWN')
        status = self.call({'action': 'INSTALL_DEPLOYMENT_SYSTEM_STATUS',
                            'operation_id': OPERATION})
        self.assertEqual(status['state'], 'UNKNOWN')

    def test_large_ds_script_uses_bounded_stream_and_other_artifacts_stay_capped(self):
        name = 'deployment_system.py'
        self.old[name] = b'a' * (16 * 1024 * 1024 + 1)
        self.new[name] = b'b' * (16 * 1024 * 1024 + 1)
        self.targets[name].chmod(0o644)
        self.targets[name].write_bytes(self.old[name])
        self.targets[name].chmod(0o555)
        (self.root / 'shim-state' / 'inbox' / OPERATION / name).write_bytes(self.new[name])
        self.assertTrue(self.call(self.packet())['ok'])
        self.assertEqual(sha(self.targets[name].read_bytes()), sha(self.new[name]))

    def test_actual_installed_script_size_is_streamed_in_64k_blocks(self):
        size = 110_226_386
        source = self.root / 'ds-large-sparse.py'
        with source.open('wb') as fh:
            fh.truncate(size)
        digest = hashlib.sha256()
        remaining = size
        while remaining:
            block = b'\0' * min(65536, remaining)
            digest.update(block)
            remaining -= len(block)
        observed = []
        original = os.read
        def bounded(fd, count):
            observed.append(count)
            return original(fd, count)
        os.read = bounded
        try:
            meta = self.mod._ds_stream(str(source), digest.hexdigest(),
                                       self.mod._DS_SCRIPT_LIMIT, size)
        finally:
            os.read = original
        self.assertEqual(meta.st_size, size)
        self.assertTrue(observed)
        self.assertLessEqual(max(observed), 65536)

    def test_ds_script_above_128_mib_is_rejected_before_copy(self):
        source = self.root / 'too-large-sparse.py'
        with source.open('wb') as fh:
            fh.truncate(128 * 1024 * 1024 + 1)
        with self.assertRaisesRegex(self.mod.Failure, 'ARTIFACT_TOO_LARGE'):
            self.mod._ds_stream(str(source), '0' * 64,
                                self.mod._DS_SCRIPT_LIMIT)

    def test_oversized_non_ds_artifact_rejects_without_effect(self):
        name = 'ds_client.py'
        self.new[name] = b'z' * (16 * 1024 * 1024 + 1)
        (self.root / 'shim-state' / 'inbox' / OPERATION / name).write_bytes(self.new[name])
        result = self.call(self.packet())
        self.assertFalse(result['ok'])
        self.assertIn('ARTIFACT_TOO_LARGE', json.dumps(result))
        for target_name, path in self.targets.items():
            self.assertEqual(path.read_bytes(), self.old[target_name])

    def test_plist_must_keep_fixed_ds_label_and_program(self):
        self.new['plist'] = b'unrelated service target'
        (self.root / 'shim-state' / 'inbox' / OPERATION / 'plist').write_bytes(
            self.new['plist'])
        result = self.call(self.packet())
        self.assertFalse(result['ok'])
        self.assertIn('DS_PLIST_CONTENT_INVALID', json.dumps(result))
        for name, path in self.targets.items():
            self.assertEqual(path.read_bytes(), self.old[name])

    def test_crash_window_is_unknown_and_consumed(self):
        self.assertTrue(hasattr(self.mod, '_ds_install_file'))
        original = self.mod._ds_install_file
        calls = []
        def crash_once(*args, **kwargs):
            value = original(*args, **kwargs)
            calls.append(True)
            if len(calls) == 1:
                raise KeyboardInterrupt('simulated process loss')
            return value
        self.mod._ds_install_file = crash_once
        with self.assertRaises(KeyboardInterrupt):
            self.call(self.packet())
        status = self.call({'action': 'INSTALL_DEPLOYMENT_SYSTEM_STATUS',
                            'operation_id': OPERATION})
        self.assertEqual(status['state'], 'UNKNOWN')
        self.assertFalse(self.call(self.packet())['ok'])

    def test_intent_fsync_ambiguity_stays_unknown_and_consumed(self):
        original = self.mod._ds_fsync_dir
        def lose_ack(directory):
            if os.path.basename(directory) == 'intents':
                raise OSError('simulated intent directory fsync error')
            return original(directory)
        self.mod._ds_fsync_dir = lose_ack
        result = self.call(self.packet())
        self.assertFalse(result['ok'])
        self.assertEqual(result['state'], 'UNKNOWN')
        status = self.call({'action': 'INSTALL_DEPLOYMENT_SYSTEM_STATUS',
                            'operation_id': OPERATION})
        self.assertEqual(status['state'], 'UNKNOWN')
        self.assertFalse(self.call(self.packet())['ok'])

    def test_client_stages_only_four_reviewed_bytes_and_builds_exact_packet(self):
        client_path = HERE / 'client.py'
        self.assertTrue(client_path.exists())
        spec = importlib.util.spec_from_file_location('hr_install_client', client_path)
        client = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(client)
        artdir = self.root / 'reviewed-artifacts'
        artdir.mkdir()
        for name in NAMES:
            (artdir / name).write_bytes(self.new[name])
        manifest = self.packet()
        shutil.rmtree(self.root / 'shim-state' / 'inbox' / OPERATION)
        staged = client.stage_packet(manifest, artdir,
                                     self.root / 'shim-state' / 'inbox')
        self.assertEqual(staged, manifest)
        for name in NAMES:
            self.assertEqual((self.root / 'shim-state' / 'inbox' /
                              OPERATION / name).read_bytes(), self.new[name])
        (artdir / 'ds_client.py').write_bytes(b'changed-after-review')
        shutil.rmtree(self.root / 'shim-state' / 'inbox' / OPERATION)
        with self.assertRaises(ValueError):
            client.stage_packet(manifest, artdir,
                                self.root / 'shim-state' / 'inbox')

    def test_client_status_packet_has_only_exact_operation(self):
        client_path = HERE / 'client.py'
        self.assertTrue(client_path.exists())
        spec = importlib.util.spec_from_file_location('hr_install_client', client_path)
        client = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(client)
        self.assertEqual(client.status_packet(OPERATION),
                         {'action': 'INSTALL_DEPLOYMENT_SYSTEM_STATUS',
                          'operation_id': OPERATION})


if __name__ == '__main__':
    unittest.main()
