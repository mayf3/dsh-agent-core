"""Inert fixed package publisher for one reviewed DS installation branch.

Injected only into an exact shim source candidate. The four public install
artifacts and request grammar remain unchanged; all private bytes are compiled
into that reviewed shim except the verified staged daemon itself.
"""
import hashlib
import os
import stat

ADMIN_FIXED_INSTALL_ID = None
ADMIN_FIXED_HOST_ID = None
ADMIN_FIXED_PYTHON_SHA256 = None
ADMIN_FIXED_PACKAGE_SHA256 = None
ADMIN_FIXED_PACKAGE_BYTES = None
ADMIN_FIXED_ROOT_HOST_OBSERVER = None
ADMIN_FIXED_EXPECTED_HOST_ID = 'FF99ABD5-79A0-5EE0-9E0B-B62671271560'
ADMIN_FIXED_QUALIFICATION_ID = 'original-router-qualification-20260927-v1'
ADMIN_FIXED_NAMES = frozenset(('PACKAGE.json', 'entry-manifest.json', 'driver.py',
    'procedure.py', 'admin_procedure.py', 'deployment.py',
    'admin_observation.mjs', 'handoff.py', 'child-proof.py',
    'admin_launcher.py', 'admin_root_carrier.py'))


def admin_fixed_compiled():
    return (type(ADMIN_FIXED_INSTALL_ID) is str and ADMIN_FIXED_INSTALL_ID
            and ADMIN_FIXED_HOST_ID == ADMIN_FIXED_EXPECTED_HOST_ID
            and type(ADMIN_FIXED_PYTHON_SHA256) is str
            and len(ADMIN_FIXED_PYTHON_SHA256) == 64
            and type(ADMIN_FIXED_PACKAGE_SHA256) is str
            and len(ADMIN_FIXED_PACKAGE_SHA256) == 64
            and type(ADMIN_FIXED_PACKAGE_BYTES) is dict
            and set(ADMIN_FIXED_PACKAGE_BYTES) == ADMIN_FIXED_NAMES
            and all(type(raw) is bytes and 0 < len(raw) <= 65536
                    for raw in ADMIN_FIXED_PACKAGE_BYTES.values())
            and ADMIN_FIXED_ROOT_HOST_OBSERVER is not None)


def _admin_fixed_write(parent, name, raw):
    fd = os.open(name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
                 0o600, dir_fd=parent)
    try:
        os.fchown(fd, 0, 0)
        os.fchmod(fd, 0o600)
        view = memoryview(raw)
        while view:
            count = os.write(fd, view)
            require(count > 0, 'ADMIN_FIXED_SHORT_WRITE')
            view = view[count:]
        os.fsync(fd)
        meta = os.fstat(fd)
        require(stat.S_ISREG(meta.st_mode) and meta.st_uid == 0
                and stat.S_IMODE(meta.st_mode) == 0o600 and meta.st_nlink == 1
                and meta.st_size == len(raw), 'ADMIN_FIXED_FILE_CUSTODY')
    finally:
        os.close(fd)
    os.fsync(parent)
    check = os.open(name, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=parent)
    try:
        current = os.fstat(check)
        name_meta = os.stat(name, dir_fd=parent, follow_symlinks=False)
        identity = lambda m: (m.st_dev, m.st_ino, m.st_mode, m.st_uid,
                              m.st_gid, m.st_nlink, m.st_size,
                              m.st_mtime_ns, m.st_ctime_ns)
        require(identity(current) == identity(name_meta)
                and os.pread(check, len(raw) + 1, 0) == raw
                and identity(os.fstat(check)) == identity(current),
                'ADMIN_FIXED_READBACK_CHANGED')
    finally:
        os.close(check)


