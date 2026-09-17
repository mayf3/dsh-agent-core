# Actual integration census

Read-only parent-Goal investigation on2026-09-18 Asia/Shanghai. Independent
investigators `/root/dcp_issuer_census` and `/root/dcp_producer_census` made no
writes or production calls. Root independently reproduced bounded negative
searches in evidence11 and hosted workflow inventory/source-availability in07/10.
This does not prove no external service exists outside the inspected locations.

## Coordinates

- DCP candidate delivery14a989088c4ba476b4da1c047be573de2c88f520, executable8ab5904.
- auth-service HEAD/local main785d7430fd0b6b9dd3aa7c110ed857fed9fea865;
  cached github/main3cf7f684a3d5c9b0d3d1f1caffcfc8b063142cbc. Cited signing and
  registry code identical across these observed refs. Remote mayf3/auth-service.
- svc-workflow cached github/main07d888205001708080aa50720e428c6f1c775c7b;
  its working checkout88ff8145 is older. All svc source references below refer
  to `git show 07d8882:<path>`, not working-tree line numbers.
- dsh canonical checkoute9699ae is older than cached origin/main3c7b169;
  candidate paths and relevant canonical ref source were read explicitly.
- it-ops-control-plane1f7bf696d960f291eaebb5c2884593d281991723.

## Reusable real capabilities

auth-service `src/lib/oauth/v1/signer.ts:97–150` signs fixed RSA/RS256 access-token
claims after registered audience and principal-profile validation. `direct.ts:81–125`
checks client/principal/grants. `src/routes/well-known.ts:19–49` publishes RSA JWKS.
`src/lib/oauth/workflow-keyring.ts:114–124,162–186` requires RSA private material.
The public frozen `contract-bundles/minimal-auth-v1/audience-registry.json` has12
audiences and no DCP/build/review audience. No private material was read.

DCP instead checks domain-separated Ed25519 statements and role/scope in
`src/trust/verify.rs:20–49`; `src/bootstrap/preparation.rs:247–302` requires six
distinct service/key/role bindings and custody receipts, then nine independently
anchored prerequisite proofs at309–352. OAuth authentication alone cannot prove
build isolation, review independence, source truth or those DCP signatures.

At dsh Git objecte9699aee6beb1d6811e3a77f0cb4c08088241348, the clean tracked
`scripts/production-candidate-runner.mjs:357–388` derives immutable
source/toolchain/architecture/closure hashes and unsigned text build evidence;
`:600–608` hashes supplied test/audit receipts. It can be reused inside an actual
trusted build service; its present caller-supplied evidence is not an issuer.
The file is absent from candidate14a9890 and cached origin/main3c7b169; this is
an explicit historical-source reuse candidate, not already integrated code.
Evidence13 pins its29,204 bytes and SHA256
`90f82a68d51c67e43c10b9f20041790b51701b9081c19e87a9cd53d10e8c36f0`.
Broker `packages/broker/src/credential-store.js:135–177` exposes credential metadata
only and explicitly does not prove Auth/grant validity. Protected credentials for
other purposes cannot be repurposed into DCP authority.

The IT ops repository contains inventory, drift, recovery and secret-reference
metadata. Its temporary Ed25519 SSH operator-session key (`scripts/ops_inventory/
root-operator-session.sh:125–138`) is unrelated to deployment statement signing;
the script was not executed. No DCP signing custody appears in its seven declared
secret references. Auth `.env` metadata is505:601/0600; contents were not accessed.

GitHub read-only inventory finds four dsh and three auth workflows, all named for
governance/adoption operations. Each content lookup at the default branch returned
404; evidence10 retains these failures. Workflow names do not prove current source
or running capability, so no hosted builder absence or inspected workflow-code
claim is made. No workflow was started and no repository setting/key was changed.
Auth search11 has two filename matches: they contain the unrelated historical
`PRODUCTION_JWKS_DEPLOYMENT_READY` flag, not DCP producer or signing implementation.

## Actual producer contracts

svc-workflow has useful generic primitives:

- `src/http/dto.rs:46–63`, `transition_transaction.rs:148–177,209–213`,
  `transition_helpers.rs:230–264`: instance lock, current-assignee check,
  `expectedWorkflowStateVersion` and current Visit CAS.
- `transition_receipt.rs:1–44`: `(principal_id,idempotency_key)` plus request hash
  and a persistent response for retry; no independent deployment PASS verification.
- `query_types.rs:49–79`, `query_domain_instances.rs:120–133,194–235`: keyset
  pagination with a separate REPEATABLE READ transaction per HTTP request.
  `handlers/timeline.rs:20–37` provides a single-instance event cursor, not a
  complete registered-producer snapshot/watermark.
- Migration0016 has artifact columns; the inspected current src has no consumer
  establishing deployment coverage/build/review truth from those columns.

The transition/query-domain files above are under
`src/store/postgres/workflow_instance_repository/`; query_types is under
`src/application/workflow_instance/`, and handlers is under `src/http/`.

Accepted Product Boundary V8 `docs/product/SVC_WORKFLOW_PRODUCT_BOUNDARY_V8.md:
853,889,923` separates workflow structural validation from business truth and says
the upper layer owns business-object identity/data. DCP readiness should not be
inferred from generic task status or added to the generic workflow engine by guess.
The requirement skill creates a generic instance from a published definition and
executes exact supplied transitions. The local execution ledger is likewise not
business authority (`packages/workflow-execution/src/ledger.js:5`).

The DCP consumer contract already exists and should be reused unchanged:

- `GoalCoverage` / `ReadyRecord` bind exact Goal acceptance revision, source,
  artifact/face, authorities, dependencies and verification profile (`model.rs:44`).
- Per-Goal readiness revision, producer snapshot revision/watermark and workflow
  state version are three different coordinates (`queue/producer.rs:19–154`).
  A snapshot must retain previously observed Goals, including closed rows.
- A safely finalized PASS produces a durable closure outbox. Only the original
  producer may sign `ClosureAcknowledgement { outbox_id, goal_id, receipt_digest,
  previous_revision, closed_revision: previous_revision + 1 }` where revision is
  the Goal readiness revision (`model.rs:160`, `queue/receipts.rs:180,278`).
- The protected mailbox publisher, permanent lock, immutable bytes and fsync are
  implemented (`service/mailbox.rs:69–108`). Root consumers read snapshots/results,
  publish closure and read ACK; that is transport, not an upstream source of truth.
- Broker `transport.js:589` creates a fresh idempotency key per execution; a closure
  adapter must persist its own exact request/key across crashes, then ACK only
  after the canonical business CAS. Calling a generic completion tool anew is unsafe.

## Minimum missing binding, not a request for a new platform

Use a single narrow producer adapter on top of these DCP types and the actual
Goal-owning system. The reusable engineering path is clear; its actual inputs are
not established by any inspected file:

1. Real DCP issuer public keys, service/role/source bindings, isolated custody and
   independent review trust anchor; actual authenticated issuing/publication
   interface. Existing OAuth/SSH keys and fixture keys cannot substitute.
2. The canonical system owning business Goals and exact Goal-to-record mapping;
   accepted readiness and acceptance source contracts; exact closure CAS/transition
   contract and authorized caller. Workflow instance state alone is insufficient.

With those bindings, the remaining implementation is a bounded adapter: durable
readiness CAS/cumulative snapshots, fixed authenticated statement publication,
receipt verification, durable canonical closure CAS and signed ACK. Without them,
choosing an arbitrary workflow definition, task title, key or PASS source would
create authority the user did not grant. No integration code or synthetic trust
was added merely to turn readiness green.
