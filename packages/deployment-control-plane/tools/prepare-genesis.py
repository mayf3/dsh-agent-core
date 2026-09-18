#!/usr/bin/env python3
"""Build and freeze a disabled genesis package as a non-root user (Python >= 3.11).

prepare: --source REPO --revision SHA40 --output NEW_ABSOLUTE_DIR
         --review-record REPORT --policy PROSPECTIVE_POLICY_JSON
finalize: --finalize-review EXISTING_PACKAGE --review-record FINAL_REPORT
Six pins and build evidence are siblings, never extra files inside the package.
Neither mode grants bootstrap permission or authenticates an independent review.
"""
import argparse
import ctypes
import hashlib
import json
import os
from pathlib import Path
import pwd
import re
import stat
import subprocess
import sys
import tempfile
import tomllib

PACKAGE = "packages/deployment-control-plane"
ARTIFACTS = "deployment-artifacts/control-plane-genesis-v1"
INITIAL = f"{ARTIFACTS}/initial-registry.json"
REQUIRED = ("docs/specs/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1.md",
            "docs/specs/AGENT_CORE_WORKFLOW_GLOBAL_INSTANCES_CAPABILITY_V4.md",
            "docs/reports/WORKFLOW_GLOBAL_INSTANCES_CAPABILITY_V4_ACCEPTANCE_V1.md")
BUILD_PATHS = (PACKAGE, ARTIFACTS, ".cargo", "rust-toolchain", "rust-toolchain.toml", "Cargo.toml", "Cargo.lock", *REQUIRED)
TEMPLATE_FIELDS = ("paths", "identities", "roles", "operations", "abort_conditions", "rollback", "future_outputs", "required_review_scopes")
PIN_FIELDS = ("plan_digest", "package_digest", "source_digest", "review_record_digest", "initial_registry_digest", "supervisor_policy_digest")
CODE_ROOT = "/usr/local/libexec/agent-deployd"
BINARIES = ("agent-deployd", "agent-deploy-issuer", "agent-deploy-bootstrap", "codex")
SCHEMA = "review-output-schema.json"


def need(condition, code):
    if not condition:
        raise ValueError(code)


def canonical(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False, allow_nan=False, separators=(",", ":")).encode("utf-8")


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def json_read(raw):
    def pairs(values):
        result = {}
        for key, value in values:
            need(key not in result, "DUPLICATE_JSON_KEY")
            result[key] = value
        return result
    return json.loads(raw, object_pairs_hook=pairs, parse_constant=lambda _: (_ for _ in ()).throw(ValueError("INVALID_JSON_NUMBER")))


def read_file(path, limit=16 * 1024 * 1024):
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(fd, "rb") as stream:
        before = os.fstat(stream.fileno())
        need(stat.S_ISREG(before.st_mode) and before.st_size <= limit, "UNSAFE_INPUT_FILE")
        raw = stream.read(limit + 1)
        after = os.fstat(stream.fileno())
        need(len(raw) == before.st_size and (before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns, before.st_ctime_ns)
             == (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns, after.st_ctime_ns), "INPUT_CHANGED")
        return raw


def sync_dir(path):
    fd = os.open(path, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def xattrs(fd):
    if hasattr(os, "listxattr"):
        return os.listxattr(fd)
    need(sys.platform == "darwin", "XATTR_PLATFORM_UNSUPPORTED")
    libc = ctypes.CDLL(None, use_errno=True)
    libc.flistxattr.argtypes = (ctypes.c_int, ctypes.c_void_p, ctypes.c_size_t, ctypes.c_int)
    libc.flistxattr.restype = ctypes.c_ssize_t
    count = libc.flistxattr(fd, None, 0, 0)
    need(0 <= count <= 65536, "XATTR_READ_FAILED")
    buffer = ctypes.create_string_buffer(count or 1)
    need(libc.flistxattr(fd, buffer, count, 0) == count, "XATTR_CHANGED")
    return [name.decode() for name in buffer.raw[:count].split(b"\0") if name]


def clear_xattrs(fd):
    for name in xattrs(fd):
        if hasattr(os, "removexattr"):
            os.removexattr(fd, name)
        else:
            libc = ctypes.CDLL(None, use_errno=True)
            libc.fremovexattr.argtypes = (ctypes.c_int, ctypes.c_char_p, ctypes.c_int)
            need(libc.fremovexattr(fd, name.encode(), 0) == 0, "XATTR_REMOVE_FAILED")


def write_new(path, raw, mode=0o400):
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, "wb") as stream:
        stream.write(raw)
        clear_xattrs(stream.fileno())
        os.fchmod(stream.fileno(), mode)
        # macOS may recreate its own provenance attribute after chmod. No input
        # xattrs are copied; the Rust reader accepts only this platform attribute.
        need(set(xattrs(stream.fileno())) <= {"com.apple.provenance"}, "UNSAFE_OUTPUT_XATTR")
        stream.flush()
        os.fsync(stream.fileno())
    sync_dir(path.parent)


