"""Fixed s256 custody primitive; not called by the inert DS action.

Inputs to these functions must come from verified root-side preflight and
launcher state. A sealed fixture is never itself a trusted host observation.
"""

import hashlib
import json
import os
import re
import stat


OPERATION_ID = "hr-s256-trusted-quiescence-cut-20260925-v1"
HANDLE = "turn:961534a5-8c94-487d-8e55-d324a54e821a:a2:g1:s256"
DIRECTORY = OPERATION_ID
MAX_BYTES = 65536
HASH = re.compile(r"^[a-f0-9]{64}$")


class Rejected(Exception):
    pass


def require(ok, reason):
    if not ok:
        raise Rejected(reason)


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":")).encode()


def valid_hash(value):
    return isinstance(value, str) and HASH.fullmatch(value) is not None


def valid_authorization(value, intent):
    if type(value) is not dict or set(value) != {
            "operationId", "hostId", "startupNonce", "subject",
            "subjectPreimageSha256", "consumingBinarySha256", "archiveSha256",
            "outputsSha256", "holderCheck", "authorizedStartupAtWallMs"}:
        return False
    subject = value["subject"]
    holder = value["holderCheck"]
    return (value["operationId"] == OPERATION_ID
            and isinstance(value["hostId"], str) and bool(value["hostId"])
            and isinstance(value["startupNonce"], str)
            and hashlib.sha256(value["startupNonce"].encode()).hexdigest()
                == intent["nonceSha256"]
            and value["subjectPreimageSha256"] == intent["subjectPreimageSha256"]
            and valid_hash(value["consumingBinarySha256"])
            and valid_hash(value["archiveSha256"])
            and type(value["outputsSha256"]) is list
            and len(value["outputsSha256"]) == 2
            and all(valid_hash(item) for item in value["outputsSha256"])
            and type(subject) is dict and set(subject) == {
                "reconciliationHandle", "turnExecutionId", "runtimeEpoch",
                "agentId", "processGeneration"}
            and subject["reconciliationHandle"] == HANDLE
            and subject["turnExecutionId"] == HANDLE
            and subject["agentId"] == "agt_hr-agent"
            and isinstance(subject["runtimeEpoch"], str) and bool(subject["runtimeEpoch"])
            and type(subject["processGeneration"]) is int
            and subject["processGeneration"] == 1
            and type(holder) is dict
            and holder.get("operationId") == OPERATION_ID
            and holder.get("method") == "lsof"
            and holder.get("openHolderCount") == 0
            and type(value["authorizedStartupAtWallMs"]) is int
            and intent["atWallMs"] < value["authorizedStartupAtWallMs"]
                <= (1 << 53) - 1)


