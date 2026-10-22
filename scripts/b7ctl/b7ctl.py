#!/usr/bin/env python3
"""b7ctl — B7 部署旁路工具（Phase 1，按 DEPLOYMENT-PROCESS-TOOLING-OPTIMIZATION-PROPOSAL-20261021 定位）

只读/旁路优先。所有写动作需要显式 --apply。
每条配方 = 2026-10-21 实战验证过的命令序列（e42r9..e42r15 六世代 + 一次完整回滚）。
不替代生产 executor/DS：原执行器仍是唯一 writer；本工具只是旁路采集、校验与配方执行。

子命令：
  preflight        EXECUTE 前终检（8 项缺席 + 日志 pin + DS 准入 + 运行时存活）
  sim              离线全路径模拟（identity→load→snapshot→verify→pre_intent，零槽位成本）
  pincheck         pin 闭包校验：给定变更文件，反扫所有钉点与传播链（r9 三处漏更的教训）
  sweep-debris     失败世代残留清理（按 r7 先例退休归档，含日志回 pin）
  restore-journal  日志截断回 era pin（253526B / 9d66242a…；preflight 按 append-only 前缀验收，r16.1 起）
  rollback         物理回滚（displaced 三层 + preimage homes + overrides + 运行时重启）
  status           状态投影（tx / 注册 / 运行时 / 舰队健康 / 磁盘）
  pong             发送 PONG 验收消息并核对精确回复
"""

import argparse
import hashlib
import json
import os
import subprocess
import sys
import time

MIG = "/var/db/agent-core/authsvc-codex-migration"
RECEIPTS = "/private/var/db/agent-deploy-system/receipts"
OP_PREFIX = "b7-packet-r41-5a07e742664460c2-e42r"
JOURNAL_PIN_BYTES = 253526
JOURNAL_PIN_SHA = "9d66242a1093259af92c1dc0792eadbdb2a0b42d54fec54f78405f5e628e904a"
JOURNAL = MIG + "/.b7-six-journal.jsonl"
LOCKS = "/usr/local/var/agent-core/production-mutation-locks/production-deploy.lock"
ARTIFACTS = "/usr/local/share/agent-core/artifacts"
L = "/usr/local/libexec/agent-core"
HOMES = "/Users/authsvc/.agent-core/homes"
LARK = "/usr/local/bin/lark-cli"

# EXECUTE 前必须缺席的 8 项（e42r14/r15 检查点实测口径）
ABSENCE_ITEMS = [
    "activation-code-input",
    "b7-preparation-input.json",
    "b7-six-target-batch.json",
    "b7-six-target-batch.json.new",
    "migration-transaction.json",
    "migration-fence.json",
]
ABSENCE_EXTRA = [LOCKS, ARTIFACTS]


def sh(cmd, capture=True):
    return subprocess.run(cmd, shell=isinstance(cmd, str), capture_output=capture, text=True)


def root(cmd, capture=True):
    return sh(["sudo", "-n"] + cmd, capture)


def p(msg):
    print(msg, flush=True)


# Typed observation uses the existing root runner and fixed affected paths.
# lstat treats a broken symlink as PRESENT; only errno.ENOENT means absent.
ABSENCE_PROBE = r"""
import errno, json, os, sys
try:
    os.lstat(sys.argv[1])
    state = "PRESENT"
except OSError as error:
    state = "ABSENT_ENOENT" if error.errno == errno.ENOENT else "ERROR"
print(json.dumps({"state": state}))
sys.exit(2 if state == "ERROR" else 0)
"""


def observe_absence(path):
    observation = root(["/usr/bin/python3", "-c", ABSENCE_PROBE, path])
    if observation.returncode != 0:
        return "ERROR"
    def unique(pairs):
        data = {}
        for key, value in pairs:
            if key in data:
                raise ValueError("duplicate observation key")
            data[key] = value
        return data
    try:
        data = json.loads(observation.stdout, object_pairs_hook=unique)
    except (TypeError, ValueError):
        return "ERROR"
    if not isinstance(data, dict) or set(data) != {"state"}:
        return "ERROR"
    return data["state"] if data["state"] in ("PRESENT", "ABSENT_ENOENT") else "ERROR"