def command(args, cwd=None, env=None, timeout=120):
    result = subprocess.run([str(a) for a in args], cwd=cwd, env=env, stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, timeout=timeout, check=False)
    need(len(result.stdout) + len(result.stderr) <= 32 * 1024 * 1024, "COMMAND_OUTPUT_LIMIT")
    if result.returncode:
        raise ValueError(f"COMMAND_FAILED {args[0]}: {result.stderr.decode(errors='replace')[-2000:]}")
    return result.stdout


def git(repo, *args):
    return command(["/usr/bin/git", "-C", repo, *args], env={"PATH": "/usr/bin:/bin", "GIT_CONFIG_NOSYSTEM": "1", "GIT_CONFIG_GLOBAL": "/dev/null"})


def check_source(repo, revision):
    need(re.fullmatch(r"[0-9a-f]{40}", revision) is not None, "EXACT_SOURCE_REVISION_REQUIRED")
    need(git(repo, "rev-parse", "--show-toplevel").decode().strip() == str(repo), "SOURCE_ROOT_REQUIRED")
    need(git(repo, "rev-parse", f"{revision}^{{commit}}").decode().strip() == revision, "SOURCE_COMMIT_REQUIRED")
    git(repo, "merge-base", "--is-ancestor", revision, "HEAD")
    need(not git(repo, "status", "--porcelain=v1", "--untracked-files=all", "--", *BUILD_PATHS), "DIRTY_CODE")
    need(not git(repo, "diff", "--name-only", revision, "HEAD", "--", *BUILD_PATHS), "EXECUTABLE_SOURCE_DRIFT")
    for parent in (repo / PACKAGE, *(repo / PACKAGE).parents):
        need(not any((parent / ".cargo" / name).exists() for name in ("config", "config.toml")), "UNPINNED_CARGO_CONFIG")


def sources_at(repo, revision):
    sources = {}
    listing = git(repo, "ls-tree", "-r", "-z", revision, "--", *BUILD_PATHS)
    for entry in listing.split(b"\0"):
        if not entry:
            continue
        metadata, path = entry.split(b"\t", 1)
        mode, kind, object_id = metadata.decode().split()
        path = path.decode("utf-8")
        need(mode in ("100644", "100755") and kind == "blob", "SOURCE_SPECIAL_FILE")
        need(all(re.fullmatch(r"[A-Za-z0-9_.-]+", part) and part not in (".", "..") for part in path.split("/")), "UNSAFE_SOURCE_PATH")
        raw = git(repo, "cat-file", "blob", object_id)
        need(len(raw) <= 16 * 1024 * 1024, "SOURCE_SIZE_LIMIT")
        sources[path] = raw
    need(all(path in sources for path in (*REQUIRED, INITIAL, f"{PACKAGE}/Cargo.lock", f"{PACKAGE}/Cargo.toml")), "SOURCE_CLOSURE_REQUIRED")
    need(len(sources) <= 4096 and sum(map(len, sources.values())) <= 256 * 1024 * 1024, "SOURCE_CLOSURE_LIMIT")
    return sources


def build_environment(scratch, home):
    return {"PATH": f"{home}/.cargo/bin:/usr/bin:/bin:/usr/sbin:/sbin", "HOME": str(scratch / "home"),
            "CARGO_HOME": str(scratch / "cargo-home"), "RUSTUP_HOME": str(home / ".rustup"),
            "CARGO_TARGET_DIR": str(scratch / "target"), "TMPDIR": str(scratch / "tmp"),
            "LC_ALL": "C", "LANG": "C"}


