# HR first-effect root receipt reader — independent implementation review

Date: 2026-09-29  
Verdict: **PASS for nonproduction implementation and review only**

I independently reviewed the four `scripts/lib/hr-shim-first-effect-receipt/` files at implementation commit `1c31c00295a47856b0deb49f4ba82e9c51709bae` against the accepted contract on base `4b6ff3bed549226e5219bbb0b19749b9fbb4cc2b`, whose Spec SHA-256 is `63f84df802a172facc0feef4182b24e36fa474871420751e51e1abc801c3b25a`. I was not the product-code author. The scope was the fixed, parameter-free reader, its tests, and the pinned DS candidate builder; I did not perform a protected read or installation.

The initial implementation at `2379fa3f564b6ed8833fec3a8d7378ca7442cedc` could report `COMMITTED_RECEIPT_PRESENT` while an unsupported `aborted.json` was also in the operation directory. Commit `1c31c002` closes that blocker: it enumerates the held operation directory, accepts only the four launched journal names, checks no-follow metadata and entry identity before returning a positive state, and returns `UNKNOWN` for unsupported entries. The added tests cover both `aborted.json` beside a valid receipt and `failed.json` beside intent. I also checked that valid `rollback.py` and `candidate.py` entries retain the expected positive classification, including the post-swap rollback hardlink count of one.

Focused unittest discovery passed **23/23**. In-memory composition from the pinned DS baseline SHA-256 `daeb44fc0c23a7a2949519a5d6abcc9459e38936e10bc704d85b25794f7a74d6` produced deterministic inert and bound candidates, with one fixed handler call in each. The review found no remaining blocker in the affected surface. This verdict does not attest to a live root transaction outcome, authorize protected installation, or resolve the existing HR `UNKNOWN` state.
