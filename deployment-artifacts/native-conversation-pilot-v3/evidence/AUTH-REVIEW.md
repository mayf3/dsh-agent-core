# Independent review — Auth MCP conversation proposed authority

```text
SPEC_GOVERNANCE_MODE = REVIEW
REVIEW_KIND = SPEC
SPEC_REVIEW = ACCEPT
REPOSITORY = mayf3/auth-service
REVIEW_TARGET_HEAD = c04599b301f3e757475bc20960992cb5d024106a
REVIEW_TARGET_TREE = 41a627e290e2139afd6b32202f66a527e3810726
BASE_HEAD = 57f459804df1b6526a164016ea3aefa12836286d
CURRENT_BASE_HEAD = 57f459804df1b6526a164016ea3aefa12836286d
REVIEWER_ID = /root/auth_authority_v3
AUTHOR_ID = /root (docs author; supply-author assistance independent of this reviewer)
AUTHOR_INDEPENDENCE = PASS
AUTHORITY_REVIEW = PASS
PRIMITIVE_BOUNDARY_REVIEW = PASS
CONTRACT_REVIEW = PASS
ACCEPTANCE_COVERAGE_REVIEW = PASS
MANDATE_SCOPE_REVIEW = PASS
EVIDENCE_REVIEWABILITY = PASS
BASE_IMPACT = NONE
BLOCKERS = 0
LOAD_BEARING_SPEC_GAPS = 0
FOLLOW_UPS_REQUIRED_FOR_THIS_CANDIDATE = 0
PREEXISTING_TOOLING_LIMITATIONS = DISCLOSED
READY_FOR_OWNER_EXACT_CONTENT_ACCEPTANCE = YES
OWNER_ACCEPTED = NO
IMPLEMENTATION_ALLOWED = NO
MERGE_READY = NO (Owner lifecycle decision and final-head check pending; PR currently Draft)
OPERATION_ALLOWED = NO
NEXT_ACTION = OWNER_DECISION
```

Review recommendation is ACCEPT for the exact proposed content, not Owner acceptance. Both new Specs remain proposed, production_apply_authority none. Their intended implementation_authority contracts is expressly inactive until authorized exact acceptance and merge into Auth main. This reviewer did not author or modify any candidate file, repository code, production state, DB, permission, credential or business state. Only this dedicated /tmp report and evidence copies were written.

## Exact reviewed content

Draft owning PR: https://github.com/mayf3/auth-service/pull/90 (provided by the author; no comment/message sent by this reviewer).

| File | SHA-256 |
|---|---|
| docs/specs/AUTH_SERVICE_AGENT_CORE_MCP_CONVERSATION_AUDIENCE_CCR_V1.md | a052790b5df80b35f9f3020dbb76bf811954798d28b29623a4bafd1079bd16fd |
| docs/specs/AUTH_SERVICE_MCP_CONVERSATION_PILOT_SUPPLY_V1.md | b9fa7e0af3ccdad98e2d76ec4dfe0822032d8353429d8698c4952189dca2c76a |
| docs/plans/MCP_CONVERSATION_AUDIENCE_IMPLEMENTATION_PLAN_V1.md | 83d8752aad710977bee9c5829a7df6c6af22042f92bdf637870fc7ee553695b2 |
| docs/specs/README.md | 25c67ce583a19e8cea01241039e36bf12d89da8024a6b39a19e86aef4ad25086 |

Committed blobs and worktree bytes match for all four. Exact copies are under candidate/. COORDINATES.json contains Git blob IDs, deterministic check outputs, full old transition error arrays and source coordinates. Fresh git ls-remote during review still returned main 57f4598. The candidate commits exactly these four docs paths. Existing governing Spec bytes are unchanged. The reviewer observed an existing untracked governance __pycache__ directory but did not create, remove or treat it as product source; it is not in the candidate commit.

## Authority and scope result

The NEW bounded child route is correct. MINIMAL_AUTH_FOUNDATION_V2 is current architecture; its exact-incorporated V1 root/modules are historical frozen authority and must not be rewritten to add the resource. The new CCR adds the explicit audience authority missing from current 1.12 source. Generic SERVICE profile and scope regex are compatibility evidence, not the grant of this new audience. The separate supply child defines new bounded offline machinery rather than expanding an existing Notification, website, CSESB or fleet grant authority.

