| 测试原文标题 | 测试文件与位置 | 整合 R1 | 基线 R2 | 集合判定 |
|---|---|---|---|---|
| packages/agent-router/test/process-lifecycle/feishu-reply-delivery-result.test.js | `packages/agent-router/test/process-lifecycle/feishu-reply-delivery-result.test.js:1:1` | FAIL / TAP 21 / L1946 | FAIL / TAP 21 / L1853 | 共同失败 |
| broker RPC: executed as the ACTUAL proc.agentId via the gateway | `packages/agent-router/test/broker-rpc.test.js:81:1` | FAIL / TAP 28 / L168 | FAIL / TAP 28 / L168 | 共同失败 |
| broker RPC: passes the exact immutable active-turn context beside actual agentId | `packages/agent-router/test/broker-rpc.test.js:112:1` | FAIL / TAP 29 / L187 | PASS / TAP 29 / L188 | 整合独有失败 |
| broker RPC: stale generation, settled execution, and cleared turn never forward ingress context | `packages/agent-router/test/broker-rpc.test.js:146:1` | FAIL / TAP 30 / L206 | PASS / TAP 30 / L200 | 整合独有失败 |
| broker RPC: delayed turn-A carrier cannot inherit live turn-B ingress context | `packages/agent-router/test/broker-rpc.test.js:170:1` | FAIL / TAP 31 / L225 | PASS / TAP 31 / L210 | 整合独有失败 |
| seam: a gateway THROW resolves as mutation_outcome_unknown with zero automatic retry (true transport loss semantics kept) | `packages/agent-router/test/broker-rpc.test.js:322:1` | FAIL / TAP 36 / L277 | FAIL / TAP 36 / L252 | 共同失败 |
| seam: a structured gateway failure passes through declared codes verbatim at the correct depth | `packages/agent-router/test/broker-rpc.test.js:334:1` | FAIL / TAP 37 / L299 | FAIL / TAP 37 / L274 | 共同失败 |
| D1 main first deliver: accepted, sessionId fixed main, one process, one prompt | `packages/agent-router/test/delivery.test.js:147:1` | FAIL / TAP 56 / L439 | PASS / TAP 56 / L414 | 整合独有失败 |
| D2 main again: same fixed session, process reused, no second mapping | `packages/agent-router/test/delivery.test.js:163:1` | FAIL / TAP 57 / L461 | PASS / TAP 57 / L429 | 整合独有失败 |
| TRUSTED_INGRESS: exact Feishu chat/conversation/message fields reach the routed turn without parsing | `packages/agent-router/test/feishu-regression.test.js:159:1` | FAIL / TAP 70 / L652 | FAIL / TAP 70 / L610 | 共同失败 |
| V2 normal: first contact binds workspace=null + session main, turns in the Agent primary workspace | `packages/agent-router/test/feishu-v2-normal.test.js:129:1` | FAIL / TAP 81 / L853 | FAIL / TAP 81 / L811 | 共同失败 |
| V2 normal: the conversation-derived workspace is NEVER chosen | `packages/agent-router/test/feishu-v2-normal.test.js:147:1` | FAIL / TAP 82 / L908 | PASS / TAP 82 / L865 | 整合独有失败 |
| E: valid canonical credential — child initializes on the openai-codex route | `packages/agent-router/test/luna-credential-chain.test.js:157:1` | FAIL / TAP 101 / L1141 | FAIL / TAP 101 / L1089 | 共同失败 |
| F: missing credential fails loud on the real chain — never a silent fallback | `packages/agent-router/test/luna-credential-chain.test.js:169:1` | FAIL / TAP 102 / L1159 | FAIL / TAP 102 / L1107 | 共同失败 |
| G: unsafe credential (group/world readable) fails loud on the real chain | `packages/agent-router/test/luna-credential-chain.test.js:186:1` | FAIL / TAP 103 / L1179 | FAIL / TAP 103 / L1127 | 共同失败 |
| D: imported agent — spawn hands the process the imported workspace + env mechanically | `packages/agent-router/test/primary-workspace.test.js:159:1` | FAIL / TAP 104 / L1208 | PASS / TAP 104 / L1155 | 整合独有失败 |
| R3: a settled or unknown turnExecutionId proves nothing (absent leaf) | `packages/agent-router/test/process-lifecycle/message-origin.test.js:175:1` | FAIL / TAP 248 / L2186 | FAIL / TAP 248 / L2093 | 共同失败 |
| scripted native rounds obtain fresh parent proof after prior settlement through real child transport | `packages/agent-router/test/route-chain/native-goal-composed.test.js:14:1` | FAIL / TAP 472 / L3704 | FAIL / TAP 472 / L3611 | 共同失败 |
| real child timeout removes native queued admission before old owner release | `packages/agent-router/test/route-chain/native-goal-composed.test.js:74:43` | FAIL / TAP 473 / L3723 | FAIL / TAP 473 / L3630 | 共同失败 |
| real child cancel removes native queued admission before old owner release | `packages/agent-router/test/route-chain/native-goal-composed.test.js:74:43` | FAIL / TAP 474 / L3740 | FAIL / TAP 474 / L3647 | 共同失败 |
