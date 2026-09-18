//! Separate nonmutating producer intake; the controller retains its five operations.
use super::{
    coordinator::{prepare_native, FreezeRequest},
    custody::ROOT,
};
use crate::{
    bootstrap::socket::SocketDirectory,
    error::require,
    service::{protocol, Intake},
    Error, Result,
};
use std::{
    io::Write,
    os::{
        fd::AsRawFd,
        unix::{
            fs::{FileTypeExt, MetadataExt, PermissionsExt},
            net::{UnixListener, UnixStream},
        },
    },
    path::Path,
    time::{Duration, Instant},
};
const SOCKET: &str = "/private/var/run/agent-deployd/issuer.sock";

pub(crate) fn bind() -> Result<UnixListener> {
    require(unsafe { libc::geteuid() } == 0, "ISSUER_REQUIRES_ROOT")?;
    let intake = Intake::open(Path::new(ROOT), false)?;
    let ids = intake
        .config
        .callers
        .iter()
        .map(|c| c.uid)
        .chain([0, 505])
        .collect();
    let proof = intake
        .config
        .socket_ancestor
        .as_ref()
        .ok_or(Error::new("SOCKET_BINDING"))?;
    let parent = SocketDirectory::open(proof, intake.config.socket_gid, &ids)?;
    // Caller owns daemon.lock before this function. Only a previous root socket at
    // this exact endpoint can be retired; no generic caller nominated pathname.
    match std::fs::symlink_metadata(SOCKET) {
        Ok(meta) => {
            require(
                meta.file_type().is_socket()
                    && meta.uid() == 0
                    && meta.gid() == intake.config.socket_gid,
                "SOCKET_BINDING",
            )?;
            require(UnixStream::connect(SOCKET).is_err(), "ISSUER_ACTIVE")?;
            parent.child.unlink("issuer.sock")?;
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => (),
        Err(_) => return Err(Error::new("SOCKET_BINDING")),
    }
    let listener = UnixListener::bind(SOCKET)?;
    let raw = std::ffi::CString::new(SOCKET).map_err(|_| Error::new("SOCKET_BINDING"))?;
    require(
        unsafe { libc::chown(raw.as_ptr(), 0, intake.config.socket_gid) } == 0,
        "SOCKET_BINDING",
    )?;
    std::fs::set_permissions(SOCKET, std::fs::Permissions::from_mode(0o660))?;
    parent.recheck()?;
    Ok(listener)
}
pub(crate) fn serve(listener: UnixListener) {
    let mut last = Instant::now() - Duration::from_secs(1);
    // One supervised job at a time. No request can multiply root worker threads.
    for stream in listener.incoming() {
        let Ok(mut stream) = stream else { break };
        let result = (|| {
            stream.set_read_timeout(Some(Duration::from_secs(2)))?;
            stream.set_write_timeout(Some(Duration::from_secs(2)))?;
            let (mut uid, mut gid) = (0, 0);
            require(
                unsafe { libc::getpeereid(stream.as_raw_fd(), &mut uid, &mut gid) } == 0,
                "PEER_IDENTITY",
            )?;
            let intake = Intake::open(Path::new(ROOT), false)?;
            let actor = intake.actor(uid, gid)?;
            require(
                uid == 502
                    && gid == 20
                    && actor
                        .allowed_producers
                        .iter()
                        .any(|p| p == "local-deployment-registry"),
                "CALLER_DENIED",
            )?;
            require(last.elapsed() >= Duration::from_secs(1), "ISSUER_QUOTA")?;
            last = Instant::now();
            let bytes = protocol::read_frame(&mut stream, 4096)?;
            let request: FreezeRequest = serde_json::from_slice(&bytes)?;
            let digest = prepare_native(&request.goal_id, &request.source_sha)?;
            Ok(serde_json::json!({"proposal_digest":digest}))
        })();
        let response = result.unwrap_or_else(
            |e: crate::Error| serde_json::json!({"state":"BLOCKED","error":e.code()}),
        );
        let _ = protocol::write_frame(&mut stream, &response);
        let _ = stream.flush();
    }
}
pub fn request(goal_id: &str, source_sha: &str) -> Result<serde_json::Value> {
    require(unsafe { libc::geteuid() } != 0, "CLIENT_REFUSES_ROOT")?;
    crate::trust::valid_id(goal_id)?;
    super::source::source_sha(source_sha)?;
    let mut stream = UnixStream::connect(SOCKET)?;
    let (mut uid, mut gid) = (u32::MAX, u32::MAX);
    require(
        unsafe { libc::getpeereid(stream.as_raw_fd(), &mut uid, &mut gid) } == 0 && uid == 0,
        "PEER_IDENTITY",
    )?;
    stream.set_read_timeout(Some(Duration::from_secs(900)))?;
    stream.set_write_timeout(Some(Duration::from_secs(2)))?;
    protocol::write_frame(
        &mut stream,
        &FreezeRequest {
            goal_id: goal_id.into(),
            source_sha: source_sha.into(),
        },
    )?;
    Ok(serde_json::from_slice(&protocol::read_frame(
        &mut stream,
        4096,
    )?)?)
}
