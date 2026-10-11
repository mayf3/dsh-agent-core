"""Layered release-packet integrity model: digests, manifests, seals (#567 Phase 1).

A packet is a directory whose files are covered by one top MANIFEST.sha256;
a SEAL.json binds the manifest bytes. Any subdirectory declared a "layer"
carries its own MANIFEST.sha256 + SEAL.json pair: the layer manifest lists
every file under the layer except its own manifest and seal, the seal binds
the manifest bytes, and the top manifest covers both files. Verification is
bottom-up from actual bytes, so a stale inner digest can never be masked by a
freshly regenerated top-level manifest, and no file can be added, dropped or
edited without a recorded finding.

Everything here is generic: no agent, date, host, business or incident names.
"""

import hashlib
import json
import os
from pathlib import Path, PurePosixPath

MANIFEST_NAME = "MANIFEST.sha256"
SEAL_NAME = "SEAL.json"
SEAL_SCHEMA = "RELEASE_PACKET_SEAL_V1"
_DIGEST_HEXDIGITS = frozenset("0123456789abcdef")


class PacketError(Exception):
    """Deterministic refusal (bad input, unsafe member, malformed document)."""


class TraversalRefused(PacketError):
    """Refusal raised while walking packet content; carries a finding code."""

    def __init__(self, code, path, detail=None):
        super().__init__("%s: %s" % (code, path))
        self.code = code
        self.path = path
        self.detail = detail


def sha256_bytes(data):
    return hashlib.sha256(data).hexdigest()


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1048576), b""):
            h.update(block)
    return h.hexdigest()


def check_rel(rel):
    """Reject manifest/pin paths that are absolute, escaped or symlink-prone."""
    if not rel or rel.startswith("/") or "\\" in rel:
        raise PacketError("UNSAFE_RELATIVE_PATH: %r" % (rel,))
    parts = PurePosixPath(rel).parts
    if not parts or any(p in ("", ".", "..") for p in parts):
        raise PacketError("UNSAFE_RELATIVE_PATH: %r" % (rel,))
    return rel


def list_files(root, exclude=()):
    """Sorted packet-relative regular-file paths under root; symlinks refused.

    Symlinked directories are rejected too: os.walk lists them in `dirnames`
    without traversing, so a link smuggled in after sealing would otherwise be
    invisible to every manifest.
    """
    exclude = frozenset(exclude)
    out = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames.sort()
        rel_dir = os.path.relpath(dirpath, root)
        for name in dirnames:
            if (Path(dirpath) / name).is_symlink():
                rel = name if rel_dir == "." else "%s/%s" % (rel_dir.replace(os.sep, "/"), name)
                raise TraversalRefused("SYMLINK_IN_PACKET", rel)
        for name in sorted(filenames):
            rel = name if rel_dir == "." else "%s/%s" % (rel_dir.replace(os.sep, "/"), name)
            if rel in exclude:
                continue
            check_rel(rel)
            p = Path(root) / rel
            if p.is_symlink():
                raise PacketError("SYMLINK_IN_PACKET: %s" % rel)
            if not p.is_file():
                raise PacketError("NOT_REGULAR_FILE: %s" % rel)
            out.append(rel)
    return sorted(out)


def manifest_lines(root, rels):
    return ["%s  %s\n" % (sha256_file(Path(root) / rel), rel) for rel in rels]


def render_manifest(lines):
    return "".join(lines).encode("utf-8")


def parse_manifest(text):
    """`<64-hex sha256>  <relative path>` per line (sha256sum -c compatible)."""
    entries = {}
    lineno = 0
    for raw in text.decode("utf-8").splitlines():
        lineno += 1
        if not raw.strip():
            continue
        parts = raw.split("  ", 1)
        if len(parts) != 2 or len(parts[0]) != 64 or not set(parts[0]) <= _DIGEST_HEXDIGITS:
            raise PacketError("MANIFEST_LINE_MALFORMED: line %d" % lineno)
        rel = check_rel(parts[1])
        if rel in entries:
            raise PacketError("MANIFEST_DUPLICATE_PATH: %s" % rel)
        entries[rel] = parts[0]
    return entries


def write_manifest(root, exclude):
    rels = [r for r in list_files(root) if r not in exclude]
    data = render_manifest(manifest_lines(root, rels))
    (Path(root) / MANIFEST_NAME).write_bytes(data)
    return MANIFEST_NAME, rels, sha256_bytes(data)


