"""Private installation-time fixed publisher; no request or caller input surface.

The four reviewed byte strings and package digest must be compiled together in
an exact independently reviewed future installation package. None is the shipped
default. Proof bytes are copied, never inferred from source coverage/history.
"""
import hashlib
import json
import os
from pathlib import Path
import stat
import time

TRUSTED_ARTIFACTS = None
INSTALLATION_PACKAGE_SHA256 = None
INSTALLATION_ID = 'hr-s256-profile-bootstrap-20260926-v1'
CUSTODY_UID = 0
TARGETS = {
    'hr-s256-one-shot-authority.json': Path('/private/var/db/agent-deploy-system-config/hr-s256-one-shot-authority.json'),
    'hr-s256-source-scope.json': Path('/private/var/db/agent-deploy-system-config/hr-s256-source-scope.json'),
    'floor-proven.json': Path('/private/var/db/agent-deploy-system/hr-s256-deployment-proof/floor-proven.json'),
    'validator-installed.json': Path('/private/var/db/agent-deploy-system/hr-s256-deployment-proof/validator-installed.json'),
}
_state = {'attempted': False, 'pins': None}


def activation_pins():
    return None if _state['pins'] is None else dict(_state['pins'])


def _require(flag, reason):
    HR_PROFILE.require(flag, reason)


def _sha(raw):
    return hashlib.sha256(raw).hexdigest()


def _validated_inputs():
    _require(HR_PROFILE.valid_hash(INSTALLATION_PACKAGE_SHA256)
        and type(TRUSTED_ARTIFACTS) is dict and set(TRUSTED_ARTIFACTS) == set(TARGETS),
        'INSTALLATION_PACKAGE_UNKNOWN')
    sealed = dict(TRUSTED_ARTIFACTS)
    hashes = {}
    objects = {}
    for name, raw in sealed.items():
        _require(type(raw) is bytes and 0 < len(raw) <= 65536, 'INSTALLATION_INPUT_BOUND')
        hashes[name] = _sha(raw)
        objects[name] = json.loads(raw, object_pairs_hook=HR_REAL_OS.unique_object)
    _require(_sha(canonical(hashes)) == INSTALLATION_PACKAGE_SHA256, 'INSTALLATION_PACKAGE_DIGEST')
    authority = objects['hr-s256-one-shot-authority.json']
    _require(type(authority) is dict and set(authority) == {'operationId', 'hostId',
        'consumingBinarySha256', 'floorProvenReceiptSha256', 'validatorInstalledReceiptSha256',
        'rollbackCaptureOperationId', 'expectedRegistrySha256'}
        and authority['operationId'] == HR_PROFILE.OPERATION_ID
        and type(authority['hostId']) is str and 0 < len(authority['hostId']) <= 128
        and type(authority['rollbackCaptureOperationId']) is str
        and 0 < len(authority['rollbackCaptureOperationId']) <= 128
        and all(HR_PROFILE.valid_hash(authority[key]) for key in ('consumingBinarySha256',
            'floorProvenReceiptSha256', 'validatorInstalledReceiptSha256', 'expectedRegistrySha256')),
        'INSTALLATION_AUTHORITY_UNKNOWN')
    _require(authority['floorProvenReceiptSha256'] == hashes['floor-proven.json']
        and authority['validatorInstalledReceiptSha256'] == hashes['validator-installed.json'],
        'INSTALLATION_PROOF_DIGEST')
    floor = objects['floor-proven.json']
    validator = objects['validator-installed.json']
    _require(type(floor) is dict and set(floor) == {'status', 'floorCommit',
        'deployedBinarySha256', 'provedAtWallMs'} and type(validator) is dict
        and set(validator) == {'evidenceKind', 'deployedBinarySha256', 'installedAtWallMs'},
        'INSTALLATION_PROOF_SHAPE')
    now = int(time.time() * 1000)
    _require(floor['status'] == 'ROUTER_RESTART_SAFETY=PROVEN'
        and floor['floorCommit'] == '2097e4f9'
        and floor['deployedBinarySha256'] == authority['consumingBinarySha256']
        and validator['deployedBinarySha256'] == authority['consumingBinarySha256']
        and validator['evidenceKind'] == 'restart_quiescence_proven'
        and all(HR_PROFILE.valid_time(t) and t < now for t in
            (floor['provedAtWallMs'], validator['installedAtWallMs'])), 'INSTALLATION_PROOF_UNKNOWN')
    scope = objects['hr-s256-source-scope.json']
    sources = ['fixed-DS-owner', 'gui/505/ai.agent-core.runtime', 'system/ai.agent-core.runtime',
        'packages/production-runtime/src/native-arm64/hr-s256-r2-gated-runtime.mjs']
    _require(type(scope) is dict and set(scope) == {'version', 'operationId', 'hostId',
        'entryManifest', 'sources'} and type(scope['version']) is int and scope['version'] == 1
        and scope['operationId'] == authority['operationId'] and scope['hostId'] == authority['hostId']
        and type(scope['sources']) is list and len(scope['sources']) == 4
        and all(type(s) is str for s in scope['sources'])
        and sorted(scope['sources']) == sorted(sources), 'INSTALLATION_SCOPE_UNKNOWN')
    HR_PROFILE.validate_entry_closure(scope['entryManifest'], sources[1:])
    return hashes, sealed


def _parent(path):
    """Every fixed ancestor remains root-owned and non-writable; no-follow."""
    fd = os.open('/', os.O_RDONLY | os.O_DIRECTORY)
    try:
        for part in path.parts[1:-1]:
            child = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=fd)
            os.close(fd)
            fd = child
            meta = os.fstat(fd)
            _require(meta.st_uid == CUSTODY_UID and not (meta.st_mode & 0o022),
                     'INSTALLATION_PARENT_CUSTODY')
        return fd
    except BaseException:
        os.close(fd)
        raise


