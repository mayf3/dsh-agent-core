# RECEIPT-VERIFIER-ADAPT

Status: R2 corrected delivery gates PASS; source adaptation ready for the authorized
commit/push/open-PR sequence. No merge or production operation is authorized.
The containing commit identifies this receipt's final delivery tree; its exact
SHA, independent final-HEAD delta result and PR readback are recorded in the PR.

## Authorization, coordinates and route

- Issuer: user R2 continuation, 2026-11-07, resuming Owner disposition #2 after
  PR #642 main merge. Target: `mayf3/dsh-agent-core`.
- Worktree: `/private/tmp/h-verifier-adapt`; single writer branch:
  `chore/verifier-post-retirement-adapt`.
- Parent/base, current HEAD during R2 gates, and freshly fetched `origin/main`:
  `4f7df01bcf087075c114901a96a7a54573110f61`. No rebase.
- Route reused from `BRIEF-VERIFIER-ADAPT.md`: REUSE / BRIEF / DURABLE;
  IMPLEMENTATION; AUTHORITY_ACCEPTED_IN_BASE=YES; SPEC_GAP_DEPENDENCY=NONE.
- Primary authority: accepted `CODE_STRUCTURE_GUARDRAILS_V3`, absorbed V2 and
  CTR-V3TE-001..004; separate implementation authority:
  `CODE_STRUCTURE_VERIFIER_CONFORMANCE_V1` (`implementation_authority: contracts`).
  V3 remains a `repository_local_rule` with `implementation_authority: none`.
- R2 explicitly removes whole-repository `npm test` from this task's delivery
  gates. This supersedes only the npm-based R1 delivery stop. The historical
  `STOPPED-VERIFIER-ADAPT.md` and all R1 logs remain unchanged locally.
- Corrected gates: (1) existing 41/41 unit rc0, (2) existing expected-red negative
  controls, (3) fresh adapted CLI on actual main HEAD and forged/broken lifecycle
  samples with raw output, (4) scoped diff self-check.
- Required unexpected failure still stops delivery. Expected rejection of a
  deliberately invalid sample is a successful negative control.

## Adaptation and source binding

Native authority parsing now separates real V2 fenced metadata from V3/TE YAML;
it validates accepted V3 identity/provenance, both retired predecessors and
reciprocal backlinks, preserved V1-to-V2 history, and exact carried-block hashes.
Comparison-base binding prevents candidate self-activation. The exact installer
transition is consumed from accepted V3 without renewing the grant: path, blob
pair, modes, whitelist-only diff, 1315-line debt, fixed baseline, caps, registry,
affected-surface rules and anti-evasion retain their existing predicates.
Existing wire labels remain, with explicit `governing_authority` metadata.
Historical TE tests read an immutable proposed source rather than current retired
prose; new tests cover the accepted retired chain and its negative cases.

The five working-file hashes below match R1 exactly. No code was repaired or
changed during R2. These bytes bind both the reused 41-test run and fresh R2 CLI.

| File | SHA-256 |
|---|---|
| `scripts/verify-code-structure.mjs` | `f4d31dbd7d4d648f18856707e6fd599e043a4df2bdf37a7b66381e7d6d9d7565` |
| `scripts/governance/code-structure-authority.mjs` | `2b4288df8bd037b39de95086a056dd9a260193eda5023b764c52dbb7124b8d26` |
| `examples/code-structure/verify-code-structure-retirement.test.mjs` | `aa9ba4d2652f9161a84300285f432bc68c22633c07c3fd1ba40218ca19e389b9` |
| `examples/code-structure/verify-code-structure-test-support.mjs` | `9f5e20e9ab2af7e801ee9914c02b070dea26cfdd25769c6c70c4895ef92b492d` |
| `examples/code-structure/verify-code-structure-transition.test.mjs` | `9dcaf14fa83333f99924d34d669089935f31a81f80a20ad3f5ea245ff9d8fa82` |

## Gate 1: retained complete unit run

Command, in the worktree on the parent/base above, with the five bound working
files; Node v26.7.0. Actual rc=0; 41/41, no fail/cancel/skip. This is R1 evidence
reused after byte verification, not a claimed second execution.

```sh
node --test examples/code-structure/verify-code-structure-retirement.test.mjs examples/code-structure/verify-code-structure-review-regressions.test.mjs examples/code-structure/verify-code-structure-transition.test.mjs examples/code-structure/verify-code-structure.test.mjs
```

