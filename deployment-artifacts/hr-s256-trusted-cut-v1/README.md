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
- deterministic assembly from the exact frozen DS v5 source SHA-256
  `b4b65201498c4ec959c391e59e86322931ab3638a475f6c0c0b2fdeddc8eb437`
  into a review-only candidate with one fixed action; its original kernel
  peer check and canonical mutation lock are preserved, and its action still
  refuses before any protected read/effect;
- a separate, real no-follow read-only s256 projection: pinned installed
  validator sources run against the same bounded store FD, check durable
  issuance/handle authority and P1–P10, return only tuple/time/preimage hash,
  and recheck file identity/digest. Its non-root fixture creates the exact
  256th sequence; this projection is not yet called by the DS action;
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

1. Complete the fixed DS action after the current inert preflight gate, with
   durable intent/phase journal and continuous mutation-lock ownership. The
   separate protected projection must be called only after exact source and
   receipt identities are verified. The Python fixture digest helper is not a
   production substitute for the JS projection.
2. Derive and pin trusted binding, primary-workspace and DSH session-path
   holder closure; verify those filesystem identities across the cut.
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

The immediate exact source-closure counterexample is a same-UID direct
`node scripts/production-runtime.mjs` launch between the post-stop census and
the authorized one-startup. DS's current flock serializes DS actions, while
launchd bootout controls only its label; neither denies that manual exec. No
reviewed finite same-UID/manual launch denial mechanism or closed installed
source manifest is present in the frozen DS v5 code. A true window/challenge
cannot assert `launchSourcesStillInhibited=true` until this gap is resolved.
The candidate must therefore remain inert; a test fixture claiming closure
would not establish the production fact.

No root process, live protected read, DS update, Runtime stop/start, store edit,
fence clear, or production action was executed. The next reviewer should assess
this as a partial nonproduction candidate and identify any direct defects in
the implemented surface; it cannot grant bootstrap or recovery readiness.