def _read_at(parent, name):
    fd = os.open(name, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=parent)
    try:
        before = os.fstat(fd)
        _require(stat.S_ISREG(before.st_mode) and before.st_uid == CUSTODY_UID
            and stat.S_IMODE(before.st_mode) == 0o600 and 0 < before.st_size <= 65536,
            'INSTALLATION_OUTPUT_CUSTODY')
        raw = os.pread(fd, before.st_size + 1, 0)
        key = lambda s: (s.st_dev, s.st_ino, s.st_uid, s.st_mode, s.st_size, s.st_mtime_ns, s.st_ctime_ns)
        _require(len(raw) == before.st_size and key(os.fstat(fd)) == key(before)
            and key(os.stat(name, dir_fd=parent, follow_symlinks=False)) == key(before),
            'INSTALLATION_OUTPUT_CHANGED')
        return raw
    finally:
        os.close(fd)


def _publish(parent, name, raw):
    fd = os.open(name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600, dir_fd=parent)
    try:
        os.fchown(fd, CUSTODY_UID, 0)
        os.fchmod(fd, 0o600)
        view = memoryview(raw)
        while view:
            count = os.write(fd, view)
            _require(count > 0, 'INSTALLATION_WRITE_UNKNOWN')
            view = view[count:]
        os.fsync(fd)
    finally:
        os.close(fd)
    os.fsync(parent)
    _require(_read_at(parent, name) == raw, 'INSTALLATION_OUTPUT_CHANGED')


def installation_bootstrap():
    """Called only at daemon initialization, never by an IPC action or request."""
    if INSTALLATION_PACKAGE_SHA256 is None and TRUSTED_ARTIFACTS is None:
        return None  # Zero protected IO, zero mutation, ordinary current DS unaffected.
    _require(not _state['attempted'], 'INSTALLATION_NO_REPLAY')
    _state['attempted'] = True
    _require(os.geteuid() == 0, 'ROOT_REQUIRED')
    hashes, sealed = _validated_inputs()  # Immutable byte snapshot before any publication.
    lock = mutation_lock()
    parents = {}
    receipt_parent = None
    try:
        receipt = Path(STATE_ROOT) / 'receipts' / (INSTALLATION_ID + '.json')
        receipt_parent = _parent(receipt)
        try:
            existing = json.loads(_read_at(receipt_parent, receipt.name),
                                  object_pairs_hook=HR_REAL_OS.unique_object)
        except FileNotFoundError:
            existing = None
        expected = {'operation_id': INSTALLATION_ID, 'action': 'HR_S256_PROFILE_INSTALLATION',
            'state': 'COMMITTED', 'artifacts': hashes, 'version': VERSION}
        if existing is not None:
            _require(type(existing) is dict and type(existing.get('version')) is int
                and existing['version'] == VERSION and existing == expected,
                'INSTALLATION_UNKNOWN_NO_REPLAY')
            # Read-only reattachment after daemon restart; no repeated publication.
            for name, path in TARGETS.items():
                parents[name] = _parent(path)
                _require(_read_at(parents[name], path.name) == sealed[name],
                         'INSTALLATION_OUTPUT_CHANGED')
        else:
            record = {**expected, 'state': 'UNKNOWN'}
            _publish(receipt_parent, receipt.name, canonical(record))
            # Reserve before even creating the fixed proof container.
            proof = TARGETS['floor-proven.json'].parent
            ancestor = _parent(proof)
            try:
                try:
                    os.mkdir(proof.name, mode=0o700, dir_fd=ancestor)
                except FileExistsError:
                    pass
                else:
                    os.fsync(ancestor)
            finally:
                os.close(ancestor)
            for name, path in TARGETS.items():
                parents[name] = _parent(path)
            # No overwrite or repair of unknown/pre-existing protected files.
            for name, path in TARGETS.items():
                try:
                    os.stat(path.name, dir_fd=parents[name], follow_symlinks=False)
                except FileNotFoundError:
                    pass
                else:
                    _require(False, 'INSTALLATION_DESTINATION_EXISTS')
            # Persisted UNKNOWN reserves this installation across any crash.
            for name in ('floor-proven.json', 'validator-installed.json',
                         'hr-s256-source-scope.json', 'hr-s256-one-shot-authority.json'):
                _publish(parents[name], TARGETS[name].name, sealed[name])
            for name, path in TARGETS.items():
                _require(_read_at(parents[name], path.name) == sealed[name],
                         'INSTALLATION_OUTPUT_CHANGED')
            # Existing DS terminal receipt writer; no new durable proof representation.
            atomic_write(receipt_path(INSTALLATION_ID), canonical(expected), 0o600)
            _require(_read_at(receipt_parent, receipt.name) == canonical(expected),
                     'INSTALLATION_RECEIPT_UNKNOWN')
        _state['pins'] = {'authority': hashes['hr-s256-one-shot-authority.json'],
                          'scope': hashes['hr-s256-source-scope.json']}
        return dict(_state['pins'])
    except BaseException:
        _state['pins'] = None
        # Truthful persisted UNKNOWN/partial bytes retained. No rollback/delete/resume.
        raise
    finally:
        for fd in parents.values():
            os.close(fd)
        if receipt_parent is not None:
            os.close(receipt_parent)
        os.close(lock)  # Publication mutex only; no runtime/child/window custody exists.
