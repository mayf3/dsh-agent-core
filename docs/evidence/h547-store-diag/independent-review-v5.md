# v5 独立真实副本 QA 复核

`SPEC_GOVERNANCE_MODE=REVIEW; REVIEW_KIND=AFFECTED_CONTRACT; REVIEW_SCOPE=DELTA; ASSURANCE_LEVEL=DURABLE`。

Reviewer `/root/capture_review` 独立于采集/runner 作者；记录者 root 将其返回结论落盘。Reviewer 只读本地文件、Git 对象和副本，无生产访问、constructor 重跑或文件写入。此记录认证执行证据；最终报告/committed Head 的 delta recheck 单独附后。

`AUTHORITY_REVIEW=PASS; MANDATE_SCOPE_REVIEW=PASS; EVIDENCE_REVIEWABILITY=PASS; CONTRACT_REVIEW=PASS; FROZEN_BLOCKER_UNION=[]; BLOCKERS=0; SPEC_GAPS=0`。

## 输入和绑定

- 固定 reader 全部 3236 文件字节/hash 与 manifest 及 `95a8e1cb512fc99dc018209d837250dd51b4d08f` 的 git archive 相同；archive SHA `da0a2cc80cceb48343751cf4eb8e2031fbdefa7ba06e3e7913204a3e8f7d8995`。
- 最终及 attempt1/attempt2 stdout 长度/hash、保留 runner hash、stderr 与各自 receipt 匹配。最终 runner SHA `bdb78f2e039f1220323fad0d89ef4fcb810a8c16fd1c5a5945f89cccd0ae99d5`，stdout SHA `c5380e46323ecd4eff82fd60c8672a4d9a8debc551c0e63778a5bdec0f9879f5`，rc=0；sandbox SHA 也匹配。
- 36 条 authsvc capture 命令仅 ls/stat/cat，全 rc=0；六个副本长度/hash/0600 权限、每文件两读三 stat、跨两遍向量均匹配，最终 hash 未变。支持两遍稳定观察，不认证 atomic snapshot/loaded bytes。
- 三文件 SHA：active `ce231b88d6a5cca631ad074523aa493e328846cdc66587075733d35d22a0a243`，registry `28ba4a74693d23ad0fc3338d77d2f5c72a35c1ae43970dfb2b4f854d6c727cc1`，faults `7d3406c02b601c34f3a033e3f003b2e62b5adfe701ed2ee5e6e4affe1b5a4591`。

## 实测结果

原始文件固定 reader 解码成功；真实 constructor 仅指向 scratch-3，默认 fresh epoch，5322 records，`businessAdmissionStatus={ready:true,reason:null}`。stdout `status=PASS; phase=complete`，141/141 checks。

当前对象为四条 legacy 加一条普通 active blocker，共五条。Reviewer 独立按 byte offset/length 切片，五个 raw-record hash/handle 均相符。五条可识别，admissionBlockerForAgent、prompt gate 和 processRegistry 拒绝均保存实际首 blocker；本次恰为各目标 handle，没有将 API 改写成一般情况下必然逐条返回。

四个有 callerCorrelation 的对象原入口解析回原 handle，duplicate mint 抛 RECONCILIATION_CORRELATION_CONFLICT；registry 全部拒绝，processFactory/workspace provision/switch effect 计数均 0。no-replay 操作前后磁盘 hash、record/correlation 计数及目标 record hash 相等。dev-engineer callerCorrelation=null，保留 CORRELATION_COVERAGE_GAP；只认证 admission quarantine，未发明历史 correlation。

四条 legacy 的 raw/loaded predicate 和 legacyFormat 一致，每条七个单字段邻近反例由完整 pure reader 返回 TypeError，共 28 个预期拒绝。未将负向断言成功当作执行失败。

## epoch 和 native scratch 差异

