//! Exact one-shot recovery for the retained 2097 dsh generation.
//! No request data selects paths, commands, identities, or effects.
use super::{files, inventory, inventory_path, journal, process};
use crate::{
    error::require,
    fs::{
        file::{sha, snapshot, write_new, FileImage},
        secure::{reject_acl, Dir},
        MutationGuard,
    },
    trust::digest,
    Error, Result,
};
use serde_json::Value;
use std::{
    net::{SocketAddr, TcpStream},
    os::unix::fs::MetadataExt,
    path::Path,
    time::{Duration, Instant},
};

const OP: &str = "pdc-fasttrack-runtime-closure-recovery-20260921-02";
const PACKET: &str = "/private/var/db/agent-deployd/recovery-packets/pdc-fasttrack-runtime-closure-recovery-20260921-02";
const EXECUTABLE: &str = "/private/var/db/agent-deployd/recovery-packets/pdc-fasttrack-runtime-closure-recovery-20260921-02/agent-deployd";
const LIVE: &str = "/usr/local/libexec/agent-core";
const BACKUP: &str = "/usr/local/libexec/agent-core.bak-20260921-072049";
const STAGING: &str = ".pdc-runtime-closure-recovery-20260921-02-harness";
const LABEL: &str = "system/ai.agent-core.runtime";
const PLIST: &str = "ai.agent-core.runtime.plist";
const LAUNCHCTL_SHA: &str = "b4dbf509754d8e1117f7851baa93ede75bc75218c48d6ddf19fbb1505d261be7";
const CP_SHA: &str = "f0629f462c6535f7b1a19f559b7093638e714961bea9228cfb2ae7896f8557f4";
const LSOF_SHA: &str = "b1b9151bbc56f4749890dbe4e533af9a4f8700240ad431a6c9ddf70fe137c165";
const EMPTY_SHA: &str = "95db062c891d1d3628c1f2fde50e2e1801b8568f99994b1e95d23ff036130c4e";
const AUTHORITY_SHA: &str = "e0800b0fde6fc46b2873decd0f83c9b807b48b56cc3c9ad9cf578a5685b5b6fe";
const INVENTORY_SHA: &str = "dd546e83d724da67dba5b02da5af6bf0c488a2ff3dfabeca35748aa24b2da0b5";
const PLIST_BEFORE_SHA: &str = "dc715fd8b73c6debfd35dd54c61fd55f38ff0e3f0f8937ebdc7cfa4afde3c3d9";
const PLIST_AFTER_SHA: &str = "27f8c42989d7ffa09dc49707b54cdb7d741357a5eceab42269aad1fa2e63a8f9";
const SOURCE: &str = "2097e4f948dca77a12d24afa1ff9fb42e9ec7756";
const PROVENANCE_SHA: &str = "bede66f18fa352b09c58b56bc045a180181145c9f2a2ea56db7e8d5bc9a5bb71";
const WORKFLOW_SHA: &str = "6f116d94b58a739216d2af2b25dfd51b32268aba26dcea281f16199f70ff93b2";
const SELF_OPS_SHA: &str = "e7f6105de4be81e37ccc60e983fe005751880d9b8a0af93c9e0602a78da87620";
const NODE_SHA: &str = "c6c9bfa8eb5d0c6799e1fd7e246f5c6036d4863b5d3173625f37d952576ca93b";
const RUNTIME_SHA: &str = "6a35dab738acdbdfd9bb9abe5632a9b949426bca15f09a73383428e4762c8588";

fn exact_dir(path: &str, uid: u32, identity: (u64, u64, u32, u32, u32, u32)) -> Result<Dir> {
    let dir = Dir::open(Path::new(path), uid)?;
    let m = dir.file.metadata()?;
    require(
        (
            m.dev(),
            m.ino(),
            m.uid(),
            m.gid(),
            m.mode() & 0o7777,
            std::os::macos::fs::MetadataExt::st_flags(&m),
        ) == identity,
        "RUNTIME_CLOSURE_DIRECTORY_DRIFT",
    )?;
    reject_acl(&dir.file)?;
    Ok(dir)
}

fn exact_image(
    image: &FileImage,
    identity: (u64, u64, u32, u32, u32, u64),
    digest: &str,
) -> Result<()> {
    require(
        (
            image.device,
            image.inode,
            image.uid,
            image.gid,
            image.mode,
            image.bytes.len() as u64,
        ) == identity
            && sha(&image.bytes) == digest,
        "RUNTIME_CLOSURE_FILE_DRIFT",
    )
}

fn validate_authority(bytes: &[u8]) -> Result<()> {
    require(
        sha(bytes) == AUTHORITY_SHA,
        "RUNTIME_CLOSURE_AUTHORITY_DRIFT",
    )?;
    validate_authority_shape(bytes)
}

fn validate_authority_shape(bytes: &[u8]) -> Result<()> {
    let value: Value = serde_json::from_slice(bytes)?;
    require(value["version"] == 1, "RUNTIME_CLOSURE_AUTHORITY_SCHEMA")?;
    let agents = value["agents"]
        .as_array()
        .ok_or(Error::new("RUNTIME_CLOSURE_AUTHORITY_SCHEMA"))?;
    let default = value["defaultAgentId"]
        .as_str()
        .ok_or(Error::new("RUNTIME_CLOSURE_AUTHORITY_SCHEMA"))?;
    require(
        agents.len() == 98 && default == "agt_fb7837711a9d4c3393dcffa83f49dd41",
        "RUNTIME_CLOSURE_AUTHORITY_SCHEMA",
    )?;
    let matches = agents
        .iter()
        .filter(|v| v["id"] == default && v["disabled"] != true)
        .count();
    let ids: std::collections::BTreeSet<_> =
        agents.iter().filter_map(|v| v["id"].as_str()).collect();
    require(
        matches == 1 && ids.len() == 98,
        "RUNTIME_CLOSURE_AUTHORITY_SCHEMA",
    )
}

