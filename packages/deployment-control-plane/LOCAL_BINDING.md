# Local issuer, registry and disabled genesis

This implements accepted `PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1@3986553` under
mayf3's explicit mandate to select local trust and business-authority bindings.
It does not amend that Spec or grant bootstrap/production permission.

## Selected trust boundary

The protected controller hosts a fixed local evidence coordinator. The separate
`issuer.sock` producer endpoint accepts only `goal_id` and `source_sha`; kernel
UID/GID and configured producer scope determine the caller. It is not a signing
API. The controller's existing five deployment operations remain unchanged.

The coordinator reads the immutable enrolled Goal, observes exact canonical Git
source/tree through the fixed public GitHub origin, and copies regular reviewed
file slots. No candidate build script, package manager or interpreter runs.
SourcePolicy is protected Owner configuration; callers cannot choose URLs, paths,
toolchain, signing identities, review scopes, prompts or verdicts. The initial
enrollment freezes c9ffe1d1637db2997689d8b2ef7def4fc1086b17.

Six independently generated Ed25519 role keys are root-owned 0600 under a root-only
0700 directory. Only typed internal signing paths can load them. Authority,
Builder, Reviewer, Producer, Verifier and Recovery domains remain separate.
Native key generation runs only inside an externally authorized bootstrap; fixture
keys and current user credentials are never copied into the package.

The reviewer is `_dcp_review`, UID/GID 612, with a private independent Codex HOME.
A fixed protected helper drops supplementary groups/GID/UID and execs the exact
hash-pinned Codex Mach-O. The fixed prompt treats candidate contents as untrusted;
tools, hooks, plugins, MCP, shell and delegation are disabled. A macOS sandbox
also denies forks and other executable paths. Root signs a review only after the
owned bounded subprocess returns a schema-valid, exact-job, exact-input PASS with
no findings, followed by rehashing the protected inputs/executables. A submitting
Agent cannot supply that output. Owner performs a fresh device login once during
authorized genesis; the runtime never reads another user's authentication files.

The protected policy cache preserves identical signed bytes for each issuance
epoch, durably advances epochs on renewal, and separately enforces Owner policy
revision rollback/equivocation and revocation checks. A cached lease may be reused;
an expired or ambiguous state cannot authorize apply.

## Durable preparation and producer integration

Before writing staging, all retained staging/job/proposal bytes and files count
towards a 512 MiB / 8192-file limit, including failed and partial attempts. The
issuer serializes preparation with its permanent lock. It persists the exact
independent evidence in a content-addressed Draft and atomically publishes a
binding index before READY. Interrupted publications resume that Draft; lease
renewal derives a new transport request ID without changing signed build/review
or READY evidence. Uncommitted partial drafts remain retained and do not claim
the authoritative binding. Mismatched final evidence fails closed.

An outstanding different artifact on the same target returns
`ISSUER_TARGET_PENDING` before new staging/READY. Same-artifact Goals remain
eligible for shared intent and existing controller coalescing. This rule does
not reset attempts, invent future generations or release a failed obligation.
The previous deployment must actually close before its reservation is released.

The local registry is a durable signed ledger, not a workflow status mirror.
Enrollment preserves the original business Goal, source records and their hashes,
Owner, accepted authority, acceptance contracts and dependencies. It owns a
distinct deployment-only obligation:

`PENDING -> READY -> CLOSED`, with revision CAS and cumulative signed producer
snapshots. The controller's intake adapter consumes those snapshots directly.
Closure requires the actual protected Queue outbox, accepted verifier receipt,
current physical execution binding and safe finalization. Closure acknowledgement
survives retries. `business_goal_complete` always remains false.

The first entry is
`WORKFLOW_ACTIVE_POOL_DISPOSITION_V1_BROKER_DEPLOYMENT`, linked to original Goal
`WORKFLOW_ACTIVE_POOL_DISPOSITION_V1`. `DEPLOYMENT_DELIVERY_V1` accepts exact
installed Broker bytes/process generation only. Original V4 ACC-XR-007 and HR/
business acceptance remain pending; the original Watchdog prerequisite remains
mandatory. Initial import is PENDING and does not invent a dependency PASS or
claim exhaustive integration of every existing Goal.

After actual activation, an authorized producer may run:

```text
agent-deploy-issuer prepare GOAL_ID SOURCE_SHA
```

It returns a trusted proposal digest for the existing controller `submit` API.
It refuses to prepare through an absent/invalid native activation proof. The
initial disabled installation cannot issue operational proposals. Every future
BuildAttestation also binds the authenticated native-enrollment digest and exact
issuer executable, alongside the retained frozen build-input manifest. Native
precheck verifies enrolled retained faces and the Node/plist/process boundaries.

## Exact disabled package and later gates

`tools/prepare-genesis.py` requires an exact clean committed source. It performs a
locked release build with an isolated environment and checksum-verified public
Cargo cache, copies actual binaries, derives policy executable hashes, and emits
the complete source manifest, plan and six external pins. It copies no keys or
authentication files. `--finalize-review` changes only the independent report and
its plan/pins; the package/source/executable/policy identities stay fixed.

The package is an operation plan. Its verifier deliberately reports
`bootstrap_allowed=false`, `activation_allowed=false`, and no achieved protected
poststate. Independent source/package review and separate exact Owner permission
are required. See the repository's `GENESIS_RUNBOOK` for the concrete operation.

First genesis creates only isolated identities, protected code/state/role keys,
the PENDING registry, disabled profile/plist and reviewer-login capability. It
does not start a service, write sudoers, restart a task, change a production entry,
enroll a target, retire legacy writers or claim a real canary. Actual target
enrollment, complete protected runtime closure, lock-family census, lifecycle
denial, legacy retirement, canary and standing activation remain later guarded
phases in the same parent Goal. Auth-service and caller-owned svc-workflow remain
unenrolled. These are not issuer/public-information gaps.
