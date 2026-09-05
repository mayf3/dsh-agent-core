# HR_DISPATCH_DELIVERY_READINESS_V1 — subject-correction review record

Owner fresh identity fact (2026-09-05, load-bearing): the current formal HR
business identity is Principal `dc702687-6515-4a2a-91ae-e572a9bbd766`
(agent_id `agt_hr-agent`); the older Principal `bc970ced-710f-4479-9ff0-e295a1c59424`
(agent_id `hr-agent`) is a legacy OpenClaw-era identity, remaining only a
bounded provisioning/admin actor where already authorized.

## Identity-binding census (exact UUIDs; no display names)

```text
LANE_A_AUTHORITY_TARGET       = bc970ced… (V1 §1:30 + CTR-HRG-001:140)  -> WRONG_TARGET
LANE_A_IMPLEMENTATION_TARGET  = bc970ced… (supply-hr-session-send-grant-v1.ts:85 PRINCIPAL_ID) -> WRONG_TARGET (follows authority; tests subject-generic)
LANE_B_AUTH_HR_SPECIFIC_BINDING = YES (V1 CTR-EAPR-005:179 names bc970ced as sole intended read-grant recipient; vehicle FIXED_PRINCIPAL_ID :51)
LANE_B_DSH_HR_SPECIFIC_BINDING  = YES (V1 CTR-EPAR-007:213 canary-precondition names bc970ced; implementation itself subject-generic)
WRONG_TARGET_SHIP_BLOCKER  = YES
NEW_AUTHORITY_REQUIRED     = YES
MERGE_ALLOWED              = NO (source merge held)
```

Additional mechanical fact: the legacy agent_id `hr-agent` does NOT satisfy
the existing `^agt_[a-z0-9-]+$` stored-id grammar (dsh CTR-EPAR-003 /
AGENT_ID_RE), so a resolution of the legacy principal already fails closed at
the dsh provider; `agt_hr-agent` satisfies it. V1's DEC-HR-001 had inverted
the two identities (it forbade `agt_hr-agent` "alias substitution").

Governance form: the repos' spec protocols (SPEC_FORMAT_V0 §14.1–14.3) forbid
in-place meaning changes to accepted normative IDs and mandate a new Spec ID
(whole-Spec successor with atomic V2-accepted + V1-superseded reciprocal
backlink). Three successors were authored, changing ONLY the subject surface.

## Candidates and ONE independent exact-head review

Reviewer: independent read-only subagent (agent_8f6293bd), 2026-09-05.

```text
LANE_A_V2      = AUTH_SERVICE_HR_AGENT_SESSION_SEND_GRANT_V2 @ 3a5e01ed9274445de77d63b6a0ece6861a843072
                 (auth branch codex/hr-subject-correction-v2; successor of V1 reviewed head 9b3b4bd…)
LANE_B_AUTH_V2 = AUTH_SERVICE_EXACT_AGENT_PRINCIPAL_RESOLUTION_V2 @ 87beb7783d7e81bdf479cbb109c42cac86a9bfbf
                 (same branch; successor of V1 reviewed head 0359575…)
DSH_V2_R1      = AGENT_CORE_EXACT_PRINCIPAL_AGENT_RESOLUTION_V2 @ 8fdae350cbeebe3c3353ddd555faf924537a1fbf
                 (dsh branch codex/principal-resolution-subject-correction-v2; successor of V1 @ dsh main 51dafbe)
VERDICT_LANE_A_V2      = ACCEPT
VERDICT_LANE_B_AUTH_V2 = ACCEPT
VERDICT_DSH_V2_R1      = REVISE (single front-matter blocker: leftover
                 `acceptance_review_verdict: PASS` — self-certifying metadata
                 on a proposed record)
BLOCKER_UNION = [that single blocker]  -> fixed ONCE
RE_AUDIT (delta, per reviewer's MINIMAL_CLOSURE) = PASS
  diff 8fdae35..eedf469 = exactly the one-line deletion; no residual
  accepted_*/review_verdict fields; status proposed; supersedes intact.
DSH_V2_FINAL_HEAD = eedf469 (branch codex/principal-resolution-subject-correction-v2)
```

Reviewer confirmations: minimality proven by hunk taxonomy (auth Lane A = 7
hunk groups, auth Lane B = 4, dsh = within taxonomy after fix); new binding
exact everywhere with zero UUID typos; legacy exclusions normative MUST NOT
while preserving V1's bounded provisioning/admin existence; grammar claim
verified against real code (`hr-agent` fails `^agt_[a-z0-9-]+$`, `agt_hr-agent`
matches); pin coherence (dsh V2 pins auth V2 @ 87beb77 whose resolution
contracts are byte-identical to V1's, so dsh's one-for-one contract references
hold; auth Lane A V2 keeps the dsh ASM pin 1912d58); lifecycle validity per
both repos' transition rules (V2s are new records, proposed, V1s untouched on
their mains; atomic acceptance flips both in one transaction).

FOLLOW_UPS (non-blocking): Lane B auth V2 CTR-EAPR-001 notes string still
cites V1 (byte-preserved by design for pin coherence; decide at
implementation preflight whether the bundle provenance string advances);
acceptance sequencing is auth-first (both V2s in one transaction), then dsh V2
whose §8 re-affirms the upstream pin against the final accepted auth revision;
two cosmetic line-wrap notes.

## Boundary

All three V2 candidates are status: proposed. IMPLEMENTATION_ALLOWED = NO and
MERGE_ALLOWED = NO until ONE batched Owner exact-head acceptance. After
acceptance: reuse the completed implementations mechanically, swap only the
affected subject/tuple/test/receipt surfaces (vehicle PRINCIPAL_ID constants,
negative legacy-principal tests per the Owner's wrong-target test list),
focused tests + ONE affected-head implementation audit. Production apply
remains gated by the shared mutation slot (Visit Activation owns it) and
native Owner authorization where privileged. This record authorizes none of
those steps.