fn linked() -> Result<()> {
    let path = Path::new("/Users/authsvc/.agent-core/agents.json");
    let m = std::fs::symlink_metadata(path)?;
    require(
        m.file_type().is_symlink()
            && m.dev() == 16777232
            && m.ino() == 92447502
            && std::fs::read_link(path)?
                == Path::new("/usr/local/libexec/agent-core/config/agents.json"),
        "RUNTIME_CLOSURE_AUTHORITY_LINK_DRIFT",
    )
}

fn require_listener_absent(address: SocketAddr) -> Result<()> {
    match TcpStream::connect_timeout(&address, Duration::from_secs(1)) {
        Err(error) if error.kind() == std::io::ErrorKind::ConnectionRefused => Ok(()),
        _ => Err(Error::new("RUNTIME_CLOSURE_FOREIGN_LISTENER")),
    }
}

fn listener_census(process: &crate::transaction::ProcessIdentity) -> Result<Value> {
    let mut evidence = serde_json::Map::new();
    for port in [8787u16, 8790u16] {
        require(
            crate::transaction::first_live_process_identity(process.pid)? == *process,
            "RUNTIME_CLOSURE_PROCESS_DRIFT",
        )?;
        let output = process::run(
            process::Tool::Lsof,
            LSOF_SHA,
            &[
                "-nP".into(),
                "-a".into(),
                "-p".into(),
                process.pid.to_string(),
                format!("-iTCP:{port}"),
                "-sTCP:LISTEN".into(),
                "-FpcfnPT".into(),
            ],
            None,
            10,
        )?;
        require(
            output.code == Some(0) && output.stderr.is_empty(),
            "RUNTIME_CLOSURE_LISTENER_UNKNOWN",
        )?;
        validate_listener_output(&output.stdout, process.pid, port)?;
        evidence.insert(
            port.to_string(),
            serde_json::json!({"sha256":sha(output.stdout.as_bytes())}),
        );
    }
    require(
        crate::transaction::first_live_process_identity(process.pid)? == *process,
        "RUNTIME_CLOSURE_PROCESS_DRIFT",
    )?;
    Ok(Value::Object(evidence))
}

fn validate_listener_output(stdout: &str, pid: u32, port: u16) -> Result<()> {
    let lines = stdout.lines().collect::<Vec<_>>();
    require(
        lines
            .iter()
            .filter(|line| **line == format!("p{pid}"))
            .count()
            == 1
            && lines.iter().filter(|line| line.starts_with('c')).count() == 1
            && lines
                .iter()
                .filter(|line| {
                    line.strip_prefix('f')
                        .and_then(|value| value.trim_end_matches('u').parse::<u32>().ok())
                        .is_some()
                })
                .count()
                == 1
            && lines.iter().filter(|line| **line == "PTCP").count() == 1
            && lines
                .iter()
                .filter(|line| **line == format!("n127.0.0.1:{port}"))
                .count()
                == 1
            && lines.iter().filter(|line| **line == "TST=LISTEN").count() == 1
            && lines.iter().all(|line| {
                line == &format!("p{pid}")
                    || line
                        .strip_prefix('c')
                        .is_some_and(|value| !value.is_empty() && value.is_ascii())
                    || line
                        .strip_prefix('f')
                        .and_then(|value| value.trim_end_matches('u').parse::<u32>().ok())
                        .is_some()
                    || *line == "PTCP"
                    || *line == format!("n127.0.0.1:{port}")
                    || *line == "TST=LISTEN"
                    || line
                        .strip_prefix("TQR=")
                        .is_some_and(|value| value.parse::<u64>().is_ok())
                    || line
                        .strip_prefix("TQS=")
                        .is_some_and(|value| value.parse::<u64>().is_ok())
            }),
        "RUNTIME_CLOSURE_LISTENER_UNKNOWN",
    )
}

fn verify_payload(app: &Dir, node_dir: &Dir) -> Result<()> {
    require(
        sha(&snapshot(
            &app.open_file("pack-provenance.json", libc::O_RDONLY, 0)?,
            505,
            1024 * 1024,
        )?
        .bytes)
            == PROVENANCE_SHA,
        "RUNTIME_CLOSURE_APP_DRIFT",
    )?;
    for (path, expected) in [
        ("packages/broker/src/capabilities/workflow.js", WORKFLOW_SHA),
        ("packages/broker/src/capabilities/self-ops.js", SELF_OPS_SHA),
        ("scripts/production-runtime.mjs", RUNTIME_SHA),
    ] {
        require(
            sha(&snapshot(
                &inventory_path::descendant(&app.file, path, libc::O_RDONLY)?,
                505,
                128 * 1024 * 1024,
            )?
            .bytes)
                == expected,
            "RUNTIME_CLOSURE_APP_DRIFT",
        )?;
    }
    require(
        sha(&snapshot(
            &node_dir.open_file("node", libc::O_RDONLY, 0)?,
            0,
            512 * 1024 * 1024,
        )?
        .bytes)
            == NODE_SHA,
        "RUNTIME_CLOSURE_NODE_DRIFT",
    )
}

fn packet_file(packet: &Dir, name: &str, expected: &str, limit: u64) -> Result<Vec<u8>> {
    let image = snapshot(&packet.open_file(name, libc::O_RDONLY, 0)?, 0, limit)?;
    require(
        image.uid == 0 && image.gid == 0 && image.mode == 0o400 && sha(&image.bytes) == expected,
        "RUNTIME_CLOSURE_PACKET_DRIFT",
    )?;
    Ok(image.bytes)
}

