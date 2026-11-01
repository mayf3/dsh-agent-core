# D14 R4 stopped implementation checkpoint

Authority is accepted PR601/26178b4f, imported by eb78b169 on production source1921f879. R3's authority stop is closed; the current stop is concrete non-Codex routing regression D14-R4-NONCODEX-001. No deployment or runtime acceptance.

Start with `generation/INDEPENDENT-PARENT-REVIEW-STOP.json` and `generation/INDEPENDENT-NONCODEX-REGRESSION.jsonl`. Current source remains unfixed under the explicit semantic-failure stop. Review independence covers the parent integration; the reviewer's own generation module is excluded from their independent approval.

`copied-artifact-provenance.json` maps each copied evidence file to its original raw path and SHA256. `named-raw-provenance.json` binds the earlier123file run (938tests/62fail/9skip) and is not final stopped-head validation. `protection/coverage-summary.json` distinguishes exact-source, exact-release, mocks and UNKNOWN installed Harness/Core facts. The reusable runner is under scripts/d14 and never emits a production qualification record.

The actual final checkpoint commit is recorded in the PR/issue, avoiding a self-referential SHA in this file. SHA256SUMS covers the files present at this checkpoint; later receipt-only additions get their own explicit coordinate.
