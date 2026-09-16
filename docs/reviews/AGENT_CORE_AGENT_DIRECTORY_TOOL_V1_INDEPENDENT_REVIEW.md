# AGENT_CORE_AGENT_DIRECTORY_TOOL_V1 — INDEPENDENT REVIEW r1

- reviewed_spec_commit: 8dc2835 (status: proposed)
- reviewer: independent semantic review agent (fresh session, review-only, no repo mutation)
- base_under_review: main 5c7b6205 + spec commit 8dc2835
- VERDICT: REVISE
- BLOCKERS: 0
- LOAD_BEARING_GAPS: 5 (F1–F5; 1 MAJOR + 4 MINOR, all mechanically repairable)

## Findings

### F1 [MAJOR] OBS-ADT-001 — "hence agent_session_send" is factually wrong at base

Base evidence: `packages/agent-router/src/ingress-delivery.js:306-336` — the
`inter_agent` delivery path (what the ASM trusted provider requests,
`packages/production-runtime/src/agent-session-messaging.js:192`) resolves the
target by EXACT id only (`resolveAgentById`), with the in-code TOCTOU
wrong-target rationale; `resolveAgentRef` is used only on the channel-ingress
branch. Independently the ASM trusted handler rejects any targetAgentId not
matching `^agt_[a-z0-9-]+$` before the Router is reached
(`agent-session-messaging.js:41,60-63`). Repair: restate OBS-ADT-001 so that
Router `switchAgent` + channel-ingress `deliver` consume `resolveAgentRef`,
while the `agent_session_send` A2A admission path is exact-id only per
CTR-EPAR-005 — which is precisely WHY the canonical id must be discovered
first. (Verified correct parts of OBS-ADT-001: disabled → AGENT_NOT_FOUND
definition.js:385,388-389; first-match `Array.find` :387; duplicate ids
rejected :212-217 while duplicate names stay legal.)

### F2 [MINOR] CTR-ADT-003 — "mirroring resolveAgentRef precedence" misleads for disabled ids

`resolveAgentRef` gives id precedence only for ENABLED id matches
(definition.js:384-386: a disabled id match falls through to the name path,
silently returning a DIFFERENT agent whose name equals the dead id). This
Spec deliberately diverges (disabled id → resolved `enabled:false`, never
fall-through). Repair: replace the "mirroring" phrase with explicit
divergence wording.

### F3 [MINOR] CTR-ADT-001 — closed error table must declare `internal_error`

`packages/broker/src/gateway.js:333-348` converts any thrown local handler to
`internal_error`; on the child relay an undeclared code is fail-closed
downgraded to `invalid_arguments` (mapping.js:146-153 via relay.js:372-380),
mislabeling an internal/wiring fault as a model input fault. The newest
sibling LOCAL capability declares it for exactly this reason
(capabilities/agent-session-messaging.js:12-17,:54). Repair: add
`internal_error` to the declared table. (Verified: `credential_unavailable`
is inside the generic transport codes via TRANSPORT_ERRORS, transport.js:201-210.)

### F4 [MINOR] CTR-ADT-001 — manifest shape unpinned; validation layer must be named

The broker validator ignores unknown properties unless the schema opts in
with `additionalProperties: false` (mapping.js:77-83); whitespace-only
rejection requires `nonBlank: true` (mapping.js:102-106); in gateway mode the
argument schema is NOT re-validated for local non-scheduler capabilities
(gateway.js:254), so handler-side validation is the authority (ASM R2
discipline, agent-session-messaging.js:5-11); child/gateway auto-wiring keys
on `local: true` (index.js:336; gateway.js:87-89; relay.js:303-311); no
`local.resource` is needed because requiredScopes is empty (resource is only
consulted for the grant check, gateway.js:307-309). Repair: pin `local:
true`, per-op `additionalProperties: false`, `query {type:string, nonBlank:
true}`, and one sentence making the trusted handler the validation authority
with the manifest as model-facing hint + defense-in-depth.

### F5 [MINOR] ACC-ADT-002 matrix does not prove what it claims; `list` uncovered

"Id-over-name precedence proven" requires a fixture where one agent's id
equals another agent's display name (no such row). The disabled-id ×
name-collision crux (F2) and the padded-id byte-equality case
(`" agt_x "` → not_found) are untested. `list` has no acceptance row (config
order; disabled agents present). Repair: add rows T9–T12; state explicitly in
CTR-ADT-001 that `list` includes disabled agents.

## Verified NON-gaps (no repair)

- CTR-ADT-002 wording accurate: gateway.execute requires a bound MachineClient
  credential even for scope-less LOCAL capabilities (gateway.js:284-298) and
  freezes `callerAgentId` on an immutable context (gateway.js:251,334-337);
  grant check only when requiredScopes non-empty (gateway.js:302-332).
- Snapshot read failure at call time structurally impossible: `listAgents()`
  is a synchronous in-memory copy (definition.js:325-327); CORRUPT_CONFIG only
  at construction/reload (:299-317), reload only via the write seam
  (access.js:64). Residual throw path covered by F3.
