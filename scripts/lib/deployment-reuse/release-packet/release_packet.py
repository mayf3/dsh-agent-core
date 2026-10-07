#!/usr/bin/env python3
"""release-packet: one command to generate and verify a release packet (#567 Phase 1).

    release_packet.py build  --config CONFIG [--rebuild-existing] [--receipt PATH]
    release_packet.py verify --package DIR --config CONFIG [--expect-top-seal SHA] [--receipt PATH]

`build` generates the packet from one unique source plus the fixed config —
materializing layers, archives, pin documents and command files, recomputing
every digest from actual bytes, sealing each layer bottom-up — then runs the
same verification as `verify` and emits a machine-readable receipt. Rebuilding
from the source is the only repair path: there is no in-place re-seal, so
batch-editing documents can never turn a failure into PASS.

Verification is bottom-up from actual bytes: every layer manifest is checked
against real content, each seal binds its manifest, the top manifest covers
everything (including layer manifests and seals), pinned digests are compared
to the files they name, and path references must close inside the packet or
match the config's external allowlist — so commands pointing at an old task
directory, stale inner digests under a fresh top-level seal, and renamed or
missing archives all fail before release with the cause located in the
receipt. Record the top seal digest (or pass --expect-top-seal) outside the
packet: a fully self-consistent forgery can only be rejected against such an
external anchor.

Blocking checks are release-essential integrity; their failure exits non-zero.
Failures of non-blocking checks (declared per reference file) degrade the
status without blocking independent execution, and a declared-but-unmeasured
human-process baseline is recorded as UNKNOWN — never as a fabricated saving.
All names come from the config: no agent, date, host, business or incident is
hardcoded here.
"""

import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import packet_build  # noqa: F401  (build_packet re-exported for API users)
import packet_config as pc
import packet_model as pm
import packet_refs as pr

TOOL = "release-packet"
TOOL_VERSION = "1.0.0"
RECEIPT_SCHEMA = "RELEASE_PACKET_RECEIPT_V1"

ConfigError = pc.ConfigError
load_config = pc.load_config
CONFIG_SCHEMA = pc.CONFIG_SCHEMA
build_packet = packet_build.build_packet


