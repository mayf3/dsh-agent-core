"""Read the original registry only. Qualification is never a JSON flag.

An admitted external caller/freshness adapter does not exist in B. The default
reader therefore preserves that UNKNOWN and refuses. Isolated tests inject the
external observation boundary in Python, never through CLI, request, or env.
"""
import hashlib
import json
import math
from pathlib import Path
import re

DEFAULT_REGISTRY = Path('/Users/yanfenma/Documents/Codex/2026-10-18/zcode-assist/tools/b7ctl/DISPATCH-REGISTRY.json')


def require(ok, message):
    if not ok:
        raise RuntimeError(message)


def strict_json(data):
    def pairs(rows):
        value = {}
        for key, item in rows:
            require(key not in value, '未任命: duplicate JSON key')
            value[key] = item
        return value

    def constant(_):
        raise RuntimeError('未任命: non-JSON constant')

    result = json.loads(data, object_pairs_hook=pairs, parse_constant=constant)
    def finite(value):
        if isinstance(value, float):
            require(math.isfinite(value), '未任命: nonfinite JSON number')
        if isinstance(value, dict):
            for item in value.values():
                finite(item)
        if isinstance(value, list):
            for item in value:
                finite(item)
    finite(result)
    return result


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True,
                      separators=(',', ':'), allow_nan=False).encode('utf-8')


def seal(value):
    return hashlib.sha256(canonical(value)).hexdigest()


def select(registry, selector):
    match = re.fullmatch(r'\$\.([A-Za-z][A-Za-z0-9_]*)\[(id|round)=([^\[\]]+)\]', selector)
    require(match is not None, '未任命: selector must use stable identity')
    collection, key, identity = match.groups()
    rows = registry.get(collection)
    require(isinstance(rows, list), '未任命: registry collection missing')
    require(all(isinstance(row, dict) and isinstance(row.get(key), str) for row in rows),
            '未任命: registry identity schema')
    found = [row for row in rows if row[key] == identity]
    require(len(found) == 1, '未任命: selector count must be one')
    return found[0]


def read_registry(path=DEFAULT_REGISTRY):
    # Path injection is for the read-only adapter's fixture, never Mandate data.
    path = Path(path)
    require(path.is_file() and not path.is_symlink(), '撤销: registry unavailable')
    before = path.stat()
    data = path.read_bytes()
    after = path.stat()
    require((before.st_ino, before.st_mtime_ns, before.st_size) ==
            (after.st_ino, after.st_mtime_ns, after.st_size), '撤销: registry changed during read')
    document = strict_json(data)
    require(isinstance(document, dict), '未任命: registry schema')
    return document


class RegistryReader:
    """B's available read is not an authenticated/freshness-qualified adapter."""

    def observe(self):
        try:
            read_registry()
        except Exception:
            raise RuntimeError('撤销: original registry read unavailable') from None
        raise RuntimeError('未任命: trusted caller/current lifecycle/anti-rollback reader UNKNOWN')
