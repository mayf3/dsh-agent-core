# VISIT_ACTIVATION_DISPATCH_R5_SEAL_FIX_V1 — r4 preflight failure root-caused (agent error), r5 gate ready

GOAL = VISIT_ACTIVATION_DISPATCH_PRODUCTION_V1
Round = docs-only root-cause + mechanical r5 package; zero production mutations this round.

## r4 attempt outcome = FAILED_NO_MUTATION (preflight-only), root cause = agent preparation error

The Owner executed the r4 `--apply` (18:35:49–18:35:50). The runner died in READ-ONLY
preflight at `ADMIN_CREDENTIAL_PREFLIGHT.json` with the node child crashing:

```
Error: Cannot find module '.../visit-canary-01a07001-r4/sealed/native/admin-provision.mjs'
```

Root cause (proven by seal archaeology): re-running the stale 15:46 `prepare-pins.py` over
the hand-frozen r3-era PINS **dropped the `sealedFiles` entry for
`native/admin-provision.mjs`** (that file was created 16:31, after the 15:46 script; the
r3-era PINS had it hand-added — r3's executed seal at `r3/sealed/native/` contains it,
`d13e5a7f…`, byte-identical to the working copy). The r4 seal therefore lacked the module
and the admin preflight child crashed at import, before any journal or production surface
(`r4/admin-output` empty; failure precedes `owner()`/`deploy()`/`broker()`/`canary()`).

Zero-mutation corroboration: live svc still legacy `f0c74ee`/0022; broker at pinned
preimages; fresh read-only DB attestation (18:40) — `principalEnabled=true`,
`domainOwner=true`, `migration23=false`, `schedulerReadEnabled=false`. The passing sibling
step (`CREDENTIAL_PREFLIGHT`, 18:35:50, identical 135-byte success log) used the same NODE
binary / `transport.js` import / authsvc token endpoint, ruling out environment drift.

The Owner's one read-only diagnostic (`sudo cat` failure log + `ls` attempt dir) supplied
the decisive evidence.

## Fix + r5 package (mechanical; independently reviewed)

1. `prepare-pins.py` sealed list restored `'native/admin-provision.mjs'`.
2. PINS regenerated: 11 sealedFiles, `native/admin-provision.mjs` = `d13e5a7f…` (== the
   16:37-executed copy); reviewGate reset to PENDING then re-sealed PASS after review.
3. `native/run_owner.py` (r5, sha256 `4a7f14e6…`) changes ONLY: PRIOR r3→r4, ROOT r4→r5,
   prior assertion = r4-shape `assert_prior_admin_seal_gap_no_mutation` (13-entry dir set;
   STATE phase STARTED + failedStep; executed-wrapper pin `04b539bd…`; failure log must
   contain `Cannot find module` + the r4 seal path; OWNER_BEFORE postgres/postgres @
   maxMigration 22; receipts == {PREFLIGHT_JOURNAL.json}; admin-output == {}).
   Pipeline/deploy/broker/canary/SQL byte-unchanged. `run_owner.before-r5.py.txt` preserves
   the executed r4 wrapper.
4. Tests: `test_policy.py` 11/11 PASS; `test_proxy_recovery.py` 3/3 PASS (r4-shape fixture:
   wrong phases raise; log without MODULE_NOT_FOUND raises; non-empty admin-output raises).
5. Independent READ-ONLY subagent review `native/R5_REVIEW.json`: **VERDICT PASS,
   blockers 0** (also confirmed r5 ROOT does not yet exist; lock/ps-scan/TTY gates intact).
6. `CURRENT_STATE.json` (r4AttemptOutcome + r5Package), `native/README.md` R5 revision
   header, `ONE_OWNER_EXECUTION_PACKET.md` R5 header (command unchanged), `MANIFEST.sha256`
   regenerated (55 files).

## NEXT_EXECUTABLE_ACTION (Owner, unchanged command)

```sh
sudo /usr/bin/python3 /Users/yanfenma/workspace/deployment-artifacts/visit-activation-dispatch-v1/recovery-01a07001/authorized-r2/native/run_owner.py --apply
```

Two native prompts: macOS sudo password, then `Password for user postgres:` (local
PostgreSQL postgres superuser password — the prompt r3 stopped at; r4 never reached it).
Everything after is automatic; the agent reads the sanitized r5 `FINAL_RECEIPT.json` and
continues autonomously. Ctrl+C at the psql prompt = safe no-mutation stop.

OWNER_ACTION_REQUIRED = that single command, nothing else.
