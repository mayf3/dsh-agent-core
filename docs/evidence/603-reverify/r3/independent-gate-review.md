# Independent R3 gate evidence review

Recorder `/root`; independent reviewer `/root/gate_inventory`. Reviewer performed read-only checks, did not write candidate/evidence or run tests. This records its returned review, not an Owner acceptance.

```text
REVIEWER_ID = /root/gate_inventory
AUTHOR_INDEPENDENCE = PASS
REVIEW_SCOPE = DELTA (R3 actual gate evidence)
REVIEW_TARGET = 0f25ce5270c0964476184af509c5857acbdf1527
VERIFICATION_TREE = 63534a3f954004da8967cd1284df8915d11d5603
BRANCH_HEAD = 91e224bc079f26cef285cba6da0872cb640ed330
SOURCE_BYTES_EQUAL_R2_SNAPSHOT = YES (read-only git diff --exit-code rc0, six paths)
R3_CHANGED_RUNTIME = rc1
EVIDENCE_REVIEWABILITY = PASS
STAGE_B_COMPLETE = NO
DELIVERY_READY = NO
PUSH_READY = NO
MERGE_READY = NO
OPERATION_ALLOWED = NO
NEXT_ACTION = STOP
```

- Actual 40 tests, 27 pass, 13 fail. All 13 failures are `NO_PROXY: runtime_proxy_env_present`; no other failure class.
- Actual argv has the six user-specified `-u` keys and PATH selection of preflighted Node v25.6.1. It does not clear NO_PROXY.
- HTTP_PROXY rejections: 0; runtime_version_mismatch/NODE_RUNTIME_VERSION: 0. The proxy guard precedes the version guard, so the failure stack alone does not prove version-guard execution.
- stdout hash recomputed equal to command.json: `322961da1758057ceef5526e234a66575c30f78056cf784123d37005f6f3e65c`.
- stderr 0 bytes; recomputed SHA256 equals `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
- V2 negative PASS again, before/after SHA256 both `10cb327a7c7b62afc2dbbb71e868daece061cd36a9df6e768427017dadf039df`; mutations=0, upgrades=0. Malformed/OFF/stop/three-way/late-append/aggregate-fence subtests pass.
- Composition drain was rejected before internal assertions. Partial subtest PASS cannot become full command rc0.

This rejection is useful negative evidence for the existing guard (accepted ordered-route CTR-014); it does not establish a product regression. Owner's all-rc0 and fail-stop requirements keep remaining gates/commit/push incomplete.

Minimum subsequent environment under continuation authorization: retain six-key prefix, append `-u NO_PROXY -u no_proxy -u NODE_USE_ENV_PROXY`, use existing /usr/local/bin/node v25.6.1. Nine keys must be absent even if empty (`process/env.js:13-23`, `compose.js:92-97`). No guard or host-config change is needed.
