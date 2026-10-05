"""Compile one private shim candidate from reviewed, closed offline bindings.

No installed state is read here. Runtime caller requests cannot supply these
bindings; the resulting shim remains inert unless every one-use input is set.
"""
import hashlib
import base64
import json
import re
import zlib

from build_admin_fixed_large_shim import build_bytes
import admin_final_binding as binder
import admin_package as package


REVIEWED_BINDING = None
INSTALL_ID = 'ds-hr-admin-private-install-20260928-v1'
SELF_UPDATE_ID = 'shim-hr-admin-fresh-20260928-v1'
HOST_ID = 'FF99ABD5-79A0-5EE0-9E0B-B62671271560'
OLD_NAMES = frozenset(('deployment_system.py', 'ds_client.py', 'plist',
                       'deployment-registry.json'))
NEW_NAMES = OLD_NAMES | {'node-runtime', 'python-runtime'}


def _digest(value):
    return type(value) is str and re.fullmatch('[a-f0-9]{64}', value) is not None


def _artifact(value):
    return (type(value) is dict and set(value) == {'sha256', 'size'}
            and _digest(value['sha256']) and type(value['size']) is int
            and 0 < value['size'] <= (128 << 20))


def _replace(source, key, value):
    if key == 'ADMIN_FRESH_HOOK_ACTIVE':
        before = key + ' = False\n'
    elif key == 'ADMIN_FRESH_NEW_SHA256':
        before = key + ' = None  # Six non-self artifacts; current shim comes from receipt.\n'
    else:
        before = key + ' = None\n'
    if source.count(before) != 1:
        raise ValueError('ADMIN_SHIM_COMPILER_ANCHOR_CHANGED:' + key)
    return source.replace(before, key + ' = ' + repr(value) + '\n', 1)


