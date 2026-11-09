#!/usr/bin/env python3
"""ts_normalize.py — HR-OBSERVATION-STANDARD-V2 R1/R2 time normalizer.

Reads a JSON evidence file (or stdin) and prints an observation block:
every timestamp field is emitted in UTC and Beijing time side by side, the
three observation categories (scheduled / observed / recorded) are kept
separate, and any timestamp in the future relative to the observation time
is flagged CLOCK_OR_FORMAT_ANOMALY with all sequencing inference suppressed.

Usage:
  python3 ts_normalize.py evidence.json
  cat evidence.json | python3 ts_normalize.py

Expected shape (missing keys tolerated, reported as such):
{
  "scheduled": "<iso8601>",     # 计划时间 (optional)
  "observed":  "<iso8601>",     # 观察时间 (defaults to now, UTC)
  "recorded":  "<iso8601>",     # 记录时间 (defaults to now, UTC)
  "events": [{"at": "<iso8601>", "what": "..."}, ...],
  "counters": {"schedulerSucceeded": 14, "ingested": 3, "businessChanged": 1,
               "unknown": 2}    # R3 tiered counters, printed as-is
}
"""
import json
import sys
from datetime import datetime, timezone, timedelta

BEIJING = timezone(timedelta(hours=8))
STD = "HR-OBSERVATION-STANDARD-V2"


def parse(value):
    if not isinstance(value, str):
        return None
    text = value.strip()
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None


def naive_assume_utc(value):
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def dual(moment):
    utc = moment.astimezone(timezone.utc)
    bj = moment.astimezone(BEIJING)
    return f"{utc.isoformat()} / {bj.isoformat()}"


def main():
    raw = sys.stdin.read() if len(sys.argv) < 2 else open(sys.argv[1]).read()
    data = json.loads(raw)
    now = datetime.now(timezone.utc)

    observed = parse(data.get("observed"))
    recorded = parse(data.get("recorded"))
    scheduled = parse(data.get("scheduled"))
    observed = naive_assume_utc(observed) if observed else now
    recorded = naive_assume_utc(recorded) if recorded else now
    scheduled = naive_assume_utc(scheduled) if scheduled else None

    print(f"standard={STD}")
    print(f"observed(观察时间): {dual(observed)}")
    print(f"recorded(记录时间): {dual(recorded)}")
    if scheduled:
        print(f"scheduled(计划时间): {dual(scheduled)}")
    else:
        print("scheduled(计划时间): MISSING — R1 requires it for slot observations")

    anomalies = 0
    events = data.get("events") or []
    for event in events:
        moment = parse(event.get("at"))
        what = event.get("what", "?")
        if moment is None:
            anomalies += 1
            print(f"event: FORMAT_ANOMALY what={what!r} raw={event.get('at')!r}")
            continue
        moment = naive_assume_utc(moment)
        flag = ""
        if moment > observed + timedelta(minutes=1):
            anomalies += 1
            flag = " CLOCK_OR_FORMAT_ANOMALY (future vs observed — no sequencing inference, R2)"
        print(f"event: {dual(moment)} what={what}{flag}")

    counters = data.get("counters") or {}
    if counters:
        print("counters(R3 tiered — scheduler outcomes are tier-1 only, never health):")
        for key in ("schedulerSucceeded", "schedulerFailed", "ingested",
                    "businessChanged", "unknown"):
            if key in counters:
                print(f"  {key}={counters[key]}")
        missing = [k for k in ("ingested", "businessChanged", "unknown")
                   if k not in counters]
        if missing:
            print(f"  MISSING_TIERS={missing} — R3: report must list ②③④ or declare UNKNOWN")
    print(f"anomalies={anomalies}")
    print("overall=HR 调度持续运行，部分业务接续已证；不代表全系统验收完成。"
          if counters.get("schedulerSucceeded") and not anomalies
          else "overall=NOT CLAIMED — see anomalies/missing fields above")


if __name__ == "__main__":
    main()
