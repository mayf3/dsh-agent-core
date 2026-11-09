# BRIEF-SUCCESSION-ORDER — 三 PR 权威继任顺序与冲突检查（Owner 裁定⑤优先项, docs-only）

授权: Owner 四PR裁定⑤(rulings[id=owner-20261107-four-pr-rulings]): "优先形成一份三PR的权威继任顺序和冲突检查, 复用现有PR/Spec生命周期"。
工作面: 本worktree(docs-only)。零产品源码, 零生产写入, 不接受不合并新提案。
停止条件: 失败即停写STOPPED-SUCCESSION-ORDER.md。

## 对象与裁定输入
- PR #655: WEC V4 锁时序 SUPERSEDE(有界解锁: 两类远端采集移出全局admission lock; 裁定④: 正式接受前将过期Svc V2引用核准为当前V3+与#657继任顺序协调; 实际双writer测试硬性要求)
- PR #657: PRE_ADMISSION_RECOVERY_V1(ordinary planned有界首次admission; 裁定②: 正式继任前核对双前驱整体退休+当前WEC权威引用+#643生命周期影响; 实施权由accepted Contracts承接)
- PR #658: REFUSAL_TERMINAL_HANDOFF_V1(refused-terminal独立reason; 裁定③: 正式落地前修正#643已accepted/merged状态表述+协调#655/#657有效前驱引用)
- 已合关联: #643(aging, accepted, 实施闸门=WEC/Svc配套接受)/#644(blocked自动恢复)/#655引用的既有WEC V3

## 任务
1. **依赖图**: 三PR间的语义依赖/引用关系/共享机制面(系统Assistance入口)精确绘制; 各自触及其他PR对象的条款坐标。
2. **继任顺序建议**: 拓扑排序+理由(如: WEC V4先于#657因WEC权威引用; #658的#643状态表述修正独立可先行); 每步的接受者/前置/合并后效果。
3. **冲突检查**: 三PR+已合#643/#644间的条款冲突扫描(同一合同对象的多点修改/锁语义vs恢复语义交叠/DTO封闭边界一致性); 冲突给消解建议。
4. **前驱引用核准清单**: 裁定④要求的Svc V2→V3核准+裁定②③要求的前驱修正——逐项列坐标与修正内容(作为各PR合并前必做项)。
5. **实施闸门矩阵**: 各PR接受后"可实施什么/仍闸什么"(照Owner各条限定: #657实施权由accepted Contracts承接/#658不实施新协议/#655实施授权保留但生产none+#652双writer测试硬门)。

## 完成定义
SUCCESSION-ORDER-AND-CONFLICTS.md(依赖图+顺序+冲突消解+前驱核准清单+实施闸门矩阵)+RECEIPT。commit新分支docs/succession-order→push→PR(base main)不合并。零生产写入。失败即停照旧。
