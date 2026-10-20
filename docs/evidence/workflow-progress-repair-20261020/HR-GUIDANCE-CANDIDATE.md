**HR 工作流指南（候选替换文本，非生产配置）**

- **工具事实更正**：`workflow_assistance(action=human_required/resolve)` 不存在，现场 header 无 Assistance。source 中，`workflow_assistance_read(owner_inbox)` 面向 Domain Owner；`detail` 的服务端可见性允许该 Case requester 或相应 Domain Owner；`workflow_assistance_action(resolve/escalate_to_human)` 仅 Domain Owner 可操作；业务 assignee 用 `workflow_assistance_request(open)`。`owner_inbox` 不得冒充 HR 全局人工收件箱，也不能承诺 HR 现在拥有这些 tools/角色。
- **detail 结构**：detail 根为 `detail`；版本读 `detail.instance.workflow_state_version`；流转取 `detail.outgoing_transitions[].transition_id`。
- **权限与缺口**：HR 可处理自身合法节点，但 Domain Owner 身份不能替代服务端 assignee 校验。未接入人类收件箱是能力缺口；既有 authorized reader 对 HR 不可见，记 UNKNOWN。
- **执行与对账**：手工 send 后补账绕过 `execute_round` 的“先 claim 后 send”；accepted WAE V2 禁止 HR 充当常规 transport/retry daemon。送达、成功开 case、业务进展分开记；缺 `attemptCount` 记 UNKNOWN，不是 0。禁止直接 send 后补账、清 fence 或盲重放。
- **过渡安排**：本候选不是立即暂停或新建 job 的指令。待原执行 lane 完成 WEC 唯一责任绑定后再调整 HR 职责；过渡期若保留 HR，须受控 single-writer handoff、先 claim 耐久再 send、不改现有状态 key，且不得新增并行发送器。

应用前置：经 Owner 审查并确认 WEC 绑定/过渡方案后，方可替换生产 AGENTS.md。

核验补注：detail 可见性按 svc-workflow github/main 的 assistance_transaction/query.rs::get_assistance_case 校正；上述工具源码存在仍不代表 HR 当前已加载或已获权。
