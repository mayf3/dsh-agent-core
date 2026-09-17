# Controller rulings and costs if wrong

These are scoped implementation/process decisions, not Product Authority or
production permission. They remain visible to independent review.

1. Use the native daemon; keep optional sudo deployctl transition disabled.
   Cost if wrong: a needed transition requires its own reviewed implementation
   and bootstrap disposition. No sudo grant was installed.
2. Invoke the packaged SDD scripts through bash with explicit output paths because
   their executable bit is absent. Cost if wrong: helper invocation/output needs
   correction; plugin files remain untouched.
3. Bind a restored release to a new immutable physical process-generation record
   instead of reusing its old generation receipt. Cost if wrong: stale physical
   state could be trusted; Task2 tests and independent re-audit address this.
4. Record absent external verification only as a protected daemon WAITING
   observation. Cost if wrong: authority could be confused with a verifier PASS;
   distinct provenance, restricted outcome, tests and Task3 review are required.
5. Put Task4 bootstrap/e2e tests in test/adoption/ with explicit Cargo targets.
   Cost if wrong: test discovery/wiring needs repair; executed targets verify it.
6. Prepare exact dependency candidate bytes offline, including deterministic path
   relocation when needed, under the existing non-production mandate. Cost if
   wrong: inert payloads need replacement/review; this never grants production
   execution, trusted-builder status, key authority or an ABI/version upgrade.
7. Validate execution-affecting plist environment within existing closure and
   environment-injection Contracts. Cost if wrong: a legitimate unsupported
   profile remains disabled until its precise loader behavior is reviewed.
8. Keep the reviewed Executor::apply signature with one reasoned function-scoped
   expect(clippy::too_many_arguments). Cost if wrong: that argument-heavy API is
   harder to maintain; no global lint suppression or runtime check was removed.
9. Move verbose installer commentary verbatim to a linked document and keep the
   executable script within500 lines with readable guards. Cost if wrong:
   documentation discoverability or extraction correctness needs repair. Require
   executable-line identity outside the guard, syntax and nonroot regression
   checks; no registry approval, packed code or rule change is inferred.
