"""Guarded fixed R2 protected-input/readback methods, not installed activation.

No environment variable or DS request can enable this adapter. The exact
reviewed bootstrap package digest is deliberately unset in this candidate.
Tests patch OS boundaries and use disposable bytes; no live method is invoked.
"""

import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import stat
import subprocess
import selectors
import time


OPERATION_ID = "hr-s256-trusted-quiescence-cut-20260925-v1"
HANDLE = "turn:961534a5-8c94-487d-8e55-d324a54e821a:a2:g1:s256"
BOOTSTRAP_PACKAGE_SHA256 = None
BOOTSTRAP_FILE = Path("/private/var/db/agent-deploy-system-config/hr-s256-one-shot-authority.json")
PRODUCTION_ROOT = Path("/Users/authsvc/.agent-core")
APP_ROOT = Path("/usr/local/libexec/agent-core/app")
NODE = "/usr/local/libexec/agent-core/node-runtime/bin/node"
DEPLOYMENT_DIR = Path("/private/var/db/agent-deploy-system/hr-s256-deployment-proof")
MAX_JSON_BYTES = 65536


class Rejected(Exception):
    pass


def require(ok, reason):
    if not ok:
        raise Rejected(reason)


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, "PROTECTED_JSON_DUPLICATE_KEY")
        result[key] = value
    return result


def protected_bytes(path, uid=0, limit=MAX_JSON_BYTES):
    """Internal fixed-path reader, no-follow through every parent component."""
    parts = PurePosixPath(path).parts
    require(parts[0] == "/", "FIXED_PATH_INVALID")
    parents = []
    fd = None
    try:
        parent = os.open("/", os.O_RDONLY | os.O_DIRECTORY)
        parents.append(parent)
        for part in parts[1:-1]:
            parent = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW,
                             dir_fd=parent)
            parents.append(parent)
        fd = os.open(parts[-1], os.O_RDONLY | os.O_NOFOLLOW, dir_fd=parent)
        before = os.fstat(fd)
        require(stat.S_ISREG(before.st_mode) and before.st_uid == uid
                and not (before.st_mode & 0o022) and 0 < before.st_size <= limit,
                "PROTECTED_INPUT_CUSTODY")
        raw = bytearray()
        while len(raw) <= limit:
            block = os.read(fd, min(65536, limit + 1 - len(raw)))
            if not block:
                break
            raw.extend(block)
        after = os.fstat(fd)
        key = lambda m: (m.st_dev, m.st_ino, m.st_mode, m.st_uid, m.st_size,
                         m.st_mtime_ns, m.st_ctime_ns)
        require(len(raw) == before.st_size and key(before) == key(after),
                "PROTECTED_INPUT_CHANGED")
        fresh = os.stat(parts[-1], dir_fd=parent, follow_symlinks=False)
        require(key(fresh) == key(before), "PROTECTED_INPUT_CHANGED")
        return bytes(raw)
    except OSError as exc:
        raise Rejected("PROTECTED_INPUT_UNAVAILABLE") from exc
    finally:
        if fd is not None:
            os.close(fd)
        for parent in reversed(parents):
            os.close(parent)


def protected_json(path, expected_sha256, uid=0):
    raw = protected_bytes(path, uid)
    require(type(expected_sha256) is str and len(expected_sha256) == 64
            and digest(raw) == expected_sha256, "PROTECTED_INPUT_DIGEST")
    try:
        return json.loads(raw, object_pairs_hook=unique_object)
    except (ValueError, UnicodeDecodeError) as exc:
        raise Rejected("PROTECTED_JSON_INVALID") from exc


def require_activation():
    # Check before protected IO. Bootstrap/install/run remain separately forbidden.
    require(type(BOOTSTRAP_PACKAGE_SHA256) is str
            and len(BOOTSTRAP_PACKAGE_SHA256) == 64, "PROFILE_NOT_BOOTSTRAPPED")
    require(os.geteuid() == 0, "ROOT_REQUIRED")
    package = protected_json(BOOTSTRAP_FILE, BOOTSTRAP_PACKAGE_SHA256)
    require(type(package) is dict and package.get("operationId") == OPERATION_ID,
            "FIXED_OPERATION_MISMATCH")
    return package


