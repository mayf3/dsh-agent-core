# Product #402 — MY_SESSIONS bounded TEST_IDENTITY acceptance slice — 2026-10-16

Round: scheduler `cap-20261016T102947Z-1200-c1`; claim `w1-my-sessions-test-identity-r1200c1`;
session `sess_1749e00d-7fef-487f-9060-251a325f985c`; ACTIVE_EXECUTION = agent-control#1167.
Mode: **PRODUCTION_MUTATION = NO** — non-production TEST_IDENTITY / read-only. Zero deploy /
restart / sudo / credential read-or-write / config-or-store change / Remote Desktop. Reuse of the
merged implementation only; no rebuild, no second release vehicle. Fresh inventory watermark:
`75c947ffaefb`.

## 1. Fresh-read inputs

- Goal #386 (CONTINUOUS_BACKLOG_DELIVERY_V1) + Product #402 body incl. all receipts through the
  2026-10-13 W1-v5-r2 packet reuse (RELEASE_PACKET_REUSE_RECEIPT_V2 + TEMPLATE_ROLE_FIX_RECEIPT).
- Governing authority: `docs/specs/AGENT_CORE_SESSION_CENTRIC_EXECUTION_TRACEABILITY_V1.md`
  (accepted); MY_SESSIONS = CTR-SCT-002 `agent_session_list` — SELF-ONLY, COORDINATE-ONLY,
  zero-Auth self surface, consumption ban.
- Merged source under test: **mayf3/dsh-agent-core main `0d3a2d6c146bc3223accfdf2f5f65675d7a8e85e`**
  (2026-10-15; includes PR491/PR495 + PR509 HR fix `04cd3b06`). PR509 verified ancestor of main.
- Detached verify worktree `/tmp/p402-r1200c1-20261016/src` @ `0d3a2d6c` (lane artifact, /tmp).

## 2. Merged-source wiring verification (fresh, at 0d3a2d6c)

| Layer | Evidence |
|---|---|
| Query core | `packages/execution-history/src/session-listing.js` `listAgentSessions` — caller-subtree direct scan only (`homes/<viewer>/sessions/**`), never the fleet index; bounded reads (4 KiB header, per-file scan cap, 64 MiB/request budget); read-only syscalls; confined reader (lstat regular nlink=1, O_NOFOLLOW, dev/ino/size verify, post-scan re-verify); canonical-root binding vs symlink substitution. **Byte-identical to the 2026-10-01 verified head** (`sha256 cfca58936600eb56ac89e0fcd03a508b7f3533dbc2ff4afc6d0cf25ebf632f0f`) |
| Capability manifest | `packages/broker/src/capabilities/execution-history.js` `agentSessionListManifest` — op `list`, args only `cursor`/`limit` (no identity argument), closed error table, `local: {resource: 'execution-history'}`, requiredScopes OMITTED (zero-Auth). **Unchanged since verified head** |
| Registration | `packages/broker/src/index.js:107` DEFAULT_MANIFESTS ⊇ `...executionHistoryManifests` (registry exactly-once asserted by broker-manifest-registration.test.js) |
| Provider | `packages/production-runtime/src/execution-history/runtime.js` `listHandle` — trusted handler, identity from `trustedContext.agentId` (gateway-derived, never model args), fail-closed pagination validation. **Unchanged since verified head** |
| Compose | `packages/production-runtime/src/compose.js:444` `mountExecutionHistoryRuntime(ctx, { layout, ... })`; `layout.homesRoot` is the read boundary; broker built via `broker-composition.js` → `apply(ctx)` → `config.manifests ?? DEFAULT_MANIFESTS` |
| Authz wiring | gateway.js delta since verified head = scheduler `clone_disabled` op only (no identity/redaction surface change); live user-domain `agents.json` contains **zero** `manifests` overrides |

Focused suites on the exact head, production-identical node v25.6.1, `env -i`:
`agent-session-list.test.js` + `broker-manifest-registration.test.js` = **18/18 PASS**
(T1, T6, T7, B2, C1/C2, C5, F1 core+handler, keyset determinism, scheduler-kind coordinates,
A3/A3b/B-B confinement counterexamples, E2/D4 coordinate honesty, registry exactly-once,
zero-Auth no-identity-arg, closed error table).

## 3. INSTALL/ENABLE census (fresh, read-only, 2026-10-16 ~11:00Z)

| Runtime generation | Load source (verified live) | MY_SESSIONS source present | Verdict |
|---|---|---|---|
| user-domain runtime, pid 83698, started 2026-10-16 19:01:41 +0800 (`--root /Users/yanfenma/.agent-core`) | `/Users/yanfenma/workspace/project/production-dsh-agent-core` @ `09c7e8b4` (= main `44da63d2` + AC1159 local parity commits bd8f74c4/09c7e8b4, committed at process start) | **YES** — `session-listing.js` present, sha256 `cfca5893…` **byte-identical to main**; registration + compose mount + provider all present in tree; tree file mtimes (13:53:58) precede process start | **INSTALLED=yes / ENABLED=yes (this generation; enabled by construction — ships in DEFAULT_MANIFESTS, mounts unconditionally, no config override)** |
| authsvc controlled root, pid 43098 (LaunchDaemon `ai.agent-core.runtime`, `/usr/local/libexec/agent-core/app`, plist `AGENT_CORE_DEPLOYED_SHA=fa4510be…` = the 10-13 HR-fix deploy) | same tree | **NO** — `packages/execution-history` absent entirely (16 packages listed) | INSTALLED=no (W1 vehicle still B7-blocked, unchanged) |
| scheduler-v2, pid 1328 (`--root /Users/yanfenma/.agent-core-scheduler-v2`) | `/Users/yanfenma/workspace/project/dsh-agent-core-main` @ `d6d18787` | **NO** | INSTALLED=no |
| Health (read-only GETs) | 8790 `{ok:true,deliverReady:true,authConfigured:false,storeReady:true}`; 8788 `{ok:true,service:"agent-core-product-api"}` | — | production healthy |

