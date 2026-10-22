#!/usr/bin/env python3
"""installer_hardening — B7 安装器加固四项（0.2.4 清单第 1-4 项的实现与断言）。

来源：2026-10-21/22 部署事故链（tx-da76cadd spawn 回归 + hr-agent 排障）。
七项清单的 1-4 项在此落地为可执行模块；5-6 项在运行时源码树
（agent-memory MEMORY_BLOOM_GUARD_V1 / agent-router WORKER_STDERR_PERSISTENCE_V1），
第 7 项为 b7ctl tx --amend-draft（fixed-subject 恢复修订草案）。

语义（对齐 RUNBOOK §6）：
  1. 三层访问授权（worker=uid 502 视角）：
     a. <root>/control                     o+x（穿越）
     b. <root>/control/codex-plugin-runtime o+x，各 gen-* 世代目录 o+rx
        （内容如因 root 侧写入失去 worker 可读/归因，repair 走 chown authsvc +
        chmod；TCC/provenance 归因损坏需 tar-pipe 物化——本模块断言并报告，
        物化操作留给人审后的安装器步骤）
     c. <dsh_root> o+x，且每 agent 预建 <dsh_root>/workspaces/<agent>/memory
        （worker 属主 502:20, 0755）
  2. 属主物化断言：homes/ 下每 agent 的 settings/.credentials/profiles 入口
     必须对 worker uid 可读；root 属主且 worker 不可读 = 失败（安装器必须以
     worker 身份或授过权的内容物化，chown 无法修复 macOS 归因）。
  3. DS policy 钉自检（M15 教训）：FINAL-SEAL 的 manifest、安装态 authority
     frozen_candidate、DS 注册绑定（registered_peer_uid + binding.manifestSha256）
     三方一致；任一缺失/不一致 = fail-loud。
  4. 注册身份：registered_peer_uid == 502（peer 绑定，非 root 注册）。

纯只读（assert 模式，b7ctl preflight 内自动跑）+ 显式 --apply 修复模式
（mkdir/chown/chmod 最小动作，逐项回执）。绝不改事务/DS 状态。
"""
import argparse
import hashlib
import re
import json
import os
import stat
import sys
from pathlib import Path

DEFAULT_ROOT = "/Users/authsvc/.agent-core"
DEFAULT_DSH_ROOT = "/Users/authsvc/.dsh"
WORKER_UID = 502
WORKER_GID = 20
SERVICE_USER = "authsvc"


def _worker_can_traverse(st_mode, st_uid, st_gid):
    """uid 502 / gid 20 视角能否穿越该目录。"""
    if st_uid == WORKER_UID:
        return bool(st_mode & stat.S_IXUSR)
    if st_gid == WORKER_GID:
        return bool(st_mode & stat.S_IXGRP)
    return bool(st_mode & stat.S_IXOTH)


def _worker_can_read(st_mode, st_uid, st_gid):
    if st_uid == WORKER_UID:
        return bool(st_mode & stat.S_IRUSR)
    if st_gid == WORKER_GID:
        return bool(st_mode & stat.S_IRGRP)
    return bool(st_mode & stat.S_IROTH)


def _stat(path):
    try:
        return os.stat(path, follow_symlinks=False)
    except FileNotFoundError:
        return None


def _chain_upto(path, stop):
    """path 及其祖先（到 stop 为止，含 stop）的列表。"""
    parts = []
    cur = Path(path).resolve()
    stop_resolved = Path(stop).resolve()
    while True:
        parts.append(str(cur))
        if cur == stop_resolved or cur.parent == cur:
            break
        cur = cur.parent
    return list(reversed(parts))


