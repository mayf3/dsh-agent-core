"""Disposable original-procedure seal for cross-language integration tests.

The caller supplies observations read from actual AgentProcess/durable-store
test modules, never receipt bytes or a PROVEN status. This is not a root entry.
"""

import json
import hashlib
import os
from pathlib import Path
import subprocess
import sys
import tempfile
from unittest.mock import patch

import driver


def seal(inputs):
    root = Path(inputs['disposableRoot'])
    if root.is_symlink() or not root.is_dir() or not str(root).startswith(tempfile.gettempdir()):
        raise ValueError('DISPOSABLE_ROOT_REQUIRED')
    proof = root / 'deployment'
    proof.mkdir(mode=0o700, exist_ok=False)
    observations = inputs['observations']
    runtimes = inputs['runtimes']
    if type(observations) is not list or len(observations) != 3 or type(runtimes) is not list or len(runtimes) != 3:
        raise ValueError('THREE_ACTUAL_OBSERVATIONS_REQUIRED')
    source = Path(__file__).with_name('procedure.py').read_bytes()
    admin = Path(__file__).with_name('admin_procedure.py').read_bytes()
    def disposable_readback(fd, digest):
        # Synthetic custody boundary only: real bytes and hash are checked,
        # while a nonroot disposable directory cannot assert root UID 0.
        size = os.fstat(fd).st_size
        raw = os.pread(fd, size + 1, 0)
        driver.require(len(raw) == size and hashlib.sha256(raw).hexdigest() == digest,
                       'DISPOSABLE_READBACK_CHANGED')
        return raw
    scope = {'__name__': '_disposable_original_procedure',
             'FixedOriginalDriver': driver.FixedOriginalDriver,
             'require': driver.require, 'Unknown': driver.Unknown,
             '_namespace_directory': lambda path: os.open(proof, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW),
             '_descriptor_bytes': disposable_readback}
    with patch.object(subprocess, 'Popen', side_effect=AssertionError('HOST_PROCESS_DENIED')):
        exec(compile(source, 'original-procedure.py', 'exec'), scope)
        exec(compile(admin, 'original-admin-procedure.py', 'exec'), scope)
        owner = object.__new__(driver.FixedOriginalDriver)
        owner._unknown = False
        owner._binding = driver._EntryBinding('a'*64, 'b'*64, inputs['binarySha256'], 'd'*64, 'e'*64)
        owner._validator_installed_wall_ms = min(value['completedAtWallMs'] for value in observations) - 1
        owner._owned_children = []
        owner._continuity = lambda: driver.require(not owner._unknown, 'ORIGINAL_CUSTODY_UNKNOWN')
        owner._health_original = lambda: None
        owner._phase_started_wall_ms = owner._validator_installed_wall_ms

        class Child:
            exited = False
            def poll(self): return 0 if self.exited else None

        def launch(phase):
            owner._child = Child()
            owner._owned_children.append(owner._child)

        def stop():
            driver.require(owner._child is not None and owner._child.poll() is None,
                           'ORIGINAL_CHILD_EXIT_UNKNOWN')
            if inputs.get('fault') == 'final_child_still_live' and len(owner._procedure_turns) == 3:
                raise driver.Unknown('ORIGINAL_STOP_TIMEOUT')
            owner._child.exited = True

        def readback():
            index = len(owner._procedure_turns)
            driver.require(owner._child.poll() is None, 'ORIGINAL_CHILD_EXIT_UNKNOWN')
            return observations[index], runtimes[index]

        owner._deploy_original = lambda: launch('deployment_start')
        owner._launch_phase = launch
        owner._stop_owned_child = stop
        owner._admin_canary_and_store_readback = readback
        scope['_checked_installation'] = lambda owned: None
        floor, validator = scope['_run_admin_owned'](owner)
        if any(child.poll() is None for child in owner._owned_children):
            raise AssertionError('OWNED_CHILD_REMAINED_LIVE')
    print(json.dumps({'floorSha256': driver.hashlib.sha256((proof / 'floor-proven.json').read_bytes()).hexdigest(),
                      'validatorSha256': driver.hashlib.sha256((proof / 'validator-installed.json').read_bytes()).hexdigest(),
                      'floor': floor, 'validator': validator}))


if __name__ == '__main__':
    sys.dont_write_bytecode = True
    seal(json.loads(sys.stdin.read()))
