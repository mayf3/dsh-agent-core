---
spec_id: AGENT_CORE_AUTHSVC_SHARED_CODEX_ACTIVATION_RECONCILIATION_V2
status: accepted
accepted_by: mayf3
accepted_date: 2026-10-04
reviewed_head: b7060c2c37ef67b1155064fc753d502fdf025208
acceptance_record: https://github.com/mayf3/dsh-agent-core/pull/452
implementation_authority: contracts
supersedes:
  - AGENT_CORE_FLEET_SHARED_CODEX_AUTH_ACTIVATION_V1_AUTHSVC_RECONCILIATION_AMENDMENT
parent_authority: AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V3
production_apply_authority: none
review_gate: independent exact-head review PASS; Owner accepted the reviewed head; final acceptance commit bound in PR 452
proposal_revision: BOUNDED_COHORT_PUBLIC_PROPOSAL_V1
operation_scope: existing Product 414 B7 deployment only
source_preparation_authority: accepted contracts once merged into implementation base
---

# Shared Codex activation reconciliation V2 — accepted

Preserve every active identity and its existing effective route while replacing duplicated legacy credential-store consumption with the existing domain-owned canonical-store mechanism. The legacy migration set is not assumed to equal the full active registry. Both sets remain exact and bounded; a smaller migration count cannot stand in for full compatibility or business acceptance.

This is the accepted complete successor for the one named reconciliation amendment, carrying its A1–A4 safety obligations forward. It does not supersede the parent OAuth protocol, the other deployment domain, or routing authority. The legacy deployment token in the existing Spec identifiers is retained solely to identify that published authority; actual principals and paths are bound privately.

Owner accepted the independently reviewed head `b7060c2c37ef67b1155064fc753d502fdf025208` on 2026-10-04 and authorized this limited docs acceptance transaction and merge. Implementation may rely on these contracts only once acceptance enters its base. `production_apply_authority: none` remains unchanged: production still needs the existing exact operation mandate and accepted artifact/marker binding. PR #452 records the final acceptance commit and the atomic predecessor lifecycle backlink; it grants no production permission.

## 1. Scope, authority, and fixed parameters