# ---------------------------------------------------------------- preflight
def cmd_preflight(args):
    """EXECUTE 前终检。任何 FAIL 都不应发射。"""
    op = args.op
    fails = []
    p("== EXECUTE 前终检 ==")
    # 1) Only a successful typed ENOENT observation proves absence.
    for pth in [*(f"{MIG}/{name}" for name in ABSENCE_ITEMS), *ABSENCE_EXTRA]:
        state = observe_absence(pth)
        if state == "ABSENT_ENOENT":
            p(f"  absent ok: {pth}")
        else:
            p(f"  FAIL {state}: {pth}")
            fails.append(pth)
    # 2) 日志 pin（append-only 前缀语义：era 钉字节必须是当前日志的精确前缀；
    #    隔离期闭合后日志按代际合法追加，等值断言只在开放时代适用）
    r = root(["stat", "-f", "%z", JOURNAL])
    d = root(["sh", "-c", f"head -c {JOURNAL_PIN_BYTES} {JOURNAL} | shasum -a 256"])
    sha = d.stdout.split()[0] if d.stdout else "?"
    size = r.stdout.strip()
    if r.returncode != 0 or d.returncode != 0 or not size.isdigit() or int(size) < JOURNAL_PIN_BYTES:
        p(f"  FAIL journal shrunk below era pin: {size} < {JOURNAL_PIN_BYTES}")
        fails.append("journal")
    elif sha == JOURNAL_PIN_SHA:
        p(f"  journal pin OK (append-only prefix {JOURNAL_PIN_BYTES}B = {sha[:12]}…, live {size}B)")
    else:
        p(f"  FAIL journal era-prefix drift: {sha[:16]}…")
        fails.append("journal")
    # 3) DS 准入状态
    r = sh(["/usr/local/libexec/agent-deploy-system/ds_client.py", "b7-status-r3", op])
    try:
        st = json.loads(r.stdout)
        data = st.get("data", {})
        ok = r.returncode == 0 and st.get("ok") is True and isinstance(data, dict) and data.get("phase") == "NO_EXECUTION_RECORD" \
            and data.get("output_available") is False and data.get("execution_enabled") is True
        p(f"  DS admission: {'OK' if ok else 'FAIL ' + json.dumps({k: data.get(k) for k in ('phase', 'output_available', 'execution_enabled')})}")
        if not ok:
            fails.append("ds-admission")
    except Exception as e:
        p(f"  FAIL DS status unreadable: {e}")
        fails.append("ds-status")
    # 4) 生产运行时
    r = sh(["pgrep", "-f", "production-runtime.mjs --root /Users/authsvc"])
    p(f"  production runtime: {'pid ' + r.stdout.strip().splitlines()[0] if r.stdout.strip() else 'DOWN (!)'}")
    if r.returncode != 0 or not r.stdout.strip() or not all(line.isdigit() for line in r.stdout.strip().splitlines()):
        fails.append("runtime-check-failed")
    # 结论
    if fails:
        p(f"\n== 终检 FAIL：{len(fails)} 项 — 禁止发射 ==")
        sys.exit(1)
    p("\n== 终检全绿。发射需人工确认（本工具不自动发射 EXECUTE）。==")


# ---------------------------------------------------------------- sim
SIM_TEMPLATE_HINT = "/tmp/r15-exec-path-sim.py（r12 版含完整注释）— 复制后将 op/gen 函数名替换为当前世代"


def cmd_sim(args):
    """离线全路径模拟：identity→load→snapshot→verify_snapshot→pre_intent。
    零槽位成本。模板：把 /tmp/r15-exec-path-sim.py 的 OP 与 r41rN 函数名替换为当前世代，
    以 root 运行（真实观测设施 + AUTHORIZED_OWNER_UID=502 语义）。"""
    p(__doc__ if False else SIM_TEMPLATE_HINT)
    p("步骤：")
    p(" 1. cp 模板 → 替换 OP 常量为当前 op、r41rN_pre_intent_checkpoint 为当前世代函数")
    p(" 2. sudo python3 <sim>.py —— 五步全 OK 才允许发射")
    p(" 3. 任一 FAIL = 精确首错位置（identity/load/snapshot/verify/pre_intent）")
    p("今日实证：该模拟器在 14:2x 一次抓住 4 个本会烧槽位的阻断（旧快照副本/复发链接/包目录/属主）")