fn observed(area: &Dir, name: &str, args: &[&str]) -> Result<process::Output> {
    journal::append(
        area,
        &format!("{name}-intent.json"),
        &serde_json::json!({"operation_id":OP,"argv":args}),
    )?;
    let output = process::run(
        process::Tool::Launchctl,
        LAUNCHCTL_SHA,
        &args.iter().map(|v| v.to_string()).collect::<Vec<_>>(),
        None,
        10,
    )?;
    journal::append(area, &format!("{name}-result.json"), &output)?;
    Ok(output)
}

fn success(area: &Dir, name: &str, args: &[&str]) -> Result<()> {
    let output = observed(area, name, args)?;
    require(
        output.code == Some(0) && output.stderr.is_empty(),
        "RUNTIME_CLOSURE_EFFECT_UNKNOWN",
    )
}

fn current_service(area: &Dir, name: &str) -> Result<process::Output> {
    observed(area, name, &["print", LABEL])
}

fn stage_file(
    dir: &Dir,
    name: &str,
    bytes: &[u8],
    uid: u32,
    gid: u32,
    mode: u32,
) -> Result<FileImage> {
    files::absent(dir, name)?;
    let file = write_new(dir, name, bytes, uid, gid, mode)?;
    snapshot(&file, uid, 1024 * 1024)
}

fn apply_file(
    dir: &Dir,
    name: &str,
    temporary: &str,
    before: &FileImage,
    prepared: &FileImage,
) -> Result<FileImage> {
    let current = snapshot(
        &dir.open_file(name, libc::O_RDONLY, 0)?,
        before.uid,
        1024 * 1024,
    )?;
    require(current == *before, "RUNTIME_CLOSURE_PREIMAGE_DRIFT")?;
    dir.rename(temporary, dir, name)?;
    let after = snapshot(
        &dir.open_file(name, libc::O_RDONLY, 0)?,
        prepared.uid,
        1024 * 1024,
    )?;
    require(after == *prepared, "RUNTIME_CLOSURE_POSTIMAGE_DRIFT")?;
    Ok(after)
}