def deployed_prerequisites(package, opened_at):
    """Verify existing pinned root receipts before any prospective stop/producer."""
    require(package == require_activation(), "ACTIVATION_PACKAGE_CHANGED")
    require(type(package) is dict and set(package) == {
        "operationId", "hostId", "consumingBinarySha256", "floorProvenReceiptSha256",
        "validatorInstalledReceiptSha256", "rollbackCaptureOperationId",
        "expectedRegistrySha256"},
        "DEPLOYMENT_PACKAGE_UNKNOWN")
    binary = package["consumingBinarySha256"]
    floor = protected_json(DEPLOYMENT_DIR / "floor-proven.json",
                           package["floorProvenReceiptSha256"])
    validator = protected_json(DEPLOYMENT_DIR / "validator-installed.json",
                               package["validatorInstalledReceiptSha256"])
    times = (floor.get("provedAtWallMs"), validator.get("installedAtWallMs"), opened_at)
    require(all(type(at) is int and 0 <= at <= (1 << 53) - 1 for at in times),
            "DEPLOYMENT_TIME_UNKNOWN")
    require(package["operationId"] == OPERATION_ID
            and type(binary) is str and len(binary) == 64
            and floor.get("status") == "ROUTER_RESTART_SAFETY=PROVEN"
            and floor.get("floorCommit") == "2097e4f9"
            and floor.get("deployedBinarySha256") == binary
            and validator.get("deployedBinarySha256") == binary
            and validator.get("evidenceKind") == "restart_quiescence_proven"
            and times[0] < opened_at and times[1] < opened_at,
            "DEPLOYMENT_PREREQUISITE_UNKNOWN")
    # Reuse v5's existing capture pointer/proof/admission verifier, read-only.
    # No admit/probe/deploy/rollback effect is called here.
    registry, registry_sha = load_registry()
    require(registry_sha == package["expectedRegistrySha256"], "REGISTRY_CHANGED")
    unit = unit_from_registry(registry, "scheduler-whole-main")
    require(unit["target"] == str(APP_ROOT) and unit["uid"] == 505 and unit["gid"] == 601,
            "FIXED_TARGET_UNKNOWN")
    _, capture = _verified_admitted_capture(package["rollbackCaptureOperationId"],
        registry_sha, str(APP_ROOT), check_live=True)
    require(capture["closure_sha256"] == binary, "ROLLBACK_FLOOR_UNKNOWN")
    return {"floor": floor, "validator": validator, "rollbackCapture": capture}


def bounded_validator_output(script, fd):
    """Fixed installed node/UID/FD read-only probe, bounded while reading."""
    child = subprocess.Popen([NODE, "--input-type=module", "-e", script, f"/dev/fd/{fd}"],
        pass_fds=(fd,), stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL, env={"PATH": "/usr/bin:/bin"},
        user=505, group=601, extra_groups=[])
    raw = bytearray()
    deadline = time.monotonic() + 15
    try:
        with selectors.DefaultSelector() as selector:
            selector.register(child.stdout, selectors.EVENT_READ)
            while selector.get_map():
                remaining = deadline - time.monotonic()
                require(remaining > 0 and selector.select(remaining), "READBACK_TIMEOUT")
                block = os.read(child.stdout.fileno(), 1025 - len(raw))
                if not block:
                    selector.unregister(child.stdout)
                else:
                    raw.extend(block)
                    require(len(raw) <= 1024, "READBACK_OUTPUT_BOUND")
        remaining = deadline - time.monotonic()
        require(remaining > 0 and child.wait(timeout=remaining) == 0 and raw,
                "SETTLEMENT_READBACK_UNKNOWN")
        return bytes(raw)
    finally:
        if child.poll() is None:
            child.kill()
        child.wait()
        child.stdout.close()