输入 256 epochs，其中 79 个被当前 record 引用；默认 fresh epoch `af638042-3d67-4e17-9322-7503595d571c`。未改代码 `authority-capacity.js:47-57` 的 compactRuntimeEpochs 保留 fresh 和所有被引用 epoch，再填历史至 256，仅淘汰无记录引用的 `c3896f43-0e73-48a0-980e-161376797a14`。无手工 epoch 编辑、输入裁剪或旧 epoch override；不可笼统声称 scratch epoch 字节完全不变。

Reviewer 独立 raw→最终 scratch 比较：顶层只变 runtimeEpoch/runtimeEpochs 和 records；7 条 record 变化涉及 5 条 bytes 重算、CTO updatedAt、stock updatedAt 和一条 bounded ownership_check 审计。来源是容量重算、startup recovery 和 process-registry.js:58-60 restoreRecoveryFences。全部 5322 条 initialOutcome/outcome/lateOutcome、terminationEvidence、settlementResult、exitObservedAt、fenceState 保持原值。

三个 marked legacy 的 marker 对应声明 agent/time/handle 匹配；registry 保留其他历史重复声明，不能称全局一对一。HR 目标和 stock 无 marker/scope。faults 精确覆盖五个 agent:generation，但固定 main store 不消费该 sidecar；不得作为终止、结算或解除 admission 的依据。

## 已解释 harness 错误和边界

attempt1/attempt2 原始 STOPPED/rc=1/runner 均保留。attempt1 是 constructor 前本地 scratch 权限；attempt2 返回 durable_store_unavailable，最小 probe 将其归因于 Node Permission Model 禁用 fsync，精确错误保存在 harness-correction-v5.json。未发现无法解释的产品谓词失败，没有生产写入被拒或一致性失败。

最终 macOS sandbox 仅允许 scratch-3 写，拒绝 network/process-fork；probe 中 scratch file/directory fsync 可用、本地越界写 EPERM。reader 和采集原件未改，未重新采生产。

`UNEXPLAINED_PREDICATE_FAILURES=0; PRODUCTION_CUTOVER=NOT_EXECUTED; BUSINESS_RECOVERED=UNKNOWN; SAFE_TO_PUBLISH=NO; MERGE_READY=NO`。

本地真实副本 QA 完成，dev correlation 缺项明确。它不认证生产安装制品/loaded bytes、在途 worker/tools 终止或隔离、回滚可用性或业务恢复；发布缺项必须保留。


## 执行交付 Head 的独立 delta recheck

Reviewer `/root/capture_review` 对 `75f1e80e41bcd7600ca38d11795d702d8a113181` 复核：`FINAL_HEAD_RECHECK=PASS; REVIEW_SCOPE=DELTA; FROZEN_BLOCKER_UNION=[]; BLOCKERS=0; FOLLOW_UPS=1`。31 个路径仅文档/证据，无 private/产品源码；packaging manifest 的30个artifact hash/bytes全部匹配；四份旧文完整字节保留。报告的141 checks、5 targets、dev correlation缺项、native scratch compaction、两个harness解释与生产发布缺项均准确。

唯一非阻断follow-up已在同一收口delta修正：把“实测数量变化”改为“当前文件枚举五条，旧文四槽未认证数量/身份，不推断生产数量随时间变化”。Reviewer额外只读v2 raw也找到相同五handles；不影响已通过QA，不重跑采集/constructor。后续收口commit仅此措辞、Brief交付坐标、本文与packaging hash刷新；最终Head另做该有限delta复核，结果持久化在PR #670 body。


## 外部 base/PR 变化的独立有界复核

Reviewer `/root/capture_review` 核实 f8b7a0e4 双父、merge-base=f6b98823，97189e12不在该merge祖先；main树仍v4 STOPPED且无qa-v5.stdout.json。固定baseline至新main的相关authority、registry/prompt gate和reconciliation无差异，既有QA仍适用。旧PR已结束，用同branch的后续draft #672闭合未集成v5交付合法，不是重复实现；旧PR元数据应纠正并链接successor。`FROZEN_BLOCKER_UNION=[]; SAFE_TO_PUBLISH=NO; MERGE_READY=NO`；外部merge actor UNKNOWN，本次操作者merge调用0。
