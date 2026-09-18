# PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1 — exact first bootstrap authorization packet

```text
GOAL = PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1
ACCEPTED_SPEC = 39865536ce51005f95a98473e77c2329078512c0
EXECUTABLE_SOURCE = 65559ddb9d414d248f640f46216bd62e8068983d
IMPLEMENTATION_COMPLETE = YES (authorized nonproduction local-binding/genesis scope)
TESTS_PASS = YES
INDEPENDENT_REVIEW_PASS = YES
BOOTSTRAP_READY = YES (FIRST_DISABLED_GENESIS_ONLY)
BOOTSTRAP_AUTHORIZED = NO
ACTIVATION_READY = NO
PARENT_GOAL_COMPLETE = NO
NEXT_ACTION = HUMAN_REQUIRED_FOR_EXACT_PRIVILEGED_BOOTSTRAP
PRODUCTION_MUTATION_PERFORMED = NO
PRIVILEGED_BOOTSTRAP_PERFORMED = NO
```

This continues the same parent Goal. R02 remains closed at reviewed 8ab5904;
its passing rereview was not treated as parent completion. Accepted Spec semantics
and the original SDD run records are unchanged. The current Owner mandate permits
selecting/implementing local issuer custody and deployment-only authority bindings.
The exact package follows Spec section 7's **disabled trust/controller install**
stage. Runtime enrollment, legacy retirement, canary and enablement follow later
under their exact privileged authorization; this packet does not claim them done.

## Exact package to authorize

Package directory:
`/Users/yanfenma/workspace/artifacts/production-deployment-control-plane-v1/genesis-65559dd`

```json
{
  "initial_registry_digest": "2a02f1b597c1963a1b080924d778099b6aea3c1ef345ae04643648cd8e333842",
  "package_digest": "fe3d6711df190b76de32cabf3607b6de12f575803f213d6603ee1eb264c5b065",
  "plan_digest": "7c516b2f349226b258e5289cd5c8ac3e9c879ae19d9ecf5d0c284698598895ab",
  "review_record_digest": "89f50873ae411a3df017d45e1d72feadc3b0c52862a51c86422094c26f15ea82",
  "source_digest": "81aee70d3d96b976b55f2e92b814e876121b5f31a2dc40960247fc327e695d06",
  "supervisor_policy_digest": "254ac64e7c3c3f0a4026b6feab568f2090cd2701234308c5e0594f4fcbdd7bb0"
}
```

Exact executable SHA-256 values:

```json
{
  "/usr/local/libexec/agent-deployd/agent-deploy-bootstrap": "2a8550ac3ffde4ccd21d501d7869608628bacd8ccb4feaab44aeb1803546d301",
  "/usr/local/libexec/agent-deployd/agent-deploy-issuer": "f7e02be4a17b28a34a37eb9b54eea9a94a5f7e1eab3459ba53cc8b0868bcea45",
  "/usr/local/libexec/agent-deployd/agent-deployd": "d732a4285695b397f11dbbe9a4100e141d4abca56365011c75791ee495a241cb",
  "/usr/local/libexec/agent-deployd/codex": "b973d440acac501fd2594a43e7ca9ce41e0a65b9dfb28d0d7a7837c99e1261e3"
}
```

The immutable package includes 152 exact Git source files, four real executable
images, the fixed review schema, initial registry, prospective policy and sealed
independent review. Its mandatory isolated `cargo build --release --locked` was
observed with rustc 1.98.1 / aarch64-apple-darwin. The controller and reviewer are
native ARM64; the prospective dsh runtime profile remains x86_64 as required by
its separately retained Node candidate. No Node candidate is installed by this
package. Every direct dependency of these four executable images is an Apple
`/usr/lib` or `/System/Library` image; no rpath, dyld environment command or
non-system loader dependency was found. Fresh protected OS checks remain execution
gates. No test key, live private key, copied login credential or activation proof
is present.

The nonroot package verifier returns `plan_ready` and byte integrity true, while
bootstrap permission, activation, achieved protected poststate and authenticated
review-result verification remain false. It is an integrity verifier. The actual
independent reviews are retained separately and the Owner grants permission outside
newly generated keys; arbitrary report text is not trusted by runtime signing.

## Resolved issuer and business-authority bindings

- mayf3 owns deployment policy and trust roots. Six role-specific Ed25519 keys
  will be generated from the system CSPRNG only during an authorized install,
  stored root-only (0700 directory, 0600 files). No generic sign/PASS input API.
- Canonical observations use public `mayf3/dsh-agent-core` GitHub commit/tree and
  ancestry, fixed URL/client/hash, without repository credentials. The actual
  c9ffe1d read-only probe passed, including selected dependency/review files.
- The deterministic builder copies only declared regular source blobs; no candidate
  code executes. The concrete source/dependency manifest binds the frozen source,
  seven transitive local module dependencies and `node:process`; the protected
  future NativeEnrollment and exact issuer digest also enter issued build evidence.
