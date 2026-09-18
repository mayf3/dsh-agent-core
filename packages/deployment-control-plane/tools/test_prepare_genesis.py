"""Nonproduction tests: synthetic bytes verify format, never review or bootstrap authority."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

SPEC = importlib.util.spec_from_file_location("prepare_genesis", Path(__file__).with_name("prepare-genesis.py"))
PACK = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PACK)

class PackageTests(unittest.TestCase):
    def test_canonical_matches_rust_sorted_utf8_encoding(self):
        self.assertEqual(PACK.canonical({"z": 1, "a": "车", "b": False}), b'{"a":"\xe8\xbd\xa6","b":false,"z":1}')

    def test_review_replacement_does_not_change_package_digest(self):
        template = {key: [] for key in PACK.TEMPLATE_FIELDS}
        template.update(paths={}, identities={}, host="fixture-host")
        sources = {"package/test.rs": b"synthetic nonproduction source"}
        executables = {"/fixture/bin": b"not an executable"}
        first = PACK.assemble(template, "a" * 40, "b" * 40, "c" * 40,
                              sources, executables, {}, b"[]", b"{}", b"draft review")
        second = PACK.assemble(template, "a" * 40, "b" * 40, "c" * 40,
                               sources, executables, {}, b"[]", b"{}", b"final review")
        self.assertEqual(first[0], second[0])
        self.assertEqual(first[2]["package_digest"], second[2]["package_digest"])
        self.assertNotEqual(first[2]["review_record_digest"], second[2]["review_record_digest"])
        self.assertNotEqual(first[2]["plan_digest"], second[2]["plan_digest"])
        self.assertFalse(first[1]["profile_enabled"])
        self.assertFalse(first[1]["activation_requested"])
        self.assertEqual(set(first[2]), set(PACK.PIN_FIELDS))

    def test_safe_copy_writes_owned_bytes_modes_without_copied_xattrs(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            PACK.write_new(root / "source.rs", b"source", 0o400)
            PACK.write_new(root / "binary", b"binary", 0o500)
            self.assertEqual((root / "source.rs").stat().st_mode & 0o777, 0o400)
            self.assertEqual((root / "binary").stat().st_mode & 0o777, 0o500)
            with (root / "source.rs").open("rb") as stream:
                self.assertLessEqual(set(PACK.xattrs(stream.fileno())), {"com.apple.provenance"})
            with self.assertRaises(FileExistsError):
                PACK.write_new(root / "source.rs", b"replacement", 0o400)

    def test_exact_git_source_accepts_docs_only_movement_but_rejects_dirty_code(self):
        with tempfile.TemporaryDirectory() as temp:
            repo = Path(temp).resolve()
            def git(*args):
                return subprocess.check_output(["git", "-C", str(repo), *args], stderr=subprocess.DEVNULL).decode().strip()
            git("init")
            git("config", "user.name", "fixture")
            git("config", "user.email", "fixture@example.invalid")
            path = repo / PACK.PACKAGE / "src/lib.rs"
            path.parent.mkdir(parents=True)
            path.write_text("// fixture source\n")
            git("add", ".")
            git("commit", "-m", "fixture source")
            revision = git("rev-parse", "HEAD")
            (repo / "review.md").write_text("fixture evidence")
            git("add", ".")
            git("commit", "-m", "docs only")
            PACK.check_source(repo, revision)
            path.write_text("// dirty code\n")
            with self.assertRaisesRegex(ValueError, "DIRTY_CODE"):
                PACK.check_source(repo, revision)
            git("checkout", "--", str(path.relative_to(repo)))
            (path.parent / "unknown.rs").write_text("// uncommitted executable source")
            with self.assertRaisesRegex(ValueError, "DIRTY_CODE"):
                PACK.check_source(repo, revision)

    def test_build_environment_cannot_inherit_rust_or_credential_overrides(self):
        with tempfile.TemporaryDirectory() as temp:
            env = PACK.build_environment(Path(temp), Path("/fixture/home"))
            self.assertNotIn("RUSTFLAGS", env)
            self.assertNotIn("RUSTC_WRAPPER", env)
            self.assertNotIn("CARGO_REGISTRY_TOKEN", env)
            self.assertEqual(env["CARGO_HOME"], str(Path(temp) / "cargo-home"))
            self.assertNotEqual(env["HOME"], "/fixture/home")


class SourceAndCacheTests(unittest.TestCase):
    def test_git_symlink_cannot_enter_source_closure(self):
        with tempfile.TemporaryDirectory() as temp:
            repo = Path(temp).resolve()
            def git(*args):
                return subprocess.check_output(["git", "-C", str(repo), *args], stderr=subprocess.DEVNULL).decode().strip()
            git("init")
            git("config", "user.name", "fixture")
            git("config", "user.email", "fixture@example.invalid")
            for path in (*PACK.REQUIRED, PACK.INITIAL, f"{PACK.PACKAGE}/Cargo.lock", f"{PACK.PACKAGE}/Cargo.toml"):
                target = repo / path
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(b"synthetic nonproduction source")
            os.symlink("/etc/passwd", repo / PACK.PACKAGE / "outside")
            git("add", ".")
            git("commit", "-m", "synthetic unsafe source")
            with self.assertRaisesRegex(ValueError, "SOURCE_SPECIAL_FILE"):
                PACK.sources_at(repo, git("rev-parse", "HEAD"))

    def test_cache_import_is_checksum_bound_and_excludes_user_config_and_tokens(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            home, scratch = root / "home", root / "scratch"
            base = "index.crates.io-fixture"
            for version in ("1.0.0", "2.0.0"):
                file = home / ".cargo/registry/cache" / base / f"demo-{version}.crate"
                file.parent.mkdir(parents=True, exist_ok=True)
                file.write_bytes(b"fixture archive")
            index = home / ".cargo/registry/index" / base / ".cache/de/mo/demo"
            index.parent.mkdir(parents=True)
            index.write_bytes(b"fixture index")
            (home / ".cargo/credentials.toml").write_text("fixture only, never import")
            (home / ".cargo/config.toml").write_text("fixture only, never import")
            raw = "\n".join(f'[[package]]\nname="demo"\nversion="{v}"\nsource="registry+https://github.com/rust-lang/crates.io-index"\nchecksum="{PACK.sha(b"fixture archive")}"' for v in ("1.0.0", "2.0.0")).encode()
            PACK.seed_registry(home, scratch, raw)
            self.assertTrue((scratch / "cargo-home/registry/cache" / base / "demo-2.0.0.crate").is_file())
            self.assertFalse((scratch / "cargo-home/credentials.toml").exists())
            self.assertFalse((scratch / "cargo-home/config.toml").exists())
            bad = raw.replace(PACK.sha(b"fixture archive").encode(), b"0" * 64)
            with self.assertRaisesRegex(ValueError, "CARGO_CACHE_CHECKSUM"):
                PACK.seed_registry(home, root / "other", bad)

if __name__ == "__main__":
    unittest.main()
