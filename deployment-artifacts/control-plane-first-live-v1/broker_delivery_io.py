"""Fixed producer I/O. Local journal records observations, never deployment authority."""
import json
import os
from pathlib import Path
import pwd
import re
import selectors
import stat
import subprocess
import sys
import time
from broker_first_delivery import GOAL, SOURCE, OPERATION, REQUEST, canonical, sha, require, run_once

ROOT = Path("/usr/local/libexec/agent-deployd")
SOCKET = Path("/private/var/run/agent-deployd")
HANDOFF = SOCKET / "broker-first-delivery.json"
FLAGS = os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC


def parse_json(raw):
    def pairs(items):
        result = {}
        for k, v in items:
            require(k not in result, "JSON_DUPLICATE")
            result[k] = v
        return result
    def invalid(_):
        raise ValueError("JSON_NUMBER")
    value = json.loads(raw.decode("utf-8"), object_pairs_hook=pairs, parse_constant=invalid)
    require(type(value) is dict, "JSON_OBJECT")
    return value


def capture(argv, env, timeout):
    """Bound pipes and wall time; only Transport supplies production argv."""
    require(timeout > 0, "OUTCOME_UNKNOWN_DEADLINE")
    child = subprocess.Popen(argv, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
        stderr=subprocess.PIPE, env=env, close_fds=True, start_new_session=True)
    buffers = {child.stdout: bytearray(), child.stderr: bytearray()}
    caps = {child.stdout: 8 * 1024 * 1024, child.stderr: 32768}
    deadline = time.monotonic() + timeout
    try:
        with selectors.DefaultSelector() as selector:
            for pipe in buffers:
                os.set_blocking(pipe.fileno(), False)
                selector.register(pipe, selectors.EVENT_READ)
            while selector.get_map():
                remaining = deadline - time.monotonic()
                require(remaining > 0, "OUTCOME_UNKNOWN_TIMEOUT")
                for key, _ in selector.select(min(remaining, 0.1)):
                    chunk = os.read(key.fileobj.fileno(), 65536)
                    if not chunk:
                        selector.unregister(key.fileobj)
                    else:
                        buffers[key.fileobj].extend(chunk)
                        require(len(buffers[key.fileobj]) <= caps[key.fileobj], "OUTCOME_UNKNOWN_OUTPUT_LIMIT")
        remaining = deadline - time.monotonic()
        require(remaining > 0, "OUTCOME_UNKNOWN_TIMEOUT")
        try:
            code = child.wait(timeout=remaining)
        except subprocess.TimeoutExpired:
            raise ValueError("OUTCOME_UNKNOWN_TIMEOUT") from None
        value = parse_json(bytes(buffers[child.stdout]))
        require("error" not in value, "CONTROLLER_ERROR")
        require(code == 0, "OUTCOME_UNKNOWN_PROCESS_EXIT")
        return value
    finally:
        # Child PID is ours and has not been released/reused; never kill arbitrary descendants.
        if child.poll() is None:
            child.kill()
        child.wait()
        child.stdout.close()
        child.stderr.close()


class Journal:
    """Exclusive append-only local evidence; any surviving entry consumes this attempt."""
    def __init__(self, path):
        path = Path(path)
        parent = os.open(path.parent, FLAGS | os.O_DIRECTORY)
        try:
            try:
                os.mkdir(path.name, 0o700, dir_fd=parent)
                os.fsync(parent)
            except FileExistsError:
                pass
            self.fd = os.open(path.name, FLAGS | os.O_DIRECTORY, dir_fd=parent)
        finally:
            os.close(parent)
        meta = os.fstat(self.fd)
        if meta.st_uid != os.getuid() or stat.S_IMODE(meta.st_mode) != 0o700:
            os.close(self.fd)
            raise ValueError("JOURNAL_METADATA")

    def consumed(self):
        return bool(os.listdir(self.fd))

    def write(self, name, value):
        require(re.fullmatch(r"(?:intent|result|failure|call-[0-9]{4}-(?:intent|result))\.json", name), "JOURNAL_NAME")
        raw = canonical(value) + b"\n"
        require(len(raw) <= 8 * 1024 * 1024, "JOURNAL_SIZE")
        fd = os.open(name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW | os.O_CLOEXEC, 0o600, dir_fd=self.fd)
        try:
            view = memoryview(raw)
            while view:
                n = os.write(fd, view)
                require(n > 0, "JOURNAL_SHORT_WRITE")
                view = view[n:]
            os.fsync(fd)
        finally:
            os.close(fd)
        os.fsync(self.fd)

    def __enter__(self):
        return self

    def __exit__(self, *args):
        os.close(self.fd)


def directory_ok(path, meta, groups):
    if not stat.S_ISDIR(meta.st_mode) or meta.st_uid != 0 or meta.st_mode & 0o7000:
        return False
    if path == Path("/private/var/run"):
        return stat.S_IMODE(meta.st_mode) == 0o775 and meta.st_gid == 1 and 1 not in groups
    return meta.st_mode & 0o022 == 0


def protected_directory(path):
    """Walk fixed root-owned ancestors without following even intermediate links."""
    fd = os.open("/", FLAGS | os.O_DIRECTORY)
    current = Path("/")
    try:
        for part in path.parts[1:]:
            nxt = os.open(part, FLAGS | os.O_DIRECTORY, dir_fd=fd)
            os.close(fd)
            fd = nxt
            current /= part
            require(directory_ok(current, os.fstat(fd), os.getgroups()), "PROTECTED_DIRECTORY")
        return fd
    except BaseException:
        os.close(fd)
        raise


def file_identity(m):
    return (m.st_dev, m.st_ino, m.st_uid, m.st_gid, m.st_mode, m.st_nlink, m.st_size,
            m.st_mtime_ns, m.st_ctime_ns)


