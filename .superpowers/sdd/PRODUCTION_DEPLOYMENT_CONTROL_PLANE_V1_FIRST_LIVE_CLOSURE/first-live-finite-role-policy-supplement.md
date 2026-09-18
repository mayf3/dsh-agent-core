# Supplemental finite conditional root-role policy

Author dcp_census_repair_review; bounded design candidate for independent assessment. No implementation or current host-safe PASS. This supplements `first-live-finite-role-policy-candidate.md` and replaces its now-resolved Developer/login relationship gaps; historical observations remain unchanged.

**The finite role definitions can now be closed for review.** The remaining14 Application/User XPC instance joins are explicit future protected metadata predicates, not a missing static authority or a reason for another broad investigation. Ordinary fixed lookups were attempted once and stopped at unavailable access. This is a finite current-ingress handover under the trusted OS/Owner baseline, not historical compromise attestation.

## Exact evidence

Under `first-live-preparation/ordinary-census`:

|Evidence|SHA256|
|---|---|
|finite-role-fixed-lookup.json|199e7b89326fb905fa40d17d7e7b91fe2bcf587903950d45150b817102721abc|
|developer-domain-role-lookup.json|bfffd3e49816caabbdd8735efff34b922ffe77ae0caed540cb0503ba1a2aa250|
|coredevice-exact-role.json|387a50879634e03e63ca22632137660eaf1f35293ba79a3550396f41c33eab9c|
|fixed-login-role-metadata.json|2883477bcdfbc1d75f2af45df07415e51c58d40e2cdaeab780a707d5b7b75f47|
|xpc-fixed-domain-attribution.json|09e9fcfb5df79eefc03238b9bcbd95d3d4077f619547d1951dccb839230e29ee|
|xpc-fixed-job-attribution.json|e77a338368204750d4a3a051f8219f37cbb08276c127941bf1c1fadc2171bd7f|
|finite-root-role-policy-v2.json|01e6a98571a41adb3ae80523184757ba51632ed2eab48dc5cd3be1a2587d3ec6|

The first four are the parent's ordinary metadata observations. The last three were produced here. Raw launchctl output was discarded after hashing and extracting only role/path/type/state/PID/domain metadata; no environment or arbitrary arguments were retained. No root calls, service mutations, login, endpoint or credentials were used. New helper sources `dcp-xpc-attribution.py` and `dcp-xpc-fixed-jobs.py` are retained with the evidence.

## Developer roles: exact submitted jobs

The actual system service table and exact job readbacks establish:

- `system/com.apple.CoreDevice.CoreDeviceDDIUpdaterService.job` → exact CoreDeviceDDIUpdaterService program, PID34546, typeSubmitted, path `(submitted by CoreDeviceServi.34539)`.
- `system/com.apple.CoreSimulator.simdiskimaged` → exact simdiskimaged program, PID34897, typeSubmitted, path `(submitted by com.apple.CoreS.34895)`.

Use these observed labels, not names guessed from the embedded Info.plist. Join future exact job program/PID to the precise kernel generation and protected signed Apple/non-SSV loader closure already identified. The submitted-by strings are provenance metadata, not permission to execute/trust arbitrary submitter code. Under the trusted OS/Apple service baseline, these finite authenticated system job roles do not require a generic Developer-service platform or another host intervention.

## Root login: trusted setuid program, not trusted terminal code

The actual parent68558 is UID502 Alacritty. The earlier Apple Terminal hypothesis is disproved and is removed from the candidate policy. Both login rows have realUID502/effectiveUID0, real/effectiveGID20, exact `/usr/bin/login` root:wheel04555, and controlling terminals `ttys000`/`ttys017`.

The role predicate is the **protected Apple setuid login program enforcing its existing OS authentication behavior**, joined to those real/effective/saved UID and GID credentials and actual tty/session. It is not “Alacritty is root-trusted.” The installed public `login(1)` manual specifies that `-f` is restricted to superuser or an already logged-in user logging in as themselves. Under the accepted trusted OS baseline, a nonroot terminal launching this authenticated OS boundary is distinct from caller-owned code executed as root. No caller terminal executable hardening or trust elevation is needed.

Future proof must bind exact kernel birth/path/real/effective/saved UID and GID credentials, the actual controlling-terminal device and session relation, and current protected Apple code identity; matching `comm`, PID, parent or tty text alone is insufficient. RealUID0, a different credential/tty tuple, an unproven kernel session, or changed executable must stop. Preserve the parent generation as metadata but do not make its writable application binary a privileged code dependency. This exception is only the observed Owner-login role, not arbitrary setuid or generic Apple utilities.

##19 XPC joins:5 observed,14 protected-read conditions

The ordinary system table found five exact roles; exact service reads independently returned typeXPCService, exact bundle/program and matching PID:

- `system/com.apple.authd` →645.
- `system/com.apple.AppStoreDaemon.StorePrivilegedODRService` →68973.
- `system/com.apple.PerfPowerTelemetryClientRegistrationService` →90762.
- `system/com.apple.MobileSoftwareUpdate.CleanupPreparePathService` →44528.
- `system/com.apple.CodeSigningHelper` →89195.

The other14 are12 Application and2 User XPC instances, with exact signed bundle identities/type already frozen in the prior static table. One ordinary `user/0` lookup and one `pid/<PID>` lookup for each returned exit1 with no stdout. No retry or permission escalation followed. The exact historical14 references are37910,44504,44505,44513,47319,59208,83554,84801,84802,84910,84911,89268,92346,92355. These PIDs are references, not future allowlist entries.

The future private protected reader must derive a current PID from the complete kernel census, first match its exact fixed bundle identity/path/signing/type candidate, then perform one bounded metadata-only launch-domain/service attribution for that PID and the fixed bundle identifier. Retain only the actual launch domain, service/bundle identity/type, program and associated current PID. Re-read precise kernel birth/path/real/effective/saved UID and GID credentials and reject any change. Application/User identities must keep their declared role; do not fabricate system labels. Multi-instance MTLCompiler services each need their own exact generation join. The observation does not authorize new bundle IDs, caller-selected paths, root utilities or a generic command/permission UI.

Unavailable/ambiguous attribution, duplicate/truncated results, a disappearing row, or an extra unclassified root process yields UNKNOWN/refusal before fresh keys/login. It never becomes an allow exception or a reason to retry until clean. These are closed operational failure conditions, not an unresolved new Product Contract.

## Closure sequence and limits

Use the current complete census and the fixed165-row-derived role catalog; never accept a process solely because it was in the historical list. Precisely allowed roles are the finite OS/Apple jobs and bundles, these two Developer jobs, the exact setuid Owner-login role, fixed Docker role, only the successfully repaired protected Tailscale generation, phase-correct current selected dsh services, and the operation's exact finite owned child lineage. Historical ps50208 is not retained as an exception.

Pre-census may identify the exact old Tailscale/dsh generations solely as transition targets. Close LW first, remove the old Tailscale loaded job/KeepAlive ingress before its one restart, quiesce old dsh services, and complete the decisive role census before isolation/publication; repeat the bounded current proof after new protected service restoration. No old service PID remains an exception after its exit is required. Fresh six-role custody and once-only login follow actual closure, under continuously held permanent mutex and the exact Owner lease. No unrelated root process is killed.

This proposal assumes the trusted Apple OS/authentication mechanisms and explicitly chosen authenticated existing service roles; it does not prove the host was never compromised. It neither waives changed/unclassified runtime observations nor demands historical persistence forensics. The requested independent decision is whether these exact conditional role predicates and ordering close the current handover contract. The author does not issue a PASS.

## FR-01 bounded correction: select all currently root-capable credentials

The corrected policy data is `ordinary-census/finite-root-role-policy-v3.json`, SHA256 `fd562779ce789c3b9eb1891f53ea7199ac6d459bf835fdab32a7133fd57caf65`. The initial supplement is preserved as `ordinary-census/finite-root-role-supplement-initial-8d5e702b.md` with its original SHA256; v2 JSON and all observations are unchanged.

This section closes only the independently frozen FR-01. Enumerate the complete bounded **all-PID** kernel set first; read selector metadata for **every PID**, not only an effective-root listing. A process is in scope when `effective_uid == 0 || real_uid == 0 || saved_uid == 0`. A saved-root child temporarily using real/effective UID502 is therefore included and must satisfy a fixed authenticated role, otherwise the census refuses.

The identity before and after each role/launch join contains all three UIDs and all corresponding effective/real/saved GIDs, precise birth, full kernel executable path, and the role's required additional fields (including actual login tty/session). Every field must remain equal; saved credentials are not inferred from executable mode or the earlier ordinary ps record. Read the selector metadata again for all rows during the bounded stable-set recheck, including initially nonroot rows; any selection or credential drift refuses. Missing, inaccessible, truncated or malformed selector metadata for **any** PID, duplicate/truncated PID enumeration, disappearance or changed set is UNKNOWN/refusal. No row with an unreadable saved UID is filtered out as nonroot. No repeated scan until clean, killing, permission fallback or new role exception is introduced.

Required offline vectors: euid502/ruid502/svuid0 is selected then rejected without a fixed role; real-root-only is selected; effective-root-only is selected; all-three-nonzero may be excluded only after complete stable selector reads; unreadable saved UID/GID or incomplete metadata refuses; effective/real/saved UID or GID change between reads refuses; nonroot→saved-root selector drift refuses; PID/birth/path/set replacement refuses. Existing exact role positives still need complete stable credentials and their own role proof. These are predicate tests, not claims of current kernel proof.

Earlier165-row observations remain immutable and incomplete for this selector; no saved credential was retroactively invented. This correction addresses explicit current kernel credential authority only and does not enlarge the trusted OS/Owner or historical-forensics scope. Source implementation remains paused.
