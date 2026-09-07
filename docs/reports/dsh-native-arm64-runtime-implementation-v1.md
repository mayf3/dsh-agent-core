# Native ARM64 implementation and stage verification

Authority: `DSH_NATIVE_ARM64_RUNTIME_V1`, Owner-accepted candidate
`bf71d20f33f82dcdba2eea18ebe799e740d88175`, accepted lifecycle merged in
`597bac4a8438cad0d3166c808b07c7bf9c815658` (implementation base).
Route: REUSE / EXEC_PLAN / CONTROLLED. Owner's continuation mandate permits
nonproduction implementation and independent audit; production remains HOLD
behind `WORKFLOW_ASSIGNEE_CANONICAL_IDENTITY_RECONCILIATION_V1`.
No normative Authority changes or repeated Owner acceptance are required.

## Implementation boundary

The production launcher rejects a selected ARM generation before importing
application code. Its sealed launch must supply `--native-arm64` and
`DSH_RUNTIME_ARCH=arm64`; wrong platform/architecture or any Node version other
than v25.6.1 fails. Current-main entry also enforces admission. Current-main
Router retains the exact parent executable and prevents agent-local overrides
from dropping its architecture expectation or sealed native-cache policy.
Admission sets NARB_DISABLE_NATIVE_CACHE=1 before application imports. Existing explicit x64 recovery
uses preserved pre-migration launch/code, not an ARM-generation bypass.

Deployment is not whole-main replacement. `stageApplication` copies the live
application source into a new isolated destination, preserves legitimate live
WIP byte-for-byte, and overlays only two commit-bound files: the thin launcher
and native admission module. Every file has preimage/postimage hashes and
provenance. Unrelated main composition and Router refactoring are excluded.
The deployed old Router already spawns the parent's `process.execPath`.
A stage containing any new unmerged delta cannot be applied. Preserved live
bytes are identified as such, never attributed to the implementation commit.

`inspectNativeClosure` inspects actual Mach-O architectures, symlinks and
non-system library edges. Mach-O install IDs are distinguished from dependency
loads. Bundled node-pty x64 prebuilds require an executed ARM selection receipt
before classification as inert; unknown/mixed native artifacts fail closed.
The inventory is a required artifact check, not a replacement for actual
loader/plugin/parent-child execution evidence.

Four pre-existing subscription tests are grouped into a subscription directory
to bring the touched production-runtime test directory within its structural
limit. Test logic is unchanged; relative imports are mechanically relocated.

## Executed observations and limits

Local evidence root:
`/Users/yanfenma/workspace/artifacts/dsh-native-arm64-runtime-v1`.
Raw receipts stay outside Git; no receipt-of-receipt commits are required.

- EVD-ARM-IMPL-001: official exact arm64 Node v25.6.1 tar SHA256
  `a80cb252d170a4730f78f5950cf19a46106f156e5886e5c1cc8c5602aea60243`;
  executable SHA256
  `e5d8a01ccadd10e9988dfb03d371066ef06f7373e51f939d758fbb7aab7b3b21`.
  Source: `node/node-feasibility.json`. Actual execution reports darwin/arm64.
- EVD-ARM-IMPL-002: clean isolated frozen Harness install and complete build
  of source `514ab7b0029141b88c807704764d0d3e1eea1da4`, pnpm 11.7.0,
  exact ARM Node. Sources: `harness-install.log`, `harness-build-final.log`.
  The install initially omitted a failed optional Codex ARM package download;
  it was separately materialized from the exact lockfile integrity, not upgraded.
  Full artifact inventory must close before sealing.
- EVD-ARM-IMPL-003: actual native internal loader v2 and boot-plugin import
  PASS; binding hash `f7834c32235b09b4daafcd922036f49546bb232dd2b3d358400eef1d88ce79f5`.
  Sources: `probes/loader.mjs`, `probes/loader-result.json`. The receipt uses
  a fresh isolated native cache, not a pre-existing user cache.
