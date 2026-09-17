# Production deployment control plane — fresh census

Date: 2026-09-17. Evidence authority only; this document grants no implementation,
deployment, process termination, identity, Grant, or business-data authority.

## Coordinates and method

- Canonical repository: `mayf3/dsh-agent-core`; fetched `origin/main` =
  `d602b592fad345fb1c9adebe2bc6611a6f5cfdc2`.
- Shared checkout = `e9699aee6beb1d6811e3a77f0cb4c08088241348`, dirty; preserved.
- Isolated authoring branch: `codex/production-deployment-control-plane-v1`.
- Read-only receipt: [census JSON](../reports/production-deployment-control-plane-v1-census-20260917.json),
  SHA256 `8b91ad8c91cb2f206fa34e99c95ec4737731c783bc0789c21347ad2e1f2f5fc6`.
- Method: read source, hashes, selected plist fields, and selected `launchctl print`
  fields as uid 502. No sudo, writes to production, restart, messages, database
  queries, credentials, private payloads, or full process environments.
- Local external repo coordinates: auth-service `785d7430fd0b6b9dd3aa7c110ed857fed9fea865`;
  svc-workflow `88ff8145eb0842b4ce759117caf4b05f9012ebdc`. These are checkout
  observations, not freshly fetched canonical lineage or proof of installed bytes.

## Observations

### OBS-DCP-001 — existing authority does not authorize the new daemon

At the canonical base, `.agents/README.md` is grammar 1.0.3; local governance
requires `NEW + CONTROLLED` to remain docs-first until acceptance in base.
`AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1` is superseded, although the shared checkout's
old bootstrap still references it. The active governance adoption and local rules
apply in the new worktree. No `agent-deployd`, DeploymentUnit, Train, or standing
deployment authority Spec exists at this base.

`PRODUCTION_STAGE_ISOLATION_AND_ARTIFACT_INTEGRITY_V1` has an accepted-looking
copy in the shared branch, last touching revision `569720870781efdc15e36d71c8728fb29b8dc2bd`.
The file is absent from canonical main, and that revision is not its ancestor.
Its one-Goal generation model is useful historical design evidence, not current
implementation authority. Do not transplant its acceptance status or claim a
partial supersession. If it enters main later, re-PREFLIGHT the overlap.

Active relevant authorities include accepted Watchdog routing/recovery, Scheduler
production reconciliation, Session Send standalone and V2 deployment, Lark UX V3,
canonical offline pnpm resolution, and the hardening Program. The hardening Program
has `implementation_authority: none`. Existing exact-release mandates are not
transferable standing authorization for new releases or new privileges.

### OBS-DCP-002 — locks do not have one authority

| Observed source | Lock identity / behavior |
|---|---|
| `scripts/trusted-cp-deploy-install.sh:48` | `/usr/local/var/agent-core/production-mutation-locks/production-deploy.lock`; mkdir; environment override |
| `deployment-artifacts/scheduler-watchdog-routing-v1/run-routing-install.mjs:28` | Same default path; environment override; inherited-holder string check |
| `deployment-artifacts/scheduler-watchdog-routing-v1/run-authorized-transaction.sh:65` | Same default plus `scheduler-watchdog-routing-tx.lock` |
| external `operator-scripts/scheduler-watchdog-production-phase2-d602b59-sudo.sh:50` | `/var/db/agent-core/production-transaction.lock`; checks `/var/db/agent-core/deployments/transaction.lock` |
| external Session Trace root transaction `:31,:531` | `/var/run/agent-core-production-mutation.lock`; flock |
| external HR delivery shell | No `flock`/named transaction lock found in the inspected source; it mutates both auth and dsh |

These are different objects. Sharing a name such as “global” does not serialize
them. Absence of a lock in one inspected script is not a whole-host bypass proof.
The live metadata census distinguishes `FileNotFoundError` from `PermissionError`;
in particular `/var/db/agent-core/deployments/transaction.lock` is unreadable, not
proven absent. No lock was acquired, removed, or repaired by this investigation.