fn execute() -> Result<Value> {
    require(
        unsafe { libc::geteuid() } == 0,
        "RUNTIME_CLOSURE_ROOT_REQUIRED",
    )?;
    require(
        std::env::current_exe()? == Path::new(EXECUTABLE),
        "RUNTIME_CLOSURE_FIXED_EXECUTABLE",
    )?;
    let control = Dir::open(Path::new("/private/var/db/agent-deployd"), 0)?;
    let guard = MutationGuard::acquire(&control, false)?;
    guard.binds(&control)?;
    files::absent(&control, OP)?;
    let area = control.mkdir(OP)?;
    journal::append(
        &area,
        "operation-intent.json",
        &serde_json::json!({"operation_id":OP,"source":SOURCE,"attempt_limit":1,"rollback":"unknown-retained"}),
    )?;

    let packet = Dir::open(Path::new(PACKET), 0)?;
    let authority = packet_file(&packet, "agents-authority.json", AUTHORITY_SHA, 1024 * 1024)?;
    validate_authority(&authority)?;
    let inventory_raw = packet_file(
        &packet,
        "harness-inventory.json",
        INVENTORY_SHA,
        64 * 1024 * 1024,
    )?;
    let inventory: inventory::Tree = serde_json::from_slice(&inventory_raw)?;
    let target_plist = packet_file(
        &packet,
        "ai.agent-core.runtime.plist",
        PLIST_AFTER_SHA,
        1024 * 1024,
    )?;

    let live = exact_dir(LIVE, 0, (16777232, 92334720, 0, 0, 0o755, 0))?;
    let app = exact_dir(
        &format!("{LIVE}/app"),
        505,
        (16777232, 92334722, 505, 601, 0o755, 0),
    )?;
    let config = exact_dir(
        &format!("{LIVE}/config"),
        505,
        (16777232, 92334724, 505, 601, 0o700, 0),
    )?;
    let backup = exact_dir(BACKUP, 0, (16777232, 55990799, 0, 0, 0o755, 0))?;
    let harness_source_file = backup.open_file("harness", libc::O_RDONLY | libc::O_DIRECTORY, 0)?;
    let hm = harness_source_file.metadata()?;
    require(
        (
            hm.dev(),
            hm.ino(),
            hm.uid(),
            hm.gid(),
            hm.mode() & 0o7777,
            std::os::macos::fs::MetadataExt::st_flags(&hm),
            hm.nlink(),
        ) == (16777232, 60266135, 505, 601, 0o755, 0, 61),
        "RUNTIME_CLOSURE_HARNESS_SOURCE_DRIFT",
    )?;
    files::absent(&live, "harness")?;
    files::absent(&live, STAGING)?;
    linked()?;

    let agents_before = snapshot(
        &config.open_file("agents.json", libc::O_RDONLY, 0)?,
        505,
        1024 * 1024,
    )?;
    exact_image(
        &agents_before,
        (16777232, 92443034, 505, 601, 0o600, 61),
        EMPTY_SHA,
    )?;
    let credentials_before = snapshot(
        &config.open_file("agent-credentials.json", libc::O_RDONLY, 0)?,
        505,
        64 * 1024 * 1024,
    )?;
    let plist_dir = exact_dir(
        "/Library/LaunchDaemons",
        0,
        (16777232, 59186137, 0, 0, 0o755, 0),
    )?;
    let plist_before = snapshot(
        &plist_dir.open_file(PLIST, libc::O_RDONLY, 0)?,
        0,
        1024 * 1024,
    )?;
    require(
        plist_before.inode == 83405977
            && plist_before.uid == 0
            && plist_before.gid == 0
            && plist_before.mode == 0o644
            && sha(&plist_before.bytes) == PLIST_BEFORE_SHA,
        "RUNTIME_CLOSURE_PLIST_DRIFT",
    )?;
    let node_dir = Dir::open(Path::new(&format!("{LIVE}/node-runtime/bin")), 0)?;
    verify_payload(&app, &node_dir)?;
    require_listener_absent("127.0.0.1:8787".parse().unwrap())?;
    require_listener_absent("127.0.0.1:8790".parse().unwrap())?;
    let prior_service = current_service(&area, "preimage-service")?;
    require(
        prior_service.code == Some(0)
            && prior_service
                .stdout
                .contains("d602b592fad345fb1c9adebe2bc6611a6f5cfdc2"),
        "RUNTIME_CLOSURE_SERVICE_DRIFT",
    )?;
    let prior_fields = crate::transaction::parse_launchd(&prior_service.stdout)?;
    require(
        prior_fields.get("state").map(String::as_str) != Some("running")
            && !prior_fields.contains_key("pid"),
        "RUNTIME_CLOSURE_SERVICE_DRIFT",
    )?;
    let expected_runtime_argv = vec![
        format!("{LIVE}/node-runtime/bin/node"),
        format!("{LIVE}/app/scripts/production-runtime.mjs"),
        "--root".into(),
        "/Users/authsvc/.agent-core".into(),
        "--catchup".into(),
        "0".into(),
    ];
    crate::transaction::prove_no_service_process(&expected_runtime_argv)?;
    journal::append(
        &area,
        "private-preimage.json",
        &serde_json::json!({
            "operation_id":OP,
            "agents":agents_before,
            "credentials":credentials_before,
            "plist":plist_before,
            "harness":"ABSENT",
            "staging":"ABSENT",
            "service_output":prior_service.stdout,
            "service_fields":prior_fields,
            "runtime_process":"ABSENT",
            "runtime_argv":expected_runtime_argv,
            "validated_flags":{"agents":0,"credentials":0,"plist":0,"live":0,"app":0,"config":0},
            "validated_acl":"ABSENT",
            "rollback":"UNSAFE_ROLLBACK_QUARANTINE_ONLY"
        }),
    )?;
    journal::append(
        &area,
        "preflight-result.json",
        &serde_json::json!({"root_inode":92334720u64,"app_inode":92334722u64,"agents_sha256":EMPTY_SHA,"plist_sha256":PLIST_BEFORE_SHA,"source":SOURCE}),
    )?;
    files::publish(
        &control,
        "runtime-closure-recovery-pending.json",
        &serde_json::json!({"operation_id":OP,"state":"MUTATION_PENDING","retry_forbidden":true}),
    )?;

    success(&area, "runtime-bootout", &["bootout", LABEL])?;
    let absent = current_service(&area, "runtime-stopped-readback")?;
    require(
        absent.code == Some(113)
            && (absent.stdout.contains("Could not find service")
                || absent.stderr.contains("Could not find service")),
        "RUNTIME_CLOSURE_STOP_UNKNOWN",
    )?;

    journal::append(
        &area,
        "harness-stage-intent.json",
        &serde_json::json!({"source_inode":60266135u64,"destination":STAGING}),
    )?;
    let cp = process::run(
        process::Tool::Cp,
        CP_SHA,
        &[
            "-cR".into(),
            format!("{BACKUP}/harness"),
            format!("{LIVE}/{STAGING}"),
        ],
        None,
        60,
    )?;
    journal::append(
        &area,
        "harness-copy-command-result.json",
        &serde_json::json!({"code":cp.code,"stdout":cp.stdout,"stderr":cp.stderr}),
    )?;
    require(
        cp.code == Some(0) && cp.stdout.is_empty() && cp.stderr.is_empty(),
        "RUNTIME_CLOSURE_COPY_UNKNOWN",
    )?;
    let stage_handle = live.open_file(STAGING, libc::O_RDONLY | libc::O_DIRECTORY, 0)?;
    let staged = Dir {
        file: stage_handle,
        uid: 505,
    };
    let staged_tree = inventory::capture_equivalent(&staged, &inventory, true)?;
    journal::append(
        &area,
        "harness-stage-result.json",
        &serde_json::json!({"tree_digest":digest(&staged_tree)?,"entries":staged_tree.entries.len()}),
    )?;

    journal::append(
        &area,
        "agents-prepare-intent.json",
        &serde_json::json!({"name":".agents.json.pdc-runtime-closure","sha256":AUTHORITY_SHA}),
    )?;
    let prepared_agents = stage_file(
        &config,
        ".agents.json.pdc-runtime-closure",
        &authority,
        505,
        601,
        0o600,
    )?;
    journal::append(&area, "agents-prepare-result.json", &prepared_agents)?;
    journal::append(
        &area,
        "plist-prepare-intent.json",
        &serde_json::json!({"name":".ai.agent-core.runtime.plist.pdc-runtime-closure","sha256":PLIST_AFTER_SHA}),
    )?;
    let prepared_plist = stage_file(
        &plist_dir,
        ".ai.agent-core.runtime.plist.pdc-runtime-closure",
        &target_plist,
        0,
        0,
        0o644,
    )?;
    journal::append(&area, "plist-prepare-result.json", &prepared_plist)?;
    journal::append(
        &area,
        "filesystem-apply-intent.json",
        &serde_json::json!({"agents_before":EMPTY_SHA,"agents_after":AUTHORITY_SHA,"plist_before":PLIST_BEFORE_SHA,"plist_after":PLIST_AFTER_SHA,"harness_tree":digest(&staged_tree)?}),
    )?;
    journal::append(
        &area,
        "agents-apply-intent.json",
        &serde_json::json!({"preimage":EMPTY_SHA,"postimage":AUTHORITY_SHA}),
    )?;
    let agents_after = apply_file(
        &config,
        "agents.json",
        ".agents.json.pdc-runtime-closure",
        &agents_before,
        &prepared_agents,
    )?;
    journal::append(
        &area,
        "agents-apply-result.json",
        &serde_json::json!({"inode":agents_after.inode,"sha256":AUTHORITY_SHA}),
    )?;
    journal::append(
        &area,
        "plist-apply-intent.json",
        &serde_json::json!({"preimage":PLIST_BEFORE_SHA,"postimage":PLIST_AFTER_SHA}),
    )?;
    let plist_after = apply_file(
        &plist_dir,
        PLIST,
        ".ai.agent-core.runtime.plist.pdc-runtime-closure",
        &plist_before,
        &prepared_plist,
    )?;
    journal::append(
        &area,
        "plist-apply-result.json",
        &serde_json::json!({"inode":plist_after.inode,"sha256":PLIST_AFTER_SHA}),
    )?;
    journal::append(
        &area,
        "harness-apply-intent.json",
        &serde_json::json!({"preimage":"ABSENT","postimage_tree":digest(&staged_tree)?}),
    )?;
    files::absent(&live, "harness")?;
    live.rename(STAGING, &live, "harness")?;
    let installed_harness = Dir {
        file: live.open_file("harness", libc::O_RDONLY | libc::O_DIRECTORY, 0)?,
        uid: 505,
    };
    require(
        inventory::census(&installed_harness, &staged_tree, false, true)? == digest(&staged_tree)?,
        "RUNTIME_CLOSURE_HARNESS_POSTIMAGE",
    )?;
    journal::append(
        &area,
        "harness-apply-result.json",
        &serde_json::json!({"tree_digest":digest(&staged_tree)?}),
    )?;
    linked()?;
    require(
        snapshot(
            &config.open_file("agent-credentials.json", libc::O_RDONLY, 0)?,
            505,
            64 * 1024 * 1024,
        )? == credentials_before,
        "RUNTIME_CLOSURE_CREDENTIAL_DRIFT",
    )?;
    journal::append(
        &area,
        "filesystem-apply-result.json",
        &serde_json::json!({"agents_inode":agents_after.inode,"plist_inode":plist_after.inode,"harness_tree":digest(&staged_tree)?}),
    )?;

    success(
        &area,
        "runtime-bootstrap",
        &[
            "bootstrap",
            "system",
            "/Library/LaunchDaemons/ai.agent-core.runtime.plist",
        ],
    )?;
    success(&area, "runtime-kickstart", &["kickstart", "-k", LABEL])?;
    let deadline = Instant::now() + Duration::from_secs(60);
    let mut readback_attempt = 0u32;
    let (service, process_identity) = loop {
        readback_attempt += 1;
        require(readback_attempt <= 120, "RUNTIME_CLOSURE_START_TIMEOUT")?;
        let service = current_service(
            &area,
            &format!("runtime-generation-readback-{readback_attempt}"),
        )?;
        if service.code == Some(0) {
            let fields = crate::transaction::parse_launchd(&service.stdout)?;
            if fields.get("state").map(String::as_str) == Some("running") {
                let pid: u32 = fields
                    .get("pid")
                    .and_then(|v| v.parse().ok())
                    .ok_or(Error::new("RUNTIME_CLOSURE_GENERATION_UNKNOWN"))?;
                let identity = crate::transaction::first_live_process_identity(pid)?;
                break (service, identity);
            }
        }
        require(Instant::now() < deadline, "RUNTIME_CLOSURE_START_TIMEOUT")?;
        std::thread::sleep(Duration::from_millis(100));
    };
    require(
        process_identity.uid == 505
            && process_identity.gid == 601
            && process_identity.executable == format!("{LIVE}/node-runtime/bin/node"),
        "RUNTIME_CLOSURE_PROCESS_IDENTITY",
    )?;
    require(
        crate::transaction::first_live_process_argv(process_identity.pid)?
            == vec![
                format!("{LIVE}/node-runtime/bin/node"),
                format!("{LIVE}/app/scripts/production-runtime.mjs"),
                "--root".into(),
                "/Users/authsvc/.agent-core".into(),
                "--catchup".into(),
                "0".into(),
            ],
        "RUNTIME_CLOSURE_PROCESS_ARGV",
    )?;
    require(
        service
            .stdout
            .lines()
            .filter(|l| l.trim() == format!("working directory = {LIVE}/app"))
            .count()
            == 1
            && service
                .stdout
                .matches(&format!("AGENT_CORE_DEPLOYED_SHA => {SOURCE}"))
                .count()
                == 1,
        "RUNTIME_CLOSURE_GENERATION_UNKNOWN",
    )?;
    let listeners_before = listener_census(&process_identity)?;
    let health_deadline = Instant::now() + Duration::from_secs(60);
    loop {
        if crate::transaction::health::probe(
            "127.0.0.1:8790".parse().unwrap(),
            Duration::from_secs(2),
        )
        .is_ok()
        {
            break;
        }
        require(
            Instant::now() < health_deadline,
            "RUNTIME_CLOSURE_HEALTH_TIMEOUT",
        )?;
        std::thread::sleep(Duration::from_millis(100));
    }
    require(
        crate::transaction::first_live_process_identity(process_identity.pid)? == process_identity,
        "RUNTIME_CLOSURE_PROCESS_DRIFT",
    )?;
    let scheduler_health = crate::verification::native_io::get(None)?;
    let scheduler_health_value = crate::verification::documents::strict_json(&scheduler_health)?;
    crate::verification::watchdog::canonical_health(&scheduler_health_value, SOURCE)?;
    let generated = scheduler_health_value["generatedAt"]
        .as_u64()
        .ok_or(Error::new("RUNTIME_CLOSURE_HEALTH_TIME"))?;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|_| Error::new("RUNTIME_CLOSURE_HEALTH_TIME"))?
        .as_millis() as u64;
    require(
        generated <= now && now - generated <= 60_000,
        "RUNTIME_CLOSURE_HEALTH_TIME",
    )?;
    let listeners_after = listener_census(&process_identity)?;
    journal::append(
        &area,
        "generation-health.json",
        &serde_json::json!({"source":SOURCE,"process":process_identity,"listeners_before":listeners_before,"listeners_after":listeners_after,"scheduler_health_sha256":sha(&scheduler_health),"generated_at":generated}),
    )?;
    let final_service = current_service(&area, "runtime-final-generation-readback")?;
    require(
        final_service.code == Some(0),
        "RUNTIME_CLOSURE_GENERATION_UNKNOWN",
    )?;
    let final_fields = crate::transaction::parse_launchd(&final_service.stdout)?;
    require(
        final_fields.get("state").map(String::as_str) == Some("running")
            && final_fields.get("pid").and_then(|v| v.parse::<u32>().ok())
                == Some(process_identity.pid)
            && crate::transaction::first_live_process_identity(process_identity.pid)?
                == process_identity,
        "RUNTIME_CLOSURE_PROCESS_DRIFT",
    )?;
    require(
        sha(&snapshot(
            &config.open_file("agents.json", libc::O_RDONLY, 0)?,
            505,
            1024 * 1024,
        )?
        .bytes)
            == AUTHORITY_SHA
            && sha(&snapshot(
                &plist_dir.open_file(PLIST, libc::O_RDONLY, 0)?,
                0,
                1024 * 1024,
            )?
            .bytes)
                == PLIST_AFTER_SHA,
        "RUNTIME_CLOSURE_FINAL_DRIFT",
    )?;
    require(
        inventory::census(&installed_harness, &staged_tree, false, true)? == digest(&staged_tree)?,
        "RUNTIME_CLOSURE_FINAL_DRIFT",
    )?;
    verify_payload(&app, &node_dir)?;
    require(
        snapshot(
            &config.open_file("agent-credentials.json", libc::O_RDONLY, 0)?,
            505,
            64 * 1024 * 1024,
        )? == credentials_before,
        "RUNTIME_CLOSURE_CREDENTIAL_DRIFT",
    )?;
    let result = serde_json::json!({"operation_id":OP,"state":"SUCCESS","source":SOURCE,"runtime":process_identity,"agents_sha256":AUTHORITY_SHA,"harness_tree_digest":digest(&staged_tree)?,"plist_sha256":PLIST_AFTER_SHA,"workflow_sha256":WORKFLOW_SHA,"self_ops_sha256":SELF_OPS_SHA});
    journal::append(&area, "success.json", &result)?;
    control.rename(
        "runtime-closure-recovery-pending.json",
        &control,
        "runtime-closure-recovery-complete.json",
    )?;
    Ok(result)
}

