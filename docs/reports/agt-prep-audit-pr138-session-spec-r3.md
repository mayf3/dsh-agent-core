# agt-prep-audit-pr138-session-spec-r3 — independent audit of PR #138 (AGENT_CORE_AGENT_SESSION_MESSAGING_V1 r2 → r3)

- AUDITOR: independent audit subagent, goal PRODUCTION_RND_PARALLEL_PREPARATION_V1 (PREPARATION TRACK); did not author the audited artifacts
- AUDIT OBJECT: branch `prep/session-spec-revision-v1` @ eaa3e3d (merge of 04e0c81 investigation + 037249f spec r3); OPEN Draft PR #138 — NOT merged by this audit
- BASELINE: github/main 840d2f4ad91f8252eb1f163330c041216a0dd9c4; original r2 draft read from the maintainer checkout (`/Users/yanfenma/workspace/project/dsh-agent-core/docs/specs/AGENT_CORE_AGENT_SESSION_MESSAGING_V1.md`, read-only)
- METHOD: full r2→r3 diff reviewed hunk-by-hunk; every code/Decision citation in the REVISED text independently re-read at BASE in the audit worktree; no trust in author claims

## VERDICT: PASS (0 blockers, 0 majors, 2 minors, 3 notes)

---

## A. Frontmatter / perimeter — PASS

- `status: proposed`; `implementation_authority: none`; `production_apply_authority: none`; `spec_kind: implementation`; `authority_level: governing_spec`; `supersedes: []`; `superseded_by: null`; `spec_id: AGENT_CORE_AGENT_SESSION_MESSAGING_V1` unchanged; `owners` unchanged. No authority elevation anywhere in r3 (the §2.2 gate explicitly keeps `IMPLEMENTATION_AUTHORITY = NONE` and `IMPLEMENTATION_BEFORE_SPEC_ACCEPTANCE = FORBIDDEN`).
- `revision: r3` + `revision_date: 2026-09-02` + structured `change_log` block present, with `audit_base` 840d2f4 and `investigation_input` pointing at the R1 investigation branch @ 04e0c81.

## B. Fix traceability — PASS (every claimed fix located, matches the investigation, and every citation reproduced at BASE)

Author report `docs/reports/agt-prep-session-spec-revision-v1.md` claims F10, F9, F12, F19, F22, F23 (+F8/G8 note). Verification per fix:

| Fix | Changed text located | Matches investigation | Citations re-verified at BASE |
|---|---|---|---|
| F10 (major) | frontmatter `related_decisions` V2→V3; §2.2 rewritten (alignment executed at BASE; `DECISION_ALIGNMENT_REQUIRED = NO`); §10 review item 1 rewritten; §8 intro de-conditioned; final fields add `GOVERNING_DECISION` / `DECISION_ALIGNMENT_REQUIRED = NO` | matches R1 F10 ("alignment HAS been executed; spec stale") | V3 frontmatter:3,14-15 (supersedes D-006 whole); V3:19-22 (r2 as read-only proposed input); V3:57-58 (cron fresh non-main); V3:363-376 (freeze TARGET_MAIN / one send = one new Run/Turn, NOT one new Session); V3:381-388 (`agent_session_send` naming); V3:395-405 (Delegation PER_TASK untouched); V3:976-999 (§29 deferral, `agent_session_send implementation` at :981); acceptance commit b2e3eb1 confirmed; `docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V2.md` carries `superseded_by: D-008` — ALL REPRODUCED |
| F9 (minor) | §4 R1 states execute-time resolver is a closed two-service merge and names the needed generalization; §8 MOD list adds `packages/broker/src/index.js` and declares it the only predicted broker source change besides the manifest | matches R1 F9 + G3/G11 | `packages/broker/src/index.js:272-275` = merge of exactly `agentDefinitionAccess` + `selfServiceSchedulerAccess` — REPRODUCED |
| F12 (minor) | §4 R2 new paragraph: 1..65536 UTF-8 byte bound + NUL-forbidden enforced by the trusted handler; broker structural validation cannot express them; manifest bounds are defense-in-depth only | matches R1 F12 | `packages/broker/src/mapping.js:99-106`: string spec supports only `minLength` (L101) + `nonBlank` (L106); no maxLength/byte/NUL anywhere in the validator — REPRODUCED |
| F19 (minor) | §4 R8 closed mapping adds `available + terminated_without_outcome -> outcome_unknown` and `no_output + terminated_without_outcome -> outcome_unknown` with rationale paragraph; §7 never-a-success list + ordering case updated | matches R1 F19 + G9 | `packages/agent-router/src/reconciliation/state-machine.js:13` `LATE_OUTCOMES` includes `terminated_without_outcome` — REPRODUCED |
| F22 (minor) | §4 R12 opens "The L0/L1 audit surface is NEW code", citing the scheduler precedent with "pattern reused, store not"; §8 marks the audit surface NEW | matches R1 F22 + G6 | `packages/scheduler/src/self-service.js:235` `appendAudit` — REPRODUCED; `packages/production-runtime/src/compose.js:440-450` sanitized `onAuditFailure` wiring (448-450) — REPRODUCED |
| F23 (minor) | §5 adds `transport_failure` / `unsupported_operation` to the required taxonomy with a rationale paragraph (taxonomy membership, not remapping) and the fail-closed downgrade argument; §4 R12 coarse `result` mapping clarified (vocabulary NOT grown) | matches R1 F23 + G14 | `packages/broker/src/gateway.js:246-248` (grant-check transport_failure) and `gateway.js:171-174` (missing local handler → `unsupported_operation`) — REPRODUCED; `mapping.js:146-153` undeclared-code fail-closed to `invalid_arguments` — REPRODUCED |
| F8/G8 (note) | §8 adds local-manifest relay-path test coverage; "no relay.js repair" | matches R1 F8 + G8 | `packages/broker/src/relay.js:153-155` local manifests relayed — REPRODUCED |

