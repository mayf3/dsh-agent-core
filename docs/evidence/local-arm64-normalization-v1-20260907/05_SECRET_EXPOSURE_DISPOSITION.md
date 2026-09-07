# 05_SECRET_EXPOSURE_DISPOSITION — capability tokens exposure classification

Owner directive §1 (CONTINUE_SAME_GOAL, 2026-09-07). No token bytes appear in this file,
in any report, or in any command log — identification uses one-way sha256 12-hex
fingerprints only, computed mechanically by scripts/secret-exposure-scan.py
(raw output: raw/35-secret-exposure-scan.txt).

## What leaked, when

During r1, raw/07-launchd-plists-sanitized.json (first version) contained cleartext values
for Agent Core capability/kernel/decision tokens sourced from launchd plists in the three
census dirs. r1 audit caught it; raw/07 was re-redacted the same day and passed fresh
re-audit. A surface scan (below) was then performed to classify the exposure.

## Mechanical surface matrix (2026-09-07)

| SURFACE | VALUE | EVIDENCE |
|---|---|---|
| Git index / commit / remote | **NO** | 0 commits contain any value (`git log --all -S`, all branches, dsh-agent-core); evidence dir git-untracked (0 tracked entries) |
| Chat / model-visible transcript | **YES** | r1 audit subagent's final report quoted cleartext values; that text traversed the model-provider API transport (subagent generation + main-session ingestion). Local session transcript stores also held it until evidence redaction |
| Uploaded artifact / external connector | **NO** | no upload or external connector used in this Goal |
| Shared filesystem / remote sync | **NO** | Syncthing: 1 folder root configured, does not cover the evidence dir or any token source; no other sync mechanism found for the involved paths |
| Persistent shell / command log | **NO** | 0 hits across ~/.zsh_history, ~/.bash_history, ~/.zsh_sessions (values never passed through shell command lines — extraction was in-process) |
| External audit artifact | **NO** | audit reports live only in the local session; 04_AUDIT_TRAIL.md and all committed evidence contain names/fingerprints only; evidence-tree residual scan = 0 files |

## Classification (per Owner rule: ANY = YES ⇒ disclose)

SECRET_EXPOSURE = POTENTIAL_EXTERNAL_DISCLOSURE
ROTATION_REQUIRED = YES

Scope qualifier (honest): the ONLY YES surface is the model-provider transport of the r1
audit transcript. Retention/log handling on that transport is outside local control,
hence POTENTIAL, not confirmed third-party disclosure. All local surfaces are NO.

## Rotation disposition

NOT performed inside this Goal (token rotation touches Agent Core kernel/broker
configuration — production DSH-domain surface owned by
DSH_NATIVE_ARM64_RUNTIME_MIGRATION_V1 / the Owner's security authority).

Bounded handoff to the owning DSH/security Goal:

- TOKENS = 4 distinct secret byte-sequences extracted from launchd plist EnvironmentVariables /
  embedded KEY=VALUE arguments in the agent-core kernel/capability-host plist family
  (fingerprints, sha256[:12]): `1b233c06e7f4`, `612c1f8cdc54`, `6edb177615f8`, `cb9f452920c8`
- SOURCES = launchd plists matching `ai.agent-core.runtime*` (user + system domain, incl.
  .bak lineage) and the agent-core kernel/capability-host plists under
  ~/Library/LaunchAgents and /Library/LaunchDaemons (full machine-readable mapping:
  raw/35-secret-exposure-scan.py run record; fingerprints are deterministic from the
  current plist values)
- LIVE_CONSUMERS = agent-core kernel (:4130) and broker (:4001) local IPC gate; runtime
  family currently running (authsvc uid, x86_64 node-runtime) — rotation implies a
  coordinated restart of that family ⇒ must ride the DSH Goal's own production-slot
  discipline, NOT an ad-hoc restart
- RECOMMENDED_ROTATION_PROCEDURE (for the owning Goal):
  1. regenerate the four values in their plist/config source of truth (new random 32-hex);
  2. update all consumer configs atomically in the same transaction;
  3. restart the kernel/broker family inside a quiesce window;
  4. verify: old values rejected, new values accepted, child agents reconnect;
  5. confirm rotation by fingerprint change (old fps above should no longer derive from
     any plist); re-run scripts/secret-exposure-scan.py — expect DISTINCT_TOKEN_BYTES
     matching the NEW fps only.
- RISK_CONTEXT = localhost-only IPC gating (loopback-bound listeners); exposure vector was
  model-provider transport of one audit transcript; no local artifact retains cleartext
  (raw/ residual = 0, re-audit ACCEPT).

## Evidence hygiene state

raw/07 (current) + raw/26 = clean; evidence tree residual scan = 0; MANIFEST.sha256 covers
the redacted tree. Redacted evidence retained; no cleartext copy exists outside the
original launchd plists (which remain the runtime source of truth, untouched by this Goal).
