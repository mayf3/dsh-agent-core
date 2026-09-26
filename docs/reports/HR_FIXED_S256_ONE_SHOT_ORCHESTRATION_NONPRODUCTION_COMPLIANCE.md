# Fixed s256 one-shot orchestration — affected compliance

STATUS = PARTIAL_NONPRODUCTION_INTEGRATION / NOT_BOOTSTRAPPABLE
PRODUCTION_READY = NO; HR_RECOVERED = NO; H2/H3/H4_ACTUAL_PASS = NO.
Base: `587efc2c96b582faf8e2d1e5af9632d67c059b43`. Authority/preflight is the
adjacent `HR_FIXED_S256_ONE_SHOT_ORCHESTRATION_NONPRODUCTION_PREFLIGHT.md`.
The frozen implementation head and executed logs are bound by the external
`HR-R2-ONE-SHOT-ORCHESTRATION-NONPROD-20260926-v1/HANDOFF.json`.

The existing two-field fixed DS request now reaches one internal orchestration
in DS TEST_MODE, under the actual canonical mutex. Missing test IO or real
production configuration still returns PROFILE_NOT_BOOTSTRAPPED before protected
reads. No request accepts caller evidence, paths, commands, callback or PASS.

Affected R2/r4 obligations exercised: intent before effects; bounded complete
census parsers; secret-safe create-only archive; authorization before final
commitment; same-process durable one-launch claim before child; existing absolute
750ms same-open-file-description challenge; startup then consumption then CLOSED
receipt order; continuity checked at every subsequent boundary; exact terminal
readback before release; no second launch. The tests use actual archive/journal/
FD challenge/lifecycle machinery. Source inhibition, current projection, installed
prerequisites, startup observations and settlement readback are explicitly synthetic
OS seams. A shaped readback is not authentic Router settlement or process ownership.

Handler custody defect RED: after post-intent window loss, a competing open of
mutation.lock could obtain flock because the handler finally block released it.
Repair: private fixed-owner custody holds the exact original canonical FD, original
window FD and actual child object; handler releases only when it has not transferred
that capability. UNKNOWN retains exclusion, does no new active loop and blocks the
next action. It persists the existing DS OUTCOME_UNKNOWN terminal/error receipt;
after SEALED it also writes the existing lifecycle UNKNOWN. Before SEALED it keeps
the truthful intent and writes no fabricated authorization/bundle/lifecycle fields.
If ACK/readback fails, capability remains retained and durable truth is not rewritten.
Reason output is a bounded code, never arbitrary exception/private payload text.

This is a reviewable partial control-flow component, not the full root-capable
profile. The retained private FD is process-local and cannot prove survival across
DS death, installed source inhibition, or a bounded external custodian's receipt.
The deadline ends active work; it does not release safe containment. Tests clean up
only their disposable FD/child capabilities. No production API releases them.

Minimum real-adapter connection plan within accepted R2 (not executed or claimed):

1. Bind the fixed installed Runtime/DS identities and source/holder closure to the
   exact operation package. Reuse no-follow fixed subject projection and pinned
   validator; derive effective primary workspace/session holder paths from installed
   binding authority rather than supplying fixture paths. Verify floor/validator
   ordering and admitted compatible rollback before inhibit/stop.
2. Implement the finite relevant source inhibition and old-tree ownership adapter
   under the same canonical FD. For a current finite controllable source set, R2
   already authorizes the one-shot cut; permanent route rewrites are unnecessary.
   If a residual same-UID actor can resume the old execution or an entry cannot be
   denied using those effects, stop SOURCE_CLOSURE_UNKNOWN before effect. The current
   old-PID-only collector cannot itself prove absence of every such actor.
3. Bind the actual fixed consuming entry/identity to inherited challenge/window FDs
   and one launch. Reuse the existing gated successor, no app/config/plist write
   during the cut. The component tests launch only a descriptor-proof surrogate.
4. Replace synthetic startup/store observations with bounded authenticated exact
   readback and actual owned-child/source dispositions. Implement a fixed external
   custodian/handoff execution adapter for post-effect UNKNOWN, including daemon
   death and release conditions; process-local references and serialized metadata
   cannot replace that capability.

These adapters are technically absent in this candidate, not merely waiting for
an Owner switch or permission to install. Existing R2 permits their bounded
nonproduction implementation for a finite supported set; no impossibility of all
such sets is asserted. Exact current protected facts have not been obtained. A
manifest that actually requires host execution-policy, app/config/plist writes or
another effect outside R2 is a concrete re-preflight boundary, not something this
integration implements. UNKNOWN remains UNKNOWN; no historical copies are assumed
universally relevant or rewritten. H4–H6 actual receipt/admission/new request remain
unexecuted. All live reads, bootstrap, stop/restart/recovery/fence and production
effects remain forbidden. Independent changed-surface review belongs to the same
parent-selected reviewer; this record is source-author evidence, not independent PASS.