def verify_packet(cfg, cfg_dir, packet_root, expect_top_seal=None):
    # One canonical packet identity (realpath) for build and verify, so
    # recorded paths bind to the same root regardless of symlinked parents.
    packet_root = Path(packet_root).resolve()
    checks = []

    def add(cid, blocking, status, details=None):
        checks.append({"id": cid, "blocking": bool(blocking), "status": status, "details": details or []})

    def findings_status(findings):
        # EXTERNAL_REFERENCE is informational (recorded, allowlisted); every
        # other finding fails its check. Check blockingness comes from config.
        hard = [f for f in findings if f.get("code") != "EXTERNAL_REFERENCE"]
        return ("FAIL", findings) if hard else ("PASS", findings)

    if not packet_root.is_dir():
        add("PACKET_PRESENT", True, "FAIL", [{"code": "PACKET_ABSENT", "path": str(packet_root)}])
        planned = (["LAYER_MANIFEST:%s" % ln["name"] for ln in cfg.get("layers", [])]
                   + ["LAYER_SEAL:%s" % ln["name"] for ln in cfg.get("layers", [])]
                   + ["TOP_MANIFEST", "TOP_SEAL"]
                   + ["PINS:%s" % p["path"] for p in cfg.get("pinFiles", [])]
                   + ["REFERENCES:%s" % r["path"] for r in cfg.get("referenceFiles", [])]
                   + (["BASELINE_RECORDED"] if cfg.get("baseline") is not None else []))
        for cid in planned:
            add(cid, True, "NOT_RUN", [{"code": "SKIPPED_AFTER_BLOCKING_FAILURE"}])
        if expect_top_seal:
            add("EXPECTED_TOP_SEAL", True, "NOT_RUN", [{"code": "SKIPPED_AFTER_BLOCKING_FAILURE"}])
        return checks

    for layer in cfg.get("layers", []):
        ldir = packet_root / layer["dir"]
        absent = ("FAIL", [{"code": "LAYER_DIR_ABSENT", "path": layer["dir"]}])
        status, details = absent if not ldir.is_dir() \
            else findings_status(pm.verify_manifest(ldir, exclude={pm.MANIFEST_NAME, pm.SEAL_NAME})[0])
        add("LAYER_MANIFEST:%s" % layer["name"], True, status, details)
        status, details = absent if not ldir.is_dir() \
            else findings_status(pm.verify_seal(ldir, kind=layer["name"])[0])
        add("LAYER_SEAL:%s" % layer["name"], True, status, details)

    status, details = findings_status(pm.verify_manifest(packet_root, exclude={pm.MANIFEST_NAME, pm.SEAL_NAME})[0])
    add("TOP_MANIFEST", True, status, details)
    status, details = findings_status(pm.verify_seal(packet_root, kind=cfg["packet"]["kind"])[0])
    add("TOP_SEAL", True, status, details)
    if expect_top_seal:
        # The external anchor is the digest of the top SEAL.json bytes — the
        # same value the receipt emits as topSealSha256 — not the manifest's.
        top_seal_path = packet_root / pm.SEAL_NAME
        observed = pm.sha256_file(top_seal_path) if top_seal_path.is_file() else None
        status = "PASS" if observed == expect_top_seal else "FAIL"
        add("EXPECTED_TOP_SEAL", True, status,
            [] if status == "PASS" else [{"code": "TOP_SEAL_ANCHOR_MISMATCH",
                                          "expected": expect_top_seal, "observed": observed}])

    for pins in cfg.get("pinFiles", []):
        path = packet_root / pins["path"]
        blocking = pins.get("blocking", True)
        try:
            findings, _doc = pr.apply_pin_bindings(packet_root, path, pins.get("bindings", []), build=False)
            status, details = findings_status(findings)
        except pm.PacketError as exc:
            status, details = "FAIL", [{"code": "PIN_DOC_ERROR", "detail": str(exc)}]
        add("PINS:%s" % pins["path"], blocking, status, details)

    for refs in cfg.get("referenceFiles", []):
        path = packet_root / refs["path"]
        blocking = bool(refs.get("blocking", True))
        findings = pr.check_reference_closure(packet_root, path, cfg.get("externalReferenceAllowlist", []), blocking)
        add("REFERENCES:%s" % refs["path"], blocking, *findings_status(findings))

    baseline = cfg.get("baseline")
    if baseline is not None:
        measured = isinstance(baseline, dict) and baseline.get("stepsMeasured") is not None \
            and baseline.get("elapsedMeasured") is not None
        add("BASELINE_RECORDED", False, "PASS" if measured else "UNKNOWN",
            [] if measured else [{"code": "NO_HISTORICAL_MEASUREMENT",
                                  "detail": "baseline declared without measurement; recorded UNKNOWN, no savings claimed"}])
    return checks


def aggregate(checks):
    if any(c["blocking"] and c["status"] != "PASS" for c in checks):
        return "BLOCKED", 1
    if any(c["status"] != "PASS" for c in checks):
        return "DEGRADED", 0
    return "PASS", 0


def make_receipt(mode, cfg, cfg_path, packet_root, checks, layers, top_seal_sha, entries, started, expect_top_seal):
    status, exit_code = aggregate(checks)
    cfg_dir = Path(cfg_path).resolve().parent
    source = cfg.get("source", {})
    repo = pc.resolve(cfg_dir, source.get("repo", "."))
    observed_clean = None
    if repo.is_dir() and source.get("commit"):
        try:
            observed_clean = pc.git(repo, "status", "--porcelain=v1") == ""
        except ConfigError:
            observed_clean = None
    baseline = cfg.get("baseline")
    measured = isinstance(baseline, dict) and baseline.get("stepsMeasured") is not None \
        and baseline.get("elapsedMeasured") is not None
    top_manifest = Path(packet_root) / pm.MANIFEST_NAME
    return {
        "schema": RECEIPT_SCHEMA, "tool": TOOL, "toolVersion": TOOL_VERSION, "mode": mode,
        "packetRoot": str(Path(packet_root).resolve()), "packetKind": cfg["packet"]["kind"],
        "configPath": str(Path(cfg_path).resolve()), "configSha256": pm.sha256_file(cfg_path),
        "source": {"repo": str(repo), "commit": source.get("commit"), "tree": source.get("tree"),
                   "observedClean": observed_clean},
        "expectTopSeal": expect_top_seal,
        "layers": layers, "topSealSha256": top_seal_sha,
        "topManifestSha256": pm.sha256_file(top_manifest) if top_manifest.is_file() else None,
        "entries": entries, "checks": checks, "status": status, "exitCode": exit_code,
        "baseline": {"measured": bool(measured), "declared": baseline,
                     "status": "PASS" if measured else "UNKNOWN"},
        "productionExecuted": False,
        "startedUtc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(started)),
        "elapsedMs": int((time.time() - started) * 1000),
    }


