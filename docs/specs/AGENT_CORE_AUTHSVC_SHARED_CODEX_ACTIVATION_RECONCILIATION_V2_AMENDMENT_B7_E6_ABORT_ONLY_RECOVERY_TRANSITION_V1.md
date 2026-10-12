---
spec_id: AGENT_CORE_AUTHSVC_SHARED_CODEX_ACTIVATION_RECONCILIATION_V2_AMENDMENT_B7_E6_ABORT_ONLY_RECOVERY_TRANSITION_V1
status: accepted-source-scope-only
proposed_by: original B7 author session sess_5b7e82d6-5ac1-474d-b6b3-a0f7b6dfa547 (worktree ac-810), claim b7-e6-trusted-entry-correction-20261012-r1, command mayf3/agent-control#937
proposed_at: 2026-10-11T23:58:40Z (r1) — r2 truthfulness corrections 2026-10-12T00:42:39Z
review_reference: B7_E6_ABORT_ONLY_RECOVERY_CONTRACT_REVIEW_V1 (independent changed-scope review, command #939, comment 6115554577): ACCEPT_SCOPE with C1/C2/C3 as BINDING conditions of any approval. That review is NOT Owner authorization and grants no production authority; this file remains status: proposed. The 2026-10-12 human Owner command authorizes SOURCE PREPARATION only — the terminal ABORT disposition and any publication/window remain the real Owner decision/interaction.
revision_note: r3 (2026-10-12T05:5xZ, DOCS_ONLY) — §8 rewritten per #963 export omission (SEALED holder/production-deploy.lock compatibility NOT_SPECIFIED in r2): predicate/path-class enumeration, retained-artifact mapping, first-bootstrap-entry analysis, truthful phase boundaries. Pre-r3 digest aadc4533d9d4dae5a362f5f92733909aa14127b09035c4df99278f67fbee6037 (12990 B/95 lines) preserved as ordinary evidence copy. SOURCE RC1/RC2/M1/M2 independently PASS (6118335675) — that PASS covers different bytes and is unaffected.
parent_spec: AGENT_CORE_AUTHSVC_SHARED_CODEX_ACTIVATION_RECONCILIATION_V2 (accepted 2026-10-04, PR452; accepted copy sha256 7911a67eb61055daf3c5f97ffc924a1e008181d07027e30e4fa2981f5fcd3753 — byte-identical, NOT modified by this proposal)
responds_to: mayf3/agent-control#424 comment 6115418028 (Owner correction); receipt 6115410102 r1 §3 retracted by r2
accepted_by: mayf3 — REAL HUMAN Owner, direct supervising-chat answer; decision receipt mayf3/agent-control#424 comment 6124229746 (2026-10-12T12:26:02Z). This acceptance record authored by the independent reviewer session sess_7768a0e2-f989-4c2b-8182-46f4eefa68ad / ac-913 (command #967) — reviewer records the Owner decision only.
accepted_date: 2026-10-12
accepted_scope: §8-r3 SOURCE implementation ONLY — the e6-only, single-use, exact-TX-bound DS publication-qualification exception -> targeted tests -> independent actual-delta review -> new exact freeze
implementation_authority: source_only
production_apply_authority: none
reviewed_proposal_sha256: 9961d9408c74a967858b35a47f3d53ee81c6528811933a2794b929abd3f0f148 (accepted preimage, 19130 bytes; preserved at ds-repair/results/amendment-pre-D2-acceptance-9961d940.md)
owner_decision_verbatim: 批准 §8-r3 限定实现
owner_decision_context: reply to the exact reviewed scope question (request_user_input_async call_376b068a9665415891afe6b2bdffeb32, item 0) whose full text names SHA 9961d940…f148, the single-use/exact-TX conditions, targeted tests/independent review/freeze, D1 SOURCE PASS reuse, and all exclusions — comment 6124229746
not_accepted_excluded: §4 actual recovery/ABORT pass execution; §8 actual DS-unit maintenance/publication/install/restart; retained-object deletion/archive/rename; security-permission changes; Owner FD3/FD9 substitution; writer takeover; UNKNOWN replay; any general/non-e6 exception inheritance
review_chain: changed-scope ACCEPT_SCOPE + C1–C3 binding (comment 6115554577) -> SOURCE PASS RC1/RC2/M1/M2 (comment 6118335675) -> material export (comment 6118406598) -> docs r3 ACCEPT_FOR_OWNER_DECISION (comment 6120570829)
---

# AMENDMENT — B7 e6 abort-only same-TX recovery admission (§8-r3 SOURCE SCOPE ACCEPTED 2026-10-12; NOT PRODUCTION-APPROVED; IMPLEMENTATION NOT STARTED)

## 0. What this proposal is and is not

This is a **narrow, abort-only recovery-admission contract** for exactly one retained
operation. It is **status: accepted-source-scope-only** (2026-10-12 REAL HUMAN Owner
decision, mayf3/agent-control#424 comment 6124229746, verbatim: 批准 §8-r3 限定实现):
the §8-r3 SOURCE design/implementation → targeted tests → independent actual-delta
review → new exact freeze is accepted, with implementation_authority=source_only and
production_apply_authority=none. It still authorizes NO execution today — §4 actual
recovery/ABORT execution, §8 actual DS-unit maintenance/publication/install/restart,
retained-object deletion/archive/rename and security-permission changes remain
excluded/unaccepted. The single bounded recovery pass under the ORIGINAL controlled
surfaces, permanent install, COMMIT, new windows, and policy changes for future packets
remain governed by the parent Spec and existing gates.

- Parent Spec text: unchanged (GOVERNING_SPEC_UNMODIFIED). This file is an additive,
  e6-scoped amendment proposal referencing the parent's section 6 step 3 semantics.
- No implementation is written by this document; the accepted §8-r3 SOURCE implementation authority is source_only and starts only in the original author session per the decision receipt (comment 6124229746).

## 1. Fixed subject (single operation, no generalization)

- operation_id: `b7-packet-r27-65e5606cf5c352f2e-e6` (fixed; no other operation may use this amendment)
- transaction_id: `tx-5974ef29916145a68133111f57ce3f9a` (fixed)
- state at proposal: native TX PREPARED; holder SEALED; phase RETAINED (OWNER_CHANNEL_IDLE_RETAINED, attempt 1, replay_allowed=false)
- Known failure: apply rejected at owner-authsvc-plugin-upgrade-r13.sh:889 — marker.scriptSha256 `5c9d0645cea47c67c651cdc8138cb481eee3b0234849cfde1bd8a00641bd43da` vs actual invoked bytes `fd6a1618bffe880ece8a59d9dc3cdaffbcfef2c0b2b9232398231a08eb2529c3` (Bash-3 empty-array fix at carrier lines 128/130 only)

## 2. Invariants that MUST NOT change (the "preserve" set)

1. Original whole execution-policy digest and the original e6 execution receipt: **byte-unchanged**. No digest edit to force PASS. The recovery authorization carries its OWN independent frozen digest (§4) alongside the preserved originals.
2. Registration history: unchanged. No re-registration, no relabel, no re-enable of `-e6`, the mis-bound base row, or any retained/UNKNOWN identity. No new operation minted by this amendment.
3. TX and holder: same TX id, same holder nonce, SEALED generation untouched except the explicit abort-only writes the original mechanism itself performs (six-target rollback journaling + carrier ABORT terminal transition).
4. All real placement/provision side effects, backups and receipt trails already on disk: preserved.

## 3. Identity facts the admission MUST verify from sealed real bytes (no inference)

| fact | value |
|---|---|
| carrier (actual invoked bytes) | `fd6a1618bffe880ece8a59d9dc3cdaffbcfef2c0b2b9232398231a08eb2529c3` |
| recovery tool (actual bytes) | `be89f18aa738ea93a923647182ff89c6400dfe72f718ed31fe8f5e58b81c10ab` |
| preparation helper (retained live original) | `eae3b40ab3f01877a1d2e2a18e83d277cf8d94395a1451643c3325f193dd8d0a` |
| resume outer | `d323f7022f164b00fc744f37f0144bfadbbe43955e57ad3efb342e8d2f4c7f45` |
| holder nonce | `8eb60d9c0f78aa11ce32bb2304b3e2e8` |
| sealed stage/cohort digest | `747bcfa8cf4dec5ade1c9289a7e602b4fa228bd1e78c74b2e2f4bec4b42ccd5f` |
| original whole execution-policy sha256 | **REQUIRED_FROM_ORIGINAL_TRUSTED_RECEIPT** (root-managed; never guessed, never read via refused-object workarounds) |
| original e6 execution receipt digest | **REQUIRED_FROM_ORIGINAL_TRUSTED_RECEIPT** |

The offline repaired preparation helper `018f412a8d8cedd3eca3f240c47d50041e1b812f7bf4857ac190226ac7228270` is a FUTURE candidate pin and is explicitly OUT OF SCOPE here — it must never be placed into the old TX.

## 4. The admitted recovery pass (abort-only; original mechanisms only)

If accepted, exactly ONE recovery pass may be admitted for this op/TX under ALL of:

1. **Entry**: the ORIGINAL trusted DS controlled entry only (the DS resume/execution surface driving the original outer `b7-resume` flow) — with the recovery binding expressed as a scoped, independently-digested authorization bound to §3's values, NOT as an edit of the preserved policy/receipt digests. The precise minimal controlled expression (a scoped recovery-authorization record verified by the existing DS admission checks, or the smallest equivalent extension of the accepted control surface) is left to the accepted-Spec-controlled design step; this proposal fixes only the contract, not the code.
2. **Actor/transport**: original FD9 holder-lease mechanics and the REAL Owner terminal over the original FD3 channel (genuine isatty; no synthesized input, no PTY forgery, no delegated answers).
3. **Permitted actions, in order, nothing else**: original six-target rollback (`recover-six-target` for this TX) → original carrier `--abort` → original carrier `verify-terminal`. Owner FD3 answer restricted to **ABORT**; COMMIT MUST be refused by the admission itself.
4. **Forbidden**: apply/re-apply, stage replay, any other TX, any other operation id, marker/receipt/policy digest edits, lock clearing outside the mechanism's own fence release, candidate helper `018f412a…` substitution, new operation identities.
5. **Guards preserved**: fresh drift guard (six-target rollback refuses on any drift vs recorded preimages — fail-closed, TX stays retained); single-writer guard (controller-admitted exclusive writer with verified quiescence/handoff before the pass; #929-refreshed credential files are OUTSIDE six-target rollback scope and must remain untouched).

## 5. Impact and rollback (honest bounds)

- Recovery may roll back up to the six-target homes' plugin/route state introduced by this TX during preparation: settings.yaml, profile package.json, cordis.patch.yml per affected home, plus batch-created links (11) and batch dsh-codex trees. **Zero interruption is NOT claimed**; no fleet-wide availability inference is drawn from prior canaries.
- On drift or any failure: the pass refuses/retains — TX remains PREPARED/RETAINED, nothing is clobbered, the pass may be re-admitted after reconciliation.
- On success: native TX state ABORTED; DS terminal receipt established through the ORIGINAL verify path; six-consumer health and business readback required as the completion evidence; the release of the production lane artifacts (incl. the 2026-10-11T22:31Z `production-deploy.lock` directory) follows the original DS contract only.
- The current deployed pair v10 (server `01e0b038…`, client `e2af292d…`) has the intact v9 generation `ds-reader-pair-82c413fc202d` as its exact rollback; this proposal does not alter it.

## 6. Explicitly out of scope

The later permanent B7 window (fresh baseline pins, explicit business maximum-interruption confirmation, genuine Owner dual-isatty execute, COMMIT/PONG, Gate6) is NOT approved, widened, or implied by acceptance of this amendment. Rejection leaves the e6 TX retained exactly as-is.


## 6a. Independent review conditions C1–C3 (binding on the design/implementation step; review 6115554577)

- **C1 receipt/policy integrity mechanics**: the original e6 execution-receipt artifact and the whole-policy digest are DISTINCT preserved objects. Before pass entry, the recovery record snapshots and hashes the original receipt artifact and materializes the whole-policy digest (the §3 REQUIRED_FROM_ORIGINAL_TRUSTED_RECEIPT values — materialized from the original trusted metadata at admission; placeholders never count as release pins). Terminal proof is a NEW independently-digested record; any mutable-store update carries explicit pre/post hashes proving the original artifact byte-unchanged. Historical original records and the mutable current-store coexist by distinct paths; old artifacts stay readable hash-consistent; future policy rotations must never promote or replay the original facts.
- **C2 failure/readmit semantics (A3 state machine)**: outcome classes are distinct — pre-write drift refusal (PREPARED/RETAINED, zero effects), failure after six-target journaling (original ABORTING / ABORTED_PENDING_RUNTIME_RESTORE / ABORT_INCOMPLETE states with journaled partial effects), lost response (UNKNOWN). Re-admission only via the original same-TX reconciliation honoring completed steps, partials and UNKNOWN; never a claim that an arbitrary failure "wrote nothing"; never replay of UNKNOWN.
- **C3 candidate rollback identity**: if the recovery implementation ships as a DS pair candidate, its rollback identity is the CURRENT live pair exactly (server 01e0b0389aec2216bc41cea73e96b0aaaaa093d321a461de1d16314b5b1c8dc1 / client e2af292da671ec5891aef5f9690c223daa2597dda572d963e7243682e92e1558) via the original pair assembly/ds-update mechanism; v9 (ds-reader-pair-82c413fc202d) remains only the live pair's own historical recovery and is never the new candidate's rollback pin.

## 7. Decision requested

ONE scope decision from the Owner: approve / reject / amend THIS abort-only recovery-admission contract (C1–C3 binding). Source preparation for the affected DS binding-surface delta has been separately ordered and proceeds under parent §6-step-3 + review coverage; it is NOT an Owner production approval and ships SOURCE_ONLY/NOT_PUBLISHED/NOT_ARMED. No code needs to be written by the Owner. If approved, the original author session produces the controlled implementation design under the accepted-Spec process (separate review), then the single recovery pass executes under §4.

RESOLVED 2026-10-12: the Owner accepted the §8-r3 SOURCE scope (mayf3/agent-control#424
comment 6124229746, verbatim: 批准 §8-r3 限定实现; implementation_authority=source_only,
production_apply_authority=none). The §4 recovery pass and all §8 production surfaces
(publication/install/restart, retained-object disposal, permission changes) remain
unaccepted/excluded; the implementation → tests → independent-actual-delta-review →
freeze sequence is the entirety of the accepted authority.

## 8. Bounded e6-only recovery publication/bootstrap scope (accepted for §8-r3 SOURCE scope only, 2026-10-12, comment 6124229746; production surfaces excluded; r3 — DOCS_ONLY clarification, 2026-10-12T05:5xZ; supersedes the r2 §8 text preserved in the evidence copy)

### 8.1 Publication gate — enumerated predicates and path classes (exact held references)

Gate chain (live v10 server, sha 01e0b038…, read-only excerpts already held): `DS_UPDATE` (deployment_system.py L5101-5105; peer 0/AUTHORIZED_OWNER_UID only) → `p0_maintained_ds_update` (L3586-3590) → `p0_reader_pair_guard` (L3525) → fixed-settings `diagnose` `qualified` (decoded settings module L57) requiring ALL of: `settingsMetadataComplete`, `stable`, `ownedFailedJob`, `workerState=='ENDED'`, `stageAndTransactionAbsent` (L53), `jobBundlePins`, plus `maintenancePreconditionsObserved` (server L3561-3562).

`stageAndTransactionAbsent` (settings L53) evaluates the ABSENT list (settings L14) — every entry must be ENOENT:

| class | path (settings L14) | exact-constant status in held evidence | disposition under this proposal |
|---|---|---|---|
| exempt-if-exact-bound | `DOMAIN + '/migration-transaction.json'` | DOMAIN structurally identified = `/private/var/db/agent-core/authsvc-codex-migration` (reg-row `nativeTransactionPath`, held); the settings module's own DOMAIN constant line is above the saved excerpt | the ONLY tolerated object: the EXACT retained e6 TX — id `tx-5974ef29916145a68133111f57ce3f9a`, state PREPARED, holder nonce `8eb60d9c…`, cohort seal `747bcfa8…` bound to §3; anything else → refuse |
| must-remain-absent | `DOMAIN + '/lock'` | same DOMAIN identification | the MIGRATION-domain lock — explicitly NOT the same object as `nativeLockPath` = `/usr/local/var/agent-core/production-mutation-locks/production-deploy.lock` (two similarly named locks, different roots); stays mandatory-ENOENT; the exception does NOT touch it |
| must-remain-absent | `DOMAIN + '/migration-fence.json'` | same DOMAIN identification | stays mandatory-ENOENT |
| must-remain-absent | `STAGE`, `STAGE + '/journal'`, `STAGE + '/journal/transaction.json'` | STAGE structurally identified = the DS snapshot root `Path(STATE_ROOT).parent/'agent-deploy-system-execution'/<packet>/'b7-wired-stage'` (saved sealed-module `validate_policy` extract; settings constant line not held) | stay mandatory-ENOENT; the exception does NOT touch them |
| unrelated to this gate | `nativeLockPath` = `/usr/local/var/agent-core/production-mutation-locks/production-deploy.lock` + its SEALED `holder` (e6 retained) | held: reg-row `nativeLockPath`; dir exists root-owned with holder inside | NOT in the settings ABSENT list — no exemption needed for it under the gate as decoded; its interplay with `maintenancePreconditionsObserved`/`ownedFailedJob`/`workerState` is a REMAINING UNKNOWN (below); the proposal neither widens to it nor assumes it absent |
| unrelated | credentials-metadata / stable / ownedFailedJob / workerState / jobBundlePins inputs | held excerpt L53 | unchanged by the exception; not e6 artifacts |

### 8.2 Retained e6 artifact → predicate mapping
- `migration-transaction.json` (PREPARED, exact id/nonce/seal) → ABSENT-list member → **exempt-if-exact-bound** (the sole §8 exception).
- `production-deploy.lock` + SEALED `holder` → **not an ABSENT-list member** → no §8 exemption required or granted; see UNKNOWN-2.
- stage snapshot tree (`agent-deploy-system-execution/<packet>/b7-wired-stage/…`) → ABSENT-list member → **must-remain-absent**; NOTE the known tension: the live v10 stage snapshot exists at this structural location and prior pair publications succeeded — HOW earlier publications satisfied STAGE-absent (p0 "maintained" cleanup vs operator action) is NOT proven from held excerpts (UNKNOWN-1); the exception must not depend on the answer.
- journal / fence / migration-lock → must-remain-absent; no retained e6 artifact is known to occupy them (holder/fence/journal absence consistent with the e6 output trail already on-chain).

### 8.3 First trusted bootstrap entry (the loaded DS does NOT implement the exception)
No already-supported entry exists: held source shows `p0_reader_pair_guard` has no exception path, and the client's ordinary inbox→DS_UPDATE flow requires full qualification. Therefore a NEW controlled maintenance/bootstrap surface is required, and its FIRST activation cannot be executed by the loaded v10 DS (it lacks the exception) — the non-circular first entry is the CONSTITUTED maintenance mechanics (the §4/B3-style stop → hash-pinned staged pair replacement → start sequence) applied to the **DS unit itself**, as a SEPARATE explicit Owner acceptance. Exact proposed source/contract delta, described only (NO implementation now): a scoped, independently-digested publication-qualification exception in the recovery-pair source (e6-TX-exact bound per §8.1, refuse-all-else), consumed by `p0_reader_pair_guard`'s qualification for this single pass. Sequence after acceptance: source implementation → targeted evidence/finite review → new exact pair freeze → separate production admission (publication entry + genuine FD3/FD9 + single-writer proof). **Approval of §8 does NOT make the current unchanged pair (89b4a911…/4a55662a…) publishable — that pair contains no §8 implementation.**

### 8.4 Truthful phase boundaries (replaces r2's blanket "leaves everything as-is")
- P0 pre-admission refusal (gate/exception/drift): ZERO writes anywhere; original receipt/policy/TX/holder digests recorded pre/post and equal.
- P1 publication (after exception qualification): the pair write begins — server and/or client files replaced by the ORIGINAL ds-update mechanics; interruption here is governed by the original ds_update body (NOT in held excerpts — UNKNOWN-3); last-safe phase = the pinned live pair (fresh preimage pinned AT admission — v10 is the rollback ONLY until that pin; never assumed unchanging).
- P2 post-publication verification/restart: daemon restart + loaded-identity readback; failure → rollback to the admission-pinned preimage via the same maintenance mechanics; rollback failure → last-safe phase disclosed, no false success.
- P3 recovery pass: per §4/C2 — pre-write refusals zero-effect; post-journal partials (ABORTING / ABORTED_PENDING_* / ABORT_INCOMPLETE) with journaled effects; lost outcome = UNKNOWN, never replayed.
- P4 terminal: native ABORTED + spawn-free reconciliation record; the retained TX FILE still exists (see 8.5).
- Evidence: pre/post digests for the original receipt, whole-policy digest, TX/holder bytes, and both pair SHAs at every phase boundary; each phase names its last-safe state.

### 8.5 Later publications stay blocked (no smuggled general exception)
Even after P4, the retained ABORTED TX file continues to fail `stageAndTransactionAbsent` — every FUTURE publication (including the permanent-B7 chain) remains BLOCKED until a separately accepted, legitimate cleanup/exception path exists. The §8 exception is e6-TX-exact, single-use, and MUST NOT be widened, reused, or inherited by any later publication or packet.

### 8.6 Remaining genuine unknowns (named, not invented; no fresh production read performed)
- UNKNOWN-1: settings module header (exact STAGE/DOMAIN constant definitions) and how prior publications satisfied STAGE-absent.
- UNKNOWN-2: `maintenancePreconditionsObserved` / `ownedFailedJob` / `workerState` definitions (settings body beyond L14/25/53/57) and whether the production-deploy.lock/holder participates in qualification.
- UNKNOWN-3: `p0_maintained_ds_update` / `p0_reader_pair_guard` full bodies (3525-3590) — maintenance behavior, atomicity/journal semantics of `ds_update`, and the exact insertion point of the scoped exception.
- UNKNOWN-4: OWNER-side lines: the precise first-entry maintenance invocation for the DS unit (built only after acceptance, under §8.3's sequence).
These require an ordinary bounded source read (settings decode + guard bodies) and are materialization prerequisites for the design step — placeholders are never release pins.
