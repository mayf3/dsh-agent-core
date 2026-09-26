"""One-use nonce/window FD challenge, disconnected from the inert DS action.

The fixture proves inherited descriptor possession only. Installed binary
identity, source closure, lock continuity and Router admission remain absent.
"""

import array
import hashlib
import json
import os
import secrets
import socket
import stat
import time


MAX_FRAME = 512
CHALLENGE_TIMEOUT = 0.75


class Rejected(Exception):
    pass


def require(ok, reason):
    if not ok:
        raise Rejected(reason)


def window_identity(fd):
    try:
        meta = os.fstat(fd)
    except OSError as exc:
        raise Rejected("WINDOW_FD_INVALID") from exc
    require(stat.S_ISREG(meta.st_mode), "WINDOW_FD_INVALID")
    return [meta.st_dev, meta.st_ino]


def response_digest(nonce, challenge, receipt_sha256, identity):
    raw = json.dumps([nonce, challenge, receipt_sha256, identity],
                     separators=(",", ":")).encode()
    return hashlib.sha256(raw).hexdigest().encode()


def approval_digest(nonce, challenge, receipt_sha256, identity):
    raw = json.dumps(["ROOT_APPROVED", nonce, challenge, receipt_sha256, identity],
                     separators=(",", ":")).encode()
    return hashlib.sha256(raw).hexdigest().encode()


def same_open_file_description(expected_fd, returned_fd, expected_identity):
    """Prove the returned regular FD shares the held window's file offset.

    A second open of the same inode has an independent offset; an inherited
    dup (including an SCM_RIGHTS transfer) shares the open-file description.
    """
    require(window_identity(returned_fd) == expected_identity, "WINDOW_FD_MISMATCH")
    original = os.lseek(expected_fd, 0, os.SEEK_CUR)
    returned = os.lseek(returned_fd, 0, os.SEEK_CUR)
    probe = original + 1
    try:
        os.lseek(returned_fd, probe, os.SEEK_SET)
        return os.lseek(expected_fd, 0, os.SEEK_CUR) == probe
    finally:
        os.lseek(returned_fd, returned, os.SEEK_SET)
        os.lseek(expected_fd, original, os.SEEK_SET)