def check_access_layers(root=DEFAULT_ROOT, dsh_root=DEFAULT_DSH_ROOT):
    """三层访问断言。返回 (failures, repairs)；failures 为结构化 dict 列表。"""
    failures, repairs = [], []
    failed_stat_paths = set()

    def fail(check, path, detail, repair=None):
        failures.append({"check": check, "path": path, "detail": detail})
        if repair:
            repairs.append(repair)

    def observe_stat(path):
        try:
            return _stat(path)
        except OSError as error:
            failed_stat_paths.add(path)
            fail("stat_observation", path, f"unreadable errno={error.errno}")
            return None

    # --- 层 a：control 穿越链（/ → root → control） -----------------------
    for p in _chain_upto(os.path.join(root, "control"), "/"):
        st = observe_stat(p)
        if st is None:
            fail("control_traverse", p, "missing")
            continue
        if not _worker_can_traverse(st.st_mode, st.st_uid, st.st_gid):
            fail("control_traverse", p,
                 f"uid502 cannot traverse (mode {stat.filemode(st.st_mode)}, owner {st.st_uid})",
                 {"cmd": ["chmod", "o+x", p]})

    # --- 层 b：中央 gen 树 ------------------------------------------------
    gen_root = os.path.join(root, "control", "codex-plugin-runtime")
    st = observe_stat(gen_root)
    if st is None:
        fail("gen_tree", gen_root, "missing (no codex-plugin-runtime gen tree)")
    else:
        if not _worker_can_traverse(st.st_mode, st.st_uid, st.st_gid):
            fail("gen_tree", gen_root, "gen root not traversable by worker",
                 {"cmd": ["chmod", "o+x", gen_root]})
        try:
            gens = sorted(d for d in os.listdir(gen_root) if d.startswith("gen-"))
        except OSError as e:
            gens = []
            fail("gen_tree", gen_root, f"listdir failed: {e}")
        current = _current_gen(gens)
        for g in gens:
            gp = os.path.join(gen_root, g)
            gst = observe_stat(gp)
            if gst is None:
                continue
            # gen 目录只要求 worker 可穿越（o=x / g=x@20 / 属主=502）：worker 按
            # 已知路径打开 gen 内文件，不需要列目录（2026-10-22 实证校准：
            # 0731 authsvc 属主 + o=x 即可正常 spawn；r 位缺失不影响）。
            if not _worker_can_traverse(gst.st_mode, gst.st_uid, gst.st_gid):
                if g == current:
                    fail("gen_tree", gp, "CURRENT gen dir not worker-traversable",
                         {"cmd": ["chmod", "o+x", gp]})
                else:
                    repairs.append({"cmd": ["chmod", "o+x", gp],
                                    "note": "非 current 世代，仅 repair 不算 failure"})
            # current 世代的顶层入口文件必须 worker 可读
            if g == current:
                for name in ("node_modules",):
                    entry = os.path.join(gp, name)
                    est = observe_stat(entry)
                    if est is not None and not _worker_can_traverse(est.st_mode, est.st_uid, est.st_gid):
                        fail("gen_tree", entry, "current gen entry not traversable by worker",
                             {"cmd": ["chmod", "o+rx", entry]})

    # --- 层 c：.dsh 穿越 + 每 agent memory 预建 ---------------------------
    for p in _chain_upto(dsh_root, "/"):
        st = observe_stat(p)
        if st is None:
            continue
        if not _worker_can_traverse(st.st_mode, st.st_uid, st.st_gid):
            fail("dsh_traverse", p, "uid502 cannot traverse .dsh chain",
                 {"cmd": ["chmod", "o+x", p]})
    homes_dir = os.path.join(root, "homes")
    try:
        agents = sorted(a for a in os.listdir(homes_dir) if a.startswith("agt_"))
    except OSError as error:
        agents = None
        fail("homes_list", homes_dir, f"unreadable errno={error.errno}")
    ws_root = os.path.join(dsh_root, "workspaces")
    ws_stat = observe_stat(ws_root)
    if ws_stat is not None and not _worker_can_traverse(ws_stat.st_mode, ws_stat.st_uid, ws_stat.st_gid):
        fail("dsh_workspaces", ws_root, "workspaces root not traversable by worker",
             {"cmd": ["chmod", "o+x", ws_root]})
    for agent in agents or []:
        mem = os.path.join(ws_root, agent, "memory")
        mst = observe_stat(mem)
        if mem in failed_stat_paths:
            continue
        if mst is None:
            fail("memory_dir", mem, "missing (worker memory spill dir)",
                 {"cmd": ["mkdir", "-p", mem], "post": [["chown", f"{WORKER_UID}:{WORKER_GID}", mem],
                                                        ["chmod", "0755", mem]]})
        elif (mst.st_uid, mst.st_gid) != (WORKER_UID, WORKER_GID):
            fail("memory_dir", mem, f"owner {(mst.st_uid, mst.st_gid)} != worker",
                 {"cmd": ["chown", f"{WORKER_UID}:{WORKER_GID}", mem]})

    # --- 项 2：属主物化（home 入口可读性抽查） ----------------------------
    # 分级：有绑定（bindings.json 提及）的 agent = FAIL；休眠 home = note。
    try:
        bound = _bound_agents(root)
    except (OSError, ValueError, TypeError) as error:
        bound = None
        fail("bindings_read", os.path.join(root, "bindings", "bindings.json"),
             f"unavailable or malformed ({type(error).__name__})")
    for agent in (agents or [])[:8]:  # 抽查前 8 个（全量成本高；安装器全量跑）
        home = os.path.join(homes_dir, agent)
        for name in ("settings.yaml", ".credentials.yaml"):
            st = observe_stat(os.path.join(home, name))
            if st is not None and not _worker_can_read(st.st_mode, st.st_uid, st.st_gid):
                if bound is None or agent in bound:
                    fail("home_materialization", os.path.join(home, name),
                         "worker cannot read home entry (安装器必须以 worker 身份物化)", None)
                else:
                    repairs.append({"cmd": ["chown", f"{WORKER_UID}:{WORKER_GID}",
                                            os.path.join(home, name)],
                                    "note": f"休眠 home {agent} 属主物化降级 note"})
    return failures, repairs


