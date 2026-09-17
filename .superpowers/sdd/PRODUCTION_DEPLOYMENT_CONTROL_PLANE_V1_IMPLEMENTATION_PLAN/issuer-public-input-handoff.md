# Public integration inputs needed for real issuer bridges

This is a request for existing integration facts, not new Spec acceptance or
production permission. Bounded repository census is in issuer-integration-census.md.
No private key, token, cookie, raw credential or Secret value should be supplied.

For an existing service, give its configuration/documentation/repository location
and public contract. Needed dimensions are:

- Role: Authority, Builder, Reviewer, Producer, Verifier or Recovery, matching the
  current typed model. One service may expose more than one role only if accepted
  independence/custody constraints are actually established.
- Stable issuer/service identity, public Ed25519 key and allowed scopes; where
  custody and caller isolation are enforced (a location/reference, no private key).
- Actual endpoint or local protected publication interface, protocol/version and
  authentication mechanism; refer to credential storage, do not paste credentials.
- Producer's authoritative DEPLOYMENT_READY source, Goal/revision CAS and exhaustive
  pagination/watermark contract. Task titles or claimed PASS strings are not inputs.
- Build/review/acceptance exact source, tree, artifact, manifest/profile, recipe,
  toolchain and dependency-closure attestations; independently attributable authors.
- Verifier result/receipt identity and correlation, deadlines and non-idempotent
  unknown handling; Goal closure acknowledgment/CAS interface.

The implementation has signed record schemas and protected mailbox transport;
these facts are still required to implement the real upstream authentication
bridges. If no such existing service is established, an explicit statement of
that fact is useful; do not fill the gap with fixture keys or Agent-authored PASS.

Source-coordinate references for these field categories (not a new contract):
model.rs Role/TrustedKey/ReadyRecord/ProducerSnapshot/BuildAttestation/Review;
service/intake.rs Configuration/VerifierBinding. Review HEADc5cab2e.
The controller continues source security repair independently of these inputs.
