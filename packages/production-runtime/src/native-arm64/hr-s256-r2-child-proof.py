#!/usr/bin/env python3
"""Fixed s256 successor startup proof; no Router code runs before this returns.

The production CLI requires a root-created peer and root-owned private window.
The trusted_uid argument exists for isolated, non-root protocol fixtures only;
the CLI never accepts an override.
"""

import array
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
    except (OSError, ValueError, TimeoutError) as exc:
        raise Rejected("CHALLENGE_UNAVAILABLE") from exc


if __name__ == "__main__":
    try:
        require(len(sys.argv) == 5 and sys.argv[1] == "--child-prove",
                "INVOCATION_INVALID")
        prove(int(sys.argv[2]), int(sys.argv[3]), sys.argv[4])
    except (Rejected, ValueError) as exc:
        print(f"[hr-s256-r2-child-proof] {exc}", file=sys.stderr)
        raise SystemExit(2) from None
