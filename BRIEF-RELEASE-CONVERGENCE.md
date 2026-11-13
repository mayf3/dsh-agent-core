# BRIEF-RELEASE-CONVERGENCE — 生产实际加载包收敛与回滚组合核验（ITOps/QA 链，只读）

## 背景（Owner 指令三遗留项）
- 当前实际加载 pack = `08102a55`（provenance 实测，/usr/local/libexec/agent-core/app，runtime PID 16139）
- Owner 指令：核准实际加载的基础包及 overlay（`08102a55`、#1386 和 Gap B 差量），补全真实发布者、源码/制品/加载版本、精确回执及**能够加载当前持久状态的回滚组合**
- 现有服务健康且有实际工作（00:12 仍有真实 broker 执行），**禁止为补报告重复重启或发布**
- 旧版不能安全读取当前历史异常记录时，不得把旧版本直接当成可用回滚

## 任务（只读 + 分析）
1. **实际加载版本认证**：PID 16139 进程的实际加载来源核验（`ps` argv + app 目录 provenance + 进程启动时间对齐）——pack `08102a55` 是否就是当前进程加载的字节（provenance 是声明，加载认证需进程启动时间与 install mtime 对齐证据）
2. **overlay 差量清点**：#1386 与 Gap B 差量在当前 app 中的实际状态（哪些文件/哪些语义已在 08102a55 内、哪些是 overlay 形式）——与 deploy 链记录对账
3. **回滚组合矩阵**：对每个候选回滚版本（现役历史 pack），判定"能否安全加载当前持久状态"：
   - turn-recovery-v3.json 当前 schema/epoch 与旧版 reader 的兼容性（引用 D-STORE-QA-547 的窄容忍结论——旧版对 5 条异常记录的读取行为）
   - 明确"不可用回滚"清单及理由（如旧版会拒载当前 store）
4. **真实发布者记录**：08102a55 及各 overlay 的 install 操作者/授权依据（deploy 链记录；UNKNOWN 如实）
5. 产出**发布收敛核验表**：加载版本 ✓/✗、overlay 状态、回滚组合可用性矩阵、缺项清单

## 边界
只读 + 隔离分析（authsvc 属主 sudo 只读）；零生产写入（不重启/不发布/不清 fence/不改权限）；探索空结果≠失败；完成定义=`RELEASE-CONVERGENCE-547.md` → commit → push → PR(base main) 不合并；失败写 STOPPED-RELEASE-CONV.md
