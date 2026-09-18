//! Nonprivileged client for the fixed producer intake. No sudo path is provided.
fn main() {
    let args: Vec<_> = std::env::args().collect();
    if args.len() == 2 && args[1] == "review-child" {
        if let Err(error) = deployment_control_plane::issuer::review::exec_native_child() {
            eprintln!("{error}");
            std::process::exit(1);
        }
        return;
    }
    let result = if args.len() == 4 && args[1] == "prepare" {
        deployment_control_plane::issuer::server::request(&args[2], &args[3])
    } else if args.len() == 4
        && args[1] == "observe-public-source"
        && unsafe { libc::geteuid() } != 0
    {
        (|| {
            let bytes = std::fs::read(&args[3])?;
            if bytes.len() > 1_048_576 {
                return Err(deployment_control_plane::Error::new("SIZE_LIMIT"));
            }
            let policy: deployment_control_plane::issuer::github::SourcePolicy =
                serde_json::from_slice(&bytes)?;
            let observed = deployment_control_plane::issuer::github::observe(&policy, &args[2])?;
            let built = deployment_control_plane::issuer::source::build_regular_files(
                &policy.slots,
                &observed.files,
            )?;
            Ok(
                serde_json::json!({"source":observed.source_sha,"tree":observed.tree_sha,"canonical_lineage_digest":observed.canonical_lineage_digest,"artifact":built.artifact_digest,"slots":built.manifest.entries,"signed":false}),
            )
        })()
    } else {
        Err(deployment_control_plane::Error::new(
            "USAGE_PREPARE_GOAL_SOURCE",
        ))
    };
    match result {
        Ok(value) => println!("{value}"),
        Err(error) => {
            eprintln!("{error}");
            std::process::exit(1);
        }
    }
}
