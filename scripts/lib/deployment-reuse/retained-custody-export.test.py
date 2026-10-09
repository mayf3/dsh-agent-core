"""Isolated tests for retained-custody-export.py — fixtures only, zero production contact.

Covers the conservative stop classes: success match, extra/missing objects,
links/out-of-bounds, hash change, binding missing/invalid, UNKNOWN/denied,
plus scope validation, zero-write and subprocess e2e. Skips the permission
denial case when running as root (root reads through 000 modes).
"""
import hashlib
import importlib.util
import json
import os
import shutil
import subprocess
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest import mock

HERE = Path(__file__).parent
SCRIPT = HERE / "retained-custody-export.py"


def load():
    if not SCRIPT.exists():
        return types.SimpleNamespace(run=lambda *a, **k: (_ for _ in ()).throw(AssertionError("adapter missing")))
    spec = importlib.util.spec_from_file_location("retained_custody_export", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def digest(data):
    return hashlib.sha256(data).hexdigest()


class Fixture:
    """Builds a retained-tree-shaped fixture plus a schema-identical scope."""

    def __init__(self, uid=None, gid=None, root_mode=0o700):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.root.chmod(root_mode)
        self.uid = os.getuid() if uid is None else uid
        self.gid = os.getgid() if gid is None else gid
        self.files = {}
        self.dirs = ["."]
        self.add_file("seed.mjs", b"SEED-MATERIALS-ONE")
        self.add_dir("tree")
        self.add_file("tree/alpha.txt", b"alpha-bytes")
        self.add_dir("tree/nested")
        self.add_file("tree/nested/deep.bin", b"deep" * 40)

    def close(self):
        self.tmp.cleanup()

    def path(self, rel):
        return self.root / rel

    def add_dir(self, rel):
        self.path(rel).mkdir()
        self.dirs.append(rel)

    def add_file(self, rel, data):
        self.path(rel).write_bytes(data)
        self.files[rel] = data

    def entry(self, rel, typ, **extra):
        value = {"relative": rel, "type": typ, "expectedUid": self.uid, "expectedGid": self.gid}
        value.update(extra)
        return value

    def scope_dict(self, **overrides):
        entries = [self.entry(".", "directory", expectedMode="0700")]
        entries += [self.entry(rel, "directory") for rel in self.dirs if rel != "."]
        entries += [self.entry(rel, "regular", expectedBytes=len(data), expectedSha256=digest(data))
                    for rel, data in sorted(self.files.items())]
        regular = [e for e in entries if e["type"] == "regular"]
        scope = {"kind": "B7_R10_EXPECTED_RETAINED_SCOPE_DERIVED_ONLY_V1",
                 "root": str(self.root),
                 "sourceItemlistSha256": "a" * 64, "sourceOutputSha256": "b" * 64,
                 "operationSourceArchiveSha256": "c" * 64,
                 "expectedCounts": {"regularFiles": len(regular), "directories": len(self.dirs),
                                    "symlinks": 0, "entries": len(entries),
                                    "regularBytes": sum(e["expectedBytes"] for e in regular)},
                 "entries": entries}
        scope.update(overrides)
        return scope

    def write_scope(self, scope=None, name="scope.json"):
        path = self.root.parent / name
        path.write_text(json.dumps(scope or self.scope_dict()))
        return str(path)

    def write_binding(self, **overrides):
        binding = {"operation": "b7-packet-r10-abcdef0123456789",
                   "stageSha256": "6" * 64, "attempt": 1,
                   "manifestSha256": "abcdef0123456789" + "0" * 48,
                   "receiptSha256": "e" * 64}
        binding.update(overrides)
        path = self.root.parent / "binding.json"
        path.write_text(json.dumps(binding))
        return str(path)

    def snapshot(self):
        state = {}
        for base, dirs, names in os.walk(self.root):
            for name in dirs + names:
                p = Path(base) / name
                st = p.lstat()
                state[str(p)] = (st.st_mtime_ns, st.st_size, st.st_mode, st.st_ino, tuple(sorted(os.listdir(base))))
        return state


class RetainedCustodyExportTests(unittest.TestCase):
    def setUp(self):
        self.m = load()
        self.fx = Fixture()
        self.addCleanup(self.fx.close)
        self.uid, self.gid = self.fx.uid, self.fx.gid
        self.scope = self.fx.write_scope()
        self.binding = self.fx.write_binding()
        self.before = self.fx.snapshot()

    def zero_write(self):
        self.assertEqual(self.fx.snapshot(), self.before)

    def call(self, *args, **kwargs):
        try:
            return self.m.run(*args, **kwargs)
        except self.m.Stop as stop:
            return 2, {"verdict": stop.code, "stopDetail": {"class": stop.code, "detail": stop.detail}}

    def run_scope_only(self, scope=None):
        return self.call(self.fx.write_scope(scope) if scope else self.scope, None, None, True)

    def test_scope_check_valid(self):
        code, record = self.run_scope_only()
        self.assertEqual((code, record["verdict"]), (0, "SCOPE_VALID"))
        self.zero_write()

    def test_success_match_records_leaf_digests(self):
        code, record = self.m.run(self.scope, self.binding)
        self.assertEqual((code, record["verdict"]), (0, "MATCH"))
        self.assertEqual(record["measuredCounts"]["regularFiles"], len(self.fx.files))
        self.assertEqual(record["measuredCounts"]["directories"], len(self.fx.dirs))
        self.assertEqual(record["anomalies"], [])
        by_rel = {e["relative"]: e for e in record["inventory"]}
        self.assertEqual(by_rel["seed.mjs"]["sha256"], digest(b"SEED-MATERIALS-ONE"))
        self.assertTrue(by_rel["seed.mjs"]["read"])
        self.assertEqual(record["binding"]["provenance"], "SUPPLIED_BY_CALLER_NOT_INDEPENDENTLY_AUTHENTICATED")
        self.assertTrue(record["binding"]["manifestOperationDigestAgreement"])
        self.assertFalse(record["disposal"]["performed"])
        self.zero_write()

    def test_extra_file_and_extra_dir_never_read_or_entered(self):
        self.fx.add_file("tree/foreign.txt", b"foreign")
        self.fx.add_dir("tree/foreign-dir")
        self.fx.add_file("tree/foreign-dir/inner.txt", b"inner")
        self.before = self.fx.snapshot()
        code, record = self.m.run(self.scope, self.binding)
        self.assertEqual(code, 2)
        self.assertEqual(record["verdict"], "EXTRA_OBJECT")
        rels = {e["relative"] for e in record["inventory"]}
        self.assertIn("tree/foreign.txt", rels)
        self.assertIn("tree/foreign-dir", rels)
        self.assertNotIn("tree/foreign-dir/inner.txt", rels)
        foreign = [e for e in record["inventory"] if e["relative"] == "tree/foreign.txt"][0]
        self.assertFalse(foreign["read"])
        self.zero_write()

    def test_missing_file_and_missing_dir_enumerated(self):
        (self.fx.path("tree/nested/deep.bin")).unlink()
        (self.fx.path("tree/nested")).rmdir()
        code, record = self.m.run(self.scope, self.binding)
        self.assertEqual(code, 2)
        self.assertEqual(record["verdict"], "MISSING_OBJECT")
        missing = {a["relative"] for a in record["anomalies"] if a["class"] == "MISSING_OBJECT"}
        self.assertEqual(missing, {"tree/nested/deep.bin", "tree/nested"})

    def test_symlink_never_traversed_target_recorded(self):
        target = self.fx.root.parent / "outside-target"
        target.write_bytes(b"outside")
        self.fx.path("tree/alpha.txt").unlink()
        self.fx.path("tree/alpha.txt").symlink_to(target)
        self.before = self.fx.snapshot()
        code, record = self.m.run(self.scope, self.binding)
        self.assertEqual(code, 2)
        self.assertEqual(record["verdict"], "LINK_OBJECT")
        link = [e for e in record["inventory"] if e["relative"] == "tree/alpha.txt"][0]
        self.assertEqual(link["type"], "symlink")
        self.assertEqual([a for a in record["anomalies"] if a["class"] == "LINK_OBJECT"][0]["target"],
                         str(target))
        self.assertNotIn(str(target), {e["relative"] for e in record["inventory"]})
        self.zero_write()

    def test_scope_rejects_link_escape_duplicate_parent_and_counts(self):
        cases = [
            self.fx.scope_dict(entries=[{"relative": ".", "type": "directory"},
                                        {"relative": "../escape", "type": "regular", "expectedBytes": 1,
                                         "expectedUid": self.uid, "expectedGid": self.gid}]),
            self.fx.scope_dict(entries=[{"relative": ".", "type": "directory"},
                                        {"relative": "x", "type": "symlink"}]),
            self.fx.scope_dict(entries=[{"relative": ".", "type": "directory"},
                                        {"relative": "tree/alpha.txt", "type": "regular",
                                         "expectedBytes": 5, "expectedUid": self.uid, "expectedGid": self.gid},
                                        {"relative": "tree/alpha.txt", "type": "regular",
                                         "expectedBytes": 5, "expectedUid": self.uid, "expectedGid": self.gid}]),
            self.fx.scope_dict(entries=[{"relative": "tree/alpha.txt", "type": "regular",
                                         "expectedBytes": 5, "expectedUid": self.uid, "expectedGid": self.gid}]),
            self.fx.scope_dict(expectedCounts={"regularFiles": 0, "directories": 0, "symlinks": 0,
                                               "entries": 1, "regularBytes": 0}),
            self.fx.scope_dict(kind="OTHER_KIND"),
        ]
        for scope in cases:
            code, record = self.run_scope_only(scope)
            self.assertEqual((code, record["verdict"]), (2, "SCOPE_INVALID"), scope)

    def test_hash_and_size_drift(self):
        self.fx.path("seed.mjs").write_bytes(b"tampered")
        code, record = self.m.run(self.scope, self.binding)
        self.assertEqual((code, record["verdict"]), (2, "DRIFT"))
        details = [a["detail"] for a in record["anomalies"] if a["class"] == "DRIFT"]
        self.assertTrue(any("sha256" in d for d in details), details)
        self.addCleanup(self.fx.close)
        self.fx = Fixture()
        self.scope = self.fx.write_scope()
        self.binding = self.fx.write_binding()
        with self.fx.path("tree/alpha.txt").open("r+b") as f:
            f.truncate(3)
        code, record = self.m.run(self.scope, self.binding)
        self.assertEqual((code, record["verdict"]), (2, "DRIFT"))
        self.assertTrue(any("size" in a["detail"] for a in record["anomalies"]))

    def test_uid_gid_mode_nlink_drift(self):
        def patch(scope, rel, **fields):
            for entry in scope["entries"]:
                if entry["relative"] == rel:
                    entry.update(fields)
        scope = self.fx.scope_dict()
        patch(scope, "seed.mjs", expectedUid=self.uid + 1)
        code, record = self.m.run(self.fx.write_scope(scope), self.binding)
        self.assertEqual((code, record["verdict"]), (2, "DRIFT"))
        self.assertEqual(record["anomalies"][0]["detail"], "uid/gid")
        scope = self.fx.scope_dict()
        for entry in scope["entries"]:
            if entry["relative"] == ".":
                entry["expectedMode"] = "0777"
        code, record = self.call(self.fx.write_scope(scope), self.binding)
        self.assertEqual((code, record["verdict"]), (2, "DRIFT"))
        self.assertIn("root mode", record["stopDetail"]["detail"])
        scope = self.fx.scope_dict()
        for entry in scope["entries"]:
            if entry["relative"] == "seed.mjs":
                entry["expectedNlink"] = 1
        self.scope = self.fx.write_scope(scope, name="scope-nlink.json")
        os.link(self.fx.path("seed.mjs"), self.fx.path("seed-link"))
        self.before = self.fx.snapshot()
        code, record = self.m.run(self.scope, self.binding)
        self.assertEqual(code, 2)
        classes = {a["class"] for a in record["anomalies"]}
        self.assertIn("DRIFT", classes)
        self.assertIn("EXTRA_OBJECT", classes)

    def test_mode_unspecified_entries_recorded_not_compared(self):
        code, record = self.m.run(self.scope, self.binding)
        self.assertEqual((code, record["verdict"]), (0, "MATCH"))
        by_rel = {e["relative"]: e for e in record["inventory"]}
        recorded = by_rel["tree"]["mode"]
        self.fx.path("tree").chmod(0o705)
        code, record = self.m.run(self.scope, self.binding)
        self.assertEqual((code, record["verdict"]), (0, "MATCH"))
        by_rel = {e["relative"]: e for e in record["inventory"]}
        self.assertEqual(by_rel["tree"]["mode"], "0705")
        self.assertNotEqual(recorded, "0705")

    def test_binding_missing_and_invalid(self):
        for binding, expected in ((None, "BINDING_MISSING"), ("/nonexistent/binding.json", "BINDING_MISSING")):
            code, record = self.call(self.scope, binding)
            self.assertEqual((code, record["verdict"]), (2, expected))
        bad = self.fx.write_binding(stageSha256="nothex")
        self.assertEqual(self.call(self.scope, bad)[1]["verdict"], "BINDING_INVALID")
        bad = self.fx.write_binding(attempt=0)
        self.assertEqual(self.call(self.scope, bad)[1]["verdict"], "BINDING_INVALID")
        bad = self.fx.write_binding(operation="x")
        self.assertEqual(self.call(self.scope, bad)[1]["verdict"], "BINDING_INVALID")

    def test_root_mismatch(self):
        code, record = self.call(self.scope, self.binding, root_arg="/somewhere/else")
        self.assertEqual((code, record["verdict"]), (2, "ROOT_MISMATCH"))

    @unittest.skipIf(os.geteuid() == 0, "root reads through mode 000")
    def test_unreadable_dir_unknown(self):
        self.fx.path("tree/nested").chmod(0o000)
        try:
            code, record = self.m.run(self.scope, self.binding)
            self.assertEqual((code, record["verdict"]), (2, "UNKNOWN"))
            self.assertIn("open:", record["anomalies"][0].get("detail", ""))
        finally:
            self.fx.path("tree/nested").chmod(0o700)

    def test_e2e_subprocess_match_and_stop(self):
        for expected_code, mutate in ((0, False), (2, True)):
            fx = Fixture()
            try:
                scope = fx.write_scope()
                binding = fx.write_binding()
                if mutate:
                    fx.path("seed.mjs").write_bytes(b"mutated")
                proc = subprocess.run(
                    [sys.executable, str(SCRIPT), "--scope", scope, "--binding", binding],
                    capture_output=True, text=True)
                self.assertEqual(proc.returncode, expected_code)
                record = json.loads(proc.stdout)
                self.assertEqual(record["verdict"], "MATCH" if not mutate else "DRIFT")
                self.assertTrue(record["zeroWrites"])
            finally:
                fx.close()

    def test_e2e_check_scope_and_usage(self):
        proc = subprocess.run([sys.executable, str(SCRIPT), "--scope", self.scope, "--check-scope"],
                              capture_output=True, text=True)
        self.assertEqual(proc.returncode, 0)
        self.assertEqual(json.loads(proc.stdout)["verdict"], "SCOPE_VALID")
        proc = subprocess.run([sys.executable, str(SCRIPT), "--scope", self.scope],
                              capture_output=True, text=True)
        self.assertEqual(proc.returncode, 3 if True else proc.returncode)
        self.assertIn("--binding", proc.stderr)


    def rewrite_scope_root(self, link_path, name):
        scope = json.loads(Path(self.scope).read_text())
        scope["root"] = str(link_path)
        return self.fx.write_scope(scope, name=name)

    def scope_for(self, root_path, files, name):
        uid, gid = os.getuid(), os.getgid()
        entries = [{"relative": ".", "type": "directory", "expectedUid": uid, "expectedGid": gid,
                    "expectedMode": "0700"}]
        for rel, data in sorted(files.items()):
            entries.append({"relative": rel, "type": "regular", "expectedUid": uid, "expectedGid": gid,
                            "expectedBytes": len(data), "expectedSha256": digest(data)})
        scope = {"kind": "B7_R10_EXPECTED_RETAINED_SCOPE_DERIVED_ONLY_V1", "root": str(root_path),
                 "sourceItemlistSha256": "a" * 64, "sourceOutputSha256": "b" * 64,
                 "operationSourceArchiveSha256": "c" * 64,
                 "expectedCounts": {"regularFiles": len(files), "directories": 1, "symlinks": 0,
                                    "entries": len(entries),
                                    "regularBytes": sum(len(d) for d in files.values())},
                 "entries": entries}
        path = self.fx.root.parent / name
        path.write_text(json.dumps(scope))
        return str(path)

    def test_root_symlink_refused(self):
        link = self.fx.root.parent / f"root-link-{os.getpid()}"
        link.symlink_to(self.fx.root)
        self.addCleanup(link.unlink)
        scope = self.rewrite_scope_root(link, f"scope-rootlink-{os.getpid()}.json")
        code, record = self.call(scope, self.binding)
        self.assertEqual((code, record["verdict"]), (2, "ROOT_SYMLINK"))
        self.assertNotEqual(record["verdict"], "MATCH")

    def test_unapproved_ancestor_symlink_refused(self):
        base = self.fx.root.parent / f"lbase-{os.getpid()}"
        base.mkdir(mode=0o700)
        self.addCleanup(base.rmdir)
        real = self.fx.root.parent / f"real-decoy-{os.getpid()}"
        (real / "deep").mkdir(parents=True, mode=0o700)
        self.addCleanup(lambda: shutil.rmtree(real))
        data = b"decoy-alpha"
        (real / "deep" / "a.txt").write_bytes(data)
        alias = base / "alias"
        alias.symlink_to(real)
        self.addCleanup(alias.unlink)
        scope = self.scope_for(alias / "deep", {"a.txt": data}, f"scope-ancestor-{os.getpid()}.json")
        code, record = self.call(scope, self.binding)
        self.assertEqual((code, record["verdict"]), (2, "ROOT_ANCESTOR_SYMLINK"))
        self.assertNotEqual(record["verdict"], "MATCH")

    def test_known_ancestor_alias_allowed_and_recorded(self):
        real = Path(os.path.realpath(self.fx.root.parent)) / f"alias-real-{os.getpid()}"
        (real / "proj").mkdir(parents=True, mode=0o700)
        self.addCleanup(lambda: shutil.rmtree(real))
        data = b"alias-content"
        (real / "proj" / "a.txt").write_bytes(data)
        holder = self.fx.root.parent / f"alias-base-{os.getpid()}"
        holder.mkdir(mode=0o700)
        self.addCleanup(holder.rmdir)
        entry = holder / "entry"
        entry.symlink_to(real)
        self.addCleanup(entry.unlink)
        scope = self.scope_for(entry / "proj", {"a.txt": data}, f"scope-alias-{os.getpid()}.json")
        saved = self.m.KNOWN_ANCESTOR_ALIASES
        self.m.KNOWN_ANCESTOR_ALIASES = dict(saved, **{str(entry): str(real)})
        self.addCleanup(setattr, self.m, "KNOWN_ANCESTOR_ALIASES", saved)
        code, record = self.m.run(scope, self.binding)
        self.assertEqual((code, record["verdict"]), (0, "MATCH"))
        substitutions = record["rootCustody"].get("aliasSubstitutions") or []
        self.assertEqual(substitutions, [{"logicalPrefix": "/var", "physicalPrefix": "/private/var",
                                          "source": "KNOWN_ANCESTOR_ALIASES"},
                                         {"logicalPrefix": str(entry), "physicalPrefix": str(real),
                                          "source": "KNOWN_ANCESTOR_ALIASES"}])

    def test_unreadable_dir_descendants_not_observed(self):
        self.fx.path("tree/nested").chmod(0o000)
        try:
            code, record = self.m.run(self.scope, self.binding)
        finally:
            self.fx.path("tree/nested").chmod(0o700)
        self.assertEqual(code, 2)
        rels = {a["relative"]: a for a in record["anomalies"]}
        self.assertEqual(rels["tree/nested/deep.bin"]["class"], "UNKNOWN")
        self.assertEqual(rels["tree/nested/deep.bin"].get("reason"), "not_observed")
        self.assertFalse([a for a in record["anomalies"] if a["class"] == "MISSING_OBJECT"])
        self.assertEqual(record["verdict"], "UNKNOWN")

    def test_lstat_failure_descendants_not_observed(self):
        real_stat = os.stat

        def flaky(path, *args, **kwargs):
            if kwargs.get("dir_fd") is not None and not str(path).startswith("/") and str(path) == "nested":
                raise OSError(13, "synthetic lstat denial")
            return real_stat(path, *args, **kwargs)

        with mock.patch("os.stat", side_effect=flaky):
            code, record = self.m.run(self.scope, self.binding)
        rels = {a["relative"]: a for a in record["anomalies"]}
        self.assertEqual(rels["tree/nested"]["class"], "UNKNOWN")
        self.assertEqual(rels["tree/nested/deep.bin"]["class"], "UNKNOWN")
        self.assertEqual(rels["tree/nested/deep.bin"].get("reason"), "not_observed")
        self.assertFalse([a for a in record["anomalies"] if a["class"] == "MISSING_OBJECT"])

    def test_symlink_at_scope_dir_descendants_not_observed(self):
        elsewhere = self.fx.root.parent / f"decoy-nested-{os.getpid()}"
        elsewhere.mkdir(mode=0o700)
        self.addCleanup(lambda: shutil.rmtree(elsewhere))
        (elsewhere / "deep.bin").write_bytes(b"decoy")
        nested = self.fx.path("tree/nested")
        (nested / "deep.bin").unlink()
        nested.rmdir()
        nested.symlink_to(elsewhere)
        self.before = self.fx.snapshot()
        code, record = self.m.run(self.scope, self.binding)
        self.assertEqual((code, record["verdict"]), (2, "LINK_OBJECT"))
        rels = {a["relative"]: a for a in record["anomalies"]}
        self.assertEqual(rels["tree/nested/deep.bin"]["class"], "UNKNOWN")
        self.assertEqual(rels["tree/nested/deep.bin"].get("reason"), "not_observed")
        self.assertFalse([a for a in record["anomalies"] if a["class"] == "MISSING_OBJECT"])
        self.zero_write()


if __name__ == "__main__":
    unittest.main()
