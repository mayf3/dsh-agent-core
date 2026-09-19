"""Exact P4R12 intent-only history preservation for one reviewed successor."""
if __name__ == "__main__":
    raise SystemExit("imported only by the exact reviewed first-live operator")

from bind_records import _object
from first_live_io import digest, require
import first_live_package as layout


P4R12_PACKAGE = "f79dce644e89e1e2386dabf2b1bd2a385640a0d25cc839cac90b1eb49ab2d026"
P4R12_PLAN = "e0d546e16dedd1d96211e001e13dba909b3be11e002d66b36debb68b0d1366a0"
EVIDENCE = {
    "p4r12_stop_readback_sha256": "e3da869bf2e0c8960c5b33d368c14271958bc5c98c417f1b86f0f68b5c072fef",
    "successor_census_sha256": "e5e0a4b1c2b979ae2e82b01f9d87d73b68dba4a60ae32955272e15630a596b57",
    "pending_readback_sha256": "803799f39f152c0342c1e694118352fbaa6456bf29da01fc70a04720337ec2da",
    "capability_root_readback_sha256": "43a949d2442434981bb04b72c831d7a57988fe15d212539aefcd387b0eb93ef1",
    "capability_completion_sha256": "6071e0e9343ba342470263c0bcc7a7a4e35c563e2a46474a7563cb455e75d404",
}


def _directory(io, path, expected, code="P4R12_DIRECTORY_BINDING"):
    value = io.metadata(path)
    require(value["type"] == "Directory", "P4R12_DIRECTORY_TYPE")
    for key in ("uid", "gid", "mode", "flags", "device", "inode"):
        require(value[key] == expected[key], code + ":" + key)
    return value


def _protected(io, path, spec):
    before = io.expect(path, spec)
    raw = io.call(["/bin/cat", path], expected_digest=spec["sha256"])
    require(io.metadata(path) == before, "P4R12_PROTECTED_CHANGED")
    return raw


