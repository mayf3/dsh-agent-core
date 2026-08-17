# AGENT_CORE_BACKUP_RETENTION_V1_PROPOSAL

> AGENT_CORE_BACKUP_RETENTION_V1
> Role: **Deployment / Ops Agent**
> Phase: **READ-ONLY INVESTIGATION + PROPOSAL ONLY**
> Repository: `mayf3/dsh-agent-core` (local checkout `dsh-agent-core`)
>
> **No backups were deleted. No code was modified. No deployment scripts were modified.**
> This document is an investigation and a proposal; it has NOT been implemented.

---

## 0. Executive Summary

Deployment backup retention for the trusted Agent Core install at
`/usr/local/libexec/agent-core` is **unbounded**: every run of the deploy script
`mv`s the entire current install to a new `agent-core.bak-<YYYYMMDD-HHMMSS>`
directory and never prunes old ones. As of this snapshot there are **13** such
backup directories using **~20.96 GiB** (≈1.5–1.7 GiB each) on `/`.

Three concrete, evidence-backed problems are highlighted:

1. **Unbounded growth** — no prune/retention exists anywhere (confirmed by a
   full-tree grep: no `prune`/`retention`/`rm -rf *bak*` path in any repo script).
2. **Blind `mv` archives interrupt/partial installs** — because Step 1 renames the
   current tree to `.bak-NN` *before* the new closure is built, a **failed or
   interrupted** install that has already partially rebuilt `app/` gets captured
   as a "backup" that is **not a usable rollback point**. Concretely,
   `agent-core.bak-20260816-211201` captured an install with a **completely empty
   `app/`, `config/`, `home/`** (broken). Several others lack `node-runtime/`, so
   they cannot boot the current hardened launchd unit (which runs
   `node-runtime/bin/node`).
3. **Rollback selection is manual and error-prone** — there is **no automated
   restore**; the operator would have to pick a `.bak` and `mv` it back by hand,
   and there is **no known-good / pinned / deployment-status marker** on any
   backup. A "keep newest 3" heuristic would be **unsafe**, because the newest
   backup (`211201`) is the broken capture.

Because there is no reliable known-good marker today, **nothing should be deleted
yet** unless an operator explicitly pins the known-good recoverable points.

---

## 1. Verified deployment path (authoritative sources)

The deploy script that produced the current install and all today's backups is:

- Live installed copy: `/usr/local/libexec/agent-core/app/scripts/trusted-cp-deploy-install.sh`
  - MD5 `d84c79d62f1c9fbf74ceef4f2f50e00b`
  - **identical** to the repo worktree variant
    `<home>/workspace/project/dsh-agent-core/.worktree/production-integration-v1/scripts/trusted-cp-deploy-install.sh`
- Deploy source branch/worktree: `feat/production-integration-v1`
  (worktree `.worktree/production-integration-v1`, HEAD moved during the day; final
  observed `da7ac27`, last commit 22:50).
- Harness source: `<home>/workspace/github/deepseek-harness` (HEAD moves
  between runs; observed at `a8872508` clean, and earlier `e02d85b19e` during the day).

There is a second, older deploy variety in
`.worktree/trusted-cp-agent-definition-compat-v1/scripts/trusted-cp-deploy-install.sh`
(MD5 `89b3092d…`) and in `.worktree/agent-core-production-resident-v1` — but the
**live** script is the `production-integration-v1` one (that is the only variant
that ships files `production-runtime*.mjs`, and the current install carries them).

> Note: the repo's *main* checkout (`.worktree` sibling `dsh-agent-core`, HEAD
> `bfe7491`) is **not** the deploy source; the deploy runs from the feature
> **worktree**.

The supervision unit that boots the deployment is the launchd plist
`ai.agent-core.runtime` (`/Library/LaunchDaemons` equivalent; template at
`.worktree/production-integration-v1/.demo/…/ai.agent-core.runtime.plist`):

```
ProgramArguments:
  /usr/local/libexec/agent-core/node-runtime/bin/node
  /usr/local/libexec/agent-core/app/scripts/production-runtime.mjs
  --root <home>/.agent-core
WorkingDirectory: /usr/local/libexec/agent-core/app
RunAtLoad=true, KeepAlive=true, ThrottleInterval=10
```

**Rollback-relevance of the plist:** the running system's entry point is the
**trusted `node-runtime/bin/node`** launching **`app/scripts/production-runtime.mjs`**.
A backup that lacks either `node-runtime/` or the production-runtime closure
**cannot boot under the current launchd unit** without also editing the plist.

---

## 2. `CURRENT_BACKUP_CREATION_FLOW`

