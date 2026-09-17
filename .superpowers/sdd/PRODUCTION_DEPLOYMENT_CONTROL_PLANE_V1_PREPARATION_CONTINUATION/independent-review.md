# Independent review — parent preparation continuation

Scoped preparation result: **PASS** at `33097dfd6deb015e9105c1cd8949c3cab6bc2617`.
This is not bootstrap readiness, parent-Goal completion, acceptance of a new
authority, or permission for any privileged operation.

## Coordinates and mandate

```text
SPEC_GOVERNANCE_MODE = REVIEW
REVIEW_KIND = AFFECTED_CONTRACT
TARGET_REPOSITORY = mayf3/dsh-agent-core
INITIAL_INSPECTION_HEAD = dc8373a9821cf9a221c622acab7b22f2e95aa893
REVIEW_TARGET_HEAD = 33097dfd6deb015e9105c1cd8949c3cab6bc2617
BASE_HEAD = 14a989088c4ba476b4da1c047be573de2c88f520
CURRENT_BASE_HEAD = 14a989088c4ba476b4da1c047be573de2c88f520
EXECUTABLE_SOURCE = 8ab5904fc0b79ba2e565469f1127312bb36c4e58
PRIMARY_AUTHORITY = PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1@39865536ce51005f95a98473e77c2329078512c0
REVIEWER_ID = /root/dcp_preparation_review
AUTHOR_ID = /root
AUTHOR_INDEPENDENCE = PASS
AUTHORITY_ACTION = REUSE
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = CONTROLLED
ROUTE_STAGE = IMPLEMENTATION
AUTHORITY_ACCEPTED_IN_BASE = YES
MUTATION_AUTHORIZATION = SOLE_INDEPENDENT_REVIEW_ARTIFACT
ISOLATED_WRITE_SURFACE = YES
OPERATION_ALLOWED = NO
```

The review used the existing isolated worktree
`/Users/yanfenma/workspace/worktrees/production-deployment-control-plane-v1-impl`
on `codex/production-deployment-control-plane-v1-bootstrap-preparation`. Parent
dispatch authorized only this review file. No Goal, subagent, production call,
sudo/root operation, credential/private-key read, candidate runtime execution,
installation, restart, or cutover was performed by this reviewer.

Goal: determine whether this continuation accurately prepares the reviewed
implementation and whether actual readiness is achievable from the inspected
inputs within the current mandate. Done When: verify the package/evidence,
resolve concrete review corrections, and give a bounded disposition. Expansion
is limited to a reachable false claim or affected accepted-Contract violation.

The initial scope was precisely the 13 additions in `14a9890..dc8373a`.
The final corrective delta `dc8373a..33097df` adds evidence12/13 and changes only
the report and integration census. No executable or prior evidence was reopened.
The eight original security closures, R02 closure, and fixed32 future debt remain
outside this review except for verifying that this continuation does not invalidate
their source coordinates. The frozen Base is the preceding delivery commit;
cached canonical `origin/main` was observed separately at `3c7b169` and is not
being relabeled as that Base.

## Independently executed checks

At `2026-09-17T23:25:14Z`, an euid502 read-only Python verifier opened the actual
package from evidence06, calculated SHA256 values, compared Git object bytes with
current worktree bytes, checked payload metadata, and parsed the plist. It exited0.
No preparation CLI or candidate Node runtime was executed by this reviewer.

```text
PACKAGE = /private/var/folders/jh/5k4x44w12ps1kbrch8__f6b80000gp/T/agent-deployd-reviewed-8ab5904-womrgd1k
MANIFEST_DIGEST = cd8bcc09371c091fa6bd8d93b1f2aa053cc2a3c80b0135d6a1c5892c45e66bb8
SOURCE_MAP_DIGEST = bf5019fc1c0ad3a080ef8af668db613e1f922c15768517e3f34e562b0c68c7fe
CONTROLLER_SHA256 = a3c6f8ec2d29e85999a46dec1a3f2f9656486bbd9c4b43d4d6d735e665f960d6
PREPARE_SHA256 = e6df3f7685d25176daabb78d8171f265d48a0e12e4b35a001acf724c5865c8c6
```

