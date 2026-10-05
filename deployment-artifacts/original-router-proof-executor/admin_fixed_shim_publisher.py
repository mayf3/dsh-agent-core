"""Inert fixed package publisher for one reviewed DS installation branch.

Injected only into an exact shim source candidate. The four public install
artifacts and request grammar remain unchanged; all private bytes are compiled
into that reviewed shim except the verified staged daemon itself.
"""
import hashlib
import json
import os
import stat

ADMIN_FIXED_INSTALL_ID = None
ADMIN_FIXED_HOST_ID = None
ADMIN_FIXED_PYTHON_SHA256 = None
ADMIN_FIXED_PACKAGE_ROOT = ('/private/var/db/agent-core-admin-final-binding-s256/'
                            'qualification-package')
ADMIN_FIXED_ROOT_UID = 0
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
            and ADMIN_FIXED_PACKAGE_ROOT ==
                '/private/var/db/agent-core-admin-final-binding-s256/qualification-package'
            and ADMIN_FIXED_ROOT_HOST_OBSERVER is not None)


def _admin_fixed_read(parent, name, maximum):
    require(name in ADMIN_FIXED_NAMES | {'FRESH.json', 'PUBLISH-SEAL.json',
                                         'OPERATION-REVIEW.json'},
            'ADMIN_FIXED_SOURCE_NAME')
    fd = os.open(name, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=parent)
    try:
        before = os.fstat(fd)
        identity = lambda st: (st.st_dev, st.st_ino, st.st_mode, st.st_uid,
                               st.st_gid, st.st_nlink, st.st_size,
                               st.st_mtime_ns, st.st_ctime_ns)
        require(stat.S_ISREG(before.st_mode)
                and before.st_uid == ADMIN_FIXED_ROOT_UID
                and stat.S_IMODE(before.st_mode) == 0o600
                and before.st_nlink == 1 and 0 < before.st_size <= maximum,
                'ADMIN_FIXED_SOURCE_CUSTODY')
        raw = os.pread(fd, before.st_size + 1, 0)
        require(len(raw) == before.st_size
                and identity(os.fstat(fd)) == identity(before)
                and identity(os.stat(name, dir_fd=parent,
                                     follow_symlinks=False)) == identity(before),
                'ADMIN_FIXED_SOURCE_CHANGED')
        return raw
    finally:
        os.close(fd)


def _admin_fixed_root_package(daemon):
    """Consume only the fixed post-FRESH root seal under the install lock."""
    root = ADMIN_FIXED_PACKAGE_ROOT
    fresh_parent = os.open(os.path.dirname(root),
                           os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    package = None
    try:
        parent_meta = os.fstat(fresh_parent)
        require(stat.S_ISDIR(parent_meta.st_mode)
                and parent_meta.st_uid == ADMIN_FIXED_ROOT_UID
                and stat.S_IMODE(parent_meta.st_mode) == 0o700,
                'ADMIN_FIXED_SOURCE_CUSTODY')
        fresh = _admin_fixed_read(fresh_parent, 'FRESH.json', 8192)
        package = os.open('qualification-package',
                          os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW,
                          dir_fd=fresh_parent)
        package_meta = os.fstat(package)
        require(stat.S_ISDIR(package_meta.st_mode)
                and package_meta.st_uid == ADMIN_FIXED_ROOT_UID
                and stat.S_IMODE(package_meta.st_mode) == 0o700,
                'ADMIN_FIXED_SOURCE_CUSTODY')
        seal_raw = _admin_fixed_read(package, 'PUBLISH-SEAL.json', 8192)
        seal = json.loads(seal_raw)
        require(type(seal) is dict and set(seal) ==
                {'version', 'installOperationId', 'hostId', 'freshEvidenceSha256',
                 'expectedPublisherPackageSha256', 'expectedPublisherFileSha256',
                 'state', 'replayAllowed'}
                and type(seal['version']) is int and seal['version'] == 1
                and seal['installOperationId'] == ADMIN_FIXED_INSTALL_ID
                and seal['hostId'] == ADMIN_FIXED_HOST_ID
                and seal['freshEvidenceSha256'] == hashlib.sha256(fresh).hexdigest()
                and seal['state'] == 'SEALED' and seal['replayAllowed'] is False
                and type(seal['expectedPublisherFileSha256']) is dict
                and set(seal['expectedPublisherFileSha256']) ==
                    ADMIN_FIXED_NAMES | {'deployment_system.py'},
                'ADMIN_FIXED_SOURCE_SEAL')
        files = {name: _admin_fixed_read(package, name, 65536)
                 for name in ADMIN_FIXED_NAMES}
        hashes = {name: hashlib.sha256(raw).hexdigest()
                  for name, raw in files.items()}
        hashes['deployment_system.py'] = hashlib.sha256(daemon).hexdigest()
        require(hashes == seal['expectedPublisherFileSha256']
                and hashlib.sha256(canonical(hashes)).hexdigest() ==
                    seal['expectedPublisherPackageSha256'],
                'ADMIN_FIXED_SOURCE_CHANGED')
        review = json.loads(_admin_fixed_read(package, 'OPERATION-REVIEW.json', 2048))
        require(type(review) is dict and set(review) ==
                {'version', 'installOperationId', 'hostId', 'freshEvidenceSha256',
                 'publishSealSha256', 'packageSha256', 'state'}
                and type(review['version']) is int and review['version'] == 1
                and review['installOperationId'] == ADMIN_FIXED_INSTALL_ID
                and review['hostId'] == ADMIN_FIXED_HOST_ID
                and review['freshEvidenceSha256'] == seal['freshEvidenceSha256']
                and review['publishSealSha256'] == hashlib.sha256(seal_raw).hexdigest()
                and review['packageSha256'] == seal['expectedPublisherPackageSha256']
                and review['state'] == 'REVIEWED',
                'ADMIN_FIXED_SOURCE_UNREVIEWED')
        require(os.fstat(package).st_ino == package_meta.st_ino
                and os.stat('qualification-package', dir_fd=fresh_parent,
                            follow_symlinks=False).st_ino == package_meta.st_ino,
                'ADMIN_FIXED_SOURCE_CHANGED')
        return files, seal['expectedPublisherPackageSha256']
    finally:
        if package is not None:
            os.close(package)
        os.close(fresh_parent)


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
    source_files, source_sha = _admin_fixed_root_package(verified['deployment_system.py'])
    files = dict(source_files,
                 **{'deployment_system.py': verified['deployment_system.py']})
    require(artifacts['deployment_system.py'] ==
                hashlib.sha256(files['deployment_system.py']).hexdigest(),
            'ADMIN_FIXED_PACKAGE_CHANGED')
    hashes = {name: hashlib.sha256(raw).hexdigest() for name, raw in files.items()}
    package_sha = hashlib.sha256(canonical(hashes)).hexdigest()
    require(package_sha == source_sha,
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
