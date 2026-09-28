"""Default-inert, fixed offline binder for one admin qualification package.

The original root executor must independently publish and review the exact
fresh input digest before this compiler is armed. This module never reads the
installed app or DS, acquires a service lock, or authorizes a production run.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import stat

import admin_package as package
from admin_fixed_shim_publisher import ADMIN_FIXED_NAMES


CANDIDATE_DIRECTORY = Path('/Users/yanfenma/workspace/artifacts/DEPLOYMENT_BACKLOG/'
    'HR-ADMIN-EXACT-OFFLINE-CANDIDATE-20260928-v2')
CANDIDATE_SHA256 = 'ff079402e47fd216ce5cd241dec98b3d7066f69886ec51fae1a1940129423249'
FINAL_TREE_SHA = '508b4042c5b1dd718c8c0858164a32ccbee65f68486c0aec4ee27b7601234968'
QUALIFICATION_ID = package.QUALIFICATION_ID
CUT_OPERATION_ID = package.CUT_OPERATION_ID
HOST_ID = package.HOST_ID
INSTALL_OPERATION_ID = 'ds-hr-admin-private-install-20260928-v1'
FRESH_DIRECTORY = Path('/private/var/db/agent-deploy-system/admin-final-binding')
REVIEWED_FRESH_SHA256 = None
ROOT_UID = 0
OLD_DS_NAMES = frozenset(('deployment_system.py', 'ds_client.py', 'plist',
                           'deployment-registry.json'))
NEW_RUNTIME_NAMES = frozenset(('deployment_system.py', 'node-runtime', 'python-runtime'))
FRESH_BYTE_NAMES = NEW_RUNTIME_NAMES | OLD_DS_NAMES | {'deploy_shim.py'}
TREE_SHA = package._tree_sha256


class BindingRejected(Exception):
    pass


def require(ok, code):
    if not ok:
        raise BindingRejected(code)


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':')).encode()


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def _hash(value):
    return type(value) is str and re.fullmatch(r'[a-f0-9]{64}', value)


def _json(raw):
    def unique(pairs):
        result = {}
        for key, value in pairs:
            require(key not in result, 'ADMIN_BINDING_DUPLICATE')
            result[key] = value
        return result
    try:
        value = json.loads(raw, object_pairs_hook=unique)
    except (ValueError, UnicodeError) as exc:
        raise BindingRejected('ADMIN_BINDING_JSON') from exc
    require(type(value) is dict, 'ADMIN_BINDING_SHAPE')
    return value


def _read_root(name, limit):
    """Read one fixed name under the root-held fresh-input directory."""
    require(name in FRESH_BYTE_NAMES | {'FRESH.json'}, 'ADMIN_BINDING_NAME')
    root = FRESH_DIRECTORY
    before_dir = root.lstat()
    require(stat.S_ISDIR(before_dir.st_mode) and before_dir.st_uid == ROOT_UID
            and not stat.S_IMODE(before_dir.st_mode) & 0o077,
            'ADMIN_BINDING_CUSTODY')
    parent = os.open(root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        require((os.fstat(parent).st_dev, os.fstat(parent).st_ino) ==
                (before_dir.st_dev, before_dir.st_ino), 'ADMIN_BINDING_CHANGED')
        fd = os.open(name, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=parent)
        try:
            before = os.fstat(fd)
            identity = lambda m: (m.st_dev, m.st_ino, m.st_mode, m.st_uid,
                                  m.st_gid, m.st_nlink, m.st_size,
                                  m.st_mtime_ns, m.st_ctime_ns)
            require(stat.S_ISREG(before.st_mode) and before.st_uid == ROOT_UID
                    and stat.S_IMODE(before.st_mode) == 0o600
                    and before.st_nlink == 1 and 0 < before.st_size <= limit,
                    'ADMIN_BINDING_CUSTODY')
            raw = os.pread(fd, before.st_size + 1, 0)
            require(len(raw) == before.st_size
                    and identity(os.fstat(fd)) == identity(before)
                    and identity(os.stat(name, dir_fd=parent,
                                         follow_symlinks=False)) == identity(before)
                    and (root.lstat().st_dev, root.lstat().st_ino) ==
                    (before_dir.st_dev, before_dir.st_ino),
                    'ADMIN_BINDING_CHANGED')
            return raw
        finally:
            os.close(fd)
    finally:
        os.close(parent)


def _checked_inputs(raw):
    value = _json(raw)
    require(set(value) == {'version', 'qualificationOperationId', 'cutOperationId',
            'installOperationId', 'hostId', 'finalTreeSha256',
            'currentAppTreeSha256', 'preimageTreeSha256', 'rollbackOperationId',
            'oldDsArtifacts', 'newDsArtifacts', 'reviewedShim',
            'newRuntime'} and type(value['version']) is int
            and value['version'] == 1 and value['qualificationOperationId'] == QUALIFICATION_ID
            and value['cutOperationId'] == CUT_OPERATION_ID
            and value['installOperationId'] == INSTALL_OPERATION_ID
            and value['hostId'] == HOST_ID
            and value['finalTreeSha256'] == FINAL_TREE_SHA
            and _hash(value['currentAppTreeSha256'])
            and value['preimageTreeSha256'] == value['currentAppTreeSha256']
            and value['preimageTreeSha256'] != FINAL_TREE_SHA
            and type(value['rollbackOperationId']) is str
            and re.fullmatch(r'[A-Za-z0-9_.-]{1,128}', value['rollbackOperationId']),
            'ADMIN_BINDING_IDENTITY')
    for key, names in (('oldDsArtifacts', OLD_DS_NAMES),
                       ('newDsArtifacts', OLD_DS_NAMES),
                       ('reviewedShim', {'deploy_shim.py'}),
                       ('newRuntime', NEW_RUNTIME_NAMES)):
        rows = value[key]
        require(type(rows) is dict and set(rows) == names,
                'ADMIN_BINDING_ARTIFACTS')
        for name, row in rows.items():
            require(type(row) is dict and set(row) == {'sha256', 'size'}
                    and _hash(row['sha256']) and type(row['size']) is int
                    and 0 < row['size'] <= (128 << 20),
                    'ADMIN_BINDING_ARTIFACTS')
    return value


def bind(output):
    """Create a non-executable package only from independently pinned inputs."""
    require(_hash(REVIEWED_FRESH_SHA256), 'ADMIN_BINDING_UNBOUND')
    output = Path(output)
    require(not output.exists(), 'ADMIN_BINDING_OUTPUT_EXISTS')
    raw = _read_root('FRESH.json', 8192)
    require(sha(raw) == REVIEWED_FRESH_SHA256, 'ADMIN_BINDING_FRESH_CHANGED')
    inputs = _checked_inputs(raw)
    candidate_raw = package._read(CANDIDATE_DIRECTORY, 'CANDIDATE.json', 8192)
    require(sha(candidate_raw) == CANDIDATE_SHA256, 'ADMIN_BINDING_CANDIDATE_CHANGED')
    candidate = _json(candidate_raw)
    require(candidate.get('executable') is False
            and candidate.get('finalTreeSha256') == FINAL_TREE_SHA
            and candidate.get('hostId') == HOST_ID,
            'ADMIN_BINDING_CANDIDATE_CHANGED')
    require(TREE_SHA(CANDIDATE_DIRECTORY / 'tree') == FINAL_TREE_SHA,
            'ADMIN_BINDING_TREE_CHANGED')
    new_bytes = {name: _read_root(name, 128 << 20) for name in NEW_RUNTIME_NAMES}
    for name, value in new_bytes.items():
        require(sha(value) == inputs['newRuntime'][name]['sha256']
                and len(value) == inputs['newRuntime'][name]['size'],
                'ADMIN_BINDING_RUNTIME_CHANGED')
    install_bytes = {name: _read_root(name, 128 << 20) for name in
                     OLD_DS_NAMES | {'deploy_shim.py'}}
    for name, value in install_bytes.items():
        row = (inputs['reviewedShim'] if name == 'deploy_shim.py'
               else inputs['newDsArtifacts'])[name]
        require(sha(value) == row['sha256'] and len(value) == row['size'],
                'ADMIN_BINDING_INSTALL_CHANGED')
    require(inputs['newDsArtifacts']['deployment_system.py'] ==
            inputs['newRuntime']['deployment_system.py'],
            'ADMIN_BINDING_INSTALL_CHANGED')
    fixed = {name: package._read(CANDIDATE_DIRECTORY / 'package-inputs', name, 65536)
             for name in package.FILES.values()
             if name not in NEW_RUNTIME_NAMES}
    for field, expected in package.SOURCE_SHA256.items():
        require(sha(fixed[package.FILES[field]]) == expected,
                'ADMIN_BINDING_SOURCE_CHANGED')
    entry = package._read(CANDIDATE_DIRECTORY / 'package-inputs',
                          'entry-manifest.json', 2048)
    require(sha(entry) == candidate['entryManifestSha256'],
            'ADMIN_BINDING_ENTRY_CHANGED')
    pins = {'version': 1, 'qualificationOperationId': QUALIFICATION_ID,
            'cutOperationId': CUT_OPERATION_ID, 'hostId': HOST_ID,
            'finalTreeSha256': FINAL_TREE_SHA,
            'preimageTreeSha256': inputs['preimageTreeSha256'],
            'rollbackOperationId': inputs['rollbackOperationId'],
            'entryManifestSha256': sha(entry),
            'validatorSha256': candidate['validatorSha256']}
    for field, name in package.FILES.items():
        pins[field] = sha(new_bytes[name] if name in new_bytes else fixed[name])
    require(set(pins) == package.FIELDS, 'ADMIN_BINDING_PACKAGE_SHAPE')
    # The existing compiler parses canonical PACKAGE.json insertion order.
    # Match its launcher/carrier bytes exactly, rather than only their values.
    pins = dict(sorted(pins.items()))
    # All relationships are checked before any output path is created.
    require(_json(entry) == {'entrySha256': pins['entrySha256'],
            'consumingBinarySha256': FINAL_TREE_SHA,
            'validatorSha256': pins['validatorSha256'],
            'helperSha256': pins['helperSha256'],
            'procedureSha256': pins['adminProcedureSha256']},
            'ADMIN_BINDING_ENTRY_CHANGED')
    template = package._read(package.PACKAGE_ROOT.parent,
                             'admin_launcher_template.py', 65536)
    carrier_template = package._read(package.PACKAGE_ROOT.parent,
                                     'admin_root_carrier_template.py', 65536)
    require(sha(template) == package.TEMPLATE_SHA256['admin_launcher_template.py']
            and sha(carrier_template) == package.TEMPLATE_SHA256['admin_root_carrier_template.py'],
            'ADMIN_BINDING_TEMPLATE_CHANGED')
    launcher = template.decode().replace('PINS = None', 'PINS = ' + repr(pins), 1).encode()
    require(template.count(b'PINS = None') == 1, 'ADMIN_BINDING_TEMPLATE_CHANGED')
    carrier = (carrier_template.decode()
               .replace('PINS = None', 'PINS = ' + repr(pins), 1)
               .replace('LAUNCHER_SHA = None',
                        'LAUNCHER_SHA = ' + repr(sha(launcher)), 1).encode())
    require(carrier_template.count(b'PINS = None') == 1
            and carrier_template.count(b'LAUNCHER_SHA = None') == 1,
            'ADMIN_BINDING_TEMPLATE_CHANGED')
    package_raw = canonical(pins) + b'\n'
    publisher_files = {**fixed, 'entry-manifest.json': entry,
                       'admin_launcher.py': launcher,
                       'admin_root_carrier.py': carrier,
                       'PACKAGE.json': package_raw}
    require(set(publisher_files) == ADMIN_FIXED_NAMES,
            'ADMIN_BINDING_PUBLISHER_SHAPE')
    publisher_hashes = {name: sha(raw) for name, raw in publisher_files.items()}
    publisher_hashes['deployment_system.py'] = sha(new_bytes['deployment_system.py'])
    publisher_package_sha = sha(canonical(publisher_hashes))
    result = {'version': 1, 'qualificationOperationId': QUALIFICATION_ID,
              'cutOperationId': CUT_OPERATION_ID,
              'installOperationId': INSTALL_OPERATION_ID,
              'hostId': HOST_ID, 'finalTreeSha256': FINAL_TREE_SHA,
              'preimageTreeSha256': inputs['preimageTreeSha256'],
              'rollbackOperationId': inputs['rollbackOperationId'],
              'freshEvidenceSha256': REVIEWED_FRESH_SHA256,
              'packageManifestSha256': sha(package_raw),
              'expectedPublisherPackageSha256': publisher_package_sha,
              'expectedPublisherFileSha256': publisher_hashes,
              'launcherSha256': sha(launcher), 'carrierSha256': sha(carrier),
              'newRuntime': inputs['newRuntime'],
              'newDsArtifacts': inputs['newDsArtifacts'],
              'reviewedShim': inputs['reviewedShim'],
              'rollbackArtifacts': inputs['oldDsArtifacts'],
              'productionAuthorized': False}
    output.mkdir()
    shutil.copytree(CANDIDATE_DIRECTORY / 'tree', output / 'tree')
    require(TREE_SHA(output / 'tree') == FINAL_TREE_SHA,
            'ADMIN_BINDING_OUTPUT_CHANGED')
    for name, value in fixed.items():
        (output / name).write_bytes(value)
    for name, value in new_bytes.items():
        (output / name).write_bytes(value)
    install_dir = output / 'install-artifacts'
    install_dir.mkdir()
    for name, value in install_bytes.items():
        (install_dir / name).write_bytes(value)
    (output / 'entry-manifest.json').write_bytes(entry)
    (output / 'admin_launcher.py').write_bytes(launcher)
    (output / 'admin_root_carrier.py').write_bytes(carrier)
    (output / 'PACKAGE.json').write_bytes(package_raw)
    require(TREE_SHA(output / 'tree') == FINAL_TREE_SHA,
            'ADMIN_BINDING_OUTPUT_CHANGED')
    for name, expected in {**fixed, **new_bytes,
                           'entry-manifest.json': entry,
                           'admin_launcher.py': launcher,
                           'admin_root_carrier.py': carrier,
                           'PACKAGE.json': package_raw}.items():
        require(package._read(output, name, 128 << 20) == expected,
                'ADMIN_BINDING_OUTPUT_CHANGED')
    for name, expected in install_bytes.items():
        require(package._read(install_dir, name, 128 << 20) == expected,
                'ADMIN_BINDING_OUTPUT_CHANGED')
    (output / 'OPERATION.json').write_bytes(canonical(result) + b'\n')
    return result
