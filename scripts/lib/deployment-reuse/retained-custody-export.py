"""Read-only custody export for the retained B7 r10 placement tree.

Bound to one supplied scope (B7_R10_EXPECTED_RETAINED_SCOPE_DERIVED_ONLY_V1)
and one supplied execution binding (operation/stageSha256/attempt). Every
path is opened O_NOFOLLOW against the checked parent dir_fd; symlink targets
are recorded, never traversed; foreign (extra) regular files and directories
are stat-only and never read or entered. Anomalies never gate continued
measurement (read-only), but any anomaly yields a stop verdict: MATCH is the
only pass and authorizes nothing. Disposal stays with the original bounded
recovery contract; this tool performs zero writes, zero renames, zero deletes
and no identity workaround. UNKNOWN means unreconciled, never absent, never
safe to dispose.

Ancestor path components are opened O_NOFOLLOW with per-component
writability and open-identity checks (their uid is not scope-pinned); the
root directory itself is compared against the scope "." entry (uid/gid
always, mode where the scope pins it). Symlinks are refused, not resolved:
a symlinked retained root fails ROOT_SYMLINK, and an ancestor symlink fails
ROOT_ANCESTOR_SYMLINK unless the logical prefix is in the closed table
KNOWN_ANCESTOR_ALIASES (macOS /var -> /private/var), which substitutes the
table's physical prefix WITHOUT reading the link target and re-verifies the
remaining components; the substitutions applied are recorded in the output.
An object that cannot be observed (read/lstat/open error, blocked by a link
or a type mismatch) is UNKNOWN — never MISSING_OBJECT — and its unobserved
descendants are UNKNOWN/not_observed: unreadable is not absent.

Usage:
  retained-custody-export.py --scope SCOPE.json --binding BINDING.json [--root ROOT]
  retained-custody-export.py --scope SCOPE.json --check-scope

Exit: 0 MATCH (or --check-scope valid) / 2 conservative stop / 3 usage.
Output: single JSON record on stdout. Requires read access to the retained
tree (root-owned 0700 on the deployment host): run under the original owner
identity via ordinary evidence-export admission, not a new B7 operation.
"""
import argparse
import hashlib
import json
import os
import stat
import sys

SCOPE_KIND = "B7_R10_EXPECTED_RETAINED_SCOPE_DERIVED_ONLY_V1"
RECORD_KIND = "B7_RETAINED_CUSTODY_EXPORT_V1"
SCOPE_CAP = 8 << 20
LINK_TARGET_CAP = 4096
HEX = frozenset("0123456789abcdef")


class Stop(Exception):
    def __init__(self, code, detail):
        super().__init__(f"{code}: {detail}")
        self.code, self.detail = code, detail


def need(ok, code, detail):
    if not ok:
        raise Stop(code, detail)


def is_hex64(value):
    return isinstance(value, str) and len(value) == 64 and frozenset(value) <= HEX


def identity(m):
    return (m.st_dev, m.st_ino, m.st_uid, m.st_gid, m.st_mode, m.st_nlink)


def load_binding(path):
    need(isinstance(path, str) and path, "BINDING_MISSING", "--binding file required")
    try:
        with open(path, "rb") as handle:
            raw = handle.read()
    except OSError as e:
        raise Stop("BINDING_MISSING", f"unreadable: {e}")
    need(len(raw) <= 65536, "BINDING_INVALID", "size")
    try:
        value = json.loads(raw)
    except Exception as e:
        raise Stop("BINDING_INVALID", f"parse: {e}")
    need(isinstance(value, dict), "BINDING_INVALID", "not an object")
    op = value.get("operation")
    need(isinstance(op, str) and 8 <= len(op) <= 128
         and all(c.isalnum() or c in "-_." for c in op), "BINDING_INVALID", "operation")
    need(is_hex64(value.get("stageSha256")), "BINDING_INVALID", "stageSha256")
    attempt = value.get("attempt")
    need(isinstance(attempt, int) and not isinstance(attempt, bool) and attempt >= 1,
         "BINDING_INVALID", "attempt")
    for key in ("receiptSha256", "manifestSha256", "packetSha256"):
        if value.get(key) is not None:
            need(is_hex64(value[key]), "BINDING_INVALID", key)
    binding = {k: value.get(k) for k in
               ("operation", "stageSha256", "attempt", "receiptSha256", "manifestSha256", "packetSha256")}
    binding["manifestOperationDigestAgreement"] = bool(
        binding["manifestSha256"] and op.endswith(binding["manifestSha256"][:16]))
    binding["provenance"] = "SUPPLIED_BY_CALLER_NOT_INDEPENDENTLY_AUTHENTICATED"
    return binding