**BACKUP_CREATOR** = the deploy script itself (shell `mv`), inside
`trusted-cp-deploy-install.sh`, Step 1.

**BACKUP_MECHANISM** = `mv` (rename), **not** `cp`, `rsync`, `tar`, or `rename`:

```bash
# trusted-cp-deploy-install.sh, lines 71-76 (production-integration-v1 variant)
if [ -e "$TRUSTED_ROOT" ]; then
  BAK="${TRUSTED_ROOT}.bak-$(date +%Y%m%d-%H%M%S)"
  echo "== backing up previous install -> $BAK"
  mv "$TRUSTED_ROOT" "$BAK"
fi
```

**BACKUP_CREATION_STAGE** = at the **very start** of the install, **before**
the new closure is built. Sequence:

1. `mv` current `agent-core` → `agent-core.bak-<ts>`  (Step 1)
2. `mkdir -p agent-core/{harness,app,home,config,.cache}` (Step 1 tail)
3. **1b.** reuse heavyweight closures from `$BAK` if unchanged (see §Section 3)
4. (re)build harness + node-runtime + app closure + home + config
5. ownership/modes, helper, audits (Step 6–9)
6. **install complete** (Step 10) → next: run hardening verify (separate step)

So the backup is a **pre-deploy snapshot of the previously installed closure**.

**BACKUP_NAMING** = `agent-core.bak-<YYYYMMDD-HHMMSS>` (lexically sortable,
timestamped from `date +%Y%m%d-%H%M%S`). This is the only ordering signal.

**BACKUP_CONTENT** = the **entire** previous installed tree: `harness/`
(≈1.5 GiB incl. offline pnpm `node_modules`), `app/`, `home/`, `config/`
(<uid>-private), and, when present, `node-runtime/` and `.cache/`. Owner/mode for
`harness/app/home` is typically `<svc-user>:<svc-user>`; `config/` is `<svc-user>:<svc-user>
0700`; `.cache` is `root:wheel 0700`.

**BACKUP_OWNER_MODE** = inherited directly from the captured install (no
re-chown/mode pass on the backup itself).

### Critical caveat — the `mv` backup is not atomic rollback evidence

Because Step 1 renames the *current* tree (whatever state it is in), any
re-deploy that runs while the previous deploy **failed partway through a rebuild**
will capture that **partial tree**. This is exactly what produced the broken
`agent-core.bak-20260816-211201` (empty `app/`, `config/`, `home/`).

---

## 3. Current reuse behavior (why some backups are "degraded")

The `production-integration-v1` deploy script (Step 1b, lines 88–105) **mutates
the just-created backup** to reuse expensive closures:

```bash
REUSE_HARNESS=0; REUSE_NODE=0
if [ -n "${BAK:-}" ]; then
  ... if "$BAK/harness/.source-stamp" == harness-src stamp ...; then
      mv "$BAK/harness" "$TRUSTED_ROOT/harness"   # <-- harness LEAVES the backup
      mv "$BAK/.cache" "$TRUSTED_ROOT/.cache"
      REUSE_HARNESS=1
  fi
  if "$BAK/node-runtime/bin/node" --version == "$(node --version)"; then
      mv "$BAK/node-runtime" "$TRUSTED_ROOT/node-runtime"  # <-- node LEAVES
      REUSE_NODE=1
  fi
fi
```

Consequences for retention analysis:

- A backup whose `harness/` and/or `node-runtime/` were `mv`'d back out into the
  new install **no longer contains a complete, self-contained rollback tree**.
- Observed state: backups `100403`, `210313`, `211201`, `222634`, `224243` have
  **no `node-runtime/`** (either the source run never had one, or it was reused
  out). Backups `130413`–`204101` still carry `node-runtime/` (v25.6.1).
- All retained backups still contain a full `harness/` (≈1.4 GiB `node_modules`),
  because the harness commit changed between sessions (stamp mismatch prevented
  reuse from draining them). The last three backups (`211201`/`222634`/`224243`)
  carry a `.source-stamp`; the earlier ten do **not**.

> **Rollback-trust impact:** complete, self-contained, restore-ready trees are not
> uniform across backups. A retention plan must classify fidelity, not just age.

---

## 4. `CURRENT_ROLLBACK_FLOW`

- **Automatic rollback: NONE.** The deploy script, on install failure, `exit 2`s
  and does **not** restore any backup.
- **Restore mechanism: MANUAL only.** There is **no** `restore`/`rollback`
  routine, wrapper script, or helper in the repo (`grep` for `restore|rollback`
  under deploy/verify finds only the *scheduler-caller* rollback,
  `rollback-callers-to-openclaw-v1.sh`, which is unrelated to this trusted
  install). An operator would have to run something like
  `sudo mv /usr/local/libexec/agent-core.bak-NN /usr/local/libexec/agent-core`
  then restart launchd.
