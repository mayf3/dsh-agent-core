# SCHEDULER_SELF_HEALING_FROM_FEISHU_V1 — Authoring & Acceptance Record

Provenance for the docs-only acceptance lane of
`docs/specs/SCHEDULER_SELF_HEALING_FROM_FEISHU_V1.md`.

## Origin

```text
SPEC_ID = SCHEDULER_SELF_HEALING_FROM_FEISHU_V1
AUTHORING_MODE = docs_only_acceptance_lane
IMPLEMENTATION_CANDIDATE_HEAD = e0ad1e31627707b9beba47639781b60ce88e4f5d
IMPLEMENTATION_CANDIDATE_BRANCH = goal/scheduler-self-healing-from-feishu-v1
   (= SCHEDULER_RETRY_MINTER_CROSS_REVISION_FIX b3ae557 + self-healing commits;
    implementation bytes dual-reviewed PASS separately — NOT part of this lane)
ACCEPTANCE_LANE_BASE = bb5327f (fresh origin/main at lane creation)
CANDIDATE_COMMIT = 3b65db3ac5d48e1cb7671c0a7ca85b066d557a01  (byte-identical spec content)
NORMATIVE_DELTA_VS_CANDIDATE_HEAD = NONE (spec bytes copied verbatim; acceptance
  transaction touches lifecycle/metadata only)
```

## Independent exact-head semantic + governance review

```text
SPEC_GOVERNANCE_MODE = REVIEW
REVIEW_KIND = SPEC
REVIEW_TARGET_HEAD = 3b65db3ac5d48e1cb7671c0a7ca85b066d557a01
BASE_HEAD = bb5327f
REVIEWER = independent agent (fresh context; author independence PASS)
OPEN_OWNER_DECISIONS = NONE (§6 production E2E defers to EXISTING accepted
  authority PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1, accepted 2026-09-17 @ 3986553)
NORMATIVE_TBD = NONE (all enums closed: stages 9 values, recoveryEligibility 4,
  globalSchedulerHealth 3 per CTR-V3-STATUS-001, jobLocalHealth 3, classification 1)
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE (superseded tick-abort behavior has NO spec freeze;
  only implementation test R3 + a mis-citing code comment — superseded by §2.3
  in the same candidate; V3 C-009 is permissive and C-023 + the store invariant
  already forbid cross-revision retry persistence)
AUTHORITY_CONFLICT_ANALYSIS = V3 C-009/C-023 latitude respected; C-026 typed
  refusals keep no-partial-record; C-035 "at least" admits the two additive
  evidence events; C-029/fence/CTR-V3-RECON/IDEMP preserved verbatim (§7);
  Watchdog CTR-RECON/ROUTE/HEALTH-001 untouched; Control-Plane DEC-SSO-001/002/003
  and CTR-PROG-003/004 hold (R4 fail-closed zero-write; R2 no-mutation)
REALISM = every §1-§4 statement anchored in base code (classifier inputs at
  occurrence-model.js structuredCollisionError / occurrence.js payload-conflict /
  store.js:288; receipt channels exist; §3 existing-field list factually accurate)
SPEC_REVIEW = PASS
BLOCKERS = NONE
```

## Reviewer notes and dispositions

| # | Note | Disposition |
|---|---|---|
| N1 | `self_ops.job_disposition` is a live third operation outside Tools V3's `status\|reconcile_turn` enumeration — pre-existing gap on main (closure runbook §6 demand); this Spec regularizes it | Folded into acceptance: frontmatter `preserves` comment records this Spec as the first normative authority for the job_disposition surface; Tools V3 frozen schemas/authority/receipt/idempotency untouched |
| N2 | Frontmatter missing 6 schema-required fields (`spec_kind`, `authority_level`, `scope`, `governed_by`, `external_authorities`, `owners`) | Folded into acceptance transaction (metadata normalization, semantic delta NONE) |
| N3 | No terminal gate declaration block (peer accepted specs all carry one) | Folded into acceptance: §8 lifecycle gate block appended with the certified values |
| N4 | §1 references unmerged-branch provenance `fa65ee5..b3ae557` | Accepted as descriptive provenance — §1.1 restates the full adopted semantics, no normative dependency on unmerged bytes |
| N5 | D-007 §7.5/§11.4 citations are superseded-authority provenance under V3 C-020 | Kept as parenthetical provenance; binding basis stated alongside (V3 C-009/C-023/C-044/C-004) |
| N6 | "Goal §16" flag vocabulary is a task artifact, not in-repo authority | Non-normative mapping; in-repo overlap carried by the closure runbook §8 |
| N7 | "engine session" used without definition | Established implementation meaning (per-engine-instance dedup); define when next touched — no byte change in this transaction |
| N8 | Secrets | None (16-hex occurrence locators only, same class the accepted Watchdog spec publishes) |

## Lifecycle transaction

```text
TRANSACTION = lifecycle-only acceptance
STATUS = proposed -> accepted
ACCEPTED_BY = mayf3 (Owner directive, phase A of the ruling dated 2026-09-17)
ACCEPTED_REVIEWED_HEAD = 3b65db3ac5d48e1cb7671c0a7ca85b066d557a01
NORMATIVE_CONTRACT_BYTES_CHANGED = NONE
ACCEPTANCE_METADATA_CHANGES = frontmatter lifecycle fields + schema normalization
  (N2) + preserves comment (N1) + ACCEPTED banner + §8 gate block (N3)
IMPLEMENTATION_ALLOWED_AFTER_MERGE = YES (Phase B reconstruction on this base,
  per the same Owner ruling)
PRODUCTION_MUTATION_ALLOWED = NO
DEPLOY_ALLOWED = NO
RE_ENABLE_HR_RETRY_AUTO = NO (until self-healing implementation is deployed and
  postdeploy verification PASSes)
```
