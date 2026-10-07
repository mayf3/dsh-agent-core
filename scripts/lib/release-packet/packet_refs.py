"""Pin documents, path-reference closure and command rendering (#567 Phase 1).

Generic contracts only — the tool never names an agent, date, host, business
or incident. What counts as a pin or a reference is declared entirely in the
config:

- A pin binding maps a JSON pointer in a pin document to a packet-relative
  file whose sha256 is recomputed from actual bytes (build) or compared
  against actual bytes (verify). Record-map bindings cover documents that pin
  many files (key = packet-relative path, or a path field per record).
- Reference closure scans declared files for absolute path references. A
  reference must resolve inside the packet (and exist), or match the config's
  external allowlist; anything else is a stale-path finding (the #565 class:
  commands pointing at an old task directory).
"""

import json
import os
import re
from pathlib import Path

from packet_model import PacketError, check_rel, sha256_file

# Absolute path tokens: 2+ segments, path characters only. The lookbehind
# keeps "https://host/x" (preceded by ':') and identifiers like "a/b" out.
ABS_PATH_RE = re.compile(r"(?<![\w:@.\-])(/[A-Za-z0-9._@+-]+(?:/[A-Za-z0-9._@+-]+)+)")
PIN_DOC_SCHEMA = "RELEASE_PACKET_PINS_V1"


def parse_pointer(pointer):
    if not pointer.startswith("/"):
        raise PacketError("JSON_POINTER_MALFORMED: %r" % (pointer,))
    return [part.replace("~1", "/").replace("~0", "~") for part in pointer.split("/")[1:]]


def pointer_get(doc, pointer):
    node = doc
    for token in parse_pointer(pointer):
        if not isinstance(node, dict) or token not in node:
            return None, False
        node = node[token]
    return node, True


def pointer_set(doc, pointer, value):
    tokens = parse_pointer(pointer)
    node = doc
    for token in tokens[:-1]:
        child = node.get(token)
        if not isinstance(child, dict):
            child = {}
            node[token] = child
        node = child
    node[tokens[-1]] = value


def _normalize_record_path(value, packet_root, where):
    """Resolve a recorded path to a packet-relative path (or refuse)."""
    text = str(value)
    p = Path(text)
    root = Path(packet_root)
    if p.is_absolute():
        if str(p).startswith(str(root) + os.sep):
            return str(p.relative_to(root))
        raise PacketError("PIN_PATH_OUTSIDE_PACKET: %s (%s)" % (text, where))
    return check_rel(text)


