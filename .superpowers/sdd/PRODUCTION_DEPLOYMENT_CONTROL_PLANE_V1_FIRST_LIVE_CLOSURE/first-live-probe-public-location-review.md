# Independent bounded design review: readable fixed denial-probe input

REVIEW_RESULT=PASS_AT_DESIGN_LEVEL
REVIEWED_DOCUMENT=first-live-probe-public-location.md
REVIEWED_SHA256=467acf819a4fbadb19353c5286e4ecc9be445f568fb6667f40303c14944bc4f3
AUTHORITY_ACTION=REUSE
SPEC_AMENDMENT_REQUIRED=NO
NEW_DESIGN_BLOCKERS=NONE_IDENTIFIED
SOURCE_REVIEW_PASS=NOT_EVALUATED
PRODUCTION_OPERATION_ALLOWED=NO

The independent reviewer did not author this delta and recomputed its exact hash. Scope is only the input location for the previously reviewed fixed inert launchd-domain denial probe, under accepted CTR-DCP-018. The earlier pathname beneath the0700 state root cannot be traversed by the tested UID502, so a failure there could establish unreadable input rather than rejected domain authority. This is a concrete proof-input correction, not a new production integration or state-permission change.

The replacement fixed path `/usr/local/libexec/agent-deployd/lifecycle-denial-probe.plist` is outside the private state root and outside launchd's automatic plist directories. The file is newly created root:wheel0644 under the existing protected root:wheel0755 executable directory; complete ancestry, single-link safe metadata, exact bytes and caller readability are frozen/read back. No key, auth, queue, journal or other control-plane state becomes readable. Creation and disposition of this one public file remain explicit future Owner-package effects.

The content and probe semantics remain unchanged: one fixed inert label, only `/usr/bin/true`, the existing authsvc identity, no RunAtLoad/KeepAlive/schedule/socket/business action, and the fixed `launchctl bootstrap system` invocation. Mere file placement does not register a service. The accepted evidence is explicit domain authorization denial with the label absent before/after; generic nonzero, unreadable/malformed input or unrelated validation error cannot qualify. If the label unexpectedly loads, failure remains recorded and further probes stop; only exact grant-bound cleanup of that proven label is allowed. Availability cleanup cannot promote the failed permission proof to PASS.

No concrete design gap remains in this narrowly frozen correction. Source/package review must check that the actual caller can read the exact validated input, the invocation uses this fixed path, result classification distinguishes permission from I/O/argument failure, and unexpected label state preserves the failure/recovery boundary. The prior same-mutex, fresh service identity, owned-effect journal and no-replay requirements remain. No actual file installation, launchctl call, service registration, privileged action or production mutation was performed by this review.

The separately proposed `Tool::RetiredNode` source change is not covered by this design verdict and will receive source-bound review only after its exact commit is frozen. This note grants no operation authorization or whole-operator/package PASS.
