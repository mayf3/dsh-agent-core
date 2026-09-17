# R02 narrow successor lane

Goal: PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_R02_CLOSURE.
Parent: PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1. This is a new Owner-mandated lane,
not a second repair wave or rewrite of the parent run.

Authority: accepted PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1, reviewed3986553;
accepted lifecycle/basebb5327f; current delivery1cbdaaff03fffa02bfa0394c7a7a9e9ed47ba696.
Original executable277a5e8832938e6b2232d11949aedfb92cd0e318.
Owner's current request authorizes only R02 test-first repair, affected/full checks,
fresh scoped independent review, and a separate bootstrap prerequisite assessment.
No production/runtime connection, root/sudo/bootstrap/install/enablement, issuer
integration, future multi-resource repair or accepted-Spec edits are authorized.

DEVELOPMENT_PREFLIGHT: REUSE / IMPLEMENTATION / BRIEF / CONTROLLED.
IMPLEMENTATION_AUTHORITY=contracts; AUTHORITY_ACCEPTED_IN_BASE=YES;
EXECUTION_MANDATE=VALID; MUTATION_AUTHORIZATION=VALID; ISOLATED_WRITE_SURFACE=YES;
SPEC_GAP_DEPENDENCY=NONE; EVIDENCE_REVIEWABILITY=PASS; OWNER_DECISION_REQUIRED=NO;
IMPLEMENTATION_ALLOWED=YES; MERGE_READY=NO; OPERATION_ALLOWED=NO.
Candidate/Base/current Base all1cbdaaff03fffa02bfa0394c7a7a9e9ed47ba696 at start;
worktree /Users/yanfenma/workspace/worktrees/production-deployment-control-plane-v1-impl;
new branch codex/production-deployment-control-plane-v1-r02-closure. Parent branch
remains pinned. Existing isolated surface and build cache reused without baseline
full-suite repetition; exact prior source has recorded168-pass baseline.

Observation/root-cause hypothesis: service/train.rs tick propagates recover_failed
record refusals before daemon_next_verification. Expired B proof therefore starves
current healthy Applied A's accepted read-only verification. Binding's prior
blanket Err-continue also fails to distinguish global journal/authority failure.
Relevant Contracts: CTR010/011 restrictions, CTR014/015 per-Goal verification,
CTR007/009/012/013 and020 affected identity/mutex/state/evidence boundaries.

Runbook: nonroot owned kernel-private0700 fixture trees and existing sandbox
daemon/socket only; no live8790 or launchd. First add precise A-Applied/B-Blocked
regression and global-unsafe negative tests. Record RED before production edits.
Implement stage-scoped definite unit refusal, durable bounded per-unit disposition,
retaining normal pinned verification, STOP/budgets and conservative unknown failure.
Run affected tests, then freeze source and execute serial locked all-target suite,
fmt, strict Clippy and release. Check governance/structure delta and Spec identity.
Fresh reviewer sees only R02 and directly affected surfaces plus retained evidence;
any changed global gates get explicit affected review. No blanket error swallowing.

DONE_WHEN: R02/global-negative/isolation/full/fmt/Clippy/release and fresh independent
R02 review PASS, no new ship blocker. Evaluate bootstrap separately against actual
Spec/implementation; actual issuer contracts remain independent dependency.
EXPANSION_TRIGGER: concrete new authority gap or security regression beyond this
mandate. No optional hardening or 32-row debt. Preserve all raw failures and parent
run files byte-for-byte. No credentials or actual private key material.
