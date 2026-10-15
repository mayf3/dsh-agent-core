# Website Human inquiry: supported resident startup source

This is an implementation/operator reference under accepted `WEBSITE_HUMAN_WORKFLOW_INQUIRY_V1` CTR-WHI-001/002/006/008/012. It grants no configuration, credential, Grant, installation, loading, publication or enablement authority. Actual configuration values and deployed state remain **UNOBSERVED / UNPROVISIONED**. The earlier programmatic `composeProductionRuntime({websiteInquiry: ...})` option alone was not a supported resident startup path.

The existing `scripts/production-runtime.mjs` → `runProductionRuntime` entry now accepts two explicit arguments:

- `--website-inquiry-enabled true` enables configuration loading only when paired with exactly one `--website-inquiry-config <absolute path>`.
- Omitted enable flag or exactly `--website-inquiry-enabled false` leaves the feature OFF and ignores the configuration path without website filesystem, key, credential or network I/O.
- Missing, duplicated, malformed or nonliteral enable/path arguments fail closed for the website routes. There is no `WEBSITE_INQUIRY_ENABLE` environment-variable implementation, environment JSON, alternative daemon or sender.

Changing supervised launch arguments and installing approved files are future separately authorized operations. The launchd generator is unchanged; this source change does not rewrite an installed plist or enable a service. Existing services retain their original startup/lifecycle. Invalid website configuration mounts a disabled website handler returning `503 NOT_PROVISIONED`, with no raw file path, JSON parser error, registry or key in the response/log. A corrected initially-invalid configuration requires a controlled resident restart to mount; no watcher or second timer exists.

## Trusted file schema

The configuration is UTF-8 JSON, at most 65,536 bytes, with no duplicate/unknown fields. Its exact top-level fields are:

| Field | Supported value |
| --- | --- |
| `schema_version` | integer `1` |
| `enabled` | boolean `true` |
| `storeFile` | normalized absolute SQLite request-store filename in the configuration file's own directory |
| `cursorKeyFile` | normalized absolute filename in that same directory; exactly 32 binary bytes, independently provisioned under later approval |
| `jwksUrl` | approved canonical HTTPS URL ending `/.well-known/jwks.json`, without credentials/query/fragment; no host is guessed |
| `registry` | exactly one pilot entry with the accepted CTR-WHI-001 closed registry shape |

Configuration/key files must be regular, non-symlink, single-link files owned by the resident UID, mode `0600`. Their immediate parent must be a non-symlink directory owned by that UID, mode `0700`. Reads use `O_NOFOLLOW`, validate the opened descriptor, enforce byte limits and reject changes during the read. Existing store files require the same private ownership/mode/type checks. Config, key and store filenames must differ. The loader creates no config, directory or key; SQLite creates its store only after successful enabled configuration validation. The cursor key is not an Auth credential and does not confer application permission.

The registry retains exactly the accepted keys: `binding_id, version, enabled, site_project_id, site_owner_id, issuer, auth_subject, human_principal_id, communication_scope_id, pilot_surface, allowed_operations, transport_client_id, transport_principal_id, exact_web_origin`. The pilot surface has only `channel, external_id, expected_agent_id`; Mobile/Feishu reuse is rejected. Identity UUIDs, exact HTTPS origin, supported operations and enabled flags are validated. These fields remain operator-owned facts requiring independent lawful verification; no identity/Grant/Binding is created by parsing them.

## Revocation, identity and restart behavior

Every service access rereads the current private configuration and key. Disabling the registry entry or removing `own_read` denies the next own-read, including previously saved bodies. Remove `preauthorize` to stop new authorization/redemption while retaining independently allowed own-result/event reads and original in-flight settlement. Auth service credential/Grant verification remains fresh for every private HTTP request.

The initial store path, key reference/bytes and JWKS URL are pinned for that resident. Drift fails closed instead of silently changing storage, signing cursors or trust roots. Registry versions/permissions may change, but the existing durable identity check rejects scope/Owner binding remapping rather than creating a new namespace for old RIDs. Storage, key or trust-root changes require their own reviewed migration/restart operation; restarting is not a way to authorize remapping old records.

## Source evidence

The new test invokes the actual `runProductionRuntime` argument/config boundary and real website runtime mount. It substitutes only the unrelated existing service graph, avoiding a daemon, model process, production store or external Auth request. Its initial meaningful RED was the missing mounted service despite enabled original-entry arguments. GREEN covers actual SQLite creation in a temporary private directory, zero website I/O when OFF, safe failure with the old resident lifecycle intact, bad/missing/symlink/permission/size/config inputs, current saved-result read revocation, stable scope identity and pinned-config drift. Existing composition/native/Auth/Router regressions remain separate checks. This is source evidence, not installed or enabled-runtime proof.
