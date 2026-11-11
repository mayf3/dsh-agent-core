# BRIEF-SRA-V1-DRAFT — Standing Release Authorization V1 可执行委托版本起草

授权: Owner 预授权机制 V2(rulings[id=owner-20261107-preauth-v2], 2026-11-07)行动指令: "原治理责任链先完成受托角色、现行权威允许的签发范围和技术强制门的适配, 再将可执行的委托版本提交合法接受"。
工作面: 本仓(fleet-window tools, git)。产出=治理文档(docs-only), 零产品代码, 零生产写入, **不签发任何窗口**(含W7)。
停止条件: 失败即停写STOPPED-SRA-V1.md。

## 起草要求(六节)
1. **受托角色定义**: Release Captain 资格(可归属身份/独立于单次作者/明确授权登记坐标/能力要求); 首任候选=监管会话(uid 502, DISPATCH-REGISTRY 台账为归属坐标); 登记与撤销程序。
2. **签发范围**: 标准可恢复生产发布的判据(accepted Contracts 内/现有 Mandate 框架/单一 fleet runtime 面/可回退); 非标准排除清单(bootstrap后需继续全局暂停/新语义/扩权/跨域/首次新面)。
3. **每次签发的强制门清单**(技术强制门适配): 从 W7 Mandate 十节抽取 Captain 签发前必须逐项核验的 checklist(精确候选+预期旧版 fresh 一致/installer+闭包资格/E01-E17 前镜像与效果边界/状态兼容核验/verifier 就绪/独立 verifier 指定/时窗+最大尝试/回滚证明绑定/STOP 条件齐备/收据要求); 每门给"核验什么+证据坐标要求"。
4. **stage10 通用原则落地**: 引 Owner §4 原文语义→Mandate stage10 字段的标准类判据+非标准类 STOP 判据。
5. **失败处理纪律**: §5 的"原责任链自行补齐/禁依赖操作/不停成 WAITING_OWNER/四类升级 Owner"操作化。
6. **合法接受与生效程序**: 依据§2 委托机制——草案→独立审查(非作者)→受托维护者按现行规则正式接受(登记坐标)→生效; 生效前现行禁令不变; W7 不自动签发(W7=生效后首单标准发布走完整 Mandate)。

## 完成定义
STANDING-RELEASE-AUTHORIZATION-V1.md(或 DRAFT 后缀)+RECEIPT-SRA-V1.md(六节覆盖对照 Owner 六条款+开放问题如实清单)。commit 到本仓新分支 docs/standing-release-auth-v1, push 开 PR(base main of that repo), 不合并。零生产写入。失败即停照旧。
