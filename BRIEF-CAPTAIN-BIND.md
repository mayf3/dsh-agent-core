# BRIEF-CAPTAIN-BIND — Captain A 专用 principal 身份绑定与任命登记准备（Owner 裁定①A）

授权: Owner 五件裁定①(rulings[id=owner-20261107-five-decisions])+条件任命裁定(rulings[id=owner-20261107-sra-formalization]第二条五条件)。
工作面: 本worktree(docs-only登记文档)+auth-service只读查询。零生产写入。**不任命**(任命登记=mayf3/合法链在证据齐备后执行, 你只准备)。
停止条件: 失败即停写STOPPED-CAPTAIN-BIND.md。

## 任务(五条件逐项落证据)
1. **条件①Principal唯一确认**: 经auth-service查询/核定 `release-captain-agent-core-20261107` 专用principal——存在性/创建需求/类型/边界(用auth-service skill只读查询; 若需创建, 产出创建请求规格交Owner确认, 不自行创建生产身份)。
2. **条件②能力与独立性证明**: 与A/W/V三角色的职责分离矩阵落档(专用principal不参与Mandate实质创作/不持生产writer/不任verifier); 能力要求清单(读权威/核installer闭包回滚证据/判UNKNOWN与STOP/理解执行入口与收据)。
3. **条件③任命/签发/撤销/审计路径**: 登记载体=DISPATCH-REGISTRY rulings+本仓docs/specs绑定; 撤销程序(同链登记); 审计=每签发Mandate绑定+台账。
4. **条件④实际控制验证设计**: 负向测试规格(未任命/过期/越界范围/缺门/错SHA/错执行者的签发请求必须被拒)——写成可执行的验证清单(供后续实际控制适配时逐项跑)。
5. **条件⑤SRA accepted坐标**: 已满足(24974c72, 前轮核验)——引用。
6. **任命登记文档草案**: 全字段(授权者=mayf3依据本裁定/被任命者=专用principal+身份绑定坐标/可签范围=本机既有fleet runtime STANDARD_RECOVERABLE/有效期=2026-12-07T16:00:00Z不自动续期/能力独立性/控制绑定/生命周期)——交Owner确认后由合法链落任命登记。
完成定义: CAPTAIN-BINDING-PACKAGE.md(五条件逐项证据+登记草案+开放问题如实: 如principal需创建则标注"待Owner确认创建")。commit新分支docs/captain-binding→push→PR(base main)不合并。
