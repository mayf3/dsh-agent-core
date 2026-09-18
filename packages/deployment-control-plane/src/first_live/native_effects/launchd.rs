use super::super::process::Output;
pub(super) fn denied(output: &Output) -> bool {
    matches!(output.code, Some(1) | Some(13))
        && (output.stderr.contains("Operation not permitted")
            || output.stderr.contains("Permission denied"))
        && !output.stderr.contains("Could not find service")
        && !output.stderr.contains("No such process")
        && !output.stderr.contains("No such file")
}
#[cfg(test)]
#[path = "../../../test/first_live/native_effects/launchd.rs"]
mod tests;
fn off_observation(disabled: &Output, service: &Output) -> bool {
    let entries: Vec<_> = disabled
        .stdout
        .lines()
        .map(str::trim)
        .filter_map(|s| s.strip_prefix("\"ai.agent-deployd\" => "))
        .collect();
    disabled.code == Some(0)
        && disabled.stdout.contains("disabled services = {")
        && entries == ["true"]
        && service.code == Some(113)
        && (service.stdout.contains("Could not find service")
            || service.stderr.contains("Could not find service"))
}
pub(super) fn controller_off(
    area: &crate::fs::secure::Dir,
    phase: &str,
    p: &super::super::packet::Packet,
    g: &super::super::gate::Grant,
) -> crate::Result<String> {
    use super::super::process::Tool;
    let disabled = super::commands::observed(
        area,
        &format!("{phase}-controller-disabled"),
        p,
        g,
        Tool::Launchctl,
        &["print-disabled".into(), "system".into()],
        false,
    )?;
    let service = super::commands::observed(
        area,
        &format!("{phase}-controller-unloaded"),
        p,
        g,
        Tool::Launchctl,
        &["print".into(), "system/ai.agent-deployd".into()],
        false,
    )?;
    crate::error::require(
        off_observation(&disabled, &service),
        "FIRST_LIVE_CONTROLLER_NOT_DISABLED",
    )?;
    crate::trust::digest(&(disabled, service))
}