| Observation | Result and limits |
|---|---|
| Actual manifest and retained evidence04 | Byte-identical; its raw and canonical sorted JSON digest equals the stated manifest digest. The separately calculated canonical source-map digest equals the stated source digest. |
| 97 source entries | Each recipe/manifest entry matches both `git show 8ab5904:<path>` and the current worktree. |
| 23 actual payloads | Each hash and size matches its manifest row; each is a regular single-link file, mode0400, owned by current euid. The package has exactly these blobs plus manifest/plist. |
| 22 Node closure payloads | Each matches its retained source image from recipe01 and the exact prior `final-repair-evidence/final-manifest.json` destination/hash map. No claim of trusted build provenance or runtime validation follows. |
| Controller and preparation binaries | Both current release binaries match R02 evidence26; the package controller matches the same daemon hash. |
| Six platform tool hashes | Current bytes at the six fixed paths match the manifest hashes. Hashing did not invoke them. |
| Disabled state | Parsed plist has `Disabled=true`, `RunAtLoad=false`, `KeepAlive=false`; profile is disabled, transition sudoers is empty. Every issuer public key/custody receipt/service identity remains null. The exact package file set contains no activation record or signing-secret file. |
| Retained bootstrap target | Evidence09 binds executable8ab, the exact command and timestamps, exit0, and `13 passed; 0 failed`. This reviewer inspected that retained observation and did not rerun the tests. |
| Prior source/authority/history | At final Head, `git diff --exit-code 14a9890 33097df -- packages scripts deployment-artifacts docs/specs .agents <original implementation run> <R02 run>` exits0. Original Spec, implementation and run records are unchanged. |

R02's 176-test/full fmt/Clippy/release results are inherited source-bound evidence,
not new executions by this reviewer. Evidence12 retains the author's fresh
governance verifier PASS and prior-ref readback; this reviewer independently
checked the zero-diff paths above, not every historical branch ref.

The final corrective recheck read `dc8373a..33097df`, evidence12/13, and the new
report/census wording, then rehashed the unchanged actual package manifest.
Evidence13's historical build helper was independently read as the Git object
`e9699aee6beb1d6811e3a77f0cb4c08088241348:scripts/production-candidate-runner.mjs`:
29,204 bytes, SHA256 `90f82a68d51c67e43c10b9f20041790b51701b9081c19e87a9cd53d10e8c36f0`.
It equals the clean canonical working-tree copy. The corrected census accurately
states that it is absent from candidate14a9890 and cached origin/main3c7b169.
It is a historical reuse candidate, not an already integrated trusted builder.

## Source-supported integration assessment

The distinction between transport/authentication and deployment truth is supported
by the inspected contracts:

- Auth-service at `785d7430fd0b6b9dd3aa7c110ed857fed9fea865`,
  `src/lib/oauth/v1/signer.ts:97–150`, validates a registered audience/principal
  profile and signs fixed RS256 access-token claims. Its public audience registry
  contains12 entries and no DCP signing audience. This is not the DCP statement
  issuer interface in `trust/verify.rs:20–49`, which requires typed domain-separated
  Ed25519 statements and catalog-fixed roles/scopes.
- At svc-workflow `07d888205001708080aa50720e428c6f1c775c7b`,
  `transition_transaction.rs:148–177,209–213` provides locking, state-version CAS
  and current-assignee enforcement; `transition_receipt.rs:17–44` binds persisted
  idempotency to principal/key/request hash. `query_domain_instances.rs:120–133,
  194–235` has separate per-request transactions and keyset pagination, not a
  complete DCP producer watermark. These files are under
  `src/store/postgres/workflow_instance_repository/`.
- The same repository's accepted Product Boundary V8 at853,889,923 explicitly
  leaves business meaning, business-object identity/data and business truth to
  the upper layer. A generic workflow state cannot supply missing readiness or
  deployment acceptance semantics.
- Existing DCP `model.rs:44–62,169–174`, `queue/producer.rs:19–154`, and
  `queue/receipts.rs:180–205,278–295` already provide the required typed coverage,
  distinct Goal/producer revisions, cumulative snapshots and original-producer
  closure acknowledgement. `service/mailbox.rs:69–108` protects immutable durable
  publication. These should be reused; they do not identify the external source
  of truth. Broker `transport.js:587–589` creates a new idempotency key per new
  execution, so an eventual closure adapter must persist its original request/key.