def installed_settlement_projection(projection_module, helper_source, expected_helper_sha256):
    """Read actual V3 store via the existing fixed FD/pinned validator, never edit it."""
    package = require_activation()
    require(digest(helper_source.encode()) == expected_helper_sha256,
            "READBACK_HELPER_DIGEST")
    before_sources = projection_module.pinned_validator_sources()
    fd, before = projection_module.opened_fixed_store()
    try:
        before_digest = projection_module.digest_fd(fd, before.st_size)
        script = helper_source.replace("../../../packages/", (APP_ROOT / "packages").as_uri() + "/")
        script += "\nprocess.stdout.write(JSON.stringify(readSettlement(process.argv[1]))+'\\n');\n"
        os.lseek(fd, 0, os.SEEK_SET)
        projection = json.loads(bounded_validator_output(script, fd), object_pairs_hook=unique_object)
        require(type(projection) is dict and set(projection) == {"settlement", "subject"}
                and projection["settlement"] == {"reconciliationHandle": HANDLE,
                    "queryState": "settled", "fenceState": "cleared",
                    "initialOutcome": "outcome_unknown",
                    "terminationEvidence": "restart_quiescence_proven"},
                "SETTLEMENT_READBACK_UNKNOWN")
        committed = HR_JOURNAL.readback("bundle-commitment")[0]["subject"]
        observed = projection["subject"]
        fields = {"turnExecutionId", "runtimeEpoch", "agentId", "processGeneration"}
        require(type(committed) is dict and set(committed) == fields
                and type(observed) is dict and set(observed) == fields | {"reconciliationHandle"}
                and observed["reconciliationHandle"] == observed["turnExecutionId"] == HANDLE
                and type(observed["processGeneration"]) is int
                and {key: observed[key] for key in fields} == committed,
                "READBACK_SUBJECT_MISMATCH")
        require(projection_module.identity(os.fstat(fd)) == projection_module.identity(before)
                and projection_module.digest_fd(fd, before.st_size) == before_digest
                and projection_module.pinned_validator_sources() == before_sources,
                "READBACK_CHANGED")
        fresh_fd, fresh_meta = projection_module.opened_fixed_store()
        try:
            require(projection_module.identity(fresh_meta) == projection_module.identity(before)
                    and projection_module.digest_fd(fresh_fd, before.st_size) == before_digest,
                    "READBACK_CHANGED")
        finally:
            os.close(fresh_fd)
        return {"validatedStoreSha256": before_digest, "subject": projection["subject"],
                "settlement": projection["settlement"],
                "validatorBinarySha256": package["consumingBinarySha256"]}
    except (OSError, ValueError, subprocess.TimeoutExpired) as exc:
        raise Rejected("SETTLEMENT_READBACK_UNKNOWN") from exc
    finally:
        os.close(fd)


