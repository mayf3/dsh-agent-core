# #1257 source verification evidence

Base `0386b34a3d1054c71cbe51a2310fdff4d55c992b`; reviewed source
`38b705a6b2cdd62969bef18b31e69ab974bbc261`. This is non-authoritative execution
Evidence, with no production installation/recovery/merge claim.

- `source-coordinates.json`: exact source paths/hashes and isolation.
- `independent/INDEPENDENT_REVIEW.{md,json}`: nonauthor exact-source PASS,
  closed blocker union, executed probes and limitations.
- `comparison-final.json`: full matched comparison, net76 new passing tests,
  identical157 failing names,38 skips each; two explicit R1 behavior updates.
- `comparison-name-scan.json`: original raw name scan before those two known
  replacements were mapped. Its FAIL_COMPARISON classification is retained
  as history, not the final coverage conclusion.
- `baseline/warm-node25/` and `candidate-matched-node25/`: complete summaries,
  failing names/diagnostics, compressed raw TAP, clean environment and PG stop.
- `candidate-node25/`: first path-topology-mismatched full run (160 failures,
 35 skips), preserved as noncomparable. The independent topology addendum
  explains automatic harness discovery; no skip flags or tests were changed.
- `r1/`, `r2/`, `r3/`: executed RED/GREEN and affected regression evidence.
- `structure-source.json`: zero new structure violations,32 baseline debt.
- `baseline/pg-fixture-*`: isolated test-only PostgreSQL schema provenance;
  tests ran and existing fixture failures remain visible. No production DB.

Full suites are FAIL_WITH_SHARED_BASELINE_DEBT, not all-green. The independent
matched-comparison receipt confirms no new failing name or unmapped removed
coverage. Real harness, actual UID502/505 resource acceptance, producer-first
rollout, live fence/admission recovery and business acceptance remain separate.

The reproducible runner is a session evidence helper that expects this task's
isolated PG setup/metadata paths. It is not a production CLI. Root dependencies
were installed without lifecycle scripts/lockfile changes; the test passthrough
and local package bridge are disclosed in environment summaries.

Raw `.tap.gz`, `.log.gz` and `.sql.gz` files are lossless gzip; extract with `gzip -dc <file>`. Validate
all archived bytes from this directory with `shasum -a 256 -c MANIFEST.sha256`.
The source tests themselves provide the fixture construction and CLI commands.
