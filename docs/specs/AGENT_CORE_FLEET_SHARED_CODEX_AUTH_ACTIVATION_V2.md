---
spec_id: AGENT_CORE_FLEET_SHARED_CODEX_AUTH_ACTIVATION_V2
status: accepted
date: 2026-09-05
accepted_by: mayf3
accepted_date: 2026-09-05
accepted_reviewed_head: 161e2ff6594c1df514518c34a2de6cfd28d55820
review_verdict: ACCEPT
review_blocker_count: 0
acceptance_semantics: pending independent review + Owner exact-head acceptance
type: activation/deployment authority (docs only this round)
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
supersedes:
  - AGENT_CORE_FLEET_SHARED_CODEX_AUTH_ACTIVATION_V1
superseded_by: null
governed_by:
  - AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V3
  - AGENT_PROCESS_LIFECYCLE_HARDENING_V2
  - SCHEDULER_TIMEOUT_OUTCOME_V2
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
external_authorities:
  - repository: Yan-Zero/dsh-codex
    authority_id: DSH_CODEX_RELEASE_V1
    revision: 75d98d5b10bb926d53108e49019668c1bde2a9eb
    relation: interoperates_with
scope:
  - exact deployment closure + one-time activation transaction plan for the yanfenma-domain unified production backend (Product API 127.0.0.1:8787, 88-agent registry)
  - credential-acquisition mode = ONE_CANONICAL_OWNER_REAUTH (CTR-SCA-009/014 normal path; bootstrap branch NOT selected)
  - bounded Luna enablement for this activation: agt_stock_agent + agt_ceo-agent (plus migration of any existing Luna-enabled agent in this domain)
  - Mobile tailnet access path is a SEPARATE lane (NETWORK_LANE); it is not part of this authority
owners:
  - mayf3
---

# AGENT_CORE_FLEET_SHARED_CODEX_AUTH_ACTIVATION_V2

> `TASK_NAME = 激活域对齐 制备` · `ROUND = AUTHORITY_AUTHORING` · docs only this round。
> 本文件是 `AGENT_CORE_FLEET_SHARED_CODEX_AUTH_ACTIVATION_V1`（accepted @ b5717e3…，目标域 =
> authsvc / fleet-92 / CLOSURE_REFREEZE_V2）的 complete standalone whole-authority successor。
> Owner ruling（2026-09-05，PROCEED_WITH_TWO_LAYER_AUTHORITY_RECONCILIATION）：机械证据证明
> ACTIVATION_V1 的目标域 ≠ 真实统一生产 Backend（MOBILE_AND_DSH_BACKEND = SAME，
> ONE_BACKEND = YES，统一 Backend = yanfenma 域 control plane，Product API 127.0.0.1:8787，
> 88-agent registry）。ACTIVATION_V1 不得直接用于该 Backend 的生产事务。
> 本 Spec 把 activation 从错误的 authsvc/92 deployment 移动到真实统一 Backend。
> 父授权 V2 的 production_apply_authority = none 由 successor V3 继承；本 Spec 同样
> docs-only；生产 apply 在独立 pre-apply audit + shared production lock（PRODUCTION_MUTATION_
> CONCURRENCY = 1）之下执行。

## 1. Goal

在真实统一生产 Backend（yanfenma 域）上，把共享 Codex auth 激活为 canonical credential domain，
使本 Goal 的 Luna 业务对象（agt_stock_agent、agt_ceo-agent，以及本域既有 Luna-enabled agent 的
迁移）通过 `openai-codex / gpt-5.6-luna` 获得真实模型回复——用 accepted V3 的
ONE_CANONICAL_OWNER_REAUTH 模式建立 canonical store，随后完成 canary 验收。

```text
ACTIVATION_END_STATE =
  canonical store live at /Users/yanfenma/.agent-core/shared-credentials/openai-codex/.openai-codex-auth.json
  AGENTS_CANONICAL = all Luna-enabled agents in this domain resolve credentialFile = canonical path
  STOCK_ACTUAL_PROVIDER = openai-codex; STOCK_ACTUAL_MODEL = gpt-5.6-luna; STOCK_REAL_REPLY = PASS
  CEO_ACTUAL_PROVIDER  = openai-codex; CEO_ACTUAL_MODEL  = gpt-5.6-luna; CEO_REAL_REPLY  = PASS
  PER_AGENT_RUNTIME_OAUTH_USE = ZERO opens
  CREDENTIAL_ACQUISITION = exactly ONE canonical Owner reauth (LEGACY_CONVERGED_BOOTSTRAP_SELECTED = NO)
```