- **Rollback selection depends on:** the operator choosing a `.bak-<ts>` by eye
  (a **glob**/name). It does **not** rely on a fixed filename, a canonical
  `latest`, a metadata marker, or a hardcoded `.bak` path.
- **Rollback does NOT verify:** there is no "was this backup a known-good PASS"
  flag, no deployment_status, no acceptance-link.

**→ Rollback-compatibility requirement (Part K) is trivially satisfied by keeping
the `agent-core.bak-<ts>` directory format and adding sidecar metadata files**; a
metadata sidecar inside each backup does not change the `mv` semantics an
operator already uses.

---

## 5. `CURRENT_RETENTION` / `CURRENT_PRUNE` / `CURRENT_ROLLBACK_SELECTION`

- **`CURRENT_RETENTION = UNBOUNDED`** (confirmed: no retention limit anywhere).
- **`CURRENT_PRUNE = NONE`** (confirmed: no `prune`/`rm -rf` of `agent-core.bak-*`
  exists in any repo or installed script).
- **`CURRENT_ROLLBACK_SELECTION = MANUAL GLOB`** (operator-picked `.bak-<ts>`).

---

## 6. `CURRENT_12/13_BACKUP_INVENTORY`

> Snapshot taken at 22:51 CST 2026. **13** backup directories (12 at the original
> problem statement + the newest `224243` created at 22:42), total **≈20.96 GiB**
> (21,982,472 KiB). `/dev/disk3s5` free ≈ 123 GiB (87% used) — not an immediate
> space emergency, but growth is unbounded and accelerating.

### 6.1 Inventory table (read-only facts)

| # | Backup dir (-20260816-) | Size | mtime | Config dir | node-rt | prod-rt closure | app/scripts | App era (by closure) |
|---|--------------------------|--------|--------|-----------|---------|-----------------|-------------|------------------------|
| 1 | `10:0403` `agent-core.bak-20260816-100403` | 1.5G (1,620,196K) | 08-15 21:46 | present(go) | no | no | OLD registry | **OLD Agent-Registry era** |
| 2 | `13:0413` `…-130413` | 1.6G (1,701,988K) | 08-16 10:04 | present | **yes** v25.6.1 | no | OLD | **OLD Agent-Registry era** |
| 3 | `13:0612` `…-130612` | 1.7G (1,834,088K) | 08-16 13:05 | present | **yes** | no | def-era | Agent-Definition era |
| 4 | `13:2129` `…-132129` | 1.6G (1,702,064K) | 08-16 13:06 | present | **yes** | no | def-era | Agent-Definition era |
| 5 | `14:5342` `…-145342` | 1.6G (1,702,064K) | 08-16 13:21 | present | **yes** | no | def-era | Agent-Definition era |
| 6 | `18:0620` `…-180620` | 1.6G (1,702,064K) | 08-16 14:54 | present | **yes** | no | def-era | Agent-Definition era |
| 7 | `19:5803` `…-195803` | 1.6G (1,702,160K) | 08-16 18:07 | present | **yes** | **yes** | 9 scripts | Production-Integration era |
| 8 | `20:2649` `…-202649` | 1.6G (1,702,160K) | 08-16 19:59 | present | **yes** | **yes** | 9 | Production-Integration era |
| 9 | `20:4101` `…-204101` | 1.6G (1,702,176K) | 08-16 20:28 | present | **yes** | **yes** | 10 | Production-Integration era |
| 10 | `21:0313` `…-210313` | 1.5G (1,620,576K) | 08-16 21:03 | present | no | **yes** | 10 | Production-Integration era |
| 11 | `21:1206` `…-211201` | 1.7G (1,751,772K) | 08-16 21:12 | present(empty) | no | no | **BROKEN (empty app/config/home)** | **Failed/partial capture** |
| 12 | `22:2639` `…-222634` | 1.5G (1,620,580K) | 08-16 22:26 | present | no | **yes** | 10 | Production-Integration era |
| 13 | `22:4248` `…-224243` | 1.5G (1,620,584K) | 08-16 22:42 | present | no | **yes** | 10 | Production-Integration era |

*`config/` is 0700 <svc-user> — content not read (no secrets touched). `present`
means the dir exists and is <uid>-private. Only `100403` was pre-`mv` at 08-15.

### 6.2 Era classification & rollback fidelity

- **OLD Agent-Registry era** (`100403`, `130413`): contain `packages/agent-registry`
  and **no** `agent-definition` / `production-runtime`. Rolling back here would
  reintroduce a since-removed architecture and, for `100403` with no node-runtime,
  could not boot the current plist.