def compile_bytes():
    pins = REVIEWED_BINDING
    if type(pins) is not dict or set(pins) != {
        'hostId', 'selfUpdateOperationId', 'installOperationId',
        'captureOperationId', 'admissionOperationId', 'oldDsArtifacts',
        'newDsArtifacts', 'newNode', 'newPython', 'ownerUid',
        'sourceSha256', 'candidateSha256', 'binderSourceSha256'}:
        raise ValueError('ADMIN_SHIM_COMPILER_UNBOUND')
    if (pins['hostId'] != HOST_ID or
            pins['selfUpdateOperationId'] != SELF_UPDATE_ID or
            pins['installOperationId'] != INSTALL_ID or
            type(pins['captureOperationId']) is not str or
            type(pins['admissionOperationId']) is not str or
            not all(re.fullmatch('[a-z0-9][a-z0-9-]{0,127}', pins[name])
                    for name in ('captureOperationId', 'admissionOperationId')) or
            pins['captureOperationId'] == pins['admissionOperationId'] or
            type(pins['ownerUid']) is not int or pins['ownerUid'] <= 0 or
            type(pins['oldDsArtifacts']) is not dict or
            set(pins['oldDsArtifacts']) != OLD_NAMES or
            type(pins['newDsArtifacts']) is not dict or
            set(pins['newDsArtifacts']) != OLD_NAMES or
            not all(_artifact(row) for row in pins['oldDsArtifacts'].values()) or
            not all(_artifact(row) for row in pins['newDsArtifacts'].values()) or
            not all(_artifact(pins[name]) for name in ('newNode', 'newPython')) or
            pins['newDsArtifacts']['deployment_system.py']['size'] <= 16 << 20 or
            pins['oldDsArtifacts']['deployment_system.py']['size'] <= 16 << 20 or
            not all(_digest(pins[name]) for name in
                    ('sourceSha256', 'candidateSha256', 'binderSourceSha256'))):
        raise ValueError('ADMIN_SHIM_COMPILER_UNBOUND')
    source = build_bytes()
    if hashlib.sha256(source).hexdigest() != pins['sourceSha256']:
        raise ValueError('ADMIN_SHIM_COMPILER_SOURCE_CHANGED')
    bundle, file_hashes = _bundle(pins)
    text = source.decode('utf8', 'strict')
    new = dict(pins['newDsArtifacts'])
    new['node-runtime'] = pins['newNode']
    new['python-runtime'] = pins['newPython']
    old = pins['oldDsArtifacts']
    values = {
        'DS_FIXED_LARGE_INSTALL_OPERATION_ID': INSTALL_ID,
        'DS_FIXED_LARGE_INSTALL_SHA256': new['deployment_system.py']['sha256'],
        'DS_FIXED_LARGE_INSTALL_SIZE': new['deployment_system.py']['size'],
        'DS_FIXED_LARGE_ROLLBACK_SHA256': old['deployment_system.py']['sha256'],
        'DS_FIXED_LARGE_ROLLBACK_SIZE': old['deployment_system.py']['size'],
        'DS_FIXED_ROLLBACK_ARTIFACTS': {
            name: (old[name]['sha256'], old[name]['size']) for name in sorted(OLD_NAMES)},
        'ADMIN_FIXED_INSTALL_ID': INSTALL_ID,
        'ADMIN_FIXED_HOST_ID': HOST_ID,
        'ADMIN_FIXED_PYTHON_SHA256': pins['newPython']['sha256'],
        'ADMIN_FRESH_HOOK_ACTIVE': True,
        'ADMIN_FRESH_SELF_UPDATE_ID': SELF_UPDATE_ID,
        'ADMIN_FRESH_CAPTURE_ID': pins['captureOperationId'],
        'ADMIN_FRESH_ADMISSION_ID': pins['admissionOperationId'],
        'ADMIN_FRESH_OLD_DS_SHA256': old['deployment_system.py']['sha256'],
        'ADMIN_FRESH_OLD_SHA256': {name: old[name]['sha256'] for name in sorted(OLD_NAMES)},
        'ADMIN_FRESH_NEW_SHA256': {name: new[name]['sha256'] for name in sorted(NEW_NAMES)},
        'ADMIN_FRESH_STAGED_SIZE': {name: new[name]['size'] for name in sorted(OLD_NAMES)},
        'ADMIN_FRESH_OWNER_UID': pins['ownerUid'],
        'ADMIN_FRESH_BUNDLE': bundle,
        'ADMIN_FRESH_BUNDLE_SHA256': hashlib.sha256(bundle).hexdigest(),
        'ADMIN_FRESH_BUNDLE_FILES': file_hashes,
        'ADMIN_FRESH_BINDER_SHA256': pins['binderSourceSha256'],
        'ADMIN_FRESH_CANDIDATE_SHA256': pins['candidateSha256'],
    }
    for key, value in values.items():
        text = _replace(text, key, value)
    before = 'ADMIN_FIXED_ROOT_HOST_OBSERVER = None\n'
    if text.count(before) != 1:
        raise ValueError('ADMIN_SHIM_COMPILER_ANCHOR_CHANGED:hostObserver')
    text = text.replace(before,
                        'ADMIN_FIXED_ROOT_HOST_OBSERVER = observe_fixed_host\n', 1)
    return text.encode('utf8')


