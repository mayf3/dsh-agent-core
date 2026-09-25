"""Fixed protected s256 read; intended only inside the pinned DS candidate."""

import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import stat
import subprocess


VALIDATOR_HASHES = {
    "durable-file.js": "1a039c5f4083069bc1f075261e945d850ee2ce08e9e7bbfe1e4fedcdaa5bcbba",
    "capacity.js": "237afe154801a0900209e68ddae47f1d7e0ca531594729209f16f687c73bb8b0",
    "authority-capacity.js": "994b4c87365a51fa2b4458d9ff8d2b0837f61a6428ecb548a6fd513bc934c7c9",
}
PROJECTOR_SHA256 = "663c86152e775eabbd70ecb17159d64b8f17a2cd94fd95d53675b71d052b2de8"
APP_ROOT = Path("/usr/local/libexec/agent-core/app")
MAX_STORE_BYTES = 16 * 1024 * 1024
MAX_RESULT_BYTES = 1024


class Rejected(Exception):
    pass


def require(condition, reason):
    if not condition:
        raise Rejected(reason)


def identity(meta):
    return (meta.st_dev, meta.st_ino, meta.st_uid, meta.st_gid,
            meta.st_mode, meta.st_size, meta.st_mtime_ns, meta.st_ctime_ns)


def source_root():
    if TEST_MODE:
        root = os.environ.get("DS_HR_SOURCE_ROOT")
        require(root is not None and Path(root).is_absolute(), "TEST_SOURCE_ROOT_MISSING")
        return Path(root)
    return APP_ROOT


def pinned_validator_sources():
    root = source_root() / "packages/agent-router/src/reconciliation"
    expected_uid = os.getuid() if TEST_MODE else TARGET_UID
    observed = []
    for name, digest in VALIDATOR_HASHES.items():
        path = root / name
        meta = os.lstat(path)
        require(stat.S_ISREG(meta.st_mode) and meta.st_uid == expected_uid
                and not (meta.st_mode & 0o022), "VALIDATOR_SOURCE_CUSTODY")
        raw = path.read_bytes()
        require(hashlib.sha256(raw).hexdigest() == digest, "VALIDATOR_SOURCE_DIGEST")
        observed.append((path, identity(meta)))
    return observed


def opened_fixed_store():
    path = PurePosixPath(ROUTER_STORE_FILE)
    require(path.is_absolute() and len(path.parts) >= 3, "FIXED_STORE_PATH")
    root = os.open("/", os.O_RDONLY | os.O_DIRECTORY)
    parents = [root]
    try:
        parent = root
        for segment in path.parts[1:-1]:
            parent = os.open(segment, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW,
                             dir_fd=parent)
            parents.append(parent)
        fd = os.open(path.parts[-1], os.O_RDONLY | os.O_NOFOLLOW, dir_fd=parent)
        try:
            meta = os.fstat(fd)
            expected_uid = os.getuid() if TEST_MODE else TARGET_UID
            expected_gid = os.getgid() if TEST_MODE else TARGET_GID
            require(stat.S_ISREG(meta.st_mode) and meta.st_uid == expected_uid
                    and meta.st_gid == expected_gid and stat.S_IMODE(meta.st_mode) == 0o600
                    and 0 < meta.st_size <= MAX_STORE_BYTES, "STORE_CUSTODY")
            return fd, meta
        except BaseException:
            os.close(fd)
            raise
    finally:
        for item in reversed(parents):
            os.close(item)


def digest_fd(fd, expected_size):
    os.lseek(fd, 0, os.SEEK_SET)
    result = hashlib.sha256()
    count = 0
    while True:
        block = os.read(fd, 65536)
        if not block:
            break
        count += len(block)
        require(count <= MAX_STORE_BYTES, "STORE_SIZE_CHANGED")
        result.update(block)
    require(count == expected_size, "STORE_SIZE_CHANGED")
    return result.hexdigest()


def fixed_subject_projection():
    """Pinned installed JS validator projects exact s256 from the same no-follow FD."""
    require(hashlib.sha256(HR_PROJECTOR_SOURCE.encode()).hexdigest() == PROJECTOR_SHA256,
            "PROJECTOR_SOURCE_DIGEST")
    before_sources = pinned_validator_sources()
    fd, before = opened_fixed_store()
    try:
        preimage = digest_fd(fd, before.st_size)
        root = source_root()
        relative = "../../packages/agent-router/src/reconciliation/"
        script = HR_PROJECTOR_SOURCE
        for name in VALIDATOR_HASHES:
            script = script.replace(relative + name,
                                    (root / "packages/agent-router/src/reconciliation" / name).as_uri())
        script += "\nprocess.stdout.write(JSON.stringify(projectSubject(process.argv[1]))+'\\n');\n"
        os.lseek(fd, 0, os.SEEK_SET)
        options = {} if TEST_MODE else {"user": TARGET_UID, "group": TARGET_GID,
                                        "extra_groups": []}
        try:
            child = subprocess.run([ROUTER_NODE_BIN, "--input-type=module", "-e",
                                    script, f"/dev/fd/{fd}"], pass_fds=(fd,),
                                   stdin=subprocess.DEVNULL, capture_output=True,
                                   timeout=15, env={"PATH": "/usr/bin:/bin"}, **options)
        except (OSError, subprocess.TimeoutExpired) as exc:
            raise Rejected("PROJECTION_UNAVAILABLE") from exc
        require(child.returncode == 0 and not child.stderr
                and 0 < len(child.stdout) <= MAX_RESULT_BYTES, "PROJECTION_INVALID")
        try:
            projection = json.loads(child.stdout)
        except (ValueError, UnicodeDecodeError) as exc:
            raise Rejected("PROJECTION_INVALID") from exc
        require(type(projection) is dict
                and projection.get("reconciliationHandle") == HR_PROFILE.HANDLE
                and projection.get("agentId") == HR_PROFILE.AGENT_ID
                and HR_PROFILE.valid_hash(projection.get("subjectPreimageSha256")),
                "PROJECTION_IDENTITY")
        require(digest_fd(fd, before.st_size) == preimage
                and identity(os.fstat(fd)) == identity(before), "STORE_CHANGED")
        fresh_fd, fresh_meta = opened_fixed_store()
        try:
            require(identity(fresh_meta) == identity(before)
                    and digest_fd(fresh_fd, before.st_size) == preimage,
                    "STORE_CHANGED")
        finally:
            os.close(fresh_fd)
        require(pinned_validator_sources() == before_sources, "VALIDATOR_SOURCE_CHANGED")
        return projection
    finally:
        os.close(fd)
