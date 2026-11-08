# BRIEF-PERTARGET-SUCCESSOR-RECON — 23:50 槽 7 笔派发的逐目标后继对账（只读）

## 背景（监管已核）
- HR 自然槽 occ:ad1cabb44133294e（23:50）经受控通道派发 7 笔（全 agent_session_send，5 确认摄入/2 回执读取受限）
- 效率样本（938ecac8→efficiency）：目标摄入 ✓ → transition 尝试 → svc 422 "workflow assignment was not admitted"（request_id 4c08ab14）——admission 门按设计拒绝（派发目标 vs 实例 assignee 不匹配，幽灵时代遗留）
- 各目标 session.jsonl 为 uid502 属主，本会话可直读

## 任务（逐目标，同法）
对 7 笔派发的每个目标 agent（efficiency 已完成作样例）：
1. 读该目标 agent 的 session.jsonl（`/Users/authsvc/.agent-core/homes/<agent>/sessions/**/main/session.jsonl`，mtime > 2026-11-08T15:50Z 的活跃文件）
2. 提取：①派发消息摄入记录（Dispatch-ID 或任务正文命中）②其对派发实例的**具体动作**（fresh-read/transition 尝试/assistance case/其他）③动作结果（成功/错误码/被拒谓词原文）④实例当前业务状态线索
3. 特别记录：每笔的 **422/4xx 谓词原文 + request_id**（如 efficiency 样例）
4. 产出**逐笔后继状态表**：实例 / 派发目标 / 摄入 / 目标动作 / 结果 / 阻塞谓词 / 需要的对齐动作（assignee 过户/assistance resolve/其他）

## 特别项
- CTO 笔：fresh-read 后遇 `assistance_open` 残留 case——提取该 case 的 ID 与内容线索（映射 #1352 升级链）
- QA/build-in-public 笔：HR 标"回执读取受限"——查明其 session 是否有摄入记录（uid502 直读可能补上）
- message_ids：efficiency=401343aa…、QA=a548f9f8…、bip=d9da3ed6…、article-publisher=57daddf5…、CTO=4880e6c7…（其余两笔见 HR cron 会话 23:50 槽转录）

## 边界
只读；零生产写入；探索空结果≠失败；svc 权威状态无凭据则标 UNKNOWN+指明合法读取者；完成定义=`PERTARGET-SUCCESSOR-RECON.md` 逐笔表+证据坐标 → commit → push → PR(base main) 不合并
