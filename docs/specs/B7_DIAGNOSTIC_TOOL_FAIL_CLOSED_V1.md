---
spec_id: B7_DIAGNOSTIC_TOOL_FAIL_CLOSED_V1
status: accepted
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
owners:
  - mayf3
repository: mayf3/dsh-agent-core
accepted_by: root-authorized-non-author-technical-actor
accepted_date: 2026-10-22
accepted_reviewed_spec_commit: 6a762883d21fbfc6d67423c5a6e8a030344225b8
acceptance_receipt_sha256: 27f2299c009253c28a3bcca6d592891deb326a9fdcacd94019fe90bdff1317c3
acceptance_scope: isolated_source_only_no_merge_adoption_or_production
authoring_base: 45cdd5ebcaf5c981973d0a86947dd17aa73ee60f
tracking_issue: https://github.com/mayf3/agent-control/issues/1256
production_apply_authority: none
scope:
  - isolated source-only b7ctl diagnostic failure classification
  - refusal of unbound legacy journal truncation
  - required current registration evidence and final harden exit
supersedes: []
superseded_by: null
---

# B7 diagnostic tool failure behavior V1

This finite source contract was independently accepted by root at the reviewed
docs commit, as recorded in
`docs/evidence/ac1256/b7-source-contract-acceptance.json`. It does not
change the deployment queue, installed tool, production journal, authority,
operation, lock, privilege or original deployment writer. The source repository is `mayf3/dsh-agent-core`, authoring base
`45cdd5ebcaf5c981973d0a86947dd17aa73ee60f`. The acceptance is source-only under the existing atomic route, not main
activation, automatic merge or adoption.
Root, as the authorized non-author technical actor, reviews the frozen docs
commit. The existing main-active AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V3
CTR-AD3-003 permits bounded NEW + DURABLE atomic Spec/code work under the Owner
task mandate, with independent acceptance before merge. Root accepted the exact frozen source-only
contract delta as the non-author authorized technical actor; the acceptance
receipt above binds the reviewed bytes and the explicit mandate. Implementation
then branches from the accepted docs commit; docs and implementation commits
remain separate. This does not claim the new unmerged Spec is main-active or
grant merge, adoption or production authority; the final PR retains its gate.
The implementation commit cannot expand this governing Spec.

## Problem and exact input

The reviewed `b7ctl.py` source SHA256 is
`38f3abfb474ca5dd4500c34aa83d9fb3478e32ddd291df44b4d845ffdd5d19af`.
`installer_hardening.py` source SHA256 is
`ef320fbeb7b4e3ee5fe28c6bdb373c477cdf3d3c0291f14cc2ae219a451bd7b0`.

Both inputs are existing unversioned tools under
`/Users/yanfenma/Documents/Codex/2026-10-18/zcode-assist/tools/b7ctl/`.
They will be imported and repaired only at
`scripts/b7ctl/b7ctl.py` and `scripts/b7ctl/installer_hardening.py`;
owned regression tests are `scripts/b7ctl/tests/test_fail_closed.py`.
That target directory is absent from the authoring base, so this is an exact
new source import, not a claim that canonical main is the app bdb baseline.
The original tool files are never edited or adopted by this task.

F04 treats failure of an absence check as proof of absence. F03 takes two clock
samples for one archive, then truncates the live journal before verifying the
archive read and ignores failure. F09 reports hardening failure with exit zero
and accepts no matching registration as no failures. These defects can cause a
caller that checks only exit status to continue on failed evidence.

The original tooling proposal is PROPOSED_NOT_ACCEPTED. Accepted
PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1 preserves durable evidence, exact
ownership/settlement and fail-closed behavior, but does not authorize this CLI's
unbound journal truncation. In particular the current preflight accepts a pinned
prefix plus valid appended bytes; file length alone is not drift or recovery
authority.

## CTR-B7D-001 — diagnostic completion

The affected read/check commands return zero only after all required current
checks have positively succeeded. A failed command, malformed observation,
unreadable required evidence or unknown result is a failed check with nonzero
exit. Printed success cannot substitute for exit status. Error output is bounded
and identifies the failed check without raw credentials or unrelated output.

