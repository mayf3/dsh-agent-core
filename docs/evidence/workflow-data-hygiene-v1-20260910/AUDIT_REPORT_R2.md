# WORKFLOW_DATA_HYGIENE_V1 — INDEPENDENT_AUDIT r2 (fresh, post-B1–B6 repairs; 2026-09-10)

Auditor: fresh-context independent agent (no authorship; adversarial recomputation + live read-only DB cross-checks). Supersedes r1 per Owner ruling (SUPERSEDED_BY_NEW_MECHANICAL_EVIDENCE).

```text
VERDICT = ACCEPT
CHECKS  = B1 PASS / B2 PASS / B3 PASS / B4 PASS / B5 PASS / B6 PASS
          / PRESERVED PASS / CENSUS_INVARIANTS PASS / MANIFEST PASS (24/24)

M1A_NORMAL_CANCEL_COUNT = 8
M1B_DANGLING_COUNT = 4
M1B_NORMAL_CANCEL_ATTEMPT = NO
M1B_NORMAL_ARCHIVE_ATTEMPT = NO
M1B_AUTHORITY_OR_EXPLICIT_HOLD = CLOSED
M1_CURRENT_IMPL_OWNER_ONLY = YES
M1_ACCEPTED_COORDINATOR_AUTHORITY_EXISTS = YES
M6_STATE_AUTHORITY_OWNER = SVC_WORKFLOW
AUTH_SERVICE_DOMAIN_BINDING_OWNER = NO
M6_ACTOR_AUTHORITY_PROVEN = NO   ← honest value; see note below
LEGACY_CREDENTIAL_USED_BY_CONVENIENCE = NO
HR_RUNTIME_ADMIN_FALLBACK = NO
LOGICAL_SUBJECT_COUNT = EXPLICIT
COMMAND_LEVEL_LEDGER = COMPLETE
TOTAL_COMMAND_COUNT = MECHANICALLY_DERIVED (94 coordinator-shape | 101 admin-fallback-shape)
REAL_BUSINESS_DESTRUCTIVE_MUTATION = 0
SHIP_BLOCKERS = NONE
```

M6_ACTOR_AUTHORITY_PROVEN = NO is the truthful, contract-consistent answer: the mechanical
actor census PROVED THE NEGATIVE (no canonical principal holds workflow.admin; all holders are
legacy/test; coordinator role granted to no canonical actor). That proof is precisely what
yields M6_AUTHORITY_GAP=YES and the 9 held M6 subjects — the two answers are complementary by
B4's own rule ("if no accepted authority explicitly supports the provisioning actor ⇒ GAP=YES").
M6 execution remains HELD until the gap resolves (preferred: WCC B1 grant → coordinator
set_domain_owner; fallback: narrow Owner-authorized one-time binding-repair authority).

NOTES (non-blocking) and disposition:
1. §1a admin-holder enumeration over-included 097f197d/858b5fe2 → corrected to match the
   frozen TSV (actual admin holders: bc970ced legacy, 9c740a57 test); conclusion unchanged.
2. §0 subject-count chain wording (48 vs M3's 0-mutation 6) → clarified; 48 = 8+4+25+2+9.
3. EXECUTABLE count 21 → corrected to 20 (19 M2 READY defs + M2A-1); HELD = 28.
4. svc-global-role-bindings also has a DISABLED coordinator row for 61819256 — immaterial
   (disabled), recorded here for completeness.
5. 6ea453e2 AMBIGUOUS-overlay/TSSV-class relationship re-verified sound.
