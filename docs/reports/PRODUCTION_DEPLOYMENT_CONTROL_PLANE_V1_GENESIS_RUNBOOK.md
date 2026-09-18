# Exact disabled genesis installation runbook

This is an execution procedure under accepted
`PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1@39865536ce51005f95a98473e77c2329078512c0`,
CTR-DCP-004/017. It grants no production permission. The implementation task permits
nonproduction tests and package preparation only. Every command below is a future
Owner operation, conditional on a separate explicit authorization of the final
reviewed package, six independent digests, numeric identities and rollback plan.

## Scope and stop boundary

The only installation mode is a fresh, disabled installation. It creates reviewer
UID/GID 612 (`_dcp_review`, nonlogin) and dedicated caller GID 602 (`_agentdeploy`).
The deterministic source builder copies verified Git blobs; it executes no candidate
build script, interpreter or package manager, so no compiler account is created.
Runtime UID 505, W1 and root W2 remain unchanged. Existing service plists and the
complete readable sudoers include tree are observed and compared, never written.

The installer creates six independent role keys only after external authorization;
public keys, protected custody and installation receipts are future outputs.
It imports the exact unsigned deployment-only enrollment as PENDING under the
externally authorized genesis operation. The original business Goal is not closed.
The profile remains disabled. No launchctl command, sudoers write, service start,
existing-task restart, native target enrollment, activation epoch or canary occurs.

The socket directory under `/private/var/run` is deferred until its exceptional
ancestor/group-denial evidence is established in a separate activation procedure.
`service.json` explicitly has `socket_ancestor:null`; no current protected socket
proof, runtime generation or activation readiness is claimed by disabled install.

## Exact package and independent anchors

The package contains only:

- `plan.json`, `package.json`, `review-record`, `initial-registry.json`,
  `supervisor-policy.json`;
- `sources/<declared relative path>`;
- `executables/agent-deployd`, `executables/agent-deploy-issuer`,
  `executables/agent-deploy-bootstrap`, `executables/codex`;
- `support/review-output-schema.json`.

The six command arguments always appear in this order:
`PLAN_SHA PACKAGE_SHA SOURCE_SHA REVIEW_SHA REGISTRY_SHA POLICY_SHA`.
Plan and source-map digests use the Rust canonical JSON digest; the other four
digests hash exact file bytes. The independent reviewer/Owner supplies these
anchors separately; copying them from an unreviewed package does not authenticate
that package. The review record is pinned as opaque evidence. A hash match never
turns arbitrary report text or a `PASS` boolean into review approval.

As the ordinary caller, verify the complete inert package first:

```sh
agent-deploy-bootstrap verify "$PACKAGE" "$PLAN_SHA" "$PACKAGE_SHA" \
  "$SOURCE_SHA" "$REVIEW_SHA" "$REGISTRY_SHA" "$POLICY_SHA"
```

Expected output has `plan_ready:true`, `artifact_integrity_verified:true`, and
`bootstrap_allowed:false`, `activation_allowed:false`,
`protected_poststate_verified:false`, `independent_review_result_verified:false`.
The source/binary review is a separate human/independent evidence gate.

## Owner authorization and first executable trust

Owner mayf3 must review and explicitly authorize exactly this disabled operation.
The external authorization is a JSON `GenesisOwnerGrant`, never signed by a new
genesis key, with `version:1`, `owner:"mayf3"`,
`method:"ExternalExactPackageAuthorization"`, `scope:"DisabledInstallationOnly"`,
the exact six-field `pins`, observed host identifier, a unique single-component
`attempt_id`, and Unix `issued_at`/`expires_at` seconds. Expiry must be later than
execution and at most the plan's `validity_seconds` after issuance (currently
at most one hour). It permits one attempt. Owner installs that exact receipt as
root:wheel 0600 in a strictly protected directory; the installer accepts no
caller-owned authorization file, ACL, symlink, hardlink or writable ancestor.

Before the first root executable starts, the Owner verifies `/usr/local/libexec`
and all ancestors are root-owned, non-caller-writable, have no unexpected ACL or
symlink, and the new `agent-deployd` directory and binary do not already exist.
Unexpected preimages stop the procedure; never overwrite an existing installation.
Use the installed Apple `/usr/bin/install` from the exact reviewed host tool census.
The operator may authenticate one ordinary sudo session; this is not a new sudoers
grant and is not a standing deployment interface.