Evidence07/10/11 is accurately bounded: seven hosted workflow names were observed,
all seven source fetches returned404, and the local tracked-source searches do
not establish global absence. This reviewer inspected those retained records;
no hosted API request was repeated and no workflow implementation was inferred
from its name. No global assertion that an issuer service cannot exist is justified.

## Minimum unavoidable inputs versus remaining engineering

Two actual attribution/selection inputs remain unresolved in the inspected scope:

1. A real trust/custody arrangement: attributable custodians, authoritative sources,
   independent reviewer anchor and a usable authenticated issuing/publication or
   provisioning plan. Existing public keys and custody receipts can be reused if
   supplied by the real facility. Where provision is needed, accepted CTR-DCP-004
   permits bootstrap to establish authentic keys; it does not require six already
   running external services or new auth-service audiences/Grants. Six distinct
   service/key/role bindings and nine proofs are the current implementation's
   `bootstrap/preparation.rs:247–344` requirements, not additional Spec authority.
   Creating caller-held fixture keys would not resolve isolation or attribution.
2. The actual canonical business Goal owner and record mapping, including accepted
   readiness, acceptance and closure/CAS meaning and the authorized caller. No
   inspected source selects these facts. Choosing a workflow definition, task
   title or arbitrary successful status would invent authority. The deployment
   Spec supplies the consumer obligations, not those source-specific business facts.

After those selections, the narrow producer/issuer adapters, durable request/CAS
handling, source-bound release coverage and resolved preparation remain engineering
under this same parent Goal. They are not completed by this review. A generic
adapter shell cannot create the missing truth or honestly make READY. No concrete
existing reuse path found in the inspected contracts supplies both missing bindings
without inventing authority or crossing the present privilege boundary.

Protected sudoers/legacy inventory is not a third unavoidable advance input merely
because UID502 cannot read it. CTR-DCP-017 and Spec section7 separate an exact
reviewable bootstrap plan from its execution. The operation request must bind
known target paths, candidate bytes, intended effects, numeric identities, rollback
rules and abort conditions. Its first authorized privileged steps can read the
protected surfaces and capture fresh preimages. Discovery of unknown writers or
effects outside the reviewed plan must stop before mutation and require the
affected plan to be refrozen. Actual retirement/lifecycle-denial proof remains an
enrollment/activation gate. It must not be falsely marked executed during preparation.

## Corrective recheck and disposition

Three documentation clarifications raised during this review are closed at33097df:

1. The report no longer requires a separate privileged inventory/preimage operation
   before any bootstrap authorization request; it states the future read-only abort gate.
2. It distinguishes six/nine implementation gates from accepted Spec authority and
   allows authentic custody establishment at separately authorized bootstrap.
3. The reusable build helper now has the exact historical source revision/hash and
   explicit absence from the current candidate/cached canonical tip.

These corrections introduce no new executable semantics or package bytes. No
new frozen security blocker or optional hardening obligation is introduced.

```text
SPEC_REVIEW = NOT_APPLICABLE
AUTHORITY_REVIEW = PASS
PRIMITIVE_BOUNDARY_REVIEW = PASS
CONTRACT_REVIEW = PASS_FOR_PREPARATION_CLAIMS
ACCEPTANCE_COVERAGE_REVIEW = PASS_FOR_AFFECTED_EVIDENCE_ONLY
MANDATE_SCOPE_REVIEW = PASS
EVIDENCE_REVIEWABILITY = PASS
BASE_IMPACT = BOUNDED_DOCS_AND_EVIDENCE_ONLY
BLOCKERS = 0
SPEC_GAPS = 0_NEW_AUTHORITY_GAPS_ESTABLISHED
FOLLOW_UPS = 0_NEW_OPTIONAL_ITEMS
TOOLING_DEBT = 0_NEW_ITEMS
SCOPED_PREPARATION_REVIEW = PASS
BOOTSTRAP_READY = NO
IMPLEMENTATION_COMPLETE = NO
PARENT_GOAL_COMPLETE = NO
MERGE_READY = NOT_ASSESSED
OPERATION_ALLOWED = NO
NEXT_ACTION = STOP_AT_TWO_ATTRIBUTABLE_INPUT_GAPS
```

The stop is bounded to the missing real inputs above. It does not waive adapter
implementation, pretend production acceptance, require a new child Goal, or reopen
unrelated prior work. Review completion itself does not authorize bootstrap.
