# BRIEF-CAPTAIN-AUTH-CREATE — Captain Principal Auth 正式创建（Owner 方案1, identity-only）

授权: Owner 统一处理①(rulings[id=owner-20261108-three-unified] items[0]): "由现有具备合法管理资格的Auth管理员执行identity-only创建...使用现有正式管理接口, 不直接写DB不绕认证"。常设授权§4已批准创建目的。
工作面: 本worktree(登记文档)+auth-service正式管理接口。零生产写入(runtime/8788不碰)。
停止条件: 失败即停写STOPPED-CAPTAIN-AUTH-CREATE.md; **若现有管理员确实无法完成→如实证明具体缺失权限/机制(Owner原话), 不猜不冒充**; 仅新增信任边界时才报最小差量HUMAN_GATE。

## 任务
1. **Auth管理接口核验(只读先行)**: 用auth-service skill确认——(a)现有Auth管理员身份/接口(哪个principal有principal registry写权限) (b)identity-only创建在现有接口下如何实现(是否存在"仅创建principal记录不附赠Client/Secret/Grant"的隔离能力) (c)Principal类型/canonical标识/Agent-Session关联/生命周期要求的Auth权威定义。
2. **创建执行**: 若①核验通过且隔离能力确认→通过正式管理接口执行identity-only创建 `release-captain-agent-core-20261107`(状态=created_not_appointed; 不附赠Client/Secret/Grant)→创建回执(principal UUID/创建时间/创建者身份)。
3. **若无法完成**: 如实报告——具体缺失的权限名/接口/机制坐标(Owner可审计); 不猜不冒充。
4. **登记**: 创建回执(或差量报告)写入CAPTAIN-AUTH-CREATE-RECEIPT.md; commit到新分支docs/captain-auth-create→push→PR(base main)不合并。
红线: identity-only(不附赠Client/Secret/Grant/生产写权限); 不直接写DB不绕认证; 失败即停。