def validate_admin_fixed_package(operation_id, artifacts, verified):
    if operation_id != ADMIN_FIXED_INSTALL_ID or ADMIN_FIXED_INSTALL_ID is None:
        return None
    require(admin_fixed_compiled()
            and ADMIN_FIXED_ROOT_HOST_OBSERVER() == ADMIN_FIXED_HOST_ID,
            'ADMIN_FIXED_BINDING_UNKNOWN')
    require(os.geteuid() == 0, 'ADMIN_FIXED_ROOT_REQUIRED')
    files = dict(ADMIN_FIXED_PACKAGE_BYTES,
                 **{'deployment_system.py': verified['deployment_system.py']})
    require(all(type(raw) is bytes and 0 < len(raw) <= 65536
                for name, raw in ADMIN_FIXED_PACKAGE_BYTES.items())
            and artifacts['deployment_system.py'] ==
                hashlib.sha256(files['deployment_system.py']).hexdigest(),
            'ADMIN_FIXED_PACKAGE_CHANGED')
    hashes = {name: hashlib.sha256(raw).hexdigest() for name, raw in files.items()}
    package_sha = hashlib.sha256(canonical(hashes)).hexdigest()
    require(package_sha == ADMIN_FIXED_PACKAGE_SHA256,
            'ADMIN_FIXED_PACKAGE_CHANGED')
    seal = canonical({'version': 1,
        'operationId': ADMIN_FIXED_QUALIFICATION_ID,
        'installOperationId': ADMIN_FIXED_INSTALL_ID,
        'hostId': ADMIN_FIXED_HOST_ID,
        'packageSha256': package_sha,
        'fileSha256': hashes,
        'pythonSha256': ADMIN_FIXED_PYTHON_SHA256,
        'state': 'INSTALLED_WAITING', 'replayAllowed': False})
    return files, package_sha, seal


def publish_admin_fixed_package(operation_id, artifacts, verified):
    validated = validate_admin_fixed_package(operation_id, artifacts, verified)
    if validated is None:
        return None
    files, package_sha, seal = validated
    parent = os.open(DS_STATE_DIR, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    operation_fd = package_fd = None
    try:
        meta = os.fstat(parent)
        require(stat.S_ISDIR(meta.st_mode) and meta.st_uid == 0
                and meta.st_gid == 80 and stat.S_IMODE(meta.st_mode) == 0o770,
                'ADMIN_FIXED_DS_PARENT_UNKNOWN')
        os.mkdir(ADMIN_FIXED_QUALIFICATION_ID, 0o700, dir_fd=parent)
        os.fsync(parent)
        operation_fd = os.open(ADMIN_FIXED_QUALIFICATION_ID,
            os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=parent)
        os.mkdir('package', 0o700, dir_fd=operation_fd)
        os.fsync(operation_fd)
        package_fd = os.open('package', os.O_RDONLY | os.O_DIRECTORY |
            os.O_NOFOLLOW, dir_fd=operation_fd)
        for name in sorted(files):
            _admin_fixed_write(package_fd, name, files[name])
        _admin_fixed_write(package_fd, 'INSTALL-SEAL.json', seal)
        # Recheck named directories after the final fsync; a displaced package
        # must never be reported as installed.
        named = os.stat(ADMIN_FIXED_QUALIFICATION_ID, dir_fd=parent,
                        follow_symlinks=False)
        current = os.fstat(operation_fd)
        require((named.st_dev, named.st_ino) == (current.st_dev, current.st_ino)
                and current.st_uid == 0 and stat.S_IMODE(current.st_mode) == 0o700,
                'ADMIN_FIXED_NAMESPACE_CHANGED')
        named = os.stat('package', dir_fd=operation_fd, follow_symlinks=False)
        current = os.fstat(package_fd)
        require((named.st_dev, named.st_ino) == (current.st_dev, current.st_ino)
                and current.st_uid == 0 and stat.S_IMODE(current.st_mode) == 0o700,
                'ADMIN_FIXED_NAMESPACE_CHANGED')
        return package_sha
    finally:
        for fd in (package_fd, operation_fd, parent):
            if fd is not None:
                os.close(fd)
