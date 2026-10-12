"""§8 e6 publication qualification, read-only until original DS_UPDATE starts.

Two fixed root-custody files are installed only by separately admitted Owner
maintenance: an authorization and its independently frozen digest pin. Neither
file is supplied by an RPC, created here, inferred from current TX bytes, or
inherited by a later packet. Absence leaves this SOURCE candidate unarmed.
"""
import hashlib
import os
from pathlib import Path
import re
import stat

OP = 'b7-packet-r27-65e5606cf5c352f2e-e6'
TX = 'tx-5974ef29916145a68133111f57ce3f9a'
NONCE = '8eb60d9c0f78aa11ce32bb2304b3e2e8'
COHORT = '747bcfa8cf4dec5ade1c9289a7e602b4fa228bd1e78c74b2e2f4bec4b42ccd5f'
SCOPE = '9cd2e69d5a71d225521b3e8c83f15f425abb48d0e677ec23ac9b5b59849cff31'
DOMAIN = 'private/var/db/agent-core/authsvc-codex-migration'
P0_OP = 'p0-runtime-role-20260927-8ab18f71-445f-4402-993c-8d498e37f52b'
STAGE = DOMAIN + '/composite-' + P0_OP
ABSENT = [STAGE, STAGE + '/journal', STAGE + '/journal/transaction.json',
          DOMAIN + '/lock', DOMAIN + '/migration-fence.json', DOMAIN + '/migration-transaction.json']
PAIR = {'deployment_system.py', 'ds_client.py'}
KEYS = {'kind', 'operation_id', 'tx_id', 'native_state', 'holder_nonce', 'cohort_seal',
        'publication_operation_id', 'artifacts', 'preimage_artifacts', 'source_scope_sha256',
        'original_policy_sha256', 'original_receipt_sha256', 'transaction_sha256', 'holder_sha256'}


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def need(ok, reason):
    if not ok:
        raise RuntimeError('E6_PUBLICATION_' + reason)


def hash_pair(value):
    return (type(value) is dict and set(value) == PAIR and
            all(type(v) is str and re.fullmatch(r'[0-9a-f]{64}', v) for v in value.values()))


def settings_bound(diagnosis, settings, tx_sha):
    # Pin the actual decoded constants, resolving §8.6 UNKNOWN-1. B7 snapshot is
    # not a P0 ABSENT path and receives no path exemption or cleanup here.
    need(settings.get('DOMAIN') == DOMAIN and settings.get('STAGE') == STAGE
         and settings.get('ABSENT') == ABSENT, 'SETTINGS_PATHS_CHANGED')
    need(type(diagnosis) is dict and diagnosis.get('schema') == 'P0_FIXED_SETTINGS_DIAGNOSIS_V1'
         and diagnosis.get('operationId') == P0_OP, 'SETTINGS_SCHEMA')
    facts = diagnosis.get('maintenanceFacts', {})
    need(all(facts.get(k) is True for k in
             ('settingsMetadataComplete', 'stable', 'ownedFailedJob', 'jobBundlePins'))
         and facts.get('workerState') == 'ENDED'
         and facts.get('stageAndTransactionAbsent') is False
         and diagnosis.get('changedDuringRead') == []
         and diagnosis.get('maintenancePreconditionsObserved') is False,
         'OTHER_MAINTENANCE_PREDICATE')
    entries = diagnosis.get('currentTransactionRows')
    need(type(entries) is list and all(type(r) is dict and type(r.get('path')) is str for r in entries), 'PATH_ROWS')
    rows = {r['path']: r for r in entries}
    need(len(rows) == len(entries), 'DUPLICATE_PATH_ROWS')
    need(all(rows.get('/' + p, {}).get('status') == 'ENOENT' for p in ABSENT[:-1]), 'OTHER_PATH_PRESENT_OR_UNKNOWN')
    tx = rows.get('/' + ABSENT[-1], {})
    need(tx.get('status') == 'PRESENT' and tx.get('sha256') == tx_sha, 'TX_OBSERVER_NOT_BOUND')


