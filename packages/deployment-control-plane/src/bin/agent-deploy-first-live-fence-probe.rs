fn main() {
    let result = if std::env::args_os().len() == 1 {
        deployment_control_plane::run_first_live_fence_capability_probe()
    } else {
        Err(deployment_control_plane::Error::new("ARGUMENTS"))
    };
    match result {
        Ok(value) => println!("{value}"),
        Err(error) => {
            eprintln!("BLOCKED {error}");
            std::process::exit(1);
        }
    }
}