pub fn run() -> Result<()> {
    match execute() {
        Ok(result) => {
            println!("RUNTIME_CLOSURE_RECOVERY {}", digest(&result)?);
            Ok(())
        }
        Err(error) => {
            if let Ok(control) = Dir::open(Path::new("/private/var/db/agent-deployd"), 0) {
                if let Ok(area) = control.child(OP) {
                    let state = match control.open_file(
                        "runtime-closure-recovery-pending.json",
                        libc::O_RDONLY,
                        0,
                    ) {
                        Err(absent) if absent.code() == "ABSENT" => "BLOCKED_NO_MUTATION",
                        _ => "QUARANTINED",
                    };
                    let _ = journal::append(
                        &area,
                        "failure.json",
                        &serde_json::json!({"operation_id":OP,"state":state,"code":error.code(),"retry_forbidden":true,"rollback":"UNSAFE_ROLLBACK"}),
                    );
                }
            }
            Err(error)
        }
    }
}

fn face(image: &FileImage, preimage: &FileImage, prepared: Option<&FileImage>) -> &'static str {
    if image == preimage {
        "PREIMAGE"
    } else if prepared.is_some_and(|expected| image == expected) {
        "POSTIMAGE"
    } else if prepared.is_none() {
        "UNKNOWN"
    } else {
        "DRIFT"
    }
}

