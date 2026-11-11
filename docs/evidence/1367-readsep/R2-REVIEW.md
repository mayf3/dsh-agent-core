# Independent R2 affected-contract and stop review

Reviewer: `/root/authority_review`; independent from semantic author. Read-only inspection; no edits and no test execution by reviewer. Review binds base/HEAD `2d8ce9d0af6a1ffcb3c8d3bdd9364635e9ae8648` plus the source hashes below and `R2-product.diff`.

Initial affected-contract review: PASS; `FROZEN_BLOCKER_UNION=[]`, `SPEC_GAPS=0`. Scope: five changed tracked files plus diagnostic-read.test.js. Accepted WEC V3 CTR-WEC1-002/003 and section 4 require true read-only projection; WAE V3 retains mutation fresh replay/CAS. Diagnostic readers use inspectFresh/load without repair. Mutation FIFO/OwnerLock/load({repairTornTail:true}), identity/generation/phase CAS and later recovery/readback/correlation exclusion intervals remain unchanged. Candidate conditional refresh covers Owner continuation, ACTIVE-to-terminal, stale-to-fast transitions. Current-read metadata does not stick to later healthy reads. Shutdown test changes only its intercept hook; all assertions remain.

Reviewer independently matched R2 RED 9/3/6 (all six are intended assertions; no fixture TypeError), GREEN 11/11 and all five hashes in R2-GREEN.json, plus shutdown test hash. Focused evidence passes; this was not complete delivery acceptance.

After the required integration gate failed, independent read-only triage confirmed 29 tests/25 pass/4 fail/0 skip. Four composition shutdown cases all throw HTTP_PROXY:runtime_proxy_env_present at compose.js:94 -> compose.js:144 before mount; those four target assertions never run. Other 25 tests ran. R2-broker artifacts do not exist. Existing compose gate also pins Node v25.6.1 while this run used v26.7.0; removing proxies alone has not been shown sufficient.

```text
schema_version = 2
FINDING = REQUIRED_GATE_FAILURE
SOURCE = Owner failure-stop mandate and required integration-suite rc0
COUNTEREXAMPLE = four composition shutdown cases abort at inherited HTTP_PROXY preflight
IMPACT = integration gate unmet; affected runtime behavior unverified; delivery cannot proceed
MINIMAL_CLOSURE = subsequent authorized continuation uses isolated test environment satisfying existing proxy and exact Node gates, reruns integration, then remaining broker/structure gates
FROZEN_BLOCKER_UNION = [R2_INTEGRATION_ENV_REQUIRED_GATE_FAILURE]
affected_readiness = IMPLEMENTATION_ALLOWED, PR_DELIVERY_READY
IMPLEMENTATION_ALLOWED = NO
PR_DELIVERY_READY = NO
MERGE_READY = NOT_APPLICABLE (forbidden)
OPERATION_ALLOWED = NO
NEXT_ACTION = STOP
```

This persistent record transcribes the independent review messages; the parent saved it after the reviewer returned its findings.

## Bound file SHA-256

- `packages/workflow-execution/src/ledger.js`: `7999048f35828027660b580763dd8b42a48b644dc01366f9fe6cfb0e903ed2a2`
- `packages/workflow-execution/src/engine.js`: `d9dfaf86dd5b52d351f4bdf44b971f68a89be8f86c5586c71fbd59dda63a7dd4`
- `packages/workflow-execution/src/terminal-attempt-operations.js`: `bd748f9a7a099ab68223ee1d9bb7888c5843c3e9608ce2768dab849aeaec1cb5`
- `packages/production-runtime/src/workflow/capability-runtime.js`: `a0c71765c4c863d68b21dd66bccf83a4a328869206a16adbbedd06033ee26e51`
- `packages/workflow-execution/test/shutdown-contract.test.js`: `0213313107d4fc54d04b715a02188565df6d358ae22e81961875660c31c28f49`
- `packages/workflow-execution/test/observation-cas/diagnostic-read.test.js`: `4b29cb5577be6f836becb6ad016216e5d4c189051146368fd6554fbb7f216580`

Product diff SHA-256: `7184d5194c6ed379edb42f2625e6cc0ffbe628bd7bc58e916b204ae3af576248`. Integration raw SHA-256: `fc16bd94076991110df74545aabe2aa5fd8550496c635a98ee417463c99e8a67`.

Final receipt fact recheck by the same independent reviewer: PASS. Receipt SHA-256 `b2aba2892938f861f3bcee3a880c192aae0e1dddd45405a55e47565c75970369`; all checkpoint evidence/source hashes matched, zero drift. The diff includes the complete 168-line new test. Reversing only the identity import and three call-site identity spreads in the archived R2 RED test reconstructs R1's recorded test SHA-256 `73224d79e446d156fde159312c22df3b4cc659a82e24df099627725e32bef2e4`, independently confirming unchanged original product assertions. HEAD and current failure-stop readiness remain unchanged. No tests were rerun and the reviewer wrote no files.