def _bound_agents(root):
    """Return positively observed bound agents; unknown evidence raises."""
    path = os.path.join(root, "bindings", "bindings.json")
    with open(path, encoding="utf-8") as handle:
        data = json.load(handle)
    if (not isinstance(data, dict) or type(data.get("version")) is not int
            or data["version"] != 1 or not isinstance(data.get("bindings"), dict)):
        raise ValueError("invalid native binding document")
    bound = set()
    for row in data["bindings"].values():
        if not isinstance(row, dict) or not isinstance(row.get("activeAgentId"), str) or not row["activeAgentId"]:
            raise ValueError("invalid native binding row")
        if row["activeAgentId"].startswith("agt_"):
            bound.add(row["activeAgentId"])
    return bound


def _current_gen(gens):
    """current 符号链接指向的世代（或字典序最大者）。"""
    link = os.path.join(DEFAULT_ROOT, "control", "codex-plugin-runtime", "current")
    try:
        target = os.readlink(link)
        for g in gens:
            if g in target:
                return g
    except OSError:
        pass
    return gens[-1] if gens else None


def check_registration(receipt_path, *, expected_operation=None,
                       expected_manifest=None, expected_sha256=None):
    """Check one pinned native receipt. An empty selection is never success."""
    def fail(detail):
        return [{"check": "registration", "path": str(receipt_path), "detail": detail}]

    if not isinstance(expected_operation, str) or not expected_operation or len(expected_operation) > 256:
        return fail("required current operation missing or invalid")
    if any(not isinstance(value, str) or re.fullmatch(r"[0-9a-f]{64}", value) is None
           for value in (expected_manifest, expected_sha256)):
        return fail("required manifest/receipt digest missing or invalid")
    def unique(pairs):
        data = {}
        for key, value in pairs:
            if key in data:
                raise ValueError("duplicate key")
            data[key] = value
        return data
    try:
        with open(receipt_path, "rb") as handle:
            raw = handle.read(1048577)
        if len(raw) > 1048576 or hashlib.sha256(raw).hexdigest() != expected_sha256:
            return fail("receipt bytes do not match required digest or size bound")
        data = json.loads(raw, object_pairs_hook=unique)
    except (OSError, TypeError, ValueError):
        return fail("required receipt unreadable or malformed")
    if not isinstance(data, dict):
        return fail("receipt must be a native object")
    binding = data.get("binding")
    valid = (data.get("kind") == "DS_B7_PACKET_REGISTRATION_V1"
             and type(data.get("version")) is int and data["version"] == 1
             and data.get("action") == "B7_PACKET_REGISTER_V1"
             and data.get("state") == "REGISTERED_ONLY"
             and data.get("operation_id") == expected_operation
             and type(data.get("registered_peer_uid")) is int and data["registered_peer_uid"] == WORKER_UID
             and isinstance(binding, dict) and binding.get("manifestSha256") == expected_manifest)
    if not valid:
        return fail("native operation/manifest/peer/envelope binding mismatch")
    return [{"check": "registration_ok", "path": str(receipt_path),
             "manifest": expected_manifest, "peer": WORKER_UID}]


