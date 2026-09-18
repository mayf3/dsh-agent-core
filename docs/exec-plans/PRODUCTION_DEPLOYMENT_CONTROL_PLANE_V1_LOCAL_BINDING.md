# Local issuer and deployment registry execution plan

This is execution under accepted `PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1`
semantic head `39865536ce51005f95a98473e77c2329078512c0`, not new Product Authority.
Owner mayf3's current task explicitly authorizes choosing and implementing minimal
local issuer/custody and deployment-only registry bindings. Actual production key
generation, installation, enablement and all production mutation remain forbidden.

## Preflight

```text
GOAL_OR_TARGET = PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1
CURRENT_GAP = authenticated local issuer, durable original-Goal binding, exact genesis package
TARGET_REPOSITORY = mayf3/dsh-agent-core
BASE_HEAD = 2c59bf5169b38c90b2ea87f210bdfb453e4a7b68
REVIEW_TARGET_HEAD = final implementation commit to be frozen after tests
CURRENT_BASE_HEAD = 2c59bf5169b38c90b2ea87f210bdfb453e4a7b68
ROUTE_STAGE = IMPLEMENTATION
AUTHORITY_ACTION = REUSE
PRIMARY_AUTHORITY = PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1@3986553
AUTHORITY_ACCEPTED_IN_BASE = YES
IMPLEMENTATION_AUTHORITY = contracts
PLAN_LEVEL = EXEC_PLAN
ASSURANCE_LEVEL = CONTROLLED
EXECUTION_MANDATE = VALID
MUTATION_AUTHORIZATION = VALID for isolated nonproduction work only
ISOLATED_WRITE_SURFACE = production-deployment-control-plane-v1-impl worktree
SPEC_GAP_DEPENDENCY = NONE
OWNER_DECISION_REQUIRED = NO for implementation
IMPLEMENTATION_ALLOWED = YES
OPERATION_ALLOWED = NO for production/bootstrap
MERGE_READY = NO pending exact affected-surface review
EVIDENCE_REVIEWABILITY = PASS for source and nonproduction results
LIVE_AUTHORITY_GAP = NONE introduced
EMERGENCY_STATE = NONE
EVIDENCE_NEEDED = negative-first tests, full Rust suite, fmt, clippy, release, independent security review, package rehash
DONE_WHEN = reviewed executable local bindings and exact bootstrap authorization package, activation remains false
EXPANSION_TRIGGER = normative contract change or a required effect outside current execution mandate
NEXT_ACTION = CONTINUE
```

## Implementation choices and checkpoints

1. Preserve achieved-proof `verify_resolved`. Add a distinct genesis operation-plan
   path: keys and protected observations are future operation outputs, never forged
   preparation evidence. Owner authorizes the exact plan/package outside newly
   generated keys. Installation stays disabled until all activation predicates pass.
2. The issuer uses protected fixed code and separate role keys. It derives signed
   facts from immutable source/artifact observations and an independently executed
   review, never from an agent-provided PASS. The submitter cannot select a signer,
   reviewer, prompt, executable, scope or environment. Untrusted candidate execution
   must never share signer or review identities. No public arbitrary-sign interface.
3. The deployment registry owns only deployment obligations. Original Goal identity,
   Owner acceptance, accepted authority and acceptance contract are immutable
   enrollment data. Authenticated READY feeds the existing cumulative producer
   protocol. Durable accepted-verifier PASS plus safe finalization drives idempotent
   deployment CAS closure. Generic workflow status and UI archive are not authority.
4. Initially enroll only the proven `WORKFLOW_ACTIVE_POOL_DISPOSITION_V1` Broker
   delivery as PENDING; retain its Watchdog prerequisite and historical source
   binding. Do not imply whole-Goal closure, production acceptance or exhaustive
   integration. Exact provenance is retained in the enrollment packet.
5. Freeze source, executables, numeric identities, role/custody boundaries, ordered
   operations, abort conditions, untouched existing services and rollback. Actual
   privileged actions require a later exact Owner authorization; no sudoers change
   or production runtime connection occurs in this work.

Each independent implementation surface receives regression tests before behavior
changes. Independent security review covers new issuer, registry, bootstrap and
directly affected trust/acceptance surfaces; unrelated closed findings stay closed.
Test fixture keys remain strictly fixture data and cannot enter the bootstrap
packet. Package integrity checks never assert that runtime isolation was exercised
under privileged identities in this nonprivileged session.

## Recovery and attempt boundaries

Nonproduction changes are isolated Git changes and private temporary outputs.
Never alter shared checkouts, install files, load launchd jobs or generate live keys.
Future bootstrap must abort on any unexpected preimage, occupied identity, source
or executable drift, untrusted path, missing attributable Owner authorization or
incomplete rollback journal. It must preserve existing tasks and services during
disabled installation; ambiguous partial execution is reconciled from its durable
journal, never retried blindly. Runtime activation is separately evidenced.
