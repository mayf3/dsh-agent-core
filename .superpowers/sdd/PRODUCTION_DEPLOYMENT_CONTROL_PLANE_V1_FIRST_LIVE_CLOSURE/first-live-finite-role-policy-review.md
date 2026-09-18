# Independent review: finite current root-role policy

REVIEWER_ID = /root/dcp_first_live_binding_review  
AUTHOR_ID = /root/dcp_census_repair_review  
AUTHOR_INDEPENDENCE = PASS  
REVIEW_KIND = AFFECTED_CONTRACT / controlled-operation design  
PRIMARY_AUTHORITY = accepted 39865536ce51005f95a98473e77c2329078512c0, CTR-DCP-008/009/017/018 and section 7  
PARENT_BASE_AT_REVIEW = 48dd8eff0fa57093357b407d259af32060afb377  
INITIAL_SUPPLEMENT_SHA256 = 8d5e702bcf8960e7166613482a6991a73f13447ab88fbd1ff35e447d7cc53af5  
INITIAL_POLICY_JSON_SHA256 = 01e6a98571a41adb3ae80523184757ba51632ed2eab48dc5cd3be1a2587d3ec6  
AUTHORITY_ACTION = REUSE  
AUTHORITY_REVIEW = PASS  
INITIAL_DESIGN_REVIEW = REVISE  
FROZEN_BLOCKER_UNION = FR-01 only  
SPEC_GAPS = 0  
SOURCE_REVIEW = NOT_PERFORMED  
CURRENT_HOST_CLOSURE = NOT_PROVEN  
OPERATION_ALLOWED = NO

## Scope and conclusion

The finite conditional-role approach is within the accepted current-ingress handover and trusted OS/Owner boundary. It does not require a new host-security Product Contract. The design does not assert historical compromise absence or silently accept the historical process list. An exact current role must join protected code/loader identity, the appropriate authenticated launch-service or login role, and a stable current kernel generation. Unclassified or unobservable entries remain a refusal.

The initial candidate has one concrete completeness hole in its definition of the census subjects, FR-01 below. This is a small design correction to the current process-credential predicate, not a reason for broad historical forensics or another host platform. The remaining fourteen Application/User XPC observations are mandatory future protected runtime predicates; their ordinary access failures do not create fourteen new normative decisions or justify an allow exception.

## FR-01 — saved-root credentials can escape an effective-root census

CLASS = SECURITY_OR_DATA_LOSS  
SOURCE = accepted CTR-DCP-017/018 and section 7 require closure of current inherited privileged writers before custody/standing use; supplement lines 38, 52, 54 and 58 specify real/effective identity joins and a complete set of root processes.

COUNTEREXAMPLE: a native child launched by the existing privileged legacy path retains a saved UID of 0 while temporarily using real/effective UID 502. A census selected by effective UID 0, or even effective/real UID 0, omits it. It can then regain effective UID 0 after the custody gate without invoking the now-retired legacy entrance. This is a current inherited process authority, not an inference that historic compromise occurred.

Apple's published XNU implementation permits restoring the effective UID from the real or saved UID. The installed SDK `sys/proc_info.h` exposes `pbi_uid`, `pbi_ruid` and `pbi_svuid` in `proc_bsdinfo`; there is no need to infer this state from argv, a name, or an ancestry guess. See [Apple XNU kern_prot.c](https://github.com/apple-oss-distributions/xnu/blob/main/bsd/kern/kern_prot.c), `setuid`/`seteuid`/`setreuid`, and `/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/proc_info.h:59`.

IMPACT: the declared complete current-root-writer closure could pass while an unclassified process still has an explicit kernel credential that restores root; new keys/login would begin before the stated boundary is established.

MINIMAL_CLOSURE: enumerate all PIDs, read the kernel selector metadata for every row, and classify every process for which effective OR real OR saved UID is 0. Bind and recheck all three UIDs, corresponding GIDs, precise birth/path and the role's other required identity fields before/after the join. Missing/truncated/unreadable selector metadata, disappearance or selector drift must refuse the census; they cannot be filtered as ordinary nonroot rows. Add offline negative vectors for euid502/ruid502/svuid0, real-root-only, unreadable saved UID, and before/after changes. No broad process kill or retry-until-clean follows. This predicate addresses explicit process credential authority; the trusted OS/Owner and no-historical-compromise-attestation boundary remains explicit.

## Other affected predicates

The two Developer jobs now have actual observed labels and service-to-program/PID evidence: `system/com.apple.CoreDevice.CoreDeviceDDIUpdaterService.job` and `system/com.apple.CoreSimulator.simdiskimaged`. A future join still must establish the exact current generation, complete protected non-SSV loader closure and exact Apple code identity. A submitted-by string is provenance, not independent authority for arbitrary submitter code. No Developer shutdown or broader enrollment is required by this policy.