- **Agent-Definition era** (`130612`, `132129`, `145342`, `180620`): have
  `agent-definition`, **no** `production-runtime`. Would boot an older
  non-supervised closure — plist mismatch.
- **Production-Integration era** (`195803`, `202649`, `204101`, `210313`,
  `222634`, `224243`): have `production-runtime` closure; **compatible** with the
  current launchd unit.
- **Broken capture** (`211201`): empty `app/`, `config/`, `home/` — **not a
  rollback point** (an interrupted rebuild was captured).

### 6.3 `CURRENT_BACKUP_RECOMMENDATION` — classification per the required taxonomy

> Because there is no known-good marker, each bundle is classified by **fidelity
> evidence**: is it a complete, current-plist-bootable, production-runtime closure?

| Backup | Class | Basis |
|--------|-------|-------|
| `19:5803` …-195803 | **PROVISIONALLY_KEEP** | Complete (app+harness+node-rt) Production-Integration closure; the *oldest* current-architecture rollback candidate; no marker, so provisionally kept. |
| `20:2649` …-202649 | **PROVISIONALLY_KEEP** | Complete Production-Integration closure; 9-script gen. |
| `20:4101` …-204101 | **PROVISIONALLY_KEEP** | Complete Production-Integration closure; 10-script gen. |
| `21:0313` …-210313 | **PROVISIONALLY_KEEP** | Production-Integration, full app but **no node-runtime** (was reused/stripped); restore needs node-runtime re-materialization. |
| `22:2639` …-222634 | **PROVISIONALLY_KEEP** | Production-Integration, full app, **no node-runtime**. |
| `22:4248` …-224243 | **PROVISIONALLY_KEEP** | Production-Integration, full app, **no node-runtime**; **most recent** recoverable production-Integration point. |
| `13:0413` …-130413 | **UNKNOWN → KEEP FOR NOW** | Complete + node-rt but **OLD Registry era** — older architecture; only complete old-era tree. Could matter if rollback to pre-Definition is ever desired. |
| `13:0612` …-130612 | **UNKNOWN → KEEP FOR NOW** | Def-era, complete. |
| `13:2129` …-132129 | **UNKNOWN → KEEP FOR NOW** | Def-era, complete. |
| `14:5342` …-145342 | **UNKNOWN → KEEP FOR NOW** | Def-era, complete. |
| `18:0620` …-180620 | **UNKNOWN → KEEP FOR NOW** | Def-era, complete; latest Def-era point (pre-CP). |
| `10:0403` …-100403 | **UNKNOWN → KEEP FOR NOW** (weakest) | Only backup without node-runtime AND OLD Registry era, pre-CP; smallest rollback value under current plist. |
| `21:1206` …-211201 | **SAFE_DELETE_CANDIDATE** | Proven **broken** (empty app/config/home); **not** a usable rollback point. However, since cleanup is not executed this round, it is merely *flagged*, not deleted. |

**NOT a "keep newest 3"** — the newest 3 are `222634`,`224243` (no node-runtime)
and the newest is actually the **broken** `211201`; a naive newest-3 policy would
keep a broken capture and drop the only *complete* current-architecture points.

### 6.4 `ESTIMATED_SPACE_AFTER_FUTURE_CLEANUP`

Applying the *proposed* retention model (§7) with:
- `NORMAL_BACKUPS_KEEP = 3`, pinned = the current-architecture points an operator
  confirms, and treating the **broken** `211201` and the **OLD/Def-era** bundles as
  non-current:

Conservative "keep 3 complete current-architecture + pin all Production-Integration
recoverable" yields ≈ **208 GiB freed** if the 10 non-current/broken/duplicate-era
bundles are eventually cleared (≈ see table — 21.0 → ~3×1.6 + small).

Concrete projection (cleanup **not performed this round**):

- Current total: **~20.96 GiB** (13 backups).
- Keep (provisionally, current-architecture recoverable): e.g.
  `195803, 202649, 204101` (+ pinned user-chosen) ≈ **~4.8–6.4 GiB**.
- Frees ≈ **~14.6–16.2 GiB** once a future, operator-approved prune of the
  non-current/broken/older-era bundles runs.
- Post-clean target: **3 normal + pinned ≈ ~4–5 backups ≈ ~6–8 GiB**.

> The exact delete set is deliberately **NOT finalized here** — several "UNKNOWN →
> KEEP" bundles retain unique recovery value for older architectures, and pinning
> requires an operator's explicit known-good decision.

---

## 7. `PROPOSED_RETENTION_MODEL`

Converged target (matches the brief):