### OBS-DCP-003 — exact-main churn and source execution are real seams

The external `scheduler-watchdog-production-runbook-d602b59.sh:64` compares
`refs/remotes/origin/main` to the frozen source and refuses on any movement.
Several SHA-specific runbooks coexist in `workspace/artifacts/operator-scripts`.
The main-tree Watchdog transaction similarly derives a new deployment source from
fresh main and carries installer content pins.

The canonical installer accepts positional `REPO_SRC`, `HARNESS_SRC`, and
`MAIN_REPO`, copies package trees, runs package installation, and changes runtime
metadata. Its helpers are resolved from the invoking source directory. This is
not an admissible unattended root API. Existing closure checks and backup ideas
can be reused after extraction; delegating this script wholesale is unsafe for
the requested boundary. No exploit attempt was performed.

The Session Trace packet is stronger evidence for a reusable narrow profile:
sealed input hashes, explicit release/rollback manifests, descriptor-relative
filesystem operations, and exact-generation readback. It still has its own root
runner, own mutex, and Owner sudo wrapper, so it is not the new control plane.

### OBS-DCP-004 — actual runtime domains and metadata

At receipt time:

| Target | Observed identity/state | Consequence |
|---|---|---|
| `system/ai.agent-core.runtime` | authsvc 505:601; PID 298; installed root `/usr/local/libexec/agent-core/app` | Scheduler, Broker, Session Send and Lark share this parent installation/restart face |
| Watchdog W1 | authsvc; loaded, not running; last exit 1 | Separate health/acceptance needed; this snapshot alone does not diagnose its exit |
| Watchdog W2 | root in plist; loaded, not running; last exit 0 | Its executable closure is root-executed and requires separate profile treatment |
| `system/com.auth-service` | authsvc; PID 586 | Separate deployment unit and cross-repo dependency |
| `gui/502/com.svc-workflow` | PID 52488; user-owned service binary | Current deployment identity can directly replace its binary; metadata transition is necessary before strong bypass prevention |
| `gui/502/ai.agent-core.runtime` | PID 5201; user-owned wrapper | A distinct runtime, not the system runtime merely because the label text matches |

System runtime plist records `AGENT_CORE_DEPLOYED_SHA=81d5ab9aaffb8fc16cfc6450bde569ca6eb67124`.
This is a declaration, not artifact/provenance verification. Runtime child uid/gid
is 502:20. Incident metadata is 505:20, runtime routing reader gid is 601, and W1/W2
routing reader gid is 20. A profile must resolve these roles by exact target and
reviewed need; recursive chown-to-one-GID is not an acceptable repair.

The root install directory is 0:0/0755. Caller non-writability of every root-executed
dependency, ACL, ancestor, and interpreter was NOT proven by this directory check.
Neither the initially checked legacy-form socket path nor the proposed
`/var/run/agent-deployd/control.sock` existed; the latter was checked in the
receipt supplement. No deployctl binary existed at the checked location.
Sudoers, full privileged ACLs, and protected state contents were not readable by
this census and remain explicit bootstrap-preflight requirements.

### OBS-DCP-005 — readiness and overlapping Goals

Task inventory was read through Codex on this date. `scheduler` (task
`01a0aac3-3842-7372-b361-d482e857c865`) records a latest freeze failure:
`PHASE2_FREEZE_FAILED`, reported rollback PASS, no apply. Its exact-cause hypothesis
(transient store lock) remains unproven; no third retry belongs to this task.
`飞书消息 修复` (`01a0a4fa-ff16-7bb1-a0ac-4b165d28998e`) has a joint-deployment
summary, but its latest turn bodies were unavailable from the task reader. This
is a discovery hint, not a verified DEPLOYMENT_READY declaration.

