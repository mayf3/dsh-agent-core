"""Fixed R2 nonproduction control flow with a guarded partial fixed IO adapter.

Real DS production entry remains PROFILE_NOT_BOOTSTRAPPED. Installed finite
source/old-tree/custody/child observations remain explicit missing connections;
no disposable test observation can bootstrap production authority.
"""

import hashlib
import json
import os
import re
import secrets
import time


_custody = {}


def normalized_subject(projection):
    """Adapt only the existing closed projector representation, without fallback."""
    fields = {"reconciliationHandle", "turnExecutionId", "runtimeEpoch", "agentId",
              "processGeneration", "sessionId", "createdAtWallMs", "updatedAt",
              "subjectPreimageSha256"}
    HR_PROFILE.require(type(projection) is dict and set(projection) == fields
        and projection["reconciliationHandle"] == projection["turnExecutionId"] == HR_PROFILE.HANDLE
        and projection["agentId"] == HR_PROFILE.AGENT_ID
        and type(projection["processGeneration"]) is int and projection["processGeneration"] == 1
        and type(projection["runtimeEpoch"]) is str and bool(projection["runtimeEpoch"])
        and type(projection["sessionId"]) is str
        and HR_PROFILE.valid_time(projection["createdAtWallMs"])
        and HR_PROFILE.valid_time(projection["updatedAt"])
        and projection["updatedAt"] >= projection["createdAtWallMs"]
        and HR_PROFILE.valid_hash(projection["subjectPreimageSha256"]),
        "PROJECTION_IDENTITY")
    return {**{key: projection[key] for key in (
        "reconciliationHandle", "turnExecutionId", "runtimeEpoch", "agentId", "processGeneration")},
        "subject_preimage_sha256": projection["subjectPreimageSha256"]}


def canonical_fd_owned(fd):
    """Handler-only private capability check, never an input success assertion."""
    held = _custody.get("fixed-DS-owner")
    return held is not None and held["canonicalFd"] == fd


def record_terminal_unknown(reason):
    # Reuse existing fixed DS terminal/error receipt; no fabricated bundle fields.
    path = state_path("receipts")
    try:
        os.mkdir(path, 0o700)
    except FileExistsError:
        pass
    write_receipt(HR_PROFILE.OPERATION_ID, {"operation_id": HR_PROFILE.OPERATION_ID,
        "unit": HR_PROFILE.TARGET_UNIT, "status": "OUTCOME_UNKNOWN",
        "error": reason, "custodian": "fixed-DS-owner"})
    HR_PROFILE.require(read_receipt(HR_PROFILE.OPERATION_ID) == {
        "operation_id": HR_PROFILE.OPERATION_ID, "unit": HR_PROFILE.TARGET_UNIT,
        "status": "OUTCOME_UNKNOWN", "error": reason, "custodian": "fixed-DS-owner"},
        "TERMINAL_READBACK_UNKNOWN")


def fixed_io():
    return HR_FIXED_IO.FixedIO()


def run_installation(io):
    """Fixed private installation event; never a request/registry action.

    The installation handler already owns intent, window and inhibited stop.
    No input can select another target or reconstruct those capabilities.
    """
    if HR_MAINTENANCE.TRUSTED_INSTALLATION is None:
        return None  # Unqualified compiled configuration: before any IO.
    HR_PROFILE.require(type(io) is HR_FIXED_IO.FixedIO and type(io._owner) is HR_OWNED_STOP._Owner,
                       "PRIVATE_INSTALLATION_OWNER_REQUIRED")
    return _run_fixed({"action": HR_PROFILE.ACTION,
                      "operation_id": HR_PROFILE.OPERATION_ID}, io._owner.canonical, io)


def run_fixed(request, canonical_lock_fd):
    # The ordinary cut has no installation effect.
    return _run_fixed(request, canonical_lock_fd)


