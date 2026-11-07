# R4 步4 — RTH 限定语义接受准备

用户R4授权步1→2→3→4严格串行，每步commit/push/停顿，不合PR；网络瞬断最多重试一次。
路线 NEW / BRIEF / CONTROLLED / AUTHORITY_AUTHORING，docs-first。当前仍proposed/none。
Parent `9c257d6cba7c419c455be63ae3b0ad496ef16334`；隔离分支 `docs/refusal-terminal-proposal-r3-step1`。
仅文档承接步3的13个路径（PPR原本不存在，完整复制；其余patch精确应用），不整合源码历史。
承接步骤2/3独审过的原字节，main仍bb67；main激活须监管按#655→#657→#658合入。

Owner mayf3四PR裁定③，selector `$.rulings[id=owner-20261107-four-pr-rulings]`，
canonical SHA256 `677bfe608a67d67f8f9092d817fff0e4f4d040f1bc6e0a0184a69315bc54d7b7`；
常设原§3B，selector `$.rulings[id=owner-20261107-standing-delegation]`，canonical SHA256
`01cc059c2bf0e0493588f00032ca06eb73e3a0a13cb33f4078996fdccb79dad3`；原件与accepted
正式载体/固定核准来源同step2记录。worker只执行受托事务，Owner为接受权威。

本候选只协调governed_by/primary-parent/future successor指向WEC4/PPR实际候选事务，
Svc既有约束引用改绑已核准V3@8da8dbcb，历史§3.2/全部旧OBS和六Contracts原字节保全。
Spec SHA256 `27e2b0b539abcb18de4676e1a1212948c110b0154e66f07750397f30d60151d8`。后续限定接受须绑定真实已审HEAD，再写accepted_by mayf3。
`implementation_authority:none`、`production_apply_authority:none`、`supersedes:[]`保持，
不新增Core/Svc协议实施许可，不重新退休旧前驱，不关闭aging/refusal future整权及Svc配套门。

独审/接受commit/final review/push在本准备时尚未执行，不预报PASS。产品/运行/业务测试NOT_RUN，
生产写0。本轮曾撤销的本地整合写入见本地R4receipt，不声称文件系统全程零源码写入；
当前提交/推送差量必须且实测仅Markdown。DONE_WHEN=限定接受事务commit/push/readback/停顿。
