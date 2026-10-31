# PRODUCT_552 RELEASE_PREP — binding the merged reader-owner fix to the existing credential/B7 deployment line

```text
STATUS              = RELEASE_PREP_FROZEN — TARGET/ARTIFACT/WIRING/PREFLIGHT/ROLLBACK/
                      STOP_CONDITIONS/ACCEPTANCE_A1_A6 bound to the EXISTING deployment
                      authority. Nothing in this packet executes a production step.
CLAIM               = agent-control#1279 · Product #552 round cap-20261024T233407Z-1870-c1
                      CLAIM_TOKEN p1-shared-codex-release-prep-r1870c1
PRODUCTION_MUTATION = NO
PROD_AUTH           = HOLD_RELEASE_PREP → execution WAIT_SCOPE = INTERNAL_DEPENDENCY (§DEPENDENCIES)
GOVERNING           = AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V3 (CTR-SCA-010, accepted)
                      + Owner contract 2026-10-24 (issue #552 comments 6386046168 /
                      6386637512, CONTRACT_AUTHORITY=ACCEPTED_BY_OWNER): file 0600 owned
                      by fleet reader uid 502, directory 0700 same owner, writer-side
                      post-rotation chown 502 + chmod 600.
                      + AGENT_CORE_AUTHSVC_SHARED_CODEX_ACTIVATION_RECONCILIATION_V2
                      (accepted, PR #452) — the deployment domain authority (Product #414 B7).
                      + AMENDMENT_7 rotation-seam deployment packet (accepted, PR #223/#227).
                      + ACCEPTANCE_PACKET.md (this directory, §1–§9 frozen at de10045e/1d9eebcb).
NO_NEW_PLATFORM     = this binding REUSES the existing Product #414 B7 serialized release
                      path, the existing AMENDMENT_7 rotation seam, and the existing
                      privileged-channel architecture. No new deployer/scheduler/credential
                      service is created or authorized by this packet.
```

## SOURCE_MERGE

```text
PR                  = mayf3/dsh-agent-core#553 (ac-task/552-shared-codex-reader-owner)
MERGED_AS           = 4729bab3c2ae30f3f772ada26b0290f36be9e394 (current github/main tip)
REVIEWED_HEAD_CHAIN = 425da336 (round-1 PASS) → de10045e → round-2 blocker convergence
                      f73e8db7 → docs-only 1d9eebcb → merge 4729bab
STATE               = SOURCE=merged; INSTALLED=no; ENABLED=no; BUSINESS_VERIFIED=no
CHANGED_SURFACE     = 7 code/test files + ACCEPTANCE_PACKET.md (PR body); additive
                      reader-owner face; per-agent trusted-CP face byte-identical (R7).
TESTS_AT_HEAD       = agent-credential-provisioning 89 = 84 pass / 0 fail / 5 env-skip;
                      broker 534/534; rotate CLI selftest 5/5; structure verifier 13 → 11
                      (only pre-existing base/main directory findings remain).
```

## RELEASE_OWNER (existing authority — reuse, no second deployer)

```text
DEPLOYMENT_LINE     = Product #414 [PRODUCT B7] "Shared Codex permanent closure —
                      deploymentRoot-safe re-freeze and fleet acceptance"
                      (standing delegation #386; domain authority PR #452 reconciliation V2:
                      "operation_scope: existing Product 414 B7 deployment only").
RELEASE_MACHINERY   = the existing B7 installer/executor line (deploymentRoot seam
                      authority amendment b08db324/PR #311; refreeze V2 executor
                      owner-router-closure-g2-g7-v2x.sh with G2.5 fresh-child canary,
                      G2.6 app-graph gate, auto-preimage, RESTORE-R1/R2);
                      b7-release-executor + single-file sudoers entry installed and
                      read back at matching SHA 17842ece (recorded on #414, 2026-10-16).
SINGLE_WRITER_RULE  = the B7 line is serialized: one original-session writer
                      (sess_2bd7c2c3-5fe0-4a21-8c04-56b57ed225d5 lineage). Latest durable
                      record on #414 (2026-10-16): v50 candidate REVISE_REQUIRED /
                      provider-capacity wait; "Only after that boundary may the existing
                      serialized release path proceed." No live writer at the fresh read.
ROTATION_AUTHORITY  = AMENDMENT_7 (accepted): scripts/agent-credential-rotate.mjs via
                      privileged-channel-psql = ONE_SUPPORTED_ROTATION_ENTRY; the seam's
                      (e) privileged DB channel is an auth-service EXTERNAL_ONLY surface.
OWNER_ACTION_REQUIRED = NO for this prep; the install/wiring execution below belongs to
                      the B7 deployment line by its own mandate.
```

