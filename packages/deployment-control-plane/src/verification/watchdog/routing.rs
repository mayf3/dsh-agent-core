use super::checks::*;
use crate::{error::require, Result};
use serde_json::{json, Value};
use std::collections::BTreeSet;
fn target(v: &Value) -> Result<()> {
    keys(v, &["channel", "to"], &[])?;
    require(v["channel"] == "feishu", "WATCHDOG_ROUTE_CHANNEL")?;
    text(v, "to")?;
    Ok(())
}
pub(super) fn manifest(v: &Value) -> Result<()> {
    keys(
        v,
        &[
            "version",
            "canonicalOpsTarget",
            "ownerTargets",
            "jobFailureTargets",
        ],
        &[],
    )?;
    require(v["version"] == 1, "WATCHDOG_ROUTING_VERSION")?;
    target(&v["canonicalOpsTarget"])?;
    for name in ["ownerTargets", "jobFailureTargets"] {
        let mut normalized = BTreeSet::new();
        for (key, value) in obj(&v[name])? {
            require(
                !key.trim().is_empty() && normalized.insert(key.trim()),
                "WATCHDOG_ROUTING_DUPLICATE_KEY",
            )?;
            target(value)?;
        }
    }
    Ok(())
}
fn provider_key(key: &str) -> Result<String> {
    let bytes = hex::decode(key).map_err(|_| crate::Error::new("WATCHDOG_NOTIFICATION_KEY"))?;
    require(bytes.len() == 32, "WATCHDOG_NOTIFICATION_KEY")?;
    const TABLE: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let mut output = String::new();
    let mut bits = 0u32;
    let mut count = 0;
    for byte in bytes {
        bits = (bits << 8) | u32::from(byte);
        count += 8;
        while count >= 6 {
            count -= 6;
            output.push(TABLE[((bits >> count) & 63) as usize] as char);
        }
    }
    if count > 0 {
        output.push(TABLE[((bits << (6 - count)) & 63) as usize] as char);
    }
    Ok(output)
}
pub(super) fn binding_shape(key: &str, i: &Value) -> Result<()> {
    let Some(b) = i.get("deliveryBinding") else {
        return require(
            i.get("deliveryBindingAt").is_none(),
            "WATCHDOG_BINDING_TIME_WITHOUT_BINDING",
        );
    };
    keys(
        b,
        &[
            "payload",
            "producer",
            "providerKey",
            "route",
            "routeSource",
            "routingSha256",
        ],
        &[],
    )?;
    target(&b["route"])?;
    hex_field(b, "routingSha256", 64)?;
    let label = match text(i, "transitionKind")? {
        "CLOSED_RECOVERED" => "RECOVERED",
        "CLOSED_ACKNOWLEDGED" => "ACKNOWLEDGED",
        _ => "NEW",
    };
    let payload = format!(
        "Scheduler watchdog {label} [{}] {} [notification-key:{key}]",
        text(&i["incident"], "rootIdentity")?,
        text(&i["incident"], "rootCauseClass")?
    );
    require(
        b["producer"] == i["producer"]
            && b["providerKey"] == provider_key(key)?
            && b["payload"] == payload
            && uint(i, "deliveryBindingAt")?
                >= uint(&i["incident"]["alertState"], "lastTransitionAt")?,
        "WATCHDOG_DELIVERY_BINDING",
    )?;
    let sources: &[&str] = match text(i, "routeClass")? {
        "SCHEDULER_CONTROL_PLANE_INCIDENT" => &["canonicalOpsTarget"],
        "JOB_FAILURE" => &["jobFailureTargets", "ownerTargets", "canonicalOpsTarget"],
        "BUSINESS_OUTPUT" => &["job.delivery"],
        _ => return Err(crate::Error::new("WATCHDOG_ROUTE_CLASS")),
    };
    require(
        sources.contains(&text(b, "routeSource")?),
        "WATCHDOG_ROUTE_SOURCE",
    )
}
pub(super) fn bindings(
    state: &Value,
    m: &Value,
    jobs: &Value,
    digest: &str,
    now: u64,
) -> Result<()> {
    for i in obj(&state["outbox"])?.values() {
        for field in [
            "deliveryBindingAt",
            "firstDeliveryAttemptAt",
            "deliveryUpdatedAt",
        ] {
            if i.get(field).is_some() {
                require(uint(i, field)? <= now, "WATCHDOG_FUTURE_DELIVERY_TIME")?;
            }
        }
        let Some(b) = i.get("deliveryBinding") else {
            continue;
        };
        let job = array(jobs)?
            .iter()
            .find(|j| j["id"] == i["incident"]["jobId"]);
        let (route, source) = match text(i, "routeClass")? {
            "SCHEDULER_CONTROL_PLANE_INCIDENT" => {
                (m["canonicalOpsTarget"].clone(), "canonicalOpsTarget")
            }
            "JOB_FAILURE" => {
                let explicit = job
                    .and_then(|j| j["logicalKey"].as_str())
                    .and_then(|key| m["jobFailureTargets"].get(key));
                let owner = job
                    .and_then(|j| j["agentId"].as_str())
                    .and_then(|key| m["ownerTargets"].get(key));
                if let Some(r) = explicit {
                    (r.clone(), "jobFailureTargets")
                } else if let Some(r) = owner {
                    (r.clone(), "ownerTargets")
                } else {
                    (m["canonicalOpsTarget"].clone(), "canonicalOpsTarget")
                }
            }
            "BUSINESS_OUTPUT" => {
                let j = job.ok_or(crate::Error::new("WATCHDOG_ROUTE_JOB_MISSING"))?;
                require(
                    j["delivery"]["mode"] != "none",
                    "WATCHDOG_BUSINESS_ROUTE_DISABLED",
                )?;
                (
                    json!({"channel":j["delivery"]["channel"],"to":j["delivery"]["to"]}),
                    "job.delivery",
                )
            }
            _ => return Err(crate::Error::new("WATCHDOG_ROUTE_CLASS")),
        };
        target(&route)?;
        require(
            b["route"] == route && b["routeSource"] == source && b["routingSha256"] == digest,
            "WATCHDOG_ROUTING_AUTHORITY_MISMATCH",
        )?;
    }
    Ok(())
}
