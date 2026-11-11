#!/usr/bin/env python3
"""C6 offline-only candidate. Never invokes an executor, installer, or production tree.

Every receipt/destination must be new and inside the explicit isolation root.
The source-view assertion is synthetic test authority, not a production barrier.
Inventory files use JSONL (including escaped newlines/surrogateescaped names).
Workers are process-group bounded by the controller's one monotonic deadline.
"""
import argparse
import base64
import ctypes
import errno
import hashlib
import json
import math
import os
import signal
import sqlite3
import stat
import subprocess
import sys
import resource
import tempfile
import time
from pathlib import Path

ENTRY_MONO = time.monotonic()
ENTRY_WALL = time.time()
VERSION = "stage_06-v2-offline-r2"
CHECKS = ("collector", "before", "copy", "empty_xattr_reapply", "dest_after", "source_after", "copy_diff", "source_drift", "acl", "hardlinks", "rollback_seal")
FIELDS = ("kind", "sha256", "target", "uid", "gid", "mode", "flags", "xattrs", "acl")
EMPTY_XATTR_SHA256 = hashlib.sha256(b"").hexdigest()
XATTR_COPY_SEMANTICS = {
    "id": "DITTO_EMPTY_VALUE_OMISSION",
    "clause": "Measured Darwin ditto --rsrc --extattr --acl may return rc=0 while omitting a named zero-byte xattr. This is a known copy semantic, not proof of metadata preservation.",
    "normalization": "Both sides split OK raw name-to-value-SHA maps into nonempty_values and explicit empty_names. Empty-name membership is retained and compared, never discarded; UNKNOWN is rejected.",
    "repair": "After copy, only absent empty attributes from the sealed before inventory are re-applied with CREATE|NOFOLLOW and read back. Every observation/action is logged. Any re-apply error fails the stage. Nonempty values are never repaired.",
    "acceptance": "Known ditto omissions and real differences have separate artifacts/counters. Complete raw xattr equality is still required after re-apply; source empty-name changes are real source drift.",
}


class Rejected(Exception):
    pass


def canonical(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=True, separators=(",", ":"))


def check_time(cfg):
    if time.monotonic() >= cfg["deadline_mono"]:
        raise Rejected("STAGE_DEADLINE")


def remaining(cfg):
    return max(0.0, cfg["deadline_mono"] - time.monotonic())


def delay(cfg, key):
    seconds = cfg.get("plan", {}).get("delays", {}).get(key, 0)
    end = time.monotonic() + float(seconds)
    while time.monotonic() < end:
        check_time(cfg)
        time.sleep(min(0.02, max(0, end - time.monotonic())))
    check_time(cfg)


def write_json(path, value, cfg=None, seal=False):
    # Chunked encoder checks deadline during serialization, before rename and after fsync.
    tmp = str(path) + ".partial"
    with open(tmp, "x", encoding="ascii") as stream:
        for part in json.JSONEncoder(sort_keys=True, ensure_ascii=True, separators=(",", ":")).iterencode(value):
            if cfg:
                check_time(cfg)
            stream.write(part)
        stream.write("\n")
        stream.flush()
        os.fsync(stream.fileno())
    if cfg:
        check_time(cfg)
    os.rename(tmp, path)
    if seal:
        os.chmod(path, 0o444)
    if cfg:
        check_time(cfg)


def digest_file(path, cfg=None):
    h = hashlib.sha256()
    with open(path, "rb") as stream:
        while True:
            if cfg:
                check_time(cfg)
            data = stream.read(1024 * 1024)
            if not data:
                break
            h.update(data)
    return h.hexdigest()


def error_record(path, field, exc):
    return {"path": path, "field": field, "status": "UNKNOWN", "error_category": type(exc).__name__,
            "errno": getattr(exc, "errno", None), "message": str(exc)}


def stable(st):
    return (st.st_dev, st.st_ino, st.st_mode, st.st_uid, st.st_gid, st.st_size,
            st.st_mtime_ns, st.st_ctime_ns, getattr(st, "st_flags", 0), st.st_nlink)


def subrun(argv, cfg):
    check_time(cfg)
    cap = min(cfg["step_timeout_seconds"], remaining(cfg))
    inherited = set()
    for argument in argv:
        if str(argument).startswith("/dev/fd/"):
            inherited.add(int(str(argument).split("/")[3]))
    result = subprocess.run(argv, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=cap, pass_fds=tuple(inherited))
    check_time(cfg)
    if result.returncode:
        exc = OSError(errno.EIO, "command failed rc=%d stderr_sha256=%s" %
                      (result.returncode, hashlib.sha256(result.stderr).hexdigest()))
        raise exc
    return result.stdout


