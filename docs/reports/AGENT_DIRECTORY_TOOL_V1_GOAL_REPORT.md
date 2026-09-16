# AGENT_CANONICAL_IDENTITY_DISCOVERY_TOOL_V1 — GOAL REPORT

date: 2026-09-16 · branch: `goal/agent-directory-tool-v1` (base = main `5c7b6205`) ·
evidence: `docs/evidence/agent-directory-tool-v1-20260916/` ·
spec: `docs/specs/AGENT_CORE_AGENT_DIRECTORY_TOOL_V1.md` (accepted) ·
review: `docs/reviews/AGENT_CORE_AGENT_DIRECTORY_TOOL_V1_INDEPENDENT_REVIEW.md`

## Required fields (Goal §十二)

```text
CURRENT_MAIN_SHA = 5c7b62055e40e3ad0c7ec80a2896a51fd0e33814 (mayf3/dsh-agent-core main)

CANONICAL_IDENTITY_SOURCE = packages/agent-definition (AgentDefinition over the ONE
  deployment-owned agents.json; records exactly {id: agt_*, name, description, disabled};
  existence/enabled truth frozen by accepted AGENT_CORE_INTERNAL_AGENT_DIRECTORY_V1;
  "Agent ≠ Auth Principal" — principal/client/grant stay in auth-service)
EXISTING_RESOLVER_REUSED = YES — the tool is a thin read projection over the existing
  AgentDefinition snapshot (listAgents); exact-id/exact-name classification reuses the
  SAME authority the Router (switchAgent/deliver) already consumes. No second registry,
  no cache, no mapping state, no DB.
TOOL_CONTRACT = agent_directory (capability `agent.directory`, LOCAL, no requiredScopes):
  resolve {query} → {status:'resolved', agent:{agentId,name,description,enabled}} |
  {status:'ambiguous', query, candidates:[{agentId,name,enabled}...]} |
  {status:'not_found', query};  list {} → {agents:[...]} (config order, disabled
  included). Exact-only: canonical agt_* id bytes first (raw, no trim), else exact
  display name after trim+lowercase fold. Disabled id resolves enabled:false and NEVER
  falls through to the name path (deliberate divergence from resolveAgentRef, whose
  disabled id match silently falls through — OBS-ADT-001(d)). Whitespace/non-string →
  invalid_arguments envelope, never a status. Per-consumer lookup identity FORBIDDEN
  and NOT created (baseline directory read, PER_CONSUMER_DIRECTORY_GRANT_DECISION_REQUIRED=NO).
FILES_CHANGED =
  docs/specs/AGENT_CORE_AGENT_DIRECTORY_TOOL_V1.md            (NEW, accepted)
  docs/reviews/AGENT_CORE_AGENT_DIRECTORY_TOOL_V1_INDEPENDENT_REVIEW.md (NEW)
  packages/broker/src/capabilities/agent-directory.js         (NEW — manifest, pure data)
  packages/production-runtime/src/agent-directory.js          (NEW — trusted provider)
  packages/broker/src/index.js                                (manifest + 5th local provider)
  packages/production-runtime/src/compose.js                  (provide agentDirectoryAccess)
  packages/broker/test/agent-directory.test.js                (NEW, 12 tests)
  packages/production-runtime/test/agent-directory.test.js    (NEW, 15 tests)
  packages/production-runtime/test/agent-directory-session-send-e2e.test.js (NEW, 5 tests)
  docs/evidence/agent-directory-tool-v1-20260916/*            (NEW, run logs)
  commits: 8dc2835 r1 → 60df050 r2(review fixes) → d32ef13 record cure → ef1128d ACCEPTED
  → d0ca733 implementation → c3d9d23 tests
TESTS = 32/32 PASS (`node --test` under /usr/local/bin/node v25.6.1, proxy-free env —
  the runtime's pinned composition gate): broker manifest/registry/relay/gateway 12;
  semantic matrix T1–T12 + zero-side-effect 15; composed-runtime E2E 5. Full-repo suite
  regression vs clean base 5c7b620: identical failure sets (10 environment-preexisting:
  voice/audio, scheduler seam, plugin-boot T3, lockfile pin — T3 PROVEN failing with the
  implementation reverted to base; agent-switch + harness tests fail identically in
  isolation on both trees), ZERO new failures. GOVERNING_SPEC_UNMODIFIED verified
  (git diff ef1128d..HEAD -- docs/specs/ = empty).
REAL_E2E = PASS (ACC-ADT-005): composed production runtime, REAL broker gateway + REAL
  parent-RPC relay + REAL trusted directory/send providers + REAL router admission
  chain + real session seam; deterministic fake child processes + stub auth-service.
  The caller fixture carries ONLY { targetDisplayName: '文章发布管家' } — mechanically
  asserted to contain NO agt_* literal; the canonical id enters the send args ONLY as
  `lookup.result.agent.agentId`; the target receives EXACTLY one inter_agent prompt in
  its canonical main. Negatives: unknown name → not_found with ZERO deliveries;
  whitespace → invalid_arguments with ZERO deliveries; disabled target → resolved
  enabled:false then the send is refused target_disabled with zero target process.
OLD_MANUAL_ID_DEPENDENCY_REMAINING =
  (a) agent_core_switch_agent still accepts a display name (side-effectful binding
  switch — unchanged accepted surface, out of scope);
  (b) workflow/HR/forum consumers not yet wired to discovery (their accepted authorities
  are unchanged; adoption is follow-up debt);
  (c) ecosystem debt (pre-existing, recorded): resolveAgentRef's disabled-id fall-through
  and the AGENT_ID uppercase vs ASM lowercase grammar mismatch remain in their own
  surfaces — the directory itself is exact and divergence-safe.
FOLLOW_UP_DEBT =
  1. Deployment/adoption of the branch (PRODUCTION_APPLY=none in this Goal — no
     production mutation was performed);
  2. agent UX rollout: tool description steers discovery-before-send; consumer specs
     (workflow assignee, HR dispatch) may reference the directory as their resolution
     primitive in their own amendment cycles;
  3. model-turn-level E2E (a live LLM agent turn) was NOT run — requires a deployed
     runtime + model quota; the runtime-level chain it would exercise is fully real
     and covered above.
FINAL_STATUS = COMPLETE (autonomous chain per Owner GOAL directive; no Owner gate
  consumed; zero production mutation; zero STOP conditions hit)
```

