---
spec_id: AGENT_CORE_B7_E6_FIRST_MAINTENANCE_HANDOFF_AMENDMENT_V1
status: accepted
implementation_authority: source_only
production_apply_authority: none
accepted_proposal_sha256: 5d3f011575bc704bf79965af2420bd8112ebbf68a7f9f94a262c7f3ac24255f4
accepted_by: Owner direct reply
acceptance_receipt: https://github.com/mayf3/agent-control/issues/424#issuecomment-6134444585
amends: AGENT_CORE_AUTHSVC_SHARED_CODEX_ACTIVATION_RECONCILIATION_V2_AMENDMENT_B7_E6_ABORT_ONLY_RECOVERY_TRANSITION_V1
---

# e6 首次 DS 维护交接入口：限定 SOURCE 修订已接受

目标仍是先合法收口 e6、由原 outer 自身释放全局 lane，让 HR 单文件发布先完成，再接续永久 B7。本修订只补第一次 DS 维护的交接入口；它不是交接回执或生产准入。

## 新证据及待明确边界

- 原 `maintenance_entry.py:105–106` 把 GUI/authsvc/native writer 交接定义为外部准入事实；该入口没有产生这份事实。
- 原 controller 的 `stop_action:1201–1205` 只查已登记 `task_issue`，没有 stop-by-session 路由。原 GUI session 不在登记任务中；#980 的 SOURCE stop 不能替代其交接。
- 冻结原 outer 的 `original_lease:183–193` 与 `guard:195–198` 只验证已经继承的 FD9。`resume:214–226` 才取得已有 holder 的同 inode 非阻塞租约；不能独立调用 guard 取得交接，也不能绕原 DS 直接运行 resume。
- 原 whole-policy 已从安装源的实际完整字节计算为 `171d492631da9121cfe341de340ca74bad9f0386158b5e68967615729696712e`，与原回执一致。原 Root outer 实际 SHA256 `d323f7022f164b00fc744f37f0144bfadbbe43955e57ad3efb342e8d2f4c7f45`，与冻结引用一致。
- 现有 sudo 管理员通道已经完成全批实际读回；无需 Owner 再导出清单。读回与暂停观察仍不能代替 writer 交接或租约。

现有源码 PASS 和 Owner 有限收口批准全部保留。目前缺的是能在首次维护前合法产生并保持交接的入口；不能把外部前提写成 PASS，也不能借普通 sudo 人工打开 FD9。

## 已接受的唯一新增 SOURCE 范围

允许在原 §8.3 构成式 DS 首次维护入口中，补齐以下交接机制，保留原 controller、原 DS、原 outer，禁止新 daemon、任务、Goal 或生产调度器：

1. 仅绑定原 OP `b7-packet-r27-65e5606cf5c352f2e-e6`、TX `tx-5974ef29916145a68133111f57ce3f9a`、nonce `8eb60d9c0f78aa11ce32bb2304b3e2e8`、cohort `747bcfa8cf4dec5ade1c9289a7e602b4fa228bd1e78c74b2e2f4bec4b42ccd5f` 及已批准 pair；其他 subject、状态、路径或消费记录全部拒绝。
2. 使用原 controller/GUI 的实际执行观察与原 DS/native guard 形成交接，不能只接受调用方声明的 release 标志。不得借 SOURCE 任务终止、GUI paused、PID 消失或 no-open-handle 单独推定 writer 交接。
3. 明确准许该已审首次维护入口取得并保持**已有 holder**的原同 inode/OFD 非阻塞租约。保留 nofollow、Root custody、单链接、完整 binding、原 TX/holder/receipt/policy pin、另一个 OFD 被拒绝的继承证明以及每个写边界的漂移检查。不能创建、清除、替换 holder，不能强制接管活跃/UNKNOWN writer，不能使用 LOCK_UN；退出只关闭自身 OFD 引用。
4. 租约覆盖首次维护发布、原 plist 启动、真实加载与健康核验，及失败时 admission-pinned pair 的准确回退。丢失租约/结果时保留 UNKNOWN 和现有现场，不换操作号或自动重放。
5. 真实 Owner FD3 原要求保留；源码不能制造或代理终端。维护成功后的同 e6 恢复仍只能由原 DS 的 `b7-owner-recovery-abort-v2` 驱动原 `b7-resume`，按 recover-six-target → 本人准确 TX ABORT → verify-terminal 顺序执行；全局锁只能由原 outer 终态机制释放。
6. 禁止追加 Shared Runtime 停服、retained TX 文件处置、永久 B7 发布窗口、marker/权限修改、apply/re-apply 或新 B7 操作。

## 复核与执行边界

- Root 在原 ac-810 直接完成这份新增入口差量、RED/GREEN 定向验证和准确冻结。原 server `9b909e1653eb872f1c0fd468c4ff5e8193c71f823bfd14a0939ffcb348e10d9c` / client `4a55662a6e0a5308a24b191aa44c445de9a5d12fd81595bc4b6971cedab32e3f` 不因本修订重建或重审。
- 仅允许对**新增交接/维护入口差量**做一次独立复核；已有 #980 SOURCE PASS、15/15 和既有冻结引用不重复。若沿原 reviewer 接续，该授权仅解除本次新增差量的接续限制，不允许重发旧审查或开展全审。
- Owner 已接受原5363B提案并只授予上述 SOURCE 与有限差量复核；本文件的接受元数据记录该决定，不扩大合同正文；实际生产仍受 Owner 已批准有限包、真实单 writer、全批 fresh drift、当前 pair 前像、真实 FD3 和本人 ABORT 约束。
- 原有限批准的 DS IPC 600s、原 runtime 300s 与 rollback-first 不变。本修订不产生新的生产许可，也不把首次维护或 SOURCE 通过称为 B7/HR 上线。

## 验收

准入失败须零生产写；活跃 writer、错误 inode/nonce/seal/subject、已有消费记录、漂移、缺失真实 Owner FD3、凭据交集、额外路径全部拒绝。有限复核通过后，Root给出可实际运行且含原前像回退的维护工作块；只有真实 e6 terminal 和 outer release 回执存在后 HR 才发布。

原批准：https://github.com/mayf3/agent-control/issues/424#issuecomment-6132525894
已验 SOURCE：https://github.com/mayf3/agent-control/issues/424#issuecomment-6127914238
管理员完整读回：https://github.com/mayf3/agent-control/issues/424#issuecomment-6133303350