Unmodified stdout:

```text
✔ new main recognizes V3 and preserves all 28 debt identities and registry bytes (2554.192167ms)
✔ malformed, forged and contradictory lifecycle chains fail closed at both coordinates (7415.780917ms)
✔ candidate document changes and self-activation cannot create an exception (1898.787042ms)
✔ V3 carries the exact transition without restarting it or waiving other 500-line failures (2878.703792ms)
✔ current lifecycle preserves density, disguise, fixture, depth and registry guards (1694.536625ms)
✔ sibling addition does not affect file debt, but overfull directory width remains a violation (2069.315208ms)
✔ package manifest content edits affect depth only when nearest module root changes (1896.140084ms)
✔ NUL-delimited Git paths preserve Unicode, quotes, tabs, and newlines as affected paths (969.576083ms)
✔ moving an over-limit in-scope file to excluded docs or an unsupported extension stays blocked (2039.407583ms)
✔ moving an over-limit file with a small comment edit to excluded docs stays blocked (975.054583ms)
✔ registry expiry must be strictly future and malformed roots or entries exit 2 (1978.083667ms)
✔ standard named-import barrels and duplicate implementations retain their signals (870.708667ms)
✔ allowlisted generated files are excluded from handwritten limits (952.141916ms)
✔ debt identity includes its measured rule metric and text output lists debt paths (2820.187916ms)
✔ resolved directory evidence reports the existing head directory and exact child count (805.5005ms)
✔ exact accepted tuple passes only the candidate delta and preserves installer debt (1838.076667ms)
✔ a changed base blob invalidates the exception even when the exact head blob matches (1156.376417ms)
✔ a same-line head modification fails rather than refreshing the blob registration (1158.442459ms)
✔ an extra line in the head fails rather than refreshing the blob registration (1141.739333ms)
✔ a no-growth edit elsewhere in the head fails rather than refreshing the blob registration (1150.898167ms)
✔ mode change invalidates the exception despite an exact content pair (1058.646167ms)
✔ absent transition authority retains V2 behavior for the exact content pair (952.272875ms)
✔ proposed transition authority retains V2 behavior for the exact content pair (970.051041ms)
✔ an unrelated oversized file still fails while the exact transition matches (1060.567125ms)
✔ unrelated affected invalid-cap debt remains a hard violation (1013.6015ms)
✔ edit of an accepted transition registry fails closed (955.731166ms)
✔ remove of an accepted transition registry fails closed (933.495959ms)
✔ the transition cannot authorize a later edit once the new blob is the comparison base (1074.505625ms)
✔ the exact blob pair on another path cannot borrow the installer exception (1059.296041ms)
✔ reports exact coordinates and unchanged 797/824 authority debt without granting the cap (790.016667ms)
✔ fails when the 797/824 debt path is affected and remains over 500 lines (688.324041ms)
✔ rejects registry deltas as configuration failures (434.747042ms)
✔ rejects a newly added handwritten file over 500 lines (716.919166ms)
✔ keeps an under-cap legacy edit that does not grow or cross the major-change threshold (684.402208ms)
✔ reports deleted inherited debt as resolved at the exact head (659.714917ms)
✔ treats rename as resolution of the old finding plus a new over-limit violation (697.184958ms)
✔ rejects major edits to an over-limit legacy file even when its line count is unchanged (676.137791ms)
✔ rejects depth, directory width, generated claims, fixture hiding, dense lines, and barrel inflation (1054.778209ms)
✔ fails closed on a malformed registry present at both comparison coordinates (387.27625ms)
✔ fails closed for unknown schema, wrong anchor, duplicate paths, and expired entries (1100.595667ms)
✔ rejects an unaccepted structural rule and unresolvable comparison refs (425.724792ms)
ℹ tests 41
ℹ suites 0
ℹ pass 41
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 16478.793833
```

Stderr: empty. Full provenance: `docs/reports/verifier-adapt-20261107/structure-tests.command.json`.

## Gate 2: retained new expected-red controls

These raw R1 stderr streams are reproduced without rewriting. Each actual rc=2
matches its expected configuration/authority rejection. Exact base/head OIDs,
argv, fixture cwd and time are in `controls/<name>.command.json` under the local
evidence directory; no fixture acceptance constitutes Owner acceptance.

`v2-backlink` — rc2, unmodified stderr:

```text
verify-code-structure: V2 retirement or reciprocal backlink invalid
```

`te-backlink` — rc2, unmodified stderr:

```text
verify-code-structure: TE retirement or reciprocal backlink invalid
```

`v2-still-accepted` — rc2, unmodified stderr:

```text
verify-code-structure: V2 retirement or reciprocal backlink invalid
```

`te-still-accepted` — rc2, unmodified stderr:

```text
verify-code-structure: TE retirement or reciprocal backlink invalid
```

`v3-proposed` — rc2, unmodified stderr:

```text
verify-code-structure: V3 or V2 authority not accepted
```

`forged-actor` — rc2, unmodified stderr:

```text
verify-code-structure: invalid V3 accepted authority metadata: accepted_by
```

`forged-review` — rc2, unmodified stderr:

```text
verify-code-structure: invalid V3 accepted authority metadata: accepted_reviewed_semantic_head
```

`wrong-authority-kind` — rc2, unmodified stderr:

```text
verify-code-structure: invalid V3 accepted authority metadata: authority_level
```

`duplicate-status` — rc2, unmodified stderr:

```text
verify-code-structure: malformed or duplicate authority metadata
```

`duplicate-native` — rc2, unmodified stderr:

```text
verify-code-structure: malformed or duplicate V2 native metadata
```

`missing-predecessor` — rc2, unmodified stderr:

```text
verify-code-structure: V3 reciprocal predecessor set invalid
```

`duplicate-predecessor` — rc2, unmodified stderr:

```text
verify-code-structure: V3 reciprocal predecessor set invalid
```

`successor-tail` — rc2, unmodified stderr:

```text
verify-code-structure: invalid V3 accepted authority metadata: superseded_by
```

`cap-spoof` — rc2, unmodified stderr:

```text
verify-code-structure: V3 carried policy drift: V2_POLICY
```

`anchor-spoof` — rc2, unmodified stderr:

```text
verify-code-structure: accepted rule thresholds or fixed anchor do not match the verifier
```

`broadened-tuple` — rc2, unmodified stderr:

```text
verify-code-structure: V3 carried policy drift: TE_CONTRACTS
```

`missing-v2` — rc2, unmodified stderr:

```text
verify-code-structure: V2 authority missing native fenced metadata
```

`missing-te` — rc2, unmodified stderr:

```text
verify-code-structure: TE retirement or reciprocal backlink invalid
```

`missing-v3` — rc2, unmodified stderr:

```text
verify-code-structure: V3 or V2 authority not accepted
```

`candidate-authority-edit` — rc2, unmodified stderr:

```text
verify-code-structure: active V3 authority chain changed between base and head: v3
```

`candidate-self-activation` — rc2, unmodified stderr:

```text
verify-code-structure: candidate cannot activate or replace comparison-base authority
```

`v3-registry-mutation` — rc2, unmodified stderr:

```text
verify-code-structure: registry or generated allowlist changed between base and head
```

Additional structural negatives retain actual rc1. The following are verbatim relevant stdout excerpts (the full JSON is retained locally):

`v3-other-501` — rc1:

```text
  "candidate_result": "CANDIDATE_DELTA_FAIL",
      "rule": "NEW_FILE_OVER_500",
```

`v3-no-grant-restart` — rc1:

```text
  "candidate_result": "CANDIDATE_DELTA_FAIL",
      "rule": "TRANSITION_EXCEPTION_MISMATCH",
```

`v3-anti-evasion` — rc1:

```text
  "candidate_result": "CANDIDATE_DELTA_FAIL",
      "rule": "STATEMENTS_PER_LINE",
      "rule": "STATEMENTS_PER_LINE_BASELINE",
      "rule": "STATEMENTS_PER_LINE_BASELINE",
      "rule": "STATEMENTS_PER_LINE_BASELINE",
      "rule": "STATEMENTS_PER_LINE_BASELINE",
      "rule": "STATEMENTS_PER_LINE_BASELINE",
      "rule": "STATEMENTS_PER_LINE_BASELINE",
      "rule": "STATEMENTS_PER_LINE_BASELINE",
      "rule": "STATEMENTS_PER_LINE_BASELINE",
```

## Gate 3: fresh targeted CLI on actual new-main tree

This is a fresh R2 execution, not just fixture-test reuse. The adapted working
runner above was invoked on the actual worktree's exact current HEAD/current
main. It reads Git trees, not uncommitted authority documents. Text invocation:

```sh
node scripts/verify-code-structure.mjs --base 4f7df01bcf087075c114901a96a7a54573110f61 --head 4f7df01bcf087075c114901a96a7a54573110f61
```

Actual rc=0; unmodified stdout:

```text
verify-code-structure: CANDIDATE_DELTA_PASS_WITH_BASELINE_DEBT (base=4f7df01bcf087075c114901a96a7a54573110f61 head=4f7df01bcf087075c114901a96a7a54573110f61)
  governing authority: CODE_STRUCTURE_GUARDRAILS_V3 (.agents/local/CODE_STRUCTURE_GUARDRAILS_V3.md)
  candidate violations: 0; baseline debt: 28; resolved debt: 0
  BASELINE_DEBT [UNREGISTERED_LEGACY_DIRECTORY] "packages"
  BASELINE_DEBT [INVALID_FILE_EXCEPTION_AUTHORITY] "packages/agent-credential-provisioning/test/provisioning.test.js"
  BASELINE_DEBT [UNREGISTERED_LEGACY_TOUCHED] "packages/agent-provisioning/test/provisioning.test.js"
  BASELINE_DEBT [FILE_OVER_FIXED_BASELINE_CAP] "packages/agent-router/src/binding-store.js"
  BASELINE_DEBT [UNREGISTERED_LEGACY_TOUCHED] "packages/agent-router/src/reconciliation/store.js"
  BASELINE_DEBT [INVALID_DIRECTORY_EXCEPTION_AUTHORITY] "packages/agent-router/test"
  BASELINE_DEBT [UNREGISTERED_LEGACY_DIRECTORY] "packages/agent-router/test/process-lifecycle"
  BASELINE_DEBT [UNREGISTERED_LEGACY_DIRECTORY] "packages/broker/test"
  BASELINE_DEBT [UNREGISTERED_LEGACY_TOUCHED] "packages/broker/test/forum-capabilities.test.js"
  BASELINE_DEBT [FILE_OVER_FIXED_BASELINE_CAP] "packages/broker/test/transport.test.js"
  BASELINE_DEBT [UNREGISTERED_LEGACY_TOUCHED] "packages/development-execution/test/development-execution.test.js"
  BASELINE_DEBT [FILE_OVER_FIXED_BASELINE_CAP] "packages/feishu-connector/src/bridge.js"
  BASELINE_DEBT [INVALID_DIRECTORY_EXCEPTION_AUTHORITY] "packages/feishu-connector/test"
  BASELINE_DEBT [UNREGISTERED_LEGACY_DIRECTORY] "packages/production-runtime/src"
  BASELINE_DEBT [INVALID_DIRECTORY_EXCEPTION_AUTHORITY] "packages/production-runtime/test"
  BASELINE_DEBT [UNREGISTERED_LEGACY_TOUCHED] "packages/production-runtime/test/model-overrides.test.js"
  BASELINE_DEBT [UNREGISTERED_LEGACY_DIRECTORY] "packages/production-runtime/test/scheduler"
  BASELINE_DEBT [UNREGISTERED_LEGACY_TOUCHED] "packages/scheduler/src/scheduler.js"
  BASELINE_DEBT [UNREGISTERED_LEGACY_DIRECTORY] "packages/scheduler/test"
  BASELINE_DEBT [UNREGISTERED_LEGACY_TOUCHED] "packages/session-history/test/session-history.test.js"
  BASELINE_DEBT [DIRECTORY_OVER_CEILING] "scripts"
  BASELINE_DEBT [UNREGISTERED_LEGACY_TOUCHED] "scripts/agent-core-backup-ops.sh"
  BASELINE_DEBT [UNREGISTERED_LEGACY_TOUCHED] "scripts/agentcore-cron.mjs"
  BASELINE_DEBT [UNREGISTERED_LEGACY_TOUCHED] "scripts/fleet-window/stage_06_v2.py"
  BASELINE_DEBT [UNREGISTERED_LEGACY_DIRECTORY] "scripts/lib"
  BASELINE_DEBT [UNREGISTERED_LEGACY_DIRECTORY] "scripts/lib/hr-s256-one-shot"
  BASELINE_DEBT [UNREGISTERED_LEGACY_TOUCHED] "scripts/lib/watchdog-payload-snapshot.mjs"
  BASELINE_DEBT [INVALID_FILE_EXCEPTION_AUTHORITY] "scripts/trusted-cp-deploy-install.sh"
```

