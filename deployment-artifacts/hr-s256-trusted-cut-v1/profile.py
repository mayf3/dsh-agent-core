"""Fixed HR s256 DS profile candidate: offline shape and causality checks.

No DS action is registered here.  In particular, this module cannot turn
synthetic observations into a production proof or execute a Runtime launch.
The R2 protected-read, source closure and launcher integration remain gated.
"""

import hashlib
import json
import re


ACTION = "HR_S256_TRUSTED_QUIESCENCE_CUT_V1"
OPERATION_ID = "hr-s256-trusted-quiescence-cut-20260925-v1"
HANDLE = "turn:961534a5-8c94-487d-8e55-d324a54e821a:a2:g1:s256"
AGENT_ID = "agt_hr-agent"
TARGET_UNIT = "scheduler-whole-main"
TARGET_SERVICE = "system/ai.agent-core.runtime"
MAX_OUTPUT_BYTES = 65536
HASH = re.compile(r"^[a-f0-9]{64}$")


class Rejected(Exception):
    """A fail-closed local candidate rejection, never an execution receipt."""


def require(condition, reason):
    if not condition:
        raise Rejected(reason)


def sha_bytes(raw):
    return hashlib.sha256(raw).hexdigest()


def sha_json(value):
    # Matches JSON.stringify for the bounded ASCII fixture, but the deployed
    # record's exact digest must be computed by the installed JS validator.
    raw = json.dumps(value, separators=(",", ":"), ensure_ascii=False).encode()
    return sha_bytes(raw)


def valid_time(value):
    return type(value) is int and 0 <= value <= (1 << 53) - 1


def valid_hash(value):
    return isinstance(value, str) and HASH.fullmatch(value) is not None


def validate_request(request):
    require(type(request) is dict and set(request) == {"action", "operation_id"},
            "REQUEST_FIELDS_INVALID")
    require(request["action"] == ACTION and request["operation_id"] == OPERATION_ID,
            "FIXED_OPERATION_MISMATCH")
    return request


def validate_subject(record, proofs):
    """Offline predicate check only; a root profile must first obtain and validate bytes.

    Neither the record nor proofs may be accepted from a DS request.  The
    eventual DS path must use the pinned installed durable validator and
    independently verified deployment receipts before calling this helper.
    """
    require(type(record) is dict and type(proofs) is dict, "SUBJECT_UNKNOWN")
    require(record.get("handle") == HANDLE
            and record.get("reconciliationHandle") == HANDLE
            and record.get("turnExecutionId") == HANDLE, "SUBJECT_IDENTITY")
    require(record.get("agentId") == AGENT_ID
            and type(record.get("processGeneration")) is int
            and record["processGeneration"] > 0
            and isinstance(record.get("runtimeEpoch"), str)
            and record["runtimeEpoch"], "SUBJECT_TUPLE")
    require(record.get("state") == "blocked" and record.get("queryState") == "pending"
            and record.get("initialOutcome") == "outcome_unknown"
            and record.get("recoveryState") == "blocked"
            and record.get("failureReason") == "runtime_restart_ownership_unavailable"
            and record.get("terminationEvidence") is None
            and record.get("exitObservedAt") is None
            and record.get("fenceState") == "active", "SUBJECT_P1_P10")
    require(valid_time(record.get("createdAtWallMs"))
            and valid_time(record.get("updatedAt")), "SUBJECT_TIME")
    floor = proofs.get("floor")
    validator = proofs.get("validator")
    binary = proofs.get("rollback_floor_sha256")
    opened = proofs.get("window_opened_at_wall_ms")
    require(type(floor) is dict and type(validator) is dict
            and valid_hash(binary) and valid_time(opened), "DEPLOYMENT_PROOF_UNKNOWN")
    require(floor.get("status") == "ROUTER_RESTART_SAFETY=PROVEN"
            and floor.get("deployedBinarySha256") == binary
            and validator.get("evidenceKind") == "restart_quiescence_proven"
            and validator.get("deployedBinarySha256") == binary
            and valid_time(floor.get("provedAtWallMs"))
            and valid_time(validator.get("installedAtWallMs"))
            and floor["provedAtWallMs"] < opened
            and validator["installedAtWallMs"] < opened,
            "DEPLOYMENT_PREREQUISITE_INVALID")
    require(record["createdAtWallMs"] < opened and record["updatedAt"] < opened,
            "SUBJECT_AFTER_CUT")
    return {"reconciliationHandle": HANDLE, "turnExecutionId": HANDLE,
            "runtimeEpoch": record["runtimeEpoch"], "agentId": AGENT_ID,
            "processGeneration": record["processGeneration"],
            "subject_preimage_sha256": sha_json(record)}


