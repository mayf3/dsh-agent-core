fn main() {
    let args: Vec<_> = std::env::args().skip(1).collect();
    let sandbox = args == ["--sandbox"];
    let result = if !args.is_empty() && !sandbox {
        Err(deployment_control_plane::Error::new("ARGUMENTS"))
    } else {
        deployment_control_plane::service::run(sandbox)
    };
    if let Err(error) = result {
        eprintln!("BLOCKED {}", error.code());
        std::process::exit(1);
    }
}
