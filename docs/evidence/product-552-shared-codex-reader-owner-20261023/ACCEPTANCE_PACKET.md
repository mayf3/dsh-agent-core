# PRODUCT_552_SHARED_STORE_READER_OWNER_V1 — frozen production acceptance packet

```text
STATUS              = FROZEN_ACCEPTANCE_PACKET — PREPARED, NOT APPLIED
PRODUCTION_MUTATION = NO   (this whole action: source + tests + review + this packet only)
MERGE_DEPLOY        = FORBIDDEN from this action — a separate later closure action
                      (Owner acceptance of the amendment below + merge + deployment
                      wiring by the deployment line) is required first.
BRANCH              = ac-task/552-shared-codex-reader-owner
SOURCE_EXACT_HEAD   = 425da336 (round-2 reviewed head; packet frozen on top as docs-only)
BASE                = origin/main 6d96f6d6
```

## 1. ROOT_CAUSE

Product #552 (2026-10-23 07:18 incident): the shared openai-codex credential store
`<deploymentRoot>/shared-credentials/openai-codex/.openai-codex-auth.json` is read by the
fleet worker (uid 502), but the daily token rotation ran the canonical credential
store-writer CROSS-UID (as authsvc, after the deployment-topology migration). The writer's
atomic 0600 write landed **writer-owned** bytes and a writer-owned 0700 directory —
mechanically correct per the old per-agent trusted-CP contract, but destroying the
shared-store ownership contract. Every respawned fleet worker then failed closed:
`EACCES lstat …/shared-credentials/openai-codex/.openai-codex-auth.json`. Workers with
cached tokens kept working (delayed detonation).

Contract authority chain:

- `AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V3` (accepted, governing): CTR-SCA-010 — canonical
  directory reader-owned (yanfenma:staff) 0700, sensitive files 0600, group/world bits 0;
  the dsh-codex reader (uid 502) strict-checks `mode == 600` **and** `owner == its own
  euid` before accepting the credential.
- Issue #552 comment 6354151781 (Owner, corrected operator evidence, verified on-host):
  the original issue proposal `0640 + group:staff` is **INVALID** (codex refuses any mode
  other than 600); the required end state is file mode 0600 **owned by the reader uid**,
  directory owned by the reader at 0700, and **"the rotation write must finalize
  ownership to the reader"** as a hard requirement; the cross-uid writer's directory
  write channel is a deployment-line decision. Emergency operator fix already applied
  on-host (dir+file → yanfenma:staff 0700/0600) — verified during this action
  (metadata-only): dir 40700 yanfenma:staff, file 100600 yanfenma:staff.

Root cause in one line: the canonical store-writer machinery had **no reader-owner
finalization face** — an atomic 0600 write always lands writer-owned, so any cross-uid
writer reproduces the incident on every rotation.

## 2. CONTRACT (as implemented — SHARED_STORE_READER_OWNER_V1)

Additive face on `packages/agent-credential-provisioning/src/store-writer.js`, selected by
`options.readerOwner = { uid, gid }`:

