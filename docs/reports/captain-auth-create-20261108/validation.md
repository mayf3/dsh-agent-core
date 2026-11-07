# Executed documentation validation

Initial candidate: `364151fda95aec7dab77f8f15adffb7a4b4f0fcc`.
Base: `80fc43bd626ceaf5a680f9355ac9c8b209cdd82b`.
Environment: `/private/tmp/h-captain-auth`, UID502, branch
`docs/captain-auth-create`, 2026-11-08 Asia/Shanghai.

| Executed check | Actual result | Limit |
|---|---|---|
| Python JSON/Owner canonical digest and source-hash verification | rc 0; canonical digest matches; 20/20 file SHA256 match | Files and source provenance, not running-process byte identity |
| Evidence metadata / task request-counter assertions | rc 0; no credential content read/hash; one public health GET, zero token/identity/DB/runtime mutation calls recorded | Counter provenance is this task's recorded operations, not a global server audit |
| `python3 .agents/tools/verify_governance.py --target . --require-accepted` | rc 0; vendored bytes and accepted lock match | Governance integrity only |
| `git diff --cached --check` before initial commit | rc 0 | Whitespace only |
| Scan five committed files for JWT-shaped values, private-key headers and credential-value assignments | rc 0; no matches | Bounded pattern scan, not a universal Secret detector |
| Non-author review of initial exact HEAD | PASS; frozen blockers `[]`; 0 blockers / 0 Spec gaps | See independent-review.md; no Auth operation acceptance |
| Fresh remote branch read | main still `80fc43bd626ceaf5a680f9355ac9c8b209cdd82b`; requested new branch absent | Observation before push only |

No product code changed and no product test suite was run. Auth creation,
canonical enrollment, appointment, management authentication and production
acceptance remain unexecuted. Final-HEAD Git/PR readback belongs to the
delivery record; it cannot turn this stopped operation into a creation receipt.
