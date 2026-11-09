# BRIEF-SRA-FORMALIZE — SRA V1 正式化接受事务（Owner 授权, docs-only）

授权: Owner 2026-11-07 裁定(rulings[id=owner-20261107-sra-formalization]第一条): 认可 PR#648 HEAD 61b97d32 六节语义; 首次接受由 Owner 授权本责任链执行; **本 worker=转换与事务执行者, 非接受权威本身**——接受权威坐标=Owner 裁定记录, 全程绑定。
工作面: 本worktree(docs/standing-release-auth-v1 @ 61b97d32)。docs-only, 零生产写入, 不任命Captain, 不签发窗口。
停止条件: 失败即停追加STOPPED-SRA-V1.md。

## 任务(四步, 顺序)
1. **格式转换**: 草案→正式 governing Spec `docs/specs/AGENT_CORE_STANDING_RELEASE_AUTHORIZATION_V1.md`, 符合SPEC_FORMAT_V0(参照本仓既有accepted spec frontmatter: spec_id/status/authority_level/implementation_authority/production_apply_authority/scope/governed_by/supersedes等); 语义与六合同逐字保留(只做格式载体转换); production_apply_authority语义如实(Captain签发权在本Spec生效+任命后按§3/§4行使, frontmatter按仓惯例如实标注)。
2. **转换commit(proposed)**: commit到本分支; 自查diff=纯格式载体+无语义delta(逐节对照)。
3. **独立差量审查**: 非作者独立审查转换后精确HEAD vs 61b97d32: 语义零变化+frontmatter合规+安全边界全保留; PASS才能进第4步。
4. **接受事务commit**: proposed→accepted; accepted_by=mayf3; 接受权威坐标=Owner裁定 rulings[id=owner-20261107-sra-formalization](监管台账)+PR#648 HEAD 61b97d32; accepted_reviewed_head=第3步审查HEAD; 绑定齐全后 push, gh pr create(base main)或更新既有PR; **合并由监管在独立审查PASS后执行**(你push后停, 等监管)。
完成定义: 转换commit SHA+独立审查PASS原文+接受commit SHA+PR回执。失败即停照旧。
