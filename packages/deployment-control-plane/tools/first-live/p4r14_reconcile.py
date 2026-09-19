"""Exact P4R14R2 retained-state preservation for one reviewed recovery successor."""
if __name__ == "__main__":
    raise SystemExit("imported only by the exact reviewed first-live operator")

from bind_records import _object
import json
from first_live_io import digest, require
import first_live_package as layout


P4R14_PACKAGE = "43d3a4661f768d9bdfd32349e8aa87c11a9ae1a7cf22a9f20895beb0df00d68d"
P4R14_EXECUTION = "first-live-dsh-20260918-01-p4r13-successor"


def _directory(io, path, expected, code="P4R14_DIRECTORY_BINDING"):
    value = io.metadata(path)
    require(value["type"] == "Directory", code + ":type")
    for key in ("uid", "gid", "mode", "flags", "device", "inode"):
        if key in expected:
            require(value[key] == expected[key], code + ":" + key)
    if "names" in expected:
        require(io.call(["/bin/ls", "-1A", path]).decode().splitlines() == expected["names"],
                code + ":names")
    return value


def _protected(io, path, spec, code="P4R14_PROTECTED"):
    before = io.expect(path, spec)
    raw = io.call(["/bin/cat", path], expected_digest=spec["sha256"])
    require(io.metadata(path) == before, code + ":changed")
    return raw


def _write_record(io, path, value):
    raw = json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()
    io.copy(raw, digest(raw), "0400", path)


