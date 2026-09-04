---
report_id: ASM_STANDALONE_PRODUCTION_DEPLOYMENT_V1
goal: AGENT_SESSION_SEND_STANDALONE_PRODUCTION_V1
date: 2026-09-05
authority: AGENT_SESSION_SEND_STANDALONE_DEPLOYMENT_AUTHORITY_V1 (accepted, PR #165, main 451d98e)
result: AGENT_SESSION_SEND_PRODUCTION_READY = YES
---

# ASM_STANDALONE_PRODUCTION_DEPLOYMENT_V1 — 终态报告

## 1. 部署时间线（诚实记录，三次 Owner 执行）

```text
22:57 attempt 1  apply 1/17 后死于 SIM_FAIL_AFTER unbound（real-only 车辆 bug；
                 set -u 下 sim 变量在 real 分支未定义）。单文件漂移，
                 RESTORE_BASELINE_OWNER.sh 从 backup 字节级恢复（17/17 验证）。
22:59 attempt 2  apply 17/17 + restart 成功，health 误判（生产 /healthz 返回
                 {"status":"ok"}，车辆 grep '{"ok":true}'——sim stub 自造格式掩盖）
                 → 车辆自动 equal-face 回滚（receipt ROLLED_BACK，字节级验证 17/17）。
23:02 attempt 3  修复（注入变量无条件默认 + health 断言双格式 + sim stub 改用生产
                 shape，全 sim 12/12 回归）后 DEPLOY_OK：
                 /Users/Shared/agent-core-deployment-receipts/ASM-STANDALONE-20260904T230257Z-RECEIPT.json
                 （17 文件 before/after sha256+mode、restart=1、health ok、catalog 记录）。
两次失败均为零用户可见影响（第一次未重启；第二次自动回滚+重启回基线）。
教训已入 memory：sim-only 变量必须无条件默认；sim stub 必须用生产真实 shape。
```

## 2. Post-deploy runtime readback（机械证明）

```text
ASM_RUNTIME_VISIBLE   = YES（部署树 import census：20 manifests 含 agent_session_send）
ASM_SCHEMA            = EXACT（toolName/operation=send/local=agent-session-messaging/
                        恰 3 required args/timeout 0..300/message minLength1+nonBlank/
                        scopes=[agent.session.send]/15 错误分类——逐字段）
ASM_ALIASES           = ABSENT（a2a_send/sessions_send/send_message = 0）
WORKFLOW_EXECUTE      = PRESERVED（7 workflow manifests；workflow.js 字节未动）
SCHEDULER             = PRESERVED（manifest 在场；restart 后 scheduler loop online）
FORUM_FACE            = UNCHANGED（7；moderator=0）
MODEL_FLEET           = UNCHANGED（model-overrides/agent-provisioning/route-chain/
                        transport/forum/registry hash 全 UNCHANGED）
RUNTIME_HEALTH        = PASS（新 pid 5131；/healthz ok；restart 恰 1 次）
AUTH                  = 1.7.0 / digest 577a1879…（零触碰）
```

## 3. A2A canary 机械取证（agt_efficiency-agent → agt_blog-agent）

```text
audit（authsvc control/agent-session-messaging-audit.jsonl 全量）：
  denial  invalid_arguments（第一次调用缺 timeoutSeconds——参数姿势，非产品缺陷）
  intent  source=agt_efficiency-agent target=agt_blog-agent requestId=aa2ecf7d-…
          correlationHash=ae5cbcbe… timeoutMode=receipt_only
  outcome result="accepted" reconciliationHandle=turn:8bf5d795…:a2:g1:s1 durationMs=1096

stderr 同窗口：agent agt_blog-agent ready pid=22419 (923ms)；
  session main RESUMED (478 events)=canonical main 复用；route-chain luna SUCCESS；
  deliver accepted requestId aa2ecf7d-… in 1094ms（与 audit intent 一致）。

SOURCE_AGENT                  = agt_efficiency-agent（audit）
TARGET_AGENT                  = agt_blog-agent（audit）
TARGET_SESSION                = canonical main（resumed 非 created）
NEW_RUN/TURN & DELIVERY_COUNT = 1（唯一 intent/outcome 对；deliver accepted 恰一次）
TARGET_OWN_PRINCIPAL/CRED     = PASS（target 以自身 luna route/credential spawn）
SOURCE_CREDENTIAL_PROPAGATED  = NO（messageOrigin 三字段冻结 allowlist，无 credential 载体）
AUTO_PING_PONG                = NO（无第二条 send；audit 无回发行）
EXACTLY_ONCE                  = PASS（一次 send→一次 deliver→一个 handle；无重试）
A2A_SESSION_MESSAGING_E2E     = PASS
诚实记录：效率管家飞书回复"failed: outcome_unknown"为模型转述失实——audit 权威
为 accepted；§23 "不得只相信自然语言回复" 的实证案例。
（stderr 中 plugin_missing/sourceCommit 报错为 ~22h 前 r3 世代历史，与本次无关。）
```

## 4. 完成条件（goal §25）逐项

```text
AGENT_SESSION_SEND_SOURCE            = REUSED（main 字节，组合文件不回写 main）
ASM_STANDALONE_DEPLOYMENT_AUTHORITY  = ACCEPTED（Owner exact-head 575fa92；main 451d98e）
ASM_NO_FLEET_COUPLING_GATE           = PASS（全 NO；Fleet 面 hash 零变化）
CURRENT_SEND_GRANT_GOVERNANCE        = CLOSED（auth PR #50 tuple 精确覆盖；零 DB 写）
AGENT_SESSION_SEND_RUNTIME_VISIBLE   = YES
A2A_SESSION_MESSAGING_E2E            = PASS
EXACTLY_ONCE / CANONICAL_MAIN / OWN_IDENTITY / NO_PROPAGATION = PASS
WORKFLOW_EXECUTE_REGRESSION          = PASS
SCHEDULER_REGRESSION                 = PASS
MODEL_FLEET_PRODUCTION_MUTATION      = NONE
RUNTIME_HEALTH                       = PASS
```

## 5. 终态

```text
AGENT_SESSION_SEND_PRODUCTION_READY = YES
LANE_B_AGENT_SESSION_SEND           = PRODUCTION_READY
DAILY_WORKFLOW_AUTONOMY_READY       = YES
GOAL_STATUS                         = COMPLETE
```

制品与证据索引：deployment-artifacts/asm-standalone-candidate-v1/（SEALED 25 文件；
SIM_RESULTS 12/12）；PR #165（census+authority+review）；deployment receipts ×3
（224401Z 之前旧世代、225945Z ROLLED_BACK、230257Z DEPLOY_OK）。