## 2. Scope and non-goals

### In scope

- deployment closure for this domain: the minimal complete shared-auth + route-v3 blob set
  (see CTR-ACT2-003), taken from frozen main bytes, NOT a moving-main deployment;
- v2→v3 config migration + canonical `credentialFile` injection for this domain's
  `agent-model-overrides.json`, atomically in one quiesce window (CTR-ACT-003 semantics carried forward);
- ONE_CANONICAL_OWNER_REAUTH: quiesce → fence → one direct-to-canonical interactive Owner login →
  validate → inject config → restart → canaries;
- Luna enablement for exactly `agt_stock_agent` and `agt_ceo-agent` (route addition is part of the
  same activation; these are also Feishu-shared agents — the route change applies to every entry
  that resolves them, including Feishu; this is recorded, not hidden);
- migration of any existing Luna-enabled agent in this domain (currently the CTO agent's route
  override) to the canonical credentialFile — option A of the Owner ruling; per-home writable OAuth
  use is FORBIDDEN after activation (V3 CTR-SCA-005);
- fresh mechanical preimage, release manifest, rollback manifest for THIS domain.

### Out of scope

- all-88 Luna enablement (`ALL_88_LUNA_ENABLEMENT = NOT_REQUIRED_FOR_MOBILE`);
- the authsvc domain and its 92-fleet activation plan (superseded as CURRENT production activation;
  its own authorization remains with ACTIVATION_V1 for that domain; this transaction MUST NOT touch
  `/Users/authsvc/**`);
- Server History, PR #145, Feishu history sync, Mobile code, Six-Pack candidates, scheduler/workflow
  changes beyond the frozen closure;
- any Mobile-specific auth/credential design (Mobile is frontend-only; SECOND_BACKEND = NONE);
- route additions for any agent other than the two business targets plus the existing CTO route
  migration (`UNRELATED_AGENT_ROUTE_CHANGE = NONE`).

## 3. Authority and dependencies

```text
PARENT_AUTHORITY = AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V3 (whole-authority successor of V2)
SUPERSEDES = AGENT_CORE_FLEET_SHARED_CODEX_AUTH_ACTIVATION_V1 (whole-authority successor; V1 remains
  the authority for the authsvc domain's own activation until/unless separately re-authorized there)
IMPLEMENTATION_AUTHORITY = contracts
PRODUCTION_APPLY_AUTHORITY = none (docs-only; apply executes only after: V3 accepted, this Spec
  accepted, closure/preimage frozen, implementation tests PASS, independent pre-apply audit PASS,
  Luna dispatch + refresh writers quiesced, canonical directory verified, COMPETING_REFRESH_WRITERS
  = NONE)
EXTERNAL_AUTHORITIES = Yan-Zero/dsh-codex @ 75d98d5b10bb926d53108e49019668c1bde2a9eb (same pin as V3)
```

## 4. Current State (frozen 2026-09-05; re-verify fresh at activation gate)

