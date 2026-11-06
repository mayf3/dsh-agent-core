# STOPPED — V3 transitional exception candidate

```text
STATUS = STOPPED
RECORDED_AT = 2026-11-06T05:39:38Z
STOP_SOURCE = Owner task: 失败即停写 STOPPED-V3-EXCEPTION.md
STOP_CLASS = REQUIRED_GATE_FAILURE
TARGET = mayf3/dsh-agent-core
WORKTREE = /private/tmp/v3-structure-rule
BRANCH = chore/structure-guardrails-v3-exception
PARENT_AND_UNCHANGED_HEAD = 75ece578301b014a23b987568d1eb8af96795300
OBSERVED_REMOTE_MAIN = a33ea347af57a85adf3d667099529f797b617771
DELIVERY_VERIFIED = NO
MERGE_READY = NO
OWNER_ACCEPTANCE = PENDING
PRODUCTION_AUTHORITY = NONE
```

## Stop event and exact failure

The required new regression suite was executed in this worktree:

```sh
node --test examples/code-structure/verify-code-structure-transition.test.mjs
```

Observed exit code: **1**. Summary: **14 tests, 11 pass, 3 fail, 0 skipped,
0 cancelled**, duration 13133.361542 ms. All three failures occurred in fixture
preparation, before the corresponding verifier assertions could execute:

| Test | Actual failure | Source |
|---|---|---|
| absent transition authority retains V2 behavior for the exact content pair | `git commit -m offline transition fixture: absent authority and old installer` failed because fixture preparation produced no changes | `prepare`, test line 36 |
| an unrelated oversized file still fails while the exact transition matches | `ENOENT` opening fixture `examples/code-structure/transition-over-limit.js`; parent directory was absent | test line 129 |
| the exact blob pair on another path cannot borrow the installer exception | `ENOENT` opening fixture `examples/code-structure/transition-alias.sh`; parent directory was absent | test line 170 |

The absent case already has the exact old installer blob at the fixture parent;
it therefore cannot assume that preparing an absent authority creates a commit.
The historical fixture parent does not contain `examples/code-structure/`.
These are test-harness defects, not proof that the corresponding mechanism cases
pass or fail. No semantic success is inferred from an unexecuted assertion.

The complete new-suite output was observed in the delegated tool execution
(session 22555); it was not saved as a local artifact. Temporary fixture clones
were removed by their registered test cleanup. This record preserves the actual
command, summary, failed test names, errors, and source coordinates; it does not
claim that an unavailable raw log is an independently replayable receipt.

No fixture repair, source repair, or further test execution was performed after
the failed gate. This stop record is the only subsequent repository write.

## Work prepared before failure

- Proposed rule: `docs/specs/CODE_STRUCTURE_GUARDRAILS_V3_TRANSITION_EXCEPTION_V1.md`.
  It preserves V2 and d506, specifies the exact tuple and diff, and records the
  1315-line installer as open historical debt with Owner accountability and
  separate split acceptance. Status remains `proposed`.
- Verifier draft: `scripts/verify-code-structure.mjs`, 425 physical lines.
  The exact exception requires an accepted rule already in comparison base,
  identical rule bytes at head, exact path/blob pair/mode/diff, and retained
  debt output. Proposed authority does not activate the mechanism.
- New tests: `examples/code-structure/verify-code-structure-transition.test.mjs`,
  178 physical lines. The required suite is incomplete due to the failures above.

Observed actual installer delta: old blob
`ef5053201e6af88b1edbcdfc33e845f872183b2b` to new blob
`356899a8ec0726f245790379429f97dfc6ea3bfb`, only inserting
`scheduler-watchdog.mjs ` after `agentcore-cron.mjs ` in the whitelist line.
The diff is +1/-1, with **1315 physical lines at both endpoints**, not net growth.
The actual installer in this worktree was not edited or executed.

## Evidence already completed

| Check | Observed result and limitation |
|---|---|
| `node --check scripts/verify-code-structure.mjs` | rc 0 before the failed suite |
| `node --test examples/code-structure/verify-code-structure.test.mjs examples/code-structure/verify-code-structure-review-regressions.test.mjs` | rc 0, 22/22 pass; raw output `/tmp/v3-exception-v2-tests.tap` |
| `python3 .agents/tools/verify_governance.py --target .` | rc 0; vendored governance bytes match the accepted lock |
| `git diff --check` | rc 0 before the failed suite; not final delivery acceptance |
| Current verifier, `--base 75ece578301b014a23b987568d1eb8af96795300 --head 75ece578301b014a23b987568d1eb8af96795300 --json` | rc 0, 28 visible baseline-debt items; `/tmp/v3-exception-baseline.json`; identical-coordinate observation only, not a gate on the uncommitted candidate |
| Independent affected-surface review | No concrete mechanism bypass found; no successful final verdict. Frozen blocker union contains the required regression-suite failure. |
| Final read-only scope check | V2 rule, V1-format registry, original implementation contract, and installer unchanged; no product-source diff |

Uncommitted prepared-content SHA-256 values:

| Path | SHA-256 |
|---|---|
| `scripts/verify-code-structure.mjs` | `99f880936b5339ffac554e5c1409cd6e314796a06d785c53fec9fc87acdb6072` |
| `docs/specs/CODE_STRUCTURE_GUARDRAILS_V3_TRANSITION_EXCEPTION_V1.md` | `5ed4032621a59dfc312a01e6128f66e00115235566180d7ab78768fe4e3ac49f` |
| `examples/code-structure/verify-code-structure-transition.test.mjs` | `265f8f0567fc6059b6ed13768a3179fa4cf0e926031ecb03b1c46192b674408e` |

The pre-existing untracked `BRIEF-V3-EXCEPTION.md` was preserved unchanged
(SHA-256 `e8484db6aa8ec28e220d53e76fcc356430c47f6715d4afcd07cfb68ce9c63f76`).
This task-specific Owner instruction authorized candidate preparation together;
it did not make proposed V3 accepted authority or assert ordinary V2 conformance.

## Disposition

No commit, push, PR, merge, acceptance edit, registry-cap refresh, rebaseline,
product-source change, PR #603 modification/revalidation, installer execution,
or production write was performed. `RECEIPT-V3-EXCEPTION.md` was not created:
the success-delivery route stopped at the failed required gate.

The literal Owner stop remains controlling. This record does not silently
authorize a harness-repair retry. The precise exception is not proven
inexpressible; its verification is incomplete. If that route is later found
inexpressible, the existing fallback remains compliant decomposition under the
unchanged 500-line ordinary limit, without cap refresh or bypass.
