"""Internal, one-use FRESH hook after the fixed shim self-update restart.

There is no request action for this hook. All selectors remain compiled and
inactive by default; the original root producer obtains the DS canonical lock
itself after this hook's durable UNKNOWN intent.
"""
import hashlib
import json
import os
import re
import stat


ADMIN_FRESH_HOOK_ACTIVE = False
ADMIN_FRESH_ROOT_UID = 0
ADMIN_FRESH_SELF_UPDATE_ID = None
ADMIN_FRESH_CAPTURE_ID = None
ADMIN_FRESH_ADMISSION_ID = None
ADMIN_FRESH_OLD_DS_SHA256 = None
ADMIN_FRESH_OLD_SHA256 = None
ADMIN_FRESH_NEW_SHA256 = None  # Six non-self artifacts; current shim comes from receipt.
ADMIN_FRESH_STAGED_SIZE = None
ADMIN_FRESH_OWNER_UID = None
ADMIN_FRESH_OPERATION_ID = 'hr-admin-fresh-prep-20260928-v1'
ADMIN_FRESH_FACTORY = None  # Embedded reviewed producer factory only.
ADMIN_FRESH_BINDER = None  # Private same-process inert package binder only.


def _admin_fresh_root_read(path):
    """Read a fixed root file with stable descriptor and named identity."""
    parent = os.open(os.path.dirname(path),
                     os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        directory = os.fstat(parent)
        require(stat.S_ISDIR(directory.st_mode)
                and directory.st_uid == ADMIN_FRESH_ROOT_UID
                and not stat.S_IMODE(directory.st_mode) & 0o022,
                'ADMIN_FRESH_HOOK_RECEIPT_CUSTODY')
        name = os.path.basename(path)
        fd = os.open(name, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=parent)
        try:
            before = os.fstat(fd)
            require(stat.S_ISREG(before.st_mode)
                    and before.st_uid == ADMIN_FRESH_ROOT_UID
                    and before.st_nlink == 1
                    and not stat.S_IMODE(before.st_mode) & 0o022
                    and 0 < before.st_size <= 65536,
                    'ADMIN_FRESH_HOOK_RECEIPT_CUSTODY')
            identity = lambda st: (st.st_dev, st.st_ino, st.st_mode, st.st_uid,
                                   st.st_gid, st.st_nlink, st.st_size,
                                   st.st_mtime_ns, st.st_ctime_ns)
            raw = os.pread(fd, before.st_size + 1, 0)
            require(len(raw) == before.st_size
                    and identity(os.fstat(fd)) == identity(before)
                    and identity(os.stat(name, dir_fd=parent,
                                         follow_symlinks=False)) == identity(before)
                    and identity(os.fstat(parent)) == identity(directory)
                    and identity(os.stat(os.path.dirname(path),
                                         follow_symlinks=False)) == identity(directory),
                    'ADMIN_FRESH_HOOK_RECEIPT_CHANGED')
            return raw, hashlib.sha256(raw).hexdigest()
        finally:
            os.close(fd)
    finally:
        os.close(parent)


def run_admin_fresh_hook():
    if not ADMIN_FRESH_HOOK_ACTIVE:
        return None
    require(os.geteuid() == ADMIN_FRESH_ROOT_UID and not TEST_MODE,
            'ADMIN_FRESH_HOOK_ROOT_REQUIRED')
    require(type(ADMIN_FRESH_SELF_UPDATE_ID) is str
            and ADMIN_FRESH_SELF_UPDATE_ID == 'shim-hr-admin-fresh-20260928-v1'
            and type(ADMIN_FRESH_CAPTURE_ID) is str
            and type(ADMIN_FRESH_ADMISSION_ID) is str
            and OP_ID.fullmatch(ADMIN_FRESH_CAPTURE_ID) is not None
            and OP_ID.fullmatch(ADMIN_FRESH_ADMISSION_ID) is not None
            and ADMIN_FRESH_CAPTURE_ID != ADMIN_FRESH_ADMISSION_ID
            and type(ADMIN_FRESH_OLD_DS_SHA256) is str
            and re.fullmatch('[a-f0-9]{64}', ADMIN_FRESH_OLD_DS_SHA256) is not None
            and type(ADMIN_FRESH_OLD_SHA256) is dict
            and set(ADMIN_FRESH_OLD_SHA256) ==
                {'deployment_system.py', 'ds_client.py', 'plist',
                 'deployment-registry.json'}
            and all(type(value) is str and re.fullmatch('[a-f0-9]{64}', value)
                    for value in ADMIN_FRESH_OLD_SHA256.values())
            and ADMIN_FRESH_OLD_SHA256['deployment_system.py'] ==
                ADMIN_FRESH_OLD_DS_SHA256
            and type(ADMIN_FRESH_NEW_SHA256) is dict
            and set(ADMIN_FRESH_NEW_SHA256) ==
                {'deployment_system.py', 'ds_client.py', 'plist',
                 'deployment-registry.json', 'node-runtime', 'python-runtime'}
            and all(type(value) is str and re.fullmatch('[a-f0-9]{64}', value)
                    for value in ADMIN_FRESH_NEW_SHA256.values())
            and type(ADMIN_FRESH_STAGED_SIZE) is dict
            and set(ADMIN_FRESH_STAGED_SIZE) ==
                {'deployment_system.py', 'ds_client.py', 'plist',
                 'deployment-registry.json'}
            and all(type(value) is int and 0 < value <= 128 << 20
                    for value in ADMIN_FRESH_STAGED_SIZE.values())
            and type(ADMIN_FRESH_OWNER_UID) is int
            and ADMIN_FRESH_OWNER_UID == AUTHORIZED_OWNER_UID
            and callable(ADMIN_FRESH_FACTORY)
            and callable(ADMIN_FRESH_BINDER),
            'ADMIN_FRESH_HOOK_UNBOUND')
    update_path = receipt_path(ADMIN_FRESH_SELF_UPDATE_ID)
    update_raw, _ = _admin_fresh_root_read(update_path)
    update = json.loads(update_raw)
    installed_path = os.path.join(SERVICE_INSTALL_DIR, 'deploy_shim.py')
    installed_raw, installed_sha = _admin_fresh_root_read(installed_path)
    require(type(update) is dict
            and update.get('operation_id') == ADMIN_FRESH_SELF_UPDATE_ID
            and update.get('action') == 'SERVICE_UPDATE'
            and update.get('state') == 'COMMITTED'
            and update.get('generation') == ADMIN_FRESH_SELF_UPDATE_ID
            and update.get('restart') == 'self'
            and type(update.get('artifacts')) is dict
            and update['artifacts'].get('deploy_shim.py') == installed_sha
            and service_current().get('generation') == ADMIN_FRESH_SELF_UPDATE_ID,
            'ADMIN_FRESH_HOOK_SELF_UPDATE_UNKNOWN')
    # The marker is an actual root-held one-use intent, not a supplied PASS.
    # Its parent is root-only writable even though STATE_ROOT is root:admin.
    marker_dir = os.path.dirname(receipt_path(ADMIN_FRESH_OPERATION_ID))
    parent = os.open(marker_dir, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        meta = os.fstat(parent)
        require(stat.S_ISDIR(meta.st_mode) and meta.st_uid == ADMIN_FRESH_ROOT_UID
                and not stat.S_IMODE(meta.st_mode) & 0o022,
                'ADMIN_FRESH_HOOK_RECEIPT_CUSTODY')
        name = ADMIN_FRESH_OPERATION_ID + '.json'
        intent = {'operation_id': ADMIN_FRESH_OPERATION_ID,
                  'action': 'INTERNAL_ADMIN_FRESH', 'state': 'UNKNOWN',
                  'selfUpdateOperationId': ADMIN_FRESH_SELF_UPDATE_ID,
                  'shimSha256': installed_sha, 'replayAllowed': False}
        fd = os.open(name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
                     0o600, dir_fd=parent)
        try:
            raw = canonical(intent)
            require(os.write(fd, raw) == len(raw),
                    'ADMIN_FRESH_HOOK_INTENT_UNKNOWN')
            os.fsync(fd)
        finally:
            os.close(fd)
        os.fsync(parent)
    finally:
        os.close(parent)
    binding = {'captureId': ADMIN_FRESH_CAPTURE_ID,
               'admissionId': ADMIN_FRESH_ADMISSION_ID,
               'reviewedDsSha256': ADMIN_FRESH_OLD_DS_SHA256,
               'reviewedOldSha256': dict(ADMIN_FRESH_OLD_SHA256),
               'reviewedNewSha256': dict(ADMIN_FRESH_NEW_SHA256,
                                        **{'deploy_shim.py': installed_sha}),
               'reviewedStagedSize': ADMIN_FRESH_STAGED_SIZE,
               'shimInboxOwnerUid': ADMIN_FRESH_OWNER_UID}
    owner = ADMIN_FRESH_FACTORY(binding)
    result = owner.produce()  # Acquires the DS canonical flock; never under shim lock.
    def finish(fresh_sha):
        finished = dict(intent, state='COMMITTED', freshSha256=fresh_sha)
        write_receipt(ADMIN_FRESH_OPERATION_ID, finished)
        readback, _ = _admin_fresh_root_read(
            receipt_path(ADMIN_FRESH_OPERATION_ID))
        require(readback == canonical(finished),
                'ADMIN_FRESH_HOOK_COMMIT_UNKNOWN')
        return finished
    return ADMIN_FRESH_BINDER(result, owner, finish)
