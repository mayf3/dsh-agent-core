//! Durable incident/outbox validation and passive dedupe, without replay mutation.
use super::{checks::*, routing};
use crate::{error::require, Result};
use serde_json::{json, Value};
use std::collections::BTreeSet;
const LIFECYCLES: &[&str] = &["OPEN", "CLOSED_ACKNOWLEDGED", "CLOSED_RECOVERED"];
const DELIVERIES: &[&str] = &["PENDING", "DELIVERED", "FAILED", "OUTCOME_UNKNOWN"];
fn record(root: &str, r: &Value) -> Result<()> {
    obj(r)?;
    obj(&r["alertState"])?;
    let episode = uint(r, "episode")?;
    let revision = uint(r, "transitionRevision")?;
    require(
        r["rootIdentity"] == root
            && LIFECYCLES.contains(&text(r, "lifecycle")?)
            && episode >= 1
            && revision >= 1
            && r["incidentId"] == format!("{root}|episode:{episode}")
            && r["alertState"]["incidentKey"] == root
            && r["alertState"]["lifecycle"] == r["lifecycle"]
            && DELIVERIES.contains(&text(&r["alertState"], "delivery")?),
        "WATCHDOG_INCOHERENT_INCIDENT",
    )?;
    for key in ["rootCauseClass", "routeClass", "producer"] {
        text(r, key)?;
    }
    array(&r["facts"])?;
    array(&r["symptoms"])?;
    Ok(())
}
pub(super) fn notification_key(i: &Value) -> Result<String> {
    crate::trust::digest(
        &json!({"incidentId":i["incidentId"],"transitionRevision":i["transitionRevision"],"transitionKind":i["transitionKind"],"routeClass":i["routeClass"]}),
    )
}
pub(super) fn validate(s: &Value, authority: Option<&Value>) -> Result<()> {
    require(s["version"] == 1, "WATCHDOG_INCIDENT_VERSION")?;
    let records = obj(&s["incidents"])?;
    let outbox = obj(&s["outbox"])?;
    let migrated = s.get("migration").is_some();
    if let Some(m) = s.get("migration") {
        keys(m, &["evidenceSha256", "factsSha256", "legacySha256"], &[])?;
        for key in ["evidenceSha256", "factsSha256", "legacySha256"] {
            hex_field(m, key, 64)?;
        }
        require(
            Some(m) == authority,
            "WATCHDOG_MIGRATION_AUTHORITY_MISMATCH",
        )?;
    }
    let mut identities = BTreeSet::new();
    for (key, i) in outbox {
        obj(i)?;
        let embedded = &i["incident"];
        let root = text(embedded, "rootIdentity")?;
        let current = records
            .get(root)
            .ok_or(crate::Error::new("WATCHDOG_OUTBOX_WITHOUT_INCIDENT"))?;
        record(root, embedded)?;
        record(root, current)?;
        let revision = uint(i, "transitionRevision")?;
        let kind = text(i, "transitionKind")?;
        require(
            (revision == 1 && kind == "OPEN")
                || (revision == 2 && ["CLOSED_ACKNOWLEDGED", "CLOSED_RECOVERED"].contains(&kind)),
            "WATCHDOG_OUTBOX_TRANSITION",
        )?;
        require(
            DELIVERIES.contains(&text(i, "delivery")?)
                && i["payloadRevision"] == i["transitionRevision"]
                && i["notificationKey"] == *key
                && notification_key(i)? == *key
                && identities.insert((text(i, "incidentId")?, revision)),
            "WATCHDOG_OUTBOX_IDENTITY",
        )?;
        equal_fields(
            embedded,
            i,
            &["incidentId", "transitionRevision", "routeClass", "producer"],
            "WATCHDOG_OUTBOX_EMBEDDED_MISMATCH",
        )?;
        require(
            embedded["lifecycle"] == i["transitionKind"]
                && uint(embedded, "episode")? <= uint(current, "episode")?
                && (embedded["episode"] != current["episode"]
                    || revision <= uint(current, "transitionRevision")?),
            "WATCHDOG_OUTBOX_HISTORY",
        )?;
        routing::binding_shape(key, i)?;
        let binding = i.get("deliveryBinding");
        let attempted = i.get("firstDeliveryAttemptAt");
        let updated = i.get("deliveryUpdatedAt");
        require(
            !(i["delivery"] == "PENDING" && (attempted.is_some() || updated.is_some())),
            "WATCHDOG_DELIVERY_CHRONOLOGY",
        )?;
        if attempted.is_some() {
            require(
                binding.is_some()
                    && uint(i, "firstDeliveryAttemptAt")? >= uint(i, "deliveryBindingAt")?,
                "WATCHDOG_DELIVERY_CHRONOLOGY",
            )?;
        }
        if updated.is_some() {
            let prior = if attempted.is_some() {
                uint(i, "firstDeliveryAttemptAt")?
            } else {
                uint(&embedded["alertState"], "lastTransitionAt")?
            };
            require(
                uint(i, "deliveryUpdatedAt")? >= prior,
                "WATCHDOG_DELIVERY_CHRONOLOGY",
            )?;
        }
        if ["DELIVERED", "OUTCOME_UNKNOWN"].contains(&text(i, "delivery")?)
            || (i["delivery"] == "FAILED" && binding.is_some())
        {
            require(
                binding.is_some() && attempted.is_some() && updated.is_some(),
                "WATCHDOG_DELIVERY_CHRONOLOGY",
            )?;
        }
    }
    for (root, r) in records {
        record(root, r)?;
        let revision = uint(r, "transitionRevision")?;
        require(
            (r["lifecycle"] == "OPEN" && revision == 1)
                || (r["lifecycle"] != "OPEN" && (revision == 2 || (migrated && revision == 1))),
            "WATCHDOG_INCIDENT_HISTORY",
        )?;
        let entries: Vec<_> = outbox
            .iter()
            .filter(|(_, i)| i["incidentId"] == r["incidentId"])
            .collect();
        if entries.is_empty() {
            require(
                migrated && r["alertState"]["delivery"] == "DELIVERED",
                "WATCHDOG_INCIDENT_MISSING_OUTBOX",
            )?;
            continue;
        }
        if !migrated {
            for rev in 1..=revision {
                require(
                    entries.iter().any(|(_, i)| i["transitionRevision"] == rev),
                    "WATCHDOG_INCIDENT_HISTORY",
                )?;
            }
        }
        let current: Vec<_> = entries
            .iter()
            .filter(|(_, i)| i["transitionRevision"] == revision)
            .collect();
        require(
            current.len() == 1,
            "WATCHDOG_INCIDENT_CURRENT_OUTBOX_CARDINALITY",
        )?;
        let (_, i) = current[0];
        equal_fields(
            r,
            i,
            &["transitionRevision", "routeClass", "producer"],
            "WATCHDOG_INCIDENT_CURRENT_OUTBOX_MISMATCH",
        )?;
        require(
            i["transitionKind"] == r["lifecycle"]
                && i["incident"]["rootIdentity"] == *root
                && (i["delivery"] == r["alertState"]["delivery"]
                    || (migrated
                        && r["alertState"]["delivery"] == "FAILED"
                        && i["delivery"] == "PENDING")),
            "WATCHDOG_INCIDENT_CURRENT_OUTBOX_MISMATCH",
        )?;
    }
    Ok(())
}
fn facts(v: &Value) -> Result<BTreeSet<String>> {
    array(v)?
        .iter()
        .map(|f| Ok(serde_json::to_string(&stable(f, "overdueMs")?)?))
        .collect()
}
pub(super) fn dedupe(s: &Value, compiled: &[Value]) -> Result<Value> {
    let mut proof = serde_json::Map::new();
    for expected in compiled {
        let root = text(expected, "rootIdentity")?;
        let r = &s["incidents"][root];
        require(
            r["lifecycle"] == "OPEN" && r["rootCauseClass"] == "RUN_STUCK_OUTCOME_UNKNOWN",
            "WATCHDOG_MISSING_OPEN_ROOT",
        )?;
        equal_fields(
            r,
            expected,
            &["rootIdentity", "rootCauseClass", "routeClass", "symptoms"],
            "WATCHDOG_DURABLE_PAYLOAD_MISMATCH",
        )?;
        require(
            facts(&r["facts"])? == facts(&expected["facts"])?,
            "WATCHDOG_DURABLE_FACTS_MISMATCH",
        )?;
        let entries: Vec<_> = obj(&s["outbox"])?
            .iter()
            .filter(|(_, i)| i["incidentId"] == r["incidentId"])
            .collect();
        require(entries.len() <= 1, "WATCHDOG_DUPLICATE_CURRENT_OPEN_INTENT")?;
        // validate already proves the exact OPEN lifecycle/current intent. The
        // original updateIncidentState OPEN branch only refreshes facts/time;
        // it cannot emit a transition for any of these existing owned roots.
        proof.insert(root.to_string(),json!({"episode":r["episode"],"incidentId":r["incidentId"],"transitionRevision":r["transitionRevision"],"alertState":r["alertState"],"outbox":entries}));
    }
    Ok(Value::Object(proof))
}
