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
COMMITMENT_FIELDS = {"receiptVersion", "operationId", "hostId", "startupNonce",
                     "reconciliationHandle", "subject", "subjectPreimageSha256",
                     "launchAuthorizationReceiptSha256", "bundleSha256",
                     "bundleByteLength", "sealedAtWallMs", "producerId"}
INDEX_FIELDS = {"version", "operationId", "reconciliationHandle", "hostId",
                "startupNonceSha256", "bundleSha256"}


class Rejected(Exception):
    pass


def require(ok, reason):
    if not ok:
        raise Rejected(reason)


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":")).encode()


def sha256(raw):
    return hashlib.sha256(raw).hexdigest()


def exact(value, fields):
    return type(value) is dict and set(value) == fields


def unique_pairs(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, "BUNDLE_DUPLICATE_FIELD")
        result[key] = value
    return result


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
            and type(value["authorizedStartupAtWallMs"]) is int
            and intent["atWallMs"] < value["authorizedStartupAtWallMs"]
                <= (1 << 53) - 1
            and type(holder) is dict
            and set(holder) == {"operationId", "executedAtWallMs", "method",
                                "paths", "openHolderCount"}
            and holder.get("operationId") == OPERATION_ID
            and holder.get("method") == "lsof"
            and type(holder.get("openHolderCount")) is int
            and holder.get("openHolderCount") == 0
            and type(holder["executedAtWallMs"]) is int
            and 0 <= holder["executedAtWallMs"] < value["authorizedStartupAtWallMs"]
            and type(holder["paths"]) is list
            and 1 <= len(holder["paths"]) <= 16
            and all(isinstance(path, str) and path.startswith("/")
                    and len(path) <= 512 for path in holder["paths"]))


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


def readback_bundle_bytes():
    root, directory = opened_custody(False)
    try:
        fd = os.open("bundle.json", os.O_RDONLY | os.O_NOFOLLOW, dir_fd=directory)
        try:
            before = os.fstat(fd)
            require(stat.S_ISREG(before.st_mode)
                    and before.st_uid == (os.geteuid() if TEST_MODE else 0)
                    and stat.S_IMODE(before.st_mode) == 0o600
                    and 0 < before.st_size <= MAX_BYTES, "BUNDLE_CUSTODY_INVALID")
            raw = os.read(fd, MAX_BYTES + 1)
            after = os.fstat(fd)
            identity = lambda meta: (meta.st_dev, meta.st_ino, meta.st_size,
                                     meta.st_mtime_ns, meta.st_ctime_ns)
            require(len(raw) == before.st_size and identity(before) == identity(after),
                    "BUNDLE_READBACK_CHANGED")
            return raw
        finally:
            os.close(fd)
    except (OSError, Rejected) as exc:
        raise Rejected("BUNDLE_READBACK_UNKNOWN") from exc
    finally:
        close_custody(root, directory)


def write_bundle_once(raw):
    require(type(raw) is bytes and 0 < len(raw) <= MAX_BYTES,
            "BUNDLE_SIZE_INVALID")
    root, directory = opened_custody(True)
    try:
        fd = os.open("bundle.json", os.O_WRONLY | os.O_CREAT | os.O_EXCL |
                     os.O_NOFOLLOW, 0o600, dir_fd=directory)
        try:
            view = memoryview(raw)
            while view:
                count = os.write(fd, view)
                require(count > 0, "BUNDLE_WRITE_UNKNOWN")
                view = view[count:]
            os.fsync(fd)
        finally:
            os.close(fd)
        os.fsync(directory)
    except (OSError, Rejected) as exc:
        raise Rejected("BUNDLE_CREATE_UNKNOWN") from exc
    finally:
        close_custody(root, directory)
    require(readback_bundle_bytes() == raw, "BUNDLE_READBACK_MISMATCH")


