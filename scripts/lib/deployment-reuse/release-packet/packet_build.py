"""Build mechanics for release-packet (#567 Phase 1).

Generates the packet from the unique source plus the fixed config: layers
(git archive / copied tree / inline files), deterministic tar.gz and frozen
copy artifacts with sha256 sidecars, rendered command files, recomputed pin
documents, then bottom-up sealing (per-layer manifest+seal, then top).
Refusals happen before or during materialization; a failed build leaves no
half-built packet behind. `--rebuild-existing` stages the regeneration in a
sibling directory and swaps only after the new packet is fully built and
sealed, so a failed rebuild leaves the previous packet byte-identical.
There is no in-place re-seal: the only repair path is rebuilding from the
source, so batch-editing documents can never turn a failure into PASS.
"""

import gzip
import hashlib
import io
import json
import os
import shutil
import subprocess
import tarfile
import tempfile
from pathlib import Path

import packet_config as pc
import packet_model as pm
import packet_refs as pr


def _materialize_git_archive(layer, ldir, cfg_dir, source):
    repo = pc.resolve(cfg_dir, source["repo"])
    commit = source.get("commit")
    if source.get("requireClean", True) and pc.git(repo, "status", "--porcelain=v1") != "":
        raise pc.ConfigError("SOURCE_NOT_CLEAN: %s" % repo)
    if commit:
        pc.require(pc.git(repo, "rev-parse", "HEAD") == commit, "SOURCE_COMMIT_DRIFT: %s" % repo)
    if source.get("tree"):
        pc.require(pc.git(repo, "rev-parse", "HEAD^{tree}") == source["tree"], "SOURCE_TREE_DRIFT: %s" % repo)
    prefix = layer["build"].get("prefix", "")
    tar_bytes = subprocess.check_output(
        ["git", "-C", str(repo), "archive", "--format=tar", "--prefix=" + prefix, commit or "HEAD"])
    _extract_tar_safely(tar_bytes, ldir)
    for overlay in layer["build"].get("overlays", []):
        rel = pm.check_rel(overlay["path"])
        src = pc.resolve(cfg_dir, overlay["from"])
        pc.require(src.is_file() and not src.is_symlink(), "OVERLAY_SOURCE_MISSING: %s" % src)
        dest = ldir / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(src.read_bytes())
    content_list = layer["build"].get("contentList")
    if content_list:
        rel = pm.check_rel(content_list)
        rels = [r for r in pm.list_files(ldir) if r != rel]
        (ldir / rel).write_bytes(pm.render_manifest(pm.manifest_lines(ldir, rels)))


def _extract_tar_safely(tar_bytes, ldir):
    with tarfile.open(fileobj=io.BytesIO(tar_bytes), mode="r:") as archive:
        for member in archive.getmembers():
            name = member.name
            pc.require(not name.startswith("/") and ".." not in Path(name).parts,
                       "TAR_MEMBER_UNSAFE: %s" % name)
            pc.require(member.isdir() or member.isfile(), "TAR_MEMBER_TYPE_REFUSED: %s" % name)
            target = ldir / name
            if member.isdir():
                target.mkdir(parents=True, exist_ok=True)
                target.chmod(0o755)
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(archive.extractfile(member).read())
                target.chmod(member.mode & 0o777 or 0o644)


def _materialize_copy_tree(layer, ldir, cfg_dir):
    src = pc.resolve(cfg_dir, layer["build"]["from"])
    pc.require(src.is_dir() and not src.is_symlink(), "COPY_TREE_SOURCE_MISSING: %s" % src)
    for p in src.rglob("*"):
        pc.require(not p.is_symlink(), "SYMLINK_IN_SOURCE: %s" % p)
    shutil.copytree(str(src), str(ldir), dirs_exist_ok=True)


def _materialize_inline_files(layer, ldir, cfg_dir):
    for item in layer["build"].get("files", []):
        rel = pm.check_rel(item["path"])
        src = pc.resolve(cfg_dir, item["from"])
        pc.require(src.is_file() and not src.is_symlink(), "INLINE_SOURCE_MISSING: %s" % src)
        dest = ldir / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(src.read_bytes())


def _build_artifact(cfg_dir, packet_root, art):
    name = art["name"]
    out = packet_root / name
    out.parent.mkdir(parents=True, exist_ok=True)
    if art["type"] == "tar-gz":
        src = packet_root / art["fromLayerDir"] if art.get("fromLayerDir") else pc.resolve(cfg_dir, art["fromDir"])
        pc.require(src.is_dir(), "ARTIFACT_SOURCE_MISSING: %s" % src)
        root_name = art.get("rootName") or Path(src).name
        with out.open("xb") as raw:
            with gzip.GzipFile(filename="", mode="wb", fileobj=raw, mtime=0) as gz:
                with tarfile.open(fileobj=gz, mode="w", format=tarfile.PAX_FORMAT) as tar:
                    for rel in pm.list_files(src):
                        p = Path(src) / rel
                        info = tarfile.TarInfo(name="%s/%s" % (root_name, rel))
                        info.uid = info.gid = 0
                        info.uname = info.gname = ""
                        info.mtime = 0
                        info.mode = p.stat().st_mode & 0o777
                        info.size = p.stat().st_size
                        with p.open("rb") as fh:
                            tar.addfile(info, fh)
    else:
        src = pc.resolve(cfg_dir, art["from"])
        data = src.read_bytes()
        if art.get("expectSha256"):
            pc.require(hashlib.sha256(data).hexdigest() == art["expectSha256"],
                       "FROZEN_ARTIFACT_DRIFT: %s" % src)
        out.write_bytes(data)
    digest = pm.sha256_file(out)
    (packet_root / (name + ".sha256")).write_text("%s  %s\n" % (digest, Path(name).name), encoding="utf-8")
    return digest