def load_scope(path):
    try:
        st = os.stat(path)
        with open(path, "rb") as handle:
            raw = handle.read()
    except OSError as e:
        raise Stop("SCOPE_UNREADABLE", str(e))
    need(st.st_size == len(raw) and len(raw) <= SCOPE_CAP, "SCOPE_INVALID", "size")
    try:
        scope = json.loads(raw)
    except Exception as e:
        raise Stop("SCOPE_INVALID", f"parse: {e}")
    need(isinstance(scope, dict) and scope.get("kind") == SCOPE_KIND, "SCOPE_INVALID", "kind")
    root = scope.get("root")
    need(isinstance(root, str) and root.startswith("/") and len(root) > 1
         and not root.endswith("/") and root == os.path.normpath(root), "SCOPE_INVALID", "root")
    entries = scope.get("entries")
    need(isinstance(entries, list) and entries, "SCOPE_INVALID", "entries")
    expected, declared_dirs = {}, set()
    for item in entries:
        need(isinstance(item, dict), "SCOPE_INVALID", "entry shape")
        rel = item.get("relative")
        need(isinstance(rel, str) and rel, "SCOPE_INVALID", "relative")
        parts = [] if rel == "." else rel.split("/")
        need(rel != "." or parts == [], "SCOPE_INVALID", "relative .")
        need(all(p not in ("", ".", "..") for p in parts), "SCOPE_INVALID", f"escape: {rel}")
        need(rel not in expected, "SCOPE_INVALID", f"duplicate: {rel}")
        typ = item.get("type")
        need(typ in ("regular", "directory"), "SCOPE_INVALID", f"type: {rel}")
        uid, gid = item.get("expectedUid"), item.get("expectedGid")
        need(isinstance(uid, int) and not isinstance(uid, bool)
             and isinstance(gid, int) and not isinstance(gid, bool), "SCOPE_INVALID", f"uid/gid: {rel}")
        for key, pred in (("expectedMode", lambda v: isinstance(v, str) and len(v) == 4 and v.isdigit()),
                          ("expectedSha256", is_hex64),
                          ("expectedNlink", lambda v: isinstance(v, int) and not isinstance(v, bool) and v >= 1),
                          ("expectedBytes", lambda v: isinstance(v, int) and not isinstance(v, bool) and v >= 0)):
            if item.get(key) is not None:
                need(pred(item[key]), "SCOPE_INVALID", f"{key}: {rel}")
        if typ == "regular":
            need(item.get("expectedBytes") is not None, "SCOPE_INVALID", f"regular without bytes: {rel}")
        if parts:
            parent = "/".join(parts[:-1]) or "."
            need(parent in declared_dirs, "SCOPE_INVALID", f"parent missing: {rel}")
        if typ == "directory":
            declared_dirs.add(rel)
        expected[rel] = item
    need("." in expected and expected["."]["type"] == "directory", "SCOPE_INVALID", "root entry")
    counts = scope.get("expectedCounts")
    need(isinstance(counts, dict), "SCOPE_INVALID", "expectedCounts")
    counted = {"regularFiles": sum(1 for e in expected.values() if e["type"] == "regular"),
               "directories": sum(1 for e in expected.values() if e["type"] == "directory"),
               "symlinks": 0, "entries": len(expected),
               "regularBytes": sum(e["expectedBytes"] for e in expected.values() if e["type"] == "regular")}
    for key in ("regularFiles", "directories", "symlinks", "entries", "regularBytes"):
        need(counts.get(key) == counted[key], "SCOPE_INVALID", f"expectedCounts.{key}")
    return {"root": root, "rawSha256": hashlib.sha256(raw).hexdigest(), "expected": expected,
            "counts": counts,
            "sourceItemlistSha256": scope.get("sourceItemlistSha256"),
            "sourceOutputSha256": scope.get("sourceOutputSha256"),
            "operationSourceArchiveSha256": scope.get("operationSourceArchiveSha256")}