```
NORMAL_BACKUPS_KEEP   = 3        # newest NORMAL, current-architecture, non-pinned
PINNED_BACKUPS_MIN    = 1        # explicit last-known-good; NOT counted in the 3
```

- Semantics: at any time there are at most **3 NORMAL** backups **+ any PINNED**
  backups (pinned are outside the retention count).
- A pinned bundle is **never automatically pruned**.
- Multiple pinned bundles are allowed temporarily, but only **explicitly** via a
  pin action; passing a deployment does **not** auto-pin beyond the operator's
  intent (see §9 known-good semantics).

---

## 8. `PIN_MODEL` — pin must NOT duplicate backup data

The pin is a **metadata / marker / pointer**, never a second copy of the tree.

**Minimal chosen mechanism (recommended):** a small **sidecar marker file inside
each backup directory**.

```
/usr/local/libexec/agent-core.bak-<ts>/.pinned
/usr/local/libexec/agent-core.bak-<ts>/.backup-meta    (see §11)
```

- A pin = `touch /usr/local/libexec/agent-core.bak-<ts>/.pinned` (or presence of
  the marker with `pinned: true` in the meta file).
- **No `cp -R`** of a 1.6 GiB tree; a pin adds zero material bytes beyond the tiny
  marker.
- Because the marker is a **regular file inside the backup directory**, it:
  - does **not** change the `mv` semantics (backup dir stays `mv`-able),
  - does **not** break existing restore `cp`/`mv` of the tree,
  - is ignored by the deploy's closure copy (deploy only reads `harness/.source-stamp`
    and `config/*.json`),
  - survives launchd restart and the deploy's backup `mv`.

This keeps the existing backup-directory format exactly, satisfying **Part K**
(no rewrite of the rollback framework, just sidecars on top).

**Who can pin** → root (the same privilege that runs the install; backups are
owned `root:wheel` at the directory level). **What permission** → `touch` inside
the backup dir (root). **How to list** → `ls /usr/local/libexec/agent-core.bak-*/.pinned`
or a one-line grep over `.backup-meta`.

---

## 9. `KNOWN_GOOD_SEMANTICS`

A bundle may be marked **last-known-good** only on explicit operational evidence —
**never** by "newest = known-good". The operational rule:

1. At **deploy start**, if the **currently installed** `agent-core` has already
   passed the required preflight/health (hardening verify / acceptance), then the
   just-created backup of that install (Step 1 `mv`) becomes a **candidate
   known-good rollback point** → operator may pin it **before** installing.
2. A **new** version only changes retention/known-good state after it has
   **completed install + launch + required health/acceptance** (hardening verify
   PASS under the trusted node, plus the PRODUCTION_INTEGRATION acceptance if
   running supervised).
3. No automatic "is it business-smart" judgment. Only the above operational
   semantics decide known-good.

This gives a usable definition of the **pre-deploy known-good** the brief asks for:
"current installed closure already verified → the backup taken of it = candidate
last-known-good pin."

---

## 10. `METADATA_MODEL`

Minimal `agent-core.bak-<ts>/.backup-meta` (single small JSON or dotted-key file):

```json
{
  "backup_id":      "20260816-224243",
  "created_at":     "2026-08-16T22:42:48+08:00",
  "source_commit":  "unknown",
  "harness_commit": "e02d85b19e...",      // from harness/.source-stamp when present
  "type":           "normal",              // normal | pinned
  "pinned":         false,
  "deployment_status": "predeploy",        // see values below
  "closure_era":    "production-integration"
}
```

**`source_commit` (app/deploy source):** the deploy does **not record the repo
commit** of `REPO_SRC`; only the **harness** commit is recorded in
`harness/.source-stamp` (and only in the last few backups). Per the brief's rule:
*if reliably obtainable use it, else `unknown`*. The app/repo commit is **not
reliably obtainable today** for most backups → **`unknown`** is the honest value.
`harness_commit` is recoverable for the stamped backups only.

### `deployment_status` — keep minimal, don't build a state machine

Allowed values (single-step transitions only):

| value | meaning |
|-------|---------|
| `predeploy` | backup was taken of the install present at deploy start |
| `rollback_used` | this backup was used for a manual rollback |
| `succeeded_successor` | the deploy that followed this backup reached verified success |
| `failed_successor` | the deploy that followed this backup failed or health-failed |

A backup starts at `predeploy`. After the deploy that consumed it succeeds
(`succeeded_successor`) or fails (`failed_successor`), a tiny post-step updates the
meta. **No** rolled-up workflow/rollback-database is created — this is a single
tag on an existing file.

---

## 11. `FAILURE_SEMANTICS` (Part H — the critical part)

Freeze these rules:

