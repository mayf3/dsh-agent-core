# R41 Preflight Credential and Complete Artifact Binding

## Credential separation

The real rehearsal requires separate trusted inputs:

```text
R30_REAL_WORKFLOW_BASE_URL
R30_REAL_WORKFLOW_TOKEN
R30_REAL_WORKFLOW_AUDIENCE
R30_REAL_WORKFLOW_SCOPE

R30_REAL_KICK_BASE_URL
R30_REAL_KICK_TOKEN
R30_REAL_KICK_AUDIENCE
R30_REAL_KICK_SCOPE
```

The due-feed/dispatch-intent read uses the svc-workflow address and Workflow audience/scope. The Kick POST uses the Agent Core execution-kick address and its own audience/scope. The test rejects equal endpoints, tokens, audiences or scopes; no credential is copied between services and no production auth rule is relaxed.

## Complete candidate artifact

`create-r38-artifact.mjs OUTPUT FULL_SHA --full-repo` builds the complete tracked production candidate tarball, embeds `artifact-manifest.json` with the full commit, and emits an external manifest containing the tarball SHA256. `verifyArtifactBinding(..., requireCompleteArtifact:true)` rejects a partial package and verifies the tarball's overall digest plus embedded commit. `r38-artifact-binding.test.js` mutates a copied candidate tarball and proves the old manifest fails with a digest mismatch, so an old PASS cannot survive candidate bytes changing.

QA, arch and itops must use the same external manifest and tarball; none may resolve a fresh HEAD independently.
