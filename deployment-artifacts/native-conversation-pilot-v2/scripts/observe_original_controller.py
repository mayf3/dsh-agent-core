#!/usr/bin/env python3
"""Fixed, read-only DS observations. This script has no mutation action."""
import argparse
import datetime
import json
import os
from pathlib import Path
import socket

SOCKET = '/private/var/run/agent-deploy-system.sock'
REQUESTS = (
    ('inspect', {'action': 'DS_INSPECT_V1'}),
    ('unit', {'action': 'DS_UNIT_STATUS_V1', 'unit': 'scheduler-whole-main'}),
    ('runtime-inputs', {'action': 'DS_RUNTIME_INPUTS_READONLY_V1'}),
    ('b7-e6', {'action': 'DS_B7_EXECUTION_STATUS_V2', 'operation_id': 'b7-packet-r27-65e5606cf5c352f2e-e6'}),
    ('b7-e23', {'action': 'DS_B7_EXECUTION_STATUS_V2', 'operation_id': 'b7-packet-r27-67fe19ef96ebaa510-e23'}),
    ('b7-e29', {'action': 'DS_B7_EXECUTION_STATUS_V2', 'operation_id': 'b7-packet-r27-83054332f5c352f2e-e29'}),
    ('b7-e29-lifecycle', {'action': 'DS_B7_LIFECYCLE_STATUS_V1', 'operation_id': 'b7-packet-r27-83054332f5c352f2e-e29'}),
)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True, help='New, private evidence directory; must not exist')
    args = parser.parse_args()
    dest = args.output.expanduser().resolve(strict=False)
    forbidden = ('/usr/local/libexec', '/private/var/db', '/Library', '/Users/authsvc', '/Users/yanfenma/.agent-core')
    if any(str(dest) == p or str(dest).startswith(p + '/') for p in forbidden):
        raise SystemExit('Refusing a production output path')
    os.umask(0o077)
    dest.mkdir(mode=0o700, parents=True, exist_ok=False)
    for name, request in REQUESTS:
        with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as channel:
            channel.settimeout(8)
            channel.connect(SOCKET)
            channel.sendall(json.dumps(request, separators=(',', ':')).encode() + b'\n')
            raw = bytearray()
            while len(raw) < 1024 * 1024:
                block = channel.recv(min(65536, 1024 * 1024 - len(raw)))
                if not block:
                    break
                raw.extend(block)
                if b'\n' in block:
                    break
            if len(raw) >= 1024 * 1024:
                raise RuntimeError('READ_RESPONSE_LIMIT; no retry or mutation')
            response = json.loads(bytes(raw))
            (dest / (name + '.json')).write_text(json.dumps(response, ensure_ascii=False, indent=2) + '\n')
    (dest / 'captured-at.txt').write_text(datetime.datetime.now(datetime.timezone.utc).isoformat() + '\n')
    print(str(dest))

if __name__ == '__main__':
    main()
