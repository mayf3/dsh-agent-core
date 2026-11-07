# BRIEF-CAPTAIN-CREATE — Captain 专用 Principal 创建链（Owner §4 已批准, 仅身份记录）

授权: Owner 常设授权§4(rulings[id=owner-20261107-standing-delegation]): "正式批准通过Auth现有合法管理路径创建专用Principal release-captain-agent-core-20261107, 采用Auth权威验证的canonical身份方案。仅创建并绑定所需身份, 不随创建附赠新Client/Secret/Grant/特权helper/生产写权限"。
工作面: 本worktree(登记文档)+auth-service合法接口。零生产写入(runtime/8788不碰)。**若创建入口无法隔离Client/Secret/Grant等效果→停止并报告最小权限差量**(Owner原话)。
停止条件: 失败即停写STOPPED-CAPTAIN-CREATE.md。

## 任务
1. **Auth创建路径核验(只读先行)**: 用auth-service skill查询现有principal类型/canonical agent命名规则/创建接口的合法入口; 明确"仅身份记录"创建在现有接口下如何隔离(不附赠Client/凭据/Grant)。
2. **创建执行**: 若入口可用且可隔离→按canonical方案创建 release-captain-agent-core-20261107(身份记录; 状态=created_not_appointed); 若无隔离能力或无权限→STOP报告最小权限差量(交Owner/Auth管理员)。
3. **五条件证据包**: 创建回执+身份归属(principal/session绑定方案)+职责分离矩阵+能力资格清单+任命/撤销/审计路径登记文档草案(validUntil=2026-12-07T16:00:00Z; NOMINATED_NOT_APPOINTED状态)+§6.5负向验证清单(未任命/过期/越界/缺门/错SHA/错执行者拒绝)。
4. 交付: commit新分支docs/captain-principal-creation→push→PR(base main)不合并→RECEIPT-CAPTAIN-CREATE.md(创建回执或差量报告+五条件状态表)。
红线: 创建仅身份记录; 不创建Client/Secret/Grant/生产写权限; 不任命; 失败即停。
