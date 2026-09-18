# Exact operation package and one-time runtime-derived coordinates

Authority: accepted Spec 39865536ce51005f95a98473e77c2329078512c0, same parent Goal, REUSE + CONTROLLED. This clarifies the already reviewed finite first-live package; it is not production authorization. No new service, signing role, target, caller field or product behavior is added.

## Concrete wiring problem

The reviewed canary design already selects T0 after lifecycle availability is ready and before the AdoptionGrant and isolated review. The draft Packet instead carries a precomputed absolute canary_plan_raw. A whole-tree inode copy, login and maintenance can consume that window before review starts. Setting a guessed future time or rewriting a plan after review would violate the existing contract.

Similarly the future login-reconciliation result includes a digest of its new short-lived Owner grant. It cannot have a historically observed digest before the command executes. This does not justify a placeholder receipt, imported PASS or a fresh attempt.

## Frozen package versus generated run records

The exact Owner package binds immutable executable/source/review digests, the complete static typed packet template, original public state/preimages, payload bytes, identities, paths, one fixed operation ID, exact effect envelope, rollback, and the closed deterministic construction rules below. Runtime grant timestamps and their derived hashes are generated once as append-only run records by the exact reviewed operator. They do not permit a caller-selected source, target, role, command, duration, retry count or alternative packet. An exact package digest is not described as the digest of a future signed or observed record.

The final authorization request must expressly disclose these fixed derivations and time bounds. The ordinary package operator verifies its own and all input hashes before prompting for administrator authentication; privileged copy consumes already-opened, ordinary-read/hash-verified bytes via the reviewed anonymous regular descriptor mechanism. Root never reopens caller-controlled source paths. Generated files are retained with exact raw hashes in the operation evidence. The root native helper revalidates its protected grant, actual packet and every actual prerequisite under its permanent mutex.

## One login grant and expected public result

1. The exact operator creates one login grant from the independently reviewed helper's closed schema and fixed compiled binding manifest. It selects issued_at from the actual clock once, with expires_at exactly issued_at + 3600 seconds, and binds the installed helper digest. This is inside the future Owner's explicit one-use login reconciliation allowance. No new original attempt or original intent is created.
2. Before invoking the helper, freeze and retain these exact grant bytes and their raw SHA256 digest. The operator may compute the expected successful public receipt bytes using only the fixed helper result schema, this raw grant-byte digest (the reviewed helper hashes its exact input bytes, not a reserialized semantic Grant), the immutable binding-manifest digest and original intent digest. Label this EXPECTED_POSTIMAGE, not an observed receipt. All status literals, booleans and original UNKNOWN retention are exactly those emitted by the existing reviewed helper.
3. The actual helper must execute once successfully and produce its independently re-read protected result. Compare actual complete bytes/hash and safe auth metadata with the expected postimage. A nonzero exit, timeout, missing/changed receipt or residual process stops the whole package; never fill an expected receipt into the protected result path or infer success from auth-file presence.
4. Only after this actual successful check may the operator construct the first-live packet from its frozen template by inserting that now-observed receipt hash. No other static field may change. It then freezes the exact packet bytes/hash and a first-live Owner grant binding them. The first-live grant uses a once-selected actual issued_at and expires_at = issued_at + 86400 seconds; the exact maximum is disclosed in the operation request. The receipt validator still requires the real successful protected result and retained original UNKNOWN semantics.
5. A crash or interrupted publication consumes the relevant durable intent; no automatic refresh, re-sign, new ID or second invocation exists. The package cannot use a changed static template merely because a new digest could be computed.

## Canary plan after actual lifecycle readiness

The external packet contains only a strict CanaryPlanTemplate: version 1, fixed Watchdog source d602b592fad345fb1c9adebe2bc6611a6f5cfdc2, fixed canary agent/logical key semantics, and the already reviewed delays at=T0+1200s and notAfter=T0+1380s. These delay values are exact constants, not caller ranges. Unknown fields or supplied achieved state/job ID/at/notAfter are rejected. There is no precomputed unsigned actual canary plan in the template.

After the complete executed lifecycle result and restored availability are verified, but before AdoptionGrant signing and before build/review starts, native code captures T0 once from its real clock, verifies the unexpired outer grant has enough remaining time for the entire canary bound, constructs the exact existing PLANNED schema with canonical UTC at and null canaryJobId, and writes those raw bytes exclusively to the operation journal. It returns a private bound plan object; only this object supplies materialization and canary execution. It is not an arbitrary clock/input override exposed by the root entry.

The AdoptionGrant signs the raw digest of that actual immutable plan; genuine isolated review and native before/created/after observation consume the same bytes. The plan is copied exclusively into the existing grant-derived capture namespace with exact byte readback before use. Existing creator windows, 900-second review budget, begin-before-create, one create, strict succeeded/noop/Router proof, one CAS cleanup, UNKNOWN preservation and non-canary isolation are unchanged. Review or execution lateness stops without changing T0, refreezing the plan or extending a grant.

The external Owner grant still pins the exact helper/controller/template algorithm and full operation scope. The runtime-derived raw plan is subsequently bound by the existing actual Authority-signed AdoptionGrant; no Agent-authored PASS is signed as evidence.

## Required review and checks

Independently review this bounded clarification before changing the draft packet/call sites. Source tests must reject extra/dynamic template fields, altered delays/source, forged expected login result, mismatched actual grant/result, insufficient lifetime, duplicate plan/intent, late review and post-freeze timestamp substitution. Verify generated packet differs from its frozen template only by the allowed observed login hash; final canary bytes must survive actual hash/signature/readback through the existing flow. Use genuine clock reads in native execution and private tests; no production clock or auth injection.

No production privilege is exercised during preparation. Whole-package/source review remains open until the actual native driver, outer descriptor delivery, generated-record bindings and failure handling are completed. Existing independent source PASS reports are bounded evidence, not authorization or end-to-end completion.
