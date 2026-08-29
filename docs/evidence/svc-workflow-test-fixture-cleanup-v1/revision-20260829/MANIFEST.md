# Evidence manifest — 残留 修订 (revision round), 2026-08-29

Directory: `docs/evidence/svc-workflow-test-fixture-cleanup-v1/revision-20260829/`
Report: `docs/reports/svc-workflow-test-fixture-cleanup-revision-v1.md`

## Artifacts

| File | Content |
|---|---|
| `run-svc-workflow-test-fixture-cleanup-v2.sh` | NEW_RUNNER archived copy — byte-identical to `/tmp/run-svc-workflow-test-fixture-cleanup-v2.sh` (sha256 `b77802236525bb8fd22bdf7f94e59b777e208f30ef7b24aa0a475c894bbd21d6`) |
| `sha256sums.txt` | sha256 of OLD_RUNNER (unchanged, `9cf26d42…391a7`), NEW_RUNNER, and the TESTVARIANT |
| `probe.sql` / `probe-lifetime-scan.txt` | read-only production probe: per-table lifetime-set vs allowlist equality (all 13 tables equal; extra=0 missing=0), shape-assumption checks, receipt key split (19 uuid-v4 + 6 fixed), 19-title multiset, role privileges |
| `snapshot.sql` | snapshot queries reused for pre/post checks: 18-table whole-table count+md5, 18 non-internal trigger states, whole-DB max(created_at) |
| `dryrun-v2-production-echoed.txt` | Test A: v2 DRYRUN full-path transcript on production (`RESULT: DRYRUN PASSED`, P2b report TOTAL 224/224 extra=0 missing=0, ROLLBACK) |
| `snapshot-A-pre.txt` / `snapshot-A-post.txt` / `snapshot-A-pre-post.diff` | Test D: production snapshots before/after the DRYRUN — diff = 0 lines |
| `snapshot-FINAL-production-recheck.txt` | end-of-round production re-snapshot (after all disposable-DB tests + container teardown) — byte-identical to `snapshot-A-pre.txt` |
| `snapshot-B-testdb-restored.txt` | disposable-copy fidelity: restored DB snapshot == production snapshot (only auth_ro ACL grant errors during restore, data digest-proven) |
| `pgrestore.txt` | restore transcript (missing-role `auth_ro` GRANT errors only — pre-existing ACL noise, no data impact) |
| `initdb.txt` | environment note: local `initdb` fails on this macOS (SysV shm limits, shmmax=4MB) → disposable cluster moved to Docker postgres:16.14-alpine |
| `test.env` | TEST-ONLY env file (dummy credential, disposable container DSN 127.0.0.1:5433) |
| `run-svc-workflow-test-fixture-cleanup-v2-TESTVARIANT.sh` | TESTVARIANT runner = v2 with EXACTLY ONE line changed (`ENV_FILE` → test.env); never pointed at production |
| `testvariant-pristine-dryrun.txt` | harness self-check: variant DRYRUN on the UN-injected disposable copy = PASS (behaves like production) |
| `island-injection.txt` | Test B: real `cargo test --test 23_global_coordinator` (9/9 passed) run against the disposable copy with `TEST_DATABASE_URL`; island inventory; P2b abort evidence; zero-write post-check (224 allowlist present + island present + 0 triggers disabled) |
| `testvariant-island-dryrun.txt` | Test B transcript: `P2b … EXTRA_FIXTURE_ROW_COUNT=224 … drifted_tables=13`, exit 3, `RESULT: FAILED (transaction rolled back; zero rows committed)` — abort BEFORE any trigger disable / DELETE |
| `drift-c1-missing.txt` / `testvariant-c1-missing-dryrun.txt` | Test C1: one allowlist domain_role_binding row deleted → `P1 domain_role_bindings: allowlist present=12 expected=13`, exit 3, zero commits |
| `drift-c2-changed.txt` / `testvariant-c2-changed-dryrun.txt` | Test C2: one allowlist principal renamed → `P3 principals: 1 allowlist rows fail pattern proof`, exit 3, zero commits; plus P2b-view of the same drift (lifetime=23 allowlist=24 missing=1) |
| `allowlist-temp-tables.sql` | helper: the 13 `allow_*` temp-table INSERT blocks extracted verbatim from the sealed v1 runner (probe/snapshot input only) |

## Notes

- Transcript artifacts (`*.txt` — six of them renamed from `.log` to `.txt` because .gitignore line 3 ignores `*.log`; content untouched — and the generated `allowlist-temp-tables.sql`) are
  whitespace-normalized for repo hygiene (trailing blanks stripped from psql table borders /
  EOF blank lines); content is otherwise verbatim. Scripts (`*.sh`, `probe.sql`, `snapshot.sql`,
  `test.env`) and the archived runner are byte-exact.
- All in-repo byte-identity claims (snapshot pre==post==final, archived runner == /tmp runner)
  were re-verified AFTER normalization.

## Intentionally NOT committed

- `/tmp/svc-workflow-p2b-revision/prod-snapshot.dump` (3.2 MB pg_dump custom-format copy of the
  production dogfood DB — used only to build the disposable container copy; kept in /tmp, never
  added to the repo).
- The disposable Docker container `svc-workflow-p2b-test` was removed after the tests
  (`docker rm -f`); port 5433 binding released.