# Closed allowlist of ancestor aliases: key = logical prefix of the requested
# root, value = canonical symlink-free physical prefix (every component of the
# value is still verified during the walk). Extending this table is a contract
# change, not a runtime decision.
KNOWN_ANCESTOR_ALIASES = {"/var": "/private/var"}


def root_chain(root, root_entry):
    uid, gid = root_entry["expectedUid"], root_entry["expectedGid"]
    chain, substitutions, all_fds, current = [], [], [os.open("/", os.O_RDONLY | os.O_DIRECTORY)], ""
    fd = all_fds[0]
    cleaned = False

    def cleanup():
        nonlocal cleaned
        if not cleaned:
            cleaned = True
            for handle in all_fds:
                try:
                    os.close(handle)
                except OSError:
                    pass

    def fail(code, detail):
        cleanup()
        raise Stop(code, detail)

    try:
        original = [p for p in root.split("/") if p]
        queue = [(p, p) for p in original]
        consumed_logical, logical_current = 0, ""
        index = 0
        while index < len(queue):
            part, logical_name = queue[index]
            index += 1
            current += "/" + part
            if logical_name is not None:
                consumed_logical += 1
                logical_current = "/" + "/".join(original[:consumed_logical])
            try:
                before = os.stat(part, dir_fd=fd, follow_symlinks=False)
            except OSError as e:
                fail("ROOT_ABSENT" if isinstance(e, FileNotFoundError) else "UNKNOWN",
                     f"root walk {current}: {e}")
            if stat.S_ISLNK(before.st_mode):
                if index == len(queue):
                    fail("ROOT_SYMLINK", f"retained root itself is a symlink: {current}")
                physical = KNOWN_ANCESTOR_ALIASES.get(logical_current)
                if physical is None:
                    fail("ROOT_ANCESTOR_SYMLINK", f"unapproved ancestor symlink: {current}")
                if len(substitutions) >= 4:
                    fail("ROOT_ANCESTOR_SYMLINK", "alias substitution limit exceeded")
                substitutions.append({"logicalPrefix": logical_current, "physicalPrefix": physical,
                                      "source": "KNOWN_ANCESTOR_ALIASES"})
                cleanup()
                cleaned = False
                all_fds = [os.open("/", os.O_RDONLY | os.O_DIRECTORY)]
                fd = all_fds[0]
                queue = ([(p, None) for p in physical.split("/") if p]
                         + [(n, n) for n in original[consumed_logical:]])
                current, index, chain = "", 0, []
                continue
            if not stat.S_ISDIR(before.st_mode):
                fail("ROOT_CUSTODY", f"not a directory: {current}")
            if before.st_mode & 0o022:
                fail("ROOT_CUSTODY", f"writable component: {current}")
            nxt = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=fd)
            all_fds.append(nxt)
            if identity(before) != identity(os.fstat(nxt)):
                fail("ROOT_CUSTODY", f"changed: {current}")
            chain.append({"path": current, "uid": before.st_uid, "gid": before.st_gid,
                          "mode": format(stat.S_IMODE(before.st_mode), "04o")})
            os.close(fd)
            all_fds.remove(fd)
            fd = nxt
        top = os.stat(".", dir_fd=fd, follow_symlinks=False)
        measured = {"uid": top.st_uid, "gid": top.st_gid, "mode": format(stat.S_IMODE(top.st_mode), "04o"),
                    "nlink": top.st_nlink, "dev": top.st_dev, "ino": top.st_ino}
        if measured["uid"] != uid or measured["gid"] != gid:
            fail("DRIFT", f"root uid/gid {measured['uid']}:{measured['gid']}")
        mode = root_entry.get("expectedMode")
        if mode is not None and measured["mode"] != mode:
            fail("DRIFT", f"root mode {measured['mode']} != {mode}")
    except BaseException:
        cleanup()
        raise
    return {"requested": root, "aliasSubstitutions": substitutions, "chain": chain, "root": measured}, fd