## TARGET (exact, observed on host 2026-10-25, metadata-only)

```text
APP_INSTALL_ROOT    = /usr/local/libexec/agent-core/app        (root:wheel)
DEPLOYED_SHA_MARKER = AGENT_CORE_DEPLOYED_SHA=fa4510beb6b01e5c40000a2ae36a62c526759e76
                      in /Library/LaunchDaemons/ai.agent-core.runtime.plist (plist mtime
                      2026-10-21 23:27; last deploy-tx activity 2026-10-21, app dir
                      mtime 2026-10-23 15:01). fa4510be = "Merge PR #506: C11-R4 R3
                      packet refresh" — a verified ANCESTOR of the fix; the deployed
                      build PREDATES it.
DEPLOYED_GAP        = the deployed app/packages/agent-credential-provisioning/src
                      contains only auth-client.js/index.js/store-writer.js — NO
                      rotation-seam.js, NO store-reader-owner.js, and NO
                      scripts/agent-credential-rotate.mjs. The fix and its CLI are
                      entirely absent from the deployed build.
SHARED_STORE_DIR    = /Users/authsvc/.agent-core/shared-credentials/openai-codex
SHARED_STORE_FILE   = <SHARED_STORE_DIR>/.openai-codex-auth.json
READER_IDENTITY     = uid 502 (yanfenma), gid 20 (staff) — mechanically confirmed by
                      the runtime contract itself: root LaunchDaemon ai.agent-core.runtime
                      runs user authsvc with DSH_AGENT_CHILD_UID=502 / DSH_AGENT_CHILD_GID=20
                      (fleet children = the readers).
CONTROL_PLANE       = same LaunchDaemon (user authsvc) — the incident's cross-uid
                      writer identity; the AUTHSVC-IDENTITY ROTATION MUST NOT BE REUSED
                      (ACCEPTANCE_PACKET §6 P2).
```

## ARTIFACT_OR_PACKET

```text
ARTIFACT_IDENTITY   = dsh-agent-core main @ 4729bab3c2ae30f3f772ada26b0290f36be9e394.
                      Per ACCEPTANCE_PACKET §6 P1: deployment builds from that merge
                      commit — never from a task branch/worktree.
BINDING_RULE        = the B7 line installs from an exact DEPLOY_SRC pin bound in its
                      operation packet; carrying 4729bab (or its accepted successor tip
                      that contains it) into that pin is a B7 deployment-line transaction
                      step, not an executor-side choice. Known deploy-tx discipline:
                      immutable pack + digest agreement (reconciliation V2 A1), G2.5/G2.6
                      post-install gates, auto-preimage before mutation.
ACCEPTANCE_PACKET   = docs/evidence/product-552-shared-codex-reader-owner-20261023/
                      ACCEPTANCE_PACKET.md §1–§8 (frozen) + §9 (round-2 addendum) —
                      the contract R1–R8, boundaries O1–O5, amendment text §8.
THIS_PACKET         = RELEASE_PREP_B7_BINDING.md — the deployment-line binding freeze.
RELATION            = companion docs-only artifact; changes NO shipped bytes.
```

## WIRING (reader uid/gid — the deployment-line decision this packet freezes)

```text
FACE                = store-writer readerOwner face (SHARED_STORE_READER_OWNER_V1, R1–R8)
                      selected by options.readerOwner = { uid: 502, gid: 20 }.
CLI                 = scripts/agent-credential-rotate.mjs rotate|gate …
                      --reader-uid 502 --reader-gid 20   (paired; validated pre-DB;
                      dangling flags refuse exit 20).
CHANNEL             = ROOT-driven privileged provisioning channel ONLY (R4): the
                      rotation invocation that touches the shared store must run as root
                      (launchd root job or the existing privileged provisioning service).
                      The authsvc-identity producer of the 2026-10-23 07:18 incident is
                      RETIRED for this store — never re-pointed, never fallback (R4
                      refuses non-root loud; no writer-owned fallback path exists).
END_STATE           = file 0600 uid 502 gid 20 exactly; dir 0700 uid 502 gid 20 exactly
                      (CTR-SCA-010 + Owner contract). Temp chowned to reader BEFORE
                      fsync+rename (R2 atomicity); root-owned leftover dir adopted
                      type-scoped (R5); foreign-owned dir refuses with ZERO mutation.
COEXISTENCE         = per-agent stores unchanged (R7): the readerOwner flags are passed
                      ONLY for the shared openai-codex store rotation.
WIRED_IN_TRANSACTION= the rotation launcher change (re-point the scheduled producer to
                      the root channel with the flags above) is part of the SAME B7
                      deployment transaction as the install — installing the build
                      without re-pointing the launcher leaves the incident producer live
                      on a build that still defaults to writer-owned writes.
```

