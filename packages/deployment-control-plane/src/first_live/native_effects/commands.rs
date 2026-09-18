use super::super::{
    compose, files, gate, journal,
    packet::Packet,
    process::{self, Output, Tool},
    retirement,
};
use crate::{
    error::require,
    fs::{file::sha, secure::Dir},
    Result,
};
pub(super) fn refusal(output: &Output) -> bool {
    output.code == Some(64)
        && output.stdout.is_empty()
        && output.stderr == "Legacy deployment entry retired; use agent-deployctl.\n"
}
pub(super) fn sudo(output: &Output, expected: &str) -> bool {
    output.code == Some(0) && output.stderr.is_empty() && sha(output.stdout.as_bytes()) == expected
}
pub(super) fn observed(
    area: &Dir,
    name: &str,
    p: &Packet,
    g: &gate::Grant,
    tool: Tool,
    args: &[String],
    caller: bool,
) -> Result<Output> {
    gate::validate(g, g, compose::now()?)?;
    let pin = match tool {
        Tool::Plutil => &p.native_enrollment.plutil_sha256,
        Tool::Retired => &p.lifecycle.retired_binary_sha256,
        Tool::Node | Tool::RetiredNode => &p.native_enrollment.node_sha256,
        _ => p
            .lifecycle
            .tool_sha256
            .get(tool.path())
            .ok_or(crate::Error::new("FIRST_LIVE_TOOL_SET"))?,
    };
    journal::append(
        area,
        &format!("{name}-intent.json"),
        &serde_json::json!({"binding":g.packet_sha256,"tool":tool.path(),"argv":args,"uid":if caller {502}else{0}}),
    )?;
    let result = process::run(
        tool,
        pin,
        args,
        if caller {
            Some((502, 20, &p.lifecycle.caller_groups))
        } else {
            None
        },
        5,
    )?;
    journal::append(area, &format!("{name}-result.json"), &result)?;
    gate::validate(g, g, compose::now()?)?;
    Ok(result)
}
pub(super) fn effective_sudo(
    area: &Dir,
    name: &str,
    p: &Packet,
    g: &gate::Grant,
) -> Result<String> {
    let value = observed(
        area,
        name,
        p,
        g,
        Tool::Sudo,
        &["-n".into(), "-l".into()],
        true,
    )?;
    require(
        sudo(&value, &p.lifecycle.effective_sudo_sha256),
        "FIRST_LIVE_PRIVILEGE_DRIFT",
    )?;
    crate::trust::digest(&value)
}
pub(super) fn legacy(area: &Dir, p: &Packet, g: &gate::Grant) -> Result<String> {
    let mut proofs = Vec::new();
    for (index, path) in retirement::LEGACY.iter().enumerate() {
        let (tool, args) = match retirement::kind(path)? {
            retirement::EntryKind::Shell => (Tool::Sh, vec![(*path).into()]),
            retirement::EntryKind::Javascript => (Tool::RetiredNode, vec![(*path).into()]),
            retirement::EntryKind::Native => (Tool::Retired, Vec::new()),
        };
        let value = observed(area, &format!("retired-{index}"), p, g, tool, &args, true)?;
        require(refusal(&value), "FIRST_LIVE_REFUSAL_FAILED")?;
        proofs.push(value);
    }
    crate::trust::digest(&proofs)
}
pub(super) fn loaded(
    area: &Dir,
    p: &Packet,
    g: &gate::Grant,
    expected: &crate::transaction::ServiceImage,
    maintenance: &super::service::Maintenance<'_>,
) -> Result<String> {
    let mut proofs = Vec::new();
    for component in &expected.components {
        require(component.loaded, "FIRST_LIVE_LOADED_DENIAL_REQUIRED")?;
        for action in ["bootout", "kickstart"] {
            maintenance.prove(expected)?;
            let mut args = vec![action.into()];
            if action == "kickstart" {
                args.push("-k".into());
            }
            args.push(component.kind.label().into());
            let name = format!(
                "{}-{action}",
                component.kind.label().rsplit('/').next().unwrap()
            );
            let output = observed(area, &name, p, g, Tool::Launchctl, &args, true)?;
            require(
                super::launchd::denied(&output),
                "FIRST_LIVE_LIFECYCLE_DENIAL",
            )?;
            maintenance.prove(expected)?;
            proofs.push(output);
        }
    }
    files::publish(
        area,
        "periodic-signal-observation.json",
        &serde_json::json!({"no_current_pid":expected.components.iter().filter(|c|c.process.is_none()).map(|c|c.kind.label()).collect::<Vec<_>>(),"forced_run":false}),
    )?;
    crate::trust::digest(&proofs)
}
#[cfg(test)]
#[path = "../../../test/first_live/native_effects/commands.rs"]
mod tests;
