#!/usr/bin/python3
"""Non-root, exact four-artifact shim client; no install or retry on import."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import socket
import stat
import sys
import time


NAMES = ('deployment_system.py', 'ds_client.py',
         'deployment-registry.json', 'plist')
DS_LIMIT = 128 * 1024 * 1024
OTHER_LIMIT = 16 * 1024 * 1024
OP_ID = re.compile(r'[A-Za-z0-9][A-Za-z0-9._-]{0,127}\Z')
HASH = re.compile(r'[a-f0-9]{64}\Z')
SOCKET = '/private/var/run/agent-deploy-shim.sock'
INBOX = Path('/private/var/db/agent-deploy-shim/inbox')


def _validate_operation(operation_id):
    if type(operation_id) is not str or OP_ID.fullmatch(operation_id) is None:
        raise ValueError('BAD_OPERATION_ID')
    return operation_id


def validate_packet(packet):
    keys = {'action', 'operation_id', 'artifacts',
            'expected_preimage_sha256', 'ds_script_preimage_size',
            'ds_script_candidate_size'}
    if type(packet) is not dict or set(packet) != keys \
            or packet.get('action') != 'INSTALL_DEPLOYMENT_SYSTEM':
        raise ValueError('PACKET_FIELDS')
    _validate_operation(packet['operation_id'])
    for field in ('artifacts', 'expected_preimage_sha256'):
        hashes = packet[field]
        if type(hashes) is not dict or set(hashes) != set(NAMES) \
                or any(type(value) is not str or HASH.fullmatch(value) is None
                       for value in hashes.values()):
            raise ValueError('FOUR_PIECE_HASHES')
    for field in ('ds_script_preimage_size', 'ds_script_candidate_size'):
        size = packet[field]
        if type(size) is not int or not 0 < size <= DS_LIMIT:
            raise ValueError('DS_SCRIPT_SIZE')
    return packet


def _copy_staged(source, destination, digest, limit, exact_size):
    src = os.open(source, os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC)
    temp = str(destination) + '.staging-%d-%d' % (os.getpid(), time.time_ns())
    dst = None
    replaced = False
    try:
        before = os.fstat(src)
        if not stat.S_ISREG(before.st_mode) or before.st_nlink != 1 \
                or not 0 < before.st_size <= limit \
                or (exact_size is not None and before.st_size != exact_size):
            raise ValueError('STAGED_SOURCE_CUSTODY_OR_SIZE')
        dst = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_EXCL |
                      os.O_NOFOLLOW | os.O_CLOEXEC, 0o600)
        h = hashlib.sha256()
        copied = 0
        while True:
            block = os.read(src, 65536)
            if not block:
                break
            copied += len(block)
            if copied > limit:
                raise ValueError('STAGED_SOURCE_TOO_LARGE')
            h.update(block)
            view = memoryview(block)
            while view:
                count = os.write(dst, view)
                if count <= 0:
                    raise ValueError('STAGING_SHORT_WRITE')
                view = view[count:]
        after = os.fstat(src)
        if copied != before.st_size or h.hexdigest() != digest \
                or (before.st_dev, before.st_ino, before.st_size,
                    before.st_mtime_ns, before.st_ctime_ns) != \
                   (after.st_dev, after.st_ino, after.st_size,
                    after.st_mtime_ns, after.st_ctime_ns):
            raise ValueError('REVIEWED_ARTIFACT_DRIFT')
        os.fsync(dst)
        os.close(dst)
        dst = None
        os.replace(temp, destination)
        replaced = True
        fd = os.open(destination.parent, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(fd)
        finally:
            os.close(fd)
    finally:
        os.close(src)
        if dst is not None:
            os.close(dst)
        if not replaced:
            try:
                os.unlink(temp)
            except FileNotFoundError:
                pass


def stage_packet(packet, artdir, inbox_root=INBOX):
    validate_packet(packet)
    artdir = Path(artdir)
    inbox_root = Path(inbox_root)
    if artdir.is_symlink() or not artdir.is_dir() \
            or {path.name for path in artdir.iterdir()} != set(NAMES):
        raise ValueError('ARTIFACT_DIRECTORY_EXACT_FOUR')
    operation_dir = inbox_root / packet['operation_id']
    operation_dir.mkdir(mode=0o700, parents=False, exist_ok=False)
    for name in NAMES:
        limit = DS_LIMIT if name == 'deployment_system.py' else OTHER_LIMIT
        size = packet['ds_script_candidate_size'] if name == 'deployment_system.py' else None
        _copy_staged(artdir / name, operation_dir / name,
                     packet['artifacts'][name], limit, size)
    return packet


def status_packet(operation_id):
    return {'action': 'INSTALL_DEPLOYMENT_SYSTEM_STATUS',
            'operation_id': _validate_operation(operation_id)}


def request(packet):
    with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as conn:
        conn.settimeout(180)
        conn.connect(SOCKET)
        conn.sendall(json.dumps(packet, sort_keys=True).encode() + b'\n')
        raw = b''
        while b'\n' not in raw:
            block = conn.recv(4096)
            if not block or len(raw) + len(block) > 65536:
                raise OSError('RESPONSE_UNKNOWN')
            raw += block
        result = json.loads(raw.split(b'\n', 1)[0])
        if type(result) is not dict:
            raise OSError('RESPONSE_SCHEMA')
        return result


def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest='mode', required=True)
    install = sub.add_parser('install')
    install.add_argument('--manifest', required=True)
    install.add_argument('--artdir', required=True)
    status = sub.add_parser('status')
    status.add_argument('--operation', required=True)
    args = parser.parse_args()
    try:
        if args.mode == 'install':
            packet = validate_packet(json.loads(Path(args.manifest).read_text()))
            stage_packet(packet, args.artdir)
        else:
            packet = status_packet(args.operation)
        result = request(packet)
    except (OSError, ValueError) as exc:
        operation = packet['operation_id'] if 'packet' in locals() else None
        print(json.dumps({'ok': False, 'state': 'UNKNOWN',
                          'operation_id': operation, 'reason': type(exc).__name__,
                          'nextReadOnlyAction': 'INSTALL_DEPLOYMENT_SYSTEM_STATUS',
                          'replayAllowed': False}, sort_keys=True))
        return 2
    print(json.dumps(result, sort_keys=True))
    return 0 if result.get('ok') and result.get('state') in ('COMMITTED', 'FAILED') else 1


if __name__ == '__main__':
    sys.exit(main())