| Lane | Common bytes / separate effects | Proposed disposition |
|---|---|---|
| Scheduler / Watchdog | same dsh tree; routing, incident-state migration and W1/W2 differ | one composed dsh release when all facets reviewed; per-Goal verification; state migration separately authorized |
| Global Scheduler / Dispatcher | dsh runtime + job configuration + auth/workflow prerequisites | aggregate dsh code only; retain dependency units and domain mutation authority |
| Lark UX | dsh connector/runtime; real-client acceptance | candidate for shared installation with Watchdog; retain independent real-client receipt |
| Session Send / Fleet Grant | dsh Broker/runtime, auth registry and grants | dsh bytes can join reviewed release; auth unit precedes dependent verification; Grant creation is not ordinary deploy |
| svc-workflow reconciliation | distinct Rust service and database/domain operations | separate profile; never fold business reconciliation into code copy/restart |

`DEPLOY_ONCE_VERIFY_PER_GOAL` is supported as a design opportunity. No exact joint
artifact coverage, complete readiness registry, or production closure was proven.
All ready Goals cannot be enumerated reliably from conversational titles alone.
The proposed producer registry closes this structural discovery gap; migration
requires each producer's receipted import, not guessed success from “merged”.

## Claims and evidence relations

| ID | Claim / state | Support and limitation |
|---|---|---|
| CLM-DCP-001 | New shared deployment authority is required | SUPPORTED by OBS-001; no existing Spec covers the requested durable permission/interface |
| CLM-DCP-002 | Current observed lanes lack one mechanical mutex | SUPPORTED by OBS-002; does not assert a concurrent production incident occurred |
| CLM-DCP-003 | Existing mechanics are reusable, wrappers are not safe daemon plugins | SUPPORTED by OBS-003; adaptation needs review/tests, not permission by hash alone |
| CLM-DCP-004 | Lark/Watchdog/Dispatcher can share some release transactions | INFERRED from OBS-004/005; exact closure and acceptance coverage remain unproven |
| EVD-DCP-001 | OBS-001 supports CLM-001 | Bound to base SHA; sufficient for docs-first routing only |
| EVD-DCP-002 | OBS-002/003 support CLM-002/003 | Source paths, lines, hashes in receipt; code observation, not runtime race execution |
| EVD-DCP-003 | OBS-004/005 support CLM-004 | Metadata + limited task snapshots; insufficient to enqueue or deploy an artifact |

## Alternatives and reuse map

1. **Recommended:** root LaunchDaemon with fixed profiles, authenticated intake,
   protected state/artifacts, one transaction journal, and a non-root Train client.
2. **Transition only:** root-owned exact-command deployctl sharing the same engine,
   queue and mutex. It adds a sudoers surface and needs a sunset/bootstrap receipt.
3. **Rejected proposal:** generic sudo wrapper or NOPASSWD shell/copy/launchctl.
   It would transfer arbitrary root behavior to a writable caller.

Migrate manifest/preimage/hash/readback primitives from Session Trace; routing
schema/validation from Watchdog; dependency-stage validation from the canonical
pnpm work; release hashes from svc-workflow. Remove per-Goal source selection,
privilege acquisition, restart orchestration, mutex ownership and production
closure claims. Preserve existing domain Specs and independent acceptance.

Apple documents system LaunchDaemons and launchd-managed sockets in
[Creating Launch Daemons and Agents](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/CreatingLaunchdJobs.html).
This supports the selected host mechanism, not a claim that our daemon exists or
is secure. Kernel peer credentials and descriptor-safe filesystem behavior must
be tested on the actual supported macOS version during implementation.

## Remaining bounded investigation gates

Before profile activation: authenticated ready-producer census; full legacy entry
inventory (including installed copies and scheduled jobs); exact privileged ACL,
ownership and sudoers readback; trusted build/review issuer integration; external
repo authority pins; real rollback/canary evidence. An unreadable protected path is
not safe-by-default. These gates belong to the reviewed bootstrap package; this
investigation does not request production escalation or mark them PASS.
