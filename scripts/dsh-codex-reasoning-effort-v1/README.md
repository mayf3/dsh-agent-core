# GPT6_LUNA_AND_REASONING_EFFORT_V1 — dsh-codex reasoning-effort lane

Goal: upgrade the Luna route `openai-codex / gpt-5.6-luna` to
`openai-codex / gpt-6-luna` with an explicit per-route `reasoningEffort`
(default `medium`), through the official provider/model registry, preserving
existing OAuth / credential / proxy semantics.

## Why a patched dsh-codex artifact exists

* pi-ai **0.87.1** is the FIRST upstream release whose `openai-codex` catalog
  carries `gpt-6-luna` (checked 0.82.1 → 0.87.1 catalog-by-catalog).
* The reasoning mechanism already exists end-to-end and is REUSED, not
  reimplemented: dsh-llm-pi-ai `profile.reasoning` → `SimpleStreamOptions.reasoning`
  → pi-ai `model.thinkingLevelMap` → Responses body `reasoning.effort`, with
  fail-loud `UNSUPPORTED_REASONING_EFFORT` capability validation.
* NO upstream dsh-codex (0.2.3 … 0.3.0) exposes a configuration field for it.
  The minimal compatibility patch adds `Config.reasoning`
  (`off|minimal|low|medium|high|xhigh|max`) and forwards it into the adapter
  profile. Upstream source: `Yan-Zero/dsh-codex@75d98d5` (v0.2.3).

## Artifact provenance (exact pins)

| field | value |
|---|---|
| OLD pluginVersion | `0.2.3` |
| OLD sourceCommit | `75d98d5b10bb926d53108e49019668c1bde2a9eb` |
| OLD artifactSha256 | `2d29f95f14ff918f90b90134353c842052e9cd2aff9cb9d1866d854fff2c50b0` |
| NEW pluginVersion | `0.2.3-dshr1` |
| NEW sourceCommit | `42f14343e1506d7d06216d7fa580cae5161001dc` |
| NEW artifactSha256 | `160bbefcc8ebe8a1a2c966ec89cdc3a723c0a0ef8cb90fe121772b18970830b5` |
| peer @earendil-works/pi-ai | `^0.82.1` → `^0.87.1` (deployment installs 0.87.1) |
| dshVersion / dshCommit | UNCHANGED (`0.1.0-rc.8` / `514ab7b0029141b88c807704764d0d3e1eea1da4`) — harness NOT touched |

The lib/ payload base equals the production-verified 0.2.3 artifact bytes
(diffed against the running install); the patch applies three identical edits
to src/ and to the compiled lib chunk (Config schema, apply() wiring, adapter
profile literal) plus the package.json version/peer bump.

## Request-boundary verification

`verify-request-boundary.mjs` assembles a production-equivalent scratch tree
(installed rc8 harness seam packages + pi-ai 0.87.1 + the patched plugin),
drives the real `apply()` wiring with a fake cordis context and a fake
credential, and captures the outbound Codex Responses request via a mocked
fetch (decoding the zstd-compressed request body pi-ai 0.87.x sends).

Proven at the wire boundary (all PASS):

* `gpt-6-luna` resolves in the pi-ai 0.87.1 catalog; unknown models fail loud.
* plugin `reasoning: "medium"` → body `{"reasoning":{"effort":"medium","summary":"auto"}}`.
* plugin `reasoning: "high"` → `{"effort":"high"}`.
* plugin `reasoning: "off"` → `{"effort":"none"}` (explicit no-thinking).
* absent config → pi-ai 0.87.x emits its implicit default `effort:"none"` —
  this is why EVERY provisioned codex route in agent-core now carries an
  explicit effort (the built-in default route pins `medium`).
* plugin config schema rejects out-of-vocabulary values (schemastery).

## Deployment notes for the Deployment Agent

* Route changes live in `<productionRoot>/agent-model-overrides.json`
  (V3 schema): model `gpt-6-luna`, `reasoningEffort: "medium"`,
  `pluginVersion: "0.2.3-dshr1"`. Reference target:
  `deployment/agent-model-overrides.gpt6-target.json`.
* Artifact injection uses the EXISTING env seam of the runtime process:
  `DSH_CODEX_PACKAGE_TARBALL=<this artifact .tgz>` and
  `DSH_CODEX_SOURCE_STAMP=<dsh-codex-0.2.3-dshr1.source-stamp.json>`
  (origin/main provisioning requires both for exact-pin verification).
* pi-ai must resolve to **0.87.1** inside each profile's `profiles/node_modules`
  (transitive install of the patched artifact; npm cache/registry reachability
  is a deployment concern).
* The config `reasoning:` key is written by provisioning into the per-agent
  `cordis.patch.yml` `llm-openai-codex` block. Rollback = restore the previous
  overrides entry (model + effort + pluginVersion) and the previous artifact
  env; the next spawn re-provisions both consistently.
