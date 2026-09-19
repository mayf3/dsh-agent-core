"""One-shot, exact P4R13 host fence capability prerequisite.

Run only with the isolated system Python from the reviewed visible wrapper.
The only privileged effects are installing one fixed reviewed probe binary and
executing that binary once.  The binary owns the fixed-path, same-fd flag
lifecycle and its durable root journal.
"""
import hashlib
import json
import os
from pathlib import Path
import pwd
import re
import selectors
import stat
import subprocess
import sys
import tempfile
import time


OPERATION = "first-live-dsh-20260918-01-p4r13-fence-capability-prerequisite-01"
PACKAGE_NAME = "p4r13-fence-capability-prerequisite"
PACKAGE_PATH = Path(
    "/Users/yanfenma/workspace/artifacts/production-deployment-control-plane-v1/p4r13-fence-capability-prerequisite"
)
INSTALL_PARENT = "/usr/local/libexec/agent-deployd"
INSTALL_TARGET = INSTALL_PARENT + "/agent-deploy-first-live-fence-probe"
PROBE_PARENT = "/private/var/db/agent-deployd"
PROBE_DIR = PROBE_PARENT + "/first-live-fence-capability-p4r13"
STAT_FORMAT = "%d|%i|%u|%g|%Lp|%l|%f|%z|%m|%c|%B|%HT"
LIMIT = 2 * 1024 * 1024


def require(ok, reason):
    if not ok:
        raise RuntimeError(reason)


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()


def unique(pairs):
    out = {}
    for key, value in pairs:
        require(key not in out, "DUPLICATE_JSON_KEY")
        out[key] = value
    return out


def identity(metadata):
    return (
        metadata.st_dev,
        metadata.st_ino,
        metadata.st_uid,
        metadata.st_gid,
        metadata.st_mode,
        metadata.st_nlink,
        metadata.st_size,
        metadata.st_mtime_ns,
        metadata.st_ctime_ns,
        getattr(metadata, "st_flags", 0),
    )


def stable_parent(value):
    return {key: value[key] for key in ("device", "inode", "uid", "gid", "mode", "flags", "type")}


def ordinary_home():
    require(
        os.getuid() == os.geteuid() == 502
        and os.getgid() == os.getegid() == 20
        and 1 not in os.getgroups(),
        "UID502_GID20_REQUIRED",
    )
    user = pwd.getpwuid(502)
    require(user.pw_uid == 502 and user.pw_gid == 20 and Path(user.pw_dir).is_absolute(), "PASSWD_BINDING")
    return Path(user.pw_dir)


def open_directory(path):
    require(path.is_absolute() and ".." not in path.parts, "DIRECTORY_PATH")
    descriptor = os.open("/", os.O_RDONLY | os.O_DIRECTORY | os.O_CLOEXEC)
    try:
        for part in path.parts[1:]:
            next_descriptor = os.open(
                part,
                os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC,
                dir_fd=descriptor,
            )
            os.close(descriptor)
            descriptor = next_descriptor
        return descriptor
    except BaseException:
        os.close(descriptor)
        raise


def claim_journal(home):
    home_descriptor = open_directory(home)
    try:
        try:
            os.mkdir(".agent-deploy-first-live-operator", 0o700, dir_fd=home_descriptor)
            os.fsync(home_descriptor)
        except FileExistsError:
            pass
        parent = os.open(
            ".agent-deploy-first-live-operator",
            os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC,
            dir_fd=home_descriptor,
        )
    finally:
        os.close(home_descriptor)
    try:
        metadata = os.fstat(parent)
        require(
            metadata.st_uid == 502
            and metadata.st_gid == 20
            and stat.S_IMODE(metadata.st_mode) == 0o700
            and getattr(metadata, "st_flags", 0) == 0,
            "JOURNAL_PARENT_METADATA",
        )
        os.mkdir(OPERATION, 0o700, dir_fd=parent)
        os.fsync(parent)
        journal = os.open(
            OPERATION,
            os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC,
            dir_fd=parent,
        )
    finally:
        os.close(parent)
    metadata = os.fstat(journal)
    require(
        metadata.st_uid == 502
        and metadata.st_gid == 20
        and stat.S_IMODE(metadata.st_mode) == 0o700
        and getattr(metadata, "st_flags", 0) == 0,
        "JOURNAL_METADATA",
    )
    return journal, (metadata.st_dev, metadata.st_ino), home / ".agent-deploy-first-live-operator" / OPERATION


