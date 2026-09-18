# Independent Production Safety Review — freeze packet v1 (2026-09-18)

Reviewer: independent agent, fresh context. Scope: FREEZE.md + repo at 41f354d.

```text
DEPLOYMENT_PREFLIGHT=PASS
ARTIFACT_SOURCE_BINDING=PASS
WHOLE_MAIN_SCOPE_REVIEW=PASS
ROLLBACK_COMPLETENESS=PASS_WITH_GAPS
MECHANICAL_REVIEW=PASS
PRODUCTION_SAFETY_REVIEW=PASS
BLOCKERS=NONE
```

Verified mechanically: coordinates (41f354d; d602b592; 62905c1 on-disk basis), scheduler-only
production delta (14 files, all packages/scheduler), artifact tar sha256 7286078…2db2, all 7
key-file hashes byte-equal to git show 41f354d:<path>, scheduler 372/372 + broker 477/477 at
candidate, store rollback-compat (store.js delta is exactly the readRunEvents limit:null
addition; old code parses evidence lines generically with no action validation; _validateDocument
covers only the v3 document), spec conformance (accepted spec, production_apply_authority none,
deploy gated), packet performs no production mutation.

GAPS_FOR_RUNBOOK (must be folded into the authorized deploy runbook — none block the freeze):
1. node_modules: artifact is a source archive; effective on-disk upgrade is 62905c1-era -> 41f354d;
   root package.json gained @deepseek-ai/dsh-session(+persistence-jsonl) 0.1.0-rc.8 in that window
   (zero manifest delta d602b592..41f354d; scheduler deps unchanged: croner ^10.0.1). Runbook must
   state the node_modules refresh procedure pre-restart, module-resolution verification, and that
   RB1's full-tree restore brings back the old node_modules bytes.
2. Capture in the preimage — or explicitly declare DO-NOT-TOUCH: harness root
   /usr/local/libexec/agent-core/harness, W1/W2 watchdog code copies + their LaunchDaemon plists,
   spawn helper, scheduler-routing manifest.
3. Credentials: declare never-copied/never-overwritten; exclude from preimage dirs.
4. RB1 wording: rsync --delete from the P1 PREIMAGE dir (not the artifact export).
5. R-1: Owner attribution of the 06:44 app-tree write+restart is a hard authorization precondition
   (slot=FREE only after attribution).
6. RB5 add readback smoke: OLD code reading runs.jsonl after NEW-code evidence lines were appended
   (tolerance proven by review; verify once on the rollback path).
7. Runbook restates explicitly: DO_NOT_REENABLE_HR_RETRY_AUTO until postdeploy verification PASS.
