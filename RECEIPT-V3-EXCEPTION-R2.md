# Verification receipt — V3 transitional exception R2

```text
RECORDED_AT = 2026-11-06T05:47:59.048749+00:00
TARGET_REPOSITORY = mayf3/dsh-agent-core
WORKTREE = /private/tmp/v3-structure-rule
BRANCH = chore/structure-guardrails-v3-exception
R1_PARENT = 75ece578301b014a23b987568d1eb8af96795300
BASE_HEAD = a33ea347af57a85adf3d667099529f797b617771
CURRENT_BASE_HEAD = a33ea347af57a85adf3d667099529f797b617771
REVIEW_TARGET_HEAD = 2373cec4db09daa2ddf005bae2f8918f3b5c0a24
SOURCE_GATES = PASS
R2_MECHANICAL_DELTA_REVIEW = PASS_RECOMMENDATION
OWNER_ACCEPTANCE = PENDING
MERGE_READY = NO
OPERATION_ALLOWED = NO
PRODUCTION_AUTHORITY = NONE
PUBLICATION_AT_RECORDING = PENDING_PUSH_AND_GH_PR
FINAL_DELIVERY_BINDING = PR body binds final receipt-only Head and remote readback
```

## Mandate, route, and preserved boundary

The attributable Owner instruction is preserved verbatim in
`BRIEF-V3-EXCEPTION-R2.md`. R1 authorization and failed-gate history remain in
`BRIEF-V3-EXCEPTION.md` and `STOPPED-V3-EXCEPTION.md`; those files were not edited.
The R2 ruling authorizes only the three fixture-initialization repairs, specified
verification, receipt, commit, push, and an open PR. It reserves independent
review and formal acceptance to the Owner and prohibits merge and production writes.

`SPEC_GOVERNANCE_MODE=PREFLIGHT`; `AUTHORITY_ACTION=REUSE` applies only to this
mechanical continuation of the retained R1 candidate, not acceptance of new V3
meaning. `PLAN_LEVEL=BRIEF`; `ASSURANCE_LEVEL=DURABLE`;
`ROUTE_STAGE=IMPLEMENTATION`; mutation mandate and isolated write surface are
valid. Accepted V2 and `CODE_STRUCTURE_VERIFIER_CONFORMANCE_V1` remain the
implementation base authorities; V3 remains **proposed**. The R1 task-specific
candidate-preparation authorization is retained; no proposed adoption or ordinary
atomic-route permission is claimed to activate V3 or supersede V2.
`SPEC_GAP_DEPENDENCY=NONE` for the authorized mechanical repair.

Goal/current gap: complete the interrupted candidate by fixing fixture setup and
executing all frozen gates. Done When: this receipt, passing specified gates,
committed/pushed candidate, and open unmerged PR titled `V3 transitional exception`.
Expansion trigger: required-gate failure, rule/verifier/assertion change, authority
conflict, or scope escape; then stop and write `STOPPED-V3-EXCEPTION-R2.md`.
Expected negative-case verifier exits below are successful negative tests.

## Actual repair and base alignment

R1 was still based on `75ece578`; it had not aligned to `a33ea347`. A fresh
`git ls-remote origin refs/heads/main refs/heads/chore/structure-guardrails-v3-exception`
returned main `a33ea347af57a85adf3d667099529f797b617771` and no remote candidate
branch. `git merge --ff-only origin/main` succeeded. The intervening #631 delta
only aligns `docs/specs/AGENT_CORE_WORKFLOW_RECOVERY_LIVENESS_V1.md` acceptance
metadata, unrelated to this task; no structure authority or implementation changed.

Only `examples/code-structure/verify-code-structure-transition.test.mjs` changes
relative to retained R1 bytes:

1. Import `mkdirSync` and create `examples/code-structure` recursively in fixture
   setup, covering both formerly missing-directory failures.
