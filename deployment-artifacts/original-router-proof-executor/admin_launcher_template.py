"""Original root executor's separate fixed admin qualifier launcher.

The sealed package compiler replaces PINS exactly once. This source is inert
until its root-owned installed bytes and six inherited descriptors are bound
by an independently reviewed operation package; it has no caller path or
generic action surface. It never sends a turn as an Owner.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import sys
import types


PINS = None


class QualificationRejected(Exception):
    pass


def require(ok, reason):
    if not ok:
        raise QualificationRejected(reason)


def _sealed(fd, expected, limit):
    before = os.fstat(fd)
    require(stat.S_ISREG(before.st_mode) and before.st_uid == 0
            and not (stat.S_IMODE(before.st_mode) & 0o022) and before.st_nlink == 1
            and 0 < before.st_size <= limit, 'ADMIN_LAUNCH_DESCRIPTOR_CUSTODY')
    raw = bytearray()
    while len(raw) < before.st_size:
        block = os.pread(fd, before.st_size - len(raw), len(raw))
        require(bool(block), 'ADMIN_LAUNCH_DESCRIPTOR_SHORT_READ')
        raw.extend(block)
    after = os.fstat(fd)
    identity = lambda m: (m.st_dev, m.st_ino, m.st_mode, m.st_uid, m.st_gid,
                          m.st_nlink, m.st_size, m.st_mtime_ns, m.st_ctime_ns)
    require(identity(before) == identity(after)
            and hashlib.sha256(raw).hexdigest() == expected,
            'ADMIN_LAUNCH_DESCRIPTOR_CHANGED')
    return bytes(raw)


def run(argv=None):
    # No path/FD/euid read before a separately reviewed exact package is
    # compiled. A source checkout or old package is always zero-effect.
    require(type(PINS) is dict and PINS.get('qualificationOperationId') ==
            'original-router-qualification-20260927-v1'
            and PINS.get('cutOperationId') ==
            'hr-s256-admin-emergency-cut-20260928-v1', 'ADMIN_PACKAGE_UNBOUND')
    args = sys.argv[1:] if argv is None else argv
    require(len(args) == 2 and args[0] == '--original-qualification-fds'
            and type(args[1]) is str
            and re.fullmatch(r'[0-9]+(,[0-9]+){5}', args[1]),
            'ADMIN_LAUNCH_INVOCATION')
    fds = tuple(int(value) for value in args[1].split(','))
    require(len(set(fds)) == 6 and all(3 <= fd <= 1024 for fd in fds),
            'ADMIN_LAUNCH_DESCRIPTORS')
    parent = Path(__file__).parent
    entry = parent / 'driver.py'  # Same fixed root package, never a caller path.
    for path in (Path(__file__), parent, entry):
        meta = path.lstat()
        require(meta.st_uid == 0 and not stat.S_IMODE(meta.st_mode) & 0o022
                and not path.is_symlink(), 'ADMIN_LAUNCH_NAMESPACE')
    manifest_raw = _sealed(fds[2], PINS['entryManifestSha256'], 2048)
    def unique(pairs):
        value = {}
        for key, item in pairs:
            require(key not in value, 'ADMIN_LAUNCH_MANIFEST_INVALID')
            value[key] = item
        return value
    try:
        manifest = json.loads(manifest_raw, object_pairs_hook=unique)
    except (ValueError, TypeError) as exc:
        raise QualificationRejected('ADMIN_LAUNCH_MANIFEST_INVALID') from exc
    require(type(manifest) is dict and manifest == {
        'entrySha256': PINS['entrySha256'],
        'consumingBinarySha256': PINS['finalTreeSha256'],
        'validatorSha256': PINS['validatorSha256'],
        'helperSha256': PINS['helperSha256'],
        'procedureSha256': PINS['adminProcedureSha256'],
    }, 'ADMIN_LAUNCH_MANIFEST_INVALID')
    entry_raw = _sealed(fds[3], PINS['entrySha256'], 65536)
    own = entry.lstat()
    passed = os.fstat(fds[3])
    require((own.st_dev, own.st_ino) == (passed.st_dev, passed.st_ino)
            and own.st_uid == 0 and stat.S_ISREG(own.st_mode),
            'ADMIN_LAUNCH_ENTRY_CHANGED')
    _sealed(fds[4], PINS['helperSha256'], 65536)
    _sealed(fds[5], PINS['daemonSha256'], 128 * (1 << 20))
    module = types.ModuleType('_original_fixed_admin_driver')
    module.__file__ = str(entry)
    sys.modules[module.__name__] = module
    try:
        exec(compile(entry_raw, str(entry), 'exec'), module.__dict__)
        module.QUALIFIED_ADMIN_PROCEDURE_SHA = module.ADMIN_PROCEDURE_SHA
        module.QUALIFIED_OWNER_SHA = None
        module.QUALIFIED_ORIGINAL_ENTRY = module._EntryBinding(
            PINS['entrySha256'], PINS['entryManifestSha256'],
            PINS['finalTreeSha256'], PINS['validatorSha256'], PINS['helperSha256'])
        module.QUALIFIED_DEPLOYMENT = module._DeploymentBinding(
            PINS['finalTreeSha256'], PINS['preimageTreeSha256'],
            PINS['rollbackOperationId'])
        for key, value in {
            'DAEMON_SHA': PINS['daemonSha256'], 'NODE_SHA': PINS['nodeSha256'],
            'ADMIN_OBSERVER_SHA': PINS['adminObserverSha256'],
            'HANDOFF_SHA': PINS['handoffSha256'],
            'PROCEDURE_DRIVER_SHA': PINS['procedureSha256'],
            'ADMIN_PROCEDURE_SHA': PINS['adminProcedureSha256'],
            'DEPLOYMENT_DRIVER_SHA': PINS['deploymentDriverSha256'],
            'QUALIFIED_EXECUTING_ENTRY_FD': fds[3],
        }.items():
            setattr(module, key, value)
        # Revalidate the same immutable descriptors after compilation; a
        # swapped FD or changed source is UNKNOWN before the first effect.
        _sealed(fds[2], PINS['entryManifestSha256'], 2048)
        _sealed(fds[3], PINS['entrySha256'], 65536)
        _sealed(fds[5], PINS['daemonSha256'], 128 * (1 << 20))
        return module.FixedOriginalDriver().run()
    finally:
        sys.modules.pop(module.__name__, None)


if __name__ == '__main__':
    run()
