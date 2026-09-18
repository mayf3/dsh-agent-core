# Independent final operation binding review

Reviewer: `/root/dcp_binding_authority_review`.
Recorded UTC: 2026-09-18T02:26:10Z.
Scope: final corrected-package request, same-attempt companion, retained failed-operation prefix, and previously reviewed reconciliation procedure. This reviewer did not author the repair or this operation request. Source/security review is separately retained from `dcp_census_repair_review`.

```text
SPEC_GOVERNANCE_MODE = REVIEW
REVIEW_KIND = CONTROLLED_OPERATION
REVIEW_TARGET_HEAD = bcfd929b7c760947df9c6f03a830a9e8a0b16651
SOURCE_TREE = ed0d500fff0546abb68099a4ab51a0114827fc0a
PRIMARY_AUTHORITY = PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1@39865536ce51005f95a98473e77c2329078512c0
AUTHORITY_ACTION = REUSE
FINAL_BINDING_RECHECK = PASS
SCOPED_BLOCKERS = 0
OWNER_REQUEST_REVIEWABLE = YES
CORRECTED_PACKAGE_AUTHORIZED = NO
INSTALLATION_COMPLETE = NO
REVIEWER_LOGIN_COMPLETE = NO
ACTIVATION_READY = NO
PARENT_GOAL_COMPLETE = NO
```

## Exact bindings verified

Companion: `/Users/yanfenma/workspace/artifacts/production-deployment-control-plane-v1/genesis-bcfd929.reconciliation-plan.json`.
SHA256: `588572b7568c91aedeedc8cf817ed0c9d809dded45fc12f740f3f2d13b584d6e`.
Bound reconciliation runbook SHA256: `3afeb06df1a94b5a22c3ec3a9c26564ca7c578a10b84eb5f605b6944ca3ee08b`.

Independently recomputed the companion, runbook, and both old/new package six-pin tuples from actual bytes. New final pins:

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

All 153 new packaged source files match their manifest hashes and exact Git objects at the reviewed source. Source tree matches Git. Both packages' executable/support bytes match their declarations; the companion's new executable map equals the new package map. The new runner is `d918d8f6f1d5e84334cd4a5e130cca998bcc5eb049a5de10a95093c0f4e7fe3c`; the retained original runner binding is `2a8550ac3ffde4ccd21d501d7869608628bacd8ccb4feaab44aeb1803546d301`.

The companion's original grant hash, six old pins, host and attempt match the retained original grant. Its journal inventory and lock metadata match the attributed protected diagnostic, including flags0, zero bytes, uid/gid0, mode0600, one link and mtime/ctime1789696678. Diagnostic SHA256: `b217a8e0d7fe9a7a493a6903312eb7c6680c4cb09a94d854492285a0de5e4076`. This is matching historical evidence, not a fresh privileged poststate check.

Read the separate source/security review and final mechanical seal review. The retained final nonroot verifier result binds the new plan and reports plan/integrity true while bootstrap permission, activation, protected poststate and authenticated review-result verification remain false. Those limits are correctly preserved in the request.

## Operation and authority conclusion

The companion permits only one additional native disabled-install invocation and one reviewer login after successful installation, using original attempt `genesis-65559dd-20260918-01` on the unchanged bound host. It records the prior invocation and its pre-InstallStep failure. Its required prefix preserves the original grant, known old runner, journal root and permanent lock; all native-step targets and proposed identities must remain absent. It requires no active bootstrap/login process, preserves the lock inode at execution, and stops on unexplained state rather than offering generic resume or a fresh attempt.

Runner replacement and a separate new grant require new exact Owner authorization. No old-pin permission is inferred. The original package/grant and lock remain retained. The procedure verifies the replacement before root execution and preserves uncertain partial state; recovery cannot delete identities, keys, state or locks. No branch permits service enable/start, existing-task restart, sudoers modification, runtime enrollment, switching, legacy retirement or real deployment.

`PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_CENSUS_REPAIR_READY.md` accurately describes the failed operation, remaining limitations and one concrete new authorization request. Reviewed request SHA256 while its final-recheck marker was PENDING: `d62dfa46dac79ce6f2ad720dba6d4009d86f1a7b05efc7a27626e53e25838907`. This record supplies the PASS disposition for that marker. Updating only its final-binding/readiness status to reference this result does not change the reviewed operation or confer permission.

The exact request is ready for Owner consideration under CTR-DCP-017 and section7. Execution still requires explicit authorization of the new pins and companion, a fresh bounded external grant, and successful protected reconciliation immediately before mutation. Successful source/tests/package review is not executed installation, login, custody, activation or parent completion.

No privileged calls, credential reads, live writes, package changes, source changes or modifications to already packaged reports were performed. This new review record is the only file written by this review.