## Acceptance criteria (Goal §十一)

| Criterion | Result | Proof |
|---|---|---|
| CANONICAL_IDENTITY_SOURCE_IDENTIFIED | YES | AgentDefinition (§三 answers in spec OBS-ADT-001/002/003) |
| SECOND_AGENT_REGISTRY_CREATED | NO | closed file set (CTR-ADT-004); provider holds zero state |
| AGENT_DIRECTORY_TOOL_AVAILABLE | YES | DEFAULT_MANIFESTS registration test + buildToolDefinition enum test |
| LOOKUP_BY_HUMAN_REFERENCE | YES | T3/T4/T7/T9 (name, padded name, id-shaped name, id==name precedence) |
| LIST_DISCOVERABLE_AGENTS | YES | list op + T12 + E2E list |
| AMBIGUITY_EXPLICIT | YES | T5 — full candidate set, config order, never a pick |
| NOT_FOUND_EXPLICIT | YES | T6/T11 + E2E negative |
| AUTHORIZATION_FILTERED | YES | byte-identical to the accepted agent.definition.read baseline (no expansion, no new grant); credential gate proven (uncredentialed caller → credential_unavailable before the handler) |
| DOWNSTREAM_CANONICAL_AGENT_ID_ONLY | YES | CTR-ADT-005 discipline + ASM exact-id admission (CTR-EPAR-005) + E2E id-flow assertion |
| DIRECTORY_TO_SESSION_SEND_E2E | PASS | composed-runtime test: name-only caller → resolve → send → target received (inter_agent provenance exact) |

## Architecture answers (Goal §三)

1. **Canonical agent_id source of truth**: `packages/agent-definition` — one JSON config
   (`agents.json`), frozen record shape `{id, name, description, disabled}`, `agt_*` ids
   minted once and immutable; existence/enabled truth authority per accepted
   AGENT_CORE_INTERNAL_AGENT_DIRECTORY_V1. Principal/client/grant identity is a SEPARATE
   auth-service authority linked by the exact agentId string.
2. **Existing resolvers**: `AgentDefinition.resolveAgentRef` (id→name navigation; used by
   Router switchAgent + channel-ingress deliver), `getAgent`, `listAgents`,
   `agent_resolve_principal` (exact Principal UUID→agentId), HTTP
   `/v1/directory/agents/:agentId` (exact exists/enabled). `agent_session_send` is
   EXACT-ID only (ASM grammar + `resolveAgentById`; TOCTOU wrong-target rationale).
3. **Name/principal→id mapping points**: exactly ONE name mapping point
   (`resolveAgentRef`); no hardcoded maps, no alias fields, no display_name columns
   anywhere (greps: 0 hits). Its two hazards (silent first-match on duplicate names,
   disabled-id fall-through) are what the directory tool classifies explicitly.
4. **Existing list/search capability**: `agent_definition_read` (list/get) was ALREADY
   Agent-facing and open to every credentialed agent; what was missing was the
   reference-RESOLUTION primitive with explicit statuses — now exposed as
   `agent_directory` reading the same snapshot (definition read unchanged).
5. **Authorization layer**: Router stamps the actual caller (child-claimed identity
   ignored); gateway requires a bound MachineClient credential for every local call
   (fail-closed credential_unavailable); `requiredScopes` grant checks via auth-service
   — the directory declares none and therefore sees EXACTLY the accepted definition-read
   baseline. No workspace/tenant ACL layer exists; inventing one was rejected
   (would be a new permission model).

## Governance record

- Standing order: fresh inspect → preflight (embedded in the spec) → NEW spec (no
  accepted spec covered a display-name resolution primitive; the HTTP directory route's
  exact-only rejection was NOT reopened — different surface, preserved byte-identically).
- Acceptance authority basis: Owner GOAL directive (2026-09-16) pre-ruled semantics and
  ordered the lifecycle incl. implementation — same pattern as AGENT_SESSION_SEND_V1 r5
  AMENDMENT_2.
- Independent review chain (all recorded): r1 REVISE (5 load-bearing gaps: A2A
  exact-id fact fix, disabled-id divergence, internal_error declaration, manifest-shape
  pinning, matrix T9–T12) → fix 60df050 → r2 REVISE (1 blocker: the REVIEW RECORD itself
  pre-pinned a phantom sha + pre-wrote a verdict — cured docs-only d32ef13; spec clean)
  → r3 ACCEPT / BLOCKERS NONE, verdict quoted verbatim, nothing pre-written.

## SPEC_COMPLIANCE

```text
SPEC_COMPLIANCE = PASS
GOVERNING_SPEC_UNMODIFIED = PASS (0 diff lines vs ef1128d)
Out-of-spec behavior = NONE found
Rejected alternatives reintroduced = NONE (no second registry; no fuzzy matching; no
  per-consumer lookup identity; no hardcoded name→UUID; no UUID-in-prompt/fixture)
SPEC_GATE = PASS (accepted spec, contracts CTR-ADT-001..006 implemented 1:1)
TESTS = PASS (32/32 goal tests; full-suite regression clean)
```
