import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest


HERE = Path(__file__).parent
SPEC = importlib.util.spec_from_file_location(
    "fence_capability_prerequisite",
    HERE / "fence_capability_prerequisite.py",
)
prerequisite = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = prerequisite
SPEC.loader.exec_module(prerequisite)


def directory(path, inode):
    return {
        "device": 16_777_230,
        "inode": inode,
        "uid": 0,
        "gid": 0,
        "mode": 0o700 if path == prerequisite.PROBE_PARENT else 0o755,
        "nlink": 1,
        "flags": 0,
        "size": 0,
        "mtime": 1,
        "ctime": 1,
        "birthtime": 1,
        "type": "Directory",
    }


class FakeOperation(prerequisite.Operation):
    def __init__(self, manifest, manifest_digest, binary):
        self.installed = False
        self.probed = False
        self.root_argv = []
        super().__init__(manifest, manifest_digest, binary)

    def invoke(self, argv, *, visible=False, stdin=None, timeout=120):
        self.sequence += 1
        if argv == ["/usr/bin/sudo", "-v"]:
            self.root_argv.append(argv)
            return 0, b"", b""
        raise AssertionError(argv)

    def root(self, argv, *, stdin=None, timeout=120):
        self.root_argv.append(argv)
        if argv[0] == "/usr/bin/install":
            self.assert_install_input = stdin.read()
            self.installed = True
            return 0, b"", b""
        if argv[:3] == ["/usr/bin/shasum", "-a", "256"]:
            return 0, (self.manifest["installed_probe"]["sha256"] + "  target\n").encode(), b""
        if argv == [prerequisite.INSTALL_TARGET]:
            self.probed = True
            return 0, prerequisite.canonical(self.manifest["expected_result"]) + b"\n", b""
        if argv == ["/bin/cat", prerequisite.PROBE_DIR + "/result.json"]:
            return 0, prerequisite.canonical(self.manifest["expected_result"]), b""
        if argv == ["/bin/ls", "-1A", prerequisite.PROBE_DIR]:
            return 0, b"clear-intent.json\nintent.json\nresult.json\nset-result.json\ntarget\n", b""
        raise AssertionError(argv)

    def stat(self, path, *, missing=False):
        if path == prerequisite.INSTALL_PARENT:
            return self.manifest["install_parent"]
        if path == prerequisite.PROBE_PARENT:
            return self.manifest["probe_parent"]
        if path == prerequisite.INSTALL_TARGET:
            if not self.installed:
                return None
            value = dict(self.manifest["installed_probe"])
            return {
                "device": 1,
                "inode": 2,
                "uid": 0,
                "gid": 0,
                "mode": 0o555,
                "nlink": 1,
                "flags": 0,
                "size": value["size"],
                "mtime": 1,
                "ctime": 1,
                "birthtime": 1,
                "type": "Regular File",
            }
        if path == prerequisite.PROBE_DIR:
            if not self.probed:
                return None
            return directory(prerequisite.PROBE_PARENT, 4)
        if path == prerequisite.PROBE_DIR + "/target":
            value = directory(prerequisite.PROBE_PARENT, 5)
            value["mode"] = 0o700
            return value
        raise AssertionError(path)


class PrerequisiteTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.old_journal = prerequisite.LOCAL_JOURNAL
        prerequisite.LOCAL_JOURNAL = Path(self.temp.name) / "journal"
        self.binary = b"reviewed-probe"
        self.manifest = {
            "source_commit": "a" * 40,
            "source_tree": "b" * 40,
            "install_parent": directory(prerequisite.INSTALL_PARENT, 10),
            "probe_parent": directory(prerequisite.PROBE_PARENT, 11),
            "installed_probe": {
                "sha256": prerequisite.sha(self.binary),
                "size": len(self.binary),
                "mode": "0500",
            },
            "expected_result": {
                "version": 1,
                "state": "SUPPORTED_AND_CLEARED",
                "selected_flag": 131072,
                "rename_blocked": True,
                "child_operations": True,
                "final_flags": 0,
            },
        }

    def tearDown(self):
        prerequisite.LOCAL_JOURNAL = self.old_journal
        self.temp.cleanup()

    def test_exact_operation_installs_verified_fd_then_probes_and_reads_clear_state(self):
        operation = FakeOperation(self.manifest, "c" * 64, self.binary)
        result = operation.run()
        self.assertEqual(operation.assert_install_input, self.binary)
        self.assertTrue(operation.probed)
        self.assertEqual(result["state"], "SUPPORTED_AND_CLEARED")
        self.assertTrue((prerequisite.LOCAL_JOURNAL / "completed.json").is_file())
        self.assertEqual(
            operation.root_argv[0],
            ["/usr/bin/sudo", "-v"],
        )
        self.assertEqual(operation.root_argv[-1], ["/bin/ls", "-1A", prerequisite.PROBE_DIR])

    def test_present_install_target_stops_before_install_or_probe(self):
        operation = FakeOperation(self.manifest, "c" * 64, self.binary)
        operation.installed = True
        with self.assertRaisesRegex(RuntimeError, "INSTALL_TARGET_PRESENT"):
            operation.run()
        self.assertFalse(operation.probed)
        self.assertFalse(any(argv and argv[0] == "/usr/bin/install" for argv in operation.root_argv))

    def test_paths_and_effects_are_fixed_not_caller_selected(self):
        self.assertEqual(prerequisite.INSTALL_TARGET, "/usr/local/libexec/agent-deployd/agent-deploy-first-live-fence-probe")
        self.assertEqual(prerequisite.PROBE_DIR, "/private/var/db/agent-deployd/first-live-fence-capability-p4r13")
        source = (HERE / "fence_capability_prerequisite.py").read_text()
        self.assertNotIn("--path", source)
        self.assertNotIn("chflags", source)

    def test_parent_recheck_binds_identity_and_security_metadata_not_mutated_timestamps(self):
        before = directory(prerequisite.PROBE_PARENT, 11)
        after = dict(before)
        after.update({"nlink": 99, "size": 4096, "mtime": 2, "ctime": 2})
        self.assertEqual(prerequisite.stable_parent(before), prerequisite.stable_parent(after))
        after["inode"] = 12
        self.assertNotEqual(prerequisite.stable_parent(before), prerequisite.stable_parent(after))


if __name__ == "__main__":
    unittest.main()
