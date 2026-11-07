# BRIEF-CAPTAIN-DESIGN — Release Captain 具体受托 Principal 核定方案（响应 Owner V2 补充①）

授权: Owner V2补充①(rulings[id=owner-20261107-preauth-v2-supplement])。docs-only, 零生产写入, 不任命。
停止条件: 失败即停写STOPPED-CAPTAIN-DESIGN.md。

## 任务: 产出《Release Captain 受托核定方案》文档, 逐项回答Owner补充①要求
1. **职责分离结构**(硬约束: 作者/发布执行者/独立验证者不得同一身份完成全链):
   - 提出三或四principal角色图: Mandate作者(监管线)/发布执行者(worker会话)/独立验证者(独立审查会话)/Release Captain(签发核验)——每个角色的职责、禁止兼任面、冲突矩阵。
   - 给出**推荐方案**: Captain=独立专用principal(非监管会话uid502——其兼任Mandate审查者, 与签发核验存在作者相邻性; 如实分析并给缓解或排除理由) vs 候选B=uid502(附职责分离缓解措施清单); 明确推荐+理由。
2. **具体受托Principal核定表**: 每角色=principal标识方案(auth-service Principal/专用session/台账归属三元组)、身份延续证明机制、能力要求、注册坐标。
3. **授权范围**: 仓/发布类/排除项(沿SRA §2)。
4. **有效期与撤销**: 建议期限(对齐2026-12-07)+续任/撤销登记程序。
5. **实际工具执行控制**(关键): window执行器如何验证Captain签发——沿用window-authority JSON+签发登记坐标绑定; 负向测试(未任命/过期/越界签发必须被拒)。
6. **任命与接受时序图**: mayf3接受SRA(PR#648)→mayf3任命Captain(登记)→Captain资格激活→首单W7流程; 每步的合法授权者与登记坐标。
7. **开放问题清单**(如实: auth-service principal可用性/跨session身份延续的现存机制缺口等)。

## 完成定义
CAPTAIN-DESIGN-PROPOSAL.md+RECEIPT(对照Owner补充①逐项覆盖)。commit同分支docs/standing-release-auth-v1或新分支, push开PR不合并。零生产写入。失败即停照旧。
