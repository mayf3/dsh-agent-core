# Independent reconciliation operator review

Reviewer: `/root/dcp_binding_authority_review`.
Scope: ordinary-user translation of the already authorized exact disabled reconciliation, before any operator/root execution. The reviewer did not author the operator.

Latest disposition: **PASS**, OP-R1 closed for the exact revised hashes recorded in the closure below. The initial finding and original reviewed hashes are retained as history.

```text
SPEC_GOVERNANCE_MODE = REVIEW
REVIEW_KIND = CONTROLLED_OPERATION
PRIMARY_AUTHORITY = PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1@39865536ce51005f95a98473e77c2329078512c0
AUTHORITY_ACTION = REUSE
OPERATOR_REVIEW = NEEDS_CHANGES
SCOPED_BLOCKERS = 1
DISPATCH_ALLOWED = NO
PRIVILEGED_EXECUTION_PERFORMED_BY_REVIEWER = NO
INSTALLATION_COMPLETE = NO
REVIEWER_LOGIN_COMPLETE = NO
ACTIVATION_AUTHORIZED = NO
PARENT_GOAL_COMPLETE = NO
```

## Exact reviewed inputs

Operation directory: `/Users/yanfenma/workspace/artifacts/production-deployment-control-plane-v1/genesis-65559dd-20260918-01/reconciliation-bcfd929`.

- `operator.py`: `1b0a66ba984f2a796d3d5422cf01d3a1162334c08d29e6d68add3ef333875e31`.
- `operator-manifest.json`: `b83ee17bf243250fdf6f4decacb95bbc50f5b23d69a2c66f1d8f5605d0eed536`.
- `authorized-reconciliation.command`: `56fff4f96cf53f9ca4822d49f84426bfaea57305ea16bbc7f62a6d4a271f8bde`.
- `owner-mandate.json`: `b63b7e594d3ed5fa838e503756187321c87c27c50fde93084a57a73f1ee8aaf0`.
- Reconciliation companion: `588572b7568c91aedeedc8cf817ed0c9d809dded45fc12f740f3f2d13b584d6e`.
- Runbook: `3afeb06df1a94b5a22c3ec3a9c26564ca7c578a10b84eb5f605b6944ca3ee08b`.

These hashes were independently recomputed. All 107 root argv tuples were read, together with the entire operator, launcher, mandate, preparation report, frozen runbook and companion. The exact source/package security review is not reopened here.

## OP-R1 — privileged copy reopens replaceable caller paths

Priority: P1; must fix before dispatch.

`operator.py:297` runs root `/usr/bin/install` with the packaged runner path as its source. `operator.py:303` does the same with the generated grant path. Both source paths reside beneath UID502-owned directories. `read_local` and final rehash validate an earlier open, then release it; they do not bind the path that the later privileged `install` reopens. File modes0400/0500 do not prevent the directory owner from replacing these directory entries.

Concrete counterexample: after final validation, a same-UID process replaces the runner source with a symlink to a root-only regular file. Root `install` dereferences that source and writes its bytes to the protected runner destination with mode0555. The installed hash check at line298 stops native execution, but only after the copied contents become readable. Replacing the grant source similarly causes root-only contents to be copied into the protected grant; `expect` then calls root `cat` at lines195–198 and `run` records stdout at lines98–103 before the digest mismatch is rejected. The same read authority is therefore leaked through the evidence output. This is a concrete source-substitution/TOCTOU failure within CTR-DCP-017's reviewed boundary, even though the native runner itself is never invoked on a mismatched hash.

Minimal required correction: privileged copy must consume only bytes already opened/read and digest-checked as the ordinary user, through a fixed input descriptor/stdin mechanism supported by the chosen protected Apple copy primitive; it must not reopen a caller-controlled filesystem path with root read authority. Keep destinations, expected digests, owner/modes, protected-prefix checks, installed readback and exact native argv unchanged. Validate the platform primitive's descriptor/input behavior without privileged effects, repin the operator/manifest/launcher and obtain this bounded recheck. Extra path checks or a later digest comparison alone do not close this issue.

## Other scoped conclusions

The newest attributable Owner continuation follows the complete exact request and authorizes the current corrected package/companion under the same original attempt. It does not authorize activation, another package, fresh attempts, production recovery or target adoption. The immutable companion's prior `bootstrap_authorized=false` is a preparation statement; the later external Owner instruction supplies authority. The operator must still create the fresh exact protected grant and pass live reconciliation.

