# Router durable generation restart safety — provenance and proof index

- Index date: 2026-09-25
- Purpose: resolve the HR recovery Spec RQ-007.1 reference at its committed
  candidate revision. This index is provenance and status, not a deployment
  receipt or proof that `ROUTER_RESTART_SAFETY = PROVEN`.

| Artifact or fact | Exact provenance and status |
|---|---|
| Source fix | PR #313 merged as `2097e4f948dca77a12d24afa1ff9fb42e9ec7756`; reviewed source HEAD `afea89b`; Phase G report says package delta is empty. The independent HR Spec review also identifies follow-up main `2a85d065`. |
| Phase G report | Original local evidence: `/Users/yanfenma/workspace/project/dsh-agent-core/docs/evidence/router-durable-generation-restart-safety-v1-20260921/REPORT.md`; SHA-256 `128b080e57269636f6e2795a3095860e2a224b14488733fa3b1075117bdd6c48`. Phase G explicitly says production deployment was not performed and proofs 1–9 remain pending. |
| Owner deployment and proof procedure | Original local evidence: `/Users/yanfenma/workspace/project/dsh-agent-core/docs/evidence/router-durable-generation-restart-safety-v1-20260921/OWNER_RUNBOOK.md`; SHA-256 `d8cfc5a3925c29ee843258a8077f57f4d8223f44bf697bbd24edba011753911e`. Its §② designates nine post-deploy checks and §1 requires the trusted control plane. |
| Independent status cross-check | Original review at `/Users/yanfenma/workspace/project/dsh-agent-core/.worktrees/hr-restart-fence-spec-v1/docs/reviews/HR_RESTART_LOST_FENCE_TRUSTED_RECOVERY_SPEC_V1_INDEPENDENT_REVIEW.md` §11/B2, frozen review SHA-256 `5b43d23f8b7bfbe350ba4024a8d0d255c35ed5442df072e74bdc032aa542089e`: deployed binary still uses the pre-floor allocator; `ROUTER_RESTART_SAFETY = PROVEN` is not achieved. |

As of 2026-09-25: **NOT_DEPLOYED / PROOF_PENDING**. The Phase G report's
literal status is `ROUTER_RESTART_SAFETY = PROVEN 未达成`. RQ-007.1 continues to
require actual deployed-binary proof before any recovery-related stop/restart.
Neither a merged source fix nor this index satisfies that gate.

The original Phase G report and Owner runbook are local, untracked inputs in
the shared checkout; their hashes above pin what was read. The proof location
designated by that runbook must receive a future deployment receipt and the
nine post-deploy checks before a separate reviewer may mark PROVEN. This
index must be updated from those exact receipts; it does not predict them.
