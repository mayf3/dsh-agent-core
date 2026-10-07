# Issue #562 (+#555/#569) — Workflow Authoring File Entry & Definition Read, Delivery & Owner Replacement Runbook

> Branch: `ac-562/authoring-file-entry` (branch-local candidate, based on
> `origin/main` `5181c211` — the tree whose
> `packages/broker/src/capabilities/workflow-definition-authoring.js` is
> byte-identical to the installed app). Same writer owns the adjacent
> Workflow Broker deltas on this branch; the shared-runtime install
> serializes with B7/#595.
> Candidate Specs (**both status: proposed** — Owner acceptance is a
> precondition for merge/install):
> - `docs/specs/AGENT_CORE_WORKFLOW_AUTHORING_FILE_ENTRY_V1.md` (#562, r2: TOCTOU-hardened read, evidence-link hardening, `outcome_unknown` preservation)
> - `docs/specs/AGENT_CORE_WORKFLOW_DEFINITION_VERSION_READ_V1.md` (#555 same-domain precise read; #569 is closed by this continuation round itself)
> Governing accepted authority for the underlying write operation:
> `AGENT_CORE_WORKFLOW_DEFINITION_AUTHORING_V4` (unchanged).

## 1. What was delivered (exact deltas)

| File | Change |
|---|---|
| `packages/broker/src/authoring-file-entry.js` | NEW (376 lines): `workflow_definition_authoring_file(path, expectedSha256?)` — single-operation lossless file entry; r2: one-descriptor contained read (pre/post-open containment + dev/ino identity), evidence path symlink hardening, relay loss → `outcome_unknown` |
| `packages/broker/src/index.js` | import + config key `authoringFileEntry` (default true) + child-mode registration block + one `DEFAULT_MANIFESTS` entry |
| `packages/broker/src/capabilities/workflow-definition-read.js` | NEW (120 lines, pure data): `workflow_definition_read` — `list_definitions` / `get_definition`, GET-only, `workflow.read`, same-domain (svc H-5) — #555 |
| `packages/broker/src/capabilities/manifests.js` | +1 re-export line (convention) |
| `packages/broker/test/authoring-file-entry.test.js` | 16 unit tests (incl. TOCTOU/evidence-symlink/outcome_unknown) |
| `packages/broker/test/authoring-file-entry.runtime.test.js` | runtime-entry integration (real apply → real parent handler → real gateway → mock svc) |
| `packages/broker/test/capabilities/workflow-definition-read.test.js` | 4 tests: manifest pins + allow / deny / missing-field |
| `scripts/verify-issue-562-authoring-file-entry.mjs` | delivery pipe: real 57 KB args byte-faithful + negatives + #555 read pipe |
| `scripts/verify-issue-562-submission-examples.py` | 16 legal / 4 illegal-family example validation on the captured args |
| `docs/specs/…V1.md` ×2 | candidate Specs (proposed) |

Not touched: `agent-router` (incl. `parent-rpc-relay.js`), `gateway.js`,
`transport.js`, `relay.js`, the WDA manifest, `workflow.js` (at its 601-line
must-not-grow ceiling), svc-workflow, auth-service, Scheduler, any production
config.

## 2. Stage truth (SOURCE / BUILD / INSTALLED / ENABLED / BUSINESS)

| Stage | State | Evidence |
|---|---|---|
| SOURCE | **DONE** — commit `b3e766f8` on `ac-562/authoring-file-entry`; 13/13 new tests GREEN (RED first), broker suite 517/517, agent-router failures = the 5 pre-existing env failures reproduced identically on clean base | commit; test output |
| BUILD | **N/A as a separate step** — the package is zero-dependency ESM executed directly by the production node runtime; verification ran on the same node v25.6.1 binary the installed runtime uses (`/usr/local/bin/node`) | runtime tests |
| INSTALLED | **NOT INSTALLED** — `/usr/local/libexec/agent-core/app` is untouched. Install happens ONLY via the Owner's formal process (see §4). Observed pre-existing drift (not ours, do not fix here): installed `parent-rpc-relay.js` matches `53b6536f` (2026-09-29) while main has the newer generic stop barrier; irrelevant to this entry (the BROKER_RPC_METHOD contract is identical in both) | diff vs installed |
| ENABLED | **NOT ENABLED** — the tool appears for an agent child only after install, and only when `$DSH_PRIMARY_WORKSPACE` resolves (fail-closed skip otherwise) | `maybeRegisterAuthoringFileEntry` |
| BUSINESS | **NOT PERFORMED** — zero real Definition/version/instance writes, no publish, no svc call. The one-time DRAFT replacement is the original Owner's action (§4) | mock-only evidence |

## 3. Local evidence (untruncated, in the private task dir)

`/Users/yanfenma/Documents/Codex/2026-10-07/task-4/`:

- `sh562-pipe-gateway-captured-args.json` — 57,593 bytes, **byte-identical**
  to `shopping-repair-draft.arguments.json` (sha256 `e7a2bd0d41cdcca6d1cf2d3e0e78a7696a33a74bb2af8074f03a445ed28001e9`); what the gateway received, captured at the gateway boundary.
- `sh562-pipe-svc-put.json` — the exact PUT (`/internal/v1/domains/<family-home>/definitions/fa016161…/draft`), body, and both fresh Idempotency-Keys.
- `sh562-pipe-evidence.jsonl` — the tool's own evidence lines: stage=request (full args + sha256) before each relay, stage=response (full envelope; `requestId: req-sh562-pipe` on the success path), stage=rejected for pre-relay validation rejections.
- `sh562-pipe-negative-results.json` — `invalid_json`, `truncated_payload`, `identity_field_injection` (file containing `agentId`/`scope`), `outside_workspace`: all rejected **pre-gateway**; `type_violation_nodes_not_array`: rejected **pre-svc-write** (gateway-owned); relay failure: exactly one attempt, verbatim error, **no auto-retry**.
- `sh562-pipe-submission-example-validation.json` — 70 checks on the CAPTURED args: 10 nodes / 16 transitions; unique keys/order; exactly one DRAFT head with `assignee_ref_type=WORKFLOW_CREATOR` (never FIXED_PRINCIPAL); three distinct terminals (purchased/cancelled/deferred); RETURN/TERMINATE direction rules; full reachability; primary chain acyclic ending at `purchased`; **16/16 legal submission examples validate**; the 4 illegal families reject (decision-as-purchase, `APPROVED_ONLY`, partial purchase, missing `userProof`).

## 4. Owner actions (formal process; install serializes with B7/#595)

1. **Review + accept both candidate Specs** (they may be accepted, renamed, or rejected independently — the tool name `workflow_definition_authoring_file` is a proposal; renaming is a non-semantic delta confined to the name constant + registration).
2. **Merge** the branch through the normal review path (spec statuses flip to accepted as part of that Owner action; this branch does not merge itself).
3. **Install** the runtime through the Owner's formal install/deploy process, in the SAME shared-runtime window that B7/#595 uses (strictly serialized — one writer on the shared runtime at a time). Product files are the four `packages/broker` paths above; no extra wiring — the file entry self-registers when `$DSH_PRIMARY_WORKSPACE` resolves (production spawn env already sets it), and the read capability rides the default manifest list.
4. **Place the args file** `shopping-repair-draft.arguments.json` (final reviewed version) inside the family steward's workspace.

**Acceptance case A — family steward (#562, one-time replacement):** instruct the family steward in its normal chat to call, exactly once:
`workflow_definition_authoring_file { "path": "<workspace>/shopping-repair-draft.arguments.json" }`
Then independently read back the DRAFT `a85253b1-d887-49cf-b28d-57c456a1c710` of definition `fa016161-d6d0-48b3-826f-b684b4439554` (e.g. `workflow_definition_read.get_definition` after install, or the existing owner read channel) and require zero difference vs `sh562-pipe-gateway-captured-args.json`; re-run the 16-example validation on the read-back before any business use. No publish, no new version, no instance.

**Acceptance case B — blog agent (#555):** as the blog domain's owner agent, call
`workflow_definition_read.get_definition { domainId: <blog-domain>, definitionId: <blog-definition> }`
and verify the PUBLISHED version row exposes the exact `context_schema` (required: title/description/acceptanceCriteria/sourceArtifactRef per the #555 diagnostics); confirm a nonexistent/foreign definition honestly returns `definition_not_found` with requestId, and that pre-creation input can now be composed from the precise schema WITHOUT touching global instance enumeration. Then, through the agent's normal `workflow_execute`, decide creation per the existing same-domain dedup contracts (this round creates nothing itself).

## 5. Honest boundaries / remaining blockers

- PENDING INSTALL (shared runtime, serialized with B7/#595): everything at INSTALLED/ENABLED/BUSINESS stage. Local evidence is mock-endpoint verification of the real pipeline — NOT production acceptance.
- The entry guarantees **lossless fidelity**; svc-workflow stays the validation owner. A wrong file is relayed verbatim and rejected/evidenced by the service. The read capability is verbatim passthrough — svc stays the authorization and truth owner.
- The original #562 first-loss layer remains **UNKNOWN**; nothing here asserts the #557 cause. #555's global-enumeration confusion is addressed by giving the precise same-domain read, not by touching the global capability.
- Installed-app drift vs main (e.g. `parent-rpc-relay.js` at `53b6536f`) is pre-existing; the entry and the read capability are compatible with both generations; the Owner's install process reconciles the tree as usual.
- Full business E2E for both agents is only reachable after the Owner's install (ENABLED/BUSINESS stage).
