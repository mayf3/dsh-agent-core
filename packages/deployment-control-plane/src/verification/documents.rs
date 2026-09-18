//! Pure codec for the fixed Watchdog document set, never a file/path reader.
use crate::{error::require, Error, Result};
use serde::de::{DeserializeSeed, Error as DeError, MapAccess, SeqAccess, Visitor};
use serde_json::{Map, Number, Value};
use std::{collections::BTreeMap, fmt};

const MAX_BYTES: usize = 4 * 1024 * 1024;
const MAX_DEPTH: usize = 64;
const DOCUMENTS: &[&str] = &[
    "phaseReceipt",
    "routingReceipt",
    "beforeHealth",
    "afterHealth",
    "beforeStore",
    "afterStore",
    "beforeIncidentState",
    "afterIncidentState",
    "routingManifest",
    "runReadback",
];
const HASH_FIELDS: &[(&str, &str)] = &[
    ("beforeStoreSha256", "beforeStore"),
    ("afterStoreSha256", "afterStore"),
    ("beforeIncidentSha256", "beforeIncidentState"),
    ("afterIncidentSha256", "afterIncidentState"),
    ("routingManifestSha256", "routingManifest"),
];

/// Reject duplicate keys at every object depth, including escaped equivalents.
/// This must run before converting protected input into a Value: a Value alone
/// cannot retain evidence of overwritten keys. No caller can widen these bounds.
pub(crate) fn strict_json(bytes: &[u8]) -> Result<Value> {
    require(
        !bytes.is_empty() && bytes.len() <= MAX_BYTES,
        "WATCHDOG_DOCUMENT_SIZE",
    )?;
    let mut decoder = serde_json::Deserializer::from_slice(bytes);
    let value = StrictValue { depth: 0 }
        .deserialize(&mut decoder)
        .map_err(|_| Error::new("WATCHDOG_DOCUMENT_JSON"))?;
    decoder
        .end()
        .map_err(|_| Error::new("WATCHDOG_DOCUMENT_JSON"))?;
    Ok(value)
}

/// Each fixed name maps to the same field in the semantic bundle. The closed
/// documentSha256 map authenticates raw bytes (including whitespace), while
/// equality checks prevent substituting a parsed body beside a correct hash.
/// The five original JS digest aliases must agree with this full raw-byte map.
/// The caller separately authenticates custody/capture and runs the evaluator.
/// No timestamp rewrite or legacy acceptance import occurs here.
pub(crate) fn verified_semantic(
    documents: &BTreeMap<String, Vec<u8>>,
    bundle: &Value,
) -> Result<Value> {
    let claims = bundle
        .get("documentSha256")
        .and_then(Value::as_object)
        .ok_or(Error::new("WATCHDOG_DOCUMENT_HASH_MAP"))?;
    let mut expected = DOCUMENTS.to_vec();
    if bundle.get("incidentMigrationAuthority").is_some() {
        expected.push("incidentMigrationAuthority");
    }
    require(
        documents.len() == expected.len()
            && claims.len() == expected.len()
            && expected
                .iter()
                .all(|key| documents.contains_key(*key) && claims.contains_key(*key)),
        "WATCHDOG_DOCUMENT_SET",
    )?;
    for key in expected {
        let bytes = &documents[key];
        require(bytes.len() <= MAX_BYTES, "WATCHDOG_DOCUMENT_SIZE")?;
        require(
            claims[key].as_str() == Some(crate::fs::file::sha(bytes).as_str()),
            "WATCHDOG_DOCUMENT_RAW_HASH",
        )?;
        let parsed = strict_json(bytes)?;
        require(bundle.get(key) == Some(&parsed), "WATCHDOG_DOCUMENT_BODY")?;
    }
    for (field, name) in HASH_FIELDS {
        require(
            bundle.get(*field) == claims.get(*name),
            "WATCHDOG_DOCUMENT_HASH_ALIAS",
        )?;
    }
    Ok(bundle.clone())
}

#[derive(Clone, Copy)]
struct StrictValue {
    depth: usize,
}
impl<'de> DeserializeSeed<'de> for StrictValue {
    type Value = Value;
    fn deserialize<D: serde::Deserializer<'de>>(
        self,
        decoder: D,
    ) -> std::result::Result<Value, D::Error> {
        if self.depth > MAX_DEPTH {
            return Err(D::Error::custom("document depth"));
        }
        decoder.deserialize_any(self)
    }
}
impl<'de> Visitor<'de> for StrictValue {
    type Value = Value;
    fn expecting(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("bounded JSON with unique object keys")
    }
    fn visit_bool<E: DeError>(self, v: bool) -> std::result::Result<Value, E> {
        Ok(Value::Bool(v))
    }
    fn visit_i64<E: DeError>(self, v: i64) -> std::result::Result<Value, E> {
        Ok(Value::Number(v.into()))
    }
    fn visit_u64<E: DeError>(self, v: u64) -> std::result::Result<Value, E> {
        Ok(Value::Number(v.into()))
    }
    fn visit_f64<E: DeError>(self, v: f64) -> std::result::Result<Value, E> {
        Number::from_f64(v)
            .map(Value::Number)
            .ok_or_else(|| E::custom("nonfinite number"))
    }
    fn visit_str<E: DeError>(self, v: &str) -> std::result::Result<Value, E> {
        Ok(Value::String(v.into()))
    }
    fn visit_string<E: DeError>(self, v: String) -> std::result::Result<Value, E> {
        Ok(Value::String(v))
    }
    fn visit_unit<E: DeError>(self) -> std::result::Result<Value, E> {
        Ok(Value::Null)
    }
    fn visit_none<E: DeError>(self) -> std::result::Result<Value, E> {
        Ok(Value::Null)
    }
    fn visit_seq<A: SeqAccess<'de>>(self, mut sequence: A) -> std::result::Result<Value, A::Error> {
        if self.depth >= MAX_DEPTH {
            return Err(A::Error::custom("document depth"));
        }
        let mut values = Vec::new();
        while let Some(value) = sequence.next_element_seed(Self {
            depth: self.depth + 1,
        })? {
            values.push(value);
        }
        Ok(Value::Array(values))
    }
    fn visit_map<A: MapAccess<'de>>(self, mut object: A) -> std::result::Result<Value, A::Error> {
        if self.depth >= MAX_DEPTH {
            return Err(A::Error::custom("document depth"));
        }
        let mut values = Map::new();
        while let Some(key) = object.next_key::<String>()? {
            if values.contains_key(&key) {
                return Err(A::Error::custom("duplicate document key"));
            }
            let value = object.next_value_seed(Self {
                depth: self.depth + 1,
            })?;
            values.insert(key, value);
        }
        Ok(Value::Object(values))
    }
}
#[cfg(test)]
#[path = "../../test/verification/documents.rs"]
mod tests;