The one-shot entry guard, repeated protected prefix/identity/process checks, exact native install/login tuple, refusal to retry/rollback automatically, preserved original grant/lock, private-key/auth metadata-only export and absent activation/socket assertions conform to the bounded operation apart from OP-R1. Device login inherits the visible Terminal and is not piped into evidence. The fixed ps census exports pid/uid/start-time/command identity rather than arguments. No allowlisted service start, launchctl, sudoers write or dsh target mutation was found.

The execute-only system `/usr/bin/sudo` has an explicit metadata-based authentication-entry check; its unreadable SHA is not fabricated. The frozen companion does not require a sudo content digest. The fixed absolute path, nonsymlink protected ancestors, root ownership, exact setuid mode/flags/link count and ACL check are an acceptable bounded treatment for this existing platform entry. Readable Apple tools and payloads remain digest-pinned.

The independently reported dsh scheduler migration cannot be treated as current health or completed recovery. Accepted Spec section7 places active legacy transaction reconciliation before activation; the present disabled installation has disjoint destinations and no target recovery action. Native preflight/readback compares current protected plist/sudoers surfaces around installation. It does not prove installed dsh app bytes or resolve that separate migration. Any actual shared-surface/prefix drift or concurrent bootstrap/login process still requires a stop; future target adoption remains separately blocked pending its own reconciliation.

No privileged calls, credential reads, operator execution, source/package changes or system writes were performed by this review. This review file is the only new file written.

## Exact OP-R1 closure

```text
OPERATOR_REVIEW = PASS
OP_R1 = CLOSED
SCOPED_BLOCKERS = 0
EXACT_OPERATOR_DISPATCH_REVIEW = PASS
PRIVILEGED_EXECUTION_PERFORMED_BY_REVIEWER = NO
FRESH_PROTECTED_PRECONDITIONS = REQUIRED_AT_EXECUTION
INSTALLATION_COMPLETE = NO
REVIEWER_LOGIN_COMPLETE = NO
ACTIVATION_AUTHORIZED = NO
PARENT_GOAL_COMPLETE = NO
```

Independently recomputed revised hashes:

- `operator.py`: `1b8f3532e7f4da56f52ab0897b890d618664852a6728f84e06294cc44a2c4911`.
- `operator-manifest.json`: `dd8ff2988fead94201760081cbb04e13b5750849bb404cc2ed67989ff7915b93`.
- `authorized-reconciliation.command`: `2d4d1f88338dd971b5d83c28034cd248b3baa92e94745af0d95c4a3578fc24a4`.
- `owner-mandate.json` unchanged: `b63b7e594d3ed5fa838e503756187321c87c27c50fde93084a57a73f1ee8aaf0`.

Reviewed the complete diff against the retained OP-R1-before operator. `install_verified_bytes` now accepts already verified ordinary-user bytes, copies them into an unlinked regular TemporaryFile, checks UID502/mode0600/nlink0/size, rehashes its contents, rewinds it and passes that descriptor as stdin. The protected Apple installer receives only `/dev/fd/0`, fixed destination, fixed ownership and fixed mode. Neither privileged copy reopens a caller-owned source path. Installed digest/metadata checks still precede the fixed native root invocation.

`run` now suppresses mismatching protected stdout before any evidence write; `expect` and original-grant read supply the expected digest. Rejected content produces only a hash/size record. The manifest changes are exactly the operator hash and the two install source operands. All other root argv entries, destinations, native install/login pins, tool hashes, prior evidence and effect limits remain unchanged. The launcher binds the revised operator and manifest hashes. This is a mechanical correction within the same authorized operation and does not create another effect or require a different native package.

Read the regression source and retained native nonroot primitive results: real Apple install accepts the unlinked regular fd0; named-source symlink substitution does not affect the copied verified bytes; bad input digest fails before install; mismatching protected-output bytes are absent from evidence. Read the final ordinary validation receipt: UID502, exit0, root_calls0, time1789704602, with `ORDINARY_NONMUTATING_VALIDATION_PASS; NO_SUDO_EXECUTED`. Python compile evidence is PASS. These are ordinary validation observations, not proof of sudo descriptor behavior, root installation, login or protected poststate. The reviewer did not run the operator or regression.

The original one-shot marker remains absent at this check. The exact revised translation may be dispatched once under the existing contextual Owner authorization; the protected prefix, fresh grant, native permanent lock and all runtime rejection gates remain mandatory. Any failure retains the original attempt and stops without retry. Review acceptance supplies no permission for activation, production target recovery/adoption, an alternate package or a new attempt.