def seal_layers(cfg, packet_root):
    """Bottom-up: per-layer manifest+seal, then top manifest+seal."""
    layers = []
    for layer in cfg.get("layers", []):
        ldir = packet_root / layer["dir"]
        _, rels, _ = pm.write_manifest(ldir, exclude={pm.MANIFEST_NAME, pm.SEAL_NAME})
        seal_sha, seal = pm.write_seal(ldir, kind=layer["name"])
        layers.append({"name": layer["name"], "dir": layer["dir"], "entries": seal["entries"],
                       "manifestSha256": pm.sha256_file(ldir / pm.MANIFEST_NAME), "sealSha256": seal_sha})
    _, top_rels, _ = pm.write_manifest(packet_root, exclude={pm.MANIFEST_NAME, pm.SEAL_NAME})
    _, top_seal = pm.write_seal(packet_root, kind=cfg["packet"]["kind"])
    top_seal["productionExecuted"] = False  # this tool never executes anything it packages
    (packet_root / pm.SEAL_NAME).write_bytes(
        (json.dumps(top_seal, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode("utf-8"))
    top_seal_sha = pm.sha256_file(packet_root / pm.SEAL_NAME)
    return layers, top_seal_sha, len(top_rels)


def _generate_packet_contents(cfg, cfg_dir, build_dir, render_root):
    """Materialize layers, artifacts, commands and pins into `build_dir`.

    Recorded absolute paths (commands, pin documents) are rendered against
    `render_root` — the packet's final location — so a staged rebuild produces
    bytes identical to a fresh build at the same root.
    """
    for layer in cfg.get("layers", []):
        ldir = build_dir / layer["dir"]
        ldir.mkdir(parents=True, exist_ok=True)
        kind = layer["build"]["type"]
        if kind == "git-archive":
            _materialize_git_archive(layer, ldir, cfg_dir, cfg["source"])
        elif kind == "copy-tree":
            _materialize_copy_tree(layer, ldir, cfg_dir)
        else:
            _materialize_inline_files(layer, ldir, cfg_dir)
    for art in cfg.get("artifacts", []):
        _build_artifact(cfg_dir, build_dir, art)
    for cmd in cfg.get("commandFiles", []):
        (build_dir / cmd["path"]).write_bytes(pr.render_command_file(cmd["entries"], render_root))
    for pins in cfg.get("pinFiles", []):
        path = build_dir / pins["path"]
        path.parent.mkdir(parents=True, exist_ok=True)
        pr.apply_pin_bindings(build_dir, path, pins.get("bindings", []), build=True,
                              render_root=render_root)


def _rebuild_existing(cfg, cfg_dir, packet_root):
    """Regenerate into a staging sibling; replace the old packet only on success.

    Every refusal — dirty source, missing overlay, drifted commit, unsafe
    binding — happens while the previous packet is still in place, so a failed
    rebuild keeps it byte-identical (the repair attempt must never destroy the
    last known-good packet).
    """
    parent = packet_root.parent
    staging = Path(tempfile.mkdtemp(prefix=".%s.rebuild-" % packet_root.name, dir=str(parent)))
    try:
        try:
            _generate_packet_contents(cfg, cfg_dir, staging, packet_root)
            layers, top_seal_sha, entries = seal_layers(cfg, staging)
        except BaseException:
            shutil.rmtree(str(staging), ignore_errors=True)
            raise
        staging.chmod(0o755)
        retired = Path(tempfile.mkdtemp(prefix=".%s.replaced-" % packet_root.name, dir=str(parent)))
        os.rename(str(packet_root), str(retired / packet_root.name))
        try:
            os.rename(str(staging), str(packet_root))
        except BaseException:
            os.rename(str(retired / packet_root.name), str(packet_root))
            raise
        finally:
            shutil.rmtree(str(retired), ignore_errors=True)
        return layers, top_seal_sha, entries
    finally:
        if staging.exists():
            shutil.rmtree(str(staging), ignore_errors=True)


def build_packet(cfg, cfg_dir, packet_root, rebuild=False):
    packet_root = Path(packet_root).resolve()
    pc.check_root_safety(packet_root, cfg_dir, cfg)
    if packet_root.exists():
        pc.require(rebuild, "PACKET_ROOT_EXISTS: %s (use --rebuild-existing to regenerate generated artifacts)" % packet_root)
        pc.require(packet_root.is_dir() and not packet_root.is_symlink(), "PACKET_ROOT_NOT_DIR: %s" % packet_root)
        return _rebuild_existing(cfg, cfg_dir, packet_root)
    packet_root.mkdir(parents=True)
    try:
        _generate_packet_contents(cfg, cfg_dir, packet_root, packet_root)
    except BaseException:
        # The target only ever holds generated artifacts, so removing it
        # restores the exact pre-build state.
        shutil.rmtree(str(packet_root), ignore_errors=True)
        raise
    return seal_layers(cfg, packet_root)
