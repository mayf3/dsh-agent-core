# #1248 M1 — read-only inspect and history delivery

Status: **M1_COMPLETE_SOURCE_ONLY**. Date: 2026-10-31 (Asia/Shanghai).

## Authority and exact scope

- Governing accepted Spec: `docs/specs/AGENT_MEMORY_INSPECT_HISTORY_IDEMPOTENCE_V2.md` @ `e9342280`.
- Actual accepted baseline commit: `e9342280`; direct Owner semantic acceptance dated 2026-10-31, [agent-control #1248](https://github.com/mayf3/agent-control/issues/1248).
- Docs-only baseline PR: [#593](https://github.com/mayf3/dsh-agent-core/pull/593). The implementation PR is stacked on `ac-task/1248-mem-gov-spec-accepted`, so its diff does not modify the governing Spec.
- Development base: `d4c7b113ad7dccaeb96c7d65964228e4f5e132b7`. Independently reviewed code/test HEAD: `bdf1efdae7a589523a2d05905f084ba3565c40a4`.
- Worktree: `/Users/yanfenma/workspace/worktrees/ac-task-1248-mem-gov-m1`; branch: `ac-task/1248-mem-gov-m1`. Shared checkout and its pre-existing changes were preserved.

Delivered: trusted binding and format/byte coverage; pure `memory_inspect`; explicit bounded `memory_history_search`; actual in-process assembly receipts; read-only CLI. `memory_search` continues to search current core only. Ordinary delete now reports core-only scope/history retention without changing its existing write path.

Not delivered or claimed: M2 copy migration, M3 idempotent writer, journal/cursor/write-entry coordination, source deployment, production manifest activation, installed/loaded attestation or HR business acceptance. No live memory queries/mounts, mkdir, migration, overwrite, permission change, daemon, network service or production writes occurred. Synthetic tests mount the plugin only over their owned temporary fixtures.

## Formal codec alignment

The fetched main had the older asymmetric codec. Formal repair `d4802a9d999619dce5ade8eaacee83ca9ba026f5` plus final audit revision `c21c8f30ef12e15ff235447d8eff8907bd73cc26` supplied the source baseline. Its `memory.js` SHA-256 is `99d59bdeb055e18d7827d5529f2505783252e6b75124f8fb45c91d5a96bf2b7d`.

Retained strict Source decoding, stored-field/tag/content/render guards, non-fatal refusal, fsync and mode/uid/gid preservation. Formal `codec.test.js`, `guard.test.js`, `recovery.test.js` were restored. Migration CLI/pathological crash-calibration tests were not imported or executed as part of M1; no migration capability was added for this task.

Read-only installed-source audit measured `memory.js=a92734a5381954ef7a05d414234e8c91113227be6a9e92aec2423eb0bf03a027`, `index.js=fdc2025443d0e12d31591d1dbfa6adb5942da04390d71bce0b48507fac649aa3`. These are observed disk hashes, **not loaded proof**. The extra installed 512KiB assembly parse window has no matching formal commit in available refs: provenance remains UNKNOWN. Its narrow behavior was explicitly retained, regression-tested and brought into this source branch; the installed directory was not copied wholesale or changed. This bounds parsing, not the legacy assembly reader's initial allocation; new inspect/history reads are separately bounded before allocation.

## Validation and RED/GREEN record

Final command (Node v26.7.0):

```sh
DSH_PRIMARY_WORKSPACE=/__MEMORY_MUST_NOT_TOUCH_SENTINEL__ \
DSH_AGENT_ID=__SENTINEL__ DSH_WORKSPACE_DIR=/__MEMORY_MUST_NOT_TOUCH_SENTINEL__ \
node --test packages/agent-memory/test/*.test.js
```

**110 tests / 8 suites; 110 PASS, 0 FAIL; rc=0.** Full output: [m1-package-tests.txt](m1-package-tests.txt).

All original package suites stayed green after formal baseline alignment: `memory.test.js`, `paths.test.js`, `plugin-workspace.test.js`, `primary-workspace.test.js`. Added/restored suites: `codec.test.js`, `guard.test.js`, `recovery.test.js`, `assembly.test.js`, `inspect.test.js`, `history.test.js`, `readonly-tools.test.js`.

- Source roundtrip/disk growth assertions failed on old main; the formal codec baseline passed 74/74. Tail protection then failed absent on formal source and passed after preserving installed behavior (75/75 package total).
- New inspect/history missing-module RED and missing-tool registration RED were observed before implementation. Parser deadline, tail prediction, guard prediction, cursor nonprogress and path-bound tombstone regressions each failed before their fixes.
- Reviewer independently reproduced 2.1MB zero-hit paragraph scanning at 3577ms (default deadline 1000ms); incremental byte accounting and parser checkpoints reduced that owned regression to about 100ms. History default/extended oversize tests never emit half-hash facts.
- Framework rejection of non-object tool args was already green; the final refused-binding test was already green and is reported as a characterization regression, not a fabricated RED→GREEN.
- Test-only filesystem auditing rejects reads/writes outside mkdtemp-owned roots and code/dependency roots; inherited workspace variables are cleared before synthetic mounts. An attempted Node permission-model run was unsuitable because Node disables fchmod/symlink under that mode; it was replaced by this explicit filesystem audit, not claimed passing.

No full-repository runtime/integration gates were run: this task is scoped to agent-memory and the accepted supporting plan calls for broader integration only when its actual impact requires it.

Structure gate at reviewed code HEAD: **CANDIDATE_DELTA_PASS_WITH_BASELINE_DEBT**, rc=0, candidate violations=0, unchanged unrelated baseline debt=32. This is not repository-wide PASS. Exact evidence: [m1-structure.json](m1-structure.json).

## Independent non-author review

Reviewer: `/root/independent_review`; authored no source/tests. Target `bdf1efdae7a589523a2d05905f084ba3565c40a4`; governing Spec unchanged since `e9342280`. **SPEC_COMPLIANCE=PASS**, open Critical=0 / Important=0 / Minor=0.

Reviewer executed full package 109/109 at `64237aa3` and final inspector 20/20; verified the final delta adds one already-green regression only. Root then executed the complete final 110/110 suite. Three Important findings were fixed with regressions: quadratic zero-hit scan; repeating continuation; forgotten daily content resurfacing after append. Prediction was aligned with the installed assembly window. Review covers source/test readiness only.

## Bounded search and explicit limitations

- Model args never choose agent/workspace/path/glob. Sources: current `MEMORY.md`, direct real UTC daily filenames, optional reviewed `memory/history-manifest.json` archive entry for the sole approved `MEMORY.md.bloated-20261022` filename.
- Query does not create that manifest or any source. Manifest archives pin full SHA-256/bytes. Maintainer-reviewed tombstones additionally bind fixed allowed `relativePath` plus source digest and byte range; a changed tombstoned source is excluded with PARTIAL, never silently resurrected.
- Full-file no-follow identity/hash verification precedes fact items. Cursors contain source IDs/versions, no paths, and are authenticated by a bounded process-local key. Every request revalidates; a process restart expires old cursors and requires a new query.
- Default 8MiB/32 files/1s; explicit extended 64MiB/256 files/5s; hard single source 32MiB. A source that cannot be fully verified has no partial hash or middle-of-file cursor.
- If revalidation itself consumes continuation budget, terminal PARTIAL `CONTINUATION_REVALIDATION_BUDGET` returns no repeating cursor. Unsearched ranges remain explicit; callers can explicitly use extended or start a narrower date range. No automatic retry/budget growth.
- Snippets are bounded and obvious secret patterns are redacted; heuristic redaction is not perfect DLP. Results are historical material, never executable authority.

## Synthetic performance

Apple M5 Pro, 15 logical CPUs, 48GiB RAM, darwin arm64, Node v26.7.0. Owned corpus: 2,112,509B / 5337-entry synthetic archive + seven 329,725B daily files + 356B core; 4,420,940 source bytes verified per query.

Ten fresh-factory and ten warmed samples per scenario, plus one warmup each. Files were just written; OS cache was **not purged**, so these are first-API-read/warm measurements, not proven disk-cold results.

| Scenario | Fresh P50 / P95 ms | Warm P50 / P95 ms | PARTIAL rate |
|---|---:|---:|---:|
| archive-only-phrase | 36.219 / 52.576 | 34.579 / 34.97 | 0 |
| daily-phrase | 34.733 / 35.387 | 34.682 / 35.497 | 0 |

All 40 measured queries completed all 9 sources under default budget; source hashes unchanged. Process peak RSS: 175120 KiB, including synthetic corpus construction. Full machine-readable data: [m1-benchmark.json](m1-benchmark.json). Reproduce with `node packages/agent-memory/test/helpers/benchmark-history.mjs`.

## Implementation organization and CLI

To meet the accepted structure gate without growing inherited oversized modules, pure codec/guards were partitioned into `src/codec.js`, existing tool definitions into `src/tools.js`, preserving public exports. CLI is `packages/agent-memory/src/inspect-cli.js`; both root `scripts/` and `scripts/lib` already exceed width ceilings, so no child was added there. These are internal layout changes, not a new architecture or scope expansion.

```sh
node packages/agent-memory/src/inspect-cli.js --config /absolute/reviewed-config.json --detail coverage
```

The operator-owned config supplies only trusted agent/primary/session context. CLI never calls plugin apply or creates files. Summary/coverage do not read archive/daily bodies. Unknown installed/loaded/injection/writer fields stay null; actual assembly receipts only arise from the existing hook and contain no text.

## Final product-source hashes at reviewed code HEAD

| File | SHA-256 |
|---|---|
| `packages/agent-memory/src/index.js` | `5153fd3197d35325959d495baab4e53fec6ffbc42b56c53c7c139d541754479a` |
| `packages/agent-memory/src/memory.js` | `b3505985494de0d47efac3faccf6aa20840f35dc1f582bd220c19f9044ec5d50` |
| `packages/agent-memory/src/codec.js` | `274209c682982a886ea0470a8fee4b5479c7de0ac44dac0043cae7b5a16786cc` |
| `packages/agent-memory/src/inspect.js` | `bbc98313865c5e13b439339878bc06f950e6a272df7d767234d04b8c7e4b3dd4` |
| `packages/agent-memory/src/history.js` | `d13101982fd8f8824490e03e019696668a51454f1f409a22d0cd47d62c7fad1f` |
| `packages/agent-memory/src/tools.js` | `469dfbe2778375ad539b9ef11e01aa26f96c26a7411d57095e6cd1fa14bc38ac` |
| `packages/agent-memory/src/inspect-cli.js` | `450d8c81034bfcf3432efbf1dd96ff41fb72c49b965aa14a1c4b4fd55f53cc77` |

## Subsequent plan and stop

M2: owned-copy protocol/migration dry-run and lossless rewrite planning, byte-conservation/conflict/rollback tests. M3: trusted event identity, durable cursor/receipts, single-workspace writer queue, recoverable journal and all write-entry integration; concurrency/restart/fault/growth tests before any controlled single-writer switch. Production installation/activation/canary is a separate original release process and remains unauthorized here.

Stop after the two reviewable PRs and delivery comment on #1248. No merge, installation or production operation.

```text
SPEC_COMPLIANCE
Referenced Spec = AGENT_MEMORY_INSPECT_HISTORY_IDEMPOTENCE_V2 @ e9342280
Implemented scope = formal codec alignment + M1 inspect/history + bounded actual-assembly receipts
Acceptance criteria evidence = package 110/110; synthetic benchmark; independent review; structure candidate delta pass with baseline debt
Out-of-spec behavior = NONE
Rejected alternative accidentally reintroduced = NO
Frozen boundaries respected = YES
New architectural decision introduced = NO
Knowledge artifacts needing update = NONE (this delivery report records the evidence)
SPEC_COMPLIANCE = PASS (M1 source and isolated tests only)
```
