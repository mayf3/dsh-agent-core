"""Config model for release-packet (#567 Phase 1).

The config is the fixed, reviewable input: it names the packet kind, the
unique source (repo/commit/tree), the layers, artifacts, pin documents,
command files and reference files. Everything business-specific lives here;
the tool carries no agent, date, host, business or incident names. Relative
paths inside the config resolve against the config file's directory.
"""

import json
import subprocess
from pathlib import Path

import packet_model as pm

CONFIG_SCHEMA = "RELEASE_PACKET_CONFIG_V1"
_HEX = frozenset("0123456789abcdef")


class ConfigError(Exception):
    """Deterministic refusal (bad config, unsafe path, drifted source)."""


def require(condition, message):
    if not condition:
        raise ConfigError(message)


def is_sha256(value):
    return isinstance(value, str) and len(value) == 64 and set(value) <= _HEX


def is_git_oid(value):
    """Git object id: 40-hex (SHA-1 repository) or 64-hex (SHA-256 repository)."""
    return isinstance(value, str) and len(value) in (40, 64) and set(value) <= _HEX


def resolve(base, value):
    p = Path(str(value))
    return p if p.is_absolute() else Path(base) / p


def load_config(path):
    try:
        cfg = json.loads(Path(path).read_bytes().decode("utf-8"))
    except (OSError, ValueError) as exc:
        raise ConfigError("CONFIG_UNREADABLE: %s (%s)" % (path, exc))
    require(isinstance(cfg, dict) and cfg.get("schema") == CONFIG_SCHEMA,
            "CONFIG_SCHEMA_UNKNOWN: expected %s" % CONFIG_SCHEMA)
    packet = cfg.get("packet")
    require(isinstance(packet, dict) and isinstance(packet.get("kind"), str) and packet["kind"],
            "CONFIG_PACKET_KIND_REQUIRED")
    require(isinstance(packet.get("root"), str) and packet["root"], "CONFIG_PACKET_ROOT_REQUIRED")
    source = cfg.get("source")
    require(isinstance(source, dict), "CONFIG_SOURCE_REQUIRED")
    if source.get("commit") is not None:
        require(is_git_oid(source["commit"]), "CONFIG_SOURCE_COMMIT_MALFORMED")
    if source.get("tree") is not None:
        require(is_git_oid(source["tree"]), "CONFIG_SOURCE_TREE_MALFORMED")
    for layer in cfg.get("layers", []):
        require(isinstance(layer, dict) and layer.get("name") and layer.get("dir"), "CONFIG_LAYER_MALFORMED")
        pm.check_rel(layer["dir"])
        build = layer.get("build")
        require(isinstance(build, dict) and build.get("type") in ("git-archive", "copy-tree", "inline-files"),
                "CONFIG_LAYER_TYPE_UNKNOWN: %s" % (build or {}).get("type"))
    for art in cfg.get("artifacts", []):
        require(isinstance(art, dict) and art.get("name") and art.get("type") in ("tar-gz", "copy"),
                "CONFIG_ARTIFACT_MALFORMED")
        pm.check_rel(art["name"])
        if art["type"] == "copy":
            require(art.get("from"), "CONFIG_ARTIFACT_FROM_REQUIRED")
    for group, field in (("commandFiles", "path"), ("referenceFiles", "path"), ("pinFiles", "path")):
        for item in cfg.get(group, []):
            require(isinstance(item, dict) and item.get(field), "CONFIG_%s_MALFORMED" % group.upper())
            pm.check_rel(item[field])
    for pins in cfg.get("pinFiles", []):
        for binding in pins.get("bindings", []):
            require(isinstance(binding, dict) and ("pointer" in binding or "forEach" in binding),
                    "CONFIG_PIN_BINDING_MALFORMED")
    return cfg


def git(repo, *args):
    try:
        return subprocess.check_output(["git", "-C", str(repo)] + list(args),
                                       stderr=subprocess.STDOUT).decode().strip()
    except (OSError, subprocess.CalledProcessError) as exc:
        raise ConfigError("GIT_COMMAND_FAILED: %s (%s)" % (args, getattr(exc, "output", exc)))


def check_root_safety(packet_root, cfg_dir, cfg):
    """The packet root must never overlap the source tree or system roots."""
    repo = Path(str(resolve(cfg_dir, cfg["source"].get("repo", ".")))).resolve()
    root = Path(str(packet_root)).resolve()
    home = Path(str(Path.home())).resolve()
    require(root != Path(root.anchor), "PACKET_ROOT_UNSAFE: filesystem root")
    require(root != home, "PACKET_ROOT_UNSAFE: home directory")
    require(not (root == repo or repo in root.parents or root in repo.parents),
            "PACKET_ROOT_OVERLAPS_SOURCE: %s" % root)
