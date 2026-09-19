"""Exact first-live-only retirement of two legacy authsvc sudoers entries."""
if __name__ == "__main__" and __package__:
    raise SystemExit("standalone fixed runner only")

import ctypes
import errno
import fcntl
import hashlib
import json
import os
from pathlib import Path
import stat
import subprocess
import sys
import time

OPERATION = "first-live-dsh-sudoers-retirement-p4r15"
ACTIVE = "/private/etc/sudoers.d"
STATE = "/private/var/db/agent-deployd"
JOURNAL = "first-live-sudoers-retirement-p4r15"
ARCHIVE = "preimages"
NAMES = ("openclaw-gateway-restart", "openclaw-gateway-restart.ztWs0g")
PREIMAGE_SHA = "268f8159462ea5e4d879e14f13f1e803427b55802c2a081e14baa265c55e4b1a"
SUDO_SHA = "f4a543ca644b3d37db613017dd8eaa3454b81e8ca97ff7c988a652416b86eaec"
VISUDO_SHA = "55b45bda339e08f4b723e8387b2734df920a348d366daedf58d40a0d109d8d7d"
AUTH_BEFORE_SHA = "3aa44ca575c8410306cbaf1456b815482c9a56eeda4642f52e26a3ce0ed93ab6"
NO_COMMAND = {
    "authsvc": "User authsvc is not allowed to run sudo on MacBook-Pro.\n",
    "_dcp_review": "User _dcp_review is not allowed to run sudo on MacBook-Pro.\n",
}
RETAINED_FILES = {
    "failure.json": (88513863, 380, "e855a0922ead0b3b9f1606aa42b532f4310cf7a537bc9087344e6e7e0e1a49c4"),
    "first-live-intent.json": (88513830, 309, "5f5760669d601664b0a188ccbf4d7ecf0725ad1fd8a5f581dc8657b29ff5570c"),
    "initial-service-sudo-intent.json": (88513856, 176, "67d7786d34008fec015f24677bdb8728715c024dfe85d3c63e3b8ac6e971a4f7"),
    "legacy-0-intent.json": (88513834, 785, "7c3029976f7c63a510c56da325e6205cc6b0008405f2188e160c9a3a5f197e07"),
    "legacy-0-result.json": (88513835, 153, "1af6c6c21519d7762ab5279fefd3e7831915b54f44ed91a77f3796b837e7a79e"),
    "legacy-1-created.json": (88513838, 154, "0e1f885da3ec232a3b7bd07ac95a24709924f9accf90b6bb13353808b6708984"),
    "legacy-1-intent.json": (88513836, 515, "c45c6108202c583fdd0e8acedd283870a90b499935cb3d8f4d9c5ecf6f56c318"),
    "legacy-1-result.json": (88513840, 320, "f22f370a6d982801b5e510468f507119854b03271398c55ca1e7cccbf0113213"),
    "legacy-2-created.json": (88513843, 153, "cead5f33a5de1437bb9149c92349744ab0cd7d7d9d56d481b7fcb44269309676"),
    "legacy-2-intent.json": (88513841, 519, "cc8851c7f0901cd0b72e3fa8f6a718f913631e70bd9bece5f1db32438d81e82e"),
    "legacy-2-result.json": (88513845, 318, "b7d8b062e1522c38971a213a7ed82249a3c5248148abd0c16687b7e1dc78c0be"),
    "legacy-ancestor-fence-intent.json": (88513832, 270, "84efc386dbca872180c813d1af8cce3418a7fa3f6b55c04e56cbfcb1e0ff0ecb"),
    "legacy-ancestor-fence-result.json": (88513833, 248, "300a10ff2407d5693aa6603e8cb064a029151ec93d45dab72d07ca4bcbc9514a"),
}
ENV = {"PATH": "/usr/bin:/bin:/usr/sbin:/sbin", "LANG": "C", "LC_ALL": "C", "HOME": "/var/root"}


