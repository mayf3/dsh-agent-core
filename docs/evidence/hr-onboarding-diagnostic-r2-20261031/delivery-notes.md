# #953 R2 development preflight and review

## DEVELOPMENT_PREFLIGHT

```text
Problem = recover read-only evidence for #953 layers 2-4 and compare failed/successful cases
Governing Spec = AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1 (investigation placement);
                 AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1 (identity boundaries);
                 AGENT_WORKSPACE_SESSION_V2_CORE_ALIGNMENT_SPEC (Feishu prebound gate)
Spec status = accepted (all three at continuation parent f5a530ef)
Relevant investigations = #953 SOURCE comment 6119942432; #965 final comment 6119953594;
                          selected source/readback/case evidence in this directory
Relevant decisions = parent D-006 V2; fetched main D-008 V3 supersedes D-006;
                     both distinguish fixed Feishu identity from generic Router switch
Previously rejected alternatives = implicit default binding as Feishu product policy;
                                  legacy identity substitution; OpenClaw restoration;
                                  credential provisioning as automatic grant
Frozen boundaries = exact IDs; trusted-parent-only credential boundary; no private credentials,
                    full auth files or session content; no real hiring/group/auth call;
                    no install/deploy/restart/apply/replay/production write
Implementation scope = investigation, selected evidence, repair proposal; zero product/test delta
Out-of-scope = production acceptance; new tools/IAM; redefining onboarding completion;
               changing unrelated pinned Harness tests
New evidence = production composition already gates unknown Feishu groups before generic Router;
               provisioning code now exists at fetched main and on disk;
               true failed/successful recruitment receipts still unavailable
Need new/amended Spec = NO for evidence-only delivery;
                       onboarding completion candidate requires independent acceptance before implementation
```

The primary agent emitted the preflight in user-facing commentary before adding investigation/evidence files.
This record does not create implementation or production authority.

## Independent read-only review

Reviewer: delegated `source_contract` agent, separate from the author and validation agent.
Review result: evidence conclusions acceptable; no demonstrated minimal product repair omitted.

- Recomputed all 15 Git-source section blob hashes and checked every quoted source line: zero mismatches.
- Checked 9 on-disk file hashes, 4 on-disk excerpts, registry and provenance file hash: match.
- Reread selected #965/#419/#469 comments: relevant assertions match.
- Confirmed no known secret/private-session disclosure and no fixture or unrelated error substituted for the failed case.
- Required precision edits were applied: limit “first SOURCE gate” to the binding layer; require actual `unbound` reason and same loaded accepted contract before classifying a real case as lawful denial.
- Added `git-preflight.json` with command/rc proving original worktree clean, exact parent, unchanged product bytes, and absent remote 953 branch before publication.
- Reviewer explicitly disallowed describing rc=1 as “existing tests green.” Final report preserves that limitation.

## SPEC_COMPLIANCE

```text
SPEC_COMPLIANCE = PASS (evidence-only scope, not product implementation acceptance)
GOVERNING_SPEC_UNMODIFIED = YES
PRODUCT_DIFF = NONE
EXISTING_TEST_DIFF = NONE
KERNEL_CHANGE = NONE
PRODUCTION_WRITES = NONE
FULL_TEST_TARGET = FAIL (pre-existing Harness dependency identity mismatch; see validation.md)
BUILD = NOT_DEFINED (source parsing PASS is reported separately)
LOADED / EXPOSED / BUSINESS_VERIFIED = UNKNOWN / UNKNOWN / NOT_VERIFIED
ISSUE_953_END_TO_END_ACCEPTANCE = NOT_CLAIMED
```

No merge or deployment approval is requested or implied. Issue #953 stays open.