Stderr: empty. A second invocation with `--json` also returned rc0. Its complete
`baseline_debt[]` equals R1 `controls/main-self.stdout` byte-derived JSON values;
28 inherited debts, 0 resolved, 0 candidate violations. This is
`CANDIDATE_DELTA_PASS_WITH_BASELINE_DEBT`, not a repository-wide clean result.

Fresh isolated tampered clone: `/var/folders/jh/5k4x44w12ps1kbrch8__f6b80000gp/T/h-verifier-r2-controls-xkwydj_1/repo`.
Both mutations start with the same accepted main contents; fixture commits do
not modify this delivery branch or confer any authority.

- Forged acceptance: replace only V3 `accepted_by: mayf3` with
  `accepted_by: worker`; fixture head `fd8c19257fe862ed6536b15f815dc1982a7fd2ed`.
- Broken retirement chain: restore V3, replace only V2
  `SUPERSEDED_BY = CODE_STRUCTURE_GUARDRAILS_V3` with
  `SUPERSEDED_BY = UNRELATED`; fixture head `c1cf488e31405f5650332fe810f831d114e79be7`.
- Each is checked as a candidate against main and at identical tampered base/head,
  so a consistently forged comparison does not become valid authority.

`forged-accepted-head`; actual rc=2; cwd is the retained clone above.

```sh
node /private/tmp/h-verifier-adapt/scripts/verify-code-structure.mjs --base 4f7df01bcf087075c114901a96a7a54573110f61 --head fd8c19257fe862ed6536b15f815dc1982a7fd2ed
```

Unmodified stderr (stdout empty):

```text
verify-code-structure: invalid V3 accepted authority metadata: accepted_by
```

`forged-accepted-both`; actual rc=2; cwd is the retained clone above.

```sh
node /private/tmp/h-verifier-adapt/scripts/verify-code-structure.mjs --base fd8c19257fe862ed6536b15f815dc1982a7fd2ed --head fd8c19257fe862ed6536b15f815dc1982a7fd2ed
```

Unmodified stderr (stdout empty):

```text
verify-code-structure: invalid V3 accepted authority metadata: accepted_by
```

`broken-backlink-head`; actual rc=2; cwd is the retained clone above.

```sh
node /private/tmp/h-verifier-adapt/scripts/verify-code-structure.mjs --base 4f7df01bcf087075c114901a96a7a54573110f61 --head c1cf488e31405f5650332fe810f831d114e79be7
```

Unmodified stderr (stdout empty):

```text
verify-code-structure: V2 retirement or reciprocal backlink invalid
```

`broken-backlink-both`; actual rc=2; cwd is the retained clone above.

```sh
node /private/tmp/h-verifier-adapt/scripts/verify-code-structure.mjs --base c1cf488e31405f5650332fe810f831d114e79be7 --head c1cf488e31405f5650332fe810f831d114e79be7
```

Unmodified stderr (stdout empty):

```text
verify-code-structure: V2 retirement or reciprocal backlink invalid
```

## Gate 4: diff self-check and independent delta review

`git diff --check` returned rc0. All tracked and untracked implementation is
exactly the five SHA-bound files under `scripts/` and `examples/` listed above.
The only additional file staged for delivery is this explicitly requested
receipt. R1 Brief/STOPPED and raw reports are preserved as local task artifacts;
they are not product changes and will not be staged. No package source,
authority document, threshold, baseline, registry, dependency or runtime change.

Independent reviewer `/root/r2_evidence_review`, who did not author the semantic
delta, reused the R1 independent source PASS and verified source/evidence hashes,
R2 scope and npm raw coordinates. Pre-final result: AUTHOR_INDEPENDENCE=PASS,
REVIEW_SCOPE=DELTA, AUTHORITY/MANDATE_SCOPE/EVIDENCE_REVIEWABILITY=PASS,
FROZEN_BLOCKER_UNION=[], SPEC_GAPS=0, FOLLOW_UPS=0, TOOLING_DEBT=0.
The reviewer will bind the containing final commit before push; the PR records
that final-HEAD delta result. MERGE_READY=NO and OPERATION_ALLOWED=NO per mandate.

## npm test: regulator attribution, not a delivery gate