def require(value, reason):
    if not value:
        raise RuntimeError(reason)


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()


def sha(value):
    return hashlib.sha256(value).hexdigest()


def _acl_none(fd):
    libc = ctypes.CDLL(None, use_errno=True)
    libc.acl_get_fd_np.argtypes = [ctypes.c_int, ctypes.c_int]
    libc.acl_get_fd_np.restype = ctypes.c_void_p
    libc.acl_get_entry.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.POINTER(ctypes.c_void_p)]
    libc.acl_get_entry.restype = ctypes.c_int
    libc.acl_free.argtypes = [ctypes.c_void_p]
    acl = libc.acl_get_fd_np(fd, 0x100)
    if not acl:
        require(ctypes.get_errno() == errno.ENOENT, "ACL_UNREADABLE")
        return
    try:
        entry = ctypes.c_void_p()
        ctypes.set_errno(0)
        found = libc.acl_get_entry(acl, 0, ctypes.byref(entry))
        require(found == -1 and ctypes.get_errno() == errno.EINVAL, "UNSAFE_ACL")
    finally:
        libc.acl_free(acl)


def _tuple(value):
    return (value.st_dev, value.st_ino, value.st_mode, value.st_uid, value.st_gid,
            value.st_nlink, value.st_size, value.st_mtime_ns, value.st_ctime_ns,
            getattr(value, "st_flags", 0))


def _xattrs(fd):
    if hasattr(os, "listxattr"):
        return os.listxattr(fd)
    require(sys.platform == "darwin", "XATTR_PLATFORM_UNSUPPORTED")
    libc = ctypes.CDLL(None, use_errno=True)
    libc.flistxattr.argtypes = (ctypes.c_int, ctypes.c_void_p, ctypes.c_size_t, ctypes.c_int)
    libc.flistxattr.restype = ctypes.c_ssize_t
    count = libc.flistxattr(fd, None, 0, 0)
    require(0 <= count <= 65536, "XATTR_READ_FAILED")
    buffer = ctypes.create_string_buffer(count or 1)
    require(libc.flistxattr(fd, buffer, count, 0) == count, "XATTR_CHANGED")
    return [name.decode() for name in buffer.raw[:count].split(b"\0") if name]


def _xattr_value(fd, name):
    require(sys.platform == "darwin", "XATTR_PLATFORM_UNSUPPORTED")
    libc = ctypes.CDLL(None, use_errno=True)
    libc.fgetxattr.argtypes = (ctypes.c_int, ctypes.c_char_p, ctypes.c_void_p,
                               ctypes.c_size_t, ctypes.c_uint32, ctypes.c_int)
    libc.fgetxattr.restype = ctypes.c_ssize_t
    encoded = name.encode()
    count = libc.fgetxattr(fd, encoded, None, 0, 0, 0)
    require(0 <= count <= 4096, "XATTR_VALUE_READ_FAILED")
    buffer = ctypes.create_string_buffer(count or 1)
    require(libc.fgetxattr(fd, encoded, buffer, count, 0, 0) == count,
            "XATTR_VALUE_CHANGED")
    return buffer.raw[:count]


def _retained_operation_xattr(fd):
    require(_xattrs(fd) == ["com.apple.provenance"] and
            _xattr_value(fd, "com.apple.provenance") ==
            bytes.fromhex("010200b853f6dc8c0be32b"),
            "RETAINED_OPERATION_XATTR")


