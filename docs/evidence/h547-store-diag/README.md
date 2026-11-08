# #547 stopped capture evidence

Read [../../../STOPPED-547-STORE-DIAG.md](../../../STOPPED-547-STORE-DIAG.md) first.

`capture.py` is the exact script from the failed single attempt, retained for review.
**Do not rerun:** the stop condition has fired. No offline diagnostic was run.
The receipt records executed commands; partial-copy hashes do not certify consistency.

`private/` contains unparsed partial production copies on this host only (0700/0600).
It is ignored by Git and must not be force-added, published, or treated as validated input.
Published artifacts contain paths, times, command results, byte counts and hashes only.
