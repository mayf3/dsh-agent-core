# Specifier stage report — dsh-trusted-ingress-align-2 (CORRECTED REPLAY)

Station: specifier (owns `behavior_specification` + `qa_procedure` ONLY)
Worktree: `sixpack-worktrees/dsh-trusted-ingress-align-2__specifier`, branch `sixpack/dsh-trusted-ingress-align-2/specifier`
BASE = `16e14233fbac1ccbdc00598097380da659e1ecd2`; entry Head = `82ea6e1` (end of the superseded replay chain: specifier→coder→cleaner→architect→hardender, no QA commit)
Governing mandate: `OWNER-MANDATE-2026-09-06-ALIGN2-CORRECTED-REPLAY-WINDOW` — FINAL, supersedes all prior replay directives, including the original GOAL work items (1)/(2).

## Route record

```text
GOAL_OR_TARGET = corrected-replay specifier station: own spec artifacts only
CURRENT_GAP = superseded chain conflated ownership (specifier had re-applied the coder test fix and authored QA automation bytes)
AUTHORITY_ACTION = REUSE (PR #177 PRODUCT_TEST_FIX=ACCEPT already decides the behavior)
PLAN_LEVEL = BRIEF   ASSURANCE_LEVEL = DURABLE
SPEC_GAP = NONE (no SPEC_GAP.md needed; nothing invented — every behavior below is decided by BASE product code or accepted review)
```

## What this station did (correction applied)

1. **REVERTED** `packages/agent-router/test/feishu-regression.test.js` to BASE bytes:
   `git restore --source=16e14233... -- <file>`; post-state blob `eabd13b77e0feda3cc6f961409b8272b4ebdeeb3`,
   byte-identical to the frozen-base blob at `797952e7` (verified by `git rev-parse` on both refs).
   The specifier does NOT redo the coder test fix; the coder replay re-applies the accepted alignment.
2. **DELETED** `sixpack-artifacts/qa.automation.json` and `sixpack-artifacts/qa_required_checks.sh`
   (superseded-attempt QA automation). The specifier does NOT fix QA automation. Deleted bytes are
   DIAGNOSTIC_EVIDENCE_ONLY; their recorded rejection cause is the singular `"entrypoint"` key, which the
   runtime gate rejects with "declares no entrypoints" (schema must be `{"entrypoints": ["qa_required_checks.sh"]}`).
3. **WROTE** `sixpack-artifacts/specifier.behavior-spec.md` — deterministic behavior specification:
   6-field frozen `ingressContext` contract with BASE coordinates
   (`packages/agent-router/src/ingress-delivery.js:104-111` construction, `packages/agent-router/src/route-chain.js:353`
   consumption — both verified this session), the exact byte-level test delta the coder must apply
   (6th field `feishuSenderOpenId: 'ou_test'`; decoy `ou_decoy_id` in input text; de-coincided
   `conversationId` `oc_thread_conv:topic_exact`; frozen + no-parse assertions kept), five enumerated
   failure cases, and recorded acceptance criteria.
4. **WROTE** `sixpack-artifacts/specifier.qa-procedure.md` — human-readable QA procedure (NO executable
   automation bytes, which belong to QA): plural-key manifest schema + verbatim canonical check names,
   fail-closed script requirements (`set -euo pipefail`, test-failure propagation, mechanical scope from
   `git diff --name-only BASE..HEAD`, governed NOT_APPLICABLE for test-only scope, no working-tree-cleanliness
   verdicts, `SIX_PACK_NODE_PATH`/PATH node resolution, set-equality + exec-bit manifest assertions,
   no `/tmp/node*` literals), the five negative probes (outputs INSIDE the worktree), and the final-QA
   protocol (automation committed before final QA; fresh final QA on unchanged certified head;
   QA_FINAL_JSON binding line).

## What was checked (fresh observations, this session, node v26.7.0)

1. Blob identity: test file at BASE `16e1423` == at frozen base `797952e7` == `eabd13b7...` (task-record premise confirmed).
2. Bounded-impact recheck re-run: `git diff --name-only BASE..origin/main` — local origin/main has moved
   beyond the task record's snapshot (docs/, broker/, product-api/, production-runtime/ files), but the
   load-bearing premise HOLDS: **`packages/agent-router` has zero files in base..main**, and the target test
   file is byte-identical to frozen base. Unrelated base movement is not candidate-Head drift.
3. Product contract presence at BASE: verified lines cited above — the alignment is a pure test-side fix; zero product change required or authorized.
4. Reverted-state gap evidence: `node --test packages/agent-router/test/feishu-regression.test.js` → exit 1, **9 tests / 8 pass / 1 fail**, failing test = `TRUSTED_INGRESS: exact Feishu chat/conversation/message fields reach the routed turn without parsing` (strict deepEqual, stale 5-field expectation vs 6-field implementation).
5. Full agent-router baseline at reverted state: 310 tests / 308 pass / 1 fail (the same TRUSTED_INGRESS test) / 1 skipped (pre-existing) / exit 1. Post-coder expectation: 309 pass / 0 fail / 1 skip.
6. Product-tree sweep vs BASE (`packages/agent-router/src`, `docs/`, `package.json`, `.github/`): 0 files changed by this station.
7. Station-mandate pre-handoff state: exactly `M` test file (revert) + 2 `D` QA files + 3 new/updated `sixpack-artifacts/` specifier files. No commit/push performed (delivery helper commits).

## Deliverables (impact set)

- `packages/agent-router/test/feishu-regression.test.js` — reverted to BASE bytes (ownership correction).
- `sixpack-artifacts/qa.automation.json` — DELETED (QA re-authors per corrected mandate).
- `sixpack-artifacts/qa_required_checks.sh` — DELETED (QA re-authors per corrected mandate).
- `sixpack-artifacts/specifier.behavior-spec.md` — NEW (behavior specification).
- `sixpack-artifacts/specifier.qa-procedure.md` — NEW (QA procedure specification).
- `sixpack-artifacts/specifier.report.md` — this report (overwrites the superseded attempt's report, whose "What was changed" described ownership the corrected mandate reassigns).

## Limitations

- All executions are on the uncommitted specifier worktree; the delivery helper commits. Downstream replays start from the committed corrected-specifier Head; old receipts downstream of that Head are NOT reusable (per mandate).
- The task record's DONE_WHEN cites "agent-router full suite 240 tests"; the same-suite measurement on this BASE is 310 tests. Recorded actuals govern; the discrepancy is pre-existing and content-independent of this task.
- Directory-form `node --test packages/agent-router/test/` remains broken on some Node builds (pre-existing, documented in PR #177); per-file/glob invocation is canonical.
- `send_notification` MCP is not in this station's toolset; pipeline notification is left to the delivery helper.
- Local governance context (`.agents/README.md`, `.agents/local/README.md`, spec-governance router) was read; mode = PREFLIGHT-grade reuse record above. Per pragmatic station scoping, the plan/TODO/validation layout required by the operator's global workflow is folded into this report and the two spec files instead of extra root-level files, keeping the tree within the station's declared impact set.
