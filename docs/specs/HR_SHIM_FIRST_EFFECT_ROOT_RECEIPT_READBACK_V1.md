---
spec_id: HR_SHIM_FIRST_EFFECT_ROOT_RECEIPT_READBACK_V1
status: accepted
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
scope:
  - one fixed read-only root journal status for shim-hr-admin-fresh-20260928-v1
governed_by:
  - HR_S256_ADMIN_EMERGENCY_RECOVERY_V1
  - PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1
external_authorities: []
supersedes: []
superseded_by: null
owners:
  - mayf3
---

# Fixed first-effect root receipt readback

## Goal

Give the already authenticated Owner caller one bounded status and digest from
the root journal of `shim-hr-admin-fresh-20260928-v1`, so the cancelled native
OS request can be reconciled before any further decision. This contract permits
nonproduction implementation and review. It does not
authorize installation, protected host reading, the old operation's replay, or
the later HR cut.

## Scope and non-goals

The sole subject is the first shim bootstrap attempt above. The fixed DS
socket request is exactly `{"action":"HR_SHIM_FIRST_EFFECT_RECEIPT_STATUS_V1"}`:
there is no operation ID, path, Agent, PID, mode, file selector, credential,
payload, or arbitrary identifier in the request. The response has only
`status` and `recordSha256` (plus transport `ok`); no journal bytes, message,
credential, pathname, Agent identity, PID, arbitrary error detail, or host
inventory is returned. The reader creates no journal, receipt, lock, service
restart, fence change, or new recovery route.

## Authority and dependencies

`HR_S256_ADMIN_EMERGENCY_RECOVERY_V1` AER-C04/C06 preserves the old HR UNKNOWN
and forbids replay; it does not define this protected read interface.
`PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1` CTR-DCP-007/008/011/017 requires
peer authentication, fixed privileged profiles, readback-driven unknown
handling, and separate bootstrap authority.
This new independent decision neither changes those authorities nor activates
the unbootstrapped `agent-deployd`. The repository's accepted development
grammar requires a docs-first route for a new controlled permission surface.

## Current State

At repository base `fbd2e399acc44ec574b82a2edb979be6364effac` and the
2026-09-29 local read of installed DS/shim source, both daemons expose `STATUS`,
but neither action reads this fixed bootstrap journal. The installed shim's
source SHA-256 is `5661fbd0c7fde5139b10cb1adf9546a1ce507e413d89177b821ddd683146d7f8`;
the installed DS source SHA-256 is
`daeb44fc0c23a7a2949519a5d6abcc9459e38936e10bc704d85b25794f7a74d6`.
The installed shim's
`FIXED_DS_SCRIPT_UPDATE_V1` accepts only three compiled P0
`(operation_id, preimage, candidate)` tuples; a new reader cannot use that
action without first changing the shim. Installed DS `DS_UPDATE` changes the
live DS script through a separate root mutation and restart; its existence is
not authority to perform it during an unresolved attempt. The older shim
`INSTALL_DEPLOYMENT_SYSTEM` and `SERVICE_UPDATE` routes do not provide this
first-effect transaction's combined lock and durable intent guarantees and
cannot serve as an implicit repair path.

## Observations

- `OBS-RB-001`: `HR-ADMIN-FIRST-EFFECT-EXECUTION-20260929-v1/OS_REQUEST_RESULT.json`
  records return code 1 and `OS_REQUEST_EXITED_RECONCILE_ROOT_RECEIPT` for the
  fixed ID; stderr records macOS `-128` (user cancelled). This is an OS request
  result, not a root transaction terminal receipt.
- `OBS-RB-002`: the launched packet's manifest SHA-256 is
  `2c5fcc99c15b49f3c9101200457b3efef1a569176be191056e1242ecfb38f12e`.
  Its bound v3 `installer.py` and `fixed_host.py` name the journal parent
  `/private/var/db/agent-deploy-bootstrap` and directory
  `hr-shim-shim-hr-admin-fresh-20260928-v1`. `intent()` creates that directory
  and writes `intent.json` before `capture()` creates `rollback.py`; a crash
  between directory creation and intent write can leave an empty consumed
  directory. It writes `committed.json` after loaded-shim readback. The bound
  `admin_fresh_shim_hook.py` validates the exact seven-field intent and
  ten-field commit schemas.
- `OBS-RB-003`: installed DS `handle` exposes `STATUS` and `DS_UPDATE`; installed
  shim `handle` exposes `STATUS`, `SERVICE_UPDATE`, and the fixed DS script
  update. Neither installed allowlist exposes a fixed read of the bootstrap
  journal. These are source observations, not claims that a past child exited.

