# Independent exact reviewer-login reconciliation design review

Reviewer: `dcp_first_live_binding_review`, not the design author or future implementation author. Date: 2026-09-18. This is a bounded design/authority review, not source acceptance or operation permission. No root, endpoint, login, credential-content read, native-helper execution or production mutation was performed.

## Exact reviewed artifact and verdict

- Design commit: `1d92fb3aefc8dc7e00ea5ac499bf2758468b3cd0`.
- Commit tree: `d747c81418d46c9ae4cf0f9e9e3730a84a7e1def`.
- File: `.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_FIRST_LIVE_CLOSURE/reviewer-login-reconciliation-design.md`.
- File SHA256: `b6c0db9d6ff88282e3a8233b6e20aa52beb5e170d37fbb53ff7dfdce8009c3a4`; working bytes independently match this commit.
- Existing disabled installation: original attempt `genesis-65559dd-20260918-01`, installed source `bcfd929b7c760947df9c6f03a830a9e8a0b16651`, package `5bf407d815068e84d9dcfbbbe442498169bb43ab98f388b168bd5d6eca40911b`, plan `c3a5ed50ffe2588cedc26b7ba3931aef85de496143ea355d70b773648b6bd38e`.
- Actual post-state evidence and limits: [independent poststate review](disabled-install-poststate-independent-review.md), report SHA256 `0d77ea364f259612ab3043b613ad9d4c2a2a7eae345a82a84276c5ba5dd5c70a`; observation-result SHA256 `5168000958f4778e1a9adfa06db1ddee576f890c204c292d4c7a384edf7e52cf`.

`AUTHORITY_ACTION = REUSE`.
`SPEC_GAP_DEPENDENCY = NONE_IDENTIFIED` for this exact one-operation design.
`DESIGN_REVIEW = PASS`.
`OPEN_DESIGN_BLOCKERS = NONE`.
`NONPRODUCTION_IMPLEMENTATION_ALLOWED = YES`, under the existing Owner mandate and required test-first/source-review gates.
`IMPLEMENTATION_REVIEW = NOT_PERFORMED`; `EXACT_OPERATION_PACKAGE = NOT_YET_REVIEWED`; `OPERATION_ALLOWED = NO`.

The pass binds the final frozen design, including its process-cleanup, lock and receipt limits. It must not be applied to the earlier generic runtime-plan formulation or to future machines/attempts.

## Authority and minimum scope

The accepted DCP Spec reviewed by Owner at `39865536ce51005f95a98473e77c2329078512c0`, with its subsequent accepted-lifecycle record, already owns isolated trusted issuer/reviewer custody, immutable evidence, explicit exact bootstrap permission and bounded control-plane failure handling (CTR004/015/017/020 and the compiled privileged-core boundary). The currently checked Spec differs from the accepted reviewed text only in the recorded acceptance lifecycle, not those Contract meanings. The repository's `REUSE + CONTROLLED` route requires a valid exact execution mandate/runbook, receipt and independent post-state review; it does not require a new Spec just because this recovery is privileged.

The original runbook's no-retry rule remains intact. Old reviewer-login appends its original intent exclusively, and login-child authenticates that original parent PID. This design does not call them again or claim that their allowance was unused. It requires a new, separately reviewed and explicitly authorized operation over the retained installation. The old unknown provider outcome stays historical unknown. No routine producer, Agent or installed daemon gains a generic recovery privilege.

The exact-operation artifact is the recommended minimum. A generic runtime reconcile-plan parser, selectable attempt/host/path/command, credential service or reusable recovery framework is unnecessary. Compiled reviewed constants for this host, original attempt and receipts, fixed paths, public digests, numeric identity, Codex/Apple-tool closure and existing lock are sufficient. Only the new strict root-only short-lived grant varies with issuance/expiry and binds the compiled manifest and actual helper digest. The actual helper hash must be externally sealed in that grant/Owner package; it is not a circular self-hash embedded in its own source. Installation of the new fixed helper belongs to the future exact Owner operation package; the helper's login-only grant does not itself authorize arbitrary installation.

This preserves the old sealed package and runner. The new helper only appends one fixed reconciliation record family within the same original attempt and performs one isolated device login. It does not change trust roots, read/sign issuer keys, clear unknown deployment state, enable services, retire legacy paths, operate a target runtime or amend normal deployment authority.

## Security reasoning and incorporated closure

The reviewed design now covers the necessary sequence: verify the protected exact closure and historical prestate, open the existing mutex without create/replace, validate its inode/device and acquire nonblocking exclusive ownership, then perform all authoritative checks and durable publication under that guard. An exclusively created and flushed new intent consumes the sole allowance before spawn. Any existing new intent/result/failure prevents reuse even if a caller changes a request or grant. Missing/malformed/drifted state, failed fsync and unknown postconditions must leave the history and consumed allowance intact.