class OneLaunchHandoff:
    def __init__(self, receipt_sha256, window_fd, sealed_startup_nonce):
        require(isinstance(receipt_sha256, str) and len(receipt_sha256) == 64
                and all(c in "0123456789abcdef" for c in receipt_sha256),
                "RECEIPT_SHA_INVALID")
        require(isinstance(sealed_startup_nonce, str)
                and 16 <= len(sealed_startup_nonce) <= 128,
                "STARTUP_NONCE_INVALID")
        self.window_identity = window_identity(window_fd)
        self.window_parent_fd = os.dup(window_fd)
        self.window_child_fd = os.dup(window_fd)
        self.root, self.child = socket.socketpair()
        self.receipt_sha256 = receipt_sha256
        self.nonce = sealed_startup_nonce
        self.challenge_value = secrets.token_hex(32)
        self.challenge_deadline = time.monotonic() + CHALLENGE_TIMEOUT
        self.taken = False
        self.used = False

    def take_child_fds(self):
        require(not self.taken and not self.used, "LAUNCH_ALREADY_CLAIMED")
        self.taken = True
        return self.child.fileno(), self.window_child_fd

    def close_child_fds(self):
        if self.child is not None:
            self.child.close()
            self.child = None
        if self.window_child_fd is not None:
            os.close(self.window_child_fd)
            self.window_child_fd = None

    def challenge(self):
        require(self.taken and not self.used, "LAUNCH_ALREADY_CLAIMED")
        self.used = True
        frame = json.dumps({"nonce": self.nonce, "challenge": self.challenge_value,
            "receiptSha256": self.receipt_sha256, "windowIdentity": self.window_identity},
            separators=(",", ":")).encode() + b"\n"
        require(len(frame) <= MAX_FRAME, "CHALLENGE_FRAME_BOUND")
        deadline = self.challenge_deadline
        received_fds = []
        try:
            remaining = deadline - time.monotonic()
            require(remaining > 0, "CHALLENGE_DEADLINE")
            self.root.settimeout(remaining)
            self.root.sendall(frame)
            answer = bytearray()
            while len(answer) < 64:
                remaining = deadline - time.monotonic()
                require(remaining > 0, "CHALLENGE_DEADLINE")
                self.root.settimeout(remaining)
                block, ancillary, flags, _ = self.root.recvmsg(
                    64 - len(answer), socket.CMSG_SPACE(4 * array.array("i").itemsize))
                require(bool(block), "CHALLENGE_CLOSED")
                require(not (flags & socket.MSG_CTRUNC), "CHALLENGE_FD_TRUNCATED")
                for level, kind, data in ancillary:
                    require(level == socket.SOL_SOCKET and kind == socket.SCM_RIGHTS,
                            "CHALLENGE_FD_INVALID")
                    fds = array.array("i")
                    fds.frombytes(data[:len(data) // fds.itemsize * fds.itemsize])
                    received_fds.extend(fds)
                answer.extend(block)
            require(len(received_fds) == 1
                    and same_open_file_description(self.window_parent_fd,
                        received_fds[0], self.window_identity), "CHALLENGE_WINDOW_FD_MISSING")
        except (OSError, TimeoutError) as exc:
            raise Rejected("CHALLENGE_UNAVAILABLE") from exc
        finally:
            for fd in received_fds:
                os.close(fd)
        require(bytes(answer) == response_digest(self.nonce, self.challenge_value,
                self.receipt_sha256, self.window_identity), "CHALLENGE_MISMATCH")
        try:
            remaining = deadline - time.monotonic()
            require(remaining > 0, "CHALLENGE_DEADLINE")
            self.root.settimeout(remaining)
            self.root.sendall(approval_digest(self.nonce, self.challenge_value,
                    self.receipt_sha256, self.window_identity))
        except (OSError, TimeoutError) as exc:
            raise Rejected("CHALLENGE_UNAVAILABLE") from exc

        return hashlib.sha256(frame + bytes(answer) + approval_digest(self.nonce,
            self.challenge_value, self.receipt_sha256, self.window_identity)).hexdigest()

    def close(self):
        self.close_child_fds()
        self.root.close()
        os.close(self.window_parent_fd)


def child_prove(challenge_fd, window_fd, expected_receipt_sha256):
    """Fixture-side primitive for an inherited FD; no production startup wiring."""
    require(isinstance(expected_receipt_sha256, str)
            and len(expected_receipt_sha256) == 64, "RECEIPT_SHA_INVALID")
    try:
        channel = socket.socket(fileno=challenge_fd)
        deadline = time.monotonic() + CHALLENGE_TIMEOUT
        raw = bytearray()
        while not raw.endswith(b"\n"):
            remaining = deadline - time.monotonic()
            require(remaining > 0, "CHALLENGE_DEADLINE")
            channel.settimeout(remaining)
            block = channel.recv(1)
            require(bool(block) and len(raw) < MAX_FRAME, "CHALLENGE_FRAME_INVALID")
            raw.extend(block)
        frame = json.loads(raw)
        identity = window_identity(window_fd)
        require(type(frame) is dict and frame.get("receiptSha256") == expected_receipt_sha256
                and frame.get("windowIdentity") == identity
                and isinstance(frame.get("nonce"), str)
                and isinstance(frame.get("challenge"), str), "CHALLENGE_BINDING_INVALID")
        answer = response_digest(frame["nonce"], frame["challenge"],
                                 expected_receipt_sha256, identity)
        sent = channel.sendmsg([answer], [(socket.SOL_SOCKET, socket.SCM_RIGHTS,
                array.array("i", [window_fd]))])
        require(sent == len(answer), "CHALLENGE_RESPONSE_INCOMPLETE")
        approved = bytearray()
        while len(approved) < 64:
            remaining = deadline - time.monotonic()
            require(remaining > 0, "CHALLENGE_DEADLINE")
            channel.settimeout(remaining)
            block = channel.recv(64 - len(approved))
            require(bool(block), "CHALLENGE_APPROVAL_MISSING")
            approved.extend(block)
        require(bytes(approved) == approval_digest(frame["nonce"], frame["challenge"],
                expected_receipt_sha256, identity), "CHALLENGE_APPROVAL_INVALID")
    except (OSError, ValueError, TimeoutError) as exc:
        raise Rejected("CHALLENGE_UNAVAILABLE") from exc


def runtime_admission_view(frame, host, nonce, receipt, challenge):
    """Separate transient H5 view; never a bundle, record or proof-frame field."""
    require(type(frame) is dict and set(frame) == {'operationId', 'hostId', 'startupNonce',
        'challenge', 'launchAuthorizationReceiptSha256', 'reconciliationHandle', 'runtime'}
        and frame['operationId'] == 'hr-s256-trusted-quiescence-cut-20260925-v1'
        and frame['hostId'] == host and frame['startupNonce'] == nonce
        and frame['launchAuthorizationReceiptSha256'] == receipt
        and frame['reconciliationHandle'] == 'turn:961534a5-8c94-487d-8e55-d324a54e821a:a2:g1:s256'
        and type(challenge) is str and len(challenge) == 32 and frame['challenge'] == challenge, 'RUNTIME_ADMISSION_BINDING')
    runtime = frame['runtime']
    require(type(runtime) is dict and set(runtime) == {'generationId', 'health',
        'businessAdmission', 'blockedReason', 'unresolvedRecoveries'}
        and type(runtime['generationId']) is str and 0 < len(runtime['generationId']) <= 128
        and runtime['health'] == 'healthy' and runtime['businessAdmission'] == 'open'
        and runtime['blockedReason'] is None and type(runtime['unresolvedRecoveries']) is int
        and runtime['unresolvedRecoveries'] >= 0, 'RUNTIME_ADMISSION_UNKNOWN')
    return dict(runtime)


def serve_fixed_window(io, handoff):
    """Only the actual fixed IO's authenticated one-child socket/custody."""
    HR_PROFILE.require(type(io) is HR_FIXED_IO.FixedIO, 'PRIVATE_RUNTIME_OWNER_REQUIRED')
    deadline = io._startup_deadline
    try:
        while not io._challenge_stop.is_set():
            HR_PROFILE.require(time.monotonic() < deadline, 'STARTUP_DEADLINE')
            handoff.root.settimeout(min(0.25, max(0, deadline - time.monotonic())))
            raw = bytearray()
            try:
                first = handoff.root.recv(1)
            except TimeoutError:
                continue
            HR_PROFILE.require(bool(first), 'LIVE_CHALLENGE_CLOSED')
            raw.extend(first)
            request_deadline = time.monotonic() + 0.75
            while not raw.endswith(b'\n'):
                remaining = request_deadline - time.monotonic()
                HR_PROFILE.require(remaining > 0 and len(raw) < 4096, 'LIVE_CHALLENGE_BOUND')
                handoff.root.settimeout(remaining)
                part = handoff.root.recv(1)
                HR_PROFILE.require(bool(part), 'LIVE_CHALLENGE_CLOSED')
                raw.extend(part)
            query = json.loads(raw, object_pairs_hook=HR_REAL_OS.unique_object)
            if type(query) is dict and 'runtime' in query:
                runtime = runtime_admission_view(query, io._package['hostId'], io._nonce,
                    HR_JOURNAL.readback('launch-authorization')[1], io._admission_challenge)
            else:
                runtime = None
                HR_PROFILE.require(type(query) is dict and set(query) == {
                    'operationId', 'hostId', 'startupNonce', 'challenge'}
                    and query['operationId'] == HR_PROFILE.OPERATION_ID
                    and query['hostId'] == io._package['hostId']
                    and query['startupNonce'] == io._nonce
                    and type(query['challenge']) is str and (len(query['challenge']) == 32
                        or query['challenge'] == 'startup-consumption-finished'),
                    'LIVE_CHALLENGE_BINDING')
            io._active()
            io._owner.check()
            root, directory = HR_JOURNAL.opened_custody(False)
            try:
                io._single_bundle(directory)
            finally:
                HR_JOURNAL.close_custody(root, directory)
            HR_PROFILE.require(HR_INVENTORY.fixed_source_identities() == io._inventory['sources']
                and io._child.poll() is None, 'LIVE_SOURCE_UNKNOWN')
            if runtime is not None:
                HR_PROFILE.require(io._startup_done.is_set() and io._runtime_admission is None
                    and time.monotonic() < deadline, 'RUNTIME_ADMISSION_NO_REPLAY')
                io._runtime_admission = runtime
                io._runtime_admission_done.set()
                continue
            if query['challenge'] == 'startup-consumption-finished':
                HR_PROFILE.require(not io._startup_done.is_set(), 'STARTUP_NOTICE_NO_REPLAY')
                io._startup_done.set()  # Notice is not settlement proof.
                continue
            remaining = request_deadline - time.monotonic()
            HR_PROFILE.require(remaining > 0, 'LIVE_CHALLENGE_BOUND')
            handoff.root.settimeout(remaining)
            handoff.root.sendall(json.dumps({**query, 'exclusiveWindowHeld': True,
                'launchSourcesStillInhibited': True, 'windowClosed': False},
                separators=(',', ':')).encode() + b'\n')
    except BaseException:
        if not io._challenge_stop.is_set():
            io._unknown = True
