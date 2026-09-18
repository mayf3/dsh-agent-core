# Independent public-byte record binder source review

**PASS for the pure fixed projection at parent09ae10b5298f0331e48ad058a9719a9e490ea03e, including the earlier372077b binder.** No authority, actual login completion, actual sudo hash or whole operator/package PASS is conferred.

Frozen and tested files:

- deployment-artifacts/control-plane-first-live-v1/bind_records.py SHA119000da25c27466ceb87047238b4a4f58c45101ef6bb33ea650db1e2f5313e3.
- deployment-artifacts/control-plane-first-live-v1/test_bind_records.py SHA1745f1dabb233be227436097ffc5c293297d70d5e506f1da636d2a8b34ba0966.

Both working files match git09ae10b. The module imports only hashlib/json, has no filesystem/network/process/auth I/O and performs no admission or signature operation.

The exact reviewed login manifest/helper/original-intent constants and one-hour grant schema are bound; booleans are not accepted as integer timestamps/version, unknown/duplicate fields and nonfinite JSON fail, and timestamp addition is u64-bounded. The expected receipt preserves original provider UNKNOWN and false review/activation flags. It hashes the original grant bytes, matching the reviewed native helper, rather than silently canonicalizing the digest input. Its receipt shape was compared with bootstrap/login_reconciliation.rs successful append path.

bind_packet checks the frozen template raw digest, requires observed receipt bytes to equal the exact expected native postimage, rejects already-populated derived fields, validates the one complete lowercase SHA line for exactly `/usr/bin/sudo`, and inserts only previous.login_receipt_sha256 and lifecycle.tool_sha256[/usr/bin/sudo] before canonical serialization. Missing/invalid maps, duplicate keys, forged differing receipts, wrong hash/path/spacing/multiple lines and static digest drift reject. No general arbitrary-field patch API is added.

Independent ordinary command in deployment-artifacts/control-plane-first-live-v1: `python3 -m unittest -v test_bind_records`, exit0,11 PASS. Log `first-live-preparation/bind-records-independent-review.log` SHA6f6b55e09193c686814ef24da939cbfc43638f5b1f2bb8eb73b369a137605338. Tests include exact output with only the two projections, original template immutability, raw-versus-canonical grant differences, missing/modified receipt, prefilled fields and malformed sudo observations.

Critical scope: a pure function cannot authenticate the provenance of bytes passed to it. Anyone can calculate an expected receipt. The completed outer operator must obtain the actual receipt from the protected successful once-only helper, enforce helper/process/auth-metadata postconditions, and preserve its exclusive attempt/UNKNOWN semantics; it must obtain sudo bytes from the authorized pinned shasum prefix after exact tuple/ACL checks, not user text. Native entry must independently re-read the actual protected receipt and revalidate digest, typed packet, grant, current state and preimages. These are retained integration gates, not proofs supplied by this module or its fixtures. No production input was fabricated or installed during review.
