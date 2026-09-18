# Corrected disabled genesis — one exact reconciliation authorization request

The actual first operation stopped before any InstallStep. The narrow source
repair, full validation, independent source review, procedure review and actual
inert package binding have completed. This request retains the same parent Goal
and original attempt. It does not assert that installation or login succeeded.

```text
GOAL = PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1
ACCEPTED_SPEC = 39865536ce51005f95a98473e77c2329078512c0
EXECUTABLE_SOURCE = bcfd929b7c760947df9c6f03a830a9e8a0b16651
CENSUS_REPAIR_IMPLEMENTATION_COMPLETE = YES
TESTS_PASS = YES
INDEPENDENT_SOURCE_REVIEW_PASS = YES
INDEPENDENT_PROCEDURE_REVIEW_PASS = YES
FINAL_BINDING_RECHECK = PASS
BOOTSTRAP_READY = YES; SAME_ATTEMPT_DISABLED_RECONCILIATION_ONLY
CORRECTED_PACKAGE_AUTHORIZED = NO
INSTALLATION_COMPLETE = NO
REVIEWER_LOGIN_COMPLETE = NO
ACTIVATION_READY = NO
PARENT_GOAL_COMPLETE = NO
```

## Actual operation and correction

Authorized package fe3d6711df190b76de32cabf3607b6de12f575803f213d6603ee1eb264c5b065
was invoked exactly once. The root bootstrap runner, external grant, journal
directory and permanent lock were created; sudoers preflight then returned
`UNSAFE_FLAGS`. No attempt directory, identities, keys, registry, reviewer HOME,
controller plist or login was created. No service was started/enabled/restarted,
no sudoers file/flag changed, no entry switched and no real deployment occurred.

Root-only diagnostics and independent review confirmed that existing sudoers
has macOS UF_COMPRESSED32; the earlier lock is flags0. The census incorrectly used
artifact zero-flags validation. The corrected reader applies only to readonly
sudoers/include census. It preserves no-follow traversal, exact owner/group,
regular single-link metadata, permission/ACL/xattr checks, logical size cap,
two identical fd reads and metadata stability. Artifact/grant/key/executable
validation is unchanged. The host's sudoers was not modified to make checks pass.

The17 previously observed process identities retained their PID/UID/start-time/
executable. Two additional processes appeared at10:00; no cause is inferred. This
is process continuity evidence, not a runtime-health or business acceptance claim.
Full existing-plist preimage equality is unclaimed because preflight stopped before
durable root census recording. See the [actual attempt report](PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_GENESIS_ATTEMPT_20260918.md).

## Exact artifacts

Package directory:
`/Users/yanfenma/workspace/artifacts/production-deployment-control-plane-v1/genesis-bcfd929`

Six final package pins:

```json
{
  "initial_registry_digest": "2a02f1b597c1963a1b080924d778099b6aea3c1ef345ae04643648cd8e333842",
  "package_digest": "5bf407d815068e84d9dcfbbbe442498169bb43ab98f388b168bd5d6eca40911b",
  "plan_digest": "c3a5ed50ffe2588cedc26b7ba3931aef85de496143ea355d70b773648b6bd38e",
  "review_record_digest": "d9263b414689c78fe24369d25c2d68e6cfecd8c57aee21edb239aefb6e118e7d",
  "source_digest": "6e06c0b665c8758c548adf02816c7f892ed4b8710cbc999ee0c3e7a82bb95a0d",
  "supervisor_policy_digest": "980d3f08cd741139b6d1c1d5ade9b0a7a9deefe4a650776b1b504c0258cdb6a0"
}
```

The [same-attempt companion plan](/Users/yanfenma/workspace/artifacts/production-deployment-control-plane-v1/genesis-bcfd929.reconciliation-plan.json) has SHA256:
`588572b7568c91aedeedc8cf817ed0c9d809dded45fc12f740f3f2d13b584d6e`.
It binds the old and new pins, source/tree, host, old runner/grant/lock preimages,
absent identities and destinations, exact runbook digest, permitted changes,
rollback, one further native invocation and one reviewer login. The reviewer
Codex bytes and business registry are unchanged; policy changes only its binding
to the rebuilt helper digest. The4 executables have only Apple loader dependencies.

New bootstrap runner SHA256:
`d918d8f6f1d5e84334cd4a5e130cca998bcc5eb049a5de10a95093c0f4e7fe3c`.
Old installed runner retained at
`2a8550ac3ffde4ccd21d501d7869608628bacd8ccb4feaab44aeb1803546d301`.
The package contains153 exact reviewed source files,4 real ARM64 binaries and1
fixed review schema. Its actual isolated `cargo build --release --locked` succeeded.
No generated production key, copied credential or synthetic runtime proof is present.

