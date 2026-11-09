# STOPPED — W6-S05 / Mandate V2 production boundary

2026-11-06；文档parent `703fcac8b1feb5d80ee91ab71a78a4686f149240`。

`STATUS=STOPPED_UNKNOWN / OPERATION_ALLOWED=NO / STAGE_00=NOT_EXECUTED / AUTHORITY_JSON=NOT_CREATED`。调查与文档交付已获用户授权，可继续；本记录停止依赖的生产动作，未尝试失败生产命令。

| Blocker / 来源 | 可达反例 / 影响 | 最小解除 / owner |
|---|---|---|
| REQUIRED_GATE_FAILURE / 跨切换pause门 | A无pause reader，bootstrap启动Scheduler/入站/poller；要求verify期间继续暂停则不能证明。bootstrap readiness=NO | Owner明确stage10为自然准入释放点，且全部旧tool隔离/其他门通过；若要求持续暂停则保持STOP-UNKNOWN，不能以批准替代技术能力 |
| REQUIRED_GATE_FAILURE / stamp兼容门 | legacy writer交给A无.git JSON reader必拒绝；相关consumer和依赖bootstrap readiness=NO | build/consumer owner实证本路径不load-bearing，或后续独立修复并重冻结；本轮不改/手填stamp |
| REQUIRED_GATE_FAILURE / Owner②可恢复证明 | helper未预存除R2两树外全部installer metadata/link前态；部分§5b写后flag仍false；bootout/install/recovery readiness=NO | writer/verifier准备可审查的逐路径前后态/恢复证明，bootout前封印；没有则不执行 |
| REQUIRED_GATE_FAILURE / 工具完整组合 | A有新阶段但旧pin，99b有新pin但缺A新阶段；最终既有bundle坐标未证。stage00 readiness=NO | 工具owner给出已受审完整artifact/hash与S04输入绑定，不重做已过S01单项修订 |
| REQUIRED_GATE_FAILURE / 当次Mandate | writer/UTC时窗/verifier未签发，真实prestate/old tools隔离/旧reader v3兼容/SOP精确版仍UNKNOWN。operation readiness=NO | Owner签最终commit/hash及精确scope；当次所有fresh gates通过；批准前零stage00 |

失败/超时不可重试、切身份、清锁、重放/重新投递、批量结算或恢复旧业务快照。保留UNKNOWN。详见[调查](INVESTIGATION-W6-S05.md)和[V2](EXECUTION-MANDATE-W6-V2.md)。当前install/bootout/bootstrap均NOT_STARTED；没有生产mutex/预镜像/receipt被本轮创建。
