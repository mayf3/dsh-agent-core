## Task 4: source adapters, bootstrap bundle and complete security verification

**Files:** create `src/bootstrap/{mod.rs,bundle.rs,verify.rs}` and
`test/adoption/{bootstrap.rs,e2e.rs}`; update package README and create
`docs/reports/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_CONFORMANCE.md`.
Legacy repo entry source adapters are limited to the inspected installer/routing/
Watchdog transaction: retain pre-bootstrap behavior and add a fixed protected
enrollment-marker guard; source changes must not increase grandfathered file size.
External installed wrappers remain untouched; bundle inventory declares their
exact disablement/permission/lifecycle checks for the later authorized cutover.

- [ ] Failing package tests first: no activation/signing secrets, mismatched binary/
  source hash, user-writable executable/ancestor, nonallowlisted target, unsafe
  sudoers rule, enabled GUI/502 svc-workflow, missing lifecycle denial or legacy
  inventory. Every case refuses BOOTSTRAP_READY. Test generated files by parsing
  plists/manifests and verifying file hashes; merely generating text is not proof.
- [ ] Implement inert bundle generation: reviewed binary + dependency/source digests,
  disabled LaunchDaemon plist, exact prospective profiles/trust-key IDs, fixed
  ownership/ACL/mode/socket identities, dry-run installation/rollback manifest,
  complete legacy inventory and negative probe plan. No root execution in generator.
  Profile enabling requires a distinct signed Owner bootstrap receipt; blank/unresolved
  host facts are explicit blockers, never permissive defaults.
- [ ] Implement offline preflight verifier for package integrity and all profile
  constraints; production-only metadata checks are listed as later execution gates.
  No generic sudo passthrough or NOPASSWD ALL. Transition deployctl is optional and
  will not be enabled when native daemon is available; verify there is no installed rule.
- [ ] Whole-branch security review covers the user's full attack list and every
  accepted Contract. Freeze one blocker union, repair once and focused re-audit.
  Preserve valid blockers; do not claim readiness from a stub/disabled-only engine.
- [ ] Final checks: locked cargo test, fmt, clippy, release build, structure delta vs
  accepted base, no governing Spec diff, secret-safe artifact inspection, process/socket
  cleanup and no production mutation evidence. Map each ACC row to executed evidence
  or post-authorization production proof; distinguish fixture/mocked launchd from real.
- [ ] Deliver IMPLEMENTATION_COMPLETE / TESTS_PASS / INDEPENDENT_REVIEW_PASS /
  BOOTSTRAP_READY with exact hashes and the one concrete Owner bootstrap request.
  Whole production Goal remains incomplete until separately authorized adoption/E2E.

## Controller preparation and boundaries

Read `bootstrap-preparation-notes.md`, `bootstrap-host-inventory.json`,
`platform-boundaries.json`, `launchd-readback-shape.json`,
`issuer-integration-census.md` and `final-review-scope.md` beside this brief.
These are bounded observations/preparation notes, not deployment authority or a
stable production preimage. Some live generations changed through unrelated work
between the original census and later read-only samples. Re-pin at any future
authorized bootstrap; do not claim production remained unchanged globally.

The source inventory also includes `scripts/production-runtime-launchd.mjs`
(GUI bootstrap/bootout/load/unload). Cover every enrolled target's writer AND
lifecycle surfaces, including external helpers and same-UID signals. The three
initially named source wrappers alone do not prove complete retirement. Keep
installed helpers and production metadata untouched during this task.

Root bootstrap must execute only bytes already staged and reverified inside a
protected root-owned closure, not caller-writable source or an earlier path hash.
Make prospective numeric identities, dependency hashes, fixed platform utilities,
trust roles and target dispositions reviewable. Never include private keys or
fixture trust as production authority. Existing producer/build/review issuer
bindings were not found in this repository; distinguish implemented integrations
from externally provisioned trust and from executed production proof.