| situation | retention action |
|-----------|------------------|
| Deploy begins → backup taken of previous install | **PRUNE = NO** |
| Deploy **fails before new version verified** | **PRUNE = NO**; the just-created `predeploy` backup is **KEPT** (it may be the only reliable rollback point) |
| Rollback **succeeds** (operator used a backup) | **USED_ROLLBACK_BACKUP = KEEP** (never delete the recovery evidence; mark `rollback_used`) |
| Deploy "succeeds" but **health verification fails** | treated as **DEPLOYMENT_FAILED**; **PRUNE = NO** |
| **Deploy + required verification success** | **PRUNE_ALLOWED = YES**; then: pinned never pruned; NORMAL kept latest 3 |
| **Partial prune failure** (rm backup A ok, backup B fails) | deployment **stays a success** (retention failure does not invalidate a healthy deployment), but a **loud non-silent warning** is emitted; next deploy retries prune |

---

## 12. `PRUNE_TRIGGER` (Part I — ordering)

Prune must happen **only** after verification success, in this order:

```
1. create backup (Step 1 mv)
2. install new closure
3. launch / restart (launchd KeepAlive)
4. required health/acceptance verification  -> success declared
5. THEN prune old NORMAL backups (keep 3)   <-- prune is LAST
```

It must **not** be `create → prune → install`, and **not**
`install complete → prune → health check`. The target: do **not reduce rollback
capacity before the new version is proven runnable**.

---

## 13. `PRUNE_FAILURE_SEMANTICS` (Part J)

- If `rm -rf backup-A` succeeds but `rm -rf backup-B` fails:
  - the **deployment still counts as SUCCESS**;
  - the operator/runbook gets a **loud warning / non-silent evidence** (write a
    `prune-failed` line to a run log / meta; decode the failing path);
  - the **next deploy retries** prune.
- **Never** trigger a product rollback because of prune failure.

---

## 14. `ROLLBACK_COMPATIBILITY` (Part K)

- `mv` a backup back to `agent-core` **still works**: sidecar `.backup-meta`
  `.pinned` files inside the backup rename with it and do not block `mv`.
- The backup **directory name** `agent-core.bak-<ts>` stays unchanged, so any
  operator glob suffix logic is preserved.
- Metadata is a **sidecar / in-directory file only**; it does not affect
  `cp`/`mv` restore.
- A pin marker does **not** alter the existing restore copy/mv.
- **Conclusion:** keep the existing backup format, add retention/metadata on top;
  do **not** rewrite the rollback framework.

---

## 15. `EXPECTED_FILES_TO_CHANGE` (Part N — implementation scope, for when approved)

Minimal set (upon approval; **nothing changed this round**):

- `.worktree/production-integration-v1/scripts/trusted-cp-deploy-install.sh`
  (and the live installed copy in the next deploy) → add:
  - write `/.backup-meta` at Step 1 (backup_id, created_at, source_commit=unknown,
    harness_commit, closure_era, deployment_status=predeploy);
  - the post-deploy prune step (after verification success): keep 3 NORMAL +
    pinned, never prune `.pinned`;
  - reuse step: if harness/node reused out of a backup, mark that meta
    `closure_degraded=true` / set `deployment_status` accordingly, and **skip that
    backup from "complete rollback tree" claims**.
- A small helper (optional) e.g. `scripts/agent-core-backup-ops.sh` for
  `--pin-backup <id>` / `--unpin-backup <id>` / `--list-pinned`. If direct
  `touch`/`rm` of the marker suffices, **skip the CLI** (no scope creep).
- No changes to `packages/*`, Router, Runtime, Scheduler, Broker, Kernel.

**Why a separate helper / cannot live inline in the deploy script?**
The pin/unpin/list operations must be callable from a **non-install** context
(before an install to pin the predeploy backup, after a rollback to mark it
`rollback_used`) without re-running a full install. Keeping them in a tiny
sidecar helper (or even just documented `touch` commands) avoids coupling an
operator-only action to a full deploy transaction. The **retention prune** itself
*does* belong in the deploy script (it must run at the correct point of the
deploy lifecycle), which is why prune lives inline and ops-only pin lives in the
helper.

---

## 16. `OPEN_QUESTIONS`

> **Decision closure recap:** items 1–2 below were the two gates that previously
> made this proposal `NEEDS_DECISION`. They are now resolved by operator decision
> (see **§19**):
> - deploy-trigger provenance is **decoupled** from retention semantics (retained
>   as an ops investigation, not a retention blocker) → reworded to item 1a;
> - historical pin set = **NONE** (do not invent a known-good) → item 2 is closed;
>   the first reliable pin is the next pre-deploy backup of the current LKG.
> The remaining items are scope/design refinements for the implementation phase,
> **not** retention-V1 blockers.