# ---------------------------------------------------------------- pincheck
PIN_GRAPH = {
    # 变更文件 → 所有大钉点（按 2026-10-21 r9-r15 实战教训枚举）
    "operationSourceArchive 成员": [
        "SOURCE-CONTENT.sha256 行", "SOURCE_LIST_SHA (seed ×3 副本)", "W (seed sha)",
        "PACKET.json 行", "M (PACKET.json sha)", "INSTALL-PINS operationSourceArchiveSha256",
        "authority frozen_candidate.operation_source_archive_sha256",
    ],
    "SEED-TEMPLATE.UNINSTALLABLE.json": [
        "stage-seed-once.py TEMPLATE_SHA (行19)", "seed-materials.mjs TEMPLATE_PIN (行105)",
        "PACKET.json 两行", "policy files 行 (manifestPath 旁)", "authority frozen_candidate.stage_seed_sha256",
    ],
    "stage-seed-once.py": [
        "SOURCE-CONTENT 行", "PACKET.json 行", "policy files 行",
        "W (FINAL-SEAL worker)", "authority frozen_candidate.seed_worker_sha256",
    ],
    "agent-credentials.json / shared-credentials": [
        "worker(502) 可读性（TCC/属主/模式 0600 owner-only 检查）",
    ],
    "appSource.root（外部仓库）": [
        "P3 validate-source（目录存在+.git+stamps+PROVENANCE）",
        "APP-PACK-PROVENANCE.repo_src_realpath（不可改路径，只能原址复原）",
    ],
}


def cmd_pincheck(args):
    """给定变更文件（--changed key 或 --list），输出必查钉点清单。"""
    if args.list:
        for k in PIN_GRAPH:
            p(f"  {k}")
        p("（--changed <key> 输出该变更的全部必查钉点）")
        return
    key = args.changed
    if key not in PIN_GRAPH:
        p(f"未知变更类型：{key}。已知类型：")
        for k in PIN_GRAPH:
            p(f"  {k}")
        sys.exit(1)
    p(f"== 变更 {key} 的钉点传播闭包 ==")
    for i, pin in enumerate(PIN_GRAPH[key], 1):
        p(f"  {i}. {pin}")
    p("\n校验手段：candidate 树内 grep 旧值（含 archive 成员/policy/模板/manifest），")
    p("229-verify + seal 兜底；PREFLIGHT 模拟 snapshot 头部 + files 9/9。")
    p("历史教训：r9 手术漏 3 处（stage-seed 钉/manifest 四常量/SEED-TEMPLATE）= 3 个世代成本。")


# ---------------------------------------------------------------- sweep-debris
def cmd_sweep(args):
    """失败世代残留清理：mv 退休（零删除）+ 日志回 pin。--apply 才执行。"""
    tag = args.tag or input("退休标签（如 e42r15-attempt）: ").strip()
    items = [
        (f"{MIG}/activation-code-input", f"{MIG}/activation-code-input.{tag}-retired"),
        (f"{MIG}/b7-preparation-input.json", f"{MIG}/b7-preparation-input.json..{tag}-retired"),
        (f"{MIG}/b7-six-target-batch.json", f"{MIG}/b7-six-target-batch.json..{tag}-install-retired"),
        (f"{MIG}/migration-transaction.json", f"{MIG}/migration-transaction.json..{tag}-retired"),
        (f"{MIG}/migration-fence.json", f"{MIG}/migration-fence.json..{tag}-retired"),
        (LOCKS, LOCKS + f".{tag}-retired"),
        (ARTIFACTS, ARTIFACTS + f".{tag}-install-retired"),
    ]
    if not args.apply:
        p("DRY-RUN（--apply 执行）：")
    n = 0
    for src, dst in items:
        r = root(["test", "-e", src])
        if r.returncode == 0:
            p(f"  {'[apply] ' if args.apply else '[dry] '}retire {src} → {dst}")
            if args.apply:
                root(["mv", src, dst])
            n += 1
        else:
            p(f"  absent: {src}")
    # 日志回 pin
    r = root(["stat", "-f", "%z", JOURNAL])
    sz = r.stdout.strip()
    p(f"  journal: {sz} bytes" + (" (已在 pin)" if sz == str(JOURNAL_PIN_BYTES) else f" → 需回 pin {JOURNAL_PIN_BYTES}"))
    if args.apply and sz != str(JOURNAL_PIN_BYTES):
        root(["mv", JOURNAL, JOURNAL + f".{tag}-appended-full-retired"])
        root(["/bin/sh", "-c", f"head -c {JOURNAL_PIN_BYTES} '{JOURNAL}.{tag}-appended-full-retired' > '{JOURNAL}'"])
        root(["chmod", "600", JOURNAL])
        root(["chown", "root:wheel", JOURNAL])
        p("  journal restored to pin")
    p(f"\n退休 {n} 项。完成后运行 preflight 复核。")
    p("注意：tx 历史目录（activation-tx-*/b7-post-conditions-*/b7-preparation-tx-*.json）属历史证据类，不退休。")


