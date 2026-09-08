---
spec_id: PRODUCT_API_VOICE_TRANSCRIPTION_V1
status: accepted
accepted_by: mayf3
accepted_at: 2026-09-08T14:10:47Z
accepted_reviewed_head: 67553c20a1a72760f053edb47a770c3ac09fbc58
accepted_normative_body_sha256: f57eaea8321c3d41bcee68a2e2ac8f5747419c6fde537c426b5a7bdd8a91bbbf
independent_review_result: PASS
independent_review_blockers: NONE
acceptance_basis: >-
  Explicit Owner exact-head acceptance ACCEPT_BOTH_CHILD_AUTHORITIES (2026-09-08,
  Master Goal MOBILE_AGENT_PRESENCE_V1, one ruling covering both child authorities:
  ACCEPT_PRODUCT_API_VOICE_TRANSCRIPTION_V1 = YES and
  ACCEPT_MOBILE_AGENT_PRESENCE_RUNTIME_V1 = YES; no Product semantic modification
  authorized) of this spec at reviewed semantic head 67553c2 (independent REVIEW
  PASS, BLOCKER_UNION = [], DEC-VT-004 engine smoke EXECUTED_OBSERVATION recorded,
  ENGINE_PIN / SERVICE DEADLINE frozen, CROSS_SPEC_COMPATIBILITY 8/8 PASS vs the
  mobile sibling). Lifecycle-only transaction: NORMATIVE_BODY_DELTA = NONE.
  accepted_normative_body_sha256 = SHA-256 of blob bytes after the closing
  frontmatter delimiter line at accepted_reviewed_head; equality at the
  acceptance head proves NORMATIVE_BODY_DELTA = NONE.
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
scope:
  - product-api voice transcription route contract
  - self-hosted ASR execution and engine pin
  - audio validation ceilings and deterministic failure mapping
  - zero raw-audio persistence and log hygiene
governed_by:
  - AGENT_CORE_PRODUCT_ARCHITECTURE_V1
external_authorities: []
supersedes: []
superseded_by: null
owners:
  - mayf3
date: 2026-09-08
---

# PRODUCT_API_VOICE_TRANSCRIPTION_V1

## 1. Goal

Add ONE authenticated private transcription route to the existing Product API
(`packages/product-api`) so the Mobile Presence voice session
(MOBILE_AGENT_PRESENCE_RUNTIME_V1, mayf3/agent-core-mobile) can transcribe
bounded utterance audio through the same Tailscale → gateway → Product API
path it already uses — with self-hosted ASR execution and zero raw-audio
persistence.

## 2. Background and evidence

