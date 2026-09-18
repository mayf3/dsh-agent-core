# FREEZE V7 — APP-ONLY SEALED GENERATION (Owner ruling 2026-09-18)

Supersedes V2–V6 execution mechanics. The V6 failure (COREPACK interactive download prompt during
the full-root installer's harness pnpm stage) is closed BY DESIGN: V7 does not run the installer,
pnpm, corepack or any package manager. We only ship new Scheduler app bytes as a sealed app
generation swap. Non-target surfaces keep their verified bytes.

## Scope ruling (Owner)

```text
TARGET_SOURCE_SHA=41f354d163f532348b2ad1ef33b5ee528655dfc6
RUNTIME_CODE_DELTA=packages/scheduler only (fresh recomputed: bb5327f..41f354d touches no other
  app-closure path; no deletions; bundle-*/profile-* unaffected)
HARNESS_CHANGE_IN_SCOPE=NO   NODE_RUNTIME_CHANGE_IN_SCOPE=NO   HOME_CHANGE_IN_SCOPE=NO
CONFIG_CHANGE_IN_SCOPE=NO    CREDENTIAL_CHANGE_IN_SCOPE=NO    CACHE_CHANGE_IN_SCOPE=NO
PNPM_INSTALL_REACHABLE=NO    COREPACK_REACHABLE=NO    NETWORK_PACKAGE_FETCH_REACHABLE=NO
```

## Sealed generation definition

```text
app.next = CURRENT live app generation (frozen manifest 66ebc369…, drift-gated at apply)
           with packages/scheduler replaced WHOLESALE from 41f354d
           (whole-package replacement is mandatory: the target generation ADDS
            src/self-ops/diagnosis.js, src/self-ops/invoker-outcome.js,
            src/watchdog/admission-isolation.js, src/watchdog/slot-accounting.js and MOVES the
            history sink to src/history/ — a file-diff overlay would leave a broken import set)
           + root package.json -> 41f354d bytes (d5764403…; dependency surface unchanged
            from the G6 source generation bb5327f — the installed node_modules closure
            satisfies it unchanged)
TARGET_APP_MANIFEST_SHA256=c41a90453d0170085b3959943af70b1111c9403b5191e097649e28c01c4e15b7 (1171 files)
  — derived at freeze from the frozen preimage manifest + the 41f354d scheduler subtree; the
  runbook rebuilds app.next at apply time and its manifest MUST equal this constant.
```

## Mutation shape (atomic renames in ONE parent dir)

```text
1. build app.next-<ts> inside /usr/local/libexec/agent-core/ (same filesystem)
2. verify manifest == TARGET_APP_MANIFEST_SHA256 + scheduler.js/package.json digests
3. mv app -> app.rollback-v7-<ts>       (exact rollback generation)
   mv app.next-<ts> -> app
4. launchctl kickstart -k system/ai.agent.core.runtime
NO per-file overwriting inside live app/.
```

## Gates before the swap (all fail-closed)

exactly-once marker (deploy-v7.auth) · staging manifest == ee8e9d23… · live app manifest ==
66ebc369… (drift=STOP) · production-deploy/routing-tx/jobs.json.lock ABSENT · engine lease
positively HELD by the live runtime (V6 correction kept) · runtime health (process + 8790/health
+ W2 heartbeat/log) · HR b115cb96 retry.auto==false (revision+updatedAtMs frozen to receipt) ·
no in-flight admitted/running occurrence (bounded wait — a restart over an in-flight turn would
manufacture an outcome_unknown) · space ≥ 2×app · package-manager PATH guard armed.

## Package-manager regression fixture (new, must PASS)

```text
--fixture-selftest (non-root, /tmp sandbox): fake pnpm/corepack/npm/npx/yarn in PATH exit 99;
assembles the expected tree by PLAIN COPIES (independent of the build code path), swaps, round-
trips the rollback, asserts: package manager never invoked, scheduler bytes new (added files
present, stale flat files gone), sibling package + root pkg correct, rollback restore exact.
FIXTURE=PASS observed at freeze.
```

## Rollback (Owner §6)

On ANY post-swap gate failure the runbook AUTOMATICALLY: app -> app.failed-v7-<ts>; rollback
generation -> app; kickstart; health readback. Store (jobs.json/runs.jsonl), harness, node-runtime,
config, credentials are never touched by V7 (by design nothing to roll back there).

## Non-target surface hashes (freeze-time references; runbook re-derives pre/post as root — the
pre==post equality INSIDE the runbook is the acceptance evidence; the config value below covers
only the operator-readable subset, root-side full capture at apply)

```text
HARNESS_PRE_HASH=955ee821c158617fc1f72d793c32a262b633c6f172d18739bdf10c61832705f9
NODE_RUNTIME_PRE_HASH=caed279fb2636ddc7988a1e1814904a3ed1bd752fe5e81b9d59eb96dadc8c40f
HOME_PRE_HASH=6912a913bf7b751344f8f7024d3266459023b221f44671e0d26c30daebcb137b
CONFIG_PRE_HASH(root-side at apply; operator subset reference)=de465b484382fd0e1d58fd8a45c3fa8b9191fafe010df3a713fe5758ca6c49f1
SPAWN_HELPER_PRE_SHA=a9fdfe66a2494557c80d9e8e8f210b2cdbbfab29a2b3fea2eeaa210197190ec2
```

## Execution (single attempt under V7)

```text
RUNBOOK=deployment-artifacts/scheduler-self-healing-v1/scheduler-self-healing-deploy-v7.sh
RUNBOOK_SHA256(V7)=c5ee02aa46aeda2de0ca2e58aad11fe3fc69643a868ba2a29d0d12c7f6c77ea7 (archived byte-identical copy in this directory;
r2: fail() now exits (all pre-swap gates fail-closed), do_build call-name fixed, conflicting-
process gate + staging key pins restored, engine-lease identity check restored, routing pre==post
check fixed, RB_TMP mkdir + robust restore for partial-mv states, final pm_guard enforced,
G7b in-flight re-check adjacent to the swap; re-verified: FIXTURE=PASS)
ROOT COMMAND (single line):
  sudo bash /Users/yanfenma/workspace/project/dsh-agent-core-selfheal-impl/deployment-artifacts/scheduler-self-healing-v1/scheduler-self-healing-deploy-v7.sh 2>&1 | tee /private/tmp/scheduler-self-healing-deploy-v7.log
```

## Independent reviews

```text
MECHANICAL_REVIEW=see V7-REVIEW-MECHANICAL.md
SAFETY_REVIEW=see V7-REVIEW-SAFETY.md
```
