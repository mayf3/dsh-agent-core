"""Finite §8 tests: real original guard/update, sealed settings and recovery engine.

All state is disposable. Only the filesystem observer and historical consumed-job
boundary are fixtures; publication uses the actual DS generation/rollback code.
"""
import ast
import base64
import contextlib
import copy
import fcntl
import hashlib
import inspect
import importlib.util
import json
import os
from pathlib import Path
import re
import stat
import sys
import threading
import types
import unittest

ROOT = Path(__file__).resolve().parents[2]
REPAIR = ROOT / 'evidence/r27-install-candidate-preparation/output/ds-repair'
sys.path.insert(0, str(REPAIR / 'tests'))
from recovery_fixture import build_env, E6_OP, E6_TX, NONCE, COHORT, ObservationFailure

SERVER = Path(os.environ.get('SECTION8_SERVER', str(REPAIR / 'candidate/deployment_system.py')))
SOURCE = SERVER.read_text()
TREE = ast.parse(SOURCE)
SHA = lambda raw: hashlib.sha256(raw).hexdigest()
CANON = lambda obj: json.dumps(obj, sort_keys=True, separators=(',', ':')).encode()
SCOPE = '9cd2e69d5a71d225521b3e8c83f15f425abb48d0e677ec23ac9b5b59849cff31'
PUB = 'ds-reader-pair-abcdef123456'  # test-only, never registered against live DS


def literal(name):
    for node in TREE.body:
        if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == name for t in node.targets):
            return ast.literal_eval(node.value)
    raise AssertionError(name)


class Failure(Exception):
    pass


def need(ok, reason):
    if not ok:
        raise Failure(reason)


