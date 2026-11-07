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