def reconcile(io, raw):
    record = _object(raw, 4 * 1024 * 1024)
    require(set(record) == {
        "version", "state", "operation_id", "execution_id", "package_sha256", "plan_sha256",
        "operation_directory", "packet_directory", "first_live_intent", "legacy_fence_intent",
        "first_live_pending", "legacy_fence_record", "legacy_ancestor", "packet_names",
        "payload_names", "staging_files", "installed_files", "socket_directory", "capability",
        "evidence", "retry_forbidden", "production_mutation"
    }, "P4R12_RECONCILIATION_SHAPE")
    require(
        record["version"] == 1
        and record["state"] == "P4R12_INTENT_ONLY_SUPERSEDED"
        and record["operation_id"] == layout.OPERATION
        and record["execution_id"] == "first-live-dsh-20260918-01-p4r10-successor"
        and record["package_sha256"] == P4R12_PACKAGE
        and record["plan_sha256"] == P4R12_PLAN
        and record["evidence"] == EVIDENCE
        and record["retry_forbidden"] is True
        and record["production_mutation"] == "P4R9_HISTORY_ARCHIVE_AND_CONTROL_PLANE_STAGING",
        "P4R12_RECONCILIATION_BINDING",
    )
    for path in (layout.P4R12_OPERATION_ARCHIVE, layout.P4R12_PACKET_ARCHIVE):
        require(io.metadata(path, absent=True) is None, "P4R12_ARCHIVE_ALREADY_PRESENT")

    _directory(io, layout.ROOT + "/first-live-operation", record["operation_directory"])
    require(
        io.call(["/bin/ls", "-1A", layout.ROOT + "/first-live-operation"])
        == b"first-live-intent.json\nlegacy-ancestor-fence-intent.json\n",
        "P4R12_OPERATION_SHAPE",
    )
    _protected(io, layout.ROOT + "/first-live-operation/first-live-intent.json", record["first_live_intent"])
    fence_raw = _protected(
        io,
        layout.ROOT + "/first-live-operation/legacy-ancestor-fence-intent.json",
        record["legacy_fence_intent"],
    )
    require(_object(fence_raw, 1024 * 1024) == record["legacy_fence_record"], "P4R12_FENCE_RECORD")
    _protected(io, layout.ROOT + "/first-live-pending.json", record["first_live_pending"])

    ancestor = _directory(io, layout.LEGACY_ANCESTOR, record["legacy_ancestor"], "P4R12_ANCESTOR")
    fence = record["legacy_fence_record"]
    require(
        set(fence) == {"operation_id", "binding", "identity", "path", "original_flags", "set_flag"}
        and fence["operation_id"] == layout.OPERATION
        and fence["path"] == layout.LEGACY_ANCESTOR
        and fence["identity"] == {key: ancestor[key] for key in ("device", "inode", "uid", "gid", "mode")}
        and fence["original_flags"] == 0
        and fence["set_flag"] == 0x0010_0000
        and ancestor["flags"] == 0,
        "P4R12_FENCE_INTENT_BINDING",
    )
    require(io.metadata(layout.LEGACY_ANCESTOR + "/transaction.lock", absent=True) is None,
            "P4R12_LEGACY_TRANSACTION_LOCK_PRESENT")

    capability = record["capability"]
    require(set(capability) == {"installed_probe", "probe_directory", "target_directory", "result_file", "result"},
            "P4R13_CAPABILITY_SHAPE")
    _protected(io, layout.FENCE_PROBE_BINARY, capability["installed_probe"])
    _directory(io, layout.FENCE_PROBE_ROOT, capability["probe_directory"], "P4R13_PROBE_DIRECTORY")
    target = _directory(io, layout.FENCE_PROBE_ROOT + "/target", capability["target_directory"],
                        "P4R13_PROBE_TARGET")
    result_raw = _protected(io, layout.FENCE_PROBE_ROOT + "/result.json", capability["result_file"])
    require(
        _object(result_raw, 1024 * 1024) == capability["result"]
        and capability["result"] == {
            "version": 1,
            "state": "SUPPORTED_AND_CLEARED",
            "selected_flag": 0x0002_0000,
            "rename_blocked": True,
            "child_operations": True,
            "final_flags": 0,
        }
        and target["flags"] == 0,
        "P4R13_CAPABILITY_BINDING",
    )

    _directory(io, layout.PACKET, record["packet_directory"])
    require(io.call(["/bin/ls", "-1A", layout.PACKET]).decode().splitlines() == record["packet_names"],
            "P4R12_PACKET_SHAPE")
    require(io.call(["/bin/ls", "-1A", layout.PACKET + "/payloads"]).decode().splitlines()
            == record["payload_names"], "P4R12_PAYLOAD_SHAPE")
    for relative, spec in record["staging_files"].items():
        _protected(io, layout.PACKET + "/" + relative, spec)
    require(set(record["installed_files"]) == {"agent-deployd", "agent-deploy-issuer", "agent-deployctl"},
            "P4R12_INSTALLED_SET")
    for name, spec in record["installed_files"].items():
        _protected(io, layout.CODE + "/" + name, spec)
    _directory(io, layout.SOCKET, record["socket_directory"])
    require(io.call(["/bin/ls", "-1A", layout.SOCKET]) == b"", "P4R12_SOCKET_NOT_EMPTY")

    io.copy(raw, digest(raw), "0400", layout.ROOT + "/first-live-operation/successor-reconciliation.json")
    io.call(["/bin/mv", layout.ROOT + "/first-live-pending.json",
             layout.ROOT + "/first-live-operation/p4r12-pending.json"])
    io.call(["/bin/mv", layout.ROOT + "/first-live-operation", layout.P4R12_OPERATION_ARCHIVE])
    io.call(["/bin/mv", layout.PACKET, layout.P4R12_PACKET_ARCHIVE])
    io.call(["/bin/sync"])

    for path in (layout.ROOT + "/first-live-pending.json", layout.ROOT + "/first-live-operation", layout.PACKET):
        require(io.metadata(path, absent=True) is None, "P4R12_ACTIVE_PATH_RETAINED")
    operation = _directory(io, layout.P4R12_OPERATION_ARCHIVE, record["operation_directory"])
    packet = _directory(io, layout.P4R12_PACKET_ARCHIVE, record["packet_directory"])
    require((operation["device"], operation["inode"]) ==
            (record["operation_directory"]["device"], record["operation_directory"]["inode"]),
            "P4R12_OPERATION_ARCHIVE_IDENTITY")
    require((packet["device"], packet["inode"]) ==
            (record["packet_directory"]["device"], record["packet_directory"]["inode"]),
            "P4R12_PACKET_ARCHIVE_IDENTITY")
    _protected(io, layout.P4R12_OPERATION_ARCHIVE + "/first-live-intent.json", record["first_live_intent"])
    _protected(io, layout.P4R12_OPERATION_ARCHIVE + "/legacy-ancestor-fence-intent.json",
               record["legacy_fence_intent"])
    _protected(io, layout.P4R12_OPERATION_ARCHIVE + "/p4r12-pending.json", record["first_live_pending"])
    _protected(io, layout.P4R12_OPERATION_ARCHIVE + "/successor-reconciliation.json",
               dict(uid=0, gid=0, mode="0400", nlink=1, flags=0, sha256=digest(raw)))
    _protected(io, layout.P4R12_PACKET_ARCHIVE + "/packet.json", record["staging_files"]["packet.json"])
