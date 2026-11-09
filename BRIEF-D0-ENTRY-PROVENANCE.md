# BRIEF-D0-ENTRY-PROVENANCE — Δ0：真实控制入口来源与调用链普查（只读）

## 授权与纪律

- 上游依据：PR #683 `CONTROL-CENSUS-SRA-EFFECTIVENESS.md` §3 差量表 Δ0（ops/sra-control-census 5f387cf1）；常设授权 §2 调查自主推进
- 本任务 = **只读普查 + docs PR（不合并）**；生产写入=0、认证面调用=0、不激活/升级任何 controller/profile、不 patch installed 文件
- 只读生产面允许：lstat/stat/read/hash/ps/launchctl print（print 级）；不 kill、不写、不重配
- 失败语义：证据找不到 = 如实 UNKNOWN，探索空结果≠失败；仅工具持续不可用才 STOPPED

## 任务

SRA 条件④生效前置的 Δ0：**控制所有者先绑定**真实入口的 `源repo/revision → 安装bytes → loaded入口 → 已准入profile/目标/当前writer`。源与授权未知 = 补归属收据，不得直接 patch installed 文件。

交付 `D0-ENTRY-PROVENANCE-CENSUS.md`（repo 根）+ PR(base main) 不合并，五节：

1. **D 的来源归属**：`/usr/local/libexec/agent-deploy-system/deployment_system.py`（及同目录 `ds_client`、其他文件）
   - 逐文件 SHA-256 + size + mtime（观察时间 UTC/北京并列）
   - 在本仓全 ref 历史（`git log --all`、`git rev-parse`、blob 搜索）搜匹配内容：哪个 commit/分支包含相同/最近似字节；`dsh-agent-core` 内无匹配 → 如实写"来源 repo 未定位（UNKNOWN）"，并列出已搜索的 ref 范围
   - 安装目录元数据：owner/group/mode、`pack-provenance.json` 或等价 provenance 文件（若有）、README/LABEL 线索
2. **既有安装/资格收据**：安装目录及仓库内与 D 相关的 receipt/profile/bootstrap 证据（`scripts/trusted-cp-deploy-install.sh` 产出物位置、`deployment-artifacts/` 下相关 profile、registry history 中 D 的部署记录坐标）
3. **调用链**：谁实际调用 D 与 fleet runner
   - `launchctl print gui/502` 全列表中与 deploy/fleet/window 相关的项（原文摘录）
   - `ps` 抽样 3 次间隔 ≥60s 的相关进程树
   - 仓内脚本互调（grep D/ds_client/window-executor 的调用点，坐标）
4. **可达写入/重启路径清单**：从 D、ds_client、fleet runner 静态读出所有 write/restart/kill/bootout 类操作（函数名+行号坐标）；标注哪些需要 root、哪些有 mutex/journal 保护——只读清单，不执行
5. **loaded 资格与缺口结论**：installed bytes == source bytes？（可证则证，不可证 UNKNOWN）；loaded（正在运行的进程是否加载这些字节）UNKNOWN 如实保留；输出"条件④ Δ0 闭合还差什么"三行以内结论

## 硬边界

- 不修改任何 spec/accepted 权威/产品代码；PR 只含普查报告+简报
- 每个 EXISTS 判定带 `坐标`；不确定一律 UNKNOWN/PARTIAL，禁止推导
- 单轮交付；未完成如实 PARTIAL/STOPPED

## 工具指令（强制）

- Git/GitHub 只用 shell `git`/`gh`（`gh pr create --repo mayf3/dsh-agent-core --base main`）；**禁 MCP github 工具**
- 文件写入后 `wc -l` + `head -20` 自证落盘
- 注意 shell 代理变量：push 失败时 `env | grep -i proxy` 原文记入报告，然后停在该步并在最终输出说明"push 失败待监管传输"，不要反复重试