## Claims and assumptions

- `CLM-RB-001` (`SUPPORTED` by `OBS-RB-001/002`): OS cancellation and an
  unchanged installed shim alone do not establish whether durable root intent
  was ever written. The original attempt remains UNKNOWN until authorized
  protected readback distinguishes its journal records.
- `CLM-RB-002` (`SUPPORTED` by `OBS-RB-003`): installing this new DS action
  before obtaining the old operation's root state would be a second privileged
  mutation and could create the same reconciliation dependency. No installed
  action is a present callable substitute for the proposed reader.

## Evidence relations

- `EVD-RB-001`: `OBS-RB-001` is the exact OS request outcome for
  `shim-hr-admin-fresh-20260928-v1`; it supports an UNKNOWN classification
  only, with no inference of no effect or success.
- `EVD-RB-002`: `OBS-RB-002/003` and the installed source allowlists support
  the fixed journal path and missing-call-path claim at the stated source and
  host coordinates. They do not verify protected journal contents.

## Decisions

- `DEC-RB-001`: provide one fixed no-parameter DS action for read-only
  reconciliation of this operation alone.
- `DEC-RB-002`: return only a coarse journal state and SHA-256 of the verified
  selected root record. A status is evidence of that record at read time; it
  does not settle HR business effects or grant a retry.

## Contracts

**CTR-RB-001 — Caller and request.** The root DS server MUST obtain actual
socket peer credentials with `getpeereid`; only its existing frozen Owner UID
502 may invoke the exact action, even though the general socket also admits
root. A supplied UID, process label,
request extension, alternate socket, or `STATUS` response is not authority.
Peer failure and any unexpected field fail closed before protected I/O. The
action MUST be disabled by default in an unbound/non-installed candidate.

**CTR-RB-002 — Fixed no-follow custody.** The reader MUST use only
`/private/var/db/agent-deploy-bootstrap/hr-shim-shim-hr-admin-fresh-20260928-v1/intent.json`
and the sibling `committed.json`. It MUST traverse the exact root-owned parent
chain by directory descriptors with `O_NOFOLLOW`, require the bootstrap parent
and operation directory to be root-owned, non-group/world-writable (operation
directory 0700), and open files relative to the held directory with
`O_NOFOLLOW`. Each present record MUST be root-owned regular, single-link,
mode 0600, bounded to 4096 bytes, and stable across descriptor, name, and
parent identity checks before and after a complete read. A missing component
is distinguished from an inaccessible, symlinked, malformed, or changed one.
The reader MUST NOT create a directory, file, or lock, and MUST NOT acquire a
mutation lock or wait for the original transaction to finish.

**CTR-RB-003 — Truthful classification.** The response schema is exactly
`{"ok":true,"status":S,"recordSha256":H}` where `H` is a lowercase
64-character SHA-256 or `null`. `S` is one of:

| Status | Required protected observation | Digest source |
|---|---|---|
| `NO_DURABLE_INTENT_OBSERVED` | Valid fixed parent custody and operation directory absent | `null` |
| `INTENT_PRESENT_UNKNOWN` | Exact valid seven-field `intent.json`, no `committed.json` | exact intent bytes |
| `COMMITTED_RECEIPT_PRESENT` | Exact valid seven-field intent and ten-field `committed.json`, with all shared fields equal | exact committed bytes |
| `UNKNOWN` | Operation directory present without valid intent, or any custody, read, parse, identity, ordering, or consistency ambiguity | `null` |

The intent MUST be a JSON object with exactly `operationId`, `state`,
`hostId`, `oldSha256`, `newSha256`, `oldMetadata`, and `oldDsPid`. The commit
MUST contain exactly those seven keys plus `oldPid`, `newPid`, and
`lockNames`. Both records MUST bind operation ID
`shim-hr-admin-fresh-20260928-v1`, host ID
`FF99ABD5-79A0-5EE0-9E0B-B62671271560`, old shim SHA-256
`5661fbd0c7fde5139b10cb1adf9546a1ce507e413d89177b821ddd683146d7f8`,
and new shim SHA-256
`53b149bf6e4ca9b99d1946955af4093547ed3a41b6d8d8f5afb8fd4a640b5f80`.
`oldMetadata` MUST equal `{"uid":0,"gid":0,"mode":365,"flags":0,"acl":"absent","xattrs":[]}`
(`mode` 365 is 0555). `oldDsPid` MUST be a positive exact integer. The
intent state MUST be `UNKNOWN`; the commit state MUST be `COMMITTED`, and
every other shared field MUST equal the intent. `oldPid` MUST be the launched
plan's 41153; `newPid` MUST be a positive exact integer different from
`oldPid`. `lockNames` MUST have exactly `ds` and `shim`, each a two-element
list of positive exact integers. Booleans do not count as integers. An
incomplete, extra-field, or mismatched record pair, commit-only record,
unsupported transaction record, or race yields `UNKNOWN`.

