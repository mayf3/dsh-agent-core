"""Private post-FRESH snapshot and inert package binding in the root shim.

The bundle is compiled from one reviewed offline candidate, never supplied by
an IPC request. This routine does not write OPERATION-REVIEW or launch a child.
"""
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import types
import zlib


ADMIN_FRESH_BUNDLE = None
ADMIN_FRESH_BUNDLE_SHA256 = None
ADMIN_FRESH_BUNDLE_FILES = None
ADMIN_FRESH_BINDER_SHA256 = None
ADMIN_FRESH_CANDIDATE_SHA256 = None
ADMIN_FRESH_SOURCE_NAME = 'qualification-source'


def _admin_bundle_hash(raw):
    return hashlib.sha256(raw).hexdigest()


def _admin_bundle_require(ok, code):
    if not ok:
        raise ValueError(code)


def _admin_bundle_write(parent, name, raw):
    fd = os.open(name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
                 0o600, dir_fd=parent)
    try:
        view = memoryview(raw)
        while view:
            n = os.write(fd, view)
            _admin_bundle_require(n > 0, 'ADMIN_BUNDLE_SHORT_WRITE')
            view = view[n:]
        os.fsync(fd)
    finally:
        os.close(fd)
    check = os.open(name, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=parent)
    try:
        before = os.fstat(check)
        named = os.stat(name, dir_fd=parent, follow_symlinks=False)
        identity = lambda m: (m.st_dev, m.st_ino, m.st_mode, m.st_uid,
                              m.st_gid, m.st_nlink, m.st_size,
                              m.st_mtime_ns, m.st_ctime_ns)
        _admin_bundle_require(stat.S_ISREG(before.st_mode)
                              and before.st_uid == 0 and before.st_nlink == 1
                              and stat.S_IMODE(before.st_mode) == 0o600
                              and identity(before) == identity(named)
                              and os.pread(check, len(raw) + 1, 0) == raw
                              and identity(os.fstat(check)) == identity(before),
                              'ADMIN_BUNDLE_READBACK_UNKNOWN')
    finally:
        os.close(check)
    os.fsync(parent)