- EVD-ARM-IMPL-004: two real main-candidate child profiles complete initialize,
  session and clean exit; production profile executes memory_search through
  the real tool loop. Sources: `probes/canary-turns.mjs` and
  `probes/canary-turns-result.json`. LLM endpoint is an isolated local mock;
  this is not normal production E2E.
- EVD-ARM-IMPL-005: live-source stage has 199 application source files with
  exactly two ARM deltas. Two live-stage children complete sessions and
  memory_search. Demo catalog has 25 tools; production catalog has 47.
  Main's 14 additional production tools are excluded from deployment.
  Sources: `stage-rehearsal/source-manifest.json`,
  `stage-rehearsal/probes/canary-turns-result.json`.
- EVD-ARM-IMPL-006: complete live-stage production composition starts isolated
  HTTP surfaces with no Feishu credentials and an empty scheduler store;
  health 200, real Router child arm64, session and memory_search PASS.
  Sources: `stage-rehearsal/probes/parent.mjs`, `parent.log`, and the
  timestamped `parent-*/result.json`. This is nonproduction rehearsal.
- EVD-ARM-IMPL-007: native-closure negative tests reject real substituted x64
  bytes, mixed tree, missing binding and unknown native contents; stage tests
  reject production destinations/source-link escapes and prove live WIP
  preservation plus exclusion of uncommitted/unrelated candidate code.
- EVD-ARM-IMPL-008: affected main suite: 487 tests, 484 pass, 1 fail, 2 skip
  (`affected-tests-clean-env.log`). The one failure is the existing
  feishuSenderOpenId expectation at the unchanged base, independently executed
  in `dsh-native-arm64-baseline-test-v1` (`baseline-feishu-test.log`). Its expected sidecar was mechanically corrected to include the already-emitted
  feishuSenderOpenId; no product code changed for that baseline test. The final
  complete suite receipt is affected-tests-final-source.log. Initial dependency/proxy-env
  setup failures are retained in earlier logs and do not count as passing evidence.
- EVD-ARM-IMPL-009: historical arm64-broken tree and clean candidate both
  contain the same ARM loader binding, but the historical incident paired
  ARM dependencies with x64 runtime. `historical-native-comparison.json`
  supports this file-level comparison, not a new Rosetta root-cause claim.

## Remaining readiness obligations

Implementation/artifact independent audit has not yet run. Final sealed roots,
complete dynamic/native dependency closure, current production consumer/launch
preimages, runtime-only rollback rehearsal, exact merged ancestry and deployment
packet remain required. Production apply, production health, normal Agent E2E
and terminal Goal COMPLETE are unproven.

The 2026-09-07 Rosetta incident and bounded security handoff are Owner-provided
context. No Rosetta repair or capability-token rotation belongs to this change;
no token bytes are read or disclosed for that handoff. P0 retains production
mutation priority. The interim target is READY_FOR_PRODUCTION_APPLY; it does
not change the original production-complete terminal boundary.

Additional executed candidate evidence: Harness affected suites (loader, boot,
terminal/subprocess and type loader) pass 343 tests across 18 files, 4 skipped;
see harness-affected-tests.log. Three separate live-source consumer stages
(business, trusted, scheduler) pass real parent/child/session/tool/health and
clean shutdown under sealed-probes/*-parent-*/result.json. The existing native
spawn helper executes the frozen 502/20 child identity using the ARM Node
(native-helper-result.json); this does not claim a privileged production apply.
Actual loader negative fixtures remove the required ARM binding and substitute
an actual x64 addon: both fail; positive loads successfully
(sealed-probes/native-loader-negative-result.json).

Live-source tests retained in the deployment preimage have eight stale
model-overrides V1 expectations against legally deployed V3 source. All eight
also fail without the ARM overlay (live-baseline-tests.log); they are not
rewritten into production. Main candidate uses its current matching model/runtime
suites. Pre-existing baseline-only timing failures are recorded, not hidden.

Profile fallback links are runtime-maintained by the existing Harness
healProfilesModuleFallback before profile import; an isolated copy of a live
264-link farm was successfully healed. No live profile or credential was changed.
Actual profile-directory census and closure receipts remain in the local
production-profile-package-census.json / production-profile-links.json files.