1a. **Deploy-trigger provenance** (`DEPLOY_TRIGGER_PROVENANCE = OPEN`): no cron
    evidence was found (root crontab requires a password — not inspectable here);
    the repeated runs look driven by interactive `sudo …run` cycles (per-`run-N`
    git history + per-run acceptance orchestrators). Retained as an **ops
    investigation only** — **not** a gate on retention V1, because retention
    semantics are independent of what triggers a deploy. The one concrete proxy
    investigated this round, concurrent-deploy guarding, is recorded at §19
    (`CONCURRENT_DEPLOY_GUARD = NO`, no lockfile/flock/pid/O_EXCL anywhere in the
    deploy or verify scripts).

2. **[CLOSED — historical pin set]:** per Decision 1, **no historical backup is
    pinned** as known-good (`CURRENT_HISTORICAL_PIN_SET = NONE`). Rationale:
    app-source commit/status is not reliably recorded, several backups lack
    `node-runtime/`, one capture is proven broken (`211201`), and
    `mtime != known-good`. The only current known-good is the active Run-8
    install, which is not yet a backup.

3. **Node-runtime-less backups:** should the retention/known-good logic treat a
    backup lacking `node-runtime/` as "recoverable only with manual node
    re-materialization"? Recommend **yes** (mark `closure_degraded=true`), so
    prune never silently drops the only complete point in favor of a degraded one.
4. **Old-era bundles:** keep `130413`/`130612`/`132129`/`145342`/`180620`/
    `100403` indefinitely as archaeology, or is old-architecture rollback truly
    unsupported? Recommend default **keep** until an operator confirms.
5. **Where should the .backup-meta live** if a backup is ever the target of the
    reuse `mv` (harness/node leave the dir)? The sidecar still belongs to the
    backup; mark it degraded rather than deleting it.

---

## 17. `IMPLEMENTATION_RECOMMENDATION`

Recommended rollout (when the operator approves moving past this investigation):

1. **Ship a pruning metadata + prune step in the deploy script** behind a flag
   (`AGENT_CORE_RETENTION=1`, default ON after a transition), operating strictly
   on the §11/§12 semantics.
2. **Add `.pinned`/`.backup-meta` sidecar support** (tiny `agent-core-backup-ops.sh`
   or direct `touch`).
3. **One-time backfill + operator pin session:** classify the 13 existing backups,
   have the operator pin the confirmed known-good recovery points (recommended
   current-architecture complete set + the most-recent recoverable), then the
   next prune run clears only the non-pinned, non-current/broken bundles.
4. **Wire `deployment_status` updates** at the single post-deploy verification
   and after any manual rollback.
5. **Add a loud prune-failure path** and a next-deploy prune retry.

**Overall: the proposal achieves operational convergence toward
`NORMAL=3 + PINNED>=1` with zero copy-data pinning, no new daemon/service/database,
and no rollback-framework rewrite — it only adds sidecar metadata + a post-verified
prune to the existing deploy script.**

---

## 18. Result Header

```
AGENT_CORE_BACKUP_RETENTION_V1_PROPOSAL = PASS
```
*Decision closure:* the investigation is complete and evidence-backed. Two prior
`NEEDS_DECISION` gates are now resolved by operator decision (see §19):
the historical pin set is **NONE** (do not invent a known-good), and deploy-
trigger provenance is **decoupled** from retention semantics. The current active
install (Run-8 PASS) is the only **current last-known-good**, and it is not yet a
backup — the first reliable pin is the **next pre-deploy backup of that active
closure**. Retention is **implementation-ready**.

> Full decision-closure fields, frozen semantics, and the one newly investigated
> proxy (`CONCURRENT_DEPLOY_GUARD`) are recorded in §19 below. All subsequent
> values in this header are final for the frozen V1 semantics.

```
DELETE_EXECUTED      = NO
CODE_MUTATION        = NONE
RUNTIME_CODE_CHANGE  = NONE
ROUTER_CHANGE        = NONE
PRODUCT_SEMANTICS_CHANGE = NONE
KERNEL_CHANGE        = NONE

FROZEN_BOUNDARIES:
  DEPLOYMENT_OPS_ONLY = YES
```

---

## 19. Decision Closure — final frozen outcome

This section records the **operator decision closure** over the existing
investigation (accepted as fact; no re-investigation of the deployment, no backup
deleted, no deploy script / code / runtime modified). It is the authoritative
final answer for AGENT_CORE_BACKUP_RETENTION_V1.

### 19.1 Decision 1 — historical pin

- **Do NOT invent a pinned known-good historical backup.**
  Rationale (from the live investigation): app source commit/status is not
  reliably recorded for the historical backups; several backups lack
  `node-runtime/`; there is a proven interrupted/broken capture (`211201`); and
  `mtime != known-good`.
