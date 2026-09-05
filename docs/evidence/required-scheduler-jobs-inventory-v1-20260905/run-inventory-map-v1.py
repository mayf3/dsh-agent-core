#!/usr/bin/env python3
"""REQUIRED_SCHEDULER_JOBS_MIGRATION_V1 — READ_ONLY_INVENTORY per-job mapping generator.

只读：解析 ~/.openclaw/cron/jobs.json（快照源），为每个 job 赋 candidate/disposition。
不写任何生产面；输出仅落入本 evidence 目录。生产 Scheduler store（authsvc home）
不可读（权限按设计拒绝），其现态以 docs/evidence 既有证据 + 本轮 launchd/进程实证记录。
"""
import json, time, os

SRC = os.path.expanduser("~/.openclaw/cron/jobs.json")
OUT = os.path.dirname(os.path.abspath(__file__))

# ---------------- mapping rules (name/agent based, priority order) ----------------
# (candidate, disposition, reason)
def rule(j):
    n = j.get("name", "")
    a = j.get("agentId") or "?"
    en = bool(j.get("enabled"))
    sch = j.get("schedule") or {}
    kind = sch.get("kind")

    # --- specials first (disabled / at one-shots) ---
    if "欢欢腰突" in n:
        return ("M8-家庭提醒与健康", "MIGRATE", "future one-shot at 2026-09-07，OpenClaw 已死将永不触发，需在当前 Scheduler 重建")
    if "墙体开裂" in n:
        return ("RETIRE-stale-oneshot", "RETIRE", "at 2026-09-01 已过期且从未执行（gateway 08-30 停），提醒时点已过")
    if "市场简报" in n:
        return ("M5-stock-agent割接包", "MIGRATE", "stock-daily-market-brief-001；割接纪律下双侧 disabled；v2 store 已有迁移副本（08-30 canary 执行成功/not-delivered）")
    if "自进化" in n:
        return ("RETIRE-selfevo", "RETIRE", "4 月已 disabled；stock 割接 manifest 明确『保持 disabled 不迁』")
    if "stagnation-alert" in n:
        return ("RETIRE-disabled", "RETIRE", "已 disabled，用途不再成立")

    if not en:
        return ("RETIRE-disabled-longtail", "RETIRE", "disabled 长尾（153 条 disabled 宇宙整体不复用；如需按名复活走迁移 Goal 单审）")

    # --- enabled ---
    if "workflow-dispatcher" in n or "worklist-poller" in n:
        return ("M1-工作流唤醒派发", "MIGRATE",
                "30min 派发/轮询与 per-agent worklist 轮询同果去重；svc-workflow 活着，仅触发器死；successor=visit-activation（HOLD）" )
    if "每日员工档案同步" in n:
        return ("M2-HR档案同步", "MIGRATE", "hr-agent 现役；机制已验证（scheduler 工具面 09-05 PASS）")
    if "每日任务早报" in n:
        return ("M3-每日任务早报", "MIGRATE", "efficiency-agent 现役（scheduler canary actor）；Broker 版即当前栈")
    if "每日随想总结" in n or "每日随想素材检测" in n:
        return ("M4-博客随想流水线", "MIGRATE", "随想总结是 blog 素材上游；blog-agent 现役，workflow_execute 生产可用")
    if a == "stock-agent":
        return ("M5-stock-agent割接包", "MIGRATE", "stock-cutover-preparation 冻结 manifest R1/R2；不迁自进化")
    if "论坛动态调度器" in n or "论坛版主每周报告" in n:
        return ("M6-论坛动态与周报", "MIGRATE", "svc-forum 活着；forum-scheduler.sh 链已死；blocker=forum 生产 supply")
    if a == "knowledge-curator-agent":
        return ("M7-Wiki维护族", "MIGRATE", "llm-wiki 项目在役；workflow_read/execute 模式即当前栈")
    if "购物清单每日提醒" in n:
        return ("M8-家庭提醒与健康", "MIGRATE", "家庭日常义务型提醒（每日 8:00）")
    if a == "family-doctor-2-agent":
        return ("M8-家庭提醒与健康", "MIGRATE", "家庭健康管理（周/月回顾）；学习类条目随本族一并迁移")
    if a == "3d-print-agent":
        return ("M9-数学练习打印", "MIGRATE", "孩子每日练习页+打印，家庭义务型产出")
    if "喜马拉雅每日搬运" in n or "播客每日主题推荐" in n:
        return ("M10-播客流水线", "MIGRATE", "公开频道内容生产（喜马拉雅专辑连载中，脚本自续集数）")
    if "GitHub 公开仓库隐私泄露扫描" in n or "github-full-leak-scan" in n:
        return ("M11-GitHub泄露扫描", "MIGRATE", "对外安全暴露面；两 job 每日/每3日去重合并取一")
    if "学习方法论" in n:
        return ("RETIRE-meta-learning", "RETIRE", "fleet 自进化框架（每日学习/周内化/应用检查）：停摆 6 日无业务影响；daily-learning/learning-review 仍作为 skill 可按需调用")
    if a == "needs-radar-agent":
        return ("M12-需求调研族", "MIGRATE", "周度需求信号调研（agent 在当前 fleet 有实证）；学习方法论除外")
    if "需求信号扫描" in n:
        return ("M12-需求调研族", "MIGRATE", "与 needs-radar 周度调研同果，去重并入")
    if "每日管线方向审核" in n or "龙虾合伙人每周待办回顾" in n:
        return ("M13-Owner管线监督", "MIGRATE", "ceo-agent 08-16 调查标记『业务最关键』；管线监督仍成立")
    if "每日服务健康巡检" in n:
        return ("RETIRE-dup-healthcheck", "RETIRE", "巡检本体由用户 crontab health-check.sh 承担且今日活跃（KEEP-K1）；agent 侧为重复机制")

    # --- meta-learning / internalization / application-check family ---
    if ("周内化" in n or "应用检查" in n or "学习" in n or "学用回顾" in n
            or "评分卡" in n or "PPT设计师" in n or "拆书" in n or "灵魂拷问" in n
            or "哲学" in n or "技能探索" in n or "前沿Skill" in n or "Skill实战" in n
            or "Skill质量巡检" in n or "安全扫描" in n or "洞察扫描" in n
            or "战略分析" in n or "自我学习" in n or "进化日报" in n or "方法论" in n
            or "随想素材" in n or "运营周总结" in n or "Synthesis" in n and False):
        return ("RETIRE-meta-learning", "RETIRE", "fleet 自进化框架（每日学习/周内化/应用检查）：停摆 6 日无业务影响；daily-learning/learning-review 仍作为 skill 可按需调用")

    # --- lifestyle / content nice-to-have ---
    return ("RETIRE-lifestyle-content", "RETIRE",
            "内容/情报 nice-to-have（旅行推荐、羊毛情报、好物学习等）：义务型产出缺失未造成可观察业务影响；能力保留可按需对话唤起")

