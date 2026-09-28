"""Build the fixed, non-executable admin source closure from reviewed offline bytes.

This module has no installed-tree or host reader. It deliberately does not
write PACKAGE.json: live preimage, rollback, runtime and DS pins are unavailable
to an offline source stage.
"""
import hashlib
import json
from pathlib import Path
import shutil

from admin_package import (_tree_sha256, _read, PACKAGE_ROOT, SOURCE_SHA256,
                           FILES, QUALIFICATION_ID, CUT_OPERATION_ID, HOST_ID)


ARTIFACTS = Path('/Users/yanfenma/workspace/artifacts/DEPLOYMENT_BACKLOG')
RESTORED = ARTIFACTS / 'HR-S256-RESTORED-SOURCE-SNAPSHOT-20260928-v1/tree'
SELECTIVE = ARTIFACTS / 'HR-S256-POSTRESTORE-SELECTIVE-APP-20260928-v1/tree'
ADMIN_STAGE = ARTIFACTS / 'HR-S256-ADMIN-EMERGENCY-NONPROD-SOURCE-STAGE-20260928-v1'
RESTORED_SHA = 'd52212d987bd53ca5928cfa33c673d1133102f03d57274498a26c0e6ca1a5dad'
SELECTIVE_SHA = '5544e0d34774d29a07b34ddb27b664344aa531207a69461ea7a10321bca3ddee'
ADMIN_STAGE_SHA = 'ca1cae3b98f49a2144c1c49a7a199256c1008b717b9fb78f18f01b09073f9210'
HOST_JOIN = {
    'packages/production-runtime/src/native-arm64/hr-admin-canary-contract.mjs':
        ('512b9268c288edd54460c2be361460df6490153d00d513c4151afd8feb78a581',
         'cef4dbf176183f9ec1722ac68816f854c1c8e02d9c4f50cfbbe754033efd3115'),
    'packages/production-runtime/src/native-arm64/hr-s256-r2-startup-context.mjs':
        ('a2cb7203f4e1e9cd16d6074e5d87c1aa31e64fda6a479f074c9d5fcc868f8cd4',
         '4a611ac8e72092674eb453e40f6d9c01c3c51ff088704aac7d7af4815189dbdc'),
}
PRESERVED = ('packages/agent-provisioning/src/index.js',
             'packages/production-runtime/src/model-overrides.js',
             'packages/production-runtime/src/compose.js')
VALIDATOR = 'packages/agent-router/src/reconciliation/quiescence-bundle.js'
HELPER = 'packages/production-runtime/src/native-arm64/hr-s256-r2-child-proof.py'


class OfflineStageRejected(Exception):
    pass


def _require(condition, code):
    if not condition:
        raise OfflineStageRejected(code)


def _sha(raw):
    return hashlib.sha256(raw).hexdigest()


def _json_bytes(value):
    return (json.dumps(value, sort_keys=True, separators=(',', ':')) + '\n').encode()