R1 command: `npm test`; cwd/worktree and SHA-bound source above.
Start `2026-11-07T03:48:36.374506+00:00`; finish
`2026-11-07T03:51:12.700153+00:00`; wrapper-observed rc=1.
The R1 run was stopped with SIGTERM to its verified Node subtree after failures;
two cancelled cases are termination consequences. Its emitted summary was:

```text
ℹ tests 3492
ℹ suites 15
ℹ pass 3332
ℹ fail 122
ℹ cancelled 2
ℹ skipped 36
ℹ todo 0
ℹ duration_ms 156153.3955
```

R2 regulator disposition supplied by the user: pre-existing environment
limitations, with 135 `ERR_MODULE_NOT_FOUND` mentions attributed to Node v26.7.0
directory-argument structure and 9 `TEST_FS_OUTSIDE_OWNED_ROOT` guard mentions;
46 `ERR_ASSERTION` mentions are all in untouched packages, zero on the adaptation
surface `code-structure`. Whole-repository npm test is removed as this task's
required delivery gate. This attribution is recorded as the regulator's supplied
disposition; this worker did not independently rerun unchanged main or prove
that full causal classification. Raw counts were independently recounted here:
135/9/46 are token occurrences, not distinct failed-test counts; guard repeats
and Node's final failure recap duplicate observations. The 46 assertion mentions
correspond to 23 repeated failures outside `code-structure`.

Evidence coordinates in `docs/reports/verifier-adapt-20261107/npm-test.stdout`
(1-based): module mentions lines 1044–6465; guard mentions lines 292–346;
assertion mentions lines 5759–7615; Node version e.g. line 309. Command, timing
and rc: `npm-test.command.json`. Selected unmodified raw excerpts:

```text
file:///private/tmp/h-verifier-adapt/packages/agent-memory/test/helpers/isolated-workspace.js:21
    throw Object.assign(new Error('TEST_FS_OUTSIDE_OWNED_ROOT'),{code:'TEST_FS_OUTSIDE_OWNED_ROOT'})
                        ^

Error: TEST_FS_OUTSIDE_OWNED_ROOT
    at check (file:///private/tmp/h-verifier-adapt/packages/agent-memory/test/helpers/isolated-workspace.js:21:25)
    at fs.<computed> [as realpathSync] (file:///private/tmp/h-verifier-adapt/packages/agent-memory/test/helpers/isolated-workspace.js:34:79)
    at toRealPath (node:internal/modules/helpers:70:13)
    at Module._findPath (node:internal/modules/cjs/loader:842:24)
    at Module._resolveFilename (node:internal/modules/cjs/loader:1562:27)
    at wrapResolveFilename (node:internal/modules/cjs/loader:1123:27)
    at defaultResolveImplForCJSLoading (node:internal/modules/cjs/loader:1147:10)
    at resolveForCJSWithHooks (node:internal/modules/cjs/loader:1174:12)
    at Module._load (node:internal/modules/cjs/loader:1346:5)
    at wrapModuleLoad (node:internal/modules/cjs/loader:261:19) {
  code: 'TEST_FS_OUTSIDE_OWNED_ROOT'
}

Node.js v26.7.0
✖ packages/agent-memory/test/plugin-workspace.test.js (62.412ms)
```

```text
node:internal/modules/package_json_reader:301
  throw new ERR_MODULE_NOT_FOUND(packageName, fileURLToPath(base), null);
        ^

Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@larksuite/channel' imported from /private/tmp/h-verifier-adapt/packages/feishu-connector/src/index.js
    at Object.getPackageJSONURL (node:internal/modules/package_json_reader:301:9)
    at packageResolve (node:internal/modules/esm/resolve:784:25)
    at moduleResolve (node:internal/modules/esm/resolve:873:18)
    at defaultResolve (node:internal/modules/esm/resolve:1006:11)
    at #cachedDefaultResolve (node:internal/modules/esm/loader:708:20)
    at #resolveAndMaybeBlockOnLoaderThread (node:internal/modules/esm/loader:728:38)
    at ModuleLoader.resolveSync (node:internal/modules/esm/loader:766:56)
    at #resolve (node:internal/modules/esm/loader:690:17)
    at ModuleLoader.getOrCreateModuleJob (node:internal/modules/esm/loader:610:35)
    at ModuleJob.syncLink (node:internal/modules/esm/module_job:277:33) {
  code: 'ERR_MODULE_NOT_FOUND'
}

```