class Collector:
    """Locked nofollow backend; no API-to-CLI fallback after selection."""
    class AttrList(ctypes.Structure):
        _fields_ = [("bitmapcount", ctypes.c_ushort), ("reserved", ctypes.c_ushort),
                    ("commonattr", ctypes.c_uint32), ("volattr", ctypes.c_uint32),
                    ("dirattr", ctypes.c_uint32), ("fileattr", ctypes.c_uint32), ("forkattr", ctypes.c_uint32)]

    def __init__(self, cfg):
        if sys.platform != "darwin":
            raise Rejected("UNSUPPORTED_PLATFORM: Darwin native ACL contract required")
        self.cfg = cfg
        self.lib = ctypes.CDLL("/usr/lib/libSystem.B.dylib", use_errno=True)
        self.lib.listxattr.argtypes = [ctypes.c_char_p, ctypes.c_void_p, ctypes.c_size_t, ctypes.c_int]
        self.lib.listxattr.restype = ctypes.c_ssize_t
        self.lib.getxattr.argtypes = [ctypes.c_char_p, ctypes.c_char_p, ctypes.c_void_p, ctypes.c_size_t, ctypes.c_uint32, ctypes.c_int]
        self.lib.getxattr.restype = ctypes.c_ssize_t
        self.lib.setxattr.argtypes = [ctypes.c_char_p, ctypes.c_char_p, ctypes.c_void_p, ctypes.c_size_t, ctypes.c_uint32, ctypes.c_int]
        self.lib.setxattr.restype = ctypes.c_int
        self.lib.getattrlist.argtypes = [ctypes.c_char_p, ctypes.POINTER(self.AttrList), ctypes.c_void_p, ctypes.c_size_t, ctypes.c_ulong]
        self.lib.getattrlist.restype = ctypes.c_int
        self.acl_seconds = 0.0

    @staticmethod
    def ok(rc):
        if rc < 0:
            number = ctypes.get_errno()
            raise OSError(number, os.strerror(number))
        return rc

    def native_xattrs(self, path):
        p = os.fsencode(path)
        n = self.ok(self.lib.listxattr(p, None, 0, 1))  # XATTR_NOFOLLOW
        if n > 16 * 1024 * 1024:
            raise Rejected("XATTR_NAMES_LIMIT")
        names = ctypes.create_string_buffer(max(1, n))
        got = self.ok(self.lib.listxattr(p, names, n, 1))
        if got != n:
            raise Rejected("UNSTABLE_XATTR_NAMES")
        values = {}
        raw_names = names.raw[:got].split(b"\0")
        if got and raw_names[-1] != b"":
            raise Rejected("INVALID_XATTR_NAMES")
        for name in sorted(x for x in raw_names if x):
            check_time(self.cfg)
            size = self.ok(self.lib.getxattr(p, name, None, 0, 0, 1))
            if size > 16 * 1024 * 1024:
                raise Rejected("XATTR_VALUE_LIMIT")
            value = ctypes.create_string_buffer(max(1, size))
            actual = self.ok(self.lib.getxattr(p, name, value, size, 0, 1))
            if actual != size:
                raise Rejected("UNSTABLE_XATTR_VALUE")
            values[os.fsdecode(name)] = hashlib.sha256(value.raw[:size]).hexdigest()
        return {"status": "OK", "values": values}

    def xattrs(self, path):
        if self.cfg["xattr_backend"] == "native":
            return self.native_xattrs(path)
        values = {}
        # Enumerate native NUL-delimited names; valid attribute names may contain LF.
        # The CLI backend independently obtains the raw value as hex, never hashes formatting.
        native_names = self.native_xattrs(path)["values"]
        for name in sorted(native_names):
            raw = subrun(["/usr/bin/xattr", "-s", "-p", "-x", "--", name, str(path)], self.cfg)
            value = bytes.fromhex(raw.decode("ascii"))
            values[name] = hashlib.sha256(value).hexdigest()
        return {"status": "OK", "values": values}

    def acl(self, path):
        started = time.monotonic()
        try:
            attrs = self.AttrList(5, 0, 0x00400000, 0, 0, 0, 0)  # ATTR_CMN_EXTENDED_SECURITY
            buf = ctypes.create_string_buffer(8192)
            self.ok(self.lib.getattrlist(os.fsencode(path), ctypes.byref(attrs), buf, len(buf), 1))  # FSOPT_NOFOLLOW
            import struct
            total, offset, length = struct.unpack_from("=IiI", buf.raw, 0)
            begin = 4 + offset
            if total < 12 or total > len(buf) or begin < 12 or begin + length > total:
                raise Rejected("INVALID_ACL_REFERENCE")
            data = buf.raw[begin:begin + length]
            if not data:
                raw_acl = b""
            else:
                if len(data) < 44:
                    raise Rejected("INVALID_ACL_LENGTH")
                magic, = struct.unpack_from("=I", data, 0)
                count, = struct.unpack_from("=I", data, 36)
                if magic != 0x012CC16D or count > 169 or len(data) != 44 + 24 * count:
                    raise Rejected("INVALID_ACL_LAYOUT")
                raw_acl = data[36:]  # Owner/group UUIDs are separate uid/gid metadata.
            return {"status": "OK", "encoding": "darwin-kauth-acl-v1", "hex": raw_acl.hex()}
        finally:
            self.acl_seconds += time.monotonic() - started


def fault(cfg, phase, path, field):
    for item in cfg.get("plan", {}).get("faults", []):
        if item["phase"] == phase and item["path"] == path and item["field"] == field:
            raise PermissionError(item.get("errno", 13), "synthetic injected read failure")


def test_event(cfg, at, phase=None, path=None):
    for item in cfg.get("plan", {}).get("events", []):
        if item["at"] != at or ("phase" in item and item["phase"] != phase) or (at == "before_hash" and item.get("path") != path):
            continue
        for op in item.get("ops", []):
            root = cfg[op.get("tree", "source")]
            target = safe_member(root, op["path"], allow_missing=True)
            action = op["op"]
            if action == "write":
                fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_TRUNC | os.O_NOFOLLOW, 0o644)
                with os.fdopen(fd, "wb") as out:
                    out.write(op.get("value", "").encode())
            elif action == "append":
                fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_APPEND | os.O_NOFOLLOW, 0o644)
                with os.fdopen(fd, "ab") as out:
                    out.write(op.get("value", "").encode())
            elif action == "chmod":
                os.chmod(target, op["mode"], follow_symlinks=False)
            elif action == "unlink":
                os.unlink(target)
            elif action == "symlink":
                link_target = op["target"]
                if os.path.isabs(link_target) and not within(cfg["isolation_root"], link_target):
                    raise Rejected("TEST_LINK_OUTSIDE_ISOLATION")
                if os.path.lexists(target):
                    os.unlink(target)
                os.symlink(link_target, target)
            elif action == "xattr":
                collector = Collector(cfg)
                value = op.get("value", "").encode()
                collector.ok(collector.lib.setxattr(os.fsencode(target), os.fsencode(op["name"]), value, len(value), 0, 1))
            elif action == "removexattr":
                collector = Collector(cfg)
                collector.lib.removexattr.argtypes = [ctypes.c_char_p, ctypes.c_char_p, ctypes.c_int]
                collector.lib.removexattr.restype = ctypes.c_int
                collector.ok(collector.lib.removexattr(os.fsencode(target), os.fsencode(op["name"]), 1))
            else:
                raise Rejected("INVALID_TEST_OPERATION")
        with open(Path(cfg["receipt"]) / "test-events.jsonl", "a", encoding="ascii") as out:
            out.write(canonical({"at": at, "phase": phase, "path": path, "mono": time.monotonic(), "event": item}) + "\n")


def collect_row(path, rel, cfg, collector, phase):
    check_time(cfg)
    before = os.lstat(path)
    mode = before.st_mode
    kind = "file" if stat.S_ISREG(mode) else "dir" if stat.S_ISDIR(mode) else "link" if stat.S_ISLNK(mode) else "unsupported"
    if kind == "unsupported":
        raise Rejected("UNSUPPORTED_TYPE mode=%o path=%r" % (mode, rel))
    row = {"path": rel, "kind": kind, "uid": before.st_uid, "gid": before.st_gid,
           "mode": stat.S_IMODE(mode), "flags": getattr(before, "st_flags", 0)}
    field = "xattrs"
    try:
        fault(cfg, phase, rel, field)
        row["xattrs"] = collector.xattrs(path)
        field = "acl"
        fault(cfg, phase, rel, field)
        row["acl"] = collector.acl(path)
        if kind == "file":
            field = "hash"
            fault(cfg, phase, rel, field)
            fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
            try:
                if stable(os.fstat(fd)) != stable(before):
                    raise Rejected("UNSTABLE_FILE_OPEN")
                test_event(cfg, "before_hash", phase, rel)
                h = hashlib.sha256()
                size = 0
                while True:
                    check_time(cfg)
                    block = os.read(fd, 1024 * 1024)
                    if not block:
                        break
                    size += len(block)
                    h.update(block)
                if stable(os.fstat(fd)) != stable(before):
                    raise Rejected("UNSTABLE_FILE_READ")
                row.update(sha256=h.hexdigest(), size=size)
            finally:
                os.close(fd)
        elif kind == "link":
            field = "target"
            row["target"] = os.readlink(path)
        if stable(os.lstat(path)) != stable(before):
            raise Rejected("UNSTABLE_ENTRY")
        return row, before
    except Exception as exc:
        exc.c6_field = field
        raise


