# Owner 常设授权总裁定 — proposed → accepted 接受事务

```text
ACCEPTANCE_ACTOR = mayf3
ACCEPTANCE_AUTHORITY = Owner ruling owner-20261107-standing-delegation，八节裁定本尊
ACCEPTANCE_EXECUTOR = /root，转换/事务执行者，不是接受权威
ACCEPTED_AT_UTC = 2026-11-07T15:08:54.867556+00:00
REVIEWED_PROPOSED_HEAD = 3f5fb8088e7822ec5bc26d641a07847b34553a50
INDEPENDENT_REVIEWER = /root/delegation_semantic_review
INDEPENDENT_REVIEW_RESULT = PASS
SEMANTIC_DELTA_AFTER_REVIEW = NONE
FROZEN_BLOCKER_UNION = []
STATUS_TRANSITION = proposed -> accepted
SUPERSEDES = []
AUTHORITY_ACTIVE_IN_MAIN_NOW = NO_PENDING_FINAL_HEAD_REVIEW_AND_MERGE
IMPLEMENTATION_ALLOWED_BY_THIS_FRAMEWORK = NO
CAPTAIN_IDENTITY_CREATED_NOW = NO
CAPTAIN_APPOINTED_NOW = NO
CONTROL_EFFECTIVE_VERIFIED_NOW = NO
SINGLE_WINDOW_ISSUED_NOW = NONE
PRODUCTION_OPERATION_ALLOWED_NOW = NO
MERGE_ALLOWED_THIS_TASK = NO
REPEATED_OWNER_APPROVAL_COUNT = 0
```

## 接受权与精确绑定

Owner 本尊八节裁定为本次接受权威；[用户Brief](../../../BRIEF-DELEGATION-FORMAL.md)
明确要求 `accepted_by=mayf3` 的首次正式化/接受事务。不是把 Owner 指令降为普通产品
调查输入，也不从候选 Captain 或作者身份循环取得新接受权。
原件 `/Users/yanfenma/Documents/Codex/2026-10-18/zcode-assist/tools/b7ctl/DISPATCH-REGISTRY.json`，selector `$.rulings[id=owner-20261107-standing-delegation]`；
canonical SHA256 `01cc059c2bf0e0493588f00032ca06eb73e3a0a13cb33f4078996fdccb79dad3`。事务写入前直接重读唯一子记录，与[快照](owner-ruling.json)
逐值一致；整个台账可前移，选中裁定未漂移。来源/provenance保留原观察坐标。

[独立审查原文](independent-review.md) SHA256 `32286d908375b9da83913ac70bdd3b26dd45f68dcf1a3e64e9a81edc3700bad1`，绑定上述
exact proposed HEAD；作者 `/root` 与 reviewer `/root/delegation_semantic_review` 不同。
review PASS 不自己完成接受，本事务记录 Owner 已给的接受决定；不声称 Owner 亲阅了转换后
exact HEAD。原八项所有字符与 §1–§13 正文在接受前后保持相等，只有 lifecycle banner、
frontmatter接受元数据与索引本条更新。SRA、DCP及所有既有权威/索引条目原字节保留。

`FINAL_ACCEPTED_HEAD` 为原子包含本收据、上述lifecycle、独审和索引的实际 Git commit对象；
不把未来SHA写成已知。完成 commit 后由 native `git rev-parse HEAD` 读回，交非作者做
final-HEAD delta review；该原文与最终完整SHA绑定在根 `RECEIPT-DELEGATION-FORMAL.md`
及新PR持久回执。收据本身不声称未来 commit/push/PR 成功。

## §8实际控制绑定与后续责任

[控制绑定清单](control-bindings.md) 是本事务的一部分，逐项列出 Auth 唯一Principal、
正式任命/撤销查询、Spec accepted/互斥/作者不自接受、window authority JSON→SRA G01。
Auth运行查询/任命/控制负向试验未执行，现有helper未消费完整G01链，不能登记EFFECTIVE。
原Auth/任命/入口控制所有者依裁定在原机制补齐和独立验证，缺证仅停依赖危险动作。
本次没有新增平台/调度/第二账本，也未修改产品源码。SRA标准发布子机制保持完整独立。

未来实际交付必须分列源码合并、实际加载、功能启用、业务见证；本任务到未合PR为止。
若必需检查/提交/push/PR任一步失败，立即STOP并保留实际rc和已产生效果，不重试。
