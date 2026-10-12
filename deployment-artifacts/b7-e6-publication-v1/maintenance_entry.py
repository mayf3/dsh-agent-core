"""Offline constituted DS-unit maintenance entry; NOT an authorization grant.

After separately accepted Owner maintenance, verified original writer handoff and
DS unit bootout, the Owner stages the frozen SOURCE pair at the fixed Root path.
This entry executes that candidate's original guard/DS_UPDATE mechanics without
starting its daemon. No normal RPC bypass, direct B7 outer execution, stop/start,
lock disposal, retained-object cleanup, or fabricated Owner transport occurs.
Restart and loaded-identity/health proof remain the original maintenance steps.
"""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import stat
import subprocess
import sys

STAGED = Path('/private/var/db/agent-deploy-system-config/e6-publication')
STATE = Path('/private/var/db/agent-deploy-system')
UNIT = 'system/ai.agent-deploy-system'
PAIR = {'deployment_system.py', 'ds_client.py'}


def need(ok, reason):
    if not ok:
        raise RuntimeError('E6_MAINTENANCE_' + reason)


def root_read(path, mode, limit):
    """Fixed bootstrap reads before the frozen DS observer can be imported."""
    path = Path(path)
    need(path in {STAGED / n for n in PAIR} | {
        STATE / 'e6-publication-authority.json', STATE / 'e6-publication-pin.json'}, 'FIXED_PATH')
    fd = os.open('/', os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    chain = []
    try:
        for index, name in enumerate(path.parts[1:]):
            leaf = index == len(path.parts) - 2
            before = os.stat(name, dir_fd=fd, follow_symlinks=False)
            part = Path('/').joinpath(*path.parts[1:index + 2])
            need(before.st_uid == 0, 'ROOT_CUSTODY')
            if leaf:
                need(stat.S_ISREG(before.st_mode) and before.st_nlink == 1
                     and stat.S_IMODE(before.st_mode) == mode and before.st_size <= limit, 'LEAF_CUSTODY')
            else:
                need(stat.S_ISDIR(before.st_mode) and (not before.st_mode & 0o022 or
                     part == STATE and before.st_gid == 80 and stat.S_IMODE(before.st_mode) == 0o770), 'ANCESTOR_CUSTODY')
            child = os.open(name, os.O_RDONLY | os.O_NOFOLLOW | (0 if leaf else os.O_DIRECTORY), dir_fd=fd)
            def identity(meta):
                return (meta.st_dev, meta.st_ino, meta.st_uid, meta.st_gid, meta.st_mode,
                        meta.st_nlink, meta.st_size, meta.st_mtime_ns, meta.st_ctime_ns)
            try:
                need(identity(os.fstat(child)) == identity(before), 'READ_RACE')
            except BaseException:
                os.close(child)
                raise
            chain.append((fd, name, before))
            fd = child
        chunks, size = [], 0
        while True:
            chunk = os.read(fd, 65536)
            if not chunk:
                break
            chunks.append(chunk)
            size += len(chunk)
            need(size <= limit, 'READ_LIMIT')
        need(identity(os.fstat(fd)) == identity(chain[-1][2]), 'READ_RACE')
        for parent, name, before in chain:
            need(identity(os.stat(name, dir_fd=parent, follow_symlinks=False)) == identity(before), 'READ_RACE')
        return b''.join(chunks)
    finally:
        os.close(fd)
        for parent, _, _ in chain:
            os.close(parent)


def publish(host, authorization, staged):
    """Testable finite body. P0 refuses without ANY writes; staging is P1."""
    artifacts = authorization.get('artifacts')
    need(type(staged) is dict and set(staged) == PAIR and type(artifacts) is dict and set(artifacts) == PAIR,
         'PAIR_SHAPE')
    need(all(hashlib.sha256(staged[name]).hexdigest() == artifacts[name] for name in PAIR), 'STAGED_PAIR_CHANGED')
    request = dict(action='DS_UPDATE', operation_id=authorization.get('publication_operation_id'), artifacts=artifacts)
    need(host.p0_reader_pair_update_shape(request), 'ORIGINAL_FIXED_REQUEST')
    inbox = Path(host.STATE_ROOT) / 'inbox' / request['operation_id']
    need(not os.path.lexists(inbox), 'PRIOR_STAGING_UNKNOWN_NO_REPLAY')
    with host.p0_reader_pair_guard(request) as recheck:
        # Only after P0 exact qualification, under the same original DS lease.
        # Any partial staging is retained, never removed/retried by this entry.
        recheck()
        os.makedirs(inbox, mode=0o700)
        for name in sorted(PAIR):
            host.atomic_write(str(inbox / name), staged[name], 0o400, recheck=recheck)
        return host.ds_update(request, recheck=recheck)


def main():
    need(len(sys.argv) == 1 and os.geteuid() == 0, 'ROOT_FIXED_ENTRY_REQUIRED')
    need(os.isatty(3), 'GENUINE_OWNER_FD3_REQUIRED')  # never creates/proxies a TTY
    need(not any(k.startswith('DS_') for k in os.environ), 'OVERRIDE_ENVIRONMENT_FORBIDDEN')
    check = subprocess.run(['/bin/launchctl', 'print', UNIT], capture_output=True, timeout=10)
    need(check.returncode == 113 and b'Could not find service' in check.stderr
         and len(check.stderr) <= 4096, 'ORIGINAL_DS_UNIT_NOT_CONFIRMED_STOPPED')
    # This observation does not claim release of GUI/authsvc/native FD9 writers.
    # Their original controller handoff is a mandatory external admission fact.
    pin = json.loads(root_read(STATE / 'e6-publication-pin.json', 0o400, 4096))
    raw = root_read(STATE / 'e6-publication-authority.json', 0o400, 16384)
    need(type(pin) is dict and set(pin) == {'kind', 'authorization_sha256'}
         and pin['kind'] == 'DS_B7_E6_PUBLICATION_PIN_V1'
         and pin['authorization_sha256'] == hashlib.sha256(raw).hexdigest(), 'INDEPENDENT_AUTHORITY_PIN')
    authorization = json.loads(raw)
    staged = {name: root_read(STAGED / name, 0o555, 512 * 1024 * 1024) for name in PAIR}
    need(type(authorization) is dict and type(authorization.get('artifacts')) is dict
         and set(authorization['artifacts']) == PAIR
         and all(hashlib.sha256(staged[n]).hexdigest() == authorization['artifacts'][n] for n in PAIR),
         'CANDIDATE_NOT_FROZEN')
    source = STAGED / 'deployment_system.py'
    name = '_ds_e6_constituted_maintenance'
    spec = importlib.util.spec_from_file_location(name, str(source))
    host = importlib.util.module_from_spec(spec)
    sys.modules[name] = host
    # Execute only the verified bytes, never reopen a potentially changed path.
    exec(compile(staged['deployment_system.py'], str(source), 'exec'), host.__dict__)
    need(host.P0_LOADED_SERVICE_SHA == authorization['artifacts']['deployment_system.py'], 'STAGED_SOURCE_CHANGED_DURING_LOAD')
    result = publish(host, authorization, staged)
    print(json.dumps({'phase': 'P1', 'publication': result,
        'loaded': 'NOT_VERIFIED', 'restart': 'REQUIRED_BY_ORIGINAL_MAINTENANCE',
        'b7GoalComplete': False}, sort_keys=True))


if __name__ == '__main__':
    main()
