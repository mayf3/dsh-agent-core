"""Fixed s256 phase projections on the existing root-custody journal.

Disconnected NONPRODUCTION implementation: observations below are internal
root-launcher/readback projections, NOT DS request data or trusted proof just
because their shape passes. The installed observation producer, child ownership,
source closure and window-release mechanism are not supplied by this module.
The DS production entry stays inert. No function spawns, signals or releases FDs.
"""

import json
import os
import stat


J = HR_JOURNAL
Rejected = J.Rejected
STATES = {"phase-startup": "STARTUP_OBSERVED",
          "phase-consumption": "CONSUMPTION_READBACK",
          "phase-abandoned": "ABANDONED", "phase-closed": "CLOSED",
          "phase-unknown": "UNKNOWN"}
PARENTS = {"phase-startup": "phase-launch-attempt",
           "phase-consumption": "phase-startup", "phase-abandoned": "phase-sealed",
           "phase-closed": "phase-consumption"}
ORDER = ("phase-sealed", "phase-launch-attempt", "phase-startup", "phase-consumption")
OWNERSHIP_FIELDS = {"ownedChild", "windowIdentity", "canonicalLockIdentity",
    "canonicalLockOwnershipReceiptSha256", "launchSourcesInhibitedReceiptSha256",
    "windowHeld", "canonicalLockHeld", "sourcesInhibited"}
RELEASE_FIELDS = {"ownership", "ownedChildDispositionReceiptSha256",
    "launchSourceDispositionReceiptSha256", "windowReleaseReceiptSha256",
    "canonicalLockDispositionReceiptSha256", "businessOutcome"}


def _ownership(value, child_required=True):
    J.require(J.exact(value, OWNERSHIP_FIELDS), "OWNERSHIP_PROJECTION_INVALID")
    child = value["ownedChild"]
    J.require((J.exact(child, {"pid", "identitySha256"})
        and type(child["pid"]) is int and child["pid"] > 0
        and J.valid_hash(child["identitySha256"])) if child_required else child is None,
        "OWNED_CHILD_PROJECTION_INVALID")
    for name in ("windowIdentity", "canonicalLockIdentity"):
        J.require(type(value[name]) is list and len(value[name]) == 2
            and all(type(item) is int and item >= 0 for item in value[name]),
            "DESCRIPTOR_PROJECTION_INVALID")
    J.require(all(value[name] is True for name in
        ("windowHeld", "canonicalLockHeld", "sourcesInhibited"))
        and J.valid_hash(value["canonicalLockOwnershipReceiptSha256"])
        and J.valid_hash(value["launchSourcesInhibitedReceiptSha256"]),
        "CONTINUOUS_CUSTODY_UNKNOWN")


def _observation(kind, value, previous):
    auth = J.readback("launch-authorization")[0]["authorization"]
    bundle = json.loads(J.readback_bundle_bytes())
    if kind == "phase-startup":
        J.require(J.exact(value, {"ownership", "launchAuthorizationReceiptSha256",
            "consumingBinarySha256", "challengeReceiptSha256"})
            and value["launchAuthorizationReceiptSha256"] == J.readback("launch-authorization")[1]
            and value["consumingBinarySha256"] == auth["consumingBinarySha256"]
            and J.valid_hash(value["challengeReceiptSha256"]), "STARTUP_PROJECTION_INVALID")
        J.readback("launch-claimed")  # A used challenge flag alone is never startup.
    elif kind == "phase-consumption":
        J.require(J.exact(value, {"ownership", "validatedStoreSha256",
            "validatorBinarySha256", "settlement", "storeReadbackReceiptSha256"})
            and J.valid_hash(value["validatedStoreSha256"])
            and J.valid_hash(value["storeReadbackReceiptSha256"])
            and value["validatorBinarySha256"] == auth["consumingBinarySha256"]
            and value["settlement"] == {"reconciliationHandle": J.HANDLE,
                "queryState": "settled", "fenceState": "cleared",
                "initialOutcome": "outcome_unknown",
                "terminationEvidence": "restart_quiescence_proven"},
            "CONSUMPTION_PROJECTION_INVALID")
    elif kind in ("phase-closed", "phase-abandoned"):
        fields = RELEASE_FIELDS | ({"noLaunchReceiptSha256"} if kind == "phase-abandoned" else set())
        J.require(J.exact(value, fields) and value["businessOutcome"] == "outcome_unknown"
            and all(J.valid_hash(value[name]) for name in fields - {"ownership", "businessOutcome"}),
            "RELEASE_PROJECTION_INVALID")
    else:
        J.require(J.exact(value, {"ownership", "custodian", "dispositionDeadlineWallMs", "reason"})
            and value["custodian"] == "fixed-DS-owner"
            and type(value["dispositionDeadlineWallMs"]) is int
            and value["reason"] in ("READBACK_UNAVAILABLE", "STARTUP_UNAVAILABLE",
                                    "CUSTODY_CONTINUITY_UNKNOWN"), "UNKNOWN_PROJECTION_INVALID")
    _ownership(value["ownership"], kind != "phase-abandoned")
    J.require(value["ownership"]["launchSourcesInhibitedReceiptSha256"] ==
        bundle["recoveryCutover"]["launchSourcesInhibitedReceiptSha256"], "SOURCE_RECEIPT_MISMATCH")
    if previous["phase"] in ("STARTUP_OBSERVED", "CONSUMPTION_READBACK"):
        J.require(value["ownership"] == previous["observation"]["ownership"],
                  "OWNERSHIP_PROJECTION_CHANGED")


