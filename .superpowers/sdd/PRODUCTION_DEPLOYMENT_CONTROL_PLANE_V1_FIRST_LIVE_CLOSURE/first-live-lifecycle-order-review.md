# Independent bounded review: lifecycle probe ordering

REVIEW_RESULT=PASS_AT_DESIGN_LEVEL
REVIEWED_DOCUMENT=first-live-lifecycle-operator-design.md
REVIEWED_SHA256=97197efe3ca8f589970986c890ac5b885763009d3588ee7966771ac70201915d
PRIOR_DOCUMENT_SHA256=cc8267b3aaa012f93c70a0fc001693410c746dd598a1943708a054bb483bac79
AUTHORITY_ACTION=REUSE
SPEC_AMENDMENT_REQUIRED=NO
NEW_DESIGN_BLOCKERS=NONE
SOURCE_REVIEW_PASS=NOT_EVALUATED
OPERATION_ALLOWED=NO

The independent reviewer did not author the steps 6/7 rewrite and independently recomputed the frozen document hash. Scope is only ordering of caller-denial probes relative to the already-designed service quiescence/restoration. The former text already required real loaded lifecycle probes after restoration but placed the mixed probe list in numbered step6 before restoration in step7. The clarification makes the actual dependency executable without changing accepted CTR-DCP-009/018, the permitted target/effects, or prior closed findings.

Step6 now performs filesystem, ancestor, retired-entry and effective-sudo checks while the service group is quiescent. Step7 restores only the originally loaded Runtime/W1/W2 jobs with the exact flags/startup policy under the same held DCP mutex and transitional legacy-lock protection, obtains fresh real loaded/process identities, executes the fixed signal0 and loaded-label launchctl denial probes, and then performs final health/identity/generation/complete-face readback. No extra planned restart is added to create probe evidence.

The required safety distinction remains explicit: generic nonzero, absent labels and ESRCH are not permission-denial evidence. Probe identities are rechecked before/after; periodic idle jobs are not force-started merely to manufacture a PID. Loaded-domain denial and an actual process-signal observation are separate facts. Unexpected success, a service effect or identity drift remains a failed operation, stops further probes and permits only exact Owner-grant-bound recovery. Recovery cannot convert the failed denial proof into PASS or silently restore retired routine authority. Current health after probes, rather than pre-probe health, binds the lifecycle receipt.

No new safety gap was found in this bounded ordering change. Existing requirements for journaled effects/results, owned-process reconciliation, fixed probe arguments/deadlines, exact rollback and future independent native source/package review remain. This design PASS does not claim live permissions are denied or authorize stopping/restoring/probing any service. No code, lock, endpoint, privileged or production action was performed by this review. Upstream service compatibility is outside this note and remains a separately evidenced review surface.
