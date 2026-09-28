"""Offline compiler for one original-executor admin qualification package.

No final reviewed package is bound here. In particular, this module cannot
select a live preimage, rollback, daemon or launcher by a caller argument.
The one fixed package directory and its independently reviewed SHA must be
frozen together before compilation can return any source bytes.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import stat


PACKAGE_ROOT = Path(__file__).with_name('admin-qualification-package')
REVIEWED_PACKAGE_SHA256 = None
QUALIFICATION_ID = 'original-router-qualification-20260927-v1'
CUT_OPERATION_ID = 'hr-s256-admin-emergency-cut-20260928-v1'
HOST_ID = '961534a5-8c94-487d-8e55-d324a54e821a'
HASH = re.compile(r'^[a-f0-9]{64}$')
FIELDS = {'version', 'qualificationOperationId', 'cutOperationId', 'hostId', 'finalTreeSha256',
          'preimageTreeSha256', 'rollbackOperationId', 'entryManifestSha256',
          'entrySha256', 'procedureSha256', 'adminProcedureSha256',
          'deploymentDriverSha256', 'adminObserverSha256', 'handoffSha256',
          'helperSha256', 'validatorSha256', 'daemonSha256', 'nodeSha256',
          'pythonSha256'}
FILES = {'entrySha256': 'driver.py', 'procedureSha256': 'procedure.py',
         'adminProcedureSha256': 'admin_procedure.py',
         'deploymentDriverSha256': 'deployment.py',
         'adminObserverSha256': 'admin_observation.mjs',
         'handoffSha256': 'handoff.py', 'helperSha256': 'child-proof.py',
         'daemonSha256': 'deployment_system.py', 'nodeSha256': 'node-runtime',
         'pythonSha256': 'python-runtime'}
VALIDATOR = 'packages/agent-router/src/reconciliation/quiescence-bundle.js'
SOURCE_SHA256 = {
    'entrySha256': '7d942d3be0cff48e077c39874674ad36fd49228c9a03366ec1ccf7727fb45e7f',
    'procedureSha256': '69335e4ec07b71d53380e854a2cc7b43b97118a5a6c5397a34675343411c9abf',
    'adminProcedureSha256': 'b1a1d5e148143c5ddf43fd644cb377cf7f74a4c561354b9098d80bd8c6933d44',
    'deploymentDriverSha256': '447c1c1a16fc6f5cac763695d4109f16c13959bec37d24f0bd0e267f57ecea53',
    'adminObserverSha256': '7669ad98e12eb9ab5aee85506b402d4a073770734343d3262ecee1385f4e234c',
    'handoffSha256': 'b9238434fe765d45b6746543fc0d9ff09c728daecdffed6f1202426f6c72ab62',
    'helperSha256': '3a7d067e1791102017e12f5f2c6f85329cc04c1b3af24deb9f14330c48ebd015',
}
TEMPLATE_SHA256 = {
    'admin_launcher_template.py': 'e7e3ceb7d7ad3a3768b6749af8d3dc74d8fc597f98cd1c592e2f23b321def892',
    'admin_root_carrier_template.py': '3d693ea3b579a5f95e39953eb4fecf70925b8f62e477900d9f60ef6c68c4bc0d',
}


class PackageRejected(Exception):
    pass


def require(ok, reason):
    if not ok:
        raise PackageRejected(reason)


def _object(raw):
    def unique(pairs):
        value = {}
        for key, item in pairs:
            require(key not in value, 'ADMIN_PACKAGE_DUPLICATE_FIELD')
            value[key] = item
        return value
    try:
        value = json.loads(raw, object_pairs_hook=unique)
    except (ValueError, TypeError) as exc:
        raise PackageRejected('ADMIN_PACKAGE_JSON_INVALID') from exc
    require(type(value) is dict, 'ADMIN_PACKAGE_SHAPE')
    return value


def _read(root, relative, limit):
    # Fixed compile-time relative names only; symlinks and partial reads fail.
    path = root / relative
    try:
        before = path.lstat()
    except OSError as exc:
        raise PackageRejected('ADMIN_PACKAGE_FILE_UNAVAILABLE') from exc
    require(stat.S_ISREG(before.st_mode) and before.st_nlink == 1
            and 0 < before.st_size <= limit, 'ADMIN_PACKAGE_FILE_INVALID')
    try:
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    except OSError as exc:
        raise PackageRejected('ADMIN_PACKAGE_FILE_UNAVAILABLE') from exc
    try:
        try:
            opened = os.fstat(fd)
            identity = lambda m: (m.st_dev, m.st_ino, m.st_mode, m.st_nlink,
                                  m.st_size, m.st_mtime_ns, m.st_ctime_ns)
            require(identity(before) == identity(opened), 'ADMIN_PACKAGE_FILE_CHANGED')
            raw = bytearray()
            while len(raw) < before.st_size:
                block = os.read(fd, before.st_size - len(raw))
                require(bool(block), 'ADMIN_PACKAGE_FILE_CHANGED')
                raw.extend(block)
            require(identity(opened) == identity(os.fstat(fd)),
                    'ADMIN_PACKAGE_FILE_CHANGED')
        except OSError as exc:
            raise PackageRejected('ADMIN_PACKAGE_FILE_UNAVAILABLE') from exc
    finally:
        os.close(fd)
    try:
        after = path.lstat()
    except OSError as exc:
        raise PackageRejected('ADMIN_PACKAGE_FILE_UNAVAILABLE') from exc
    require(len(raw) == before.st_size and identity(before) == identity(after),
            'ADMIN_PACKAGE_FILE_CHANGED')
    return bytes(raw)


def _tree_sha256(root):
    require(root.is_dir() and not root.is_symlink(), 'ADMIN_PACKAGE_TREE_MISSING')
    entries, dirs, total = [], 0, 0
    for current, names, files in os.walk(root, followlinks=False):
        for name in sorted(names):
            path = Path(current) / name
            require(path.is_dir() and not path.is_symlink(), 'ADMIN_PACKAGE_TREE_LINK')
            dirs += 1
        for name in sorted(files):
            path = Path(current) / name
            relative = path.relative_to(root).as_posix()
            raw = _read(root, relative, 128 * (1 << 20))
            entries.append({'p': relative, 's': len(raw), 'h': hashlib.sha256(raw).hexdigest()})
            total += len(raw)
            require(len(entries) <= 20000 and total <= 2 * (1 << 30), 'ADMIN_PACKAGE_TREE_BOUND')
        require(dirs <= 20000, 'ADMIN_PACKAGE_TREE_BOUND')
    entries.sort(key=lambda item: item['p'])
    raw = json.dumps({'dirs': dirs, 'entries': entries, 'links': [], 'total': total},
                     sort_keys=True, separators=(',', ':')).encode()
    return hashlib.sha256(raw).hexdigest()


def compile_fixed_admin_qualification():
    require(type(REVIEWED_PACKAGE_SHA256) is str
            and HASH.fullmatch(REVIEWED_PACKAGE_SHA256), 'ADMIN_PACKAGE_UNBOUND')
    raw = _read(PACKAGE_ROOT, 'PACKAGE.json', 8192)
    require(hashlib.sha256(raw).hexdigest() == REVIEWED_PACKAGE_SHA256,
            'ADMIN_PACKAGE_DIGEST_CHANGED')
    pins = _object(raw)
    require(set(pins) == FIELDS and type(pins['version']) is int and pins['version'] == 1
            and pins['qualificationOperationId'] == QUALIFICATION_ID
            and pins['cutOperationId'] == CUT_OPERATION_ID and pins['hostId'] == HOST_ID,
            'ADMIN_PACKAGE_BINDING_INVALID')
    for name in FIELDS - {'version', 'qualificationOperationId', 'cutOperationId',
                          'hostId', 'rollbackOperationId'}:
        require(type(pins[name]) is str and HASH.fullmatch(pins[name]),
                'ADMIN_PACKAGE_HASH_INVALID')
    require(type(pins['rollbackOperationId']) is str
            and re.fullmatch(r'[A-Za-z0-9_.-]{1,128}', pins['rollbackOperationId']),
            'ADMIN_PACKAGE_ROLLBACK_INVALID')
    require(pins['finalTreeSha256'] != pins['preimageTreeSha256'],
            'ADMIN_PACKAGE_PREIMAGE_AMBIGUOUS')
    for field, name in FILES.items():
        raw_file = _read(PACKAGE_ROOT, name, 128 * (1 << 20)
                         if name in ('node-runtime', 'deployment_system.py',
                                     'python-runtime') else 65536)
        require(hashlib.sha256(raw_file).hexdigest() == pins[field],
                'ADMIN_PACKAGE_SOURCE_CHANGED')
        if field in SOURCE_SHA256:
            require(pins[field] == SOURCE_SHA256[field],
                    'ADMIN_PACKAGE_SOURCE_VERSION')
    require(hashlib.sha256(_read(PACKAGE_ROOT / 'tree', VALIDATOR, 65536)).hexdigest()
            == pins['validatorSha256'], 'ADMIN_PACKAGE_VALIDATOR_CHANGED')
    require(_tree_sha256(PACKAGE_ROOT / 'tree') == pins['finalTreeSha256'],
            'ADMIN_PACKAGE_TREE_CHANGED')
    entry = _read(PACKAGE_ROOT, 'entry-manifest.json', 2048)
    require(hashlib.sha256(entry).hexdigest() == pins['entryManifestSha256'],
            'ADMIN_PACKAGE_ENTRY_MANIFEST_CHANGED')
    require(_object(entry) == {'entrySha256': pins['entrySha256'],
            'consumingBinarySha256': pins['finalTreeSha256'],
            'validatorSha256': pins['validatorSha256'],
            'helperSha256': pins['helperSha256'],
            'procedureSha256': pins['adminProcedureSha256']},
            'ADMIN_PACKAGE_ENTRY_MANIFEST_INVALID')
    name = 'admin_launcher_template.py'
    template_bytes = _read(Path(__file__).parent, name, 65536)
    require(hashlib.sha256(template_bytes).hexdigest() == TEMPLATE_SHA256[name],
            'ADMIN_COMPILER_TEMPLATE_CHANGED')
    template = template_bytes.decode('utf8')
    require(template.count('PINS = None') == 1, 'ADMIN_LAUNCHER_TEMPLATE_CHANGED')
    return template.replace('PINS = None', 'PINS = ' + repr(pins), 1).encode()


def compile_fixed_admin_carrier():
    # The launcher is derived first. The separate carrier pins its digest,
    # which avoids any launcher<->manifest or carrier<->launcher hash cycle.
    launcher = compile_fixed_admin_qualification()
    pins = _object(_read(PACKAGE_ROOT, 'PACKAGE.json', 8192))
    name = 'admin_root_carrier_template.py'
    template_bytes = _read(Path(__file__).parent, name, 65536)
    require(hashlib.sha256(template_bytes).hexdigest() == TEMPLATE_SHA256[name],
            'ADMIN_COMPILER_TEMPLATE_CHANGED')
    template = template_bytes.decode('utf8')
    require(template.count('PINS = None') == 1 and
            template.count('LAUNCHER_SHA = None') == 1,
            'ADMIN_CARRIER_TEMPLATE_CHANGED')
    return (template.replace('PINS = None', 'PINS = ' + repr(pins), 1)
            .replace('LAUNCHER_SHA = None',
                     'LAUNCHER_SHA = ' + repr(hashlib.sha256(launcher).hexdigest()), 1)
            .encode())
