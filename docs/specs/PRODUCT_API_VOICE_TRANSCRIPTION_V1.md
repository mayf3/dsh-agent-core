---
spec_id: PRODUCT_API_VOICE_TRANSCRIPTION_V1
status: proposed
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

ASR execution is self-hosted behind this route. PRIMARY engine candidate:
Paraformer-zh via sherpa-onnx (model `sherpa-onnx-paraformer-zh-2024-03-09`,
int8); FALLBACK evidence only: whisper.cpp. All published figures (model size
~230 MB, RTF 0.2–0.6, CPU <2 s per 5 s utterance) are INVESTIGATION_ESTIMATE
and MUST NOT be recorded as runtime Observations until measured on the
intended backend execution host. Engine runs fully in memory; deterministic
failure (error return per request; no retry loop). Third-party cloud ASR is
forbidden; changing engines later that would send audio to any third-party
service requires a new Owner/privacy gate.

### DEC-VT-004 — Engine smoke gate before deadline freeze

Before freezing the exact service deadline and resource numbers, ONE bounded
smoke on the intended backend execution host (no production mutation, fixed
Chinese fixtures: short utterance, ~5 s utterance, near-maximum-duration
utterance) MUST record: MODEL_LOAD, TRANSCRIPTION, TEXT_NONEMPTY,
WARM_LATENCY_MS, PEAK_RSS. These are EXECUTED_OBSERVATION values. If
Paraformer is sufficient: ENGINE_SELECTED = Paraformer-zh via sherpa-onnx;
STOP_ENGINE_RESEARCH = YES (whisper.cpp remains fallback evidence only).

### DEC-VT-005 — Deterministic deadline and failure mapping

```text
SERVICE DEADLINE = frozen after DEC-VT-004 smoke (EXECUTED_OBSERVATION warm
                   latency + fixed margin); a provisional bound of 8 s MUST
                   NOT be treated as final until then
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

Route live behind the existing gateway auth with: EXECUTED_OBSERVATION smoke
recorded (DEC-VT-004); deterministic 400/413/415/503/504 mapping exercised by
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
SERVICE_DEADLINE_VALUE = pending DEC-VT-004 EXECUTED_OBSERVATION smoke
ENGINE_PIN = Paraformer-zh via sherpa-onnx pending the same smoke
```
