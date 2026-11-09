# BRIEF-DELEGATION-FORMAL — 常设授权总裁定正式化+控制绑定（Owner 裁定 §8 制度适配）

授权: Owner 常设授权总裁定(rulings[id=owner-20261107-standing-delegation])§8: "原治理责任链负责将本裁定通过有权维护者的正式记录, 与实际Auth/Spec/发布入口的授权控制绑定; 不得仅凭本地台账声明生效"。
工作面: 本worktree(docs-only, detach @ main 24974c72)。零产品源码, 零生产写入。参照#648/#643接受事务模式(你=事务执行者非接受权威)。
停止条件: 失败即停写STOPPED-DELEGATION-FORMAL.md。

## 任务
1. **正式 governing Spec**: docs/specs/AGENT_CORE_STANDING_OPERATIONAL_DELEGATION_V1.md——SPEC_FORMAT_V0合规; 八节裁定语义逐字保真转换(裁决原文在DISPATCH-REGISTRY rulings[id=owner-20261107-standing-delegation], 快照+canonical SHA入provenance); proposed→accepted接受事务(accepted_by=mayf3, 接受权威=Owner裁定本尊, reviewed HEAD绑定); 新增文档不 supersede 任何现有权威(与SRA V1互补: SRA=标准发布子机制, 本件=总委托框架)。
2. **权威索引更新**: docs/specs/README.md 登记+发现入口。
3. **控制绑定清单**(§8核心): 逐项列出本裁定如何被实际控制执行/验证——(a)Auth: Captain principal唯一性+任命登记查询 (b)Spec: docs/specs accepted状态与互斥权威(§3C作者不得自接受) (c)发布入口: window executor authority JSON须绑定SRA checklist G01(合法委托与范围)——每项给"控制点/验证方式/负向拒绝场景"。
4. 交付: commit(转换+接受+索引)→push新分支docs/standing-delegation-v1→PR(base main)不合并→RECEIPT(含控制绑定清单)。
完成定义: 全链rc0原文+PR回执。失败即停照旧。

## R2 明确续接（2026-11-07）

本轮用户明确授权：修复终审日期比较（frontmatter 经
`json.loads(json.dumps(fm, default=str))` 规范化后再比，不改 Spec 正文），
重跑终审并保留 PASS 原文，push 本地 `cd98bf1a` 及新证据至原 PR #660，
完成注明 R1 脚本问题和 R2 修复的收据。零产品源码、零生产写入，失败即停。
该指令解除 R1 已知脚本问题的本次续接限制；历史 STOP/FAIL/UNKNOWN 不改写。

```text
schema_version = 2
SPEC_GOVERNANCE_MODE = PREFLIGHT
REVIEW_TARGET_HEAD = cd98bf1ab73c5abd3b598aa4d71c217127a7a2d0
BASE_HEAD = 24974c720d634b965943e08bfd0862657b9be0e1
CURRENT_BASE_HEAD = 9df5bd2fdea17f04bcd1762cd6800c350efcf9c3
GOAL_OR_TARGET = close existing PR #660 docs delivery with corrected independent audit and remote readback
CURRENT_GAP = R1 final audit timestamp representation mismatch; receipt commit not pushed
AUTHORITY_ACTION = REUSE
PRIMARY_AUTHORITY = accepted local governance and AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V3
ROUTE_STAGE = AUTHORITY_AUTHORING
AUTHORITY_ACCEPTED_IN_BASE = YES
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = DURABLE
MUTATION_AUTHORIZATION = VALID; current user R2 task, existing branch single writer /root
ISOLATED_WRITE_SURFACE = YES
SPEC_GAP_DEPENDENCY = NONE
PRODUCT_IMPLEMENTATION_ALLOWED = NO
PRODUCTION_OPERATION_ALLOWED = NO
MERGE_ALLOWED = NO
EVIDENCE_NEEDED = independent corrected audit raw stdout/stderr/child rc; final-head delta review; push and PR/remote exact-head readback
DONE_WHEN = corrected audit PASS plus receipt/evidence pushed and PR #660 exact-head readback, open and unmerged
EXPANSION_TRIGGER = required check failure, relevant authority conflict, or scope beyond docs/evidence; STOP dependent work
NEXT_ACTION = CONTINUE
```

固定在干净的隔离审计 worktree 复核原 `cd98bf1a`，保留原来的 HEAD、clean、
两文件 receipt-only 差量和 20 条历史链断言。R2 新证据在现有工作分支另作差量审查。
日期的实际值和期望值均采用相同规范化，避免 `datetime.__str__` 的空格与 ISO `T`
的表示差异。每个必需子检查单独捕获 stdout/stderr/rc，任何失败立即停止；
不得再用后续 whitespace 检查覆盖 Python 子检查退出码。
