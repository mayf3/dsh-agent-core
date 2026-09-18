## Global Constraints

- No privileged installation, login, retry, service operation, sudoers modification,
  lock deletion, key generation or package/installed-runner replacement in this work.
- Preserve exact failed package fe3d6711df190b76de32cabf3607b6de12f575803f213d6603ee1eb264c5b065,
  plan7c516b2f349226b258e5289cd5c8ac3e9c879ae19d9ecf5d0c284698598895ab and
  attempt genesis-65559dd-20260918-01. A future request retains this same attempt.
- The failure happened before any InstallStep. Protected diagnostic confirmed
  journal contains only root0600 zero-byte flags0 bootstrap.lock. sudoers is
  root0440 single-link flags32 with old mtime/ctime. No identities/state/keys/plist.
- No blanket flags/xattrs permission relaxation; no change to generic artifact trust.
- No unrelated R02/closed findings, future multi-resource debt, or new Goal.
- Tests are nonroot disposable fixtures; no real privileged files are read by tests.

### Task 1: Correct the read-only sudoers census

Work in packages/deployment-control-plane. First add a real macOS compressed-file
regression proving the current sudoers census reader rejects a safe compressed
fixture. Suggested fixture: create ordinary compressible text in kernel private temp
and Apple ditto --hfsCompression to a separate file; prove flags32 and byte readback.
Use an existing production census reader entry, factoring narrowly if necessary;
retain RED command/output before implementation. Never alter real /private/etc.

Introduce the smallest census-only reader preserving descriptor/no-follow/path
owner rules, root UID/GID in native invocation, regular/single-link/nonwritable
metadata, ACL rejection and allowed xattrs. Permit only UF_COMPRESSED (0x20) for
existing configuration census. Read bounded logical bytes twice from the same
opened fd; check metadata/flags/xattrs before/after and stable bytes. Use it only
for sudoers and its explicitly parsed include graph. Keep ordinary artifact,
key/grant/executable readers strict. Keep include syntax/cycles/count fail closed.

Add negative tests for links/unsafe writable metadata/disallowed flags/xattrs,
size limits and artifact rejection of the compressed fixture. Make minimal
phase-specific error context so the same census failure is attributable without
printing secret/config contents; only if it can preserve existing error contracts.
Do not add an arbitrary root read API or a generic resume/override flag.

Run focused tests, full Rust suite, fmt, strict Clippy and release build; retain
exact logs and self-review. Commit only your source/test files; controller owns
documents and operation reports. Report scope and test provenance.


Read .agents/README.md before code. Existing isolated worktree is the only write surface. Governing authority and initial preflight are in the plan; current base is eb7e72f2bc75c8842492b2b90cac31263dd583ea. Keep new Rust files under500lines and directories within limits.