def _run_fixed(request, canonical_lock_fd, installation_io=None):
    HR_PROFILE.validate_request(request)
    if not TEST_MODE:
        HR_REAL_OS.require_activation()
        HR_PROFILE.require(os.geteuid() == 0, "ROOT_REQUIRED")
    io = HR_ONE_SHOT.fixed_io() if installation_io is None else installation_io
    deadline = io._operation_deadline if type(io) is HR_FIXED_IO.FixedIO else time.monotonic() + 300
    window = None if installation_io is None else io._window
    child = None if installation_io is None else io._child
    sealed = False
    intent = installation_io is not None
    handoff = None
    last_ownership = None
    stop_owner = None if installation_io is None else io._owner

    def boundary():
        nonlocal last_ownership
        HR_PROFILE.require(time.monotonic() < deadline, "OPERATION_DEADLINE")
        if stop_owner is not None:
            stop_owner.check()
        observed = io.observe_custody(canonical_lock_fd, window, child)
        HR_LIFECYCLE._ownership(observed, child is not None)
        lock_meta = os.fstat(canonical_lock_fd)
        HR_PROFILE.require(observed["canonicalLockIdentity"] ==
            [lock_meta.st_dev, lock_meta.st_ino], "CANONICAL_LOCK_CHANGED")
        HR_PROFILE.require(observed["windowIdentity"] ==
            HR_HANDOFF.window_identity(window), "WINDOW_CHANGED")
        if last_ownership is not None:
            fixed = HR_LIFECYCLE.OWNERSHIP_FIELDS - {"ownedChild"}
            HR_PROFILE.require(all(observed[key] == last_ownership[key] for key in fixed),
                               "CUSTODY_CONTINUITY_UNKNOWN")
        last_ownership = observed
        return observed

    try:
        HR_PROFILE.require(not receipt_exists(HR_PROFILE.OPERATION_ID),
                           "OPERATION_ALREADY_TERMINAL")
        if installation_io is not None:
            # Genuine retained capabilities, not a second lock/window/stop attempt.
            HR_PROFILE.require(time.monotonic() < deadline, "OPERATION_DEADLINE")
            io._active()
            stop_owner.check()
            HR_PROFILE.require(io._child is None and not io._launched
                and io._stop is not None and io._stop._owner is stop_owner
                and io._window == stop_owner.window and io._intent == stop_owner.intent_digest
                and type(io._nonce) is str
                and hashlib.sha256(io._nonce.encode()).hexdigest() == stop_owner.intent['nonceSha256'],
                "PRIVATE_INSTALLATION_INTENT_UNBOUND")
            raw = HR_REAL_OS.protected_bytes(HR_REAL_OS.Path(STATE_ROOT) /
                HR_JOURNAL.DIRECTORY / 'launch-sources-inhibited.json')
            observed = json.loads(raw, object_pairs_hook=HR_REAL_OS.unique_object)
            HR_PROFILE.require(hashlib.sha256(raw).hexdigest() ==
                io._receipts.get('launch-sources-inhibited')
                and type(observed) is dict and set(observed) ==
                    {'operationId', 'hostId', 'startupNonce', 'atWallMs', 'complete'}
                and observed['operationId'] == HR_PROFILE.OPERATION_ID
                and observed['hostId'] == io._package['hostId']
                and observed['startupNonce'] == io._nonce and observed['complete'] is True
                and HR_PROFILE.valid_time(observed['atWallMs'])
                and stop_owner.opened_at < observed['atWallMs'], 'PRIVATE_INHIBITION_UNBOUND')
            inhibited_at = observed['atWallMs']
            HR_MAINTENANCE.promote_waiting(io)
        # Current installed projection/inventory is freshly validated after promotion.
        projection = HR_PROJECTION.fixed_subject_projection()
        subject = normalized_subject(projection)
        prerequisites = io.preflight(projection)
        if installation_io is None:
            nonce = secrets.token_hex(32)
            HR_JOURNAL.seal_intent(nonce, subject["subject_preimage_sha256"], io.wall_ms())
            intent = True
            if type(io) is HR_FIXED_IO.FixedIO:
                io.bind_intent_nonce(nonce)
            window, opened_at = io.open_fixed_window()
            stop_owner = HR_OWNED_STOP.capture_from_handler(canonical_lock_fd, window, opened_at)
            if type(io) is HR_FIXED_IO.FixedIO:
                io.attach_owned_stop(stop_owner)
            inhibited_at = io.inhibit_fixed_sources()
        else:
            nonce, opened_at = io._nonce, stop_owner.opened_at
            HR_PROFILE.require(stop_owner.intent['subjectPreimageSha256'] ==
                subject['subject_preimage_sha256'], "PRIVATE_INSTALLATION_SUBJECT_CHANGED")
        quiesced_at = io.quiesce_fixed_tree()
        boundary()
        census = HR_COLLECTOR.collect_whole_host(prerequisites["oldPids"],
                                               prerequisites["holderPaths"])
        boundary()
        archive = HR_ARCHIVE.seal_census(prerequisites["hostId"], census,
                                        prerequisites["holderPaths"], quiesced_at)
        boundary()
        authorization = HR_PROFILE.build_authorization({
            "operationId": HR_PROFILE.OPERATION_ID,
            "hostId": prerequisites["hostId"], "startupNonce": nonce,
            "subject": subject, "consumingBinarySha256": prerequisites["binarySha256"],
            "archiveSha256": archive["archiveSha256"],
            "windowOpenedAtWallMs": opened_at,
            "launchSourcesInhibitedAtWallMs": inhibited_at,
            "oldTreeQuiescedAtWallMs": quiesced_at,
            "hostCensus": archive["hostCensus"], "holderCheck": archive["holderCheck"],
            "authorizedStartupAtWallMs": io.wall_ms(),
            "sourceClosureComplete": HR_PROFILE.validate_entry_closure(
                *io.observed_entry_closure()), "windowHeld": True})
        boundary()
        authorization_digest = HR_JOURNAL.seal_launch_authorization(authorization)
        final_bytes = io.final_bundle_bytes(authorization, authorization_digest, archive,
                                           opened_at, quiesced_at)
        boundary()
        HR_JOURNAL.seal_bundle_commitment(final_bytes, io.wall_ms())
        sealed = True
        boundary()
        if installation_io is not None:
            HR_MAINTENANCE.handoff_waiting(io)
            boundary()  # Original operation bound/capability after fallible installation readback.
        HR_JOURNAL.claim_one_launch(io.wall_ms())  # Persist before any possible child.
        boundary()
        handoff = HR_HANDOFF.OneLaunchHandoff(authorization_digest, window, nonce)
        challenge_fd, window_fd = handoff.take_child_fds()
        child = io.launch_fixed(challenge_fd, window_fd, authorization_digest)
        handoff.close_child_fds()
        challenge_digest = handoff.challenge()  # Absolute 750ms and same-OFD check.
        if type(io) is HR_FIXED_IO.FixedIO:
            io.attach_authenticated_handoff(handoff, challenge_digest)
        ownership = boundary()
        startup = io.startup_observation(child, authorization_digest)
        startup["ownership"] = ownership
        HR_LIFECYCLE.record_startup_observed(startup, io.wall_ms())
        boundary()
        consumption = io.exact_consumption_readback(child)
        consumption["ownership"] = boundary()
        HR_LIFECYCLE.record_consumption_readback(consumption, io.wall_ms())
        disposition = io.verified_disposition(child)
        disposition["ownership"] = boundary()
        HR_LIFECYCLE.record_closed(disposition, io.wall_ms())
        # Only a CLOSED receipt/readback permits the fixed IO owner to release.
        HR_PROFILE.require(HR_LIFECYCLE.snapshot()["disposition"] == "CLOSED",
                           "CLOSURE_READBACK_UNKNOWN")
        io.release_verified(window, canonical_lock_fd)
        stop_owner.close()
        result = {"ok": True, "disposition": "CLOSED", "nonproduction": True}
        if type(io) is HR_FIXED_IO.FixedIO:
            result["runtime"] = dict(io._runtime_admission)  # Separate readonly H5 output, never durable proof.
        return result
    except Exception as exc:
        # No retries, later positive restoration, release, or fence reconstruction.
        recorded = False
        reason = str(exc)
        if re.fullmatch(r"[A-Z][A-Z0-9_]{0,63}", reason) is None:
            reason = "OBSERVATION_UNAVAILABLE"
        if intent:
            # Transfer the actual owned FD before any fallible ACK/journal call.
            _custody["fixed-DS-owner"] = {"canonicalFd": canonical_lock_fd,
                "windowFd": window, "child": child, "io": io, "stopOwner": stop_owner,
                "activeDeadlineMonotonic": deadline}
            try:
                record_terminal_unknown(reason)
                io.retain_unknown(window, child)
            except Exception:
                pass  # Retention is capability based even when durable ACK is lost.
        if sealed:
            ownership = last_ownership
            if ownership is not None:
                known_child = io._child_identity if type(io) is HR_FIXED_IO.FixedIO else None
                ownership = {**ownership, "ownedChild": known_child,
                    "windowHeld": None, "canonicalLockHeld": None,
                    "sourcesInhibited": None}
                try:
                    HR_LIFECYCLE.record_unknown({"ownership": ownership,
                        "custodian": "fixed-DS-owner",
                        "dispositionDeadlineWallMs": io.wall_ms() + 300000,
                        "reason": "CUSTODY_CONTINUITY_UNKNOWN"}, io.wall_ms())
                    recorded = True
                except Exception:
                    pass  # Actual durable state is retained, never asserted CLOSED.
        return {"ok": False, "error": reason, "disposition": "UNKNOWN" if intent else
                "PRECHECK_REJECTED", "unknownReceiptWritten": recorded,
                "nonproduction": True}
    finally:
        if handoff is not None:
            handoff.close()  # Duplicates only; original custody stays with fixed IO.