The bounded goal belongs to existing [Product #414](https://github.com/mayf3/dsh-agent-core/issues/414). Keep its original owner and single writer; do not create another Product, scheduler, database, registry, role, or deployment platform.

Public authority references:

- [Predecessor reconciliation amendment](AGENT_CORE_FLEET_SHARED_CODEX_AUTH_ACTIVATION_V1_AUTHSVC_RECONCILIATION_AMENDMENT.md): the complete authority replaced by this successor; retained artifact, canonical-store, transaction, provisioning, and recovery obligations are restated below.
- [Activation V1](AGENT_CORE_FLEET_SHARED_CODEX_AUTH_ACTIVATION_V1.md), especially CTR-ACT-003/004/009/010, and [Activation V2](AGENT_CORE_FLEET_SHARED_CODEX_AUTH_ACTIVATION_V2.md): retain the original deployment's activation and custody boundaries.
- [Fleet shared Codex auth V3](AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V3.md): canonical credentials, refresh ownership, no-copy semantics, and the retained domain authority.
- [Default model routing config V1](DEFAULT_MODEL_ROUTING_CONFIG_V1.md): a missing per-Agent override legally inherits the effective global/default route under existing precedence. This proposal does not select new routes.

These parameter names hide deployment details; they do not let an executor choose another target or relax a fixed scope:

| Parameter | Binding and constraint |
|---|---|
| `R`, `nR` | Complete active registry ID set and exact cardinality for this operation; active means `disabled != true` in the existing registry. |
| `F`, `nF` | Exact legacy configuration/store migration set and cardinality; `F` is a proper subset of `R`; override keys equal `F`. |
| `deploymentRoot`, `servicePrincipal` | The original authorized deployment root and its existing security-domain principal, fixed in the private operation packet. No cross-domain substitution. |
| `trustedTxRoot`, `trustedOwner`, `trustedGroup` | Existing root-only transaction/recovery trust domain and platform privileged ownership. These are not executor-selected permissions. |
| `artifactRoot`, `sourcePins`, `artifactDigests` | Immutable reviewed source, plugin, dependency closure, carrier, outer executor, helper, and migrator coordinates for the same operation. |
| `operationBinding` | Existing mandate/packet plus exact source/tree, target, preimages, identities, allowed effects, attempt/window, and same transaction ID. |

The complete lists, exact counts, per-identity configuration, machine paths, principals, and detailed acceptance records stay in the existing private operation packet. Their cryptographic binding is mandatory, not a documentation placeholder that may remain unresolved at apply time. This public Spec is reviewable without disclosing private snapshots; a production attempt with missing required snapshots is not ready.

Any changed membership or target needs explicit reconciliation of this fixed operation and its bounded contract before a new attempt. No runtime cohort expansion, auto-exclusion, or count-only substitution is permitted.

## 2. Carried-forward A1–A4 obligations

### A1. Reproducible exact-pin artifact and full dependency closure

Rebuild from the already accepted plugin source commit `75d98d5b10bb926d53108e49019668c1bde2a9eb`; this proposal does not authorize a new source pin. Freeze both the plugin archive and dependency-scope archive from the tested harness dependency set. Consume immutable artifacts, never a mutable working tree. Bind each SHA-256 in the existing accepted marker and operation packet; marker digest, frozen artifact digest, and consumed digest must agree.

Existing G1/G2 checks must reject the known incompatible build and verify the required `credentialFile`, `withOwnerReauth`, `OpenAICodexReauthRequiredError`, and refresh-intent exports/behavior under their existing thresholds. A package label or source pin string alone does not prove faithful build provenance. Preserve the existing audit record of the rejected artifact privately; never reuse it as the new artifact.

### A2. Canonical store belongs to the deployment domain

The canonical reference remains `<deploymentRoot>/shared-credentials/openai-codex/.openai-codex-auth.json`, owned by the original domain. Preserve file mode `0600`, directory mode `0700`, non-symlink and single-link requirements, no tombstone, and valid/unexpired canonical-state checks. There is one lineage owner. No credential value, token surgery, lineage copying, cross-domain consumption, or restoration of an older credential lineage is authorized.

### A3. Existing durable transaction, effect boundary, and exact recovery

Reuse the existing transaction schema and state machine:

```text
PREPARED -> QUIESCING -> FENCE_CREATING -> MUTATING_NO_FENCE -> MUTATING_FENCED
-> APPLIED_AWAITING_PONG -> COMMITTING -> COMMITTED_PENDING_FENCE_CLEAR -> COMMITTED

MUTATING* | APPLIED_AWAITING_PONG -> ROLLING_BACK -> ROLLBACK_APPLIED
-> ABORTED_PENDING_FENCE_CLEAR -> ABORTED

runtime restoration failure -> ABORTED_PENDING_RUNTIME_RESTORE
incomplete recovery -> ABORT_INCOMPLETE
```

The existing state-specific no-mutation abort and re-entry rules remain binding. Persist transaction ID, exact absolute paths, source/script/artifact digests, and manifest binding in `trustedTxRoot`: root-only directory `0700`, transaction files `0600` under the fixed privileged owner/group, with fence and lock in the same trust domain. Validate fixed path prefixes and non-symlink transaction paths; the intentional `current` link is separately checked against the exact generation target.

Preserve the global mutex and single writer. The recoverable lease binds PID, process metadata, and a random nonce; stale takeover atomically quarantines the old lock with exactly one winner. Release validates the nonce. Lease lifetime is independent of rollback arming. Launcher termination alone is not proof that workers, dispatched tools, refresh writers, or external effects are quiescent.

Keep the apply order: proven quiescence and effect boundary; durable fence; journaled freeze (`intent` fsync, atomic rename-away, `done` fsync, including intent-only process-death reconciliation); generation switch; controlled runtime bootstrap; applicable import/realpath/canonical-chain and zero-per-home-open checks; authorized credential-layer canary. Manifest digest is not checked while the journal legitimately evolves before its freeze point; it binds from `APPLIED_AWAITING_PONG` onward. Every mutation and recoverable resource must have the exact recorded preimage required by the existing transaction.

Commit still requires actual authorized Feishu delivery/PONG confirmation and complete topology/runtime revalidation. `COMMITTING` forbids racing abort. Pending commit/fence-clear states resume idempotently under the same transaction. Root-only confirmation, not an untrusted public receipt, is authoritative; receipt `.txId` must equal the transaction. Public success receipts are generated only after `COMMITTED`.

Abort preserves already-restored marker/archive recognition and does not replay `rollback_all`. Required runtime restoration must succeed before `ABORTED`; otherwise retain the explicit incomplete/pending recovery state. Armed errors/signals use the existing recovery path. Process death or lost output does not authorize a new apply: a nonterminal transaction blocks new mutation and requires same-transaction reconciliation. It never proves a business outcome or authorizes business replay.

### A4. Normal provisioning converges to the same canonical mechanism

The existing provisioning path must persist the own-domain canonical `credentialFile` and install the exact accepted plugin/dependency artifacts. Its independently reviewed implementation and tests must be merged before apply; otherwise later home creation/rebuild can reintroduce the old build or per-home store behavior. Use the existing provisioning entrypoint and `persistOpenAICodexCredentialFile` semantics. Provisioning readiness is not blanket permission to create homes, copy seed credentials, or alter ownership/modes.

## 3. Exact private operation binding

The existing private packet and the same durable transaction must bind all of the following before any live mutation:

1. Full sorted `R`/`F` lists, `nR`/`nF`, raw registry/config SHA-256, and canonical set digests. For each digest, sort IDs in ASCII order, serialize with `JSON.stringify(ids)`, encode UTF-8 without a trailing newline, then SHA-256. Counts alone cannot bind identity.
2. Every `R` identity's effective route source (per-Agent override, composition config, runtime environment, or built-in) and ordered chain: non-secret provider/model/route kind, plugin/pin if applicable, effective reasoning effort if applicable, canonical digest of provider-environment semantics, and credential-reference domain/path without values. Distinguish explicit absence from unknown. Bind source and order, not just a set of providers.
3. Every affected consumer's required home/profile/plugin metadata, dependency and access evidence, and actual provisioning path. Apply Codex custody/permission checks according to the resolved route, including global/default inheritance outside `F`. Missing home metadata does not imply an inactive or unused identity; an existing provisioning path must be proven ready rather than presumed to work later.
4. Exact target, source/tree, carrier/outer/helper/migrator and dependency artifact digests, preimage algorithm and resource ownership, and actual worker/tool/refresh custody scope. Bind all set/route/consumer snapshots to the same mandate and transaction.

Read-only historical observations are not fresh operation evidence. Missing evidence or permission denial leaves readiness blocked; do not retry through a different identity/tool, escalate access, read credentials, or infer private configuration from labels. A trusted authorized operator may supply the required sanitized evidence through its already legitimate read surface. This Spec grants no such access.

## 4. Contracts

**CTR-COHORT-001 — Preserve identities and effective routing.** Every identity in `R` remains active with stable identity/default semantics and the same effective route source and ordered chain. Migration cannot add/remove overrides, change provider/model/fallback/effort/environment, or use disabled flags or labels to shrink coverage. The only configuration delta in `F` is v2-to-v3 schema version plus own-domain canonical `credentialFile` on applicable Codex subscription routes. This explicit reference change is not route reselection. Route changes require a separate explicit task.

**CTR-COHORT-002 — Exact binding and drift refusal.** Before the first live write and on resume/commit, prove live registry equals the bound `R`, override keys equal `F`, exact counts match, `F` is a proper subset of `R`, and all route/consumer snapshots are complete. Validate packet/source/transaction consistency and state-appropriate pre/postimages. Same-count identity replacement, addition/removal, disabled-state change, route-source change, or input hash drift fails closed. Do not repair lists automatically or re-apply. Same-transaction recovery may preserve UNKNOWN and restore recorded owned resources; it cannot guess a new intended state from drift.

**CTR-COHORT-003 — Distinguish migration from full compatibility.** `F` receives the existing old-store census, exact code/config/plugin preimages, journal, import, realpath, and canonical checks. All of `R` receives identity/routability, effective-route, dependency, and provisioning compatibility proof against the same candidate app/schema/runtime. Applicable Codex consumers outside `F` receive the same identity isolation, canonical, access, and custody checks. Shared runtime/restart scope covers every affected consumer. If legacy state requiring migration is discovered outside `F`, stop the attempt and revise the fixed packet and bounded contract; never expand `F` during execution.

**CTR-COHORT-004 — Provisioning and permission stay explicit.** Do not create per-home OAuth copies to satisfy a migration gate, copy lineage, or obtain another domain's credentials. Use A4's normal own-domain provisioning and exact pin. Any necessary real home/profile/plugin/settings/seed-copy write must be individually included and authorized in the original operation mandate. Existing homes are not automatically recreated, chowned, or chmodded. Missing required authority or access evidence makes the item `BLOCKED` while keeping it active; do not start a model session merely to fill an evidence gap.

**CTR-COHORT-005 — Preserve transaction and recovery safety.** Reuse A3's mutex, single writer, root-only transaction/fence, and exact code/config/plugin recovery. Quiescence/effect proof includes actual affected workers, already-dispatched tools/effects, and refresh writers, not merely a roster or launcher. EOF, timeout, lost receipt, and unknown external effects remain UNKNOWN and use same-transaction reconciliation. Never replay old business, restore credential lineage, or roll back current business state/outbox. Recovery covers only recorded, owned, reversible resources; unrecorded homes and business state remain outside it. Runtime recovery failure cannot claim completed abort. No-abort `COMMITTING`, idempotent receipts, and actual PONG remain binding.

**CTR-COHORT-006 — Honest acceptance and finite stop conditions.** Reuse existing receipts to distinguish actual migration completion for `F`, per-identity compatibility for all `R`, and live canary evidence bound to actual identity/route/source/transaction. Do not relabel a migration count as full business success. Reuse existing G3/G2.7/topology and route checks. Authorized live canaries must traverse the changed installation/loading path and cover distinct affected route/provisioning paths; do not add a model-request gate for every identity. Fixtures and representative canaries do not claim unexecuted identities were individually exercised. Commit only when required coverage passes and the original Owner confirms actual PONG. Missing/foreign/BLOCKED evidence retains refusal and existing same-transaction recovery. Real business sends still require explicit operation authorization.

## 5. Acceptance definitions

These are definitions for the later accepted-base implementation and authorized operation, not executed results for this proposal.

| Acceptance / Contracts | Method and environment | Required evidence and expected result | Failure condition |
|---|---|---|---|
| ACC-COHORT-001 / CTR-COHORT-001 | Existing model-overrides loader/chain fixtures; isolated generic IDs, explicit and inherited routes | Pre/post identity and route-source/ordered-chain comparison; only allowed schema/reference delta within `F` | Added override, disabled identity, changed route source, or unknown treated as default |
| ACC-COHORT-002 / CTR-COHORT-002 | Existing migration fixture and before-swap/input-drift checks | Unbound mismatched sets rejected; exact bound sets admitted; same-count replacement, route change, digest conflict, and mid-operation drift refused without unrecorded writes | Count-only matching, silent exclusion, automatic expansion, or new apply retry |
| ACC-COHORT-003 / CTR-COHORT-003 | Existing G2.7 real loader, topology and normal-provisioning fixtures against one candidate tree | `F` migration/recovery evidence plus all-`R` compatibility matrix; inherited Codex consumers included; missing dependencies explicitly BLOCKED | Migration PASS promoted to all-consumer PASS, missing consumer, unknown preimage, or expanded `F` |
| ACC-COHORT-004 / CTR-COHORT-004 | Existing provisioning and domain-boundary fixtures; no real credentials or host writes | Own-domain canonical and exact pin; missing/foreign references refused; preparation does not mutate registry/homes/permissions or copy tokens | Any unauthorized credential, home, seed, or permission write |
| ACC-COHORT-005 / CTR-COHORT-005 | Existing multiprocess SIGKILL, outer-lease, same-transaction abort, and runtime-restore-failure fixtures; generic bounded sets | Exact code/config/plugin recovery; unrecorded state untouched; UNKNOWN/effect fence retained; no apply/business replay; pending recovery is not terminal success | Out-of-scope restore, unsafe lock takeover, false terminal state, credential/business snapshot rollback |
| ACC-COHORT-006 / CTR-COHORT-006 | Isolated receipt negatives plus existing live canaries/terminal readback only after explicit authorization | Separate migration/compatibility evidence; actual consumer/route/source/transaction attribution; real PONG through installed loaded path; complete terminal recovery evidence | Fixture presented as business proof, lost result/missing PONG called success, or uncovered identities hidden by overall PASS |

A1/A2 artifact/canonical checks feed ACC-COHORT-003/004; A3 transaction and topology checks feed ACC-COHORT-003/005/006; A4 provisioning checks feed ACC-COHORT-003/004. Existing isolated regression results establish only the mechanisms they actually exercised; they do not establish the new set semantics or live business acceptance. Extend affected inputs/assertions in those fixtures after acceptance; no new global gates, platform, or full-repository audit is required.

## 6. Docs-first acceptance and bounded delivery sequence

1. Submit this complete proposed successor in the existing Product's docs-only review lane. Bind the integration base, proposal digest, actual commit/head, and independent affected-contract review. Keep the prior implementation candidate and its evidence separately; do not call this document an implemented change.
2. The repository Owner or explicitly recorded authorized maintainer accepts the exact independently reviewed head. In that later atomic docs acceptance transaction, set the successor to accepted with provenance and mark the named predecessor superseded with the backlink. Preserve its historical body. Until then the predecessor remains active. This PR performs only that authorized docs acceptance transaction; production authority remains none.
3. Once acceptance is merged into the implementation base, the existing single writer adapts the current migrator, carrier, outer/helper bindings and affected fixtures. Do not change identity schema, route precedence, or introduce a second authority. Review only the affected contract delta and any concrete blocker union.
4. The original operator supplies the private snapshots in section 3. Prepare source, complete artifacts, exact bindings, and a concrete operation packet. Include only necessary real writes with actor, exact target, pre/postimage, and recovery boundary. Missing necessity evidence does not justify broad permission repair.
5. Obtain the exact production mandate and bind the accepted marker through the existing authorized path. Validate A1–A4 and sections 3–5 before the single apply attempt. Spec acceptance itself cannot update the marker, expand OS access, restart services, or send business requests.
6. Run the existing authorized apply/canary/same-transaction commit/readback sequence. Failure uses the existing same-transaction recovery; lost outcomes stay UNKNOWN without replay. Finish with separately attributable migration completion, full compatibility coverage, actual authorized business evidence, and auditable terminal/rollback readback. An audit or review alone is not rollout completion.

## 7. Non-goals and preserved boundaries

No new coordinator, scheduler, database, governance platform, or role. No unrelated Workflow, Scheduler, Forum, or routing changes. Preserve one-lineage/one-owner, domain and identity isolation, no-copy/no-token-surgery, exact old-store evidence retention, idempotency, effect fences, no-replay, single-writer exclusion, and truthful rollback. Do not combine unrelated permission or credential repairs with this operation. Detailed environment history and acceptance records remain in the existing private lane; public evidence must contain no credentials, raw logs, machine paths, real per-Agent IDs, or per-Agent private configuration.
