# Independent focused source review: buffered issuer reply after peer close

REVIEWER = /root/dcp_first_live_binding_review  
AUTHOR_INDEPENDENCE = PASS  
SOURCE = 76fff5cc411ef42f2a865a00d799101cba1a2cb0  
SCOPE = issuer/server.rs tests and service/protocol.rs exact-frame read implementation only  
FROZEN_BLOCKER_UNION = NONE  
INDEPENDENT_AFFECTED_SOURCE_REVIEW = PASS  
WHOLE_OPERATOR_REVIEW = NOT_PERFORMED  
PRODUCTION_OR_PRIVILEGED_OPERATION = NONE

The two reviewed file hashes are `f57e28675f1778d01da4af6c0f2944509fce8bd714c378f860902bdb20c563b1` (issuer/server.rs) and `e281b8ae097f38f083b0b62da9685e75b20af72451628707c65be2115fdf4c08` (service/protocol.rs). Their working copies matched the exact commit before the independent checks. This is a bounded follow-on to the earlier issuer deadline review, not a reopening of unrelated issuer/custody findings.

The retained author RED log demonstrates a complete, buffered UnixStream frame rejected while setting SO_RCVTIMEO after peer close: errno22 and FILESYSTEM_IO. Its SHA256 is `1e136c3735c8254008cbc092d95c38209715859e799c17dc86f9ab0a039902b3`. That failure is distinct from a truncated frame or an elapsed read budget.

The repair uses poll plus MSG_DONTWAIT recv, with the same single deadline shared by the frame header and body. It no longer changes socket timeout options on a closed peer. Interrupted/would-block reads return to the bounded loop; nonrecoverable read errors and elapsed deadlines fail, and zero-byte receive remains DISCONNECTED. Readiness is checked against the deadline before receiving. Poll timeout rounding cannot extend acceptance past the deadline. No operation is retried, no second mutation is issued, and a complete response is not synthesized from partial bytes.

The inbound default remains one second, and only the existing outbound issuer reply path requests the bounded 900-second budget. The 4096-byte issuer reply limit, other caller-supplied internal frame limits, depth16, strict higher-level parsing and zero/excessive budget rejection are unchanged. The server's peer authorization and endpoint behavior are untouched. This change introduces no caller-selectable command, identity, path or issuer.

Independent execution used ordinary private UnixStream/fixture endpoints only:

| Check | Result | Log SHA256 |
|---|---|---|
| `cargo test --locked --lib deadline_tests -- --test-threads=1` | 5 passed, including 200 completed-frame/closed-peer pairs, truncated close, delayed real reply, total deadline/length/depth and default inbound bounds | `001f1b2b299434ef6b66ce2bbcc476e4a9242c1cd60db0a952b0f5fc827f00ee` |
| `cargo test --locked --test socket -- --test-threads=1`, isolated exact-commit archive | 9 passed; real private transport identity/scope/quota, slow partial frame, depth/size rejection, unprivileged production-entry refusal and fixture safety | `3b9a48d26553ff6e8ed3939f75dafbbe6e04b19656c661142c7c13bda7e8cac6` |

Logs are `first-live-preparation/independent-issuer-peer-close.log` and `independent-protocol-socket-frozen.log` under the existing external artifact root. The exact package source archive SHA256 is `acb1003d25c2d28df6ff9c4aff2bf14e51d3ef302b2ad91e07b4f9922b856fbb`; it was extracted into the reviewer's private kernel-selected temporary directory without modifying the author's tree.

An intermediate socket-check attempt against the shared working tree did not run tests: concurrent uncommitted registry-bridge work failed compilation on private reexport visibility. It is retained as `independent-protocol-socket.log`, SHA256 `d505f1224cd656e53d9c0929ae8cc7c3495498c7b551164a8e33aace48fcea39`. This is neither a PASS nor a defect attributed to the two-file frozen framing candidate. The isolated exact-commit check resolved that review-environment ambiguity without pausing or changing author work.

No full-suite, fmt, clippy, release, complete operation/package or production-readiness claim is made by this report. The parent retains its separate validation and affected integration obligations. No root call, live service/issuer endpoint, production mutation, key/authentication read, source edit or installation occurred.