Current GUI/502 svc-workflow remains explicitly ineligible under the accepted
Spec. External auth-service authority and migration must not be invented here.
Disabled adoption can be reported explicitly; an unfinished/stub driver or an
unresolved prerequisite for the proposed actual bootstrap cannot be labeled ready.

Task 1 has a completed independent re-audit. Tasks 2/3 exact report and API
handoffs will be provided before dispatch. Final whole-branch review is dispatched
by the controller after this task's concrete code and evidence; do not spawn
reviewers or self-declare INDEPENDENT_REVIEW_PASS. Record real test observations
and source coverage for ACC-001 through ACC-014, with P-only tests pending.

The repository's deterministic structure verifier excludes Rust. Retain its
comparison to the exact baseline (three existing directory violations), supplement
with tracked Rust file/child/depth counts and semantic anti-evasion review, and
never call the entire repository structure gate PASS. Do not repair unrelated
legacy debt. Preserve evidence artifacts rather than deleting this SDD workspace.

## Contract coverage and stop boundary

Task 1 owns CTR 001–004/006/010 and durable parts of 011/015/020; Task 2 owns
005/008/009/011–013; Task 3 integrates 001/007/010/014–016/020; Task 4 owns
017–019 and the complete ACC-001–014 conformance audit. Every overlapping interface
gets integration tests in Task 3/4. No Contract is satisfied solely by a type or test
name. Stop only at genuine privileged bootstrap authorization, an irreducible
authority/security blocker, or requested BOOTSTRAP_READY delivery.

Additional controller preparation files: conformance-preparation.md is an evidence
index, not a verdict; runtime-app-metadata-capacity.json/runtime-app-links.json
record bounded actual app layout metadata; prospective-caller-group.json records
that prospective `_agentdeploy` with GID 602 was absent when observed; bootstrap-platform-tools.json
records exact read-only system utility metadata/hashes. Treat proposed identities
as new bootstrap operations requiring later Owner authority and collision recheck,
not as already provisioned permissions. Do not weaken no-link artifact intake to
mirror existing installed package links.

Test-layout ruling: Task3 uses19 immediate children at test/. Task4 adds exactly
one cohesive adoption/ directory containing separate bootstrap.rs and e2e.rs Cargo
test targets, plus any related fixtures; do not add two more root-level files.
Keep standard target namesbootstrap/e2e via explicit Cargo[[test]] paths. This is
a test-layout correction for the accepted structure limit, not reduced coverage.

Concrete mandatory profile-closure integration: read native-node-loader-closure.json,
native-node-loader-ancestors.json,native-runtime-closure-observation.json and
native-loader-env-classification.json plus bootstrap-preparation-notes.md. Current
Nodeentryhash alone leaves actual directMach-O Homebrew dependency paths under
caller-writable ancestors. AcceptedCTR004/008/017 and plannedACC006 require complete
root-executed dependency safety, includingW2. Extend nativeprofile/closure validation
as needed in Task4, with meaningful rejecting fixture evidence, and make the exact
prospective protected closure concrete. Do not modifyliveNode/Homebrew/plists or
claim protected closure from launcherhash alone. Avoid generic path/command escape
under the guise of a profile.

Native-runtime-closure-observation.json records currentNodeentry/W2/plisthashes
and selectedidentity505:601; it does not pin futurelivepreimages. Private signing
keys remain outsidepublicbundles and must be0600 protected with publickey/role/scope
validation; Task3 includes a rejecting0644privatekey regression.

Task3 repair handoff: mailbox publication uses a permanent protected0600
publication.lock, initialized/flushed under the daemon singleton before workers.
Include its protected state-root lifecycle in the exact bootstrap layout. It is
not the global mutation mutex and grants no authority. Late verification requests
now have durable generation/CAS completion plus retained error disposition;
preserve these semantics in adoption/e2e tests. Read task-3-report.md repair appendix.
