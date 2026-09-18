use crate::{error::require, Error, Result};
use serde_json::{Map, Value};
use std::collections::BTreeSet;
pub(super) fn obj(v: &Value) -> Result<&Map<String, Value>> {
    v.as_object().ok_or(Error::new("WATCHDOG_EXPECTED_OBJECT"))
}
pub(super) fn array(v: &Value) -> Result<&Vec<Value>> {
    v.as_array().ok_or(Error::new("WATCHDOG_EXPECTED_ARRAY"))
}
pub(super) fn text<'a>(v: &'a Value, key: &str) -> Result<&'a str> {
    v.get(key)
        .and_then(Value::as_str)
        .filter(|s| !s.trim().is_empty())
        .ok_or(Error::new("WATCHDOG_EXPECTED_STRING"))
}
pub(super) fn uint(v: &Value, key: &str) -> Result<u64> {
    v.get(key)
        .and_then(Value::as_u64)
        .filter(|n| *n <= 9_007_199_254_740_991)
        .ok_or(Error::new("WATCHDOG_EXPECTED_SAFE_INTEGER"))
}
pub(super) fn keys(v: &Value, required: &[&str], optional: &[&str]) -> Result<()> {
    let map = obj(v)?;
    require(
        required.iter().all(|k| map.contains_key(*k))
            && map
                .keys()
                .all(|k| required.contains(&k.as_str()) || optional.contains(&k.as_str())),
        "WATCHDOG_RECORD_FIELDS",
    )
}
pub(super) fn hex_field(v: &Value, k: &str, len: usize) -> Result<()> {
    let s = text(v, k)?;
    require(
        s.len() == len
            && s.bytes()
                .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b)),
        "WATCHDOG_INVALID_DIGEST",
    )
}
pub(super) fn unique(rows: &[Value], key: &str) -> Result<()> {
    let mut seen = BTreeSet::new();
    for row in rows {
        require(seen.insert(text(row, key)?), "WATCHDOG_DUPLICATE_IDENTITY")?;
    }
    Ok(())
}
pub(super) fn stable(v: &Value, drop: &str) -> Result<Value> {
    let mut o = obj(v)?.clone();
    o.remove(drop);
    Ok(Value::Object(o))
}
pub(super) fn equal_fields(
    a: &Value,
    b: &Value,
    fields: &[&str],
    reason: &'static str,
) -> Result<()> {
    require(fields.iter().all(|k| a.get(k) == b.get(k)), reason)
}
pub(super) fn alias<'a>(v: &'a Value, fields: &[&str]) -> Result<&'a Value> {
    let found: Vec<_> = fields.iter().filter_map(|k| v.get(k)).collect();
    let first = found
        .first()
        .ok_or(Error::new("WATCHDOG_MISSING_IDENTITY"))?;
    require(
        found.iter().all(|v| *v == *first),
        "WATCHDOG_AMBIGUOUS_IDENTITY",
    )?;
    Ok(first)
}
