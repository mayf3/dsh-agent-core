# LARK_UX_PHASE1_V2 — final dedicated-App Canary

```text
REPORT_ID = LARK_UX_PHASE1_V2_CANARY_V2
DATE = 2026-08-22
RUN_ID = pr46-ux-v2-final-20260822T072629Z
PR = #46
PR46_HEAD = e45ffa1a9dbeaf976512932b52a689a100d4be20
CANDIDATE_TREE = 2bba5059a8b1d0210723ae1310c51b2a5b176a1a
REMOTE_HEAD_STABLE = YES
DEDICATED_TEST_APP_CANARY = PASS
MANDATORY_SCENARIOS = 18 / 18 PASS
PRODUCT_CODE_CHANGE_AFTER_PR46_HEAD = NONE
```

## 1. Isolated runtime and identity

- A new dedicated non-production App was created through the official reviewed
  `@larksuite/channel` `registerApp` QR onboarding flow.
- Test App identity SHA-256:
  `3952e3cdc4319f2832bba140b78b20ad16071df860ca2d4206d1670b1ed6416c`.
- The App identity differs from both the production App and the standalone pilot.
  Neither existing App was modified.
- Credential file and isolated Binding store were both mode `0600`. No credential,
  token, Authorization value, real person name, private message body, or raw platform
  identifier is persisted here.
- Transport was WebSocket. Cards, a custom converter, and a second renderer remained
  disabled. The runtime stayed on `@larksuite/channel@0.5.0`, immutable runtime
  revision `ab028f9dbcc09effbdfa4c9885cdcc1f5ecc623f`.
- Independent P2P, group, and topic conversations were prebound to the isolated test
  Agent/session. One-way safe coordinates only:
  - group conversation: `dedd692aff7ff02e3bb8f357`
  - P2P conversation: `bd9ee13101601503adc1ca44`
  - topic chat/conversation/thread: `06b753cd769ce477f0025b0b` /
    `6653707c7b37b0c8cd769f5b` / `c78c39eb1add50bc94840ded`

## 2. Provider outcome

The primary route `zai/glm-5.3` registered, then the provenance turn terminated with
explicit `account_quota_exhausted`. The scenario was stopped. There was no same-turn
fallback. A clean isolated process/home was started and the scenario rerun from its
start on the authorized fallback `openai-codex/gpt-5.6-luna`.

```text
PRIMARY_RESULT = account_quota_exhausted
FALLBACK_TRIGGER_ALLOWED = YES
SAME_TURN_SILENT_FALLBACK = NO
CLEAN_RESTART = YES
EFFECTIVE_PROVIDER_MODEL = openai-codex/gpt-5.6-luna
EFFECTIVE_PROVIDER_REGISTERED = YES
EFFECTIVE_TURN_COMPLETED = YES
TURN_FINISHED_AT = 2026-08-22T08:04:59.774Z
SAFE_REPLY_SHA256 = f0075be645fb71bf13abaec06c61aa6500d3bad0d6804eed2c7768e7c7f5971a
```

## 3. Mandatory Canary matrix

Success-path observations used the real Feishu web client and the exact candidate
connector. Error-class rows use the real pinned SDK `OutboundSender` with a controlled
raw transport, as required to induce otherwise unsafe/non-deterministic platform
errors; the connector adds no retry, fallback, or replay.