```sh
sudo /usr/bin/install -d -o root -g wheel -m 0755 /usr/local/libexec/agent-deployd
sudo /usr/bin/install -o root -g wheel -m 0555 \
  "$PACKAGE/executables/agent-deploy-bootstrap" \
  /usr/local/libexec/agent-deployd/agent-deploy-bootstrap
/usr/bin/shasum -a 256 /usr/local/libexec/agent-deployd/agent-deploy-bootstrap
```

Compare that installed readback with the independently reviewed runner digest in
the exact plan **before any root invocation of the new runner**. Hashing runs as
the ordinary caller. The protected destination prevents caller replacement after
readback. A mismatch stops here; do not execute the installed binary.

After installing the externally authorized `AUTH_FILE` root:wheel 0600:

```sh
sudo /usr/local/libexec/agent-deployd/agent-deploy-bootstrap install \
  "$PACKAGE" "$AUTH_FILE" "$PLAN_SHA" "$PACKAGE_SHA" \
  "$SOURCE_SHA" "$REVIEW_SHA" "$REGISTRY_SHA" "$POLICY_SHA"
```

The runner verifies its own fixed installed path/hash, the grant, the complete
package inventory and bounded no-follow reads. It locks the permanent bootstrap
mutex, refuses any prior attempt, verifies absent new paths and local/search
identity collisions, records read-only preflight, then durably journals intent
before each fixed step and result after readback. Apple dscl/dseditgroup binaries
must match the package's tool digests and protected metadata. Commands have fixed
operation arguments and a cleared environment. No caller executable is run as root.

Success is `INSTALLED_DISABLED_PENDING_OWNER_LOGIN`; runtime enrollment and
activation remain false. Preserve the protected attempt directory under
`/private/var/db/agent-deploy-bootstrap/<attempt_id>/` and all receipts.

## Reviewer account login

Owner performs the separate visible device-login action using the same exact pins
and a still-valid external grant. A renewed grant may retain the same attempt and
pins when the initial validity window elapsed; it cannot change the installed
package. This action does not copy an existing account's credentials.

```sh
sudo /usr/local/libexec/agent-deployd/agent-deploy-bootstrap reviewer-login \
  "$PACKAGE" "$AUTH_FILE" "$PLAN_SHA" "$PACKAGE_SHA" \
  "$SOURCE_SHA" "$REVIEW_SHA" "$REGISTRY_SHA" "$POLICY_SHA"
```

The protected runner records login intent, starts a fresh fixed helper process,
rechecks authorization/install state, drops supplementary groups/GID/UID to 612,
and execs only the pinned Codex binary's `login --device-auth` command. HOME and
CODEX_HOME are the isolated 612-owned 0700 `/private/var/db/agent-deploy-review`.
Owner completes the visible device flow with the intended account. Login command
completion receives a separate protected receipt and does not activate deployment.
A timeout/failure stays unknown and is not retried automatically.

## Abort, reconciliation and bounded rollback

Stop for expired/mismatched authorization, any pin or source drift, an occupied
identity/path, incomplete census, unsafe metadata, unexpected prior journal or
any failing step. The first unpaired intent remains an unknown outcome. Do not
rerun with another attempt ID, delete locks/journals/users, regenerate keys, or
infer that a failed command had no effect. Retain durable evidence and reconcile
the exact step before issuing any new operation.

The narrow rollback command requires the same package, a current external grant
with the original attempt/pins, and no activation markers:

```sh
sudo /usr/local/libexec/agent-deployd/agent-deploy-bootstrap rollback \
  "$PACKAGE" "$AUTH_FILE" "$PLAN_SHA" "$PACKAGE_SHA" \
  "$SOURCE_SHA" "$REVIEW_SHA" "$REGISTRY_SHA" "$POLICY_SHA"
```

It removes only new nonsecret executable/schema/plist files recorded in completed
step results whose protected current hashes match the receipt. The preinstalled
bootstrap runner, keys, registry, service configuration, identities, directories,
locks and journals remain protected. Files from an unpaired intent are never
guessed or automatically deleted. The receipt explicitly says reconciliation is
still required. This is not a claim of full restoration or permission to resume.

## Verification limits

Nonproduction evidence exercises the shared transaction engine in the kernel's
private temporary directory, authorization rejection, source/package rehashing,
symlink/hardlink/writable-file rejection, identity-collision parsing, partial-step
quarantine and exact-hash nonsecret rollback. It executes zero native commands.
No production keys, dscl writes, installed poststate, reviewer login or root
identity isolation was exercised during implementation. Those remain future
Owner-authorized operations with actual receipts and independent readback.