def seed_registry(home, scratch, lock_bytes):
    # Copy only public crates.io cache entries named by Cargo.lock. No config,
    # credentials, tokens, Git checkouts, or user source directories are imported.
    packages = tomllib.loads(lock_bytes.decode())["package"]
    for package in packages:
        source = package.get("source")
        if source is None:
            continue
        need(source == "registry+https://github.com/rust-lang/crates.io-index", "NONPUBLIC_CARGO_SOURCE")
        name, version = package["name"], package["version"]
        need(re.fullmatch(r"[A-Za-z0-9_-]+", name) and re.fullmatch(r"[A-Za-z0-9.+-]+", version), "INVALID_CRATE")
        lower = name.lower()
        index_path = f"1/{lower}" if len(lower) == 1 else f"2/{lower}" if len(lower) == 2 else f"3/{lower[0]}/{lower}" if len(lower) == 3 else f"{lower[:2]}/{lower[2:4]}/{lower}"
        registry = home / ".cargo/registry"
        for base in (registry / "cache").glob("index.crates.io-*"):
            archive = base / f"{name}-{version}.crate"
            if archive.is_file() and not archive.is_symlink():
                raw = read_file(archive, 64 * 1024 * 1024)
                need(sha(raw) == package["checksum"], "CARGO_CACHE_CHECKSUM")
                write_new(scratch / "cargo-home/registry/cache" / base.name / archive.name, raw, 0o600)
        for base in (registry / "index").glob("index.crates.io-*"):
            entry = base / ".cache" / index_path
            if entry.is_file() and not entry.is_symlink():
                target = scratch / "cargo-home/registry/index" / base.name
                index_target = target / ".cache" / index_path
                if not index_target.exists():
                    write_new(index_target, read_file(entry), 0o600)
                if not (target / "config.json").exists():
                    write_new(target / "config.json", canonical({"dl": "https://static.crates.io/crates", "api": "https://crates.io"}), 0o600)


def assemble(template, authority, revision, tree, sources, executables, support, initial, policy, review):
    source_map = {path: sha(raw) for path, raw in sources.items()}
    package = {"version": 1, "source_revision": revision, "source_tree": tree, "source_files": source_map,
               "executables": {path: sha(raw) for path, raw in executables.items()},
               "support_files": {path: sha(raw) for path, raw in support.items()},
               "initial_registry_digest": sha(initial), "supervisor_policy_digest": sha(policy)}
    plan = dict(package, accepted_authority=authority, package_digest=sha(canonical(package)),
                source_digest=sha(canonical(source_map)), review_record_digest=sha(review),
                profile_enabled=False, activation_requested=False,
                owner_authorization={"owner": "mayf3", "method": "ExternalExactPackageAuthorization",
                                     "scope": "DisabledInstallationOnly", "attempt_limit": 1, "validity_seconds": 3600})
    plan.update({key: template[key] for key in TEMPLATE_FIELDS})
    pins = {key: plan[key] for key in PIN_FIELDS if key != "plan_digest"}
    pins["plan_digest"] = sha(canonical(plan))
    return package, plan, pins


def external_paths(output):
    return Path(f"{output}.pins.json"), Path(f"{output}.preparation.json")


def verify(output, pins, env):
    plan = json_read(read_file(output / "plan.json"))
    need(sha(canonical(plan)) == pins["plan_digest"], "PLAN_PIN_MISMATCH")
    bootstrap = output / "executables/agent-deploy-bootstrap"
    need(sha(read_file(bootstrap, 512 * 1024 * 1024)) == plan["executables"][f"{CODE_ROOT}/agent-deploy-bootstrap"], "BOOTSTRAP_BINARY_DRIFT")
    raw = command([output / "executables/agent-deploy-bootstrap", "verify", output,
                   *(pins[key] for key in PIN_FIELDS)], env=env)
    result = json_read(raw)
    need(result.get("artifact_integrity_verified") is True and result.get("plan_ready") is True, "PACKAGE_VERIFICATION_FAILED")
    for field in ("bootstrap_allowed", "activation_allowed", "protected_poststate_verified", "independent_review_result_verified"):
        need(result.get(field) is False, "FALSE_READINESS_CLAIM")
    return result