def _bundle(pins):
    """Capture only reviewed immutable offline inputs, never runtime paths."""
    root = binder.CANDIDATE_DIRECTORY
    raw = package._read(root, 'CANDIDATE.json', 8192)
    if hashlib.sha256(raw).hexdigest() != pins['candidateSha256']:
        raise ValueError('ADMIN_SHIM_CANDIDATE_CHANGED')
    candidate = json.loads(raw)
    if (candidate.get('executable') is not False or
            candidate.get('hostId') != HOST_ID or
            candidate.get('finalTreeSha256') != binder.FINAL_TREE_SHA or
            package._tree_sha256(root / 'tree') != binder.FINAL_TREE_SHA):
        raise ValueError('ADMIN_SHIM_CANDIDATE_CHANGED')
    source_root = package.PACKAGE_ROOT.parent
    source_pins = candidate.get('activationSourcePins')
    if (type(source_pins) is not dict or
            set(source_pins) != {
                'admin_package.py', 'build_admin_private_ds_candidate.py',
                'admin_ds_private_bootstrap.py', 'build_admin_fixed_large_shim.py',
                'admin_fixed_shim_publisher.py', 'admin_fresh_producer.py',
                'admin_fresh_shim_hook.py', 'admin_fresh_bind_hook.py',
                'compile_admin_fixed_shim.py', 'admin_host_identity.py'}):
        raise ValueError('ADMIN_SHIM_SOURCE_PINS_CHANGED')
    names = ['CANDIDATE.json']
    for subdir in ('tree', 'package-inputs'):
        names.extend(path.relative_to(root).as_posix() for path in
                     (root / subdir).rglob('*') if path.is_file())
    values = {name: package._read(root, name, 128 << 20) for name in names}
    tree = {name[5:]: value for name, value in values.items()
            if name.startswith('tree/')}
    directories = {'/'.join(name.split('/')[:depth]) for name in tree
                   for depth in range(1, len(name.split('/')))}
    entries = [{'p': name, 's': len(value),
                'h': hashlib.sha256(value).hexdigest()}
               for name, value in sorted(tree.items())]
    captured = json.dumps({'dirs': len(directories), 'entries': entries,
                           'links': [], 'total': sum(row['s'] for row in entries)},
                          sort_keys=True, separators=(',', ':')).encode()
    if (hashlib.sha256(captured).hexdigest() != binder.FINAL_TREE_SHA or
            len(tree) != len([name for name in names if name.startswith('tree/')])):
        raise ValueError('ADMIN_SHIM_CAPTURE_CHANGED')
    source_inputs = candidate.get('sourcePinned')
    if (type(source_inputs) is not dict or
            set(source_inputs) != set(package.SOURCE_SHA256) or
            any(hashlib.sha256(values['package-inputs/' + package.FILES[field]])
                .hexdigest() != expected for field, expected in source_inputs.items()) or
            hashlib.sha256(values['package-inputs/entry-manifest.json'])
                .hexdigest() != candidate.get('entryManifestSha256')):
        raise ValueError('ADMIN_SHIM_CAPTURE_CHANGED')
    for name, expected in source_pins.items():
        source = package._read(source_root, name, 65536)
        if hashlib.sha256(source).hexdigest() != expected:
            raise ValueError('ADMIN_SHIM_SOURCE_CHANGED:' + name)
        values[name] = source
    for name in ('admin_final_binding.py', 'admin_launcher_template.py',
                 'admin_root_carrier_template.py'):
        values[name] = package._read(source_root, name, 65536)
    if any(hashlib.sha256(values[name]).hexdigest() != pin
           for name, pin in package.TEMPLATE_SHA256.items()):
        raise ValueError('ADMIN_SHIM_CAPTURE_CHANGED')
    if hashlib.sha256(values['admin_final_binding.py']).hexdigest() != \
            pins['binderSourceSha256']:
        raise ValueError('ADMIN_SHIM_BINDER_CHANGED')
    if (package._tree_sha256(root / 'tree') != binder.FINAL_TREE_SHA or
            package._read(root, 'CANDIDATE.json', 8192) != raw):
        raise ValueError('ADMIN_SHIM_CANDIDATE_CHANGED')
    encoded = {name: base64.b64encode(value).decode('ascii')
               for name, value in sorted(values.items())}
    packed = json.dumps(encoded, sort_keys=True, separators=(',', ':')).encode()
    if len(packed) > 8 << 20:
        raise ValueError('ADMIN_SHIM_BUNDLE_TOO_LARGE')
    compressed = zlib.compress(packed, 9)
    return compressed, {name: hashlib.sha256(value).hexdigest()
                        for name, value in values.items()}
