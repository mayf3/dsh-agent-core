# Actual issuer/producer integration gap — not a Spec acceptance gap

Owner acceptance at3986553 remains sufficient for implementation. This observation
does not reopen Product Authority or request production permission.

The bounded repository census found no existing build/review signature or
DEPLOYMENT_READY producer adapters outside the new crate. That is not evidence
that no external service exists. The controller asked for existing configuration
locations or public-key information; no answer has arrived as of this checkpoint.
Never request or print private signing keys.

Task4 implementer checkpoint: generic protected mailbox ingestion from Task3 is
implemented and tested. Actual external service-to-mailbox authentication bridges
have not been implemented because endpoint, protocol, authentication, key custody
and producer source bindings are unknown. Merely filling trusted key IDs does not
close that integration. This affects both a concrete production manifest and the
actual integration code, not the already accepted implementation mandate.

Required next information is the existing service/producer contract and its public
trust/custody coordinates, or an explicit statement that no such integration
exists. Then implementation can use that actual contract within accepted CTR001
and CTR004. Do not choose fixture identities, translate task titles into readiness,
or treat an Agent-authored PASS file as an independent authenticated observation.

Continue all independent source, artifact preparation, negative tests and review.
Until resolved, conformance must report the missing adapter/authority dependency
precisely; it cannot claim operational bootstrap readiness or whole Goal closure.
No production mutation or bootstrap is authorized by supplying configuration.
