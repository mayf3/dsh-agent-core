"""Fixed s256 secret-safe census archive, disconnected from the inert DS action.

This seals already collected internal zero-count outputs. It does not prove
source/holder closure, lock ownership, host identity or a valid cutover.
"""

import hashlib
import json
import os
import re
import stat


OPERATION_ID = "hr-s256-trusted-quiescence-cut-20260925-v1"
DIRECTORY = "hr-s256-quiescence-evidence"
MAX_BYTES = 65536
HASH = re.compile(r"^[a-f0-9]{64}$")
FILES = ("census-ps.txt", "census-lsof.txt", "census-archive.json")


class Rejected(Exception):
    pass


def require(condition, reason):
    if not condition:
        raise Rejected(reason)


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def valid_time(value):
    return type(value) is int and 0 <= value <= (1 << 53) - 1


def normalized(raw, tool):
    require(type(raw) is bytes and 0 < len(raw) <= MAX_BYTES and raw.endswith(b"\n"),
            "CENSUS_OUTPUT_INVALID")
    try:
        parsed = json.loads(raw)
    except (ValueError, UnicodeDecodeError) as exc:
        raise Rejected("CENSUS_OUTPUT_INVALID") from exc
    count = "scannedProcessCount" if tool == "ps" else "scannedFileCount"
    zero = "oldTreeProcessCount" if tool == "ps" else "openHolderCount"
    require(type(parsed) is dict and set(parsed) == {"tool", count, zero, "rawSha256"}
            and parsed["tool"] == tool and type(parsed[count]) is int and parsed[count] > 0
            and type(parsed[zero]) is int and parsed[zero] == 0
            and isinstance(parsed["rawSha256"], str)
            and HASH.fullmatch(parsed["rawSha256"]), "CENSUS_OUTPUT_INVALID")
    return parsed


def validated_inputs(host_id, census, holder_paths, quiesced_at):
    require(isinstance(host_id, str) and 1 <= len(host_id) <= 128
            and all(ord(char) >= 32 for char in host_id), "HOST_ID_UNKNOWN")
    require(type(census) is dict and set(census) == {
        "runtimeTreeProcessCount", "openHolderCount", "psOutput", "lsofOutput",
        "psAtWallMs", "lsofAtWallMs"}, "CENSUS_SHAPE_INVALID")
    require(type(census["runtimeTreeProcessCount"]) is int
            and census["runtimeTreeProcessCount"] == 0
            and type(census["openHolderCount"]) is int
            and census["openHolderCount"] == 0, "CENSUS_NOT_ZERO")
    require(valid_time(quiesced_at) and valid_time(census["psAtWallMs"])
            and valid_time(census["lsofAtWallMs"])
            and quiesced_at < census["psAtWallMs"] <= census["lsofAtWallMs"],
            "CENSUS_ORDER_UNKNOWN")
    require(type(holder_paths) is list and 1 <= len(holder_paths) <= 16
            and len(set(holder_paths)) == len(holder_paths)
            and all(isinstance(path, str) and path.startswith("/")
                    and len(path) <= 512 and ".." not in path.split("/")
                    for path in holder_paths), "HOLDER_PATH_UNKNOWN")
    normalized(census["psOutput"], "ps")
    normalized(census["lsofOutput"], "lsof")


