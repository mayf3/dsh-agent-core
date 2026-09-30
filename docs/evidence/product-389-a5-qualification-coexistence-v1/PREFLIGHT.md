# DEVELOPMENT_PREFLIGHT — Product #389 (Epic A5) candidate-qualification isolation

```text
DEVELOPMENT_PREFLIGHT

Problem =
  Product #389 DONE_WHEN requires focused regression coverage that a
  candidate/private canary qualification window (deployment_start /
  restart_a / restart_b) neither blocks nor is bypassed by ordinary
  unrelated Agent traffic, plus an isolated test-identity coexistence
  demonstration. Current main has the qualification seams implemented
  (fixed-admin canary contract) but NO coexistence regression and NO
  restart_a/restart_b coverage at the registry/admission seam.

Governing Spec =
  AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1 (accepted) — protocol authority for
  this preflight. Domain authorities for the seam under test (all accepted,
  source-frozen): PRODUCTION_STAGE_ISOLATION_AND_ARTIFACT_INTEGRITY_V1
  (+ AMENDMENT_2) deployment isolation semantics; the fixed-admin
  qualification contract modules (production-runtime/src/native-arm64/
  hr-admin-canary-contract.mjs + hr-s256-r2-startup-context.mjs) merged via
  the accepted HR trusted-recovery / fresh-cut lanes. Owner-issued execution
  authority for this non-production stage: GitHub Program #382 / Goal #386 /
  Epic #375 (A5) / Product #389 with its frozen DONE_WHEN and boundaries.

Spec status = accepted (authorities above); Product #389 DONE_WHEN is the
  active Owner-authorized work order.

Relevant investigations =
  agent-control#92 incident evidence (HR admission OPEN, turn parked
  pre-spawn during a fresh-cut qualification window) — the failure class
  this product isolates.

Relevant decisions =
  Isolation is per-agent + private-channel by design: the canary Agent is
  reserved for the root-owned token (FIXED_ADMIN_CANARY_PRIVATE_ONLY),
  canary effects are denied (FIXED_ADMIN_CANARY_EFFECT_DENIED), and global
  admission is gated ONLY by the durable-store floor
  (store.startupBlockedReason → AGENT_PROCESS_RECOVERY_STARTUP_BLOCKED).

Previously rejected alternatives =
  Global qualification windows / fleet-wide qualification for a single
  candidate (Epic #375 non-goals: "no fleet-wide qualification window for a
  single candidate"). Name-heuristics or env-based canary selection
  (contract is a root-authenticated private protocol; never caller-facing).

Frozen boundaries =
  No production deploy/restart/sudo/credential/data mutation; no replay of
  UNKNOWN work; no new governance framework; test identities only
  (synthetic agent ids, fake OS children); ACCEPTANCE_MODE = TEST_IDENTITY.

Implementation scope =
  New focused regression file
  packages/agent-router/test/process-lifecycle/candidate-qualification-
  coexistence.test.js driving the REAL createProcessRegistry + REAL
  AgentProcess over fake children + ONE real TurnReconciliationStore:
  ordinary-agent admission/turn coexistence while the qualification is
  pending, after it completes, and after it fails; restart_a/restart_b/
  deployment_start phase matrix; canary fail-closed bypass negatives;
  durable-store floor negative control. If and only if these expose a real
  source defect, the smallest source fix is added with a docs-first spec
  candidate in the same branch (merge gated on Owner acceptance).

Out-of-scope =
  Production deploy/verify (→ WAITING_PROD_AUTH later with exact release/
  operation/canary); changes to the frozen canary contract modules; broker/
  svc surfaces; fleet readback tooling.

New evidence =
  Fresh main read: origin/main 360756e3 (this branch's base); existing
  qualification suites (fixed-admin-canary/registry/effect-deny/
  admin-qualification-seal) pass but cover the canary path only — zero
  ordinary-traffic coexistence coverage exists anywhere (grep-verified).

Need new/amended Spec = NO for the regression coverage itself (tests are
  assurance, zero semantic delta). Conditionally YES (docs-first candidate
  in the same branch) only if the RED run exposes a source defect.
```
