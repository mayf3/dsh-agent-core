# Offline turn-recovery validation and candidates (#1257)

The command builds a **new candidate file**, with no input-store writes,
worker signals, service actions, installation or request replay. Candidate
success does not mean live admission or a live fence changed. Adoption needs
the existing separately authorized stop/install/readback transaction with
exact preimage and rollback. An unreceipted candidate is not ready to adopt.

Use an explicit local copy and the loader from the deployment being targeted.
There are no production path defaults. Pin the exact SHA-256 of
`packages/agent-router/src/reconciliation/durable-file.js`; sibling `store.js`
and its imports must belong to that trusted deployment. A loader hash binds
the schema version; it is not termination evidence.

```sh
node scripts/availability-recovery/turn-recovery.mjs validate \
  --store /absolute/local-copy.json \
  --loader /absolute/trusted-app/packages/agent-router/src/reconciliation/durable-file.js \
  --loader-sha256 <exact-64-hex-sha256>
```

Validation includes restored handle/issuance/correlation authority and caps,
without startup restoration or persistence against the input. Keep the
returned `sourceSha256` for an explicit authorization.

The authorization is a mode0600 regular file owned by the invoking OS owner.
An unprivileged caller must also own the source; root can prepare a candidate
for another owner. This local filesystem Owner boundary does not authenticate
a remote principal or grant production installation. Exact version1 shape:

```json
{
  "version": 1,
  "operationId": "owner-1257-one-exact-handle",
  "ownerUid": 502,
  "sourceSha256": "<exact-source-sha256>",
  "loaderSha256": "<exact-deployed-loader-sha256>",
  "handle": "<exact-reconciliation-handle>",
  "runtimeEpoch": "<durable-record-epoch>",
  "agentId": "<durable-record-agent>",
  "processGeneration": 7,
  "evidence": "child_real_exit",
  "exitObservedAt": 123456789
}
```

Use exact local readbacks for identity, UID, timestamp and hashes. The command
does not create `exitObservedAt`: submitted evidence must match an observation
**already durable in that record**. For an already settled record needing
proven fence cleanup, use `evidence: "durable_settlement_cleanup"` with its
exact timestamp (possibly null for another accepted durable proof kind).

```sh
node scripts/availability-recovery/turn-recovery.mjs reconcile \
  --store /absolute/local-copy.json \
  --loader /absolute/trusted-app/packages/agent-router/src/reconciliation/durable-file.js \
  --loader-sha256 <exact-64-hex-sha256> \
  --authorization /absolute/owner-authorization.json \
  --out /absolute/new-candidate.json
```

The output and `<out>.receipt.json` are exclusively created, mode0600 and
fsynced. Existing files/symlinks are never overwritten. The receipt binds
source, candidate, loader and authorization hashes, operation, handle and
settlement/fence projection. `CANDIDATE_RECEIPT_INCOMPLETE` leaves a failed,
unreceipted output for inspection. Process one handle per operation; for
several eligible records use the previous candidate as the next input with
a fresh authorization bound to its hash. Other document values are retained.

Both input and candidate pass the deployed loader. Existing constructors
produce `queryState`, settlement and timestamped actions. A stale source,
wrong identity, malformed schema, missing permission or unproven registry
cleanup refuses without changing the source or publishing a candidate.

## Known blocked/pending/cleared writer drift (R2, #1257)

For a local copy containing several illegal `state=blocked`,
`queryState=pending`, `fenceState=cleared` records, ordinary `validate` and
single-record `reconcile` continue to reject the file. Use `reconcile-batch`
only when the Owner authorization explicitly names **every** record to repair.
It restores only the authorized fences to active in a temporary file, then
runs the complete pinned deployment loader. Missing fields, wrong enums,
other invalid records or insufficient proof refuse the entire candidate.
The original bytes are never rewritten.

The version2 authorization has the same private-file/OS Owner custody as
version1, binds the exact original source and deployed loader hashes, and
uses this closed shape:

```json
{
  "version": 2,
  "operationId": "owner-1257-exact-batch",
  "ownerUid": 502,
  "sourceSha256": "<exact-original-source-sha256>",
  "loaderSha256": "<exact-deployed-loader-sha256>",
  "records": [{
    "handle": "<exact-handle>",
    "runtimeEpoch": "<durable-epoch>",
    "agentId": "<durable-agent>",
    "processGeneration": 7,
    "evidence": "exact_started_then_idle",
    "exitObservedAt": null,
    "restoreBlockedFence": true
  }]
}
```

Repeat the per-record entry for each exact authorized handle; duplicate targets
are rejected. `restoreBlockedFence=true` matches only that exact illegal shape.
False permits an already valid record in the same batch. Evidence must already
be durable: `child_real_exit` requires the exact non-null exit observation;
`exact_started_then_idle` and `exact_queued_removal` preserve their existing
proof type and null exit timestamp. Authorization cannot supply a missing
observation. Existing outcome evidence has precedence and refuses exit-only
settlement. `restart_quiescence_proven` is never accepted as an operator-supplied
proof string: its original trusted startup verifier remains mandatory.

```sh
node scripts/availability-recovery/turn-recovery.mjs reconcile-batch \
  --store /absolute/local-copy.json \
  --loader /absolute/trusted-app/packages/agent-router/src/reconciliation/durable-file.js \
  --loader-sha256 <exact-64-hex-sha256> \
  --authorization /absolute/owner-batch-authorization.json \
  --out /absolute/new-candidate.json
```

