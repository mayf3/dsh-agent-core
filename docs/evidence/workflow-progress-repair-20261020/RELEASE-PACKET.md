状态：Qoder 草案经协调者事实复核，供主协调者审查；仅候选核验包，本次生产写入为零。

# Assistance 安装闭包候选核验包（非发布授权）

## 结论

本包只核验既有产物是否闭环，不含新增 API 实现，也不构成发布授权。源、安装、header 三处差异已确认：source 有 read/action/request 三个 manifest（manifests.js 导出、index.js 注册）；安装目录缺该模块与 manifests.js（旧 index 直接注册 workflow.js）；三例目标 session header 均 77 tools 且无 assistance；当前 PID 实际加载的 bytes 仍为 UNKNOWN。873fd520f1e4511a4514d2ab16aecfc2c6f53623 的 request.open 沿用 V1 blocked→Assistance + WEC §4 的 pattern，未改 Spec，不得当作独立 Spec authority；WEC §4 仅显式 read/action。V1 已被 accepted V2 全量替代：CTR-WAE-008 target 以 own Principal open existing assistance，CTR-WAE-009 broker manifests unchanged。UID502 PID62717 绑定 root=/Users/yanfenma/.agent-core，启动日志明确 WEC poller disabled（WORKFLOW_EXECUTION_POLLER_AGENT_ID 未配置；当前可变状态未被独立暴露）；不得归因 UID505 PID43954（root/ledger/WEC/load 为 UNKNOWN）；health 不含 WEC readiness。HANDOFF 是 evidence not authority；旧 pins svc1249ec42、dshfbd2e399 过时，须重冻源码/生产 preimage/完整依赖，不能以单个 JS 热修替代。实现/发布方须对照 accepted 契约完成 scope 判断。

## 依赖与顺序

1. 只读 preflight：实际 migration head、0027/0028 及后续兼容；WEC base live face（trace GET 应 401 非 404）；kick 配置由 custodian 出非 secret 摘要。0027 仅为旧包基线，不得回退 migration。
2. 另获生产窗口后：核验后仅补尚未应用且兼容的 migration 0028 → svc 完整 binary → dsh 完整 binary；dormant 安装与 poller 启用分阶段。
3. 启用前 Owner 指定唯一 dedicated poller（禁 hr-agent/efficiency-agent；不入 FORUM_OPERATOR_AGENT_IDS），最小 grant：workflow.read/execute、GLOBAL_SCHEDULER_READ、auth.agent.resolve、agent.session.send、forum.read/write。WHO blocker 现为 UNKNOWN，须 readback，不得假定或另造 identity。
4. 未启用时 wake 返回 503 poller_unconfigured，svc outbox 继续 retry；svc 回退到 pre-#68 binary 会吞 unknown outbox kind，需 OWNER_ASSISTANCE_WAKE 未投递行归零，migration 0028 leave-forward。

## 离线/将来线上验收

source tests（scope split、CAS/idempotency、assignee 与 owner 角色、UNKNOWN 不重试、one-wake dedupe）→ 完整 build/installation manifest hashes → 精确 PID 启动与新 session 工具 header（按角色验证获准能力） → 只读 owner inbox/detail → 另授低风险 canary：open→OWNER_PENDING→wake once→resolve/explicit HUMAN_REQUIRED；确认唯一 Workflow 执行责任 runtime。测试通过不等于生产已修复。

## 责任与未决项

- 原 deployment lane 负责 source→install→PID 闭包；Auth/Owner 确认唯一 poller 与既有 grant；assignee 负责业务与 open；domain owner 处理 resolve/escalate；WEC 负责有界重试且 UNKNOWN 不重放。
- 本次禁止：send/open/resolve/transition、deploy、restart、poller enable、ledger reset、DB write。
- 静态文件缺失不得判为所有实例停滞的唯一根因。


## Qoder 调用回执

```json
{
  "started_at_utc": "2026-10-20T11:47:21.639596+00:00",
  "finished_at_utc": "2026-10-20T11:47:52.249898+00:00",
  "requested_model": "DeepSeek-Flash",
  "observed_model": "not independently reported by CLI stdout",
  "tools": "empty",
  "mcp_servers": {},
  "no_session_persistence": true,
  "max_model_request_retries": 0,
  "exit_code": 0,
  "prompt_sha256": "b38dfa0b3fc90eb32341cd8ac59035f44e215a579c187de480bcce905833f033",
  "stdout_sha256": "f7c3715f735b42522bd7835e6c83347645d6fb096d728e3cc43eeeb28bc29dd3",
  "stderr_bytes": 0
}
```

调用参数：`qoder -m DeepSeek-Flash --tools "" --strict-mcp-config --mcp-config '{"mcpServers":{}}' --no-session-persistence --max-model-request-retries 0 --max-output-tokens 3000 -p <sanitized evidence prompt>`。

## 复核与证据边界

协调者核对 git 对象及既有现场证据，修正草案的三处歧义：disabled 只绑定该 PID 的启动记录；0028 仅补未应用项；吞 outbox 的回退风险限定 svc pre-#68。源码测试补充：协调者已执行 workflow-execution 全套及 broker transition/Assistance suites，233/233 PASS（Node v26.7.0）。这不包含包中其余所有验收步骤；build/install/load/live 仍未通过验收。

- 本地引用（未 fetch）：dsh `6d96f6d6f08c14e894ec4be9eab708ecf5b09635`；svc `bfc28c15320acab8cf7d7a36128cd5c9db9a1b1a`。这是可复核源码基线，**不是已批准 deployment target**。
- 现场证据：[runtime report](/tmp/workflow-readonly-20261020/runtime/11_runtime_report.txt)、[source/install diff](/tmp/workflow-readonly-20261020/runtime/14_assistance_install_source_diff.json)、[supplement](/tmp/workflow-readonly-20261020/runtime/15_assistance_supplement.txt)、[session facts](/tmp/workflow-readonly-20261020/sessions/facts.json)。采集窗口 2026-10-20 11:28–11:39 UTC；此包未重新读生产状态。
- 复用源：dsh `docs/evidence/wec-owner-assistance-deploy-handoff-v1-20260929/HANDOFF.md`；svc `docs/deployment/WORKFLOW_EXECUTION_CONTROL_V1_DEPLOYMENT_PACKAGE.md`。冻结新包必须重新读实际安装与原执行 lane；旧 pins 不可直接执行。
- 离线测试定位：`packages/broker/test/workflow-assistance-capability.test.js`、`workflow-assistance-request.test.js`；`packages/production-runtime/test/workflow-owner-assistance-wake.test.js`；`packages/workflow-execution/test/product-449-distribution-recovery.test.js`；`packages/product-api/test/workflow-execution-api.test.js`。这些路径已用上述 dsh git 对象核验存在。
- Qoder 只有文本输入，无工具、无 MCP；实际完成的是草拟本包，未被委派执行部署。stdout hash 对应未编辑草案；本包包含人工复核修订，因此两者 hash 不应相等。