def _admin_bundle_snapshot(fresh_root):
    _admin_bundle_require(type(ADMIN_FRESH_BUNDLE) is bytes
                          and type(ADMIN_FRESH_BUNDLE_SHA256) is str
                          and _admin_bundle_hash(ADMIN_FRESH_BUNDLE) ==
                              ADMIN_FRESH_BUNDLE_SHA256
                          and type(ADMIN_FRESH_BUNDLE_FILES) is dict
                          and ADMIN_FRESH_SOURCE_NAME == 'qualification-source',
                          'ADMIN_BUNDLE_UNBOUND')
    inflater = zlib.decompressobj()
    packed = inflater.decompress(ADMIN_FRESH_BUNDLE, 8 << 20)
    _admin_bundle_require(inflater.eof and not inflater.unused_data
                          and not inflater.unconsumed_tail and not inflater.flush(),
                          'ADMIN_BUNDLE_BOUND')
    value = json.loads(packed)
    _admin_bundle_require(type(value) is dict
                          and set(value) == set(ADMIN_FRESH_BUNDLE_FILES),
                          'ADMIN_BUNDLE_SHAPE')
    decoded = {}
    for relative, encoded in value.items():
        _admin_bundle_require(type(relative) is str and type(encoded) is str
                              and relative and len(relative) <= 240
                              and all(part not in ('', '.', '..')
                                      for part in relative.split('/'))
                              and all(re.fullmatch('[A-Za-z0-9_.-]+', part)
                                      for part in relative.split('/')),
                              'ADMIN_BUNDLE_PATH')
        raw = base64.b64decode(encoded, validate=True)
        _admin_bundle_require(_admin_bundle_hash(raw) ==
                              ADMIN_FRESH_BUNDLE_FILES[relative],
                              'ADMIN_BUNDLE_CHANGED')
        decoded[relative] = raw
    parent = os.open(fresh_root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        parent_meta = os.fstat(parent)
        _admin_bundle_require(stat.S_ISDIR(parent_meta.st_mode)
                              and parent_meta.st_uid == 0
                              and stat.S_IMODE(parent_meta.st_mode) == 0o700,
                              'ADMIN_BUNDLE_CUSTODY')
        os.mkdir(ADMIN_FRESH_SOURCE_NAME, 0o700, dir_fd=parent)
        os.fsync(parent)
        snapshot = os.open(ADMIN_FRESH_SOURCE_NAME,
                           os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW,
                           dir_fd=parent)
        try:
            made = {''}
            for relative, raw in sorted(decoded.items()):
                parts = relative.split('/')
                current = snapshot
                opened = []
                try:
                    for depth, part in enumerate(parts[:-1]):
                        prefix = '/'.join(parts[:depth + 1])
                        if prefix not in made:
                            os.mkdir(part, 0o700, dir_fd=current)
                            os.fsync(current)
                            made.add(prefix)
                        child = os.open(part, os.O_RDONLY | os.O_DIRECTORY |
                                        os.O_NOFOLLOW, dir_fd=current)
                        opened.append(child)
                        current = child
                    _admin_bundle_write(current, parts[-1], raw)
                finally:
                    for fd in reversed(opened):
                        os.close(fd)
            os.fsync(snapshot)
        finally:
            os.close(snapshot)
        return Path(fresh_root) / ADMIN_FRESH_SOURCE_NAME, decoded
    finally:
        os.close(parent)


def admin_bind_fresh(result, owner, finish):
    """Reacquire the canonical lock, observe current bytes, bind an inert package."""
    ds = owner._load_backend()
    lock = ds.mutation_lock()  # The producer has already released its own FD.
    try:
        _admin_bundle_require(owner._observe_host() == owner.HOST_ID,
                              'ADMIN_BUNDLE_HOST_CHANGED')
        _, current, _ = ds.dir_tree_state(str(owner.APP), str(owner.APP),
                                          ['node_modules'])
        _admin_bundle_require(current == result['currentAppTreeSha256'],
                              'ADMIN_BUNDLE_APP_CHANGED')
        registry, generation = ds.load_registry()
        unit = ds.unit_from_registry(registry, 'scheduler-whole-main')
        _admin_bundle_require(unit['kind'] == 'tree'
                              and unit['target'] == str(owner.APP)
                              and unit.get('preserve') == ['node_modules']
                              and unit['uid'] == 505 and unit['gid'] == 601,
                              'ADMIN_BUNDLE_UNIT_CHANGED')
        generation_dir, capture = ds._verified_admitted_capture(
            owner.CAPTURE_ID, generation, str(owner.APP))
        pointer_raw, _ = ds.read_verified(os.path.join(
            generation_dir, 'rollback-pointer.json'))
        pointer = json.loads(pointer_raw)
        admission = ds.read_receipt(owner.ADMISSION_ID)
        _admin_bundle_require(type(pointer) is dict
                              and pointer.get('operation_id') == owner.ADMISSION_ID
                              and type(admission) is dict
                              and admission.get('state') == 'ADMITTED'
                              and admission.get('unit') == 'scheduler-whole-main'
                              and admission.get('capture_operation_id') == owner.CAPTURE_ID
                              and capture.get('tree_sha256') == current
                              and result['rollbackOperationId'] == owner.ADMISSION_ID,
                              'ADMIN_BUNDLE_ROLLBACK_CHANGED')
        old = {name: owner._read_owned(path) for name, path in owner.OLD_PATHS.items()}
        _admin_bundle_require(all(owner._artifact(raw) ==
                                  result['oldDsArtifacts'][name] and
                                  owner._sha(raw) == owner.REVIEWED_OLD_SHA256[name]
                                  for name, raw in old.items()),
                              'ADMIN_BUNDLE_OLD_CHANGED')
        observed_new = {name: (owner._read_staged(name) if name in
                        owner.OLD_PATHS else owner._read_owned(owner.NEW_PATHS[name]))
                        for name in owner.NEW_NAMES}
        _admin_bundle_require(all(owner._sha(raw) == owner.REVIEWED_NEW_SHA256[name]
                              for name, raw in observed_new.items()),
                              'ADMIN_BUNDLE_NEW_CHANGED')
        fresh = owner._read_owned(owner.FRESH_DIRECTORY / 'FRESH.json')
        _admin_bundle_require(fresh == owner._canonical(result),
                              'ADMIN_BUNDLE_FRESH_CHANGED')
        for name in owner.NEW_NAMES:
            raw = owner._read_owned(owner.FRESH_DIRECTORY / name)
            expected = (result['reviewedShim']['deploy_shim.py'] if
                        name == 'deploy_shim.py' else
                        result['newRuntime'][name] if name in
                        ('deployment_system.py', 'node-runtime', 'python-runtime')
                        else result['newDsArtifacts'][name])
            _admin_bundle_require(owner._artifact(raw) == expected,
                                  'ADMIN_BUNDLE_NEW_CHANGED')
            _admin_bundle_require(raw == observed_new[name],
                                  'ADMIN_BUNDLE_NEW_CHANGED')
        snapshot, files = _admin_bundle_snapshot(owner.FRESH_DIRECTORY)
        _admin_bundle_require(_admin_bundle_hash(files['CANDIDATE.json']) ==
                              ADMIN_FRESH_CANDIDATE_SHA256
                              and _admin_bundle_hash(files['admin_final_binding.py']) ==
                              ADMIN_FRESH_BINDER_SHA256,
                              'ADMIN_BUNDLE_SOURCE_CHANGED')
        package_module = types.ModuleType('_fixed_admin_package')
        package_module.__file__ = str(snapshot / 'admin_package.py')
        exec(compile(files['admin_package.py'], package_module.__file__, 'exec'),
             package_module.__dict__)
        binder = types.ModuleType('_fixed_admin_binder')
        binder.__dict__.update({'package': package_module,
                                'ADMIN_FIXED_NAMES': ADMIN_FIXED_NAMES})
        binder_source = files['admin_final_binding.py'].replace(
            b'import admin_package as package\n'
            b'from admin_fixed_shim_publisher import ADMIN_FIXED_NAMES\n', b'')
        _admin_bundle_require(binder_source != files['admin_final_binding.py'],
                              'ADMIN_BUNDLE_BINDER_CHANGED')
        exec(compile(binder_source, str(snapshot / 'admin_final_binding.py'), 'exec'),
             binder.__dict__)
        binder.CANDIDATE_DIRECTORY = snapshot
        binder.CANDIDATE_SHA256 = ADMIN_FRESH_CANDIDATE_SHA256
        binder.BOUND_FRESH_SHA256 = _admin_bundle_hash(fresh)
        binder.FRESH_DIRECTORY = owner.FRESH_DIRECTORY
        binder.FIXED_ROOT_OUTPUT = owner.FRESH_DIRECTORY / 'qualification-package'
        binder.ROOT_UID = owner.ROOT_UID
        package_module.PACKAGE_ROOT = snapshot / 'admin-qualification-package'
        binder.bind_fixed_root()  # Writes PUBLISH-SEAL only; no review or launch.
        return finish(_admin_bundle_hash(fresh))  # COMMITTED under this same lock.
    finally:
        os.close(lock)