The single receipt records each actual fence restoration and settlement,
including proof kind and exit timestamp. Final whole-file validation precedes
exclusive output publication. Business outcome stays UNKNOWN and no old request
is retried. #624/#625 Workflow reconciliation/observation responsibilities are
independent; this command cannot complete or erase them.

## Required offline check before any restart (R4)

After **any** manual or scripted turn-recovery change, validate the exact
candidate with the **deployed version's** loader using the `validate` command
above. A source checkout's loader cannot substitute for the installed version.
Keep the successful JSON validation receipt, source/candidate/loader hashes,
and the separate operation authorization. Any validation failure prohibits
installation and restart; preserve the original file and stop. Repeat validation
on the exact installed bytes during an independently authorized adoption,
before restarting. This source task grants no adoption or production effects.

`DURABLE_PROOF_REQUIRED` means existing evidence cannot authorize settlement.
PID absence, retired epoch, timeout, Owner assertion or an untrusted exit
string cannot fill that gap. Restart-lost records remain UNKNOWN/fenced;
the separately accepted root-custodied startup quiescence path governs that
shape. Exit-only recovery cannot downgrade persisted exact outcome evidence.

## Restart and resource checks

Use the existing planned-restart census and Runtime SIGTERM/SIGINT path; no
`launchctl kickstart -k` shortcut. Undrained work refuses ordinary restart
before mutation. Clean stop requires owned worker real exit and durable
settlement; a shutdown/disposer failure is a failed stop. A boundary receipt
records observations and cannot manufacture exit evidence.

`scripts/availability-recovery/drain-then-restart.mjs` is the named ordinary
restart adapter used by `scripts/scheduler-cp-admission.mjs`. It delegates to
the existing controlled deployment transaction: durable drain census, graceful
launchd SIGTERM stop, successful worker/settlement stop proof and exact old
native-instance exit, then bootstrap. Missing proof or remaining workers
prohibit replacement; this adapter rejects the undrained bypass. Do not invoke
the production admission script under this source-only task. Runtime-owned
exact-worker escalation remains governed by PLH C020-C022; the outer adapter
adds no forced-kill path.

The controlled restart now requires the **running producer** to have emitted
`stopProof.version=1` in its existing ready evidence, bound to its exact native
PID/UID/GID/start/program. An older producer without that capability is
rejected before plist/preimage/stop mutation, leaving it running. Adopting this
producer floor requires a separate controlled rollout; this PR does not claim
that the old deployed runtime already supports it. A fresh successful stop
pair, empty slots, drained durable census and native old-instance exit are
required before bootstrap. Writable/hardlinked receipts, identity drift,
timeout or a failed stop refuse replacement. The existing external unload
budget can expire before a worker's longer grace; it cannot authorize a late
bootstrap. No changed global workflow admission policy is introduced: a
concurrent stop can retain new **settled** termination-only UNKNOWN history;
the gate refuses new **unresolved** restart-lost fences.

The issue's resource regressions also require controlled-deployment checks
under the actual reader identities: credential readability, harness/profile
import smoke, every profile bundle `package.json`, runtime traverse access to
each workspace, and intended ownership retained after resource writes. Those
checks belong in a future exact deployment acceptance package. This change
performs no production chmod/chown, credential read, import or fleet repair.

## Alert and related work boundaries

Recovery-startup and unresolved-turn blocks use #1332's structured failure
feed, category `other`, with bounded reason metadata. A blocked request
emits an immediate alert; normal transport failures retain their threshold.
This is the existing log/counter surface, with no new destination or daemon.

The source monitor adapter consumes these structured events from an explicitly
named local `runtime.err.log` copy. It emits a `recovery_governance_notice` JSON
line immediately for each startup block or unresolved-turn fence event, with
separate counts. The subsequent existing `delivery-failure-alert` line is not
counted again. Counts describe observed blocked deliveries, not a census of
distinct active durable fences. Arbitrary log-body keywords do not create an
alert. Use the existing governance log consumer to receive stdout; no external
notification endpoint or production schedule is installed by this change.

```sh
node scripts/availability-recovery/recovery-monitor.mjs monitor \
  --log /absolute/local/runtime.err.log --once
# Omit --once to poll (default 1000 ms); SIGTERM/SIGINT stops the monitor.
```

The first poll reads at most the last 1 MiB and reports skipped bytes. Rotation
or truncation resets the file cursor while retaining observed counts; an input
read failure exits with a bounded error. Monitor restarts begin fresh counts;
these notices are mechanism evidence, not durable delivery acknowledgments.

- `dsh-agent-core#527` owns Scheduler receipt windows, occurrence-fence
  evidence readback, no-nextRun probes and HUMAN_REQUIRED notices. This CLI
  does not mutate jobs/occurrences, clear their fences or change retry policy.
- `agent-control#1332` / PR590 owns transport readiness, evidence-safe retry,
  quarantine and dead letters. #1257 reuses its alert store without widening
  replay eligibility.
- `dsh-agent-core#508/#509` UNKNOWN protection stays: termination-only becomes
  `terminated_without_outcome`, business result remains unknown, and absent
  trusted proof keeps the fence.