def opened_directory(create):
    require(TEST_MODE or os.geteuid() == 0, "ROOT_CUSTODY_REQUIRED")
    root = None
    try:
        root = os.open(STATE_ROOT, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        meta = os.fstat(root)
        require(stat.S_ISDIR(meta.st_mode)
                and meta.st_uid == (os.geteuid() if TEST_MODE else 0)
                and not (meta.st_mode & 0o022)
                and (meta.st_mode & 0o001), "EVIDENCE_ROOT_INACCESSIBLE")
        if create:
            try:
                os.mkdir(DIRECTORY, 0o755, dir_fd=root)
                os.fsync(root)
            except FileExistsError:
                pass
        directory = os.open(DIRECTORY, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW,
                            dir_fd=root)
        meta = os.fstat(directory)
        require(stat.S_ISDIR(meta.st_mode)
                and meta.st_uid == (os.geteuid() if TEST_MODE else 0)
                and stat.S_IMODE(meta.st_mode) == 0o755, "EVIDENCE_DIRECTORY_INVALID")
        return root, directory
    except (OSError, Rejected) as exc:
        if root is not None:
            os.close(root)
        raise Rejected("EVIDENCE_DIRECTORY_UNAVAILABLE") from exc


def read_file(directory, name):
    fd = os.open(name, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=directory)
    try:
        meta = os.fstat(fd)
        require(stat.S_ISREG(meta.st_mode)
                and meta.st_uid == (os.geteuid() if TEST_MODE else 0)
                and stat.S_IMODE(meta.st_mode) == 0o644
                and 0 < meta.st_size <= MAX_BYTES, "EVIDENCE_FILE_INVALID")
        raw = os.read(fd, MAX_BYTES + 1)
        require(len(raw) == meta.st_size, "EVIDENCE_FILE_CHANGED")
        return raw
    finally:
        os.close(fd)


def readback():
    root, directory = opened_directory(False)
    try:
        ps, lsof, archive_raw = [read_file(directory, name) for name in FILES]
        normalized(ps, "ps")
        normalized(lsof, "lsof")
        archive = json.loads(archive_raw)
        require(type(archive) is dict and set(archive) == {
            "operationId", "hostId", "tools", "outputsSha256",
            "runtimeTreeProcessCount", "psAtWallMs", "lsofAtWallMs"}
            and archive["operationId"] == OPERATION_ID
            and isinstance(archive["hostId"], str) and archive["hostId"]
            and archive["tools"] == ["ps", "lsof"]
            and archive["outputsSha256"] == [digest(ps), digest(lsof)]
            and type(archive["runtimeTreeProcessCount"]) is int
            and archive["runtimeTreeProcessCount"] == 0
            and valid_time(archive["psAtWallMs"])
            and valid_time(archive["lsofAtWallMs"])
            and archive["psAtWallMs"] <= archive["lsofAtWallMs"],
            "CENSUS_ARCHIVE_INVALID")
        return {"archiveSha256": digest(archive_raw), "archive": archive}
    except (OSError, ValueError, UnicodeDecodeError, Rejected) as exc:
        raise Rejected("CENSUS_ARCHIVE_READBACK_UNKNOWN") from exc
    finally:
        os.close(directory)
        os.close(root)


def seal_census(host_id, census, holder_paths, quiesced_at):
    validated_inputs(host_id, census, holder_paths, quiesced_at)
    ps, lsof = census["psOutput"], census["lsofOutput"]
    archive = {"operationId": OPERATION_ID, "hostId": host_id,
               "tools": ["ps", "lsof"],
               "outputsSha256": [digest(ps), digest(lsof)],
               "runtimeTreeProcessCount": 0,
               "psAtWallMs": census["psAtWallMs"],
               "lsofAtWallMs": census["lsofAtWallMs"]}
    raw = (json.dumps(archive, separators=(",", ":")) + "\n").encode()
    require(len(raw) <= MAX_BYTES, "CENSUS_ARCHIVE_BOUND")
    root, directory = opened_directory(True)
    try:
        for name, content in zip(FILES, (ps, lsof, raw)):
            fd = os.open(name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
                         0o644, dir_fd=directory)
            try:
                os.fchmod(fd, 0o644)
                view = memoryview(content)
                while view:
                    count = os.write(fd, view)
                    require(count > 0, "EVIDENCE_WRITE_UNKNOWN")
                    view = view[count:]
                os.fsync(fd)
            finally:
                os.close(fd)
        os.fsync(directory)
    except (OSError, Rejected) as exc:
        raise Rejected("CENSUS_ARCHIVE_CREATE_UNKNOWN") from exc
    finally:
        os.close(directory)
        os.close(root)
    observed = readback()
    require(observed["archive"] == archive and observed["archiveSha256"] == digest(raw),
            "CENSUS_ARCHIVE_READBACK_MISMATCH")
    return {"evidenceDir": os.path.join(STATE_ROOT, DIRECTORY),
            "archiveSha256": digest(raw),
            "hostCensus": {"operationId": OPERATION_ID,
                "executedAtWallMs": census["psAtWallMs"], "hostId": host_id,
                "tools": ["ps", "lsof"], "outputsSha256": archive["outputsSha256"],
                "archiveRef": "census-archive.json", "runtimeTreeProcessCount": 0},
            "holderCheck": {"operationId": OPERATION_ID,
                "executedAtWallMs": census["lsofAtWallMs"], "method": "lsof",
                "paths": holder_paths, "openHolderCount": 0}}
