# Native goal continuation source candidate

DEVELOPMENT_PREFLIGHT: REUSE / EXEC_PLAN / CONTROLLED / IMPLEMENTATION.
Authority: accepted `AGENT_CORE_NATIVE_GOAL_CONTINUATION_ADMISSION_V1` at
`c1cbd7506ca58c0abace216e651e1cceb98e030d`; its Contracts are unchanged.
Production application authority remains none.

The native driver reserves and awaits one exact message. The required demo-server
provider retains its synchronous commit closure, requests the existing parent
queue, and commits only inside the new Router handle's AsyncLocalStorage context.
The private `rpc.cancel` notification carries only the originating request ID and
aborts only that bound child's pending native admission controller. It cannot
cancel a Broker call or another child's execution. Definite pre-write abort removes
the queued entry. Written/uncertain work retains the existing UNKNOWN machinery.

The original native message ID seeds the exact matcher before write without
claiming an accepted receipt. Native events or a matching receipt prove acceptance.
A wrong-ID receipt or uncertain commit response remains UNKNOWN. A bounded
process-local seen-reservation set survives reconciliation-record eviction; it
never forgets an old reservation to admit another one. At the existing late-receipt
capacity (256 attempts per process generation), further automatic admission fails
closed with `NATIVE_GOAL_RESERVATION_CAPACITY`; this is visible disarming, not an
automatic restart or new goal policy. Queue/RPC caps still apply independently.

Validation originals are under the task artifact directory
`workflow-unattended-mechanisms-20261027/native-implementation`:

- Native RED 17/18 before the hook; native GREEN 413 related cases, affected driver
  source coverage 100%; keyless ACP goal snapshots 2/2.
- Parent admission, child provider, required-mode compatibility and real OS child
  composition tests. A scripted native goal produces automatic rounds 1 and 2
  after preceding parent executions settle, with distinct exact source handles.
- Actual child timeout/cancel while the preceding parent execution owns the queue
  removes native pending admission; releasing the owner causes no late prompt
  write. Disabling only the cancellation notification reproduces RED.
- Unknown callback, lost prompt receipt plus exact late reconciliation, and duplicate
  reservation after reconciliation eviction have focused RED/GREEN originals.
- Expanded local regression: 337 passed, one skipped, one import failure because
  optional `@larksuite/channel` is absent. That unrelated Feishu test did not run.
  The existing stale-registration test also leaked a test-owned child after
  replacing `child.kill`; its disposer now retains the original bound kill.
  The owned leaked child was stopped, and the focused cleanup suite completed.

These are deterministic source/composition facts. Real-provider ACC-NGC-006 is
NOT_RUN here and belongs to the independent bounded two-Agent trial. No source
check certifies business semantic acceptance, deployed state, or historical HR
recovery. The native source/artifact commit and hashes must be paired explicitly
using the existing candidate subscription requirement; production pins are not
rewritten or impersonated.
