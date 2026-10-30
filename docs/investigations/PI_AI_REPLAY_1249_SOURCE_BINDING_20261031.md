# #1249 source binding and implementation preflight

Observed 2026-10-31. This is an evidence-only checkpoint and proposed Spec, not a
completed replay repair, RED-to-GREEN regression delivery or fleet recovery.

## Result

The incident is documented in [agent-control#1249](https://github.com/mayf3/agent-control/issues/1249),
but its claimed schema direction does not match the inspected 0.2.5 source tuple.
The actual failing in-memory conversion for that incident remains **UNKNOWN**.
Do not patch a reader merely to fit the incident's suggested explanation.

The second defect has an existing canonical fix in
[harness PR #4](https://github.com/mayf3/deepseek-harness/pull/4), merged at
`c211b445593fa5639075dc690801a3a3005ca0dd`. Reuse those bytes and their regression
tests; this task has not reimplemented or redeployed that passed fix.

No governing accepted Spec for this product delta was found. The proposed
[PI_AI_REPLAY_COMPATIBILITY_025_V1](../specs/PI_AI_REPLAY_COMPATIBILITY_025_V1.md)
must be independently reviewed, accepted and merged before product implementation.
The investigation does not grant that authority.

## Repository and source identities

The original checkout was `docs/agent-delivery-resilience-v1` at
`2d28545b3a17818e4a0b9481827fd56a18cd4c3c` with existing staged/untracked work.
It has no tracked top-level `harness/`, `app/` or harness submodule. Core resolves
the separate harness checkout through `DSH_HARNESS_ROOT` or its neighboring
workspace path (`packages/agent-provisioning/src/index.js:50-69`).

Linked worktree creation failed because the sandbox could not create the branch
lock under the original `.git/refs/heads/`. An independent clone at
`/tmp/dsh-ac1249` preserves the original checkout. The task branch is
`ac-task/1249-replay-schema-fix`; fresh remote base is
`20e60dd72a42a0ef69e0acb8516b15c1893ffb01`.

| Source | Exact revision | Observation |
|---|---|---|
| deepseek-harness main local checkout | `514ab7b0029141b88c807704764d0d3e1eea1da4` | Detached, package version `0.1.0-rc.8` |
| Existing web-event repair | `c211b445593fa5639075dc690801a3a3005ca0dd` | `replay.ts` byte-identical to the local checkout |
| dsh-codex `v0.2.5` | `e3e54e206f7c829503c7e6eed378643ba0416792` | Read via `git show`; existing dirty worktree says 0.2.6 and was not touched |
| 0.2.5 dependency lock | same fixed tag | `@deepseek-ai/dsh-llm-pi-ai@0.1.0-rc.7`; git tag does not alone establish npm publication or loaded runtime bytes |

Fixed source captures, SHA256 values and actual `git show` argv/rc are in
[`source-capture.json`](../evidence/pi-ai-replay-1249-20261031/checks/source-capture.json).
Line-numbered relevant excerpts are in
[`source-excerpts.txt`](../evidence/pi-ai-replay-1249-20261031/source-excerpts.txt).
These are product source files, not session files.

## Exact inspected call chain

All harness locations below bind `c211b445593fa5639075dc690801a3a3005ca0dd`;
plugin locations bind `e3e54e206f7c829503c7e6eed378643ba0416792`.

1. `packages/core/session/src/surface.ts:99-104` projects `assistant/message`
   from `event.data.message` without changing replay fields.
2. `packages/llm/llm/src/index.ts:823-835`, `forAdapter`, retains same-adapter
   replay metadata and removes it for a different owning adapter.
3. **Actual plugin memory replacement:** `src/adapter.ts:47-59`,
   `migrateReplayHistory`, maps messages and replaces `source.replayState` in a
   detached message/source. Its caller is `OpenAICodexAdapter.stream` at
   `src/adapter.ts:148-153`.
4. **Recognized conversion:** `src/adapter.ts:32-44`,
   `migrateLegacyOpenAICodexReplayState`, converts flat **v1** into wrapped **v2**.
   Wrapped v2 and other inputs return unchanged. This function does not turn
   valid wrapped v2 into an invalid `response.kind`.
5. `packages/llm/llm-pi-ai/src/context.ts:99-113` (or `:197-202` with images)
   calls `toPiAssistant`.
6. **Validation, not transformation:** `replay.ts:110-140` reads
   `envelope.response`; `:116-117` validates `response.kind === 'pi-ai'` and
   `response.version === 2`. Blocks remain at the outer envelope.
7. `replay.ts:179-220` reconstructs native assistant blocks and metadata.
   `:237-247` catches specifically `INVALID_REPLAY_STATE` and produces
   provider-neutral history; the inspected current code does not propagate that
   error as the reported fatal turn failure.

Thus no exact wrapped-v2-to-invalid transformation has been demonstrated in this
tuple. The incident's deployed 023rb reader, package/build identity and historical
loaded bytes remain unbound. No production files or process state were read to
resolve that uncertainty.

## Existing event repair and 0.2.5 integration

Harness `packages/core/session/src/known-event-types.ts:68` now registers exactly
`web/openai-codex-search-llm-request`; `packages/core/session/src/types.ts:384`
declares its payload. `packages/session/session-persistence/src/coordinator.ts:1061-1064`
retains rejection for unknown non-ignorable events. The existing five regression
cases live in
`packages/session/session-persistence-jsonl/tests/codex-websearch-resume.spec.ts`.

[Product #550](https://github.com/mayf3/dsh-agent-core/issues/550) records its
source RED/GREEN and independent review, while installation and business
acceptance remain separate. Those historical test counts are not fresh results
from this task. Codex 0.2.5's `src/search-event.ts:42-45` appends the event without
`ignorable`; the canonical reader registration handles historical unmarked events
without a durable rewrite. Its module declaration must be checked for type-level
duplication when pairing 0.2.5 with the patched harness.

The requested 0.2.5 ride-along can therefore reuse that harness fix, but no new
0.2.5 artifact was built, sealed, installed or loaded here. The original tag and
unrelated 0.2.6 work remain untouched.

## DEVELOPMENT_PREFLIGHT

```text
Problem = #1249 replay compatibility and exact Codex telemetry reload compatibility
Governing Spec = NONE FOUND for this product delta
Spec status = NOT_ACCEPTED; PI_AI_REPLAY_COMPATIBILITY_025_V1 is proposed only
Relevant investigations = this report; fixed #1249/#548/#550 incident snapshots
Relevant decisions = existing session ownership/identity semantics remain unchanged
Previously rejected alternatives = no same-scope rejected Spec found; no generic unknown-event bypass
Frozen boundaries = zero production writes/real session reads; no format v3; 0.2.5 only
Implementation scope = NONE in this checkpoint; source/publication investigation and proposal only
Out-of-scope = deploy/restart/session rotation or rewrite/credentials/config/UNKNOWN replay
New evidence = pinned reader accepts wrapped v2; plugin already migrates flat v1; web-event fix already merged
Need new/amended Spec = YES
IMPLEMENTATION_ALLOWED = NO
```

`.agents/README.md:34-43` requires an accepted Spec, with any amendment merged
before coding. `AGENT_DELIVERY_RESILIENCE_V1:19-22` expressly excludes #550;
its provider-idle transport contracts do not authorize replay schema changes.
`AGENT_CORE_HARDENING_PROGRAM_V1` has `implementation_authority: none`.
Issue requirements and source-review PASS do not substitute for accepted Spec
authority. No product code or product regression tests were edited.

## Verification and limits

The public npm tarball's computed SHA512 equals both registry `dist.integrity`
and the pinned 0.2.5 lock. Tarball SHA256 is
`7ebef054dab1642eaba4eb3edbca4299a354d710583485ce68ce8db9674099ee`;
the unmodified published bundle SHA256 is
`917c559d3e804c638e69a2e46a6ee922e50636f962eaffae1fab9af56835debd`.
The metadata has no `gitHead`: behavioral agreement is not proof of a full
tarball-to-git-source build binding.

The archived [publication probe](../evidence/pi-ai-replay-1249-20261031/publication-probe/probe-results.json)
calls the unmodified public `PiAiAdapter.stream` with a synthetic provider.
Actual command: `/opt/homebrew/bin/node /private/tmp/dsh-ac1249-probe/probe.mjs`,
rc **0**, empty child HOME/DSH_HOME, forbidden fetch (`fetchAttempts=0`).
The root agent independently repeated the command and recomputed archive integrity.

| Synthetic observation | Actual result |
|---|---|
| Wrapped v2, empty content and matching empty blocks | Native replay reaches synthetic provider |
| Wrapped v2, reasoning/text/tool blocks | Native replay; responseId, three signatures and redaction retained |
| Raw flat v1 | Explicit `dsh-foreign` degradation; request continues |
| Raw flat v2 | Explicit `dsh-foreign` degradation; request continues |
| Manually constructed result of flat-v1 migration | Native replay; this public-class scenario does not execute the plugin migration |
| Wrapped v2, block count mismatch | Explicit `dsh-foreign` degradation |

All six preserve the original input bytes. This is **not a product RED/GREEN
cycle**: valid wrapped v2 was already accepted. An initial diagnostic script
startup error (`require.resolve`/ESM exports) is preserved under `attempts/1` and
is not counted as product RED. A separate function-excerpt comparison executes
the pinned plugin migration itself and compares published/git replay conversion
for six vectors. It is not full plugin startup or a persistence restart test.

The public-class probe uses available development peers, including `dsh-llm`
and `dsh-launch-environment` rc.8; exact versions/paths are in its receipt. Thus
it does not verify the full 0.2.5 dependency closure. It loads no production
installation, real model, real session, credential store or service.

No RED-to-GREEN repair cycle, full affected package-suite
PASS, exact-head implementation review PASS, or source repair is claimed.
Non-author review here concerns the evidence and proposed Spec only.

The reported **1,940 affected files** is an incident count. This task did not
read or rescan them. Fleet self-healing is **UNPROVEN**: it needs the reproducing
source-to-candidate binding and corresponding compatibility regression evidence.
Even a later conditional source statement would not prove installation or actual
fleet recovery. No manual migration script was prepared or run.

## SPEC_COMPLIANCE

```text
Referenced Spec = accepted repository knowledge governance for evidence placement only
Implemented scope = source investigation and proposed Spec; product delta NONE
Acceptance criteria evidence = fixed source captures and bounded diagnostic observations
Out-of-spec behavior = NONE for this evidence checkpoint
Rejected alternative accidentally reintroduced = NO
Frozen boundaries respected = YES
New architectural decision introduced = NO (proposal pending acceptance)
Knowledge artifacts needing update = proposed product Spec requires acceptance/merge
SPEC_COMPLIANCE = PASS for evidence-only scope; product SPEC_GATE = FAIL
```