def _image(fd, expected_uid):
    before = os.fstat(fd)
    require(stat.S_ISREG(before.st_mode) and before.st_nlink == 1 and before.st_uid == expected_uid,
            "SUDOERS_PREIMAGE_METADATA")
    _acl_none(fd)
    require(_xattrs(fd) == [], "SUDOERS_PREIMAGE_XATTR")
    os.lseek(fd, 0, os.SEEK_SET)
    data = bytearray()
    while len(data) <= 4096:
        chunk = os.read(fd, min(4097 - len(data), 4096))
        if not chunk:
            break
        data.extend(chunk)
    after = os.fstat(fd)
    require(_tuple(before) == _tuple(after) and len(data) == before.st_size <= 4096,
            "SUDOERS_OBJECT_CHANGED")
    return {"device": after.st_dev, "inode": after.st_ino, "uid": after.st_uid,
            "gid": after.st_gid, "mode": stat.S_IMODE(after.st_mode),
            "flags": getattr(after, "st_flags", 0), "size": after.st_size,
            "sha256": sha(data)}


def _open_optional(parent, name):
    try:
        return os.open(name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK | os.O_CLOEXEC,
                       dir_fd=parent)
    except FileNotFoundError:
        return None


def _mkdir(parent, name, uid):
    try:
        os.mkdir(name, 0o700, dir_fd=parent)
        os.fsync(parent)
    except FileExistsError:
        pass
    fd = os.open(name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC,
                 dir_fd=parent)
    meta = os.fstat(fd)
    require(meta.st_uid == uid and meta.st_gid == (0 if uid == 0 else os.getgid())
            and stat.S_IMODE(meta.st_mode) == 0o700 and
            getattr(meta, "st_flags", 0) == 0, "JOURNAL_METADATA")
    _acl_none(fd); require(_xattrs(fd) == [], "JOURNAL_METADATA")
    return fd


def _record(area, name, value, uid):
    raw = canonical(value)
    existing = _open_optional(area, name)
    if existing is not None:
        try:
            image = _image(existing, uid)
            require(image == {"device": image["device"], "inode": image["inode"], "uid": uid,
                    "gid": 0 if uid == 0 else os.getgid(), "mode": 0o400, "flags": 0,
                    "size": len(raw), "sha256": sha(raw)}, "JOURNAL_DRIFT")
            os.lseek(existing, 0, os.SEEK_SET)
            require(os.read(existing, len(raw) + 1) == raw, "JOURNAL_DRIFT")
            return
        finally:
            os.close(existing)
    fd = os.open(name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW | os.O_CLOEXEC,
                 0o400, dir_fd=area)
    try:
        os.fchown(fd, uid, 0 if uid == 0 else os.getgid())
        os.write(fd, raw)
        os.fsync(fd)
    finally:
        os.close(fd)
    os.fsync(area)


def _expected_fixture(active, uid):
    values = []
    for name in NAMES:
        fd = _open_optional(active, name)
        require(fd is not None, "FIXTURE")
        try:
            values.append(_image(fd, uid))
        finally:
            os.close(fd)
    return tuple(values)


def _locations(active, archive, expected):
    values = []
    for index, name in enumerate(NAMES):
        source = _open_optional(active, name)
        saved = _open_optional(archive, name)
        require((source is None) != (saved is None), "SUDOERS_RETIREMENT_LOCATION_UNKNOWN")
        fd = source if source is not None else saved
        try:
            actual = _image(fd, expected[index]["uid"])
        finally:
            os.close(fd)
        require(actual == expected[index], "SUDOERS_RETIREMENT_PREIMAGE")
        values.append(actual)
    return values