```text
BACKEND = yanfenma-domain unified control plane
  CONTROL_PLANE_IDENTITY_AT_FREEZE = pid 18234, uid 502, gid 20 (staff), started 2026-09-05T09:40:10+08,
  argv = node /Users/yanfenma/workspace/project/production-dsh-agent-core/scripts/production-runtime.mjs --root /Users/yanfenma/.agent-core
  (persistent identity = the yanfenma-domain control plane binding 127.0.0.1:8787 and owning
  /Users/yanfenma/.agent-core; the pid is a scene coordinate)
DEPLOYMENT_CHECKOUT = /Users/yanfenma/workspace/project/production-dsh-agent-core @ 549dace
  (Merge PR #34 luna-rc8-sync; loader accepts overrides schema version 2 ONLY)
DSH_HARNESS_ROOT_AT_FREEZE = /Users/yanfenma/workspace/github/deepseek-harness/.worktree/luna-production-rc8-20260822-090003
REGISTRY = /Users/yanfenma/.agent-core/agents.json; FLEET_COUNT = 88 (fresh-verified 2026-09-05)
HOMES = 88, drwx------ yanfenma:staff; production root 0700
CONFIG = /Users/yanfenma/.agent-core/agent-model-overrides.json schema version 2;
  exactly one openai-codex subscription route (agt_cto-agent -> gpt-5.6-luna, providerEnv proxy
  127.0.0.1:7890); global default route oc-go/deepseek-v4-flash (429-quota; NOT this Goal's target)
PER_HOME_OAUTH_IN_DOMAIN = one logical legacy store for agt_cto-agent, two physical candidate
  paths observed (the agent-home path /Users/yanfenma/.agent-core/homes/agt_cto-agent/.openai-codex-auth.json,
  mtime 2026-08-20, and a second CTO store under the .dsh agents-homes root) — both are stale
  generations; NEITHER is a bootstrap candidate (LEGACY_CONVERGED_BOOTSTRAP_SELECTED = NO). The
  lsof sweep and the zero-per-home proof bind BOTH paths (the authoritative per-home path set for
  this domain = the exact homes resolved by the production composition, re-derived fresh at the
  activation gate).
CANONICAL_DOMAIN = ABSENT
RUNTIME_SPAWN_PROOF = child cold spawn verified 2026-09-05 (pid 53655, ready 1654ms, session main
  resumed 1965 events) after rehearsal-squatter removal; spawn EACCES = NONE
COMPETING_REFRESH_WRITERS = to prove NONE at activation gate (desktop Codex app holds its own
  ~/.codex/auth.json and MUST NOT be treated as a canonical writer; its refreshes do not touch this
  domain's canonical store — the canonical generation starts from the Owner reauth, so desktop-app
  rotation of ~/.codex/auth.json cannot invalidate it; conversely the canonical store must NOT be
  linked to ~/.codex/auth.json in any way)
```

## 5. Contracts

### CTR-ACT2-001 — Exact deployment closure (domain-realigned, minimal, non-moving-main)

The production code closure is the minimal complete blob set that makes THIS domain's runtime
implement schema-v3 + credentialFile + shared-store semantics. It MUST be extracted from frozen
main bytes (base commit recorded at candidate preparation from the same main that V3's
implementation validation ran against — expected base = the PR #176 merge 16e1423 lineage, exact
commit re-frozen at candidate preparation), NOT from a moving branch:

```text
packages/production-runtime/src/model-overrides.js        (v3 loader + CANONICAL constant, realigned)
packages/production-runtime/src/shared-codex.js           (explicit credentialFile service wiring)
packages/production-runtime/src/shared-codex-migration.js (selection/migration functions, verbatim)
packages/production-runtime/src/shared-codex-migration-executable.js (domain-realigned executable)
packages/agent-provisioning/src/index.js                  (credentialFile profile wiring + boundary assertion)
packages/production-runtime/test/* for the above          (tests are NOT deployed; used for validation only)
```

REQUIRED_BLOBS = exactly the files whose semantics the runtime needs for: v3 config parsing,
canonical constant resolution, credentialFile pass-through into agent profiles, the migration
executable, and its direct tests. UNRELATED_MAIN_BLOBS = EXCLUDED — no scheduler, workflow,
server-history, broker, memory, session, router-index, notification, or Mobile file enters the
closure. If the CLOSURE_REFREEZE_V2 8-blob set proves byte-complete for this domain's needs, its
target bytes MAY be reused; the authsvc-domain PREIMAGE RECEIPTS may NOT (this domain freezes its
own fresh preimage). `compose.js` handling follows CTR-ACT-001 evidence: compose is excluded unless
fresh inspection of THIS domain's checkout (549dace) proves its compose imports a surface the
closure changes; the loader/config seam (`loadAgentModelOverrides`) signature compatibility MUST be
mechanically checked against 549dace before closure freeze, and the closure MUST include the
minimal compose adjustment if (and only if) the check fails.

### CTR-ACT2-002 — Domain constants realignment (bounded implementation)

The executable's domain-hardcoded constants MUST be parameterized to this domain as the ONLY
implementation delta against the frozen main bytes:

```text
SHARED_CONFIG_PATH = /Users/yanfenma/.agent-core/agent-model-overrides.json
FENCE_PATH         = /Users/yanfenma/.agent-core/control/shared-codex-migration-fence.json
CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE =
  /Users/yanfenma/.agent-core/shared-credentials/openai-codex/.openai-codex-auth.json
PERMISSION PROBES  = same-uid domain model per V3 CTR-SCA-010: uid502 create/replace/read PASS;
  third-uid denied probe via ordinary POSIX bits; the authsvc control-plane ACL probe is REPLACED
  by a canonical-owner (uid502) control-plane probe. No setuid, no ACL machinery, no new uid.
CANARIES           = STOCK (agt_stock_agent), CEO (agt_ceo-agent) — the two business targets;
  plus CTO (agt_cto-agent) as the existing Luna-enabled agent migration case.
```