## PREFLIGHT (all must hold before any apply; fresh-read at apply time)

```text
P1  BUILD      install source contains 4729bab (marker: store-reader-owner.js present in
               the packed app tree; rotate CLI present in packed scripts/).
P2  CHANNEL    the privileged rotation channel runs as root; authsvc-identity rotation
               decommissioned for this store in the same transaction.
P3  READER     uid/gid 502/20 confirmed on host (id yanfenma) and passed explicitly via
               --reader-uid/--reader-gid. Never guessed, never defaulted.
P4  STORE_DIR  dir is reader-owned 0700 (current state satisfies this). If a foreign-owned
               shape is found (R5 refusal), converge ONCE out-of-band as operator (the
               2026-10-23 emergency fix is the template), then re-run. No silent adoption.
P5  GATE       agent-credential-rotate.mjs gate (with the reader face) PASS or an
               explicitly receipted reconciliation state before any rotate.
P6  B7_LINE    the install tx runs under the existing Product #414 serialized release
               mandate (single writer, exact operationBinding, preimages bound) —
               NOT as a side channel.
```

## ROLLBACK (three layers, all pre-existing — reused, not redesigned)

```text
L1 CODE        revert the merge commit 4729bab (additive face; per-agent stores never
               depended on it).
L2 STORE       rotation seam preimage .preimage-<operationId>.bak (0600) inside the
               reader-owned dir + channel rollback face (rollbackDbRotation converges DB
               to the store-held generation, receipted, replay-idempotent).
               ROLLED_BACK is receipted ONLY when BOTH the DB rollback AND the store
               restore are proven (round-2 B2: storeRestored gate); restore finalization
               re-owns the backup to the reader via pinned-fd fchown pre-rename (R6/B1).
L3 OPERATOR    the pre-fix manual procedure is unchanged and remains the last resort:
               operator chown reader 0600 file / 0700 dir (the 2026-10-23 emergency fix,
               already proven on this host).
SPLIT_STATE    SPLIT_STATE_OPEN receipt (either direction named) = seam auto-refuses all
               further rotation (unreconciled_rotation) until explicit reconciliation.
               Never replayed over.
```

## STOP_CONDITIONS

```text
S1  R5 foreign-owned directory refusal → stop; one-time operator convergence; re-run
    preflight. Zero mutation by the channel itself.
S2  external_prerequisite_missing(e) → stop; the refusal is itself a valid fail-closed
    proof; wire (e) per AMENDMENT_7 first; never bypassed or retried blind.
S3  any SPLIT_STATE_OPEN → stop; reconciliation only; no new rotation.
S4  any A-step failure → stop the bounded sequence; record receipts; no unbounded retry,
    no identical-command replay.
S5  root channel unavailable → stop; NO writer-owned fallback may ever be introduced.
S6  any step that would read or expose credential CONTENT outside the in-process seam
    → forbidden by construction; all observation steps are metadata-only (stat/ls).
```

## ACCEPTANCE_A1_A6 (bounded production acceptance — executes ONLY in the B7 closure action)

Binding sequence (owner-mandated order, agent-control#1279 command text; command
templates from ACCEPTANCE_PACKET §6):

```text
A1  ONE real rotation of the shared store writes through the canonical path:
    root channel runs scripts/agent-credential-rotate.mjs rotate --agent <agt_*> …
    --reader-uid 502 --reader-gid 20. Receipt in the append-only JSONL (fingerprints
    only). A clean external_prerequisite_missing(e) refusal is a FAIL-PROOF, not a
    pass-substitute; (e) must be live for the real rotation.
A2  Final ownership/mode readback (metadata-only, immediately): file stat ==
    502:staff 100600; dir == 502:staff 40700; no .tmp-*/.lock leftovers; receipt
    operationId matches.
A3  uid 502 immediate read: sudo -u \#502 cat <store> >/dev/null succeeds; a third
    uid (e.g. \#505) fails. Content stays redirected to /dev/null — never displayed.
A4  Next fleet codex turn succeeds: respawned fleet worker completes a real turn with
    no 'Credential store read failed' signature (the incident's exact failure).
A5  Rollback/readback: one injected swap failure in a fixture store observes
    ROLLED_BACK + reader-owned restored preimage (T13b shape) — or, if exercised on
    the real store, the L2 preimage restore re-verified by an A2-shaped metadata
    readback. SPLIT_STATE_OPEN (if it occurs) is handled per S3, never counted as pass.
A6  No credential-content exposure across A1–A5: all observation is metadata-only;
    receipts carry fingerprints only (secret fields structurally rejected); the only
    content reads are in-process inside the seam (Part H red line).
IDEMPOTENCY: repeat A1–A4 once; contract holds after every rotation with zero drift
    (accepted coverage: repeated rotations are idempotent).
```