def retire_at(active, state, expected, uid, verify):
    existing = _open_optional(state, JOURNAL)
    if existing is None:
        for index, name in enumerate(NAMES):
            fd = _open_optional(active, name)
            require(fd is not None, "SUDOERS_RETIREMENT_PREIMAGE")
            try:
                require(_image(fd, uid) == expected[index], "SUDOERS_RETIREMENT_PREIMAGE")
            finally:
                os.close(fd)
        area = _mkdir(state, JOURNAL, uid)
    else:
        area = existing
    archive = _mkdir(area, ARCHIVE, uid)
    try:
        captured = _locations(active, archive, expected)
        _record(area, "preimage-captured.json", {"version": 1, "operation_id": OPERATION,
                "entries": [{"name": name, "identity": captured[i]} for i, name in enumerate(NAMES)]}, uid)
        _record(area, "retire-intent.json", {"version": 1, "operation_id": OPERATION,
                "active_root": ACTIVE, "archive_root": f"{STATE}/{JOURNAL}/{ARCHIVE}",
                "names": list(NAMES)}, uid)
        for index, name in enumerate(NAMES):
            source = _open_optional(active, name)
            saved = _open_optional(archive, name)
            if source is not None and saved is None:
                require(_image(source, uid) == expected[index], "SUDOERS_RETIREMENT_PREIMAGE")
                os.rename(name, name, src_dir_fd=active, dst_dir_fd=archive)
                os.fsync(active); os.fsync(archive)
                saved = _open_optional(archive, name)
                try:
                    require(saved is not None and _tuple(os.fstat(saved)) == _tuple(os.fstat(source)),
                            "SUDOERS_RETIREMENT_RENAME_IDENTITY")
                finally:
                    if saved is not None: os.close(saved)
                    os.close(source)
            elif source is None and saved is not None:
                os.close(saved)
            else:
                if source is not None: os.close(source)
                if saved is not None: os.close(saved)
                raise RuntimeError("SUDOERS_RETIREMENT_LOCATION_UNKNOWN")
            saved = _open_optional(archive, name)
            require(saved is not None, "SUDOERS_RETIREMENT_ARCHIVE")
            try:
                require(_image(saved, uid) == expected[index], "SUDOERS_RETIREMENT_ARCHIVE")
            finally:
                os.close(saved)
            require(_open_optional(active, name) is None, "SUDOERS_RETIREMENT_ACTIVE")
            _record(area, f"remove-{index}-result.json", {"version": 1, "operation_id": OPERATION,
                    "name": name, "archive_identity": expected[index]}, uid)
        _locations(active, archive, expected)
        _record(area, "removed-from-active-sudoers-include-set.json", {"version": 1,
                "operation_id": OPERATION, "active_absent": list(NAMES),
                "archive_digest": sha(canonical(expected))}, uid)
        verify(area, uid)
        result = {"version": 1, "operation_id": OPERATION, "state": "RETIREMENT_COMPLETE",
                  "active_absent": list(NAMES), "archive_digest": sha(canonical(expected))}
        _record(area, "retirement-complete.json", result, uid)
        return result
    finally:
        os.close(archive); os.close(area)


def _tool(path, expected):
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK | os.O_CLOEXEC)
    try:
        meta = os.fstat(fd)
        require(stat.S_ISREG(meta.st_mode) and meta.st_uid == meta.st_gid == 0 and
                meta.st_nlink == 1 and not meta.st_mode & 0o022, "TOOL_METADATA")
        data = bytearray()
        while True:
            chunk = os.read(fd, 1048576)
            if not chunk: break
            data.extend(chunk)
        require(sha(data) == expected and _tuple(os.fstat(fd)) == _tuple(meta), "TOOL_DIGEST")
    finally:
        os.close(fd)


def _command(argv):
    result = subprocess.run(argv, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, env=ENV, cwd="/", timeout=15, check=False)
    require(len(result.stdout) + len(result.stderr) <= 1048576, "COMMAND_OUTPUT_BOUND")
    return result


def _sudo(name):
    result = _command(["/usr/bin/sudo", "-n", "-l", "-U", name])
    return {"name": name, "returncode": result.returncode,
            "stdout": result.stdout.decode("utf-8", "strict"),
            "stderr": result.stderr.decode("utf-8", "strict"),
            "stdout_sha256": sha(result.stdout), "stderr_sha256": sha(result.stderr)}


