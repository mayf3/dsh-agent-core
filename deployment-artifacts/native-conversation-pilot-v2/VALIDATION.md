# Fixed candidate verification

All results below are isolated source evidence. No production load, live OAuth credential POST, production ACL/Binding/identity mutation, dot round trip, blog publishing or Workflow change was performed.

| Surface | Exact verification | Result and limit |
|---|---|---|
| Minimal DSH slice | 8 named test files on CODE `1c69e052c9d232e67e4b5dc21355ecb0b9798109`, original system Node v25.6.1, captured actual dependencies, synthetic roots/agents | **41/41 PASS**, root re-ran after freeze; includes source recovery, exact relation, idempotency, original fence, fail-closed, original compose/store and entry OFF |
| Source custody | Included real writer UID502 and reader UID505 fixture with temporary macOS ACL and cleanup | **2/2 PASS**, subset of 41; parent read/ACK, no source-body write, child denied ACK, inherited ACL on rename, unsafe owner/mode/link/ACL and hash mismatch fail closed, TTL preserves source bytes; production ACL NOT_RUN |
| Actual MCP config loader | Real `mcp/src/native-conversation.mjs` at remote `90cc8ed`, synthetic files and fake loopback DSH | 10 negative/positive cases (plus parent test): nonloopback, https endpoint, extra keys, subject mismatch, newline secret, bad client charset, disabled, unauthenticated transport, unsafe mode/symlink; rejected cases make zero fake DSH calls |
| Actual DSH validator | Real candidate auth module | 6 cases: valid, HTTP, two clients, two targets, disabled, send-withdrawn |
| Config loader total | Node TAP includes the two parent tests | **18/18 PASS**; not the old copied MCP schema |
| Proposed TLS sidecar | Original Node executable, temporary CA→IP-SAN leaf, recording HTTP fixture | **1/1 PASS** containing actual POST Basic/form transit, same Node fetch+NODE_EXTRA_CA_CERTS, no-CA and wrong-SAN rejection, exact route/method/content caps, upstream redirect no-retry, derived XFF/XFP, no caller cookies/forwarding, no-store+Pragma:no-cache; no live credential used |
| Final config+TLS invocation | `node --test scripts/config-loader-tests.mjs tls/token-proxy.test.mjs` from packet paths | **19/19 PASS**, log retained |
| Offline config renderer | Synthetic attested-receipt shape; actual disabled 0600 outputs; four bad receipt controls and four no-write path controls | **9 checks PASS**; only new children of the fixed offline generated-configs directory allowed; no credential output, no production installation |
| Dependency closure | All real-baseline/candidate/MCP symlinks resolved strictly in their own snapshot | **2913 links**, no broken/external link; full content/mode/link manifest verified separately |
| Actual baseline | Complete system app source capture and final readback | **303 source files**, zero read failures and zero live-byte drift; no historical Git commit is asserted for an installed non-Git tree |
| Minimal operational delta | Compare actual baseline to frozen candidate | **18 runtime files** = 11 add +7 local edits, **0 delete**,296 original files byte-identical;10 added test/fixture files excluded from deploy-tree |
| Deployed safety code | Exact `event-correlation.js` and original reconciliation/HR/launcher/core modules | Original SHA `47693d4d79af4e0643078e4f178bd341457b8418c07892d1a65d846f07af58bc` preserved; old launchd SHA stamp is not loaded-byte proof |
| Rollback bytes | BSD tar `--acls --xattrs`, actual app+deps+system plist, independently read and compared | **71800 archive entries /66443 regular files**,0 baseline byte mismatch; private archive hash in COORDINATES; runtime data not copied; DS rollback admission NOT_RUN |
| Independent source review | BASE/CODE Git blobs and18-file runtime manifest, actual UID fixture + loader/TLS re-run | PASS for reviewed delta; original P1 retained in report and closed with evidence; production readiness excluded |
| Independent other-surface review | Auth CCR, identity/TLS design, sidecar, plist, renderer | PASS after forwarding/cache-header/output-boundary fixes; auth CCR remains draft and external gates remain |

Source test command (working directory `real-candidate/source`):

```sh
env -u HTTP_PROXY -u HTTPS_PROXY -u NO_PROXY -u http_proxy -u https_proxy -u no_proxy -u ALL_PROXY -u all_proxy -u NODE_USE_ENV_PROXY /usr/local/libexec/agent-core/node-runtime/bin/node --test packages/product-api/test/conversation/pilot.test.js packages/product-api/test/conversation/native-source-fault.test.js packages/agent-router/test/route-chain/conversation-runtime-seam.test.js packages/agent-router/test/route-chain/conversation-source.test.js packages/agent-router/test/route-chain/conversation-source-ownership.test.js packages/demo-server/test/session-seam.test.js packages/production-runtime/test/entry-conversation-env.test.js packages/production-runtime/test/compose-conversation-backport.test.js
```

The earlier38/38+DSH6/6+copied-MCP7/7 report remains unchanged at the v1 receipt. Existing HR aggregates, website and artifact pagination were not retested. There is no claim of full repository-suite PASS, actual auth acceptance, loaded JS byte identity or business success.

`SPEC_COMPLIANCE = PASS` for this source/package delta under accepted DSH r3 and MCP contract. Governing accepted Spec bytes are unchanged. Source authority does not authorize production auth CCR, TLS/ACL/identity/Binding/load/send actions. `PRODUCTION_APPLY = NOT_RUN`; `BUSINESS_ACCEPTANCE = NOT_RUN`. Real remaining blockers are explicitly listed in README/RUNBOOK and owning-authority drafts; no approval is inferred from fixture results.