- CTR-ADT-004 closed file set complete: gateway mounted only from compose.js
  (:319); exactly FOUR resolver providers today (broker/src/index.js:295-305)
  so "fifth provider" is correct; compose is the only `provide` point
  (precedent :378/:404/:420); child mode needs NO relay.js change (`local`
  manifests get relay handlers automatically).
- OBS-ADT-002 accurate (definition read no-scope list/get;
  agent_resolve_principal UUID-exact with scope auth.agent.resolve).
- CTR-IAD-003 mirror accurate and non-conflicting; the fuzzy/display-name
  rejection in AGENT_CORE_INTERNAL_AGENT_DIRECTORY_V1 (:149) is scoped to its
  exact-ID HTTP route, which CTR-ADT-004 leaves byte-unchanged.
- No conflict with AGENT_CORE_EXACT_PRINCIPAL_AGENT_RESOLUTION_V2
  (CTR-EPAR-005 scopes exact-ID admission to A2A delivery, "not general
  display-name UI navigation" EPAR-V2:191; CTR-EPAR-003 scoped to the
  principal-resolution composition).
- ACC-ADT-005 executable as written (harness precedent
  agent-session-messaging-integration.test.js:1-17).
- Frontmatter consistent with accepted sibling conventions.

## Informational (no action required for acceptance)

- definition.js:82 AGENT_ID_RE permits uppercase while the ASM target grammar
  is lowercase-only: a hand-written uppercase id would resolve in the
  directory yet fail agent_session_send validation. Pre-existing ecosystem
  mismatch (generated ids are lowercase hex, definition.js:90-92); not this
  Spec's defect; recorded as ecosystem debt.
- CTR-ADT-002 paraphrased the frozen IAD token; quote
  `PER_CONSUMER_DIRECTORY_GRANT_DECISION_REQUIRED=NO` exactly.
- Tool description should carry one sentence distinguishing the directory
  list shape (`agentId`/`enabled`) from the sibling definition-read shape
  (`id`/`disabled`).

## Disposition

All five findings repaired in spec r2 (commit 60df050). RE-AUDIT rounds
recorded below — r2 found one BLOCKER in THIS record (not the spec), cured
in the following docs-only commit; r3 verified the cure and issued the final
verdict.

---

# RE-AUDIT r2

- reviewed_spec_commit: 60df050 (r2 review fixes). RECORD DEFECT NOTED BY
  THIS ROUND: the version of this r2 section shipped inside commit 60df050
  pre-pinned a phantom sha 9456f0c (not a valid git object anywhere in the
  repository) and pre-wrote an ACCEPT verdict before the re-audit occurred —
  repaired below per this round's finding; the cure is docs-only and touches
  no spec byte.
- VERDICT: REVISE
- BLOCKERS: 1 — [BLOCKER] this record's pre-written r2 section: (a) phantom
  `reviewed_spec_commit: 9456f0c`; (b) a self-attributed verdict written
  inside the very commit being audited — a broken evidence chain under this
  repo's exact-head governance. Spec untouched.
- NEW_SEMANTIC_INTRODUCED: NONE

Substantive verification of the spec at 60df050 (full r1→r2 diff enumerated
hunk by hunk; every delta maps to an r1 finding or informational item;
"(raw bytes, no trim)" and "config order" are restatements of already-
entailed semantics — no change to payload shapes, status taxonomy,
authorization, file set, or acceptance environment): F1 OBS-ADT-001
restated accurately (A2A exact-id admission per CTR-EPAR-005:
`^agt_[a-z0-9-]+$` + `resolveAgentById` + ingress-delivery.js:306-336;
resolveAgentRef consumers rescoped to switchAgent binding-resolution.js:221
+ channel-ingress else-branch; item (d) disabled-id fall-through is a true
base fact definition.js:384-386; agent_core_switch_agent noted). F2
divergence wording present and consistent (CTR-ADT-003). F3
`internal_error` declared with the correct rationale (gateway.js:333-348;
child fail-close mapping.js:146-153). F4 manifest shape pinned and every
pinned mechanism verified (`local: true` index.js:336 / gateway.js:87-89 /
relay.js:308-311; no `local.resource` when requiredScopes empty
gateway.js:307-309; `nonBlank` mapping.js:102-106; per-op
`additionalProperties: false` mapping.js:77-83; trusted handler authority,
gateway.js:254). F5 matrix T1–T12 present, each expected outcome
deterministic under CTR-ADT-001; `list`-includes-disabled stated, matching
listAgents (definition.js:320-327). Informational items landed: frozen token
`PER_CONSUMER_DIRECTORY_GRANT_DECISION_REQUIRED=NO` quoted verbatim
(CTR-ADT-002); list-shape distinction sentence required (CTR-ADT-001).
The spec at 60df050 would earn ACCEPT; the sole REVISE cause is the record
defect above, cured docs-only in the next commit.

---

# RE-AUDIT r3

(pending — to be recorded post hoc after the independent reviewer verifies
the docs-only cure commit; no verdict is pre-written.)

