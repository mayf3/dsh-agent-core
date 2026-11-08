# #547 stopped capture evidence

Latest: **v4 STOPPED** after root's local file discovery referenced nonexistent
`docs/architecture`. The stderr is preserved in `stop-v4-receipt.json`; outer and
inner exit statuses were not retained and remain UNKNOWN. No v4 production read,
authsvc call, capture, scratch constructor or product test ran. Only stop-record
packaging and existing PR delivery continue. v1/v2/v3 raw evidence stays unchanged.

Previous: **v3 STOPPED** after a local helper query referenced a nonexistent source
file (rc=2). This is not a store/validator failure. No v3 production reads, capture,
constructor load or product tests ran. See [D-STORE-QA-547.md](../../../D-STORE-QA-547.md)
and `stop-v3-receipt.json`. `capture-v3.py` is an **UNEXECUTED / UNVALIDATED draft**,
including its local `--check`; do not run it under the current STOP.
`candidate-audit-v3.md` packages already executed source/dedup observations only.
No v1/v2 evidence or raw private data was modified.

Read [../../../STOPPED-547-STORE-DIAG.md](../../../STOPPED-547-STORE-DIAG.md) first.

`capture.py` is the exact script from the failed single attempt, retained for review.
**Do not rerun:** the stop condition has fired. No offline diagnostic was run.
The receipt records executed commands; partial-copy hashes do not certify consistency.

`capture-v2.py` is also the exact executed script, retained unchanged. **Do not rerun.**
Its broad `lock` substring matched `pre-fleet-unblock`, overcapturing one authsvc-readable
historical file. The v2 receipt's machine `PASS` means three-pass byte/stat consistency;
capture scope is **FAIL**, diagnostic continuation is **STOPPED**, offline predicates are
**NOT_RUN**. See the separate scope validation and v2 independent review.

`private/` contains v1 partial copies plus v2 three-pass store/source copies on this host only (0700/0600).
Only local JSON parsing for top-level v2 counts was done; it is not validator execution.
It is ignored by Git and must not be force-added, published, or treated as validated input.
Published artifacts contain paths, times, command results, byte counts and hashes only.