def fmt_sched(sch):
    k = sch.get("kind")
    if k == "cron":
        return f"cron {sch.get('expr','')}"
    if k == "every":
        h = (sch.get("everyMs") or 0) / 3600000.0
        return f"every {h:g}h"
    if k == "at":
        return f"at {str(sch.get('at',''))[:16]}"
    return str(k)

def main():
    d = json.load(open(SRC))
    jobs = d.get("jobs", d)
    now = time.time() * 1000
    rows, counts = [], {}
    for j in jobs:
        st = j.get("state") or {}
        lr = st.get("lastRunAtMs")
        cand, disp, reason = rule(j)
        last = time.strftime("%Y-%m-%d", time.localtime(lr / 1000)) if lr else "NEVER"
        recent = bool(lr and lr > now - 14 * 86400 * 1000)
        rows.append({
            "id": j.get("id", "")[:13], "name": j.get("name", ""), "agentId": j.get("agentId") or "?",
            "enabled": bool(j.get("enabled")), "schedule": fmt_sched(j.get("schedule") or {}),
            "lastRun": last, "ranLast14d": recent, "lastStatus": st.get("lastRunStatus") or st.get("lastStatus") or "-",
            "candidate": cand, "disposition": disp, "reason": reason,
        })
        key = f"{disp}:{cand}"
        counts[key] = counts.get(key, 0) + 1

    rows.sort(key=lambda r: (r["disposition"], r["candidate"], r["agentId"], r["name"]))
    with open(os.path.join(OUT, "SUMMARY_COUNTS.json"), "w") as f:
        json.dump({"snapshot_total": len(rows),
                   "enabled_total": sum(1 for r in rows if r["enabled"]),
                   "disabled_total": sum(1 for r in rows if not r["enabled"]),
                   "buckets": dict(sorted(counts.items()))}, f, ensure_ascii=False, indent=1)

    lines = ["# APPENDIX — OpenClaw cron per-job map (snapshot %s)" % time.strftime("%Y-%m-%dT%H:%M:%S%z"),
             "",
             "源：`~/.openclaw/cron/jobs.json` 只读解析。共 %d 条（enabled %d / disabled %d）。" % (
                 len(rows), sum(1 for r in rows if r['enabled']), sum(1 for r in rows if not r['enabled'])),
             "",
             "| name | agent | enabled | schedule | lastRun(±14d) | candidate | disposition |",
             "|---|---|---|---|---|---|---|"]
    for r in rows:
        flag = "✓" if r["ranLast14d"] else ""
        lines.append("| %s | %s | %s | %s | %s%s | %s | %s |" % (
            r["name"][:44].replace("|", "／"), r["agentId"][:26], str(r["enabled"]).lower(),
            r["schedule"], r["lastRun"], flag, r["candidate"], r["disposition"]))
    with open(os.path.join(OUT, "APPENDIX_JOB_MAP.md"), "w") as f:
        f.write("\n".join(lines) + "\n")
    print(json.dumps({"snapshot_total": len(rows),
                      "enabled": sum(1 for r in rows if r['enabled']),
                      "disabled": sum(1 for r in rows if not r['enabled']),
                      "buckets": dict(sorted(counts.items()))}, ensure_ascii=False, indent=1))

if __name__ == "__main__":
    main()
