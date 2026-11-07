# BRIEF-643-ACCEPT — #643 接受事务（Owner 已授权, docs-only）

授权: Owner 五件裁定③(rulings[id=owner-20261107-five-decisions]): #643 aging提案正式接受, 限定"仅限提案语义; WEC/Svc配套权威正式接受前不得实施新reason或用于生产"。
工作面: 本worktree(detach @ PR#643 head)。docs-only; 零产品源码; 零生产写入; **不合并**(监管执行)。
停止条件: 失败即停写STOPPED-643-ACCEPT.md。

## 任务(参照#648接受事务模式)
1. frontmatter: proposed→accepted; accepted_by=mayf3; accepted_date/accepted_at; acceptance_authority=Owner裁定 rulings[id=owner-20261107-five-decisions] items[2](selector+canonical坐标); accepted_reviewed_head=当前PR head; **接受限定条款逐字写入**: "WEC/Svc配套权威正式接受前不得实施新reason或用于生产"。
2. PR转录评论坐标(6707205612)入绑定。
3. commit→push(PR#643自动更新)→停等监管合并。
完成定义: 接受commit SHA+frontmatter原文+push回执。
