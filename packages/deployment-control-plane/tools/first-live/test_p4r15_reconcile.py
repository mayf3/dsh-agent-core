import copy
import json
from pathlib import Path
import unittest

import p4r15_reconcile as r
from first_live_io import digest


RECORD = json.loads(Path(__file__).with_name("p4r15-successor-reconciliation.json").read_text())


class IO:
    def __init__(self, record, fail_after=None):
        self.record = record
        self.calls = []
        self.copies = {}
        self.moved = set()
        self.mutations = 0
        self.fail_after = fail_after
        self.expected_metadata = {}

    def _directory(self, expected):
        return dict(type="Directory", **expected)

    def metadata(self, path, absent=False):
        destinations = {r.layout.P4R15R4_OPERATION_ARCHIVE, r.layout.P4R15R4_PACKET_ARCHIVE,
                        r.layout.P4R15R4_PENDING_ARCHIVE, r.layout.P4R16_RECONCILIATION}
        active = {r.layout.ROOT + "/first-live-operation", r.layout.PACKET,
                  r.layout.ROOT + "/first-live-pending.json"}
        if absent:
            if path in destinations:
                return {"present": True} if path in self.moved else None
            if path in active:
                return None if path in self.moved else {"present": True}
            if path.startswith(r.layout.SUDOERS_ACTIVE + "/"):
                return None
            return {"present": True}
        if path in (r.layout.ROOT + "/first-live-operation", r.layout.P4R15R4_OPERATION_ARCHIVE):
            return self._directory(self.record["operation_directory"])
        if path == r.layout.ROOT + "/first-live-operation/first-live-recovery-maintenance-0-0":
            return self._directory(self.record["maintenance_directory"])
        if path == r.layout.P4R14_OPERATION_ARCHIVE:
            return self._directory(self.record['p4r14_history']['operation_directory'])
        if path == r.layout.P4R14_PACKET_ARCHIVE:
            return self._directory(self.record['p4r14_history']['packet_directory'])
        if path in (r.layout.PACKET, r.layout.P4R15R4_PACKET_ARCHIVE):
            return self._directory(self.record["packet_directory"])
        if path == r.layout.SOCKET:
            return self._directory(self.record["socket_directory"])
        if path == r.layout.LEGACY_ANCESTOR:
            return self._directory(self.record["legacy_ancestor"])
        if path == r.layout.SUDOERS_RETIREMENT:
            return self._directory(self.record["sudoers_retirement"]["journal_directory"])
        if path in self.record["legacy_locks"]:
            return self._directory(self.record["legacy_locks"][path]["directory"])
        value=self.expected_metadata.get(path, {"inode": 1});return {k:v for k,v in value.items() if k!='spec'}

    def expect(self, path, spec):
        value = {"inode": spec.get("inode", 1)}
        self.expected_metadata[path] = {**value, 'spec': dict(spec)}
        return value

    def copy(self, raw, value, mode, path, gid=0):
        if digest(raw) != value:
            raise RuntimeError("COPY_DIGEST")
        self.copies[path] = raw
        self._cut()

    def _cut(self):
        self.mutations += 1
        if self.fail_after == self.mutations:
            raise RuntimeError("SIMULATED_CRASH_UNKNOWN")

    def call(self, argv, **kwargs):
        self.calls.append(argv)
        if argv[:2] == ["/bin/ls", "-1A"]:
            path = argv[-1]
            if path in (r.layout.ROOT + "/first-live-operation", r.layout.P4R15R4_OPERATION_ARCHIVE):
                names = self.record["operation_directory"]["names"]
            elif path.endswith("first-live-recovery-maintenance-0-0"):
                names = []
            elif path == r.layout.P4R14_OPERATION_ARCHIVE:
                names = self.record['p4r14_history']['operation_directory']['names']
            elif path == r.layout.P4R14_PACKET_ARCHIVE:
                names = self.record['p4r14_history']['packet_directory']['names']
            elif path in (r.layout.PACKET, r.layout.P4R15R4_PACKET_ARCHIVE):
                names = self.record["packet_names"]
            elif path.endswith("/payloads"):
                names = self.record["payload_names"]
            elif path == r.layout.LEGACY_ANCESTOR:
                names = self.record["legacy_ancestor"]["names"]
            elif path == r.layout.SOCKET:
                names = self.record["socket_directory"]["names"]
            elif path in self.record["legacy_locks"]:
                names = self.record["legacy_locks"][path]["directory"]["names"]
            else:
                names = self.record["sudoers_retirement"]["journal_directory"]["names"]
            return (("\n".join(names) + "\n") if names else "").encode()
        if argv[0] == "/bin/mkdir":
            self.moved.add(argv[-1]); self._cut()
        elif argv[0] == "/bin/mv":
            self.moved.add(argv[1]); self.moved.add(argv[2]); self._cut()
        elif argv[0] == "/bin/sync":
            self._cut()
        return b"bound"


class Reconciliation(unittest.TestCase):
    def test_exact_retained_state_is_archived_without_replaying_effects(self):
        io = IO(copy.deepcopy(RECORD))
        r.reconcile(io, json.dumps(RECORD, sort_keys=True, separators=(",", ":")).encode())
        self.assertEqual([x[0] for x in io.calls].count("/bin/mv"), 3)
        self.assertIn(r.layout.P4R16_RECONCILIATION + "/complete.json", io.copies)
        pending_spec=io.expected_metadata[r.layout.P4R15R4_PENDING_ARCHIVE]['spec']
        packet_spec=io.expected_metadata[r.layout.P4R15R4_PACKET_ARCHIVE + '/packet.json']['spec']
        self.assertNotIn('ctime',pending_spec);self.assertNotIn('ctime',packet_spec)
        self.assertEqual(pending_spec['inode'],RECORD['first_live_pending']['inode'])
        self.assertEqual(packet_spec['inode'],RECORD['staging_files']['packet.json']['inode'])
        self.assertNotIn([r.layout.CODE + "/agent-deployd", "--first-live-and-enable"], io.calls)

    def test_history_fence_lock_or_prerequisite_drift_stops_before_first_write(self):
        for drift in ("package", "fence", "holder", "p4r14", "history"):
            value = copy.deepcopy(RECORD); io = IO(copy.deepcopy(RECORD))
            if drift == "package": value["package_sha256"] = "0" * 64
            elif drift == "fence": io.record["legacy_ancestor"]["flags"] = 0
            elif drift == "holder": io.record["legacy_locks"][r.layout.LEGACY_DEPLOY_LOCK]["directory"]["names"] = ["foreign"]
            elif drift == "p4r14": io.record["p4r14_history"]["operation_directory"]["mode"] = 0o755
            else: io.record["operation_directory"]["names"] = ["foreign"]
            with self.assertRaises(RuntimeError):
                r.reconcile(io, json.dumps(value, sort_keys=True, separators=(",", ":")).encode())
            self.assertFalse(io.copies)
            self.assertFalse(any(x[0] in ("/bin/mv", "/bin/mkdir") for x in io.calls))

    def test_each_reconciliation_crash_cut_stops_without_later_mutation(self):
        raw = json.dumps(RECORD, sort_keys=True, separators=(",", ":")).encode()
        for cut in range(1, 11):
            io = IO(copy.deepcopy(RECORD), fail_after=cut)
            with self.assertRaisesRegex(RuntimeError, "SIMULATED_CRASH_UNKNOWN"):
                r.reconcile(io, raw)
            self.assertEqual(io.mutations, cut)


if __name__ == "__main__":
    unittest.main()