The change is restricted to preflight, harden and legacy restore-journal. It
does not rewrite sweep, rollback, generator, sealer, registration or queue logic.
Those remain separate findings and cannot be accidentally called by tests.

## CTR-B7D-002 — typed absence

An absence observation has exactly `PRESENT`, `ABSENT_ENOENT` or `ERROR`.
Only an explicit ENOENT from the original legal filesystem observation proves
`ABSENT_ENOENT`. Any symlink directory entry is PRESENT, including a broken
symlink. Permission/ancestor-traversal failure, other errno, failed privilege
transport, command/interpreter error, malformed JSON, extra output and unknown
classification are ERROR. Numeric nonzero status by itself is never ENOENT.

Use the existing fixed affected path list and original observation runner;
do not introduce a caller-supplied path, generic shell, new privilege or a second
privileged entry point. The observation protocol is closed and validates both
successful transport and the exact typed result. Preflight must fail if any
of its eight absence observations is PRESENT or ERROR.

## CTR-B7D-003 — unbound journal recovery refuses mutation

The existing restore-journal interface has no binding for the current operation,
full journal preimage, permitted tail disposal or original recovery authority.
Therefore `restore-journal --apply` must fail nonzero before issuing any command
that can mutate, rename, truncate, chmod or chown the journal. Its diagnostic
states `RECOVERY_AUTHORITY_REQUIRED` and names the missing exact recovery
contract. It must not print restored or successful recovery.

The read-only path may report size and prefix match after successful typed reads;
a shorter file, bad prefix or read error is nonzero. A matching prefix with a
longer file is `APPENDED_TAIL_RETAINED`, not a reason to truncate or a recovery
success. A size-equal and matching journal is `MATCH_PIN_NO_MUTATION`.

This is a fail-closed mitigation, not an implementation of a new generic recovery
system and not a claim that a real journal was restored. Future actual authorized
restore is outside this source-only task and needs its own exact
operation/preimage/prefix/append-tail/ownership contract and independent
acceptance before that recovery implementation. Its algorithm must preserve
the original, use one archive identity, validate before writes, exclusive staged
output, fsync/readback and atomic publication, with fault tests. This Spec grants
none of that production authority.

## CTR-B7D-004 — required current registration and final harden result

Hardening requires these four explicit inputs:

```text
b7ctl harden --op <operation_id> --manifest-sha256 <64_lowercase_hex>
  --registration-receipt <exact_file>
  --registration-receipt-sha256 <64_lowercase_hex> [--apply]
```

The expected operation ID and manifest digest must be supplied from the exact
source-owner reviewed generation/FINAL-SEAL binding; the expected receipt digest
binds the exact required receipt bytes. They are diagnostic inputs, not execution
authority. The operation ID identifies the generation; the native receipt has no
independent generation field, so no separate generation proof is fabricated.
No argument defaults to r15, a glob or a newest file. Missing arguments or invalid
SHA format are usage failure (exit2); read/check/repair failure is exit1; complete
success is exit0.

The accepted receipt envelope is native `DS_B7_PACKET_REGISTRATION_V1`,
`version=1`, `action=B7_PACKET_REGISTER_V1`, `state=REGISTERED_ONLY`, with
`operation_id` exactly equal to `--op`, integer (not boolean)
`registered_peer_uid=502`, and `binding.manifestSha256` exactly equal to
`--manifest-sha256`. Its raw bytes must match
`--registration-receipt-sha256` before JSON interpretation. Duplicate JSON keys,
wrong scalar types and non-object binding fail. Unknown extra native fields may
remain but cannot supply or override any required predicate. A wrapper or
`registration_ok` label does not replace this native envelope.

Hardening consumes that explicit current operation and exact required
registration receipt from the original source owner; it does not infer current
identity from an r15 glob or lexicographic newest file. Missing, unreadable,
malformed, ambiguous or mismatched required receipt is failure. The expected
operation/generation/manifest and worker peer must be present and match their
accepted source binding; do not fabricate absent values or accept a successful
unrelated receipt.

