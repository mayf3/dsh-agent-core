# BRIEF-ENTRY-BINDING — §6.5 实际入口绑定普查（Δ5 前置，只读）

## 授权与纪律

- 上游：accepted AGENT_CORE_FLEET_WINDOW_AUTHORITY_VALIDATION_V1（PR #686）+ 实施合并 PR #687（main，六类拒绝接线）；SRA-C-006 第 5 步"绑定实际入口版本/hash"
- **只读普查 + docs PR（不合并）**：生产写入=0、认证面调用=0、不执行任何 fleet-window/deploy 程序
- 只读允许：lstat/stat/shasum/read/ps（可 3 次间隔抽样）/launchctl print
- 失败语义：找不到=UNKNOWN 如实；工具持续不可用才 STOPPED

## 任务

交付 `ENTRY-BINDING-CENSUS.md`（repo 根）+ PR(base main) 不合并，四节：

1. **真实执行入口定位**：fleet-window 五文件（window-executor-v5.sh / window_helper_core.py / window_helper.py / window_preimage_xattr.py / window-selftest.py）在 main（417cc8ee+687=现 main HEAD）之外是否存在已安装/快照副本（搜索 /usr/local/libexec、/Library/LaunchDaemons、/Users/yanfenma/Library/LaunchAgents、workspace 内 checkout 的非 main 分支副本）。逐副本：路径/owner/mode/size/SHA256（观察时间 UTC+北京并列）+ 与 main 版本逐字节比较
2. **调用链**：谁调用这些脚本（launchd 项原文、仓内互调坐标、deploy 链 runbook 引用坐标）；若运行副本≠main 版本，指出该副本含/不含六类拒绝接线（grep 六类关键字/新函数名）
3. **fresh 撤销 reader 的运行时数据源**：实施代码读取的 registry/任命数据路径（文件坐标），该路径当前是否可读、是否为现行治理账（DISPATCH-REGISTRY.json 同源？）；不可读=UNKNOWN
4. **绑定结论**：实际入口=哪个副本；该副本是否已在校验接线路径上（YES/NO/UNKNOWN）；§6.5 效力判定还差哪几项（≤5 行）

## 工具指令（强制）

- 只用 shell git/gh；**禁 MCP github 工具**；写后自证落盘
- push 失败（代理 127.0.0.1:7890）：本地 commit + git bundle 交接 + 输出"待监管传输"，不重试
