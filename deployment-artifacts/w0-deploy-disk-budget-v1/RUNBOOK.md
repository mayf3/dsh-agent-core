# W0 RELEASE-SAFETY deploy disk-budget v1 — RUNBOOK (production acceptance packet)

STATUS: PREPARED / WAITING_PROD_AUTH. Every command below is an OPERATOR
command for an AUTHORIZED production deploy window. Nothing here has been
executed. This packet changes NO runtime behavior; it gates the existing
deploy.

## 0. Preconditions (operator, before the deploy window)

```
sudo /usr/local/libexec/agent-core/app/scripts/agent-core-backup-ops.sh \
  /usr/local/libexec/agent-core --list          # census: what is retained today
sudo cat /usr/local/libexec/agent-core-deploy-budget-receipt.json 2>/dev/null || true
df -k /usr/local/libexec                        # free space sanity
```

## 1. Deploy (the gate runs inside it, before any mutation)

```
sudo ./scripts/trusted-cp-deploy-install.sh <REPO_SRC> <HARNESS_SRC> [MAIN_REPO]
```

- The section-0c gate runs BEFORE the section-1 full-root preimage `mv`.
- ADMITTED → install proceeds exactly as before (behavior unchanged).
- REFUSED (exit 2) → **NOTHING was mutated**; read the receipt:

```
sudo cat /usr/local/libexec/agent-core-deploy-budget-receipt.json
```

  - `verdict: REFUSED_DISK_BUDGET` (exit 4): free space after the projected
    reservation would fall below max(60 GiB, 10% Data volume). HARD — free
    disk or enlarge the volume; no exception path exists.
  - `verdict: REFUSED_RETENTION_CAP` (exit 5): creating this preimage would
    exceed live + 1 pinned known-good + 1 newest immediate-rollback preimage
    (≥20 GiB class). The receipt names the EXACT eligible cleanup paths.
    DRAIN_REFUSED-style refusal is the gate working; a refused deploy never
    mutates.

## 2. Retention-cap escape hatches (operator, exact paths only)

```
# remove ONE named superseded unpinned preimage (receipt: agent-core-cleanup-exact-receipt.json)
sudo /usr/local/libexec/agent-core/app/scripts/agent-core-backup-ops.sh \
  /usr/local/libexec/agent-core --cleanup-exact \
  /usr/local/libexec/agent-core.bak-<EXACT-TIMESTAMP>

# then re-run the deploy; the gate re-admits when the cap is satisfied
```

Refusals you WILL see and must respect: pinned backups ("--unpin first if
this pin is genuinely obsolete"), legacy backups (separate operator task per
AGENT_CORE_BACKUP_RETENTION_V1), rollback_used and unknown-status (KEEP).

Open-Product pin exception (only for a documented open Product that justifies
keeping a third ≥20 GiB backup):

```
sudo AGENT_CORE_BUDGET_PIN_EXCEPTION="Product #<id> open: <why the extra preimage is required>" \
  ./scripts/trusted-cp-deploy-install.sh <REPO_SRC> <HARNESS_SRC> [MAIN_REPO]
```

The reason lands verbatim in the receipt (`pin_exception_*`). sudo strips env
by default — pass it inline as shown (same mechanism as
AGENT_CORE_VERIFIED_PREDECESSOR_LKG).

## 3. Post-deploy (unchanged duties)

- Verified-success prune stays post-verification-only:
  `sudo …/agent-core-backup-ops.sh /usr/local/libexec/agent-core --prune --verified-success`
  (keeps newest 3 NORMAL; pinned/rollback_used/legacy never touched).
- NOTE: prune may retain up to 3 NORMAL backups; the pre-deploy cap admits
  only 1 unpinned + 1 pinned ≥20 GiB. The NEXT deploy will therefore refuse
  until the superseded ones are cleaned by exact path (§2). This friction is
  the cap working as designed.
- First deploy after a verified LKG: assert
  `AGENT_CORE_VERIFIED_PREDECESSOR_LKG=YES` exactly as before (#414 seam
  preserved; the backup now additionally records pin_reason).

## 4. Verification checklist for the authorized window (V1–V7)

1. Pre-deploy: `--list` census recorded.
2. Gate receipt exists after the deploy attempt (admit OR refuse) with all
   required fields.
3. On refusal: `ls /usr/local/libexec` shows NO new `.bak-*`, live install
   untouched (`sudo ls /usr/local/libexec/agent-core` intact), services
   untouched (the deploy never reached any restart step).
4. On admit: install proceeds; new preimage appears exactly once with the
   projected name; receipt `retained_backups_after_projected` matches
   `--list` reality.
5. Rollback path unchanged: `sudo rm -rf /usr/local/libexec/agent-core &&
   sudo mv <BAK> /usr/local/libexec/agent-core` (operator-executed, exact
   paths, only on a failed deploy) + RESTORE-R2 watchdog re-pin per §8.
6. No wildcard cleanup was executed at any point.
7. Receipt + census evidence archived into this packet's evidence dir.

## 5. Stop conditions

- Any refusal whose receipt shows floor_source/size_class_source = env-override
  that YOU did not set: STOP, investigate before proceeding.
- Disk free below the floor after any manual cleanup: STOP (do not deploy).
- Any need to delete a PINNED or LEGACY backup: STOP — outside this packet;
  separate owner-authorized task per AGENT_CORE_BACKUP_RETENTION_V1.