def _present(kind):
    root, directory = J.opened_custody(False)
    try:
        try:
            os.stat(kind + ".json", dir_fd=directory, follow_symlinks=False)
            return True
        except FileNotFoundError:
            return False
    except OSError as exc:
        raise Rejected("LIFECYCLE_PRESENCE_UNKNOWN") from exc
    finally:
        J.close_custody(root, directory)


def _terminal_absent():
    J.require(not any(_present(kind) for kind in
        ("phase-unknown", "phase-closed", "phase-abandoned", "key-tombstone")),
        "LIFECYCLE_TERMINAL_OR_UNKNOWN")


def _record(kind, observation, at_wall_ms, parent):
    previous, digest = readback(parent)
    J.require(type(at_wall_ms) is int and previous["atWallMs"] < at_wall_ms <= (1 << 53) - 1,
              "LIFECYCLE_TIME_INVALID")
    _observation(kind, observation, previous)
    if kind == "phase-unknown":
        J.require(at_wall_ms < observation["dispositionDeadlineWallMs"]
                  <= at_wall_ms + 300000, "CONTAINMENT_DEADLINE_INVALID")
    return {**J.phase_record(STATES[kind], at_wall_ms, digest),
            "observation": observation}


def _tombstone(record, digest):
    return {"version": 1, "operationId": J.OPERATION_ID, "phase": record["phase"],
        "hostId": record["hostId"], "reconciliationHandle": J.HANDLE,
        "startupNonceSha256": record["startupNonceSha256"],
        "bundleCommitmentSha256": record["bundleCommitmentSha256"],
        "terminalReceiptSha256": digest, "atWallMs": record["atWallMs"]}


def readback(kind):
    if kind in ORDER[:2] or kind == "launch-claimed":
        return J.readback(kind)
    J.require(kind in STATES or kind == "key-tombstone", "LIFECYCLE_KIND_INVALID")
    root, directory = J.opened_custody(False)
    try:
        fd = os.open(kind + ".json", os.O_RDONLY | os.O_NOFOLLOW, dir_fd=directory)
        try:
            before = os.fstat(fd)
            J.require(stat.S_ISREG(before.st_mode)
                and before.st_uid == os.fstat(directory).st_uid
                and stat.S_IMODE(before.st_mode) == 0o600
                and 0 < before.st_size <= J.MAX_BYTES, "LIFECYCLE_CUSTODY_INVALID")
            raw = os.read(fd, J.MAX_BYTES + 1)
            after = os.fstat(fd)
            identity = lambda meta: (meta.st_dev, meta.st_ino, meta.st_size,
                                     meta.st_mtime_ns, meta.st_ctime_ns)
            J.require(len(raw) == before.st_size and identity(before) == identity(after),
                      "LIFECYCLE_READBACK_CHANGED")
        finally:
            os.close(fd)
        record = json.loads(raw, object_pairs_hook=J.unique_pairs)
        J.require(type(record) is dict and raw == J.canonical(record), "LIFECYCLE_CANONICAL_INVALID")
        if kind == "key-tombstone":
            commitment, commitment_digest = J.readback("bundle-commitment")
            J.require(J.exact(record, {"version", "operationId", "phase", "hostId",
                "reconciliationHandle", "startupNonceSha256", "bundleCommitmentSha256",
                "terminalReceiptSha256", "atWallMs"}) and type(record["version"]) is int
                and record["version"] == 1 and record["operationId"] == J.OPERATION_ID
                and record["phase"] in ("CLOSED", "ABANDONED")
                and record["hostId"] == commitment["hostId"]
                and record["reconciliationHandle"] == J.HANDLE
                and record["startupNonceSha256"] == J.sha256(commitment["startupNonce"].encode())
                and record["bundleCommitmentSha256"] == commitment_digest
                and J.valid_hash(record["terminalReceiptSha256"])
                and type(record["atWallMs"]) is int
                and commitment["sealedAtWallMs"] < record["atWallMs"] <= (1 << 53) - 1,
                "TOMBSTONE_INVALID")
        else:
            parent = PARENTS.get(kind)
            if kind == "phase-unknown":
                candidates = [item for item in ORDER if _present(item)]
                J.require(bool(candidates), "UNKNOWN_PARENT_MISSING")
                parent = candidates[-1]
            expected = _record(kind, record.get("observation"), record.get("atWallMs"), parent)
            J.require(type(record.get("version")) is int and record == expected,
                      "LIFECYCLE_RECORD_INVALID")
            if kind in ("phase-abandoned", "phase-closed"):
                J.require(readback("key-tombstone")[0] == _tombstone(record, J.sha256(raw)),
                          "TOMBSTONE_BINDING_INVALID")
            if kind == "phase-abandoned":
                J.require(not any(_present(item) for item in ORDER[1:]), "ABANDONMENT_AFTER_ATTEMPT")
        return record, J.sha256(raw)
    except (OSError, ValueError, UnicodeDecodeError, KeyError, TypeError, Rejected) as exc:
        raise Rejected("LIFECYCLE_READBACK_UNKNOWN") from exc
    finally:
        J.close_custody(root, directory)


