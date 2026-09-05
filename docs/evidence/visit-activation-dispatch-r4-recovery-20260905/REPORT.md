# VISIT_ACTIVATION_DISPATCH_R4_RECOVERY_V1 — Outcome Reconciliation + r4 Owner Gate

GOAL = VISIT_ACTIVATION_DISPATCH_PRODUCTION_V1
GOAL_MODE = RESUME_GOAL_FROM_DURABLE_HANDOFF (agent replaced mid-goal; zero conversational context)
Round = docs-only reconciliation + mechanical r4 package; zero production mutations this round.

## TRANSACTION_STATE = FAILED_NO_MUTATION

Handoff said a production transaction MAY have started (previous agent launched the formal
package via sudo in a native Terminal before handoff). Reconciliation of durable receipts
against live production truth:

1. r3 attempt executed 16:37:36–16:37:50 local (root session ttys003, 14 s total):
   - `/usr/local/libexec/agent-core/config/visit-canary-01a07001-r3/FINAL_RECEIPT.json`
     (0644, agent-readable by design): `status=OWNER_OUTCOME_UNKNOWN_STOP_NO_REPLAY`,
     `failureType=RuntimeError`, `automaticRetry=FORBIDDEN`.
   - Progress reconstructed by stat over the 0711 root dir: preflight complete
     (CATALOG/ATTESTATION/CREDENTIAL/ADMIN_CREDENTIAL preflight receipts 16:37:37),
     `OWNER_PSQL_STDOUT.log` created 16:37:37 (psql spawned),
     `OWNER_AFTER.json` written 16:37:50 (post-psql read-only DB observation SUCCEEDED).
2. Root cause: sudo succeeded; the interactive `psql -W` **postgres password was never
   entered**; psql exited non-zero within the 14 s window → runner's designed
   uncertain-outcome stop. No deploy/broker/canary step was reached.
3. No-mutation proof (three independent legs):
   - `OWNER_AFTER.json` (written AFTER psql exited) is byte-size identical to
     `OWNER_BEFORE.json` (927 == 927): the only length-variable fields are the two
     `ownerPair[].owner` strings, so both still read `postgres`;
   - `owner-correction.sql` is ONE `BEGIN..COMMIT` transaction with all guard assertions
     inside — partial commit is structurally impossible;
   - live truth: svc-workflow `:8989/version` still legacy `f0c74ee` / schemaVersion 0022,
     healthz ok, readyz ready; runtime `:8790/health` ok/deliverReady/storeReady; both live
     broker capability files hash-match PINS `beforeSha256`
     (`53286178…` / `b16ab691…`).
4. Chain of custody: working wrapper == R3 frozen review hash == r3 actually-executed seal
   copy (`d3888cc2…`); all seven sealed source files byte-match working copies.
5. No runner/psql/sudo process survives; `PRODUCTION_MUTATION_CONCURRENCY=1` lane is free.

The runner label was OWNER_OUTCOME_UNKNOWN (correct at raise time); the receipts plus
production truth narrow it to FAILED_NO_MUTATION, so per the no-replay rule the SAME GOAL
continues from the exact failed step (owner psql authentication), not a redesign.

## r4 package (mechanical; independently reviewed)

r3's attempt directory forbids rerun by design (`ROOT.mkdir` without exist_ok), so the
established r2→r3 precedent was followed: prior attempt preserved, wrapper mechanically
re-targeted.

- `native/run_owner.before-r4.py.txt` preserves the r3 executed wrapper (`d3888cc2…`).
- `native/run_owner.py` (r4, sha256 `04b539bd…`) changes ONLY: PRIOR r2→r3, ROOT r3→r4,
  and the prior-attempt assertion, now `assert_prior_owner_unknown_no_mutation`: r3 dir
  exact 15-entry shape; STATE/FINAL_RECEIPT phase `OWNER_OUTCOME_UNKNOWN_STOP_NO_REPLAY`;
 executed-wrapper hash pin `d3888cc2…`; BOTH owner snapshots postgres/postgres at
  maxMigration 22 with equal oids (i.e. a real mutation mechanically forbids the new
  attempt); receipts/admin-output journal shapes. Pipeline/deploy/broker/canary logic
  byte-unchanged.
- Tests: `test_policy.py` 11/11 PASS; `test_proxy_recovery.py` 3/3 PASS (fixture updated to
  the r3 shape, including "mutated OWNER_AFTER ⇒ rerun forbidden").
- `prepare-pins.py` re-run (PINS re-hash; all sealedFiles/brokerFiles/releases verified);
  independent READ-ONLY subagent review `native/R4_REVIEW.json`: **VERDICT PASS,
  blockers 0** (non-root limits recorded honestly; each is re-verified mechanically by the
  wrapper itself as root at apply time); `PINS.reviewGate` sealed to `PASS`.
- `CURRENT_STATE.json` updated (r3AttemptOutcome + r4Package); `native/README.md` revision
  header; `MANIFEST.sha256` regenerated (53 files).

## NEXT_EXECUTABLE_ACTION

ONE Owner native action (only when Owner can stay for two prompts, ~3-5 min):

```sh
sudo /usr/bin/python3 /Users/yanfenma/workspace/deployment-artifacts/visit-activation-dispatch-v1/recovery-01a07001/authorized-r2/native/run_owner.py --apply
```

Prompt 1: macOS sudo password. Prompt 2: `Password for user postgres:` — the local
PostgreSQL `postgres` superuser password (this is the prompt that went unanswered in r3).
Everything after the two prompts is automatic; the agent then reads the sanitized r4
`FINAL_RECEIPT.json` and continues post-deploy verification autonomously. Ctrl+C at the
psql prompt is a safe no-mutation stop.

OWNER_ACTION_REQUIRED = that single command, nothing else.

## Identity standing (per handoff, applied everywhere)

BUSINESS_ACTOR = `dc702687-6515-4a2a-91ae-e572a9bbd766` (agt_hr-agent) — receives
GLOBAL_SCHEDULER_READ and runs canary reads.
PROVISIONING_ACTOR = `bc970ced-710f-4479-9ff0-e295a1c59424` — legacy admin identity,
performs only the one bounded provisioning transaction via its existing root-protected
wf-admin credential (client `mc_FdRIJ5THMv1V4tGAC3PPqL83`, natively verified, no new
client/grant).