2. For the absent-authority fixture, add excluded non-executable
   `docs/structure-transition-fixture.txt` so the setup commit has a real file
   change while the transition authority remains absent.

No assertion, verifier draft, or rule draft changed. Reversing exactly these
setup edits restores the R1 test SHA-256. Both draft hashes still equal the R1
stop receipt:

| Path | SHA-256 |
|---|---|
| `scripts/verify-code-structure.mjs` | `99f880936b5339ffac554e5c1409cd6e314796a06d785c53fec9fc87acdb6072` |
| `docs/specs/CODE_STRUCTURE_GUARDRAILS_V3_TRANSITION_EXCEPTION_V1.md` | `5ed4032621a59dfc312a01e6128f66e00115235566180d7ab78768fe4e3ac49f` |
| R1 test before setup repair | `265f8f0567fc6059b6ed13768a3179fa4cf0e926031ecb03b1c46192b674408e` |
| Repaired test | `5c4c4f0788ac9963c67117f473d473b1e87c76dfa793f0fb457a6889a784bae7` |

## Executed gates

All commands ran locally in the named worktree, except the frozen synthetic
comparisons explicitly identified below. Raw outputs and the exact synthetic
runner are retained at:

```text
/var/folders/jh/5k4x44w12ps1kbrch8__f6b80000gp/T/v3-exception-r2-iq7l9thq
```

| Gate | Actual observation |
|---|---|
| `node --test examples/code-structure/verify-code-structure-transition.test.mjs` | rc 0; 14 tests, 14 pass, 0 fail/cancel/skip; 16511.354334 ms |
| `node --test examples/code-structure/verify-code-structure.test.mjs examples/code-structure/verify-code-structure-review-regressions.test.mjs` | rc 0; 22 tests, 22 pass, 0 fail/cancel/skip; 16162.263292 ms |
| `node --check scripts/verify-code-structure.mjs` | rc 0 |
| `python3 .agents/tools/verify_governance.py --target .` | rc 0; vendored bytes match accepted governance lock |
| `git diff --check` and staged `git diff --cached --check` | rc 0 |
| `node scripts/verify-code-structure.mjs --base a33ea347af57a85adf3d667099529f797b617771 --head 2373cec4db09daa2ddf005bae2f8918f3b5c0a24 --json` | rc 0; V2; `CANDIDATE_DELTA_PASS_WITH_BASELINE_DEBT`; 961 in-scope files, 0 candidate violations, 28 debt, 0 resolved |
| Protected-source exact comparison below | rc 0; no diff |

The tests executed against the same source hashes committed at `2373cec4db09daa2ddf005bae2f8918f3b5c0a24`;
no intervening source edits occurred. The actual candidate gate uses V2 because
the exception remains proposed. This is candidate-delta evidence, not general
repository conformance.

## Frozen-scene local synthetic commits

`python3 /var/folders/jh/5k4x44w12ps1kbrch8__f6b80000gp/T/v3-exception-r2-iq7l9thq/frozen-scenarios.py` returned **rc 0**, with all checks satisfied.
It creates only an independent shared **bare clone** at `/var/folders/jh/5k4x44w12ps1kbrch8__f6b80000gp/T/v3-exception-r2-iq7l9thq/frozen.git`.
Its objects and `refs/fixtures/*` stay in that clone and are never pushed.
Evaluation completed at `2026-11-06T05:45:13.543271+00:00`. The runner has fixed fixture
identity/date and parent refs; it can be copied into a fresh local directory and
rerun against this checkout. Other environments must adjust its `ROOT` path.

Frozen source parent: `75ece578301b014a23b987568d1eb8af96795300`.
The exact tuple is installer path `scripts/trusted-cp-deploy-install.sh`, old
blob `ef5053201e6af88b1edbcdfc33e845f872183b2b`, new blob
`356899a8ec0726f245790379429f97dfc6ea3bfb`, unchanged mode `100644`, and one
whitelist-line replacement (+1/-1), retaining **1315 physical lines** at both ends.

