#!/usr/bin/env python3
"""Fixed s256 successor startup proof; no Router code runs before this returns.

The production CLI requires a root-created peer and root-owned private window.
The trusted_uid argument exists for isolated, non-root protocol fixtures only;
the CLI never accepts an override.
"""

import array
import fcntl
import hashlib
import json
import os
import socket
import stat
import struct
import sys
import time


DEADLINE_SECONDS = 0.75
MAX_FRAME = 512


class Rejected(Exception):
    pass


def require(ok, reason):
    if not ok:
        raise Rejected(reason)


def peer_uid(channel):
    if sys.platform == "darwin" and hasattr(socket, "LOCAL_PEERCRED"):
        # Darwin xucred: version, uid, ngroups, groups[]. SOL_LOCAL == 0.
        raw = channel.getsockopt(0, socket.LOCAL_PEERCRED, 76)
        require(len(raw) >= 12, "ROOT_PEER_UNKNOWN")
        return struct.unpack_from("=I", raw, 4)[0]
    if hasattr(socket, "SO_PEERCRED"):
        raw = channel.getsockopt(socket.SOL_SOCKET, socket.SO_PEERCRED, 12)
        require(len(raw) == 12, "ROOT_PEER_UNKNOWN")
        return struct.unpack("=iii", raw)[1]
    raise Rejected("ROOT_PEER_UNKNOWN")


def approval_digest(nonce, challenge, receipt_sha256, identity):
    raw = json.dumps(["ROOT_APPROVED", nonce, challenge, receipt_sha256, identity],
                     separators=(",", ":")).encode()
    return hashlib.sha256(raw).hexdigest().encode()


def response_digest(nonce, challenge, receipt_sha256, identity):
    raw = json.dumps([nonce, challenge, receipt_sha256, identity],
                     separators=(",", ":")).encode()
    return hashlib.sha256(raw).hexdigest().encode()


def prove(challenge_fd, window_fd, receipt_sha256, *, trusted_uid=0):
    require(isinstance(receipt_sha256, str) and len(receipt_sha256) == 64
            and all(c in "0123456789abcdef" for c in receipt_sha256),
            "RECEIPT_SHA_INVALID")
    require(isinstance(challenge_fd, int) and challenge_fd >= 3
            and isinstance(window_fd, int) and window_fd >= 3
            and challenge_fd != window_fd, "DESCRIPTOR_INVALID")
    deadline = time.monotonic() + DEADLINE_SECONDS
    channel = None
    try:
        channel = socket.socket(fileno=challenge_fd)
        require(peer_uid(channel) == trusted_uid, "ROOT_PEER_MISMATCH")
        meta = os.fstat(window_fd)
        require(stat.S_ISREG(meta.st_mode) and meta.st_uid == trusted_uid
                and stat.S_IMODE(meta.st_mode) == 0o600 and meta.st_nlink == 1,
                "ROOT_WINDOW_MISMATCH")
        identity = [meta.st_dev, meta.st_ino]
        raw = bytearray()
        while not raw.endswith(b"\n"):
            remaining = deadline - time.monotonic()
            require(remaining > 0, "CHALLENGE_DEADLINE")
            channel.settimeout(remaining)
            block = channel.recv(1)
            require(bool(block) and len(raw) < MAX_FRAME, "CHALLENGE_FRAME_INVALID")
            raw.extend(block)
        frame = json.loads(raw)
        require(type(frame) is dict and frame.get("receiptSha256") == receipt_sha256
                and frame.get("windowIdentity") == identity
                and isinstance(frame.get("nonce"), str)
                and isinstance(frame.get("challenge"), str), "CHALLENGE_BINDING_INVALID")
        answer = response_digest(frame["nonce"], frame["challenge"],
                                 receipt_sha256, identity)
        remaining = deadline - time.monotonic()
        require(remaining > 0, "CHALLENGE_DEADLINE")
        channel.settimeout(remaining)
        sent = channel.sendmsg([answer], [(socket.SOL_SOCKET, socket.SCM_RIGHTS,
                array.array("i", [window_fd]))])
        require(sent == len(answer), "CHALLENGE_RESPONSE_INCOMPLETE")
        approval = bytearray()
        while len(approval) < 64:
            remaining = deadline - time.monotonic()
            require(remaining > 0, "CHALLENGE_DEADLINE")
            channel.settimeout(remaining)
            block = channel.recv(64 - len(approval))
            require(bool(block), "CHALLENGE_APPROVAL_MISSING")
            approval.extend(block)
        require(bytes(approval) == approval_digest(frame["nonce"], frame["challenge"],
                receipt_sha256, identity), "CHALLENGE_APPROVAL_INVALID")
        return frame
    except (OSError, ValueError, TimeoutError) as exc:
        raise Rejected("CHALLENGE_UNAVAILABLE") from exc
    finally:
        if channel is not None:
            channel.close()


