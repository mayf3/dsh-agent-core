# CAPTAIN-APPOINTMENT-REGISTRATION-20261109 — 条件式任命登记（SRA-C-001 字段齐备）

状态：**NOMINATED_APPOINTMENT_PENDING_VERIFICATION**。本登记是 five-decisions ① 序列第 2 步（身份核验✅→**任命登记**→§6.5 控制生效验证→生效），**不是生效任命**：生效前签发权 = NONE，不签发任何 Mandate/W7。SRA V1 已 ACTIVE_ON_MAIN（#682，2026-11-09）。状态机：`候选 → [本登记] → 条件式 → [§6.5 PASS] → EFFECTIVE（正式任命，五条件全满足后原链完成不再请批）`。

## 1. SRA-C-001 七字段登记

| 登记字段 | 内容 |
|---|---|
| **授权者与依据** | Owner mayf3：`owner-20261107-five-decisions` ①（专用 principal + 顺序指令）、`owner-20261107-four-pr-rulings` ①（仅身份创建授权）、`owner-20261108-three-unified` ①（创建方案1批准）、常设授权 §4（Captain 条件任命框架）、`owner-20261107-sra-formalization` ②（五条件与 NOMINATED_NOT_APPOINTED 纪律）。接受权威：AGENT_CORE_STANDING_RELEASE_AUTHORIZATION_V1，ACTIVE_ON_MAIN=YES（激活 PR #682，非作者独立 final-HEAD 审查 PASS，审查头 `9529e9a5`，blob `750504f2`）。**Issuer = Owner mayf3**（现有合法授权签发者；经由上述 ruling 授出，登记动作由其常设授权责任链内的监管会话执行，按 Owner 指令序列办理第 2 步），**非候选自授**；生效任命按 sra-formalization ② 由原合法任命责任链完成 |
| **被任命者** | Principal `5964fd61-1de1-4dd5-a28f-bac00f95c5a3`；agent_id `agt_release-captain-agent-core-20261107`；external_ref `agentcore:v1:principal:agt_release-captain-agent-core-20261107`；principal_type=agent / state=active / ownerless（accepted OWNERLESS_AGENT_PRINCIPAL_V1 profile）；identity-only（无 Client/Secret/Grant）。身份收据：PR #665（已合并）+ PR 评论闭环（GET by-external-ref 200 PRESENT 双读回）。**session 绑定：未绑定**——待 §6.5 控制验证时与实际入口一并绑定（诚实待核，不预支）；**UID：Auth 层身份 principal，不声明 OS UID 归属**（uid502 不代表本 principal，ruling 原文；OS UID 与 Auth principal 分属不同层）；**台账归属：DISPATCH-REGISTRY history 各 Captain 相关条目 + PR #659/#656/#649/#665 审计链**。跨 session 身份延续证明 = §6.5 控制验证时绑定（未验证，如实待核；与 CAPTAIN-REMAINING-CONDITIONS-20261109.md ①行一致：身份记录 DONE ≠ session/跨会话已证） |
| **提名链（候选来源超然记录）** | SRA spec 草案期原提名 = 监管会话 uid502 台账归属（规范化子记录 SHA256 `0498d4a65f2eb5d66cc3ec686a377ccbbbc3a779d79460a7ba6569233dc004e5`）；**Owner `five-decisions` ① 已改定为专用 principal**（该 Owner 决定超然于 spec 草案期候选表述）；`three-unified` ① 批准创建；PR #649 四 principal 方案为对照依据（其"后续接受事务须明确唯一采用方案"由此处及 Owner 裁定满足）。uid502 单独不代表身份（ruling 原文） |
| **可签范围** | 仅：本仓 `mayf3/dsh-agent-core`、既有单一 fleet runtime、`STANDARD_RECOVERABLE` 标准发布类（SRA-C-002 五判据全过）。排除项 = SRA-C-002 非标准清单全部 + 不转委托、不扩域、不激活新 controller/profile/trust root/setuid helper、不清他人 fence、不动 Secret/Grant、不业务重放。缺少普通资格材料≠新产品决策，按 SRA-C-005 原链补齐 |
| **有效期** | `validUntil = 2026-12-07T16:00:00Z`（UTC，不自动续期）；`validFrom = EFFECTIVE 收据时刻`（依 ruling "validFrom 以可归属生效收据为准"，生效前无签发窗口可言）。续任须新明确期限，不默认延长 |
| **能力和独立性** | 能力证据 = §6.5/SRA-C-006 第 5 步控制验证（待条件④，未做）。独立性 = §2 四角色映射表（本文）+ 逐单冲突矩阵绑定；C 不得为本单候选/installer 实质作者、不兼任本单 A/W/V |
| **控制绑定** | 现有执行控制对 issuer/范围/时效/撤销及 Mandate 的机械验证 = **条件④控制面适配的交付物**（含负向拒绝：未任命/越界/过期/撤销/候选漂移/缺门），绑定实际入口版本/hash 与资格收据；未交付并验证前 EFFECTIVE 不可登记 |
| **生命周期** | 任命登记 ID = `CAPTAIN-APPT-REG-20261109-01`；登记时间 2026-11-09（UTC 见 registry history 同刻条目）；登记者 = 原责任链监管会话。撤销：Owner 或原有权任命者在同一登记链撤销/缩窄，记录 actor/时间/范围/理由及受影响 Mandate；过期/撤销后不得启动新窗口或新写入阶段，在飞操作按当次已批准安全配方处置，撤销不自动授权 kill/回滚/重放 |

