# DEVELOPMENT_PREFLIGHT — private handler FD connection

Base05cae94b7261b374b9be110dfaedada1ccbc015d; isolated same single writer. REUSE accepted R2 one canonical owner/exclusive window/durable intent/no replay; r4 RQ-005. BRIEF / CONFORMANCE. Parent mandate2026-09-26 authorizes this nonproduction connector.

Capture only the actual handler-owned canonical FD and newly owned window FD, duplicate their open-file descriptions, bind the existing immutable intent digest, and reject wrong/reused/released descriptors or stale intent at boundaries. Retain these private capabilities with existing UNKNOWN custody; no durable fields. Fixed path identities and lock probes are local capability checks, never complete source closure. Production capture must reject before IO unless activated; explicit TEST_MODE assembled fixtures use disposable DS root. Fixed stop effects still require independent activation/inventory guards. No launch/readback/LE1/custodian completeness claim.