Citations I could NOT reproduce: NONE. (All revised-text citations re-read at BASE; r2-inherited §3 citations spot-checked — `ingress-delivery.js:221-226` caller-sessionId rejection and `session-seam.js:164` `source:{kind:'user'}` and `turn-execution.js:334-336` messageId receipt all reproduce.)

## C. Semantic drift — PASS (0 undeclared substantive deltas; frozen semantics intact)

Full r2→r3 diff (241 diff lines) reviewed hunk-by-hunk. Every substantive delta maps to a declared fix: frontmatter/banner/§2.2/§10/final-fields (F10), §4 R1 + §8 (F9), §4 R2 (F12), §4 R8 + §7 (F19), §4 R12 + §8 (F22, F23), §5 (F23), §8 test line (F8/G8). Remaining hunks are the change_log itself, banner status text, and grammar-level rewraps.

Frozen target semantics verified unchanged in r3:
- timeout=0 → return after inbox receipt; timeout>0 → wait for this exact Run's one aggregated final assistant reply (§0 model block intact);
- outcome non-conflation: proven success/reply never fabricated from retained text; `terminated_without_outcome` maps to `outcome_unknown` and never to `replied`/`target_run_failed`/empty reply (F19 rows are additive and preserve the r2 proven-vs-unknown convention);
- no auto-replay, no auto B→A ping-pong, no arbitrary sessionId/sessionKey targeting, target-own Principal/credential/Grant — all untouched;
- Delegation (V3 §12 PER_TASK non-main) explicitly out of scope; Messaging-only scoping preserved.

## D. Internal consistency — PASS

- `related_decisions` cites only D-008 as current; D-006/V2 appear solely as superseded (§2.2 records the whole-supersession). No superseded authority is cited as current anywhere.
- §8 predicted scope, §10 review-gate items, and the final-fields block agree with each other and with the change_log (resolver edit = only broker src change besides manifest; audit surface NEW; error table must declare both F23 codes).
- Section numbering, §4 R-numbering, §7 mandatory-case list, and the banner all consistent.

## Findings

- F1 (minor): r3 keeps r2's `related_specs` wake entry with disposition note "Draft PR #130; close as obsolete" verbatim. Declared intentional in the author report; harmless (a disposition note, not a live dependency), but it will read stale once PR #130 is actually closed.
- F2 (minor): §3 evidence-line citations were left exactly as r2 wrote them (declared). R1 re-verified the underlying flows as CONFIRMED and the audit spot-checks reproduce them, but a few line anchors are untested here (e.g. `process-registry.js:87-139`, `evidence-buffer.js:27-29`); risk is low because they are evidence prose, not contract text.
- N1 (note): F23's coarse L1 `result` bucket mapping (`denied` vs `failed`) is a clarifying sentence, not a schema change — correctly avoids growing the frozen audit vocabulary.
- N2 (note): the change_log's fix list is exactly the investigation's REVISE set (1 major + 5 minor + 1 note); no investigation finding is dropped without record.
- N3 (note): PR must remain OPEN / not merged until its independent spec-acceptance round; acceptance itself is out of this audit's scope.

## E. Boundary compliance (this branch)

`prep/session-spec-revision-v1` @ eaa3e3d: merge-base with 840d2f4 = 840d2f4 (base correct); 3 commits (04e0c81, 037249f, eaa3e3d); changed paths = 5 ADDED files only, all under `docs/investigations/`, `docs/reports/`, `docs/specs/`, `evidence/`. Zero product-code changes; `packages/broker/src/capabilities/workflow.js` blob identical to BASE (83df50eb); no transition-closure/recovery/rollback/deployment-authority doc touched; secret scan clean. See agt-prep-audit-boundary-compliance.md.

## F. Verdict

**PASS.** PR #138 accurately discharges every fix its change_log claims, against investigation findings that this audit independently re-anchored at BASE. No authority elevation, no undeclared drift, no frozen-semantics change, no unreproducible citation. Recommended: proceed to the spec's independent acceptance round with findings F1/F2 noted (neither blocks acceptance).