def open_package(path):
    require(path.is_absolute() and ".." not in path.parts, "PACKAGE_PATH")
    descriptor = os.open("/", os.O_RDONLY | os.O_DIRECTORY | os.O_CLOEXEC)
    try:
        for part in path.parts[1:]:
            next_descriptor = os.open(
                part,
                os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC,
                dir_fd=descriptor,
            )
            os.close(descriptor)
            descriptor = next_descriptor
        metadata = os.fstat(descriptor)
        require(
            metadata.st_uid == 502
            and metadata.st_gid == 20
            and stat.S_IMODE(metadata.st_mode) == 0o700
            and getattr(metadata, "st_flags", 0) == 0,
            "PACKAGE_METADATA",
        )
        return descriptor
    except BaseException:
        os.close(descriptor)
        raise


def read_file(parent, name, expected, *, maximum=LIMIT):
    require(type(name) is str and "/" not in name and name not in ("", ".", ".."), "FILE_NAME")
    require(type(expected) is dict and set(expected) == {"sha256", "size", "mode"}, "FILE_SPEC")
    require(type(expected["sha256"]) is str and len(expected["sha256"]) == 64, "DIGEST")
    descriptor = os.open(
        name,
        os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC | os.O_NONBLOCK,
        dir_fd=parent,
    )
    try:
        before = os.fstat(descriptor)
        require(
            stat.S_ISREG(before.st_mode)
            and before.st_uid == 502
            and before.st_gid == 20
            and before.st_nlink == 1
            and stat.S_IMODE(before.st_mode) == int(expected["mode"], 8)
            and getattr(before, "st_flags", 0) == 0
            and before.st_size == expected["size"]
            and 0 < before.st_size <= maximum,
            "FILE_METADATA",
        )
        raw = bytearray()
        while len(raw) <= maximum:
            part = os.read(descriptor, min(65536, maximum + 1 - len(raw)))
            if not part:
                break
            raw.extend(part)
        require(len(raw) == before.st_size and sha(raw) == expected["sha256"], "FILE_DIGEST")
        require(identity(os.fstat(descriptor)) == identity(before), "FILE_CHANGED")
        require(
            identity(os.stat(name, dir_fd=parent, follow_symlinks=False)) == identity(before),
            "FILE_REPLACED",
        )
        return bytes(raw)
    finally:
        os.close(descriptor)


def validate_source_review(manifest, review_md, review_json):
    review = json.loads(review_json, object_pairs_hook=unique)
    require(canonical(review) == review_json, "SOURCE_REVIEW_CANONICAL")
    require(
        manifest["source_review"]
        == {"report_sha256": sha(review_md), "record_sha256": sha(review_json), "verdict": "PASS"}
        and review.get("version") == 1
        and review.get("verdict") == "PASS"
        and review.get("source_commit") == manifest["source_commit"]
        and review.get("source_tree") == manifest["source_tree"]
        and review.get("report_sha256") == sha(review_md)
        and review.get("new_ship_blockers") == []
        and review.get("production_mutation_performed") is False
        and review.get("root_probe_executed") is False,
        "SOURCE_REVIEW",
    )