def export_inventory(db, directory, cfg, phase, counts):
    delay(cfg, phase + "_serialize")
    chunks = []
    chunk = None
    chunk_count = 0
    component = None
    hashes = {}
    def close_chunk():
        if chunk:
            chunk.flush()
            os.fsync(chunk.fileno())
            chunk.close()
            name = "chunk-%06d.jsonl" % len(chunks)
            chunks.append({"file": name, "count": chunk_count, "sha256": digest_file(directory / name, cfg)})
            os.chmod(directory / name, 0o444)
    with open(directory / "names.jsonl", "x", encoding="ascii") as names, open(directory / "acl.jsonl", "x", encoding="ascii") as acls:
        for raw_rel, data in db.execute("SELECT path,data FROM entries ORDER BY path"):
            check_time(cfg)
            rel = os.fsdecode(raw_rel)
            first = rel.split("/", 1)[0]
            if chunk is None or chunk_count >= cfg["chunk_entries"] or first != component:
                close_chunk()
                chunk = open(directory / ("chunk-%06d.jsonl" % len(chunks)), "x", encoding="ascii")
                component, chunk_count = first, 0
            row = json.loads(data)
            chunk.write(data + "\n")
            names.write(canonical({"path": rel, "kind": row["kind"]}) + "\n")
            acls.write(canonical({"path": rel, "acl": row["acl"]}) + "\n")
            chunk_count += 1
        close_chunk()
        for stream in (names, acls):
            stream.flush()
            os.fsync(stream.fileno())
    groups = 0
    with open(directory / "hardlinks.jsonl", "x", encoding="ascii") as links:
        # Stream even a single huge group without accumulating all member names.
        for dev, ino, count in db.execute("SELECT dev,ino,count(*) FROM entries WHERE kind='file' GROUP BY dev,ino HAVING count(*)>1"):
            links.write('{"paths":[')
            first = True
            for (raw_rel,) in db.execute("SELECT path FROM entries WHERE dev=? AND ino=? ORDER BY path", (dev, ino)):
                check_time(cfg)
                if not first:
                    links.write(",")
                links.write(canonical(os.fsdecode(raw_rel)))
                first = False
            links.write("]}\n")
            groups += 1
        links.flush()
        os.fsync(links.fileno())
    for name in ("names.jsonl", "acl.jsonl", "hardlinks.jsonl"):
        hashes[name] = digest_file(directory / name, cfg)
        os.chmod(directory / name, 0o444)
    # Canonical hardlink comparison is by relative-path groups, never raw inode IDs.
    index = {"version": VERSION, "phase": phase, **counts, "chunks": chunks, "names_file": "names.jsonl",
             "acl_file": "acl.jsonl", "hardlinks_file": "hardlinks.jsonl", "artifact_hashes": hashes,
             "hardlink_groups": groups, "exclusions": [], "backend": cfg["xattr_backend"], "status": "COMPLETE"}
    write_json(directory / "index.json", index, cfg, seal=True)
    seal = {"index_sha256": digest_file(directory / "index.json", cfg), "count": counts["count"], "sealed_mono": time.monotonic()}
    write_json(directory / "seal.json", seal, cfg, seal=True)
    return index


