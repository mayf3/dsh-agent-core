# Credential Provisioning V2 — docs candidate / acceptance packet

This AUTHOR / SUPERSEDE / CONTROLLED candidate is docs-first. It is not acceptance, implementation, deployment, credential recovery or production permission.

## Fixed inputs and mechanical composition

- DSH base main: `33ebceb9c80df668c27ad61d162ed9afa0c08da8`.
- Complete predecessor V1 blob: `a335484c25da539d6552ff1b896abe2177fba821`; original accepted file is byte-unchanged.
- Fixed REV3: SHA256 `e163ca8357343f48e99c8013ed5e26783017e3118a28f35e36f63af53fac5d23` (23310 B).
- [Exact sentence mapping and included-core hashes](AGENT_CREDENTIAL_PROVISIONING_V2_COMPOSITION_MAPPING_20261019.json) records every original/replacement sentence and 22 mechanical/history-boundary changes.
- [Complete V2 successor](../specs/AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V2.md) includes the entire inherited body and reviewed State E core. Reverse application of every mapping exactly reconstructs the full V1 blob, without an omitted section. The included core equals REV3 section-1-through-OPEN_PRODUCT_DECISIONS plus only explicit latest-user S01/S02 source-admission changes. Reversing S01/S02 recovers the exact reviewed REV3 core; its evidence-only wrapper/status footer stays in the immutable original.
- Only predecessor acceptance actor/date/reviewed-head and contemporaneous completion/construction claims are historical. Inherited normative permissions, restrictions and Acceptance Criteria retain their originally effective composition and precedence at the fixed V1 blob, including A8.1-A8.4 and valid rules restated in summaries/Acceptance/Final Output. Earlier rules already changed by a later amendment are not reactivated. Original PR #17 values and AM7 COMPOSITION are preserved; only the explicit V2 State E exception changes current scope. New 12/6 criteria do not replace inherited acceptance. Current normative D7/Scope/H/I3/I4 wording carries only the reviewed operator exception; there is no appendix-priority rule.
- Twelve CTR-SER Contracts, six ACC-SER criteria and six future source paths count only this added single-client State E delta; they do not replace inherited Phase A / ordinary matching-store ROTATE scope.

## Review reuse and provenance

R1 reviewed the actual complete proposal supplied in two text parts. R2 reviewed only the four reported repairs. R3 reviewed only CTR003 sequencing repair and returned PASS, reusing prior passed portions. The reviewer did not read files/runtime independently. Sole Sol wrote/read/pinned actual file bytes. Requested reviewer model: gpt-6-astra; actual observed model: NOT_EXPOSED. This chain closes the proposal's reported semantic issues, not qualified acceptance, whole-V2 composition confirmation or instance readiness. The author mechanical checks are separately labelled and are not an independent semantic review. Latest-user S01/S02 source-admission changes receive one separate affected-delta review; prior R1/R2/R3 conclusions are reused.

Local evidence root: `/Users/yanfenma/Documents/Codex/2026-10-18/three-session-followup-0743/`. These are local custody locations, not remotely accessible links. The original coordinator can supply the nonsecret fixed evidence; no secrets or full evidence corpus are copied into this repository.

| Local evidence basename | SHA256 |
|---|---|
| AUTH-SESSION-CREDENTIAL-RECOVERY-PREFLIGHT-20261019.json | a9f2842a2af2611284688953de4d2924347c7b658aaafa03d6e1e1ab39c82774 |
| AUTH-SESSION-CREDENTIAL-RECOVERY-STATE-E-IMPLEMENTATION-DECISION-20261019.json | 07746ae195ccdd41bd21617c0d4de9d11b21f01b400dd21128dc5940ddc4e754 |
| AUTH-SESSION-STATE-E-SINGLE-CLIENT-IMPLEMENTATION-AUTHORITY-DELTA-PROPOSED-20261019.md | ddb7ec2236193d61adbc63c20aa81de0769f4de1fa6ace2e9f35fb2bce64e3cf |
| AUTH-SESSION-STATE-E-PROPOSED-TEXT-REVIEW-R1-20261019.json | a50cda7382df5153ffc6958598b559b112b09af3afe45b3d700245fb6c27bfe5 |
| AUTH-SESSION-STATE-E-SINGLE-CLIENT-IMPLEMENTATION-AUTHORITY-DELTA-PROPOSED-REV2-20261019.md | 62c9ed7934c304d7a97ea16df872093552c40a0dfea3142633d1e774190ccb8a |
| AUTH-SESSION-STATE-E-PROPOSED-TEXT-REVIEW-R2-20261019.json | 230fda5ecf13a46e8cd99a1d3ee2f3b8bd570144891e2cf6f33afde32981814b |
| AUTH-SESSION-STATE-E-SINGLE-CLIENT-IMPLEMENTATION-AUTHORITY-DELTA-PROPOSED-REV3-20261019.md | e163ca8357343f48e99c8013ed5e26783017e3118a28f35e36f63af53fac5d23 |
| AUTH-SESSION-STATE-E-PROPOSED-TEXT-REVIEW-R3-20261019.json | f67adbeacb5e459a60254b25a8b4279230df3ceb3e851afcf42fb75e86c13535 |
| AUTH-SESSION-CREDENTIAL-RECOVERY-FINAL-20261019.json | 8efc0e54a8001c962fda1daa75c620ced9df4c7e25e458e7bf316479a032dceb |

