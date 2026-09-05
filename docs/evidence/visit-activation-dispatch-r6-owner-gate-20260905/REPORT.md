# VISIT_ACTIVATION_DISPATCH_R6_OWNER_GATE_V1 — r5 proved the seal fix; r6 gate ready; only the interactive postgres password remains

GOAL = VISIT_ACTIVATION_DISPATCH_PRODUCTION_V1
Round = docs-only; zero production mutations (three attempts, three clean stops).

## r5 attempt outcome (20:16:17–20:16:29) = FAILED_NO_MUTATION — and the r4 fix is PROVEN

The Owner's r5 `--apply` ran the complete preflight successfully, including the previously
broken admin-credential step (ADMIN_CREDENTIAL_PREFLIGHT success; the r5 seal contained
`native/admin-provision.mjs` `d13e5a7f…`). The run then reached the owner step, spawned
`psql -W` as postgres (20:16:18), and ended at 20:16:29 with receipt
`OWNER_OUTCOME_UNKNOWN_STOP_NO_REPLAY`. Zero mutation again proven: `OWNER_AFTER.json`
(927 B) == `OWNER_BEFORE.json` (927 B) ⇒ ownerPair still postgres/postgres; single guarded
`BEGIN..COMMIT` ⇒ no partial-commit surface; live svc still legacy `f0c74ee`/0022, healthz
ok. The postgres password was not successfully entered (second occurrence, after r3).

Also observed: a second concurrent invocation at ~20:16 crashed instantly and harmlessly at
`ROOT.mkdir` (FileExistsError) — the traceback the Owner reported. Attempt directories are
append-only by design; r5 is consumed.

## r6 package (mechanical; independently reviewed)

- `native/run_owner.before-r6.py.txt` preserves the executed r5 wrapper (`4a7f14e6…`).
- `native/run_owner.py` (r6, sha256 `80c67ee8…`) changes ONLY: PRIOR r4→r5, ROOT r5→r6, and
  the prior assertion → owner-unknown no-mutation shape pinned to r5 (exact 15-entry dir
  set; STATE/FINAL_RECEIPT phase `OWNER_OUTCOME_UNKNOWN_STOP_NO_REPLAY`; executed-wrapper
  pin `4a7f14e6…`; BOTH owner snapshots postgres/postgres @ maxMigration 22 with equal
  oids — a real mutation mechanically forbids the new attempt; receipts/admin-output
  journal shapes). Pipeline/deploy/broker/canary/SQL byte-unchanged.
- Tests: `test_policy.py` 11/11 PASS; `test_proxy_recovery.py` 3/3 PASS (owner-unknown
  fixture, sealed prior wrapper = before-r6 bytes).
- Independent READ-ONLY subagent review `native/R6_REVIEW.json`: **VERDICT PASS,
  blockers 0** (confirmed r6 ROOT absent; lock/ps-scan/TTY/fresh-preimage gates intact).
- `PINS.reviewGate` sealed PASS. `CURRENT_STATE.json` (r5AttemptOutcome + r6Package),
  `native/README.md` R6 header, `ONE_OWNER_EXECUTION_PACKET.md` r6 (command unchanged,
  optional `--check` dry-run documented, explicit two-prompt guidance), `MANIFEST.sha256`
  refreshed (57 files).

## NEXT_EXECUTABLE_ACTION (Owner, same command)

Optional dry-run (sudo password only, read-only, does not consume the attempt slot):
`sudo …/native/run_owner.py --check`

The real action — run ONCE, in ONE terminal, stay for both prompts:

```sh
sudo /usr/bin/python3 /Users/yanfenma/workspace/deployment-artifacts/visit-activation-dispatch-v1/recovery-01a07001/authorized-r2/native/run_owner.py --apply
```

Prompt 1 `[sudo] password:` — macOS login password. Prompt 2
`Password for user postgres:` — the local PostgreSQL postgres superuser password; type it
and press Return. It appears right after `PREFLIGHT_PASS_NO_PRODUCTION_MUTATION` /
`OWNER_ATTEMPTING` lines. No password at hand ⇒ **Ctrl+C immediately** (safe no-mutation
stop), do not press bare Return. The agent then reads the sanitized r6 FINAL_RECEIPT.json
and continues autonomously.

OWNER_ACTION_REQUIRED = that single command, nothing else.