The root helper can only spawn its own fixed child action. That child revalidates code/grant/compiled bindings and authenticates its live parent and existing lock identity while the parent retains the lock; it does not acquire a second lock or wait on its own parent. It clears the environment, sets the sole supplementary group612, drops GID/UID to612, and execs exactly the original pinned Codex device-login command with the fixed protected home. No root interpreter, root Codex, arbitrary argv or caller-selected path is introduced. Credential and device-code output stays on the visible local terminal.

During review, the following directly affected closure was required and incorporated in the frozen design:

1. **Post-child survivor check:** direct-child exit is insufficient if a reviewer descendant survives. Before completion, run the fixed process census and require no UID612 or reconciliation child. A survivor produces UNKNOWN and is preserved; no broad UID/process-group signal is allowed. Only the directly owned child may be terminated/reaped on the bounded timeout.
2. **Shared-lock child proof:** explicitly retain one existing parent-held lock through final publication, avoiding child reacquisition/self-wait or an independent second mutex.
3. **Auth metadata and truthful receipt:** use the existing issuer contract: fixed home612:6120700; safe regular single-link, nonempty auth file612:6120600 with no unsafe ACL/symlink/flags. Inspect metadata only. The completion receipt claims this newly authorized command and local metadata checks; it neither claims independent review PASS nor reclassifies the original provider outcome.
4. **Scope reduction and retained custody:** freeze this one operation as compiled bindings, retain all old attempt/intent/package/runner bytes, check six role-key files only by safe root-only metadata, and leave all activation dispositions disabled.

These are applications of existing isolation, durable-record and failure obligations to the selected operation. They do not establish a new long-lived platform contract. No other closed finding was reopened.

## Required implementation evidence

The design is sufficiently concrete to implement. Source review must verify actual control flow rather than accepting matching receipt labels. Meaningful ordinary fixtures must cover the real native seams where practical, with no fake claim of a provider login:

- Exact valid prestate and grant permit one spawn and preserve all historical bytes; changed plan/request or repeat after any new intent/result/failure cannot replenish the allowance.
- Wrong/malformed/expired grant, future or invalid time bounds, helper/Codex/tool drift, altered old public records, wrong host/identity, unsafe home/key/auth metadata, auth or old login-result already present, activated configuration/socket, replaced/busy/missing lock and preexisting reviewer/bootstrap processes all reject before login effects.
- Intent/parent binding and existing-lock proof reject foreign child invocation; child environment, groups and identity are exact. Secret paths have no content-read/hash/log path in the helper. Fixed process output must exclude arguments and credentials.
- Crash or I/O failure at intent/result publication, failed/timeout child, unsafe/missing auth after success, changed disabled state or surviving child/UID612 process remain UNKNOWN and never replay. Final completion requires all postconditions plus durable publication; no generic process sweep or cleanup is substituted.
- Historical installation/login entrypoints and sealed package bytes remain unchanged. New source needs the appropriate fmt/tests/clippy/release checks and a fresh independent security review before the operation artifact is sealed.

No implementation tests were run for this design-only review. Existing poststate evidence and exact packaged source were inspected; fixture success cannot satisfy actual login or grant permission.

## Remaining blocker union and handoff

There is no open blocker to the bounded nonproduction implementation. The actual operation remains blocked on an implemented and independently reviewed helper, exact compiled binding manifest, reproducible artifact/package and complete controlled runbook, plus a fresh exact Owner grant/authorization. At dispatch, the current protected prestate and lock/process census must be revalidated once; the September18 observation is a binding baseline, not permanent permission. Drift stops the operation and retains evidence. No old attempt reset or blind retry is available.

Owner device authentication is still required locally under the future package. Until that operation succeeds and its public result is independently read back, the real isolated reviewer prerequisite remains incomplete/unknown. A successful new login still does not prove a real trusted build/review job has passed.

The full first-live blocker union in the linked poststate report remains: uninstalled candidate versus installed disabled controller; exact full target generation/transaction and preimage proof; real current Watchdog semantic prerequisite and signed deployment-child mapping; reviewed adoption/baseline/observer/predecessor implementation; required legacy retirement and caller-denial proof; explicit conditional activation/real canary authority; and actual Broker issuance/apply/finalize/producer closure. This login design removes none of those gates. It should be packaged with that one complete operation request, not dispatched as a piecemeal retry. Parent Goal and other unadopted targets remain incomplete.