## Qualified acceptance entry and actual account

Owning authority `.agents/local/README.md:66-75` at base permits repository owner mayf3 or a maintainer explicitly authorized in the PR. Recommendation is not acceptance; the decision must bind reviewed commit and final accepted head.

Current public GitHub metadata reports authenticated actor mayf3/id5518571 and repository owner mayf3/id5518571, with repository push/admin permissions. This proves account identity/capability only. This agent does not infer owner delegation or self-accept.

The bounded record check is limited to that local rule, the pinned current-task authority decision and fixed AM7 PR #223 (author mayf3; reviewed source head d3d1363ed3eb6b52dab65b9ae37eaf014912a9f6; merge 892a26a38ba7c15c75f42837d202256f8e136267). PR #223 records its historical incident/Owner-directed AM7 scope, not current agent delegation to accept V2. No current-task explicit DSH maintainer acceptance delegation has been identified in those scoped records. Auth #92, B7 and user recovery/docs-effect authorization do not expand that role.

Exact next acceptance decision: repository owner mayf3, or a maintainer expressly designated in this PR, records a qualified decision for this complete V2 at its actually reviewed commit, including actual actor/time and reviewed coordinates. The original coordinator routes it. No acceptance is inferred from the authenticated account, invented dates or prefilled values. The user's bounded recovery effect authorization already exists; this is a separate Spec acceptance decision, not another request for that effect.

## Future single atomic lifecycle transaction — NOT performed

Only after actual qualified acceptance:

1. `docs/specs/AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V2.md`: change `status: proposed` to `status: accepted`, retaining its whole-V1 supersedes relation. Actual acceptor/time/reviewed commit are audit inputs recorded when the decision occurs, binding the final accepted head without a Git file self-reference.
2. `docs/specs/AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1.md`: change frontmatter `status: accepted` to `status: superseded`; add `superseded_by: AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V2`. Preserve original body and acceptance history. Any current backlink note must be explicitly historical and must not rewrite original ruling/date/head.
3. `docs/specs/README.md`: atomically change the same two rows to V2 accepted/current (effective only after authority-branch merge) and V1 superseded/history. No fragment supersession or two active successors.
4. The decision binds actual reviewed candidate and final accepted head. Lifecycle-only finalization gets only the applicable mechanical/affected-delta confirmation, reusing the closed review rather than restarting semantic review.
5. Original qualified chain/root controls acceptance and merge. This worker does neither. At this Draft PR stage V1 stays active and unchanged; there is no authority gap.

Acceptance in main can permit only the exact implementation scope; this docs PR changes none of the six future source paths. Source implementation, artifacts/load, original custody, one-operation admission and live result remain separate. No build, install, product test, old gate or production probe is run for this mechanical docs composition.

## Recovery handoff remains bounded

Caller is UNBOUND; creator is UNKNOWN; credential is NOT restored. No new locator was run for this docs stage. A qualifying source is either the original ZCode diagnostic record keeper, or an actually bound existing runtime/capability pure-read session/identity/status call with real credential_unavailable and proven no mint/send/identity or env/permission change, business-state write, business ACK or retroactive repair of existing Auth/business audit; normal infrastructure recording of this read and necessary sanitized diagnostics are allowed. The second identifies only that one actual affected existing identity and is not asserted to be the ZCode identity absent later exact DB proof. It is a permitted source, not a prerequisite to accepting the docs design. The original ZCode keeper can still supply its safe projection `{toolName=actual installed entrypoint (historical ZCode: agent_session_send), failureCode=credential_unavailable, invocationTime, toolCallId or recordId, callerAgentId or joinable sourceSessionId/child-generation/PID, projection provenance}`. No prompt/body/secret or manually guessed ID. Local fixed denial audit was absent and previously checked runtime logs could not join this failure to its caller. Multiple callers require actual records and individual mapping, not a configuration/client list.

Missing an already controlled main gates only canary, not otherwise lawful credential recovery. No native caller identity/readback capability has been asserted. Docs-stage DB/store/rotate/ensure/mint/send/canary/runtime/production effects are all zero. Pilot/V3/B7 and deployment 2of2 remain separate.

## Fixed candidate coordinates and cleanup

Exact postcommit HEAD/tree/file/diff pins, remote Draft PR state and the single composition confirmation belong in external evidence/PR body, not a Git file claiming its own commit hash. Retain existing evidence/review/source/release/active material and this unique candidate. Do not pull/rebase/clean or modify another checkout.
