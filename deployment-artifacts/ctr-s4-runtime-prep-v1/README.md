# CTR-S4 source delivery packet

PR base: `main`; deployment target line: `ac1159-deploy`. This packet prepares
the existing full-app release path. Installation, runtime reload and activation
belong to the regulator's authorized deployment window; none is executed here.

## Authority and included changes

The D-009 amendment is **ACCEPTED**, quoting mayf3 Owner's supplied 2026-11-02
ruling: **“termination-only 证据判 failed，修订 D-009”**. The amendment and its
implementation must enter the same implementation base. The date is the supplied
ruling date, distinct from the actual execution timestamps in the receipts.

Source provenance is `825664850abce61e821eb505063241341d419907`; `2d28545b` was
the earlier Spec-only commit. The port retains the reviewed repairs: missing
registry evidence stays UNKNOWN; exact Router identity/current epoch is required;
mutation uses Scheduler's existing lock and receipts; recurring termination-only
policy `failed` retains business UNKNOWN and never fabricates executionOutcome;
no replay, retry or catch-up; future natural slots only. One-shot jobs remain
outside this automatic policy. Runtime stop rejects new work and drains admitted
commits/audit writes before Router disposal.

`source-files.json` pins the affected app files and directly imported local
dependencies. It is an inventory, not a standalone overlay. The ordinary
`scripts/trusted-cp-deploy-install.sh` copies each package's `package.json` and
`src/**` through its existing package-copy helper, including the policy, batch,
decoder, eligibility and runtime mount. Its shared `APP_SCRIPTS_WHITELIST` now
includes `scheduler-watchdog.mjs` in both prescan and copy loops.

Use the full-app release path with its existing Node/DSH/dependency closures.
The legacy 23-path `WATCHDOG_OVERLAY_PATHS` does not contain the CTR-S4 mount or
policy/batch and cannot deliver this change. Its two unrelated baseline digest
drifts remain recorded; the one reviewed occurrence decoder pin is refreshed.

## Offline artifacts and verification

The final local delivery directory contains:

- `ctr-s4-source.bundle`: Git source/history for an isolated clone;
- `ctr-s4-source.tar.gz`: the same exact committed tree without Git metadata;
- `manifest.json`: exact final HEAD/tree, branch, base/target, artifact SHA-256
  and sizes, source-file hashes and verification coordinates;
- `README.md`, `source-files.json`, and `SHA256SUMS`.

These are source inputs and receipts. They do not contain a newly installed
Node/DSH closure or runtime credentials. The packet path and actual hashes are
published in PR #603 and #417 after creation; no hash is invented in advance.

Verify `shasum -a 256 -c SHA256SUMS`, then `git bundle verify
ctr-s4-source.bundle` from a Git repository. Clone the bundle into an isolated
release worktree; compare its HEAD and tree with `manifest.json`, and require a
clean status. A tar extraction alone is not a Git pack source. Reproduce the
installer's read-only source gate from that clean clone:

```sh
env EXPECTED_SOURCE_SHA="$CTR_S4_HEAD" EXPECTED_SOURCE_TREE="$CTR_S4_TREE" \
  bash "$CTR_S4_SOURCE/scripts/trusted-cp-deploy-install.sh" \
  --validate-source "$CTR_S4_SOURCE"
```

Set those three task-specific variables to the verified manifest coordinates and
isolated clone path. This command validates source provenance only. Integration
onto `ac1159-deploy` changes the HEAD/tree: rebind the manifest and affected
review to the integrated candidate before the regulator uses the existing
full-app installer. PR #603's known conflict with current main is still an
integration task; this packet does not claim merge readiness.

## Enable (regulator only)

1. Complete integration/review and the existing full-app release admission,
   preimage, single-writer and rollback gates for the exact target. Deliver code
   with `AGENT_CORE_FENCE_AUTO_RECONCILE` absent: the default is OFF, with no
   auto-reconcile timer or store pass.
2. In the **actual supervised Runtime unit's** `EnvironmentVariables`, set
   `AGENT_CORE_FENCE_AUTO_RECONCILE=on` (exact lowercase `on`). Preserve the other
   unit settings and record its preimage. Equivalent direct-process env is
   `env AGENT_CORE_FENCE_AUTO_RECONCILE=on <approved-runtime-command>`. Merely
   exporting it in the installer shell is insufficient: the existing
   `production-runtime-launchd.mjs` pass-through list does not forward this key.
   Use the regulator's existing configuration path for the actual unit; do not
   replace a production system unit with the helper's default GUI unit.
3. Apply that env through the regulator's existing authorized runtime reload.
   Read back the new process's actual env and
   `fence-auto-reconcile: ENABLED — intervalMs=900000`. The default period is
   15 minutes and there is no immediate startup pass. No manual tick or old
   occurrence replay is part of activation.
4. Take the authorized bounded canary/readback: exact policy receipt with
   business UNKNOWN retained, other same-Job unknown contributions still fenced,
   no retry/catch-up, then the next strictly future natural slot. Logs, health
   and offline tests alone do not establish business acceptance.

## Disable / rollback (regulator only)

Remove `AGENT_CORE_FENCE_AUTO_RECONCILE` from the same actual Runtime env (or set
it to any value other than `on`), then apply that env with the existing authorized
reload. Runtime shutdown stops/drains this loop before Router disposal; read back
the replacement process's missing flag and the `DISABLED` startup message. The
new process creates no auto-reconcile timer. An external shell `unset` or editing
a plist cannot change the env of an already-running Node process.

Within an existing process, configured() is checked at every tick and again
inside locked evidence revalidation: once its actual env is off, subsequent and
queued settlement work is rejected. An already-admitted commit may finish and
its receipt is drained. Removing the flag disables future auto-settlement; it
does not erase committed evidence or undo a past settlement. Preserve the
V3/UNKNOWN-aware decoder and retained receipts after a policy settlement; do not
roll back to a reader that rejects those records. No raw fence/store edit or
stopgap retirement is required.

## Evidence and remaining boundaries

The final continuation of
[`CTR_S4_PREPARATION_R2.md`](../../docs/reports/CTR_S4_PREPARATION_R2.md)
records current commands/results and retained historical evidence. Exactly 11
unchanged task-base directory structure debts remain; the snapshot file's
approved registry entry closes the later file violation. The broader runtime
suite's 26 baseline failures remain separate from focused wiring acceptance.
No deployment, restart, production write, flag enable, shared-checkout edit or
PR merge is claimed. #417 remains open for installed/enabled/business acceptance.
