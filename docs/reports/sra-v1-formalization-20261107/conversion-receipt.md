# SRA V1 格式转换收据（proposed）

- 授权：当前 `BRIEF-SRA-FORMALIZE.md`；Owner 原件 `/Users/yanfenma/Documents/Codex/2026-10-18/zcode-assist/tools/b7ctl/DISPATCH-REGISTRY.json`，selector `$.rulings[id=owner-20261107-sra-formalization]`，`items[0]`。
- Owner 记录时间：`2026-11-07 15:16`；本次直接观察：`2026-11-07T07:20:36.333385+00:00`；canonical SHA256：`f6ace2b1e1621da830421e57a9b886faac75de8f4bf7a895d0ecf0832438a129`。算法：UTF-8 `json.dumps(record, ensure_ascii=False, sort_keys=True, separators=(',', ':'))`，无末尾换行。快照为相同选中记录，不复制完整台账或 Secret。
- 接受权威为 Owner mayf3 的该裁定；`/root` 为格式转换作者和事务执行者，不是接受权威，不以未来 Captain 身份接受。
- 源/分支：`docs/standing-release-auth-v1 @ 61b97d326e337057cd1f71c0a6ff0dc37ab72ec2`；integration main=`f6e332d7568b01c5253618449bfef5839102c851`；只读 PR/main 检查 rc0，PR #648 OPEN 且仍为源 HEAD（辅助核查 agent `/root/authority_binding`）。

```text
GOAL_OR_TARGET = 保留已认可六节语义，完成正式 Spec 格式转换与 Owner 授权接受事务
CURRENT_GAP = 源草案尚无正式 governing Spec 载体和本次接受绑定
SPEC_GOVERNANCE_MODE = AUTHOR
AUTHORITY_ACTION = NEW  # 原 NEW 提案的首次接受，不改六节意义
PRIMARY_AUTHORITY = Owner ruling owner-20261107-sra-formalization + repository accepted governance
ROUTE_STAGE = AUTHORITY_AUTHORING
AUTHORITY_ACCEPTED_IN_BASE = NO
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = CONTROLLED
DOCS_FIRST_REQUIRED = YES
IMPLEMENTATION_AUTHORITY = none
EVIDENCE_NEEDED = 原文逐节字节对照 / schema / nonauthor exact proposed HEAD review / acceptance final HEAD recheck / PR readback
DONE_WHEN = 转换commit + 独立PASS原文 + 接受commit + push/PR回执
EXPANSION_TRIGGER = 权威冲突 / 六节语义差量 / 安全边界丢失 / 非文档效果 / 任一任务门失败
STOP_RULE = 失败即停，追加 STOPPED-SRA-V1.md
MERGE_EXECUTOR = 监管；本worker push/PR回执后停
CAPTAIN_APPOINTED_NOW = NO
WINDOW_ISSUED_NOW = NONE
PRODUCTION_OPERATION_ALLOWED_NOW = NO
```

## 转换清单与逐节自查

源草案文件不改。正式文件新增合法 ID/YAML、SPEC_FORMAT_V0 的十三个无编号逻辑章节、来源与历史生命周期说明。源标题/route/goal/inputs/authority/boundary 六段分别带 marker 保全；六节正文只把 `## n.` 改为 `### n.`，将仓库根相对链接机械重定位到 `docs/specs/`。所有 §1–§6 引用仍指原六节。新增文字仅索引/重述既有决定、证据类型和事务状态，无新增规范义务。

`production_apply_authority: conditional_controlled_operation` 沿用仓内值，条件字段精确限定为原 §1/§6 生效、任命及控制资格后按原 §3/§4 签发完整单次 Mandate；当前转换/接受不授任何生产操作。DCP V1 的 none 原文不变。implementation_authority 保持 none。

实际逐节检查结果与 SHA256 见 [conversion-checks.json](conversion-checks.json)。此提交本身为 proposed 转换坐标；精确完整 SHA 从 Git commit 对象读取，独审必须对该 SHA 与源 HEAD 比较。此收据不是独审 PASS 或正式接受；接受 commit/最终 HEAD/PR 另行持久绑定。

## 实际执行自查

`python3 /private/tmp/sra-formalization-check.py` rc0：六节逐字逆转换、完整源重建 SHA256 一致，13 逻辑章节、frontmatter JSON Schema、6/6 验收、14 个本地链接、vendored integrity 均 PASS。独审应独立从 Git 对象复核，不以作者检查代替语义判断。源根目录草案 SHA256=`5c1bb2567bd2ca04a2743d6c871934204fe511023aec340058f02df0477531e2`。

[远端观察原始回执](remote-preflight.json)：PR #648 与 main 两次只读命令均 rc0，坐标与源一致，无相关 Base movement。Owner 选中快照 canonical hash 复核相符。
