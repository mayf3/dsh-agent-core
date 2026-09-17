# Bootstrap preparation constraints — not authorization

Owner accepted implementation and non-production verification only. First root
copy, key provisioning, daemon activation, enrollment and legacy permission changes
remain forbidden in this task. Prepare a concrete inert package for later review.

## Bootstrap executable and trust boundary

First privileged execution must not run a caller-writable script or binary based
on an earlier pathname hash. A reviewable operation can stage the exact native
binary into a newly created protected root-owned location with fixed platform
utilities, reverify its protected bytes against the reviewed digest, then execute
only that protected binary. Exact steps, numeric identities and rollback require
independent review and subsequent Owner authorization. No package manager or
candidate-provided interpreter/hook runs as root.

Include the native executable's complete loader/dependency closure and canonical
macOS path aliases. Readback must distinguish a copied artifact from authority to
execute it. No private signing key belongs in a public bundle. Proposed future key
provisioning must identify isolated issuer roles, protected custody, source bindings,
public-key receipts and activation checks. Agent-owned fixture keys cannot become
production trust. Existing issuer integration facts are still unresolved; see
issuer-integration-census.md and the controller's pending information request.

## Host observations and identities

All observations below are time-bound preparation, not a protected transaction
preimage. Later live samples already differed from the original census through
unrelated activity. Re-pin during a future authorized bootstrap; do not claim
production globally remained unchanged during this source task.

- bootstrap-host-inventory.json and platform-boundaries.json record selected
  paths, service definitions and macOS directory metadata.
- launchd-readback-shape.json records sanitized selected runtime fields.
- prospective-caller-group.json: at 2026-09-17 14:27 UTC, Directory Services had
  neither group `_agentdeploy` nor GID 602. Task 4 may propose this new group in
  the exact bootstrap manifest, with collision recheck before authorized creation.
  No group or membership was changed. Do not substitute staff, or assume existing
  processes immediately acquire a newly provisioned supplementary group.
- native-runtime-closure-observation.json: at 14:47 UTC, authsvc was UID 505 /
  primary GID 601. Node entry, W2 script and the three plist metadata/hashes were
  recorded without printing configuration values.
- bootstrap-platform-tools.json records read-only system utility hashes/metadata;
  it is neither a selected operation sequence nor executed bootstrap evidence.

Current `gui/502/com.svc-workflow` stays ineligible until separately accepted
identity/domain separation is implemented and verified. External auth-service
adoption authority must not be invented. Explicitly disabled target adoption does
not waive missing functionality in a profile claimed to be ready.

## Existing app layout

At 14:24 UTC, runtime-app-metadata-capacity.json recorded 1,130 regular files,
43,574,106 regular-file bytes, 254 directories and 22 symlinks. Largest regular
file: 17,662,909 bytes. runtime-app-links.json lists the links. This metadata census
read no file content and changed no production state. It is not a release manifest.
Do not relax no-link artifact intake to mirror the existing tree. Exact proposed
app slots, unchanged loader closure and permission/lifecycle retirement need review.

## Concrete Node loader closure gate

native-node-loader-closure.json records direct Mach-O load commands from the
52,160-byte protected Node entry, SHA-256:
`c6c9bfa8eb5d0c6799e1fd7e246f5c6036d4863b5d3173625f37d952576ca93b`.
It references 18 `/usr/local/opt` dependencies plus `@rpath/libnode.141.dylib`.
native-node-loader-ancestors.json confirms the representative `/usr/local/opt/libuv`
path has caller-502-writable ancestors/symlink, flags 0. The leaf's 0404 mode does
not prevent path replacement. native-loader-env-classification.json found no
DYLD_/LD_ keys in the three selected plists; no raw environment values were printed.
These are static loader/filesystem observations, not a claim about exact libraries
currently mapped in production. No exploit or write probe was executed.

Current native dependencies() hashes only Node and plists. It cannot alone prove
the accepted complete privileged closure. Task 4 must enforce complete loader
closure safety/hash binding for prospective enrolled profiles, prepare actual
protected closure bytes, or retain an explicit readiness blocker. Do not claim an
operationally ready profile from the launcher hash or from disabling every profile.
Do not recursively chown Homebrew or mutate live Node/plists during preparation.

native-runtime-lib-inventory.json shows the existing protected lib directory has
only root:wheel 0444 libnode.141.dylib (67,194,056 bytes), not the 18 direct Homebrew
dependencies. This is slightly above the app-artifact 64 MiB file cap. Bootstrap
closure preparation needs separate explicit finite bounds; do not widen app or
socket limits indiscriminately. Read-only `/usr/bin/file` identifies Node and
libnode as Mach-O 64-bit x86_64. Preserve the observed ABI/architecture; do not
introduce an incidental ARM64 or Node-version migration.
