# SRA V1 非作者审查收据

本文件由 `/root` 记录两名非作者实际返回的审查结果；reviewer 未创作本候选语义。它是审查证据，不是正式接受、任命、生效或逐窗签发。

```text
REPOSITORY = mayf3/dsh-agent-core
REVIEW_TARGET_HEAD = 67723399ee801d3262b92969a8c016ff53c8a7d2
BASE_HEAD = f6e332d7568b01c5253618449bfef5839102c851
CURRENT_BASE_HEAD = f6e332d7568b01c5253618449bfef5839102c851
BASE_OBSERVATION = remote-read-r2.json at 2026-11-07 06:51:56-57 UTC
MODE = REVIEW
REVIEW_KIND = SPEC
ASSURANCE_LEVEL = CONTROLLED
REVIEW_SCOPE = FULL_INITIAL_AFFECTED_AUTHORITY_REVIEW
AUTHOR_ID = /root
REVIEWERS = /root/sra_source_audit, /root/w7_gate_audit
AUTHOR_INDEPENDENCE = PASS
FROZEN_BLOCKER_UNION = []
DOCS_PUBLICATION_READY = YES
SPEC_ACCEPTANCE_COMPLETE = NO
DELEGATION_EFFECTIVE = NO
IMPLEMENTATION_ALLOWED = NO
OPERATION_ALLOWED = NO
MERGE_READY = NO_THIS_TASK_PROHIBITS_MERGE
```

## Owner/角色/权威审查

reviewer=`/root/sra_source_audit`；结果 `SPEC_REVIEW=ACCEPT`（推荐）、`AUTHORITY_REVIEW / PRIMITIVE_BOUNDARY_REVIEW / CONTRACT_REVIEW / ACCEPTANCE_COVERAGE_REVIEW / MANDATE_SCOPE_REVIEW / EVIDENCE_REVIEWABILITY=PASS`；`BLOCKERS / SPEC_GAPS / FOLLOW_UPS / TOOLING_DEBT=0`。

- Owner 六条有双向覆盖；§2继任委托未扩大成任意新权威接受权限，新增SRA接受者仍须有针对该机制的明确授权。
- 首任uid502/台账归属只作候选，未用历史reviewer_session补造principal；任命/期限/独立性/撤销/控制绑定设为生效前必需。
- 草案、审查、正式接受、main落地、实际生效、单次Mandate分开；提示词/JSON/hash/merge均不单独产生生产许可。
- stage10只恢复原合法自然准入，UNKNOWN/各域fence/认证/no replay保持；bootstrap后全局pause归非标准拒绝。
- 普通失败原链补齐；四组升级保留未知写入对账与attempt/STOP边界。
- W7十节覆盖G01–G16，未来事实未提前PASS，不自动签发W7，DCP V1 production_apply_authority保持none。
- 收据pending状态明确为候选冻结时点，未把未来push/PR冒称完成。

实际只读验证：两份来源快照hash/bytes PASS；provenance中11份仓内authority的commit/blob/SHA256 PASS；三条Owner子记录规范化hash PASS；`git diff --check BASE..REVIEW_TARGET_HEAD` rc0；仅9份文档/证据，无产品代码或生产变更。该reviewer沿用已持久化双路径main观察，没有新增远端读取。

## W7强制门/阶段/回滚审查

reviewer=`/root/w7_gate_audit`；实际返回 `docs发布语义审查 PASS`、`FROZEN_BLOCKER_UNION=[]`，接受/生效/生产readiness均NO。

- G01–G16覆盖W7十节、E01–E17精确效果、06a完整前镜像、V3状态兼容、R1/R2回滚、STOP与终收据。
- 签发前材料与窗口内fresh事实明确分开；05/07/10/11/12未预填PASS；没有完整preimage不bootout。
- stage10只恢复既有合法自然准入，保留UNKNOWN/fence/auth/no replay；不改W7、不自动签发。
- 实际独立运行来源快照hash/原件字节对照、authority blob/hash核对、六节/本地链接检查、base..candidate diff check、vendored integrity，均rc0/无问题。

## 限制与下一边界

这些结果只适用于上述候选和base的docs发布。没有执行角色任命、正式接受、控制资格、生产读取/写入或窗口门。本收据及RECEIPT后续仅作事实更新，最终HEAD仍由非作者做delta recheck；最终出版结果在PR持久记录中绑定，不将此处候选hash伪装成未来最终hash。
