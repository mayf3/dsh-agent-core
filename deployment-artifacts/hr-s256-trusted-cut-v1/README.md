# Fixed HR s256 R2 nonproduction candidate

```text
STATUS = PARTIAL_IMPLEMENTATION / NOT_BOOTSTRAPPABLE
PRODUCTION_READY = false
LIVE_READ_OR_EFFECT = none
FIXED_OPERATION_ID = hr-s256-trusted-quiescence-cut-20260925-v1
FIXED_SUBJECT = turn:961534a5-8c94-487d-8e55-d324a54e821a:a2:g1:s256
```

Authority is the accepted r4 Spec and mayf3's R2 acceptance record (SHA-256
`f3e0f4bdb813e4ee77b0213995f9e63aaba3d971d8dfce5dccbbc6da5b7a7960`).
This directory is isolated candidate source and synthetic tests. It is **not**
an installed DS artifact, a registered action, or a producer of valid live
proof. The external frozen DS package is unchanged. `production_entry` always
rejects `PROFILE_NOT_BOOTSTRAPPED` after checking the exact two-field request.

Implemented and checked offline:

- fixed action/operation/subject constants and request rejection of arbitrary
  paths, commands, subject selectors and caller PASS fields;
- exact s256 preimage predicate and forward-proof *shape* checks, with no
  implication that caller-supplied test objects are trusted deployment proof;
- root-required, bounded, absolute `ps` and `lsof` process execution; parser
  rejects nonzero/timeout/truncation/malformed output, old known PIDs and
  matching holder paths, and returns only normalized secret-safe summaries;
- offline authorization construction checks that required subject, preimage,
  archive/output, holder and binary fields are present and timestamp order is
  causal; it does **not** independently verify their root-custody source or
  launch;
- Router V2 accepts the one R2 fixed operation ID alongside its existing
  `op-...` grammar, while an unrelated `hr-...` ID remains zero-write rejected.

Still required for the R2 profile; **none is supplied by this candidate**:

1. An exact DS action integration under its kernel-peer Owner gate and canonical
   mutation lock, with no alternative privileged entry.
2. Fixed no-follow protected s256 store projection using the pinned installed
   durable validator, byte-exact JS preimage digest, and trusted binding,
   primary-workspace and DSH session-path closure. The Python fixture digest
   helper is not a production substitute for JS `JSON.stringify`.
3. Fresh current installed source/target/actor/lock identities, complete
   launch/resumption source manifest, old process-tree identity, holder-path
   identity and single-host proof. The local collector's PID/path parser is
   only one component; it does not establish the closure or filesystem inode
   completeness on its own.
4. Trusted floor proofs 1–9, validator-before-producer deployment receipt,
   pinned rollback floor and compatible rollback generation from protected
   sources, not caller dictionaries.
5. Durable root custody, immutable archive/receipt hashes, before/after
   journal, continuous exclusive window, finite stop/inhibition, single pinned
   Runtime launch with nonce/window descriptors and authenticated Router
   startup wiring, post-settlement readback, bounded UNKNOWN containment.
6. Separate r4 V9 replay-preimage provenance successor remains unaccepted and
   is outside this change. Full r4 conformance cannot be claimed.

No root process, live protected read, DS update, Runtime stop/start, store edit,
fence clear, or production action was executed. The next reviewer should assess
this as a partial nonproduction candidate and identify any direct defects in
the implemented surface; it cannot grant bootstrap or recovery readiness.
