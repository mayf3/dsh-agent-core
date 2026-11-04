# R38 Immutable Artifact Binding

The release candidate is one artifact tuple, not a mutable Git HEAD:

```text
candidate.tgz
candidate.tgz.manifest.json
```

The tarball contains `artifact-manifest.json` with the full 40-character commit SHA and per-file SHA256 values. The external manifest contains the tarball SHA256, the same commit SHA, and the file map. `verifyArtifactBinding` checks all three identities:

1. tarball bytes == external manifest `tarballSha256`;
2. embedded manifest commit == external manifest commit;
3. workspace source bytes == declared file digest == extracted artifact bytes.

`r38-artifact-binding.test.js` builds a temporary candidate tarball and verifies these identities. It does not merely check that `git rev-parse HEAD` looks like a SHA.

## Shared-version protocol

- **QA:** runs the regression suite against the candidate tarball and archives the external manifest plus raw test output.
- **Arch:** reviews the same manifest's commit/file map and independently verifies tarball digest before acceptance.
- **itops:** stages exactly that tarball, verifies the same SHA256 and embedded commit, records previous/candidate hashes in the release receipt, and rolls back to the previous tarball—not a newly resolved HEAD.

The R37 cross-process restart test remains in the same candidate test set. Production deployment is not performed by this change.

## R39 rehearsal API contract

The real Workflow rehearsal first reads the authoritative due feed (`/internal/v1/dispatch-intents`) and selects the exact matching `dispatchIntentId`. It then POSTs only `{workflowInstanceId,nodeVisitId,dispatchIntentId}` to `/workflow-execution/kicks`. Both `{ok:true,kicked:true}` and `{ok:true,coalesced:true}` are transport successes only; the test never treats them as business completion. Independent event and turn readback paths must confirm the resumed turn and Workflow event.