def prepare(args):
    need(os.geteuid() != 0, "PREPARATION_REFUSES_ROOT")
    repo = Path(args.source).resolve(strict=True)
    output = Path(args.output)
    need(output.is_absolute() and not output.exists() and not output.is_symlink(), "NEW_ABSOLUTE_OUTPUT_REQUIRED")
    need(output.parent.is_dir(), "OUTPUT_PARENT_REQUIRED")
    output = output.parent.resolve(strict=True) / output.name
    pins_path, evidence_path = external_paths(output)
    need(not pins_path.exists() and not evidence_path.exists(), "OUTPUT_EVIDENCE_EXISTS")
    check_source(repo, args.revision)
    sources = sources_at(repo, args.revision)
    tree = git(repo, "rev-parse", f"{args.revision}^{{tree}}").decode().strip()
    review = read_file(Path(args.review_record).resolve(strict=True))
    need(bool(review), "REVIEW_RECORD_REQUIRED")
    policy = json_read(read_file(Path(args.policy).resolve(strict=True)))
    need(policy["profile"]["enabled"] is False, "DISABLED_PROFILE_REQUIRED")
    initial = sources[INITIAL]
    need(len(json_read(initial)) == 1, "INITIAL_ENROLLMENT_REQUIRED")
    policy_source = sources[f"{PACKAGE}/src/bootstrap/genesis_policy.rs"].decode()
    authority = re.search(r'pub const GENESIS_AUTHORITY: &str = "([0-9a-f]{40})";', policy_source)
    need(authority is not None, "GENESIS_AUTHORITY_REQUIRED")
    review_source = sources[f"{PACKAGE}/src/issuer/review.rs"].decode()
    schema = re.search(r'pub const REVIEW_SCHEMA_JSON: &str = r#"(.*?)"#;', review_source, re.S)
    need(schema is not None, "REVIEW_SCHEMA_REQUIRED")
    schema_bytes = schema[1].encode()
    json_read(schema_bytes)
    home = Path(pwd.getpwuid(os.geteuid()).pw_dir)
    codex_alias = home / ".codex/packages/standalone/current/bin/codex"
    codex = codex_alias.resolve(strict=True)
    executables = {f"{CODE_ROOT}/codex": read_file(codex, 512 * 1024 * 1024)}
    output.mkdir(mode=0o700)
    temp_root = Path(command(["/usr/bin/getconf", "DARWIN_USER_TEMP_DIR"], env={"PATH": "/usr/bin:/bin"}).decode().strip()).resolve(strict=True)
    need(temp_root.stat().st_uid == os.geteuid() and temp_root.stat().st_mode & 0o777 == 0o700, "PRIVATE_TEMP_REQUIRED")
    with tempfile.TemporaryDirectory(prefix="dcp-genesis-build-", dir=temp_root) as temp:
        scratch = Path(temp).resolve()
        env = build_environment(scratch, home)
        for name in ("home", "cargo-home", "tmp"):
            (scratch / name).mkdir(mode=0o700)
        seed_registry(home, scratch, sources[f"{PACKAGE}/Cargo.lock"])
        cargo, rustc = home / ".cargo/bin/cargo", home / ".cargo/bin/rustc"
        compiler = command([rustc, "-vV"], cwd=repo / PACKAGE, env=env).decode()
        cargo_version = command([cargo, "-vV"], cwd=repo / PACKAGE, env=env).decode()
        build = [cargo, "build", "--release", "--locked", "--manifest-path", repo / PACKAGE / "Cargo.toml"]
        command(build, cwd=repo / PACKAGE, env=env, timeout=900)
        check_source(repo, args.revision)
        need(codex_alias.resolve(strict=True) == codex
             and sha(read_file(codex, 512 * 1024 * 1024)) == sha(executables[f"{CODE_ROOT}/codex"]), "CODEX_CURRENT_CHANGED")
        for name in BINARIES[:-1]:
            executables[f"{CODE_ROOT}/{name}"] = read_file(scratch / "target/release" / name, 512 * 1024 * 1024)
        need(sum(map(len, executables.values())) <= 1024 * 1024 * 1024, "EXECUTABLE_SIZE_LIMIT")
        for path, raw in executables.items():
            write_new(output / "executables" / Path(path).name, raw, 0o500)
        bootstrap = output / "executables/agent-deploy-bootstrap"
        template = json_read(command([bootstrap, "template"], env=env))
        need(set(template) == set(TEMPLATE_FIELDS) | {"host"}, "GENESIS_TEMPLATE_FIELDS")
        need(policy["profile"]["host"] == template["host"], "PROFILE_HOST_MISMATCH")
        policy["issuer_policy"]["codex_sha256"] = sha(executables[f"{CODE_ROOT}/codex"])
        policy["issuer_policy"]["review_helper_sha256"] = sha(executables[f"{CODE_ROOT}/agent-deploy-issuer"])
        policy_bytes = canonical(policy)
        support = {f"{CODE_ROOT}/{SCHEMA}": schema_bytes}
        package, plan, pins = assemble(template, authority[1], args.revision, tree, sources, executables, support, initial, policy_bytes, review)
        for path, raw in sources.items():
            write_new(output / "sources" / path, raw)
        for name, raw in {"package.json": canonical(package), "plan.json": canonical(plan), "review-record": review,
                          "initial-registry.json": initial, "supervisor-policy.json": policy_bytes,
                          f"support/{SCHEMA}": schema_bytes}.items():
            write_new(output / name, raw)
        checked = verify(output, pins, env)
        evidence = {"kind": "local-source-build-and-package-observation", "source_repository": str(repo),
                    "source_revision": args.revision, "source_tree": tree, "source_digest": pins["source_digest"],
                    "build_command": [str(a) for a in build], "build_exit_code": 0, "cargo": cargo_version, "rustc": compiler,
                    "rustc_host": re.search(r"^host: (.+)$", compiler, re.M)[1],
                    "codex_resolved_path": str(codex), "executables": package["executables"],
                    "binary_architectures": {Path(p).name: command(["/usr/bin/file", "-b", output / "executables" / Path(p).name], env=env).decode().strip() for p in executables},
                    "host_observation": template["host"], "cargo_environment_keys": sorted(env),
                    "ambient_rust_overrides_inherited": False, "credential_files_imported": False,
                    "independent_build_authenticity_verified": False, "independent_review_verified": False,
                    "bootstrap_authorized": False, "activation_allowed": False, "verification": checked}
        write_new(pins_path, canonical(pins))
        write_new(evidence_path, canonical(evidence))
    return {"package": str(output), "pins": str(pins_path), "evidence": str(evidence_path), "bootstrap_allowed": False}