| # | Scenario | Timestamp (UTC) | Result | Safe evidence |
|---:|---|---|---|---|
| 1 | Heading native normalization | 07:55:32 | PASS | Six labels visible, ordered, and natively treated; distinct levels not required. |
| 2 | Nested ordered/unordered list | 07:32:54 | PASS | Both list kinds and depth-1 children visibly retained in order. |
| 3 | Python fenced code + language | 08:07:41 | PASS | Native code blocks showed `python`; code bytes and all safe markers present. |
| 4 | Clickable byte-stable link | 07:55:32 | PASS | Native anchor clickable; DOM `href` exactly equalled input for query, fragment, and percent encoding. Input URL SHA-256 `dce30ecc…a7943c`. |
| 5 | Simple native table | 07:32:54 | PASS | Real client displayed a two-column header and two-row table grid. |
| 6 | >3500 comprehensive long content | 08:07:41 | PASS | 13,343 chars, 4 chunks, 280/280 markers complete and ordered; table/link present; fence closed/reopened with `python` in each chunk; mention counts `[1,0,0,0]`, outside fence; end marker present. Content SHA-256 `9f197d60…ddd0f`. |
| 7 | Group auto-mention | 07:29:21 | PASS | Trigger sender identity came only from ingress openId; native clickable mention and recipient native notification observed. Message pseudonym `95dd3e…f8682`. |
| 8 | Topic auto-mention | 07:52:22 | PASS | Native clickable mention and notification observed inside the topic; reply did not escape to main group. Message pseudonym `0782bd…cef2e`. |
| 9 | Topic follow-up continuity | 07:54:26 | PASS | `conversationId = chatId:topic:threadId`; same safe conversation/thread and byte-equal prebound Binding on first and follow-up ingress. |
| 10 | P2P no auto-mention | 07:35:22 | PASS | Real P2P response rendered Markdown with zero mention nodes. |
| 11 | Missing/invalid openId | 07:26:33 | PASS | Real invalid-id output had no mention/name fallback; missing and invalid contract cases produced no fabricated identity. |
| 12 | Router failure receipt | 07:26:33 | PASS | Real client receipt was plain text with zero mentions; Router failure call remained exactly two arguments. |
| 13 | Unbound/proactive | 07:48:14 | PASS | Real unbound receipt and proactive notice were plain text with zero mentions; unbound path created no Binding. |
| 14 | `target_revoked` | 08:10:17 | PASS | Exactly one logical same-chat top-level fallback; content/rendering/mention preserved; connector retry 0. |
| 15 | `permission_denied` | 08:10:17 | PASS | Fail loud; no reply-target removal, top-level degradation, or format fallback. |
| 16 | `format_error` | 08:10:17 | PASS | Exactly one logical Markdown→text fallback with the same answer; connector retry 0. |
| 17 | Exhausted `rate_limited` | 08:10:17 | PASS | SDK attempts 3; connector retry 0; automatic replay 0; fail loud. |
| 18 | Ambiguous unknown | 08:10:17 | PASS | `OUTCOME_UNKNOWN`; no visible exactly-once claim; connector retry/replay 0. |

Native table, clickable mention, and native notification gates passed, so no Owner
Decision stop was triggered.

## 4. Binding and delivery equality

```text
P2P_PREBOUND = YES
GROUP_PREBOUND = YES
TOPIC_PREBOUND_BEFORE_SUCCESS_INGRESS = YES
GROUP_BINDING_EQUAL_BEFORE_AFTER = YES
TOPIC_CONVERSATION_FORMULA_EQUAL = YES
TOPIC_FIRST_FOLLOWUP_CONVERSATION_EQUAL = YES
TOPIC_FIRST_FOLLOWUP_BINDING_EQUAL = YES
TOPIC_REPLY_STAYED_IN_THREAD = YES
```

## 5. Verification

All commands below used Node `v25.6.1`; production/full-repository child boots were
bound to the clean frozen Harness at commit
`a12bb03c6861969985f066bfbf0cb7e5dd5ac567`.

| Suite | Result |
|---|---|
| dedicated UX connector + SDK fault contracts | 26/26 PASS |
| Feishu connector full | 162/162 PASS |
| Agent Router full, including four UX seam tests | 111/111 PASS |
| production runtime full | 42 PASS / 0 fail / 2 skip |
| real Binding read-only replay | 1/1 PASS |
| serialized full repository | 653 tests / 650 PASS / 0 fail / 3 skip |
| governance integrity verifier (`--require-accepted`) | PASS |
| accepted parent/amendment blob equality with main | MATCH / MATCH |

Post-report checks (`git diff --check`, gitleaks, credential scan, forbidden-surface
check) are recorded in the JSON report and final PR commit gate.

## 6. Authority and non-actions

```text
PARENT_SPEC_BLOB = 91513d140bfeb2747326a465bdc01d72c899c864
HEADING_AMENDMENT_BLOB = 9785c8a55f0028ca345e458f2a49f6de2b4939b3
ACCEPTED_SPEC_CHANGE = NONE
PHASE_A_FOUNDATION_REGRESSION = NONE
PRODUCT_CODE_CHANGE_AFTER_PR46_HEAD = NONE
DEPENDENCY_CHANGE = NONE
DEPLOYMENT = NONE
PRODUCTION_STATE_CHANGE = NONE
MERGE = NONE
SECRET_DISCLOSURE = NONE
OWNER_DECISION_REQUIRED = NONE
READY_FOR_体验审计 = YES
```
