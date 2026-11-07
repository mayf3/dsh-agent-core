# Disk Stage 1 独立证据审查

- `schema_version = 2`
- `SPEC_GOVERNANCE_MODE = REVIEW`
- `REVIEW_KIND = AFFECTED_CONTRACT`
- `REVIEW_SCOPE = FULL`；`FULL_REVIEW_BASIS = INITIAL_REVIEW`
- `REVIEW_TARGET_HEAD = 7f777f21ee4b93bb5e792c66bf047ad8723d36ee`
- `BASE_HEAD = bb67ce5ae53908c299e751d3904793b9f4d08240`
- `CURRENT_BASE_HEAD = bb67ce5ae53908c299e751d3904793b9f4d08240`（根交付者刚读回；本审查未写远端）
- `REVIEWER_ID = /root/independent_review`
- `NUMERIC_REVIEWER_ID = /root/independent_review/numeric_check`
- `AUTHOR_ID = /root`；调查子收据作者为 `/root/{workspace_refs,preservation,tmp_physical}`。
- `AUTHOR_INDEPENDENCE = PASS`：本审查者及数值复核者没有参与被审报告、扫描脚本、盘点数据或调查结论的形成；本文件是首次参与的写入。
- `ASSURANCE_LEVEL = DURABLE`
- `RESULT = PASS_FOR_STAGE1_DOCUMENT_DELIVERY`
- `FROZEN_BLOCKER_UNION = []`；`BLOCKERS = 0`；`SPEC_GAPS = 0`
- `MERGE_READY = NOT_APPLICABLE`；Owner要求创建PR且不合并。
- `GC_OPERATION_ALLOWED = NO`；本审查不是删除、生产写入或保留策略变更的接受/授权。

## 审查对象绑定

| 文件 | SHA256 |
|---|---|
| `DISK-STAGE1-INVENTORY.md` | `bb312fdce6f7f784879903089beaa997daaf10115205557501ff1670268c29ef` |
| `docs/evidence/disk-stage1-20261107/candidates-20.json` | `600c4f50f5851f07e9b432cf4fcfb127119e91bad924cc536258f76e71158807` |

本次只读取本worktree的提交、报告、收据和本机SDK文档；没有重新扫描生产内容，没有执行受查脚本，没有修改Git/调度/生产面。唯一审查写入是本文件。

## 范围及适用边界

已读取AGENTS、vendored grammar、local governance、spec-governance的REVIEW模式、Product Architecture shared-host/Secret边界、D-008/D-009索引，以及CTR-SOD-002调查授权、BACKUP_RETENTION_V1的pinned/legacy/rollback限制和DEVELOPMENT_EXECUTION_SURFACE §12的Operator-managed retention。

审查范围是Owner第一阶段的只读调查文档及其证据关系：空间账单、差额解释、重点域、20项条件候选、引用与UNKNOWN、物理空间方法、preservation创建/消费链、第三阶段建议的边界。没有接受新的TTL/GC合同，也不以报告充当运行态权威。

## 已执行检查与结果

1. **证据完整性和数值（rc0）。** 独立数值子复核验证SHA256SUMS中121项全部存在、hash全部相等。20候选路径唯一、无父子重叠，按allocated bytes降序；每项A/P均与相应physical probe的allocated/private_all_links吻合。A合计41,663,488,000B，P合计34,060,652,544B；当前保证可回收与实际释放字段逐项为0。证据manifest不自递归，也未预先包含审查回执。
2. **主账单复算（rc0）。** Data可见du749,962,634,240B、顶层差8,192B，APFS各卷与容器开销、Data余量17,888,300,032B及容器余量59,719,306,240B均与原始plist/du一致。root视图1,516,186,564,608B、外盘du102,343,114,752B、最终df Data771,018,907,648B均与报告一致。前后窗口不同被明示，没有把约47G旧差额强行归入某类垃圾。
3. **物理方法审查。** 独立读本机SDK的getattrlist man与attr.h，确认CMNEXT private/cloneID/refcount的含义与脚本mask/类型相符。检查脚本用lstat、同dev边界、dev+inode去重、树内名字数与nlink比较；未用内容hash或不同inode代替clone证据。a29/a45共享payload、a46私有payload及三份tar的结论均有返回属性和独立哈希收据，报告没有将P承诺为当前可执行释放量。
4. **引用和保留审查。** 候选矩阵逐项保留process/schedule/Workflow/Mandate/PR/Receipt/rollback/formal-reference八域；无可见FD、无literal命中、PR merged和旧mtime未被提升为“无人使用”。PR85 OPEN exact head、523实际symlink、活跃postgres、W7/W6及B7 preimage的保留反例被正确突出。20项是明示探测范围内的优先复核集合，报告没有声称已穷尽全机可回收目录。
5. **preservation因果边界。** 对照原生Codex元数据/进程收据和campaign-archive-chain：原生nightly重建保持UNKNOWN；当前rollout增长、历史FD引用与campaign按轮次排他rename是不同观察。a12 rc0归档收据及准入消费者源码已绑定；a104库存没有补造PID，a105一次授权没有被称为已执行。03:00/07:00的异责任备份未冒充Codex producer。
6. **权限与Secret输出检查（rc0）。** 查看各域权限/解析错误保留及UNKNOWN声明；对新增文件执行带词边界的sk-/Bearer/ghp_/github_pat_、私钥头和JWT形式检查，匹配坐标0。手工检查调度/归档摘录仅必要字段，未发现DB/认证载荷或会话正文被导出。模式检查不保证穷尽任意Secret形式，报告也没有作这种保证。
7. **差异检查（rc0）。** `git diff --check bb67ce5ae53908c299e751d3904793b9f4d08240 HEAD -- . ':!**/*.stdout.txt'`通过。原始lsof comm尾空格留存，完整默认check的rc2是明确记录的原始证据格式现象，非篡改或产品缺陷。提交差异限Brief/主报告/evidence，不含产品源码、生产配置或保留合同变更。

## 结论与保留限制

`AUTHORITY_REVIEW = PASS`；`PRIMITIVE_BOUNDARY_REVIEW = PASS`；`MANDATE_SCOPE_REVIEW = PASS`；`EVIDENCE_REVIEWABILITY = PASS`；`ACCEPTANCE_COVERAGE_REVIEW = PASS_FOR_BOUNDED_STAGE1_REPORT`。

本阶段可交付文档并按Owner要求push/建PR。无阻塞发现；不要求扩大调查成新的治理/GC实现。未知的nightly输出根、完整当前Workflow/Mandate/rollback引用、权限不可见面、重建可恢复性和真正删除后的df变化仍为UNKNOWN或未执行，不能由本审查PASS填充。它们继续阻止把任一候选改称已证安全删除；后续阶段应按原责任链补齐适用事实。

若最终Head仅加入本审查回执及manifest绑定，不需要重跑全盘扫描；应对实际最终Head做receipt-only delta读回，确认根报告/候选JSON/原始收据语义未变化。