# ---------------------------------------------------------------- restore-journal
def cmd_restore_journal(args):
    # The old recipe has no exact operation/preimage/tail-disposal authority.
    # Refuse before even issuing a runner call; inspection is a separate path.
    if args.apply:
        p("RECOVERY_AUTHORITY_REQUIRED: unbound journal mutation is disabled")
        sys.exit(1)
    r = root(["stat", "-f", "%z", JOURNAL])
    size = r.stdout.strip()
    if r.returncode != 0 or not size.isdigit() or int(size) < JOURNAL_PIN_BYTES:
        p("FAIL journal size unreadable or shorter than pin")
        sys.exit(1)
    d = root(["sh", "-c", f"head -c {JOURNAL_PIN_BYTES} {JOURNAL} | shasum -a 256"])
    fields = d.stdout.split() if isinstance(d.stdout, str) else []
    if d.returncode != 0 or not fields or fields[0] != JOURNAL_PIN_SHA:
        p("FAIL journal prefix unreadable or mismatched")
        sys.exit(1)
    p("MATCH_PIN_NO_MUTATION" if int(size) == JOURNAL_PIN_BYTES else "APPENDED_TAIL_RETAINED")


# ---------------------------------------------------------------- rollback
def cmd_rollback(args):
    """物理回滚：displaced 三层 + preimage homes + overrides + 运行时重启。
    --apply 才执行。前置：确认 0.2.3 失败（PONG FAIL / fleet spawn 回归）。"""
    tx = args.tx
    if not tx:
        p("需要 --tx <tx-id>")
        sys.exit(1)
    L_ = L
    steps = [
        ("停运行时", ["pkill", "-f", "production-runtime.mjs --root /Users/authsvc"]),
        (f"app 退休 → 恢复 displaced", f"mv {L_}/app {L_}/app.oldversion-rollback-$(date +%s) 2>/dev/null; "
         f"cp -R {L_}/.app-tx-{tx}-displaced {L_}/app"),
        (f"harness 恢复", f"mv {L_}/harness {L_}/harness.oldversion-rollback-$(date +%s) 2>/dev/null; "
         f"cp -R {L_}/.harness-tx-{tx}-displaced {L_}/harness 2>/dev/null || true"),
        (f"node-runtime 恢复", f"mv {L_}/node-runtime {L_}/node-runtime.oldversion-rollback-$(date +%s) 2>/dev/null; "
         f"cp -R {L_}/.node-runtime-tx-{tx}-displaced {L_}/node-runtime 2>/dev/null || true"),
        ("homes dsh-codex ← preimage", f"for src in /Users/authsvc/.agent-core/control/codex-plugin-preimage-{tx}*/agt_*__dsh-codex; do "
         f"home=$(basename $src | sed 's/__dsh-codex$//'); dest=/Users/authsvc/.agent-core/homes/$home/profiles/node_modules/dsh-codex; "
         f"rm -rf $dest; cp -R $src $dest; done"),
        ("overrides 回拨", "B=$(ls -t /Users/authsvc/.agent-core/agent-model-overrides.json.pre-* 2>/dev/null | head -1); "
         "[ -n \"$B\" ] && cp $B /Users/authsvc/.agent-core/agent-model-overrides.json"),
    ]
    if not args.apply:
        p("DRY-RUN（--apply 执行）：")
        for name, _ in steps:
            p(f"  {name}")
        p("  运行时以完整 launchd env 重启（HOME=/Users/authsvc + plist env 块，见 /tmp/ac-env.txt 生成法）")
        p("  验证：PONG 消息 → agent 15B 精确回复送达")
        return
    for name, cmd_ in steps:
        if isinstance(cmd_, str):
            r = root(["/bin/sh", "-c", cmd_])
        else:
            r = root(cmd_)
        p(f"  {name}: rc={r.returncode}")
    p("\n回滚执行完毕。运行时重启（launchd 优先，2026-10-22 起生产监管已恢复）：")
    p("  sudo launchctl kickstart -k system/ai.agent-core.runtime")
    p("  （手动兜底：/tmp/ac-env.txt 配方，见 RUNBOOK §7；两处属主陷阱见 §7 陷阱清单）")
    p("验证：PONG 消息 → agent 15B 精确回复送达。事务事后 reconcile（管线内 --abort）。")