- Parent product ruling: owner Master Goal MOBILE_AGENT_PRESENCE_V1 ruling
  SELECT_SERVER_ASR_FOR_VOICE_V1 (2026-09-08): V1 ASR is SERVER_ASR;
  APP_EMBEDDED_LOCAL_ASR deferred; the system SpeechRecognizer route is
  rejected for V1 (device discriminators: mic PCM PASS, recognizer zero
  delivery — see agent-core-mobile PR #11 evidence @ f1ca747+5a377cf);
  DICTATION_ONLY is not a legal shortcut.
- Owner-authorized privacy boundary (frozen, mirrored from the ruling):
  RAW_AUDIO_DEVICE_EGRESS=YES; RAW_AUDIO_PERSISTENCE=NONE;
  RAW_AUDIO_IN_SESSION/HISTORY/LOCAL_CACHE/LOGS/ANALYTICS/GIT=FORBIDDEN;
  THIRD_PARTY_CLOUD_ASR=FORBIDDEN_FOR_V1;
  AUDIO_RETENTION_AFTER_TRANSCRIPTION=NONE; only the resulting transcript
  text is canonical.
- Device/client side: agent-core-mobile MOBILE_AGENT_PRESENCE_RUNTIME_V1
  (proposed, PR #17) owns capture (mono 16 kHz PCM16 WAV), ephemeral buffer,
  deterministic endpoint, request invocation, buffer destruction, and session
  state; it MUST conform to the route contract frozen here.
- 3D/perf context is complete (PR #16 @ 7f4997c) and out of scope here.

## 3. Scope and non-goals

In scope: the transcription route contract; self-hosted ASR execution
ownership; audio validation ceilings; deterministic timeout/failure mapping;
zero-persistence and log-allowlist guarantees; same-backend invariant.

Out of scope: streaming/full-duplex ASR; third-party cloud ASR; model-quality
research; session/history/cache writes; Agent/model spawn; changes to
/v1/message or any existing route; the mobile client seam (owned by
MOBILE_AGENT_PRESENCE_RUNTIME_V1); persistent audio storage of any kind.

## 4. Topology and invariants

```text
Phone → Tailscale → existing gateway → SAME Product API → ASR execution
      → {"text": transcript} → discarded audio

ONE_BACKEND                    = YES
SECOND_USER_FACING_BACKEND     = FORBIDDEN
PUBLIC_ASR_ENDPOINT            = FORBIDDEN (private authenticated route only)
ADB_REVERSE                    = FORBIDDEN_AS_FINAL_PATH
HISTORY_LISTENER_REUSE         = FORBIDDEN — the dedicated history listener's
  accepted authority is history-only and rejects non-history traffic; voice
  transcription enters through the existing Mobile private gateway → Product
  API path with the minimum additive route defined here
/V1_MESSAGE                    = UNCHANGED (semantics and behavior untouched)
AUTH                           = reuse the existing Mobile private Product API
  authentication path (same identity context as /v1/message); no new auth
  scheme
NO_MODEL_OR_AGENT_SPAWN        = the ASR component MUST NOT spawn agents,
  sessions, or models of the agent-core runtime
```

## 5. Decisions

### DEC-VT-001 — One additive route, simplest wire

```text
ROUTE        = POST /v1/voice/transcription
CONTENT-TYPE = audio/wav
BODY         = raw bounded WAV bytes (mono 16 kHz PCM16; RIFF header required)
RESPONSE     = 200 {"text": "<transcript>"} (application/json)
```

One request → one transcript. No multipart, no streaming, no chunk protocol,
no websocket, no upload store, no transcription job queue. `text` is the
canonical product data.

### DEC-VT-002 — Bounded audio validation (backend-owned ceilings)

The route MUST validate before ASR execution and fail deterministically:

```text
MEDIA TYPE     = audio/wav else 415
PAYLOAD CEILING = 512 KB else 413 (covers 15 s of 16 kHz mono PCM16 ≈ 480 KB
                 + RIFF header)
DURATION CEILING = 15 s decoded else 413
MALFORMED WAV  = 400
```

Exact ceiling VALUES are frozen here (backend-owned per the mobile/backend
ownership split in MOBILE_AGENT_PRESENCE_RUNTIME_V1 DEC-RUN-006).

### DEC-VT-003 — Self-hosted ASR execution

ASR execution is self-hosted behind this route. ENGINE_SELECTED =
Paraformer-zh via sherpa-onnx (model `sherpa-onnx-paraformer-zh-2024-03-09`,
int8); whisper.cpp is FALLBACK_ONLY (replacement evidence, not V1 scope).
The engine runs fully in memory; deterministic failure (error return per
request; no retry loop). Third-party cloud ASR is forbidden; changing
engines later in a way that would send audio to any third-party service
requires a new Owner/privacy gate.

```text
ENGINE_PIN
  RUNTIME      = sherpa-onnx v1.13.7 (prebuilt osx-arm64, onnxruntime 1.17.1)
  MODEL ASSET  = sherpa-onnx-paraformer-zh-2024-03-09/model.int8.onnx
                 sha256 90bc03034ae1bef9575f8cc798cd1519c8be8aa9e8b458a033e32017ff4d584c
  TOKENS ASSET = tokens.txt
                 sha256 6c0e3b35cece259829e6cb5b8d90d13db88f61ea3a2953d11898e4b2bfd7a2e2
  CONFIG       = num_threads=2, greedy_search
STOP_ENGINE_RESEARCH = YES (no further engine comparison, benchmarking, or tuning)
```

### DEC-VT-004 — Engine smoke EXECUTED_OBSERVATION (deadline evidence)

ONE bounded smoke was executed (2026-09-08) on the intended backend execution
host — the owner production backend host that runs the Product API — in an
isolated scratch sandbox: NO_PRODUCTION_MUTATION=YES, RAW_AUDIO_PERSISTENCE=
NONE, TEMP_AUDIO_FILE=NONE (verified zero residual audio/temp artifacts after
the run). Fixtures were synthetic Chinese utterances (mono 16 kHz PCM16 WAV):
A short 1.865 s, B ~5 s 5.849 s, C near-maximum 13.033 s (within the 15 s /
512 KB ceilings). Primary engine only; whisper.cpp not exercised (not needed).

```text
MODEL_LOAD             = PASS (0.69–0.80 s across runs)
TRANSCRIPTION          = PASS (3/3 fixtures)
TEXT_NONEMPTY          = YES (3/3)
WARM_LATENCY_MS_SHORT  = 88   (1.865 s fixture)
WARM_LATENCY_MS_5S     = 245  (5.849 s fixture)
WARM_LATENCY_MS_NEAR_MAX = 540 (13.033 s fixture; repeat spread ≤ ±5 ms)
PEAK_RSS_MB            = 721.4 (max resident set size)
near-max RTF           = 0.041
```

Sufficiency per the stop rule: reliable load, non-empty Chinese text,
bounded resource use, stable worst-case latency → ENGINE_SELECTED frozen as
in DEC-VT-003.

### DEC-VT-005 — Deterministic deadline and failure mapping

```text
SERVICE DEADLINE = 1500 ms (frozen from DEC-VT-004 EXECUTED_OBSERVATION:
                   measured near-max warm decode 540 ms + fixed execution
                   margin 960 ms covering the full-ceiling projection
                   ≈620 ms at 15 s, thread/CPU contention, and host
                   variance; not derived from published RTF estimates)
DEADLINE EXCEEDED → 504 (and in-process cancellation; no orphan work)
ENGINE UNAVAILABLE → 503
VALIDATION FAILURES → 400 / 413 / 415 per DEC-VT-002
```

No internal retries; the mobile client owns the timeout relation (its timeout
exceeds this deadline plus transport margin — MOBILE_AGENT_PRESENCE_RUNTIME_V1
DEC-RUN-006).

### DEC-VT-006 — Zero raw-audio persistence and log hygiene

The route MUST keep raw audio in memory only: no temp files (mechanically
avoidable here — decode from the request buffer), no disk writes, no
session/history/cache writes, no logs containing audio or audio-derived
payloads; log allowlist = route, status, byte count, duration, latency.
Analytics MUST NOT receive audio or transcripts-of-audio beyond the canonical
text that already flows through the existing message path.

## 6. Acceptance

### ACC-VT-001 — Spec readiness

Independent review of this exact revision (dsh-agent-core review convention:
separate context; blocker union; fix once; ONE re-audit); owner exact-head
acceptance.

### ACC-VT-002 — Implementation conformance

Route live behind the existing gateway auth executing the ENGINE_PIN
configuration (DEC-VT-003) under the frozen SERVICE DEADLINE (DEC-VT-005);
deterministic 400/413/415/503/504 mapping exercised by
tests; zero-persistence verified (no temp files, log allowlist audit);
/v1/message regression untouched; history listener untouched; NO_MODEL_OR_
AGENT_SPAWN verified.

### ACC-VT-003 — Cross-spec compatibility (before either child acceptance)

One bounded CROSS_SPEC_COMPATIBILITY_CHECK between this Spec and
MOBILE_AGENT_PRESENCE_RUNTIME_V1 (agent-core-mobile PR #17): MEDIA_TYPE_
COMPATIBLE / AUTH_COMPATIBLE / BYTE_LIMIT_COMPATIBLE / DURATION_LIMIT_
COMPATIBLE / TIMEOUT_RELATION_VALID / RESPONSE_SCHEMA_COMPATIBLE /
PRIVACY_BOUNDARY_IDENTICAL — all YES required; no third shared Spec.

## 7. Open questions

```text
None. SERVICE_DEADLINE_VALUE and ENGINE_PIN are frozen (DEC-VT-003,
DEC-VT-004, DEC-VT-005).
```
