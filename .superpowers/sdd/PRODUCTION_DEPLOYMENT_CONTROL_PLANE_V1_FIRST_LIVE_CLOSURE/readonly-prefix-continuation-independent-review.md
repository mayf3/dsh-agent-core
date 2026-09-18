# Independent exact read-only-prefix continuation review

Reviewer: `/root/dcp_binding_authority_review`.
Scope: the single evidence-bound ordinary operator continuation after the recorded `protected-prefix / ANCESTOR_UNSAFE` stop. This reviewer did not author the operator. This addendum supplements the prior operator security review; it does not alter its historical findings or receipts.

```text
SPEC_GOVERNANCE_MODE = REVIEW
REVIEW_KIND = CONTROLLED_OPERATION
PRIMARY_AUTHORITY = PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1@39865536ce51005f95a98473e77c2329078512c0
AUTHORITY_ACTION = REUSE
CONTINUATION_EXECUTION_REVIEW = PASS
SCOPED_BLOCKERS = 0
CONTINUATION_LIMIT = 1
NATIVE_ATTEMPT_ID = genesis-65559dd-20260918-01
CORRECTED_PACKAGE_NATIVE_CALLS_BEFORE_CONTINUATION = 0
FRESH_PROTECTED_PRECONDITIONS = REQUIRED_AT_EXECUTION
INSTALLATION_COMPLETE = NO
REVIEWER_LOGIN_COMPLETE = NO
ACTIVATION_AUTHORIZED = NO
PARENT_GOAL_COMPLETE = NO
```

## Exact reviewed bytes

Directory: `/Users/yanfenma/workspace/artifacts/production-deployment-control-plane-v1/genesis-65559dd-20260918-01/reconciliation-bcfd929`.

- `operator.py`: `3f272d7f1328f3386735a272b18233d8199c105ee7f93931d97d29308adb9280`.
- `operator-manifest.json`: `a13c3c55abc9eccc571bbcd355e1ba9132088e73a7b6f7e9ed00d3d1dc5174f4`.
- `authorized-reconciliation.command`: `ce9ed84bb47fc3d7e32c7b96d857b6e3cb528138b615001040d82fd02e1a6ea2`.
- `readonly-stop-binding.json`: `bb39041eb5cae80a388371bafe0a78b7c70d09abc9d0fc1bc5d3612bc7851bbf`.

All four hashes were independently recomputed from actual files. Manifest binds the new operator and stop-binding hashes; launcher binds the new manifest and operator. Original Owner mandate is unchanged. The complete 107 root argv tuples are byte-for-byte equal to the preceding OP-R1-fixed manifest; no new privileged command, destination or native argument was added.

## Stop binding and bounded continuation

Independently rehashed all 51 bound prior evidence files: 16 command records with stdout/stderr, two phase records and one error record. All 16 commands are successful root `stat`/`ls`. Final observations record `/private/var/run` root:daemon0775 without ACL; exact preceding operator hash `1b8f3532e7f4da56f52ab0897b890d618664852a6728f84e06294cc44a2c4911` stops there before any install/grant/native/login phase. Its retained `op-prefix-before/operator.py` copy matches that hash. This prior operator invocation performed no DCP mutation/native call; the earlier original-package native preflight attempt remains historical and is not erased.

The original empty `entry-invocation` directory still matches the bound device/inode/uid/gid/mode/mtime/ctime. It is neither deleted nor reused. New `RUN_OUT` is the literal `readonly-prefix-continuation-01` directory; its exclusive mkdir is the sole continuation guard and evidence sink. It was absent at review. A second invocation cannot pass that mkdir. Original logs remain in the parent directory.

`validate_readonly_stop` rejects changed hashes, extra prior phase/command files, a different error, non-read-only commands, a used corrected-package call budget, prior grant/backup/result outputs or changed original guard metadata. It runs during ordinary validation before authentication and again before mutation. The one continuation must still execute the full fresh protected prefix, exact old runner/grant/lock, identities, process census, absent targets, package verification and final repeated prefix gate. The previous incomplete prefix observations are not treated as successful live reconciliation.

## Narrow gate correction and retained security

Reviewed the actual complete operator diff and manifest differences. Only `/private/var/run` is removed from the trusted write-ancestor list. The operator still observes its metadata and still requires `/private/var/run/agent-deployd` absent before and after installation. All actual write ancestors retain the same strict checks. No code changes directory permissions, creates a socket, or treats this observation as socket trust proof. This matches the original genesis runbook's explicit deferred socket-ancestor proof and the native configuration's `socket_ancestor: None`.

OP-R1 remains closed: root install consumes only verified ordinary-user bytes through an unlinked regular fd0 and fixed `/dev/fd/0`; rejected protected output is not retained. The exact package, same native attempt, fresh grant format, unchanged native install/login argv, one-call limits, disabled outputs, permanent lock preservation and failure stop behavior remain intact. There is no retry loop, generic resume, automatic rollback, marker reset or new native attempt.

Read the focused regression source and retained results: deferred run0775 is observed without blocking; an actual write ancestor0775 is rejected; the exact old stop is accepted; an extra prior native phase is rejected. OP-R1 regression remains PASS. The ordinary validation receipt records UID502, exit0, root_calls0 at time1789705980. These are nonprivileged test/validation observations; this reviewer did not execute the operator or tests, and no fresh protected reconciliation or installation success is claimed.

## Authority disposition

This exact continuation may execute once under the existing Owner instruction to complete the current exact disabled installation. It consumes the same still-unused corrected-package native call allowance and preserves all original history. The local continuation guard identifies an operator evidence segment, not a new native attempt. The accepted authority, package/plan/companion and allowed privileged effects are unchanged. No additional Owner authorization is required for this bounded correction; activation, production target adoption/recovery and later deployment remain outside scope.

Any new failed or unknown precondition stops and retains evidence; this PASS does not authorize another continuation. Actual install/login receipts and independent poststate verification remain outstanding. No privileged calls, credential reads, operator execution, source/package edits or system writes were performed by this review. Only this review addendum was written.
