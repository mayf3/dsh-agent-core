//! Fixed derivation from authenticated native Scheduler history and event bytes.
use super::documents::strict_json;
use crate::{error::require, Error, Result};
use serde_json::{json, Value};
pub(crate) fn derive(raw: &[u8], events: &[u8], job: &str) -> Result<Value> {
    let mut body = strict_json(raw)?;
    require(body["next_cursor"].is_null(), "WATCHDOG_RUN_PAGINATION")?;
    let rows = body["runs"]
        .as_array_mut()
        .ok_or(Error::new("WATCHDOG_RUN_READBACK"))?;
    require(rows.len() == 1, "WATCHDOG_RUN_IDENTITY")?;
    let run = &mut rows[0];
    require(run["job_id"] == job, "WATCHDOG_RUN_IDENTITY")?;
    let occurrence = run["occurrence_id"]
        .as_str()
        .ok_or(Error::new("WATCHDOG_RUN_IDENTITY"))?
        .to_string();
    let ended = run["ended_at"]
        .as_str()
        .ok_or(Error::new("WATCHDOG_RUN_TIME"))?;
    let ended = instant(ended)?;
    let object = run
        .as_object_mut()
        .ok_or(Error::new("WATCHDOG_RUN_READBACK"))?;
    require(!object.contains_key("endedAt"), "WATCHDOG_RUN_AMBIGUOUS")?;
    object.remove("ended_at");
    object.insert("endedAt".into(), json!(ended));
    let mut matching = Vec::new();
    for line in events.split(|b| *b == b'\n').filter(|b| !b.is_empty()) {
        let event = strict_json(line)?;
        if event["occurrenceId"] == occurrence {
            matching.push(event);
            require(matching.len() <= 256, "WATCHDOG_EVENT_LIMIT")?;
        }
    }
    Ok(json!({"runs":rows,"events":matching}))
}
pub(crate) fn instant(text: &str) -> Result<u64> {
    // History's public time contract is the canonical Date.toISOString form.
    let b = text.as_bytes();
    require(
        b.len() == 24
            && b[4] == b'-'
            && b[7] == b'-'
            && b[10] == b'T'
            && b[13] == b':'
            && b[16] == b':'
            && b[19] == b'.'
            && b[23] == b'Z',
        "WATCHDOG_RUN_TIME",
    )?;
    let number = |start: usize, end: usize| -> Result<i64> {
        require(
            b[start..end].iter().all(u8::is_ascii_digit),
            "WATCHDOG_RUN_TIME",
        )?;
        text[start..end]
            .parse()
            .map_err(|_| Error::new("WATCHDOG_RUN_TIME"))
    };
    let year = number(0, 4)?;
    let month = number(5, 7)?;
    let day = number(8, 10)?;
    let hour = number(11, 13)?;
    let minute = number(14, 16)?;
    let second = number(17, 19)?;
    let millis = number(20, 23)?;
    require(
        (1970..=9999).contains(&year)
            && (1..=12).contains(&month)
            && hour < 24
            && minute < 60
            && second < 60,
        "WATCHDOG_RUN_TIME",
    )?;
    let leap = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
    let days = [
        31,
        if leap { 29 } else { 28 },
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31,
    ];
    require(
        day >= 1 && day <= days[(month - 1) as usize],
        "WATCHDOG_RUN_TIME",
    )?;
    let y = year - i64::from(month <= 2);
    let era = y / 400;
    let yoe = y - era * 400;
    let m = month + if month > 2 { -3 } else { 9 };
    let doy = (153 * m + 2) / 5 + day - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    let epoch_days = era * 146097 + doe - 719468;
    u64::try_from(((epoch_days * 24 + hour) * 60 + minute) * 60000 + second * 1000 + millis)
        .map_err(|_| Error::new("WATCHDOG_RUN_TIME"))
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn canonical_utc_history_time_has_exact_numeric_derivative() {
        assert_eq!(instant("1970-01-01T00:00:00.000Z").unwrap(), 0);
        assert_eq!(instant("2000-01-01T00:00:00.000Z").unwrap(), 946684800000);
        assert_eq!(instant("2000-02-29T12:34:56.789Z").unwrap(), 951827696789);
        for bad in [
            "2001-02-29T00:00:00.000Z",
            "2000-02-30T00:00:00.000Z",
            "2026-09-18T24:00:00.000Z",
            "2026-09-18T00:00:00+00:00",
        ] {
            assert!(instant(bad).is_err())
        }
    }
    #[test]
    fn exact_history_and_admission_event_are_retained() {
        let raw=br#"{"runs":[{"job_id":"job","occurrence_id":"occ","outcome":"succeeded","ended_at":"2000-01-01T00:00:00.000Z","result":{"final_status":"PASS"}}],"next_cursor":null}"#;
        let events=b"{\"occurrenceId\":\"other\"}\n{\"occurrenceId\":\"occ\",\"action\":\"router_admission\",\"phase\":\"accepted\"}\n";
        let value = derive(raw, events, "job").unwrap();
        assert_eq!(value["runs"][0]["endedAt"], 946684800000u64);
        assert!(value["runs"][0].get("ended_at").is_none());
        assert_eq!(value["events"].as_array().unwrap().len(), 1);
        assert!(derive(raw, events, "wrong").is_err());
    }
}