def _observed_summary(cfg, packet_root):
    layers = []
    for layer in cfg.get("layers", []):
        ldir = Path(packet_root) / layer["dir"]
        layers.append({"name": layer["name"], "dir": layer["dir"],
                       "manifestSha256": pm.sha256_file(ldir / pm.MANIFEST_NAME) if (ldir / pm.MANIFEST_NAME).is_file() else None,
                       "sealSha256": pm.sha256_file(ldir / pm.SEAL_NAME) if (ldir / pm.SEAL_NAME).is_file() else None,
                       "entries": None})
    top_seal = Path(packet_root) / pm.SEAL_NAME
    top_manifest = Path(packet_root) / pm.MANIFEST_NAME
    entries = None
    if top_manifest.is_file():
        try:
            entries = len(pm.parse_manifest(top_manifest.read_bytes()))
        except pm.PacketError:
            entries = None
    return layers, (pm.sha256_file(top_seal) if top_seal.is_file() else None), entries


def _receipt_path(args, packet_root):
    if args.get("receipt"):
        return Path(args["receipt"])
    packet_root = Path(packet_root).resolve()
    return packet_root.parent / ("%s.receipt.json" % packet_root.name)


def main(argv):
    if len(argv) < 2 or argv[1] not in ("build", "verify"):
        sys.stderr.write(__doc__.strip() + "\n")
        return 2
    mode = argv[1]
    args = {}
    i = 2
    while i < len(argv):
        arg = argv[i]
        if arg.startswith("--"):
            args[arg[2:]] = argv[i + 1] if i + 1 < len(argv) and not argv[i + 1].startswith("--") else True
            i += 2 if isinstance(args[arg[2:]], str) else 1
        else:
            sys.stderr.write("unexpected argument: %s\n" % arg)
            return 2
    started = time.time()
    packet_root = None
    try:
        pc.require(args.get("config"), "--config CONFIG is required")
        cfg_path = Path(args["config"])
        cfg = load_config(cfg_path)
        cfg_dir = cfg_path.resolve().parent
        expect_top_seal = args.get("expect-top-seal")
        pc.require(not expect_top_seal or pc.is_sha256(expect_top_seal), "--expect-top-seal must be 64 hex")
        if mode == "build":
            packet_root = pc.resolve(cfg_dir, cfg["packet"]["root"])
            layers, top_seal_sha, entries = build_packet(cfg, cfg_dir, packet_root,
                                                         rebuild=bool(args.get("rebuild-existing")))
        else:
            pc.require(args.get("package"), "verify requires --package DIR")
            packet_root = Path(args["package"])
            layers, top_seal_sha, entries = _observed_summary(cfg, packet_root)
        checks = verify_packet(cfg, cfg_dir, packet_root, expect_top_seal)
        receipt = make_receipt(mode, cfg, cfg_path, packet_root, checks, layers, top_seal_sha, entries,
                               started, expect_top_seal)
    except (ConfigError, pm.PacketError) as exc:
        sys.stderr.write("release-packet: REFUSED %s\n" % exc)
        return 2
    receipt_path = _receipt_path(args, packet_root)
    receipt_path.parent.mkdir(parents=True, exist_ok=True)
    receipt_path.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    sys.stdout.write(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n")
    return receipt["exitCode"]


if __name__ == "__main__":
    sys.exit(main(sys.argv))
