P1-B only (P1-A blocked on spec-author)

Refs mayf3/agent-control#1374.

Adds six longitudinal regression tests for the existing managed create, resolve-current-review and escalation operations. The first request saves the effect in a local Svc substitute and loses its HTTP response; ledger generations 2 and 3 use the original effect/command/result on SUCCEEDED and issue no new POST on UNKNOWN. Trusted attempt/generation coordinates stay out of the business request/key. Product code and existing semantics are unchanged.

Validation: new tests 6/6, existing five-suite baseline 67/67 (unchanged hashes rebound from base), governance integrity rc=0, structure V2 candidate delta pass with 28 inherited debt findings and zero candidate violations. Independent affected-contract review PASS.

The tests use real Core ledger/context/Gateway and loopback HTTP with fixture Svc persistence and seeded admission eligibility/quiescence. Real Svc DB, process crash and production/business acceptance remain UNKNOWN. No merge or production changes are authorized.

Full commands, raw output and hashes: docs/evidence/ekr-p1b/. Receipt: RECEIPT-EKR-P1B.md.