# ---------------------------------------------------------------- tx
TX_RECEIPT_GLOB = "/private/var/db/agent-deploy-system/receipts/*.b7-execution.json"


def cmd_tx(args):
    """只读事务账本投影：DS 回执 + 监管状态 + 合法下一步。不做任何 bypass。"""
    r = root(["/bin/sh", "-c", f"ls -t {TX_RECEIPT_GLOB} 2>/dev/null"], capture=True)
    receipts = [l for l in (r.stdout or "").splitlines() if l.strip()]
    if not receipts:
        p("无 b7-execution 回执（无已注册执行事务）")
        return
    for path in receipts[: args.limit]:
        raw = root(["cat", path], capture=True).stdout or ""
        try:
            d = json.loads(raw)
        except Exception:
            p(f"{path}: 不可解析")
            continue
        p(f"{d.get('operation_id')}:")
        p(f"  tx_id={d.get('tx_id')} phase={d.get('phase')} reason={d.get('reason')} "
          f"attempt={d.get('attempt')} terminal_output={d.get('terminal_output')}")
    p("\n合法语义（红线，勿绕过）：")
    p("  - phase=RETAINED+APPLIED_AWAITING_PONG：物理安装与业务验收可独立证明；")
    p("    正式 COMMIT 需管线 armed-stage 互斥 FD 上下文，FD 已随安全释放消失。")
    p("  - 禁止从普通 sudo shell 跑 r13.sh --abort/--commit；禁止 B7_OUTER_ACTIVE/TXPROBE 伪造。")
    p("  - 缺口=恢复转移合同（固定 TX 身份重新获权+fence 核验），归 0.2.4 清单第 7 项，")
    p("    收敛进 B7_STAGE_RUNNER_AND_RECOVERY 单元；在此之前账本保持 APPLIED_AWAITING_PONG 属实记录。")
    p("\n运行时监管：")
    r = sh(["pgrep", "-f", "production-runtime.mjs --root /Users/authsvc"])
    pids = r.stdout.strip().splitlines()
    p(f"  runtime: {'pid ' + pids[0] if pids else 'DOWN'}")
    r = sh(["pgrep", "-f", "deployment_system.py"])
    p(f"  DS daemon: {'pid ' + r.stdout.strip().splitlines()[0] if r.stdout.strip() else '未运行（部署窗口按 RUNBOOK §7 拉起）'}")
    if args.amend_draft:
        _tx_amend_draft(receipts)


AMEND_DRAFT_TEMPLATE = """# AMENDMENT_B7_TX-{tx_short}_RECOVERY_TRANSFER_V1（草案，PROPOSED_NOT_ACCEPTED）
# 生成：b7ctl tx --amend-draft @ {ts}
# 模式先例：E6_PIN / E23_PIN（fixed-subject retained-generation recovery，
#   全部字段机器读取自授权 read-back，历史回执字节不变）。
# 语义：为 {op} 定义一次性合法恢复转移——在原 armed FD 消失后，由
#   本修订的 fixed pin 精确授权单一主体对该 TX 执行 RECONCILE/COMMIT。
# 红线：字段必须与 DS 权威 read-back 逐字节一致后才能采纳；禁止泛化为
#   通用 bypass；采纳需 Owner 授权 + accepted amendment 落入实现 PR base。

PIN = {{
  'operation_id': '{op}',
  'tx_id': '{tx}',
  'execution_receipt_sha256': '{receipt_sha}',
  'manifest_sha256': '{manifest}',
  # TODO(下一 armed 上下文补齐，机器读取自 DS b7-status-r3 / 权威 read-back)：
  #   holder_nonce / cohort_seal / fence 状态指纹
  'business_acceptance': {{
    'pong_verified': true,
    'evidence': '{pong_evidence}',
  }},
}}

# 恢复转移前置（全部满足才允许该 TX 的 RECONCILE/COMMIT）：
#  1. 本 PIN 全字段 == DS 权威 read-back（逐字段比对，fail-loud）
#  2. 目标 phase == APPLIED_AWAITING_PONG（其它状态一律拒绝）
#  3. PONG 业务证据文件 sha256 == business_acceptance.evidence 绑定值
#  4. DS mutation lock 以本修订身份独占持有（不继承、不伪造 FD9）
#  5. 执行后回执追加，历史记录字节不变
"""