def fixed_settlement_readback():
    """Zero-argument fixed owner method; no caller path, helper or subject selector."""
    observation = installed_settlement_projection(HR_PROJECTION,
        HR_READBACK_HELPER_SOURCE, HR_READBACK_HELPER_SHA256)
    record = {"version": 1, "operationId": OPERATION_ID,
        "subject": observation["subject"], "validatedStoreSha256": observation["validatedStoreSha256"],
        "validatorBinarySha256": observation["validatorBinarySha256"],
        "settlement": observation["settlement"], "atWallMs": time.time_ns() // 1_000_000}
    raw = HR_JOURNAL.canonical(record)
    root, directory = HR_JOURNAL.opened_custody(False)
    fd = None
    try:
        fd = os.open("store-readback.json", os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
                     0o600, dir_fd=directory)
        os.fchmod(fd, 0o600)
        remaining = memoryview(raw)
        while remaining:
            size = os.write(fd, remaining)
            require(size > 0, "READBACK_RECEIPT_WRITE_UNKNOWN")
            remaining = remaining[size:]
        os.fsync(fd)
        os.close(fd)
        fd = None
        os.fsync(directory)
        # No-follow readback, same exact bytes, no placeholder receipt digest.
        observed = protected_bytes(Path(STATE_ROOT) /
            HR_JOURNAL.DIRECTORY / "store-readback.json")
        require(observed == raw, "READBACK_RECEIPT_CHANGED")
        return {"validatedStoreSha256": observation["validatedStoreSha256"],
            "validatorBinarySha256": observation["validatorBinarySha256"],
            "settlement": observation["settlement"],
            "storeReadbackReceiptSha256": digest(raw)}
    except OSError as exc:
        raise Rejected("READBACK_RECEIPT_UNKNOWN") from exc
    finally:
        if fd is not None:
            os.close(fd)
        os.close(directory)
        os.close(root)


def observe_no_runtime_uid_before_launch():
    """Fixed post-stop observation; never a continuous or complete source proof."""
    require_activation()  # Refuse before spawning any protected read probe.
    try:
        raw = HR_COLLECTOR.command_output(HR_COLLECTOR.PS_COMMAND)
        require(type(raw) is bytes and 0 < len(raw) <= HR_COLLECTOR.MAX_OUTPUT_BYTES
                and raw.endswith(b"\n"), "RUNTIME_UID_CENSUS_UNKNOWN")
        scanned, _ = HR_COLLECTOR.parse_ps(raw, set())
        uid_count = sum(int(HR_COLLECTOR.PS_ROW.fullmatch(row).group(3)) == 505
                        for row in raw.splitlines())
        require(uid_count == 0, "RUNTIME_UID_ACTOR_PRESENT")
        return {"scannedProcessCount": scanned, "runtimeUidProcessCount": 0,
                "outputSha256": digest(raw), "observedAtWallMs": time.time_ns() // 1_000_000}
    except HR_COLLECTOR.Rejected as exc:
        raise Rejected("RUNTIME_UID_CENSUS_UNKNOWN") from exc

# R2 explicitly permits an exact reviewed bootstrap source manifest. This is
# the SAME root bootstrap publisher/authority, not DS request data or a PASS
# flag. No manifest is installed or authorized by this candidate.
SOURCE_SCOPE_SHA256 = None
SOURCE_SCOPE_FILE = Path('/private/var/db/agent-deploy-system-config/hr-s256-source-scope.json')


def qualified_source_scope():
    package = require_activation()
    require(type(SOURCE_SCOPE_SHA256) is str and len(SOURCE_SCOPE_SHA256) == 64,
            'SOURCE_SCOPE_NOT_BOOTSTRAPPED')  # Before protected read.
    scope = protected_json(SOURCE_SCOPE_FILE, SOURCE_SCOPE_SHA256)
    require(type(scope) is dict and set(scope) == {'version', 'operationId', 'hostId',
            'entryManifest', 'sources'} and type(scope['version']) is int and scope['version'] == 1
            and scope['operationId'] == OPERATION_ID and scope['hostId'] == package['hostId'],
            'SOURCE_CLOSURE_UNKNOWN')
    gated = 'packages/production-runtime/src/native-arm64/hr-s256-r2-gated-runtime.mjs'
    require(type(scope['sources']) is list and len(scope['sources']) == 4
            and sorted(scope['sources']) == sorted(['fixed-DS-owner',
                'gui/505/ai.agent-core.runtime', 'system/ai.agent-core.runtime', gated]),
            'SOURCE_CLOSURE_UNKNOWN')
    HR_PROFILE.validate_entry_closure(scope['entryManifest'],
        [value for value in scope['sources'] if value != 'fixed-DS-owner'])
    # The pinned, reviewed bootstrap manifest is a qualified finite coverage
    # input. Known MF1 tuples or UID-zero observations alone do not supply it.
    # Current identity/mutable-input checks remain the installed inventory's job.
    return scope


def old_runtime_membership():
    """Read-only membership, never process ownership or permission to signal.

    Only the fixed system launchd root and its observed descendants are
    eligible. An unrelated Runtime-UID resident rejects before the cut.
    """
    require_activation()
    import re
    service = HR_COLLECTOR.command_output(
        ['/bin/launchctl', 'print', 'system/ai.agent-core.runtime'])
    pids = re.findall(rb'^\s*pid = ([1-9][0-9]*)\s*$', service, re.MULTILINE)
    require(len(pids) == 1, 'OLD_TREE_ROOT_UNKNOWN')
    root_pid = int(pids[0])
    raw = HR_COLLECTOR.command_output(HR_COLLECTOR.PS_COMMAND)
    require(raw.endswith(b'\n'), 'OLD_TREE_OBSERVATION_UNKNOWN')
    HR_COLLECTOR.parse_ps(raw, set())  # Reject incomplete/duplicate rows first.
    rows = {int(match.group(1)): (int(match.group(2)), int(match.group(3)))
            for match in (HR_COLLECTOR.PS_ROW.fullmatch(row) for row in raw.splitlines())}
    require(root_pid in rows and rows[root_pid][1] == 505, 'OLD_TREE_ROOT_UNKNOWN')
    tree = {root_pid}
    while True:
        grown = tree | {pid for pid, (parent, _) in rows.items() if parent in tree}
        if grown == tree:
            break
        tree = grown
    require(all(uid != 505 or pid in tree for pid, (_, uid) in rows.items()),
            'UNOWNED_RUNTIME_UID_RESIDENT')
    return tree


def observe_owned_runtime_residents(child):
    """Point observation joined to an internally created child capability.

    The finite source inhibition remains a separate required authority. This
    observation cannot authorize launch or turn a caller PID into ownership.
    """
    require_activation()
    require(child is not None and child.poll() is None, 'OWNED_STARTUP_LOST')
    raw = HR_COLLECTOR.command_output(HR_COLLECTOR.PS_COMMAND)
    require(raw.endswith(b'\n'), 'RUNTIME_UID_CENSUS_UNKNOWN')
    HR_COLLECTOR.parse_ps(raw, set())
    rows = {int(match.group(1)): (int(match.group(2)), int(match.group(3)))
            for match in (HR_COLLECTOR.PS_ROW.fullmatch(row) for row in raw.splitlines())}
    require(child.pid in rows and rows[child.pid][1] == 505, 'OWNED_STARTUP_LOST')
    tree = {child.pid}
    while True:
        grown = tree | {pid for pid, (parent, _) in rows.items() if parent in tree}
        if grown == tree:
            break
        tree = grown
    require(all(uid != 505 or pid in tree for pid, (_, uid) in rows.items()),
            'UNOWNED_RUNTIME_UID_RESIDENT')
    require(child.poll() is None, 'OWNED_STARTUP_LOST')