The observed login parent is UID502 Alacritty, not Apple Terminal. Accepting only the protected Apple setuid `/usr/bin/login` OS authentication role with the frozen real/effective credentials and verified current tty/session is consistent with the trusted OS baseline. It does not make Alacritty privileged code. I verified the referenced local login manual SHA256 `4a99867c771c29bbb513acf9030d0f4eaa8c9b6ae929c802fe61012aa98661ba` and its restricted `-f` contract. No login, authentication test or credential read was performed. The saved UID predicate from FR-01 must also be included; a matching path/comm/parent/tty string alone remains insufficient.

Five System XPC roles have ordinary service readbacks. The other fourteen have exact fixed bundle/service identities and declared Application/User roles, with explicit future protected attribution and refusal on failure. That conditional design is coherent; current proof is absent. Multiple MTLCompiler/CloudTelemetry instances need distinct generation joins. The native parser must select the actual top-level service metadata, not accept a nested `type`/PID field from the retained flattened launchctl display. This is a source-validation obligation, not an additional finding against the policy.

All 165 historical rows are pointers to candidate role definitions. No PID is standing authority and every row remains `current_verified=false`. The JSON classes total 136 direct OS daemon candidates, 19 fixed XPC roles, two Developer jobs, two protected Apple launch roles, two third-party roles, two login rows, init, and one historical transient. The historical `ps` row is not an exception. The three historical basename observations (autofsd, automountd, aslmanager) have fixed absolute launch-manifest programs; future kernel comparison must use those protected absolute identities, never the short observed names. Init requires its explicit PID1/kernel/SSV role, not a fabricated launch-job label.

Only the repaired protected Tailscale generation may pass the safe-host phase. Old Tailscale/dsh generations are transition targets until their required exit, not signing-safe exceptions. Docker remains its separately fixed protected signed helper/plist/loader role. The bounded operation's own children require actual owned birth lineage. Exact ingress retirement, old-generation exit, decisive census, new-inode isolation/restoration and repeated current proof precede fresh custody/login under the one continuous mutex. No unknown role may be killed or accepted merely to make the gate pass.

## Evidence and limits

I read the exact supplement, prior static candidate, all class definitions in v2 JSON and the linked retained metadata evidence. Independently recomputed the six additional-evidence hashes and special-static hash, checked all 165 unique historical references and 23 special rows, and confirmed that the retained 23 codesign results report strict verification success. I did not rerun signatures against live executables or treat those retained static results as a current kernel census. The five System XPC exact-service records contain matching program/domain/PID data; all fourteen other one-shot lookups report exit1 and zero stdout as stated.

No source, root process, privileged endpoint, live service, key, authentication contents or production state was changed or queried in this review. Reading retained public evidence and the installed public SDK/manual is not a live handover proof. Future source/tests/independent review and the single exact Owner operation authorization remain required even after the design blocker is closed.

## Exact FR-01 design re-audit

CORRECTED_SUPPLEMENT_SHA256 = 0107056cb13c6091842c30064574c0e2a5b482e15818b6a919cab342151327ac  
CORRECTED_POLICY_JSON_SHA256 = fd562779ce789c3b9eb1891f53ea7199ac6d459bf835fdab32a7133fd57caf65  
FR-01 = CLOSED_AT_DESIGN_LEVEL  
FINAL_DESIGN_REVIEW = PASS  
REMAINING_DESIGN_BLOCKERS = NONE  
AUTHORITY_ACTION = REUSE  
SOURCE_REVIEW = NOT_PERFORMED  
CURRENT_HOST_CLOSURE = NOT_PROVEN  
OPERATION_ALLOWED = NO

I compared the corrected supplement against the retained original `finite-root-role-supplement-initial-8d5e702b.md`, whose SHA256 still equals the original reviewed value. I independently checked the v2→v3 JSON row delta: all 165 rows and their roles, paths, static identities and prior observations are preserved; the only per-row change is the appended complete-credential requirement on all 165 rows. The historical transient's class remains excluded; the added general requirement does not make it an allowed role. No role was added or retrospectively marked verified.

The corrected predicate starts from bounded complete all-PID enumeration, includes a row when any effective/real/saved UID is 0, requires all three UIDs and corresponding GIDs in the stable identity, and rechecks selector metadata even for initially nonroot rows. Missing saved credentials, incomplete/unreadable metadata, selector/credential drift, changed PID set, substitution or disappearance refuse the result. Required offline vectors directly include the saved-root-only counterexample and its nonroot/real-root/effective-root controls. The old ordinary observations are explicitly insufficient to establish saved credentials and remain unchanged.

This closes the frozen FR-01 design union without broadening the role catalog or asserting new current observations. The finite conditional policy is sufficient for implementing the stated current process-credential/ingress handover under the explicit trusted OS/Owner baseline. Source-level kernel enumeration, exact launch-role parsing, finite bounds, stable-set joins and integration ordering still require executed tests and independent source review. The fourteen protected XPC joins and all other current role proofs are runtime gates, not granted exceptions. No historical-compromise attestation, complete operation readiness or production authorization follows from this design PASS.