Failures produce nonzero exit. In the existing apply path, an attempted repair
never reuses pre-apply success: failed repair is failure and a fresh complete
read-only check determines final status. No new repair operation or privilege
is introduced. The source task exercises this path only with owned synthetic
files/runners, never against installed paths.

## Frozen boundaries

No production inspection for validation, sudo execution, install/load/enable,
restart, real preflight/harden/restore/apply, lock/permission/timer changes,
generation creation, new operation/attempt, replay or business send. Original
tool/candidate/controller bytes are preserved. Implementation occurs in a
private source snapshot on an isolated branch. The implementation author cannot
self-accept this Spec or expand it in the implementation PR.

The accepted deployment and lifecycle authorities are not amended by this
proposal. No stale-lock timeout, CPU heuristic, recovered process exit or new
PID is settlement or takeover proof. UNKNOWN is not absence, safe replay or
BUSINESS_VERIFIED.

## Acceptance cases

| Case | Required result |
|---|---|
| All eight paths explicit ENOENT, all remaining checks successful | preflight exit zero |
| Any path present or broken symlink | preflight nonzero |
| EACCES, EPERM, other errno, rc2, failed transport, malformed/extra result | preflight nonzero; never absent-success |
| Required pin/DS/runtime check command fails despite plausible stdout | preflight nonzero |
| restore --apply with large/equal/short/missing journal | nonzero before first mutating runner call; original bytes unchanged |
| read-only exact pin | explicit MATCH_PIN_NO_MUTATION; zero |
| read-only matching prefix plus longer tail | APPENDED_TAIL_RETAINED, original bytes unchanged; no recovery-success claim |
| read-only shorter/bad prefix/read failure | nonzero |
| harden access failure or required receipt missing/wrong/unreadable | nonzero |
| correct explicitly bound receipt and access checks | zero |
| synthetic repair failure or post-apply failure | nonzero after fresh checks |

Tests load real affected source functions with all command runners replaced
before invocation. Fixtures are exclusively owned and synthetic; no actual
sudo, mv, head, chmod, chown or live helper executes. Observe the original source
fail the expected assertions, then patch the isolated source and run affected
tests. Independent non-author review binds the final commit/diff and confirms
this exact scope. Merge, adoption, installed, loaded/enabled and business
verification remain separate and initially NOT_DONE.

## Technical disposition required

The root non-author technical actor has selected CTR-B7D-003's explicit
fail-closed mitigation as the immediate F03 safety repair direction; independent acceptance binds reviewed commit
`6a762883d21fbfc6d67423c5a6e8a030344225b8`; this metadata commit records that
existing decision and does not expand the frozen semantic body. It does not
claim functional recovery is complete. If actual restore is required now, first
supply the exact governing restore/append-tail contract and replace this
mitigation with a separately reviewed bounded recovery design. Ordinary source
repair does not require stopping the deployment writer.

## Authoring coordinates and evidence

```text
AUTHORITY_ACTION = NEW
ROUTE_STAGE = AUTHORITY_AUTHORING
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = DURABLE (source import/failure behavior only; no new privilege, Secret/Grant change, destructive data change or production access)
EXISTING_ROUTE_AUTHORITY_IN_BASE = YES (ADOPTION_V3 CTR-AD3-003)
NEW_CONTRACT_ACCEPTANCE = RECORDED_BY_NON_AUTHOR_FOR_ISOLATED_SOURCE_IMPLEMENTATION
MAIN_INTEGRATION_AND_FINAL_REVIEW = STILL_REQUIRED
ATOMIC_SPEC_CODE_ROUTE = PERMITTED_BY_EXISTING_MAIN_AUTHORITY
IMPLEMENTATION_PERFORMED = NO
PRODUCTION_EFFECTS = NONE
```

`docs/evidence/ac1256/b7-baseline-characterization.json` records the three
synthetic counterexamples against the pinned originals. It is source-behavior
evidence, not production evidence or implementation acceptance. The fixture
loaded only selected AST definitions and replaced all runners before invocation;
no native command or production read/write occurred. Root owns issue progress
and independent non-author reviews; no native controller WORK is queued.