- Independent review runs as `_dcp_review` UID/GID 612 in an isolated HOME, with a
  pinned Codex/helper, fixed prompt/schema, no tools/plugins/shell/delegation, and
  a process-execution sandbox. Only observed exact bound review output can be signed.
- Deployment registry owns only a distinct deployment obligation. The first entry
  is `WORKFLOW_ACTIVE_POOL_DISPOSITION_V1_BROKER_DEPLOYMENT`, linked to the actual
  original task/Owner request, V4 accepted Spec/acceptance and frozen source
  c9ffe1d1637db2997689d8b2ef7def4fc1086b17. Five original evidence references were
  byte-rehashed. Entry imports as PENDING, never presumed READY or business complete.
- Its `DEPLOYMENT_DELIVERY_V1` acceptance proves installed bytes and physical
  readback. Original V4 ACC-XR-007/HR/business obligations remain pending. The
  recorded Watchdog prerequisite is preserved; no production dependency PASS was
  fabricated. This is an explicit initial scope, not all business Goals onboarded.
- The internal producer adapter supplies signed cumulative snapshots/watermarks and
  consumes protected Queue outbox receipts with safe-finalize CAS closure. Deployment
  CLOSED never means the original business Goal is complete.

Issuer/public input is therefore **resolved as implementation and package policy**.
Actual key/custody/account establishment is a bootstrap operation, not missing
external information. Fresh native enrollment/readback and actual prerequisite/
business acceptance remain activation/end-to-end gates. No unresolved issuer or
registry design choice is being returned to the Owner.

## Complete parent remaining-condition assessment

| Accepted contracts / acceptance | Nonproduction state | Required later executed production evidence |
|---|---|---|
| CTR001 / ACC001 — readiness discovery | Signed local registry, CAS, cumulative snapshots, paging, watermarks and actual initial provenance implemented/tested | Authorized import readback; declared producer census under enabled service; no global onboarding claim |
| CTR002–003 / ACC002 — immutable unit and coalescing | Existing queue/unit/late-coverage tests remain passing; same artifact shares intent; conflicting unsubmitted artifact stays PENDING | Real joint Goal release with one install/restart and separate receipts |
| CTR004,006 / ACC003 — source/build/review/policy | Real public frozen-source observation; protected typed issuer; independent reviewer; lease/revocation/crash tests pass | Actual role-key custody, reviewer login/isolation and authenticated native-enrollment readback |
| CTR005,008 / ACC004 — artifact/profile safety | Existing no-follow/metadata/slot/loader and new complete package tests pass | Exact protected target preimages, installed slots/loader/plists verified during enrollment |
| CTR007 / ACC005 — identity/socket API | Kernel credential socket tests pass; issuer accepts only scoped goal/source; five controller operations unchanged | Actual socket ancestor and group-denial proof before socket/daemon activation |
| CTR008,017,019 / ACC006 — privilege boundary | New installer separately reviewed; no arbitrary command/parameter interface; no transition sudoers rule | One authorized disabled genesis; then separate exact runtime enrollment/activation transaction |
| CTR009–010 / ACC007 — global mutex | Entire transaction mutex/recovery tests pass; only test readiness handshake repaired | Fresh four-lock-family/active-legacy transaction census and maintenance serialization |
| CTR010 / ACC008 — dependencies/ordering | Existing DAG/STOP policy and new protected dependency/target issuance tests pass | Real Watchdog prerequisite receipt before the selected Broker delivery |
| CTR010–011,020 / ACC009 — unknown/recovery | Existing recovery/attempt tests plus issuance partial-publication and resource-bound regressions pass; R02 remains closed | Privileged unknowns reconciled from actual journals, no blind replay |
| CTR012–013 / ACC010 — apply/restart/rollback | Existing full preimage/rollback/process-generation fixtures pass; new conservative genesis rollback tested | Actual target preimage, restart/health/readback and exact safe rollback/canary |
| CTR014–015 / ACC011 — per-Goal acceptance | Local verifier mapping repaired; durable finalized outbox/registry closure tests pass | Native deployment receipt plus separate original business acceptance/E2E |
| CTR016–017 / ACC012 — standing authority | Truth table/disabled activation tests pass; protected policy and exact bootstrap plan implemented | Protected bootstrap epoch, enrolled profile and standing Train enabled after required gates |
| CTR018 / ACC013 — retirement/adoption | Existing guards and prospective inventory retained, no unrelated findings reopened | Retire canonical legacy writers/sudoers/helper/launch paths; actual write/signal/domain denial; auth-service and gui/502 svc-workflow remain unenrolled |
| CTR019–020 / ACC014 — sunset/resource limits | No transition lane selected; current quota/retention/timeouts and new issuer quotas tested | Actual protected capacity/readback, retained rollback evidence and declared coverage |

