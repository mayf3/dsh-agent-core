# Disabled genesis attempt — 2026-09-18

This records actual execution under mayf3's explicit exact package/plan authorization.
It does not replace the accepted Spec or authorize another privileged attempt.

```text
GOAL = PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1
ACCEPTED_SPEC = 39865536ce51005f95a98473e77c2329078512c0
EXECUTABLE_SOURCE = 65559ddb9d414d248f640f46216bd62e8068983d
DELIVERY_AT_EXECUTION = eb7e72f2bc75c8842492b2b90cac31263dd583ea
PACKAGE_SHA256 = fe3d6711df190b76de32cabf3607b6de12f575803f213d6603ee1eb264c5b065
PLAN_SHA256 = 7c516b2f349226b258e5289cd5c8ac3e9c879ae19d9ecf5d0c284698598895ab
ATTEMPT_ID = genesis-65559dd-20260918-01
RESULT = STOPPED_DURING_PREFLIGHT
BOOTSTRAP_SYSTEM_WRITES_PERFORMED = YES_PARTIAL_SETUP
INSTALLATION_COMPLETE = NO
REVIEWER_LOGIN_PERFORMED = NO
PRODUCTION_SERVICE_MUTATION_PERFORMED = NO
REAL_DEPLOYMENT_PERFORMED = NO
ACTIVATION_PERFORMED = NO
PARENT_GOAL_COMPLETE = NO
```

## Authorization and fresh verification

The Owner explicitly authorized one disabled installation, dedicated reviewer login,
and reviewed verification/recovery, bound to all six pins, host and identities.
Before execution, both operator and independent reviewer rehashed the six pins,
152 exact Git source files, four executable images and fixed support file. Host
343ecc65a7edc224c7b235c9bdbcc964ef5e81475734dc97bb1fa057e2959024 matched.
New identity names/numbers and destinations were absent. Existing nonroot-readable
ancestor metadata and Apple entry-tool hashes matched. Root-only service/sudoers
content census remained the native installer's declared preflight gate.

A nonroot operator translation was independently checked before execution. Local
Terminal presented administrator authentication. The driver installed only the
exact bootstrap runner and external grant, hashed the protected runner as the
ordinary caller, then invoked the reviewed installed runner once with literal
pins. Original operator-driver SHA256:
6f413acb3e8f3277130f460b7f7c728c0b1716f01cedd28cf38c8500a9cfc6ae.
The install command returned exit1 and `UNSAFE_FLAGS`; the driver stopped before
reviewer-login. No command was retried with the same or another attempt ID.

## Actual retained system state

- `/usr/local/libexec/agent-deployd/agent-deploy-bootstrap`: root:wheel0555,
  one link, flags0, SHA256
  2a8550ac3ffde4ccd21d501d7869608628bacd8ccb4feaab44aeb1803546d301.
- `/private/var/db/genesis-65559dd-20260918-01.authorization.json`:
  root:wheel0600, one link, flags0; exact grant SHA256
  dc416250cf805465ab50de917ac1f59323a6096b2f0745600d40a374ded3a37e.
- `/private/var/db/agent-deploy-bootstrap`: root:wheel0700, containing only
  `bootstrap.lock`. Lock is root:wheel0600, single-link, empty, flags0.
- No attempt subdirectory or InstallStep intent/result exists. No deployment state,
  role keys, registry, service config, controller plist, reviewer HOME/workspace,
  `_dcp_review` UID/GID612 or `_agentdeploy` GID602 was created.
- No reviewer login, credential creation, daemon enable/start, target enrollment,
  socket creation, old entry retirement, existing-service restart or sudoers write.

No rollback was invoked. The reviewed rollback requires an attempt journal and
removes only recorded completed-step nonsecret payloads; neither exists here.
The retained runner/grant/directory/lock are known setup, not evidence that a
transaction step ran or that an unknown step can be replayed. They remain intact.

## Root cause and independent conclusion

Protected diagnostics used fixed read-only Apple commands after local administrator
authentication. They confirmed the lock above and showed `/private/etc/sudoers`
is root:wheel0440, single-link, with `UF_COMPRESSED`32. Its mtime1786589515 and
ctime1788023518 predate this operation. Kernel-readable logical bytes hash to
65a09ed9f0e681000606b97797398241f482e4318acccd77b50f673f02e3f10f.
`visudo -c` parsed this file and its two includes successfully.

Frozen source: `sudoers_census → io::read → file::snapshot → secure::validate`
requires file flags exactly0. It therefore rejects a safe compressed existing
configuration file using an artifact-only metadata rule. The earlier lock and
platform-tool validations do not explain this rejection: lock flags0 and the two
Apple tools' flags0x80020 satisfy their respective checks.

Independent reviewer `dcp_binding_authority_review` confirmed the root cause and
safe preflight stop from frozen source, fresh public metadata and attributed
protected diagnostic. The original error has no path/phase; localization is the
combined evidence, not a claim that the error itself named sudoers. The diagnostic
record is an attributed transcription from actual tool output, not a signed receipt.

## Existing task/service observations

All17 selected pre-existing process observations retained the same PID, UID,
start time and executable at the poststate check; this includes the two UID505 Node
processes. Two additional UID502 Node processes appeared at10:00; their cause is
not attributed to bootstrap. Process metadata is not health/E2E acceptance.

The17 existing system plists have retained poststate hashes. The complete root
preimage census was not durably recorded because preflight stopped; no full
before/after plist equality claim is made. Frozen execution flow and absent native
steps prove no service mutation command was reached. Sudoers timestamps and source
flow support no sudoers write; content hash alone is not a fabricated preimage.

## Continued nonproduction work

The Owner's standing nonproduction mandate covers a narrow census-only repair,
real compressed-file regression plus rejecting counterexamples, full validation,
and fresh independent affected-surface review. Generic artifact/grant/key validators
must remain strict; do not decompress, clear flags or otherwise modify live sudoers.

The original package and privileged prefix remain pinned. Any corrected executable
has a new package identity and cannot inherit this exact-package authorization.
Prepare one complete reconciliation request tied to the same original attempt,
old protected runner/grant/lock preimages, corrected package, disabled install and
reviewer login; execute nothing from it before explicit Owner authorization.

Evidence: [operation index](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_CENSUS_REPAIR/operation-evidence-index.json).
Raw operation directory:
`/Users/yanfenma/workspace/artifacts/production-deployment-control-plane-v1/genesis-65559dd-20260918-01`.