The external DSH r3 exact coordinate 44da63d21987bf7115435f0767e7851b9022836a is accessible and its accepted CTR-NC-001/003/009 agrees with the proposed protocol, stable communication scope, unique verified client mapping, own-result boundary, per-call authorization, no UNKNOWN replay and separate production activation. The thin-client contract at dot-read-mcp 90cc8ed is also accessible and consistent. Neither external source authorizes Auth writes. No reciprocal acceptance or new API/platform authority is inferred.

The CCR has no DB/supply/source-custody/TLS/Binding operation authority. Supply has no Bundle source or deployment authority; registry and identity supply have separate phases, plans, nonces, write sets, transactions and receipts. Current missing mandate/trust adapter, exact connector receipt, OS permission setup and live identity/runtime pins are explicit later operation gates. They are not pretended present, and they do not require inventing platform work in this source-authority proposal.

## Version and registration closure result

MCP 1.14.0 is a candidate, not a claim of an existing artifact or permanent version lease. Current source is explicitly 1.12.0/12 entries. Website accepted CCR proposes 1.13 and its source has not landed. The MCP contract preserves that planning reservation without adding website entries or requiring website production. CCR CTR-MCC-004 requires fresh accepted-sibling/source checks, exact repin and independent review if sibling source lands or candidate version becomes occupied. It preserves every prior entry/order/profile/scope and adds only the MCP entry. This is a valid bounded append and does not modify accepted website meaning.

The 15-path registration closure is sufficient at this exact base for the stated change: 11 Bundle registry/manifest/metadata/schema/fixture/changelog files, the closed validator, production runtime version allowlist, version-only changes in the existing session test, and the new focused MCP test. Validator source version equality checks 274-281 and the closed audience set at391-407 justify the linked artifacts. The generator already derives the ignored runtime snapshot; no generator, generic issuer/verifier, API, Prisma or migration edit is needed. If implementation requires an extra semantic file or actual unsupported mechanism, it must stop and re-PREFLIGHT.

Existing 1.8 runtime/candidate test assertions/helper allowlist are disclosed pre-existing drift. They are outside this 15-path closure and cannot be silently rewritten or represented as passing. The new focused test must exercise the actual generic issuer and production loader, and inspect signed claims and real HTTP cache headers where applicable, rather than copying a test schema. Source/fixture results remain separate from actual loaded memory, DB equality and DSH HTTPS POST acceptance.

## Supply closure, persistence and secret-safety result

The three new paths in CTR-MCS-003 can own the bounded CLI, isolated harness and tests without requiring hidden generic product edits. Existing schema already supports SERVICE MachinePrincipal, MachineClient, MachineAccessGrant, GrantChangeAudit and AuthSecurityAudit. The new principal/client/grant facts and one closed GrantChangeAudit envelope can therefore commit in the stated single PostgreSQL transaction without new columns/tables. Existing credential-rotation authority permits INSERT of new clients while restricting UPDATE of secret_hash/rotated_at; this proposal creates once and offers no rotation seam. It does not claim existing generic HTTP creation is itself a secure supply vehicle. Legacy allowedResources/allowedScopes remain empty; MachineAccessGrant is the V1 authorization fact.

The source closure covers both Phase A registry and Phase B supply logic within the one CLI but exposes no combined APPLY and no runtime service API. Phase A allows only absent-to-exact Audience@1 plus same-transaction registry audit; wrong existing or unaudited rows refuse. Phase B performs zero Audience writes and requires completed Phase A plus separate actual-loaded runtime/DB agreement evidence. Exact source, generated and loaded coordinates are separate throughout.

Table locks precede the advisory query and data snapshot, cover every six-table predicate/write set and block uncooperative row writers. The chosen existing reconciliation-family advisory key is explicitly shared intentionally, not claimed to protect unrelated writers on its own. Serializable conflicts/timeouts abort once; nonce claim, protected fence and fixed external-ref lane prevent duplicate attempts. Non-target digests and complete projections test bystander invariance. No accepted audit/token/profile meaning is silently weakened.