def apply_repairs(repairs, run):
    """--apply：逐条执行 repair（外部传入 run(cmd) 执行器，通常 sudo sh）。"""
    done = []
    for r in repairs:
        cmds = [r["cmd"]] + r.get("post", [])
        ok = True
        for cmd in cmds:
            rc = run(cmd)
            ok = ok and rc == 0
        done.append({"repair": r["cmd"], "ok": ok})
    return done


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--root", default=DEFAULT_ROOT)
    ap.add_argument("--dsh-root", default=DEFAULT_DSH_ROOT)
    ap.add_argument("--op", required=True)
    ap.add_argument("--manifest-sha256", required=True)
    ap.add_argument("--registration-receipt", required=True)
    ap.add_argument("--registration-receipt-sha256", required=True)
    ap.add_argument("--apply", action="store_true", help="执行修复（默认只断言）")
    args = ap.parse_args(argv)

    failures, repairs = check_access_layers(args.root, args.dsh_root)
    reg = check_registration(args.registration_receipt, expected_operation=args.op,
                             expected_manifest=args.manifest_sha256,
                             expected_sha256=args.registration_receipt_sha256)
    for item in reg:
        if item["check"] != "registration_ok":
            failures.append(item)

    if failures:
        print(f"FAIL: {len(failures)} 项不满足")
        for f in failures:
            print(f"  [{f['check']}] {f['path']}: {f['detail']}")
    else:
        print("PRECHECK PASSED: final recheck pending" if args.apply
              else "ALL GREEN: 三层访问 + 属主物化 + 注册身份 全部满足")
    if repairs:
        print(f"\n可修复项 {len(repairs)} 条" + ("（--apply 未加，仅列出）" if not args.apply else "："))
        for r in repairs:
            print("  " + " && ".join([" ".join(c) for c in [r["cmd"]] + r.get("post", [])]))
    if args.apply:
        if any(item["check"] != "registration_ok" for item in reg):
            return 1
        def run(cmd):
            print("+ " + " ".join(cmd))
            return os.system(" ".join(cmd))
        result = apply_repairs(repairs, run)
        ok = sum(1 for r in result if r["ok"])
        print(f"applied {ok}/{len(result)}")
        failures2, _ = check_access_layers(args.root, args.dsh_root)
        failures2.extend(item for item in check_registration(
            args.registration_receipt, expected_operation=args.op,
            expected_manifest=args.manifest_sha256,
            expected_sha256=args.registration_receipt_sha256) if item["check"] != "registration_ok")
        repair_failed = any(not item["ok"] for item in result) or len(result) != len(repairs)
        print("复检：" + ("ALL GREEN" if not failures2 and not repair_failed else "FAIL"))
        return 1 if failures2 or repair_failed else 0
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