class Operation:
    def __init__(self, manifest, manifest_digest, binary, journal_fd, journal_identity, journal_path):
        self.manifest = manifest
        self.manifest_digest = manifest_digest
        self.binary = binary
        self.sequence = 0
        self.phase = "preflight"
        self.journal_fd = journal_fd
        self.journal_identity = journal_identity
        self.journal_path = journal_path
        self.env = {"PATH": "/usr/bin:/bin:/usr/sbin:/sbin", "LANG": "C", "LC_ALL": "C"}
        self.record(
            "operation-intent.json",
            {
                "operation_id": OPERATION,
                "manifest_sha256": manifest_digest,
                "source_commit": manifest["source_commit"],
                "source_tree": manifest["source_tree"],
                "state": "CONSUMED",
            },
        )

    def record(self, name, value):
        require(re.fullmatch(r"[a-zA-Z0-9_.-]{1,160}", name) is not None, "RECORD_NAME")
        metadata = self.journal_path.lstat()
        require(
            stat.S_ISDIR(metadata.st_mode)
            and (metadata.st_dev, metadata.st_ino) == self.journal_identity
            and metadata.st_uid == 502
            and metadata.st_gid == 20
            and stat.S_IMODE(metadata.st_mode) == 0o700
            and getattr(metadata, "st_flags", 0) == 0,
            "JOURNAL_DRIFT",
        )
        raw = canonical(value)
        require(len(raw) <= LIMIT, "RECORD_BOUND")
        descriptor = os.open(
            name,
            os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW | os.O_CLOEXEC,
            0o600,
            dir_fd=self.journal_fd,
        )
        with os.fdopen(descriptor, "wb") as stream:
            stream.write(raw)
            stream.flush()
            os.fsync(stream.fileno())
        os.fsync(self.journal_fd)

    def invoke(self, argv, *, visible=False, stdin=None, timeout=120):
        self.sequence += 1
        name = f"{self.sequence:04d}-{self.phase}"
        self.record(name + "-intent.json", {"argv": argv, "visible": visible})
        if visible:
            require(stdin is None and sys.stdin.isatty() and sys.stdout.isatty(), "VISIBLE_TTY")
            result = subprocess.run(argv, env=self.env, cwd="/", close_fds=True, check=False)
            status, out, err = result.returncode, b"", b""
        else:
            process = subprocess.Popen(
                argv,
                env=self.env,
                cwd="/",
                stdin=stdin if stdin is not None else subprocess.DEVNULL,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                close_fds=True,
            )
            selector = selectors.DefaultSelector()
            data = [bytearray(), bytearray()]
            try:
                for index, stream in enumerate((process.stdout, process.stderr)):
                    selector.register(stream, selectors.EVENT_READ, index)
                end = time.monotonic() + timeout
                while selector.get_map() or process.poll() is None:
                    require(time.monotonic() < end, "COMMAND_TIMEOUT")
                    for key, _ in selector.select(min(0.1, max(0, end - time.monotonic()))):
                        raw = os.read(key.fileobj.fileno(), 65536)
                        if not raw:
                            selector.unregister(key.fileobj)
                        else:
                            data[key.data].extend(raw)
                            require(sum(map(len, data)) <= LIMIT, "OUTPUT_BOUND")
                status, out, err = process.returncode, bytes(data[0]), bytes(data[1])
            except BaseException:
                if process.poll() is None:
                    process.kill()
                    try:
                        process.wait(timeout=2)
                    except subprocess.TimeoutExpired:
                        pass
                raise
            finally:
                selector.close()
                process.stdout.close()
                process.stderr.close()
        self.record(
            name + "-result.json",
            {
                "exit": status,
                "stdout_sha256": sha(out),
                "stdout_size": len(out),
                "stderr_sha256": sha(err),
                "stderr_size": len(err),
                "contents_retained": False,
                "visible": visible,
            },
        )
        return status, out, err

    def root(self, argv, *, stdin=None, timeout=120):
        return self.invoke(["/usr/bin/sudo", "-n"] + argv, stdin=stdin, timeout=timeout)

    def expect_success(self, result, reason):
        status, out, err = result
        require(status == 0, reason)
        return out, err

    def stat(self, path, *, missing=False):
        status, out, err = self.root(["/usr/bin/stat", "-f", STAT_FORMAT, path])
        if missing and status == 1 and not out and b"No such file or directory" in err:
            return None
        require(status == 0 and not err, "STAT")
        fields = out.decode().strip().split("|")
        require(len(fields) == 12, "STAT_FORMAT")
        keys = ["device", "inode", "uid", "gid", "mode", "nlink", "flags", "size", "mtime", "ctime", "birthtime"]
        value = {key: int(raw, 8 if key == "mode" else 10) for key, raw in zip(keys, fields)}
        value["mode"] &= 0o7777
        value["type"] = fields[-1]
        return value

    def run(self):
        self.expect_success(self.invoke(["/usr/bin/sudo", "-v"], visible=True), "AUTHENTICATION")
        install_parent = self.stat(INSTALL_PARENT)
        require(
            install_parent == self.manifest["install_parent"],
            "INSTALL_PARENT_DRIFT",
        )
        probe_parent = self.stat(PROBE_PARENT)
        require(probe_parent == self.manifest["probe_parent"], "PROBE_PARENT_DRIFT")
        require(self.stat(INSTALL_TARGET, missing=True) is None, "INSTALL_TARGET_PRESENT")
        require(self.stat(PROBE_DIR, missing=True) is None, "PROBE_ALREADY_PRESENT")

        self.phase = "install"
        with tempfile.TemporaryFile(dir=self.journal_path) as source:
            source.write(self.binary)
            source.flush()
            source.seek(0)
            metadata = os.fstat(source.fileno())
            require(
                stat.S_ISREG(metadata.st_mode)
                and metadata.st_uid == 502
                and metadata.st_nlink == 0
                and stat.S_IMODE(metadata.st_mode) == 0o600,
                "INSTALL_INPUT_FD",
            )
            self.expect_success(
                self.root(
                    [
                        "/usr/bin/install",
                        "-o",
                        "root",
                        "-g",
                        "wheel",
                        "-m",
                        "0555",
                        "/dev/fd/0",
                        INSTALL_TARGET,
                    ],
                    stdin=source,
                ),
                "INSTALL_FAILED",
            )
        installed = self.stat(INSTALL_TARGET)
        expected = self.manifest["installed_probe"]
        require(
            installed["uid"] == 0
            and installed["gid"] == 0
            and installed["mode"] == 0o555
            and installed["nlink"] == 1
            and installed["flags"] == 0
            and installed["size"] == expected["size"]
            and installed["type"] == "Regular File",
            "INSTALLED_METADATA",
        )
        digest_out, digest_err = self.expect_success(
            self.root(["/usr/bin/shasum", "-a", "256", INSTALL_TARGET]),
            "INSTALLED_DIGEST_READ",
        )
        require(not digest_err and digest_out.decode().split()[0] == expected["sha256"], "INSTALLED_DIGEST")

        self.phase = "probe"
        status, out, err = self.root([INSTALL_TARGET])
        require(status == 0 and not err, "PROBE_FAILED")
        result = json.loads(out, object_pairs_hook=unique)
        require(canonical(result) + b"\n" == out, "PROBE_OUTPUT")
        require(result == self.manifest["expected_result"], "PROBE_RESULT")

        self.phase = "readback"
        require(
            stable_parent(self.stat(INSTALL_PARENT)) == stable_parent(install_parent),
            "INSTALL_PARENT_CHANGED",
        )
        require(
            stable_parent(self.stat(PROBE_PARENT)) == stable_parent(probe_parent),
            "PROBE_PARENT_CHANGED",
        )
        probe = self.stat(PROBE_DIR)
        target = self.stat(PROBE_DIR + "/target")
        require(
            probe["uid"] == 0
            and probe["gid"] == 0
            and probe["mode"] == 0o700
            and probe["flags"] == 0
            and probe["type"] == "Directory",
            "PROBE_DIRECTORY",
        )
        require(
            target["uid"] == 0
            and target["gid"] == 0
            and target["mode"] == 0o700
            and target["flags"] == 0
            and target["type"] == "Directory",
            "PROBE_TARGET_NOT_CLEARED",
        )
        result_out, result_err = self.expect_success(
            self.root(["/bin/cat", PROBE_DIR + "/result.json"]),
            "PROBE_RESULT_READ",
        )
        require(not result_err and result_out == canonical(result), "PROBE_RESULT_DRIFT")
        names_out, names_err = self.expect_success(
            self.root(["/bin/ls", "-1A", PROBE_DIR]),
            "PROBE_INVENTORY_READ",
        )
        require(
            not names_err
            and names_out.decode().splitlines()
            == ["clear-intent.json", "intent.json", "result.json", "set-result.json", "target"],
            "PROBE_INVENTORY",
        )
        final = {
            "operation_id": OPERATION,
            "state": "SUPPORTED_AND_CLEARED",
            "installed_probe": {"path": INSTALL_TARGET, "sha256": expected["sha256"]},
            "probe_result_sha256": sha(result_out),
            "root_journal": PROBE_DIR,
        }
        self.record("completed.json", final)
        return final

    def execute(self):
        try:
            return self.run()
        except BaseException as error:
            try:
                self.record(
                    "stopped.json",
                    {
                        "state": "STOP_RECONCILE",
                        "retry_forbidden": True,
                        "error_type": type(error).__name__,
                        "reason": str(error),
                    },
                )
            except BaseException:
                pass
            raise