Everything else in the executable (ten-gate/one-gate receipt semantics, quiesce/fence durability,
atomic copy/rename, config v3 injection fail-closed checks, zero-per-home-opens verification,
pinned artifact receipt, rollback-never-restores-legacy) is carried forward verbatim.
`EXPECTED_FLEET = 92` is NOT modified: runner discrimination proved the cardinality check binds
ONLY inside `bootstrapSelection()` (bootstrap branch), and this activation uses the normal
`ONE_CANONICAL_OWNER_REAUTH` path (no `candidateClass` in config ⇒ legacy selection path ⇒
provenance-based, zero proven generations in this domain ⇒ `canonicalReauthRequired: true` ⇒
exactly one `ownerReauthCanonical` execution). NO_SPECULATIVE_RUNNER_REFACTOR: no fleet-count
change anywhere.

### CTR-ACT2-003 — Fresh preimage, release and rollback manifests (this domain)

Before apply, freeze fresh: full 8787 listener table with pids/cmdlines/cwd; this domain's registry
blob (88), config preimage (schema v2 bytes), the closure target files' CURRENT bytes in
production-dsh-agent-core (549dace) as per-file preimage; harness root identity; canonical-domain
absence proof; per-home OAuth inventory (paths + mtime metadata only, CTR-SCA-011). Release
manifest = closure blobs + their sha256 + destination paths in the deployment checkout. Rollback
manifest = per-file preimage restore + config v2 preimage restore + canonical directory removal
ONLY IF the canonical store was never activated (post-reauth the canonical credential is never
rolled back or deleted, per V3 CTR-SCA-014); runtime-only rollback never restores per-home
writable use.

### CTR-ACT2-004 — Quiesce and durable fence (this domain)

`LUNA_DISPATCH_QUIESCED` and `REFRESH_WRITERS_QUIESCED` MUST be established against this domain's
Luna-enabled baseline (CTO route + any child holding an open OAuth store) and durably recorded to
`FENCE_PATH` before credential acquisition. In this domain the quiesce operation is: ensure no Luna
child is running or admissible (CTO luna route disabled or its child stopped; stock/ceo have no
Luna route yet — nothing to quiesce there) and no process holds the canonical filename lock
(nothing does: canonical is absent). COMPETING_REFRESH_WRITERS = NONE MUST be proven: enumerate
processes with open handles on any in-domain OAuth store (`lsof` on the CTO per-home path), prove
no active refresh loop, and record that the desktop Codex app (`~/.codex/auth.json`) is treated as
a separate credential generation outside this domain's canonical store. ASSUMPTION (not mechanical
proof): the Owner's canonical reauth and the desktop app's login share the same subscription but
MAY or MAY NOT share the same provider-side OAuth grant; if they do share it, a desktop-side
rotation could invalidate the canonical refresh token. Mitigation is structural: the first
canonical refresh after any such event fails closed per CTR-ACT2-006 (`refresh_token_reused` ⇒
OPERATOR_BLOCKED, evidence preserved, no retry), and the durable shared-store protocol makes
recovery a single controlled re-entrancy, not a repeat incident.

### CTR-ACT2-005 — ONE_CANONICAL_OWNER_REAUTH execution order

Exactly this order, fail-closed at every step. The execution ORDER is aligned to the
carried-forward runner (`shared-codex-migration-executable.js` normal reauth path: quiesce →
fence → selection → ownerReauthCanonical → validateCanonical → permission probes →
switchFleetConfig (requires config ALREADY v3) → zero-per-home → artifact receipt → restart →
canaries → fleet health); the transaction script MUST let the runner own the credential step so
that exactly ONE reauth happens (CANONICAL_REAUTH_COUNT_MAX = 1):

1. **Pre-stage (before any credential work): closure install + config v3 migration** — install
   the frozen closure into the deployment checkout (per release manifest, CTR-ACT2-003) and
   migrate `agent-model-overrides.json` schema v2 → v3 with canonical `credentialFile` injection
   (one atomic same-dir rename; route order, fallbacks, providerEnv unchanged). This is the
   v2/v3 atomic window: a restart in this state fails loud (v3 loader demands `credentialFile`
   on openai-codex routes; canonical file not yet present is a legal intermediate — the loader
   validates config fields, it does not stat the file) and produces NO admission. Rationale: the
   runner's `switchFleetConfig` throws unless config is already v3, so credential acquisition
   MUST come after this stage.
