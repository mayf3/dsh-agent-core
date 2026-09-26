"""Bounded, read-only whole-host census candidate for the fixed HR cut.

This is not wired into DS.  The old PID identity set and holder roots must
come from a reviewed root-owned source/holder closure, which does not yet
exist.  Direct use without that closure is not a valid r4 proof producer.
"""

import hashlib
import json
import os
import re
import selectors
import subprocess
import time


PS_COMMAND = ["/bin/ps", "-axo", "pid=,ppid=,uid=,comm="]
LSOF_COMMAND = ["/usr/sbin/lsof", "-nP", "-F0pfn"]
MAX_OUTPUT_BYTES = 65536
PS_ROW = re.compile(rb"^\s*(\d+)\s+(\d+)\s+(\d+)\s+([^\r\n\0]+)\s*$")


class Rejected(Exception):
    pass


def require(condition, reason):
    if not condition:
        raise Rejected(reason)


def command_output(argv):
    try:
        child = subprocess.Popen(argv, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                                 stderr=subprocess.PIPE, env={"PATH": "/usr/bin:/bin"})
    except OSError as exc:
        raise Rejected("CENSUS_UNAVAILABLE") from exc
    stdout = bytearray()
    stderr = bytearray()
    deadline = time.monotonic() + 10
    try:
        with selectors.DefaultSelector() as selector:
            selector.register(child.stdout, selectors.EVENT_READ, stdout)
            selector.register(child.stderr, selectors.EVENT_READ, stderr)
            while selector.get_map():
                remaining = deadline - time.monotonic()
                require(remaining > 0, "CENSUS_TIMEOUT")
                ready = selector.select(remaining)
                require(bool(ready), "CENSUS_TIMEOUT")
                for key, _ in ready:
                    output = key.data
                    limit = MAX_OUTPUT_BYTES if output is stdout else 4096
                    block = os.read(key.fileobj.fileno(), min(65536, limit + 1 - len(output)))
                    if not block:
                        selector.unregister(key.fileobj)
                    else:
                        output.extend(block)
                        require(len(output) <= limit, "CENSUS_OUTPUT_BOUND")
        remaining = deadline - time.monotonic()
        require(remaining > 0, "CENSUS_TIMEOUT")
        require(child.wait(timeout=remaining) == 0 and not stderr and bool(stdout),
                "CENSUS_INCOMPLETE")
        return bytes(stdout)
    except subprocess.TimeoutExpired as exc:
        raise Rejected("CENSUS_TIMEOUT") from exc
    finally:
        if child.poll() is None:
            child.kill()
        child.wait()
        child.stdout.close()
        child.stderr.close()


def parse_ps(raw, old_pids):
    scanned = 0
    present = 0
    seen = set()
    for row in raw.splitlines():
        match = PS_ROW.fullmatch(row)
        require(match is not None, "PS_PARSE_UNKNOWN")
        pid = int(match.group(1))
        require(pid > 0 and pid not in seen, "PS_IDENTITY_UNKNOWN")
        seen.add(pid)
        scanned += 1
        if pid in old_pids:
            present += 1
    require(scanned > 0, "PS_EMPTY")
    return scanned, present


def parse_lsof(raw, holder_roots):
    scanned = 0
    holders = 0
    current_pid = None
    current_fd = None
    paths = tuple(os.path.normpath(root) for root in holder_roots)
    require(raw.endswith(b"\0"), "LSOF_INCOMPLETE")
    for token in raw.split(b"\0"):
        token = token.strip(b"\r\n")
        if not token:
            continue
        tag, value = token[:1], token[1:]
        if tag == b"p":
            require(current_fd is None, "LSOF_INCOMPLETE")
            require(value.isdigit() and int(value) > 0, "LSOF_PID_UNKNOWN")
            current_pid = int(value)
            current_fd = None
        elif tag == b"f":
            require(current_fd is None, "LSOF_INCOMPLETE")
            require(current_pid is not None and bool(value), "LSOF_FD_UNKNOWN")
            current_fd = value
        elif tag == b"n":
            require(current_pid is not None and current_fd is not None
                    and bool(value), "LSOF_PATH_UNKNOWN")
            try:
                name = value.decode("utf-8", "strict")
            except UnicodeDecodeError as exc:
                raise Rejected("LSOF_PATH_UNKNOWN") from exc
            require("\x00" not in name and ".." not in name.split("/"),
                    "LSOF_PATH_UNKNOWN")
            scanned += 1
            normalized = os.path.normpath(name)
            if any(normalized == root or normalized.startswith(root + "/")
                   for root in paths):
                holders += 1
            current_fd = None
        else:
            raise Rejected("LSOF_FIELD_UNKNOWN")
    require(current_pid is not None and current_fd is None and scanned > 0, "LSOF_INCOMPLETE")
    return scanned, holders


def collect_whole_host(old_pids, holder_roots):
    """Return only secret-safe normalized summaries and raw-output digests."""
    require(os.geteuid() == 0, "ROOT_REQUIRED")
    require(type(old_pids) is set and old_pids
            and all(type(pid) is int and pid > 0 for pid in old_pids),
            "OLD_TREE_IDENTITY_UNKNOWN")
    require(type(holder_roots) is list and 1 <= len(holder_roots) <= 16
            and len(set(holder_roots)) == len(holder_roots)
            and all(isinstance(path, str) and path.startswith("/")
                    and len(path) <= 512 for path in holder_roots),
            "HOLDER_PATH_UNKNOWN")
    ps = command_output(PS_COMMAND)
    ps_at = time.time_ns() // 1_000_000
    lsof = command_output(LSOF_COMMAND)
    lsof_at = time.time_ns() // 1_000_000
    require(0 < ps_at <= lsof_at <= (1 << 53) - 1, "CENSUS_TIME_UNKNOWN")
    scanned_processes, present = parse_ps(ps, old_pids)
    scanned_files, holders = parse_lsof(lsof, holder_roots)
    require(present == 0, "OLD_TREE_PRESENT")
    require(holders == 0, "HOLDER_PRESENT")
    normalized_ps = {"tool": "ps", "scannedProcessCount": scanned_processes,
                     "oldTreeProcessCount": 0,
                     "rawSha256": hashlib.sha256(ps).hexdigest()}
    normalized_lsof = {"tool": "lsof", "scannedFileCount": scanned_files,
                       "openHolderCount": 0,
                       "rawSha256": hashlib.sha256(lsof).hexdigest()}
    encode = lambda obj: (json.dumps(obj, separators=(",", ":")) + "\n").encode()
    return {"runtimeTreeProcessCount": 0, "openHolderCount": 0,
            "psOutput": encode(normalized_ps), "lsofOutput": encode(normalized_lsof),
            "psAtWallMs": ps_at, "lsofAtWallMs": lsof_at}
