use super::{
    credentials::Identity,
    launch::{self, Metadata},
    policy::Role,
};
use crate::{Error, Result};
pub(super) fn join(role: &Role, identity: &Identity, metadata: &Metadata) -> Result<()> {
    use crate::error::require;
    require(
        identity.pid == metadata.pid
            && identity.executable.as_deref() == Some(role.resolved_path.as_str())
            && identity.credentials.root_capable(),
        "HOST_ROLE_ATTRIBUTION",
    )?;
    match role.class.as_str() {
        "OS_LAUNCH_DAEMON_STATIC_CANDIDATE"
        | "APPLE_PROTECTED_LAUNCH_ROLE"
        | "THIRD_PARTY_AUTHORITY_REQUIRED" => require(
            metadata.kind == "LaunchDaemon"
                && role.authorities.iter().any(|authority| {
                    metadata.domain_service == format!("system/{}", authority.label)
                        && metadata.path == authority.path
                        && metadata.program == authority.program
                }),
            "HOST_ROLE_ATTRIBUTION",
        ),
        "APPLE_FIXED_SUBMITTED_HELPER_ROLE" => require(
            role.fixed_launch_target.as_deref() == Some(metadata.domain_service.as_str())
                && metadata.kind == "Submitted"
                && metadata.program == role.path
                && metadata.path.starts_with("(submitted by ")
                && metadata.path.ends_with(')'),
            "HOST_ROLE_ATTRIBUTION",
        ),
        "APPLE_FIXED_INSTANCE_LAUNCH_ROLE" => {
            let identifier = role
                .identifier
                .as_deref()
                .ok_or_else(|| Error::new("HOST_ROLE_ATTRIBUTION"))?;
            let label = metadata
                .domain_service
                .strip_prefix("system/")
                .ok_or_else(|| Error::new("HOST_ROLE_ATTRIBUTION"))?;
            require(
                identifier == "com.apple.loginwindow"
                    && launch::valid_instance_label(label, "com.apple.loginwindow.")
                    && metadata.kind == "LaunchDaemon"
                    && role.authorities.iter().any(|authority| {
                        metadata.path == authority.path
                            && metadata.program == authority.program
                            && authority.label == identifier
                    }),
                "HOST_ROLE_ATTRIBUTION",
            )
        }
        "APPLE_FIXED_XPC_ROLE" => {
            let identifier = role
                .identifier
                .as_deref()
                .ok_or_else(|| Error::new("HOST_ROLE_ATTRIBUTION"))?;
            let target = match role.service_type.as_deref() {
                Some("System") => format!("system/{identifier}"),
                Some("Application") | Some("User") => format!("pid/{}/{identifier}", identity.pid),
                _ => return Err(Error::new("HOST_ROLE_ATTRIBUTION")),
            };
            let bundle = role
                .bundle_path
                .as_deref()
                .and_then(|p| p.strip_suffix("/Contents/Info.plist"))
                .ok_or_else(|| Error::new("HOST_ROLE_ATTRIBUTION"))?;
            require(
                metadata.domain_service == target
                    && metadata.kind == "XPCService"
                    && metadata.program == role.path
                    && metadata.path == bundle,
                "HOST_ROLE_ATTRIBUTION",
            )
        }
        _ => Err(Error::new("HOST_ROLE_ATTRIBUTION")),
    }
}
#[cfg(test)]
#[path = "../../../../test/first_live/host/attribution.rs"]
mod tests;