## One requested operation

Authorize the companion plan and six pins above for the same host
343ecc65a7edc224c7b235c9bdbcc964ef5e81475734dc97bb1fa057e2959024,
Owner mayf3 and original attempt `genesis-65559dd-20260918-01`:

1. Reconcile the known prefix using protected read-only checks. Require code to
   contain only the old exact runner; journal to contain only the exact existing
   lock; original grant hash/Owner/host/pins/attempt to match; every InstallStep
   target and proposed identity to remain absent. Any unexpected effect stops.
2. Replace only that old runner with the exact correction via pinned Apple install.
   Verify its protected hash before root execution. Preserve old grant, old package,
   lock and evidence; create a separate fresh exact grant with the same attempt.
3. Invoke the corrected native disabled installer once. It rechecks all bindings,
   permanent mutex and complete protected census before journaled InstallSteps.
4. Only after successful disabled installation, perform one isolated reviewer
   device login. Export public receipts/configuration and metadata for independent
   poststate verification. No private key/auth contents are exported.

Expected existing-task impact: none planned. Existing runtime code, identities,
service entries and process lifecycles stay as they are. This operation still
excludes controller/service enablement/start, existing restarts, native target
installation/enrollment, sudoers changes, production switching, legacy retirement
and real deployment. It does not complete the parent Goal.

Recovery: before any native effect, exact old-runner restoration is permitted only
from verified bytes/preimages; a mismatch stops. After native invocation, preserve
the original attempt and all partial effects. Use only the reviewed recorded-hash
nonsecret rollback; identities, keys, state, runner and locks remain protected.
Unpaired intent or failed/timed-out login remains unknown and cannot be replayed.
Full procedure: [reconciliation runbook](PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_GENESIS_RECONCILIATION_RUNBOOK.md).

Owner actions are limited to accepting this exact replacement/continuation once,
local administrator authentication, and the visible dedicated device login.
The Agent handles commands, records and readback. No issuer/registry field choices
or separate Goal coordination are requested.

```text
OWNER=mayf3
GOAL=PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1
AUTHORIZE_DISABLED_GENESIS_RECONCILIATION=YES
ATTEMPT_ID=genesis-65559dd-20260918-01
PACKAGE_SHA256=5bf407d815068e84d9dcfbbbe442498169bb43ab98f388b168bd5d6eca40911b
PLAN_SHA256=c3a5ed50ffe2588cedc26b7ba3931aef85de496143ea355d70b773648b6bd38e
RECONCILIATION_PLAN_SHA256=588572b7568c91aedeedc8cf817ed0c9d809dded45fc12f740f3f2d13b584d6e
SCOPE=EXACT_RUNNER_REPLACEMENT_AND_SAME_ATTEMPT_DISABLED_INSTALL_LOGIN
```

This new authorization is necessary because the Owner's existing grant explicitly
binds the old exact package/plan, and accepted CTR-DCP-017 requires a separately
exact bootstrap manifest. Changing a binary cannot inherit old-pin permission.
No changed binary or second native invocation has been executed.

## Validation and evidence

- Real compressed regression failed UNSAFE_FLAGS before implementation and passes
  after. The identical fixture remains rejected as an artifact.
- 4 focused census tests cover compressed includes, size limits, links, writable or
  wrong-owner/group files, forbidden flags/xattrs/ACL, malformed/cyclic/bounded graphs.
- Full Rust suite260passed,0failed,2existing explicit manual CLI/model probes ignored.
  fmt, all-target Clippy-Dwarnings and release build pass; Python packager7pass.
- Fresh source/security/quality review: dcp_census_repair_review PASS, no blockers.
  Actual153sources/4binaries/schema/inventory independently rehashed against Git.
- Reconciliation procedure: dcp_binding_authority_review PASS. Root/production
  execution is still a future independently verified observation, not a test result.
- Three unchanged unrelated repository structure violations remain disclosed;
  candidate source/test files and bootstrap directory are within local limits.

Evidence directory:
`.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_CENSUS_REPAIR/`.
Original SDD run, accepted Spec, R02 closure and eight other closed findings remain
unchanged. Subsequent profile enrollment, legacy retirement, real canary, standing
Train enablement, joint release and per-Goal receipts remain parent-Goal work.