def scan(cfg, phase):
    delay(cfg, phase + "_scan")
    root = cfg["source"] if phase != "dest-after" else cfg["dest"]
    directory = Path(cfg["receipt"]) / phase
    directory.mkdir()
    db = sqlite3.connect(directory / "inventory.sqlite")
    db.execute("PRAGMA temp_store=FILE")
    db.execute("PRAGMA cache_size=-4096")
    db.execute("CREATE TABLE entries(path BLOB PRIMARY KEY,kind TEXT,dev INTEGER,ino INTEGER,data TEXT)")
    db.execute("CREATE INDEX inode_groups ON entries(dev,ino,path)")
    collector = Collector(cfg)
    counts = {"count": 0, "regular_files": 0, "data_bytes": 0, "errors": 0}
    try:
        def entry(path, rel):
            try:
                row, st = collect_row(path, rel, cfg, collector, phase)
            except Exception as exc:
                counts["errors"] += 1
                write_json(directory / "errors.json", [error_record(rel, getattr(exc, "c6_field", "entry"), exc)])
                raise
            db.execute("INSERT INTO entries VALUES(?,?,?,?,?)", (os.fsencode(rel), row["kind"], st.st_dev, st.st_ino, canonical(row)))
            counts["count"] += 1
            if row["kind"] == "file":
                counts["regular_files"] += 1
                counts["data_bytes"] += row["size"]
            return row, st
        row, initial = entry(root, ".")
        if row["kind"] != "dir":
            raise Rejected("SOURCE_ROOT_NOT_DIRECTORY")
        if phase != "dest-after" and (initial.st_dev, initial.st_ino) != (cfg["source_view"]["dev"], cfg["source_view"]["ino"]):
            raise Rejected("SOURCE_VIEW_IDENTITY_CHANGED")
        # FD anchored traversal: no symlink ancestors are followed even during rename races.
        rootfd = os.open(root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        if stable(os.fstat(rootfd)) != stable(initial):
            os.close(rootfd)
            raise Rejected("UNSTABLE_ROOT_OPEN")
        stack = [(rootfd, os.scandir(rootfd), ".", initial)]
        try:
            while stack:
                check_time(cfg)
                parentfd, iterator, parentrel, parentst = stack[-1]
                try:
                    child = next(iterator)
                except StopIteration:
                    if stable(os.fstat(parentfd)) != stable(parentst):
                        raise Rejected("UNSTABLE_DIRECTORY %r" % parentrel)
                    iterator.close()
                    os.close(parentfd)
                    stack.pop()
                    continue
                rel = child.name if parentrel == "." else parentrel + "/" + child.name
                # macOS does not support /dev/fd/DIR/leaf. Each scanner is a
                # single-threaded worker: cwd is anchored to the already-open
                # parent, so no path ancestor can be redirected through a link.
                os.fchdir(parentfd)
                row, st = entry(child.name, rel)
                if row["kind"] == "dir":
                    fd = os.open(child.name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=parentfd)
                    if stable(os.fstat(fd)) != stable(st):
                        os.close(fd)
                        raise Rejected("UNSTABLE_DIRECTORY_OPEN")
                    stack.append((fd, os.scandir(fd), rel, st))
        finally:
            for fd, iterator, _, _ in stack:
                iterator.close()
                os.close(fd)
        if stable(os.lstat(root)) != stable(initial):
            raise Rejected("UNSTABLE_ROOT_FINAL")
        db.commit()
        index = export_inventory(db, directory, cfg, phase, counts)
        db.close()
        os.chmod(directory / "inventory.sqlite", 0o444)
        return {"status": "PASS", **counts, "index": str(directory / "index.json"), "acl_seconds": collector.acl_seconds,
                "index_sha256": digest_file(directory / "index.json", cfg), "chunks": len(index["chunks"])}
    except Exception:
        db.commit()
        db.close()
        write_json(directory / "partial-metrics.json", {**counts, "acl_seconds": collector.acl_seconds, "status": "INCOMPLETE"})
        if not (directory / "errors.json").exists():
            write_json(directory / "errors.json", [{"status": "UNKNOWN", "error_category": "INCOMPLETE_SCAN", "message": "no complete sealed inventory"}])
        raise


def selftest(cfg):
    root = Path(cfg["receipt"]) / "collector-selftest"
    root.mkdir()
    file = root / "space\nand file"
    file.write_bytes(b"\x00binary\xff\n")
    (root / "dir").mkdir()
    os.symlink("missing", root / "dangling")
    os.symlink(str(file), root / "absolute")
    c = Collector(cfg)
    value = b"\x00\xff\n\x80binary"
    c.ok(c.lib.setxattr(os.fsencode(file), b"com.c6fix.binary", value, len(value), 0, 1))
    c.ok(c.lib.setxattr(os.fsencode(file), b"com.c6fix.empty", b"", 0, 0, 1))
    for attribute in (b"com.c6fix.new\nline", b"-x"):
        c.ok(c.lib.setxattr(os.fsencode(file), attribute, value, len(value), 0, 1))
    subrun(["/bin/chmod", "+a", "everyone allow read", str(file)], cfg)
    rows = {}
    for rel in (".", "dir", "space\nand file", "dangling", "absolute"):
        rows[rel], _ = collect_row(root if rel == "." else root / rel, rel, cfg, c, "selftest")
    if not rows["space\nand file"]["acl"]["hex"]:
        raise Rejected("SELFTEST_ACL_NONEMPTY")
    if rows["space\nand file"]["xattrs"]["values"].get("com.c6fix.binary") != hashlib.sha256(value).hexdigest():
        raise Rejected("SELFTEST_BINARY_XATTR")
    if normalize_xattrs(rows["space\nand file"]["xattrs"])["empty_names"] != ["com.c6fix.empty"]:
        raise Rejected("SELFTEST_EMPTY_XATTR")
    errors = []
    for name, fn in (("xattrs", c.xattrs), ("acl", c.acl)):
        try:
            fn(root / "nonexistent")
        except OSError as exc:
            errors.append(error_record("nonexistent", name, exc))
        else:
            raise Rejected("SELFTEST_ERROR_NOT_REJECTED " + name)
    if len(errors) != 2:
        raise Rejected("SELFTEST_ERROR_COVERAGE")
    for field, permission in (("acl", "readsecurity"), ("xattrs", "readextattr")):
        denied = root / ("denied-" + field)
        denied.write_bytes(b"denial selftest")
        c.ok(c.lib.setxattr(os.fsencode(denied), b"com.c6fix.binary", value, len(value), 0, 1))
        subrun(["/bin/chmod", "+a", "everyone deny " + permission, str(denied)], cfg)
        try:
            getattr(c, field)(denied)
        except PermissionError as exc:
            errors.append(error_record(denied.name, field, exc))
        else:
            raise Rejected("SELFTEST_PERMISSION_NOT_REJECTED " + field)
        finally:
            subrun(["/bin/chmod", "-N", str(denied)], cfg)
    write_json(Path(cfg["receipt"]) / "collector-selftest.json", {"status": "PASS", "rows": rows, "expected_errors": errors,
               "xattr_backend": cfg["xattr_backend"], "acl_backend": "getattrlist-FSOPT_NOFOLLOW"}, cfg, seal=True)
    return {"status": "PASS", "count": len(rows), "bytes": len(value), "errors": 0, "expected_errors": len(errors)}


def iter_rows(directory):
    index = json.loads((directory / "index.json").read_text())
    for chunk in index["chunks"]:
        with open(directory / chunk["file"], encoding="ascii") as stream:
            for line in stream:
                yield json.loads(line)


def normalize_xattrs(value):
    if not isinstance(value, dict) or value.get("status") != "OK" or not isinstance(value.get("values"), dict):
        raise Rejected("XATTR_COMPARISON_REQUIRES_OK_RAW_VALUES")
    return {"status": "OK", "nonempty_values": {k: v for k, v in value["values"].items() if v != EMPTY_XATTR_SHA256},
            "empty_names": sorted(k for k, v in value["values"].items() if v == EMPTY_XATTR_SHA256)}


def xattr_classes(before, after, which):
    # Apply exactly the same normalization to both sides, retaining empty names.
    na, nb = normalize_xattrs(before), normalize_xattrs(after)
    av, bv = before["values"], after["values"]
    rows = []
    for name in sorted(set(av) | set(bv)):
        if av.get(name) == bv.get(name):
            continue
        # These are final inventories, after re-apply. Residual/new omissions are
        # real differences; only the pre-reapply observation log uses ditto class.
        rows.append({"name": name, "classification": "REAL_XATTR_DIFFERENCE",
                     "before": av.get(name), "after": bv.get(name)})
    return na, nb, rows


def empty_xattr_reapply(cfg):
    receipt = Path(cfg["receipt"])
    before = receipt / "before"
    sealed = json.loads((before / "seal.json").read_text())
    if digest_file(before / "index.json", cfg) != sealed["index_sha256"]:
        raise Rejected("SEALED_INDEX_CHANGED_BEFORE_REAPPLY")
    index = json.loads((before / "index.json").read_text())
    collector = Collector(cfg)
    counts = {"count": 0, "known_ditto_omissions": 0, "reapplied": 0, "already_present": 0, "real_differences": 0, "errors": 0}
    log = receipt / "empty-xattr-reapply.jsonl"
    with open(log, "x", encoding="ascii") as out:
        def emit(record):
            out.write(canonical(record) + "\n")
            out.flush()
            os.fsync(out.fileno())
        try:
            for chunk in index["chunks"]:
                if digest_file(before / chunk["file"], cfg) != chunk["sha256"]:
                    raise Rejected("SEALED_CHUNK_CHANGED_BEFORE_REAPPLY")
                with open(before / chunk["file"], encoding="ascii") as stream:
                    for line in stream:
                        check_time(cfg)
                        row = json.loads(line)
                        names = normalize_xattrs(row["xattrs"])["empty_names"]
                        if not names:
                            continue
                        # Anchor every ancestor with O_NOFOLLOW, then use only its leaf.
                        fd = os.open(cfg["dest"], os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
                        try:
                            parts = row["path"].split("/")
                            for component in parts[:-1]:
                                nextfd = os.open(component, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=fd)
                                os.close(fd)
                                fd = nextfd
                            os.fchdir(fd)
                            leaf = parts[-1]
                            for name in names:
                                counts["count"] += 1
                                record = {"path": row["path"], "name": name, "expected_sha256": EMPTY_XATTR_SHA256}
                                try:
                                    check_time(cfg)
                                    fault(cfg, "empty-xattr-reapply", row["path"], "xattrs")
                                    actual = collector.native_xattrs(leaf)["values"]
                                    if name in actual:
                                        if actual[name] == EMPTY_XATTR_SHA256:
                                            counts["already_present"] += 1
                                            record.update(classification="PRESERVED_EMPTY_VALUE", action="NONE", status="PASS")
                                        else:
                                            counts["real_differences"] += 1
                                            record.update(classification="REAL_XATTR_DIFFERENCE", action="NONE_NONEMPTY_NEVER_OVERWRITTEN", actual_sha256=actual[name], status="DIFFERENCE")
                                        emit(record)
                                        continue
                                    counts["known_ditto_omissions"] += 1
                                    record.update(classification="DITTO_EMPTY_VALUE_OMISSION", observation="ABSENT", action="REAPPLY_EMPTY_CREATE_NOFOLLOW", status="ATTEMPT")
                                    emit(record)
                                    collector.ok(collector.lib.setxattr(os.fsencode(leaf), os.fsencode(name), b"", 0, 0, 1 | 2))
                                    if collector.native_xattrs(leaf)["values"].get(name) != EMPTY_XATTR_SHA256:
                                        raise Rejected("EMPTY_XATTR_REAPPLY_READBACK_FAILED")
                                    check_time(cfg)
                                    counts["reapplied"] += 1
                                    emit({**record, "status": "PASS", "readback_sha256": EMPTY_XATTR_SHA256})
                                except Exception as exc:
                                    emit({**record, "status": "FAIL", "error": error_record(row["path"], "xattrs", exc)})
                                    raise
                        finally:
                            os.close(fd)
        except Exception as exc:
            counts["errors"] += 1
            summary = {"status": "FAIL", **counts, "reason": str(exc), "artifact": str(log)}
            write_json(receipt / "empty-xattr-reapply.json", summary)
            return summary
    summary = {"status": "PASS", **counts, "artifact": str(log),
               "gate_scope": "re-apply operations only; observed real differences remain for independent final copy/source comparisons",
               "sha256": digest_file(log, cfg), "semantics": XATTR_COPY_SEMANTICS}
    write_json(receipt / "empty-xattr-reapply.json", summary, cfg, seal=True)
    return summary


def topology(directory, cfg):
    # Store relative-path groups in SQLite so inode ordering across copies is irrelevant.
    # Keep even auxiliary SQLite storage inside the authorized receipt tree.
    with tempfile.NamedTemporaryFile(prefix="topology-", suffix=".sqlite", dir=cfg["receipt"], delete=False) as temporary:
        temporary_path = temporary.name
    db = sqlite3.connect(temporary_path)
    db.execute("PRAGMA temp_store=FILE")
    db.execute("PRAGMA cache_size=-4096")
    db.execute("CREATE TABLE groups(data TEXT PRIMARY KEY)")
    with open(directory / "hardlinks.jsonl", "rb") as stream:
        digest, length = hashlib.sha256(), 0
        while True:
            check_time(cfg)
            data = stream.read(65536)
            if not data:
                break
            pieces = data.split(b"\n")
            for i, piece in enumerate(pieces):
                digest.update(piece)
                length += len(piece)
                if i < len(pieces) - 1:
                    db.execute("INSERT INTO groups VALUES(?)", (digest.hexdigest(),))
                    digest, length = hashlib.sha256(), 0
        if length:
            raise Rejected("INVALID_HARDLINK_JSONL")
    return db


def diff(cfg, which):
    delay(cfg, "diff")
    receipt = Path(cfg["receipt"])
    before = receipt / "before"
    after = receipt / ("dest-after" if which == "copy-diff" else "source-after")
    a, b = iter(iter_rows(before)), iter(iter_rows(after))
    ra, rb = next(a, None), next(b, None)
    counts = {"diff_fields": 0, "diff_paths": 0, "acl_differences": 0, "hardlink_differences": 0,
              "known_ditto_omissions": 0, "real_xattr_differences": 0}
    path = receipt / (which + ".jsonl")
    classification_path = receipt / (which + "-xattr-classification.jsonl")
    with open(path, "x", encoding="ascii") as out, open(classification_path, "x", encoding="ascii") as classifications:
        def emit(rel, field, va, vb):
            out.write(canonical({"path": rel, "field": field, "before": va, "after": vb}) + "\n")
            counts["diff_fields"] += 1
            if field in ("acl", "acl_path_missing", "acl_path_added"):
                counts["acl_differences"] += 1
        while ra is not None or rb is not None:
            check_time(cfg)
            changed = False
            if rb is None or (ra is not None and os.fsencode(ra["path"]) < os.fsencode(rb["path"])):
                emit(ra["path"], "missing", ra, None)
                emit(ra["path"], "acl_path_missing", ra["acl"], None)
                ra = next(a, None)
                changed = True
            elif ra is None or os.fsencode(rb["path"]) < os.fsencode(ra["path"]):
                emit(rb["path"], "added", None, rb)
                emit(rb["path"], "acl_path_added", None, rb["acl"])
                rb = next(b, None)
                changed = True
            else:
                for field in FIELDS:
                    va, vb = ra.get(field), rb.get(field)
                    if field == "xattrs":
                        va, vb, classes = xattr_classes(va, vb, which)
                        for item in classes:
                            classifications.write(canonical({"path": ra["path"], **item}) + "\n")
                            counts["known_ditto_omissions" if item["classification"] == "DITTO_EMPTY_VALUE_OMISSION" else "real_xattr_differences"] += 1
                    if va != vb:
                        emit(ra["path"], field, va, vb)
                        changed = True
                ra, rb = next(a, None), next(b, None)
            counts["diff_paths"] += int(changed)
        ta, tb = topology(before, cfg), topology(after, cfg)
        ga = (x[0] for x in ta.execute("SELECT data FROM groups ORDER BY data"))
        gb = (x[0] for x in tb.execute("SELECT data FROM groups ORDER BY data"))
        va, vb = next(ga, None), next(gb, None)
        while va is not None or vb is not None:
            check_time(cfg)
            if va == vb:
                va, vb = next(ga, None), next(gb, None)
                continue
            if vb is None or (va is not None and va < vb):
                emit(".", "hardlink_group_missing", {"group_sha256": va, "artifact": str(before / "hardlinks.jsonl")}, None)
                va = next(ga, None)
            else:
                emit(".", "hardlink_group_added", None, {"group_sha256": vb, "artifact": str(after / "hardlinks.jsonl")})
                vb = next(gb, None)
            counts["hardlink_differences"] += 1
        ta.close()
        tb.close()
        out.flush()
        os.fsync(out.fileno())
        classifications.flush()
        os.fsync(classifications.fileno())
    check_time(cfg)
    return {"status": "FAIL" if counts["diff_fields"] else "PASS", **counts, "artifact": str(path), "sha256": digest_file(path, cfg),
            "xattr_classification_artifact": str(classification_path), "xattr_classification_sha256": digest_file(classification_path, cfg),
            "xattr_normalization": XATTR_COPY_SEMANTICS["normalization"]}


def within(root, path):
    return os.path.commonpath([os.path.abspath(root), os.path.abspath(path)]) == os.path.abspath(root)


def safe_member(root, relative, allow_missing=False):
    if os.path.isabs(relative) or ".." in relative.split("/"):
        raise Rejected("INVALID_RELATIVE_PATH")
    path = os.path.join(root, relative)
    # Never resolve a fixture symlink (especially an absolute or dangling one).
    parts = relative.split("/")
    probe = root
    for i, part in enumerate(parts):
        if part in ("", "."):
            continue
        probe = os.path.join(probe, part)
        try:
            info = os.lstat(probe)
        except FileNotFoundError:
            if allow_missing:
                break
            raise
        if stat.S_ISLNK(info.st_mode) and i < len(parts) - 1:
            raise Rejected("SYMLINK_ANCESTOR")
    return path


def copy_proxy(cfg):
    test = cfg.get("plan", {}).get("copy_test")
    if test:
        if test.get("ignore_term"):
            signal.signal(signal.SIGTERM, signal.SIG_IGN)
        child = None
        if test.get("spawn_child"):
            child = subprocess.Popen([sys.executable, "-c", "import signal,time; signal.signal(signal.SIGTERM,signal.SIG_IGN); time.sleep(300)"])
        write_json(Path(cfg["receipt"]) / "copy-test-processes.json", {"pid": os.getpid(), "child_pid": child.pid if child else None})
        time.sleep(test.get("sleep", 0))
        return {"status": "PASS"}
    # Injection occurs within an explicit copy-step proxy before ditto starts.
    # Its event is labelled precisely; it is not proof of an in-ditto byte-copy race.
    test_event(cfg, "during_copy")
    result = subprocess.run(cfg["ditto_argv"])
    if result.returncode:
        raise Rejected("DITTO_RC_%d" % result.returncode)
    return {"status": "PASS"}


def seal_rollback(cfg):
    delay(cfg, "seal")
    current_source = os.lstat(cfg["source"])
    if (current_source.st_dev, current_source.st_ino) != (cfg["source_view"]["dev"], cfg["source_view"]["ino"]):
        raise Rejected("SOURCE_VIEW_IDENTITY_CHANGED_AT_SEAL")
    receipt = Path(cfg["receipt"])
    evidence = json.loads((receipt / "seal-input.json").read_text())
    hashes = {}
    for name in ("before", "dest-after", "source-after"):
        directory = receipt / name
        index = json.loads((directory / "index.json").read_text())
        # Fresh re-read all sealed inventories, names, ACL and topology before acceptance.
        for item in index["chunks"]:
            if digest_file(directory / item["file"], cfg) != item["sha256"]:
                raise Rejected("SEALED_CHUNK_CHANGED")
        for filename, expected in index["artifact_hashes"].items():
            if digest_file(directory / filename, cfg) != expected:
                raise Rejected("SEALED_ARTIFACT_CHANGED")
        sealed = json.loads((directory / "seal.json").read_text())
        actual = digest_file(directory / "index.json", cfg)
        if actual != sealed["index_sha256"]:
            raise Rejected("SEALED_INDEX_CHANGED")
        hashes[name] = actual
    document = {"version": VERSION, "status": "PASS", "scope": "OFFLINE_SYNTHETIC_ONLY", "install_state": "not_started",
                "source_view": cfg["source_view"], "source": cfg["source"], "dest": cfg["dest"], "exclusions": [],
                "inventory_index_sha256": hashes, "checks": evidence["checks"], "sealed_mono": time.monotonic(),
                "deadline_mono": cfg["deadline_mono"]}
    write_json(receipt / "rollback-preimage.json", document, cfg, seal=True)
    seal = {"sha256": digest_file(receipt / "rollback-preimage.json", cfg), "sealed_mono": time.monotonic()}
    write_json(receipt / "rollback-preimage.seal.json", seal, cfg, seal=True)
    return {"status": "PASS", **seal}


def worker(config, job):
    cfg = json.loads(Path(config).read_text())
    os.environ["SQLITE_TMPDIR"] = cfg["receipt"]
    try:
        check_time(cfg)
        if job == "selftest":
            result = selftest(cfg)
        elif job in ("before", "dest-after", "source-after"):
            result = scan(cfg, job)
        elif job in ("copy-diff", "source-drift"):
            result = diff(cfg, job)
        elif job == "copy-proxy":
            result = copy_proxy(cfg)
        elif job == "empty-xattr-reapply":
            result = empty_xattr_reapply(cfg)
        elif job == "seal":
            result = seal_rollback(cfg)
        else:
            raise Rejected("UNKNOWN_WORKER")
        check_time(cfg)
        usage = resource.getrusage(resource.RUSAGE_SELF)
        result["resources"] = {"maxrss_bytes": usage.ru_maxrss, "user_seconds": usage.ru_utime, "system_seconds": usage.ru_stime,
                               "scope": "this isolated worker process; child resources separate"}
        print(canonical(result))
        return 0
    except Exception as exc:
        result = {"status": "UNKNOWN", "error_category": type(exc).__name__, "errno": getattr(exc, "errno", None), "reason": str(exc)}
        metrics = Path(cfg["receipt"]) / job / "partial-metrics.json"
        if metrics.exists():
            result.update(json.loads(metrics.read_text()))
            result["status"] = "UNKNOWN"
        usage = resource.getrusage(resource.RUSAGE_SELF)
        result["resources"] = {"maxrss_bytes": usage.ru_maxrss, "user_seconds": usage.ru_utime, "system_seconds": usage.ru_stime}
        print(canonical(result))
        return 1


def execute(argv, name, cfg, record):
    start = time.monotonic()
    record.update(argv=argv, start_mono=start, start_epoch=time.time(), remaining_start=remaining(cfg),
                  timeout_seconds=min(cfg["step_timeout_seconds"], remaining(cfg)))
    if remaining(cfg) <= 0:
        record.update(status="NOT_RUN", reason="STAGE_DEADLINE", end_mono=time.monotonic(), elapsed=0)
        return None
    directory = Path(cfg["receipt"])
    stdout_path, stderr_path = directory / (name + ".stdout"), directory / (name + ".stderr")
    with open(stdout_path, "xb") as out, open(stderr_path, "xb") as err:
        process = subprocess.Popen(argv, stdout=out, stderr=err, start_new_session=True)
        record["pid"] = process.pid
        if name == "copy":
            write_json(directory / "copy-running.json", {"pid": process.pid, "pgid": process.pid, "argv": argv,
                       "start_mono": start, "scope": "this isolated subprocess only"})
        timed_out = False
        try:
            process.wait(timeout=record["timeout_seconds"])
        except subprocess.TimeoutExpired:
            timed_out = True
            record["termination"] = {"process_group": process.pid, "sigterm_mono": time.monotonic(), "grace_seconds": 0.15}
            try:
                os.killpg(process.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
            try:
                process.wait(timeout=0.15)
            except subprocess.TimeoutExpired:
                pass
            # Kill the group even if its leader exited; grandchildren must not survive.
            try:
                os.killpg(process.pid, signal.SIGKILL)
                record["termination"]["sigkill_mono"] = time.monotonic()
            except ProcessLookupError:
                record["termination"]["group_already_absent"] = True
            process.wait(timeout=1)
            record["termination"]["leader_reaped"] = True
    end = time.monotonic()
    record.update(rc=process.returncode, end_mono=end, end_epoch=time.time(), elapsed=end - start,
                  remaining_end=remaining(cfg), stdout=str(stdout_path), stderr=str(stderr_path),
                  stdout_sha256=digest_file(stdout_path), stderr_sha256=digest_file(stderr_path),
                  stderr_bytes=stderr_path.stat().st_size)
    if timed_out:
        record.update(status="UNKNOWN", reason="STAGE_DEADLINE" if end >= cfg["deadline_mono"] else "STEP_TIMEOUT")
        return None
    if end >= cfg["deadline_mono"]:
        record.update(status="UNKNOWN", reason="STAGE_DEADLINE")
        return None
    if process.returncode:
        record.update(status="UNKNOWN", reason="SUBCOMMAND_RC_%d" % process.returncode)
        try:
            record["worker_result"] = json.loads(stdout_path.read_text())
        except (ValueError, UnicodeError):
            pass
        return None
    record["status"] = "PASS"
    return stdout_path


def controller(args):
    # Validation precedes receipt creation and all source-tree access.
    if (not all(math.isfinite(value) for value in (args.reserve_seconds, args.stage_budget_seconds, args.step_timeout_seconds, args.window_deadline_epoch))
            or args.reserve_seconds < 600 or args.stage_budget_seconds <= 0 or args.step_timeout_seconds <= 0 or args.chunk_entries <= 0):
        raise Rejected("INVALID_BUDGET: explicit >=600s subsequent-stage reserve required")
    if not args.source_view_id.strip():
        raise Rejected("SOURCE_VIEW_ID_MISSING")
    isolation = os.path.realpath(args.isolation_root)
    expected = os.path.realpath("/tmp/v5-rebuild/c6-fix-tests")
    if isolation != expected:
        raise Rejected("ISOLATION_ROOT_MUST_BE_C6_FIX_TESTS")
    os.makedirs(isolation, exist_ok=True)
    paths = {}
    for name in ("source", "dest", "receipt"):
        lexical = os.path.abspath(getattr(args, name))
        # Normalize only the known /tmp alias, never a fixture's symlink.
        lexical_root = os.path.abspath(args.isolation_root)
        if not within(lexical_root, lexical) or lexical == lexical_root:
            raise Rejected("PATH_OUTSIDE_ISOLATION " + name)
        rel = os.path.relpath(lexical, lexical_root)
        paths[name] = safe_member(isolation, rel, allow_missing=(name != "source"))
    source, dest, receipt = paths["source"], paths["dest"], paths["receipt"]
    for a, b in ((source, dest), (source, receipt), (dest, receipt), (receipt, dest)):
        if within(a, b):
            raise Rejected("NESTED_SOURCE_DEST_OR_RECEIPT")
    if os.path.lexists(dest) or os.path.lexists(receipt):
        raise Rejected("DEST_AND_RECEIPT_MUST_BE_UNIQUE_NEW_PATHS")
    source_st = os.lstat(source)
    if not stat.S_ISDIR(source_st.st_mode):
        raise Rejected("SOURCE_ROOT_NOT_DIRECTORY")
    deadline = min(ENTRY_MONO + args.stage_budget_seconds,
                   ENTRY_MONO + args.window_deadline_epoch - ENTRY_WALL - args.reserve_seconds)
    if deadline <= time.monotonic():
        raise Rejected("NO_STAGE_BUDGET_AFTER_RESERVE")
    plan = {}
    if args.test_plan:
        plan_path = os.path.abspath(args.test_plan)
        if not within(os.path.abspath(args.isolation_root), plan_path):
            raise Rejected("TEST_PLAN_OUTSIDE_ISOLATION")
        plan = json.loads(Path(safe_member(isolation, os.path.relpath(plan_path, os.path.abspath(args.isolation_root)))).read_text())
    cfg = {**paths, "version": VERSION, "isolation_root": isolation, "entry_mono": ENTRY_MONO, "entry_epoch": ENTRY_WALL,
           "deadline_mono": deadline, "window_deadline_epoch": args.window_deadline_epoch, "reserve_seconds": args.reserve_seconds,
           "stage_budget_seconds": args.stage_budget_seconds, "step_timeout_seconds": args.step_timeout_seconds,
           "xattr_backend": args.xattr_backend, "chunk_entries": args.chunk_entries, "plan": plan, "exclusions": [],
           "source_view": {"id": args.source_view_id, "kind": args.source_view_kind, "dev": source_st.st_dev, "ino": source_st.st_ino,
                           "authority": "caller-asserted synthetic barrier; not production admission"},
           "ditto_argv": ["/usr/bin/ditto", "--rsrc", "--extattr", "--acl", source, dest]}
    os.mkdir(receipt, 0o700)
    config = Path(receipt) / "run-config.json"
    write_json(config, cfg, cfg, seal=True)
    result = {"version": VERSION, "status": "FAIL", "scope": "OFFLINE_SYNTHETIC_ONLY", "install_state": "not_started",
              "xattr_copy_semantics": XATTR_COPY_SEMANTICS,
              "exclusions": [], "config": str(config), "entry_mono": ENTRY_MONO, "deadline_mono": deadline,
              "checks": {key: {"status": "NOT_RUN", "reason": "prior gate not completed"} for key in CHECKS}, "steps": {}}
    script = os.path.abspath(__file__)
    acl_time = 0.0
    def job(name, key=None):
        nonlocal acl_time
        step = result["steps"].setdefault(name, {})
        output = execute([sys.executable, script, "--worker", str(config), name], name, cfg, step)
        if output is None:
            partial = step.get("worker_result", {})
            acl_time += partial.get("acl_seconds", 0)
            step.update(count=partial.get("count", 0), bytes=partial.get("data_bytes", 0), errors=partial.get("errors", 1),
                        resources=partial.get("resources", {}))
            if key:
                result["checks"][key] = {**partial, "status": step["status"], "reason": step.get("reason"), "step": name}
            return None
        data = json.loads(output.read_text())
        acl_time += data.get("acl_seconds", 0)
        step.update(count=data.get("count", data.get("diff_paths", 0)), bytes=data.get("data_bytes", data.get("bytes", 0)),
                    errors=data.get("errors", data.get("diff_fields", 0)), resources=data.get("resources", {}))
        if key:
            result["checks"][key] = data
        return data
    failure = None
    try:
        if job("selftest", "collector") is None:
            raise Rejected("COLLECTOR_SELFTEST_FAILED")
        if job("before", "before") is None:
            raise Rejected("BEFORE_NOT_COMPLETE")
        # The before index seal binds names, blocks, ACL and hardlink groups before any copy.
        test_event(cfg, "after_before_seal")
        copy_step = result["steps"].setdefault("copy", {})
        use_proxy = bool(plan.get("copy_test") or any(e["at"] == "during_copy" for e in plan.get("events", [])))
        argv = [sys.executable, script, "--worker", str(config), "copy-proxy"] if use_proxy else cfg["ditto_argv"]
        copied = execute(argv, "copy", cfg, copy_step)
        copy_step.update(count=result["checks"]["before"].get("count"), bytes=result["checks"]["before"].get("data_bytes"),
                         errors=0 if copied is not None else 1,
                         resource_scope="copy bytes/count are requested input coverage; per-ditto peak is not collected here")
        copy_step["ditto_argv"] = cfg["ditto_argv"]
        result["checks"]["copy"] = {"status": copy_step["status"], "reason": copy_step.get("reason"), "rc": copy_step.get("rc")}
        if copied is None:
            raise Rejected("COPY_FAILED")
        test_event(cfg, "before_empty_xattr_reapply")
        reapplied = job("empty-xattr-reapply", "empty_xattr_reapply")
        if reapplied is None or reapplied["status"] != "PASS":
            raise Rejected("EMPTY_XATTR_REAPPLY_FAILED")
        test_event(cfg, "after_copy")
        dest_scan = job("dest-after", "dest_after")
        if dest_scan is not None:
            job("copy-diff", "copy_diff")
        # Independent call: a copy difference never short-circuits source revalidation.
        test_event(cfg, "before_source_after")
        source_scan = job("source-after", "source_after")
        if source_scan is not None:
            job("source-drift", "source_drift")
        comparisons = [result["checks"]["copy_diff"], result["checks"]["source_drift"]]
        for category, field in (("acl", "acl_differences"), ("hardlinks", "hardlink_differences")):
            if all(item["status"] in ("PASS", "FAIL") for item in comparisons):
                result["checks"][category] = {"status": "FAIL" if any(item[field] for item in comparisons) else "PASS",
                                               "copy": comparisons[0][field], "source": comparisons[1][field]}
            else:
                result["checks"][category] = {"status": "NOT_RUN", "reason": "both complete comparison artifacts required"}
        required = [key for key in CHECKS if key != "rollback_seal"]
        if not all(result["checks"][key]["status"] == "PASS" for key in required):
            raise Rejected("PREIMAGE_GATES_NOT_ALL_PASS")
        write_json(Path(receipt) / "seal-input.json", {"checks": result["checks"]}, cfg, seal=True)
        if job("seal", "rollback_seal") is None:
            raise Rejected("ROLLBACK_SEAL_FAILED")
        check_time(cfg)
        result["status"] = "PASS"
    except Exception as exc:
        failure = str(exc)
        result["reason"] = failure
    end = time.monotonic()
    if end >= deadline:
        result.update(status="FAIL", reason="STAGE_DEADLINE")
    if result["status"] != "PASS":
        # A late seal can never masquerade as an accepted rollback artifact.
        for name in ("rollback-preimage.json", "rollback-preimage.seal.json"):
            artifact = Path(receipt) / name
            if artifact.exists():
                artifact.rename(Path(receipt) / (name + ".REJECTED"))
        for item in result["checks"].values():
            if item["status"] == "NOT_RUN":
                item["reason"] = result.get("reason", failure) + "; prerequisites/budget unavailable"
    total = end - ENTRY_MONO
    steps = result["steps"]
    components = {"Tbefore": steps.get("selftest", {}).get("elapsed", 0) + steps.get("before", {}).get("elapsed", 0),
                  "Tcopy": steps.get("copy", {}).get("elapsed", 0) + steps.get("empty-xattr-reapply", {}).get("elapsed", 0),
                  "Tdest": steps.get("dest-after", {}).get("elapsed", 0) + steps.get("copy-diff", {}).get("elapsed", 0),
                  "Tsource_after": steps.get("source-after", {}).get("elapsed", 0) + steps.get("source-drift", {}).get("elapsed", 0),
                  "Tacl": acl_time}
    # Native ACL calls are measured inside scans, then removed from their enclosing component.
    for phase, component in (("before", "Tbefore"), ("dest-after", "Tdest"), ("source-after", "Tsource_after")):
        data = result["checks"].get({"before": "before", "dest-after": "dest_after", "source-after": "source_after"}[phase], {})
        components[component] -= data.get("acl_seconds", 0)
    components["Tseal"] = total - sum(components.values())
    result["timings"] = {**components, "T06": total, "accounting": "nonoverlapping through start of final receipt; stage_06.completion.json includes final receipt serialization/fsync; stdout T06 includes completion marker", "end_mono": end,
                         "remaining_seconds": remaining(cfg), "termination_grace_seconds": 0.15}
    # Failure reporting is an explicit post-deadline administrative write, never a PASS seal.
    try:
        delay(cfg, "final_receipt") if result["status"] == "PASS" else None
        write_json(Path(receipt) / "stage_06.json", result, cfg if result["status"] == "PASS" else None, seal=True)
        if result["status"] == "PASS":
            check_time(cfg)
    except Rejected:
        result.update(status="FAIL", reason="STAGE_DEADLINE_DURING_FINAL_RECEIPT")
        final_receipt = Path(receipt) / "stage_06.json"
        if final_receipt.exists():
            final_receipt.rename(Path(receipt) / "stage_06.json.REJECTED")
        for name in ("rollback-preimage.json", "rollback-preimage.seal.json"):
            artifact = Path(receipt) / name
            if artifact.exists():
                artifact.rename(Path(receipt) / (name + ".REJECTED"))
        # Preserve the deadline-expired partial serialization, then report failure.
        partial = Path(receipt) / "stage_06.json.partial"
        if partial.exists():
            partial.rename(Path(receipt) / "stage_06.json.partial.REJECTED")
        write_json(final_receipt, result, seal=True)
    completed = time.monotonic()
    full_components = {**components, "Tseal": components["Tseal"] + completed - end}
    completion = {"status": result["status"], "reason": result.get("reason"), "timings": {**full_components, "T06": completed - ENTRY_MONO},
                  "receipt_completed_mono": completed, "deadline_mono": deadline,
                  "stage_06_sha256": digest_file(Path(receipt) / "stage_06.json"),
                  "accounting": "includes stage_06.json serialization/fsync and failure finalization; excludes this small completion marker and stdout; stdout T06 includes marker; external wall bounds process exit"}
    try:
        write_json(Path(receipt) / "stage_06.completion.json", completion, cfg if result["status"] == "PASS" else None, seal=True)
        if result["status"] == "PASS":
            check_time(cfg)
    except Rejected:
        result.update(status="FAIL", reason="STAGE_DEADLINE_DURING_COMPLETION_RECEIPT")
        for name in ("stage_06.json", "stage_06.completion.json", "rollback-preimage.json", "rollback-preimage.seal.json"):
            artifact = Path(receipt) / name
            if artifact.exists():
                artifact.rename(Path(receipt) / (name + ".REJECTED"))
        write_json(Path(receipt) / "stage_06.json", result, seal=True)
        partial = Path(receipt) / "stage_06.completion.json.partial"
        if partial.exists():
            partial.rename(Path(receipt) / "stage_06.completion.json.partial.REJECTED")
        completion.update(status="FAIL", reason=result["reason"], stage_06_sha256=digest_file(Path(receipt) / "stage_06.json"))
        write_json(Path(receipt) / "stage_06.completion.json", completion, seal=True)
    print(canonical({"status": result["status"], "receipt": receipt, "reason": result.get("reason"), "T06": time.monotonic() - ENTRY_MONO}))
    return 0 if result["status"] == "PASS" else 1


def main():
    if len(sys.argv) == 4 and sys.argv[1] == "--worker":
        return worker(sys.argv[2], sys.argv[3])
    parser = argparse.ArgumentParser(description=__doc__)
    for option in ("source", "dest", "receipt", "isolation-root", "source-view-id"):
        parser.add_argument("--" + option, required=True)
    parser.add_argument("--source-view-kind", required=True, choices=["synthetic-barrier"])
    for option in ("window-deadline-epoch", "reserve-seconds", "stage-budget-seconds"):
        parser.add_argument("--" + option, type=float, required=True)
    parser.add_argument("--step-timeout-seconds", type=float, default=3600)
    parser.add_argument("--chunk-entries", type=int, default=2048)
    parser.add_argument("--xattr-backend", choices=["native", "cli"], default="native")
    parser.add_argument("--test-plan")
    args = parser.parse_args()
    try:
        return controller(args)
    except Exception as exc:
        print(canonical({"status": "FAIL", "install_state": "not_started", "reason": str(exc), "error_category": type(exc).__name__}))
        return 1


if __name__ == "__main__":
    sys.exit(main())