def _retained_state():
    old = os.open(f"{STATE}/first-live-operation", os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC)
    try:
        meta = os.fstat(old)
        require((meta.st_dev, meta.st_ino, meta.st_uid, stat.S_IMODE(meta.st_mode)) ==
                (16777230, 88513828, 0, 0o700), "RETAINED_STATE")
        require(getattr(meta, "st_flags", 0) == 0, "RETAINED_STATE")
        _retained_operation_xattr(old)
        _acl_none(old)
        expected_names = sorted([*RETAINED_FILES, "first-live-maintenance-0-0"])
        require(sorted(os.listdir(old)) == expected_names, "RETAINED_HISTORY")
        for name, (inode, size, expected_sha) in RETAINED_FILES.items():
            fd = _open_optional(old, name)
            require(fd is not None, "RETAINED_HISTORY")
            try:
                image = _image(fd, 0)
                require(image == {"device": 16777230, "inode": inode, "uid": 0, "gid": 0,
                        "mode": 0o400, "flags": 0, "size": size, "sha256": expected_sha},
                        "RETAINED_HISTORY")
            finally:
                os.close(fd)
        maintenance = os.open("first-live-maintenance-0-0",
                              os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC,
                              dir_fd=old)
        try:
            m = os.fstat(maintenance)
            require((m.st_dev, m.st_ino, m.st_uid, m.st_gid, stat.S_IMODE(m.st_mode),
                    getattr(m, "st_flags", 0), os.listdir(maintenance)) ==
                    (16777230, 88513855, 0, 0, 0o700, 0, []), "RETAINED_HISTORY")
            _acl_none(maintenance); require(_xattrs(maintenance) == [], "RETAINED_HISTORY")
        finally:
            os.close(maintenance)
    finally:
        os.close(old)
    fence = os.open("/usr/local/var/agent-core",
                    os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC)
    try:
        m = os.fstat(fence)
        require((m.st_dev, m.st_ino, m.st_uid, m.st_gid, stat.S_IMODE(m.st_mode),
                getattr(m, "st_flags", 0)) == (16777230, 80401184, 0, 80, 0o755, 131072),
                "RETAINED_FENCE")
        _acl_none(fence); require(_xattrs(fence) == [], "RETAINED_FENCE")
    finally:
        os.close(fence)
    for path, identity, holder_name, holder_identity, holder_sha in (
        ("/usr/local/var/agent-core/production-mutation-locks/production-deploy.lock",
         (16777230, 88513837, 0, 80, 0o700), "holder",
         (16777230, 88513839, 0, 80, 0o600), "b9598b6e06b8cb47ffbe6be42f0a11744e69857423a43d7be1c41868cc5abbde"),
        ("/private/var/db/agent-core/production-transaction.lock",
         (16777230, 88513842, 0, 0, 0o700), "dcp-handover.json",
         (16777230, 88513844, 0, 0, 0o600), "7fd7ac58e07a85e0e585bffa95829440dfeb42436ae0fde2de8fd551230351b8"),
    ):
        directory = os.open(path, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC)
        try:
            m = os.fstat(directory)
            require((m.st_dev, m.st_ino, m.st_uid, m.st_gid, stat.S_IMODE(m.st_mode)) == identity
                    and getattr(m, "st_flags", 0) == 0 and os.listdir(directory) == [holder_name],
                    "RETAINED_LOCK")
            holder = _open_optional(directory, holder_name)
            require(holder is not None, "RETAINED_LOCK")
            try:
                before = os.fstat(holder)
                image = _image(holder, 0)
                require((before.st_dev, before.st_ino, before.st_uid, before.st_gid,
                        stat.S_IMODE(before.st_mode)) == holder_identity
                        and image["sha256"] == holder_sha, "RETAINED_LOCK")
            finally:
                os.close(holder)
        finally:
            os.close(directory)
    require(not Path("/proc/51690").exists(), "COMPETING_WRITER") if Path("/proc").exists() else None
    try:
        os.kill(51690, 0)
    except ProcessLookupError:
        pass
    else:
        raise RuntimeError("COMPETING_WRITER")
    lock = os.open("/private/var/run/agent-core-production-mutation.lock",
                   os.O_RDWR | os.O_NOFOLLOW | os.O_NONBLOCK | os.O_CLOEXEC)
    meta = os.fstat(lock)
    require((meta.st_dev, meta.st_ino, meta.st_uid, meta.st_gid, stat.S_IMODE(meta.st_mode)) ==
            (16777230, 65414111, 0, 1, 0o600), "RETAINED_STATE")
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        os.close(lock); raise RuntimeError("COMPETING_WRITER")
    return lock