```text
R1  FINAL_STATE       the committed store file is owned by READER (uid/gid) at mode 0600
                      exactly (no group/other/special bits); the store directory is owned
                      by READER at mode 0700 exactly — the V3 CTR-SCA-010 end state; the
                      dsh-codex reader's strict mode+owner check passes.
R2  ATOMICITY         the temp file is chowned to READER BEFORE the fsync+rename commit —
                      the rename lands the final state atomically; readers observe either
                      the preimage or a complete reader-owned generation, never a window
                      with a foreign-owned file at the store path.
R3  FAIL_CLOSED       ANY ownership-finalization failure (temp chown, directory handoff,
                      restore finalization, post-chown verification) refuses the
                      operation; the preimage store stays byte-identical; temp+lock are
                      cleaned. In the rotation seam, a failed restore finalization
                      receipts SPLIT_STATE_OPEN instead of committing an unownable store.
R4  CHANNEL           readerOwner requires the ROOT-driven privileged provisioning
                      channel (non-root writers refuse loud and never fall back to a
                      writer-owned write); mutually exclusive with ownerUid/ownerGid;
                      reader uid must not be root; readerOwner and ownerUid/ownerGid
                      validate against the same trust rules as the existing faces.
R5  DIRECTORY_SAFETY  a root-owned leftover directory (this channel's own artifact) is
                      adopted to the reader (chown + chmod 0700, type-scoped to a real
                      non-symlink directory); ANY foreign-owned directory (e.g. the
                      incident's authsvc-owned shape) refuses loud with ZERO mutation —
                      convergence from that shape is an explicit operator step, never a
                      silent adoption. Directory bits stay exactly 0700: traversal never
                      widened, zero group/other read exposure on the dir or file.
R6  RESTORE_PARITY    the bounded-recovery preimage restore finalizes the backup to the
                      reader (chown + verified stat inside the same store lock, before the
                      atomic rename) — recovery cannot commit a channel-owned store that
                      the reader (and this face's own gate) could never open again.
R7  PER_AGENT_UNCHANGED with readerOwner ABSENT the writer is byte-identical to the
                      accepted Part G trusted-CP face (process identity default,
                      ownerUid/ownerGid trusted-CP nomination, root refused as owner,
                      non-root cannot nominate a foreign owner, all modes/TOCTOU checks
                      unchanged). The read face (readCredentialStoreDocument) gained only
                      fileSystem injectability (default = the same real-fs functions) —
                      all O_NOFOLLOW/nlink/mode/TOCTOU assertions still enforced, and the
                      pre-rename commit-sequence recheck remains non-injectable.
R8  SEAM_GATE_PARITY  the rotation seam's GATE/VERIFY store reads carry the same
                      storeWriteOptions as the swap (owner options flow through) — a
                      reader-owned shared store is gate-readable under its own face, and
                      the gate never falls back to the driver's process identity.
```

Operator CLI face (deployable): `scripts/agent-credential-rotate.mjs rotate|gate …
--reader-uid <n> --reader-gid <n>` (paired, validated before any DB contact; dangling
flags refuse loud).

## 3. CHANGED_SURFACE (exact, at reviewed head 425da336; base 6d96f6d6)

```text
packages/agent-credential-provisioning/src/store-writer.js   +sharedReaderOwner validation
                                                              +readerOwner threading in trustedOwner/
                                                               assertTrustedDirectory (type-scoped adoption)/
                                                               preflightTrustedCredentialDirectory/
                                                               readTrustedStore/readCredentialStoreDocument
                                                               (fileSystem injectable)/trustedCredentialStoreWrite
                                                              +finalizeReaderOwnedRestore (exported)
                                                              +replaceCredentialForAgent docblock
packages/agent-credential-provisioning/src/rotation-seam.js   GATE + VERIFY reads carry storeWriteOptions;
                                                              restore path finalizes reader ownership pre-rename
scripts/agent-credential-rotate.mjs                           --reader-uid/--reader-gid face (rotate + gate),
                                                              validation, usage/header docs
packages/agent-credential-provisioning/test/store-writer.test.js   +7 SHARED_READER_OWNER tests
packages/agent-credential-provisioning/test/rotation-seam.test.js  +T13 gate plumbing, +T13b recovery-under-face

TOTAL: 5 files, 0 spec/docs edits in the source commits, 0 new dependencies, 0 deletions
of existing behavior. GOVERNING_SPEC_UNMODIFIED honored — spec files untouched.
```

## 4. TESTS (observed at 425da336)

```text
agent-credential-provisioning  node --test packages/agent-credential-provisioning/test/*.test.js
                               87 tests: 82 pass / 0 fail / 5 skipped (pre-existing
                               env-dependent: real-PG smoke, cross-repo seam, psql argv,
                               census fixtures — skip on this host by design)
broker (reader of the store)   node --test packages/broker/test/*.test.js  415/415 pass
rotate CLI selftest            node scripts/agent-credential-rotate.mjs selftest  5/5 pass
whole-repo npm test            byte-attributed against a pristine origin/main worktree run:
                               my branch 2634 pass / 98 fail vs pristine 2550 pass / 104 fail;
                               the failure-set diff was exactly 2 candidates, both PROVEN
                               non-regressions (one byte-identical pre-existing on pristine:
                               agent_switch tool-registration TypeError; one load-flaky
                               passing in isolation on BOTH branches: notification-ingress
                               C-IDM-009 W1 real-port SIGKILL timing). The inverse diff is
                               the same flake class in the opposite direction. The 1 failure
                               in agent-provisioning (harness path sanity) also reproduces
                               on pristine at any non-canonical checkout path.
```