- `CURRENT_HISTORICAL_PIN_SET = NONE`.
- The current **active trusted install** (Run-8 complete PASS) is treated as
  `CURRENT_LAST_KNOWN_GOOD = YES` — but it is **not currently a backup**.
- On the **next deployment**, Step 1 `mv`s that active closure into a new
  `agent-core.bak-<ts>`; at that point that backup becomes the **first reliable
  pinned last-known-good**. It is written with **metadata + a pin marker — no data
  copy** (per §8/§10).
- Until that first reliable pinned LKG exists:
  `AUTO_PRUNE_EXISTING_HISTORICAL_BACKUPS = NO`.

### 19.2 Decision 2 — deploy trigger

- Whether today's deploys are schedule-driven is **no longer a retention-V1
  blocker**; retention semantics are **independent of the trigger source**.
- `DEPLOY_TRIGGER_PROVENANCE = OPEN` (retained as an ops investigation; no cron
  evidence was found, but root crontab was not inspectable without a password).
- **Newly investigated:** concurrent-deploy guard.
  - Inspected the live deploy script (`production-integration-v1` variant) and the
    verify scripts for any lockfile, `flock`, pidfile, `O_EXCL`, or `trap`-based
    mutex: **none found**.
  - `CONCURRENT_DEPLOY_GUARD = NO`.
  - If in practice deploys are only ever operator-driven `sudo` single-instance
    runs, this is **`FOLLOW_UP_DEBT`** — recorded, **not** used to build a
    deployment service. No daemon/service is introduced.

### 19.3 Historical inventory disposition (final)

| Backup | Disposition |
|--------|-------------|
| `211201` | **`SAFE_DELETE_CANDIDATE` / `PROVEN_BROKEN`** (empty app/config/home — interrupted capture). |
| `195803` `202649` `204101` `210313` `222634` `224243` | **`PROVISIONALLY_KEEP`** (current-architecture recoverable points). |
| `100403` `130413` `130612` `132129` `145342` `180620` | **`UNKNOWN_KEEP`** (evidence insufficient: older architecture, some lack node-runtime). |

- This round: **`DELETE_EXECUTED = NO`**. Historical cleanup is **not implemented**.
- Nothing historical is auto-pruned before the first reliable pinned LKG exists.

### 19.4 Frozen retention semantics (V1)

```
NORMAL_RETENTION        = 3
PINNED_RETENTION        >= 1

PIN                     = metadata / marker only
PIN_DATA_COPY           = NO

FAILED_DEPLOYMENT_PRUNE           = NO
FAILED_HEALTH_VERIFICATION_PRUNE  = NO
VERIFIED_SUCCESS_PRUNE            = NORMAL_ONLY
PINNED_AUTO_PRUNE                 = NEVER
USED_ROLLBACK_BACKUP              = KEEP

PRUNE_FAILURE = loud warning; does NOT invalidate a healthy deployment
```

### 19.5 Metadata source-commit discipline

- Metadata must describe the **backed-up previous installed closure**, and must
  **not** mis-record a successor / new-deployment commit as the backup's source
  commit.
- If the previous app commit cannot be reliably obtained:
  `source_commit = unknown` — do **not** guess. (Harness commit may be recorded
  from `harness/.source-stamp` when present and reliable.)

### 19.6 Final outcome fields

```
AGENT_CORE_BACKUP_RETENTION_V1_PROPOSAL = PASS

CURRENT_LAST_KNOWN_GOOD            = ACTIVE_RUN8_INSTALL
CURRENT_HISTORICAL_PIN_SET         = NONE
FIRST_RELIABLE_PIN                 = NEXT_PREDEPLOY_BACKUP_OF_CURRENT_LKG
AUTO_PRUNE_LEGACY_BACKUPS_BEFORE_FIRST_PIN = NO

NORMAL_RETENTION    = 3
PINNED_MINIMUM      = 1

CONCURRENT_DEPLOY_GUARD = NO        # inspected: no lock/flock/pid/O_EXCL in deploy/verify scripts
DEPLOY_TRIGGER_PROVENANCE = OPEN    # ops investigation only, not a retention blocker

IMPLEMENTATION_READY = YES

DELETE_EXECUTED      = NO
CODE_MUTATION        = NONE
RUNTIME_CODE_CHANGE  = NONE
ROUTER_CHANGE        = NONE
PRODUCT_SEMANTICS_CHANGE = NONE
KERNEL_CHANGE        = NONE

FROZEN_BOUNDARIES:
  DEPLOYMENT_OPS_ONLY = YES
```