def verify_manifest(root, exclude=()):
    """Compare a manifest against actual bytes; report the complement too.

    A missing or malformed manifest, and any refused traversal (e.g. a
    symlinked directory), are structured findings — never an aborted verifier.
    """
    root = Path(root)
    exclude = frozenset(exclude)
    try:
        actual = [r for r in list_files(root) if r not in exclude]
    except TraversalRefused as exc:
        detail = {"code": exc.code, "path": exc.path}
        if exc.detail:
            detail["detail"] = exc.detail
        return [detail], []
    except PacketError as exc:
        return [{"code": "PACKET_TRAVERSAL_REFUSED", "path": str(root), "detail": str(exc)}], []
    try:
        recorded = parse_manifest((root / MANIFEST_NAME).read_bytes())
    except OSError:
        return [{"code": "MANIFEST_ABSENT", "path": MANIFEST_NAME}], actual
    except PacketError as exc:
        return [{"code": "MANIFEST_MALFORMED", "path": MANIFEST_NAME, "detail": str(exc)}], actual
    findings = []
    actual_set = set(actual)
    for rel in sorted(recorded):
        p = root / rel
        if not p.is_file():
            findings.append({"code": "MANIFEST_FILE_MISSING", "path": rel, "expected": recorded[rel], "observed": None})
        else:
            observed = sha256_file(p)
            if observed != recorded[rel]:
                findings.append({"code": "DIGEST_MISMATCH", "path": rel, "expected": recorded[rel], "observed": observed})
    for rel in sorted(actual_set - set(recorded)):
        findings.append({"code": "UNLISTED_FILE", "path": rel, "expected": None, "observed": sha256_file(root / rel)})
    return findings, actual


def write_seal(root, kind, manifest_rel=MANIFEST_NAME):
    manifest_path = Path(root) / manifest_rel
    seal = {
        "schema": SEAL_SCHEMA,
        "kind": kind,
        "manifest": manifest_rel,
        "manifestSha256": sha256_file(manifest_path),
        "entries": len(parse_manifest(manifest_path.read_bytes())),
    }
    data = (json.dumps(seal, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode("utf-8")
    (Path(root) / SEAL_NAME).write_bytes(data)
    return sha256_bytes(data), seal


def read_seal(root):
    return json.loads((Path(root) / SEAL_NAME).read_bytes().decode("utf-8"))


def verify_seal(root, kind, manifest_rel=MANIFEST_NAME):
    """Seal must parse, match the expected kind, and bind the manifest bytes."""
    root = Path(root)
    findings = []
    try:
        seal = read_seal(root)
    except (OSError, ValueError) as exc:
        return [{"code": "SEAL_UNREADABLE", "path": SEAL_NAME, "detail": str(exc)}], None
    if not isinstance(seal, dict):
        return [{"code": "SEAL_MALFORMED", "path": SEAL_NAME}], None
    for key in ("schema", "kind", "manifest", "manifestSha256", "entries"):
        if key not in seal:
            findings.append({"code": "SEAL_FIELD_MISSING", "path": SEAL_NAME, "detail": key})
    if findings:
        return findings, seal
    if seal["schema"] != SEAL_SCHEMA:
        findings.append({"code": "SEAL_SCHEMA_UNKNOWN", "path": SEAL_NAME, "observed": seal["schema"]})
    if seal["kind"] != kind:
        findings.append({"code": "SEAL_KIND_MISMATCH", "path": SEAL_NAME, "expected": kind, "observed": seal["kind"]})
    if seal["manifest"] != manifest_rel:
        findings.append({"code": "SEAL_MANIFEST_NAME_MISMATCH", "path": SEAL_NAME, "expected": manifest_rel, "observed": seal["manifest"]})
    manifest_path = root / manifest_rel
    if not manifest_path.is_file():
        findings.append({"code": "MANIFEST_ABSENT", "path": manifest_rel})
    else:
        observed = sha256_file(manifest_path)
        if observed != seal["manifestSha256"]:
            findings.append({"code": "SEAL_DIGEST_MISMATCH", "path": SEAL_NAME, "expected": seal["manifestSha256"], "observed": observed})
        try:
            entries = len(parse_manifest(manifest_path.read_bytes()))
        except PacketError:
            entries = None
        if seal["entries"] != entries:
            findings.append({"code": "SEAL_ENTRY_COUNT_MISMATCH", "path": SEAL_NAME, "expected": seal["entries"], "observed": entries})
    return findings, seal