def main():
    require(
        sys.flags.isolated
        and sys.flags.no_site
        and sys.flags.dont_write_bytecode
        and sys.flags.ignore_environment
        and sys.flags.no_user_site,
        "ISOLATED_SYSTEM_PYTHON_REQUIRED",
    )
    require(os.getuid() == os.geteuid() == 502 and os.getgid() == os.getegid() == 20, "UID502_GID20_REQUIRED")
    require(len(sys.argv) == 2 and len(sys.argv[1]) == 64, "MANIFEST_ARGUMENT")
    require(Path(sys.executable) == Path("/Library/Developer/CommandLineTools/usr/bin/python3"), "SYSTEM_PYTHON_REQUIRED")
    require(Path(__file__) == Path("/dev/fd/9"), "FD_BOUND_ENTRY_REQUIRED")
    package = PACKAGE_PATH
    parent = open_package(package)
    try:
        manifest_spec = {"sha256": sys.argv[1], "size": os.stat(package / "manifest.json").st_size, "mode": "0400"}
        manifest_raw = read_file(parent, "manifest.json", manifest_spec)
        manifest = json.loads(manifest_raw, object_pairs_hook=unique)
        require(canonical(manifest) == manifest_raw, "MANIFEST_CANONICAL")
        require(
            type(manifest) is dict
            and set(manifest)
            == {
                "version",
                "operation_id",
                "source_commit",
                "source_tree",
                "source_review",
                "operator_files",
                "files",
                "install_parent",
                "probe_parent",
                "installed_probe",
                "expected_result",
            }
            and manifest["version"] == 1
            and manifest["operation_id"] == OPERATION,
            "MANIFEST_SCHEMA",
        )
        require(
            type(manifest["operator_files"]) is dict
            and set(manifest["operator_files"]) == {"fence_capability_prerequisite.py"},
            "OPERATOR_SET",
        )
        read_file(
            parent,
            "fence_capability_prerequisite.py",
            manifest["operator_files"]["fence_capability_prerequisite.py"],
        )
        require(
            set(manifest["files"])
            == {"agent-deploy-first-live-fence-probe", "source-review.md", "source-review.json"},
            "FILE_SET",
        )
        binary = read_file(parent, "agent-deploy-first-live-fence-probe", manifest["files"]["agent-deploy-first-live-fence-probe"])
        review_md = read_file(parent, "source-review.md", manifest["files"]["source-review.md"])
        review_json = read_file(parent, "source-review.json", manifest["files"]["source-review.json"])
        validate_source_review(manifest, review_md, review_json)
        require(manifest["installed_probe"] == manifest["files"]["agent-deploy-first-live-fence-probe"], "BINARY_BINDING")
    finally:
        os.close(parent)
    home = ordinary_home()
    journal_fd, journal_identity, journal_path = claim_journal(home)
    try:
        operation = Operation(manifest, sys.argv[1], binary, journal_fd, journal_identity, journal_path)
        result = operation.execute()
        print(canonical(result).decode())
    finally:
        os.close(journal_fd)


if __name__ == "__main__":
    try:
        main()
    except BaseException as error:
        print(f"BLOCKED {error}", file=sys.stderr)
        raise