def read_leaf(parent, name, mode, gid, bound):
    fd = os.open(name, FLAGS, dir_fd=parent)
    try:
        m = os.fstat(fd)
        require(stat.S_ISREG(m.st_mode) and m.st_nlink == 1 and m.st_uid == 0 and
                m.st_gid == gid and stat.S_IMODE(m.st_mode) == mode and 0 < m.st_size <= bound,
                "PROTECTED_FILE")
        raw = bytearray()
        while True:
            part = os.read(fd, min(65536, bound + 1 - len(raw)))
            if not part:
                break
            raw.extend(part)
            require(len(raw) <= bound, "PROTECTED_SIZE")
        require(file_identity(os.fstat(fd)) == file_identity(m) and
                file_identity(os.stat(name, dir_fd=parent, follow_symlinks=False)) == file_identity(m),
                "PROTECTED_FILE_DRIFT")
        return bytes(raw)
    finally:
        os.close(fd)


def read_handoff():
    fd = protected_directory(SOCKET)
    try:
        return parse_json(read_leaf(fd, HANDOFF.name, 0o440, 20, 16384))
    finally:
        os.close(fd)


def protected_tool(name, expected):
    require(name in ("agent-deploy-issuer", "agent-deployctl"), "TOOL")
    fd = protected_directory(ROOT)
    try:
        require(sha(read_leaf(fd, name, 0o555, 0, 64 * 1024 * 1024)) == expected, "TOOL_DIGEST")
    finally:
        os.close(fd)


def socket_ready(name):
    require(name in ("control.sock", "issuer.sock"), "SOCKET_NAME")
    fd = protected_directory(SOCKET)
    try:
        m = os.stat(name, dir_fd=fd, follow_symlinks=False)
        require(stat.S_ISSOCK(m.st_mode) and m.st_uid == 0 and m.st_gid == 20 and
                stat.S_IMODE(m.st_mode) == 0o660, "SOCKET_METADATA")
    finally:
        os.close(fd)


class Transport:
    def __init__(self, h, home):
        self.h = h
        self.home = home
        self.started = time.monotonic()
        self.wall = time.time()
        self.previous = 0.0

    def now(self):
        # Clock rollback cannot lengthen either bound; forward jumps expire early.
        return max(time.time(), self.wall + time.monotonic() - self.started)

    def pause(self):
        time.sleep(2)

    def call(self, action, argument, request):
        require(request == REQUEST, "REQUEST_ID")
        require(action in ("prepare", "submit", "status", "receipt", "retry-verification"), "OPERATION")
        if action == "prepare":
            require(argument == SOURCE, "SOURCE")
            name, args, cap = "agent-deploy-issuer", ["prepare", GOAL, SOURCE], 905
        else:
            require(isinstance(argument, str) and re.fullmatch("[0-9a-f]{64}", argument), "ARGUMENT")
            name, args, cap = "agent-deployctl", [action, REQUEST, argument], 10
        # Reserve margin against the existing per-actor 120/minute quota, including receipt fetches.
        time.sleep(max(0, 0.65 - (time.monotonic() - self.previous)))
        self.previous = time.monotonic()
        protected_tool(name, self.h["issuer_sha256" if action == "prepare" else "ctl_sha256"])
        socket_ready("issuer.sock" if action == "prepare" else "control.sock")
        remaining = min(self.h["expires_at"] - self.now(), 1800 - (time.monotonic() - self.started), cap)
        require(remaining > 0, "OUTCOME_UNKNOWN_DEADLINE")
        env = {"PATH": "/usr/bin:/bin", "LANG": "C", "LC_ALL": "C", "HOME": self.home}
        return capture([str(ROOT / name), *args], env, remaining)


def journal_parent(home):
    """The only user-writable output area; no environment-selected pathname."""
    home = Path(home)
    require(home.is_absolute() and home.parts[:2] == ("/", "Users"), "HOME")
    parent = protected_directory(home.parent)
    try:
        fd = os.open(home.name, FLAGS | os.O_DIRECTORY, dir_fd=parent)
    finally:
        os.close(parent)
    try:
        m = os.fstat(fd)
        require(m.st_uid == 502 and m.st_mode & 0o022 == 0, "HOME_METADATA")
        name = ".agent-deploy-first-live"
        try:
            os.mkdir(name, 0o700, dir_fd=fd)
            os.fsync(fd)
        except FileExistsError:
            pass
        child = os.open(name, FLAGS | os.O_DIRECTORY, dir_fd=fd)
        try:
            m = os.fstat(child)
            require(m.st_uid == 502 and stat.S_IMODE(m.st_mode) == 0o700, "JOURNAL_METADATA")
        finally:
            os.close(child)
        return home / name
    finally:
        os.close(fd)


def main():
    require(os.geteuid() == os.getuid() == 502 and os.getegid() == os.getgid() == 20 and
            1 not in os.getgroups(), "CALLER_IDENTITY")
    require(len(sys.argv) == 1, "ARGUMENTS")
    home = pwd.getpwuid(502).pw_dir
    h = read_handoff()
    # Validate before creating any local evidence directory.
    from broker_first_delivery import check_handoff
    transport = Transport(h, home)
    check_handoff(h, transport.now())
    with Journal(journal_parent(home) / OPERATION) as journal:
        try:
            result = run_once(h, journal, transport)
        except BaseException:
            # Preserve every completed prefix; no deletion, retry or changed attempt ID.
            if journal.consumed():
                try:
                    journal.write("failure.json", {"state": "STOP_RECONCILE", "request_id": REQUEST})
                except (OSError, ValueError):
                    pass
            raise
    print(canonical(result).decode())