The original installer creates the operation directory immediately before
intent write; the directory alone consumes this operation ID. An empty
directory therefore yields `UNKNOWN`. A `rollback.py` without a valid intent
is inconsistent with the launched writer order and also yields `UNKNOWN`.
A verified absent directory means only that no durable intent was observed
at this read coordinate; it does not prove the native OS process never
started, authorize the operation's replay, or settle any other effect. A
committed receipt reports its presence, not current service or HR recovery.

**CTR-RB-004 — No authority from readback.** Every result, including
`NO_DURABLE_INTENT_OBSERVED`, retains the old HR UNKNOWN and
`replayAllowed=false` semantics outside the response. No status
authorizes a retry of `shim-hr-admin-fresh-20260928-v1`, a fresh operation ID,
installation, fence clearing, session deletion, or admission of an HR request.
The caller records the digest and fixed read coordinate for independent
review; the reader does not copy root bytes to an Owner-writable location.

**CTR-RB-005 — Installation boundary.** Nonproduction code and tests may be
prepared after this Spec is accepted in the applicable base. Installing the
reader into live DS via `DS_UPDATE`, or modifying the shim to admit a new fixed
pair, requires a distinct reviewed exact change, fresh root/lock/child-state
preflight, compatible rollback, and attributable Owner-controlled operation
authority. The unresolved first-effect operation MUST NOT be replayed or used
as the reader installer. The new installation MUST NOT be claimed as a way to
prove its own premutation safety. If existing authorized `STATUS`/fixed
receipt channels cannot expose this journal, the minimum remaining external
boundary is an independently authorized fixed read of these exact protected
records; until then the old attempt stays UNKNOWN.

## Acceptance

| Case | Contracts | Method and environment | Required evidence and expected result / failure condition |
|---|---|---|---|
| `ACC-RB-001` | 001,002 | Disposable DS socket and root-journal fixture; kernel-peer seam | Only actual UID 502 and exact action reach protected read; root peer, wrong peer, extra field or failed `getpeereid` do not. |
| `ACC-RB-002` | 002,003 | Disposable no-follow fixture with absent directory, empty consumed directory, inconsistent rollback-only directory, intent-only, paired commit, symlink, hardlink, ownership/mode, malformed, and rename-race cases | Only absent operation directory yields `NO_DURABLE_INTENT_OBSERVED`; empty/rollback-only directory and each ambiguous case yield `UNKNOWN` with null digest and zero writes. |
| `ACC-RB-003` | 003,004 | Fixed packet intent/commit fixtures and response inspection | Missing or extra keys, wrong host/metadata/PID/lockNames type, pair disagreement, old/new digest or ID mismatch cannot report commit; output has only allowed fields and no outcome/replay/fence inference. |
| `ACC-RB-004` | 005 | Source and install-path review against installed allowlists | Existing `STATUS`, three hardcoded fixed DS update pairs, and `DS_UPDATE` do not count as installed readback; no installer or original operation runs in acceptance tests. |

## Alternatives and disposition

Generic path/receipt lookup and expansion of `STATUS` are rejected because
they expose a broader protected surface. Reusing the pending shim bootstrap
to install its own reader is rejected because the original operation has no
trusted terminal readback. A separately authorized fixed root OS read remains
an operational alternative if an existing bounded channel can perform it.

## Migration, compatibility, and rollback

This is an additive fixed action in a future DS candidate; existing request
schemas and receipts remain unchanged. A nonproduction candidate is inert by
default. Any live adoption has a separate controlled rollback and readback
plan; rolling back the reader cannot erase the original journal, receipt,
lock, logs, or UNKNOWN state. This Spec creates no automatic migration.

## Acceptance scope

The independent semantic review verified this fixed DS read surface and the
launched packet's record schema. The delegated maintainer's acceptance is
recorded with the exact merge commit in the governing PR. This acceptance is
limited to nonproduction implementation and review. No product installation,
live protected read, or old-operation replay is authorized by this Spec.
