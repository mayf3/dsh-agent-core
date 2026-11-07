# SRA V1 正式格式转换独立差量审查

```text
SPEC_GOVERNANCE_MODE = REVIEW
REVIEW_KIND = SPEC
REVIEW_RESULT = PASS
SPEC_REVIEW = ACCEPT
REPOSITORY = mayf3/dsh-agent-core
REVIEWER_ID = /root/formal_conversion_review
AUTHOR_ID = /root
AUTHOR_INDEPENDENCE = PASS
REVIEW_TARGET_HEAD = 8fdd5e9dc4f9cf525188d6ac19f986e0191e9604
SEMANTIC_SOURCE_HEAD = 61b97d326e337057cd1f71c0a6ff0dc37ab72ec2
BASE_HEAD = f6e332d7568b01c5253618449bfef5839102c851
CURRENT_BASE_HEAD = f6e332d7568b01c5253618449bfef5839102c851
ASSURANCE_LEVEL = CONTROLLED
REVIEW_SCOPE = DELTA
SCOPE_REASON = 对 Owner 已认可六节进行正式载体转换的差量审查；不重启未变草案的全量产品审查
IMPACT_EVIDENCE = 两个精确 Git 对象的全文逆转换、逐节字节比较、新增外壳/frontmatter 语义审查、Owner 原件核对
AUTHORITY_REVIEW = PASS
PRIMITIVE_BOUNDARY_REVIEW = PASS
CONTRACT_REVIEW = PASS
ACCEPTANCE_COVERAGE_REVIEW = PASS
MANDATE_SCOPE_REVIEW = PASS
EVIDENCE_REVIEWABILITY = PASS
BASE_IMPACT = NONE
SEMANTIC_DELTA = NONE
FROZEN_BLOCKER_UNION = []
BLOCKERS = 0
SPEC_GAPS = 0
FOLLOW_UPS = 0
TOOLING_DEBT = 0
READY_FOR_OWNER_AUTHORIZED_ACCEPTANCE_TRANSACTION = YES
ACCEPTANCE_COMPLETE_AT_REVIEWED_HEAD = NO
IMPLEMENTATION_ALLOWED = NO
MERGE_READY = NO_PENDING_ACCEPTANCE_AND_REGULATOR_FINAL_HEAD_REVIEW
OPERATION_ALLOWED = NO
NEXT_ACTION = CONTINUE_OWNER_AUTHORIZED_DOCS_ONLY_ACCEPTANCE_TRANSACTION
```

本 reviewer 未创作本次转换、原六节语义或其附属证据，未修改工作面、未执行接受、远端写入或生产操作。本结论是独立审查推荐，不自行构成正式接受。

## 实际独立核验

检查从上述两个精确 Git 对象读取内容，未运行作者的 `/private/tmp/sra-formalization-check.py`，也未将作者检查报告作为独立 PASS 的替代。

在 `2026-11-07T07:23:29.943827+00:00` 完成的独立检查实际 rc=0：

- 将正式文件六节标题层级和相对链接逆转换，逐节比较 `SRA-C-001` 至 `SRA-C-006`：六项全部字节一致。
- 将保全的源标题、route、goal、inputs、authority、boundary 与六节正文重新组装：全文与源草案字节一致。
- 使用仓内 `.agents/schemas/spec-frontmatter.schema.json` 独立验证 YAML：PASS。
- 检查十三个逻辑章节顺序：PASS。
- 检查原六个合同与验收映射：6/6，原表及其方法、环境、必需证据、通过预期和失败反例未变。
- 从候选 Git 树检查全部十四个本地链接目标：全部存在。
- 直接读取监管台账原件的唯一选中裁定，与候选中的 Owner 裁定快照比较：内容完全一致，规范化 hash 相符。
- `git diff --check 61b97d326e337057cd1f71c0a6ff0dc37ab72ec2 8fdd5e9dc4f9cf525188d6ac19f986e0191e9604`：rc=0。
- `python3 .agents/tools/verify_governance.py --target .`：rc=0，vendored governance bytes match governance.lock.json。
- 差量只有六个新增 Markdown/JSON 文档与证据文件；根目录源草案未改，无代码或生产配置变更。

独立 fresh 远端读取亦实际 rc=0：

```text
main = f6e332d7568b01c5253618449bfef5839102c851
PR #648 state = OPEN
PR #648 base = main
PR #648 head = 61b97d326e337057cd1f71c0a6ff0dc37ab72ec2
PR = https://github.com/mayf3/dsh-agent-core/pull/648
```

## 内容绑定