2. quiesce + fence (CTR-ACT2-004); verify canonical domain ABSENT + permissions pre-provisioned
   (directory created 0700 yanfenma:staff before Owner action);
3. verify no per-home runtime writer (lsof sweep on all in-domain OAuth stores) and no canonical
   intent file exists;
4. provenance inspection (runner `selectAuthoritativeCodexGeneration` over the domain's legacy
   candidate inventory — expected: zero proven generations in this domain ⇒ `canonicalReauthRequired:
   true`; if the inventory unexpectedly yields a proven generation, ABORT and re-run the
   fresh-production gate — that would contradict this Spec's §4 facts);
5. **OWNER GATE (the only one besides exact-head acceptance), executed INSIDE the runner's
   `ownerReauthCanonical` binding**: the Owner performs ONE interactive OpenAI Codex login that
   writes DIRECTLY into the canonical store
   (`/Users/yanfenma/.agent-core/shared-credentials/openai-codex/.openai-codex-auth.json`).
   The exact entrypoint command is frozen in the transaction script and reviewed by the pre-apply
   audit; it MUST be a mechanism that targets the canonical filename itself (a wrapper around the
   stock `codex` CLI with a store-level redirect, or whatever login mechanism the dsh-codex 0.2.3
   line natively supports for an explicit store path — the stock `codex login` writing
   `~/.codex/auth.json` alone is NOT a canonical landing and MUST NOT be used followed by a copy).
   The Owner MUST NOT login into `~/.codex/auth.json` and copy, MUST NOT login into an Agent Home,
   MUST NOT upload tokens anywhere, MUST NOT copy the old CTO credential;
6. `validateCanonical` metadata check (parses, 0600, group/world zero, no printing of contents) +
   the four permission probes (uid502 read; uid502 atomic replace; canonical-owner control-plane
   probe; third-uid denied — per CTR-ACT2-002 realignment of the runner's probe bindings);
7. `switchFleetConfig` re-confirmation (canonical credentialFile injection idempotent re-check);
8. zero per-home runtime opens verification; pinned dsh-codex artifact receipt exact-match;
9. controlled restart of the control plane (same wrapper/env identity);
10. canaries in order: STOCK → CEO (business targets) → CTO (migration case); each proves
    provider=openai-codex, model=gpt-5.6-luna, real reply, no oc-go/GLM use, no per-home OAuth open;
11. fleet health check limited to this domain's Luna-enabled set (NOT all 88 — other agents remain
    on their existing routes untouched).

### CTR-ACT2-006 — First canonical refresh provenance boundary

The first remote refresh after the Owner reauth begins the first formal canonical generation
provenance (V3 CTR-SCA-006/007/008 carried forward verbatim: same-filename lock, durable intent,
atomic replacement, outcome_unknown fail-closed, one remote refresh per generation,
`OPENAI_CODEX_REFRESH_IN_PROGRESS` bounded wait, no old-token retry). A first-refresh
`refresh_token_reused`/`invalid_grant` result ⇒ FAIL_CLOSED + OPERATOR_BLOCKED + evidence
preserved; Luna disabled pending Owner investigation; NO retry.

### CTR-ACT2-007 — Rollback

Runtime-only rollback after quiesce: restore per-file preimages (closure files + config v2),
restart control plane, Luna disabled (never re-enable per-home writable OAuth use, never restore
any legacy rotating refresh token). The canonical credential, fence, and intent evidence are never
rolled back or deleted once the canonical store exists. Rollback restores
PRODUCTION_USABLE = YES via pre-existing routes (oc-go global default unchanged; CTO luna route
returns to its pre-activation state — disabled or per-home, exactly as found, but per-home runtime
use MUST NOT resume if zero-per-home was already proven; in that case Luna stays disabled until a
later authority action).

### CTR-ACT2-008 — Secret boundary

Verbatim carry-forward of CTR-SCA-011/CTR-ACT-012: only provider, model, paths, metadata,
generationId, verdict fields in any evidence; no token/hash/digest/credential content anywhere.

## 6. Acceptance (this Spec, authoring-round)

- ACC-ACT2-001: closure blob set byte-identity vs frozen main; UNRELATED_MAIN_BLOBS exclusion proof
  (census diff vs 549dace deployed state).
- ACC-ACT2-002: domain-constants parameterization — focused tests prove the realigned executable
  produces identical behavior on synthetic fixtures (receipt checks, quiesce, v3 injection,
  zero-per-home, canary ordering STOCK→CEO→CTO) and that the 92-constant is untouched and
  unreachable in the reauth path.
- ACC-ACT2-003: v2→v3 migration on this domain's real config snapshot (redacted structure) yields
  semantics-preserving v3; loader accepts; route order/fallbacks/providerEnv unchanged.
- ACC-ACT2-004: dry-run of the full transaction in an isolated sandbox (root=fixture dir, synthetic
  credentials, fake OAuth) end-to-end PASS + rollback rehearsal (runtime-only, canonical retained).
- ACC-ACT2-005: secret scan zero hits across artifacts/receipts/plans.
- ACC-ACT2-006: canary plan proves per-target provider/model attribution from child/turn evidence,
  not parent env or config files.

### Contract coverage

| Contract | Acceptance | Covered |
|---|---|---|
| `CTR-ACT2-001` | `ACC-ACT2-001` | YES |
| `CTR-ACT2-002` | `ACC-ACT2-002`, `ACC-ACT2-003` | YES |
| `CTR-ACT2-003` | `ACC-ACT2-001`, `ACC-ACT2-004` | YES |
| `CTR-ACT2-004` | `ACC-ACT2-004` | YES |
| `CTR-ACT2-005` | `ACC-ACT2-004`, `ACC-ACT2-006` | YES |
| `CTR-ACT2-006` | `ACC-ACT2-004` | YES |
| `CTR-ACT2-007` | `ACC-ACT2-004` (rollback rehearsal) | YES |
| `CTR-ACT2-008` | `ACC-ACT2-005` | YES |

## 7. Rollback summary

See CTR-ACT2-007. Staged rollbacks per phase; canonical credential never deleted post-reauth;
Luna disabled-not-degraded on any failure; production stays usable on existing routes.

## 8. Open questions

```text
ACCEPTANCE_BACKLINKS = the single acceptance commit atomically writes BOTH reciprocal backlinks
  (V2 → superseded_by = ACTIVATION_V2, and ACTIVATION_V1 → superseded_by = ACTIVATION_V2) plus the
  docs/specs/README.md lifecycle mirrors
OPEN_OWNER_DECISIONS = NONE (acceptance itself is the decision)
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE (V2→V3 and ACTIVATION_V1→V2 are atomic whole-authority
  successions; authsvc domain keeps ACTIVATION_V1 for its own future use)
PARTIAL_SUPERSESSION = NONE
READY_FOR_INDEPENDENT_REVIEW = YES
ACCEPTANCE_FORM = ONE exact-head acceptance of V3 + this Spec together (single Owner gate),
  production apply gated separately by the pre-apply audit + fresh gates
PRODUCTION_MUTATION_CONCURRENCY = 1 (global production lock; authsvc domain excluded from this transaction)
```

## 9. Authoring output

```text
TASK_NAME = 激活域对齐 制备
ROUND = AUTHORITY_AUTHORING (docs only)
SPEC_ID = AGENT_CORE_FLEET_SHARED_CODEX_AUTH_ACTIVATION_V2
STATUS = proposed
SUPERSEDES_ON_ACCEPTANCE = AGENT_CORE_FLEET_SHARED_CODEX_AUTH_ACTIVATION_V1
PARENT = AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V3 (proposed)
TARGET_DOMAIN = yanfenma unified backend (Product API 127.0.0.1:8787, root /Users/yanfenma/.agent-core, fleet 88)
CREDENTIAL_ACQUISITION = ONE_CANONICAL_OWNER_REAUTH (exactly one Owner login into canonical store)
LEGACY_CONVERGED_BOOTSTRAP_SELECTED = NO
LUNA_BUSINESS_TARGETS = agt_stock_agent, agt_ceo-agent (+ CTO migration case)
ALL_88_LUNA_ENABLEMENT = NOT_REQUIRED_FOR_MOBILE
MOBILE_NETWORK_LANE = SEPARATE (gateway /v1 path-scoped pass-through; own preimage/manifest/review)
PRODUCT_CODE_CHANGE = bounded domain-constants parameterization only (under V3 CTR-SCA-013)
PRODUCTION_CHANGE = NONE (this authoring round)
AUTHORING_READY_FOR_REVIEW = YES
NEXT_TASK = 激活域对齐 审计（ONE independent review，双 Spec 同审）
```