/// Bounded read-only discriminator for a retained recovery fence. It never
/// clears pending state, writes a journal record, restarts a service, or replays
/// an effect.
pub fn status() -> Result<Value> {
    require(
        unsafe { libc::geteuid() } == 0,
        "RUNTIME_CLOSURE_ROOT_REQUIRED",
    )?;
    require(
        std::env::current_exe()? == Path::new(EXECUTABLE),
        "RUNTIME_CLOSURE_FIXED_EXECUTABLE",
    )?;
    let control = Dir::open(Path::new("/private/var/db/agent-deployd"), 0)?;
    let guard = MutationGuard::acquire_readonly(&control)?;
    guard.binds(&control)?;
    let pending: Value = files::read(&control, "runtime-closure-recovery-pending.json")?;
    require(
        pending["operation_id"] == OP
            && pending["state"] == "MUTATION_PENDING"
            && pending["retry_forbidden"] == true
            && pending.as_object().is_some_and(|v| v.len() == 3),
        "RUNTIME_CLOSURE_PENDING_MALFORMED",
    )?;
    let area = control.child(OP)?;
    let preimage: Value = files::read(&area, "private-preimage.json")?;
    let agents_pre: FileImage = serde_json::from_value(preimage["agents"].clone())?;
    let plist_pre: FileImage = serde_json::from_value(preimage["plist"].clone())?;
    let credentials_pre: FileImage = serde_json::from_value(preimage["credentials"].clone())?;
    let agents_prepared = files::read::<FileImage>(&area, "agents-prepare-result.json").ok();
    let plist_prepared = files::read::<FileImage>(&area, "plist-prepare-result.json").ok();
    let config = Dir::open(Path::new(&format!("{LIVE}/config")), 505)?;
    let plist_dir = Dir::open(Path::new("/Library/LaunchDaemons"), 0)?;
    let agents = snapshot(
        &config.open_file("agents.json", libc::O_RDONLY, 0)?,
        505,
        1024 * 1024,
    )?;
    let plist = snapshot(
        &plist_dir.open_file(PLIST, libc::O_RDONLY, 0)?,
        0,
        1024 * 1024,
    )?;
    let credentials = snapshot(
        &config.open_file("agent-credentials.json", libc::O_RDONLY, 0)?,
        505,
        64 * 1024 * 1024,
    )?;
    let packet = Dir::open(Path::new(PACKET), 0)?;
    let inventory_raw = packet_file(
        &packet,
        "harness-inventory.json",
        INVENTORY_SHA,
        64 * 1024 * 1024,
    )?;
    let inventory: inventory::Tree = serde_json::from_slice(&inventory_raw)?;
    let live = Dir::open(Path::new(LIVE), 0)?;
    let harness = match live.open_file("harness", libc::O_RDONLY | libc::O_DIRECTORY, 0) {
        Err(error) if error.code() == "ABSENT" => "ABSENT".to_string(),
        Err(_) => "UNKNOWN".to_string(),
        Ok(file) => {
            match inventory::capture_equivalent(&Dir { file, uid: 505 }, &inventory, true)
                .and_then(|captured| digest(&captured))
            {
                Ok(captured_digest) => {
                    match files::read::<Value>(&area, "harness-stage-result.json") {
                        Ok(record) if record["tree_digest"] == captured_digest => {
                            "POSTIMAGE".into()
                        }
                        _ => "UNKNOWN".into(),
                    }
                }
                Err(_) => "DRIFT".into(),
            }
        }
    };
    let staging = match live.open_file(STAGING, libc::O_RDONLY | libc::O_DIRECTORY, 0) {
        Err(error) if error.code() == "ABSENT" => "ABSENT".to_string(),
        Err(_) => "UNKNOWN".to_string(),
        Ok(file) => {
            match inventory::capture_equivalent(&Dir { file, uid: 505 }, &inventory, true)
                .and_then(|captured| digest(&captured))
            {
                Ok(captured_digest) => {
                    match files::read::<Value>(&area, "harness-stage-result.json") {
                        Ok(record) if record["tree_digest"] == captured_digest => "STAGED".into(),
                        _ => "UNKNOWN".into(),
                    }
                }
                Err(_) => "DRIFT".into(),
            }
        }
    };
    let service = process::run(
        process::Tool::Launchctl,
        LAUNCHCTL_SHA,
        &["print".into(), LABEL.into()],
        None,
        10,
    )?;
    let mut status_process = None;
    let mut service_face = if service.code == Some(113) {
        "ABSENT".to_string()
    } else if service.code == Some(0) {
        let fields = crate::transaction::parse_launchd(&service.stdout)?;
        if service
            .stdout
            .contains("d602b592fad345fb1c9adebe2bc6611a6f5cfdc2")
            && fields.get("state").map(String::as_str) != Some("running")
            && !fields.contains_key("pid")
        {
            "PREIMAGE".to_string()
        } else if service
            .stdout
            .matches(&format!("AGENT_CORE_DEPLOYED_SHA => {SOURCE}"))
            .count()
            == 1
            && service
                .stdout
                .lines()
                .filter(|line| line.trim() == format!("working directory = {LIVE}/app"))
                .count()
                == 1
            && fields.get("state").map(String::as_str) == Some("running")
        {
            let pid = fields
                .get("pid")
                .and_then(|value| value.parse::<u32>().ok())
                .ok_or(Error::new("RUNTIME_CLOSURE_GENERATION_UNKNOWN"))?;
            let identity = crate::transaction::first_live_process_identity(pid)?;
            require(
                identity.uid == 505
                    && identity.gid == 601
                    && identity.executable == format!("{LIVE}/node-runtime/bin/node"),
                "RUNTIME_CLOSURE_PROCESS_IDENTITY",
            )?;
            require(
                crate::transaction::first_live_process_argv(identity.pid)?
                    == vec![
                        format!("{LIVE}/node-runtime/bin/node"),
                        format!("{LIVE}/app/scripts/production-runtime.mjs"),
                        "--root".into(),
                        "/Users/authsvc/.agent-core".into(),
                        "--catchup".into(),
                        "0".into(),
                    ],
                "RUNTIME_CLOSURE_PROCESS_ARGV",
            )?;
            status_process = Some(identity);
            "POSTIMAGE".to_string()
        } else {
            "UNKNOWN".to_string()
        }
    } else {
        "UNKNOWN".to_string()
    };
    if service_face == "POSTIMAGE" {
        let process = status_process.ok_or(Error::new("RUNTIME_CLOSURE_PROCESS_IDENTITY"))?;
        let canonical = listener_census(&process)
            .and_then(|_| {
                crate::transaction::health::probe(
                    "127.0.0.1:8790".parse().unwrap(),
                    Duration::from_secs(2),
                )
            })
            .and_then(|_| crate::verification::native_io::get(None))
            .and_then(|bytes| {
                let value = crate::verification::documents::strict_json(&bytes)?;
                crate::verification::watchdog::canonical_health(&value, SOURCE)?;
                Ok(())
            })
            .and_then(|_| listener_census(&process))
            .and_then(|_| {
                require(
                    crate::transaction::first_live_process_identity(process.pid)? == process,
                    "RUNTIME_CLOSURE_PROCESS_DRIFT",
                )
            });
        if canonical.is_err() {
            service_face = "UNKNOWN".into();
        }
    }
    let journal_files = area.names_bounded(128)?;
    Ok(serde_json::json!({
        "operation_id":OP,
        "state":"READ_ONLY_RECONCILIATION",
        "agents":face(&agents,&agents_pre,agents_prepared.as_ref()),
        "plist":face(&plist,&plist_pre,plist_prepared.as_ref()),
        "credentials":if credentials==credentials_pre {"PREIMAGE"} else {"DRIFT"},
        "harness":harness,
        "staging":staging,
        "service":service_face,
        "journal_files":journal_files,
        "production_mutation":false
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn authority_shape_rejects_empty_and_accepts_exact_shape() {
        assert!(
            validate_authority_shape(br#"{"version":1,"defaultAgentId":null,"agents":[]}"#)
                .is_err()
        );
        let default = "agt_fb7837711a9d4c3393dcffa83f49dd41";
        let mut agents = (0..97)
            .map(|i| serde_json::json!({"id":format!("agt_fixture_{i}"),"disabled":false}))
            .collect::<Vec<_>>();
        agents.push(serde_json::json!({"id":default,"disabled":false}));
        let bytes = serde_json::to_vec(
            &serde_json::json!({"version":1,"defaultAgentId":default,"agents":agents}),
        )
        .unwrap();
        validate_authority_shape(&bytes).unwrap();
        agents[0]["id"] = serde_json::json!(default);
        let duplicate = serde_json::to_vec(
            &serde_json::json!({"version":1,"defaultAgentId":default,"agents":agents}),
        )
        .unwrap();
        assert!(validate_authority_shape(&duplicate).is_err());
    }
    #[test]
    fn fixed_effects_do_not_include_business_payload_paths() {
        assert_eq!(LABEL, "system/ai.agent-core.runtime");
        assert_eq!(LIVE, "/usr/local/libexec/agent-core");
        assert!(![WORKFLOW_SHA, SELF_OPS_SHA].contains(&AUTHORITY_SHA));
    }

    #[test]
    fn atomic_apply_rejects_preimage_drift() {
        let temp = tempfile::tempdir_in(crate::fs::FixtureRoots::kernel_temp().unwrap()).unwrap();
        let uid = unsafe { libc::geteuid() };
        let gid = unsafe { libc::getegid() };
        let dir = Dir::open(temp.path(), uid).unwrap();
        let first = write_new(&dir, "value", b"before", uid, gid, 0o600).unwrap();
        let before = snapshot(&first, uid, 1024).unwrap();
        let next = write_new(&dir, "next", b"after", uid, gid, 0o600).unwrap();
        let prepared = snapshot(&next, uid, 1024).unwrap();
        dir.unlink("value").unwrap();
        write_new(&dir, "value", b"foreign", uid, gid, 0o600).unwrap();
        assert!(apply_file(&dir, "value", "next", &before, &prepared).is_err());
        assert_eq!(files::raw(&dir, "value").unwrap(), b"foreign");
    }

    #[test]
    fn status_face_never_labels_unattributed_bytes_as_postimage() {
        let pre = FileImage {
            bytes: b"before".to_vec(),
            uid: 1,
            gid: 2,
            mode: 0o600,
            device: 3,
            inode: 4,
            xattrs: Default::default(),
            mtime_seconds: 5,
            mtime_nanos: 6,
        };
        assert_eq!(face(&pre, &pre, None), "PREIMAGE");
        let mut post = pre.clone();
        post.bytes = b"after".to_vec();
        post.inode = 7;
        assert_eq!(face(&post, &pre, None), "UNKNOWN");
        let prepared = post.clone();
        assert_eq!(face(&post, &pre, Some(&prepared)), "POSTIMAGE");
        post.inode = 8;
        assert_eq!(face(&post, &pre, Some(&prepared)), "DRIFT");
        post = prepared.clone();
        post.xattrs.insert("foreign".into(), b"value".to_vec());
        assert_eq!(face(&post, &pre, Some(&prepared)), "DRIFT");
        post = prepared.clone();
        post.mtime_nanos += 1;
        assert_eq!(face(&post, &pre, Some(&prepared)), "DRIFT");
        post = prepared.clone();
        post.device += 1;
        assert_eq!(face(&post, &pre, Some(&prepared)), "DRIFT");
        post.bytes = b"foreign".to_vec();
        assert_eq!(face(&post, &pre, Some(&prepared)), "DRIFT");
    }

    #[test]
    fn listener_evidence_is_exactly_pid_and_port_bound() {
        let valid = "p123\ncnode\nf17u\nPTCP\nn127.0.0.1:8790\nTST=LISTEN\nTQR=0\nTQS=0\n";
        validate_listener_output(valid, 123, 8790).unwrap();
        assert!(validate_listener_output(valid, 124, 8790).is_err());
        assert!(validate_listener_output(valid, 123, 8787).is_err());
        assert!(validate_listener_output(&format!("{valid}f18u\n"), 123, 8790).is_err());
        assert!(validate_listener_output(&format!("{valid}n127.0.0.1:1\n"), 123, 8790).is_err());
    }
}