def apply_pin_bindings(packet_root, doc_path, bindings, build):
    """Recompute (build) or check (verify) pinned digests from actual bytes.

    Returns (findings, doc). In build mode the doc is rewritten with paths
    rebound to this packet root and digests recomputed; in verify mode it is
    left untouched and every binding is compared against actual bytes.
    """
    packet_root = Path(packet_root)
    path = Path(doc_path)
    findings = []
    if build:
        doc = {}
    else:
        try:
            doc = json.loads(path.read_bytes().decode("utf-8"))
        except (OSError, ValueError) as exc:
            return [{"code": "PIN_DOC_UNREADABLE", "path": str(path), "detail": str(exc)}], None
    for binding in bindings:
        findings.extend(_apply_binding(packet_root, doc, binding, build, str(path)))
    if build:
        doc_out = dict(doc)
        doc_out["schema"] = PIN_DOC_SCHEMA
        data = (json.dumps(doc_out, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode("utf-8")
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    return findings, doc


def _digest_finding(code, binding, target, expected, observed):
    return {"code": code, "binding": binding.get("pointer"), "target": target, "expected": expected, "observed": observed}


def _apply_binding(packet_root, doc, binding, build, doc_path):
    packet_root = Path(packet_root)
    findings = []
    if "forEach" in binding:
        return _apply_map_binding(packet_root, doc, binding, build, doc_path)
    if "pointer" not in binding:
        raise PacketError("PIN_BINDING_MALFORMED: need pointer or forEach")
    pointer = binding["pointer"]
    rel = binding.get("target")
    target_pointer = binding.get("targetPointer")
    if target_pointer is not None:
        raw, ok = pointer_get(doc, target_pointer)
        if build:
            if not ok or raw is None:
                raise PacketError("PIN_TARGET_POINTER_EMPTY: %s" % target_pointer)
            rel = _normalize_record_path(raw, packet_root, doc_path + target_pointer)
            pointer_set(doc, target_pointer, str(packet_root / rel))
        elif not ok:
            return [{"code": "PIN_TARGET_POINTER_MISSING", "binding": pointer, "target": target_pointer}]
        else:
            try:
                rel = _normalize_record_path(raw, packet_root, doc_path + target_pointer)
            except PacketError as exc:
                return [{"code": "PIN_PATH_OUTSIDE_PACKET", "binding": pointer, "target": str(raw), "detail": str(exc)}]
    if rel is None:
        raise PacketError("PIN_BINDING_MALFORMED: need target or targetPointer")
    target = packet_root / rel
    if not target.is_file():
        return [{"code": "PIN_TARGET_MISSING", "binding": pointer, "target": rel}]
    observed = sha256_file(target)
    if build:
        pointer_set(doc, pointer, observed)
    else:
        recorded, ok = pointer_get(doc, pointer)
        if not ok or recorded is None:
            findings.append({"code": "PIN_DIGEST_ABSENT", "binding": pointer, "target": rel})
        elif recorded != observed:
            findings.append(_digest_finding("PIN_DIGEST_MISMATCH", binding, rel, recorded, observed))
    return findings


def _apply_map_binding(packet_root, doc, binding, build, doc_path):
    packet_root = Path(packet_root)
    findings = []
    container, ok = pointer_get(doc, binding["forEach"])
    if not ok or not isinstance(container, dict):
        if build:
            container = {}
            pointer_set(doc, binding["forEach"], container)
        else:
            return [{"code": "PIN_MAP_MISSING", "binding": binding["forEach"], "target": doc_path}]
    path_key = binding.get("pathKey")
    digest_key = binding.get("digestKey", "sha256")
    bytes_key = binding.get("bytesKey")
    if build and binding.get("paths") is not None:
        for declared in binding["paths"]:
            rel = check_rel(declared)
            container.setdefault(rel, {path_key: str(packet_root / rel)} if path_key else {})
    for name in sorted(container):
        record = container[name]
        if path_key:
            if not isinstance(record, dict):
                findings.append({"code": "PIN_RECORD_MALFORMED", "binding": binding["forEach"], "target": name})
                continue
            raw = record.get(path_key)
            if raw is None:
                findings.append({"code": "PIN_PATH_ABSENT", "binding": binding["forEach"], "target": name})
                continue
            try:
                rel = _normalize_record_path(raw, packet_root, doc_path)
            except PacketError as exc:
                findings.append({"code": "PIN_PATH_OUTSIDE_PACKET", "binding": binding["forEach"], "target": str(raw), "detail": str(exc)})
                continue
            if build:
                record[path_key] = str(packet_root / rel)
        else:
            if not isinstance(record, dict):
                findings.append({"code": "PIN_RECORD_MALFORMED", "binding": binding["forEach"], "target": name})
                continue
            rel = check_rel(name)
        target = packet_root / rel
        if not target.is_file():
            findings.append({"code": "PIN_TARGET_MISSING", "binding": binding["forEach"], "target": rel})
            continue
        observed = sha256_file(target)
        if build:
            record[digest_key] = observed
            if bytes_key:
                record[bytes_key] = target.stat().st_size
        else:
            recorded = record.get(digest_key)
            if recorded is None:
                findings.append({"code": "PIN_DIGEST_ABSENT", "binding": binding["forEach"], "target": rel})
            elif recorded != observed:
                findings.append(_digest_finding("PIN_DIGEST_MISMATCH", binding, rel, recorded, observed))
            if bytes_key and record.get(bytes_key) not in (None, target.stat().st_size):
                findings.append({"code": "PIN_BYTES_MISMATCH", "binding": binding["forEach"], "target": rel,
                                 "expected": record.get(bytes_key), "observed": target.stat().st_size})
    return findings


def extract_absolute_paths(text):
    return sorted(set(m.group(1) for m in ABS_PATH_RE.finditer(text)))


def check_reference_closure(packet_root, file_path, allowlist, blocking):
    """Every absolute path reference must be in-packet (and exist) or allowlisted."""
    packet_root = Path(packet_root)
    path = Path(file_path)
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError as exc:
        return [{"code": "REFERENCE_FILE_UNREADABLE", "path": str(path), "detail": str(exc), "blocking": blocking}]
    findings = []
    allow_exact = set(allowlist or ())
    allow_prefix = tuple(a for a in allow_exact if a.endswith("/"))
    allow_exact = set(a for a in allow_exact if not a.endswith("/"))
    for raw in extract_absolute_paths(text):
        target = Path(os.path.normpath(raw))
        if str(target).startswith(str(packet_root) + os.sep) or target == packet_root:
            if not target.exists():
                findings.append({"code": "BROKEN_REFERENCE", "path": raw, "file": str(path), "blocking": blocking,
                                 "detail": "inside packet but does not exist"})
            continue
        if raw in allow_exact or str(target).startswith(tuple(str(Path(os.path.normpath(a))) + "/" for a in allow_prefix)):
            findings.append({"code": "EXTERNAL_REFERENCE", "path": raw, "file": str(path), "blocking": False,
                             "detail": "allowlisted external reference (recorded, not followed)"})
            continue
        findings.append({"code": "STALE_PATH_REFERENCE", "path": raw, "file": str(path), "blocking": blocking,
                         "detail": "outside the packet and not allowlisted (old task path?)"})
    return findings


def render_command_file(entries, packet_root):
    """Render command entries with {packet_root} bound to this packet."""
    parts = []
    for entry in entries:
        command = str(entry["command"]).replace("{packet_root}", str(packet_root))
        parts.append("%s:\n%s\n" % (entry["label"], command))
    return "".join(parts).encode("utf-8")