def _tx_amend_draft(receipts):
    if not receipts:
        p("无回执，无法生成修订草案")
        return
    try:
        d = json.loads(root(["cat", receipts[0]], capture=True).stdout)
    except Exception as e:
        p(f"回执不可读: {e}")
        return
    op = d.get("operation_id", "?")
    tx = d.get("tx_id", "?")
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                       f"AMENDMENT-DRAFT-{tx[:16]}.md")
    pong = ("/Users/yanfenma/Documents/Codex/2026-10-18/zcode-assist/answers/"
            "sol-r41-r2-20261020/r15-receipts/ZCODE-DEPLOY-FUNCTIONAL-COMPLETION.json")
    body = AMEND_DRAFT_TEMPLATE.format(
        tx_short=tx.replace("tx-", "")[:12], ts=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        op=op, tx=tx,
        receipt_sha=hashlib.sha256((root(["cat", receipts[0]], capture=True).stdout or "").encode()).hexdigest(),
        manifest="(机器读取自 FINAL-SEAL/registration binding)",
        pong_evidence=pong)
    with open(out, "w", encoding="utf-8") as fh:
        fh.write(body)
    p(f"\n修订草案已生成（PROPOSED_NOT_ACCEPTED）: {out}")
    p("补齐 holder/fence 指纹后按 E23 先例走 Owner 授权采纳；在此之前不得用于实际 RECONCILE/COMMIT。")


# ---------------------------------------------------------------- status
def cmd_status(args):
    ops = root(["ls", RECEIPTS], capture=True).stdout or ""
    gen = sorted(set(l.split(OP_PREFIX)[1].split(".")[0] for l in ops.splitlines() if OP_PREFIX in l),
                 key=lambda g: int(g.replace("r", "") or 0))
    p(f"已知世代：{gen}")
    latest = gen[-1] if gen else "?"
    op = f"{OP_PREFIX}{latest}"
    r = sh(["/usr/local/libexec/agent-deploy-system/ds_client.py", "b7-status-r3", op])
    try:
        st = json.loads(r.stdout)
        p(f"latest {op}: {json.dumps({k: st.get('data', {}).get(k) for k in ('phase', 'active', 'tx_id', 'output_available')})}")
    except Exception:
        p("status unreadable")
    r = sh(["pgrep", "-f", "production-runtime.mjs --root /Users/authsvc"])
    p(f"runtime: {'pid ' + r.stdout.strip().splitlines()[0] if r.stdout.strip() else 'DOWN'}")
    r = sh(["pgrep", "-f", "deployment_system.py"])
    p(f"DS (manual): {'pid ' + r.stdout.strip().splitlines()[0] if r.stdout.strip() else 'via launchd?'}")
    r = root(["df", "-H", "/"], capture=True)
    p("disk: " + (r.stdout.strip().splitlines()[-1] if r.stdout else "?"))
    r = root(["du", "-sh", "/private/var/db/agent-deploy-system-driven"], capture=True)
    p("driven: " + (r.stdout.strip() or "?"))


# ---------------------------------------------------------------- pong
def cmd_pong(args):
    chat = args.chat
    if not chat:
        p("需要 --chat <oc_…>（agent 群 id）")
        sys.exit(1)
    r = sh([LARK, "api", "POST", "/open-apis/im/v1/messages", "--as", "user", "--format", "json",
            "--params", '{"receive_id_type":"chat_id"}',
            "--data", json.dumps({"receive_id": chat, "msg_type": "text",
                                  "content": json.dumps({"text": "Reply with exactly: PONG-FLEET-LUNA"})})])
    ok = '"code": 0' in r.stdout
    p("PONG 消息已发送" if ok else "发送失败：" + r.stdout[:200])
    if not ok:
        sys.exit(1)
    p("等待 agent 回复后，用 lark-cli 拉群消息核对精确文本（15B = PONG-FLEET-LUNA）；")
    p("或查会话文件 assistant/message 的 source.provider/model/responseId。")


