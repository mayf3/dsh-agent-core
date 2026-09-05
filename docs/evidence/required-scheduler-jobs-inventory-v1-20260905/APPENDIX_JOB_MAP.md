# APPENDIX — OpenClaw cron per-job map (snapshot 2026-09-05T17:07:49+0800)

源：`~/.openclaw/cron/jobs.json` 只读解析。共 279 条（enabled 126 / disabled 153）。

| name | agent | enabled | schedule | lastRun(±14d) | candidate | disposition |
|---|---|---|---|---|---|---|
| workflow-dispatcher-hr-agent | hr-agent | true | every 0.5h | 2026-08-30✓ | M1-工作流唤醒派发 | MIGRATE |
| worklist-poller-learning-expert | learning-expert | true | every 1h | 2026-08-30✓ | M1-工作流唤醒派发 | MIGRATE |
| 播客-喜马拉雅每日搬运 | podcast-producer-agent | true | cron 0 10 * * * | 2026-08-30✓ | M10-播客流水线 | MIGRATE |
| 播客每日主题推荐 | podcast-producer-agent | true | cron 59 0 * * * | 2026-08-17 | M10-播客流水线 | MIGRATE |
| GitHub 公开仓库隐私泄露扫描 - 每日5:00 | open-source-agent | true | cron 0 5 * * * | 2026-08-30✓ | M11-GitHub泄露扫描 | MIGRATE |
| github-full-leak-scan | security-agent | true | cron 0 5 */3 * * | 2026-08-16 | M11-GitHub泄露扫描 | MIGRATE |
| 每周需求信号扫描 - 周一09:00 | biz-explorer | true | cron 12 3 * * 1 | 2026-08-17 | M12-需求调研族 | MIGRATE |
| 周一论坛调研 - Reddit + Dev.to/Hashnode | needs-radar-agent | true | cron 54 3 * * 1 | 2026-08-17 | M12-需求调研族 | MIGRATE |
| 周三论坛调研 - 知乎 + 36氪/少数派 | needs-radar-agent | true | cron 8 4 * * 3 | 2026-08-12 | M12-需求调研族 | MIGRATE |
| 周二论坛调研 - V2EX + CSDN/掘金 | needs-radar-agent | true | cron 1 4 * * 2 | 2026-08-11 | M12-需求调研族 | MIGRATE |
| 周五论坛调研 - 开源中国/SegmentFault + 头条/搜狐 | needs-radar-agent | true | cron 47 3 * * 5 | 2026-08-14 | M12-需求调研族 | MIGRATE |
| 周六付费意愿调研 - acquire.com/Flippa + 众筹平台 | needs-radar-agent | true | cron 0 10 * * 6 | NEVER | M12-需求调研族 | MIGRATE |
| 周内化 - needs-radar-agent | needs-radar-agent | true | cron 15 2 * * 6 | 2026-08-15 | M12-需求调研族 | MIGRATE |
| 周四论坛调研 - Reddit(技术) + Quora/Medium | needs-radar-agent | true | cron 15 4 * * 4 | 2026-08-13 | M12-需求调研族 | MIGRATE |
| 周日主动发帖需求挖掘 - r/SomebodyMakeThis + HN Ask HN  | needs-radar-agent | true | cron 0 10 * * 0 | 2026-08-30✓ | M12-需求调研族 | MIGRATE |
| 应用检查 - needs-radar-agent | needs-radar-agent | true | cron 45 2 1,15 * * | 2026-08-15 | M12-需求调研族 | MIGRATE |
| 每日管线方向审核 | ceo-agent | true | cron 6 1 * * * | 2026-08-17 | M13-Owner管线监督 | MIGRATE |
| 龙虾合伙人每周待办回顾 + 主线偏差检查 | ceo-agent | true | cron 0 2 * * 6 | 2026-08-15 | M13-Owner管线监督 | MIGRATE |
| 每日员工档案同步 - 凌晨 | hr-agent | true | cron 50 0 * * * | 2026-08-30✓ | M2-HR档案同步 | MIGRATE |
| 每日任务早报 - 凌晨4:10（Broker版） | efficiency-agent | true | cron 10 4 * * * | 2026-08-30✓ | M3-每日任务早报 | MIGRATE |
| 每日随想素材检测 + 触发文章工作流 | blog-agent | true | cron 7 0 * * * | 2026-08-30✓ | M4-博客随想流水线 | MIGRATE |
| 每日随想总结 - 22点 | daily-thought-agent | true | cron 22 4 * * * | 2026-08-30✓ | M4-博客随想流水线 | MIGRATE |
| 周内化 - stock-agent | stock-agent | true | cron 15 3 * * 6 | 2026-08-15 | M5-stock-agent割接包 | MIGRATE |
| 商业分析每日学习 | stock-agent | true | cron 20 1 */2 * * | 2026-08-30✓ | M5-stock-agent割接包 | MIGRATE |
| 应用检查 - stock-agent | stock-agent | true | cron 00 4 1,15 * * | 2026-08-17 | M5-stock-agent割接包 | MIGRATE |
| 每周一收盘后更新股票价格跟踪 | stock-agent | true | cron 40 3 * * 1 | 2026-08-17 | M5-stock-agent割接包 | MIGRATE |
| 每日市场简报 - AI/科技/指数行情 | stock-agent | false | cron 44 2 * * 1-5 | 2026-08-17 | M5-stock-agent割接包 | MIGRATE |
| 股票分析学习 | stock-agent | true | cron 25 1 * * * | 2026-08-30✓ | M5-stock-agent割接包 | MIGRATE |
| 论坛动态调度器 v6（Agent 侧） | course-community-agent-2 | true | every 1h | 2026-08-30✓ | M6-论坛动态与周报 | MIGRATE |
| 论坛版主每周报告 - 论坛健康度周报 | course-community-agent-2 | true | cron 30 9 * * 0 | 2026-08-30✓ | M6-论坛动态与周报 | MIGRATE |
| Wiki 周度 Synthesis 编译 - 周日5:30 | knowledge-curator-agent | true | cron 52 0 * * 0 | 2026-08-17 | M7-Wiki维护族 | MIGRATE |
| Wiki 日度审查 - 每天凌晨5点 | knowledge-curator-agent | true | cron 27 4 * * * | 2026-08-30✓ | M7-Wiki维护族 | MIGRATE |
| Wiki 月度全量审计 - 每月1号5点 | knowledge-curator-agent | true | cron 0 5 1 * * | 2026-08-01 | M7-Wiki维护族 | MIGRATE |
| wiki-executor | knowledge-curator-agent | true | every 4h | 2026-08-30✓ | M7-Wiki维护族 | MIGRATE |
| 家庭医生每周健康回顾与建议 - 每周日9:00 | family-doctor-2-agent | true | cron 31 0 * * 0 | 2026-08-16 | M8-家庭提醒与健康 | MIGRATE |
| 家庭医生每日健康知识学习 （每3天） | family-doctor-2-agent | true | cron 30 1 */3 * * | 2026-08-16 | M8-家庭提醒与健康 | MIGRATE |
| 家庭月度健康回顾提醒 - 每月1日9:00 | family-doctor-2-agent | true | cron 42 0 1 * * | 2026-08-01 | M8-家庭提醒与健康 | MIGRATE |
| 欢欢腰突第6周复诊评估提醒 | family-doctor-2-agent | true | at 2026-09-07T01:00 | NEVER | M8-家庭提醒与健康 | MIGRATE |
| 购物清单每日提醒 - 早上8:00 | shopping-list-agent | true | cron 9 2 * * * | 2026-08-30✓ | M8-家庭提醒与健康 | MIGRATE |
| 每日数学练习生成+打印（教育顾问版）- 早上10:00 | 3d-print-agent | true | cron 0 10 * * * | 2026-08-30✓ | M9-数学练习打印 | MIGRATE |
| stagnation-alert | hr-agent | false | at 2026-08-30T11:15 | 2026-08-30✓ | RETIRE-disabled | RETIRE |
| podcast-prepare-topics | ? | false | cron 45 6 * * * | 2026-07-06 | RETIRE-disabled-longtail | RETIRE |
| voice-tech-daily-learning | ? | false | cron 30 9 */2 * * | 2026-07-07 | RETIRE-disabled-longtail | RETIRE |
| 产品经理-项目产品边界巡检-每小时 | ? | false | cron 0 8 * * * | 2026-06-20 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - agent-dev-engineer | agent-dev-engineer | false | at 2026-08-16T15:24 | 2026-08-16 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - agent-dev-engineer | agent-dev-engineer | false | at 2026-08-16T18:26 | 2026-08-17 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - agent-dev-engineer | agent-dev-engineer | false | at 2026-08-16T20:27 | 2026-08-17 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - agent-dev-engineer | agent-dev-engineer | false | at 2026-08-17T00:28 | 2026-08-17 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - agent-dev-engineer | agent-dev-engineer | false | at 2026-08-17T03:30 | 2026-08-17 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - agent-dev-engineer | agent-dev-engineer | false | at 2026-08-17T07:31 | 2026-08-17 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - agent-dev-engineer | agent-dev-engineer | false | at 2026-08-17T09:32 | 2026-08-17 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - agent-dev-engineer | agent-dev-engineer | false | at 2026-08-17T16:33 | 2026-08-18 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - agent-dev-engineer | agent-dev-engineer | false | at 2026-08-17T19:34 | 2026-08-18 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - agent-dev-engineer | agent-dev-engineer | false | at 2026-08-17T20:35 | 2026-08-18 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - agent-dev-engineer | agent-dev-engineer | false | at 2026-08-17T22:35 | 2026-08-18 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - agent-dev-engineer | agent-dev-engineer | false | at 2026-08-17T23:36 | 2026-08-18 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - agent-dev-engineer | agent-dev-engineer | false | at 2026-08-18T04:45 | 2026-08-18 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - arch-reviewer | arch-reviewer | false | at 2026-08-16T15:26 | 2026-08-16 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - arch-reviewer | arch-reviewer | false | at 2026-08-16T18:28 | 2026-08-17 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - arch-reviewer | arch-reviewer | false | at 2026-08-16T20:29 | 2026-08-17 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - arch-reviewer | arch-reviewer | false | at 2026-08-17T00:30 | 2026-08-17 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - arch-reviewer | arch-reviewer | false | at 2026-08-17T03:32 | 2026-08-17 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - arch-reviewer | arch-reviewer | false | at 2026-08-17T07:33 | 2026-08-17 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - arch-reviewer | arch-reviewer | false | at 2026-08-17T09:34 | 2026-08-17 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - arch-reviewer | arch-reviewer | false | at 2026-08-17T16:35 | 2026-08-18 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - arch-reviewer | arch-reviewer | false | at 2026-08-17T19:36 | 2026-08-18 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - arch-reviewer | arch-reviewer | false | at 2026-08-17T20:37 | 2026-08-18 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - arch-reviewer | arch-reviewer | false | at 2026-08-17T22:37 | 2026-08-18 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - arch-reviewer | arch-reviewer | false | at 2026-08-17T23:38 | 2026-08-18 | RETIRE-disabled-longtail | RETIRE |
| workflow-dispatch-article-publisher-agent | article-publisher-agent | false | at 2026-08-29T23:36 | 2026-08-30✓ | RETIRE-disabled-longtail | RETIRE |
| workflow-dispatch-article-publisher-agent-17 | article-publisher-agent | false | at 2026-08-16T15:38 | 2026-08-16 | RETIRE-disabled-longtail | RETIRE |
| workflow-dispatch-article-publisher-agent-17 | article-publisher-agent | false | at 2026-08-16T18:39 | 2026-08-17 | RETIRE-disabled-longtail | RETIRE |
| workflow-dispatch-article-publisher-agent-17 | article-publisher-agent | false | at 2026-08-16T22:40 | 2026-08-17 | RETIRE-disabled-longtail | RETIRE |
| workflow-dispatch-article-publisher-agent-17 | article-publisher-agent | false | at 2026-08-17T02:41 | 2026-08-17 | RETIRE-disabled-longtail | RETIRE |
| workflow-dispatch-article-publisher-agent-17 | article-publisher-agent | false | at 2026-08-17T08:42 | 2026-08-17 | RETIRE-disabled-longtail | RETIRE |
| workflow-dispatch-article-publisher-agent-17 | article-publisher-agent | false | at 2026-08-17T16:14 | 2026-08-18 | RETIRE-disabled-longtail | RETIRE |
| workflow-dispatch-article-publisher-agent-17 | article-publisher-agent | false | at 2026-08-17T19:15 | 2026-08-18 | RETIRE-disabled-longtail | RETIRE |
| workflow-dispatch-article-publisher-agent-17 | article-publisher-agent | false | at 2026-08-17T23:16 | 2026-08-18 | RETIRE-disabled-longtail | RETIRE |
| workflow-dispatch-blog-agent-1786955237 | blog-agent | false | at 2026-08-17T08:42 | 2026-08-17 | RETIRE-disabled-longtail | RETIRE |
| workflow-dispatch-blog-agent-1786984183 | blog-agent | false | at 2026-08-17T16:44 | 2026-08-18 | RETIRE-disabled-longtail | RETIRE |
| workflow-dispatch-blog-agent-1786991414 | blog-agent | false | at 2026-08-17T18:45 | 2026-08-18 | RETIRE-disabled-longtail | RETIRE |
| workflow-dispatch-blog-agent-1787007657 | blog-agent | false | at 2026-08-17T23:15 | 2026-08-18 | RETIRE-disabled-longtail | RETIRE |
| 夜间自动审稿 - 第1轮 (00:00) | blog-agent | false | cron 0 0 * * * | 2026-08-07 | RETIRE-disabled-longtail | RETIRE |
| 夜间自动审稿 - 第2轮 (01:00) | blog-agent | false | cron 0 1 * * * | 2026-08-08 | RETIRE-disabled-longtail | RETIRE |
| 夜间自动审稿 - 第3轮 (02:00) | blog-agent | false | cron 0 2 * * * | 2026-08-07 | RETIRE-disabled-longtail | RETIRE |
| 夜间自动审稿 - 第4轮 (03:00) | blog-agent | false | cron 0 3 * * * | 2026-08-07 | RETIRE-disabled-longtail | RETIRE |
| 夜间自动审稿 - 第5轮 (04:00) | blog-agent | false | cron 0 4 * * * | 2026-05-12 | RETIRE-disabled-longtail | RETIRE |
| 夜间自动审稿 - 第6轮 (05:00) | blog-agent | false | cron 0 5 * * * | 2026-08-07 | RETIRE-disabled-longtail | RETIRE |
| 夜间自动审稿 - 第7轮 (06:00) | blog-agent | false | cron 1 0 * * * | 2026-08-07 | RETIRE-disabled-longtail | RETIRE |
| 夜间自动审稿 - 第8轮 (07:00) | blog-agent | false | cron 13 1 * * * | 2026-08-08 | RETIRE-disabled-longtail | RETIRE |
| bip-5709a28e-进度巡查 | build-in-public-agent | false | at 2026-08-16T14:10 | 2026-08-16 | RETIRE-disabled-longtail | RETIRE |
| bip-domain-scheduler | build-in-public-agent | false | every 1h | 2026-08-04 | RETIRE-disabled-longtail | RETIRE |
| 刹车系统-早间主任务确认 | ceo-agent | false | cron 0 9 * * * | 2026-08-18 | RETIRE-disabled-longtail | RETIRE |
| 刹车系统-晚间三问 | ceo-agent | false | cron 0 21 * * * | 2026-08-30✓ | RETIRE-disabled-longtail | RETIRE |
| 论坛动态调度器 - 扫描通知并触发相关 Agent | course-community-agent-2 | false | every 1h | 2026-08-11 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - course-community-agent-2 | course-community-agent-2 | false | at 2026-08-16T12:27 | 2026-08-16 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - course-community-agent-2 | course-community-agent-2 | false | at 2026-08-16T15:28 | 2026-08-16 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - course-community-agent-2 | course-community-agent-2 | false | at 2026-08-16T18:30 | 2026-08-17 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - course-community-agent-2 | course-community-agent-2 | false | at 2026-08-16T20:31 | 2026-08-17 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - course-community-agent-2 | course-community-agent-2 | false | at 2026-08-17T02:29 | 2026-08-17 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - course-community-agent-2 | course-community-agent-2 | false | at 2026-08-17T03:34 | 2026-08-17 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - course-community-agent-2 | course-community-agent-2 | false | at 2026-08-17T07:35 | 2026-08-17 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - course-community-agent-2 | course-community-agent-2 | false | at 2026-08-17T09:36 | 2026-08-17 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - course-community-agent-2 | course-community-agent-2 | false | at 2026-08-17T16:37 | 2026-08-18 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - course-community-agent-2 | course-community-agent-2 | false | at 2026-08-17T19:38 | 2026-08-18 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - course-community-agent-2 | course-community-agent-2 | false | at 2026-08-17T20:39 | 2026-08-18 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - course-community-agent-2 | course-community-agent-2 | false | at 2026-08-17T22:39 | 2026-08-18 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - course-community-agent-2 | course-community-agent-2 | false | at 2026-08-17T23:41 | 2026-08-18 | RETIRE-disabled-longtail | RETIRE |
| at-job-freeze-probe-cto-0425 | cto-agent | false | at 2026-08-29T20:25 | 2026-08-30✓ | RETIRE-disabled-longtail | RETIRE |
| workflow-dispatch-cto-agent | cto-agent | false | at 2026-08-29T23:36 | 2026-08-30✓ | RETIRE-disabled-longtail | RETIRE |
| workflow-dispatch-cto-agent-1786955220 | cto-agent | false | at 2026-08-17T08:42 | 2026-08-17 | RETIRE-disabled-longtail | RETIRE |
| workflow-dispatch-cto-agent-1786984162 | cto-agent | false | at 2026-08-17T16:44 | 2026-08-18 | RETIRE-disabled-longtail | RETIRE |
| workflow-dispatch-cto-agent-1786991397 | cto-agent | false | at 2026-08-17T18:44 | 2026-08-18 | RETIRE-disabled-longtail | RETIRE |
| workflow-dispatch-cto-agent-1787007638 | cto-agent | false | at 2026-08-17T23:15 | 2026-08-18 | RETIRE-disabled-longtail | RETIRE |
| 每日创意灵感清单 - 早上7点 | education-agent | false | cron 45 0 * * * | 2026-07-09 | RETIRE-disabled-longtail | RETIRE |
| ⏰ 定时任务测试 - 15分钟后 | efficiency-agent | false | at 2026-08-27T14:27 | 2026-08-30✓ | RETIRE-disabled-longtail | RETIRE |
| 余额定时查询 | finance-agent | false | cron 1 */5 * * * | NEVER | RETIRE-disabled-longtail | RETIRE |
| game-dev-domain-scheduler | game-producer-agent | false | every 1h | 2026-08-04 | RETIRE-disabled-longtail | RETIRE |
| hr-unified-dispatcher | hr-agent | false | every 1h | 2026-08-07 | RETIRE-disabled-longtail | RETIRE |
| legacy-runner-catch | hr-agent | false | at 2026-08-29T20:16 | 2026-08-30✓ | RETIRE-disabled-longtail | RETIRE |
| 群头像批量更新 - 夜间23点至早上9点每小时执行（直到全部完成） | hr-agent | false | cron 0 23,0-8 * * * | NEVER | RETIRE-disabled-longtail | RETIRE |
| rhythm-verification-probe-0705 | itops-agent | false | at 2026-08-29T23:05 | 2026-08-30✓ | RETIRE-disabled-longtail | RETIRE |
| workflow-dispatch-itops-agent | itops-agent | false | at 2026-08-29T23:36 | 2026-08-30✓ | RETIRE-disabled-longtail | RETIRE |
| workflow-dispatch-itops-agent-1786893783 | itops-agent | false | at 2026-08-16T15:38 | 2026-08-16 | RETIRE-disabled-longtail | RETIRE |
| workflow-dispatch-itops-agent-1786904661 | itops-agent | false | at 2026-08-16T18:39 | 2026-08-17 | RETIRE-disabled-longtail | RETIRE |
| workflow-dispatch-itops-agent-1786919110 | itops-agent | false | at 2026-08-16T22:40 | 2026-08-17 | RETIRE-disabled-longtail | RETIRE |
| workflow-dispatch-itops-agent-1786933549 | itops-agent | false | at 2026-08-17T02:40 | 2026-08-17 | RETIRE-disabled-longtail | RETIRE |
| workflow-dispatch-itops-agent-1786955224 | itops-agent | false | at 2026-08-17T08:42 | 2026-08-17 | RETIRE-disabled-longtail | RETIRE |
| workflow-dispatch-itops-agent-1786984168 | itops-agent | false | at 2026-08-17T16:44 | 2026-08-18 | RETIRE-disabled-longtail | RETIRE |
| workflow-dispatch-itops-agent-1786991401 | itops-agent | false | at 2026-08-17T18:45 | 2026-08-18 | RETIRE-disabled-longtail | RETIRE |
| workflow-dispatch-itops-agent-1787007643 | itops-agent | false | at 2026-08-17T23:15 | 2026-08-18 | RETIRE-disabled-longtail | RETIRE |
| LLM Wiki 逐条编译 - 每小时 | knowledge-curator-agent | false | cron 20 3 * * * | 2026-08-02 | RETIRE-disabled-longtail | RETIRE |
| wiki-dispatcher | knowledge-curator-agent | false | every 1h | 2026-08-04 | RETIRE-disabled-longtail | RETIRE |
| wiki-pull-daily-thoughts | knowledge-curator-agent | false | cron 50 5 * * * | 2026-08-02 | RETIRE-disabled-longtail | RETIRE |
| workflow-dispatch-knowledge-curator-agent | knowledge-curator-agent | false | at 2026-08-29T23:36 | 2026-08-30✓ | RETIRE-disabled-longtail | RETIRE |
| 跨域综合桥接 - 每天13点 | knowledge-curator-agent | false | cron 0 13 * * * | NEVER | RETIRE-disabled-longtail | RETIRE |
| 学习复习卡片推送 - 每天早上9点 | learning-expert | false | cron 0 9 * * * | 2026-07-22 | RETIRE-disabled-longtail | RETIRE |
| 学习流水线监督 - 每天9:30 | learning-expert | false | cron 30 9 * * * | 2026-07-23 | RETIRE-disabled-longtail | RETIRE |
| 周内化 - lobster-agent | lobster-agent | false | cron 30 1 * * 6 | 2026-07-04 | RETIRE-disabled-longtail | RETIRE |
| 应用检查 - lobster-agent | lobster-agent | false | cron 51 1 1,15 * * | 2026-07-01 | RETIRE-disabled-longtail | RETIRE |
| 龙虾进化助手每日学习 - 凌晨1:30 | lobster-agent | false | cron 0 5 */2 * * | 2026-07-07 | RETIRE-disabled-longtail | RETIRE |
| 论文逐句溯源审稿 - 夜间23点-09点每小时 | paper-reviewer-agent | false | cron 0 23,0-8 * * * | NEVER | RETIRE-disabled-longtail | RETIRE |
| 播客-发起Review | podcast-producer-agent | false | cron 0 10 * * * | 2026-07-16 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - product-manager | product-manager | false | at 2026-08-16T12:29 | 2026-08-16 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - product-manager | product-manager | false | at 2026-08-16T16:25 | 2026-08-17 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - product-manager | product-manager | false | at 2026-08-16T20:33 | 2026-08-17 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - product-manager | product-manager | false | at 2026-08-17T00:32 | 2026-08-17 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - product-manager | product-manager | false | at 2026-08-17T03:36 | 2026-08-17 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - product-manager | product-manager | false | at 2026-08-17T07:37 | 2026-08-17 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - product-manager | product-manager | false | at 2026-08-17T09:38 | 2026-08-17 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - product-manager | product-manager | false | at 2026-08-17T16:39 | 2026-08-18 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - product-manager | product-manager | false | at 2026-08-17T20:41 | 2026-08-18 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - product-manager | product-manager | false | at 2026-08-17T22:41 | 2026-08-18 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - product-manager | product-manager | false | at 2026-08-17T23:43 | 2026-08-18 | RETIRE-disabled-longtail | RETIRE |
| 论文改写净化循环 - 夜间23点-09点 + 中午12点-17点 | psychology-agent | false | cron 0 23,0-8,12-16 * * * | NEVER | RETIRE-disabled-longtail | RETIRE |
| qa-reviewer-weekly-summary | qa-reviewer | false | cron 30 1 * * * | 2026-06-20 | RETIRE-disabled-longtail | RETIRE |
| workflow-dispatch-qa-reviewer-1786895613 | qa-reviewer | false | at 2026-08-16T16:08 | 2026-08-17 | RETIRE-disabled-longtail | RETIRE |
| workflow-dispatch-qa-reviewer-1786902848 | qa-reviewer | false | at 2026-08-16T18:09 | 2026-08-17 | RETIRE-disabled-longtail | RETIRE |
| workflow-dispatch-qa-reviewer-1786919104 | qa-reviewer | false | at 2026-08-16T22:40 | 2026-08-17 | RETIRE-disabled-longtail | RETIRE |
| workflow-dispatch-qa-reviewer-1786933544 | qa-reviewer | false | at 2026-08-17T02:40 | 2026-08-17 | RETIRE-disabled-longtail | RETIRE |
| workflow-dispatch-qa-reviewer-1786955228 | qa-reviewer | false | at 2026-08-17T08:42 | 2026-08-17 | RETIRE-disabled-longtail | RETIRE |
| workflow-dispatch-qa-reviewer-1786984173 | qa-reviewer | false | at 2026-08-17T16:44 | 2026-08-18 | RETIRE-disabled-longtail | RETIRE |
| workflow-dispatch-qa-reviewer-1786991406 | qa-reviewer | false | at 2026-08-17T18:45 | 2026-08-18 | RETIRE-disabled-longtail | RETIRE |
| workflow-dispatch-qa-reviewer-1787007647 | qa-reviewer | false | at 2026-08-17T23:15 | 2026-08-18 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - qa-reviewer | qa-reviewer | false | at 2026-08-16T15:31 | 2026-08-16 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - qa-reviewer | qa-reviewer | false | at 2026-08-16T18:32 | 2026-08-17 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - qa-reviewer | qa-reviewer | false | at 2026-08-16T20:27 | 2026-08-17 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - qa-reviewer | qa-reviewer | false | at 2026-08-17T00:35 | 2026-08-17 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - qa-reviewer | qa-reviewer | false | at 2026-08-17T03:31 | 2026-08-17 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - qa-reviewer | qa-reviewer | false | at 2026-08-17T07:32 | 2026-08-17 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - qa-reviewer | qa-reviewer | false | at 2026-08-17T09:32 | 2026-08-17 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - qa-reviewer | qa-reviewer | false | at 2026-08-17T16:33 | 2026-08-18 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - qa-reviewer | qa-reviewer | false | at 2026-08-17T19:40 | 2026-08-18 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - qa-reviewer | qa-reviewer | false | at 2026-08-17T20:35 | 2026-08-18 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - qa-reviewer | qa-reviewer | false | at 2026-08-17T22:36 | 2026-08-18 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - qa-reviewer | qa-reviewer | false | at 2026-08-17T23:37 | 2026-08-18 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - qa-reviewer | qa-reviewer | false | at 2026-08-18T04:46 | 2026-08-18 | RETIRE-disabled-longtail | RETIRE |
| 论坛通知触发 - qa-reviewer | qa-reviewer | false | at 2026-08-18T05:48 | 2026-08-30✓ | RETIRE-disabled-longtail | RETIRE |
| workflow-dispatch-test-engineer-1786897437 | test-engineer | false | at 2026-08-16T16:38 | 2026-08-17 | RETIRE-disabled-longtail | RETIRE |
| workflow-dispatch-test-engineer-1786919114 | test-engineer | false | at 2026-08-16T22:40 | 2026-08-17 | RETIRE-disabled-longtail | RETIRE |
| workflow-dispatch-test-engineer-1786933553 | test-engineer | false | at 2026-08-17T02:40 | 2026-08-17 | RETIRE-disabled-longtail | RETIRE |
| workflow-dispatch-test-engineer-1786955233 | test-engineer | false | at 2026-08-17T08:42 | 2026-08-17 | RETIRE-disabled-longtail | RETIRE |
| workflow-dispatch-test-engineer-1786984178 | test-engineer | false | at 2026-08-17T16:44 | 2026-08-18 | RETIRE-disabled-longtail | RETIRE |
| workflow-dispatch-test-engineer-1786991410 | test-engineer | false | at 2026-08-17T18:45 | 2026-08-18 | RETIRE-disabled-longtail | RETIRE |
| workflow-dispatch-test-engineer-1787007652 | test-engineer | false | at 2026-08-17T23:15 | 2026-08-18 | RETIRE-disabled-longtail | RETIRE |
| workflow-dispatch-thesis-advisor-agent | thesis-advisor-agent | false | at 2026-08-29T23:36 | 2026-08-30✓ | RETIRE-disabled-longtail | RETIRE |
| NumberBlocks Supervisor - 每2小时监督 | voice-tech-agent | false | cron 0 */2 * * * | 2026-04-30 | RETIRE-disabled-longtail | RETIRE |
| NumberBlocks Worker - 每30分钟干活 | voice-tech-agent | false | cron */30 * * * * | 2026-04-30 | RETIRE-disabled-longtail | RETIRE |
| workflow-dispatch-writing-style-analyst-agen | writing-style-analyst-agen | false | at 2026-08-16T16:08 | 2026-08-17 | RETIRE-disabled-longtail | RETIRE |
| workflow-dispatch-writing-style-analyst-agen | writing-style-analyst-agen | false | at 2026-08-16T22:40 | 2026-08-17 | RETIRE-disabled-longtail | RETIRE |
| workflow-dispatch-writing-style-analyst-agen | writing-style-analyst-agen | false | at 2026-08-17T02:41 | 2026-08-17 | RETIRE-disabled-longtail | RETIRE |
| 每日服务健康巡检 - 早上6:30 | itops-agent | true | every 24h | 2026-08-30✓ | RETIRE-dup-healthcheck | RETIRE |
| 每日商业化落地尝试方案 - 凌晨2点 | biz-explorer | true | cron 40 0 * * * | 2026-08-30✓ | RETIRE-lifestyle-content | RETIRE |
| content-ops-weekly-report-push | content-ops-agent | true | cron 16 2 * * 0 | 2026-08-30✓ | RETIRE-lifestyle-content | RETIRE |
| platform-data-api-daily | content-ops-agent | true | cron 2 2 * * * | 2026-08-30✓ | RETIRE-lifestyle-content | RETIRE |
| platform-data-weekly-summary | content-ops-agent | true | every 24h | 2026-08-30✓ | RETIRE-lifestyle-content | RETIRE |
| 每日羊毛扫描 | hao-yang-mao-agent | true | cron 0 9 * * * | 2026-08-30✓ | RETIRE-lifestyle-content | RETIRE |
| qa-reviewer-daily-learning | qa-reviewer | true | cron 0 3 */2 * * | 2026-08-17 | RETIRE-lifestyle-content | RETIRE |
| 核心 Skill 轮流优化 - 凌晨2:10 | research-agent | true | cron 7 3 * * 0 | 2026-08-17 | RETIRE-lifestyle-content | RETIRE |
| test-engineer-daily-learning-001 | test-engineer | true | every 24h | 2026-08-30✓ | RETIRE-lifestyle-content | RETIRE |
| test-engineer-weekly-review | test-engineer | true | cron 23 2 * * 0 | 2026-08-30✓ | RETIRE-lifestyle-content | RETIRE |
| 旅游规划周末推荐 - 周四下午3点 | travel-planner-agent | true | cron 58 2 * * 4 | 2026-08-13 | RETIRE-lifestyle-content | RETIRE |
| 旅游规划每日推荐 - 轮转7主题+去重 | travel-planner-agent | true | cron 35 1 * * * | 2026-08-17 | RETIRE-lifestyle-content | RETIRE |
| 前沿观察 - 每周Review与报告（每周一10点） | trend-tracker | true | cron 34 1 * * 1 | 2026-08-17 | RETIRE-lifestyle-content | RETIRE |
| PPT设计师双周应用检查 | ? | true | cron 45 4 1,15 * * | 2026-08-15 | RETIRE-meta-learning | RETIRE |
| PPT设计师周内化 | ? | true | cron 00 0 * * 0 | 2026-08-17 | RETIRE-meta-learning | RETIRE |
| PPT设计师每日学习 | ? | true | cron 25 0 */2 * * | 2026-08-30✓ | RETIRE-meta-learning | RETIRE |
| 周内化 - article-publisher-agent | article-publisher-agent | true | cron 30 0 * * 0 | 2026-08-16 | RETIRE-meta-learning | RETIRE |
| 应用检查 - article-publisher-agent | article-publisher-agent | true | cron 00 0 1,15 * * | 2026-08-17 | RETIRE-meta-learning | RETIRE |
| 运营周总结 + Skill更新 - 每周日凌晨4点 | article-publisher-agent | true | cron 0 4 * * 0 | 2026-08-30✓ | RETIRE-meta-learning | RETIRE |
| 周内化 - biz-explorer | biz-explorer | true | cron 15 0 * * 6 | 2026-08-17 | RETIRE-meta-learning | RETIRE |
| 应用检查 - biz-explorer | biz-explorer | true | cron 15 0 1,15 * * | 2026-08-17 | RETIRE-meta-learning | RETIRE |
| 每周学用回顾 - 周六10:00 | biz-explorer | true | cron 51 2 * * 6 | 2026-08-15 | RETIRE-meta-learning | RETIRE |
| 每日商业化案例学习与分析 - 凌晨2:30 （每3天） | biz-explorer | true | cron 30 1 */3 * * | 2026-08-16 | RETIRE-meta-learning | RETIRE |
| 写作技巧学习 - 每日凌晨3点 （每周日凌晨） | blog-agent | true | cron 0 2 * * 0 | 2026-08-30✓ | RETIRE-meta-learning | RETIRE |
| 周内化 - blog-agent | blog-agent | true | cron 00 1 * * 0 | 2026-08-16 | RETIRE-meta-learning | RETIRE |
| 应用检查 - blog-agent | blog-agent | true | cron 30 0 1,15 * * | 2026-08-17 | RETIRE-meta-learning | RETIRE |
| 周内化 - book-deconstructor-agent | book-deconstructor-agent | true | cron 45 4 * * 6 | 2026-08-15 | RETIRE-meta-learning | RETIRE |
| 应用检查 - book-deconstructor-agent | book-deconstructor-agent | true | cron 45 0 1,15 * * | 2026-08-17 | RETIRE-meta-learning | RETIRE |
| 每日拆书学习 - 凌晨4:30 | book-deconstructor-agent | true | cron 30 4 * * * | 2026-08-30✓ | RETIRE-meta-learning | RETIRE |
| Build in Public 学习 — 每2天凌晨 | build-in-public-agent | true | cron 30 1 */2 * * | 2026-08-17 | RETIRE-meta-learning | RETIRE |
| 周内化 - ceo-agent | ceo-agent | true | cron 30 1 * * 0 | 2026-08-16 | RETIRE-meta-learning | RETIRE |
| 应用检查 - ceo-agent | ceo-agent | true | cron 00 1 1,15 * * | 2026-08-15 | RETIRE-meta-learning | RETIRE |
| 每日随想战略分析 - 凌晨2点 | ceo-agent | true | cron 4 4 * * * | 2026-08-30✓ | RETIRE-meta-learning | RETIRE |
| 龙虾合伙人每日自我学习 | ceo-agent | true | cron 40 2 */2 * * | 2026-08-17 | RETIRE-meta-learning | RETIRE |
| 内容运营学习 - 凌晨2:22 （每周一凌晨） | content-ops-agent | true | cron 0 4 * * 1 | 2026-08-17 | RETIRE-meta-learning | RETIRE |
| 周内化 - content-ops-agent | content-ops-agent | true | cron 00 2 * * 0 | 2026-08-30✓ | RETIRE-meta-learning | RETIRE |
| 应用检查 - content-ops-agent | content-ops-agent | true | cron 15 1 1,15 * * | 2026-08-15 | RETIRE-meta-learning | RETIRE |
| 周内化 - course-community-agent | course-community-agent | true | cron 45 0 * * 6 | 2026-08-17 | RETIRE-meta-learning | RETIRE |
| 应用检查 - course-community-agent | course-community-agent | true | cron 30 1 1,15 * * | 2026-08-15 | RETIRE-meta-learning | RETIRE |
| 社群运营方法学习 - 每2天凌晨 | course-community-agent | true | cron 30 0 */2 * * | 2026-08-30✓ | RETIRE-meta-learning | RETIRE |
| 交付复盘方法论学习 - 每2天凌晨 | delivery-review-agent | true | cron 15 0 */2 * * | 2026-08-30✓ | RETIRE-meta-learning | RETIRE |
| 周内化 - delivery-review-agent | delivery-review-agent | true | cron 15 1 * * 6 | 2026-08-15 | RETIRE-meta-learning | RETIRE |
| 应用检查 - delivery-review-agent | delivery-review-agent | true | cron 45 1 1,15 * * | 2026-08-17 | RETIRE-meta-learning | RETIRE |
| 周内化 - education-agent | education-agent | true | cron 30 2 * * 0 | 2026-08-16 | RETIRE-meta-learning | RETIRE |
| 应用检查 - education-agent | education-agent | true | cron 00 2 1,15 * * | 2026-08-15 | RETIRE-meta-learning | RETIRE |
| 每日教育学习 - 凌晨5:44 | education-agent | true | cron 11 0 */2 * * | 2026-08-30✓ | RETIRE-meta-learning | RETIRE |
| 周内化 - efficiency-agent | efficiency-agent | true | cron 00 3 * * 0 | 2026-08-17 | RETIRE-meta-learning | RETIRE |
| 应用检查 - efficiency-agent | efficiency-agent | true | cron 15 2 1,15 * * | 2026-08-15 | RETIRE-meta-learning | RETIRE |
| 效率方法论夜间学习 - 凌晨2点 （每周日凌晨） | efficiency-agent | true | cron 0 1 * * 0 | 2026-08-16 | RETIRE-meta-learning | RETIRE |
| 探索家每日学习 - 凌晨5:33 | explorer | true | cron 33 5 */2 * * | 2026-08-17 | RETIRE-meta-learning | RETIRE |
| 每日学习-家庭财务 | finance-housekeeper-agent | true | cron 19 0 */2 * * | 2026-08-30✓ | RETIRE-meta-learning | RETIRE |
| 求职情报官每日学习 — 凌晨2点 每2天 | job-watch-agent | true | cron 15 2 */2 * * | 2026-08-17 | RETIRE-meta-learning | RETIRE |
| 周内化 - learning-expert | learning-expert | true | cron 45 1 * * 6 | 2026-08-17 | RETIRE-meta-learning | RETIRE |
| 学习评分卡日报 - 每天8:30 | learning-expert | true | cron 37 2 * * * | 2026-08-18 | RETIRE-meta-learning | RETIRE |
| 每日学习：Agent时代人类学习方法论 - 凌晨1:17 （每周日凌晨） | learning-expert | true | cron 0 4 * * 0 | 2026-08-30✓ | RETIRE-meta-learning | RETIRE |
| 龙虾进化日报 - 每天10:00 | lobster-agent | true | cron 27 1 * * * | 2026-08-17 | RETIRE-meta-learning | RETIRE |
| 需求雷达学习方法论 - 每2天凌晨 | needs-radar-agent | true | cron 0 0 */2 * * | 2026-08-30✓ | RETIRE-meta-learning | RETIRE |
| 周内化 - podcast-producer-agent | podcast-producer-agent | true | every 24h | 2026-08-30✓ | RETIRE-meta-learning | RETIRE |
| 应用检查 - podcast-producer-agent | podcast-producer-agent | true | cron 00 3 1,15 * * | 2026-08-15 | RETIRE-meta-learning | RETIRE |
| 播客每日AI趋势学习 （每3天） | podcast-producer-agent | true | cron 30 2 */3 * * | 2026-08-16 | RETIRE-meta-learning | RETIRE |
| 周内化 - research-agent | research-agent | true | cron 00 4 * * 0 | 2026-08-30✓ | RETIRE-meta-learning | RETIRE |
| 应用检查 - research-agent | research-agent | true | cron 15 3 1,15 * * | 2026-08-15 | RETIRE-meta-learning | RETIRE |
| 搜索与深度研究能力学习 - 凌晨1:10 （每周一，换方向） | research-agent | true | cron 0 4 * * 1 | 2026-08-17 | RETIRE-meta-learning | RETIRE |
| 搜索专家每日学习 — 凌晨2点 每2天 | search-expert-agent | true | cron 0 2 */2 * * | 2026-08-17 | RETIRE-meta-learning | RETIRE |
| 每日生活好物学习 - 凌晨4:31 （每周日凌晨） | shopping-list-agent | true | cron 0 5 * * 0 | 2026-08-30✓ | RETIRE-meta-learning | RETIRE |
| Skill优化学习（凌晨0点） （每周日凌晨） | skill-engineer-agent | true | cron 0 3 * * 0 | 2026-08-17 | RETIRE-meta-learning | RETIRE |
| 周内化 - skill-engineer-agent | skill-engineer-agent | true | cron 30 4 * * 0 | 2026-08-30✓ | RETIRE-meta-learning | RETIRE |
| 应用检查 - skill-engineer-agent | skill-engineer-agent | true | cron 30 3 1,15 * * | 2026-08-17 | RETIRE-meta-learning | RETIRE |
| 每周Skill质量巡检 - 公共目录 + 被Link的Skill | skill-engineer-agent | true | cron 0 5 * * 0 | 2026-08-30✓ | RETIRE-meta-learning | RETIRE |
| 每日Skills/Extensions安全扫描 - 凌晨4:30 | skill-engineer-agent | true | cron 41 0 * * * | 2026-08-30✓ | RETIRE-meta-learning | RETIRE |
| 每日Skill实战优化 - 扫描+优化现有Skill | skill-engineer-agent | true | cron 48 1 * * * | 2026-08-30✓ | RETIRE-meta-learning | RETIRE |
| 每日前沿Skill推送 - 10:00 | skill-engineer-agent | true | cron 20 1 * * * | 2026-08-30✓ | RETIRE-meta-learning | RETIRE |
| 每日技能探索 - 13:20 | skill-engineer-agent | true | cron 0 0 * * * | 2026-08-30✓ | RETIRE-meta-learning | RETIRE |
| 周内化 - soul-questioner-agent | soul-questioner-agent | true | cron 45 2 * * 6 | 2026-08-15 | RETIRE-meta-learning | RETIRE |
| 哲学学习 - 凌晨1点 （每周日凌晨） | soul-questioner-agent | true | cron 0 0 * * 0 | 2026-08-17 | RETIRE-meta-learning | RETIRE |
| 应用检查 - soul-questioner-agent | soul-questioner-agent | true | cron 45 3 1,15 * * | 2026-08-15 | RETIRE-meta-learning | RETIRE |
| 每周随想洞察扫描 - 周一凌晨1点 | soul-questioner-agent | true | cron 0 1 * * 1 | 2026-08-17 | RETIRE-meta-learning | RETIRE |
| 每日灵魂拷问 - 凌晨3点 | soul-questioner-agent | true | cron 29 1 * * * | 2026-08-17 | RETIRE-meta-learning | RETIRE |
| 周内化 - travel-planner-agent | travel-planner-agent | true | cron 00 5 * * 0 | 2026-08-30✓ | RETIRE-meta-learning | RETIRE |
| 应用检查 - travel-planner-agent | travel-planner-agent | true | cron 15 4 1,15 * * | 2026-08-15 | RETIRE-meta-learning | RETIRE |
| 每日学习 - travel-planner-agent （每3天） | travel-planner-agent | true | cron 30 5 */3 * * | 2026-08-16 | RETIRE-meta-learning | RETIRE |
| 前沿观察 - 每日学习（daily-learning） （每3天） | trend-tracker | true | cron 30 2 */3 * * | 2026-08-16 | RETIRE-meta-learning | RETIRE |
| 周内化 - trend-tracker | trend-tracker | true | cron 45 3 * * 6 | 2026-08-15 | RETIRE-meta-learning | RETIRE |
| 应用检查 - trend-tracker | trend-tracker | true | cron 30 4 1,15 * * | 2026-08-17 | RETIRE-meta-learning | RETIRE |
| 文风分析师每周内化回顾 | writing-style-analyst-agen | true | cron 0 19 * * 1 | 2026-08-10 | RETIRE-meta-learning | RETIRE |
| 文风分析师每日学习 - 审稿能力与风格学习 （每3天） | writing-style-analyst-agen | true | cron 30 0 */3 * * | 2026-08-30✓ | RETIRE-meta-learning | RETIRE |
| 股票研究自进化 - 23点起每小时 | stock-agent | false | cron 0 23,0-8 * * * | 2026-04-30 | RETIRE-selfevo | RETIRE |
| 提醒：提交工单修复墙体开裂（8/30 代记待办） | efficiency-agent | true | at 2026-09-01T01:00 | NEVER | RETIRE-stale-oneshot | RETIRE |