def readback(kind):
    require(kind in ("intent", "launch-authorization", "bundle-commitment",
                     "live-handle-index", "launch-claimed"),
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
        elif kind == "live-handle-index":
            authorization = readback("launch-authorization")[0]["authorization"]
            require(exact(record, INDEX_FIELDS)
                    and type(record["version"]) is int
                    and record["version"] == 1
                    and record["reconciliationHandle"] == HANDLE
                    and record["hostId"] == authorization["hostId"]
                    and record["startupNonceSha256"] ==
                        sha256(authorization["startupNonce"].encode())
                    and valid_hash(record["bundleSha256"]),
                    "COMMITMENT_INDEX_INVALID")
        elif kind == "bundle-commitment":
            authorization, auth_digest = readback("launch-authorization")
            auth = authorization["authorization"]
            index = readback("live-handle-index")[0]
            bundle_raw = readback_bundle_bytes()
            require(exact(record, COMMITMENT_FIELDS)
                    and type(record["receiptVersion"]) is int
                    and record["receiptVersion"] == 1
                    and record["operationId"] == OPERATION_ID
                    and record["hostId"] == auth["hostId"]
                    and record["startupNonce"] == auth["startupNonce"]
                    and record["reconciliationHandle"] == HANDLE
                    and exact(record["subject"], {"turnExecutionId",
                        "runtimeEpoch", "agentId", "processGeneration"})
                    and record["subject"] == {
                        key: auth["subject"][key] for key in
                        ("turnExecutionId", "runtimeEpoch", "agentId",
                         "processGeneration")}
                    and record["subjectPreimageSha256"] ==
                        auth["subjectPreimageSha256"]
                    and record["launchAuthorizationReceiptSha256"] == auth_digest
                    and record["bundleSha256"] == index["bundleSha256"]
                    and record["bundleSha256"] == sha256(bundle_raw)
                    and type(record["bundleByteLength"]) is int
                    and record["bundleByteLength"] == len(bundle_raw)
                    and type(record["sealedAtWallMs"]) is int
                    and auth["authorizedStartupAtWallMs"] <
                        record["sealedAtWallMs"] <= (1 << 53) - 1
                    and record["producerId"] ==
                        "trusted root recovery control plane",
                    "BUNDLE_COMMITMENT_INVALID")
        else:
            require(set(record) == {"version", "operationId", "phase",
                                    "launchAuthorizationSha256",
                                    "bundleCommitmentSha256", "atWallMs"}
                    and record["version"] == 1 and record["phase"] == "LAUNCH_CLAIMED"
                    and record["launchAuthorizationSha256"] ==
                        readback("launch-authorization")[1]
                    and record["bundleCommitmentSha256"] ==
                        readback("bundle-commitment")[1]
                    and type(record["atWallMs"]) is int and record["atWallMs"] >
                        readback("bundle-commitment")[0]["sealedAtWallMs"],
                    "LAUNCH_CLAIM_INVALID")
        require(raw == canonical(record), "RECEIPT_CANONICAL_INVALID")
        return record, hashlib.sha256(raw).hexdigest()
    except (OSError, ValueError, UnicodeDecodeError, Rejected) as exc:
        raise Rejected("RECEIPT_READBACK_UNKNOWN") from exc
    finally:
        close_custody(root, directory)


def write_once(kind, record):
    require(kind in ("intent", "launch-authorization", "live-handle-index",
                     "bundle-commitment", "launch-claimed"), "RECEIPT_KIND_INVALID")
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


def validated_final_bundle(raw, authorization, launch_digest):
    require(type(raw) is bytes and 0 < len(raw) <= MAX_BYTES,
            "BUNDLE_SIZE_INVALID")
    try:
        bundle = json.loads(raw.decode("utf-8"), object_pairs_hook=unique_pairs,
            parse_constant=lambda _value: reject_nonfinite())
    except (ValueError, UnicodeDecodeError, Rejected) as exc:
        raise Rejected("BUNDLE_SCHEMA_INVALID") from exc
    require(exact(bundle, {"bundleSchemaVersion", "subject", "epochRetirement",
                           "recoveryCutover", "deploymentProof", "hostCensus",
                           "holderCheck", "custody", "controlledStop"})
            and bundle["bundleSchemaVersion"] == 2
            and bundle["subject"] == authorization["subject"]
            and exact(bundle["epochRetirement"], {"retiredEpoch"})
            and bundle["epochRetirement"]["retiredEpoch"] ==
                authorization["subject"]["runtimeEpoch"], "BUNDLE_SUBJECT_INVALID")
    cut = bundle["recoveryCutover"]
    require(exact(cut, {"operationId", "hostId", "startupNonce",
                        "subjectPreimageSha256", "exclusiveWindowReceiptSha256",
                        "launchSourcesInhibitedReceiptSha256",
                        "oldTreeQuiescedReceiptSha256",
                        "launchAuthorizationReceiptSha256", "windowOpenedAtWallMs",
                        "oldTreeQuiescedAtWallMs", "authorizedStartupAtWallMs",
                        "consumingBinarySha256"})
            and cut["operationId"] == OPERATION_ID
            and cut["hostId"] == authorization["hostId"]
            and cut["startupNonce"] == authorization["startupNonce"]
            and cut["subjectPreimageSha256"] ==
                authorization["subjectPreimageSha256"]
            and cut["launchAuthorizationReceiptSha256"] == launch_digest
            and cut["consumingBinarySha256"] ==
                authorization["consumingBinarySha256"]
            and all(valid_hash(cut[name]) for name in (
                "exclusiveWindowReceiptSha256",
                "launchSourcesInhibitedReceiptSha256",
                "oldTreeQuiescedReceiptSha256"))
            and all(type(cut[name]) is int and 0 <= cut[name] <= (1 << 53) - 1
                    for name in ("windowOpenedAtWallMs", "oldTreeQuiescedAtWallMs",
                                 "authorizedStartupAtWallMs"))
            and cut["windowOpenedAtWallMs"] < cut["oldTreeQuiescedAtWallMs"]
            < cut["authorizedStartupAtWallMs"]
            == authorization["authorizedStartupAtWallMs"],
            "BUNDLE_CUT_INVALID")
    deployment = bundle["deploymentProof"]
    census = bundle["hostCensus"]
    require(exact(deployment, {"floorProvenReceiptSha256",
                               "validatorInstalledReceiptSha256",
                               "deployedBinarySha256"})
            and valid_hash(deployment["floorProvenReceiptSha256"])
            and valid_hash(deployment["validatorInstalledReceiptSha256"])
            and deployment["deployedBinarySha256"] ==
                authorization["consumingBinarySha256"]
            and exact(census, {"operationId", "executedAtWallMs", "hostId",
                               "tools", "outputsSha256", "archiveRef",
                               "runtimeTreeProcessCount"})
            and census["operationId"] == OPERATION_ID
            and census["hostId"] == authorization["hostId"]
            and census["tools"] == ["ps", "lsof"]
            and census["outputsSha256"] == authorization["outputsSha256"]
            and isinstance(census["archiveRef"], str)
            and 0 < len(census["archiveRef"]) <= 512
            and type(census["runtimeTreeProcessCount"]) is int
            and census["runtimeTreeProcessCount"] == 0
            and type(bundle["holderCheck"]["openHolderCount"]) is int
            and type(census["executedAtWallMs"]) is int
            and cut["oldTreeQuiescedAtWallMs"] < census["executedAtWallMs"]
            < cut["authorizedStartupAtWallMs"]
            and bundle["holderCheck"] == authorization["holderCheck"]
            and cut["oldTreeQuiescedAtWallMs"] <
                bundle["holderCheck"]["executedAtWallMs"]
            < cut["authorizedStartupAtWallMs"], "BUNDLE_EVIDENCE_VALUES_INVALID")
    custody = bundle["custody"]
    require(exact(custody, {"executedAs", "producedBy", "evidenceDir"})
            and custody["executedAs"] == "root"
            and custody["producedBy"] ==
                "trusted_cp_recovery_evidence_collector_v1"
            and isinstance(custody["evidenceDir"], str)
            and custody["evidenceDir"].startswith("/")
            and len(custody["evidenceDir"]) <= 512,
            "BUNDLE_CUSTODY_VALUES_INVALID")
    # The controlled-stop variant and its live plan binding are not built by
    # this disconnected increment. Reject it instead of guessing an enum.
    require(bundle["controlledStop"] is None, "CONTROLLED_STOP_UNIMPLEMENTED")
    return bundle


def reject_nonfinite():
    raise Rejected("BUNDLE_NONFINITE")


def seal_bundle_commitment(bundle_bytes, sealed_at_wall_ms):
    """Seal fixed final bytes + one-handle index, without launch authority."""
    authorization, auth_digest = readback("launch-authorization")
    auth = authorization["authorization"]
    validated_final_bundle(bundle_bytes, auth, auth_digest)
    require(type(sealed_at_wall_ms) is int
            and auth["authorizedStartupAtWallMs"] < sealed_at_wall_ms
            <= (1 << 53) - 1, "COMMITMENT_SEAL_TIME_INVALID")
    digest = sha256(bundle_bytes)
    index = {"version": 1, "operationId": OPERATION_ID,
        "reconciliationHandle": HANDLE, "hostId": auth["hostId"],
        "startupNonceSha256": sha256(auth["startupNonce"].encode()),
        "bundleSha256": digest}
    receipt = {"receiptVersion": 1, "operationId": OPERATION_ID,
        "hostId": auth["hostId"], "startupNonce": auth["startupNonce"],
        "reconciliationHandle": HANDLE,
        "subject": {name: auth["subject"][name] for name in
                    ("turnExecutionId", "runtimeEpoch", "agentId",
                     "processGeneration")},
        "subjectPreimageSha256": auth["subjectPreimageSha256"],
        "launchAuthorizationReceiptSha256": auth_digest,
        "bundleSha256": digest, "bundleByteLength": len(bundle_bytes),
        "sealedAtWallMs": sealed_at_wall_ms,
        "producerId": "trusted root recovery control plane"}
    write_bundle_once(bundle_bytes)
    write_once("live-handle-index", index)
    return write_once("bundle-commitment", receipt)


def claim_one_launch(at_wall_ms):
    """Durably consume the fixed launch before any child can be spawned."""
    receipt, digest = readback("launch-authorization")
    commitment, commitment_digest = readback("bundle-commitment")
    require(type(at_wall_ms) is int
            and commitment["sealedAtWallMs"] < at_wall_ms
            <= (1 << 53) - 1, "LAUNCH_CLAIM_TIME_INVALID")
    return write_once("launch-claimed", {"version": 1, "operationId": OPERATION_ID,
        "phase": "LAUNCH_CLAIMED", "launchAuthorizationSha256": digest,
        "bundleCommitmentSha256": commitment_digest,
        "atWallMs": at_wall_ms})