Focused acceptance coverage (new; discrimination empirically verified by the reviewer
against the parent commit: the restore-finalization unit test fails at import level on
the parent — helper absent, maximal discriminator — and the chown-attempt discriminator
fails there; T13b passes on the parent exactly as its in-file comment honestly
discloses, with the cross-uid transition delegated to the unit test):

- shared-store rotation finalizes reader-owned 0600 with sibling entries byte-preserved
- directory contract: fresh create reader-owned 0700; root-owned leftover adopted; foreign
  owner refused with zero mutation
- failed temp chown: chown attempted exactly once, preimage byte-identical, zero leftovers
- idempotent repeated rotations: contract holds after every rotation, zero drift
- refusal matrix: non-root writer, root reader, mixed owner options, malformed input — all
  refuse pre-mutation; group-readable store refused (no exposure widening)
- restore finalization: root→reader convergence recorded+verified; failure and mismatch
  refusals; non-root refusal
- T13: the reader face flows through the seam GATE read (injected surface, receipted
  external_prerequisite_missing(e) refusal — fail-closed NOW behavior unchanged)
- T13b: bounded recovery under the reader face lands reader-owned 0600 and the face's own
  gate reads the restored preimage generation

## 5. REVIEW (independent, exact-head, adversarial)

```text
Reviewer          = independent review agent (separate context; adversarial brief:
                    "hunt for a way the store can still end up non-reader-owned or a
                    failed finalization that silently commits")
Round 1 @ d6a6d456 = REVISE / 1 load-bearing blocker:
                    B1 bounded-recovery restore could commit a channel-owned (root)
                    backup under the reader face, bricking the reader gate — plus 8
                    non-blocking notes.
Round-1 fixes     = 425da336 (see §3/§4): finalizeReaderOwnedRestore wired into the
                    restore path pre-rename; type-scoped adoption; chown-attempt
                    discriminator; CLI dangling-flag refusal; gate flag validation
                    before DB contact. Non-blocking notes 3/5/6/7/8 accepted as
                    documented operational boundaries (§7).
Round 2 @ 425da336 = PASS / BLOCKERS = NONE. Reviewer-verified at the exact head:
                    suites green (87 tests / 82 pass / 0 fail / 5 env-skipped;
                    selftest 5/5; CLI dangling-flag probes die exit 20 pre-DB);
                    discrimination probes (new tests fail on the parent commit);
                    and an EMPIRICAL recovery truth table under the reader face
                    ({pre-rename | post-rename swap failure} × {finalize OK/FAIL} ×
                    {rollback OK/FAIL}): in EVERY cell the store at storeFile is
                    owner=reader mode=0600 — clause "no sequence under the reader
                    face can commit a non-reader-owned store inode at storeFile"
                    CONFIRMED.
Residuals (reviewer-tracked, non-blocking):
  N1  compound corner: post-rename swap failure + failed restore finalization
      receipts ROLLED_BACK while the store stays at the NEW generation (still
      reader-owned 0600, loudly thrown, .bak retained, inherited gate refuses next
      contact with split_state_detected) — a PRE-EXISTING error-routing shape this
      delta inherits character-identically; requires two independent exotic
      failures. Recommendation carried to the closure action: when the restore
      step fails, verify whether storeFile still holds the preimage before
      choosing ROLLED_BACK vs SPLIT_STATE_OPEN.
  N2  finalizeReaderOwnedRestore chowns before its verified lstat; a symlink
      planted at the predictable .preimage-*.bak path by an identity that already
      holds the directory's trust (the reader account) would have its TARGET
      chowned before the symlink refusal blocks the rename. Optional hardening
      (lstat-before-chown) carried to the closure action.
  N3  cosmetic: one test-file line merged (test/store-writer.test.js:518);
      functionally identical.
VERDICT CHAIN = REVISE(1 blocker) → fixes → PASS(0 blockers). Packet frozen at the
PASSED head 425da336 — reviewed source is byte-final; N1–N3 are recorded for the
closure action, not patched post-verdict.
```

## 6. RELEASE_PACKET (deployment-line wiring — executes ONLY in the separate closure action)