| Synthetic coordinate | Full commit OID |
|---|---|
| Accepted-authority simulation, parent is frozen 75ece578; only adds the draft with local fixture status `accepted` | `1368902097872c8485086f3ab793078d618a2be8` |
| Exact whitelist head, parent is accepted-authority simulation | `a22a9e0425a1e569abd32bfc0c7e69ba6aad9de6` |
| Mutated head, parent is accepted-authority simulation | `cf695a54612336747cd1551e2d1c289f28383c21` |
| No-document head, parent is frozen 75ece578 | `f4df79bf05ff8dc7dfde8d446f3fa4b71d4b3295` |
| Accepted fixture without the exception entry, parent is frozen 75ece578 | `78aeceae7996642608aa73178d4b536ed4248aed` |
| No-entry exact installer head | `2fb9fe961150181a2417d37cb3d56054b5d72ba0` |

Each raw JSON was produced by `node <verifier> --base <recorded-base-oid>
--head <recorded-head-oid> --json`, cwd the isolated bare clone. The current
verifier is the unchanged R1 draft; the comparison V2 binary is extracted with
`git show a33ea347af57a85adf3d667099529f797b617771:scripts/verify-code-structure.mjs`
to `accepted-v2-verifier.mjs` (SHA-256 `9b06896ed493d4fc7680aefffbeb92448043fed10dca94042b554231340afd55`).

| Case | Expected and observed result |
|---|---|
| Exact accepted simulation `13689020..a22a9e04` | rc 0; applied exact tuple; candidate delta passes with 28 visible debt, including 1315-line installer tagged `STRUCTURE_TRANSITION_EXCEPTION_V1`; installer debt is not resolved |
| Same-line head-blob mutation | rc 1; `TRANSITION_EXCEPTION_MISMATCH` plus ordinary installer violation; mutated blob `3e2518c638c19c98efcecb800dc9bf5ad7969af8` |
| No authority document at frozen 75ece578 base | rc 1; complete JSON exactly equals accepted V2 verifier output at the same coordinates |
| Accepted fixture document with no exception entry | rc 1; complete JSON exactly equals V2 at the same coordinates |
| Literal `75ece578..a22a9e04` (authority only added at head) | rc 1; complete JSON exactly equals V2; head-only acceptance cannot self-activate |

**Coordinate qualification:** literal `75ece578` has no accepted exception
record. It cannot truthfully be reported as an exception PASS without changing
the retained rule. The required positive mechanism observation is therefore the
permitted local accepted-authority simulation derived from that frozen parent;
the real frozen base retains V2 failure. These fixture edits are not Owner
acceptance, main activation, PR #603 revalidation, or installation evidence.

## Independent affected-delta review

Reviewer `/root/r2_independent_review` authored no candidate files and used
`spec-governance` REVIEW mode. At exact semantic head `2373cec4db09daa2ddf005bae2f8918f3b5c0a24` and base/current
base `a33ea347af57a85adf3d667099529f797b617771`, its recorded verdict is
**PASS recommendation for R2 candidate delivery**, with 0 Blockers, 0 Spec gaps,
0 Follow-ups, and 0 Tooling-debt findings. Scope: the three mechanical setup
repairs, invalidated execution evidence, unchanged R1 rule/verifier hashes, and
unrelated #631 base alignment. It independently checked test counts, raw JSON
hashes/coordinates, the synthetic commit trees, V2 equality, real candidate gate,
and reverse-edit proof of unchanged assertions.

This delta review closes the R1 required-suite failure for candidate delivery.
It does not assert a new full semantic acceptance of the V3 proposal. Owner
formal acceptance remains pending. A receipt-only final commit requires a final
Head delta readback, recorded in the PR with the final SHA; no unchanged test
suite needs another execution solely because the receipt is committed.

## Scope readback and delivery boundary