def assemble(output, *, repo=Path(__file__).resolve().parents[2]):
    """Produce only a fixed offline stage; output must be a new directory."""
    output = Path(output)
    _require(not output.exists(), 'ADMIN_OFFLINE_OUTPUT_EXISTS')
    _require(_tree_sha256(RESTORED) == RESTORED_SHA, 'ADMIN_RESTORED_CHANGED')
    _require(_tree_sha256(SELECTIVE) == SELECTIVE_SHA, 'ADMIN_SELECTIVE_CHANGED')
    stage = json.loads(_read(ADMIN_STAGE, 'STAGE.json', 65536))
    _require(stage['base']['sha256'] == SELECTIVE_SHA
             and stage['stage']['sha256'] == ADMIN_STAGE_SHA
             and len(stage['fixedPaths']) == 13, 'ADMIN_STAGE_MAP_CHANGED')
    _require(_tree_sha256(ADMIN_STAGE / 'tree') == ADMIN_STAGE_SHA,
             'ADMIN_STAGE_CHANGED')
    for name in PRESERVED:
        _require(_read(RESTORED, name, 1 << 20) == _read(SELECTIVE, name, 1 << 20)
                 == _read(ADMIN_STAGE / 'tree', name, 1 << 20),
                 'ADMIN_ORDINARY_AGENT_CHANGED')
    for name, pin in stage['fixedPaths'].items():
        _require(_sha(_read(ADMIN_STAGE / 'tree', name, 1 << 20)) == pin['stageSha256'],
                 'ADMIN_STAGE_PATH_CHANGED')
    old_files = {p.relative_to(SELECTIVE).as_posix() for p in SELECTIVE.rglob('*') if p.is_file()}
    staged_files = {p.relative_to(ADMIN_STAGE / 'tree').as_posix()
                    for p in (ADMIN_STAGE / 'tree').rglob('*') if p.is_file()}
    changed = {name for name in old_files | staged_files
               if (name not in old_files or name not in staged_files
                   or _sha(_read(SELECTIVE, name, 1 << 20))
                   != _sha(_read(ADMIN_STAGE / 'tree', name, 1 << 20)))}
    _require(changed == set(stage['fixedPaths']), 'ADMIN_STAGE_MAP_CHANGED')
    for name, (before, after) in HOST_JOIN.items():
        _require(_sha(_read(ADMIN_STAGE / 'tree', name, 1 << 20)) == before,
                 'ADMIN_HOST_PREIMAGE_CHANGED')
        _require(_sha(_read(repo, name, 1 << 20)) == after,
                 'ADMIN_HOST_POSTIMAGE_CHANGED')
    source_bytes = {}
    for field, expected in SOURCE_SHA256.items():
        source = {'helperSha256': repo / HELPER}.get(field)
        if source is None:
            source = PACKAGE_ROOT.parent / FILES[field]
        source_bytes[field] = _read(source.parent, source.name, 65536)
        _require(_sha(source_bytes[field]) == expected, 'ADMIN_PRODUCER_SOURCE_CHANGED')

    output.mkdir()
    tree = output / 'tree'
    shutil.copytree(ADMIN_STAGE / 'tree', tree, symlinks=True)
    for name in HOST_JOIN:
        (tree / name).write_bytes(_read(repo, name, 1 << 20))
    for name in PRESERVED:
        _require(_read(tree, name, 1 << 20) == _read(RESTORED, name, 1 << 20),
                 'ADMIN_ORDINARY_AGENT_CHANGED')
    final_sha = _tree_sha256(tree)
    package_inputs = output / 'package-inputs'
    package_inputs.mkdir()
    for field, raw in source_bytes.items():
        (package_inputs / FILES[field]).write_bytes(raw)
    validator_sha = _sha(_read(tree, VALIDATOR, 65536))
    entry_manifest = {
        'entrySha256': SOURCE_SHA256['entrySha256'],
        'consumingBinarySha256': final_sha,
        'validatorSha256': validator_sha,
        'helperSha256': SOURCE_SHA256['helperSha256'],
        'procedureSha256': SOURCE_SHA256['adminProcedureSha256'],
    }
    entry_raw = _json_bytes(entry_manifest)
    (package_inputs / 'entry-manifest.json').write_bytes(entry_raw)
    known = {
        'qualificationOperationId': QUALIFICATION_ID,
        'cutOperationId': CUT_OPERATION_ID,
        'hostId': HOST_ID,
        'operationCandidate': {
            'fixedInstallAction': 'INSTALL_DEPLOYMENT_SYSTEM',
            'fixedCutRequest': {'action': 'HR_S256_ADMIN_EMERGENCY_CUT_V1',
                                'operation_id': CUT_OPERATION_ID},
            'qualificationInvocation': 'private-root-carrier-zero-argument',
            'installAndQualificationEnabled': False,
        },
        'sourceRestoredTreeSha256': RESTORED_SHA,
        'sourceSelectiveTreeSha256': SELECTIVE_SHA,
        'sourceAdminStageTreeSha256': ADMIN_STAGE_SHA,
        'finalTreeSha256': final_sha,
        'validatorSha256': validator_sha,
        'helperSha256': _sha(_read(tree, HELPER, 65536)),
        'entryManifestSha256': _sha(entry_raw),
        'hostJoin': {name: {'before': before, 'after': after}
                     for name, (before, after) in HOST_JOIN.items()},
        'preservedOrdinaryPaths': {name: _sha(_read(tree, name, 1 << 20))
                                   for name in PRESERVED},
        'sourcePinned': SOURCE_SHA256,
        'activationSourcePins': {name: _sha(_read(PACKAGE_ROOT.parent, name, 65536))
                                 for name in ('admin_package.py',
                                              'build_admin_private_ds_candidate.py',
                                              'admin_ds_private_bootstrap.py',
                                              'build_admin_fixed_large_shim.py',
                                              'admin_fixed_shim_publisher.py',
                                              'admin_host_identity.py')},
        'executable': False,
        'unbound': ['currentLivePreimageTreeSha256', 'compatibleRollbackOperationId',
                    'currentInstalledDaemonSha256', 'currentInstalledClientSha256',
                    'currentInstalledPlistSha256', 'currentInstalledConfigSha256',
                    'reviewedDaemonCandidateSha256', 'reviewedNodeRuntimeSha256',
                    'reviewedPythonRuntimeSha256', 'reviewedPackageSha256',
                    'reviewedShimCandidateSha256', 'oneUseInstallOperationId',
                    'rootOwnedPackageReceipt', 'shimInstallReceipt',
                    'hostQualificationReceipts', 'productionAuthority'],
    }
    (output / 'CANDIDATE.json').write_bytes(_json_bytes(known))
    return known
