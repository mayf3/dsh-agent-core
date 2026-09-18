# Independent bounded design review: known availability recovery

REVIEW_RESULT=PASS_AT_DESIGN_LEVEL
REVIEWED_DOCUMENT=first-live-availability-recovery-clarification.md
FINAL_REVIEWED_SHA256=cbce59957fbbc63ae54e4c60454122ca5e7da054586e82d1f6275d69cc028656
INITIAL_DESIGN_SHA256=44629be277ca341e2d10966402e042c7a868e0fd0cb9ab47995850a1711fc6dd
AUTHORITY_ACTION=REUSE
SPEC_AMENDMENT_REQUIRED=NO
FROZEN_NEW_DESIGN_BLOCKER_UNION=NONE_IDENTIFIED
SOURCE_AND_WHOLE_PACKAGE_REVIEW=STILL_REQUIRED
PRODUCTION_OPERATION_ALLOWED=NO
PRODUCTION_OR_PRIVILEGED_ACTIONS_PERFORMED=NO

The reviewer did not author the design and recomputed the final hash. This is the finite first-live adoption-maintenance failure disposition under accepted Spec39865536ce51005f95a98473e77c2329078512c0, particularly CTR-DCP-008/009/013/017/018/020. It is not a change to ordinary accepted-unit rollback/retry semantics, and does not reopen unrelated findings.

The existing native maintenance dependency checks require the reviewed protected loader graph. The known original Node tree's Homebrew/@rpath dependencies do not satisfy that new protected closure; inventing an old enrollment or bypassing loader checks merely to restart it would introduce an unsafe privileged execution route. Sealed old bytes are evidence and guarded static recovery inputs, not independent authority to execute their old loader graph.

The selected alternative is bounded and truthful: where the stop is known, all relevant effects are durably classified, and the complete new app/harness/Node/plist face has passed exact byte/identity/metadata/link/loader checks, a still-valid explicit Owner grant under the same retained locks can restore only the original service group's availability on that verified new face. Original identity/argv/load/disabled policy and periodic idle distinctions remain bound. Services never stopped are not restarted for uniformity. DCP stays disabled/fenced, writer stubs stay retired, no business unit is admitted, and failed lifecycle/probe/canary evidence remains FAILED. This is a separately journaled availability action inside the authorized bootstrap operation, not a normal deployment rollback success or retry.

During review the initial wording 'an operation/recovery intent lacks a result' was clarified. A still-open enclosing operation is not itself an unknown effect. Every relevant concrete effect must instead have a durable explicit observed failed/completed result and a current safe-face proof before a new exclusive one-use recovery intent can be published. Missing concrete effect/recovery results remain UNKNOWN; they cannot be relabeled known failure to enter recovery. The final document incorporates this precise distinction. The actual driver must preserve it at every intent/effect/result boundary, including failed denial probes and partial service transitions.

Incomplete/changed closure, expired grant, unexplained current image, partial/unknown service effect or interrupted recovery stops further actions and retains journals/locks/fences. No broad UID killing, repeated start/stop, changed ID, cleanup-budget reset or automatic old-writer restoration is authorized. The fresh-inode recovery helper cannot be applied blindly to revert a verified new loader to its unsafe predecessor and then claim restart is safe. Static repair and service availability have different prerequisites, and protected auth/key/queue/business/history state remains excluded.

These are appropriate fail-closed semantics already contemplated by CTR-DCP-013's UNSAFE_ROLLBACK/quarantine boundary and the separately authorized exact bootstrap in CTR-DCP-017. The bounded plan chooses how to preserve availability when safe; it does not relax a long-lived Product Contract. The explicit tradeoff must be in the final Owner package: normal adoption maintenance and later Broker restart are distinct effects, known safe new closure may restore availability while DCP remains failed, and partial/unknown state may leave named services stopped pending explicit reconciliation. No universal automatic rollback promise is permissible.

Required source evidence remains both branches of the real driver: durable known failure plus current verified face permits only one counted restoration; missing result, stale generation, changed closure, expired grant or recovery reentry permits none. Both must preserve FAILED/quarantine/no-admission and original load/idle distinctions. Fresh exact source and package review must confirm those gates and truthful receipts before operation. No service, Node loader, production path, privileged action or recovery was executed by this design review.