Key change vs the 2026-10-01/10-04 census: the user-domain runtime generation began carrying the
byte-identical MY_SESSIONS source TODAY via the AC1159 user-runtime surface-parity deploy
(`09c7e8b4`, process start 19:01:41 +0800). The authsvc W1 vehicle target is unchanged (B7-blocked).

## 4. TEST_IDENTITY read path (the bounded DONE_WHEN slice)

Instrument: `/tmp/p402-r1200c1-20261016/probe.mjs` (copied to this directory). Isolated fixture
root under `/tmp/p402-r1200c1-20261016/fixture`; test identities `agt_p402_probe` (3 own journals:
`main` with user+workflow_execution origins and a real `workflow_execute` coordinate,
`cron-run-occ:0402deadbeef1234` scheduler journal, `team-sync` inter_agent journal), victim
`agt_p402_victim` (secret sentinel + own coordinate), attack plants: symlinked journal,
hardlinked journal (nlink=2), sessions-root symlink substitution agent, message-TEXT-quoted fake
coordinates (`88888888-…`, `occ:0bad0bad0bad0bad1`). Drives the REAL production composition seam:
`createExecutionHistoryRuntime(...).mount(ctx)` → `executionHistoryAccess.handlers
['agent_session_list'].list(args, trustedContext)` — plus the query core for the
substitution/missing-homes faces.

**Result: 47/47 assertions PASS, 0 FAIL** (full log: `probe-output-20261016.txt`):

- Bounded view (13): ok:true; `result.agentId` = trusted caller; exactly the 3 own sessions;
  kinds main/scheduler/other; origins user/workflow_execution/inter_agent correct; main row
  carries exactly `[99999999-…]` workflow coordinate; cron row carries
  `[occ:0402deadbeef1234]` derived from the session id; row key set is the coordinate-only
  10-field shape (sessionId, kind, createdAtUtc, lastActiveAtUtc, origins flags,
  ≤10 coordinates each with truncation flags, scanTruncated); timestamps present;
  escape-hatch dirs never become rows; **no fleet index created**.
- Identity boundaries (6): missing trusted identity → `forbidden_not_owner`; invalid identity
  shape → `forbidden_not_owner`; sessions-root symlink substitution → honest EMPTY listing with
  zero victim leakage; missing homes root → `history_unavailable`.
- Pagination (12): limit 0/201/'10'/null, cursor 5/''/unknown key → `invalid_arguments`
  (fail-closed, never clamped); limit=1 → `truncated:true` + keyset `nextCursor`; page 2
  completes with no overlap, `truncated:false`, terminal `nextCursor:null`; non-finite cursor
  timestamp (`TmFOOm1haW4` = 'NaN:main') → `invalid_arguments`.
- Redaction (13): whole-output sentinel scan — NO `P402_SECRET`, NO `P402_VICTIM`, no victim
  coordinate `77777777-…`, quoted fake coordinate-shaped TEXT (`88888888-…`, `occ:0bad0bad0bad0bad1`)
  never becomes an origin or coordinate, no journal content strings, no `session.jsonl`/cwd paths,
  no tool names, no foreign agentId.
- Zero unintended writes (3): full before/after inventory of the fixture root (23 entries: every
  file path+size+mtime+mode+nlink+sha256, every dir mtime+mode, every symlink target)
  **byte-identical**; victim journal mtime untouched; hardlink attack confirmed actually planted
  (test validity).

## 5. Lifecycle determination (evidence-backed, per-generation)

```text
SOURCE            = merged  (0d3a2d6c on main; rider bytes cfca5893… == W1-v5-r2 packet bytes)
INSTALLED         = partial_by_generation
                    user-domain runtime gen 09c7e8b4 (started 2026-10-16T11:01:41Z) = YES
                    authsvc controlled root fa4510be (W1 vehicle target)            = NO
                    scheduler-v2 d6d18787                                            = NO
ENABLED           = partial_by_generation (YES exactly where INSTALLED — no separate flag;
                    zero manifests override in the live config)
BUSINESS_VERIFIED = no     (no real-usage evidence yet; this round is TEST_IDENTITY by design)
DISPOSITION       = INSTALL (authsvc W1 vehicle — unchanged, B7/#414-blocked)
                    + BUSINESS_VERIFY on the live user-domain generation (needs a real
                    credentialed agent query or natural-usage evidence — credential seam
                    out of bounds for this lane)
ACCEPTANCE_MODE   = TEST_IDENTITY — the bounded DONE_WHEN slice items 1–5 + 8 are COMPLETE
```

## 6. Boundaries respected

No production mutation of any kind; production contacts were read-only (process census, tree
ls/stat/sha256 of load sources, plist env var read, two health GETs, live `agents.json` grep for
`manifests` — no credential store touched). No Remote Desktop. No sudo. No reinstall (the
user-domain generation was left exactly as found; no restart, no file writes outside /tmp and
this evidence directory). No second release vehicle; the W1-v5-r2 packet remains the only
prepared artifact. Lane artifacts: `/tmp/p402-r1200c1-20261016/` (ephemeral) + this directory
(`VERIFY-TEST-IDENTITY.md`, `probe.mjs`, `probe-output-20261016.txt`, `ENVIRONMENT-20261016.txt`).