def authorization_projection(fd, digest, approved_frame, *, trusted_uid=0):
    """Read an inherited immutable receipt capability after root FD approval.

    No path/host/nonce/PASS input can authorize this. The CLI fixes trusted_uid
    to0; the override is only for disposable non-root descriptor fixtures.
    """
    def unique(pairs):
        value = {}
        for key, item in pairs:
            require(key not in value, 'AUTHORIZATION_DUPLICATE_FIELD')
            value[key] = item
        return value
    try:
        before = os.fstat(fd)
        require(stat.S_ISREG(before.st_mode) and before.st_uid == trusted_uid
                and stat.S_IMODE(before.st_mode) == 0o600 and before.st_nlink == 1
                and 0 < before.st_size <= 65536
                and fcntl.fcntl(fd, fcntl.F_GETFL) & os.O_ACCMODE == os.O_RDONLY,
                'AUTHORIZATION_FD_CUSTODY')
        raw = os.pread(fd, 65537, 0)
        after = os.fstat(fd)
        identity = lambda m: (m.st_dev, m.st_ino, m.st_size, m.st_mtime_ns, m.st_ctime_ns)
        require(identity(before) == identity(after) and len(raw) == before.st_size
                and hashlib.sha256(raw).hexdigest() == digest, 'AUTHORIZATION_FD_CHANGED')
        value = json.loads(raw, object_pairs_hook=unique)
        canonical = json.dumps(value, sort_keys=True, separators=(',', ':')).encode()
        require(raw == canonical and type(value) is dict and set(value) == {
            'version', 'operationId', 'phase', 'intentSha256', 'authorization'}
            and value['version'] == 1 and value['phase'] == 'LAUNCH_AUTHORIZED'
            and value['operationId'] == 'hr-s256-trusted-quiescence-cut-20260925-v1',
            'AUTHORIZATION_RECEIPT_INVALID')
        auth = value['authorization']
        require(type(auth) is dict and set(auth) == {'operationId', 'hostId', 'startupNonce',
            'subject', 'subjectPreimageSha256', 'consumingBinarySha256', 'archiveSha256',
            'outputsSha256', 'holderCheck', 'authorizedStartupAtWallMs'}
            and auth['operationId'] == value['operationId']
            and type(approved_frame) is dict and auth['startupNonce'] == approved_frame.get('nonce')
            and type(auth['hostId']) is str and 1 <= len(auth['hostId']) <= 128
            and type(auth['consumingBinarySha256']) is str and len(auth['consumingBinarySha256']) == 64
            and all(c in '0123456789abcdef' for c in auth['consumingBinarySha256']),
            'AUTHORIZATION_BINDING_INVALID')
        subject = auth['subject']
        handle = 'turn:961534a5-8c94-487d-8e55-d324a54e821a:a2:g1:s256'
        require(type(subject) is dict and set(subject) == {'reconciliationHandle',
            'turnExecutionId', 'runtimeEpoch', 'agentId', 'processGeneration'}
            and subject['reconciliationHandle'] == subject['turnExecutionId'] == handle
            and subject['agentId'] == 'agt_hr-agent'
            and type(subject['processGeneration']) is int and subject['processGeneration'] == 1
            and type(subject['runtimeEpoch']) is str and 0 < len(subject['runtimeEpoch']) <= 128,
            'AUTHORIZATION_SUBJECT_INVALID')
        return {'hostId': auth['hostId'], 'startupNonce': auth['startupNonce'],
                'consumingBinarySha256': auth['consumingBinarySha256'],
                'recoveryPlanStopsRuntime': True}  # Fixed R2 plan, not a caller choice.
    except (OSError, ValueError, TypeError, KeyError) as exc:
        raise Rejected('AUTHORIZATION_UNAVAILABLE') from exc


if __name__ == "__main__":
    try:
        require((len(sys.argv) == 5 and sys.argv[1] == "--child-prove") or
                (len(sys.argv) == 6 and sys.argv[1] == "--startup-prove"), "INVOCATION_INVALID")
        approved = prove(int(sys.argv[2]), int(sys.argv[3]), sys.argv[4])
        if sys.argv[1] == "--startup-prove":
            print(json.dumps(authorization_projection(int(sys.argv[5]), sys.argv[4], approved),
                             separators=(',', ':')))
    except (Rejected, ValueError) as exc:
        print(f"[hr-s256-r2-child-proof] {exc}", file=sys.stderr)
        raise SystemExit(2) from None
