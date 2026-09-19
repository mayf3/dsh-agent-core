fn main() {
    let args: Vec<_> = std::env::args().skip(1).collect();
    let sandbox = args == ["--sandbox"];
    let result = if args == ["--first-live-completion"] {
        deployment_control_plane::run_first_live_completion()
    } else if args == ["--first-live-host-readonly-probe"] {
        deployment_control_plane::run_first_live_host_readonly_probe()
            .and_then(|value| deployment_control_plane::trust::canonical_bytes(&value))
            .map(|bytes| println!("{}", String::from_utf8_lossy(&bytes)))
    } else if args == ["--first-live-and-enable"] {
        deployment_control_plane::run_first_live_and_enable()
    } else if args == ["--first-live-recovery-and-enable"] {
        deployment_control_plane::run_first_live_recovery_and_enable()
    } else if args == ["--first-live"] {
        deployment_control_plane::run_first_live()
    } else if args
        .first()
        .is_some_and(|arg| arg.starts_with("--") && arg != "--sandbox")
    {
        deployment_control_plane::service::run_adoption(&args).map(|value| println!("{value}"))
    } else if !args.is_empty() && !sandbox {
        Err(deployment_control_plane::Error::new("ARGUMENTS"))
    } else {
        deployment_control_plane::service::run(sandbox)
    };
    if let Err(error) = result {
        eprintln!("BLOCKED {}", error.code());
        std::process::exit(1);
    }
}
