# Stage 1 执行校验

检查时间：2026-11-07T16:00Z；基线 bb67ce5ae53908c299e751d3904793b9f4d08240。

- 文档与JSON暂存校验 `git diff --cached --check -- . ':!**/*.stdout.txt'`：rc0。完整默认check对原样保存的lsof comm尾空格返回rc2；原始stdout字节保留，不为通过格式检查改写证据。格式检查不等于磁盘清理验收。
- 79份JSON解析成功；3份本次metadata/汇总脚本 `ast.parse` 成功。未运行产品build/test/installer或受查脚本。
- 候选20项，精确路径唯一、无父子重叠、按allocated bytes降序；每项private payload <= allocation；当前保证回收0、实际释放0。
- Data主账单与APFS/df原始整数复核；顶层sum与根差8,192B；Data前后df变化单独保留。root别名视图与主账单分离。
- 原始错误未丢弃；permission-index.json索引1845条根线程stderr行，其他调查子域各自JSON完整保存错误。重复扫描的拒绝不相加成空间。
- 凭据模式扫描：边界匹配sk-/ghp_/github_pat_及Bearer长值，实际匹配0。该检查是本次输出检查，不保证穷尽所有Secret形式；未读取DB或认证文件正文。
- APFS属性返回mask已校验；候选全部无attribute unsupported记录。第三方/受保护路径仅metadata/容量；没有为了验证重建性而进行真实构建。

限制：活跃文件系统是分窗口观测；未冻结writer。完整Workflow/Mandate/rollback状态、native nightly创建链与部分权限面UNKNOWN。没有安全删除PASS，也未测真实删除后的df释放。独立审查覆盖本报告与证据的一致性，不代替未知权限面或后续生产/GC验收。
