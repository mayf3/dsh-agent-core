"""Disposable admin journal bridge; qualification receipts are never inputs.

The two deployment proof files must already exist from the original executor's
separate sealed procedure. Only cut-side synthetic receipts are copied here.
"""
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
from unittest.mock import patch

from build_admin_candidate import build_admin_current_bytes


def fixture(inputs):
    state_root = Path(inputs['stateRoot'])
    if state_root.is_symlink() or not state_root.is_dir() or not str(state_root).startswith(tempfile.gettempdir()):
        raise ValueError('DISPOSABLE_STATE_ROOT_REQUIRED')
    compiled = state_root / 'compiled-admin-ds.py'
    compiled.write_bytes(build_admin_current_bytes())
    env = {'DS_TEST_MODE': '1', 'DS_STATE_ROOT': str(state_root),
           'DS_INSTALL_DIR': str(state_root / 'install'),
           'DS_GEN_ROOT': str(state_root / 'generations')}
    with patch.dict(os.environ, env), patch.object(subprocess, 'Popen',
            side_effect=AssertionError('HOST_PROCESS_DENIED')):
        spec = importlib.util.spec_from_file_location('synthetic_admin_ds', compiled)
        ds = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(ds)
        journal = ds.HR_ADMIN_JOURNAL
        auth, bundle = inputs['authorization'], inputs['bundle']
        journal.seal_intent(auth['startupNonce'], auth['subjectPreimageSha256'],
                            bundle['recoveryCutover']['windowOpenedAtWallMs'] - 1)
        digest = journal.seal_launch_authorization(auth)
        bundle['recoveryCutover']['launchAuthorizationReceiptSha256'] = digest
        directory = state_root / journal.OPERATION_ID
        source = state_root.parent / 'source-receipts'
        for name in ('exclusive-window.json', 'launch-sources-inhibited.json',
                     'old-tree-quiesced.json', 'census-ps.txt', 'census-lsof.txt',
                     'census-archive.json'):
            path = source / name
            if path.is_symlink() or not path.is_file():
                raise ValueError('SYNTHETIC_CUT_RECEIPT_MISSING')
            shutil.copyfile(path, directory / name)
            os.chmod(directory / name, 0o600)
        sealed = auth['authorizedStartupAtWallMs'] + 1
        journal.seal_bundle_commitment(journal.canonical(bundle), sealed)
        journal.claim_one_launch(sealed + 1)
        print(json.dumps({'evidenceDir': str(directory), 'bundle': bundle}))


if __name__ == '__main__':
    sys.dont_write_bytecode = True
    fixture(json.loads(sys.stdin.read()))
