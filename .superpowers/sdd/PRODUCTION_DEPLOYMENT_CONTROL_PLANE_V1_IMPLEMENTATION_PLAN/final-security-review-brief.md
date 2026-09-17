# Independent whole-branch security review brief

Read final-review-scope.md first; it is the accepted-Contract attention map.
Review all actual executable implementation paths and source adapters in the
controller-supplied full branch diff, against accepted Spec3986553 / accepted
basebb5327f622a0333f1e11d945319e024a3731f05a. Read the final exact task reports,
conformance and stable EVD records plus controller-rulings.md. The supplied diff
includes retained historical logs; navigate repeated logs by hunk index and read
relevant final observations. Read every source/test/config/report hunk once in
bounded chunks. Do not regenerate diffs, repeatedly reread unchanged sources,
or rerun reported suites. Focused outside-diff reads or disposable counterexamples
are permitted only for a named concrete suspected risk and must be documented.

User's security attack list: command injection, path traversal, symlink race,
user-writable privileged script, arbitrary launchctl, arbitrary chmod/chown,
environment injection, artifact substitution, TOCTOU, rollback privilege
escalation, mutex bypass, direct legacy deployment bypass. Cover all20Contracts
and14Acceptance rows. This is the final broad source/security review, not a fifth
implementation task or a deployment. Task gates are evidence, not blanket immunity
from real cross-component reachable findings.

Mandate: no production path writes, service restarts, ACL/sudoers changes, daemon
installation/enablement, privileged bootstrap, legacy switch/retirement, secrets or
root probes. Do not run sudo. Fixtures must refuse euid0 and outside private roots;
launchd/identity-changing behavior remains simulated until separately authorized.
No push, merge, ref/index/source edit, subagent, or broad test repetition. You may
write only your own designated review report plus explicitly scoped disposable
nonproduction probe material when needed. Preserve all previous observations.

Record independent SPEC/CONFORMANCE and QUALITY/SECURITY verdicts for actual scope,
and a distinct bootstrap readiness verdict. Known RP01–08 remain factual inputs,
not claimed waived conditions: real external authenticated bridges are missing;
exact native host/enrollment and useful complete release closure are incomplete;
local/ad-hoc signatures are not isolated trusted builder/reviewer authority; no
protected census/lifecycle denial or Owner activation has occurred. Do not infer
external services are absent just because their configuration is unknown. Decide
which exact source/integration gates these omissions prevent; never transform
bounded task approval into whole implementation/bootstrap PASS.

Freeze complete known blocker union once. Each blocker requires source authority,
current reachable counterexample, exact source coordinates, impact, minimal closure
and validation. Distinguish fixable code/evidence blockers, real external inputs,
and post-authorization production gates. Optional hardening without a reachable
violation remains FOLLOW_UP under local convergence policy. Record strengths and
limits, all required evidence qualifications, and a compact attack-list/Contract
disposition matrix. No fabricated privilege proof from fixture results.

Controller will give one union repair pass and one scoped re-audit for actionable
findings; do not invent a new Spec or ongoing generic hardening program. Report
full findings persistently and return only verdicts, IDs, report path, and concerns.

Readiness implementation question to resolve explicitly: distinguish unavailable
external facts from source code that would still refuse every fully valid resolved
input. Inspect prospective template equality and verifier/bootstrap-ready result,
production activation/native enrollment binding, and exact supported release face.
Determine which remaining code gaps can be repaired under accepted authority
without guessing external protocols, and which require real integration inputs.
A truthful nonready result is safe but does not by itself satisfy the user's
implementation-complete target; give exact source/Contract justification either way.

Also distinguish pre-authorization BOOTSTRAP_READY from activation permission.
CTR-DCP-017 says independent security review precedes separate Owner authorization
of the exact manifest, and bootstrap then writes its protected receipt. User
explicitly requests readiness before the first privileged authorization. Assess
whether current verification's unconditional false / Owner receipt blocker
conflates package reviewability with permission to execute. Neither producing a
ready package nor a positive offline review may authorize activation; conversely
absence of a future activation receipt alone cannot substitute for diagnosing
missing pre-bootstrap implementation/evidence.
