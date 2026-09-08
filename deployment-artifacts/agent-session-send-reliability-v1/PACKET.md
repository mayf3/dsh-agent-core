# AGENT_SESSION_SEND_RELIABILITY_V1 — Deployment Packet (r1, FROZEN)

- date: 2026-09-08
- frozen candidate head: `1d70571b9b94af0d337b2ef2e9f86560b822587d` (branch `impl/agent-session-send-reliability-v1`)
- base: main `db93649` (AMENDMENT_1 accepted via PR #202, merge 8994aa5)
- authority: AGENT_CORE_AGENT_SESSION_MESSAGING_V1 accepted r3 + **AMENDMENT_1 accepted r4** (PR #202 @8994aa5) + **AMENDMENT_2 accepted r5** (PR #212 @f4ebfee — AGENT_PROCESS_EXITED unified matrix + outcome_unknown phase split; independent review chain in frontmatter; independent implementation audit r1 ACCEPT/NONE + AMENDMENT_2 delta audit)
- GOVERNING_SPEC_UNMODIFIED: PASS (`git diff db93649..1d70571 -- docs/specs/` is empty)

## ⚠ HOLD — PRODUCTION_APPLY = HOLD_WHILE_P0_OWNS_SLOT

P0 (WORKFLOW_ASSIGNEE_CANONICAL_IDENTITY_RECONCILIATION_V1) owns the production mutation
slot. This packet is FROZEN; do not poll, do not regenerate. On
`P0_PRODUCTION_MUTATION_SLOT_RELEASED = YES`: RESUME SAME GOAL → fresh-verify affected
coordinates only → the §11 fresh deployment-authority round (below) → preflight §C →
apply §D → post-verify §E.

## A. What ships (semantic closure)

1. **§5.2 render detail** — `agent_session_send` model-visible failures carry the structured
   reason (`reply_unavailable: reply unavailable (no_output)`); opt-in via the new
   `renderErrorDetail` manifest marker (schema-copied).
2. **§5.2 audit persistence** — L1 `failed` outcome rows persist `failureCode`
   (+ `failureReason` for reply_unavailable and the post-receipt malformed-receipt marker);
   intent/outcome rows persist `invocationCorrelation`. Per-reason delivery history becomes
   recoverable from evidence (was unrecoverable).
3. **§5.3 anchor** — child relay mints an opaque `invocationCorrelation` per send RPC
   invocation; forwarded at the trusted parent-RPC boundary (type-checked 8..128 printable;
   identity stays gateway-derived); persisted verbatim in L1 rows.
4. **§5.3 reconcile capability** — `agent_session_send_reconcile` (`infrastructure: true`,
   NEVER a model tool; gateway-executable; reuses `agent.session.send` — GRANT_CHANGE=NONE);
   read-only `lookup` over the file-backed rotating L1 chain (live + `.1`; restarts survive;
   rotation is the only evidence loss; corrupt evidence degrades to UNKNOWN).
5. **§5.3 relay duty** — EXACTLY ONE lookup at each of the two unknown capture points
   (transport throw; malformed/undeclared parent envelope), then the closed conversion:
   DELIVERED per outcome row (replied ⇒ `replyTextAvailable:false`), NOT_DELIVERED only under
   proven retention coverage, UNKNOWN final ⇒ NO_AUTOMATIC_RETRY. The send is NEVER replayed.
6. **§5.1a/§5.2/§5.3 AMENDMENT_2 (AGENT_PROCESS_EXITED corpus)** — post-receipt outcome_unknown rows carry the `post_receipt` marker + canonical proven-receipt render detail (DELIVERED + UNKNOWN); pre-receipt admission-unproven stays unmarked UNKNOWN (the Router's C-004/C-017 boundary doctrine consumed — NOT_DELIVERED never fabricated at the process boundary); §5.3 conversion row outcome_unknown+post_receipt ⇒ DELIVERED + UNKNOWN; AGENT_PROCESS_EXITED is a reason, never a delivery status.
7. **§5.1a real acceptance case (AGENT_PROCESS_EXITED_RECOVERY_V1 frozen facts)** — a BARE AGENT_PROCESS_EXITED carrier (initialize/startup death: process never READY, no prompt write existed) maps to not_admitted ⇒ NOT_DELIVERED, directly caller-visible with the reason preserved; envelope-carrying boundary shapes stay unproven UNKNOWN (Router C-004/C-017 doctrine consumed, never modified).
8. **Pre-existing defects fixed (A/B-proven on base, on the session-send critical path)** —
   broker child-mode apply crashed with ReferenceError (`withSchedulerMutationMask` was
   re-exported but never imported into module scope): EVERY source-main child tool
   registration was dead; agent-router seam tests still asserted pre-§5.2-hardening scheduler
   semantics (updated to the shipped state machine).

Known NOT shipped (deliberate): durable persistence beyond the rotating window (§6 non-goal);
reply-text recovery after a lost `replied` response (`replyTextAvailable:false` is the honest
terminal); self-send; HR-side retry logic (forbidden by the Owner).

## B. Frozen file closure

`FILE_CLOSURE.sha256` — sha256 of the 13 changed files at the frozen head. Preflight gate:
hashes of the deployed bytes MUST equal this table post-apply (§E).

## C. Preflight (all read-only; run at resume)

```text
C1  fresh census: P0 slot state = RELEASED (Owner confirm; no polling before that)
C2  base check: production tree currently at the 2026-09-05 deployment (relay blob 2ec4acf);
    clean worktree at 1d70571 with node_modules hybrid (main-repo entries + @deepseek-ai/@larksuite
    from the deployed tree)
C3  suites at the frozen head (pinned node v25.6.1 + proxy-free env — HARD preconditions):
    broker 375/375 · agent-router 311/311 · scheduler 191/191 · scheduler-router 22/22 ·
    production-runtime 181/188 (the 2 failures are A/B-identical on base: cross-agent-history
    logical_key fixture drift; arm64 closure inspection — NOT blockers)
C4  re-run the phase-1 probe: docs/evidence/agent-session-send-reliability-v1-20260908/probe/
    discriminating-failure-injection.mjs (must print the same §4/§5 verdicts)
```

## D. Apply (bounded, stage-first — ONLY after the §11 authority round)

Per accepted §11 DEPLOYMENT_AUTHORITY_NOTE: before ANY production mutation, run the fresh
deployment-authority round under AGENT_SESSION_SEND_STANDALONE_DEPLOYMENT_AUTHORITY_V1
(frozen AUTHORIZED_RELEASE_SOURCE) covering this packet (fresh preflight → authority
record → apply authorization). Then:

```text
D1  stage the 5 src files (+3 test files, non-production) into the release staging area
D2  boot rehearsal on the staged tree (proxy-free env, pinned node) — health + manifests:
    agent_session_send present; agent_session_send_reconcile ABSENT from every model tool list
D3  cutover via the established launchd/copy path; restart the canonical runtime (authsvc domain)
D4  read-back: FILE_CLOSURE.sha256 over the deployed bytes — ALL MATCH
```

Rollback: `ROLLBACK.md` (preimage capture before D1; restore + restart + read-back).

## E. Post-verify (bounded canary + evidence)

```text
E1  probe repeat against the live runtime: reply-side failure surfaces WITH the reason
E2  §5.3 live injection (Owner-gated A2A canary per the standing gates): receipt committed →
    response lost → reconcile DELIVERED → one inbox receipt → one target Run → zero redelivery
E3  EXACTLY_ONCE_SESSION_DELIVERY=PASS · NO_AUTOMATIC_RETRY=PASS · NO_DUPLICATE_DELIVERY=PASS ·
    DELIVERY_STATUS_UNAMBIGUOUS=PASS · REPLY_STATUS_INDEPENDENT=PASS (evidence rows E1/E2 +
    the frozen test suite)
E4  audit read: L1 rows carry failureCode/failureReason/invocationCorrelation
E5  follow-up (deployment round): confirm the auth-service grant is scope-keyed (not
    resource-qualified) so the reconcile capability's nominal resource
    'agent-session-messaging-reconcile' cannot deny lookups — audit r1 note 6
```

## F. VERDICT

```text
READY_FOR_PRODUCTION_APPLY = YES (candidate frozen @ 1d70571; packet frozen @ this file)
PRODUCTION_APPLY = HOLD_WHILE_P0_OWNS_SLOT
GOAL_STATUS = BLOCKED_BY_DEPENDENCY (until P0_PRODUCTION_MUTATION_SLOT_RELEASED = YES)
OWNER_ACTION_REQUIRED = NONE (resume is Owner-signalled, not polled)
```