def reconcile(io, raw):
    record = _object(raw, 8 * 1024 * 1024)
    require(set(record) == {
        "version", "state", "operation_id", "execution_id", "package_sha256",
        "operation_directory", "operation_files", "maintenance_directory",
        "first_live_pending", "packet_directory", "packet_names", "payload_names",
        "staging_files", "installed_files", "socket_directory", "legacy_ancestor",
        "legacy_locks", "sudoers_retirement", "retry_forbidden"
    }, "P4R14_RECONCILIATION_SHAPE")
    require(record["version"] == 1 and record["state"] == "P4R14R2_RETAINED_SAFE_STOP"
            and record["operation_id"] == layout.OPERATION
            and record["execution_id"] == P4R14_EXECUTION
            and record["package_sha256"] == P4R14_PACKAGE
            and record["retry_forbidden"] is True,
            "P4R14_RECONCILIATION_BINDING")

    # The separately reviewed prerequisite must be complete before history moves.
    sudoers = record["sudoers_retirement"]
    require(set(sudoers) == {"journal_directory", "completion", "archives", "active_absent"}
            and sudoers["active_absent"] == list(layout.LEGACY_SUDOERS_NAMES),
            "SUDOERS_RETIREMENT_BINDING")
    _directory(io, layout.SUDOERS_RETIREMENT, sudoers["journal_directory"], "SUDOERS_JOURNAL")
    _protected(io, layout.SUDOERS_RETIREMENT + "/retirement-complete.json",
               sudoers["completion"], "SUDOERS_COMPLETION")
    for name in layout.LEGACY_SUDOERS_NAMES:
        require(io.metadata(layout.SUDOERS_ACTIVE + "/" + name, absent=True) is None,
                "LEGACY_SUDOERS_STILL_ACTIVE")
        _protected(io, layout.SUDOERS_RETIREMENT + "/preimages/" + name,
                   sudoers["archives"][name], "SUDOERS_ARCHIVE")

    for path in (layout.P4R14_OPERATION_ARCHIVE, layout.P4R14_PACKET_ARCHIVE,
                 layout.P4R14_PENDING_ARCHIVE, layout.P4R15_RECONCILIATION):
        require(io.metadata(path, absent=True) is None, "P4R14_ARCHIVE_ALREADY_PRESENT")

    _directory(io, layout.ROOT + "/first-live-operation", record["operation_directory"])
    require(set(record["operation_files"]) == set(record["operation_directory"]["names"])
            - {"first-live-maintenance-0-0"}, "P4R14_OPERATION_FILE_SET")
    for name, spec in record["operation_files"].items():
        _protected(io, layout.ROOT + "/first-live-operation/" + name, spec)
    _directory(io, layout.ROOT + "/first-live-operation/first-live-maintenance-0-0",
               record["maintenance_directory"], "P4R14_MAINTENANCE")
    require(record["maintenance_directory"]["names"] == [], "P4R14_MAINTENANCE_NOT_EMPTY")
    _protected(io, layout.ROOT + "/first-live-pending.json", record["first_live_pending"])

    ancestor = _directory(io, layout.LEGACY_ANCESTOR, record["legacy_ancestor"],
                          "P4R14_ANCESTOR")
    require(ancestor["flags"] == 0x0002_0000, "P4R14_FENCE_NOT_RETAINED")
    require(set(record["legacy_locks"]) == {layout.LEGACY_DEPLOY_LOCK, layout.LEGACY_TRANSACTION_LOCK},
            "P4R14_LOCK_SET")
    for path, value in record["legacy_locks"].items():
        _directory(io, path, value["directory"], "P4R14_LOCK_DIRECTORY")
        require(value["directory"]["names"] == [value["holder_name"]], "P4R14_LOCK_CONTENTS")
        _protected(io, path + "/" + value["holder_name"], value["holder"], "P4R14_LOCK_HOLDER")

    _directory(io, layout.PACKET, record["packet_directory"])
    require(io.call(["/bin/ls", "-1A", layout.PACKET]).decode().splitlines() == record["packet_names"],
            "P4R14_PACKET_SHAPE")
    require(io.call(["/bin/ls", "-1A", layout.PACKET + "/payloads"]).decode().splitlines()
            == record["payload_names"], "P4R14_PAYLOAD_SHAPE")
    for relative, spec in record["staging_files"].items():
        _protected(io, layout.PACKET + "/" + relative, spec)
    require(set(record["installed_files"]) == {"agent-deployd", "agent-deploy-issuer", "agent-deployctl"},
            "P4R14_INSTALLED_SET")
    for name, spec in record["installed_files"].items():
        _protected(io, layout.CODE + "/" + name, spec)
    _directory(io, layout.SOCKET, record["socket_directory"], "P4R14_SOCKET")
    require(record["socket_directory"]["names"] == [], "P4R14_SOCKET_NOT_EMPTY")

    io.call(["/bin/mkdir", "-m", "0700", layout.P4R15_RECONCILIATION])
    intent = {"version": 1, "operation_id": layout.OPERATION,
              "predecessor_execution_id": P4R14_EXECUTION,
              "predecessor_package_sha256": P4R14_PACKAGE,
              "record_sha256": digest(raw), "state": "RECONCILIATION_INTENT"}
    _write_record(io, layout.P4R15_RECONCILIATION + "/intent.json", intent)
    io.call(["/bin/mv", layout.ROOT + "/first-live-pending.json", layout.P4R14_PENDING_ARCHIVE])
    _write_record(io, layout.P4R15_RECONCILIATION + "/pending-archive-result.json",
                  {**intent, "state": "PENDING_ARCHIVED"})
    io.call(["/bin/mv", layout.ROOT + "/first-live-operation", layout.P4R14_OPERATION_ARCHIVE])
    _write_record(io, layout.P4R15_RECONCILIATION + "/operation-archive-result.json",
                  {**intent, "state": "OPERATION_ARCHIVED"})
    io.call(["/bin/mv", layout.PACKET, layout.P4R14_PACKET_ARCHIVE])
    _write_record(io, layout.P4R15_RECONCILIATION + "/packet-archive-result.json",
                  {**intent, "state": "PACKET_ARCHIVED"})
    io.call(["/bin/sync"])

    for path in (layout.ROOT + "/first-live-pending.json", layout.ROOT + "/first-live-operation", layout.PACKET):
        require(io.metadata(path, absent=True) is None, "P4R14_ACTIVE_PATH_RETAINED")
    _directory(io, layout.P4R14_OPERATION_ARCHIVE, record["operation_directory"], "P4R14_OPERATION_ARCHIVE")
    _protected(io, layout.P4R14_PENDING_ARCHIVE, record["first_live_pending"], "P4R14_PENDING_ARCHIVE")
    _directory(io, layout.P4R14_PACKET_ARCHIVE, record["packet_directory"], "P4R14_PACKET_ARCHIVE")
    _protected(io, layout.P4R14_PACKET_ARCHIVE + "/packet.json", record["staging_files"]["packet.json"])
    _write_record(io, layout.P4R15_RECONCILIATION + "/complete.json",
                  {**intent, "state": "P4R14R2_RETAINED_STATE_ARCHIVED"})