Credential custody is concrete: generate once after durable attempt fence, scrypt verifier only in DB, root-owned protected same-filesystem escrow, final file fixed to uid502/gid20 and0600, no ancestor ACL/chmod workarounds, descriptor/inode/symlink/hardlink checks, fsync, absent-preimage no-replace CAS and internal verifier comparison. File installation precedes commit, and the Spec expressly rejects a shared atomic filesystem/DB claim. Insufficient rights or unprovisioned escrow blocks before generation; separate setup is not hidden in this vehicle. Error/receipt schema excludes secrets and raw exceptions. Final private JSON matches the existing MCP credential loader fields.

UNKNOWN recovery keeps the original operation, nonce, fence and secret. Read-only reconcile classifies exact committed, committed delivery incomplete, stable proven noncommit, secret lost or unresolved/refused. Recovery only installs proven original bytes under a fresh mandate and exact CAS; it cannot rotate, mint another secret/client, overwrite a foreign file or infer rollback from an exception. Exact rerun is all-write-zero. Proven noncommit cleanup and escrow retention deletion remain separately authorized; non-secret fences/audits persist. These obligations are discriminating and map to real PostgreSQL, filesystem, process-kill and concurrency fault tests.

Connector subject is a DSH/MCP configuration UUID, distinct from Auth sub, reader/target IDs and CSESB lineage. The input connector receipt establishes original transport/subject provenance; Auth success evidence binds the generated IDs and the original receipt digest. Product configuration/Binding/enablement remains outside the Auth tool. Nothing requires a temporary CSESB table to become a runtime identity lookup, and no production attestation adapter is falsely claimed available.

Registry rollback is a separately mandated stopped-service forward active@1-to-disabled@2 update with audit and retained row. It neither reactivates nor deletes. Runtime/source restore is the original release owner's separate action, and serving remains stopped through unknown/mixed state. Supply rollback never remints or deletes proven committed identity/audits. Normal stop-send retains result authentication; full client/grant/audience/TLS disable is correctly distinguished. These are bounded, explicit safety/availability semantics rather than hidden automatic compensation.

## Structure, Acceptance and deterministic verification

Independently executed on the committed blobs:

- Draft202012 frontmatter validation against the repository schema: PASS for both new records; status proposed and production_apply_authority none.
- Ordered required sections1..13: PASS for both.
- CCR: 8 stable Contracts all mapped by7 Acceptance rows. Supply:12 stable Contracts all mapped by10 Acceptance rows and explicit coverage matrix. Methods state isolated DB/OS/issuer environments, required observations and concrete failures. All future execution remains NOT_RUN.
- Both new metadata records pass validate_metadata with zero errors.
- verify_governance.py --target <worktree> --require-accepted: exit0; vendored bytes match lock and accepted adoption.
- git diff --check: PASS; four docs-only changes; every existing Spec byte unchanged.

Whole-repository transition validation DOES NOT PASS. Independent base-to-base and base-to-candidate projections both contain the same20 old errors: historical superseded successor fields use arrays/non-strict backlinks, old governed_by strings include '(accepted)', and dependent historical-edge checks consequently fail. Candidate error delta is zero. The existing AUTH_SERVICE_AGENTCORE_HR_DISPATCHER_IDENTITY_V1 YAML scanner error occurs on identical bytes in both projections and is excluded symmetrically with an explicit recorded limitation. It was not normalized, repaired or hidden. This is not a new candidate metadata failure or proof of whole-repository validation success. Current local governance enforcement reality and this task do not make unrelated historical repair part of this bounded proposal.

Product/source tests, runtime load, production DB/identity/credential effects, real token minting, DSH enablement and business messages were NOT_RUN by this reviewer. No live conformance or runtime availability claim is made.

## Finding union and decision boundary

BLOCKER_UNION = []
LOAD_BEARING_SPEC_GAPS = []
CANDIDATE_NORMATIVE_FIXES_REQUIRED = []

One citation uses the historically accepted svc-forum reconciliation Spec as a mechanism precedent although that predecessor is now superseded. The current candidate does not derive MCP mutation permission from it: the new child owns the exact new scope and explicit lock/audit contracts. No ancestor scope is widened, so this wording is not a blocker or a required revision.

The exact reviewed proposed content is suitable for mayf3 / explicitly delegated Auth maintainer to accept. Acceptance still requires the actor's attributable exact-head lifecycle action, independent final-head recheck and merge into main. Independent review cannot perform those actions or authorize current implementation/production. Any normative edit to these four frozen contents invalidates the affected review and needs review at the new exact hash. No platform expansion, old-governance repair or second production executor is recommended.