## 2. 四角色映射表（条件② 独立性落表，依 PR #649 方案 + Owner 裁定）

| 角色 | 身份（本登记时点） | 逐单绑定规则 | 与 C 互异 |
|---|---|---|---|
| **C = Release Captain** | 专用 Auth principal `5964fd61…`（见上） | 固定 | — |
| **A = Mandate 作者/监管线** | 原责任链监管会话（DISPATCH-REGISTRY 台账归属；uid502 仅为操作上下文，不代表身份） | 逐单记录台账坐标 | ✓ 不同主体（专用 Auth principal vs 监管会话台账身份） |
| **W = 发布执行 worker** | 逐单指定的执行入口会话/Agent（持本单唯一 writer 身份与本人 mutex） | 每单 Mandate 显式绑定，签发前核非 A/C 同主体 | 逐单强制 |
| **V = 独立 verifier** | 逐单指定的非作者只读审查（既有 QA 模式，如 #681 v3 QA） | 每单 Mandate 显式绑定 + 作者独立性声明 | 逐单强制 |

冲突矩阵（同一单发布，X = 不得同主体承担；新开 session 不消除冲突）：A×W、A×V、A×C、W×V、W×C、V×C 全部 X。实质参与改写者按新角色计算（如监管审查实质改写 Mandate 则计为作者）。同 UID 不是独立性证明；只写角色名或自报身份不合格。

## 3. 生效前置（未完成项，全部为可结束工作项）

1. **条件④ 控制面适配 + §6.5 负向资格**：机械验证 issuer/范围/时效/撤销/Mandate 并演示六类拒绝（未任命/越界/过期/撤销/候选漂移/缺门）；独立 verifier 回执；绑定入口版本/hash。
2. **能力证据**：§6.5 通过即构成能力证据（条件②的能力半边）。
3. **跨 session 身份延续证明**（被任命者字段待核项）。

以上完成 → 原合法任命责任链按 sra-formalization ② 完成正式任命（不再请批）→ 登记 `EFFECTIVE`（validFrom=生效收据时刻）→ 此后方可在范围内逐单签发；W7 仍为生效后首单候选，不自动签发。

## 4. 本登记不改变的事实

OPERATION_ALLOWED_NOW=NO；四种独立事实（SRA accepted / Captain appointed / control effective / Mandate issued）分离纪律不变；本登记不签发、不授权、不激活任何控制面。