def measure(expected, dir_fd):
    inventory, anomalies, blocked = [], [], set()

    def drift(rel, detail):
        anomalies.append({"class": "DRIFT", "relative": rel, "detail": detail})

    def note(cls, rel, **fields):
        anomalies.append(dict({"class": cls, "relative": rel}, **fields))

    def walk(rel, fd):
        for name in sorted(os.listdir(fd)):
            child = name if rel == "." else f"{rel}/{name}"
            item = expected.get(child)
            try:
                st = os.stat(name, dir_fd=fd, follow_symlinks=False)
            except OSError as e:
                note("UNKNOWN", child, detail=str(e))
                blocked.add(child)
                continue
            if stat.S_ISLNK(st.st_mode):
                try:
                    target = os.readlink(name, dir_fd=fd)
                except OSError as e:
                    target = f"UNREADABLE:{e}"
                note("LINK_OBJECT", child, target=target[:LINK_TARGET_CAP])
                if item is not None and item["type"] == "directory":
                    blocked.add(child)
                inventory.append({"relative": child, "type": "symlink", "uid": st.st_uid, "gid": st.st_gid,
                                  "mode": format(stat.S_IMODE(st.st_mode), "04o"), "nlink": st.st_nlink})
                continue
            if item is None:
                kind = "directory" if stat.S_ISDIR(st.st_mode) else "regular"
                note("EXTRA_OBJECT", child, measuredType=kind)
                inventory.append({"relative": child, "type": kind, "uid": st.st_uid, "gid": st.st_gid,
                                  "mode": format(stat.S_IMODE(st.st_mode), "04o"), "nlink": st.st_nlink,
                                  "read": False})
                continue
            measured = {"relative": child, "type": item["type"], "uid": st.st_uid, "gid": st.st_gid,
                        "mode": format(stat.S_IMODE(st.st_mode), "04o"), "nlink": st.st_nlink}
            if stat.S_ISDIR(st.st_mode) and item["type"] == "directory":
                if measured["uid"] != item["expectedUid"] or measured["gid"] != item["expectedGid"]:
                    drift(child, "uid/gid")
                mode = item.get("expectedMode")
                if mode is not None and measured["mode"] != mode:
                    drift(child, f"mode {measured['mode']} != {mode}")
                try:
                    nxt = os.open(name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=fd)
                except OSError as e:
                    note("UNKNOWN", child, detail=f"open: {e}")
                    blocked.add(child)
                    inventory.append(measured)
                    continue
                try:
                    if identity(st) != identity(os.fstat(nxt)):
                        note("UNKNOWN", child, detail="changed during open")
                        blocked.add(child)
                        inventory.append(measured)
                        continue
                    inventory.append(measured)
                    walk(child, nxt)
                finally:
                    os.close(nxt)
            elif stat.S_ISREG(st.st_mode) and item["type"] == "regular":
                if measured["uid"] != item["expectedUid"] or measured["gid"] != item["expectedGid"]:
                    drift(child, "uid/gid")
                mode = item.get("expectedMode")
                if mode is not None and measured["mode"] != mode:
                    drift(child, f"mode {measured['mode']} != {mode}")
                nlink = item.get("expectedNlink")
                if nlink is not None and measured["nlink"] != nlink:
                    drift(child, f"nlink {measured['nlink']} != {nlink}")
                if st.st_size != item["expectedBytes"]:
                    drift(child, f"size {st.st_size} != {item['expectedBytes']}")
                try:
                    handle = os.open(name, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=fd)
                except OSError as e:
                    note("UNKNOWN", child, detail=f"open: {e}")
                    inventory.append(measured)
                    continue
                try:
                    if identity(os.fstat(handle)) != identity(st):
                        note("UNKNOWN", child, detail="changed during open")
                        inventory.append(measured)
                        continue
                    digest, total = hashlib.sha256(), 0
                    while True:
                        chunk = os.read(handle, 1 << 20)
                        if not chunk:
                            break
                        digest.update(chunk)
                        total += len(chunk)
                    if identity(os.fstat(handle)) != identity(st) or total != st.st_size:
                        note("UNKNOWN", child, detail="changed during read")
                        inventory.append(measured)
                        continue
                finally:
                    os.close(handle)
                measured["bytes"], measured["sha256"], measured["read"] = total, digest.hexdigest(), True
                sha = item.get("expectedSha256")
                if sha is not None and measured["sha256"] != sha:
                    drift(child, "sha256")
                inventory.append(measured)
            else:
                drift(child, f"scope type {item['type']} not found on site")
                if item["type"] == "directory":
                    blocked.add(child)
                inventory.append(measured)

    walk(".", dir_fd)
    measured_paths = {e["relative"] for e in inventory}
    for rel in sorted(k for k in expected if k != "." and k not in measured_paths):
        blocker = next((b for b in blocked if rel == b or rel.startswith(b + "/")), None)
        if blocker is not None:
            note("UNKNOWN", rel, reason="not_observed", blockedAncestor=blocker)
        else:
            note("MISSING_OBJECT", rel)
    return inventory, anomalies