```text
PRECONDITIONS (all must hold before any apply)
  P1  This branch merged to main by the separate closure action; deployment builds from
      that merge commit (not from this branch/worktree).
  P2  The privileged rotation channel runs as ROOT (launchd root job, or the existing
      privileged provisioning service) — the only identity that may finalize reader
      ownership (R4). The authsvc-identity rotation of the incident MUST NOT be reused.
  P3  Reader identity known: uid/gid of the fleet worker account (incident values:
      502/20 staff). Passed explicitly via --reader-uid/--reader-gid — never guessed.
  P4  Shared store directory state: reader-owned 0700 required. If a foreign-owned
      directory shape is found (R5 refusal), converge it ONCE out-of-band as the
      operator (the incident emergency fix is the template), then re-run.

ACCEPTANCE SEQUENCE (per the issue's acceptance clause "轮换写一次 → uid 502 立即可读 → 下一 turn 成功")
  A1  Selftest + suites on the deployment build (§4 commands).
  A2  Drive ONE rotation of the shared store through the seam with the reader face
      (root channel): scripts/agent-credential-rotate.mjs rotate --agent <agt_*> …
      --reader-uid 502 --reader-gid 20. Refusal path (no (e) channel) is itself the
      fail-closed proof; wire (e) per AMENDMENT_7 when rotating real MachineClients.
  A3  Immediately verify metadata (NO content read): stat == reader:staff 100600; dir ==
      reader:staff 0700; no .tmp-/.lock leftovers.
  A4  uid 502 readability probe: sudo -u \#502 cat <store> >/dev/null succeeds; a third
      uid fails.
  A5  Next fleet codex turn succeeds (no 'Credential store read failed' signature).
  A6  Repeat A2–A5 once (idempotency) and exercise one injected swap failure in a
      fixture store to observe ROLLED_BACK + reader-owned restore (T13b shape).

ROLLBACK
  Code: revert the merge commit (additive face; per-agent stores never depended on it).
  Store: the rotation seam keeps preimage backups (.preimage-*.bak) and receipts; the
  operator-side restore remains the pre-fix manual procedure (chown reader 0600 / dir
  0700) — unchanged by this packet.

MONITORING (optional, issue item 3): alert on the broker signature
  'Credential store read failed' (same agent-control#1257 R3 channel) and on a scheduled
  metadata probe asserting owner==reader && mode==600 within N minutes after each
  rotation window (07:1x).
```

## 7. DOCUMENTED OPERATIONAL BOUNDARIES (accepted review notes, not defects)

```text
O1  Writer-owned (non-root) leftovers (the literal 07:18 incident shape) are NOT
    auto-adopted — R5 refuses them loud; convergence is the one-time operator step
    (already applied on-host 2026-10-23).
O2  Under the reader face the gate/verify/CLI-gate reads converge a ROOT-owned directory
    to the reader as a side effect (this channel's own artifact only); it is not
    separately receipted — acceptable because it is the same privileged channel's
    handoff, never a foreign-owned surface.
O3  On COMPLETED, the preimage .bak stays channel(root)-owned 0600 inside the
    reader-owned directory (unReadable by the worker) — deliberate: recovery artifacts
    belong to the privileged channel.
O4  Cross-uid chown mechanics are not exercisable in CI (no root in tests, forbidden in
    this action): the harness uses reader==process-uid with an injected root identity;
    the cross-uid transition is covered mechanically by fake-surface unit tests and
    finally by acceptance steps A2–A4 on the deployment host.
O5  The dsh-codex plugin's own OAuth token-refresh writer (the 07:1x producer of the
    codex-native file) is an EXTERNAL repo surface — this packet fixes the repository's
    canonical credential store-writer contract and its rotation seam/CLI faces; pointing
    the deployment's shared-store rotation at this face is exactly the deployment-line
    decision the issue assigns (§6 wiring).
```

## 8. AMENDMENT TEXT (to be merged with the closure action — NOT part of this branch)

`AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V3 AMENDMENT_READER_OWNER_ROTATION_V1` (proposed):
records the cross-uid writer topology evidence (Product #552 + comment 6354151781), the
corrected contract (R1–R8 above), and the SHARED_STORE_READER_OWNER_V1 face as the
implementation authority for shared-store rotations whose writer channel is not the
reader uid; CTR-SCA-010's same-uid domain remains the end-state owner/mode authority
(0700 dir / 0600 files, group/world 0) and is now reachable and enforced from the
privileged cross-uid channel. Per-agent trusted-CP store face (CREDENTIAL_PROVISIONING_V1
Part G) unchanged.

```text
ACCEPTANCE_RECORD = PENDING (Owner) — this packet authorizes NOTHING by itself.
PRODUCTION_MUTATION = NO (this action). NEXT = separate closure action: Owner acceptance
→ merge → deployment-line wiring (§6) → A1–A6 evidence → status flip.
```