def opened_custody(create):
    require(TEST_MODE or os.geteuid() == 0, "ROOT_CUSTODY_REQUIRED")
    root = None
    try:
        root = os.open(STATE_ROOT, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        meta = os.fstat(root)
        require(stat.S_ISDIR(meta.st_mode)
                and meta.st_uid == (os.geteuid() if TEST_MODE else 0)
                and not (meta.st_mode & 0o022), "CUSTODY_ROOT_INVALID")
        if create:
            try:
                os.mkdir(DIRECTORY, 0o700, dir_fd=root)
                os.fsync(root)
            except FileExistsError:
                pass
        directory = os.open(DIRECTORY, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW,
                            dir_fd=root)
        meta = os.fstat(directory)
        require(stat.S_ISDIR(meta.st_mode)
                and meta.st_uid == (os.geteuid() if TEST_MODE else 0)
                and stat.S_IMODE(meta.st_mode) == 0o700, "CUSTODY_DIRECTORY_INVALID")
        return root, directory
    except (OSError, Rejected) as exc:
        if root is not None:
            os.close(root)
        raise Rejected("CUSTODY_UNAVAILABLE") from exc


def close_custody(root, directory):
    os.close(directory)
    os.close(root)


def readback(kind):
    require(kind in ("intent", "launch-authorization", "launch-claimed"),
            "RECEIPT_KIND_INVALID")
    root, directory = opened_custody(False)
    try:
        name = kind + ".json"
        fd = os.open(name, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=directory)
        try:
            meta = os.fstat(fd)
            require(stat.S_ISREG(meta.st_mode)
                    and meta.st_uid == (os.geteuid() if TEST_MODE else 0)
                    and stat.S_IMODE(meta.st_mode) == 0o600
                    and 0 < meta.st_size <= MAX_BYTES, "RECEIPT_CUSTODY_INVALID")
            raw = os.read(fd, MAX_BYTES + 1)
            require(len(raw) == meta.st_size, "RECEIPT_SIZE_CHANGED")
        finally:
            os.close(fd)
        record = json.loads(raw)
        require(type(record) is dict and record.get("operationId") == OPERATION_ID,
                "RECEIPT_IDENTITY_INVALID")
        if kind == "intent":
            require(set(record) == {"version", "operationId", "phase", "subject",
                                    "subjectPreimageSha256", "nonceSha256", "atWallMs"}
                    and record["version"] == 1 and record["phase"] == "INTENT"
                    and record["subject"] == HANDLE
                    and valid_hash(record["subjectPreimageSha256"])
                    and valid_hash(record["nonceSha256"])
                    and type(record["atWallMs"]) is int and record["atWallMs"] >= 0,
                    "INTENT_INVALID")
        elif kind == "launch-authorization":
            require(record.get("phase") == "LAUNCH_AUTHORIZED"
                    and type(record.get("authorization")) is dict
                    and record.get("intentSha256") == readback("intent")[1]
                    and valid_authorization(record["authorization"], readback("intent")[0]),
                    "LAUNCH_RECEIPT_INVALID")
        else:
            require(set(record) == {"version", "operationId", "phase",
                                    "launchAuthorizationSha256", "atWallMs"}
                    and record["version"] == 1 and record["phase"] == "LAUNCH_CLAIMED"
                    and record["launchAuthorizationSha256"] ==
                        readback("launch-authorization")[1]
                    and type(record["atWallMs"]) is int and record["atWallMs"] >
                        readback("launch-authorization")[0]["authorization"]
                        ["authorizedStartupAtWallMs"], "LAUNCH_CLAIM_INVALID")
        require(raw == canonical(record), "RECEIPT_CANONICAL_INVALID")
        return record, hashlib.sha256(raw).hexdigest()
    except (OSError, ValueError, UnicodeDecodeError, Rejected) as exc:
        raise Rejected("RECEIPT_READBACK_UNKNOWN") from exc
    finally:
        close_custody(root, directory)


def write_once(kind, record):
    raw = canonical(record)
    require(0 < len(raw) <= MAX_BYTES, "RECEIPT_SIZE_INVALID")
    root, directory = opened_custody(True)
    try:
        fd = os.open(kind + ".json", os.O_WRONLY | os.O_CREAT | os.O_EXCL |
                     os.O_NOFOLLOW, 0o600, dir_fd=directory)
        try:
            view = memoryview(raw)
            while view:
                count = os.write(fd, view)
                require(count > 0, "RECEIPT_WRITE_UNKNOWN")
                view = view[count:]
            os.fsync(fd)
        finally:
            os.close(fd)
        os.fsync(directory)
    except (OSError, Rejected) as exc:
        raise Rejected("RECEIPT_CREATE_UNKNOWN") from exc
    finally:
        close_custody(root, directory)
    observed, digest = readback(kind)
    require(observed == record and digest == hashlib.sha256(raw).hexdigest(),
            "RECEIPT_READBACK_MISMATCH")
    return digest


def seal_intent(nonce, subject_preimage_sha256, at_wall_ms):
    require(isinstance(nonce, str) and 16 <= len(nonce) <= 128
            and valid_hash(subject_preimage_sha256)
            and type(at_wall_ms) is int and 0 <= at_wall_ms <= (1 << 53) - 1,
            "INTENT_INPUT_INVALID")
    return write_once("intent", {"version": 1, "operationId": OPERATION_ID,
        "phase": "INTENT", "subject": HANDLE,
        "subjectPreimageSha256": subject_preimage_sha256,
        "nonceSha256": hashlib.sha256(nonce.encode()).hexdigest(),
        "atWallMs": at_wall_ms})


def seal_launch_authorization(authorization):
    intent, _ = readback("intent")
    require(valid_authorization(authorization, intent), "LAUNCH_AUTHORIZATION_BINDING_INVALID")
    return write_once("launch-authorization", {"version": 1,
        "operationId": OPERATION_ID, "phase": "LAUNCH_AUTHORIZED",
        "intentSha256": readback("intent")[1], "authorization": authorization})


def claim_one_launch(at_wall_ms):
    """Durably consume the fixed launch before any child can be spawned."""
    receipt, digest = readback("launch-authorization")
    require(type(at_wall_ms) is int
            and receipt["authorization"]["authorizedStartupAtWallMs"] < at_wall_ms
            <= (1 << 53) - 1, "LAUNCH_CLAIM_TIME_INVALID")
    return write_once("launch-claimed", {"version": 1, "operationId": OPERATION_ID,
        "phase": "LAUNCH_CLAIMED", "launchAuthorizationSha256": digest,
        "atWallMs": at_wall_ms})