Other R1 failures (including runtime override and `f.bytes(...).startsWith` errors)
remain in the original log. They have not been repaired, hidden, or represented
as a complete suite pass. No all-repository npm rerun was required or attempted
in R2.

## Evidence archive and hashes

Full raw files remain at
`/private/tmp/h-verifier-adapt/docs/reports/verifier-adapt-20261107/`.
This committed receipt provides coordinate-bound raw excerpts; the local archive
is not published as an independent remote artifact. All hashes below are fresh
measurements of unchanged original byte streams. R2 metadata records absolute
argv/cwd, start/finish, actual/expected rc, comparison OIDs, Node version and
runner hashes. The retained tampered clone allows local object inspection.

| Evidence file (relative to archive) | SHA-256 |
|---|---|
| `structure-tests.stdout` | `65f656ef150c5d3b50076d44db94e1af1a00708e740f9278441cbee5258e6da5` |
| `structure-tests.stderr` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `structure-tests.command.json` | `7e1e4ec82ef3e0db2d0af0ccd050e5f4a001bdeff9f6851aaf34e38d5642a223` |
| `npm-test.stdout` | `4cff26139355fb43a49c7e51dae848bb5d210408652e19f8b5f4864c9e1e9022` |
| `npm-test.stderr` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `npm-test.command.json` | `db4a80ff0964c660dda28b7747759d6ee8b7e9744ccf4136d29cd138bcf85026` |
| `r2/current-main-text.stdout` | `a0e5ca5b6e998e741c9e69ecdea2e5baaf79461f600dc8e2b21fb06044d47a01` |
| `r2/current-main-text.command.json` | `ffca8e446c336a67beac5c785b7f7199295eb3a4f51b2eb02029ce73692e2cbc` |
| `r2/current-main-json.stdout` | `8196c3217ff1a9b9989e51e14f7f5c0ccb1a8c8371549c28834aecccc791e384` |
| `r2/current-main-json.command.json` | `5a9922ad589e4b46e31f77a25af56bcf5265ce532dbb2bc88debebd0f76397c8` |
| `r2/coordinates.json` | `9cdb60a7005508d3476cf5579525a2e4dfd0b7202efc2a177ea920d2b96b1f30` |
| `r2/forged-accepted-head.stderr` | `b254ed50d1f9938d51656ea349da3debed3f19b53f008e1c399806ef0f5d330c` |
| `r2/forged-accepted-head.command.json` | `638b691dbf8ec9c95bc200034a31e36d42ee76bfa7a72195f9862174381aa493` |
| `r2/forged-accepted-both.stderr` | `b254ed50d1f9938d51656ea349da3debed3f19b53f008e1c399806ef0f5d330c` |
| `r2/forged-accepted-both.command.json` | `6f5b3c58cf8bd3d3a262eca88256e4a4dba75c278aef6e0e20fde8bfbc60f97f` |
| `r2/broken-backlink-head.stderr` | `1ca3b7e625503105c65f6cc62031f29bc4814d0754098e44002ba5dea7281202` |
| `r2/broken-backlink-head.command.json` | `32d88de2afd43c5158c47ed4dde49cc9b20eee609dca3df7de478e2df228d944` |
| `r2/broken-backlink-both.stderr` | `1ca3b7e625503105c65f6cc62031f29bc4814d0754098e44002ba5dea7281202` |
| `r2/broken-backlink-both.command.json` | `c0621c2b96c8ee80512785052bccd57de7a14064d5294f41d4a8b0c161e42546` |

## Known limits

- Delivery is source/test/CLI qualification and one unmerged PR. It does not
  install a runner, qualify production/runtime behavior, merge authority, accept
  a future successor, or revalidate PR #603.
- Historical debt remains 28 and unresolved. The exact installer exception and
  its separate split obligation are unchanged; no cap or allowance is renewed.
- Native parsing deliberately supports the current pinned plain metadata formats.
  Unknown/future acceptance or carried-policy changes require a separate task;
  this is not a general YAML parser or automatic acceptance mechanism.
- Full-suite rc1/cancellation and regulator-supplied environment attribution
  remain distinct from the actual focused rc0 and expected-red observations.
- The receipt precedes its containing commit. Final commit SHA, remote ref and
  open/unmerged PR state require the subsequent fresh delivery readback in the PR.