def qualify(engine, request, diagnosis, settings, receipt_exists, install_dir, read_verified):
    """Called ONLY under the original DS inode/flock and consumed-job guard.

    Returns a read-only lease recheck. The original generation creation consumes
    the bound operation even on a partial/UNKNOWN update; no custom replay flag,
    fresh operation, lock, write, or recovery/Owner interaction is introduced.
    """
    need(type(request) is dict and set(request) == {'action', 'operation_id', 'artifacts'}
         and request.get('action') == 'DS_UPDATE'
         and type(request.get('operation_id')) is str
         and re.fullmatch(r'ds-reader-pair-[a-z0-9]{12}', request['operation_id'])
         and hash_pair(request.get('artifacts')), 'REQUEST_SHAPE')
    root = Path(engine.ds.STATE_ROOT)
    auth_path = str(root / 'e6-publication-authority.json')
    pin_path = str(root / 'e6-publication-pin.json')

    def observe(prior):
        # Existing nofollow, bounded, exact-mode Root observer; no caller paths.
        pin_raw, pin = engine.base.read_json(pin_path, 0o400, 4096)
        auth_raw, auth = engine.base.read_json(auth_path, 0o400, 16384)
        need(type(pin) is dict and set(pin) == {'kind', 'authorization_sha256'}
             and pin.get('kind') == 'DS_B7_E6_PUBLICATION_PIN_V1'
             and digest(auth_raw) == pin.get('authorization_sha256'), 'INDEPENDENT_DIGEST')
        need(type(auth) is dict and set(auth) == KEYS, 'AUTHORITY_SHAPE')
        expected = {'kind': 'DS_B7_E6_PUBLICATION_AUTH_V1', 'operation_id': OP, 'tx_id': TX,
                    'native_state': 'PREPARED', 'holder_nonce': NONCE, 'cohort_seal': COHORT,
                    'source_scope_sha256': SCOPE}
        need(all(auth.get(k) == v for k, v in expected.items()), 'AUTHORITY_SUBJECT')
        need(auth.get('publication_operation_id') == request['operation_id']
             and hash_pair(auth.get('artifacts')) and auth['artifacts'] == request['artifacts']
             and hash_pair(auth.get('preimage_artifacts')), 'PUBLICATION_BINDING')
        need(all(type(auth.get(k)) is str and re.fullmatch(r'[0-9a-f]{64}', auth[k]) for k in
                 ('original_policy_sha256', 'original_receipt_sha256', 'transaction_sha256', 'holder_sha256')),
             'AUTHORITY_DIGEST_SHAPE')
        need(engine.active is None, 'WRITER_ACTIVE')
        _, reg = engine.base.registration(OP)
        name = reg['binding']['packetId']
        need(name in engine.policy['packets'], 'REGISTERED_PACKET')
        policy = engine.policy['packets'][name]
        need(reg['binding']['manifestSha256'] == policy['manifestSha256'], 'REGISTERED_MANIFEST')
        need(digest(engine.ds.canonical(engine.policy)) == engine.policy_sha == auth['original_policy_sha256'], 'WHOLE_POLICY_CHANGED')
        raw, _ = engine.base.read_json(engine.path(OP), 0o600)
        state = engine.load(OP, reg)
        need(digest(raw) == auth['original_receipt_sha256'] and state is not None
             and state['phase'] == 'RETAINED' and state['tx_id'] == TX
             and state['attempt'] == 1 and state['input_sequence'] == 0
             and state['input_pending'] is None and state['terminal_output'] is False, 'ORIGINAL_RECEIPT_CHANGED')
        # Existing RC1/RC2 recovery preflight remains byte-identical; it verifies
        # snapshot, holder nonce/full binding, original prep, outer and cohort.
        engine.recovery_preflight(state, policy)
        tx_raw, tx = engine.base.read_json(policy['nativeTransactionPath'], 0o600, 4 * 1024 * 1024)
        holder_raw, holder = engine.base.read_json(str(Path(policy['nativeLockPath']) / 'holder'), 0o600)
        need(tx.get('txId') == TX and tx.get('state') == 'PREPARED'
             and holder.get('phase') == 'SEALED' and tx.get('outer') == holder
             and digest(tx_raw) == auth['transaction_sha256']
             and digest(holder_raw) == auth['holder_sha256'], 'NATIVE_PREIMAGE_CHANGED')
        if not engine.ds.TEST_MODE:
            need(os.path.realpath(policy['nativeTransactionPath']) == '/' + ABSENT[-1], 'NATIVE_PATH_CHANGED')
        settings_bound(prior, settings, digest(tx_raw))
        return (pin_raw, auth_raw, raw, tx_raw, holder_raw,
                engine.ds.canonical(engine.policy), engine.ds.canonical(reg)), auth

    frozen, auth = observe(diagnosis)
    operation = request['operation_id']
    generation = str(root / 'ds-generations' / operation)
    need(not receipt_exists(operation) and not os.path.lexists(generation), 'ALREADY_CONSUMED_OR_UNKNOWN')
    # First activation stages only AFTER qualification under this lease. A prior
    # inbox may be a lost P1 staging attempt before original generation creation;
    # it is UNKNOWN/consumed, including when all files happen to look complete.
    # Ordinary client pre-staging cannot invoke this e6 bootstrap exception.
    need(not os.path.lexists(root / 'inbox' / operation), 'ALREADY_STAGED_OR_UNKNOWN')
    # Admission-pinned pair is verified BEFORE generation creation or any write.
    for name, sha in auth['preimage_artifacts'].items():
        path = os.path.join(install_dir, name)
        meta = os.lstat(path)
        owner = os.getuid() if engine.ds.TEST_MODE else 0
        need(stat.S_ISREG(meta.st_mode) and meta.st_uid == owner and meta.st_nlink == 1
             and stat.S_IMODE(meta.st_mode) == 0o555, 'PAIR_PREIMAGE_CUSTODY')
        need(read_verified(path)[1] == sha, 'PAIR_PREIMAGE_CHANGED')

    def recheck(prior):
        current, _ = observe(prior)
        need(current == frozen, 'PROTECTED_REFERENCE_CHANGED')

    return recheck
