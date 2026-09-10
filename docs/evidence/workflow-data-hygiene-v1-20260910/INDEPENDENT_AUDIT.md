# WORKFLOW_DATA_HYGIENE_V1 / WORKFLOW_COORDINATOR_CONTROL_PLANE_V1 — INDEPENDENT_AUDIT r1

<!-- HISTORICAL_R2_CENSUS_RECORD_ONLY / NON_EXECUTABLE / SUPERSEDED_BY_R3 — this r1 audit verdict is superseded by the convergence audit rounds and the FINAL exact-head audit (INDEPENDENT_AUDIT_FINAL.md). Do not consume any mutation wording herein. -->

- **Audited heads**: `cfc1762` (census freeze) → `2cf55b7` (r2 LEDGER_METRIC_SEMANTICS + AUTHORITY_MAP M1–M6 + CLEANUP_PLAN exact set). Inputs: `CLASSIFICATION_LEDGER.md` r2, `CLEANUP_PLAN.md` r1 (FROZEN for audit), `census-raw/*` (sha256 manifest), builder `build-classification-ledger.mjs`.
- **Audit mode**: mechanical, read-only, zero production access. Reproducibility: builder re-run over `census-raw/` reproduces byte-identical outputs (sha256 stable across runs).
- **Verdict: PASS — 10/10 checks, 0 blockers.**

| # | Check | Verdict | Evidence |
|---|---|---|---|
| A1 | exclusive business classes sum == 338 (REAL_BUSINESS 217 + HUMAN_REQUIRED 77 + TEST_OR_FIXTURE 38 + STALE_UNIQUE 6 + STALE_UNRESOLVED 0) | PASS | instance-classification.tsv (338 rows) |
| A2 | lifecycle dimension orthogonal, sum == 338 (TERMINAL 273 + NON_TERMINAL_CURRENT 61 + NON_TERMINAL_DANGLING 4) | PASS | same |
| A3 | every M1 write-set row (12) is TEST_OR_FIXTURE ∧ non-terminal ∧ not quarantined | PASS | n=12, no violations |
| A4 | Owner-confirmed Batch A canaries (9fd262ec / 5538dca9 / 5fe7570a) ⊆ M1 | PASS | exact match |
| A5 | three Owner dispositions NOT in write-set (cebf4816 / 5709a28e / 085b41f2) | PASS | absent from every mutation table |
| A6 | disposition semantics in ledger rows: cebf4816 quarantined=true; 5709a28e dispatch_eligible=false (WAE-V2 owns recovery); 085b41f2 REAL_BUSINESS dispatch_eligible=true (normal production, untouched) | PASS | ledger rows |
| A7 | §M6 declares exactly 9 owner-binding repairs, preimages frozen in binding-rows-for-plan.tsv | PASS | n=9 |
| A8 | §M2A test-definition archive count = 2 as declared | PASS | plan text |
| A9 | zero REAL_BUSINESS instance ids appear as mutation targets anywhere in the plan | PASS | full-plan UUID scan |
| A10 | execution precondition recorded (AUTH_V1_CANARY_WRITE_ENABLED write gate) + §5 sequencing gate (this document authorizes NO execution) | PASS | plan header/§M1 |

## Authority map (frozen understanding, cross-goal)

- **M1 test-instance cancels (12)**: executor `agt_hr-agent` (dc702687) as DOMAIN_OWNER of each domain **after §M6 rebinds**; surface = deployed svc-workflow `POST /internal/v1/workflow-instances/{id}/cancel` (SVC_WORKFLOW_COORDINATOR_CONTROL_PLANE_V1 W-surface also permits GLOBAL_WORKFLOW_COORDINATOR — either authority suffices; DOMAIN_OWNER path is the hygiene plan's primary).
- **cebf4816 formal cancel/archive**: separate lane — **WORKFLOW_COORDINATOR_CONTROL_PLANE_V1** coordinator cross-domain cancel/archive, gated by `M1_CANCEL_ARCHIVE_PRODUCTION_MUTATION = HOLD` until `LIVE_CANCEL_ARCHIVE_READY = YES` (broker deploy of f132557 + coordinator grant). Disposition QUARANTINE_DO_NOT_RECOVER unchanged; it is NOT part of hygiene M1.
- **5709a28e**: RECOVER_VIA_WAE_V2 — execution owned by the WORKFLOW_AGENT_EXECUTION goal (slot-gated). Not hygiene, not coordinator cleanup.
- **085b41f2**: PRESERVE — REAL_BUSINESS, dispatch-eligible, normal production. Excluded from every cleanup set (A5/A9).
- **M6 (9) / M2 (25) / M2A (2) / M3 (6 dispositions, 0 DB)**: per CLEANUP_PLAN §M6/§M2/§M2A/§M3.

## Gates

```text
HOLD: M1_CANCEL_ARCHIVE_PRODUCTION_MUTATION = HOLD (Owner directive) until LIVE_CANCEL_ARCHIVE_READY = YES
HOLD: all production mutation until PRODUCTION_MUTATION_SLOT assignment per PRODUCTION_MUTATION_CONCURRENCY=1
AUDIT: INDEPENDENT_AUDIT r1 = PASS / 0 BLOCKERS on audited heads (this document)
NEXT: r2 re-audit ONLY on CLEANUP_PLAN/ledger semantic movement (fresh verify, no reuse of this PASS)
```