These production rows keep the parent Goal incomplete. They are subsequent phases
of this Goal, not newly invented user-coordinated Goals or missing public-issuer
materials. The first irreversible/privileged boundary is now the exact package
below; all required preparation for that boundary has been performed.

## Tests and independent review

- Rust full suite: **256 passed, 0 failed, 2 explicitly manual online smoke tests
  ignored**. Ignored tests are not described as native identity/login verification.
- Python packager: **7 passed**. Format, Clippy (`-D warnings`), locked release and
  isolated package build passed. R02/recovery/acceptance tests remain in the suite.
- New negative-first repairs cover policy equivocation, exact Draft/publication
  interruption, partial-file mismatch, retained-data quota, conflicting-target
  issuance, source freeze, business/deployment separation and verifier mapping.
- Fresh independent source/package review by `dcp_preparation_review`: PASS.
  Fresh separate installer review by `dcp_binding_authority_review`: PASS;
  GI-R1 closed. No new first-genesis ship blockers.
- Repository structure gate still reports three unchanged baseline violations in
  unrelated directories; no global structure PASS is claimed. All current Rust
  files are <=500 lines; affected new directories remain <=20 children.

Evidence: [index](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_LOCAL_BINDING/evidence-index.json),
[independent decisions](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_LOCAL_BINDING/independent-review.md),
[changed files](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_LOCAL_BINDING/changed-files.txt),
[final package verification](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_LOCAL_BINDING/final/package-final-verify.json).

## One requested Owner authorization

Authorize **one fresh disabled genesis attempt and its dedicated reviewer login**,
for the exact six pins above, on host digest `343ecc65a7edc224c7b235c9bdbcc964ef5e81475734dc97bb1fa057e2959024`.
The authenticated grant is valid at most 3600 seconds and is created only after
explicit Owner acceptance. It is not signed with the new genesis trust roots.

Actual privileged effects:

1. Install the exact bootstrap runner into a fresh root-owned protected code
   directory after external SHA-256 comparison, then execute only that runner.
2. Read and receipt root preimages, complete readable sudoers includes, existing
   system service plist hashes and local/search identity census. Unexpected state
   stops before installation steps. Sudoers and existing service files are not changed.
3. Create `_dcp_review` UID/GID612 (nonlogin shell), `_agentdeploy` GID602 and its
   UID502 caller membership. Create the new root-only state/journal/custody paths,
   isolated reviewer HOME and neutral review workspace.
4. Install the four exact binaries plus schema; generate six separate role keys;
   import the sole exact deployment enrollment as PENDING; write disabled profile/
   service config and disabled `ai.agent-deployd.plist`; record/read back each step.
5. Drop to UID/GID612 through the fixed reviewed helper for one visible dedicated
   `codex login --device-auth`, placing credentials only in that isolated HOME.

No launchctl invocation, service enablement/start/restart, target app/Node install,
production routing change, legacy retirement, sudoers edit or native target
activation is authorized by this requested scope. Existing tasks retain their
current code, service identities, runtime and entry points. A nonprivileged census
found proposed names/IDs/paths absent and 17 existing system plist metadata faces
protected; fresh root recheck remains mandatory at execution.

Failure recovery: each step writes durable intent before effect and result after
readback. Any unpaired intent is UNKNOWN; no automatic retry, lock deletion, key
regeneration or new-attempt bypass. New admission remains disabled. The reviewed
rollback removes only exact-hash new nonsecret files recorded by completed steps.
It preserves keys, identities, state, runner and journals; uncertain partial effects
require explicit receipt-based reconciliation. Existing services are not silently
restored/restarted or switched. This is conservative containment, not a promise
that every partial bootstrap can be erased automatically.

**Owner actions:** approve this exact package/plan once; perform the macOS
administrator authentication when the authorized operation starts; complete the
visible dedicated Codex device login. The Agent will prepare the fresh exact
`GenesisOwnerGrant`, run the prescribed operation/readback and retain receipts;
the Owner is not asked to supply issuer endpoints, keys, registry fields or shell
implementation. No privileged command has been run in this preparation turn.

Suggested response:

```text
AUTHORIZE_DISABLED_GENESIS=YES
PACKAGE_SHA256=fe3d6711df190b76de32cabf3607b6de12f575803f213d6603ee1eb264c5b065
PLAN_SHA256=7c516b2f349226b258e5289cd5c8ac3e9c879ae19d9ecf5d0c284698598895ab
OWNER=mayf3
SCOPE=ONE_DISABLED_INSTALLATION_AND_DEDICATED_REVIEWER_LOGIN
```

The explicit permission boundary comes from the Owner's current mandate and
accepted Spec CTR-DCP-017 / section 7. Implementation acceptance does not grant it.
[Controlled operation procedure](PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_GENESIS_RUNBOOK.md).
