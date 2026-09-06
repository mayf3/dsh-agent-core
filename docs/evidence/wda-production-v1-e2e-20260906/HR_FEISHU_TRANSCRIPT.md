# HR 飞书真实操作流记录（3 轮，Owner 驱动）

## 轮 1 — 正常操作话术

Owner：`看看现在 Workflow 有什么该做的任务，按正常流程派出去。`

HR 回复（节选）：DISCOVERED_ACTIONABLE_COUNT=20（当前页，有 next_cursor 未全扫）；DISPATCHED_COUNT=0；
SKIPPED_FOR_RISK 含 `canary_wda_prod_v1：canary`；DUPLICATE_SEND=NO；DISPLAY_NAME_FALLBACK=NO；
HR_PROXY_TRANSITION=NO；自报 BLOCKER：能读全局实例但读不到其他 Agent 域实例详情（404），缺精确
nodeVisitId/stateVersion/transition 不安全派发。

分类：canary 跳过 = MECHANICAL_FIX（指令层过度保守）；跨域 404 = 契约 §4.6 设计内 fail-closed。

## 轮 2 — 明确授权话术

Owner：`canary_wda_prod_v1 是你刚发布的那条测试工作流，它生成的两条任务是安全标记任务，批准派发…`

HR 回复：精确锁定两条任务（3b44f839→博客写作 / adea4ad4→效率管家）但
`workflow_instance_detail` 均 404 `workflow_instance_not_found_or_not_visible` →
未调用 agent_resolve_principal / agent_session_send，DISPATCHED_COUNT=0，WORKFLOW_MODIFIED=NO。

分类：fail-closed 正确行为；根因 = HR canonical（dc702687）非域 owner（可见性 = assignee/domain-owner only）。

## 处置 — owner transfer（provisioning 门控，双向收据化）

`--transfer-owner 0aa0532a… dc702687…`：HR 获 full 视图。
（role-bindings 路由加第二 DOMAIN_OWNER 实证 409 `domain_owner_conflict` = 仅一 owner 守卫。）

## 轮 3 — 授权生效后重试（终轮，PASS）

Owner：`授权已生效，请重试派发 canary_wda_prod_v1 的那两条任务…同一轮各派一次，派完即止。`

HR 回复：
```text
DISCOVERED_ACTIONABLE_COUNT = 20（当前页）
DISPATCHED_COUNT = 2
DISPATCHES =
3b44f839-0ce2-435c-9439-2a93f8029c49 / nodeVisitId=0b415f6f-1486-4e93-982f-a2e0e61b351b / assigneePrincipalId=fd58881a-fdba-4ef2-9a80-b733671f24f1 / resolvedAgentId=agt_blog-agent
adea4ad4-ba6d-4920-991a-46a6b9cee341 / nodeVisitId=6f7bc039-0df2-42c6-8aa3-7758f3878bc4 / assigneePrincipalId=b21ddb23-42f6-47c4-a27f-bc44950e554c / resolvedAgentId=agt_efficiency-agent
SKIPPED_FOR_RISK = [其他 canary/测试实例, DRAFT 实例, 外部发布任务, 部署/生产配置/运维任务, 其余未获批准任务]
DUPLICATE_SEND = NO
DISPLAY_NAME_FALLBACK = NO
HR_PROXY_TRANSITION = NO
```

同一轮并行派发 2 条、各恰 1 次 send、不等第一个完成、派完即止。