def _write_once(kind, record):
    J.require(kind in STATES or kind == "key-tombstone", "LIFECYCLE_KIND_INVALID")
    raw = J.canonical(record)
    J.require(0 < len(raw) <= J.MAX_BYTES, "LIFECYCLE_SIZE_INVALID")
    root, directory = J.opened_custody(False)
    try:
        fd = os.open(kind + ".json", os.O_WRONLY | os.O_CREAT | os.O_EXCL |
                     os.O_NOFOLLOW, 0o600, dir_fd=directory)
        try:
            view = memoryview(raw)
            while view:
                count = os.write(fd, view)
                J.require(count > 0, "LIFECYCLE_WRITE_UNKNOWN")
                view = view[count:]
            os.fsync(fd)
        finally:
            os.close(fd)
        os.fsync(directory)
    except (OSError, Rejected) as exc:
        raise Rejected("LIFECYCLE_CREATE_UNKNOWN") from exc
    finally:
        J.close_custody(root, directory)
    observed, digest = readback(kind)
    J.require(observed == record and digest == J.sha256(raw), "LIFECYCLE_READBACK_MISMATCH")
    return digest


def record_startup_observed(observation, at_wall_ms):
    _terminal_absent()
    J.require(not _present("phase-consumption"), "STARTUP_ORDER_INVALID")
    return _write_once("phase-startup", _record("phase-startup", observation,
                                               at_wall_ms, "phase-launch-attempt"))


def record_consumption_readback(observation, at_wall_ms):
    _terminal_absent()
    return _write_once("phase-consumption", _record("phase-consumption", observation,
                                                   at_wall_ms, "phase-startup"))


def _terminal(kind, observation, at_wall_ms, parent):
    J._fresh_claim.clear()  # No failed closure/abandonment path can admit a spawn.
    _terminal_absent()
    record = _record(kind, observation, at_wall_ms, parent)
    _write_once("key-tombstone", _tombstone(record, J.sha256(J.canonical(record))))
    return _write_once(kind, record)


def record_abandoned(observation, at_wall_ms):
    J._fresh_claim.clear()
    J.require(not any(_present(item) for item in ORDER[1:]), "ABANDONMENT_AFTER_ATTEMPT")
    return _terminal("phase-abandoned", observation, at_wall_ms, "phase-sealed")


def record_closed(observation, at_wall_ms):
    return _terminal("phase-closed", observation, at_wall_ms, "phase-consumption")


def record_unknown(observation, at_wall_ms):
    J._fresh_claim.clear()
    _terminal_absent()
    present = [item for item in ORDER if _present(item)]
    J.require(bool(present), "UNKNOWN_PARENT_MISSING")
    return _write_once("phase-unknown", _record("phase-unknown", observation,
                                               at_wall_ms, present[-1]))


def snapshot():
    """Readback disposition never grants spawn, replay, or release permission."""
    state = {"disposition": "UNKNOWN", "launchAllowed": False,
             "releaseAllowed": False, "retainInhibition": True,
             "launchMayHaveOccurred": True, "custodian": None}
    try:
        if _present("phase-unknown"):
            value, _ = readback("phase-unknown")
            state["custodian"] = value["observation"]["custodian"]
            return state
        terminal = [kind for kind in ("phase-closed", "phase-abandoned") if _present(kind)]
        J.require(len(terminal) <= 1, "CONFLICTING_TERMINALS")
        if terminal:
            record, _ = readback(terminal[0])
            state["disposition"] = record["phase"]
            state["launchMayHaveOccurred"] = record["phase"] != "ABANDONED"
            return state
        for kind in ORDER:
            if _present(kind):
                readback(kind)
        # Historical sealed state alone is not affirmative no-launch proof.
        return state
    except Rejected:
        return state
