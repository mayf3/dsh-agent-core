# Independent review — #547 v2 isolated release preparation

This record transcribes independent read-only agent observations in this session.
It is not a production trust-issuer attestation, acceptance or install mandate.

- Recorder: `/root`; independent artifact/checklist reviewer: `/root/drain_audit`.
- Independent rollback/ITOps reviewer: `/root/rollback_audit`.
- Task parent: `0e0e0327c944216ce9965646e4d9e7d6b6298142`.
- Integration snapshot: `5360707882b4f85813d842037f660f54fd2496c8`.
- Report reviewed by rollback/ITOps reviewer: SHA-256 `6b13809a1572ac47abf11c818302561e87ff09b9dfe6794387fc8f0be8395d32`.
- Archive reviewed independently: SHA-256 `302804005fe9bd7090c8dd027c34b1712ab7912ef52f3245da69ba75d414afa0`.

## Executed artifact observations

`/root/drain_audit` independently recomputed archive SHA and streamed every
member against the candidate manifest: 15,621,483 bytes, 1,704 members (app root
plus 1,703 manifest entries). File contents, size, type, mode and literal symlink
all match. Four Router bytes match exact Git95 blobs. Full candidate/foundation
delta is four Router paths plus provenance. All four gzip/raw manifest hashes
and entry counts match. Harness5,618 links have no lexical escape or absent
logical target in its bound manifest. Versus observed081, only provenance and
two Scheduler paths differ. No payload/installer/runtime was executed.

Result: `ENGINEERING_ARTIFACT_PIN_REVIEW=PASS`.

## Independent rollback and coverage review

`/root/rollback_audit` independently read/hash-checked the archive and embedded
provenance and reviewed the final report. Result: semantic PASS, no concrete
false readiness/scope blocker. It confirmed all of:

- explicit four-blob95 +393 reconstructed composite; not whole-main95;
- current081 prestate and potential two-Scheduler regression disclosed;
- no install admission; full393 rollback remains NOT_READY;
- original393 legacy-reader rejection remains external historical evidence;
- edited-fence snapshot and business-store overwrite proposal excluded;
- limited backup inventory does not claim global absence.

Its sole delivery finding was the not-yet-created link to this review record;
this file closes that materialization finding. Record existence is not a new
production readiness assertion.

## Preserved limits and final binding

`FROZEN_BLOCKER_UNION` for isolated engineering preparation: no semantic blocker
identified by the two reviews above. Production readiness remains NO: full
historical393 backup/old-reader compatibility and current-prestate/artifact
coverage are not satisfied. No whole-system, loaded-byte or business PASS.

The initial source census included development-execution/package.json even
though the official recipe later removes that package and copies onlysrc.
The source-based correction is in source-selection-correction.json; final
349-file unaffected-source check has no mismatch. Candidate bytes unchanged.
The rejected whole-main95 route and explained local harness invocation failures
remain recorded and do not become production or mechanism PASS.

Final report/checklist review and exact committed-Head recheck will be appended
as actual observations; the final-Head receipt is published in PR673 body to
avoid a self-referential commit hash. Candidate and relevant semantics must
remain equal to the reviewed hashes; any delta requires affected-surface check.

## Completed final semantic-material review

`/root/drain_audit` reviewed the report/checklist after selection correction:
`PASS`, `FROZEN_PREPARATION_BLOCKER_UNION=NONE`. Exact report SHA:
`6b13809a1572ac47abf11c818302561e87ff09b9dfe6794387fc8f0be8395d32`.
The reviewer checked pure reader + stable pre/post guards, Node argv, native
adapter read methods, JSON/gzip metadata, and corrected source selection in
exact393 installer937-942/exact95 installer921-926. No production commands,
constructors or QA ran. The sole pending link was this record, now present.

Reviewed material hashes:

- build-composite.py: `6f21ac103c9e1f3bf01d82b6ee3b4fe72eef2bdcbd4e14c1f0b909d786c5cc20`
- collect-preflight.py: `e2d510dc4428948cd13b7030225b2d7dd098e3cd8152f24840d631ca320f8ab2`
- candidate-pin.json: `90440a64495618d5b550d775c189b7c3410fe88723f276e1811fa665545bec0f`

Final committed-Head delta recheck remains a distinct post-commit observation
and will be bound in PR673 body; the above statements do not pre-claim it.

## Evidence presentation delta before commit

`git diff --cached --check` initially returned2 on two blank context lines in
the newly tracked raw unified diff, before commit executed. Original bytes are
preserved in scheduler-context.original.diff.gz. The displayed .diff is now the
actual same fixed-object command with --unified=0, removing context-only blank
lines without changing source edits. collect-preflight.py now emits that same
format (SHA `097b1206d5a1e45d39743ca50ce0f173d6b1deb7178d2eaa24145368d3154d3d`). This is an explained evidence-presentation correction,
not a source/build consistency failure. Report, artifact and manifests unchanged.
The exact committed-Head reviewer must include this mechanical delta.
