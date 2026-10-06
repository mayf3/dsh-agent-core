# INDEPENDENT_REVIEW_V22 — B7 SHARED_CODEX_DEPLOYMENT_ROOT_REFREEZE_V2.2 packet

> Independent changed-surface review of the v2.2 repair lane · 2026-10-02 · Product #414 ·
> agent-control#194 (non-production repair lane; PRODUCTION_MUTATION = NO).
> Reviewed head: **73861307** (branch `svc/b7-v22-packet-repair-20261002`; source pin
> b78aa30a / tree d5fb04c9). Reviewer: independent pass (fresh reader of every changed
> byte; all mechanical gates re-run by the reviewer itself).

## Verdict

```text
INDEPENDENT_REVIEW_V22 = PASS
SHIP_BLOCKERS = 0
LOAD_BEARING_GAPS = NONE
SCOPE_DISCIPLINE = PASS
```

Scope discipline (reviewer-verified): `c25278e1..73861307` touches only the 9 declared
source files (installer + gate lib + 2 new tests + 5 vendored files) + 8 evidence files;
the three repairs map 1:1 to the two proven #193 defects plus the gate-proven
development-execution gap (verified live: `packages/development-execution` has no
package.json and is relatively imported at
`packages/production-runtime/src/development-execution-runtime.js:13`); no broad refactor,
no governing-spec edits (`docs/specs` delta = 0 at both commits), no production mutation in
lane bytes (generators/selftests confine writes to /tmp; production reads are read-only),
backups untouched.

## Reviewer's substantive verifications

- **Installer §3/§3b/§5b**: vendored copy placed after the §3 dep loop with a pre-flight
  existence check exiting 2 before `rm -rf`; §3b runs after app closure + bridges + deps
  and BEFORE §4/§5b/§6 (no ownership side effect can precede it); §5b find exclusions cover
  both pinned dirs and their contents (`-path X` + `-path X/*`; `*` crosses `/` in BSD
  find), control/ root and non-pinned children (e.g. control/turn-recovery-v3.json) still
  receive the blanket (reader-gid 601 contract untouched); pin-assert = chgrp -R 20 on
  existing / mkdir+chown 505:20+chmod 700 on missing; workspaces+homes 502-owned 0755,
  agents.json symlink and root 711 unchanged.
- **RUNTIME_APP_GRAPH_GATE_V1**: driver argv index correct (process.argv[2]); env/cwd
  throwaway-only with no --root; classification regex matches Node's actual
  "Cannot find package 'X' imported from Y" wording; non-resolution errors and timeouts
  fail closed (SIGKILL + close await); spawn-error cannot deadlock; process.exit(0) after
  the marker kills import-time handles.
- **Executor v2.2**: EXPECTED_SHA/TREE verified against git (= b78aa30a / d5fb04c9);
  G2.6 sits after G2.5 with no restart anywhere in the script; RESTORE-R2 command text
  identical in all 6 occurrences (installer §8; executor header/deploy-comment/3 dies;
  packet §6); v2.1 byte_provenance_verdict fix intact and still self-tested.
- **Digests**: all §4 rows independently recomputed and MATCH (executor cc993d92…,
  installer ad491b79…, gate lib 6603818c…, new tests 451a57f3…/2d677b2a…, vendored 5 files
  3568fa0b/4ade5fad/56f33d23/cff70853/7b7c2579, RED/GREEN 0dfb8538/d3ab7b79, generators
  93336f90/f35360a3); unchanged-by-design rows match at this tree (closure gate af43b337…,
  canary b737d6b4…, v2 tests af364c01…/5db9419b…); MANIFEST.sha256 -c 11/11 OK at the
  reviewed head; vendored-vs-live byte identity independently confirmed (all 5 live files
  digest-identical).
- **Mechanical (re-run by the reviewer)**: bash -n OK; installer --selftest-provenance
  PASS (T1a–T8); `node --test scripts/lib/*.test.mjs` = 27 tests / 26 pass / 0 fail /
  1 skip (closure-resolution-gate 9 = 8p+1s; fresh-child-canary 4 = 4p;
  runtime-app-graph-gate 7 = 7p; watchdog-ownership 7 = 7p); executor --selftest PASS;
  executor --selftest-repair PASS rc=0 (echo#3 RED+GREEN, RESTORE-R1 RED+GREEN, G2.6
  RED+GREEN, RESTORE-R2 RED+GREEN via the real readPrivateFile, contract markers). No
  command required root or wrote to /usr/local or /Users/authsvc.

## Non-blocking notes (all 6) and absorb disposition

1. §4 forward-references this review file before it existed → **ABSORBED**: this file +
   its MANIFEST row land in the absorb commit (the merge head carries both).
2. Suite-count attribution drift (packet-commit message + log labeled the 27/26/1
   four-suite total as "new suites") → **ABSORBED**: execution-log section corrected in
   place (this lane's own section, pre-publication); correct split = NEW 14/14/0 +
   existing 13 = 12p/1s/0f. The already-written packet-commit message is immutable; this
   record + the corrected log are the authority.
3. G2.6 die references RESTORE-R2 by name without inlining the command (the two
   restore-path dies inline it) → **ABSORBED (wording)**: packet §6 now states the exact
   carry shape. Executor bytes unchanged on this point.
4. --selftest reads the live trusted app's durable-file module (read-only, inherited
   verbatim from the v2.1 executor) while the header said "no production access" →
   **ABSORBED (comment-only)**: executor header now states the read-only production-path
   read; --selftest-repair confirmed fully hermetic by the reviewer.
5. §3b invokes the gate without --timeout-ms (60s default vs the 120s used in evidence
   and G2.6) → **RECORDED, NOT ABSORBED**: fail-safe direction (slow cold import fails
   closed, re-runnable); changing installer bytes post-review would move the pin for zero
   safety gain. The next pin movement may align the value.
6. red-green-ownership.sh requires $DAMAGE_GID exported and a non-20 secondary group →
   **RECORDED**: environment-dependent by design; the evidence header records the exact
   invoking identity (uid=502, primary gid 20, damage gid 599) and degrades visibly.

Absorb commit: zero semantic delta from the reviewed head 73861307 (comment/wording
precision + this record + MANIFEST rebind; suite numbers and all digests re-verified after
the absorb edits; executor --selftest/--selftest-repair re-run PASS).