# ---------------------------------------------------------------- harden
def cmd_harden(args):
    """Check exact current evidence; final failures always return nonzero."""
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import installer_hardening as ih

    def check():
        failures, repairs = ih.check_access_layers()
        registration = ih.check_registration(
            args.registration_receipt, expected_operation=args.op,
            expected_manifest=args.manifest_sha256,
            expected_sha256=args.registration_receipt_sha256)
        registration_failures = [item for item in registration if item["check"] != "registration_ok"]
        failures.extend(registration_failures)
        return failures, repairs, bool(registration_failures)

    failures, repairs, registration_failed = check()
    if args.apply and registration_failed:
        p("FAIL: required registration binding; repairs not attempted")
        sys.exit(1)
    repair_failed = False
    if args.apply:
        if repairs:
            def run(cmd):
                p("+ " + " ".join(cmd))
                return sh(cmd, capture=False).returncode
            done = ih.apply_repairs(repairs, run)
            repair_failed = len(done) != len(repairs) or any(not d["ok"] for d in done)
            p(f"applied {sum(1 for d in done if d['ok'])}/{len(done)}")
        # Always re-read every check; pre-apply success never survives by assumption.
        failures, _, _ = check()
    if failures or repair_failed:
        p(f"FAIL: {len(failures)} checks; repair_failed={repair_failed}")
        for item in failures:
            p(f"  [{item['check']}] {item['path']}: {item['detail']}")
        sys.exit(1)
    p("ALL GREEN: 三层访问 + 属主物化 + 精确当前注册身份")
    if repairs and not args.apply:
        p(f"（{len(repairs)} 条可选卫生修复未执行）")


# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(prog="b7ctl", description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("preflight", help="EXECUTE 前终检")
    s.add_argument("--op", required=True)
    s = sub.add_parser("sim", help="离线全路径模拟说明")
    s = sub.add_parser("pincheck", help="pin 闭包校验")
    s.add_argument("--changed")
    s.add_argument("--list", action="store_true")
    s = sub.add_parser("sweep-debris", help="失败世代残留清理")
    s.add_argument("--tag")
    s.add_argument("--apply", action="store_true")
    s = sub.add_parser("restore-journal", help="日志截断回 pin")
    s.add_argument("--apply", action="store_true")
    s = sub.add_parser("rollback", help="物理回滚")
    s.add_argument("--tx")
    s.add_argument("--apply", action="store_true")
    s = sub.add_parser("status", help="状态投影")
    s = sub.add_parser("tx", help="事务账本只读投影+合法下一步")
    s.add_argument("--limit", type=int, default=3)
    s.add_argument("--amend-draft", action="store_true",
                   help="为最新 RETAINED 事务生成 fixed-subject 恢复修订草案（E23 先例模式）")
    s = sub.add_parser("harden", help="安装器加固四项断言（--apply 执行权限级修复）")
    s.add_argument("--op", required=True)
    def digest(value):
        import re
        if re.fullmatch(r"[0-9a-f]{64}", value) is None:
            raise argparse.ArgumentTypeError("expected 64 lowercase hexadecimal characters")
        return value
    s.add_argument("--manifest-sha256", type=digest, required=True)
    s.add_argument("--registration-receipt", required=True)
    s.add_argument("--registration-receipt-sha256", type=digest, required=True)
    s.add_argument("--apply", action="store_true")
    s = sub.add_parser("pong", help="发送 PONG 验收消息")
    s.add_argument("--chat")
    args = ap.parse_args()
    {"preflight": cmd_preflight, "sim": cmd_sim, "pincheck": cmd_pincheck,
     "sweep-debris": cmd_sweep, "restore-journal": cmd_restore_journal,
     "rollback": cmd_rollback, "status": cmd_status, "tx": cmd_tx,
     "harden": cmd_harden, "pong": cmd_pong}[args.cmd](args)


if __name__ == "__main__":
    main()
