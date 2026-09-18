use super::{
    intake::Intake,
    protocol::{self, Operation, Request},
};
use crate::{
    error::require,
    fs::{
        file::write_new,
        secure::{validate, Dir},
        FixtureRoots,
    },
    model::State,
    queue::Queue,
    Error, Result,
};
use std::{
    collections::BTreeMap,
    fs::File,
    os::{
        fd::AsRawFd,
        unix::{
            fs::{FileTypeExt, MetadataExt, PermissionsExt},
            net::{UnixListener, UnixStream},
        },
    },
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
pub(crate) fn now() -> Result<u64> {
    Ok(SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| Error::new("CLOCK"))?
        .as_secs())
}
struct Service {
    intake: Intake,
    queue: Queue,
    traffic: Mutex<BTreeMap<u32, (usize, u32, Instant)>>,
}
impl Service {
    fn dispatch(&self, uid: u32, gid: u32, request: Request) -> Result<serde_json::Value> {
        request.validate()?;
        let actor = self.intake.actor(uid, gid)?;
        let q = &self.queue;
        let result = match request.operation {
            Operation::Submit { proposal_digest } => {
                // Poll failures retain existing admission state; submit cannot invent a ready record.
                let _ = self.intake.poll(q);
                let mut proposal = self.intake.proposal(&proposal_digest)?;
                proposal.request_id = request.request_id;
                {
                    let submission =
                        q.submit(&self.intake.config.catalog, &actor, &proposal, now()?)?;
                    if submission.state == State::Applied {
                        q.daemon_request_verification(&actor, &submission.unit_id)?;
                    }
                    serde_json::to_value(submission)?
                }
            }
            Operation::Status { unit_id } => {
                let mut value = serde_json::to_value(q.status(&actor, &unit_id)?)?;
                value["receipt_digests"] =
                    serde_json::to_value(q.receipt_digests(&actor, &unit_id)?)?;
                value
            }
            Operation::Receipt { digest } => serde_json::from_str(&q.receipt(&actor, &digest)?)?,
            Operation::CancelPending { unit_id } => {
                let s = q.status(&actor, &unit_id)?;
                serde_json::to_value(q.cancel_pending(&actor, &unit_id, s.revision)?)?
            }
            Operation::RetryVerification { unit_id } => {
                q.daemon_request_verification(&actor, &unit_id)?;
                serde_json::json!({"queued":true})
            }
        };
        Ok(serde_json::json!({"result":result}))
    }
    fn acquire(&self, uid: u32) -> Result<()> {
        let mut traffic = self.traffic.lock().map_err(|_| Error::new("QUOTA"))?;
        require(
            traffic.values().map(|v| v.0).sum::<usize>() < 32,
            "CONNECTION_QUOTA",
        )?;
        let state = traffic.entry(uid).or_insert((0, 0, Instant::now()));
        if state.2.elapsed() >= Duration::from_secs(60) {
            state.1 = 0;
            state.2 = Instant::now();
        }
        require(state.0 < 4 && state.1 < 120, "ACTOR_QUOTA")?;
        state.0 += 1;
        state.1 += 1;
        Ok(())
    }
    fn serve(&self, mut stream: UnixStream, uid: u32, gid: u32) {
        let result = (|| {
            let raw = protocol::read_frame(&mut stream, protocol::MAX_FRAME)?;
            let request: Request = serde_json::from_slice(&raw)?;
            self.dispatch(uid, gid, request)
        })();
        let response =
            result.unwrap_or_else(|e| serde_json::json!({"error":e.code(),"state":"BLOCKED"}));
        let _ = protocol::write_frame(&mut stream, &response);
        if let Ok(mut traffic) = self.traffic.lock() {
            if let Some(state) = traffic.get_mut(&uid) {
                state.0 -= 1;
            }
        }
    }
}
fn peer(stream: &UnixStream) -> Result<(u32, u32)> {
    let (mut uid, mut gid) = (0, 0);
    require(
        unsafe { libc::getpeereid(stream.as_raw_fd(), &mut uid, &mut gid) } == 0,
        "PEER_IDENTITY",
    )?;
    Ok((uid, gid))
}
fn singleton(root: &Dir, sandbox: bool) -> Result<File> {
    let file = root.open_file(
        "daemon.lock",
        libc::O_RDWR | if sandbox { libc::O_CREAT } else { 0 },
        0o600,
    )?;
    validate(&file, root.uid, false)?;
    require(file.metadata()?.mode() & 0o777 == 0o600, "UNSAFE_MODE")?;
    require(
        unsafe { libc::flock(file.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) } == 0,
        "DAEMON_ACTIVE",
    )?;
    file.sync_all()?;
    root.file.sync_all()?;
    Ok(file)
}
pub(crate) fn queue(root: &Dir, path: &Path) -> Result<Queue> {
    for name in [
        "queue.db",
        "queue.db-wal",
        "queue.db-shm",
        "queue.db-journal",
    ] {
        match root.open_file(name, libc::O_RDONLY, 0) {
            Ok(f) => {
                validate(&f, root.uid, false)?;
                require(f.metadata()?.mode() & 0o777 == 0o600, "UNSAFE_MODE")?;
            }
            Err(e) if e.code() == "ABSENT" => {
                if name == "queue.db" {
                    write_new(
                        root,
                        name,
                        &[],
                        root.uid,
                        root.file.metadata()?.gid(),
                        0o600,
                    )?;
                }
            }
            Err(e) => return Err(e),
        }
    }
    Queue::open(path.join("queue.db"))
}
pub fn run(sandbox: bool) -> Result<()> {
    let uid = unsafe { libc::geteuid() };
    let path = if sandbox {
        require(uid != 0, "FIXTURE_REFUSES_ROOT")?;
        let path = std::env::current_dir()?;
        let roots = FixtureRoots::open(&path)?;
        let _ = roots.lock()?;
        let _ = roots.artifacts()?;
        let _ = roots.target()?;
        roots.root.mkdir("transactions")?;
        roots.root.mkdir("admitted")?;
        path
    } else {
        require(uid == 0, "PRODUCTION_REQUIRES_ROOT")?;
        require(
            std::fs::canonicalize("/var")? == Path::new("/private/var"),
            "CANONICAL_VAR_ALIAS",
        )?;
        PathBuf::from("/private/var/db/agent-deployd")
    };
    let intake = Intake::open(&path, sandbox)?;
    let _singleton = singleton(&intake.root, sandbox)?;
    super::mailbox::initialize(&intake.root)?;
    let queue = queue(&intake.root, &path)?;
    queue.require_configured_activation(intake.config.first_target_adoption.as_deref())?;
    for producer in &intake.config.producers {
        queue.register_producer(&intake.config.catalog, producer)?;
    }
    let _ = intake.poll(&queue);
    let mut train = super::train::Train::open(&intake, &queue, &path, sandbox)?;
    if !sandbox
        && intake
            .config
            .producers
            .iter()
            .any(|p| p == "local-deployment-registry")
    {
        let listener = crate::issuer::server::bind()?;
        std::thread::spawn(move || crate::issuer::server::serve(listener));
    }
    let socket_parent = if sandbox {
        path.clone()
    } else {
        PathBuf::from("/private/var/run/agent-deployd")
    };
    let protected_socket = if sandbox {
        None
    } else {
        let identities = intake
            .config
            .callers
            .iter()
            .map(|c| c.uid)
            .chain([0, 505])
            .collect();
        Some(crate::bootstrap::socket::SocketDirectory::open(
            intake
                .config
                .socket_ancestor
                .as_ref()
                .ok_or(Error::new("SOCKET_ANCESTOR_REQUIRED"))?,
            intake.config.socket_gid,
            &identities,
        )?)
    };
    let socket_dir = if let Some(socket) = &protected_socket {
        Dir {
            file: socket.child.file.try_clone()?,
            uid: 0,
        }
    } else {
        Dir::open(&socket_parent, uid)?
    };
    if !sandbox {
        require(
            socket_dir.file.metadata()?.mode() & 0o777 == 0o750
                && socket_dir.file.metadata()?.gid() == intake.config.socket_gid,
            "SOCKET_BINDING",
        )?;
    }
    if let Some(socket) = &protected_socket {
        socket.recheck()?;
    }
    let socket = socket_parent.join("control.sock");
    if let Ok(metadata) = std::fs::symlink_metadata(&socket) {
        require(
            metadata.file_type().is_socket() && metadata.uid() == uid,
            "UNSAFE_SOCKET",
        )?;
        // Own daemon singleton excludes a live peer; never remove production.lock.
        std::fs::remove_file(&socket)?;
    }
    let service = Arc::new(Service {
        intake,
        queue,
        traffic: Mutex::new(BTreeMap::new()),
    });
    let listener = UnixListener::bind(&socket)?;
    std::fs::set_permissions(
        &socket,
        std::fs::Permissions::from_mode(if sandbox { 0o600 } else { 0o660 }),
    )?;
    if !sandbox {
        use std::ffi::CString;
        let name = CString::new(socket.as_os_str().as_encoded_bytes())
            .map_err(|_| Error::new("UNSAFE_PATH"))?;
        require(
            unsafe { libc::chown(name.as_ptr(), 0, service.intake.config.socket_gid) } == 0,
            "SOCKET_BINDING",
        )?;
    }
    if let Some(socket) = &protected_socket {
        socket.recheck()?;
    }
    socket_dir.file.sync_all()?;
    let worker = service.clone();
    std::thread::spawn(move || {
        let mut last_error = None;
        loop {
            let error = train
                .tick(&worker.intake, &worker.queue)
                .err()
                .map(|e| e.code());
            if error != last_error {
                if let Some(code) = error {
                    eprintln!("BLOCKED {code}");
                }
            }
            last_error = error;
            std::thread::sleep(Duration::from_millis(100));
        }
    });
    for stream in listener.incoming() {
        let mut stream = stream?;
        let identity = peer(&stream);
        let admitted = identity.and_then(|(u, g)| {
            service.intake.actor(u, g)?;
            service.acquire(u)?;
            Ok((u, g))
        });
        match admitted {
            Ok((uid, gid)) => {
                let service = service.clone();
                std::thread::spawn(move || service.serve(stream, uid, gid));
            }
            Err(e) => {
                let _ = protocol::write_frame(
                    &mut stream,
                    &serde_json::json!({"error":e.code(),"state":"BLOCKED"}),
                );
            }
        }
    }
    Ok(())
}
