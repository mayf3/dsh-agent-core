# One preactivation custody transition — proposed execution design

Status: nonproduction design for independent authority/safety assessment. It is not a new accepted Spec, a bootstrap grant, an active trust epoch, or a production receipt. The current login-first operator checkpoint must not be executed. Historical installation and its UNKNOWN login outcome remain unchanged.

## DEVELOPMENT_PREFLIGHT

GOAL_OR_TARGET = PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1; first useful dsh deployment loop.
CURRENT_GAP = new evidence of caller-writable root Tailscale execution and inherited root writer authority prevents establishing first standing-use custody.
AUTHORITY_ACTION = REUSE proposed, subject to independent affected-contract review.
PRIMARY_AUTHORITY = accepted 39865536ce51005f95a98473e77c2329078512c0, CTR-DCP-001/004/008/009/017/018/020 and migration section 7.
PLAN_LEVEL = EXEC_PLAN; ASSURANCE_LEVEL = CONTROLLED.
ROUTE_STAGE = IMPLEMENTATION preparation only; existing Owner mandate permits custody design and nonproduction implementation, not execution.
DONE_WHEN = source, negative/crash tests and independent review bind one exact future Owner operation package preserving the old attempt/history and enabling no standing use from old keys.
EXPANSION_TRIGGER = active historical records, prior published queue cursors, unknown root role, unavailable exact authority, changed business enrollment semantics, or a need for recurring rotation/multi-host service management. Stop at that concrete condition; do not enlarge this design automatically.

## Chosen finite boundary

The accepted Spec already makes trust-root changes separately Owner-authorized bootstrap effects. This design proposes one explicitly authorized preactivation update; no request/API can rotate keys, choose a key, alter a historical prefix, reset a counter, or nominate a path. No signing service or generic Goal platform is introduced. The independent review must decide whether the historical-read compatibility described below remains implementation under these contracts; a load-bearing normative gap stops implementation through the repository's docs-first route.

Rejected alternatives: retaining the exposed-custody-era keys as active trust would leave the new evidence unresolved; deleting/reinitializing the registry loses receipt/history identity; accepting both old/new public keys for active verification permits old evidence to authorize new work; changing historical signed bytes conceals history. A generic multi-epoch rotation protocol is unnecessary.

## Single serialized operation and effects order

One root supervisor owns the existing permanent production mutex from authoritative preflight through all mutation, readback, genuine adoption/acceptance and finalization. Existing legacy locks remain held until their exact reviewed retirement disposition. The pending fence is durable before mutation and denies other admission. No stage releases ownership to an independently launched mutation helper, and no inherited string means lock possession.

1. Verify exact source/package/grant, host/identities, installed disabled genesis, original attempt/UNKNOWN login, public/protected preimages, empty operational state, original one-record PENDING registry, tool identities and actual lock families. Read-only dynamic observations are recorded and joined to the fixed manifest; no observed value widens authority.
2. Retire the actual LW NOPASSWD executable first using the reviewed refusal binary and exact preimage. Retire/lock the two actually installed dsh script entries and prove the two declared source-only entries remain absent. Do not add missing paths. Keep sudoers bytes unchanged.
3. Replace only the Tailscale launch executable reference with the authenticated same-version protected copy, with one bounded stop/start, exact old generation exit and new generation/readiness readback. KeepAlive/RunAtLoad require a real bootout before changing the plist; killing a PID is insufficient because it may respawn. Network interruption is an explicit new effect in the future Owner package, requiring a local control path. Preserve all other plist fields, identity, state, socket and network policy. The payload/old-new plist static candidate is identified below.
4. Complete dsh quiescence/new-inode isolation, actual caller denial and new service generation/readback. Before protected publication and again afterward, a finite reviewed kernel census must exclude unclassified inherited root writers, under the explicit trusted OS/Owner baseline. Static executable lists or no-Node/no-shell observations do not suffice. Do not claim historical-host integrity, automatically trust all baseline rows, kill unclassified processes, or expand into host forensic repair.
5. Only after the reviewed current closure receipt succeeds, perform the six-role custody transition below. During it admission remains fenced and daemon disabled. No old key issues new build/review/adoption/standing proof.
6. Perform the separately authorized once-only dedicated reviewer login inside the same owned operation, after closure and fresh custody. Bind a successor helper to the new package and protected transition receipt instead of silently reusing the old helper's obsolete public pins. Preserve original attempt `genesis-65559dd-20260918-01`, original login intent and UNKNOWN outcome. A fresh reconciliation allowance is consumed before invoking its exact fixed command; no new attempt ID restores it. Device output goes only to the local terminal, never evidence logs. Existing unexpected authentication metadata stops the operation for explicit disposition; it is not silently trusted or deleted.
7. Bind actual generated public keys and known login result to the fixed configuration template under root custody. Freeze canary time only after lifecycle and login complete, within the still-live Owner operation lease. Run genuine isolated issuer build/review, zero-install Watchdog adoption, real Watchdog canary/acceptance and per-Goal receipts. Enable standing authority/controller only when all gates pass; then submit the genuinely pending Broker artifact through the reviewed nonroot producer/controller API and obtain install/readback/acceptance/closure receipts.

This ordering supersedes the proposed login-first sequencing only; it does not rewrite previous runs. Completing a component, installation, or adoption does not complete the parent business Goal. Source/auth-service/svc-workflow and other unenrolled targets retain their separate status.

## Exact one-record historical bridge

The original protected registry must consist only of the permanent `registry.lock` and raw `state-00000000000000000001.json`, with the previously retained SHA256 `74e98530ee6689b1ca5c822b4719791a86f3cdd60e2a53ad250f7210af6844f1`. Validate its signatures using the exact historical profile-bearing `service.json` catalog, and verify that its keys equal original `local-trust.json`. The latter alone is insufficient because genesis wrote it before adding the dsh profile to the in-memory catalog. Bind both original raw files and the original installation receipt in the operation manifest.