## DEPENDENCIES (durable — execution is WAIT_SCOPE=INTERNAL_DEPENDENCY)

```text
D1  RELEASE_PATH_SERIALIZATION (load-bearing)
    Production installs into /usr/local/libexec/agent-core go through the existing
    Product #414 [PRODUCT B7] serialized release path under its standing delegation,
    with a single original-session writer. Its latest durable record (2026-10-16)
    holds the v50 candidate at REVISE_REQUIRED and states the serialized release path
    proceeds only after that boundary. Carrying 4729bab into the B7 deploy-source pin
    and executing the install tx is therefore a Product #414 deployment-line
    transaction. This action does NOT create a second deployer and does NOT bypass
    the serialization.

D2  PRIVILEGED_ROTATION_WIRING (load-bearing)
    The current daily codex-store rotation producer runs with authsvc identity
    (incident root cause). Its launcher lives in privileged surfaces not readable by
    this action (the scheduler jobs store /Users/authsvc/.agent-core/scheduler/ and
    the authsvc crontab are root/authsvc-only). Re-pointing it to the root channel
    with --reader-uid 502 --reader-gid 20 — and retiring the authsvc-identity path —
    is a privileged deployment-line/operator step (ACCEPTANCE_PACKET §6 P2/O5). It
    must land in the SAME transaction as the install (see WIRING).

D3  AMENDMENT_SPEC_FILE (non-blocking, release-doc follow-up)
    Contract authority is Owner-accepted at contract level (issue #552 comments
    6386046168 + 6386637512). The amendment text AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V3
    AMENDMENT_READER_OWNER_ROTATION_V1 is frozen in ACCEPTANCE_PACKET §8; the
    docs/specs spec file itself is not yet merged into main. Merging it is part of
    the closure transaction's docs step; its absence does not block the wiring
    contract above because the Owner contract comments are the accepted authority.
```

## PROD_AUTH_STATE (observed 2026-10-25, metadata-only — no credential content read)

```text
STORE_DIR   /Users/authsvc/.agent-core/shared-credentials/openai-codex
            = drwx------ yanfenma:staff (0700) — CONTRACT END-STATE HOLDS (operator
            emergency fix intact).
STORE_FILE  .openai-codex-auth.json = -rw------- yanfenma:staff (100600),
            content mtime 2026-10-22 07:44 — NO rotation has rewritten the store since
            the incident window; the recurrence ("本次 chmod 只能撑到下次轮换") is ARMED
            but has not re-fired as of this fresh read.
BUILD       /usr/local/libexec/agent-core/app @ fa4510be — PREDATES the fix; deployed
            provisioning has NO reader-owner face, NO seam, NO rotate CLI. Every future
            cross-uid rotation from this build reproduces the incident until
            install + wiring land.
READER      uid 502 / gid 20 (staff) — confirmed from the runtime's own spawn contract
            (DSH_AGENT_CHILD_UID/GID in the root LaunchDaemon).
NET         production is currently SAFE-BY-OPERATOR-FIX and UNPROTECTED-BY-BUILD:
            the end state matches the Owner contract, but nothing enforces it across
            the next rotation.
```

## NEXT_ACTION

```text
1  This frozen binding is handed to the existing release owner (Product #414 B7
   deployment line) as the deployment input: artifact = main@4729bab (or accepted
   successor tip), target + wiring + preflight + rollback + A1–A6 exactly as frozen
   here. No re-derivation, no new platform.
2  The B7 closure action executes ONE deployment transaction: install (D1 path) +
   rotation-channel re-point (D2 step) in the same tx, then A1–A6 with receipts.
3  Only after A1–A6 receipts: Product #552 flips INSTALLED=yes → ENABLED=yes →
   BUSINESS_VERIFIED=yes; merge of the D3 amendment spec file rides the same docs
   step. PRODUCTION_MUTATION of THIS prep action remains NO.
WAIT_SCOPE (for execution, not for this prep) = INTERNAL_DEPENDENCY — D1 + D2 above,
   both owned by the existing Product #414 deployment line; no new path invented.
```

PRODUCTION_MUTATION = NO
