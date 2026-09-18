use super::{
    attribution,
    context::{Context, LaunchObservation},
    credentials::Identity,
    environment, image, macho,
    policy::Role,
    reader, signature,
};
use crate::{error::require, Error, Result};
use std::collections::{BTreeMap, BTreeSet};
#[derive(serde::Serialize)]
pub(super) struct Observation {
    identity: Identity,
    role: String,
    image: image::Image,
    code_identity: Vec<u8>,
    authorities: BTreeMap<String, String>,
    launch: Option<LaunchObservation>,
    loaders: BTreeMap<String, String>,
    loader_environment: Option<String>,
}
fn platform_library(path: &str) -> bool {
    (path.starts_with("/usr/lib/") || path.starts_with("/System/Library/"))
        && path
            .split('/')
            .skip(1)
            .all(|p| !p.is_empty() && p != "." && p != "..")
}
fn closure(role: &Role, initial: &image::Image) -> Result<BTreeMap<String, String>> {
    if sealed_entry(&role.resolved_path) {
        return Ok(BTreeMap::new());
    }
    let cpu = if cfg!(target_arch = "aarch64") {
        0x0100000c
    } else {
        0x01000007
    };
    let mut pending = macho::dependencies(&initial.bytes, cpu)?;
    let mut seen = BTreeSet::new();
    let mut result = BTreeMap::new();
    let mut total = initial.bytes.len();
    while let Some(path) = pending.pop() {
        if platform_library(&path) || !seen.insert(path.clone()) {
            continue;
        }
        require(
            seen.len() <= 64
                && (path.starts_with("/Library/Developer/PrivateFrameworks/")
                    || path.starts_with("/Library/Apple/System/Library/")),
            "HOST_LOADER_CLOSURE",
        )?;
        let image = image::protected(&path)?;
        total += image.bytes.len();
        require(total <= 512 * 1024 * 1024, "HOST_LOADER_CLOSURE")?;
        signature::static_apple(&path, None)?;
        pending.extend(macho::dependencies(&image.bytes, cpu)?);
        result.insert(path, image.digest);
    }
    Ok(result)
}
pub(super) fn prove(ctx: &Context<'_>, role: &Role, identity: &Identity) -> Result<Observation> {
    ctx.check()?;
    require(
        reader::identity(identity.pid)? == *identity,
        "HOST_CENSUS_DRIFT",
    )?;
    let loader_environment = (!sealed_entry(&role.resolved_path))
        .then(|| environment::running(identity.pid))
        .transpose()?;
    let code = image::protected(&role.resolved_path)?;
    if let Some(expected) = &role.executable_sha256 {
        require(code.digest == *expected, "HOST_ROLE_CODE_DRIFT")?;
    }
    let signed = if role.resolved_path == "/Library/PrivilegedHelperTools/com.docker.vmnetd" {
        signature::running_docker(identity.pid, &role.resolved_path)?
    } else {
        signature::running_apple(
            identity.pid,
            &role.resolved_path,
            role.identifier.as_deref(),
        )?
    };
    let mut authorities = BTreeMap::new();
    for a in &role.authorities {
        let actual = image::protected(&a.path)?;
        require(actual.digest == a.sha256, "HOST_ROLE_AUTHORITY_DRIFT")?;
        authorities.insert(a.path.clone(), actual.digest);
    }
    if let Some(path) = &role.bundle_path {
        let actual = image::protected(path)?;
        require(
            role.bundle_sha256.as_deref() == Some(actual.digest.as_str()),
            "HOST_ROLE_AUTHORITY_DRIFT",
        )?;
        authorities.insert(path.clone(), actual.digest);
    }
    let launch = match role.class.as_str() {
        "OS_INIT_STATIC_CANDIDATE" => {
            require(
                identity.pid == 1
                    && identity.parent_pid == 0
                    && role.resolved_path == "/sbin/launchd",
                "HOST_INIT_ROLE",
            )?;
            None
        }
        "APPLE_SETUID_OWNER_LOGIN_ROLE" => {
            login(role, identity)?;
            None
        }
        "APPLE_FIXED_SUBMITTED_HELPER_ROLE" => {
            let target = role
                .fixed_launch_target
                .as_deref()
                .ok_or_else(|| Error::new("HOST_ROLE_ATTRIBUTION"))?;
            let found = ctx.query(target)?;
            attribution::join(role, identity, &found.metadata)?;
            Some(found)
        }
        "APPLE_FIXED_XPC_ROLE" => {
            let id = role
                .identifier
                .as_deref()
                .ok_or_else(|| Error::new("HOST_ROLE_ATTRIBUTION"))?;
            let target = match role.service_type.as_deref() {
                Some("System") => format!("system/{id}"),
                Some("Application") | Some("User") => format!("pid/{}/{id}", identity.pid),
                _ => return Err(Error::new("HOST_ROLE_ATTRIBUTION")),
            };
            let found = ctx.query(&target)?;
            attribution::join(role, identity, &found.metadata)?;
            Some(found)
        }
        _ => {
            let mut found = None;
            for authority in &role.authorities {
                if let Some(observation) =
                    ctx.query_optional(&format!("system/{}", authority.label))?
                {
                    if observation.metadata.pid == identity.pid {
                        attribution::join(role, identity, &observation.metadata)?;
                        require(found.is_none(), "HOST_ROLE_AMBIGUOUS")?;
                        found = Some(observation);
                    }
                }
            }
            Some(found.ok_or_else(|| Error::new("HOST_ROLE_ATTRIBUTION"))?)
        }
    };
    let loaders = closure(role, &code)?;
    if let Some(before) = &loader_environment {
        require(
            environment::running(identity.pid)? == *before,
            "HOST_ENVIRONMENT_DRIFT",
        )?;
    }
    let after = image::protected(&role.resolved_path)?;
    require(
        after.digest == code.digest
            && after.device == code.device
            && after.inode == code.inode
            && reader::identity(identity.pid)? == *identity,
        "HOST_CENSUS_DRIFT",
    )?;
    ctx.check()?;
    Ok(Observation {
        identity: identity.clone(),
        role: role.class.clone(),
        image: code,
        code_identity: signed,
        authorities,
        launch,
        loaders,
        loader_environment,
    })
}
fn login(role: &Role, identity: &Identity) -> Result<()> {
    use std::os::unix::fs::{FileTypeExt, MetadataExt};
    let c = &identity.credentials;
    require(
        c.real_uid == 502
            && c.effective_uid == 0
            && c.saved_uid == 0
            && c.real_gid == 20
            && c.effective_gid == 20
            && c.saved_gid == 20
            && identity.session_id.is_some_and(|s| s > 0),
        "HOST_LOGIN_ROLE",
    )?;
    let tty = role
        .tty
        .as_deref()
        .ok_or_else(|| Error::new("HOST_LOGIN_ROLE"))?;
    require(matches!(tty, "ttys000" | "ttys017"), "HOST_LOGIN_ROLE")?;
    let metadata = std::fs::symlink_metadata(format!("/dev/{tty}"))?;
    require(
        metadata.file_type().is_char_device()
            && metadata.rdev() == identity.tty_device as u64
            && metadata.uid() == 502,
        "HOST_LOGIN_ROLE",
    )
}

fn sealed_entry(path: &str) -> bool {
    [
        "/System/Library/",
        "/usr/lib/",
        "/usr/libexec/",
        "/usr/bin/",
        "/usr/sbin/",
        "/sbin/",
        "/bin/",
    ]
    .iter()
    .any(|prefix| path.starts_with(prefix))
        && path
            .split('/')
            .skip(1)
            .all(|part| !part.is_empty() && part != "." && part != "..")
}
#[cfg(test)]
#[path = "../../../../test/first_live/host/inspect.rs"]
mod tests;