```text
SOURCE_FULL_SHA256 =
5c1bb2567bd2ca04a2743d6c871934204fe511023aec340058f02df0477531e2

INDEPENDENTLY_RECONSTRUCTED_FULL_SHA256 =
5c1bb2567bd2ca04a2743d6c871934204fe511023aec340058f02df0477531e2

PROPOSED_FORMAL_SPEC_SHA256 =
11e0f998e67036fd52d04b8abde632e36eb90fdca99df3c78795cfee7e9e17fc

OWNER_RULING_CANONICAL_SHA256 =
f6ace2b1e1621da830421e57a9b886faac75de8f4bf7a895d0ecf0832438a129
```

逐节逆转换后的 SHA256 与源节完全相同：

| 原节/合同 | 独立复核 SHA256 |
|---|---|
| §1 / SRA-C-001 | `c1c3d78de22a5a2cdba86097b79a361daa65dc77bb7e0885d91c55dcd02aa6f1` |
| §2 / SRA-C-002 | `06311e963d40174c660a3fd6f7f3a40033b04a42a73ffe9ea14d2aff81f6a4a8` |
| §3 / SRA-C-003 | `2f238305b4ee3db8e7fc6175bbd49e0e2faa81da708a721a2b4dbd045b6f85c2` |
| §4 / SRA-C-004 | `da55263d21cab964722d0661d0f144929522c92c015e92d029fe67b465fbd79b` |
| §5 / SRA-C-005 | `fb911a77d0e867e7ffd32585564cc1af073ca1ff9977aa23d6a41ecd90800199` |
| §6 / SRA-C-006 | `696d6e74eac43d178e2beef1a3fbae15ceaac9aab0d5edf1d69aec0034ed2fa8` |

Owner 原件：

```text
/Users/yanfenma/Documents/Codex/2026-10-18/zcode-assist/tools/b7ctl/DISPATCH-REGISTRY.json
selector = $.rulings[id=owner-20261107-sra-formalization]
acceptance authorization = items[0]
canonicalization = UTF-8 json.dumps(record, ensure_ascii=False, sort_keys=True, separators=(',', ':')), no trailing newline
```

## 独立语义判断

1. 正式 Spec 的合法稳定 ID、路径、frontmatter 和十三个逻辑章节符合 `SPEC_FORMAT_V0`。原六个 `SRA-C-*` 标识及验收含义不变；未引入 supersession 或第二个可独立生效模型。新增外壳承担索引、类型、来源和生命周期说明，没有新增、缩窄或扩大六节规范意义。

2. `production_apply_authority: conditional_controlled_operation` 配合条件字段如实表达原 §1/§6 生效、任命和控制资格满足后，有权 Captain 才可依原 §3/§4 签发完整单次标准类 Mandate。该字段没有允许当前生产执行，没有激活 controller/profile/helper，也没有改写 DCP V1 的 `production_apply_authority: none`。`implementation_authority: none` 保持源稿边界。

3. 接受权威明确绑定 Owner 裁定，而非转换作者、事务 worker 或未来 Captain。裁定快照是来源证据，未被写成另一接受渠道；首次接受仍需 reviewed HEAD、接受记录及最终接受 HEAD 绑定。旧草案时点的“本轮不接受”等描述已明确作为历史记录保留，不冒称当前事务状态。

4. 原六节全部安全边界保留：候选与任命分开、明确期限与撤销、职责独立；只签标准类；G01–G16 和未来阶段 fresh 事实分开；完整前镜像先于 bootout；旧 runtime 与已派发 effects 的终止或有效隔离正证；stage10 仅恢复既有合法自然准入；保留 UNKNOWN、各域 fence、认证及不重放；V3-aware 回滚及 E01–E17 限制；普通缺证原责任链补齐；未知写入先对账、不盲重试；接受、main 落地、实际生效与逐单签发分别成立；W7 不自动签发。

## 限制与下一边界

本 PASS 仅适用于 `8fdd5e9dc4f9cf525188d6ac19f986e0191e9604` 相对 `61b97d326e337057cd1f71c0a6ff0dc37ab72ec2` 的格式转换差量。它不证明生产 installer、控制资格、Captain 身份/任命、运行状态或任何窗口门已通过。

允许依已给 Owner 授权继续 docs-only 接受事务。接受提交应绑定本 reviewed HEAD、Owner 裁定及 `accepted_by=mayf3`；随后最终接受 HEAD 仍须独立生命周期差量复核。合并由监管执行，当前 worker 不合并、不任命、不签发、不做生产操作。