def run(scope_path, binding_path, root_arg=None, check_scope_only=False):
    scope = load_scope(scope_path)
    record = {"kind": RECORD_KIND, "zeroWrites": True,
              "scope": {k: scope[k] for k in ("root", "rawSha256", "counts", "sourceItemlistSha256",
                                             "sourceOutputSha256", "operationSourceArchiveSha256")}}
    if check_scope_only:
        record["verdict"], record["checkScopeOnly"] = "SCOPE_VALID", True
        return 0, record
    record["binding"] = load_binding(binding_path)
    root = scope["root"]
    if root_arg is not None:
        need(root_arg == root, "ROOT_MISMATCH", f"{root_arg} != scope root {root}")
    custody, dir_fd = root_chain(root, scope["expected"]["."])
    try:
        inventory, anomalies = measure(scope["expected"], dir_fd)
    finally:
        os.close(dir_fd)
    files = [e for e in inventory if e["type"] == "regular"]
    record["rootCustody"] = custody
    record["measuredCounts"] = {"entries": len(inventory) + 1,
                                "regularFiles": len(files),
                                "directories": 1 + sum(1 for e in inventory if e["type"] == "directory"),
                                "symlinks": sum(1 for e in inventory if e["type"] == "symlink"),
                                "regularBytes": sum(e.get("bytes", 0) for e in files)}
    record["inventory"], record["anomalies"] = inventory, anomalies
    record["verdict"] = anomalies[0]["class"] if anomalies else "MATCH"
    record["stopDetail"] = anomalies[0] if anomalies else None
    record["disposal"] = {"performed": False, "authorizedByThisTool": False,
                          "record": "retained pending the original bounded recovery/disposal contract; "
                                    "MATCH does not authorize any disposal, replay or cleanup"}
    return (0 if record["verdict"] == "MATCH" else 2), record


def main(argv):
    class Parser(argparse.ArgumentParser):
        def error(self, message):
            self.print_usage(sys.stderr)
            sys.stderr.write(f"retained-custody-export: {message}\n")
            raise SystemExit(3)

    parser = Parser()
    parser.add_argument("--scope", required=True)
    parser.add_argument("--binding")
    parser.add_argument("--root")
    parser.add_argument("--check-scope", action="store_true")
    args = parser.parse_args(argv)
    if not args.check_scope and not args.binding:
        parser.error("--binding is required unless --check-scope")
    try:
        code, record = run(args.scope, args.binding, args.root, args.check_scope)
    except Stop as stop:
        record = {"kind": RECORD_KIND, "zeroWrites": True, "verdict": stop.code,
                  "stopDetail": {"class": stop.code, "detail": stop.detail},
                  "disposal": {"performed": False, "authorizedByThisTool": False,
                               "record": "conservative stop; retained pending the original bounded "
                                         "recovery/disposal contract"}}
        print(json.dumps(record, indent=1, sort_keys=True))
        return 2
    print(json.dumps(record, indent=1, sort_keys=True))
    return code


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