def world():
    f = build_env()
    f['prime_receipt']()
    base, engine = f['base'], f['engine']
    # Model the real SEALED holder and original outer's full record equality.
    holder = json.loads((f['lock_dir'] / 'holder').read_bytes())
    holder['phase'] = 'SEALED'
    (f['lock_dir'] / 'holder').write_bytes(CANON(holder))
    native = json.loads(f['tx_file'].read_bytes())
    native['outer'] = copy.deepcopy(holder)
    f['tx_file'].write_bytes(CANON(native))
    for path in (f['tx_file'], f['lock_dir'] / 'holder', Path(engine.path(E6_OP))):
        path.chmod(0o600)
    # Observer boundary keeps exact-mode/nofollow/nlink semantics; Root ancestor
    # authentication remains the unchanged DS observer, outside this delta.
    observed_read = engine.base.read_json
    def secure_read(path, mode, limit=None):
        meta = os.lstat(path)
        if not stat.S_ISREG(meta.st_mode) or meta.st_nlink != 1 or stat.S_IMODE(meta.st_mode) != mode:
            raise ObservationFailure('CUSTODY_INVALID', 'read', 'b7-evidence')
        return observed_read(path, mode, limit)
    engine.base.read_json = secure_read
    settings = {}
    exec(compile(base64.b64decode(literal('P0_SETTINGS_B64')), 'original-settings', 'exec'), settings)
    tx_path = '/' + settings['DOMAIN'] + '/migration-transaction.json'
    rows = {}

    class Reader:
        def __init__(self, *args):
            pass

        def _project(self, *args):
            pass

        def probe(self, path):
            if path in rows:
                return copy.deepcopy(rows[path])
            if path in self.credentials:
                return {'path': '/' + path, 'metadataObservation': 'COMPLETE', 'gate': {'uid': True}}
            out = {'path': '/' + path, 'status': 'ENOENT'}
            if path == settings['RECEIPT']:
                out.update(status='PRESENT', binding={'ownedFailedJob': True})
            elif path.startswith(settings['JOB'] + '/bundle/') and path.endswith('MANIFEST.json'):
                out.update(status='PRESENT', binding={'manifest': True})
            elif '/' + path == tx_path:
                out.update(status='PRESENT', sha256=SHA(f['tx_file'].read_bytes()))
            return out

    def diagnose(*args):
        namespace = {'_Reader': Reader, 'JSON_NAMES': ['journal/transaction.json'], 'MANIFESTS': {}}
        return settings['collect'](namespace, None, 0, 505, ['test-agent'], process=lambda pid: 'ENDED')

    settings['diagnose'] = diagnose
    op = literal('P0_READER_PAIR_OPERATION')
    record = dict(ok=True, operationId=op, graphSha256=literal('P0_READER_GRAPH_SHA'),
        serviceSha256='1' * 64, serviceSession='2' * 32, jobSession='3' * 32,
        parentSession='12345678-1234-1234-1234-123456789abc', pid=12345,
        state='FAIL_CLOSED', exitCode=2, max_attempts=1, replayAllowed=False,
        actualError={'operationId': op, 'verdict': 'FAIL_CLOSED', 'reason': 'SERVICE_STILL_LOADED'})
    evidence = dict(binding='MATCH', stable=True, issues=[], writes=False,
        secretContentRead=False, replayAllowed=False, continuationEligible=False,
        transaction=dict(phase='ABORTED', installedCount=0, installedEffects=[],
            installIntent=None, rollbackFailureRecorded=False),
        journal=dict(effectCount=97, entryPhases=[dict(path=str(i), phase='CAPTURED') for i in range(97)]))
    job = type('Job', (), dict(proc=None, guard=threading.RLock(),
        status=lambda self: copy.deepcopy(record), _receipt=lambda self: copy.deepcopy(record)))()
    state = Path(f['ds'].STATE_ROOT)
    state.mkdir(parents=True)
    lock = state / 'mutation.lock'
    lock.write_bytes(b'')
    lock.chmod(0o644)
    live = base / 'install'
    live.mkdir()
    artifacts = {'deployment_system.py': SHA(b'new-server'), 'ds_client.py': SHA(b'new-client')}
    preimages = {'deployment_system.py': SHA(b'old-server'), 'ds_client.py': SHA(b'old-client')}
    for name, raw in [('deployment_system.py', b'old-server'), ('ds_client.py', b'old-client')]:
        (live / name).write_bytes(raw)
        (live / name).chmod(0o555)
    # Secure observer is the existing recovery fixture boundary. No real Root read.
    auth = dict(kind='DS_B7_E6_PUBLICATION_AUTH_V1', operation_id=E6_OP, tx_id=E6_TX,
        native_state='PREPARED', holder_nonce=NONCE, cohort_seal=COHORT,
        publication_operation_id=PUB, artifacts=artifacts, preimage_artifacts=preimages,
        source_scope_sha256=SCOPE, original_policy_sha256=engine.policy_sha,
        original_receipt_sha256=SHA(Path(engine.path(E6_OP)).read_bytes()),
        transaction_sha256=SHA(f['tx_file'].read_bytes()),
        holder_sha256=SHA((f['lock_dir'] / 'holder').read_bytes()))
    request = dict(action='DS_UPDATE', operation_id=PUB, artifacts=copy.deepcopy(artifacts))
    auth_path = state / 'e6-publication-authority.json'
    pin_path = state / 'e6-publication-pin.json'

    def arm():
        if auth_path.exists():
            auth_path.chmod(0o600)
        auth_path.write_bytes(CANON(auth))
        auth_path.chmod(0o400)
        if pin_path.exists():
            pin_path.chmod(0o600)
        pin_path.write_bytes(CANON(dict(kind='DS_B7_E6_PUBLICATION_PIN_V1', authorization_sha256=SHA(auth_path.read_bytes()))))
        pin_path.chmod(0o400)

    arm()
    ns = dict(base64=base64, contextlib=contextlib, fcntl=fcntl, hashlib=hashlib, os=os, re=re, stat=stat,
        TEST_MODE=True, STATE_ROOT=str(state), DS_INSTALL_DIR=str(live), VERSION=1,
        Failure=Failure, require=need, canonical=CANON, sha_bytes=SHA,
        DS_ARTIFACTS=set(artifacts), OP_ID=re.compile(r'^[a-z0-9-]+$'),
        state_path=lambda name: str(state / name),
        _p0_reader_job=lambda: job, p0_reader_terminal_readback=lambda: copy.deepcopy(evidence),
        _p0_settings_module=lambda: settings, _p0_diagnostic_namespace=lambda: {}, P0_DIAGNOSTIC_ROSTER=['test-agent'],
        P0_READER_PAIR_OPERATION=op, P0_READER_GRAPH_SHA=record['graphSha256'],
        _b7_execution_instance=engine,
        p0_reader_update_blocked=lambda: False,
        receipt_path=lambda operation: str(state / 'receipts' / (operation + '.json')),
        receipt_exists=lambda operation: (state / 'receipts' / (operation + '.json')).exists(),
        read_verified=lambda path: (Path(path).read_bytes(), SHA(Path(path).read_bytes())))
    def atomic_write(path, raw, mode=0o600, recheck=None):
        if recheck:
            recheck()
        target = Path(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        temp = target.with_name(target.name + '.test-tmp')
        temp.write_bytes(raw)
        temp.chmod(mode)
        os.replace(temp, target)
    ns['atomic_write'] = atomic_write  # only atomic replacement syscall boundary
    wanted = {'ds_update', 'p0_reader_pair_update_shape', '_p0_pair_receipt_pin', '_p0_pair_clean_abort',
        'p0_reader_pair_guard', 'p0_maintained_ds_update', '_b7_e6_publication_module'}
    nodes = [n for n in TREE.body if isinstance(n, (ast.FunctionDef, ast.Assign)) and
        (isinstance(n, ast.FunctionDef) and n.name in wanted or isinstance(n, ast.Assign) and
         any(isinstance(t, ast.Name) and t.id.startswith('B7_E6_PUBLICATION_') for t in n.targets))]
    exec(compile(ast.Module(body=nodes, type_ignores=[]), 'actual-pair-source', 'exec'), ns)
    guard = ns['p0_reader_pair_guard']
    if not inspect.signature(guard).parameters:
        # Baseline compatibility only: the actual old guard still decides P0.
        ns['p0_reader_pair_guard'] = lambda request=None: guard()
    spec = importlib.util.spec_from_file_location('entry', Path(__file__).parent / 'maintenance_entry.py')
    entry = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(entry)
    staged = {'deployment_system.py': b'new-server', 'ds_client.py': b'new-client'}
    def stage_fixture():
        inbox = state / 'inbox' / PUB
        inbox.mkdir(parents=True)
        for name, raw in staged.items():
            (inbox / name).write_bytes(raw)
    def publish():
        return entry.publish(types.SimpleNamespace(**ns), auth, staged)
    f.update(state=state, ns=ns, settings=settings, diagnose=diagnose, rows=rows, auth=auth,
        auth_path=auth_path, pin_path=pin_path, arm=arm, request=request, record=record, live=live,
        publish=publish, stage_fixture=stage_fixture)
    return f


def snapshot(f):
    result = {}
    for p in f['base'].rglob('*'):
        meta = p.lstat()
        kind = 'symlink' if p.is_symlink() else 'file' if p.is_file() else 'directory'
        result[str(p.relative_to(f['base']))] = (kind, stat.S_IMODE(meta.st_mode), meta.st_nlink,
            os.readlink(p) if p.is_symlink() else p.read_bytes() if p.is_file() else None)
    return result


class PublicationTests(unittest.TestCase):
    def refuse(self, f):
        before = snapshot(f)
        with self.assertRaises((Failure, ObservationFailure, RuntimeError, OSError)):
            f['ns']['p0_maintained_ds_update'](f['request'])
        self.assertEqual(snapshot(f), before, 'P0 refusal must write nothing, including generations')

    def test_exact_e6_qualifies_under_original_guard_and_consumes_generation(self):
        f = world()
        self.assertFalse(f['diagnose']()['maintenancePreconditionsObserved'])
        receipt_before = Path(f['engine'].path(E6_OP)).read_bytes()
        tx_before = f['tx_file'].read_bytes()
        holder_before = (f['lock_dir'] / 'holder').read_bytes()
        result = f['publish']()
        self.assertTrue(result['ok'])
        self.assertEqual(json.loads(Path(f['ns']['receipt_path'](PUB)).read_bytes())['state'], 'COMMITTED')
        self.assertEqual((f['live'] / 'deployment_system.py').read_bytes(), b'new-server')
        self.assertEqual(Path(f['engine'].path(E6_OP)).read_bytes(), receipt_before)
        self.assertEqual(f['tx_file'].read_bytes(), tx_before)
        self.assertEqual((f['lock_dir'] / 'holder').read_bytes(), holder_before)
        self.refuse(f)

    def test_first_entry_uses_original_guard_before_staging(self):
        spec = importlib.util.spec_from_file_location('entry', Path(__file__).parent / 'maintenance_entry.py')
        entry = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(entry)
        for armed in (False, True):
            f = world()
            if not armed:
                f['pin_path'].unlink()
            host = types.SimpleNamespace(**f['ns'])
            before = snapshot(f)
            if not armed:
                with self.assertRaises((RuntimeError, ObservationFailure, OSError)):
                    entry.publish(host, f['auth'], {'deployment_system.py': b'new-server', 'ds_client.py': b'new-client'})
                self.assertEqual(snapshot(f), before)
            else:
                self.assertTrue(entry.publish(host, f['auth'], {'deployment_system.py': b'new-server', 'ds_client.py': b'new-client'})['ok'])
                self.assertEqual((f['live'] / 'deployment_system.py').read_bytes(), b'new-server')
                before = snapshot(f)
                with self.assertRaisesRegex(RuntimeError, 'PRIOR_STAGING_UNKNOWN_NO_REPLAY'):
                    entry.publish(host, f['auth'], {'deployment_system.py': b'new-server', 'ds_client.py': b'new-client'})
                self.assertEqual(snapshot(f), before)

    def test_every_other_absent_path_is_mandatory_absent(self):
        for path in world()['settings']['ABSENT'][:-1]:
            for status in ('PRESENT', 'UNKNOWN', 'UNSAFE_CUSTODY'):
                with self.subTest(path=path, status=status):
                    f = world()
                    f['rows'][path] = {'path': '/' + path, 'status': status}
                    self.refuse(f)

    def test_authority_and_request_are_exact_not_caller_expandable(self):
        mutations = [('tx_id', 'tx-other'), ('native_state', 'ABORTED'), ('holder_nonce', '0' * 32),
            ('cohort_seal', '0' * 64), ('original_receipt_sha256', '0' * 64),
            ('original_policy_sha256', '0' * 64), ('transaction_sha256', '0' * 64),
            ('holder_sha256', '0' * 64), ('source_scope_sha256', '0' * 64),
            ('publication_operation_id', 'ds-reader-pair-fedcba654321'), ('unexpected', True)]
        for key, value in mutations:
            with self.subTest(key=key):
                f = world()
                f['auth'][key] = value
                f['arm']()
                self.refuse(f)
        for mutate in (lambda f: f['auth_path'].unlink(), lambda f: f['pin_path'].unlink(),
            lambda f: (f['auth_path'].chmod(0o600), f['auth_path'].write_bytes(b'{}')),
            lambda f: f['request']['artifacts'].update({'ds_client.py': '0' * 64}),
            lambda f: f['request'].update(authorization=True),
            lambda f: f['request'].update(operation_id='ds-reader-pair-fedcba654321')):
            f = world()
            mutate(f)
            self.refuse(f)

    def test_native_identity_and_state_fail_closed_even_if_resealed_authority(self):
        for key, value in [('txId', 'tx-other'), ('state', 'ABORTED'), ('state', 'UNKNOWN'),
            ('stageSealSha256', '0' * 64)]:
            f = world()
            tx = json.loads(f['tx_file'].read_bytes())
            tx[key] = value
            f['tx_file'].write_bytes(CANON(tx))
            f['auth']['transaction_sha256'] = SHA(f['tx_file'].read_bytes())
            f['arm']()
            self.refuse(f)

    def test_unsealed_or_tx_holder_record_disagreement_refuses_without_effect(self):
        for change in ('unsealed', 'outer'):
            f = world()
            if change == 'unsealed':
                path = f['lock_dir'] / 'holder'
                holder = json.loads(path.read_bytes())
                holder['phase'] = 'PREPARING'
                path.write_bytes(CANON(holder))
                f['auth']['holder_sha256'] = SHA(path.read_bytes())
            else:
                tx = json.loads(f['tx_file'].read_bytes())
                tx['outer']['nonce'] = '0' * 32
                f['tx_file'].write_bytes(CANON(tx))
                f['auth']['transaction_sha256'] = SHA(f['tx_file'].read_bytes())
            f['arm']()
            before = snapshot(f)
            with self.assertRaises((RuntimeError, ObservationFailure)):
                with f['ns']['p0_reader_pair_guard'](f['request']):
                    pass
            self.assertEqual(snapshot(f), before)
        for key, value in [('nonce', '0' * 32), ('format', 'OTHER')]:
            f = world()
            holder_path = f['lock_dir'] / 'holder'
            holder = json.loads(holder_path.read_bytes())
            holder[key] = value
            holder_path.write_bytes(CANON(holder))
            f['auth']['holder_sha256'] = SHA(holder_path.read_bytes())
            f['arm']()
            self.refuse(f)

    def test_recheck_observes_native_and_settings_drift_before_any_write(self):
        for drift in ('tx', 'settings', 'pin', 'mutex', 'receipt'):
            with self.subTest(drift=drift):
                f = world()
                guard = f['ns']['p0_reader_pair_guard']
                args = (f['request'],) if inspect.signature(guard).parameters else ()
                with guard(*args) as recheck:
                    if drift == 'tx':
                        f['tx_file'].write_bytes(f['tx_file'].read_bytes() + b' ')
                    elif drift == 'settings':
                        path = f['settings']['ABSENT'][0]
                        f['rows'][path] = {'path': '/' + path, 'status': 'PRESENT'}
                    elif drift == 'pin':
                        f['pin_path'].chmod(0o600)
                        f['pin_path'].write_bytes(b'{}')
                    elif drift == 'mutex':
                        lock = f['state'] / 'mutation.lock'
                        lock.rename(f['state'] / 'old-lock')
                        lock.write_bytes(b'')
                        lock.chmod(0o644)
                    else:
                        f['record']['serviceSha256'] = '0' * 64
                    before = snapshot(f)
                    with self.assertRaises(Exception):
                        recheck()
                    self.assertEqual(snapshot(f), before)

    def test_consumed_or_unknown_generation_cannot_reenter(self):
        for receipt in (False, True):
            f = world()
            generation = f['state'] / 'ds-generations' / PUB
            generation.mkdir(parents=True)
            if receipt:
                path = Path(f['ns']['receipt_path'](PUB))
                path.parent.mkdir()
                path.write_bytes(CANON({'state': 'ABORTED'}))
            self.refuse(f)

    def test_partial_first_entry_staging_is_consumed_unknown_even_without_generation(self):
        f = world()
        f['stage_fixture']()
        (f['state'] / 'inbox' / PUB / 'ds_client.py').unlink()
        self.refuse(f)

    def test_other_maintenance_and_writer_conditions_still_refuse(self):
        f = world()
        cases = [f['settings']['RECEIPT'], f['settings']['JOB'] + '/bundle/owner/MANIFEST.json',
            'Users/authsvc/.agent-core/homes/test-agent/settings.yaml']
        for path in cases:
            with self.subTest(path=path):
                f = world()
                f['rows'][path] = {'path': '/' + path, 'status': 'UNKNOWN'}
                self.refuse(f)
        f = world()
        f['engine'].active = {'operation_id': E6_OP}
        self.refuse(f)
        f = world()
        f['record']['exitCode'] = 0
        self.refuse(f)
        f = world()
        held = os.open(f['state'] / 'mutation.lock', os.O_RDONLY)
        try:
            fcntl.flock(held, fcntl.LOCK_EX | fcntl.LOCK_NB)
            self.refuse(f)
        finally:
            os.close(held)

    def test_authority_and_pair_custody_fail_before_generation_creation(self):
        for path_kind in ('auth', 'pin', 'pair'):
            f = world()
            path = f['auth_path'] if path_kind == 'auth' else f['pin_path'] if path_kind == 'pin' else f['live'] / 'ds_client.py'
            path.chmod(0o666)
            self.refuse(f)
            f = world()
            path = f['auth_path'] if path_kind == 'auth' else f['pin_path'] if path_kind == 'pin' else f['live'] / 'ds_client.py'
            saved = path.with_name(path.name + '.saved')
            path.rename(saved)
            path.symlink_to(saved)
            self.refuse(f)
        f = world()
        f['auth']['preimage_artifacts']['ds_client.py'] = '0' * 64
        f['arm']()
        self.refuse(f)

    def test_original_fully_qualified_publication_needs_no_exception(self):
        f = world()
        path = f['settings']['ABSENT'][-1]
        f['rows'][path] = {'path': '/' + path, 'status': 'ENOENT'}
        f['auth_path'].unlink()
        f['pin_path'].unlink()
        f['stage_fixture']()
        self.assertTrue(f['diagnose']()['maintenancePreconditionsObserved'])
        self.assertTrue(f['ns']['p0_maintained_ds_update'](f['request'])['ok'])

    def test_p1_failure_rolls_back_and_consumes_the_exact_operation(self):
        f = world()
        atomic = f['ns']['atomic_write']
        injected = {'done': False}
        def interrupted(path, raw, mode=0o600, recheck=None):
            atomic(path, raw, mode, recheck)
            if str(path) == str(f['live'] / 'deployment_system.py') and raw == b'new-server' and not injected['done']:
                injected['done'] = True
                raise OSError('TEST_AFTER_ATOMIC_REPLACEMENT')
        f['ns']['atomic_write'] = interrupted
        with self.assertRaisesRegex(Failure, 'SELF_UPDATE_ABORTED'):
            f['publish']()
        self.assertEqual((f['live'] / 'deployment_system.py').read_bytes(), b'old-server')
        self.assertEqual((f['live'] / 'ds_client.py').read_bytes(), b'old-client')
        self.assertEqual(json.loads(Path(f['ns']['receipt_path'](PUB)).read_bytes())['state'], 'ABORTED')
        self.refuse(f)

    def test_p1_rollback_failure_is_reported_incomplete_never_replayed(self):
        f = world()
        atomic = f['ns']['atomic_write']
        def interrupted(path, raw, mode=0o600, recheck=None):
            if str(path) == str(f['live'] / 'ds_client.py'):
                raise OSError('TEST_CLIENT_WRITE_AND_ROLLBACK_FAILURE')
            atomic(path, raw, mode, recheck)
        f['ns']['atomic_write'] = interrupted
        with self.assertRaisesRegex(Failure, 'SELF_UPDATE_ABORT_INCOMPLETE'):
            f['publish']()
        self.assertEqual((f['live'] / 'deployment_system.py').read_bytes(), b'new-server')
        self.assertEqual(json.loads(Path(f['ns']['receipt_path'](PUB)).read_bytes())['state'], 'ABORT_INCOMPLETE')
        self.refuse(f)

    def test_lost_lease_stops_all_later_writes_and_remains_unknown(self):
        f = world()
        atomic = f['ns']['atomic_write']
        def lease_lost(path, raw, mode=0o600, recheck=None):
            atomic(path, raw, mode, recheck)
            if str(path) == str(f['live'] / 'deployment_system.py') and raw == b'new-server':
                # External drift after P1, not a write by publication code.
                f['tx_file'].write_bytes(f['tx_file'].read_bytes() + b' ')
                raise OSError('TEST_EXTERNAL_LEASE_DRIFT')
        f['ns']['atomic_write'] = lease_lost
        with self.assertRaisesRegex(Failure, 'SELF_UPDATE_UNKNOWN_LEASE_LOST'):
            f['publish']()
        self.assertEqual((f['live'] / 'deployment_system.py').read_bytes(), b'new-server')
        self.assertEqual((f['live'] / 'ds_client.py').read_bytes(), b'old-client')
        self.assertFalse(Path(f['ns']['receipt_path'](PUB)).exists())
        self.refuse(f)


if __name__ == '__main__':
    unittest.main(verbosity=2)