At the reviewed semantic Head the only candidate paths relative to `a33ea347`
are the proposed V3 rule, verifier, its new tests, the two original mandate
records, and R1 stop history. This receipt is the only subsequent planned file.
The protected comparison executed with rc 0:

```sh
git diff --exit-code a33ea347 2373cec4db09daa2ddf005bae2f8918f3b5c0a24 -- \
  .agents/local/CODE_STRUCTURE_GUARDRAILS_V2.md .agents/structure-registry.json \
  docs/specs/CODE_STRUCTURE_VERIFIER_CONFORMANCE_V1.md \
  scripts/trusted-cp-deploy-install.sh packages/ .agents/governance.lock.json
```

Unchanged blobs at base and semantic Head:

| Subject | Git blob |
|---|---|
| V2 rule | `7b828fd1d03ff70d61d0b72be7c61b64712b514d` |
| V1-format registry, all caps/allowlist/fixed baseline preserved | `06dc0c25eaf503b8893741646ec4cce8d540831e` |
| Original implementation contract | `76a21d47a480c7551b93617e2fc2c7916f40e6f1` |
| Actual installer, never edited or executed | `ef5053201e6af88b1edbcdfc33e845f872183b2b` |

No product source, production state, #603, registry caps, or accepted authority
was mutated. Local synthetic negative findings are expected checks, not failed
required gates. No R2 stop condition fired.

Publication is not yet claimed at receipt recording time. The remaining
mandated operations are the receipt-only commit, final-Head delta check, push,
and `gh pr create` with title `V3 transitional exception`; then fresh remote and
PR Head readback. A gh timeout stops submission immediately without retry, with
`STOPPED-V3-EXCEPTION-R2.md`; uncertain remote result stays unknown. Do not merge.

## Raw-output integrity

These are actual SHA-256 values for the retained local artifacts. Paths below
are relative to the evidence directory above. The receipt carries the executed
results and independent review; raw logs are local artifacts, not remote files.

| Artifact | SHA-256 |
|---|---|
| `new-tests.tap` | `53797fee349ba3fd5acbe20990eb6f59fa9ab826ca130e0581d7f18f09b401a9` |
| `v2-tests.tap` | `b4ec7a0c75a7342c94e157478486b33ceb569110c74065f583ede29e5b88eb67` |
| `candidate-structure.json` | `52c1e54d518caf98f37a3b999131c7cfd5dc433d7a7675afc55cbd429c352b1b` |
| `frozen-scenarios.py` | `28d92dd35e070af3bc9f25fff5632416ff5226fc644a5044830f17e0d7fe2ffb` |
| `frozen-summary.json` | `bfc3ee0c4f4a8f8b21e9c004624e4b315386ac8efe0cd00e677928bc4a728359` |
| `exact-match.json` | `ef4032892a50065df6789a9bd28f511405d25b4690ce02b0beddd2456cb6dce8` |
| `changed-blob.json` | `00f6b62d3e324c3e40a33bfa6d753a89af67ede3bec9a03a4f9a21061625539c` |
| `absent-authority.json` | `f06e348fcdd80c039b6d541a0a23c949f3c645d5369999c41695105020834bfb` |
| `absent-authority-v2.json` | `f06e348fcdd80c039b6d541a0a23c949f3c645d5369999c41695105020834bfb` |
| `no-entry.json` | `20c83ec46d5046b100bea9b08faef5fbe9316787fdaee7656a60a5d45a2414d7` |
| `no-entry-v2.json` | `20c83ec46d5046b100bea9b08faef5fbe9316787fdaee7656a60a5d45a2414d7` |
| `literal-frozen-base-candidate-only.json` | `0761af68ba9b1021feced8d071c3423da4f6757b6e118bc399d86194ebdd49ce` |
| `literal-frozen-base-candidate-only-v2.json` | `0761af68ba9b1021feced8d071c3423da4f6757b6e118bc399d86194ebdd49ce` |