def replace_exact(path, raw):
    temporary = path.with_name(path.name + ".pending")
    write_new(temporary, raw)
    os.replace(temporary, path)
    sync_dir(path.parent)


def finalize(args):
    need(os.geteuid() != 0, "PREPARATION_REFUSES_ROOT")
    output = Path(args.finalize_review)
    need(output.is_absolute(), "ABSOLUTE_PACKAGE_REQUIRED")
    output = output.resolve(strict=True)
    pins_path, evidence_path = external_paths(output)
    pins = json_read(read_file(pins_path))
    need(set(pins) == set(PIN_FIELDS), "GENESIS_PIN_FIELDS")
    home = Path(pwd.getpwuid(os.geteuid()).pw_dir)
    env = {"PATH": "/usr/bin:/bin", "HOME": str(home), "LC_ALL": "C"}
    verify(output, pins, env)
    review = read_file(Path(args.review_record).resolve(strict=True))
    need(bool(review), "REVIEW_RECORD_REQUIRED")
    plan = json_read(read_file(output / "plan.json"))
    plan["review_record_digest"] = sha(review)
    updated = dict(pins, review_record_digest=sha(review), plan_digest=sha(canonical(plan)))
    # Interrupted multi-file replacement is a fail-closed package, not an installable
    # atomic transaction. Preserve pending bytes and stop; never auto-replay a failure.
    replace_exact(output / "review-record", review)
    replace_exact(output / "plan.json", canonical(plan))
    checked = verify(output, updated, env)
    replace_exact(pins_path, canonical(updated))
    evidence = json_read(read_file(evidence_path))
    evidence.update(review_record_digest=updated["review_record_digest"], verification=checked)
    replace_exact(evidence_path, canonical(evidence))
    return {"package": str(output), "pins": str(pins_path), "package_digest_unchanged": True, "bootstrap_allowed": False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for flag in ("source", "revision", "output", "review-record", "policy", "finalize-review"):
        parser.add_argument(f"--{flag}")
    args = parser.parse_args()
    need(os.geteuid() != 0, "PREPARATION_REFUSES_ROOT")
    need(args.review_record, "REVIEW_RECORD_REQUIRED")
    if args.finalize_review:
        need(not any((args.source, args.revision, args.output, args.policy)), "MIXED_PREPARATION_MODES")
        result = finalize(args)
    else:
        need(all((args.source, args.revision, args.output, args.policy)), "PREPARATION_INPUT_REQUIRED")
        result = prepare(args)
    print(json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, subprocess.TimeoutExpired, KeyError) as error:
        print(f"PREPARATION_STOP: {error}", file=sys.stderr)
        sys.exit(1)