def _verify_policy(area, uid):
    visudo = _command(["/usr/sbin/visudo", "-c"])
    require(visudo.returncode == 0, "VISUDO_UNKNOWN")
    _record(area, "visudo-validation.json", {"version": 1, "operation_id": OPERATION,
            "returncode": visudo.returncode, "stdout_sha256": sha(visudo.stdout),
            "stderr_sha256": sha(visudo.stderr)}, uid)
    reports = [_sudo(name) for name in ("authsvc", "_dcp_review")]
    for report in reports:
        require(report["returncode"] == 0 and report["stderr"] == "" and
                report["stdout"] == NO_COMMAND[report["name"]], "EFFECTIVE_POLICY_UNKNOWN")
    _record(area, "effective-policy-readback.json", {"version": 1, "operation_id": OPERATION,
            "reports": reports}, uid)


def run():
    require(os.getuid() == os.geteuid() == 0, "ROOT_REQUIRED")
    _tool("/usr/bin/sudo", SUDO_SHA); _tool("/usr/sbin/visudo", VISUDO_SHA)
    held = _retained_state()
    active = os.open(ACTIVE, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC)
    state = os.open(STATE, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC)
    try:
        active_meta = os.fstat(active); state_meta = os.fstat(state)
        require((active_meta.st_dev, active_meta.st_ino, active_meta.st_uid, active_meta.st_gid,
                stat.S_IMODE(active_meta.st_mode), getattr(active_meta, "st_flags", 0)) ==
                (16777230, 59193409, 0, 0, 0o755, 0), "ACTIVE_ROOT")
        require((state_meta.st_dev, state_meta.st_ino, state_meta.st_uid, state_meta.st_gid,
                stat.S_IMODE(state_meta.st_mode), getattr(state_meta, "st_flags", 0)) ==
                (16777230, 85616151, 0, 0, 0o700, 0), "STATE_ROOT")
        for directory in (active, state):
            _acl_none(directory); require(_xattrs(directory) == [], "PROTECTED_ROOT_METADATA")
        expected = (
            {"device": 16777230, "inode": 34603253, "uid": 0, "gid": 0, "mode": 0o440,
             "flags": 0, "size": 167, "sha256": PREIMAGE_SHA},
            {"device": 16777230, "inode": 34603251, "uid": 0, "gid": 0, "mode": 0o440,
             "flags": 0, "size": 167, "sha256": PREIMAGE_SHA},
        )
        prior = _open_optional(state, JOURNAL)
        if prior is None:
            auth = _sudo("authsvc"); reviewer = _sudo("_dcp_review")
            require(auth["returncode"] == 0 and auth["stderr"] == "" and
                    auth["stdout_sha256"] == AUTH_BEFORE_SHA, "EFFECTIVE_PREIMAGE")
            require(reviewer["returncode"] == 0 and reviewer["stderr"] == "" and
                    reviewer["stdout"] == NO_COMMAND["_dcp_review"], "REVIEWER_POLICY")
        else:
            os.close(prior)
        return retire_at(active, state, expected, 0, _verify_policy)
    finally:
        os.close(active); os.close(state); os.close(held)


if __name__ == "__main__":
    try:
        print(canonical(run()).decode())
    except BaseException as error:
        print(canonical({"version": 1, "state": "STOP_RECONCILE", "reason": str(error),
                         "retry_forbidden": True}).decode())
        raise