def validate_census(ps_bytes, lsof_bytes, runtime_count, holder_count,
                    holder_paths, complete):
    """Check bounded normalized observations, not claims from an API client."""
    require(type(ps_bytes) is bytes and 0 < len(ps_bytes) <= MAX_OUTPUT_BYTES
            and type(lsof_bytes) is bytes and 0 < len(lsof_bytes) <= MAX_OUTPUT_BYTES,
            "CENSUS_OUTPUT_BOUND")
    require(complete is True and runtime_count == 0 and holder_count == 0,
            "CENSUS_NOT_ZERO_OR_INCOMPLETE")
    require(type(holder_paths) is list and 1 <= len(holder_paths) <= 16
            and len(set(holder_paths)) == len(holder_paths)
            and all(isinstance(path, str) and path.startswith("/")
                    and len(path) <= 512 for path in holder_paths), "HOLDER_PATH_UNKNOWN")
    return {"tools": ["ps", "lsof"],
            "outputsSha256": [sha_bytes(ps_bytes), sha_bytes(lsof_bytes)],
            "runtimeTreeProcessCount": 0}


def build_authorization(cut):
    """Shape an offline launch receipt from internally verified cut observations."""
    require(type(cut) is dict and cut.get("operationId") == OPERATION_ID
            and isinstance(cut.get("hostId"), str) and cut["hostId"]
            and isinstance(cut.get("startupNonce"), str)
            and 8 <= len(cut["startupNonce"]) <= 128
            and valid_hash(cut.get("consumingBinarySha256"))
            and valid_hash(cut.get("archiveSha256")),
            "LAUNCH_IDENTITY_INVALID")
    subject = cut.get("subject")
    census = cut.get("hostCensus")
    holders = cut.get("holderCheck")
    require(type(subject) is dict and subject.get("reconciliationHandle") == HANDLE
            and valid_hash(subject.get("subject_preimage_sha256"))
            and type(census) is dict and type(holders) is dict,
            "LAUNCH_OBSERVATION_UNKNOWN")
    require(cut.get("sourceClosureComplete") is True and cut.get("windowHeld") is True,
            "LAUNCH_WINDOW_OR_SOURCE_UNKNOWN")
    opened = cut.get("windowOpenedAtWallMs")
    inhibited = cut.get("launchSourcesInhibitedAtWallMs")
    quiesced = cut.get("oldTreeQuiescedAtWallMs")
    authorized = cut.get("authorizedStartupAtWallMs")
    ps_at = census.get("executedAtWallMs")
    lsof_at = holders.get("executedAtWallMs")
    require(all(valid_time(t) for t in (opened, inhibited, quiesced,
                                          ps_at, lsof_at, authorized))
            and opened < inhibited < quiesced <= ps_at < authorized
            and quiesced <= lsof_at < authorized,
            "LAUNCH_CAUSAL_ORDER_INVALID")
    require(census.get("runtimeTreeProcessCount") == 0
            and census.get("tools") == ["ps", "lsof"]
            and isinstance(census.get("outputsSha256"), list)
            and len(census["outputsSha256"]) == 2
            and all(valid_hash(d) for d in census["outputsSha256"])
            and holders.get("operationId") == OPERATION_ID
            and holders.get("method") == "lsof"
            and holders.get("openHolderCount") == 0,
            "LAUNCH_CENSUS_INVALID")
    return {"operationId": OPERATION_ID, "hostId": cut["hostId"],
            "startupNonce": cut["startupNonce"],
            "subject": {key: subject[key] for key in (
                "reconciliationHandle", "turnExecutionId", "runtimeEpoch",
                "agentId", "processGeneration")},
            "subjectPreimageSha256": subject["subject_preimage_sha256"],
            "consumingBinarySha256": cut["consumingBinarySha256"],
            "archiveSha256": cut["archiveSha256"],
            "outputsSha256": census["outputsSha256"],
            "holderCheck": holders,
            "authorizedStartupAtWallMs": authorized}


def production_entry(request):
    validate_request(request)
    raise Rejected("PROFILE_NOT_BOOTSTRAPPED")