Require revision1/previous_revision0/watermark1, empty ready snapshot, exactly the original PENDING row at row revision0, no ready/proposal/closure, business_goal_complete=false, and exact original Enrollment payload/digest. Require no queue database, activation, delivered intake, pending registry temporary file, issuer jobs, adoption, open transaction or recovery artifact. Any richer history is outside this one-time design and fails before changing keys.

Preserve original state1 bytes at their existing name and keep an immutable protected archive of the old public catalog/config and old private files, inaccessible to current signing. Generate six independent entropy-backed keys once into a new fixed protected staging directory after the safe-host phase. A durable transition intent consumes this one-operation allowance before generation. Existing staging/intent, partial publication or unknown completion never triggers automatic regeneration/replay.

The append-only transition result binds old raw state1/catalog/config digests, old/new public key catalogs, safe-host receipt, exact Owner grant/package, and these two fresh outputs:

- A new Producer signature over the *unchanged empty snapshot1 payload*, retained separately as a bootstrap reattestation. It asserts an empty deployment-ready census, never review/health success.
- New ledger state2, previous_digest equal the canonical signed state1 digest, carrying the exact same Enrollment payload re-signed by the new Authority key and unchanged PENDING row semantics. Its snapshot2 uses revision2/previous_revision1/watermark2 and is empty, signed by new Producer. The ledger itself uses new Producer. No business state or accepted contract is changed.

Publish staged custody, active catalog/config and state2 with descriptor-bound exact metadata and fsyncs under the mutex. There is no claim of atomic multi-file rename: the existing pending fence plus incomplete transition/startup guards reject every mixed state. A complete transition receipt is last, and all its referenced bytes are revalidated at startup. A crash leaves the original attempt/history and partial transition evidence intact, admission disabled, no replay. No rollback to old keys may re-enable standing use.

Registry history compatibility is limited to **the exact raw state1 prefix named by this protected once-only transition receipt**. Only that branch may use the archived old catalog. State2 must prove payload-identical carry-forward and all state2+ records use only the active catalog. Normal `enroll` remains signed-record immutable and cannot invoke this exception. Request/admission/review/policy/recovery verification receives no archived keys and never retries with them.

For an initial queue cursor0, `snapshots_after` publishes the fresh reattested snapshot1, then snapshot2, then later current-catalog snapshots. It preserves producer CAS/watermark continuity 0→1→2 and never serves the old-key snapshot as active input. History APIs retain the original signed ledger as evidence. The current producer identifier is unchanged; no reset or invented business record. Reattestation is valid only for this proven empty, never-published genesis census; it must not become a facility for re-signing arbitrary old records.

## Tailscale static candidate already prepared

Artifact directory: `/Users/yanfenma/workspace/artifacts/production-deployment-control-plane-v1/first-live-preparation/tailscale-static-candidate-v1`.
Manifest SHA256 `b4ac483e12ce4c173424c384d67bb55f09ffe9ab16aaa0c1abb7bf4de2956c5f`.
Original plist SHA256 `d8b2ca94c6fe9d417f7541c882d87b95a4bdea8a5a6a4e80484e7e9a7e11ffdf`; candidate `ec12e0c62acf5cd44984fdf8474dca8fafc098842c2a9f8c3f62bfb03caa19f8`.
Only semantic difference: ProgramArguments[0] changes from `/usr/local/bin/tailscaled` to `/usr/local/libexec/tailscale-sealed/tailscaled`.
Same-version executable SHA256 `5d9c03785aa534b0bd42071f1b7632474ae932e876dcaa7fd3866f685010d8da`, 23331104 bytes. Official Homebrew GHCR index→manifest→bottle→member chain independently PASS in `first-live-tailscale-provenance-review.md`, SHA256 `9ce2b68792acf9baf3e4a2078ea3f91a4fe852247050933e03456fac93e6d07e`. This is named Homebrew publication trust, not a Tailscale vendor signature.

Known complete new-start failure may use only the exact reviewed availability disposition. Restoring the old caller-writable path, if explicitly authorized, leaves DCP globally unsafe/disabled and is not secure rollback. Unknown stop/start must retain UNKNOWN, with no repeated start, broad kill or automatic reverse mutation. State/network identity is never rolled back or re-registered.

## Required executed evidence and stop boundary

Tests must first demonstrate current rejection of legitimate preserved history after a key change, then verify exact state1→state2 carry and cursor0→1→2. Negative cases: changed old raw bytes/catalog/profile; active/closed original row; preexisting queue or pending publication; changed payload/owner/contract; missing or forged transition receipt; old signatures for each of six active roles; mixed active keys/config/ledger; old-key snapshot publication; reset/counter gaps; repeated transition; entropy/write/fsync/rename crash points. Normal registry immutability, current admission and unrelated recovery fail-closed behavior must remain enforced.

Lifecycle tests must reject key generation/login before the safe-host proof, Tailscale PID-only stop with respawn, old executable path after restart, unclassified/detached root writers, expired grant, missing durable effect result, and any attempt to release/reacquire the mutex between mutation phases. Existing genuine issuer review isolation remains mandatory: no Agent self-PASS gets signed.

Before one exact Owner request: finish the bounded source, full tests/fmt/clippy/release and independent review of affected privilege/custody/history/order surfaces, freeze package and once-only recovery. There is no current complete package digest or execution authorization. The concrete next input needed internally is the finite root-role classification and implementation review, not an Owner-supplied issuer or registry.
