# BRIEF-RTH-CORE-SUCCESSOR — refused protocol Core 整权后继起草（常设授权 §3B 已授权）

授权: Owner 常设授权§3B(rulings[id=owner-20261107-standing-delegation]): "这些已决定语义所必需的WEC/WAE/Liveness整权继任及Core/Svc配套合同"+五件裁定③(RTH V1限定接受, 配套接受后可实施)。
工作面: 本worktree(docs-only, detach @ main b6ddc2a6)。零产品源码, 零生产写入, proposed/零实施权(接受=Owner)。
停止条件: 失败即停追加STOPPED-1377-MINIMPL.md。

## 背景
- RTH V1(AGENT_CORE_REFUSAL_TERMINAL_HANDOFF_V1)已accepted落main但implementation_authority:none(限定接受)。
- 实施需Core整权后继(把RTH V1的refused protocol语义纳入实施权contracts)+Svc配套。

## 任务
1. **起草Core整权后继提案**: SUPERSEDE或NEW路线论证——目标=把RTH V1的refused protocol(RECOVERY_REFUSAL_TERMINAL reason/系统级Assistance交接/幂等收据/失败责任保留)纳入implementation_authority: contracts的实施权威。可选路线:
   a. 独立NEW Spec(仅refused protocol实施面)
   b. 并入PPR V1 AMEND(若PPR V1的WAE3/Liveness1后继范围可自然扩展)
   给路线论证+推荐。
2. **WEC/WAE/Liveness整权继任核对**: RTH protocol实施需触及的WEC/WAE/Liveness条款——核对现有accepted权威(含V4/PPR V1)是否已覆盖, 或需附加整权继任; 逐项列坐标。
3. **Svc配套合同清单**: RTH protocol的Svc侧义务(接收/回复/消费者)——列需配对的Svc合同与当前状态。
4. **实施闸门矩阵**: 提案接受后#1377最小实现的可实施面/仍闸面; PPR V1与#644的边界一致性核验。
5. 格式: SPEC_FORMAT_V0, proposed/零实施权(接受=Owner)。

## 交付
docs/specs/ 提案文档+RECEIPT-RTH-CORE-SUCCESSOR.md(路线论证+核对清单+闸门矩阵+开放问题)。commit新分支docs/rth-core-successor→push→PR(base main)不合并。
